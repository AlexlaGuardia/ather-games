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
import { paintFor, TOP, SIDE } from './tiles'

/** Icon edge in CSS pixels. Small enough to stay crisp, large enough for the cube to read. */
const ICON = 48
/** Texture resolution sampled for the faces. */
const TILE = 16

const cache = new Map<string, string | null>()

/** Multiply a painted layer's RGB, so the three faces read as lit from one side. */
function shaded(src: Uint8Array, k: number): ImageData {
  const out = new ImageData(TILE, TILE)
  for (let i = 0; i < TILE * TILE; i++) {
    out.data[i * 4 + 0] = Math.min(255, src[i * 4 + 0] * k)
    out.data[i * 4 + 1] = Math.min(255, src[i * 4 + 1] * k)
    out.data[i * 4 + 2] = Math.min(255, src[i * 4 + 2] * k)
    out.data[i * 4 + 3] = src[i * 4 + 3]
  }
  return out
}

/** Draw `img` onto the parallelogram at `p0` spanned by edge vectors `u` and `v`. */
function face(
  ctx: CanvasRenderingContext2D, img: CanvasImageSource,
  px: number, py: number, ux: number, uy: number, vx: number, vy: number,
): void {
  ctx.save()
  // The unit square of the tile maps onto (u, v) — this IS the projection, no trig needed.
  ctx.setTransform(ux / TILE, uy / TILE, vx / TILE, vy / TILE, px, py)
  ctx.drawImage(img, 0, 0)
  ctx.restore()
}

function toCanvas(d: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = TILE; c.height = TILE
  c.getContext('2d')!.putImageData(d, 0, 0)
  return c
}

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
  if (mat === undefined) { cache.set(itemId, null); return null }

  const c = document.createElement('canvas')
  c.width = ICON; c.height = ICON
  const ctx = c.getContext('2d')
  if (!ctx) { cache.set(itemId, null); return null }
  ctx.imageSmoothingEnabled = false      // these are pixels, not photographs

  // ★ A SLAB WEARS ITS BASE MATERIAL'S FACES — `paintFor` is keyed on the full material, and a
  // half-block id has no painter of its own. `materialForItem` hands back the slab material, so
  // masking here is what stops every slab icon from being the magenta fallback.
  const base = mat & 0xFF
  const top = toCanvas(shaded(paintFor(base, TOP, TILE), 1))
  const left = toCanvas(shaded(paintFor(base, SIDE, TILE), 0.78))
  const right = toCanvas(shaded(paintFor(base, SIDE, TILE), 0.56))

  // An isometric cube: half-width w, top-rhombus half-height w/2, and a body of depth w — so the
  // whole thing is exactly 2w square and centring it needs no measuring.
  const w = ICON * 0.34, h = w / 2, d = w
  const cx = ICON / 2, cy = ICON / 2
  const leftV = { x: cx - w, y: cy - w + h }
  const rightV = { x: cx + w, y: cy - w + h }
  const midV = { x: cx, y: cy }                       // bottom vertex of the top rhombus

  face(ctx, top, leftV.x, leftV.y, w, -h, w, h)       // lid
  face(ctx, left, leftV.x, leftV.y, w, h, 0, d)       // near-left wall
  face(ctx, right, midV.x, midV.y, w, -h, 0, d)       // near-right wall
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  const url = c.toDataURL()
  cache.set(itemId, url)
  return url
}
