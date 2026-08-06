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
import { MATERIAL_COLOR } from '../attrs'

export const TOP = 0
export const SIDE = 1
export const BOTTOM = 2

/** Ordered — a material's position here IS its slot, so do not reorder without rebuilding. */
export const TILE_MATERIALS: number[] = [
  MAT.BEDROCK, MAT.DEEP_STONE, MAT.STONE, MAT.SUBSOIL, MAT.TOPSOIL, MAT.SAND, MAT.WATER,
  ORE.RAW_MANA, ORE.ELEMENT_VIOLET, ORE.ELEMENT_STORM, ORE.ELEMENT_EARTH, ORE.ELEMENT_WATER,
  ORE.PURE_CORE, ORE.ATHER_CRYSTAL,
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
export function layerOf(material: number, face: number): number {
  const slot = material >= 0 && material < SLOT.length ? SLOT[material] : -1
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

/** Grass crown — the face you spend the whole game looking down at. */
function paintGrassTop(dst: Layer, size: number, seed: number) {
  const base = rgbOf(MATERIAL_COLOR[MAT.TOPSOIL])
  const dark = shade(base, -34)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const clump = vnoise(x, y, size, 8, seed)
      const blade = h2(x, y, seed + 12)
      let c = mix(dark, shade(base, 16), clamp01(clump * 0.8 + blade * 0.45))
      if (blade > 0.94) c = shade(c, 26)
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
function paintGrassSide(dst: Layer, size: number, seed: number) {
  const dirt = rgbOf(MATERIAL_COLOR[MAT.SUBSOIL])
  const grass = rgbOf(MATERIAL_COLOR[MAT.TOPSOIL])
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

function paintBedrock(dst: Layer, size: number, seed: number) {
  const base = rgbOf(MATERIAL_COLOR[MAT.BEDROCK])
  const b = Math.max(2, Math.round(size / 8))
  for (let py = 0; py < size; py += b) {
    for (let px = 0; px < size; px += b) {
      const d = (h2(px / b, py / b, seed) - 0.5) * 2 * 46
      for (let y = py; y < py + b && y < size; y++)
        for (let x = px; x < px + b && x < size; x++)
          put(dst, size, x, y, shade(base, d + (h2(x, y, seed + 9) - 0.5) * 10))
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

// ── assembly ─────────────────────────────────────────────────────────────────────────────────────

function paintFor(material: number, face: number, size: number): Layer {
  const dst = new Uint8Array(size * size * 4)
  const seed = material * 1013 + 17
  switch (material) {
    case MAT.BEDROCK: paintBedrock(dst, size, seed); break
    case MAT.DEEP_STONE: paintRock(dst, size, rgbOf(MATERIAL_COLOR[material]), { speckle: 10, blotch: 16, vein: 22, seed }); break
    case MAT.STONE: paintRock(dst, size, rgbOf(MATERIAL_COLOR[material]), { speckle: 11, blotch: 14, vein: 16, seed }); break
    case MAT.SUBSOIL: paintGrit(dst, size, rgbOf(MATERIAL_COLOR[material]), 18, 22, seed); break
    case MAT.SAND: paintGrit(dst, size, rgbOf(MATERIAL_COLOR[material]), 10, 0, seed); break
    case MAT.WATER: paintWater(dst, size, seed); break
    case MAT.TOPSOIL:
      if (face === TOP) paintGrassTop(dst, size, seed)
      else if (face === SIDE) paintGrassSide(dst, size, seed)
      else paintGrit(dst, size, rgbOf(MATERIAL_COLOR[MAT.SUBSOIL]), 18, 22, seed)
      break
    default: writeOre(dst, size, material, seed)
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
