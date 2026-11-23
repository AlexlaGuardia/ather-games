// BETA M100: the M map pans + zooms (Alex 11-23: "grab it to move it or scroll to magnify").
// Pure view math, shared by both worlds' maps (open/ather/panels.tsx FoldMap, open/continent/map.tsx).
//
// A view is a scale `k` and a translate (`x`, `y`) in the VIEWPORT's CSS px: content point p shows at p * k + (x, y).
// The content fills the viewport at k = 1, so clamping keeps the picture covering the box: never a gap at an edge.
// Run: npx tsx src/app/shimmer/ui/pan-zoom.test.ts

export interface View { k: number; x: number; y: number }
export const HOME: View = { k: 1, x: 0, y: 0 }
export const MAX_K = 6
/** Pointer travel (CSS px) before a press becomes a drag: under it a press is still a click on a stop. */
export const DRAG_PX = 5

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Keep the picture covering a w x h box: k in [1, maxK], the translate inside [w - w k, 0]. */
export function clampView(v: View, w: number, h: number, maxK = MAX_K): View {
  const k = clampN(v.k, 1, maxK)
  return { k, x: clampN(v.x, w - w * k, 0), y: clampN(v.y, h - h * k, 0) }
}

/** Zoom by `factor` about the viewport point (px, py): the content under that point stays under it (until a clamp). */
export function zoomAt(v: View, factor: number, px: number, py: number, w: number, h: number, maxK = MAX_K): View {
  const k = clampN(v.k * factor, 1, maxK), r = k / v.k
  return clampView({ k, x: px - (px - v.x) * r, y: py - (py - v.y) * r }, w, h, maxK)
}

export function panBy(v: View, dx: number, dy: number, w: number, h: number, maxK = MAX_K): View {
  return clampView({ k: v.k, x: v.x + dx, y: v.y + dy }, w, h, maxK)
}

/** Wheel delta to a zoom factor: one notch (~100) is about x1.16, a trackpad's small deltas zoom smoothly. */
export const wheelFactor = (deltaY: number, deltaMode = 0) => Math.exp(-(deltaMode === 1 ? deltaY * 33 : deltaY) * 0.0015)

/** Content point -> viewport point (what a marker drawn at a fixed screen size is placed with). */
export const toView = (v: View, cx: number, cy: number): [number, number] => [cx * v.k + v.x, cy * v.k + v.y]
/** Viewport point -> content point (what a tap is tested in). */
export const fromView = (v: View, sx: number, sy: number): [number, number] => [(sx - v.x) / v.k, (sy - v.y) / v.k]

export const isHome = (v: View) => v.k === 1 && v.x === 0 && v.y === 0
