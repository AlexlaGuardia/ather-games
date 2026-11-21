// ── PLOT COLUMNS (BETA M54; Alex 11-20: "lets add in columes.. twice as thick as the walls") ─────────────────────────────
// A column stands on a grid CORNER (the same corners wall pieces run between), square, twice a wall's thickness, a storey tall.
// Any wall material; stucco takes paint like a stucco wall. Stored per level beside the walls: level 0 in Works.cols, upper
// levels in Level.cols (plot-floors.ts), keyed 'i,j'. A draft column is on the list until Build, like a draft wall.
// Cost: 2 m of its wall (2 x AMOUNTS.wallPerM). Support up a floor: a column below at that corner, a wall ending there, or a
// built room touching the corner. PURE: no three, no react.
import type { Box } from '../terrain-world'
import { WALL_T, WALL_H, WALL_MATS, isColour, paintable, edgeEnds, findRooms, type WallMat, type Walls } from './plot-walls'

export const COL_T = WALL_T * 2   // 0.6 m: "twice as thick as the walls"
export interface Col { mat: WallMat; tint?: string; draft?: true }
export type Cols = Readonly<Record<string, Col>>
export const colKey = (i: number, j: number) => `${i},${j}`
export const parseCol = (k: string): { i: number; j: number } | null => { const m = /^(-?\d+),(-?\d+)$/.exec(k); return m ? { i: +m[1], j: +m[2] } : null }
export const colColour = (c: Col) => (c.mat === 'stucco' && c.tint ? c.tint : WALL_MATS[c.mat].color)

/** load-side: well-formed columns only */
export function adoptCols(v: unknown): Cols {
  const out: Record<string, Col> = {}
  if (v && typeof v === 'object') for (const [k, c] of Object.entries(v as Record<string, unknown>)) {
    if (!parseCol(k) || !c || typeof c !== 'object') continue
    const x = c as { mat?: unknown; tint?: unknown; draft?: unknown }
    if (typeof x.mat !== 'string' || !(x.mat in WALL_MATS)) continue
    out[k] = { mat: x.mat as WallMat, ...(x.mat === 'stucco' && isColour(x.tint) ? { tint: x.tint.toLowerCase() } : {}), ...(x.draft === true ? { draft: true as const } : {}) }
  }
  return out
}

/** the walker's solids: one box per BUILT column, from `base` (the level's floor) up a storey */
export function colBoxes(cols: Cols | undefined, base: number, lift?: (i: number, j: number) => number): Box[] {
  const h = COL_T / 2, out: Box[] = []
  for (const [k, c] of Object.entries(cols ?? {})) { if (c.draft) continue; const p = parseCol(k)!, b = base + (lift?.(p.i, p.j) ?? 0); out.push({ x0: p.i - h, x1: p.i + h, z0: p.j - h, z1: p.j + h, y0: b - 0.5, y1: b + WALL_H }) }
  return out
}

export type ColChange = { ok: true; cols: Cols; said: string; refund?: { id: string; n: number } } | { ok: false; why: string }
/** the Column tool's tap at corner (i, j): an empty corner gets a DRAFT column of `mat`; a draft is taken away; a built one
 *  comes down with its cost back (`refund`, the caller gives it to the bag). `held`: is the corner on ground you hold. */
export function toggleCol(cols: Cols | undefined, i: number, j: number, mat: WallMat, held: boolean, perCol: number): ColChange {
  const k = colKey(i, j), c = cols?.[k], next: Record<string, Col> = { ...(cols ?? {}) }
  if (c) { delete next[k]; return { ok: true, cols: next, said: c.draft ? 'Column taken off the plan.' : 'Column down.', ...(c.draft ? {} : { refund: { id: WALL_MATS[c.mat].item, n: Math.ceil(perCol - 1e-9) } }) } }
  if (!held) return { ok: false, why: 'Build on ground you hold.' }
  next[k] = { mat, draft: true }
  return { ok: true, cols: next, said: 'A column, on the plan.' }
}

/** does a column at `k` on the level above stand on the level below: a column there, a wall ending at that corner, or a
 *  built room touching it (its slab) */
export function colStandsOn(below: { walls: Walls; cols?: Cols }, k: string): boolean {
  if (below.cols?.[k]) return true
  const p = parseCol(k); if (!p) return false
  for (const w of Object.keys(below.walls)) if (edgeEnds(w).some(([x, z]) => x === p.i && z === p.j)) return true
  const cells = new Set(findRooms(below.walls).flatMap(r => r.cells.map(([a, b]) => `${a},${b}`)))
  return [[p.i - 1, p.j - 1], [p.i, p.j - 1], [p.i - 1, p.j], [p.i, p.j]].some(([a, b]) => cells.has(`${a},${b}`))
}

/** what the draft columns cost: `perCol` of their wall's item each (lines summed per item, not yet rounded) */
export function colNeeds(cols: Cols | undefined, perCol: number): { id: string; n: number }[] {
  const m = new Map<string, number>()
  for (const c of Object.values(cols ?? {})) if (c.draft) { const id = WALL_MATS[c.mat].item; m.set(id, (m.get(id) ?? 0) + perCol) }
  return [...m].map(([id, n]) => ({ id, n }))
}
export const draftCols = (cols: Cols | undefined) => Object.values(cols ?? {}).filter(c => c.draft).length
/** Build: every draft column stands */
export function standCols(cols: Cols | undefined): Cols {
  const out: Record<string, Col> = {}
  for (const [k, c] of Object.entries(cols ?? {})) { const { draft: _d, ...rest } = c; void _d; out[k] = rest }
  return out
}
/** paint a stucco column (free); wood and brick keep their colour */
export function paintColumn(cols: Cols | undefined, k: string, colour: string): { cols: Cols } | { why: string } {
  const c = cols?.[k]; if (!c) return { why: 'Tap a column to paint it.' }
  if (!paintable(c.mat)) return { why: `${WALL_MATS[c.mat].name} keeps its own colour. Only stucco takes paint.` }
  if (!isColour(colour)) return { why: 'That is not a colour.' }
  if (colColour(c) === colour.toLowerCase()) return { why: 'Already that colour.' }
  return { cols: { ...(cols ?? {}), [k]: { ...c, tint: colour.toLowerCase() } } }
}
/** the column whose corner (x, z) is within reach of (for taps), or null */
export function colAt(cols: Cols | undefined, x: number, z: number, r = 0.55): string | null {
  const i = Math.round(x), j = Math.round(z), k = colKey(i, j)
  return cols?.[k] && Math.hypot(x - i, z - j) <= r ? k : null
}
