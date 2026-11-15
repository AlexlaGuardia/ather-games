// GARDEN CLUSTERS, IN THE OPEN WORLD — the geometry (Alex 11-15: "it should work the same: if no friends have joined
// the clouds hide the expansion, but once a friend joins they are linked together and the communal space opens in the
// middle as a bridge between plots. Pretty much the same idea"). [OPEN] in CANON_GAPS (reverses ather-rework §3):
// built against Alex's word with NEUTRAL words ("the shared ground", "a bridge"); the retired names stay retired
// until Magii rules.
//
// THE FRAME. Up to four plots stand in quarters round a shared middle. Each keeper sees it from their own plot, which
// stays at the origin, so everything position-keyed they own (squares, the gate, Gregory) never moves:
//   quarter vector q (north = −z): ne (+1,−1) · nw (−1,−1) · sw (−1,+1) · se (+1,+1)
//   the middle, in MY coords:  −D·q(mine)        a mate's plot centre:  middle + D·q(theirs)
// ALONE (or the only one in the frame): nothing but your island; the clouds hide the rest.
// LINKED (two or more): the shared ground opens in the middle, a BRIDGE runs from each plot's rim to it, and on each
// plot a LANE parts the mist from the corner of the starting ground out to the rim (the mist walls are cut only where
// the lane crosses them). A mate's plot is read-only (Alex 09-23); this file only says where things are and what you
// can stand on.
//
// ★ PURE. The server record (src/lib/accounts/clusters.ts, consent-only joining, the four landlord guards) is reused
// as is; a member's quarter comes from there.

import type { Box } from '../terrain-world'
import { PLOT_R, insideIsland, plotHeightAt, mistWalls, GRID_HALF, SQ, GRID as GRID_N } from './plot'

export type Quarter = 'ne' | 'nw' | 'sw' | 'se'
export const QV: Record<Quarter, { x: number; z: number }> = { ne: { x: 1, z: -1 }, nw: { x: -1, z: -1 }, sw: { x: -1, z: 1 }, se: { x: 1, z: 1 } }

/** Plot-centre to middle offset along each axis (so plots stand 2D apart; a plot is ~2·PLOT_R across). */
export const D = 150
export const MIDDLE_R = 40          // the shared ground's radius
export const BRIDGE_W = 4, LANE_W = 4
export const MIDDLE_Y = 2.0         // the shared ground stands at the plots' pad height

export interface Mate { quarter: Quarter; name: string; owned: string[] }
export interface Seg { ax: number; az: number; ay: number; bx: number; bz: number; by: number; w: number }
export interface Frame {
  mine: Quarter | null
  linked: boolean
  middle: { x: number; z: number; r: number } | null
  mates: (Mate & { x: number; z: number })[]
  /** my lane (on my plot, through the mist) */
  lane: Seg | null
  /** bridges, rim to middle: mine and each mate's */
  bridges: Seg[]
}

/** Where the island's walkable rim meets the diagonal toward q, measured from a plot's centre. */
function rimAlong(q: { x: number; z: number }): number {
  const ux = q.x / Math.SQRT2, uz = q.z / Math.SQRT2
  let lo = 0, hi = PLOT_R * 1.5
  // the last point with WALKABLE ground (plotHeightAt is finite only on whole land cells, a little inside the outline)
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (Number.isFinite(plotHeightAt(ux * m, uz * m))) lo = m; else hi = m }
  return lo
}

export function clusterFrame(mine: Quarter | null, mates: Mate[]): Frame {
  const others = mates.filter(m => m.quarter !== mine)
  if (!mine || others.length === 0) return { mine, linked: false, middle: null, mates: [], lane: null, bridges: [] }
  const q = QV[mine], mx = -D * q.x, mz = -D * q.z
  const toMid = { x: -q.x, z: -q.z }                     // from my plot, the middle lies along −q
  const u = { x: toMid.x / Math.SQRT2, z: toMid.z / Math.SQRT2 }
  const rim = rimAlong(toMid) - 1.5
  const corner = Math.hypot(GRID_HALF - 2 * SQ, GRID_HALF - 2 * SQ) - 2   // just inside the starting 3×3's corner
  const midEdge = (cx: number, cz: number) => { const dx = mx - cx, dz = mz - cz, d = Math.hypot(dx, dz); return { x: mx - (dx / d) * (MIDDLE_R - 2), z: mz - (dz / d) * (MIDDLE_R - 2) } }
  const bridge = (cx: number, cz: number, qq: { x: number; z: number }): Seg => {
    const uu = { x: -qq.x / Math.SQRT2, z: -qq.z / Math.SQRT2 }, r = rimAlong({ x: -qq.x, z: -qq.z }) - 1.5
    const a = { x: cx + uu.x * r, z: cz + uu.z * r }, e = midEdge(cx, cz)
    return { ax: a.x, az: a.z, ay: plotHeightAt(uu.x * r, uu.z * r), bx: e.x, bz: e.z, by: MIDDLE_Y, w: BRIDGE_W }
  }
  const placed = others.map(m => ({ ...m, x: mx + D * QV[m.quarter].x, z: mz + D * QV[m.quarter].z }))
  return {
    mine, linked: true,
    middle: { x: mx, z: mz, r: MIDDLE_R },
    mates: placed,
    lane: { ax: u.x * corner, az: u.z * corner, ay: plotHeightAt(u.x * corner, u.z * corner), bx: u.x * rim, bz: u.z * rim, by: plotHeightAt(u.x * rim, u.z * rim), w: LANE_W },
    bridges: [bridge(0, 0, q), ...placed.map(m => bridge(m.x, m.z, QV[m.quarter]))],
  }
}

/** Distance from (x,z) to a segment, and how far along it (0..1). */
function along(s: Seg, x: number, z: number) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, L = dx * dx + dz * dz
  const t = L > 0 ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L)) : 0
  return { d: Math.hypot(s.ax + dx * t - x, s.az + dz * t - z), t }
}
export const onSeg = (s: Seg, x: number, z: number) => along(s, x, z).d <= s.w / 2

/** The ground of everything the cluster adds, or −Infinity: a mate's island, the shared ground, a bridge. (My own
 *  island is plot.ts's.) A mate's island is the same shape as everyone's, so plotHeightAt in their frame. */
export function clusterGround(f: Frame, x: number, z: number): number {
  if (!f.linked) return -Infinity
  let best = -Infinity
  for (const b of f.bridges) { const a = along(b, x, z); if (a.d <= b.w / 2) best = Math.max(best, b.ay + (b.by - b.ay) * a.t) }
  if (f.middle && Math.hypot(x - f.middle.x, z - f.middle.z) < f.middle.r) best = Math.max(best, MIDDLE_Y)
  for (const m of f.mates) { const h = plotHeightAt(x - m.x, z - m.z); if (h > best) best = h }
  return best
}

/** My plot's mist walls with the lane cut through them (walls are cut to 1 m pieces where the lane crosses). */
export function wallsWithLane(owned: ReadonlySet<string>, f: Frame): Box[] {
  const walls = mistWalls(owned)
  if (!f.lane) return walls
  const lane = f.lane, out: Box[] = []
  for (const w of walls) {
    const cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2
    if (along(lane, cx, cz).d > SQ) { out.push(w); continue }            // nowhere near: keep whole
    const alongX = w.x1 - w.x0 > w.z1 - w.z0
    const len = alongX ? w.x1 - w.x0 : w.z1 - w.z0
    for (let k = 0; k < len; k++) {
      const p = alongX ? { ...w, x0: w.x0 + k, x1: w.x0 + k + 1 } : { ...w, z0: w.z0 + k, z1: w.z0 + k + 1 }
      if (!onSeg(lane, (p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2)) out.push(p)
    }
  }
  // the lane's own sides, wherever it crosses ground you do not hold: the mist parts for the lane only, so you cannot
  // step off it into the unbought squares (mist walls alone only fence the ground you HOLD)
  const dx = lane.bx - lane.ax, dz = lane.bz - lane.az, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux
  for (let t = 0; t <= L; t += 0.7) for (const side of [-1, 1]) {
    const x = lane.ax + ux * t + nx * side * (lane.w / 2 + 0.35), z = lane.az + uz * t + nz * side * (lane.w / 2 + 0.35)
    const i = Math.floor((x + GRID_HALF) / SQ), j = Math.floor((z + GRID_HALF) / SQ)
    const inGrid = i >= 0 && j >= 0 && i < GRID_N && j < GRID_N
    if (inGrid && owned.has(`${i},${j}`)) continue
    if (!insideIsland(x, z)) continue
    out.push({ x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4, y0: -20, y1: 40 })
  }
  return out
}
