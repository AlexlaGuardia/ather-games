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
import { bladePixels, tallBladePixels, bladeAtlasPixels, GRASS_VARIANTS, TALL_TILE_H, headPixels, bushPixels, bloomClusterPixels, matLeafPixels, matBloomPixels, matShadowPixels, fruitClusterPixels, mossPixels, HEAD_TINTS, BLADE_GREEN, BLADE_TILE, TUFT_SEED, TUFT_BLADES, TALL_SEED, TALL_BLADES } from './tex/flora-tex'
import { cropStalkPixels, cropHeadPixels } from './tex/crop-tex'
import { FLORA, FRUIT_MATS } from '../voxel/flora'
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

/** The scatter's own colours, exported for the same reason the geometry is. */
export const FLORA_COLORS = {
  deadfall: DEADFALL_COLOR,
  shroomStem: SHROOM_STEM_COLOR,
  shroomCaps: SHROOM_CAPS,
  puff: PUFF_COLOR,
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
export const CAP = { tuft: 24000, tall: 9000, flower: 4000, mat: 9000, bush: 4000, fruit: 3000, herb: 12000, rock: 5000, log: 4000, shroom: 3000, crop: 6000, puff: 2000, moss: 6000 } as const

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
  /**
   * Draw the selection border on ONE plant — the reticle's whole job for ground cover.
   * Same geometry, same texture, same sway as the plant it marks; see `outlineMaterial`.
   * `y` is the spot's GROUND height, exactly as `PlantProbe` reports it.
   */
  setHighlight(kind: number, x: number, y: number, z: number, variant: number, alongX?: boolean): boolean
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
  // ⚠ WOUND TO FACE +Y. The material is DoubleSide, so a wrong winding still DRAWS — but Lambert
  // flips the normal on a back face, and a pad lit from underneath is a black disc on the grass.
  // That is exactly what the first shot showed; the fix is the index order, not the material.
  g.setIndex([0, 2, 1, 0, 3, 2])
  return g
}

/** ONE builder for a part, read by the renderer AND by `vertsFor` — a flat part and a star part
 *  must be measured by the same code that draws them or the outline lies about one of them. */
export interface FloraPart { w: number; h: number; yBase?: number; flat?: boolean; tiles?: number; lean?: number }

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
 */
export const CARD_LEAN = 0.4
const partGeometry = (p: FloraPart): THREE.BufferGeometry =>
  p.flat ? buildFlatGeometry(p.w, p.yBase ?? 0) : buildCrossGeometry(p.w, p.h, p.yBase ?? 0, p.tiles ?? 1, p.lean ?? 0)

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
  [FLORA.TUFT]: [{ w: 0.7, h: 0.55, tiles: GRASS_VARIANTS, lean: CARD_LEAN }],
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
    { w: 1.0, h: 0, yBase: 0.04, flat: true },
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
  [FLORA.FRUIT]: { root: 0.97, jitter: 0.15 },
  [FLORA.HERB]: { root: 0.97, jitter: 0.3 },
  [FLORA.CROP]: { root: 0.97, jitter: 0.3 },
  [FLORA.ROCK]: { root: 1.06, jitter: 0.5 },
  [FLORA.DEADFALL]: { root: 1.12, jitter: 0 },
  [FLORA.MUSHROOM]: { root: 0.99, jitter: 0.55 },
  [FLORA.PUFF]: { root: 0.99, jitter: 0.4 },
  [FLORA.MOSS]: { root: 0.97, jitter: 0.04 },        // covers its cell, like a bloom mat
}

/** A stalk's height roll. Y only — a wider blade would thin the texture, not grow the plant. */
export const floraGrow = (variant: number): number => 0.75 + variant * 0.5
/** Scatter's size roll. All three axes for a stone; length is held at 1.0 for a log (see below). */
export const floraScatterScale = (variant: number): number => 0.8 + variant * 0.45

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
): THREE.Matrix4 {
  // Deterministic per-spot jitter off the variant roll: offset within the cell, a turn, a little
  // size. Same spot, same blades, forever.
  const jx = (variant * 7.13) % 1 - 0.5, jz = (variant * 3.71) % 1 - 0.5
  const place = FLORA_PLACE[kind] ?? FLORA_PLACE[FLORA.TUFT]
  if (kind === FLORA.DEADFALL) {
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
    scl.set(sw, floraGrow(variant), sw)
  }
  return out.compose(off, quat, scl)
}

/** Local vertex positions per kind, built ONCE from the same buffers the renderer draws. */
let partVerts: Map<number, Float32Array[]> | null = null
function vertsFor(kind: number): Float32Array[] {
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
  kind: number, x: number, y: number, z: number, variant: number, alongX?: boolean,
): FloraBox | null {
  const parts = vertsFor(kind)
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

export function createFloraRenderer(): FloraRenderer {
  const uTime = { value: 0 }

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
  const injectSway = (shader: { uniforms: Record<string, unknown>; vertexShader: string }, amp: number): void => {
    shader.uniforms.uTime = uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + [
        '{',
        '  #ifdef USE_INSTANCING',
        // ★ WIND, NOT WATER (2026-09-14, Alex: "looking a bit like sea weed"). The old sway was
        // sin on x + cos on z at two frequencies — a Lissajous circle, weighted linearly by height:
        // every tip drew a slow loop, which is exactly how kelp moves in a swell. Wind is different
        // on three counts, and each one is a line below: it has ONE direction (a blade leans
        // downwind and springs back, it does not orbit); a blade is stiff at the root and bends at
        // the tip (weight is height SQUARED, not height); and it comes in GUSTS — a slow envelope
        // rolling across the meadow with a quick flutter riding on it, not a metronome.
        '  float ph = (instanceMatrix[3].x * 0.83 + instanceMatrix[3].z * 0.55) * 0.35;',
        '  float w = uv.y * uv.y * ' + amp.toFixed(3) + ';',
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
    m.onBeforeCompile = (shader) => { injectSway(shader, amp); injectAtlas(shader, tiles) }
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
  const outlineMaterial = (map: THREE.Texture, amp: number, tiles = 1): THREE.MeshBasicMaterial => {
    const m = new THREE.MeshBasicMaterial({
      map, alphaTest: 0.4, side: THREE.DoubleSide, color: 0x000000,
      // Same geometry at the same matrix as the plant means identical depth: without an offset the
      // two z-fight and the border strobes. depthWrite off so the border never occludes the plant.
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    })
    m.onBeforeCompile = (shader) => {
      injectSway(shader, amp)
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
          '    diffuseColor.rgb = vec3(0.0);',
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
  const clusterTex = toTexture(bloomClusterPixels(), 32)
  const matLeafTex = toTexture(matLeafPixels(), 32)
  const matBloomTex = toTexture(matBloomPixels(), 32)
  const matShadowTex = toTexture(matShadowPixels(), 32)
  const mossTex = toTexture(mossPixels(), 32)
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
  const fruitBushGeo = crossGeo(FLORA.FRUIT)
  const fruitGeo = crossGeo(FLORA.FRUIT, 1)
  const herbGeo = crossGeo(FLORA.HERB)
  const cropGeo = crossGeo(FLORA.CROP)
  // The head rides at the top of a full-height stalk. Scaled with the stalk by the instance matrix,
  // so a half-grown planted crop carries a half-height head rather than a floating one.
  const cropHeadGeo = crossGeo(FLORA.CROP, 1)
  const tipGeo = crossGeo(FLORA.HERB, 1)

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

  const herbMat = swayMaterial(bladeTex, FLORA_SWAY[FLORA.HERB])
  // Sway a touch stiffer than a herb: a laden crop is heavier and a field that ripples like grass
  // reads as grass. Its own tiles, so a crop is never accidentally drawn with a blade texture.
  const cropStalkTex = toTexture(cropStalkPixels(3), 16)
  const cropHeadTex = toTexture(cropHeadPixels(8), 8)
  const cropMat = swayMaterial(cropStalkTex, FLORA_SWAY[FLORA.CROP])
  const cropHeadMat = swayMaterial(cropHeadTex, FLORA_SWAY[FLORA.CROP])
  const tipMat = swayMaterial(headTex, FLORA_SWAY[FLORA.HERB])
  const tuftMat = swayMaterial(tuftTex, FLORA_SWAY[FLORA.TUFT], GRASS_VARIANTS)
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
  // ★ THE ONE FLORA MATERIAL THAT GLOWS. The pad is painted near-white and the tint is the moss
  // colour, so the emissive is that same colour scaled — one row in `MATERIAL_COLOR` drives the
  // day look, the night glow and the item icon. The block behind it carries the light channel
  // that actually lights the ground (registry `emit`); this is the plant's own body lit from within.
  const mossGeo = crossGeo(FLORA.MOSS)
  const mossMat = swayMaterial(mossTex, FLORA_SWAY[FLORA.MOSS])
  mossMat.emissive = new THREE.Color(MATERIAL_COLOR[MAT.GLOW_MOSS] ?? 0x7fe0b8)
  mossMat.emissiveIntensity = MOSS_EMISSIVE

  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, CAP.tuft)
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
  const fruitBushes = new THREE.InstancedMesh(fruitBushGeo, fruitBushMat, CAP.fruit)
  const fruits = new THREE.InstancedMesh(fruitGeo, fruitMat, CAP.fruit)
  fruitBushes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.fruit * 3), 3)
  fruits.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.fruit * 3), 3)
  const fruitTile = new THREE.InstancedBufferAttribute(new Float32Array(CAP.fruit), 1).setUsage(THREE.DynamicDrawUsage)
  fruitGeo.setAttribute('aTile', fruitTile)
  /** The atlas column for a fruit material — the order `FRUIT_MATS` lists them in. */
  const FRUIT_COL = new Map<number, number>(FRUIT_MATS.map((m, i) => [m, i]))
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
  // The forage (2026-09-16). A puff is tinted per instance so a huddle is not four identical
  // creams; the moss takes its colour as a tint over the near-white pad, like a bloom head.
  const puffs = new THREE.InstancedMesh(puffGeo, puffMat, CAP.puff)
  const mosses = new THREE.InstancedMesh(mossGeo, mossMat, CAP.moss)
  puffs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.puff * 3), 3)
  mosses.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.moss * 3), 3)

  for (const m of [tufts, talls, stems, heads, matLeaves, matBlooms, matStars, matShadows, bushes, bushHeads, fruitBushes, fruits, herbs, tips, crops, cropHeads, rocks, logs, shroomStems, shroomCaps, puffs, mosses]) {
    m.count = 0
    m.frustumCulled = false     // instances span the whole load radius; the default bounds lie
    m.receiveShadow = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }

  const group = new THREE.Group()
  group.add(tufts, talls, stems, heads, matLeaves, matBlooms, matStars, matShadows, bushes, bushHeads, fruitBushes, fruits, herbs, tips, crops, cropHeads, rocks, logs, shroomStems, shroomCaps, puffs, mosses)

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
  const hlDefs: { kind: number; geo: THREE.BufferGeometry; mat: THREE.Material; grow: number }[] = [
    { kind: FLORA.TUFT, geo: hlAtlasGeo(tuftGeo), mat: outlineMaterial(tuftTex, FLORA_SWAY[FLORA.TUFT], GRASS_VARIANTS), grow: 1 },
    { kind: FLORA.TALL, geo: hlAtlasGeo(tallGeo), mat: outlineMaterial(tallTex, FLORA_SWAY[FLORA.TALL], GRASS_VARIANTS), grow: 1 },
    { kind: FLORA.FLOWER, geo: stemGeo, mat: outlineMaterial(bladeTex, FLORA_SWAY[FLORA.FLOWER]), grow: 1 },
    { kind: FLORA.FLOWER, geo: headGeo, mat: outlineMaterial(headTex, FLORA_SWAY[FLORA.FLOWER]), grow: 1 },
    { kind: FLORA.BLOOM_MAT, geo: matLeafGeo, mat: outlineMaterial(matLeafTex, FLORA_SWAY[FLORA.BLOOM_MAT]), grow: 1 },
    { kind: FLORA.BLOOM_MAT, geo: matBloomGeo, mat: outlineMaterial(matBloomTex, FLORA_SWAY[FLORA.BLOOM_MAT]), grow: 1 },
    { kind: FLORA.BLOOM_MAT, geo: matStarGeo, mat: outlineMaterial(clusterTex, FLORA_SWAY[FLORA.BLOOM_MAT]), grow: 1 },
    { kind: FLORA.BLOOM_BUSH, geo: bushGeo, mat: outlineMaterial(bushTex, FLORA_SWAY[FLORA.BLOOM_BUSH]), grow: 1 },
    { kind: FLORA.BLOOM_BUSH, geo: bushHeadGeo, mat: outlineMaterial(clusterTex, FLORA_SWAY[FLORA.BLOOM_BUSH]), grow: 1 },
    // The fruit card's column is chosen by MATERIAL and `setHighlight` is handed a kind, not a
    // material — so the border marks the bush body only. A bush's silhouette IS the body.
    { kind: FLORA.FRUIT, geo: fruitBushGeo, mat: outlineMaterial(bushTex, FLORA_SWAY[FLORA.FRUIT]), grow: 1 },
    { kind: FLORA.HERB, geo: herbGeo, mat: outlineMaterial(bladeTex, FLORA_SWAY[FLORA.HERB]), grow: 1 },
    { kind: FLORA.HERB, geo: tipGeo, mat: outlineMaterial(headTex, FLORA_SWAY[FLORA.HERB]), grow: 1 },
    { kind: FLORA.CROP, geo: cropGeo, mat: outlineMaterial(cropStalkTex, FLORA_SWAY[FLORA.CROP]), grow: 1 },
    { kind: FLORA.CROP, geo: cropHeadGeo, mat: outlineMaterial(cropHeadTex, FLORA_SWAY[FLORA.CROP]), grow: 1 },
    { kind: FLORA.ROCK, geo: rockGeo, mat: outlineHullMaterial(), grow: 1.14 },
    { kind: FLORA.DEADFALL, geo: logGeo, mat: outlineHullMaterial(), grow: 1.1 },
    { kind: FLORA.MUSHROOM, geo: shroomStemGeo, mat: outlineHullMaterial(), grow: 1.12 },
    { kind: FLORA.MUSHROOM, geo: shroomCapGeo, mat: outlineHullMaterial(), grow: 1.12 },
    { kind: FLORA.PUFF, geo: puffGeo, mat: outlineHullMaterial(), grow: 1.12 },
    { kind: FLORA.MOSS, geo: mossGeo, mat: outlineMaterial(mossTex, FLORA_SWAY[FLORA.MOSS]), grow: 1 },
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

  return {
    group,
    sync(cols, seed, probe) {
      let nT = 0, nL = 0, nF = 0, nM = 0, nB = 0, nFr = 0, nH = 0, nR = 0, nG = 0, nS = 0, nC = 0, nP = 0, nMo = 0
      // ⚠ WANTED IS COUNTED SEPARATELY FROM DRAWN, and that separation is the whole instrument.
      // The `n*` counters stop at the cap by construction, so they can never report an overrun —
      // they are the truncated number. These count what the world ASKED for.
      let wT = 0, wL = 0, wF = 0, wM = 0, wB = 0, wFr = 0, wH = 0, wR = 0, wG = 0, wS = 0, wC = 0, wP = 0, wMo = 0
      for (const c of cols) {
        for (const s of spotsFor(c.key, c.x0, c.z0, seed, probe)) {
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
            if (nT < CAP.tuft) { tufts.setMatrixAt(nT, mtx); tufts.setColorAt(nT, grassTint(s.ground)); tuftTile.setX(nT, tileOf(s.variant)); nT++ }
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
            if (nFr < CAP.fruit) {
              fruitBushes.setMatrixAt(nFr, mtx)
              fruits.setMatrixAt(nFr, mtx)
              // Leaf colour over the green tile — the blade arithmetic (target / BLADE_GREEN).
              const leaf = MATERIAL_COLOR[s.mat] ?? 0x569e42
              fruitBushes.setColorAt(nFr, tint.setRGB(
                ((leaf >> 16) & 255) / BLADE_GREEN[0], ((leaf >> 8) & 255) / BLADE_GREEN[1], (leaf & 255) / BLADE_GREEN[2]))
              fruits.setColorAt(nFr, tint.set(FRUIT_TINT[s.mat] ?? 0xffffff))
              fruitTile.setX(nFr, FRUIT_COL.get(s.mat) ?? 0)
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
      tufts.count = nT; talls.count = nL; stems.count = nF; heads.count = nF
      matLeaves.count = nM; matBlooms.count = nM; matStars.count = nM; matShadows.count = nM
      bushes.count = nB; bushHeads.count = nB
      fruitBushes.count = nFr; fruits.count = nFr
      herbs.count = nH; tips.count = nH
      crops.count = nC; cropHeads.count = nC
      // ★ REPORT DEMAND, NOT JUST WHAT FIT. A pool at 100% of cap and a pool at 199% of cap draw
      // exactly the same picture; only these numbers tell them apart.
      for (const [pool, wanted, cap] of [
        ['tuft', wT, CAP.tuft], ['tall', wL, CAP.tall], ['flower', wF, CAP.flower],
        ['mat', wM, CAP.mat], ['bush', wB, CAP.bush], ['fruit', wFr, CAP.fruit],
        ['herb', wH, CAP.herb], ['crop', wC, CAP.crop],
        ['rock', wR, CAP.rock], ['log', wG, CAP.log], ['shroom', wS, CAP.shroom],
        ['puff', wP, CAP.puff], ['moss', wMo, CAP.moss],
      ] as [string, number, number][]) {
        floraDemand[pool] = { wanted, cap }
        if (wanted > cap) noteOverflow(pool, wanted, cap)
      }
      rocks.count = nR; logs.count = nG; shroomStems.count = nS; shroomCaps.count = nS
      puffs.count = nP; mosses.count = nMo
      for (const m of [rocks, logs, shroomStems, shroomCaps, puffs, mosses]) {
        m.instanceMatrix.needsUpdate = true
        if (m.instanceColor) m.instanceColor.needsUpdate = true
      }
      tufts.instanceMatrix.needsUpdate = true
      talls.instanceMatrix.needsUpdate = true
      tuftTile.needsUpdate = true
      tallTile.needsUpdate = true
      fruitTile.needsUpdate = true
      if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true
      if (talls.instanceColor) talls.instanceColor.needsUpdate = true
      stems.instanceMatrix.needsUpdate = true
      heads.instanceMatrix.needsUpdate = true
      for (const m of [matLeaves, matBlooms, matStars, matShadows, bushes, bushHeads, fruitBushes, fruits]) {
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
      }
    },
    invalidate(colKey) { cache.delete(colKey) },
    invalidateAll() { cache.clear() },
    tick(elapsed) { uTime.value = elapsed },

    setHighlight(kind, x, y, z, variant, alongX) {
      // ★ THE SAME PLACEMENT DERIVATION THE PLANT ITSELF USES. If this composed its own matrix the
      // border would be a second opinion about where the plant is, and the two would disagree the
      // first time anyone re-tuned a jitter.
      floraMatrix(kind, x, y, z, variant, alongX, hlMtx, off, quat, scl)
      let drew = false
      for (const h of hlMeshes) {
        if (h.kind !== kind) { h.mesh.count = 0; continue }
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
      for (const h of hlMeshes) { h.mesh.dispose(); (h.mat as THREE.Material).dispose() }
      tuftGeo.dispose(); tallGeo.dispose(); stemGeo.dispose(); headGeo.dispose()
      herbGeo.dispose(); tipGeo.dispose()
      tuftMat.dispose(); tallMat.dispose(); stemMat.dispose(); headMat.dispose()
      herbMat.dispose(); tipMat.dispose()
      bladeTex.dispose(); tuftTex.dispose(); tallTex.dispose(); headTex.dispose()
      // The two atlas outlines own a CLONED geometry (see `hlAtlasGeo`); every other outline shares
      // its plant's, which is disposed above.
      for (const h of hlMeshes) if (h.kind === FLORA.TUFT || h.kind === FLORA.TALL) h.geo.dispose()
      // The flower forms (2026-09-14/15): geometry, material, texture — same three each.
      for (const g of [matLeafGeo, matBloomGeo, matStarGeo, matShadowGeo, bushGeo, bushHeadGeo, fruitBushGeo, fruitGeo, mossGeo, puffGeo]) g.dispose()
      for (const m of [matLeafMat, matBloomMat, matStarMat, matShadowMat, bushMat, bushHeadMat, fruitBushMat, fruitMat, mossMat, puffMat]) m.dispose()
      for (const t of [bushTex, clusterTex, matLeafTex, matBloomTex, matShadowTex, fruitTex, mossTex]) t.dispose()
    },
  }
}
