// Ground-cover renderer — flora.ts's selection field, standing up in the world.
//
// ★ ONE InstancedMesh PER KIND, NON-NEGOTIABLE (piece-mesh's rule, same reasoning): a meadow is
// tens of thousands of tufts, and anything per-tuft is the WebGL-context-loss bug. Six draws total:
// tufts, tall grass, flower stems, flower heads (heads split out so instanceColor can tint the bloom
// without turning the stem pink), and — since 2026-08-18 — herb bodies and herb tips, which is how
// canon's four element herbs cost two draws between them instead of eight.
//
// ★ THE RENDERER OWNS SURFACE TRUTH. flora.ts says what WOULD grow; the probe (VoxelWorld's live
// voxel read) says whether the actual ground is still topsoil with air above — so player-dug holes
// shed their tufts and placed blocks never wear a flower hat. Per-column spot lists are cached and
// invalidated on edit; a sync assembles instance buffers from cache, so the per-frame cost of the
// whole feature is one uniform write.
//
// ★ WIND IS A SHADER, PHASE IS POSITION. The sway reads instanceMatrix translation for its phase
// ((x+z)·k = a travelling wave, so gusts ROLL across a meadow instead of every blade metronoming
// in sync), weighted by uv.y so roots stay planted. CPU never touches a standing instance.

import * as THREE from 'three'
import { bladePixels, headPixels, HEAD_TINTS, BLADE_GREEN, TUFT_SEED, TUFT_BLADES, TALL_SEED, TALL_BLADES } from './tex/flora-tex'
import { cropStalkPixels, cropHeadPixels } from './tex/crop-tex'
import { FLORA } from '../voxel/flora'
import { MATERIAL_COLOR } from './attrs'
import { MAT } from '../voxel/depth'

const SECTION = 16

/**
 * ── ★ SCATTER COLOURS, AND THEY ARE NOT MULTIPLIERS ────────────────────────────────────────────
 * ⚠ THE ONE TRAP HERE IS THAT THESE READ NOTHING LIKE `GRASS_OF_GROUND` BELOW, AND MUST NOT.
 * A blade's `instanceColor` is `target / BLADE_GREEN` — a MULTIPLIER — because the blade texture is
 * painted green and a green texture cannot multiply into straw. Scatter geometry carries NO map at
 * all, so its material colour is plain white and `instanceColor` lands as the FINAL colour. Divide
 * these by anything and you get a black stone. Same field, opposite arithmetic, one screen apart.
 *
 * ★ A STONE TAKES ITS COLOUR FROM THE GROUND IT LIES ON — slice ②'s lesson, and for the same
 * reason it was learned: one grey stone on nine different grounds is half of what "samey" meant.
 * ⚠ A GROUND ABSENT FROM THIS TABLE FALLS BACK TO neutral grey, never black or magenta.
 */
const ROCK_OF_GROUND: Readonly<Record<number, number>> = {
  [MAT.TOPSOIL]: 0x8a8880,
  [MAT.FOREST_LOAM]: 0x7b756a,   // damp wood floor — darker, a little brown in it
  [MAT.LUSH_TURF]: 0x848275,
  [MAT.MARSH_MUD]: 0x6e6a5a,     // wet, silt-stained
  [MAT.DRY_GRASS]: 0x9e9784,     // dusty, sun-bleached
  [MAT.HIGHLAND_TURF]: 0x8d8b86,
  [MAT.SCREE]: 0x97948c,         // the stone it broke off — lightest, and the land with the most
}
const ROCK_FALLBACK = 0x8a8880

/** Weathered, barkless, sun-greyed — deliberately NOT any species' fresh log colour. */
const DEADFALL_COLOR = 0x6b5c47
const SHROOM_STEM_COLOR = 0xe0d6bd
/** Placeholder caps. Generic build vocabulary — canon names no fungus, so neither do we. */
const SHROOM_CAPS = [0xa8503c, 0xc08a45, 0x8f6f9e, 0xb8ab86] as const

/** Instance caps — generous against radius-12 meadow country; sync stops quietly at the cap. */
// Scatter caps are far below grass because scatter IS rare (~1-3% of columns against grass's 13%).
// Sized against the measured worst case — a crag at rockK 3.0 is 3% of its columns — with headroom.
const CAP = { tuft: 24000, tall: 6000, flower: 9000, herb: 4000, rock: 5000, log: 4000, shroom: 3000, crop: 4000 } as const

/**
 * ── ★ THE FOUR ELEMENT HERBS, AS ONE SHAPE IN FOUR COLOURS (2026-08-18) ────────────────────────
 * A taller cross card with a tinted TIP riding above it — body colour and tip colour per species,
 * both instance-tinted, so four canon plants cost two draws instead of eight.
 *
 * ★ THE TIP IS NOT DECORATION FOR ONE OF THEM: canon calls Stormgrass *"blue-tipped blades"*, so
 * blade-plus-tip is that plant drawn literally, and it carries the other three honestly enough at
 * this size (a bloom, a bead, a coil's crown are all "something at the top of a stalk").
 *
 * ⚠ ALL FOUR SHARE A SILHOUETTE, AND THAT IS THE PLACEHOLDER. Colour is doing all the work of
 * telling them apart, which is exactly what the vessels brief warns against for a shelf of bottles.
 * They stand on four different grounds so a player never sees two side by side — that is what makes
 * this survivable, not good. **Distinct silhouettes are Alex's call** (art), and the canon text is
 * already specific enough to draw from: a bloom that hums, blue-tipped blades, a deep-anchored coil,
 * a petal beaded with moisture.
 */
/**
 * ── ★★ THE RIPE HEAD, AND WHY IT IS A SEPARATE TINT (2026-08-22) ───────────────────────────────
 * Split from the stalk for the same reason the flower's head is split from its stem: an
 * `instanceColor` can make the grain gold without turning the stalk gold too. One extra draw buys
 * every crop its own ripe colour, and ripeness is the single most useful thing a crop can signal —
 * it is what tells a keeper the bed is worth walking to.
 *
 * ★★ AND THIS TABLE IS SHARED BY WILD AND PLANTED CROPS ON PURPOSE. A wild Atherwheat on a meadow
 * and one grown in a garden bed are the same plant, so they are the same pixels and the same tint.
 * The two feeds differ only in where the instances come from — a selection field for the wild, a
 * bed Map for the planted — which is the whole reason there is ONE renderer here rather than two.
 * Two renderers over one plant is the mirror shape: they agree until somebody tunes one.
 */
const CROP_HEAD: Readonly<Record<number, number>> = {
  [MAT.MOONVINE]: 0xcfd4ff,      // night-opening bloom, moonlit white-blue
  [MAT.STARBEAN]: 0x4f5f3a,      // a hard dark pod — deliberately NOT brighter than its stem
  [MAT.CRYSTALCAP]: 0xdff0ff,    // the facet catching light
  [MAT.DREAMROOT]: 0xc8a0d8,     // the bloom over the root, paler than the body
  [MAT.SHIMMERBLOOM]: 0xfff0d0,  // sun on a shore petal
  [MAT.ATHERWHEAT]: 0xf0d890,    // ripe grain, the one everybody recognises
  [MAT.DAWNCAP]: 0xffc890,       // first light, warmest note in the world
}

const HERB_TIP: Readonly<Record<number, number>> = {
  [MAT.VIOLETBLOOM]: 0xd9b0ff,   // the hum, made visible — the one that glows a little
  [MAT.STORMGRASS]: 0x9fe4ff,    // canon's blue tip, verbatim
  [MAT.ROOTVINE]: 0x7f8f4a,      // a pale crown over dark root-green; the plant is the STEM here
  [MAT.TIDEPETAL]: 0xeafffb,     // beaded — near white, wet
}

/** Placeholder palette, tiles.ts's register: greens off TOPSOIL, heads in mana-adjacent pastels. */

/**
 * ── ★ GRASS TAKES ITS COLOUR FROM THE GROUND IT GROWS IN (slice ②, 2026-08-19) ─────────────────
 * Ground cover was ONE green everywhere. Flower heads have been tinted by variant and herbs by
 * material since they shipped, but tufts and tall grass shared a single blade texture with no
 * instance colour at all — so the grass on a barrens' straw read identically to the grass in a wet
 * dell, which quietly undid a good part of what the ground layer bought: you would walk from green
 * turf to straw turf and the thing standing ON it never changed.
 *
 * ★ THESE ARE TARGET COLOURS, NOT MULTIPLIERS, and the difference is the whole reason this is
 * readable. The blade texture is painted in `BLADE_GREEN` with an additive per-pixel shade, so a
 * multiplicative tint can only ever darken it and no product of a green texture will ever look like
 * straw. Instead each ground names the colour its grass SHOULD be, and the multiplier is derived
 * (target / BLADE_GREEN) — which may exceed 1 per channel, which is fine: `instanceColor` is a
 * float attribute and the shader multiplies.
 *
 * ⚠ TOPSOIL IS `BLADE_GREEN` EXACTLY, so its multiplier is exactly (1,1,1) and the world's most
 * common ground looks byte-identical to how it looked before this existed. That is deliberate: a
 * change meant to add variety must not quietly restyle the 45% case as a side effect.
 *
 * ⚠ A GROUND ABSENT FROM THIS TABLE FALLS BACK TO BLADE_GREEN — it does not go black or magenta.
 * Ground cover only grows on `TURF`, so the table needs one row per turf and nothing else; a new
 * turf added without a row is merely un-tinted, which is the right failure for a look table.
 */
const GRASS_OF_GROUND: Readonly<Record<number, number>> = {
  [MAT.TOPSOIL]: 0x569e42,        // === BLADE_GREEN. Multiplier (1,1,1). Do not "tidy" this away.
  [MAT.FOREST_LOAM]: 0x3f7a38,    // deeper and bluer under a closed canopy
  [MAT.LUSH_TURF]: 0x63bc46,      // a wet valley floor: the most alive grass in the world
  [MAT.DRY_GRASS]: 0xa89a52,      // straw — the one that could never have come from a multiply
  [MAT.HIGHLAND_TURF]: 0x74a06a,  // cooler and greyer, hardy turf at altitude
}

interface Spot { x: number; y: number; z: number; kind: number; variant: number; mat: number; ground: number; alongX?: boolean }

/**
 * ── ★ THE VOXEL DECIDES WHETHER A PLANT IS THERE (2026-08-11) ──────────────────────────────────
 * This renderer used to ASK `floraAt` what grows here, which made ground cover a fiction only the
 * renderer could see — nothing could target it, break it, drop it or save it. Now the world is the
 * source of truth: the probe reports the plant VOXEL standing at (x, z) and the ground top to
 * stand it on, or null. Pick a flower and it is gone because the block is gone, through exactly
 * the same edit path a mined stone takes.
 *
 * `kind` comes from the voxel; `variant` stays a pure function of position (see flora.ts) so the
 * look never has to be stored and picking one plant cannot restyle its neighbour. `y` is
 * fractional on a slumped lip — it is a ground height, not a cell index.
 */
export type PlantProbe = (x: number, z: number) => { y: number; kind: number; variant: number; mat: number; ground: number; alongX?: boolean } | null

export interface FloraRenderer {
  group: THREE.Group
  /** Rebuild buffers from the loaded columns. Column spot lists are cached until invalidated. */
  sync(cols: { key: string; x0: number; z0: number }[], seed: number, probe: PlantProbe): void
  /** Drop a column's cached spots (its ground changed — an edit landed). */
  invalidate(colKey: string): void
  /**
   * Drop EVERY column's cached spots.
   *
   * ★ FOR CROSSING BETWEEN SPACES, AND IT IS NOT THE SAME AS LETTING `sync` PRUNE (2026-08-15).
   * `sync` drops cache entries whose key is no longer loaded — which is exactly the wrong rule at a
   * space change, because **Wilds column "0,0" and Home Plot column "0,0" are the same key.** The
   * stale entry stays "live" and the garden is handed the Wilds' ground cover for that column. Same
   * two-spaces-one-name hazard `save.ts` namespaces its records against.
   */
  invalidateAll(): void
  tick(elapsed: number): void
  dispose(): void
}

/** A crossed pair of 1×1 quads, base at y=0, uv.y 0 at the root — the sway weight rides on it.
 *  Normals point UP so a blade lights like the ground it grows from (the standard grass-card
 *  trick; a real face normal would moonlight one side of every blade). */
function buildCrossGeometry(width: number, height: number, yBase = 0): THREE.BufferGeometry {
  const hw = width / 2
  const pos: number[] = []
  const uv: number[] = []
  const nrm: number[] = []
  const idx: number[] = []
  const quad = (ax: number, az: number, bx: number, bz: number) => {
    const base = pos.length / 3
    pos.push(ax, yBase, az, bx, yBase, bz, bx, yBase + height, bz, ax, yBase + height, az)
    uv.push(0, 0, 1, 0, 1, 1, 0, 1)
    nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0)
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  quad(-hw, 0, hw, 0)
  quad(0, -hw, 0, hw)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setIndex(idx)
  return g
}

/**
 * ★ THE PIXELS MOVED TO `tex/flora-tex.ts` AND THESE ARE NOW WRAPPERS (2026-08-12).
 * Ground cover has no block face, so its ITEM ICON had nothing to derive from and grass was on the
 * list for Alex to hand-paint. But the world draws grass from CODE, so the icon needs the same
 * generator rather than new art — hand-painting one would have created a second source of truth for
 * what a tuft looks like, which is exactly what `item-icon.ts` refuses for blocks. The fills are
 * three-free now; all that lives here is the GPU wrapper.
 */
function toTexture(data: Uint8Array, size: number): THREE.DataTexture {
  const t = new THREE.DataTexture(data, size, size)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

const makeBladeTexture = (seed: number, blades: number, size = 16): THREE.DataTexture =>
  toTexture(bladePixels(seed, blades, size), size)

const makeHeadTexture = (size = 8): THREE.DataTexture => toTexture(headPixels(size), size)

export function createFloraRenderer(): FloraRenderer {
  const uTime = { value: 0 }

  /** Lambert so flora lives under the same day-night lights as the pieces; the sway is injected
   *  and the material stays ONE compiled program per mesh (audit's whole point). */
  const swayMaterial = (map: THREE.Texture, amp: number): THREE.MeshLambertMaterial => {
    const m = new THREE.MeshLambertMaterial({ map, alphaTest: 0.4, side: THREE.DoubleSide })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
  float ph = (instanceMatrix[3].x + instanceMatrix[3].z) * 0.35;
  float w = uv.y * ${amp.toFixed(3)};
  transformed.x += sin(uTime * 1.5 + ph) * w;
  transformed.z += cos(uTime * 1.1 + ph * 1.3) * w * 0.7;
  #endif
}`)
    }
    return m
  }

  const bladeTex = makeBladeTexture(TUFT_SEED, TUFT_BLADES)
  const tallTex = makeBladeTexture(TALL_SEED, TALL_BLADES)
  const headTex = makeHeadTexture()

  // Widths chosen against the jitter so a blade can never overhang its cell (w/2 + 0.15 ≤ 0.5):
  // on a terrace step, grass leaning out over the riser reads as floating from below.
  const tuftGeo = buildCrossGeometry(0.7, 0.55)
  const tallGeo = buildCrossGeometry(0.7, 1.05)
  const stemGeo = buildCrossGeometry(0.5, 0.62)
  const headGeo = buildCrossGeometry(0.3, 0.3, 0.55)   // a small cross riding near the stem's top
  // A herb stands taller than a wildflower and shorter than tall grass: it has to be findable from
  // a few blocks away (it is the thing you came for) without hiding what is behind it.
  const herbGeo = buildCrossGeometry(0.55, 0.8)
  // ⚠ A CROP STANDS TALLER THAN A HERB AND THAT IS INFORMATION, NOT DRESSING. A herb is findable
  // from a distance because it is rare; a crop has to read as *cultivated* — a stand of grain is
  // chest-high and that silhouette is what separates a field from a meadow. Unit height, because
  // the PLANTED feed scales it per growth phase and the wild feed leaves it at full.
  const cropGeo = buildCrossGeometry(0.62, 1.0)
  // The head rides at the top of a full-height stalk. Scaled with the stalk by the instance matrix,
  // so a half-grown planted crop carries a half-height head rather than a floating one.
  const cropHeadGeo = buildCrossGeometry(0.42, 0.30, 0.72)
  const tipGeo = buildCrossGeometry(0.34, 0.34, 0.72)

  // ── ★★ SCATTER IS SOLID AND DOES NOT SWAY (2026-08-19, slice ③) ──────────────────────────────
  // Every material above injects a sway into its vertex shader, and that is correct for an alpha
  // card standing on a stalk. A stone that sways is a bug you cannot unsee, and a fallen log that
  // breathes is worse. So these three get real geometry and a plain Lambert: no `onBeforeCompile`,
  // no `alphaTest` (nothing is cut out), `side: FrontSide` because a closed solid never shows its
  // interior — which also halves their fill cost against the double-sided cards.
  //
  // ⚠ PLACEHOLDER FORMS, LIKE EVERY MATERIAL IN THIS WORLD. An icosahedron is a stone the way a
  // corked bottle was an infusion vessel: honest, readable at range, and waiting for Alex's call on
  // what the Ather's ground furniture actually looks like. Silhouette is what is being fixed here —
  // that a rock reads as a lump, a log as a long low bar, a mushroom as a stalk with a cap.
  const solidMaterial = (): THREE.MeshLambertMaterial =>
    new THREE.MeshLambertMaterial({ side: THREE.FrontSide })

  // A stone: low, angular, wider than tall so it reads as lying ON the ground rather than set INTO
  // it. Flattened on Y by the instance scale below rather than in the geometry, so one buffer
  // serves every size.
  const rockGeo = new THREE.IcosahedronGeometry(0.21, 0)
  // A log: EXACTLY ONE CELL LONG (1.0) so consecutive cells of a run butt against each other into a
  // continuous trunk with no gap and no overlap. Six-sided rather than smooth — this world's
  // vocabulary is faceted, and a 6-gon costs 12 triangles. Built lying along +X; the instance
  // quaternion turns it a quarter turn for a Z-axis log (see `alongX`).
  const logGeo = new THREE.CylinderGeometry(0.15, 0.13, 1.0, 6)
  logGeo.rotateZ(Math.PI / 2)
  // A mushroom in two parts, for the same reason a herb is body-plus-tip: the cap carries the
  // colour and the silhouette, the stalk just holds it up.
  const shroomStemGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.24, 5)
  shroomStemGeo.translate(0, 0.12, 0)
  const shroomCapGeo = new THREE.ConeGeometry(0.17, 0.15, 8)
  shroomCapGeo.translate(0, 0.30, 0)

  const rockMat = solidMaterial()
  const logMat = solidMaterial()
  const shroomStemMat = solidMaterial()
  const shroomCapMat = solidMaterial()

  const herbMat = swayMaterial(bladeTex, 0.07)
  // Sway a touch stiffer than a herb: a laden crop is heavier and a field that ripples like grass
  // reads as grass. Its own tiles, so a crop is never accidentally drawn with a blade texture.
  const cropStalkTex = toTexture(cropStalkPixels(3), 16)
  const cropHeadTex = toTexture(cropHeadPixels(8), 8)
  const cropMat = swayMaterial(cropStalkTex, 0.05)
  const cropHeadMat = swayMaterial(cropHeadTex, 0.05)
  const tipMat = swayMaterial(headTex, 0.07)
  const tuftMat = swayMaterial(bladeTex, 0.05)
  const tallMat = swayMaterial(tallTex, 0.1)
  const stemMat = swayMaterial(bladeTex, 0.08)
  const headMat = swayMaterial(headTex, 0.08)

  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, CAP.tuft)
  const talls = new THREE.InstancedMesh(tallGeo, tallMat, CAP.tall)
  // Slice ②: the blades take the colour of the ground under them (see GRASS_OF_GROUND).
  tufts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.tuft * 3), 3)
  talls.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.tall * 3), 3)
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, CAP.flower)
  const heads = new THREE.InstancedMesh(headGeo, headMat, CAP.flower)
  heads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.flower * 3), 3)
  const herbs = new THREE.InstancedMesh(herbGeo, herbMat, CAP.herb)
  const tips = new THREE.InstancedMesh(tipGeo, tipMat, CAP.herb)
  const crops = new THREE.InstancedMesh(cropGeo, cropMat, CAP.crop)
  const cropHeads = new THREE.InstancedMesh(cropHeadGeo, cropHeadMat, CAP.crop)
  crops.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.crop * 3), 3)
  cropHeads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.crop * 3), 3)
  // BOTH halves are tinted, unlike the flower (whose stem stays green): a herb's body colour is
  // most of what identifies it, and four species sharing one silhouette have nothing else to say.
  herbs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.herb * 3), 3)
  tips.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.herb * 3), 3)
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, CAP.rock)
  const logs = new THREE.InstancedMesh(logGeo, logMat, CAP.log)
  const shroomStems = new THREE.InstancedMesh(shroomStemGeo, shroomStemMat, CAP.shroom)
  const shroomCaps = new THREE.InstancedMesh(shroomCapGeo, shroomCapMat, CAP.shroom)
  // ★ ALL FOUR ARE INSTANCE-TINTED. A stone takes its colour from the GROUND it lies on — the same
  // move slice ② made for grass, and for the same reason: one grey stone on nine different grounds
  // was half of what "samey" meant. The cap colour is the mushroom's whole identity.
  rocks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.rock * 3), 3)
  logs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.log * 3), 3)
  shroomStems.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.shroom * 3), 3)
  shroomCaps.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.shroom * 3), 3)

  for (const m of [tufts, talls, stems, heads, herbs, tips, crops, cropHeads, rocks, logs, shroomStems, shroomCaps]) {
    m.count = 0
    m.frustumCulled = false     // instances span the whole load radius; the default bounds lie
    m.receiveShadow = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }

  const group = new THREE.Group()
  group.add(tufts, talls, stems, heads, herbs, tips, crops, cropHeads, rocks, logs, shroomStems, shroomCaps)

  // Memoised per ground — a Color object per material ever, not per stone.
  const rockCols = new Map<number, THREE.Color>()
  const rockTint = (ground: number): THREE.Color => {
    let c = rockCols.get(ground)
    if (!c) { c = new THREE.Color(ROCK_OF_GROUND[ground] ?? ROCK_FALLBACK); rockCols.set(ground, c) }
    return c
  }

  const cache = new Map<string, Spot[]>()
  const mtx = new THREE.Matrix4()
  const quat = new THREE.Quaternion()
  const scl = new THREE.Vector3()
  const off = new THREE.Vector3()
  const tint = new THREE.Color()
  const Y_AXIS = new THREE.Vector3(0, 1, 0)

  // target / BLADE_GREEN, memoised per ground — one divide per material ever, not per blade.
  const grassMul = new Map<number, THREE.Color>()
  const grassTint = (ground: number): THREE.Color => {
    let c = grassMul.get(ground)
    if (!c) {
      const t = GRASS_OF_GROUND[ground] ?? 0x569e42
      c = new THREE.Color().setRGB(
        ((t >> 16) & 255) / BLADE_GREEN[0],
        ((t >> 8) & 255) / BLADE_GREEN[1],
        (t & 255) / BLADE_GREEN[2],
      )
      grassMul.set(ground, c)
    }
    return c
  }

  const spotsFor = (k: string, x0: number, z0: number, seed: number, probe: PlantProbe): Spot[] => {
    const hit = cache.get(k)
    if (hit) return hit
    const out: Spot[] = []
    for (let dz = 0; dz < SECTION; dz++) for (let dx = 0; dx < SECTION; dx++) {
      const x = x0 + dx, z = z0 + dz
      const p = probe(x, z)
      if (!p) continue
      out.push({ x, y: p.y, z, kind: p.kind, variant: p.variant, mat: p.mat, ground: p.ground })
    }
    cache.set(k, out)
    return out
  }

  return {
    group,
    sync(cols, seed, probe) {
      let nT = 0, nL = 0, nF = 0, nH = 0, nR = 0, nG = 0, nS = 0, nC = 0
      for (const c of cols) {
        for (const s of spotsFor(c.key, c.x0, c.z0, seed, probe)) {
          // Deterministic per-spot jitter off the variant roll: offset within the cell, a turn,
          // a little size. Same spot, same blades, forever.
          const jx = (s.variant * 7.13) % 1 - 0.5, jz = (s.variant * 3.71) % 1 - 0.5
          // Base sits a shade BELOW the surface top: a root emerging from the ground plane hides
          // any single-texel alpha seam; a root exactly ON it re-manufactures the hover.
          off.set(s.x + 0.5 + jx * 0.3, s.y + 0.97, s.z + 0.5 + jz * 0.3)
          quat.setFromAxisAngle(Y_AXIS, s.variant * Math.PI * 2)
          const grow = 0.75 + s.variant * 0.5
          scl.set(1, grow, 1)
          mtx.compose(off, quat, scl)
          // ── ★★ SCATTER TAKES ITS OWN TRANSFORM, BEFORE THE SHARED ONE IS APPLIED ─────────────
          // The `mtx` composed above is right for a stalk: a full random turn about Y and a
          // `grow` scale on Y only. Both are wrong here. A LOG must be turned to its RUN's axis and
          // to nothing else — a random turn would break a straight trunk into scattered sticks,
          // which is the pebble bug rebuilt in the renderer after the field went to the trouble of
          // avoiding it. A STONE may turn freely (it has no axis) but must be scaled on all three,
          // not stretched vertically into a menhir.
          if (s.kind === FLORA.ROCK || s.kind === FLORA.DEADFALL || s.kind === FLORA.MUSHROOM) {
            const sz = 0.8 + s.variant * 0.45
            if (s.kind === FLORA.DEADFALL) {
              // Quarter turn for a Z-run; no jitter along the log's own axis or the run gaps show.
              quat.setFromAxisAngle(Y_AXIS, s.alongX ? 0 : Math.PI / 2)
              off.set(s.x + 0.5, s.y + 1.12, s.z + 0.5)
              scl.set(1, sz, sz)          // ⚠ NOT the length axis — that stays 1.0 so runs butt up
              mtx.compose(off, quat, scl)
              if (nG < CAP.log) { logs.setMatrixAt(nG, mtx); logs.setColorAt(nG, tint.set(DEADFALL_COLOR)); nG++ }
            } else if (s.kind === FLORA.ROCK) {
              quat.setFromAxisAngle(Y_AXIS, s.variant * Math.PI * 2)
              off.set(s.x + 0.5 + jx * 0.5, s.y + 1.06, s.z + 0.5 + jz * 0.5)
              scl.set(sz, sz * 0.75, sz)  // squat: a stone lies ON the ground, it does not stand
              mtx.compose(off, quat, scl)
              if (nR < CAP.rock) { rocks.setMatrixAt(nR, mtx); rocks.setColorAt(nR, rockTint(s.ground)); nR++ }
            } else {
              quat.setFromAxisAngle(Y_AXIS, s.variant * Math.PI * 2)
              off.set(s.x + 0.5 + jx * 0.55, s.y + 0.99, s.z + 0.5 + jz * 0.55)
              scl.set(sz, sz, sz)
              mtx.compose(off, quat, scl)
              if (nS < CAP.shroom) {
                shroomStems.setMatrixAt(nS, mtx); shroomCaps.setMatrixAt(nS, mtx)
                shroomStems.setColorAt(nS, tint.set(SHROOM_STEM_COLOR))
                shroomCaps.setColorAt(nS, tint.set(SHROOM_CAPS[Math.floor(s.variant * 991) % SHROOM_CAPS.length]))
                nS++
              }
            }
          }
          else if (s.kind === FLORA.TUFT) {
            if (nT < CAP.tuft) { tufts.setMatrixAt(nT, mtx); tufts.setColorAt(nT, grassTint(s.ground)); nT++ }
          }
          else if (s.kind === FLORA.TALL) {
            if (nL < CAP.tall) { talls.setMatrixAt(nL, mtx); talls.setColorAt(nL, grassTint(s.ground)); nL++ }
          }
          else if (s.kind === FLORA.CROP) {
            if (nC < CAP.crop) {
              crops.setMatrixAt(nC, mtx)
              cropHeads.setMatrixAt(nC, mtx)
              // Tinted from the SAME table the block and its item icon read (`MATERIAL_COLOR`), so
              // an Atherwheat in the ground, in the bag and on the block are one colour by
              // construction — the herbs' rule, and the reason a re-tune cannot desync them.
              crops.setColorAt(nC, tint.set(MATERIAL_COLOR[s.mat] ?? 0x8f9f5a))
              cropHeads.setColorAt(nC, tint.set(CROP_HEAD[s.mat] ?? 0xffffff))
              nC++
            }
          }
          else if (s.kind === FLORA.HERB) {
            if (nH < CAP.herb) {
              herbs.setMatrixAt(nH, mtx)
              tips.setMatrixAt(nH, mtx)
              // Tinted from the SAME table the block and its item icon read (`MATERIAL_COLOR`), so a
              // Violetbloom in the ground, in the bag and on the block are one colour by construction.
              herbs.setColorAt(nH, tint.set(MATERIAL_COLOR[s.mat] ?? 0x6f8f4a))
              tips.setColorAt(nH, tint.set(HERB_TIP[s.mat] ?? 0xffffff))
              nH++
            }
          }
          else if (nF < CAP.flower) {
            stems.setMatrixAt(nF, mtx)
            heads.setMatrixAt(nF, mtx)
            heads.setColorAt(nF, tint.set(HEAD_TINTS[Math.floor(s.variant * 977) % HEAD_TINTS.length]))
            nF++
          }
        }
      }
      tufts.count = nT; talls.count = nL; stems.count = nF; heads.count = nF
      herbs.count = nH; tips.count = nH
      crops.count = nC; cropHeads.count = nC
      rocks.count = nR; logs.count = nG; shroomStems.count = nS; shroomCaps.count = nS
      for (const m of [rocks, logs, shroomStems, shroomCaps]) {
        m.instanceMatrix.needsUpdate = true
        if (m.instanceColor) m.instanceColor.needsUpdate = true
      }
      tufts.instanceMatrix.needsUpdate = true
      talls.instanceMatrix.needsUpdate = true
      if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true
      if (talls.instanceColor) talls.instanceColor.needsUpdate = true
      stems.instanceMatrix.needsUpdate = true
      heads.instanceMatrix.needsUpdate = true
      herbs.instanceMatrix.needsUpdate = true
      tips.instanceMatrix.needsUpdate = true
      if (heads.instanceColor) heads.instanceColor.needsUpdate = true
      if (herbs.instanceColor) herbs.instanceColor.needsUpdate = true
      if (tips.instanceColor) tips.instanceColor.needsUpdate = true
      crops.instanceMatrix.needsUpdate = true
      cropHeads.instanceMatrix.needsUpdate = true
      if (crops.instanceColor) crops.instanceColor.needsUpdate = true
      if (cropHeads.instanceColor) cropHeads.instanceColor.needsUpdate = true
      // Evicted columns fall out of `cols`, so their spots simply stop being written; drop their
      // cache too or a long walk grows it forever.
      if (cache.size > cols.length * 2 + 64) {
        const live = new Set(cols.map(c => c.key))
        for (const k of [...cache.keys()]) if (!live.has(k)) cache.delete(k)
      }
    },
    invalidate(colKey) { cache.delete(colKey) },
    invalidateAll() { cache.clear() },
    tick(elapsed) { uTime.value = elapsed },
    dispose() {
      tuftGeo.dispose(); tallGeo.dispose(); stemGeo.dispose(); headGeo.dispose()
      herbGeo.dispose(); tipGeo.dispose()
      tuftMat.dispose(); tallMat.dispose(); stemMat.dispose(); headMat.dispose()
      herbMat.dispose(); tipMat.dispose()
      bladeTex.dispose(); tallTex.dispose(); headTex.dispose()
    },
  }
}
