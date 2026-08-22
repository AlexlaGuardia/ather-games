// Procedural block tiles — the texture spike's stand-in art.
//
// ★ THIS IS NOT SHIMMER'S ART AND MUST NEVER BECOME IT. Every tile here is generated from code, from
// the placeholder palette in `attrs.ts`. It exists so the RENDER PATH can be judged before a single
// pixel is hand-painted: does a texture array survive greedy meshing, do per-face variants work, does
// ore still read in the dark. The look call is Alex's, on painted tiles, later.
//
// ★ PURE. No three, no DOM. Same reason `voxel/` is pure — this generates bytes; wrapping them in a
// GPU texture is `atlas.ts`'s job. It also means the tile generator is testable and portable.
//
// ── WHY EVERY MATERIAL GETS THREE LAYERS ─────────────────────────────────────────────────────────
// A block face is top, side, or bottom. Only TOPSOIL actually differs across the three today (grass
// crown, grassy-fringed dirt flank, plain underside), so two thirds of these layers are duplicates.
// That is deliberate: the layer index is `slot * 3 + face`, a fixed stride, so painting a distinct
// side for STONE later is dropping a file in, not renumbering the world. 43 layers at 64px is 688KB.
// The wrong economy here would be saving half a megabyte and buying a renumbering.

import { MAT } from '../../voxel/depth'
import { ORE } from '../../voxel/ore'
import { WOOD } from '../../voxel/trees'
import { MATERIAL_COLOR } from '../attrs'
import { baseOf } from '../../voxel/depth'

export const TOP = 0
export const SIDE = 1
export const BOTTOM = 2

/** Ordered — a material's position here IS its slot, so do not reorder without rebuilding. */
export const TILE_MATERIALS: number[] = [
  MAT.PACKED_CLOUD, MAT.DEEP_STONE, MAT.STONE, MAT.SUBSOIL, MAT.TOPSOIL, MAT.SAND, MAT.WATER,
  ORE.RAW_MANA, ORE.ELEMENT_VIOLET, ORE.ELEMENT_STORM, ORE.ELEMENT_EARTH, ORE.ELEMENT_WATER,
  ORE.PURE_CORE, ORE.ATHER_CRYSTAL,
  // ⚠ APPEND ONLY — a material's position here IS its layer slot. Wood added 2026-08-07 with trees.
  WOOD.GOLDWOOD_LOG, WOOD.GOLDWOOD_LEAVES,
  WOOD.SHIMMEROAK_LOG, WOOD.SHIMMEROAK_LEAVES,
  WOOD.STARWILLOW_LOG, WOOD.STARWILLOW_LEAVES,
  WOOD.DAWNWOOD_LOG, WOOD.DAWNWOOD_LEAVES,
  // Grey soil added 2026-08-07 with the biome layer.
  MAT.GREY_SOIL,
  // The lantern added 2026-08-07 with the Hollows spawn cycle — the first emitter.
  MAT.MANA_LANTERN,
  // The crafting table added 2026-08-08 — the first station.
  MAT.CRAFT_TABLE,
  MAT.SAWMILL,
  MAT.STONECUTTER,
  // The story road added 2026-08-08 with the quest-spine worldgen.
  MAT.PATH,
  // Plank block added 2026-08-08 with the road's bridges; it stopped generating there 2026-08-15.
  MAT.PLANKS,
  // The bridge deck split off PLANKS 2026-08-15 — same strips, weathered, and it pays nothing.
  MAT.DECK,
  // Spring crust added 2026-08-08 with the hot-spring terraces.
  MAT.SPRING_CRUST,
  MAT.POT, MAT.POT_SEEDED, MAT.POT_BLOOM,
  // The chest added 2026-08-11 — the first block that holds something.
  MAT.CHEST,
  // Rubble + cut stone added 2026-08-13 with the building grammar: what a quarried block gives you,
  // and what you cut it into. ⚠ Appending here without a `paintFor` case below is how every tree
  // once rendered as crystal — the switch's default IS the ore painter.
  MAT.RUBBLE, MAT.CUT_STONE,
  // The masonry palette added 2026-08-15 — three crafted surfaces, no new rock.
  MAT.STONE_BRICK, MAT.PALE_BRICK, MAT.SANDSTONE,
  // The waymark + the plot's cloud-wall, added 2026-08-15 with the passages layer.
  MAT.WAYMARK, MAT.CLOUD_WALL,
  // The cauldron added 2026-08-18 with brewing — the alchemy station.
  MAT.CAULDRON,
  // ── The grounds, added 2026-08-19 with the character layer ──────────────────────────────────
  // ⚠ Each one NEEDS a `paintFor` case below, exactly as the rubble note above says: the switch's
  // default is the ore painter, so a ground appended here and forgotten there does not render as
  // plain dirt, it renders as a crystal seam in the middle of a meadow.
  MAT.FOREST_LOAM, MAT.LUSH_TURF, MAT.MARSH_MUD, MAT.DRY_GRASS, MAT.HIGHLAND_TURF, MAT.SCREE,
  // ── The garden beds, added 2026-08-22 — one per plank wood ──────────────────────────────────
  // ⚠ THE BED SHIPPED 08-22 WITHOUT THIS LINE AND WITHOUT A PAINTER, so `layerOf` returned
  // FALLBACK_LAYER on all three faces and the block sampled the magenta checker. Nobody saw it
  // because the same day's craft-surface bug meant nobody could craft one — two bugs hiding each
  // other. Adding a MAT id is never the whole job; it needs a line here AND a case below.
  MAT.GARDEN_BED_GOLDWOOD, MAT.GARDEN_BED_SHIMMEROAK, MAT.GARDEN_BED_DAWNWOOD,
]

/** One spare layer past the end: an unmapped material samples magenta rather than layer 0's stone. */
export const FALLBACK_LAYER = TILE_MATERIALS.length * 3
export const LAYER_COUNT = FALLBACK_LAYER + 1

const SLOT = (() => {
  const max = Math.max(...TILE_MATERIALS)
  const s = new Int16Array(max + 1).fill(-1)
  TILE_MATERIALS.forEach((m, i) => { s[m] = i })
  return s
})()

/** Material + face → texture-array layer. Out-of-range or unmapped falls to the loud magenta layer. */
// ⚠ A SLAB IS ITS BASE MATERIAL, texturally. Without the mask a half topsoil block is an unmapped
// id and the ore artist's magenta fallback claims it — see the block below on that failure mode.
export function layerOf(material: number, face: number): number {
  const m = baseOf(material)
  const slot = m >= 0 && m < SLOT.length ? SLOT[m] : -1
  return slot < 0 ? FALLBACK_LAYER : slot * 3 + face
}

/** Face index from a quad's normal. The mesher already emits axis-aligned flat normals, so this is
 *  exact — no epsilon needed beyond guarding against float noise in the buffer. */
export const faceOfNormal = (ny: number): number => (ny > 0.5 ? TOP : ny < -0.5 ? BOTTOM : SIDE)

// ── deterministic noise ──────────────────────────────────────────────────────────────────────────

/** Integer hash → [0,1). Same seed + coords always gives the same tile, so a look you liked is
 *  reproducible and a diff of the generator is a diff of the art. */
function h2(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/**
 * Value noise on a lattice that WRAPS at `cells`.
 *
 * ⚠ The wrap is the whole point and it is invisible when wrong. These tiles are sampled with
 * RepeatWrapping across a greedy quad that can be 32 blocks wide, so a tile whose left edge does not
 * meet its right edge draws a visible grid across every large surface — which reads as "the mesher is
 * broken", not "the noise is not periodic". Lattice coordinates are taken mod `cells` for that reason.
 */
function vnoise(x: number, y: number, size: number, cells: number, seed: number): number {
  const fx = (x / size) * cells
  const fy = (y / size) * cells
  const x0 = Math.floor(fx), y0 = Math.floor(fy)
  const tx = smooth(fx - x0), ty = smooth(fy - y0)
  const m = (v: number) => ((v % cells) + cells) % cells
  const a = h2(m(x0), m(y0), seed)
  const b = h2(m(x0 + 1), m(y0), seed)
  const c = h2(m(x0), m(y0 + 1), seed)
  const d = h2(m(x0 + 1), m(y0 + 1), seed)
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty
}

// ── colour helpers (0-255 ints, sRGB — the same space the flat palette is authored in) ───────────

const clamp8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0)
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const rgbOf = (hex: number): [number, number, number] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
const shade = (c: [number, number, number], d: number): [number, number, number] =>
  [clamp8(c[0] + d), clamp8(c[1] + d), clamp8(c[2] + d)]
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [clamp8(a[0] + (b[0] - a[0]) * t), clamp8(a[1] + (b[1] - a[1]) * t), clamp8(a[2] + (b[2] - a[2]) * t)]

/** One layer's worth of RGBA. Alpha is NOT opacity here — see `writeOre`. */
type Layer = Uint8Array

const put = (dst: Layer, size: number, x: number, y: number, c: [number, number, number], a = 0) => {
  const o = (y * size + x) * 4
  dst[o] = c[0]; dst[o + 1] = c[1]; dst[o + 2] = c[2]; dst[o + 3] = a
}

// ── the painters ─────────────────────────────────────────────────────────────────────────────────
//
// Feature sizes are expressed in TEXELS, not fractions of the tile, wherever the detail is meant to
// get finer with resolution. That is what makes the 32-vs-64 comparison honest: at 64 the speckle is
// genuinely a finer grain and the veins are genuinely thinner, rather than the same image upscaled.
// Blotches are the exception — they are fixed at 8 lattice cells so the large-scale shape of a
// material is the same at both sizes, and only its detail changes.

/** Clear band of host rock kept around the tile edge, in TEXELS — so it holds at every tile size
 *  rather than scaling up into a fat empty border at 64px. */
const EDGE_CLEAR = 1.5

interface RockOpts { speckle: number; blotch: number; vein: number; seed: number }

function paintRock(dst: Layer, size: number, base: [number, number, number], o: RockOpts) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const blot = (vnoise(x, y, size, 8, o.seed) - 0.5) * 2 * o.blotch
      const grit = (h2(x, y, o.seed + 77) - 0.5) * 2 * o.speckle
      let c = shade(base, blot + grit)
      // A thin darker vein network. At 32 it lands as a chunky crack, at 64 as a hairline — which is
      // exactly the kind of detail the density table says you cannot keep past a few blocks out.
      if (o.vein > 0) {
        const v = vnoise(x, y, size, 4, o.seed + 991)
        if (Math.abs(v - 0.5) < 0.045) c = shade(c, -o.vein)
      }
      put(dst, size, x, y, c)
    }
  }
}

function paintGrit(dst: Layer, size: number, base: [number, number, number], amp: number, pebble: number, seed: number) {
  const pb = Math.max(1, Math.round(size / 16))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const blot = (vnoise(x, y, size, 8, seed) - 0.5) * 2 * (amp * 0.6)
      const grit = (h2(x, y, seed + 31) - 0.5) * 2 * amp
      put(dst, size, x, y, shade(base, blot + grit))
    }
  }
  // Pebbles: coarse blocks that survive minification, so soil still reads as soil at distance.
  if (pebble > 0) {
    for (let py = 0; py < size; py += pb) {
      for (let px = 0; px < size; px += pb) {
        if (h2(px, py, seed + 404) > 0.86) {
          const d = h2(px, py, seed + 405) > 0.5 ? pebble : -pebble
          for (let y = py; y < py + pb && y < size; y++)
            for (let x = px; x < px + pb && x < size; x++) {
              const o = (y * size + x) * 4
              put(dst, size, x, y, shade([dst[o], dst[o + 1], dst[o + 2]], d))
            }
        }
      }
    }
  }
}

/** Grass crown — the face you spend the whole game looking down at. `crown` defaults to living
 *  turf; GREY_SOIL passes its own desaturated base and a flatter contrast (drained ground gutters,
 *  it does not sparkle — the bright blade-catch is halved so nothing glints). */
function paintGrassTop(dst: Layer, size: number, seed: number,
  crown: number = MATERIAL_COLOR[MAT.TOPSOIL], contrast = 1) {
  const base = rgbOf(crown)
  const dark = shade(base, -34 * contrast)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const clump = vnoise(x, y, size, 8, seed)
      const blade = h2(x, y, seed + 12)
      let c = mix(dark, shade(base, 16 * contrast), clamp01(clump * 0.8 + blade * 0.45))
      if (blade > 0.94) c = shade(c, 26 * contrast)
      put(dst, size, x, y, c)
    }
  }
}

/**
 * Grass flank — dirt with a ragged green crown along the top of the tile.
 *
 * ★ "TOP" MEANS ROW 0, i.e. the top of the image as you would see it in an editor — which is also
 * where a painter would put it without being told. That reads naturally only because the shader
 * negates v on side faces (see the UV derivation in atlas.ts); without that negation, world-up is
 * INCREASING row index and this crown would have to be painted at the bottom of the file. The flip
 * lives in the shader precisely so this file, and any hand-painted tile that replaces it, can be
 * authored the obvious way round.
 */
/**
 * ── ★★ THE FLANK CARRIES THE GROUND IT HOLDS UP (#620, 2026-08-19) ─────────────────────────────
 * Until now `dirt` was `MAT.SUBSOIL` flat, for every turf in the world. So slice ① gave the world
 * nine grounds and slice ② dressed them — and every one of them still sat on the SAME cold brown
 * flank, which is why a bright lush-turf top met a dark side at every terrace lip. Alex called it
 * the most visible remaining seam between grounds, and it is: the top face is what you see from
 * standing height, but on terraced country the FLANK is most of what you actually look at.
 *
 * ★ DERIVED, NOT TABULATED, and that is deliberate. A per-ground soil table would be one more
 * `Record` to forget the day a tenth ground lands — the exact drift the doctor spent tonight
 * proving (a check comparing against a model of what exists, while the model rots). Pulling the
 * flank from bare subsoil TOWARD the ground's own colour means a new ground gets a matching flank
 * for free, and the relationship is the physical one: the soil under a turf is that turf's soil.
 *
 * ⚠ IT IS A PULL, NOT A REPLACEMENT. At t=1 the flank becomes the grass colour and every terrace
 * face turns green, which is the opposite failure — a cliff of lawn. The crown must still read as
 * the only living part of the side.
 *
 * ── ★★★ 0.35 → 0.70, RULED BY ALEX 2026-08-20, AND THE STAGING IS WHY IT TOOK TWO PASSES ────────
 * The first pass compared three shades **at the barrens terraces** and shipped 0.35. That is grey
 * country, where a grey flank against grey ground is very nearly invisible — so the comparison was
 * run on the one terrain that cannot answer the question. **A dial must be staged where its failure
 * is loudest, not where the terrain is photogenic.**
 *
 * On GREEN country — meadow, dell, woodland, roughly 65% of the world — it is the dominant visual,
 * because quantization puts a 1-block riser every 3-5 columns across all gentle ground (already
 * slumped: 93% of dell lips are) and from any raised angle you are looking mostly at FACES. At 0.35
 * the mix is **65% subsoil**, so every one of those steps drew a grey stripe on green turf and the
 * landscape read as a ploughed field. Rendered at one spot on a devwin preview: **0.35 striped,
 * 0.70 a continuous green hillside.** Same geometry, one constant.
 *
 * ★ AND 0.70 DOES NOT BUY THAT WITH THE CLIFF-OF-LAWN ABOVE, because the pull is toward **each
 * ground's own colour** rather than toward a single grass green. Highland turf is itself pale and
 * cold, so a highland face stays grey at 0.70 — verified on the steep den face at (-1301,-233),
 * where the mouth still reads as a cut passage. The derived design is what makes the high value
 * safe; a tabulated one would have needed nine separate judgements.
 *
 * ⚠ THE CAUTION ABOVE STILL BINDS — this is 0.70, not 1.0, and the remaining 30% subsoil is what
 * keeps a face from reading as lawn. Do not "finish the job".
 */
export const FLANK_TINT = 0.70

function paintGrassSide(dst: Layer, size: number, seed: number,
  crownColor: number = MATERIAL_COLOR[MAT.TOPSOIL], flankTint: number = FLANK_TINT) {
  const dirt = mix(rgbOf(MATERIAL_COLOR[MAT.SUBSOIL]), rgbOf(crownColor), flankTint)
  const grass = rgbOf(crownColor)
  const crown = Math.max(2, Math.round(size * 0.28))
  for (let x = 0; x < size; x++) {
    // Wrapping 1D fringe: the ragged boundary has to meet itself across the tile seam.
    const jag = Math.round((vnoise(x, 0, size, 8, seed + 5) - 0.5) * 2 * (size * 0.09))
    const edge = crown + jag
    for (let y = 0; y < size; y++) {
      const grit = (h2(x, y, seed + 61) - 0.5) * 2 * 16
      const blot = (vnoise(x, y, size, 8, seed + 3) - 0.5) * 2 * 12
      const isGrass = y <= edge
      const c = shade(isGrass ? grass : dirt, grit + blot + (isGrass ? 0 : -4))
      put(dst, size, x, y, c)
    }
  }
}

function paintWater(dst: Layer, size: number, seed: number) {
  const base = rgbOf(MATERIAL_COLOR[MAT.WATER])
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wave = Math.sin((x / size) * Math.PI * 4 + (y / size) * Math.PI * 2) * 6
      const n = (vnoise(x, y, size, 8, seed) - 0.5) * 2 * 10
      put(dst, size, x, y, shade(base, wave + n))
    }
  }
}

/**
 * Spring crust — pale mineral shell with deposit rings. The rings are contour lines of one smooth
 * noise (thin darker-teal bands where it crosses evenly spaced thresholds), which is what layered
 * mineral deposit actually looks like from above: growth rings around old waterlines.
 */
function paintCrust(dst: Layer, size: number, seed: number) {
  const base = rgbOf(MATERIAL_COLOR[MAT.SPRING_CRUST])
  const ring: [number, number, number] = [176, 208, 198]   // the teal a wet mineral seam dries to
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = vnoise(x, y, size, 5, seed)
      const grit = (h2(x, y, seed + 31) - 0.5) * 2 * 7
      // Distance from the nearest ring threshold, in field space — thin band = ring line.
      const band = Math.abs(((n * 6) % 1 + 1) % 1 - 0.5)
      const onRing = band > 0.44
      const calcite = h2(x, y, seed + 77) > 0.93
      const c = onRing ? mix(base, ring, 0.7) : shade(base, grit + (calcite ? 14 : 0))
      put(dst, size, x, y, c)
    }
  }
}

/**
 * Packed cloud — the floor of the world (2026-08-15). Was `paintBedrock`, a blocky 8-cell mosaic
 * that said "hard rock, do not dig further"; the message is the same and the material is not.
 *
 * ★ SOFT SHAPES, HARD VALUE — that pairing is the whole brief. This is cloud, so the forms have to
 * be rounded and banked (wrapping value noise at two scales, no straight edge anywhere), but it is
 * cloud pressed until you can stand on it, so the contrast is TIGHT: a fluffy high-contrast tile
 * would read as sky leaking into the cave and invite the player to try to break it. Dense, cool,
 * quiet — heaped wool compressed into a floor.
 *
 * ⚠ `vnoise` AND NOT `h2`, DELIBERATELY, and it is the one thing that would go wrong invisibly.
 * The old mosaic was per-texel hash, which tiles fine because noise has no shape. Billows DO have
 * shape, so this needs the WRAPPING lattice — `vnoise`'s whole reason for existing (see its header:
 * a tile whose left edge does not meet its right draws a visible grid across every large surface,
 * and the floor of the world is the largest unbroken surface in the game).
 */
function paintPackedCloud(dst: Layer, size: number, seed: number) {
  const base = rgbOf(MATERIAL_COLOR[MAT.PACKED_CLOUD])
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Two octaves: 3 cells for the banks, 6 for the curdle along their edges.
      const banks = vnoise(x, y, size, 3, seed)
      const curdle = vnoise(x, y, size, 6, seed + 41)
      const n = banks * 0.7 + curdle * 0.3
      // Swing (±20) — measured by rendering, not picked: ±13 read as an untextured placeholder cube
      // and anything past ±25 starts reading as fluffy sky leaking into the cave.
      const lift = (n - 0.5) * 40
      // A faint bright rim where a bank crests, which is what makes it read as volume rather than
      // as a stain. Kept subtle: this material must never look like it emits (it does not — see
      // the registry on why giving the floor an `emit` would relight every deep cave).
      const crest = n > 0.64 ? (n - 0.64) * 62 : 0
      put(dst, size, x, y, shade(base, lift + crest + (h2(x, y, seed + 9) - 0.5) * 4))
    }
  }
}

/**
 * Ore — host rock with a crystal cluster, and the CLUSTER ONLY carries the glow.
 *
 * ★ ALPHA IS AN EMISSIVE MASK, NOT OPACITY. The material is opaque, so the alpha channel is free
 * real estate; the fragment shader multiplies the per-vertex emissive strength by it. Without this
 * the whole block glows and ore in an unlit cave reads as a lamp rather than as crystal in stone —
 * which matters more now that the night ruling makes dark places a real part of the game.
 */
function writeOre(dst: Layer, size: number, material: number, seed: number) {
  const host = rgbOf(MATERIAL_COLOR[MAT.DEEP_STONE])
  paintRock(dst, size, host, { speckle: 9, blotch: 12, vein: 0, seed })
  const ore = rgbOf(MATERIAL_COLOR[material] ?? 0xff00ff)
  const lit = shade(ore, 62)
  const dim = shade(ore, -46)
  const rim = shade(ore, -96)

  // ★ ANGULAR AND HARD-STEPPED, NOT ROUND AND SMOOTH — the first pass got both wrong and it read as
  // gumballs. Two rules do the work:
  //   1. MANHATTAN distance, not Euclidean. |dx|+|dy| draws a DIAMOND, and a diamond reads as a cut
  //      stone at 32px where a circle reads as a bubble. Shape language beats detail at this size.
  //   2. Three flat tones split along a diagonal, with NO gradient between them. A smooth ramp is
  //      what makes a shape look inflated; hard facets are what make it look cut. Pixel art gets its
  //      solidity from tone STEPS, and a soft glow on top of a soft ramp compounds the error.
  // A dark rim seats each shard into the rock so it reads as embedded rather than stuck on.
  // ★ SHARDS ARE FULLY CONTAINED — NOTHING TOUCHES THE TILE EDGE, AND THE OBVIOUS ARGUMENT AGAINST
  // THAT IS WRONG. The instinct is to wrap them toroidally so the tile is seamless, and that does
  // work: UVs are aligned to block boundaries, so a shard leaving the right edge meets its other
  // half on the left edge of the block next door and completes across the seam.
  //
  // But that only pays when two ore blocks are ADJACENT, and ore is mostly scattered singles. The
  // common case is one isolated block showing two clipped half-shards against plain stone on both
  // sides — which does not read as seamless, it reads as broken. Containing them costs the rare
  // continuous-vein case and buys a clean read on every block, which is the case that actually
  // occurs. The host rock still wraps (its blotch noise is lattice-periodic), so the tile has no
  // seam regardless.
  //
  // ⚠ KNOWN CONSEQUENCE: every ore block now shows the IDENTICAL cluster, so a large vein will read
  // as a stamped repeat. The fix when that bites is variant layers — 2-3 ore tiles per material,
  // selected per-block by the same `hashBlock` the jitter already uses, which costs no extra
  // geometry and no meshing. Not built yet; it is not worth the layers until a vein looks wrong.
  const shards = 6
  for (let i = 0; i < shards; i++) {
    // Slight anisotropy per shard so a cluster does not look stamped from one die.
    const r = size * (0.09 + h2(i, 3, seed + 200) * 0.07)
    const sx = 0.75 + h2(i, 4, seed + 200) * 0.6
    const sy = 0.75 + h2(i, 5, seed + 200) * 0.6
    // Inset by the shard's own reach on each axis, so no part of it can cross an edge. The extent of
    // a Manhattan diamond along x is r*sx (and r*sy along y) — using r alone would let the wider
    // shards clip out again, which is the exact bug being fixed.
    const padX = r * sx + EDGE_CLEAR
    const padY = r * sy + EDGE_CLEAR
    const cx = padX + h2(i, 1, seed + 200) * Math.max(0, size - 2 * padX)
    const cy = padY + h2(i, 2, seed + 200) * Math.max(0, size - 2 * padY)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx
        const dy = y - cy
        const d = Math.abs(dx / sx) + Math.abs(dy / sy)
        if (d > r) continue

        let c: [number, number, number]
        let glow: number
        if (d > r - Math.max(1, size / 32)) {
          c = rim; glow = 30                                   // seated edge against the rock
        } else if (dx - dy < -r * 0.12) {
          c = lit; glow = 255                                  // facet catching the light
        } else if (dx - dy > r * 0.34) {
          c = dim; glow = 120                                  // facet turned away
        } else {
          c = ore; glow = 205
        }
        put(dst, size, x, y, c, glow)
      }
    }
  }

  // A scatter of single-texel flecks. Cheap, and it keeps the host rock from looking like clean
  // stone with objects placed on it — real ore bleeds into its matrix.
  // Inset for the same reason as the shards: a fleck bisected by the block boundary is the same
  // dirty edge in miniature, and there are a lot more of them.
  const flecks = Math.round(size * 0.9)
  const span = size - 2 * EDGE_CLEAR
  for (let i = 0; i < flecks; i++) {
    const x = Math.floor(EDGE_CLEAR + h2(i, 11, seed + 300) * span)
    const y = Math.floor(EDGE_CLEAR + h2(i, 12, seed + 300) * span)
    const o = (y * size + x) * 4
    if (dst[o + 3] > 0) continue                               // already crystal, leave it alone
    put(dst, size, x, y, shade(ore, -34), 90)
  }
}

// ── wood ─────────────────────────────────────────────────────────────────────────────────────────
// These exist because they were MISSING: TILE_MATERIALS listed the wood ids (so layerOf mapped them
// to real slots) but paintFor had no cases for them, and the switch's `default` is the ORE painter.
// Every log and every leaf block rendered as crystal shards in deep-stone host rock — Alex's "the
// trees are made out of stone ore blocks", 2026-08-07. The fallback checker never fired because the
// materials WERE mapped; the hole was between the slot table and the painter. When you append to
// TILE_MATERIALS, the switch below needs a case, or the default hands your block to the ore artist.

/** Bark — vertical striation. Tone is per-COLUMN (1D wrapped noise) so the grain runs up the trunk,
 *  with a fine groove line where the stripe noise crosses a band. */
function paintBark(dst: Layer, size: number, base: [number, number, number], seed: number) {
  for (let x = 0; x < size; x++) {
    const stripe = (vnoise(x, 0, size, 8, seed) - 0.5) * 2 * 16
    const groove = vnoise(x, 0, size, 16, seed + 7)
    const isGroove = Math.abs(groove - 0.5) < 0.06
    for (let y = 0; y < size; y++) {
      const grit = (h2(x, y, seed + 21) - 0.5) * 2 * 8
      // Sparse horizontal nicks so the bark is not perfect verticals — real bark breaks its grain.
      const nick = h2(x >> 1, y, seed + 53) > 0.93 ? -14 : 0
      put(dst, size, x, y, shade(base, stripe + grit + nick + (isGroove ? -26 : 0)))
    }
  }
}

/** End grain — concentric SQUARE rings. Square, not round: at tile size a circle reads as a target;
 *  square rings read as cut wood, the same shape-language call as the ore's Manhattan diamonds. */
function paintRings(dst: Layer, size: number, base: [number, number, number], seed: number) {
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.max(Math.abs(x - c), Math.abs(y - c))
      const ring = ((d + (h2(x, y, seed + 3) > 0.85 ? 1 : 0)) % 3) === 0 ? -18 : 6
      const heart = d < size * 0.14 ? 10 : 0
      const grit = (h2(x, y, seed + 11) - 0.5) * 2 * 6
      put(dst, size, x, y, shade(base, ring + heart + grit))
    }
  }
}

/** Foliage — clump noise cut into three hard tones (pixel solidity comes from tone STEPS, same rule
 *  as the ore facets), with sparse dark holes so a canopy reads as leaves, not as a green block. */
function paintLeaves(dst: Layer, size: number, base: [number, number, number], seed: number) {
  const dark = shade(base, -30)
  const lit = shade(base, 20)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const clump = vnoise(x, y, size, 8, seed)
      let c = clump < 0.42 ? dark : clump > 0.62 ? lit : base
      const blade = h2(x, y, seed + 31)
      if (blade > 0.94) c = shade(c, 24)        // leaf catching light
      else if (blade < 0.05) c = shade(c, -38)  // hole into the canopy's dark
      put(dst, size, x, y, c)
    }
  }
}

/**
 * Dressed stone — courses of blocks with a mortar line between them, offset row to row.
 *
 * ★ THE COURSE OFFSET IS THE WHOLE READ. A grid of squares is a texture; bricks that step half a
 * block each row are unmistakably BUILT, and that is the one thing this tile has to say from
 * across a garden. Each block takes its own slight tone so a wall does not read as wallpaper.
 */
/**
 * Staggered masonry. `rows`×`cols` blocks per face, half-block stagger per course.
 *
 * ★ THE COURSE COUNT IS A PARAMETER BECAUSE TEXTURE IS THE ONLY THING SEPARATING TWO GREYS
 * (2026-08-15). Cut stone and stone bricks are the SAME ROCK, so hue cannot tell them apart the
 * way it separates pale brick and sandstone — a builder picking a wall has nothing to go on but
 * the pattern. Ashlar stays 4×2 (big dressed slabs, byte-identical to what shipped); bricks are
 * 8×4, half the unit in both axes, which reads as "somebody laid this" rather than "somebody cut
 * this". Both divisors keep the joints on whole pixels at 16 and 32.
 */
function paintAshlar(
  dst: Layer, size: number, base: [number, number, number], seed: number,
  rows = 4, cols = 2,
) {
  const mortar = shade(base, -34)
  const rh = size / rows
  const bw = size / cols
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / rh)
    // Half-block stagger per row, which is what stops it reading as a grid.
    const off = (row % 2) * (bw / 2)
    for (let x = 0; x < size; x++) {
      const bx = Math.floor(((x + off) % size) / bw)
      const onCourse = Math.floor(y % rh) === 0
      const onJoint = Math.floor((x + off) % bw) === 0
      if (onCourse || onJoint) { put(dst, size, x, y, mortar); continue }
      // One tone per block, so neighbouring stones differ slightly.
      const tone = (h2(row, bx + row * 7, seed) - 0.5) * 22
      const grit = (h2(x, y, seed + 5) - 0.5) * 2 * 5
      put(dst, size, x, y, shade(base, tone + grit))
    }
  }
}

/**
 * Sedimentary banding — sandstone, and the reason it is not just tinted ashlar.
 *
 * ★ A DIFFERENT IDIOM, NOT A DIFFERENT PALETTE. Three masonry blocks all wearing courses would put
 * the whole read on hue, and hue is the first thing that goes at distance, in shadow, and at night
 * under a lantern. Sandstone is BOUND SAND, not laid blocks — so it gets horizontal strata with no
 * joints at all, which is legible as a silhouette texture long after the tan has gone grey in the
 * dark. Bands are hashed per-row so a wall of them does not tile into stripes.
 */
function paintBanded(dst: Layer, size: number, base: [number, number, number], seed: number) {
  // ⚠ THE FIRST VERSION OF THESE NUMBERS WAS INVISIBLE, AND ONLY LOOKING FOUND IT. Bands 2px tall
  // with a ±10 tone swing and a rare -14 seam rendered as a FLAT TAN CUBE at icon scale — all hue,
  // no texture, which is exactly the "tint is not a texture" failure the sawmill and the cutter
  // were each written to avoid, arrived at from the other direction. A procedural pattern has to be
  // checked against the pixels it produces, not against how it reads in the source.
  const bh = Math.max(2, Math.round(size / 5))         // ~3px at 16, ~6px at 32: a band you can see
  for (let y = 0; y < size; y++) {
    const band = Math.floor(y / bh)
    const tone = (h2(band, band * 13, seed) - 0.5) * 34
    // The parting line between beds. Every band gets one at its top edge, varying in strength, so
    // the strata read as layers rather than as a stack of differently-coloured stripes.
    const edge = y % bh === 0 && band > 0
    const deep = h2(band, band * 7, seed + 11) > 0.5
    for (let x = 0; x < size; x++) {
      // Grain runs ALONG the bedding — sampled coarsely in x and finely in y, so the noise itself
      // is horizontal and reinforces the layering instead of fighting it with isotropic speckle.
      const grain = (h2(x >> 1, y, seed + 17) - 0.5) * 13
      put(dst, size, x, y, shade(base, tone + grain + (edge ? (deep ? -34 : -20) : 0)))
    }
  }
}

/**
 * Which timber each bed is framed in — the whole of Alex's "the planks used decides the colour".
 *
 * ⚠ READ OFF THE SPECIES' OWN LOG COLOUR, never a second hand-picked palette. A bed framed in
 * dawnwood must be the dawnwood the keeper cut; a separate colour here would drift the first time
 * the log's own colour was tuned, and nothing would fail.
 */
// ⚠⚠ A FUNCTION, NOT A TABLE, AND THAT IS NOT STYLE — IT IS THE ONLY SHAPE THAT WORKS HERE.
// `tiles.ts` imports MATERIAL_COLOR from `../attrs`, and `attrs.ts` imports layerOf from this file:
// a genuine import cycle, and a harmless one for as long as every painter reads MATERIAL_COLOR
// INSIDE a function body. The first cut of this was a top-level object literal, so it evaluated at
// module-init while MATERIAL_COLOR was still in its temporal dead zone and took the whole page down
// with "Cannot access 'J' before initialization" — a white-screen client exception, not a bad
// colour. Every other painter in this file gets away with the cycle by being lazy. Stay lazy.
const bedFrame = (material: number): number => ({
  [MAT.GARDEN_BED_GOLDWOOD]: MATERIAL_COLOR[WOOD.GOLDWOOD_LOG],
  [MAT.GARDEN_BED_SHIMMEROAK]: MATERIAL_COLOR[WOOD.SHIMMEROAK_LOG],
  [MAT.GARDEN_BED_DAWNWOOD]: MATERIAL_COLOR[WOOD.DAWNWOOD_LOG],
}[material] ?? MATERIAL_COLOR[MAT.PLANKS])

/** A bed's flank: milled boards with the dark soil line along the top edge. */
function paintPlankFrame(dst: Layer, size: number, wood: [number, number, number], seed: number): void {
  const strip = Math.max(2, Math.round(size / 3))
  const soilLip = Math.max(1, size >> 3)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (y < soilLip) { put(dst, size, x, y, [120, 112, 104], 0); continue }
    const seam = x % strip === 0
    put(dst, size, x, y, seam ? shade(wood, -46) : shade(wood, (h2(x, y, seed) - 0.5) * 20), 0)
  }
}

const LOG_SET = new Set<number>([WOOD.GOLDWOOD_LOG, WOOD.SHIMMEROAK_LOG, WOOD.STARWILLOW_LOG, WOOD.DAWNWOOD_LOG])
const LEAF_SET = new Set<number>([WOOD.GOLDWOOD_LEAVES, WOOD.SHIMMEROAK_LEAVES, WOOD.STARWILLOW_LEAVES, WOOD.DAWNWOOD_LEAVES])
/** Saplings paint as foliage — a seedling is leaves, and `paintLeaves` already reads as foliage. */
const SAPLING_SET = new Set<number>([
  MAT.SAPLING_GOLDWOOD, MAT.SAPLING_SHIMMEROAK, MAT.SAPLING_STARWILLOW, MAT.SAPLING_DAWNWOOD,
])

// ── the lantern ──────────────────────────────────────────────────────────────────────────────────

/**
 * A plank frame around warm mana glass. The GLASS carries the emissive alpha and the frame stays
 * dead wood — a lit block must read as light held in a thing, not as a cube that glows. Core is a
 * hard-stepped Manhattan diamond, the ore shards' shape language: facets, not gradients.
 */
function paintLantern(dst: Layer, size: number, seed: number) {
  const frame = rgbOf(MATERIAL_COLOR[WOOD.GOLDWOOD_LOG])
  const glass = rgbOf(MATERIAL_COLOR[MAT.MANA_LANTERN])
  const hot = shade(glass, 56)
  const dim = shade(glass, -44)
  const b = Math.max(2, Math.round(size / 8))
  const c = (size - 1) / 2
  const r = size / 2 - b
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x < b || y < b || x >= size - b || y >= size - b) {
        put(dst, size, x, y, shade(frame, (h2(x, y, seed) - 0.5) * 26), 0)
        continue
      }
      const d = Math.abs(x - c) + Math.abs(y - c)
      if (d < r * 0.5) put(dst, size, x, y, hot, 255)
      else if (d < r * 0.85) put(dst, size, x, y, glass, 205)
      else put(dst, size, x, y, dim, 140)
    }
  }
}

/**
 * The crafting table. TOP is a worked plank surface with a darker etched work-square — the "this
 * face is where things happen" read, MC muscle memory without copying its grid. SIDE is a light
 * top rail over a recessed panel between corner legs, so it reads as furniture standing on the
 * ground rather than another full cube of wood. BOTTOM is plain dark planks.
 */
function paintCraftTable(dst: Layer, size: number, seed: number, face: number) {
  const milled = rgbOf(MATERIAL_COLOR[MAT.CRAFT_TABLE])
  const dark = shade(milled, -52)
  const rail = shade(milled, 20)
  const plankH = Math.max(2, Math.round(size / 4))
  const b = Math.max(1, Math.round(size / 8))          // etch/leg thickness
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const jitter = (h2(x, y, seed) - 0.5) * 20
      if (face === TOP) {
        // plank strips + seam lines, then the etched work-square over them
        const seam = y % plankH === 0
        const inEtch = (x === b || x === size - 1 - b) && y >= b && y <= size - 1 - b ||
                       (y === b || y === size - 1 - b) && x >= b && x <= size - 1 - b
        put(dst, size, x, y, inEtch ? dark : shade(seam ? dark : milled, seam ? 0 : jitter), 0)
      } else if (face === SIDE) {
        const inRail = y < plankH                                  // top rail band
        const inLeg = x < b || x >= size - b                       // corner legs, full height
        const panel = shade(milled, -26 + jitter * 0.6)            // recessed panel
        put(dst, size, x, y, inRail ? shade(rail, jitter) : inLeg ? dark : panel, 0)
      } else {
        const seam = y % plankH === 0
        put(dst, size, x, y, shade(seam ? shade(dark, -14) : dark, seam ? 0 : jitter * 0.6), 0)
      }
    }
  }
}

/**
 * The sawmill. Deliberately the crafting table's SIBLING and not a new idiom — both are timber
 * workstations and should read as one family across a plot — with exactly one thing carrying the
 * difference: the BLADE SLOT.
 *
 * ★ THE TINT ALONE WAS NOT ENOUGH, and that is why this function exists rather than reusing
 * `paintCraftTable` with a different colour. The two stations do different jobs (the mill takes
 * logs 2.4x faster and refuses everything else), so a player who owns both has to tell them apart
 * at a glance from across the plot. Two pale timber cubes differing only in warmth is a legibility
 * bug wearing a palette, and it costs the player a wasted walk every time he guesses wrong.
 *
 * TOP is the plank bed split by a dark kerf with a bright steel lip on one side — the one mark that
 * says "saw" with no other cue. SIDE shows the bed line and the blade's rim standing proud of it.
 * BOTTOM is plain dark planks, same as the bench: nobody sees it and inventing detail there is work
 * that renders for no one.
 */
function paintSawmill(dst: Layer, size: number, seed: number, face: number) {
  const milled = rgbOf(MATERIAL_COLOR[MAT.SAWMILL])
  const dark = shade(milled, -52)
  const steel = shade(rgbOf(0xb9c0c6), 0)
  const plankH = Math.max(2, Math.round(size / 4))
  const mid = Math.round(size / 2)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const jitter = (h2(x, y, seed) - 0.5) * 20
      if (face === TOP) {
        // The kerf runs the full width at the midline; the lip is the single bright pixel row that
        // makes it read as a cutting edge rather than a plank seam.
        const seam = y % plankH === 0
        const kerf = y === mid
        const lip = y === mid - 1
        put(dst, size, x, y,
          kerf ? shade(dark, -18) : lip ? shade(steel, jitter * 0.5)
               : shade(seam ? dark : milled, seam ? 0 : jitter), 0)
      } else if (face === SIDE) {
        // Bed line across the upper third with the blade rim above it, legs below — the same
        // standing-furniture silhouette the bench uses, so they sit together correctly.
        const bed = y === plankH
        const rim = y === plankH - 1 && x > 2 && x < size - 3
        const inLeg = x < Math.max(1, Math.round(size / 8)) || x >= size - Math.max(1, Math.round(size / 8))
        put(dst, size, x, y,
          rim ? shade(steel, jitter * 0.5) : bed ? shade(dark, -10)
              : inLeg ? dark : shade(milled, -22 + jitter * 0.6), 0)
      } else {
        const seam = y % plankH === 0
        put(dst, size, x, y, shade(seam ? shade(dark, -14) : dark, seam ? 0 : jitter * 0.6), 0)
      }
    }
  }
}

/**
 * The stonecutter. The family's third station, and the first one that is not made of wood — which
 * is doing the legibility work the sawmill had to buy with a blade slot.
 *
 * ★ MATERIAL, NOT TINT, IS WHAT TELLS THREE STATIONS APART. The mill needed its own painter because
 * two pale timber cubes differing only in warmth is a legibility bug wearing a palette. A THIRD
 * pale timber cube would have been worse than either — so the cutter is a grey stone bed standing
 * on timber legs, and it reads at a glance from across a plot even in silhouette.
 *
 * TOP is a dressed slab, gritty rather than grained, split by the same dark kerf and bright steel
 * lip the mill uses — the family mark, and the one cue that says the block cuts things. SIDE is the
 * heavy bed as a thick band with the blade rim proud of it, standing on short dark legs: mass on
 * legs, where the mill is a bench on legs. BOTTOM is plain dark stone; nobody sees it and inventing
 * detail there is work that renders for no one.
 */
function paintStonecutter(dst: Layer, size: number, seed: number, face: number) {
  const slab = rgbOf(MATERIAL_COLOR[MAT.STONECUTTER])
  const dark = shade(slab, -46)
  const timber = shade(rgbOf(MATERIAL_COLOR[MAT.CRAFT_TABLE]), -30)   // the family's leg stock
  const steel = rgbOf(0xb9c0c6)
  const bedH = Math.max(3, Math.round(size / 3))                      // the bed is THICK — it is the tool
  const mid = Math.round(size / 2)
  const legW = Math.max(1, Math.round(size / 8))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Grit rather than grain: two hashes at different scales so the surface reads as stone that
      // was worked, not as a plank that was greyed.
      const grit = (h2(x, y, seed + 19) - 0.5) * 16
      const blot = (h2(x >> 2, y >> 2, seed + 5) - 0.5) * 14
      if (face === TOP) {
        const kerf = y === mid
        const lip = y === mid - 1
        put(dst, size, x, y,
          kerf ? shade(dark, -16) : lip ? shade(steel, grit * 0.5)
               : shade(slab, grit + blot), 0)
      } else if (face === SIDE) {
        const rim = y === bedH - 1 && x > 2 && x < size - 3
        const inBed = y < bedH
        const inLeg = x < legW || x >= size - legW
        put(dst, size, x, y,
          rim ? shade(steel, grit * 0.5)
              : inBed ? shade(slab, grit + blot)
              : inLeg ? shade(timber, grit * 0.4) : shade(dark, -8 + grit * 0.6), 0)
      } else {
        put(dst, size, x, y, shade(dark, grit * 0.6 + blot * 0.5), 0)
      }
    }
  }
}

/**
 * The waymark — a planted passage. A dressed post with a LIT GLYPH on its faces.
 *
 * ★ THE GLYPH IS THE WHOLE READ, and it is drawn with the alpha channel rather than a brighter
 * colour. `writeOre`'s trick: alpha is an EMISSIVE MASK here, not opacity, so only the glyph glows
 * and the stone around it stays stone. A waymark lit uniformly would read as a lamp — which is
 * exactly what it must not be mistaken for, since the registry gives it a real `emit` and a keeper
 * needs to tell "my passage" from "my lantern" across a dark field.
 *
 * TOP is the glyph square, whole. SIDE carries a vertical bar with the same square at eye height,
 * so the marker reads from any approach without four painted faces. BOTTOM is plain dark stone.
 */
function paintWaymark(dst: Layer, size: number, seed: number, face: number) {
  const stone = rgbOf(MATERIAL_COLOR[MAT.WAYMARK])
  const dark = shade(stone, -48)
  const lit = rgbOf(0xe4f7ff)
  const c = (size - 1) / 2
  // ⚠ THIN STROKE, WIDE RING. The first cut used a size/8 stroke on a size/4 ring, which at 16px
  // made the lit band nearly as wide as the gap it was supposed to outline — the icon sheet showed
  // it as a bright plate with dark speckles rather than as a mark. A glyph needs MORE background
  // than foreground to read as a glyph.
  const arm = Math.max(1, Math.round(size / 16))      // glyph stroke, in texels
  const rad = Math.max(3, Math.round(size / 3))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const grit = (h2(x, y, seed + 23) - 0.5) * 12
      const dx = Math.abs(x - c), dy = Math.abs(y - c)
      // A ring-and-cross glyph: legible at 16px, and nothing in the world shares the shape.
      // A square ring with a solid pip at its centre: two shapes, lots of dark between them, and
      // nothing else in the world wears it. Legible at 16px, which is the only size that matters.
      const onRing = Math.abs(Math.max(dx, dy) - rad) <= arm * 0.6
      const onPip = dx <= arm && dy <= arm
      const glyph = face === BOTTOM ? false : onRing || onPip
      if (glyph) { put(dst, size, x, y, shade(lit, grit * 0.4), 255); continue }
      if (face === SIDE && dy > rad + arm) {
        // the post below/above the glyph plate — banded so it reads as stacked stone
        const band = Math.floor(y / Math.max(2, Math.round(size / 5))) % 2 === 0
        put(dst, size, x, y, shade(band ? stone : shade(stone, -14), grit), 0)
        continue
      }
      put(dst, size, x, y, shade(face === BOTTOM ? dark : stone, grit), 0)
    }
  }
}

/**
 * The cloud-wall — the plot's boundary, and `paintPackedCloud`'s soft sibling.
 *
 * ★ SAME BILLOWS, LESS PRESSURE — the pair has to read as one material at two pressures (canon:
 * pressed soft and glowing at the walls, pressed hard where you stand). So it reuses the floor's
 * two-octave wrapping lattice at a LARGER cell and a WIDER swing: bigger, looser banks with more
 * contrast between them, which is what "piled like heaped wool" looks like next to "pressed flat".
 *
 * ⚠ `vnoise`, not `h2`, for the same reason the floor gives: billows have shape, so the lattice has
 * to WRAP or a visible grid draws across what is by definition the largest continuous surface a
 * player ever looks at — the wall around their whole world.
 */
function paintCloudWall(dst: Layer, size: number, seed: number) {
  const base = rgbOf(MATERIAL_COLOR[MAT.CLOUD_WALL])
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const banks = vnoise(x, y, size, 2, seed)          // 2 cells: bigger heaps than the floor's 3
      const curdle = vnoise(x, y, size, 5, seed + 61)
      const n = banks * 0.72 + curdle * 0.28
      // ★ THE CONTRAST IS BOUGHT IN THE TROUGHS, NOT THE CRESTS. Raising the highlights on a pale
      // material just clips it toward white and flattens the whole face (that is what happened at
      // 0xd6dcea). Pushing the gaps DOWN is what makes heaped wool read as heaps — the shadow
      // between two piles is the only thing that says there are two.
      const lift = n < 0.5 ? (n - 0.5) * 96 : (n - 0.5) * 44
      const crest = n > 0.62 ? (n - 0.62) * 60 : 0
      // Alpha lifts on the crests only: the glow lives in the lit rim of a heap, never flat across
      // the face, or the wall reads as a light-box instead of as cloud with a sun behind it.
      const a = n > 0.66 ? Math.round(Math.min(1, (n - 0.66) * 3) * 150) : 0
      put(dst, size, x, y, shade(base, lift + crest + (h2(x, y, seed + 9) - 0.5) * 4), a)
    }
  }
}

/**
 * The chest. SIDE carries the whole read: a lid seam across the upper third, two dark iron straps,
 * and a latch plate centred on the seam — the silhouette a player identifies from six blocks away
 * without reading a label. TOP is lid boards running crosswise to the body's, banded by the same
 * iron. BOTTOM is plain dark stock.
 *
 * ⚠ ONE SIDE LAYER MEANS THE LATCH IS ON ALL FOUR SIDES. The atlas is three faces per material
 * (top/side/bottom), not six, so there is no front. That is honest rather than wrong — the block
 * has no facing to respect yet, and inventing one here would be a lie the placement code cannot
 * keep. The day directional blocks land (the parked stairs/logs item), this gets a front.
 */
function paintChest(dst: Layer, size: number, seed: number, face: number) {
  const wood = rgbOf(MATERIAL_COLOR[MAT.CHEST])
  const iron = shade(wood, -74)
  const lid = shade(wood, 16)
  const plankH = Math.max(2, Math.round(size / 4))
  const strap = Math.max(1, Math.round(size / 10))          // iron strap width
  const seamY = Math.max(2, Math.round(size / 3))           // where the lid meets the body
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const jitter = (h2(x, y, seed) - 0.5) * 18
      if (face === TOP) {
        // lid boards run across, with the straps continuing over the top so the bands wrap
        const seam = x % plankH === 0
        const onStrap = Math.abs(y - size / 4) < strap / 2 || Math.abs(y - (3 * size) / 4) < strap / 2
        put(dst, size, x, y, onStrap ? shade(iron, jitter * 0.4) : shade(seam ? shade(lid, -30) : lid, seam ? 0 : jitter), 0)
      } else if (face === SIDE) {
        const onSeam = y === seamY || y === seamY - 1
        const onStrap = Math.abs(x - size / 4) < strap / 2 || Math.abs(x - (3 * size) / 4) < strap / 2
        // The latch: a plate straddling the seam, dead centre. ⚠ Sized to READ AT 16px, which is
        // the tile the world actually samples — the first cut was 2px wide and vanished into the
        // strap noise at real size while looking fine blown up.
        const latchW = Math.max(3, Math.round(size / 5))
        const inLatch = Math.abs(x - c) <= latchW / 2 && y >= seamY - 2 && y <= seamY + latchW
        const board = y % plankH === 0 ? shade(wood, -22) : shade(y < seamY ? lid : wood, jitter)
        put(dst, size, x, y,
          inLatch ? shade(iron, 22 + jitter * 0.3)
            : onSeam ? shade(iron, -12)
            : onStrap ? shade(iron, jitter * 0.4)
            : board, 0)
      } else {
        const seam = y % plankH === 0
        const dark = shade(wood, -56)
        put(dst, size, x, y, shade(seam ? shade(dark, -14) : dark, seam ? 0 : jitter * 0.6), 0)
      }
    }
  }
}

// ── assembly ─────────────────────────────────────────────────────────────────────────────────────

/** Exported for the item-icon renderer: an item's art must BE the block's art (see item-icon.ts). */
/**
 * The cauldron. The alchemy station, and the family's fourth — first one that is a VESSEL.
 *
 * ★ MATERIAL TELLS THE STATIONS APART (the rule paintStonecutter states): two pale timbers and a
 * grey stone bed are already on a plot, so the brewer is FIRED CLAY on a stone hearth. Nothing else
 * in the world is that warm brown at that size, so it reads in silhouette from across a garden —
 * which is the whole test, because the four of them will stand in a row.
 *
 * ⚠ NOT IRON, NOT THREE LEGS, and that is canon rather than taste. `design-briefs/
 * shimmer-alchemy-vessels.md`: *"No metal... hand-blown glass, fired clay, cork, wax, cord and
 * cloth. Metal belongs to the collar and the Mint."* The default cauldron in anyone's head is a
 * black iron pot, so the painter has to actively refuse it.
 *
 * TOP is the brew: a dark still surface inside a clay rim, with a faint sheen — the vessels brief
 * makes *the liquid the light source*, so the sheen is the only bright thing here and the clay never
 * is. Deliberately DIM: an idle cauldron is holding water, and painting a glow into it would promise
 * a brew that is not running. SIDE is a heavy clay belly with the pot's own rim band at the top and
 * a dark stone hearth course at the bottom, so the silhouette says *basin standing on a fire*.
 * BOTTOM is plain soot — nobody sees it.
 */
function paintCauldron(dst: Layer, size: number, seed: number, face: number) {
  const clay = rgbOf(MATERIAL_COLOR[MAT.CAULDRON])
  const hearth = shade(rgbOf(MATERIAL_COLOR[MAT.STONE]), -18)
  const soot = shade(clay, -52)
  const brew = rgbOf(0x2e3b46)                                  // still, dark, unlit water
  const hearthH = Math.max(2, Math.round(size / 4))             // the fire bed it stands on
  const rimH = Math.max(1, size >> 3)
  if (face === BOTTOM) { paintGrit(dst, size, soot, 10, 8, seed); return }
  if (face === SIDE) {
    paintGrit(dst, size, clay, 12, 10, seed)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const grit = (h2(x, y, seed + 31) - 0.5) * 14
      if (y < rimH) put(dst, size, x, y, shade(clay, 24 + grit * 0.5), 0)           // the rim
      else if (y >= size - hearthH) put(dst, size, x, y, shade(hearth, grit * 0.7), 0)  // the hearth
    }
    return
  }
  // TOP: clay ring, brew inside it, one soft sheen arc off-centre so the surface reads as liquid
  // rather than as a hole. The arc is asymmetric on purpose — hand-blown, hand-fired, never a
  // factory shape (the brief's *"slight asymmetry"* clause, at 16px where that is all it can be).
  paintGrit(dst, size, clay, 10, 8, seed)
  const c = (size - 1) / 2, r = size * 0.36
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - c, y - c)
    if (d > r) continue
    const grit = (h2(x, y, seed + 7) - 0.5) * 10
    const sheen = Math.abs(d - r * 0.62) < 0.9 && x < c            // one arc, left of centre
    put(dst, size, x, y, sheen ? shade(brew, 34) : shade(brew, grit), 0)
  }
}

export function paintFor(material: number, face: number, size: number): Layer {
  const dst = new Uint8Array(size * size * 4)
  const seed = material * 1013 + 17
  switch (material) {
    case MAT.PACKED_CLOUD: paintPackedCloud(dst, size, seed); break
    case MAT.DEEP_STONE: paintRock(dst, size, rgbOf(MATERIAL_COLOR[material]), { speckle: 10, blotch: 16, vein: 22, seed }); break
    case MAT.STONE: paintRock(dst, size, rgbOf(MATERIAL_COLOR[material]), { speckle: 11, blotch: 14, vein: 16, seed }); break
    case MAT.SUBSOIL: paintGrit(dst, size, rgbOf(MATERIAL_COLOR[material]), 18, 22, seed); break
    case MAT.SAND: paintGrit(dst, size, rgbOf(MATERIAL_COLOR[material]), 10, 0, seed); break
    case MAT.WATER: paintWater(dst, size, seed); break
    case MAT.SPRING_CRUST: paintCrust(dst, size, seed); break
    case MAT.TOPSOIL:
      if (face === TOP) paintGrassTop(dst, size, seed)
      else if (face === SIDE) paintGrassSide(dst, size, seed)
      else paintGrit(dst, size, rgbOf(MATERIAL_COLOR[MAT.SUBSOIL]), 18, 22, seed)
      break
    case MAT.GREY_SOIL:
      if (face === TOP) paintGrassTop(dst, size, seed, MATERIAL_COLOR[MAT.GREY_SOIL], 0.55)
      else if (face === SIDE) paintGrassSide(dst, size, seed, MATERIAL_COLOR[MAT.GREY_SOIL])
      else paintGrit(dst, size, rgbOf(MATERIAL_COLOR[MAT.SUBSOIL]), 18, 22, seed)
      break
    // ── ★ THE GROUNDS (2026-08-19) ───────────────────────────────────────────────────────────
    // The four TURFS take the grass painter with their own colour, which is exactly how GREY_SOIL
    // has always worked — one painter, one palette entry, a whole ground. Their CONTRAST differs
    // on purpose and it is not decoration: contrast is how blade-scatter reads at distance, so the
    // dry grass is coarse (sparse straw over bare earth) and the highland turf is tight (hardy,
    // close-cropped at altitude). Same shape language argument as rubble against cut stone.
    case MAT.FOREST_LOAM:
    case MAT.LUSH_TURF:
    case MAT.DRY_GRASS:
    case MAT.HIGHLAND_TURF: {
      const c = MATERIAL_COLOR[material]
      const contrast = material === MAT.DRY_GRASS ? 1.35 : material === MAT.HIGHLAND_TURF ? 0.75 : 1
      if (face === TOP) paintGrassTop(dst, size, seed, c, contrast)
      else if (face === SIDE) paintGrassSide(dst, size, seed, c)
      else paintGrit(dst, size, rgbOf(MATERIAL_COLOR[MAT.SUBSOIL]), 18, 22, seed)
      break
    }
    // ⚠ MUD AND SCREE ARE NOT TURF AND MUST NOT WEAR THE GRASS PAINTER. A grass crown on either
    // one is the whole reason a marsh would still read as a meadow: the top face is what you see
    // from standing height, so it is the face that has to say "nothing grows here".
    case MAT.MARSH_MUD: paintGrit(dst, size, rgbOf(MATERIAL_COLOR[material]), 14, 26, seed); break
    case MAT.SCREE: paintRock(dst, size, rgbOf(MATERIAL_COLOR[material]), { speckle: 30, blotch: 24, vein: 0, seed }); break
    // ── ★ THE BUILDING GRAMMAR'S TWO STONES (2026-08-13) ────────────────────────────────────
    // They must read apart ACROSS A ROOM, because the whole point of the ruling is that a player
    // can see the difference between what they patched and what they built. So the split is in the
    // SHAPE language, not the hue: rubble is loose rock — heavy speckle, big blotches, no
    // structure — while cut stone is a dressed ASHLAR face with mortar courses, which is the one
    // thing nothing else in the world draws.
    case MAT.RUBBLE: paintRock(dst, size, rgbOf(MATERIAL_COLOR[material]), { speckle: 26, blotch: 30, vein: 0, seed }); break
    case MAT.CUT_STONE: paintAshlar(dst, size, rgbOf(MATERIAL_COLOR[material]), seed); break
    // ⚠ The masonry palette (2026-08-15). Same painter, finer courses — see `paintAshlar` on why
    // the two greys are separated by pattern and the other two by mineral.
    case MAT.STONE_BRICK:
    case MAT.PALE_BRICK: paintAshlar(dst, size, rgbOf(MATERIAL_COLOR[material]), seed, 8, 4); break
    case MAT.SANDSTONE: paintBanded(dst, size, rgbOf(MATERIAL_COLOR[material]), seed); break
    case MAT.WAYMARK: paintWaymark(dst, size, seed, face); break
    case MAT.CLOUD_WALL: paintCloudWall(dst, size, seed); break
    // ── the garden beds, one per plank wood (2026-08-22) ────────────────────────────────────
    // ★ ALEX: *"it would be cool if the garden beds were mergable and the planks used decides the
    // color of the border."* The frame IS the border, and it is drawn here rather than tinted by
    // the vertex colour because that colour multiplies the whole block — one hue for soil and frame
    // both. Two tones in one block means two tones in the TEXTURE.
    //
    // ⚠ THE FRAME IS DRAWN AT FULL STRENGTH AND THE SOIL IS DRAWN DARK, because `atlas.ts` does
    // `diffuseColor.rgb *= tile.rgb` — the tile is a MULTIPLIER over the material colour, not a
    // replacement. A frame painted in the wood's own absolute hue would come out wood x soil.
    //
    // ⚠ AND THE FRAME MUST SURVIVE THE MERGE. When beds learn to join, the border is edge geometry
    // emitted only on the outside of a run, and this painted frame becomes the thing it agrees
    // with. Keep the band a whole number of texels wide or the two will not line up at 16px.
    case MAT.GARDEN_BED_GOLDWOOD:
    case MAT.GARDEN_BED_SHIMMEROAK:
    case MAT.GARDEN_BED_DAWNWOOD: {
      const wood = rgbOf(bedFrame(material))
      const band = Math.max(1, size >> 3)          // 2 texels at 16px — the frame's width
      if (face === BOTTOM) { paintGrit(dst, size, shade(wood, -34), 10, 10, seed); break }
      if (face === SIDE) {
        // From the side a bed is its timber, with the soil showing as a dark line along the top.
        paintPlankFrame(dst, size, wood, seed)
        break
      }
      // TOP: turned earth inside a timber frame. The soil is drawn DARK so the material colour
      // carries it; the frame is drawn bright so the wood reads through the multiply.
      paintGrit(dst, size, [214, 206, 198], 16, 12, seed)
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const edge = x < band || y < band || x >= size - band || y >= size - band
        if (edge) put(dst, size, x, y, shade(wood, (h2(x, y, seed) - 0.5) * 16), 0)
      }
      // Two furrows across the soil — what says "turned" rather than "a brown square", and the cue
      // a keeper reads from standing height when deciding which squares are still bare.
      const furrow = Math.max(1, size >> 4)
      for (const fy of [Math.floor(size * 0.38), Math.floor(size * 0.66)])
        for (let y = fy; y < fy + furrow; y++)
          for (let x = band + 1; x < size - band - 1; x++) put(dst, size, x, y, [150, 142, 134], 0)
      break
    }
    case MAT.MANA_LANTERN: paintLantern(dst, size, seed); break
    // ── the pot, in three states ────────────────────────────────────────────────────────────
    // ⚠ Appended to TILE_MATERIALS above, so it NEEDS these cases: the switch's default is the ore
    // painter, and that is exactly how every tree once rendered as crystal in deep stone.
    // The three states must read apart AT A GLANCE and from across a garden, so they differ in
    // what sits on the SOIL rather than in the pot's own clay: bare, a pale sprout, an open bloom.
    case MAT.POT:
    case MAT.POT_SEEDED:
    case MAT.POT_BLOOM: {
      const clay = rgbOf(MATERIAL_COLOR[MAT.POT])
      if (face === BOTTOM) { paintGrit(dst, size, shade(clay, -18), 10, 10, seed); break }
      if (face === SIDE) {
        paintGrit(dst, size, clay, 12, 10, seed)
        // A rim band across the top quarter — the silhouette cue that says "vessel", not "block".
        for (let y = 0; y < Math.max(1, size >> 2); y++)
          for (let x = 0; x < size; x++) put(dst, size, x, y, shade(clay, 26), 0)
        break
      }
      // TOP: soil in the mouth of the pot, ringed by clay, with the state sitting in the middle.
      paintGrit(dst, size, clay, 10, 8, seed)
      const c = (size - 1) / 2, r = size * 0.34
      const soil = rgbOf(MATERIAL_COLOR[MAT.SUBSOIL])
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (Math.hypot(x - c, y - c) > r) continue
        put(dst, size, x, y, shade(soil, Math.floor(h2(x, y, seed) * 16) - 8), 0)
      }
      if (material === MAT.POT) break
      const sprout = rgbOf(MATERIAL_COLOR[MAT.TUFT])
      if (material === MAT.POT_SEEDED) {
        // A thin pale shoot: small on purpose, so "not ready yet" is legible without a HUD.
        for (let y = Math.floor(c - r * 0.55); y <= Math.ceil(c); y++)
          put(dst, size, Math.round(c), y, shade(sprout, 30), 0)
      } else {
        // Bloomed: an open four-petal star in mana gold — the one state worth crossing a garden for.
        const petal = rgbOf(MATERIAL_COLOR[MAT.MANA_LANTERN] ?? MATERIAL_COLOR[MAT.TUFT])
        for (let d = -Math.floor(r * 0.7); d <= Math.floor(r * 0.7); d++) {
          put(dst, size, Math.round(c + d), Math.round(c), petal, 0)
          put(dst, size, Math.round(c), Math.round(c + d), petal, 0)
        }
        put(dst, size, Math.round(c), Math.round(c), shade(petal, 40), 0)
      }
      break
    }
    case MAT.CRAFT_TABLE: paintCraftTable(dst, size, seed, face); break
    // ⚠ Appended to TILE_MATERIALS above, so it NEEDS this case — the switch's default is the ore
    // artist, and a station with no case ships as a magenta crystal you can right-click.
    case MAT.SAWMILL: paintSawmill(dst, size, seed, face); break
    // ⚠ Same story a third time — TILE_MATERIALS without a case here is a magenta ore block. The
    // render-audit oracle now fails on that, which is why this line cannot be forgotten again.
    case MAT.STONECUTTER: paintStonecutter(dst, size, seed, face); break
    // ⚠ Appended to TILE_MATERIALS above, so it NEEDS this case — the switch's default is the ore
    // painter, which is how every tree once rendered as crystal.
    case MAT.CHEST: paintChest(dst, size, seed, face); break
    // ⚠ Fourth time this warning earns its keep — TILE_MATERIALS without a case here is a magenta
    // ore block you can right-click. `render-audit.test.ts` fails on it, which is the only reason
    // this line is hard to forget.
    case MAT.CAULDRON: paintCauldron(dst, size, seed, face); break
    case MAT.PATH:
      // Packed earth: subsoil's grit, lightened and calmer, with sparse pale pebbles — reads as
      // WALKED against topsoil's grass without shouting like sand.
      if (face === TOP) {
        paintGrit(dst, size, rgbOf(MATERIAL_COLOR[MAT.PATH]), 12, 8, seed)
        for (let i = 0; i < size; i++) {
          const px = Math.floor(h2(i, 7, seed) * size), py = Math.floor(h2(3, i, seed ^ 9) * size)
          if (h2(px, py, seed) > 0.72) put(dst, size, px, py, shade(rgbOf(MATERIAL_COLOR[MAT.PATH]), 34), 0)
        }
      } else paintGrit(dst, size, rgbOf(MATERIAL_COLOR[MAT.SUBSOIL]), 18, 22, seed)
      break
    case MAT.PLANKS: {
      // Plain milled strips — the craft table's surface without the etched work-square.
      const milled = rgbOf(MATERIAL_COLOR[MAT.PLANKS])
      const strip = Math.max(2, Math.round(size / 4))
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const seam = (face === SIDE ? x : y) % strip === 0
        put(dst, size, x, y, seam ? shade(milled, -48) : shade(milled, (h2(x, y, seed) - 0.5) * 22), 0)
      }
      break
    }
    case MAT.DECK: {
      // The same milled strips, weathered: wider boards, a deeper gap between them, and grain
      // noise at nearly twice the plank's spread so the surface reads worn rather than machined.
      // ★ The SILHOUETTE stays a plank floor on purpose — this is still a bridge, and a player
      // should recognise the crossing instantly. What has to differ is only the thing that says
      // "this is the road's, not yours", so the tell is tone and wear, never a different shape.
      const worn = rgbOf(MATERIAL_COLOR[MAT.DECK])
      const strip = Math.max(3, Math.round(size / 3))
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const along = face === SIDE ? x : y
        const seam = along % strip === 0
        // A second, sparser darkening picks out split boards — weather, not a seam grid.
        const split = h2(x, Math.floor(y / strip), seed ^ 0x5ec) > 0.86
        put(dst, size, x, y,
          seam ? shade(worn, -56)
            : shade(worn, (h2(x, y, seed) - 0.5) * 40 - (split ? 18 : 0)), 0)
      }
      break
    }
    default:
      if (LOG_SET.has(material)) {
        const c = rgbOf(MATERIAL_COLOR[material])
        if (face === SIDE) paintBark(dst, size, c, seed)
        else paintRings(dst, size, c, seed)
      }
      else if (LEAF_SET.has(material) || SAPLING_SET.has(material))
        paintLeaves(dst, size, rgbOf(MATERIAL_COLOR[material]), seed)
      else writeOre(dst, size, material, seed)
  }
  return dst
}

/** A loud checker so an unmapped material is a bug you SEE, not a block that quietly looks like stone. */
function paintFallback(size: number): Layer {
  const dst = new Uint8Array(size * size * 4)
  const b = Math.max(2, size / 8)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      put(dst, size, x, y, (((x / b) | 0) + ((y / b) | 0)) % 2 ? [255, 0, 255] : [20, 20, 20])
  return dst
}

/**
 * The whole tile set as ONE contiguous buffer, laid out layer-major — the exact shape
 * `THREE.DataArrayTexture` wants, so `atlas.ts` does no repacking.
 */
export function buildTileArray(size: number): Uint8Array {
  const per = size * size * 4
  const out = new Uint8Array(per * LAYER_COUNT)
  for (let slot = 0; slot < TILE_MATERIALS.length; slot++) {
    for (let face = 0; face < 3; face++) {
      out.set(paintFor(TILE_MATERIALS[slot], face, size), (slot * 3 + face) * per)
    }
  }
  out.set(paintFallback(size), FALLBACK_LAYER * per)
  return out
}

/**
 * One layer, for drawing a reference swatch at true pixel size in the HUD.
 *
 * Copies rather than viewing the shared buffer: `ImageData` requires a `Uint8ClampedArray` backed by
 * a plain `ArrayBuffer`, and a view over the tile set is typed `ArrayBufferLike`. A copy of one 64px
 * tile is 16KB, drawn once — not worth a cast that would outlive the reason for it.
 *
 * ⚠ The return type is INFERRED deliberately. Annotating it `Uint8ClampedArray` widens the buffer
 * parameter back to `ArrayBufferLike` (which admits `SharedArrayBuffer`) and `ImageData` rejects it
 * again — the annotation would undo the very thing the copy is here to achieve.
 */
export function sliceLayer(all: Uint8Array, size: number, layer: number) {
  const per = size * size * 4
  const out = new Uint8ClampedArray(per)
  out.set(all.subarray(layer * per, layer * per + per))
  return out
}
