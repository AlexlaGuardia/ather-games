// ── BETA M153 s1c-2: THE GROUND UNDER A MOVED HOUSE ──
// A house the owner moved in Place mode stands LEVEL on the highest ground under its pad, on a plinth that reaches down to the lowest, so
// no hill pokes through its floor. A step (half a metre) onto it is walked; a higher side is a wall; past PAD_FALL Publish refuses. A house
// nobody moved is untouched by any of this (GLADE.y, as built). PURE, a leaf (moonwell-glade and the walker both sit on it).
import { placeOf, yawOfQ, type Place, type Prop } from '../../world/builder-props'
import type { Box } from '../terrain-world'

export type Ground = (x: number, z: number) => number
/** a turned rectangle: w across its own x, d along its own z, `yaw` = three's rotation-y */
export interface Rect { x: number; z: number; yaw: number; w: number; d: number }
/** a lot's pad, and what Greg's home and Yarrow's crate take up (moonwell-glade LOT_W / LOT_D, glade-home HOME_R, yarrow-teach; the test
 *  holds them equal) */
export const PLACE_SIZE: Readonly<Record<Place, { w: number; d: number }>> = {
  home: { w: 3.8, d: 3.8 }, jars: { w: 0.9, d: 0.6 },
  fennel: { w: 13.5, d: 8.5 }, hazel: { w: 13.5, d: 8.5 }, sax: { w: 13.5, d: 8.5 }, yarrow: { w: 13.5, d: 8.5 }, mallow: { w: 13.5, d: 8.5 },
}
/** how far the ground may fall under a house (m) */
export const PAD_FALL = 1.5
const GRID = 0.5
export const toRect = (r: Rect, x: number, z: number) => { const c = Math.cos(r.yaw), s = Math.sin(r.yaw), dx = x - r.x, dz = z - r.z; return { u: dx * c - dz * s, v: dx * s + dz * c } }
export const fromRect = (r: Rect, u: number, v: number) => { const c = Math.cos(r.yaw), s = Math.sin(r.yaw); return { x: r.x + u * c + v * s, z: r.z - u * s + v * c } }
export const inRect = (r: Rect, x: number, z: number, grow = 0) => { const p = toRect(r, x, z); return Math.abs(p.u) <= r.w / 2 + grow && Math.abs(p.v) <= r.d / 2 + grow }
export function rectPoints(r: Rect, grid = GRID): { x: number; z: number }[] {
  const n = Math.max(1, Math.ceil(r.w / grid)), m = Math.max(1, Math.ceil(r.d / grid)), out: { x: number; z: number }[] = []
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) out.push(fromRect(r, (i / n - 0.5) * r.w, (j / m - 0.5) * r.d))
  return out
}
/** do two turned rectangles overlap (separating axes; touching is not overlapping) */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  const cs = (r: Rect) => [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([u, v]) => fromRect(r, u * r.w / 2, v * r.d / 2)), A = cs(a), B = cs(b)
  for (const r of [a, b]) for (const [ax, az] of [[Math.cos(r.yaw), -Math.sin(r.yaw)], [Math.sin(r.yaw), Math.cos(r.yaw)]]) {
    const pa = A.map(p => p.x * ax + p.z * az), pb = B.map(p => p.x * ax + p.z * az)
    if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false
  }
  return true
}
/** the highest and lowest land under it; NaN over nothing but void */
export function padLevel(r: Rect, ground: Ground): { top: number; low: number } {
  let top = -Infinity, low = Infinity
  for (const p of rectPoints(r)) { const g = ground(p.x, p.z); if (!Number.isFinite(g)) continue; if (g > top) top = g; if (g < low) low = g }
  return top === -Infinity ? { top: NaN, low: NaN } : { top, low }
}
/** the plinth as the walker's boxes: a strip for each half metre of z (none on level ground) */
export function plinthBoxes(r: Rect, top: number, low: number): Box[] {
  if (!(top - low > 0.02)) return []
  const c = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([u, v]) => fromRect(r, u * r.w / 2, v * r.d / 2)), z0 = Math.min(...c.map(p => p.z)), z1 = Math.max(...c.map(p => p.z)), n = Math.ceil((z1 - z0) / GRID), out: Box[] = []
  for (let k = 0; k < n; k++) {
    const a = z0 + (z1 - z0) * k / n, b = z0 + (z1 - z0) * (k + 1) / n, z = (a + b) / 2, xs: number[] = []
    for (let e = 0; e < 4; e++) { const p = c[e], q = c[(e + 1) % 4]; if ((p.z <= z) !== (q.z <= z)) xs.push(p.x + (q.x - p.x) * (z - p.z) / (q.z - p.z)) }
    if (xs.length === 2) out.push({ x0: Math.min(...xs), x1: Math.max(...xs), z0: a, z1: b, y0: low - 0.5, y1: top })
  }
  return out
}
/** the pads a list of pieces moved */
export function movedPads(props: readonly Prop[] | undefined): (Rect & { place: Place })[] {
  const out: (Rect & { place: Place })[] = []
  for (const p of props ?? []) { const k = placeOf(p.k); if (k) out.push({ place: k, x: p.x, z: p.z, yaw: yawOfQ(p.q), ...PLACE_SIZE[k] }) }
  return out
}
/** What people and pieces stand on: the land, or a moved lot's pad. No lot moved = the land itself (the same function). The WALKER asks
 *  the land and bumps the plinth's boxes instead (dynamic-solids). */
export function padGround(props: readonly Prop[] | undefined, ground: Ground): Ground {
  const pads = movedPads(props).filter(p => p.place !== 'home' && p.place !== 'jars').map(r => ({ r, top: NaN, asked: false }))
  if (!pads.length) return ground
  return (x, z) => {
    let g = ground(x, z)
    for (const p of pads) if (inRect(p.r, x, z)) { if (!p.asked) { p.asked = true; p.top = padLevel(p.r, ground).top }; if (Number.isFinite(g) && p.top > g) g = p.top }
    return g
  }
}
