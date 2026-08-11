// Item icons — drawn from the block's OWN texture, never from a second set of art.
//
// ── ★ WHY THIS IS NOT AN ART PIPELINE (2026-08-11, Alex asked whether we needed Meshy) ──────────
// An item icon in a voxel game is a cube wearing the faces the block already has. Generating art
// for it — by hand, by Meshy, by anything — creates a SECOND source of truth for what topsoil looks
// like, and the two drift the first time someone retunes the grit: the world changes and the icon
// keeps showing last month's dirt. Deriving the icon from `paintFor` means an item can never look
// like something the block is not, and a new block gets an icon the moment it gets a texture, with
// nobody remembering to draw one.
//
// It is also free and instant, which matters less than the correctness argument but is not nothing.
//
// Non-block items (a seed, a shard) have no faces to wear and DO need real art. They fall back to a
// flat chip here, and that fallback is deliberately plain so it reads as "not drawn yet" rather
// than as a finished thing nobody will revisit.

import { materialForItem } from '../../voxel/registry'
import { paintFor, TILE_MATERIALS, TOP, SIDE } from './tiles'

/** Icon edge in CSS pixels. Small enough to stay crisp, large enough for the cube to read. */
const ICON = 48
/** Texture resolution sampled for the faces. */
const TILE = 16


/**
 * ── ★ THE PROJECTION IS PURE, SO IT CAN BE LOOKED AT (2026-08-11) ───────────────────────────────
 * Rasterises the cube into a plain RGBA buffer with no canvas, no DOM and no GPU. That is what lets
 * `scripts/icon-sheet.mts` write the real icons to a PNG on a headless server — the projection I
 * ship and the projection anyone inspects are the SAME CODE, which a screenshot harness that
 * re-implemented the maths would not give you. Re-implementing it "just to preview" is how the
 * preview ends up correct and the game does not.
 *
 * Per-pixel INVERSE mapping rather than forward splatting: solving each output pixel back into the
 * tile leaves no seams or gaps, which forward-drawing 16 texels into a 48px parallelogram would.
 */
export function rasterIcon(top: Uint8Array, side: Uint8Array, size = ICON, tile = TILE): Uint8Array {
  const out = new Uint8Array(size * size * 4)
  // Half-width w, top-rhombus half-height w/2, body depth w — so the cube is exactly 2w square and
  // centring needs no measuring.
  const w = size * 0.34, h = w / 2, d = w
  const cx = size / 2, cy = size / 2
  const lx = cx - w, ly = cy - w + h              // left vertex: origin of the lid and the near-left
  const mx = cx, my = cy                          // bottom vertex of the lid: origin of the near-right

  // Each face: origin, edge U (tile +x), edge V (tile +y), source, and a light multiplier.
  const faces: [number, number, number, number, number, number, Uint8Array, number][] = [
    [lx, ly, w, -h, w, h, top, 1],       // lid, full light
    [lx, ly, w, h, 0, d, side, 0.78],    // near-left
    [mx, my, w, -h, 0, d, side, 0.56],   // near-right, deepest shade
  ]

  for (const [px, py, ux, uy, vx, vy, src, lit] of faces) {
    const det = ux * vy - vx * uy
    if (det === 0) continue
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Sample the pixel CENTRE — sampling the corner puts a half-pixel bias on every face and
        // shows up as a one-pixel sliver of background along the cube's silhouette.
        const qx = x + 0.5 - px, qy = y + 0.5 - py
        const s = (qx * vy - vx * qy) / det
        const t = (ux * qy - qx * uy) / det
        if (s < 0 || s >= 1 || t < 0 || t >= 1) continue
        const tx = Math.min(tile - 1, (s * tile) | 0)
        const ty = Math.min(tile - 1, (t * tile) | 0)
        const si = (ty * tile + tx) * 4
        const di = (y * size + x) * 4
        out[di + 0] = Math.min(255, src[si + 0] * lit)
        out[di + 1] = Math.min(255, src[si + 1] * lit)
        out[di + 2] = Math.min(255, src[si + 2] * lit)
        // ★ OPACITY COMES FROM THE FACE TEST, NEVER FROM THE SOURCE ALPHA. `tiles.put` defaults
        // alpha to 0 and the atlas uses that channel as a GLOW mask, not transparency — the world
        // shader reads RGB and ignores it. Copying it here drew only the parts of a block that
        // emit light: ore seams rendered as floating crystal specks and every ordinary block came
        // out invisible. A block face is opaque; being inside the cube is what makes a pixel real.
        out[di + 3] = 255
      }
    }
  }
  return out
}

/** Does a real painter own this material, or would it fall to the ore artist's default? */
export const hasTileArt = (material: number): boolean => TILE_MATERIALS.includes(material & 0xFF)

/**
 * The icon for a material as a raw RGBA buffer.
 *
 * ⚠ CALLERS MUST CHECK `hasTileArt` FIRST. `paintFor`'s switch defaults to the ORE painter, so a
 * material with no case of its own comes back as crystal in host rock — which is how the ground
 * cover icons rendered as magenta gemstones (caught by looking at `scripts/icon-sheet.mts`, not by
 * any test). It is the same hole this file's own header warns about between TILE_MATERIALS and the
 * painter switch, appearing one layer up.
 */
export function iconPixels(material: number, size = ICON, tile = TILE): Uint8Array {
  // ★ A SLAB WEARS ITS BASE MATERIAL'S FACES — `paintFor` is keyed on the full material and a
  // half-block id has no painter of its own, so without this mask every slab icon is the fallback.
  const base = material & 0xFF
  return rasterIcon(paintFor(base, TOP, tile), paintFor(base, SIDE, tile), size, tile)
}

const cache = new Map<string, string | null>()
/**
 * A data URL for this item's icon, or null when it has no block behind it.
 *
 * Memoised for the lifetime of the page: an icon is a pure function of the item, the hotbar and the
 * satchel both ask for the same handful, and re-rasterising per render is how a UI starts costing
 * frames. Returns null rather than throwing outside the browser (SSR, tests).
 */
export function itemIcon(itemId: string): string | null {
  const hit = cache.get(itemId)
  if (hit !== undefined) return hit
  if (typeof document === 'undefined') return null

  const mat = materialForItem(itemId)
  // No block, or a block with no painter of its own: fall back to the plain chip rather than
  // shipping a confidently WRONG picture. Ground cover lands here until it is drawn.
  if (mat === undefined || !hasTileArt(mat)) { cache.set(itemId, null); return null }

  // The browser's only job is to carry the pure buffer onto a canvas — no projection lives here.
  const c = document.createElement('canvas')
  c.width = ICON; c.height = ICON
  const ctx = c.getContext('2d')
  if (!ctx) { cache.set(itemId, null); return null }
  const px = iconPixels(mat)
  const img = new ImageData(ICON, ICON)
  img.data.set(px)
  ctx.putImageData(img, 0, 0)

  const url = c.toDataURL()
  cache.set(itemId, url)
  return url
}
