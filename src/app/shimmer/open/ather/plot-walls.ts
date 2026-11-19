// ── PLOT WALLS: build your own house on the home plot, Sims-style (BETA M37 slice 1; Alex 11-19, world d5a9e927) ─────
// Look signed on docs/looks/plot-walls.html; canon [RULED] athernyx e0ecc99 (a house goes up from crafted pieces, plain
// plan mode at the planning table, Co. iron = trim only).
//
// A wall is a run of 1 m PIECES on the plot's metre grid. Each piece is one grid EDGE between two corners:
//   'h,i,j' runs along x from (i, j) to (i+1, j)      'v,i,j' runs along z from (i, j) to (i, j+1)      (i, j = world metres)
// Pieces are as thick and tall as the prefab rooms' walls (rooms.ts WALL_T / WALL_H) and each one overruns its corners by
// half a thickness, so an L or a T closes with no gap and no seam (the mock's rule).
// Slice 1 = straight runs, drawn and erased in plan mode, solid to the walker, saved with the plot (Works.walls).
// Cost (interim, until slice 4's crafted wall pieces): 1 plank of the wall's wood per metre, all of it back on erase.
// PURE: no three, no react, no rooms.ts (rooms.ts imports THIS for its overlap checks).
import type { Box } from '../terrain-world'
import { countOf, take, give, type Inv } from '../shared/inventory'

export const WALL_T = 0.3, WALL_H = 3.2   // = rooms.ts (a drawn wall and a room's wall are one family); rooms.test asserts it
export const MAX_RUN = 24                  // the longest run one drag lays (metres)
export const MAX_WALLS = 600               // pieces on one plot
export const WALL_MATS = {
  goldwood: { name: 'Goldwood', item: 'goldwood_plank', color: '#d2a157' },
  shimmeroak: { name: 'Shimmeroak', item: 'shimmeroak_plank', color: '#a79bbd' },
  dawnwood: { name: 'Dawnwood', item: 'dawnwood_plank', color: '#c27a5b' },
} as const
export type WallMat = keyof typeof WALL_MATS
export const WALL_MAT_ORDER = Object.keys(WALL_MATS) as WallMat[]
export interface Wall { mat: WallMat }
export type Walls = Readonly<Record<string, Wall>>
export interface Corner { i: number; j: number }
export interface Rect { x0: number; x1: number; z0: number; z1: number }

/** the grid corner nearest a ground point */
export const snapCorner = (x: number, z: number): Corner => ({ i: Math.round(x), j: Math.round(z) })
/** a drag from `a` toward `b`, made straight (the longer axis wins) and no longer than MAX_RUN */
export function straighten(a: Corner, b: Corner): Corner {
  const di = b.i - a.i, dj = b.j - a.j, cap = (d: number) => Math.max(-MAX_RUN, Math.min(MAX_RUN, d))
  return Math.abs(di) >= Math.abs(dj) ? { i: a.i + cap(di), j: a.j } : { i: a.i, j: a.j + cap(dj) }
}
/** the pieces a straight run covers (empty when a == b) */
export function runKeys(a: Corner, b: Corner): string[] {
  const s = straighten(a, b), out: string[] = []
  if (s.j === a.j) for (let i = Math.min(a.i, s.i); i < Math.max(a.i, s.i); i++) out.push(`h,${i},${a.j}`)
  else for (let j = Math.min(a.j, s.j); j < Math.max(a.j, s.j); j++) out.push(`v,${a.i},${j}`)
  return out
}
export function parseKey(k: string): { o: 'h' | 'v'; i: number; j: number } | null {
  const m = /^([hv]),(-?\d+),(-?\d+)$/.exec(k); return m ? { o: m[1] as 'h' | 'v', i: +m[2], j: +m[3] } : null
}
/** a piece's footprint on the ground, overrun by half a thickness at each end (corners close) */
export function edgeRect(k: string): Rect {
  const e = parseKey(k)!, t = WALL_T / 2
  return e.o === 'h' ? { x0: e.i - t, x1: e.i + 1 + t, z0: e.j - t, z1: e.j + t } : { x0: e.i - t, x1: e.i + t, z0: e.j - t, z1: e.j + 1 + t }
}
/** the piece's two corners, for "is this on ground you hold" */
export function edgeEnds(k: string): [number, number][] {
  const e = parseKey(k)!; return e.o === 'h' ? [[e.i, e.j], [e.i + 1, e.j]] : [[e.i, e.j], [e.i, e.j + 1]]
}
/** solid boxes for the walker (y0 sits under the ground like a room's walls) */
export const wallBoxes = (walls: Walls, groundY: number): Box[] =>
  Object.keys(walls).map(k => { const r = edgeRect(k); return { ...r, y0: groundY - 0.5, y1: groundY + WALL_H } })
export const wallRects = (walls: Walls): Rect[] => Object.keys(walls).map(edgeRect)

export type Verdict = { ok: true; add: string[]; cost: number } | { ok: false; why: string }
/** What the plot asks of a new run. `blocked` = the rooms', chests' and furniture's rectangles + named keep-clear
 *  circles; `held(x, z)` = is that point on ground the keeper holds. Pieces already standing are skipped (free). */
export function canLay(walls: Walls, keys: string[], mat: WallMat, held: (x: number, z: number) => boolean,
  blocked: { rects: { r: Rect; why: string }[]; circles: readonly { x: number; z: number; r: number }[] }, inv?: Inv): Verdict {
  const add = keys.filter(k => !walls[k])
  if (!add.length) return { ok: false, why: keys.length ? 'That wall is already up.' : 'Drag to draw a wall.' }
  if (Object.keys(walls).length + add.length > MAX_WALLS) return { ok: false, why: `${MAX_WALLS} metres of wall already stand. Take some down first.` }
  for (const k of add) {
    if (!edgeEnds(k).every(([x, z]) => held(x, z))) return { ok: false, why: 'Build on ground you hold.' }
    const r = edgeRect(k)
    for (const c of blocked.circles) {
      const px = Math.max(r.x0, Math.min(c.x, r.x1)), pz = Math.max(r.z0, Math.min(c.z, r.z1))
      if (Math.hypot(px - c.x, pz - c.z) < c.r) return { ok: false, why: 'Leave room around the gate, Gregory and the table.' }
    }
    for (const b of blocked.rects) if (r.x0 < b.r.x1 && r.x1 > b.r.x0 && r.z0 < b.r.z1 && r.z1 > b.r.z0) return { ok: false, why: b.why }
  }
  const item = WALL_MATS[mat].item
  if (inv && countOf(inv, item) < add.length) return { ok: false, why: `${add.length} ${WALL_MATS[mat].name} Planks needed, ${countOf(inv, item)} in the bag.` }
  return { ok: true, add, cost: add.length }
}
/** lay the run: the new pieces stand, their planks leave the bag */
export function lay(walls: Walls, inv: Inv, add: string[], mat: WallMat): { walls: Walls; inv: Inv } | null {
  const t = take(inv, WALL_MATS[mat].item, add.length); if (!t) return null
  const next: Record<string, Wall> = { ...walls }; for (const k of add) next[k] = { mat }
  return { walls: next, inv: t }
}
/** take a run down: every standing piece under it comes down and its plank comes back (what the bag cannot hold stays up) */
export function raze(walls: Walls, inv: Inv, keys: string[]): { walls: Walls; inv: Inv; down: number; full: boolean } {
  const next: Record<string, Wall> = { ...walls }
  let bag = inv, down = 0, full = false
  for (const k of keys) {
    const w = next[k]; if (!w) continue
    const g = give(bag, WALL_MATS[w.mat].item, 1); if (g.left) { full = true; break }
    bag = g.inv; delete next[k]; down++
  }
  return { walls: next, inv: bag, down, full }
}
/** load-side: keep only well-formed pieces of a known wood */
export function adoptWalls(v: unknown): Walls {
  const out: Record<string, Wall> = {}
  if (v && typeof v === 'object') for (const [k, w] of Object.entries(v as Record<string, { mat?: string }>)) {
    if (parseKey(k) && w && typeof w.mat === 'string' && w.mat in WALL_MATS) out[k] = { mat: w.mat as WallMat }
  }
  return out
}
