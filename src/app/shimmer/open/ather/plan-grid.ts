// BETA M142: the plan-mode grid. A line every metre (the step walls, columns, stairs and floors snap to) on the ground the keeper
// OWNS, stronger on garden-square edges; on the plan's level, riding the raised floors (foundations) and open floors. PURE:
// plan-grid-view.tsx draws it as one set of line segments and rebuilds only when gridSig changes.
import { GRID, SQ, GRID_HALF, GROUND_Y, sqId } from './plot'
import { levelBase, levelOf, type Stacked } from './plot-floors'
import { liftOf, type Founded } from './plot-found'
import { DECK_T } from './plot-decks'

/** a hand over what it lies on: over the drawn floors (0.03 and a prefab's 0.08), under the knee */
export const GRID_UP = 0.1
export const GRID_FAINT = 0.2, GRID_STRONG = 0.55   // alphas
type Works = Founded & Stacked
export const isSquareEdge = (v: number) => (((v + GRID_HALF) % SQ) + SQ) % SQ === 0

/** cells ('i,j') whose floor on level `lv` is not the level's plain one, with how far above it they are */
export function raisedCells(w: Works, lv: number): Map<string, number> {
  const L = liftOf(w), out = new Map<string, number>()
  const put = (k: string, h: number) => { if (h > 0) out.set(k, Math.max(out.get(k) ?? 0, h)) }
  for (const h of L.houses) for (const c of h.cells) { const [i, j] = c.split(',').map(Number); put(c, L.cell(i, j)) }
  for (const k of Object.keys(levelOf(w, lv).decks ?? {})) { const [i, j] = k.split(',').map(Number); put(k, lv === 0 ? (L.floor(i, j) || DECK_T) : L.cell(i, j)) }
  if (lv === 0) for (const r of w.rooms ?? []) for (let i = Math.floor(r.x) - 12; i < r.x + 12; i++) for (let j = Math.floor(r.z) - 12; j < r.z + 12; j++) put(`${i},${j}`, L.prefabAt(i + 0.5, j + 0.5) ?? 0)
  return out
}
/** everything the drawn grid depends on, as one string */
export const gridSig = (owned: ReadonlySet<string>, lv: number, raised: ReadonlyMap<string, number>) => `${lv}|${[...owned].sort().join(' ')}|${[...raised].map(([k, h]) => `${k}=${h}`).sort().join(' ')}`

export interface GridLines { pos: number[]; alpha: number[]; segments: number }
/** the lines: neighbouring metres at the same height are one segment, so flat ground costs two points a line */
export function gridLines(owned: ReadonlySet<string>, lv: number, raised: ReadonlyMap<string, number>): GridLines {
  const own = new Set<number>()
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) if (owned.has(sqId(i, j))) own.add(j * GRID + i)
  const held = (i: number, j: number) => { const a = Math.floor((i + GRID_HALF) / SQ), b = Math.floor((j + GRID_HALF) / SQ); return a >= 0 && b >= 0 && a < GRID && b < GRID && own.has(b * GRID + a) }
  const base = GROUND_Y + levelBase(lv) + GRID_UP, pos: number[] = [], alpha: number[] = []
  // an edge with a cell on each side: the height it lies at (a house's rim rides the house), or null off your ground
  const at = (p: [number, number], q: [number, number]) => { const a = held(...p), b = held(...q); return a || b ? Math.max(a ? raised.get(`${p[0]},${p[1]}`) ?? 0 : 0, b ? raised.get(`${q[0]},${q[1]}`) ?? 0 : 0) : null }
  for (const dir of [0, 1] as const) for (let c = -GRID_HALF; c <= GRID_HALF; c++) {
    let from = 0, h: number | null = null
    for (let t = -GRID_HALF; t <= GRID_HALF; t++) {
      const n = t === GRID_HALF ? null : dir ? at([c - 1, t], [c, t]) : at([t, c - 1], [t, c])
      if (n === h) continue
      if (h !== null) { const y = base + h, s = isSquareEdge(c) ? GRID_STRONG : GRID_FAINT; pos.push(...(dir ? [c, y, from, c, y, t] : [from, y, c, t, y, c])); alpha.push(s, s) }
      h = n; from = t
    }
  }
  return { pos, alpha, segments: alpha.length / 2 }
}
