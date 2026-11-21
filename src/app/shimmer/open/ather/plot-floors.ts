// ── PLOT FLOORS: the house as stacked LEVELS (BETA M47 slice 1; Alex 11-20 "explore multiple floors") ───────────────────
// Level 0 is today's house, stored exactly where it always was (Works.walls / floors / paid), so an old save IS one level and
// loads unchanged. Levels 1.. live in Works.upper[k-1] as { walls, floors, paid }: each its own walls, doors, windows, rooms.
// A level's SLAB is the floor you stand on: it covers the level's own built rooms (SLAB_T thick, its top at levelBase(k)).
// Support rule (nothing floats): a wall on level k must stand on a wall of level k-1 or on a cell of one of its rooms.
// The roof sits on the TOP level only (the highest level with any wall). PURE: no three, no react.
import type { Box } from '../terrain-world'
import { WALL_H, DOOR_H, RAIL_H, edgeRect, findRooms, parseKey, adoptWalls, adoptFloors, adoptPaid, type Walls, type WallMat, type Floors, type Paid, type Rect } from './plot-walls'
import { adoptCols, colBoxes, colStandsOn, type Cols } from './plot-cols'
import { adoptStairs, stairBoxes, landingRails, stairCellSet, stairStandsOn, holeRails, type Stairs } from './plot-stairs'
import { adoptDecks, deckBoxes, deckFloating, builtDeckCells, type Decks } from './plot-decks'

export const SLAB_T = 0.2, STOREY = WALL_H + SLAB_T, MAX_LEVELS = 3
/** the floor surface of level k above the plot's ground (level 0 = 0) */
export const levelBase = (k: number) => k * STOREY
export interface Level { walls: Walls; floors?: Floors; paid?: Paid; /** M54: columns on corners (plot-cols.ts) */ cols?: Cols; /** M56: stairs up to the next level (plot-stairs.ts) */ stairs?: Stairs; /** M56 (a): open floor, a patio / balcony (plot-decks.ts) */ decks?: Decks }
/** the part of Works this module reads and writes */
export interface Stacked { walls?: Walls; floors?: Floors; paid?: Paid; cols?: Cols; stairs?: Stairs; decks?: Decks; upper?: Level[] }

export const levelCount = (w: Stacked) => 1 + (w.upper?.length ?? 0)
export const levelOf = (w: Stacked, k: number): Level => k === 0 ? { walls: w.walls ?? {}, floors: w.floors, paid: w.paid, cols: w.cols, stairs: w.stairs, decks: w.decks } : (w.upper?.[k - 1] ?? { walls: {} })
/** a level with nothing on it (no wall, no column) is no level */
const emptyLevel = (l: Level) => !Object.keys(l.walls).length && !Object.keys(l.cols ?? {}).length && !Object.keys(l.stairs ?? {}).length && !Object.keys(l.decks ?? {}).length
export const levelsOf = (w: Stacked): Level[] => Array.from({ length: levelCount(w) }, (_, k) => levelOf(w, k))
/** w with level k replaced (growing the stack when k is the next one up) */
export function withLevel<T extends Stacked>(w: T, k: number, lv: Level): T {
  if (k === 0) return { ...w, walls: lv.walls, floors: lv.floors, paid: lv.paid, cols: lv.cols, stairs: lv.stairs, decks: lv.decks }
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
    const cols = adoptCols((l as { cols?: unknown })?.cols), stairs = adoptStairs((l as { stairs?: unknown })?.stairs), decks = adoptDecks((l as { decks?: unknown })?.decks)
    out.push({ walls, floors: adoptFloors((l as { floors?: unknown })?.floors), paid: adoptPaid((l as { paid?: unknown })?.paid, walls), ...(Object.keys(cols).length ? { cols } : {}), ...(Object.keys(stairs).length ? { stairs } : {}), ...(Object.keys(decks).length ? { decks } : {}) })
  }
  while (out.length && emptyLevel(out[out.length - 1])) out.pop()
  return out
}

/** the two cells an edge borders: 'h,i,j' = (i, j-1) and (i, j); 'v,i,j' = (i-1, j) and (i, j) */
const edgeCells = (k: string): [number, number][] => { const e = parseKey(k)!; return e.o === 'h' ? [[e.i, e.j - 1], [e.i, e.j]] : [[e.i - 1, e.j], [e.i, e.j]] }
/** does a wall on the level above stand on `below`: a wall on that very edge, or a cell of one of its rooms on either side */
/** `floor` (M56 (a)): this level's own BUILT deck cells ('i,j'): a piece on a deck's edge stands on the deck */
export function standsOn(below: Walls, key: string, floor?: ReadonlySet<string>): boolean {
  if (below[key] && below[key].kind !== 'rail') return true   // M56 (c): a railing holds nothing up
  if (floor?.size && edgeCells(key).some(([i, j]) => floor.has(`${i},${j}`))) return true
  const rooms = findRooms(below); if (!rooms.length) return false
  const cells = new Set(rooms.flatMap(r => r.cells.map(([i, j]) => `${i},${j}`)))
  return edgeCells(key).some(([i, j]) => cells.has(`${i},${j}`))
}
export type Support = { ok: true } | { ok: false; why: string }
/** may these new pieces go on a level whose floor below is `below`? (refuses the first one that would float) */
export function canStack(below: Walls | undefined, keys: string[], floor?: ReadonlySet<string>): Support {
  if ((!below || !Object.keys(below).length) && !floor?.size) return { ok: false, why: 'A floor needs walls or rooms under it. Build the floor below first.' }
  const bad = keys.find(k => !standsOn(below ?? {}, k, floor))
  return bad ? { ok: false, why: 'A wall up here must stand on a wall or a room of the floor below.' } : { ok: true }
}
/** every upper piece that floats over the stack as it stands ('level:key'); empty = sound */
export function floating(w: Stacked): string[] {
  const out: string[] = [], lv = levelsOf(w)
  for (let k = 1; k < lv.length; k++) { const fl = new Set(builtDeckCells(lv[k].decks).map(([i, j]) => `${i},${j}`)); for (const key of Object.keys(lv[k].walls)) if (!standsOn(lv[k - 1].walls, key, fl)) out.push(`${k}:${key}`) }
  for (let k = 1; k < lv.length; k++) for (const c of deckFloating(lv[k - 1], lv[k].decks)) out.push(`${k}:d${c}`)   // M56 (a): a balcony must stay held
  for (let k = 1; k < lv.length; k++) for (const key of Object.keys(lv[k].cols ?? {})) if (!colStandsOn(lv[k - 1], key)) out.push(`${k}:c${key}`)   // M54
  for (let k = 1; k < lv.length; k++) for (const [key, st] of Object.entries(lv[k].stairs ?? {})) if (!stairStandsOn(lv[k].walls, key, st)) out.push(`${k}:s${key}`)   // M56: an upper stair stands on its level's rooms
  return out
}
/** the highest level that has any wall: the roof goes there (and nowhere lower) */
export const topLevel = (w: Stacked): number => { const lv = levelsOf(w); for (let k = lv.length - 1; k > 0; k--) if (Object.values(lv[k].walls).some(x => x.kind !== 'rail')) return k; return 0 }   // columns (or railings) alone carry no roof

/** the cells of a level's BUILT rooms (rooms in `paid`): its slab, the floor above the room below */
export function slabCells(lv: Level): [number, number][] {
  const paid = lv.paid ?? {}, built: Walls = Object.fromEntries(Object.entries(lv.walls).filter(([, x]) => !x.draft))
  return findRooms(built).filter(r => paid[r.key]).flatMap(r => r.cells)
}
/** the walker's solids for levels above the ground: each wall (a door only its lintel) and a slab box per cell, its top at the floor */
/** `shaft`: holes left in the slabs, `i,j` (every level) or `i,j,k` (level k only: lift.ts shaftHoles) */
/** the foundation under the house (M55 slice 2, plot-found liftOf): per edge / cell / corner of the ground floor's grid */
export interface LiftLookup { edge(k: string): number; cell(i: number, j: number): number; corner(i: number, j: number): number }
export function upperBoxes(w: Stacked, groundY: number, shaft?: ReadonlySet<string>, lift?: LiftLookup): Box[] {
  const out: Box[] = [], lv = levelsOf(w), E = (k: string) => lift?.edge(k) ?? 0, C = (i: number, j: number) => lift?.cell(i, j) ?? 0
  for (let k = 1; k < lv.length; k++) {
    const base = groundY + levelBase(k)
    for (const [key, x] of Object.entries(lv[k].walls)) if (!x.draft) { const r: Rect = edgeRect(key), b = base + E(key); out.push({ ...r, y0: x.kind === 'door' ? b + DOOR_H : b - SLAB_T, y1: b + (x.kind === 'rail' ? RAIL_H : WALL_H) }) }
    for (const h of stairRails(w, k)) { const r: Rect = edgeRect(h.key), b = base + E(h.key); out.push({ ...r, y0: b - SLAB_T, y1: b + RAIL_H }) }   // M56 (c): the railing round the stair hole
    const stairHole = stairCellSet(lv[k - 1].stairs)   // M56: the slab is open over the stairs that climb to it
    for (const [i, j] of slabCells(lv[k])) if (!shaft?.has(`${i},${j}`) && !shaft?.has(`${i},${j},${k}`) && !stairHole.has(`${i},${j}`)) { const b = base + C(i, j); out.push({ x0: i, x1: i + 1, z0: j, z1: j + 1, y0: b - SLAB_T, y1: b }) }
    out.push(...colBoxes(lv[k].cols, base, lift ? (i, j) => lift.corner(i, j) : undefined))   // M54
    out.push(...deckBoxes(lv[k].decks, base, false, lift ? C : undefined))   // M56 (a): balconies
  }
  // M56: every level's built stairs are solid steps from that level's floor (level 0's from the ground)
  for (let k = 0; k < lv.length; k++) { const base = groundY + levelBase(k); for (const [key, st] of Object.entries(lv[k].stairs ?? {})) if (!st.draft) { const [i, j] = key.split(',').map(Number); out.push(...stairBoxes(key, st, base + C(i, j)), ...landingRails(key, st, base + C(i, j))) } }
  return out
}

/** M56 (c): the railing round each stair hole on level k (k >= 1): every edge of the hole that borders this level's slab, except
 *  the arrival end the stairs climb out of, and except where a piece of this level already stands. Part of the stairs: no cost,
 *  gone when they go. */
export function stairRails(w: Stacked, k: number): { key: string; mat: WallMat }[] {
  if (k < 1 || k >= levelCount(w)) return []
  const lv = levelOf(w, k), slab = new Set(slabCells(lv).map(([i, j]) => `${i},${j}`))
  return holeRails(levelOf(w, k - 1).stairs, slab, lv.walls)
}
