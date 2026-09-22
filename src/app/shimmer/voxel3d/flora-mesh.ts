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
import { bladePixels, tallBladePixels, bladeAtlasPixels, GRASS_VARIANTS, TALL_TILE_H, headPixels, bushPixels, bloomClusterPixels, matLeafPixels, matBloomPixels, matShadowPixels, fruitClusterPixels, mossPixels, rosettePixels, reedPixels, wakePixels, HEAD_TINTS, BLADE_GREEN, BLADE_TILE, TUFT_SEED, TUFT_BLADES, TALL_SEED, TALL_BLADES } from './tex/flora-tex'
import { cropStalkPixels, cropHeadPixels } from './tex/crop-tex'
import { plantedLook, STAGE_GROW, STAGE_RIPE, type PlantedSpot } from './planted-feed'
import { FLORA, FRUIT_MATS } from '../voxel/flora'
import { MATERIAL_COLOR } from './attrs'
import { MAT } from '../voxel/depth'
import { SHELF_FACES, type ShelfCell } from './shelf-scan'
import { cartoonStackGlsl, cartoonUniforms, CARTOON_DECL_GLSL } from './cartoon-glsl'
import { createLightUniforms, type LightUniforms } from './light-glsl'
import { bankLeanAt } from '../voxel/height'
import { sunfruitBushLeavesGeo, sunfruitBushFruitGeo, sunfruitBushBox } from './models/sunfruit-bush'
import { moonberryBushLeavesGeo, moonberryBushFruitGeo, moonberryBushBox } from './models/moonberry-bush'

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
/** The puff cluster's body — `MATERIAL_COLOR[PUFF_CLUSTER]` so the icon, the bag and the ground agree. */
const PUFF_COLOR = MATERIAL_COLOR[MAT.PUFF_CLUSTER] ?? 0xe6dcc4
/**
 * How hard the moss glows. Lambert emissive is added AFTER the lights, so this is what survives
 * the night: at 0.45 a ribbon reads at midnight and is a soft cushion by day, not a lamp.
 */
export const MOSS_EMISSIVE = 0.28

/**
 * ── ★ THE SCATTER GEOMETRY, EXPORTED SO THE ICON WEARS THE SAME SHAPE (2026-08-26) ─────────────
 * These four were locals inside the builder below, which was correct while the world was the only
 * thing that drew them. `voxel3d/tex/mesh-icon.ts` now draws them too — a deadfall log and a
 * mushroom have no tile texture to derive a cube from, so their inventory icons are rendered from
 * this geometry instead of hand-painted.
 *
 * ⚠ THEY ARE FACTORIES, AND THE POST-CONSTRUCTION CALLS ARE THE POINT. `logGeo.rotateZ` is what
 * makes a log LIE DOWN and `translate` is what stacks a cap on its stalk — a second consumer that
 * restated `new CylinderGeometry(0.15, 0.13, 1.0, 6)` would get a standing log and be internally
 * consistent about the wrong shape. That is the mirror bug this repo has paid for repeatedly: a copy
 * and its original agreeing perfectly and both being wrong. One definition, two consumers.
 *
 * Factories rather than shared instances because `BufferGeometry` is mutable and disposable — the
 * world disposes its copies on unmount, and an icon must not be holding a freed buffer.
 */
export const floraLogGeo = (): THREE.BufferGeometry => {
  const g = new THREE.CylinderGeometry(0.15, 0.13, 1.0, 6)
  g.rotateZ(Math.PI / 2)          // lying along +X — a felled trunk, not a post
  return g
}
export const floraShroomStemGeo = (): THREE.BufferGeometry => {
  const g = new THREE.CylinderGeometry(0.05, 0.07, 0.24, 5)
  g.translate(0, 0.12, 0)
  return g
}
export const floraShroomCapGeo = (): THREE.BufferGeometry => {
  const g = new THREE.ConeGeometry(0.17, 0.15, 8)
  g.translate(0, 0.30, 0)         // rides the top of the stalk
  return g
}
export const floraRockGeo = (): THREE.BufferGeometry => new THREE.IcosahedronGeometry(0.21, 0)
/**
 * A puff cluster (2026-09-16): three puffballs huddled on the ground, ONE buffer. Merged by hand
 * (position + normal, non-indexed) rather than via a utils import, the same way `station-mesh`
 * does it — three spheres of two subdivisions is 240 triangles, the size of a mushroom pair. Sizes
 * differ on purpose: a huddle of equals is a pattern, a big one with two small is a family.
 */
export const floraPuffGeo = (): THREE.BufferGeometry => {
  const balls: [number, number, number, number][] = [
    [0.00, 0.13, 0.02, 0.14],
    [-0.17, 0.09, -0.12, 0.10],
    [0.15, 0.08, -0.14, 0.09],
  ]
  const pos: number[] = [], nrm: number[] = []
  for (const [x, y, z, r] of balls) {
    // An IcosahedronGeometry is already non-indexed (three warns if you ask), so the arrays concat.
    const g = new THREE.IcosahedronGeometry(r, 1)
    g.translate(x, y, z)
    pos.push(...(g.getAttribute('position').array as Float32Array))
    nrm.push(...(g.getAttribute('normal').array as Float32Array))
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  return out
}

/**
 * ── ★★ THE FRUIT BUSH IS A SCULPT, AND IT IS A FACTORY LIKE EVERY OTHER SOLID (2026-09-22) ─────
 * Alex walked the A/B at `/bushtest sculpt` — card · code stand-in · picaso's glb — and the model
 * won. So the WILD fruit pool draws the sculpt, and the two cards it used to draw stay only in the
 * showcase, which is what an A/B is for.
 *
 * ★ THE GLB IS BAKED, NOT FETCHED, AND THE REASON IS NOT SPEED. Three consumers of a plant's shape
 * do not run in a browser — `floraBounds` (the reticle's box), `mesh-icon`'s software raster, and
 * the node checks that read both. Handed an async geometry they would each go on measuring the CARD
 * while the world drew the sculpt: a loose outline, a wrong icon, and every guard green, because a
 * guard that cannot see its subject reports on nothing. `scripts/bake-flora-model.mts` turns the
 * glb into `models/sunfruit-bush.ts` — quantised positions and uvs, one `npm run bake:flora` after
 * every picaso pass. The `.glb` in `public/` is untouched and still what `/bushtest sculpt` loads.
 *
 * ★ NORMALISED THROUGH THE MODEL'S OWN MEASURED BOX, so picaso can re-bake at any `TARGET_W` and
 * the game's footprint does not move. The widest horizontal extent becomes exactly one cell and the
 * base sits on y = 0 — a derivation, not a number anyone has to keep in step. (Today the model is
 * already 1.0 wide and based at 0, so the fit is the identity; that is the point — it stays the
 * identity by measurement rather than by luck.)
 */
type BushBox = { min: readonly [number, number, number]; max: readonly [number, number, number] }
const fitBush = (g: THREE.BufferGeometry, box: BushBox): THREE.BufferGeometry => {
  const [mnx, mny, mnz] = box.min, [mxx, , mxz] = box.max
  // ⚠ WIDTH ONLY. Normalising HEIGHT too would erase the one difference canon actually states
  // between the two bushes' bodies: the sunfruit is a compact dome (0.95 tall) and the moonberry
  // is low and broad (0.62), because one grows in open sun and the other in shade. A fit that
  // makes every bush the same box makes every bush the same plant.
  const k = 1 / Math.max(mxx - mnx, mxz - mnz)
  g.translate(-(mnx + mxx) / 2, -mny, -(mnz + mxz) / 2)
  g.scale(k, k, k)
  return g
}
/**
 * ── ★ TWO BUSHES, AND THE DIFFERENCE IS CANON'S (2026-09-22) ─────────────────────────────────
 * `CANON/world/cuisine.md` › *★ ATHER FRUIT* (ruled 2026-08-22): Sunfruit is *"a warm golden
 * FRUIT"* — singular, few, big, sitting on the crown — and Moonberry is *"cool blue BERRIES"* —
 * plural, many, small, hanging. The CARD ATLAS already encoded exactly that (four big fruit in
 * column 0, nine small in column 1) and the first sculpt pass threw it away by drawing one mesh
 * for both, which left a moonberry as a sunfruit painted blue. This is that split, restored in
 * geometry: two bakes off one script (`scripts/models/bake-bushes.sh` holds the recipes).
 * ⚠ KEYED ON MATERIAL, NOT ON A BOOLEAN. An unknown material falls back to the sunfruit rather
 * than to nothing — a bush that fails to draw reads as a hole in the world, not as a missing case.
 */
const BUSH_MODELS: Readonly<Record<number, { leaves: () => THREE.BufferGeometry; fruit: () => THREE.BufferGeometry; box: BushBox }>> = {
  [MAT.SUNFRUIT_BUSH]: { leaves: sunfruitBushLeavesGeo, fruit: sunfruitBushFruitGeo, box: sunfruitBushBox },
  [MAT.MOONBERRY_BUSH]: { leaves: moonberryBushLeavesGeo, fruit: moonberryBushFruitGeo, box: moonberryBushBox },
}
const bushModel = (mat: number) => BUSH_MODELS[mat] ?? BUSH_MODELS[MAT.SUNFRUIT_BUSH]
/** The sculpted leafy body, wearing the card's own pixels (see `solidBushTex`). */
export const floraFruitLeavesGeo = (mat: number = MAT.SUNFRUIT_BUSH): THREE.BufferGeometry => {
  const m = bushModel(mat); return fitBush(m.leaves(), m.box)
}
/** The fruit on it — its own buffer so it takes its own tint, the puff's pattern. */
export const floraFruitBerriesGeo = (mat: number = MAT.SUNFRUIT_BUSH): THREE.BufferGeometry => {
  const m = bushModel(mat); return fitBush(m.fruit(), m.box)
}
/** Every fruit material that has its own sculpt — the pool builds one instanced pair per entry. */
export const BUSH_MODEL_MATS: ReadonlyArray<number> = Object.keys(BUSH_MODELS).map(Number)

/**
 * ── ★ THE MODEL BUSH — an A/B against the card bush (2026-09-22, Alex: "3d models for bushes,
 * trees and other flora… whats the dif between what we use now") ──────────────────────────────
 * Not a FLORA kind and not generated: a SHOWCASE geometry the owner's `/bushtest` stands beside a
 * card bush so Alex can walk round both. It is what a low-poly sculpted bush is — a cluster of
 * flattened, jittered icospheres (~700 tris, the size a Meshy/Blender bush would be after decimation)
 * tinted per instance like a puff (leaves in the bush's leaf colour, the fruit in its fruit colour,
 * two buffers), drawn faceted (`flatShading`) through the same Lambert + toon stack as a rock, so
 * the comparison is about SHAPE, not shading. If the look wins, a real `.glb` slots into the same
 * path (a geometry + this material); if it loses, this and the command go.
 */
export function floraModelBushGeo(seed = 1): { leaves: THREE.BufferGeometry; fruit: THREE.BufferGeometry } {
  const rnd = (() => { let t = seed * 9301 + 49297; return () => { t = (t * 9301 + 49297) % 233280; return t / 233280 } })()
  const pos: number[] = [], nrm: number[] = []
  // Seven balls: one big at the heart, six around it, each squashed on Y and jittered per vertex.
  const balls: [number, number, number, number][] = [[0, 0.42, 0, 0.44]]
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.6
    const d = 0.26 + rnd() * 0.14
    balls.push([Math.cos(a) * d, 0.28 + rnd() * 0.22, Math.sin(a) * d, 0.24 + rnd() * 0.12])
  }
  // ⚠ JITTER BY THE VERTEX'S OWN POSITION, NOT PER INDEX: the icosphere is non-indexed, so a
  // corner shared by five faces is five vertices — five independent rolls tear the mesh open
  // (the first shot was a shredded ball). A hash of (x,y,z) moves all five copies together.
  const h = (a: number, b: number, c: number, k: number) => { const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + k * 19.3 + seed) * 43758.5453; return v - Math.floor(v) - 0.5 }
  const uv: number[] = []
  for (const [x, y, z, r] of balls) {
    const g = new THREE.IcosahedronGeometry(r, 1)
    const p = g.getAttribute('position') as THREE.BufferAttribute
    const u = g.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const ox = p.getX(i), oy = p.getY(i), oz = p.getZ(i)
      pos.push(ox + h(ox, oy, oz, 1) * 0.07 + x, oy * 0.78 + h(ox, oy, oz, 2) * 0.05 + y, oz + h(ox, oy, oz, 3) * 0.07 + z)
      // The bush tile wrapped round each ball twice — the card's own pixels on the model's skin.
      uv.push((u.getX(i) * 2) % 1, (u.getY(i) * 2) % 1)
    }
    g.dispose()
  }
  const leaves = new THREE.BufferGeometry()
  leaves.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  leaves.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  leaves.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3))
  // Flat facets: per-face normals on the non-indexed buffer — the low-poly look itself.
  leaves.computeVertexNormals()
  // The fruit: small balls on the crown's surface. Its own buffer so it takes its own tint
  // (`instanceColor`, the puff's pattern) — a vertex-colour attribute did not survive the stack.
  const fp: number[] = []
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, e = 0.25 + rnd() * 0.9
    const bx = Math.cos(a) * Math.cos(e) * 0.5, by = 0.42 + Math.sin(e) * 0.36, bz = Math.sin(a) * Math.cos(e) * 0.5
    const g = new THREE.IcosahedronGeometry(0.055 + rnd() * 0.02, 0)
    g.translate(bx, by, bz)
    fp.push(...(g.getAttribute('position').array as Float32Array))
    g.dispose()
  }
  const fruit = new THREE.BufferGeometry()
  fruit.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3))
  fruit.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(fp.length), 3))
  fruit.computeVertexNormals()
  void nrm
  return { leaves, fruit }
}

/**
 * ── ★ THE SHELF FUNGUS (2026-09-21): a stack of brackets hanging off a trunk face ─────────────
 * Canon: *"layered"*. Three half-discs, ONE buffer (merged like the puff): the largest at the
 * bottom, each one a hair smaller and set a little higher, so the stack reads as a bracket fungus
 * and not as three coins. Each is a HALF cylinder (theta 0..π) — the flat cut sits on the plane
 * x = 0 and the curve bulges toward +x, so local +x is "away from the trunk" and `floraMatrix`
 * turns the instance so that axis points off the face it hangs on. The cut face is left open on
 * purpose: it is pressed against the log and never seen. Closed on top and bottom (the cylinder's
 * caps follow the arc), so the hull outline has a silhouette to draw. Sized to sit inside its
 * cell: radius 0.42 toward the trunk's face, half-width 0.42 across it, 0.6 tall over the stack.
 */
export const floraShelfGeo = (): THREE.BufferGeometry => {
  // [radius, thickness, y-centre] per bracket, bottom first.
  const tiers: [number, number, number][] = [[0.42, 0.09, 0.18], [0.36, 0.08, 0.36], [0.28, 0.07, 0.52]]
  const pos: number[] = [], nrm: number[] = []
  for (const [r, t, y] of tiers) {
    // A little wider at the top than the underside (rTop > rBottom): the shelf's lip.
    const g = new THREE.CylinderGeometry(r, r * 0.86, t, 9, 1, false, 0, Math.PI).toNonIndexed()
    g.translate(0, y, 0)
    pos.push(...(g.getAttribute('position').array as Float32Array))
    nrm.push(...(g.getAttribute('normal').array as Float32Array))
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  return out
}
/** The bracket's body — `MATERIAL_COLOR[SHELF_FUNGUS]` so the icon, the block row and the trunk agree. */
const SHELF_COLOR = MATERIAL_COLOR[MAT.SHELF_FUNGUS] ?? 0xb08a4e

/** The scatter's own colours, exported for the same reason the geometry is. */
export const FLORA_COLORS = {
  deadfall: DEADFALL_COLOR,
  shroomStem: SHROOM_STEM_COLOR,
  shroomCaps: SHROOM_CAPS,
  puff: PUFF_COLOR,
  shelf: SHELF_COLOR,
} as const

/**
 * Instance caps.
 *
 * ⚠⚠⚠ ONE WORST CASE WAS PICKED FOR EIGHT POOLS AND IT IS THE WRONG ONE FOR THE HERBS.
 * This block used to read *"generous against radius-12 meadow country"* — and **meadow carries no
 * herbs at all.** Meadow is the correct worst case for `tuft`; it is the one ground guaranteed to
 * produce ZERO of what the herb pool holds. The herbs' real worst case is basin + woodland + shore,
 * and `HERB_TUNE` makes it worse ON PURPOSE: it packs rare grounds tight (basin 0.80, shore 0.52) so
 * all four herbs stay equally findable. That compensation is right, and it is exactly what blows
 * this pool.
 *
 * Measured (play lane, `generatedAt` over a real load ring at chunk -90,150 — woodland 36.6%,
 * meadow 30.2%, basin 24.7%, shore 8.3%): herbs wanted **2,961** at radius 6, **4,986** at radius 8,
 * **7,954** at radius 12. Against a cap of 4,000 that is **199% at radius 12** — so in herb country
 * at any radius past the default, roughly HALF the element herbs in the ring exist, are breakable,
 * and are never drawn.
 *
 * ★ AND IT IS NOT COSMETIC: the four element herbs gate all four Infusions, which canon makes the
 * only road to an evolved form — every one of the forty ruled second forms. A player meets that as
 * *"the Water Infusion is the hard one"*, which is the precise misreading `HERB_TUNE` exists to
 * prevent. The compensation was being undone downstream of itself.
 *
 * ⚠ THE SIZES BELOW ARE THE SMALLER HALF OF THE FIX. See `noteOverflow` — a pool that stops quietly
 * at its cap is indistinguishable from empty ground, which is why nobody found this by playing and
 * no test asked. Every cap here is a guess about terrain; the reporting is what makes the next wrong
 * guess visible instead of silent.
 */
// Scatter caps are far below grass because scatter IS rare (~1-3% of columns against grass's 13%).
// Sized against the measured worst case — a crag at rockK 3.0 is 3% of its columns — with headroom.
// herb 4000 -> 12000: 1.5x the measured radius-12 worst case (7,954), so the headroom survives a
// HERB_TUNE re-tune rather than sitting exactly on today's number. tall 6000 -> 9000 and crop
// 4000 -> 6000 for the same reason — both were measured at 96% and 54% of cap, and 96% is not
// headroom, it is a pool that has already arrived.
/**
 * ★ EXPORTED SO A PROBE CANNOT MIRROR IT. The cap sweep that found the herb overrun kept its OWN
 * copy of this table, so the moment these numbers moved its report went stale while still looking
 * authoritative — it printed `herb cap 4000` against a live cap of 12,000 and called the pool 199%
 * over when it was 66% under. Agreement between a copy and its original is not evidence about
 * either; import this instead of restating it.
 */
/** The ripe glint's card size, its float above the crown, its texture size and its colour. */
const GLINT_SIZE = 0.26
const GLINT_LIFT = 0.04
const GLINT_TEX = 16
const GLINT_COLOR = 0xfff1b8
/** A collapsed instance: the head pool is 1:1 with the stalk pool, so an unripe crop's head is
 *  written as nothing rather than skipped. Scale 0 is degenerate and rasterises no fragment. */
const ZERO_MTX = new THREE.Matrix4().makeScale(0, 0, 0)

/** A four-point star, white, soft-edged: the additive material tints it. */
function glintPixels(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = Math.abs(x - c) / (size / 2), dy = Math.abs(y - c) / (size / 2)
    // A star is where one axis is near zero: the product of the two distances is small along
    // both spokes and large in the quadrants. Softened so the additive blend has a falloff.
    const spoke = Math.max(0, 1 - (dx * dy) * 14 - Math.max(dx, dy) * 0.9)
    const core = Math.max(0, 1 - Math.hypot(dx, dy) * 2.2)
    const a = Math.min(1, spoke + core)
    if (a <= 0.02) continue
    const o = (y * size + x) * 4
    data[o] = 255; data[o + 1] = 255; data[o + 2] = 255; data[o + 3] = Math.round(a * 255)
  }
  return data
}

export const CAP = { tuft: 24000, tall: 9000, flower: 4000, mat: 9000, bush: 4000, fruit: 3000, herb: 12000, rock: 5000, log: 4000, shroom: 3000, crop: 6000, glint: 64, puff: 2000, moss: 6000, reed: 1500, shelf: 1500 } as const

/**
 * ★★★ A POOL THAT OVERFLOWS SAYS SO — ONCE, PER POOL, WITH THE NUMBER.
 *
 * The bug this closes is not the cap, it is the SILENCE. `sync` stopping quietly at the cap makes an
 * overrun indistinguishable from empty ground: nothing throws, nothing looks wrong, and the only
 * symptom is plants that are there, are breakable, and are not drawn. Nobody finds that by playing,
 * because the missing thing is missing.
 *
 * ⚠ ONCE PER POOL, NOT PER SYNC. Sync runs continuously; a warn per overflow would be a console
 * flood, and a flood is its own kind of silence. The first one carries the information.
 */
const overflowed = new Set<string>()
function noteOverflow(pool: string, wanted: number, cap: number): void {
  if (overflowed.has(pool)) return
  overflowed.add(pool)
  console.warn(`[flora] ${pool} pool overflowed: ${wanted} wanted, ${cap} drawn — `
    + `${wanted - cap} plants exist and are breakable but are NOT rendered. Raise CAP.${pool}.`)
}

/** What each pool wanted at the last sync, whether or not it fit. Readable by a test or a HUD. */
export const floraDemand: Record<string, { wanted: number; cap: number }> = {}

/**
 * ── ★★ THE DENOMINATOR, BECAUSE A 0 WITHOUT ONE IS NOT A READING (2026-09-22) ─────────────────
 * `floraDemand` reports whatever the LAST sync wrote, and it carried no indication of whether that
 * sync had its subject loaded. **A pool at 0 and a pool nobody has filled yet are byte-identical**,
 * and on 2026-09-22 that cost a peer window most of an afternoon: `fruit/herb/crop 0` was reported
 * as a prod defect, with the generator proved to be writing the voxels (250/250 cells). It was not
 * a defect. Measured at the SAME spot: `meadow · 84 col` → fruit 0; `meadow · 108 col` → fruit 276.
 *
 * ⚠ THE READOUT WAS THE BUG, NOT THE READER. Nothing about `{"fruit":{"wanted":0,"cap":3000}}`
 * says "ask me again when the ring has settled", so the honest move is to make the number
 * impossible to quote without its denominator — `__flora()` spreads these INTO the demand object
 * it hands out, so a `JSON.stringify(demand)` dump carries them whether the reader thought to look
 * or not. (Suggested in exactly this form by the window that hit it.)
 */
export const floraSync = { cols: 0, serial: 0 }
/** How many lean-map texels carried a river lean at the last sync — `__flora().lean` reads it. */
export let leanLive = 0

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

/** The FRUIT on each bush — canon's own words: a warm golden fruit; cool blue berries. */
const FRUIT_TINT: Readonly<Record<number, number>> = {
  [MAT.SUNFRUIT_BUSH]: 0xf2b23a,
  [MAT.MOONBERRY_BUSH]: 0x6cb8f0,
}

/**
 * ── ★★ CANON GIVES EACH FRUIT A LIGHT, AND THEY ARE NOT THE SAME LIGHT (2026-09-22) ───────────
 * `CANON/world/cuisine.md` › *★ ATHER FRUIT*, ruled 2026-08-22, two entries and two verbs:
 *   Sunfruit  — *"A warm golden fruit that **glows faintly**."*
 *   Moonberry — *"Cool blue berries that **shimmer in low light**."*
 * A glow is steady; a shimmer is not. So the sunfruit takes a faint constant emissive and the
 * moonberry takes a stronger one that BREATHES, on a phase off its own world position — the same
 * trick the wind and the ripe glint use, and for the same reason: a whole thicket pulsing in
 * lockstep reads as a UI effect, not as a plant.
 *
 * ★ "IN LOW LIGHT" NEEDS NO GATE, AND THAT IS WHY IT IS AN EMISSIVE AND NOT A LAMP. Lambert adds
 * emissive AFTER the lights (the glow-moss entry says it outright), so the same constant is a
 * barely-there warmth at noon and the only thing left after dusk. The condition canon states is a
 * property of the arithmetic, not something to branch on.
 *
 * ⚠ DIALS. `shimmer` 0 = a steady glow. These are the numbers Alex judges at night, and they are
 * the reason the two bushes read as different plants from across a clearing rather than at arm's
 * length, where shape alone already tells them apart.
 */
const FRUIT_GLOW: Readonly<Record<number, { emissive: number; shimmer: number }>> = {
  [MAT.SUNFRUIT_BUSH]: { emissive: 0.16, shimmer: 0 },
  // ⚠ 0.42 → 0.30 (Alex, 2026-09-22, looking at it on his own screen at 22:00). At 0.42 the
  // berries read MILKY — nearer white than `FRUIT_TINT`'s cool blue — because the emissive lands
  // on a surface the moon has ALREADY lit. My own night check had been against a headless render
  // far darker than the real game (swiftshader under-lights badly), so 0.42 was tuned against the
  // wrong reference: the instrument, not the number, was the mistake.
  [MAT.MOONBERRY_BUSH]: { emissive: 0.30, shimmer: 0.45 },
}

const HERB_TIP: Readonly<Record<number, number>> = {
  [MAT.VIOLETBLOOM]: 0xd9b0ff,   // the hum, made visible — the one that glows a little
  [MAT.STORMGRASS]: 0x9fe4ff,    // canon's blue tip, verbatim
  [MAT.ROOTVINE]: 0x7f8f4a,      // a pale crown over dark root-green; the plant is the STEM here
  [MAT.TIDEPETAL]: 0xeafffb,     // beaded — near white, wet
  [MAT.GOLDLEAF]: 0xf2dc78,      // the gold: a pale yellow crown over the green-gold body (09-17)
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

interface Spot { x: number; y: number; z: number; kind: number; variant: number; mat: number; ground: number; alongX?: boolean; face?: number }

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
  /**
   * `river` — whether this space carves rivers (the Wilds), so the lean map is built; the Glade
   * and the plot generate from their own columns and the river field means nothing there, yet
   * `bankLeanAt` would still answer for it (measured: 723 live texels on the Glade island, every
   * one a lie). Off = the map is zeroed and the bank flora stands straight.
   */
  /**
   * `shelves` — the trunk-side scan (`shelf-scan.ts`) for a column, or absent (a host with no
   * columns to scan, or a test of the ground family). The ground probe cannot reach a bracket at
   * height, so this is the SECOND reader; cached per column beside the ground spots.
   */
  /**
   * `fruited` — whether the fruit bush at this CELL still carries its fruit (`picking.ts`). Absent
   * means every bush is fruited, which is what a harness and any space with no picking should see.
   */
  sync(cols: { key: string; x0: number; z0: number }[], seed: number, probe: PlantProbe, river?: boolean, shelves?: (x0: number, z0: number) => ShelfCell[], fruited?: (x: number, y: number, z: number) => boolean): void
  /**
   * The SHOWCASE (2026-09-22): stand a card bush and/or a model bush at exact spots, outside the
   * pools — `/bushtest`'s A/B. Rewrites the whole set each call; `[]` clears it. Never saved.
   */
  showcase(entries: { x: number; y: number; z: number; kind: 'card' | 'model' | 'sculpt'; mat: number }[]): void
  /**
   * Hand the showcase a SCULPTED bush (a glTF's `Leaves` + `Fruit` geometries, base at the origin,
   * blocks as units). Until this is called a `'sculpt'` entry draws nothing. The glb is loaded by
   * the host (`/bushtest sculpt`) — the renderer never fetches.
   */
  setSculpt(leaves: THREE.BufferGeometry, fruit: THREE.BufferGeometry | null): void
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
  /**
   * The PLANTED feed — the crops standing in garden beds (2026-09-16, `planted-feed.ts`).
   * Stored, and written into the crop / herb pools on the next `sync` AFTER the wild spots, so
   * a bed's crop is the same pixels, tint and sway as the wild plant of its kind — one renderer
   * over one plant, which is what CROP_HEAD's header asked for. The host owns WHEN this moves
   * (a stage is minutes apart); this only remembers the list.
   */
  setPlanted(spots: ReadonlyArray<PlantedSpot>): void
  tick(elapsed: number): void
  /** The cartoon dials — the same value writes the world's blocks take (settings.ts). */
  setCartoon(v: Record<string, number>): void
  /** The reed's tip lean in blocks (`REED_LEAN` default) — a dial for Alex at the river. */
  setReedLean(v: number): void
  /**
   * Draw the selection border on ONE plant — the reticle's whole job for ground cover.
   * Same geometry, same texture, same sway as the plant it marks; see `outlineMaterial`.
   * `y` is the spot's GROUND height, exactly as `PlantProbe` reports it.
   */
  setHighlight(kind: number, x: number, y: number, z: number, variant: number, alongX?: boolean, mat?: number, hasFruit?: boolean): boolean
  /** No plant under the reticle. */
  clearHighlight(): void
  dispose(): void
}

/** THREE quads in a star (0°, 60°, 120°), base at y=0, uv.y 0 at the root — the sway weight rides
 *  on it. Was a two-quad cross until 2026-09-14: seen along either quad's plane a cross collapses
 *  to a single card edge-on and the tuft flickers thin from half the walk angles; a 60° star never
 *  has a view that catches all its cards edge-on. Two more triangles per plant; the meadow is still
 *  one draw per kind.
 *  Normals point UP so a blade lights like the ground it grows from (the standard grass-card
 *  trick; a real face normal would moonlight one side of every blade). */
function buildCrossGeometry(width: number, height: number, yBase = 0, tiles = 1, lean = 0): THREE.BufferGeometry {
  const hw = width / 2
  // The top edge's swing along the card's normal (see CARD_LEAN). The card's base line stays put,
  // so the root still meets the ground where the probe said it does.
  const swing = height * Math.tan(lean)
  const pos: number[] = []
  const uv: number[] = []
  const nrm: number[] = []
  const swy: number[] = []
  const idx: number[] = []
  // `col` is the card's ATLAS COLUMN, carried in uv.x's integer part: card k of a `tiles`-wide
  // atlas gets uv.x in [k, k+1). The shader adds the instance's own offset and wraps (see
  // `injectAtlas`), so the three cards of one plant show three different tiles. `tiles` = 1 → 0.
  const quad = (ax: number, az: number, bx: number, bz: number, col: number) => {
    const base = pos.length / 3
    // The card's in-plane normal, unit length: the direction its top swings when it leans.
    const len = Math.hypot(bx - ax, bz - az) || 1
    const nx = -(bz - az) / len * swing, nz = (bx - ax) / len * swing
    pos.push(ax, yBase, az, bx, yBase, bz, bx + nx, yBase + height, bz + nz, ax + nx, yBase + height, az + nz)
    uv.push(col, 0, col + 1, 0, col + 1, 1, col, 1)
    nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0)
    // ★ HOW FAR THIS VERTEX IS FROM THE ROOT — the sway's weight, stated rather than inferred.
    // See `aSway`'s note on `buildFlatGeometry`: this used to be read off `uv.y`, which is only
    // "height" on a card that happens to stand up.
    swy.push(0, 0, 1, 1)
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3
    quad(-hw * Math.cos(a), -hw * Math.sin(a), hw * Math.cos(a), hw * Math.sin(a), k % tiles)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(swy, 1))
  g.setIndex(idx)
  return g
}

/** A single 1×1 quad lying FLAT at yBase, normal up — the ground-cover pad. `uv.y` runs along
 *  +z, so the sway (weighted by uv.y) would lift one edge; the mat's amp is tiny for that reason. */
function buildFlatGeometry(width: number, yBase: number): THREE.BufferGeometry {
  const hw = width / 2
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    -hw, yBase, -hw, hw, yBase, -hw, hw, yBase, hw, -hw, yBase, hw,
  ], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
  /**
   * ── ★★ `aSway` = 0: A PAD IS PRESSED TO THE EARTH AND DOES NOT BEND (fixed 2026-09-22) ───────
   * Alex: *"the flower patches are doing some weird motion when waving in the wind and they end up
   * going underground."* Both halves were one bug, and it was a wrong MODEL rather than a bad
   * number. The sway weights itself by `uv.y²`, meaning *how far this vertex is from the root* —
   * which `uv.y` only is on a card that stands UP. This quad is horizontal and its uv is
   * `[0,0, 1,0, 1,1, 0,1]`, so `uv.y` was the pad's FAR EDGE: two corners pinned, two corners
   * driven. That sheared the pad like a flag (the weird motion) and, because the same weight also
   * feeds `transformed.y -= bend² · w · 0.35`, pushed those corners DOWN — through a pad that
   * clears the ground by 0.02, against ~0.009 of wind dip plus ~0.009 of river lean. Underground.
   *
   * ⚠ AND IT HAD ALREADY BEEN SEEN AND MIS-DIAGNOSED: `FLORA_SWAY[BLOOM_MAT]`'s own comment reads
   * *"a pad lying on the ground barely moves; uv.y is its far edge"* — the fact was known and the
   * response was to shrink the amplitude, which makes a wrong weighting SMALL instead of absent.
   * A patch still sheared and still sank, just slowly enough to look like something else.
   *
   * So the weight is now an attribute the builder states outright, and for a pad it is 0. The
   * patch keeps its life from the BLOOM_MAT's third part — a low star of real cross geometry that
   * sways properly — which is also what a flower patch does: the blooms move, the mat does not.
   */
  g.setAttribute('aSway', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1))
  // ⚠ WOUND TO FACE +Y. The material is DoubleSide, so a wrong winding still DRAWS — but Lambert
  // flips the normal on a back face, and a pad lit from underneath is a black disc on the grass.
  // That is exactly what the first shot showed; the fix is the index order, not the material.
  g.setIndex([0, 2, 1, 0, 3, 2])
  return g
}

/** ONE builder for a part, read by the renderer AND by `vertsFor` — a flat part and a star part
 *  must be measured by the same code that draws them or the outline lies about one of them. */
export interface FloraPart {
  w: number; h: number; yBase?: number; flat?: boolean; tiles?: number; lean?: number
  /** A contact SHADOW under the plant: drawn with the soft shadow material, never tinted, never
   *  outlined (a border on a soft disc is a black ring). `flora-outline.test` skips these. */
  shadow?: boolean
  /** The reed's WAKE (2026-09-18): a flat quad running +z from the root for `h` blocks, `w` wide,
   *  that the wake material turns to the flow in the vertex program. Never outlined — it is water,
   *  not plant — and the bounds it contributes are the unturned quad's (the turn is the GPU's). */
  wake?: boolean
}

/**
 * ── ★ THE LEAN: A STAR OF VERTICAL CARDS IS A STAR OF LINES FROM ABOVE (2026-09-16) ─────────────
 * Alex: *"a lot of the flora is a flat line."* The 60° star (below) fixed the SIDE view — no walk
 * angle catches all three cards edge-on — but a keeper stands 1.8 blocks tall and looks DOWN at
 * grass, and from above every vertical card is a line no matter how many of them there are. The
 * tuft you see most is the one at your feet, and that one was three pencil strokes.
 *
 * So the cards LEAN: each one tilts about its base line by this angle, and the top edge swings out
 * along the card's own normal. From above a leaning card presents `w × h·sin(lean)` of texture —
 * a pinwheel of three leaves instead of an asterisk — and from the side it is still `h·cos(lean)`
 * tall. No extra triangles; the meadow is still one draw per kind. The alternative (fold each card
 * into two outward-splayed halves) reads a touch better from above and doubles the tuft budget.
 * Radians. 0 for a part that must stay a true star (a bloom head, a round bush).
 *
 * ⚠ TRIED AT 0.4 AND TURNED OFF THE SAME NIGHT. Alex: *"they seem tilted now, and still flat."*
 * Right: a tilted card of thin blades is still a row of texels from above — the lean moves the
 * line, it does not fill it. The fix that works is the CAP (see `rosettePixels`): a flat card at
 * knee height wearing the clump seen from above. The lean stays as a dial at 0 so the experiment
 * is a number, not a memory.
 */
export const CARD_LEAN = 0
/** How dark the selection border paints an edge texel: a fraction of the texel's own colour (see `outlineMaterial`). */
export const OUTLINE_SHADE = 0.22
/** The wake: a flat quad from the root running +z for `len`, `width` wide, uv.y along the run so
 *  row 0 of `wakePixels` (the apex) sits under the stalk. Faces +Y; the wake material is
 *  DoubleSide with no lighting, so the winding only has to agree with the flat pad's. */
function buildWakeGeometry(width: number, len: number, yBase: number): THREE.BufferGeometry {
  const hw = width / 2
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    -hw, yBase, 0, hw, yBase, 0, hw, yBase, len, -hw, yBase, len,
  ], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
  // Flat on the sheet, like the pad above — no bend weight. (Its own material does not sway, but
  // an attribute the shader might read must exist on every geometry that could meet it.)
  g.setAttribute('aSway', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1))
  g.setIndex([0, 2, 1, 0, 3, 2])
  return g
}
export const partGeometry = (p: FloraPart): THREE.BufferGeometry =>
  p.wake ? buildWakeGeometry(p.w, p.h, p.yBase ?? 0)
  : p.flat ? buildFlatGeometry(p.w, p.yBase ?? 0) : buildCrossGeometry(p.w, p.h, p.yBase ?? 0, p.tiles ?? 1, p.lean ?? 0)

/**
 * ── ★★★ THE SHAPE OF A PLANT, IN ONE PLACE, BECAUSE A SECOND CONSUMER ARRIVED ────────────────
 * (2026-09-09, Alex: *"when grass, flowers or some other misc item block is selected its outlining
 * the whole block instead of just the item."*)
 *
 * The reticle's wireframe was a fixed 1.002 cube at the cell centre while a tuft is drawn 0.7 wide,
 * 0.55 tall and ROOTED 0.03 BELOW the cell floor — so the outline agreed with the plant about
 * nothing except which cell it was in. This is the sapling-icon bug exactly (`greedy.ts` draws a
 * cross, the icon drew a cube): two consumers deriving from one source and disagreeing about a
 * property the source did not carry.
 *
 * ⚠⚠ AND THE OBVIOUS FIX IS THE ONE THIS FILE HAS ALREADY BEEN BURNED BY TWICE — a hand-written
 * table of per-kind boxes beside the geometry that builds them. `CAP` says it ("EXPORTED SO A PROBE
 * CANNOT MIRROR IT"), the geometry factories say it ("One definition, two consumers"), and both
 * entries exist because a copy and its original agreed perfectly and were both wrong. A box table
 * would go stale the first time anyone re-tunes a width, and it would go stale SILENTLY, because a
 * slightly-wrong outline is not something a test notices or a player reports.
 *
 * So nothing below restates a number. `FLORA_PARTS` is the ONLY statement of what a cross-kind is
 * built from — `createFloraRenderer` builds its buffers from it — and `floraBounds` measures the
 * REAL transformed vertices of those same buffers through `floraMatrix`, which is the same function
 * `sync` composes its instance matrices with. Change a width and the outline moves with it; there
 * is no second place to forget.
 */
export const FLORA_PARTS: Record<number, ReadonlyArray<FloraPart>> = {
  // Widths chosen against the jitter so a blade can never overhang its cell (w/2 + 0.15 <= 0.5).
  // The tuft is a fan of three cards AND a flat rosette at knee height (2026-09-16): the rosette
  // is what a clump looks like from above, and from the side it is edge-on inside the fan.
  [FLORA.TUFT]: [
    { w: 0.7, h: 0.55, tiles: GRASS_VARIANTS, lean: CARD_LEAN },
    { w: 0.5, h: 0, yBase: 0.2, flat: true },   // the cap; 0.5: its diagonal + the jitter must stay inside the cell
    // The clump's contact shadow, the bloom mat's trick (2026-09-15 "stickers"): from above a
    // ground-tinted rosette on ground-tinted turf was camouflage; the dark disc under it is what
    // makes a clump read as a THING on the ground rather than a pattern in it.
    { w: 0.6, h: 0, yBase: 0.04, flat: true, shadow: true },
  ],
  [FLORA.TALL]: [{ w: 0.7, h: 1.05, tiles: GRASS_VARIANTS, lean: CARD_LEAN * 0.6 }],
  // ── The three flower forms (2026-09-14). `FLOWER` is the SINGLE: one stem, one big head, the
  // tallest of the three. The mat is a flat pad (leaves, then blooms over it) plus a low star so
  // it has SOME side profile; the bush is a leafy body with a bloom cluster riding its shoulders.
  [FLORA.FLOWER]: [{ w: 0.5, h: 0.82, lean: CARD_LEAN * 0.5 }, { w: 0.42, h: 0.42, yBase: 0.68, lean: CARD_LEAN * 0.5 }],
  [FLORA.BLOOM_MAT]: [
    { w: 0.98, h: 0, yBase: 0.05, flat: true },     // leaf pad, ground-multiplied
    { w: 0.98, h: 0, yBase: 0.07, flat: true },     // bloom dots, tinted
    { w: 0.6, h: 0.2, lean: CARD_LEAN * 0.5 },      // low star of blooms, tinted — the side view
    // The contact shadow, UNDER the leaves (2026-09-15, "stickers"). A hair wider than the pad so
    // the soft rim shows past the leaf edge; 0.04 over the root puts it 0.01 above the ground
    // plane (root is 0.97), clear of z-fighting and below the pad's 0.05.
    { w: 1.0, h: 0, yBase: 0.04, flat: true, shadow: true },
  ],
  // Bushes lean too (the noon shot from above: a bush was three dark lines and a fruit plate).
  [FLORA.BLOOM_BUSH]: [{ w: 0.85, h: 0.7, lean: CARD_LEAN * 0.5 }, { w: 0.7, h: 0.45, yBase: 0.4, lean: CARD_LEAN * 0.5 }],
  // A fruit bush is the bloom bush's shape a little bigger, with fruit where the blooms were.
  [FLORA.FRUIT]: [{ w: 0.9, h: 0.78, lean: CARD_LEAN * 0.5 }, { w: 0.74, h: 0.46, yBase: 0.28, lean: CARD_LEAN * 0.5 }],
  // A herb stands taller than a wildflower and shorter than tall grass: findable at a few blocks
  // without hiding what is behind it. Body plus tip.
  [FLORA.HERB]: [{ w: 0.55, h: 0.8, lean: CARD_LEAN * 0.6 }, { w: 0.34, h: 0.34, yBase: 0.72, lean: CARD_LEAN * 0.5 }],
  // Chest-high: a stand of grain has to read as CULTIVATED, and that silhouette is what separates a
  // field from a meadow. Unit height, because the planted feed scales it per growth phase.
  [FLORA.CROP]: [{ w: 0.62, h: 1.0, lean: CARD_LEAN * 0.4 }, { w: 0.42, h: 0.30, yBase: 0.72, lean: CARD_LEAN * 0.4 }],
  // Glow-moss is a pad and only a pad (2026-09-16): no blooms, no side star, and no contact
  // shadow — a thing that lights the ground does not darken it. The whole plant is one flat card.
  [FLORA.MOSS]: [
    { w: 0.98, h: 0, yBase: 0.05, flat: true },
    // A pad seen from eye level is a line (the bloom mat's lesson) — a low star gives it a cushion's
    // side profile. Same texture, so it reads as the same moss standing up a little.
    { w: 0.6, h: 0.14, lean: CARD_LEAN * 0.5 },
  ],
  // ── ★ WAKEREED (2026-09-18, RULED). Rooted on the WATER SURFACE (the probe reports the sheet's
  // plane as its ground): the card runs 0.45 under the sheet — the drowned quarter of the tile —
  // and 1.35 over it, reed-tall against a 1.8 keeper on the bank a block up. Narrow: a stand of
  // three hollow stalks, not a fan. Then the wake, a flat decal on the sheet running downstream
  // from the root: 0.7 wide, 1.9 long. The reed's lean is the shader's (see `injectSway`'s
  // `reed` mode); no card lean, so the flow is the only thing that bends it.
  [FLORA.REED]: [
    { w: 0.4, h: 1.8, yBase: -0.45 },
    { w: 0.8, h: 2.2, yBase: 0.02, wake: true },
  ],
}

/**
 * How hard each kind bends in the wind. ★ EXPORTED AND SHARED WITH THE SELECTION OUTLINE: the
 * outline is the same geometry at the same matrix, so if its vertex program bends by a different
 * amount the dark border walks off the blade. Two call sites, one number.
 */
export const FLORA_SWAY: Record<number, number> = {
  // Since the weight is height² (see `injectSway`) only the top of a blade carries the number:
  // the lean at the tip is roughly `amp` blocks downwind at a full gust.
  [FLORA.TUFT]: 0.09,
  [FLORA.TALL]: 0.18,
  [FLORA.FLOWER]: 0.14,
  [FLORA.BLOOM_MAT]: 0.015,   // a pad lying on the ground barely moves; uv.y is its far edge
  [FLORA.BLOOM_BUSH]: 0.06,
  [FLORA.FRUIT]: 0.05,
  [FLORA.HERB]: 0.1,
  [FLORA.CROP]: 0.08,
  [FLORA.MOSS]: 0.01,         // a cushion on the ground; the sway is only so the program compiles alike
  [FLORA.REED]: 0.03,         // the wind barely reaches a stalk the river already holds; the flow does the bending
}

/**
 * Where a kind's root sits above the spot's ground height, and how far it may wander inside its
 * cell. ⚠ THE ROOTS ARE BELOW 1.0 ON PURPOSE: a root emerging from the ground plane hides the
 * single-texel alpha seam that a root sitting exactly ON it re-manufactures. That 0.03 is also
 * why a cell-aligned outline can never fit a plant — it starts before the cell does.
 */
export const FLORA_PLACE: Record<number, { root: number; jitter: number }> = {
  [FLORA.TUFT]: { root: 0.97, jitter: 0.3 },
  [FLORA.TALL]: { root: 0.97, jitter: 0.3 },
  [FLORA.FLOWER]: { root: 0.97, jitter: 0.3 },
  [FLORA.BLOOM_MAT]: { root: 0.97, jitter: 0.04 },   // a pad covers its cell; it does not wander
  [FLORA.BLOOM_BUSH]: { root: 0.97, jitter: 0.2 },
  // ★ TIGHTENED FROM 0.15 WHEN THE BUSH BECAME A SOLID (2026-09-22). A card's reach is its
  // half-width only on the one rotation that points it at you; a sculpt's is its half-width
  // always. 0.5 (fitted half-width) x 1.06 (the biggest size roll) + 0.05 = 0.58, which is the
  // same reach the rotated 0.9-wide card already had — so the meadow's spacing does not move.
  [FLORA.FRUIT]: { root: 0.97, jitter: 0.1 },
  [FLORA.HERB]: { root: 0.97, jitter: 0.3 },
  [FLORA.CROP]: { root: 0.97, jitter: 0.3 },
  [FLORA.ROCK]: { root: 1.06, jitter: 0.5 },
  [FLORA.DEADFALL]: { root: 1.12, jitter: 0 },
  [FLORA.MUSHROOM]: { root: 0.99, jitter: 0.55 },
  [FLORA.PUFF]: { root: 0.99, jitter: 0.4 },
  [FLORA.MOSS]: { root: 0.97, jitter: 0.04 },        // covers its cell, like a bloom mat
  // The reed's ground IS the sheet's plane (probe: surface − 1), so the root sits exactly on it —
  // the stalk's drowned quarter hides any seam a 0.97 would have been for.
  [FLORA.REED]: { root: 1.0, jitter: 0.28 },
  // The shelf's `y` is its CELL (it hangs at height, there is no ground under it): the stack's
  // bottom bracket sits a little up the cell, and it never wanders — its back is on the trunk.
  [FLORA.SHELF]: { root: 0.08, jitter: 0 },
}

/** A stalk's height roll. Y only — a wider blade would thin the texture, not grow the plant. */
export const floraGrow = (variant: number): number => 0.75 + variant * 0.5
/** Scatter's size roll. All three axes for a stone; length is held at 1.0 for a log (see below). */
export const floraScatterScale = (variant: number): number => 0.8 + variant * 0.45
/**
 * The fruit bush's size roll — UNIFORM, and that is the whole difference from `floraGrow`.
 * A card is a picture of a plant, so stretching it on Y alone reads as a taller plant. A sculpt is
 * a plant, and the same stretch reads as a plant someone pulled. Narrower than the scatter roll
 * (0.8..1.25) because a stone may be a pebble or a boulder and a bush of a species may not.
 * ⚠ A DIAL, and the one to move if Alex says the bushes are too samey or too big.
 */
export const floraBushScale = (variant: number): number => 0.82 + variant * 0.24

const Y_UP = new THREE.Vector3(0, 1, 0)

/**
 * ★ THE ONE PLACEMENT DERIVATION. `sync` composes every instance matrix through this, and
 * `floraBounds` measures through it, so the outline cannot drift from the plant it outlines.
 *
 * `y` is the spot's GROUND height, fractional on a slumped lip — not a cell index.
 */
export function floraMatrix(
  kind: number, x: number, y: number, z: number, variant: number, alongX: boolean | undefined,
  out: THREE.Matrix4, off: THREE.Vector3, quat: THREE.Quaternion, scl: THREE.Vector3,
  face?: number,
): THREE.Matrix4 {
  // Deterministic per-spot jitter off the variant roll: offset within the cell, a turn, a little
  // size. Same spot, same blades, forever.
  const jx = (variant * 7.13) % 1 - 0.5, jz = (variant * 3.71) % 1 - 0.5
  const place = FLORA_PLACE[kind] ?? FLORA_PLACE[FLORA.TUFT]
  if (kind === FLORA.SHELF) {
    // ★ THE BRACKET'S BACK IS ON THE TRUNK. `face` is the unit step from the cell TOWARD the log
    // (`shelf-scan`), so the geometry's flat cut (local x = 0) goes on that face of the cell and
    // its local +x (the curve) points the other way. Rotating (1,0,0) by θ about Y gives
    // (cos θ, 0, −sin θ); we want that to be −face.
    const [fx, fz] = SHELF_FACES[face ?? 0]
    quat.setFromAxisAngle(Y_UP, Math.atan2(fz, -fx))
    off.set(x + 0.5 + fx * 0.5, y + place.root, z + 0.5 + fz * 0.5)
    const sz = 0.85 + ((variant * 5.31) % 1) * 0.3
    scl.set(sz, sz, sz)
  } else if (kind === FLORA.DEADFALL) {
    // Quarter turn for a Z-run; no jitter along the log's own axis or the run gaps show.
    quat.setFromAxisAngle(Y_UP, alongX ? 0 : Math.PI / 2)
    off.set(x + 0.5, y + place.root, z + 0.5)
    const sz = floraScatterScale(variant)
    scl.set(1, sz, sz)            // ⚠ NOT the length axis — that stays 1.0 so runs butt up
  } else if (kind === FLORA.ROCK) {
    quat.setFromAxisAngle(Y_UP, variant * Math.PI * 2)
    off.set(x + 0.5 + jx * place.jitter, y + place.root, z + 0.5 + jz * place.jitter)
    const sz = floraScatterScale(variant)
    scl.set(sz, sz * 0.75, sz)    // squat: a stone lies ON the ground, it does not stand
  } else if (kind === FLORA.MUSHROOM || kind === FLORA.PUFF) {
    quat.setFromAxisAngle(Y_UP, variant * Math.PI * 2)
    off.set(x + 0.5 + jx * place.jitter, y + place.root, z + 0.5 + jz * place.jitter)
    const sz = floraScatterScale(variant)
    scl.set(sz, sz, sz)
  } else if (kind === FLORA.FRUIT) {
    // The sculpt (2026-09-22). Turned and jittered like everything else, but scaled UNIFORMLY —
    // see `floraBushScale`. The turn is doing more work here than it does for a card: a card's
    // rotation only changes which way its picture faces, while a lumpy solid presents a different
    // silhouette at every angle, which is most of why a stand of these does not read as copy-paste.
    quat.setFromAxisAngle(Y_UP, variant * Math.PI * 2)
    off.set(x + 0.5 + jx * place.jitter, y + place.root, z + 0.5 + jz * place.jitter)
    const sz = floraBushScale(variant)
    scl.set(sz, sz, sz)
  } else if (kind === FLORA.BLOOM_MAT || kind === FLORA.MOSS) {
    // A pad has no height to roll; a quarter-turn is enough variety and keeps its square on the cell.
    off.set(x + 0.5 + jx * place.jitter, y + place.root, z + 0.5 + jz * place.jitter)
    quat.setFromAxisAngle(Y_UP, Math.floor(variant * 4) * (Math.PI / 2))
    scl.set(1, 1, 1)
  } else {
    off.set(x + 0.5 + jx * place.jitter, y + place.root, z + 0.5 + jz * place.jitter)
    quat.setFromAxisAngle(Y_UP, variant * Math.PI * 2)
    // The two grasses also roll their WIDTH (2026-09-15, "copy paste"): a stand a fifth wider or
    // narrower than its neighbour is the cheapest difference the eye still catches. Bounded so
    // w/2 · 1.15 + jitter stays inside the cell (0.35 · 1.15 + 0.15 = 0.55 > 0.5 by a hair — a
    // blade tip past the cell line is what the old cross did on every rotation and nobody saw).
    const sw = kind === FLORA.TUFT || kind === FLORA.TALL ? 0.85 + ((variant * 11.7) % 1) * 0.3 : 1
    // The reed's grow is narrower (0.85..1.15): a stand is reed-tall or it is not a reed, and the
    // wake rides the same matrix — a 0.75 wake behind a 1.25 one would read as two currents.
    scl.set(sw, kind === FLORA.REED ? 0.85 + variant * 0.3 : floraGrow(variant), sw)
  }
  return out.compose(off, quat, scl)
}

/** Local vertex positions per kind, built ONCE from the same buffers the renderer draws. */
let partVerts: Map<number, Float32Array[]> | null = null
/**
 * ⚠ KEYED ON `kind` FOR EVERY PLANT BUT ONE. The two fruit bushes are one FLORA kind and two
 * different meshes (see `BUSH_MODELS`), so FRUIT is measured per MATERIAL and stored under a
 * composite key. Without this the reticle would box a low sprawling moonberry with the tall
 * sunfruit's dome — a box that is loose by a third, and loose in a way no test notices unless it
 * names the material.
 */
const fruitKey = (mat: number) => -mat
function vertsFor(kind: number, mat?: number): Float32Array[] {
  if (kind === FLORA.FRUIT && mat !== undefined) {
    const k = fruitKey(mat)
    if (!partVerts?.has(k)) {
      vertsFor(FLORA.TUFT)          // force the one-time build below
      const m = bushModel(mat)
      const grab1 = (g: THREE.BufferGeometry): Float32Array => {
        const a = (g.getAttribute('position').array as Float32Array).slice(); g.dispose(); return a
      }
      partVerts!.set(k, [grab1(fitBush(m.leaves(), m.box)), grab1(fitBush(m.fruit(), m.box))])
    }
    return partVerts!.get(k) ?? []
  }
  if (!partVerts) {
    partVerts = new Map()
    for (const k of Object.keys(FLORA_PARTS)) {
      const kind2 = Number(k)
      partVerts.set(kind2, FLORA_PARTS[kind2].map(p => {
        const g = partGeometry(p)
        const a = (g.getAttribute('position').array as Float32Array).slice()
        g.dispose()
        return a
      }))
    }
    // ⚠ SCATTER READS ITS REAL FACTORIES, NOT A RESTATED PRIMITIVE. `logGeo.rotateZ` is what makes
    // a log LIE DOWN and `translate` is what stacks a cap on its stalk — measuring a fresh
    // `CylinderGeometry(...)` here would produce a box around a STANDING log, internally consistent
    // and wrong, which is the mirror bug this file's own header warns about.
    const grab = (g: THREE.BufferGeometry): Float32Array => {
      const a = (g.getAttribute('position').array as Float32Array).slice()
      g.dispose()
      return a
    }
    partVerts.set(FLORA.ROCK, [grab(floraRockGeo())])
    partVerts.set(FLORA.DEADFALL, [grab(floraLogGeo())])
    partVerts.set(FLORA.MUSHROOM, [grab(floraShroomStemGeo()), grab(floraShroomCapGeo())])
    partVerts.set(FLORA.PUFF, [grab(floraPuffGeo())])
    partVerts.set(FLORA.SHELF, [grab(floraShelfGeo())])
    // ★ THE FRUIT BUSH OVERRIDES ITS OWN `FLORA_PARTS` ROW, WHICH IS STILL THERE ON PURPOSE.
    // The pool draws the sculpt; the row survives because `/bushtest`'s card half still builds
    // from it, and an A/B whose control quietly disappears is not an A/B. So this set() must come
    // AFTER the FLORA_PARTS loop above, or the reticle would go on boxing the control.
    partVerts.set(FLORA.FRUIT, [grab(floraFruitLeavesGeo()), grab(floraFruitBerriesGeo())])
  }
  return partVerts.get(kind) ?? []
}

export interface FloraBox { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }

const bMtx = new THREE.Matrix4()
const bOff = new THREE.Vector3()
const bQuat = new THREE.Quaternion()
const bScl = new THREE.Vector3()
const bVec = new THREE.Vector3()

/**
 * The world-space box a drawn plant actually occupies.
 *
 * ★ MEASURED, NOT DECLARED. Every vertex of the kind's real geometry is pushed through the real
 * instance matrix and the extremes are kept — so a rotated cross gets the extent of the ROTATED
 * cross (between 0.71 and 1.0 of its width, depending where the roll put it) rather than the
 * corner-to-corner box of an axis-aligned one, which would be up to 41% too wide and would read as
 * a loose outline rather than a wrong one. Cheap enough for the frame loop: one hit cell, at most
 * 26 vertices, and the local buffers are built once.
 *
 * `y` is the spot's GROUND height, exactly as `PlantProbe` reports it.
 */
export function floraBounds(
  kind: number, x: number, y: number, z: number, variant: number, alongX?: boolean, mat?: number,
): FloraBox | null {
  const parts = vertsFor(kind, mat)
  if (!parts.length) return null
  floraMatrix(kind, x, y, z, variant, alongX, bMtx, bOff, bQuat, bScl)
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
  for (const v of parts) {
    for (let i = 0; i < v.length; i += 3) {
      bVec.set(v[i], v[i + 1], v[i + 2]).applyMatrix4(bMtx)
      if (bVec.x < x0) x0 = bVec.x
      if (bVec.y < y0) y0 = bVec.y
      if (bVec.z < z0) z0 = bVec.z
      if (bVec.x > x1) x1 = bVec.x
      if (bVec.y > y1) y1 = bVec.y
      if (bVec.z > z1) z1 = bVec.z
    }
  }
  return { x0, y0, z0, x1, y1, z1 }
}

/**
 * ★ THE PIXELS MOVED TO `tex/flora-tex.ts` AND THESE ARE NOW WRAPPERS (2026-08-12).
 * Ground cover has no block face, so its ITEM ICON had nothing to derive from and grass was on the
 * list for Alex to hand-paint. But the world draws grass from CODE, so the icon needs the same
 * generator rather than new art — hand-painting one would have created a second source of truth for
 * what a tuft looks like, which is exactly what `item-icon.ts` refuses for blocks. The fills are
 * three-free now; all that lives here is the GPU wrapper.
 */
function toTexture(data: Uint8Array, size: number, height = size): THREE.DataTexture {
  const t = new THREE.DataTexture(data, size, height)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

const makeBladeTexture = (seed: number, blades: number, size = BLADE_TILE): THREE.DataTexture =>
  toTexture(bladePixels(seed, blades, size), size)

const makeHeadTexture = (size = 8): THREE.DataTexture => toTexture(headPixels(size), size)

/**
 * ── ★ THE CURRENT REACHES THE FLORA: THE LEAN MAP (2026-09-18) ────────────────────────────────
 * Alex: *"the way it flows to the flora"*. A plant on the river ribbon leans downstream — full at
 * the waterline, nothing where the meadow takes over — and every card material bends by the same
 * vector, so the bank reads as one country tugged by one river rather than a row of tufts each
 * with an opinion. `bankLeanAt` (height.ts) is the field; this is how it reaches ~fourteen
 * instanced meshes without fourteen attributes: ONE 2D texture over the loaded window, two blocks
 * per texel, RG = the lean vector packed around 128, and the shared sway samples it at the
 * instance's world xz. A texture rather than an instanced attribute for the same reason the
 * light ring is a torus and not a per-chunk uniform (light-texture.ts): one sampler, one program
 * per kind, no per-mesh write site to forget. Rebuilt on every `sync`, which already runs once
 * per settled load ring — the cheap `riverField` gate answers "no river" for most texels.
 * ⚠ LINEAR-filtered on purpose: a 2-block texel read NEAREST is a step in the lean at every
 * other block, which the eye catches on a row of tall grass.
 */
export const LEAN_TEXEL = 2
/** Tip lean at full strength, in blocks — beside the tuft's 0.09 gust, a steady 0.16 reads as bent. */
export const LEAN_AMP = 0.16
/** The reed's lean at the tip, in blocks — most of a 1.35 stalk's height: combed nearly flat at full
 *  tug. A uniform (`setReedLean`), so `__flora().reedLean(v)` moves it on a running page. */
export const REED_LEAN = 0.85
/** The slack cycle's rate (rad/s): 0.48 ≈ 13s from combed to standing and back. */
export const REED_SLACK_RATE = 0.48
/** Off-map (and a fresh renderer) is 128 = no lean. */
const LEAN_ZERO = 128

export interface LeanMap {
  texture: THREE.DataTexture
  /** World xz of texel (0, 0)'s corner and the map's extent in blocks — the shader's sampling frame. */
  origin: THREE.Vector2
  size: THREE.Vector2
  /** Rebuild over the loaded columns. Returns how many texels carried a lean (the instrument). */
  fill: (cols: { x0: number; z0: number }[], seed: number) => number
  /** Zero the map (a space without rivers). Returns 0, so the call reads like `fill`'s. */
  clear: () => number
  dispose: () => void
}

export function createLeanMap(): LeanMap {
  let w = 4, h = 4
  let data = new Uint8Array(w * h * 4).fill(LEAN_ZERO)
  let texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType)
  const setup = (t: THREE.DataTexture) => {
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.ClampToEdgeWrapping
    t.generateMipmaps = false; t.needsUpdate = true
  }
  setup(texture)
  const origin = new THREE.Vector2(0, 0)
  const size = new THREE.Vector2(w * LEAN_TEXEL, h * LEAN_TEXEL)
  const map: LeanMap = {
    texture, origin, size,
    fill(cols, seed) {
      if (cols.length === 0) return 0
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity
      for (const c of cols) { x0 = Math.min(x0, c.x0); z0 = Math.min(z0, c.z0); x1 = Math.max(x1, c.x0 + SECTION); z1 = Math.max(z1, c.z0 + SECTION) }
      // One texel of margin so the clamp reads zero at the map's edge, never the last real value.
      x0 -= LEAN_TEXEL; z0 -= LEAN_TEXEL; x1 += LEAN_TEXEL; z1 += LEAN_TEXEL
      const nw = Math.ceil((x1 - x0) / LEAN_TEXEL), nh = Math.ceil((z1 - z0) / LEAN_TEXEL)
      if (nw !== w || nh !== h) {
        w = nw; h = nh
        data = new Uint8Array(w * h * 4)
        texture.dispose()
        texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType)
        setup(texture)
        map.texture = texture
      }
      data.fill(LEAN_ZERO)
      origin.set(x0, z0)
      size.set(w * LEAN_TEXEL, h * LEAN_TEXEL)
      let live = 0
      // The margin ring stays zero: only interior texels are asked (the clamp's whole point).
      for (let j = 1; j < h - 1; j++) {
        for (let i = 1; i < w - 1; i++) {
          // Texel centre, so a plant at the cell's middle reads its own value under LINEAR.
          const [lx, lz] = bankLeanAt(x0 + (i + 0.5) * LEAN_TEXEL, z0 + (j + 0.5) * LEAN_TEXEL, seed)
          if (lx === 0 && lz === 0) continue
          const o = (j * w + i) * 4
          data[o] = Math.round(LEAN_ZERO + lx * 127)
          data[o + 1] = Math.round(LEAN_ZERO + lz * 127)
          live++
        }
      }
      texture.needsUpdate = true
      return live
    },
    clear() { data.fill(LEAN_ZERO); texture.needsUpdate = true; return 0 },
    dispose() { texture.dispose() },
  }
  return map
}

export function createFloraRenderer(light: LightUniforms = createLightUniforms()): FloraRenderer {
  const uTime = { value: 0 }
  const lean = createLeanMap()
  // ⚠ `value` is re-pointed when the map grows (a new DataTexture); the uniform object is shared
  // by every program, so one write lands everywhere — same shape as `cartoon`/`light` below.
  const uLean = { value: lean.texture as THREE.Texture }
  const uLeanOrigin = { value: lean.origin }
  const uLeanSize = { value: lean.size }
  const uReedLean = { value: REED_LEAN }
  // ── ★★ FLORA ON THE WORLD'S LIGHT (2026-09-17) ─────────────────────────────────────────────
  // Every plant material was plain Lambert under the scene lights: no cartoon stack (the blocks'
  // three-step banding, the 0.35 floor, the hour) and no LIGHT FIELD — a lantern lit the ground
  // and not the grass standing on it, and at noon a tuft shaded smoothly on a block that shaded
  // in bands. The last visible seam once the pieces (09-13) and the canopy (09-08) had joined.
  // Now both flora families take the stack from the one module: the cards sample the field at
  // their OWN cell (`here`) with the block-edge outline off, the solids (rock, log, mushroom,
  // puff) take it exactly as a piece does. One uniform set, shared, so `setCartoon` is one write.
  // ⚠ The light uniforms default to a fresh set when none is passed (tests, dev pages) — the
  // field then reads as unbuilt (fully lit), which is what those pages showed before.
  const cartoon = cartoonUniforms()
  const injectStack = (shader: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }, card: boolean): void => {
    Object.assign(shader.uniforms, cartoon, light)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFWPos;\nvarying vec3 vFWNorm;')
      // ⚠ AFTER the sway, which edits `transformed` at begin_vertex — the field must be read where
      // the bent blade actually is, and the injections are applied in order (sway first below).
      .replace('#include <project_vertex>', [
        '#ifdef USE_INSTANCING',
        'vFWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;',
        'vFWNorm = normalize((modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz);',
        '#else',
        'vFWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        'vFWNorm = normalize(mat3(modelMatrix) * normal);',
        '#endif',
        '#include <project_vertex>',
      ].join('\n'))
    // ★ The material's EMISSIVE rides past the stack and the field (the ore-glow slot): three has
    // already folded it into outgoingLight, so it is taken back out first — or a glow-moss would
    // read as "fully lit" to the banding and then be put out by the night field it exists to light.
    const emit = 'outgoingLight -= totalEmissiveRadiance;\n'
      + cartoonStackGlsl('vFWNorm', 'vFWPos', 'totalEmissiveRadiance', card ? { here: true, noOutline: true } : {})
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CARTOON_DECL_GLSL + 'varying vec3 vFWPos;\nvarying vec3 vFWNorm;')
      .replace('#include <output_fragment>', emit)
      .replace('#include <opaque_fragment>', emit)
  }

  /**
   * ★ THE SWAY INJECTION, SHARED BY THE PLANT AND ITS SELECTION OUTLINE (2026-09-09).
   * Both materials MUST bend by the identical amount or the dark border slides off the blade it is
   * drawn on — the outline is the same geometry at the same matrix, so any difference in the vertex
   * program shows up as two plants a few centimetres apart. One function, called twice.
   *
   * ⚠ THE SWAY IS GATED ON `USE_INSTANCING`, which is why the outline is drawn as a ONE-INSTANCE
   * InstancedMesh and not as a plain Mesh. A plain Mesh compiles without that define, stands
   * perfectly still, and detaches from a swaying plant — correct-looking code, wrong-looking world.
   */
  const injectSway = (shader: { uniforms: Record<string, unknown>; vertexShader: string }, amp: number, reed = false): void => {
    shader.uniforms.uTime = uTime
    shader.uniforms.uLean = uLean
    shader.uniforms.uLeanOrigin = uLeanOrigin
    shader.uniforms.uLeanSize = uLeanSize
    shader.uniforms.uReedLean = uReedLean
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform sampler2D uLean;\nuniform vec2 uLeanOrigin;\nuniform vec2 uLeanSize;\nuniform float uReedLean;\nattribute float aSway;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + [
        '{',
        '  #ifdef USE_INSTANCING',
        // ── the river's lean: steady, downstream, off the lean map at the instance's own cell.
        // Sampled per VERTEX (the instance xz is the same for all of them) — cheap, and a vertex
        // program cannot do it anywhere else. A mat's amp is tiny so its pad does not slide.
        '  vec2 leanUv = (instanceMatrix[3].xz - uLeanOrigin) / uLeanSize;',
        '  vec2 lean = (texture2D(uLean, leanUv).rg - 128.0 / 255.0) * (255.0 / 127.0);',
        // ── ⚠ THE LEAN IS A WORLD VECTOR AND `transformed` IS LOCAL (found 2026-09-18 by the reed).
        // `begin_vertex` runs BEFORE the instance matrix, and every card carries a random yaw
        // (`floraMatrix`), so a downstream vector added here was turned by that yaw: each plant
        // leaned the right AMOUNT in its own random direction, and the bank shipped that way for a
        // day — it read as "tugged" because the tug phase is by world position. A reed combed
        // upstream is not a reed, so the vector is brought into the instance's frame first: the
        // inverse yaw, read off `instanceMatrix[0]` (the local x axis in world space, (cos φ, −sin φ)).
        '  vec2 axL = normalize(instanceMatrix[0].xz);',
        '  lean = vec2(axL.x * lean.x + axL.y * lean.y, -axL.y * lean.x + axL.x * lean.y);',
        // ── ★ THE REED IS IN THE WATER, NOT BESIDE IT (2026-09-18). The bank's lean is a tug the
        // river's wind gives dry grass: LEAN_AMP at the tip, 0.8 steady with a breath. The reed
        // stands in the current itself, and canon says what that does: *"combed flat by the flow
        // and standing up again when it slacks."* So its lean is REED_LEAN (most of a block at the
        // tip, which on a 1.35 stalk is nearly flat) and its tug is a SLACK CYCLE — a slow swing
        // between a third and full, ~13s round, phased by position so a stand combs together and
        // the river's stands do not. The wind term below still runs, at the reed's tiny amp.
        reed
          ? '  float lw = aSway * aSway * uReedLean;'
          : '  float lw = aSway * aSway * ' + LEAN_AMP.toFixed(3) + ' * min(1.0, ' + amp.toFixed(3) + ' / 0.09);',
        // A current tugs and eases: 0.8 steady with a slow 0.2 breath, never the wind's gust shape.
        reed
          ? '  float tug = 0.34 + 0.66 * (0.5 + 0.5 * sin(uTime * ' + REED_SLACK_RATE.toFixed(3) + ' + (instanceMatrix[3].x + instanceMatrix[3].z) * 0.4));'
          : '  float tug = 0.8 + 0.2 * sin(uTime * 1.1 + (instanceMatrix[3].x + instanceMatrix[3].z) * 0.4);',
        '  transformed.x += lean.x * lw * tug;',
        '  transformed.z += lean.y * lw * tug;',
        '  transformed.y -= dot(lean, lean) * lw * tug * 0.35;',
        // ★ WIND, NOT WATER (2026-09-14, Alex: "looking a bit like sea weed"). The old sway was
        // sin on x + cos on z at two frequencies — a Lissajous circle, weighted linearly by height:
        // every tip drew a slow loop, which is exactly how kelp moves in a swell. Wind is different
        // on three counts, and each one is a line below: it has ONE direction (a blade leans
        // downwind and springs back, it does not orbit); a blade is stiff at the root and bends at
        // the tip (weight is height SQUARED, not height); and it comes in GUSTS — a slow envelope
        // rolling across the meadow with a quick flutter riding on it, not a metronome.
        '  float ph = (instanceMatrix[3].x * 0.83 + instanceMatrix[3].z * 0.55) * 0.35;',
        '  float w = aSway * aSway * ' + amp.toFixed(3) + ';',
        '  float gust = 0.55 + 0.45 * sin(uTime * 0.7 - ph);',
        '  float flutter = 0.22 * sin(uTime * 3.3 + ph * 2.7) + 0.1 * sin(uTime * 5.1 - ph * 1.9);',
        '  float bend = gust + flutter;',
        '  transformed.x += 0.83 * bend * w;',
        '  transformed.z += 0.55 * bend * w;',
        // A bent blade is not a longer blade: dip the tip a little so the lean reads as a bow.
        '  transformed.y -= bend * bend * w * 0.35;',
        '  #endif',
        '}',
      ].join('\n'))
  }

  /**
   * ★ THE ATLAS COLUMN, per instance. `aTile` is an instanced float on the geometry; the card's
   * own column rides in uv.x's integer part (see `buildCrossGeometry`). Wrapped so any pairing
   * lands on a real column, then divided down to atlas space. Only kinds with `tiles > 1` get
   * this — a one-tile material keeps the stock uv path and no attribute.
   */
  const injectAtlas = (shader: { vertexShader: string }, tiles: number): void => {
    if (tiles <= 1) return
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n#ifdef USE_INSTANCING\nattribute float aTile;\n#endif')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n' + [
        '#ifdef USE_INSTANCING',
        '  vMapUv.x = mod(uv.x + aTile, ' + tiles.toFixed(1) + ') / ' + tiles.toFixed(1) + ';',
        '#endif',
      ].join('\n'))
  }

  /** Lambert so flora lives under the same day-night lights as the pieces; the sway is injected
   *  and the material stays ONE compiled program per mesh (audit's whole point). */
  const swayMaterial = (map: THREE.Texture, amp: number, tiles = 1): THREE.MeshLambertMaterial => {
    const m = new THREE.MeshLambertMaterial({ map, alphaTest: 0.4, side: THREE.DoubleSide })
    m.onBeforeCompile = (shader) => { injectSway(shader, amp); injectAtlas(shader, tiles); injectStack(shader, true) }
    return m
  }

  /**
   * ── ★★★ THE SELECTION BORDER: DARKEN THE ITEM'S OWN EDGE TEXELS ──────────────────────────────
   * Alex, 2026-09-09, on the fitted wireframe box that replaced the full-block one: *"thats a
   * little better ... but is there no way to just darken the border of the item when looking at
   * it?"* Right instinct, and a box was always a compromise — a box around a grass tuft describes
   * the tuft's EXTENT, and what a player reads as "this one" is its SHAPE.
   *
   * ★ SO NOTHING IS GROWN AND NOTHING IS ADDED. This is the plant's own geometry, its own texture
   * and its own sway, with a fragment program that keeps ONLY the texels that are opaque AND touch
   * a transparent neighbour — the sprite's silhouette, one texel wide — and paints them dark.
   * Interior texels discard, so the plant beneath shows through untouched.
   *
   * ⚠ THE INVERTED-HULL OUTLINE (a scaled-up dark copy behind the original) IS WRONG FOR AN ALPHA
   * CARD and was rejected on paper rather than by trying it: a card is half gaps, so the enlarged
   * dark copy is visible THROUGH the gaps between the blades, and a tuft comes out with a dark
   * smear behind it instead of a rim around it. It is the right trick for the closed solids, and
   * they use it (see `outlineHullMaterial`).
   *
   * ⚠ ONE TEXEL, MEASURED FROM THE TEXTURE, NOT DECLARED. `1.0 / map.image.width` — the blades are
   * 16px and the heads are 8px, so a hard-coded offset would be a half-texel rim on one and a
   * double on the other. Reading it off the texture also means a re-paint at a new resolution keeps
   * a one-texel border by construction. Pixel art with NearestFilter: one texel is the convention.
   */
  // ── ★ THE BORDER IS A DARK SHADE OF THE TEXEL, NOT BLACK (2026-09-22) ─────────────────────
  // Alex, from inside a stand of tall grass on prod: a solid black plant under the crosshair. On a
  // blade tile the blades are ONE texel wide, so every opaque texel touches a transparent one and
  // the "one-texel border" is the entire sprite — a black rim around a 1px line is a black line.
  // The rule stays (edge texels, interior discarded); what an edge texel is painted changes: its
  // own colour at `OUTLINE_SHADE`, so a wide leaf keeps a dark rim and a thin blade reads as a
  // shaded stand of grass rather than a silhouette. Pixel art's own convention (a selout is a
  // darker shade of the fill, not #000). Unlit (MeshBasic), so at night it can only ever be as dark
  // as the shade of the unlit texel: dark enough by day, near-invisible by moonlight, never a glow.
  const outlineMaterial = (map: THREE.Texture, amp: number, tiles = 1, reed = false): THREE.MeshBasicMaterial => {
    const m = new THREE.MeshBasicMaterial({
      map, alphaTest: 0.4, side: THREE.DoubleSide, color: 0xffffff,
      // Same geometry at the same matrix as the plant means identical depth: without an offset the
      // two z-fight and the border strobes. depthWrite off so the border never occludes the plant.
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    })
    m.onBeforeCompile = (shader) => {
      injectSway(shader, amp, reed)
      injectAtlas(shader, tiles)
      // ⚠ Read off the ATLAS width for an atlas texture: one texel is one texel of the whole strip.
      const texel = 1 / ((map.image as { width?: number })?.width || 16)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + [
          '{',
          '  float aT = ' + texel.toFixed(6) + ';',
          // Only opaque texels can be a border; transparent ones fall through to the standard
          // alpha test below and are discarded there.
          '  if (diffuseColor.a >= 0.4) {',
          '    float nL = texture2D(map, vMapUv + vec2(-aT, 0.0)).a;',
          '    float nR = texture2D(map, vMapUv + vec2( aT, 0.0)).a;',
          '    float nD = texture2D(map, vMapUv + vec2(0.0, -aT)).a;',
          '    float nU = texture2D(map, vMapUv + vec2(0.0,  aT)).a;',
          // An interior texel is surrounded by opaque neighbours: drop it and let the plant show.
          '    if (min(min(nL, nR), min(nD, nU)) >= 0.4) discard;',
          '    diffuseColor.rgb *= ' + OUTLINE_SHADE.toFixed(3) + ';',
          '  }',
          '}',
        ].join('\n'))
    }
    return m
  }

  /**
   * The closed solids get the outline the cards could not use: a dark copy of the hull, grown
   * along its normals and drawn BACK faces only, so it peeks out exactly at the silhouette. A
   * stone, a log and a mushroom cap are closed and convex enough for it, and they carry no alpha
   * for a texel test to read.
   */
  const outlineHullMaterial = (): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, depthWrite: false })

  /**
   * ── ★ THE WAKE'S PROGRAM (2026-09-18): TURN TO THE FLOW, BREATHE WITH THE SLACK ──────────────
   * The wake quad is built running local +z from the root (`buildWakeGeometry`). The instance
   * matrix gives the reed a random yaw like every card, so the quad has to be turned TWICE in the
   * vertex program: the world heading is the lean map's vector at the instance cell (the same
   * texel the stalk leans by, so stalk and wake can never disagree), and it is first brought into
   * the instance's local frame by the inverse of that yaw — read straight off `instanceMatrix[0]`,
   * the local x axis in world space — then the quad's +z is rotated onto it.
   *
   * ⚠ NO LEAN IS NO WAKE. A still pond, the Glade (whose lean map is cleared), a texel outside the
   * map: the vector is zero, and the quad collapses to nothing rather than pointing +z. Canon is
   * exact about this: *"a still pond has no wake."* The alpha also rides the reed's slack cycle at
   * the SAME phase, so the wake is whitest when the stalk is combed flattest.
   */
  const injectWake = (shader: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }): void => {
    shader.uniforms.uTime = uTime
    shader.uniforms.uLean = uLean
    shader.uniforms.uLeanOrigin = uLeanOrigin
    shader.uniforms.uLeanSize = uLeanSize
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform sampler2D uLean;\nuniform vec2 uLeanOrigin;\nuniform vec2 uLeanSize;\nvarying float vWake;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + [
        'vWake = 0.0;',
        '{',
        '  #ifdef USE_INSTANCING',
        '  vec2 leanUv = (instanceMatrix[3].xz - uLeanOrigin) / uLeanSize;',
        '  vec2 lean = (texture2D(uLean, leanUv).rg - 128.0 / 255.0) * (255.0 / 127.0);',
        '  float L = length(lean);',
        '  if (L < 0.02) { transformed = vec3(0.0); } else {',
        '    vec2 dW = lean / L;',
        // instanceMatrix[0].xz = (cos φ, −sin φ) for a yaw φ about Y; the inverse yaw on (x, z).
        '    vec2 ax = normalize(instanceMatrix[0].xz);',
        '    float c = ax.x, s = -ax.y;',
        '    vec2 dL = vec2(c * dW.x - s * dW.y, s * dW.x + c * dW.y);',
        '    float x = transformed.x, z = transformed.z;',
        '    transformed.x = x * dL.y + z * dL.x;',
        '    transformed.z = -x * dL.x + z * dL.y;',
        // The stalk's own slack cycle, same phase — whitest when combed flattest; never fully out.
        '    float tug = 0.34 + 0.66 * (0.5 + 0.5 * sin(uTime * ' + REED_SLACK_RATE.toFixed(3) + ' + (instanceMatrix[3].x + instanceMatrix[3].z) * 0.4));',
        '    vWake = min(1.0, L * 1.4) * (0.6 + 0.4 * tug);',
        '  }',
        '  #endif',
        '}',
      ].join('\n'))
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vWake;')
      // Foam moves: a ripple runs down the wake (uv.y is the run) so the decal is not a sticker on
      // a river that scrolls under it. Multiplicative on the tile's own alpha; the V stays a V.
      .replace('#include <map_fragment>', '#include <map_fragment>\n'
        + 'diffuseColor.a *= vWake * (0.7 + 0.3 * sin(vMapUv.y * 22.0 - uTime * 3.2));')
  }
  const wakeMaterial = (map: THREE.Texture): THREE.MeshLambertMaterial => {
    const m = new THREE.MeshLambertMaterial({ map, transparent: true, depthWrite: false, alphaTest: 0.04, side: THREE.DoubleSide })
    m.onBeforeCompile = (shader) => { injectWake(shader); injectStack(shader, true) }
    return m
  }

  // The two grasses are ATLASES of GRASS_VARIANTS tiles; the flower stem keeps a plain tile.
  const bladeTex = makeBladeTexture(TUFT_SEED, TUFT_BLADES)
  const tuftTex = toTexture(
    bladeAtlasPixels(TUFT_SEED, GRASS_VARIANTS, BLADE_TILE, BLADE_TILE, sd => bladePixels(sd, TUFT_BLADES)),
    BLADE_TILE * GRASS_VARIANTS, BLADE_TILE)
  const tallTex = toTexture(
    bladeAtlasPixels(TALL_SEED, GRASS_VARIANTS, BLADE_TILE, TALL_TILE_H, sd => tallBladePixels(sd, TALL_BLADES)),
    BLADE_TILE * GRASS_VARIANTS, TALL_TILE_H)
  const headTex = makeHeadTexture()
  const bushTex = toTexture(bushPixels(), 32)
  // ★ LIT LIKE THE CARD, NOT LIKE A ROCK (Alex, 09-22: "the model bush looks too bright, can we
  // match the card's lighting"). Two things made it bright: the solid family's light path (the
  // field sampled by normal, no `here`) and a FLAT leaf colour where the card's painted tile is
  // mostly darker than its tint. So: the card's own stack mode, and the tint scaled by the bush
  // tile's mean brightness — the model's average albedo IS the card's, by construction.
  // Second pass (the first — the card's stack mode over a flat colour — still read pale at night):
  // the model wears the CARD'S OWN TILE as its map, tinted by the card's own arithmetic
  // (leaf / BLADE_GREEN), through the card's stack — albedo and light are the card's by
  // construction; only the shape differs. No sway (amp 0), no alpha cut (a solid has no holes).
  // ⚠ THE CARD TILE HAS HOLES, AND A SOLID HAS NO ALPHA CUT: its transparent texels are black RGB,
  // and on the model they drew as black blotches (Alex's first look at the sculpt). The solids wear
  // a FILLED copy — every clear texel takes the tile's mean opaque colour — so the skin is the
  // card's pixels where the card has pixels and the card's average everywhere else.
  // And the card's tile is DRAWN AS A BUSH — a highlight blob on one side, shadow on the other —
  // so wrapped round a solid, one flank wore the highlight as a cream slab (Alex's second look).
  // The solids wear the tile's PIXELS in a scrambled order: every opaque texel, dealt over the
  // 32×32 by a fixed hash. Same colours, same mean, same spread as the card; no region larger
  // than a texel. At nearest filtering that is fine leafy noise, which is what a bush's skin is.
  const solidBushTex = (() => {
    const px = bushPixels(), out = new Uint8Array(px.length)
    const opaque: number[] = []
    for (let i = 0; i < px.length; i += 4) if (px[i + 3] >= 128) opaque.push(i)
    for (let t = 0; t < px.length / 4; t++) {
      const v = Math.sin(t * 12.9898 + 78.233) * 43758.5453
      const src = opaque[Math.floor((v - Math.floor(v)) * opaque.length)] ?? 0
      out[t * 4] = px[src]; out[t * 4 + 1] = px[src + 1]; out[t * 4 + 2] = px[src + 2]; out[t * 4 + 3] = 255
    }
    return toTexture(out, 32)
  })()

  const clusterTex = toTexture(bloomClusterPixels(), 32)
  const matLeafTex = toTexture(matLeafPixels(), 32)
  const matBloomTex = toTexture(matBloomPixels(), 32)
  const matShadowTex = toTexture(matShadowPixels(), 32)
  const mossTex = toTexture(mossPixels(), 32)
  const rosetteTex = toTexture(rosettePixels(), BLADE_TILE)
  // ★ ONE TEXTURE, TWO COLUMNS, ONE MESH: a sunfruit bush carries a few big fruit, a moonberry
  // bush many small berries — the same atlas trick the grasses use, with the column chosen by
  // MATERIAL rather than by roll (see `FRUIT_COL`). The fruit card has no per-card spread.
  const fruitTex = toTexture(
    bladeAtlasPixels(0xf7a1, FRUIT_MATS.length, 32, 32,
      (sd, col) => col === 0 ? fruitClusterPixels(32, sd, 4, 0.13) : fruitClusterPixels(32, sd, 9, 0.07)),
    32 * FRUIT_MATS.length, 32)

  // ★ EVERY WIDTH AND HEIGHT COMES FROM `FLORA_PARTS`, WHICH THE RETICLE'S OUTLINE ALSO MEASURES.
  // The reasoning behind each number lives on the table; restating one here would give the outline
  // and the plant two sources that agree until somebody re-tunes exactly one of them.
  const crossGeo = (kind: number, part = 0): THREE.BufferGeometry => partGeometry(FLORA_PARTS[kind][part])
  const tuftGeo = crossGeo(FLORA.TUFT)
  const tallGeo = crossGeo(FLORA.TALL)
  const stemGeo = crossGeo(FLORA.FLOWER)
  const headGeo = crossGeo(FLORA.FLOWER, 1)
  const matLeafGeo = crossGeo(FLORA.BLOOM_MAT)
  const matBloomGeo = crossGeo(FLORA.BLOOM_MAT, 1)
  const matStarGeo = crossGeo(FLORA.BLOOM_MAT, 2)
  const matShadowGeo = crossGeo(FLORA.BLOOM_MAT, 3)
  const bushGeo = crossGeo(FLORA.BLOOM_BUSH)
  const bushHeadGeo = crossGeo(FLORA.BLOOM_BUSH, 1)
  // ★ THE FRUIT BUSH'S CARDS SURVIVE FOR THE SHOWCASE ONLY (2026-09-22). The wild pool draws
  // `bushLeafGeo`/`bushBerryGeo` below; these two are `/bushtest`'s control and nothing else reads
  // them. Deleting them would win a few hundred bytes and cost the ability to re-run the A/B.
  const fruitBushGeo = crossGeo(FLORA.FRUIT)
  // The sculpt (picaso's glb, baked). The pool's two parts — a leafy body and the fruit on it.
  // The sculpts — ONE PAIR PER FRUIT MATERIAL (see `BUSH_MODELS`). `bushLeafGeo`/`bushBerryGeo`
  // stay as the sunfruit's, because the reticle's default and the icon path want a single answer
  // when nobody has said which bush; the pools below index by material.
  const bushGeos = BUSH_MODEL_MATS.map(mat => ({ mat, leaf: floraFruitLeavesGeo(mat), berry: floraFruitBerriesGeo(mat) }))
  const bushLeafGeo = bushGeos[0].leaf, bushBerryGeo = bushGeos[0].berry
  const herbGeo = crossGeo(FLORA.HERB)
  const cropGeo = crossGeo(FLORA.CROP)
  // The head rides at the top of a full-height stalk. Scaled with the stalk by the instance matrix,
  // so a half-grown planted crop carries a half-height head rather than a floating one.
  const cropHeadGeo = crossGeo(FLORA.CROP, 1)
  const tipGeo = crossGeo(FLORA.HERB, 1)
  // ── ★ THE RIPE GLINT — canon's "sparkle hints" on a ready crop (2026-09-16) ─────────────────
  // A small star of three cards floating over a crop that `isCropReady`, additive, unlit, pulsing
  // in the vertex program off the same `uTime` the sway reads. It is the one thing in the feed
  // that is not a plant: a keeper scanning a row of twenty beds needs to see WHICH ones want them
  // from the far end of the plot, and a ripe head alone is a hue change at that distance.
  // ⚠ NOT a FLORA kind: no material, no probe, never picked, never outlined. `count` is 0 unless
  // something is ripe, so the bounds and outline tests see nothing new.
  const glintGeo = buildCrossGeometry(GLINT_SIZE, GLINT_SIZE, GLINT_LIFT)

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
  const solidMaterial = (): THREE.MeshLambertMaterial => {
    const m = new THREE.MeshLambertMaterial({ side: THREE.FrontSide })
    m.onBeforeCompile = (shader) => injectStack(shader, false)
    return m
  }

  // A stone: low, angular, wider than tall so it reads as lying ON the ground rather than set INTO
  // it. Flattened on Y by the instance scale below rather than in the geometry, so one buffer
  // serves every size.
  const rockGeo = floraRockGeo()
  // A log: EXACTLY ONE CELL LONG (1.0) so consecutive cells of a run butt against each other into a
  // continuous trunk with no gap and no overlap. Six-sided rather than smooth — this world's
  // vocabulary is faceted, and a 6-gon costs 12 triangles. Built lying along +X; the instance
  // quaternion turns it a quarter turn for a Z-axis log (see `alongX`).
  const logGeo = floraLogGeo()
  // A mushroom in two parts, for the same reason a herb is body-plus-tip: the cap carries the
  // colour and the silhouette, the stalk just holds it up.
  const shroomStemGeo = floraShroomStemGeo()
  const shroomCapGeo = floraShroomCapGeo()

  const rockMat = solidMaterial()
  const logMat = solidMaterial()
  const shroomStemMat = solidMaterial()
  const shroomCapMat = solidMaterial()
  const puffGeo = floraPuffGeo()
  // A puffball is a sphere, and a Lambert sphere is two-thirds shadow — at noon the first shot
  // read as a huddle of round grey stones. A warm lift on the shaded side keeps it fungus-pale
  // without lighting the ground (it is the body's own paleness, not a light channel).
  const puffMat = solidMaterial()
  puffMat.emissive = new THREE.Color(0x4a4236)
  // The shelf fungus (2026-09-21): a bracket's underside is all shadow (it faces down, on the
  // shaded side of a trunk), so the same warm lift as the puff, a touch browner.
  const shelfGeo = floraShelfGeo()
  const shelfMat = solidMaterial()
  shelfMat.emissive = new THREE.Color(0x3e3020)

  const herbMat = swayMaterial(bladeTex, FLORA_SWAY[FLORA.HERB])
  // Sway a touch stiffer than a herb: a laden crop is heavier and a field that ripples like grass
  // reads as grass. Its own tiles, so a crop is never accidentally drawn with a blade texture.
  const cropStalkTex = toTexture(cropStalkPixels(3), 16)
  const cropHeadTex = toTexture(cropHeadPixels(8), 8)
  const cropMat = swayMaterial(cropStalkTex, FLORA_SWAY[FLORA.CROP])
  const cropHeadMat = swayMaterial(cropHeadTex, FLORA_SWAY[FLORA.CROP])
  const glintTex = toTexture(glintPixels(GLINT_TEX), GLINT_TEX)
  const glintMat = new THREE.MeshBasicMaterial({
    map: glintTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, color: GLINT_COLOR,
  })
  glintMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + [
        '{',
        '  #ifdef USE_INSTANCING',
        // Each bed twinkles on its own beat (phase off its position), breathing in size and
        // bobbing a hair — a glint that pulses in lockstep across a row reads as a UI effect.
        '  float gp = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;',
        '  float pulse = 0.7 + 0.3 * sin(uTime * 2.6 + gp);',
        '  transformed.xz *= pulse;',
        '  transformed.y += 0.06 * sin(uTime * 1.4 + gp);',
        '  #endif',
        '}',
      ].join('\n'))
  }
  const tipMat = swayMaterial(headTex, FLORA_SWAY[FLORA.HERB])
  const tuftMat = swayMaterial(tuftTex, FLORA_SWAY[FLORA.TUFT], GRASS_VARIANTS)
  // The cap sways with the fan (same amp, so the outline rule holds): uv.y is its far edge, so the
  // far blades of the rosette move with the fan's tips — the clump leans as one thing.
  const tuftCapGeo = crossGeo(FLORA.TUFT, 1)
  const tuftCapMat = swayMaterial(rosetteTex, FLORA_SWAY[FLORA.TUFT])
  const tallMat = swayMaterial(tallTex, FLORA_SWAY[FLORA.TALL], GRASS_VARIANTS)
  const stemMat = swayMaterial(bladeTex, FLORA_SWAY[FLORA.FLOWER])
  const headMat = swayMaterial(headTex, FLORA_SWAY[FLORA.FLOWER])
  const matLeafMat = swayMaterial(matLeafTex, FLORA_SWAY[FLORA.BLOOM_MAT])
  const matBloomMat = swayMaterial(matBloomTex, FLORA_SWAY[FLORA.BLOOM_MAT])
  const matStarMat = swayMaterial(clusterTex, FLORA_SWAY[FLORA.BLOOM_MAT])
  // ★ THE ONE TRANSPARENT FLORA MATERIAL. Every other card is a cutout (alphaTest) in the opaque
  // pass; this one is a soft fade, so it goes through the transparent pass with depth write OFF —
  // it must never occlude the pad it sits under, and a cutout would harden its rim into a black
  // ring. Unlit on purpose (Basic, not Lambert): a shadow does not catch the sun. No sway: it is
  // the ground's darkening, not part of the plant.
  const matShadowMat = new THREE.MeshBasicMaterial({
    map: matShadowTex, color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false,
  })
  const bushMat = swayMaterial(bushTex, FLORA_SWAY[FLORA.BLOOM_BUSH])
  const bushHeadMat = swayMaterial(clusterTex, FLORA_SWAY[FLORA.BLOOM_BUSH])
  const fruitBushMat = swayMaterial(bushTex, FLORA_SWAY[FLORA.FRUIT])
  const fruitMat = swayMaterial(fruitTex, FLORA_SWAY[FLORA.FRUIT], FRUIT_MATS.length)
  // ── ★ THE SCULPT'S TWO MATERIALS, AND THE SHOWCASE SHARES THEM ────────────────────────────
  // Lit like the card and not like a rock: the card's own stack mode, the card's own pixels (the
  // scrambled `solidBushTex`), the card's own tint arithmetic. Only the shape differs — which is
  // what made the A/B a fair one, and is why the winner ships with the loser's skin.
  // ⚠ NO SWAY. A card on a stalk bends; a leafy solid the size of a cell does not, and the same
  // vertex program applied to a closed volume shears it. If a fruit bush ever needs to breathe in
  // the wind it wants its own gentle whole-body lean, not the blade's tip-weighted one.
  // ⚠ NO ALPHA CUT, `FrontSide`: a solid has no holes and never shows its interior.
  const bushLeafMat = new THREE.MeshLambertMaterial({ map: solidBushTex, side: THREE.FrontSide, flatShading: true })
  bushLeafMat.onBeforeCompile = (shader) => injectStack(shader, true)
  /**
   * One berry material PER SPECIES, because canon gives them different light (see `FRUIT_GLOW`).
   * `shimmer` > 0 breathes the emissive on a per-instance phase; 0 leaves it steady and the
   * injection costs one multiply by 1.0.
   */
  const berryMaterialFor = (fmat: number): THREE.MeshLambertMaterial => {
    const glow = FRUIT_GLOW[fmat] ?? { emissive: 0, shimmer: 0 }
    const m = new THREE.MeshLambertMaterial({ side: THREE.FrontSide, flatShading: true })
    m.emissive = new THREE.Color(FRUIT_TINT[fmat] ?? 0xffffff)
    m.emissiveIntensity = glow.emissive
    m.onBeforeCompile = (shader) => {
      injectStack(shader, true)
      if (glow.emissive <= 0) return
      shader.uniforms.uTime = uTime
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vShim;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + [
          '{',
          '  #ifdef USE_INSTANCING',
          // Phase off world xz, exactly as the sway and the glint do — neighbours breathe apart.
          '  float bp = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;',
          `  vShim = 1.0 - ${glow.shimmer.toFixed(3)} + ${glow.shimmer.toFixed(3)} * (0.5 + 0.5 * sin(uTime * 1.5 + bp));`,
          '  #else',
          '  vShim = 1.0;',
          '  #endif',
          '}',
        ].join('\n'))
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vShim;')
        // ⚠ AFTER the emissive is assembled, never before — `totalEmissiveRadiance` is declared
        // and set by the includes above this anchor, so an earlier injection would not compile.
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vShim;')
    }
    return m
  }
  // ⚠ BUILT ONCE PER SPECIES, UP FRONT, NOT INSIDE THE POOL LOOP. A `berryMaterialFor(...)` call
  // in the loop is two materials today and one-per-object the day the loop iterates over anything
  // else — `render-audit` refuses the shape rather than the count, and it is right to: that is the
  // WebGL-context-loss bug this file's header opens with. (It caught exactly this, 2026-09-22.)
  const berryMats = new Map<number, THREE.MeshLambertMaterial>(BUSH_MODEL_MATS.map(m => [m, berryMaterialFor(m)]))
  // The default pair's berry material (the showcase and the reticle's fallback species).
  const bushBerryMat = berryMats.get(MAT.SUNFRUIT_BUSH) ?? berryMats.values().next().value as THREE.MeshLambertMaterial
  // ★ THE ONE FLORA MATERIAL THAT GLOWS. The pad is painted near-white and the tint is the moss
  // colour, so the emissive is that same colour scaled — one row in `MATERIAL_COLOR` drives the
  // day look, the night glow and the item icon. The block behind it carries the light channel
  // that actually lights the ground (registry `emit`); this is the plant's own body lit from within.
  const mossGeo = crossGeo(FLORA.MOSS)
  const mossMat = swayMaterial(mossTex, FLORA_SWAY[FLORA.MOSS])
  mossMat.emissive = new THREE.Color(MATERIAL_COLOR[MAT.GLOW_MOSS] ?? 0x7fe0b8)
  mossMat.emissiveIntensity = MOSS_EMISSIVE
  // ── ★ WAKEREED (2026-09-18): the stalk on the reed sway (comb + slack), the wake on its own
  // program. The stalk is tinted from MATERIAL_COLOR like the moss (painted near-white); the wake
  // is white foam and takes no tint.
  const reedTex = toTexture(reedPixels(), BLADE_TILE, TALL_TILE_H)
  const wakeTex = toTexture(wakePixels(), BLADE_TILE, TALL_TILE_H)
  const reedGeo = crossGeo(FLORA.REED)
  const wakeGeo = crossGeo(FLORA.REED, 1)
  const reedMat = new THREE.MeshLambertMaterial({ map: reedTex, alphaTest: 0.4, side: THREE.DoubleSide })
  reedMat.onBeforeCompile = (shader) => { injectSway(shader, FLORA_SWAY[FLORA.REED], true); injectStack(shader, true) }
  const wakeMat = wakeMaterial(wakeTex)

  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, CAP.tuft)
  const tuftCaps = new THREE.InstancedMesh(tuftCapGeo, tuftCapMat, CAP.tuft)
  tuftCaps.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.tuft * 3), 3)
  const tuftShadowGeo = crossGeo(FLORA.TUFT, 2)
  const tuftShadows = new THREE.InstancedMesh(tuftShadowGeo, matShadowMat, CAP.tuft)
  const talls = new THREE.InstancedMesh(tallGeo, tallMat, CAP.tall)
  // Slice ②: the blades take the colour of the ground under them (see GRASS_OF_GROUND).
  tufts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.tuft * 3), 3)
  talls.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.tall * 3), 3)
  // The atlas column per instance lives on the GEOMETRY (that is where three reads instanced
  // attributes from), so the outline meshes below get their own clone with a one-slot copy.
  const tuftTile = new THREE.InstancedBufferAttribute(new Float32Array(CAP.tuft), 1).setUsage(THREE.DynamicDrawUsage)
  const tallTile = new THREE.InstancedBufferAttribute(new Float32Array(CAP.tall), 1).setUsage(THREE.DynamicDrawUsage)
  tuftGeo.setAttribute('aTile', tuftTile)
  tallGeo.setAttribute('aTile', tallTile)
  /** Which atlas column an instance starts on — a slice of the variant roll the jitter and the
   *  turn do not already read, so column and turn are not correlated. */
  const tileOf = (variant: number): number => Math.floor(((variant * 613.7) % 1) * GRASS_VARIANTS)
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, CAP.flower)
  const heads = new THREE.InstancedMesh(headGeo, headMat, CAP.flower)
  heads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.flower * 3), 3)
  // The mat: leaves take the ground's green (a multiplier, like a blade), both bloom layers take
  // the head tint. The bush: body ground-green, cluster tinted. Same two arithmetics as the flower.
  const matLeaves = new THREE.InstancedMesh(matLeafGeo, matLeafMat, CAP.mat)
  const matBlooms = new THREE.InstancedMesh(matBloomGeo, matBloomMat, CAP.mat)
  const matStars = new THREE.InstancedMesh(matStarGeo, matStarMat, CAP.mat)
  const matShadows = new THREE.InstancedMesh(matShadowGeo, matShadowMat, CAP.mat)
  matLeaves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.mat * 3), 3)
  matBlooms.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.mat * 3), 3)
  matStars.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.mat * 3), 3)
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, CAP.bush)
  const bushHeads = new THREE.InstancedMesh(bushHeadGeo, bushHeadMat, CAP.bush)
  bushes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.bush * 3), 3)
  bushHeads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.bush * 3), 3)
  // The fruit bush: body in the bush's own leaf colour (a multiplier over the green tile, like a
  // blade over its ground), fruit in FRUIT_TINT. Same two arithmetics as everything above.
  /**
   * ── ★ THE FRUIT POOL IS NOW ONE PAIR PER SPECIES, ON ONE SHARED BUDGET ──────────────────────
   * Two sculpts means two geometries means two instanced meshes; there is no atlas trick that
   * saves a draw here, because what differs is the MESH, not the pixels on it. Four draws for the
   * world's fruit bushes.
   * ⚠ `CAP.fruit` IS THE TOTAL, NOT THE PER-SPECIES ALLOWANCE. Each mesh is sized to the cap so
   * either species may fill the ring alone (they grow on different grounds, so a woodland really
   * can be all moonberry), but `sync` stops at `CAP.fruit` ACROSS both — otherwise adding a
   * species would silently double the worst case the budget was measured against.
   */
  const bushPools = bushGeos.map(g => {
    const leaves = new THREE.InstancedMesh(g.leaf, bushLeafMat, CAP.fruit)
    const berryMat = berryMats.get(g.mat) ?? bushBerryMat
    const berries = new THREE.InstancedMesh(g.berry, berryMat, CAP.fruit)
    leaves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.fruit * 3), 3)
    berries.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.fruit * 3), 3)
    // `n` counts BODIES, `f` counts FRUITED bodies — a picked bush draws its leaves and no fruit
    // (`picking.ts`), so the two meshes no longer share a count.
    return { mat: g.mat, leaves, berries, berryMat, n: 0, f: 0 }
  })
  const bushPoolOf = new Map(bushPools.map(b => [b.mat, b]))
  const bushMeshes = bushPools.flatMap(b => [b.leaves, b.berries])
  /**
   * The atlas column for a fruit material — the order `FRUIT_MATS` lists them in.
   * ⚠ THE WILD POOL NO LONGER READS THIS. The sculpt carries one fruit cluster for every species
   * and tells sunfruit from moonberry by TINT alone, so the two-column atlas (four big fruit /
   * nine small) is now a card-only idea and lives on for `/bushtest`'s control. The shape half of
   * that distinction comes back when picaso bakes the moonberry — same script, different seed.
   */
  const FRUIT_COL = new Map<number, number>(FRUIT_MATS.map((m, i) => [m, i]))
  const herbs = new THREE.InstancedMesh(herbGeo, herbMat, CAP.herb)
  const tips = new THREE.InstancedMesh(tipGeo, tipMat, CAP.herb)
  const crops = new THREE.InstancedMesh(cropGeo, cropMat, CAP.crop)
  const cropHeads = new THREE.InstancedMesh(cropHeadGeo, cropHeadMat, CAP.crop)
  const glints = new THREE.InstancedMesh(glintGeo, glintMat, CAP.glint)
  glints.renderOrder = 2          // after the cards it floats among; additive over them, never under
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
  // The forage (2026-09-16). A puff is tinted per instance so a huddle is not four identical
  // creams; the moss takes its colour as a tint over the near-white pad, like a bloom head.
  const puffs = new THREE.InstancedMesh(puffGeo, puffMat, CAP.puff)
  const mosses = new THREE.InstancedMesh(mossGeo, mossMat, CAP.moss)
  puffs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.puff * 3), 3)
  mosses.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.moss * 3), 3)
  const shelves = new THREE.InstancedMesh(shelfGeo, shelfMat, CAP.shelf)
  shelves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.shelf * 3), 3)
  const reeds = new THREE.InstancedMesh(reedGeo, reedMat, CAP.reed)
  const wakes = new THREE.InstancedMesh(wakeGeo, wakeMat, CAP.reed)
  reeds.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.reed * 3), 3)
  // The wake is transparent and lies a hair over the sheet: drawn after the cards (like the
  // glints) so it is never sorted behind the water it decorates.
  wakes.renderOrder = 2

  for (const m of [tufts, tuftCaps, tuftShadows, talls, stems, heads, matLeaves, matBlooms, matStars, matShadows, bushes, bushHeads, ...bushMeshes, herbs, tips, crops, cropHeads, glints, rocks, logs, shroomStems, shroomCaps, puffs, mosses, reeds, wakes, shelves]) {
    m.count = 0
    m.frustumCulled = false     // instances span the whole load radius; the default bounds lie
    m.receiveShadow = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }

  const group = new THREE.Group()
  group.add(tufts, tuftCaps, tuftShadows, talls, stems, heads, matLeaves, matBlooms, matStars, matShadows, bushes, bushHeads, ...bushMeshes, herbs, tips, crops, cropHeads, glints, rocks, logs, shroomStems, shroomCaps, puffs, mosses, reeds, wakes, shelves)

  // ── the showcase (2026-09-22): a few card bushes and model bushes at exact spots, off the pools ──
  const SHOW_CAP = 8
  const showCard = new THREE.InstancedMesh(fruitBushGeo, fruitBushMat, SHOW_CAP)
  const showFruitGeo = crossGeo(FLORA.FRUIT, 1)
  const showFruitTile = new THREE.InstancedBufferAttribute(new Float32Array(SHOW_CAP), 1)
  showFruitGeo.setAttribute('aTile', showFruitTile)
  const showFruit = new THREE.InstancedMesh(showFruitGeo, fruitMat, SHOW_CAP)
  showCard.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SHOW_CAP * 3), 3)
  showFruit.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SHOW_CAP * 3), 3)
  // ★ THE SHOWCASE WEARS THE POOL'S OWN MATERIALS (`bushLeafMat` / `bushBerryMat`). It used to
  // build its own identical pair, which was harmless while the model was only ever a showcase and
  // became a trap the moment the pool shipped one: two materials that agree perfectly today and
  // diverge the first time anyone tunes exactly one of them — and the one you would tune is the
  // one you can SEE, which is the showcase. Then the A/B stops measuring what the world draws.
  const showModelMat = bushLeafMat, showFruitMat = bushBerryMat
  const modelGeo = floraModelBushGeo(7)
  const showLeaves = new THREE.InstancedMesh(modelGeo.leaves, showModelMat, SHOW_CAP)
  const showBerries = new THREE.InstancedMesh(modelGeo.fruit, showFruitMat, SHOW_CAP)
  showLeaves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SHOW_CAP * 3), 3)
  showBerries.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SHOW_CAP * 3), 3)
  // The sculpted bush (picaso's glb) — same materials as the stand-in, so only the shape differs.
  let sculptLeaves: THREE.InstancedMesh | null = null, sculptFruit: THREE.InstancedMesh | null = null
  showCard.count = 0; showFruit.count = 0; showLeaves.count = 0; showBerries.count = 0
  // Same as every pool: the geometry's bounds sit at the origin, so the default culling would
  // hide the pair unless world (0,0,0) happened to be on screen (it did not; two blank shots).
  for (const m of [showCard, showFruit, showLeaves, showBerries]) m.frustumCulled = false
  group.add(showCard, showFruit, showLeaves, showBerries)

  // ── ★★ THE SELECTION OUTLINE'S OWN MESHES — ONE INSTANCE EACH, COUNT 0 UNTIL AIMED AT ────────
  // One InstancedMesh per (kind, part), capacity 1. ⚠ INSTANCED ON PURPOSE, not a plain Mesh: the
  // sway is gated on `USE_INSTANCING`, so a plain Mesh would compile without it, stand still, and
  // shed its border the moment the wind moved the plant. Capacity 1 because only one thing is ever
  // under the reticle.
  //
  // `grow` is 1 for the cards — their border is drawn IN PLACE by darkening edge texels, so
  // growing them would be wrong twice over — and slightly above 1 for the solids, whose back-face
  // hull has to peek out past the silhouette to be seen at all.
  // An outline mesh sharing an atlas kind's geometry would read `aTile` from the POOL's slot 0 —
  // some other plant's column. Its own clone carries a one-slot `aTile` that `setHighlight` fills.
  const hlAtlasGeo = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
    const c = g.clone()
    c.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(1), 1).setUsage(THREE.DynamicDrawUsage))
    return c
  }
  const hlDefs: { kind: number; geo: THREE.BufferGeometry; mat: THREE.Material; grow: number; fmat?: number; berryHull?: boolean }[] = [
    { kind: FLORA.TUFT, geo: hlAtlasGeo(tuftGeo), mat: outlineMaterial(tuftTex, FLORA_SWAY[FLORA.TUFT], GRASS_VARIANTS), grow: 1 },
    { kind: FLORA.TUFT, geo: tuftCapGeo, mat: outlineMaterial(rosetteTex, FLORA_SWAY[FLORA.TUFT]), grow: 1 },
    { kind: FLORA.TALL, geo: hlAtlasGeo(tallGeo), mat: outlineMaterial(tallTex, FLORA_SWAY[FLORA.TALL], GRASS_VARIANTS), grow: 1 },
    { kind: FLORA.FLOWER, geo: stemGeo, mat: outlineMaterial(bladeTex, FLORA_SWAY[FLORA.FLOWER]), grow: 1 },
    { kind: FLORA.FLOWER, geo: headGeo, mat: outlineMaterial(headTex, FLORA_SWAY[FLORA.FLOWER]), grow: 1 },
    { kind: FLORA.BLOOM_MAT, geo: matLeafGeo, mat: outlineMaterial(matLeafTex, FLORA_SWAY[FLORA.BLOOM_MAT]), grow: 1 },
    { kind: FLORA.BLOOM_MAT, geo: matBloomGeo, mat: outlineMaterial(matBloomTex, FLORA_SWAY[FLORA.BLOOM_MAT]), grow: 1 },
    { kind: FLORA.BLOOM_MAT, geo: matStarGeo, mat: outlineMaterial(clusterTex, FLORA_SWAY[FLORA.BLOOM_MAT]), grow: 1 },
    { kind: FLORA.BLOOM_BUSH, geo: bushGeo, mat: outlineMaterial(bushTex, FLORA_SWAY[FLORA.BLOOM_BUSH]), grow: 1 },
    { kind: FLORA.BLOOM_BUSH, geo: bushHeadGeo, mat: outlineMaterial(clusterTex, FLORA_SWAY[FLORA.BLOOM_BUSH]), grow: 1 },
    // ★ THE FRUIT BUSH MOVED FROM A CARD BORDER TO A HULL when it became a sculpt (2026-09-22).
    // A card's border is painted IN PLACE by darkening its own edge texels; a solid has no edge
    // texels to darken, so it takes the grown back-face hull the rock and the puff take. Both
    // parts get one — the fruit sits proud of the crown, and a hull round the body alone would
    // leave the berries outside their own outline.
    // ⚠ AND ONE PAIR PER SPECIES, keyed by `fmat`: a moonberry is low and broad (0.62 tall) and a
    // sunfruit is a dome (0.95), so one hull for both is loose by a third on whichever it is not.
    ...bushGeos.flatMap(g => ([
      { kind: FLORA.FRUIT, fmat: g.mat, geo: g.leaf, mat: outlineHullMaterial(), grow: 1.12 },
      { kind: FLORA.FRUIT, fmat: g.mat, geo: g.berry, mat: outlineHullMaterial(), grow: 1.12, berryHull: true },
    ])),
    { kind: FLORA.HERB, geo: herbGeo, mat: outlineMaterial(bladeTex, FLORA_SWAY[FLORA.HERB]), grow: 1 },
    { kind: FLORA.HERB, geo: tipGeo, mat: outlineMaterial(headTex, FLORA_SWAY[FLORA.HERB]), grow: 1 },
    { kind: FLORA.CROP, geo: cropGeo, mat: outlineMaterial(cropStalkTex, FLORA_SWAY[FLORA.CROP]), grow: 1 },
    { kind: FLORA.CROP, geo: cropHeadGeo, mat: outlineMaterial(cropHeadTex, FLORA_SWAY[FLORA.CROP]), grow: 1 },
    { kind: FLORA.ROCK, geo: rockGeo, mat: outlineHullMaterial(), grow: 1.14 },
    { kind: FLORA.DEADFALL, geo: logGeo, mat: outlineHullMaterial(), grow: 1.1 },
    { kind: FLORA.MUSHROOM, geo: shroomStemGeo, mat: outlineHullMaterial(), grow: 1.12 },
    { kind: FLORA.MUSHROOM, geo: shroomCapGeo, mat: outlineHullMaterial(), grow: 1.12 },
    { kind: FLORA.PUFF, geo: puffGeo, mat: outlineHullMaterial(), grow: 1.12 },
    { kind: FLORA.SHELF, geo: shelfGeo, mat: outlineHullMaterial(), grow: 1.12 },
    { kind: FLORA.MOSS, geo: mossGeo, mat: outlineMaterial(mossTex, FLORA_SWAY[FLORA.MOSS]), grow: 1 },
    // The reed's border is the stalk's; the wake is water and gets none (FloraPart.wake).
    { kind: FLORA.REED, geo: reedGeo, mat: outlineMaterial(reedTex, FLORA_SWAY[FLORA.REED], 1, true), grow: 1 },
  ]
  const hlMeshes = hlDefs.map(d => {
    const im = new THREE.InstancedMesh(d.geo, d.mat, 1)
    im.count = 0
    im.frustumCulled = false
    im.renderOrder = 3       // after the plants, so the border is never sorted behind its own plant
    return { ...d, mesh: im }
  })
  for (const h of hlMeshes) group.add(h.mesh)
  const hlMtx = new THREE.Matrix4()
  const hlGrow = new THREE.Vector3()

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
  let planted: ReadonlyArray<PlantedSpot> = []

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
      // ⚠⚠ `alongX` WAS DROPPED HERE AND NO LOG HAS EVER LAIN ALONG ITS RUN (found 2026-09-09 by
      // the reticle-outline guard, which measured a log across the axis the probe said it ran on).
      // The probe derives the axis from the neighbouring voxel and documents at length why it reads
      // the world rather than the field; this line then copied every OTHER field into the Spot, so
      // `s.alongX` was always undefined and `floraMatrix` took the quarter-turn branch for all of
      // them. Every X-run rendered as logs turned across it — which also defeats the `scl(1, sz,
      // sz)` reasoning one function down, whose whole point is that consecutive cells butt up into
      // a continuous trunk. A computed field with no consumer, wearing a passing suite.
      out.push({ x, y: p.y, z, kind: p.kind, variant: p.variant, mat: p.mat, ground: p.ground, alongX: p.alongX })
    }
    cache.set(k, out)
    return out
  }

  // ── ★ THE SHELF SPOTS — the trunk-side reader, cached like the ground spots (2026-09-21) ──
  // Same key, a second map: `invalidate(colKey)` drops both, because an edit that moves a bracket
  // (a felled trunk, a picked shelf) lands on the same column the ground edit does. The variant
  // folds `y` in: three brackets stacked at one (x, z) must not be three identical sizes.
  const shelfCache = new Map<string, Spot[]>()
  const shelfSpotsFor = (k: string, x0: number, z0: number, seed: number, scan: (x0: number, z0: number) => ShelfCell[]): Spot[] => {
    const hit = shelfCache.get(k)
    if (hit) return hit
    const out: Spot[] = scan(x0, z0).map(c => ({
      x: c.x, y: c.y, z: c.z, kind: FLORA.SHELF,
      variant: ((c.x * 0.618 + c.z * 0.382 + c.y * 0.137 + seed * 1e-4) % 1 + 1) % 1,
      mat: MAT.SHELF_FUNGUS, ground: 0, face: c.face,
    }))
    shelfCache.set(k, out)
    return out
  }

  // ── ★ THE PLANTED FEED, written after the wild spots — and on its OWN beat (2026-09-16) ────
  // The wild sync waits for the streaming queue to go quiet (`incoming` in the host), which on a
  // slow device or a headless box can be a long wait; the first cut hung the planted crops on that
  // same gate and a keeper's beds sat empty while columns trickled in. The planted tail does not
  // need a rebuild: it starts where the wild feed stopped (`baseC`/`baseH`, remembered from the
  // last sync) and rewrites only itself. `sync` calls it at the end; `setPlanted` calls it at once.
  let baseC = 0, baseH = 0
  let demandC = 0, demandH = 0
  const writePlanted = (): void => {
    // ── ★ THE PLANTED FEED, appended after the wild spots (2026-09-16) ─────────────────────
    // Same pools, same tints, same sway; only the matrix differs. A bed's crop stands CENTRED
    // in its cell (no jitter — it was put there) at a turn off the bed's own position, and its
    // height is the STAGE, not `floraGrow`'s random size. The ripe head is the ripeness signal
    // and is drawn only at STAGE_RIPE; before that the head instance is collapsed to nothing
    // (the two pools are 1:1 by index, so it cannot simply be skipped). Caps are shared with the
    // wild feed and counted into the same demand row, so a plot cannot overflow silently.
    let nC = baseC, nH = baseH, nGl = 0
    for (const s of planted) {
      const look = plantedLook(s.cropId)
      if (!look) continue
      const place = FLORA_PLACE[look.pool === 'herb' ? FLORA.HERB : FLORA.CROP]
      off.set(s.x + 0.5, s.y + place.root, s.z + 0.5)
      quat.setFromAxisAngle(Y_UP, s.variant * Math.PI * 2)
      const grow = STAGE_GROW[s.stage]
      scl.set(1, grow, 1)
      mtx.compose(off, quat, scl)
      const ripe = s.stage === STAGE_RIPE
      if (look.pool === 'crop') {
        demandC++
        if (nC < CAP.crop) {
          crops.setMatrixAt(nC, mtx)
          crops.setColorAt(nC, tint.set(look.body ?? MATERIAL_COLOR[look.mat] ?? 0x8f9f5a))
          cropHeads.setMatrixAt(nC, ripe ? mtx : ZERO_MTX)
          cropHeads.setColorAt(nC, tint.set(look.head ?? CROP_HEAD[look.mat] ?? 0xffffff))
          nC++
        }
      } else {
        demandH++
        if (nH < CAP.herb) {
          herbs.setMatrixAt(nH, mtx)
          herbs.setColorAt(nH, tint.set(MATERIAL_COLOR[look.mat] ?? 0x6f8f4a))
          tips.setMatrixAt(nH, ripe ? mtx : ZERO_MTX)
          tips.setColorAt(nH, tint.set(HERB_TIP[look.mat] ?? 0xffffff))
          nH++
        }
      }
      if (ripe && nGl < CAP.glint) {
        // The glint sits ON the crown, not over it — the first shot had it a whole plant
        // above the head, reading as weather. The head part tops out at 1.02 of the unit stalk;
        // the star's base rides just under that so it overlaps the head's tip. Unscaled: a star
        // should not stretch with the stalk.
        scl.set(1, 1, 1)
        off.y = s.y + place.root + 0.88
        glints.setMatrixAt(nGl, mtx.compose(off, quat, scl))
        nGl++
      }
    }
    glints.count = nGl
    glints.instanceMatrix.needsUpdate = true
    crops.count = nC; cropHeads.count = nC; herbs.count = nH; tips.count = nH
    for (const m of [crops, cropHeads, herbs, tips]) {
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  }

  return {
    group,
    setSculpt(leaves, fruit) {
      if (sculptLeaves) { group.remove(sculptLeaves); sculptLeaves.dispose() }
      if (sculptFruit) { group.remove(sculptFruit); sculptFruit.dispose() }
      sculptLeaves = new THREE.InstancedMesh(leaves, showModelMat, SHOW_CAP)
      sculptLeaves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SHOW_CAP * 3), 3)
      sculptLeaves.count = 0; sculptLeaves.frustumCulled = false
      group.add(sculptLeaves)
      if (fruit) {
        sculptFruit = new THREE.InstancedMesh(fruit, showFruitMat, SHOW_CAP)
        sculptFruit.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SHOW_CAP * 3), 3)
        sculptFruit.count = 0; sculptFruit.frustumCulled = false
        group.add(sculptFruit)
      } else sculptFruit = null
    },
    showcase(entries) {
      let nc = 0, nm = 0, ns = 0
      for (const e of entries) {
        mtx.compose(off.set(e.x + 0.5, e.y, e.z + 0.5), quat.setFromAxisAngle(Y_UP, (e.x * 7 + e.z * 3) % 6), scl.set(1, 1, 1))
        if (e.kind === 'card') {
          if (nc >= SHOW_CAP) continue
          showCard.setMatrixAt(nc, mtx); showFruit.setMatrixAt(nc, mtx)
          const leaf = MATERIAL_COLOR[e.mat] ?? 0x569e42
          showCard.setColorAt(nc, tint.setRGB(((leaf >> 16) & 255) / BLADE_GREEN[0], ((leaf >> 8) & 255) / BLADE_GREEN[1], (leaf & 255) / BLADE_GREEN[2]))
          showFruit.setColorAt(nc, tint.set(FRUIT_TINT[e.mat] ?? 0xffffff))
          showFruitTile.setX(nc, FRUIT_COL.get(e.mat) ?? 0)
          nc++
        } else if (e.kind === 'sculpt') {
          if (!sculptLeaves || ns >= SHOW_CAP) continue
          const leaf = MATERIAL_COLOR[e.mat] ?? 0x569e42
          sculptLeaves.setMatrixAt(ns, mtx)
          sculptLeaves.setColorAt(ns, tint.setRGB(((leaf >> 16) & 255) / BLADE_GREEN[0], ((leaf >> 8) & 255) / BLADE_GREEN[1], (leaf & 255) / BLADE_GREEN[2]))
          if (sculptFruit) { sculptFruit.setMatrixAt(ns, mtx); sculptFruit.setColorAt(ns, tint.set(FRUIT_TINT[e.mat] ?? 0xffffff)) }
          ns++
        } else {
          if (nm >= SHOW_CAP) continue
          showLeaves.setMatrixAt(nm, mtx); showBerries.setMatrixAt(nm, mtx)
          // The card's tint arithmetic over the card's tile: leaf / BLADE_GREEN (a multiplier).
          const leaf = MATERIAL_COLOR[e.mat] ?? 0x569e42
          showLeaves.setColorAt(nm, tint.setRGB(((leaf >> 16) & 255) / BLADE_GREEN[0], ((leaf >> 8) & 255) / BLADE_GREEN[1], (leaf & 255) / BLADE_GREEN[2]))
          showBerries.setColorAt(nm, tint.set(FRUIT_TINT[e.mat] ?? 0xffffff))
          nm++
        }
      }
      showCard.count = nc; showFruit.count = nc; showLeaves.count = nm; showBerries.count = nm
      if (sculptLeaves) sculptLeaves.count = ns
      if (sculptFruit) sculptFruit.count = ns
      for (const m of [showCard, showFruit, showLeaves, showBerries, sculptLeaves, sculptFruit]) { if (!m) continue; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true }
      showFruitTile.needsUpdate = true
    },
    sync(cols, seed, probe, river = true, shelfScan, fruited) {
      // The lean map first: the same columns, the same seed, one pass — see `createLeanMap`.
      leanLive = river ? lean.fill(cols, seed) : lean.clear()
      uLean.value = lean.texture
      let nT = 0, nL = 0, nF = 0, nM = 0, nB = 0, nFr = 0, nH = 0, nR = 0, nG = 0, nS = 0, nC = 0, nP = 0, nMo = 0, nRe = 0, nSh = 0, wSh = 0
      // ⚠ RESET BESIDE `nFr`, NOT INSIDE THE LOOP: these are per-species slot counters and a
      // sync that forgot them would append to the last sync's instances until the cap ate it.
      for (const b of bushPools) { b.n = 0; b.f = 0 }
      // ── ★ THE TRUNK-SIDE PLANTS, from their own reader (2026-09-21) ───────────────────────
      // Written first, before the ground loop, on their own pool: a shelf never appears in the
      // ground spots (the probe stops at h+1), and the ground loop below `continue`s on the kind
      // in case an edit ever exposes one at ankle height — the generator refuses that cell.
      if (shelfScan) for (const c of cols) {
        for (const s of shelfSpotsFor(c.key, c.x0, c.z0, seed, shelfScan)) {
          wSh++
          if (nSh >= CAP.shelf) continue
          floraMatrix(s.kind, s.x, s.y, s.z, s.variant, false, mtx, off, quat, scl, s.face)
          shelves.setMatrixAt(nSh, mtx)
          // Ochre to tan across the stack, off the variant: a bracket fungus is banded, not one brown.
          const k = 0.88 + ((s.variant * 613.7) % 1) * 0.24
          shelves.setColorAt(nSh, tint.set(SHELF_COLOR).multiplyScalar(k))
          nSh++
        }
      }
      shelves.count = nSh
      shelves.instanceMatrix.needsUpdate = true
      if (shelves.instanceColor) shelves.instanceColor.needsUpdate = true
      // ⚠ WANTED IS COUNTED SEPARATELY FROM DRAWN, and that separation is the whole instrument.
      // The `n*` counters stop at the cap by construction, so they can never report an overrun —
      // they are the truncated number. These count what the world ASKED for.
      let wT = 0, wL = 0, wF = 0, wM = 0, wB = 0, wFr = 0, wH = 0, wR = 0, wG = 0, wS = 0, wC = 0, wP = 0, wMo = 0, wRe = 0
      for (const c of cols) {
        for (const s of spotsFor(c.key, c.x0, c.z0, seed, probe)) {
          if (s.kind === FLORA.SHELF) continue      // the trunk-side reader owns it (above)
          // ★ ONE PLACEMENT DERIVATION, SHARED WITH THE RETICLE'S OUTLINE. Jitter, turn, root
          // height and grow all live in `floraMatrix`; see its header for why they are not here.
          floraMatrix(s.kind, s.x, s.y, s.z, s.variant, s.alongX, mtx, off, quat, scl)
          // ── ★★ SCATTER TAKES ITS OWN TRANSFORM, BEFORE THE SHARED ONE IS APPLIED ─────────────
          // The `mtx` composed above is right for a stalk: a full random turn about Y and a
          // `grow` scale on Y only. Both are wrong here. A LOG must be turned to its RUN's axis and
          // to nothing else — a random turn would break a straight trunk into scattered sticks,
          // which is the pebble bug rebuilt in the renderer after the field went to the trouble of
          // avoiding it. A STONE may turn freely (it has no axis) but must be scaled on all three,
          // not stretched vertically into a menhir.
          if (s.kind === FLORA.ROCK || s.kind === FLORA.DEADFALL || s.kind === FLORA.MUSHROOM || s.kind === FLORA.PUFF) {
            if (s.kind === FLORA.PUFF) {
              wP++
              if (nP < CAP.puff) {
                puffs.setMatrixAt(nP, mtx)
                // A hair of warmth or cool per cluster, off the variant, so a patch is not one cream.
                const k = 0.92 + ((s.variant * 431.3) % 1) * 0.12
                puffs.setColorAt(nP, tint.set(PUFF_COLOR).multiplyScalar(k))
                nP++
              }
            } else if (s.kind === FLORA.DEADFALL) {
              wG++
              if (nG < CAP.log) { logs.setMatrixAt(nG, mtx); logs.setColorAt(nG, tint.set(DEADFALL_COLOR)); nG++ }
            } else if (s.kind === FLORA.ROCK) {
              wR++
              if (nR < CAP.rock) { rocks.setMatrixAt(nR, mtx); rocks.setColorAt(nR, rockTint(s.ground)); nR++ }
            } else {
              wS++
              if (nS < CAP.shroom) {
                shroomStems.setMatrixAt(nS, mtx); shroomCaps.setMatrixAt(nS, mtx)
                shroomStems.setColorAt(nS, tint.set(SHROOM_STEM_COLOR))
                shroomCaps.setColorAt(nS, tint.set(SHROOM_CAPS[Math.floor(s.variant * 991) % SHROOM_CAPS.length]))
                nS++
              }
            }
          }
          else if (s.kind === FLORA.TUFT) {
            wT++
            if (nT < CAP.tuft) {
              tufts.setMatrixAt(nT, mtx); tufts.setColorAt(nT, grassTint(s.ground)); tuftTile.setX(nT, tileOf(s.variant))
              tuftCaps.setMatrixAt(nT, mtx); tuftCaps.setColorAt(nT, grassTint(s.ground))
              tuftShadows.setMatrixAt(nT, mtx)
              nT++
            }
          }
          else if (s.kind === FLORA.TALL) {
            wL++
            if (nL < CAP.tall) { talls.setMatrixAt(nL, mtx); talls.setColorAt(nL, grassTint(s.ground)); tallTile.setX(nL, tileOf(s.variant)); nL++ }
          }
          else if (s.kind === FLORA.CROP) {
            wC++
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
            wH++
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
          else if (s.kind === FLORA.MOSS) {
            wMo++
            if (nMo < CAP.moss) {
              mosses.setMatrixAt(nMo, mtx)
              mosses.setColorAt(nMo, tint.set(MATERIAL_COLOR[s.mat] ?? 0x7fe0b8))
              nMo++
            }
          }
          else if (s.kind === FLORA.REED) {
            wRe++
            if (nRe < CAP.reed) {
              reeds.setMatrixAt(nRe, mtx)
              wakes.setMatrixAt(nRe, mtx)
              reeds.setColorAt(nRe, tint.set(MATERIAL_COLOR[s.mat] ?? 0xb4d49a))
              nRe++
            }
          }
          else if (s.kind === FLORA.BLOOM_MAT) {
            wM++
            if (nM < CAP.mat) {
              matLeaves.setMatrixAt(nM, mtx)
              matBlooms.setMatrixAt(nM, mtx)
              matStars.setMatrixAt(nM, mtx)
              matShadows.setMatrixAt(nM, mtx)
              matLeaves.setColorAt(nM, grassTint(s.ground))
              tint.set(HEAD_TINTS[Math.floor(s.variant * 977) % HEAD_TINTS.length])
              matBlooms.setColorAt(nM, tint)
              matStars.setColorAt(nM, tint)
              nM++
            }
          }
          else if (s.kind === FLORA.FRUIT) {
            wFr++
            // ★ THE BUDGET IS SHARED (`nFr`), THE SLOT IS THE SPECIES' OWN (`b.n`). An unknown
            // fruit material falls back to the sunfruit's pair rather than vanishing — a bush that
            // fails to draw reads as a hole in the world, not as a missing case.
            const b = bushPoolOf.get(s.mat) ?? bushPools[0]
            if (nFr < CAP.fruit) {
              b.leaves.setMatrixAt(b.n, mtx)
              // Leaf colour over the green tile — the blade arithmetic (target / BLADE_GREEN).
              const leaf = MATERIAL_COLOR[s.mat] ?? 0x569e42
              b.leaves.setColorAt(b.n, tint.setRGB(
                ((leaf >> 16) & 255) / BLADE_GREEN[0], ((leaf >> 8) & 255) / BLADE_GREEN[1], (leaf & 255) / BLADE_GREEN[2]))
              b.n++
              // ★ A PICKED BUSH IS THE SAME BODY WITH NO FRUIT ON IT, AND THAT COST NOTHING TO
              // BUILD because the sculpt already ships leaves and fruit as two buffers: "bare" is
              // simply not writing this instance into the berry mesh. `fruited` is the host's
              // question to answer (`picking.ts` holds the state); absent = every bush fruited,
              // which is what a test harness and any space without picking should see.
              if (!fruited || fruited(s.x, Math.ceil(s.y) + 1, s.z)) {
                b.berries.setMatrixAt(b.f, mtx)
                b.berries.setColorAt(b.f, tint.set(FRUIT_TINT[s.mat] ?? 0xffffff))
                b.f++
              }
              nFr++
            }
          }
          else if (s.kind === FLORA.BLOOM_BUSH) {
            wB++
            if (nB < CAP.bush) {
              bushes.setMatrixAt(nB, mtx)
              bushHeads.setMatrixAt(nB, mtx)
              bushes.setColorAt(nB, grassTint(s.ground))
              bushHeads.setColorAt(nB, tint.set(HEAD_TINTS[Math.floor(s.variant * 977) % HEAD_TINTS.length]))
              nB++
            }
          }
          else {
            wF++
            if (nF < CAP.flower) {
              stems.setMatrixAt(nF, mtx)
              heads.setMatrixAt(nF, mtx)
              heads.setColorAt(nF, tint.set(HEAD_TINTS[Math.floor(s.variant * 977) % HEAD_TINTS.length]))
              nF++
            }
          }
        }
      }
      tufts.count = nT; tuftCaps.count = nT; tuftShadows.count = nT; talls.count = nL; stems.count = nF; heads.count = nF
      matLeaves.count = nM; matBlooms.count = nM; matStars.count = nM; matShadows.count = nM
      bushes.count = nB; bushHeads.count = nB
      for (const b of bushPools) { b.leaves.count = b.n; b.berries.count = b.f }
      herbs.count = nH; tips.count = nH
      crops.count = nC; cropHeads.count = nC
      // The planted tail starts where the wild feed stopped; it sets the crop/herb counts itself.
      baseC = nC; baseH = nH
      demandC = 0; demandH = 0
      writePlanted()
      wC += demandC; wH += demandH
      // ★ AND REPORT WHAT THE DEMAND WAS MEASURED OVER. See `floraSync`: the same numbers mean
      // different things over 84 columns and over 108, and without this they read identically.
      floraSync.cols = cols.length
      floraSync.serial++
      // ★ REPORT DEMAND, NOT JUST WHAT FIT. A pool at 100% of cap and a pool at 199% of cap draw
      // exactly the same picture; only these numbers tell them apart.
      for (const [pool, wanted, cap] of [
        ['tuft', wT, CAP.tuft], ['tall', wL, CAP.tall], ['flower', wF, CAP.flower],
        ['mat', wM, CAP.mat], ['bush', wB, CAP.bush], ['fruit', wFr, CAP.fruit],
        ['herb', wH, CAP.herb], ['crop', wC, CAP.crop],
        ['rock', wR, CAP.rock], ['log', wG, CAP.log], ['shroom', wS, CAP.shroom],
        ['puff', wP, CAP.puff], ['moss', wMo, CAP.moss], ['reed', wRe, CAP.reed], ['shelf', wSh, CAP.shelf],
      ] as [string, number, number][]) {
        floraDemand[pool] = { wanted, cap }
        if (wanted > cap) noteOverflow(pool, wanted, cap)
      }
      rocks.count = nR; logs.count = nG; shroomStems.count = nS; shroomCaps.count = nS
      puffs.count = nP; mosses.count = nMo; reeds.count = nRe; wakes.count = nRe
      for (const m of [rocks, logs, shroomStems, shroomCaps, puffs, mosses, reeds, wakes]) {
        m.instanceMatrix.needsUpdate = true
        if (m.instanceColor) m.instanceColor.needsUpdate = true
      }
      tufts.instanceMatrix.needsUpdate = true
      tuftCaps.instanceMatrix.needsUpdate = true
      tuftShadows.instanceMatrix.needsUpdate = true
      if (tuftCaps.instanceColor) tuftCaps.instanceColor.needsUpdate = true
      talls.instanceMatrix.needsUpdate = true
      tuftTile.needsUpdate = true
      tallTile.needsUpdate = true
      if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true
      if (talls.instanceColor) talls.instanceColor.needsUpdate = true
      stems.instanceMatrix.needsUpdate = true
      heads.instanceMatrix.needsUpdate = true
      for (const m of [matLeaves, matBlooms, matStars, matShadows, bushes, bushHeads, ...bushMeshes]) {
        m.instanceMatrix.needsUpdate = true
        if (m.instanceColor) m.instanceColor.needsUpdate = true
      }
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
        for (const k of [...shelfCache.keys()]) if (!live.has(k)) shelfCache.delete(k)
      }
    },
    invalidate(colKey) { cache.delete(colKey); shelfCache.delete(colKey) },
    invalidateAll() { cache.clear(); shelfCache.clear() },
    setPlanted(spots) { planted = spots; writePlanted() },
    tick(elapsed) { uTime.value = elapsed },
    setCartoon(v) { for (const [k, val] of Object.entries(v)) if (cartoon[k]) cartoon[k].value = val },
    setReedLean(v) { uReedLean.value = v },

    setHighlight(kind, x, y, z, variant, alongX, mat, hasFruit = true) {
      // ★ THE SAME PLACEMENT DERIVATION THE PLANT ITSELF USES. If this composed its own matrix the
      // border would be a second opinion about where the plant is, and the two would disagree the
      // first time anyone re-tuned a jitter.
      floraMatrix(kind, x, y, z, variant, alongX, hlMtx, off, quat, scl)
      let drew = false
      for (const h of hlMeshes) {
        // ⚠ A SPECIES-KEYED DEF ONLY LIGHTS FOR ITS OWN MATERIAL, and with no material named it
        // falls back to the FIRST (the sunfruit) rather than lighting both or neither — two hulls
        // at once would read as a double border, none as a broken reticle.
        // A picked bush has no berries to outline, and a hull round fruit that is not drawn is a
        // border floating in the air. `berryHull` marks the second def of each species' pair.
        const wrongBush = h.fmat !== undefined
          && (h.fmat !== (mat ?? BUSH_MODEL_MATS[0]) || (h.berryHull === true && !hasFruit))
        if (h.kind !== kind || wrongBush) { h.mesh.count = 0; continue }
        if (h.grow === 1) h.mesh.setMatrixAt(0, hlMtx)
        else h.mesh.setMatrixAt(0, mtx.copy(hlMtx).scale(hlGrow.setScalar(h.grow)))
        h.mesh.instanceMatrix.needsUpdate = true
        // An atlas kind: the border must show the SAME columns as the plant under it.
        const tileAttr = h.geo.getAttribute('aTile') as THREE.InstancedBufferAttribute | undefined
        if (tileAttr) { tileAttr.setX(0, tileOf(variant)); tileAttr.needsUpdate = true }
        h.mesh.count = 1
        drew = true
      }
      // ⚠ A kind with no outline mesh silently marks NOTHING, which reads to a player as the
      // reticle being broken rather than as a missing case. The caller falls back to the wireframe
      // box on false, so an unhandled kind degrades to the old behaviour instead of to nothing.
      return drew
    },
    clearHighlight() {
      for (const h of hlMeshes) h.mesh.count = 0
    },
    dispose() {
      lean.dispose()
      for (const h of hlMeshes) { h.mesh.dispose(); (h.mat as THREE.Material).dispose() }
      tuftGeo.dispose(); tuftCapGeo.dispose(); tuftShadowGeo.dispose(); tuftCapMat.dispose(); rosetteTex.dispose(); tallGeo.dispose(); stemGeo.dispose(); headGeo.dispose()
      herbGeo.dispose(); tipGeo.dispose()
      glintGeo.dispose(); glintMat.dispose(); glintTex.dispose()
      tuftMat.dispose(); tallMat.dispose(); stemMat.dispose(); headMat.dispose()
      herbMat.dispose(); tipMat.dispose()
      bladeTex.dispose(); tuftTex.dispose(); tallTex.dispose(); headTex.dispose()
      // The two atlas outlines own a CLONED geometry (see `hlAtlasGeo`); every other outline shares
      // its plant's, which is disposed above.
      for (const h of hlMeshes) if (h.kind === FLORA.TUFT || h.kind === FLORA.TALL) h.geo.dispose()
      // The flower forms (2026-09-14/15): geometry, material, texture — same three each.
      for (const g of [matLeafGeo, matBloomGeo, matStarGeo, matShadowGeo, bushGeo, bushHeadGeo, fruitBushGeo, ...bushGeos.flatMap(g2 => [g2.leaf, g2.berry]), mossGeo, puffGeo, shelfGeo]) g.dispose()
      // `showModelMat`/`showFruitMat` are aliases of the two bush materials, not a second pair.
      // ⚠ `bushPools[].berryMat` — one per species (canon gives each fruit its own light), and the
      // sunfruit's IS `bushBerryMat`, so the Set is what stops a double dispose.
      for (const m of new Set<{ dispose(): void }>([matLeafMat, matBloomMat, matStarMat, matShadowMat, bushMat, bushHeadMat, fruitBushMat, fruitMat, bushLeafMat, bushBerryMat, ...berryMats.values(), solidBushTex, mossMat, puffMat, shelfMat])) m.dispose()
      for (const t of [bushTex, clusterTex, matLeafTex, matBloomTex, matShadowTex, fruitTex, mossTex]) t.dispose()
    },
  }
}
