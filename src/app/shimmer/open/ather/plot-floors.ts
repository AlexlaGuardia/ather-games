// ── PLOT FLOORS: the house as stacked LEVELS (BETA M47 slice 1; Alex 11-20 "explore multiple floors") ───────────────────
// Level 0 is today's house, stored exactly where it always was (Works.walls / floors / paid), so an old save IS one level and
// loads unchanged. Levels 1.. live in Works.upper[k-1] as { walls, floors, paid }: each its own walls, doors, windows, rooms.
// A level's SLAB is the floor you stand on: it covers the level's own built rooms (SLAB_T thick, its top at levelBase(k)).
// Support rule (nothing floats): a wall on level k must stand on a wall of level k-1 or on a cell of one of its rooms.
// The roof sits on the TOP level only (the highest level with any wall). PURE: no three, no react.
import type { Box } from '../terrain-world'
import { WALL_H, DOOR_H, edgeRect, findRooms, parseKey, adoptWalls, adoptFloors, adoptPaid, type Walls, type Floors, type Paid, type Rect } from './plot-walls'
import { adoptCols, colBoxes, colStandsOn, type Cols } from './plot-cols'

export const SLAB_T = 0.2, STOREY = WALL_H + SLAB_T, MAX_LEVELS = 3
/** the floor surface of level k above the plot's ground (level 0 = 0) */
export const levelBase = (k: number) => k * STOREY
export interface Level { walls: Walls; floors?: Floors; paid?: Paid; /** M54: columns on corners (plot-cols.ts) */ cols?: Cols }
/** the part of Works this module reads and writes */
export interface Stacked { walls?: Walls; floors?: Floors; paid?: Paid; cols?: Cols; upper?: Level[] }

export const levelCount = (w: Stacked) => 1 + (w.upper?.length ?? 0)
export const levelOf = (w: Stacked, k: number): Level => k === 0 ? { walls: w.walls ?? {}, floors: w.floors, paid: w.paid, cols: w.cols } : (w.upper?.[k - 1] ?? { walls: {} })
/** a level with nothing on it (no wall, no column) is no level */
const emptyLevel = (l: Level) => !Object.keys(l.walls).length && !Object.keys(l.cols ?? {}).length
export const levelsOf = (w: Stacked): Level[] => Array.from({ length: levelCount(w) }, (_, k) => levelOf(w, k))
/** w with level k replaced (growing the stack when k is the next one up) */
export function withLevel<T extends Stacked>(w: T, k: number, lv: Level): T {
  if (k === 0) return { ...w, walls: lv.walls, floors: lv.floors, paid: lv.paid, cols: lv.cols }
  const up = [...(w.upper ?? [])]; while (up.length < k) up.push({ walls: {} }); up[k - 1] = lv
  while (up.length && emptyLevel(up[up.length - 1])) up.pop()   // an emptied top level is no level
  return { ...w, upper: up }
}
/** load-side: well-formed upper levels (a save from before floors has none) */
export function adoptUpper(v: unknown): Level[] {
  if (!Array.isArray(v)) return []
  const out: Level[] = []
  for (const l of v.slice(0, MAX_LEVELS - 1)) {
    const walls = adoptWalls((l as { walls?: unknown })?.walls)
    const cols = adoptCols((l as { cols?: unknown })?.cols)
    out.push({ walls, floors: adoptFloors((l as { floors?: unknown })?.floors), paid: adoptPaid((l as { paid?: unknown })?.paid, walls), ...(Object.keys(cols).length ? { cols } : {}) })
  }
  while (out.length && emptyLevel(out[out.length - 1])) out.pop()
  return out
}

/** the two cells an edge borders: 'h,i,j' = (i, j-1) and (i, j); 'v,i,j' = (i-1, j) and (i, j) */
const edgeCells = (k: string): [number, number][] => { const e = parseKey(k)!; return e.o === 'h' ? [[e.i, e.j - 1], [e.i, e.j]] : [[e.i - 1, e.j], [e.i, e.j]] }
/** does a wall on the level above stand on `below`: a wall on that very edge, or a cell of one of its rooms on either side */
export function standsOn(below: Walls, key: string): boolean {
  if (below[key]) return true
  const rooms = findRooms(below); if (!rooms.length) return false
  const cells = new Set(rooms.flatMap(r => r.cells.map(([i, j]) => `${i},${j}`)))
  return edgeCells(key).some(([i, j]) => cells.has(`${i},${j}`))
}
export type Support = { ok: true } | { ok: false; why: string }
/** may these new pieces go on a level whose floor below is `below`? (refuses the first one that would float) */
export function canStack(below: Walls | undefined, keys: string[]): Support {
  if (!below || !Object.keys(below).length) return { ok: false, why: 'A floor needs walls or rooms under it. Build the floor below first.' }
  const bad = keys.find(k => !standsOn(below, k))
  return bad ? { ok: false, why: 'A wall up here must stand on a wall or a room of the floor below.' } : { ok: true }
}
/** every upper piece that floats over the stack as it stands ('level:key'); empty = sound */
export function floating(w: Stacked): string[] {
  const out: string[] = [], lv = levelsOf(w)
  for (let k = 1; k < lv.length; k++) for (const key of Object.keys(lv[k].walls)) if (!standsOn(lv[k - 1].walls, key)) out.push(`${k}:${key}`)
  for (let k = 1; k < lv.length; k++) for (const key of Object.keys(lv[k].cols ?? {})) if (!colStandsOn(lv[k - 1], key)) out.push(`${k}:c${key}`)   // M54
  return out
}
/** the highest level that has any wall: the roof goes there (and nowhere lower) */
export const topLevel = (w: Stacked): number => { const lv = levelsOf(w); for (let k = lv.length - 1; k > 0; k--) if (Object.keys(lv[k].walls).length) return k; return 0 }   // columns alone carry no roof

/** the cells of a level's BUILT rooms (rooms in `paid`): its slab, the floor above the room below */
export function slabCells(lv: Level): [number, number][] {
  const paid = lv.paid ?? {}, built: Walls = Object.fromEntries(Object.entries(lv.walls).filter(([, x]) => !x.draft))
  return findRooms(built).filter(r => paid[r.key]).flatMap(r => r.cells)
}
/** the walker's solids for levels above the ground: each wall (a door only its lintel) and a slab box per cell, its top at the floor */
/** `shaft`: holes left in the slabs, `i,j` (every level) or `i,j,k` (level k only: lift.ts shaftHoles) */
export function upperBoxes(w: Stacked, groundY: number, shaft?: ReadonlySet<string>): Box[] {
  const out: Box[] = [], lv = levelsOf(w)
  for (let k = 1; k < lv.length; k++) {
    const base = groundY + levelBase(k)
    for (const [key, x] of Object.entries(lv[k].walls)) if (!x.draft) { const r: Rect = edgeRect(key); out.push({ ...r, y0: x.kind === 'door' ? base + DOOR_H : base - SLAB_T, y1: base + WALL_H }) }
    for (const [i, j] of slabCells(lv[k])) if (!shaft?.has(`${i},${j}`) && !shaft?.has(`${i},${j},${k}`)) out.push({ x0: i, x1: i + 1, z0: j, z1: j + 1, y0: base - SLAB_T, y1: base })
    out.push(...colBoxes(lv[k].cols, base))   // M54
  }
  return out
}
