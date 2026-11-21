// ── PLOT DECKS: free floors + balconies (BETA M56 (a); Alex 11-20 "draw a floor area WITHOUT walls (patio / deck / platform)
// .. and on upper levels a balcony / landing that needs support below") ──────────────────────────────────────────────────
// A deck is a set of 1 m CELLS (cell (i, j) = [i, i+1] x [j, j+1], the rooms' own grid) with a floor pattern + colour, drawn in
// plan mode as a rectangle, stored per level beside the walls (level 0 Works.decks, upper levels Level.decks), keyed 'i,j'.
// Level 0 = a PATIO: a low platform DECK_T tall on the plot's ground. Upper levels = a BALCONY / landing: a slab like a room's,
// its top at the level's floor.
// SUPPORT (upper levels): a cell stands when the level below holds it DIRECTLY (one of its cells is a room there, a load-bearing
// wall runs along one of its edges, or a column stands at one of its corners) or it sits ONE cell out from a directly held cell
// (CANTILEVER = 1: a balcony may reach 1 m past its wall line or column; 2 m out is refused). Railings (M56 (c)) go on its
// edges by hand. Cost: like a room's floor, its pattern's base material per m² (FLOOR_PATS / FLOOR_PER_M2), paid at Build.
// PURE: no three, no react.
import type { Box } from '../terrain-world'
import { findRooms, FLOOR_PATS, FLOOR_PER_M2, isColour, type FloorPat, type Walls } from './plot-walls'
import type { Cols } from './plot-cols'
import { give, type Inv } from '../shared/inventory'

export const DECK_T = 0.12          // a patio's height off the ground (m): a step up, under the walker's 0.5 m step rule
export const DECK_SLAB_T = 0.2      // = plot-floors SLAB_T (not imported: plot-floors imports this module); plot-decks.test asserts it
export const CANTILEVER = 1         // cells a balcony may reach past what holds it
export const MAX_DECK_DRAG = 12     // the widest side one drag lays (m)
export const MAX_DECK_CELLS = 400   // deck cells on one level
export interface Deck { pat: FloorPat; col: string; draft?: true }
export type Decks = Readonly<Record<string, Deck>>
export const deckKey = (i: number, j: number) => `${i},${j}`
const parse = (k: string): [number, number] | null => { const m = /^(-?\d+),(-?\d+)$/.exec(k); return m ? [+m[1], +m[2]] : null }

/** the cells of the rectangle between two cells a and b (inclusive), each side clamped to MAX_DECK_DRAG */
export function deckRect(a: [number, number], b: [number, number]): [number, number][] {
  const c = (d: number) => Math.max(-(MAX_DECK_DRAG - 1), Math.min(MAX_DECK_DRAG - 1, d))
  const bi = a[0] + c(b[0] - a[0]), bj = a[1] + c(b[1] - a[1]), out: [number, number][] = []
  for (let i = Math.min(a[0], bi); i <= Math.max(a[0], bi); i++) for (let j = Math.min(a[1], bj); j <= Math.max(a[1], bj); j++) out.push([i, j])
  return out
}
export function adoptDecks(v: unknown): Decks {
  const out: Record<string, Deck> = {}
  if (v && typeof v === 'object') for (const [k, d] of Object.entries(v as Record<string, unknown>)) {
    if (!parse(k) || !d || typeof d !== 'object') continue
    const x = d as { pat?: unknown; col?: unknown; draft?: unknown }
    if (typeof x.pat !== 'string' || !(x.pat in FLOOR_PATS) || !isColour(x.col)) continue
    out[k] = { pat: x.pat as FloorPat, col: x.col.toLowerCase(), ...(x.draft === true ? { draft: true as const } : {}) }
  }
  return out
}
export const deckCellSet = (d: Decks | undefined) => new Set(Object.keys(d ?? {}))
export const builtDeckCells = (d: Decks | undefined): [number, number][] => Object.entries(d ?? {}).filter(([, x]) => !x.draft).map(([k]) => parse(k)!)

/** what the level BELOW offers a deck cell above it */
export interface Below { walls: Walls; cols?: Cols }
/** a predicate: is cell (i, j) held DIRECTLY by `below` (a room cell, a load-bearing wall on one of its edges, a column on a corner) */
export function directSupport(below: Below): (i: number, j: number) => boolean {
  const room = new Set(findRooms(below.walls).flatMap(r => r.cells.map(([a, b]) => `${a},${b}`)))
  const wall = (k: string) => { const w = below.walls[k]; return !!w && w.kind !== 'rail' }   // a railing holds nothing up (M56 (c))
  return (i, j) => room.has(`${i},${j}`)
    || wall(`h,${i},${j}`) || wall(`h,${i},${j + 1}`) || wall(`v,${i},${j}`) || wall(`v,${i + 1},${j}`)
    || [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].some(([a, b]) => !!below.cols?.[`${a},${b}`])
}
/** is cell (i, j) on an upper level supported: held directly, or within CANTILEVER cells (4-way steps) of a directly held cell */
export function supported(below: Below): (i: number, j: number) => boolean {
  const d = directSupport(below)
  return (i, j) => {
    for (let di = -CANTILEVER; di <= CANTILEVER; di++) for (let dj = -CANTILEVER; dj <= CANTILEVER; dj++) if (Math.abs(di) + Math.abs(dj) <= CANTILEVER && d(i + di, j + dj)) return true
    return false
  }
}

export type DeckChange = { ok: true; decks: Decks; n: number; said: string } | { ok: false; why: string }
/** plan a rectangle of deck: the cells not yet deck become DRAFTS of `pat` / `col`. `cellWhy(i, j)` = null when the cell may take a
 *  deck, else why not (held ground / a room there / a stair hole / no support below): the first refusal refuses the whole drag. */
export function planDecks(decks: Decks | undefined, cells: [number, number][], pat: FloorPat, col: string, cellWhy: (i: number, j: number) => string | null): DeckChange {
  if (!isColour(col)) return { ok: false, why: 'That is not a colour.' }
  const add = cells.filter(([i, j]) => !decks?.[deckKey(i, j)])
  if (!add.length) return { ok: false, why: cells.length ? 'That floor is already down.' : 'Drag to draw a floor.' }
  if (Object.keys(decks ?? {}).length + add.length > MAX_DECK_CELLS) return { ok: false, why: `${MAX_DECK_CELLS} m² of open floor already on this level.` }
  for (const [i, j] of add) { const why = cellWhy(i, j); if (why) return { ok: false, why } }
  const next: Record<string, Deck> = { ...(decks ?? {}) }; for (const [i, j] of add) next[deckKey(i, j)] = { pat, col: col.toLowerCase(), draft: true }
  return { ok: true, decks: next, n: add.length, said: `${add.length} m² of floor, on the plan.` }
}
/** take deck cells up: a draft just goes; a built cell gives its m² of material back (what the bag cannot hold stays down) */
export function eraseDecks(decks: Decks | undefined, cells: [number, number][], inv: Inv): { decks: Decks; inv: Inv; up: number; full: boolean } {
  const next: Record<string, Deck> = { ...(decks ?? {}) }
  let bag = inv, up = 0, full = false
  for (const [i, j] of cells) {
    const k = deckKey(i, j), d = next[k]; if (!d) continue
    if (!d.draft) { const g = give(bag, FLOOR_PATS[d.pat].item, FLOOR_PER_M2); if (g.left) { full = true; break } bag = g.inv }
    delete next[k]; up++
  }
  return { decks: next, inv: bag, up, full }
}
/** what the DRAFT cells cost: their pattern's base material per m² (not yet rounded) */
export function deckNeeds(decks: Decks | undefined): { id: string; n: number }[] {
  const m = new Map<string, number>()
  for (const d of Object.values(decks ?? {})) if (d.draft) { const id = FLOOR_PATS[d.pat].item; m.set(id, (m.get(id) ?? 0) + FLOOR_PER_M2) }
  return [...m].map(([id, n]) => ({ id, n }))
}
export const draftDecks = (d: Decks | undefined) => Object.values(d ?? {}).filter(x => x.draft).length
export function standDecks(d: Decks | undefined): Decks { const out: Record<string, Deck> = {}; for (const [k, x] of Object.entries(d ?? {})) { const { draft: _d, ...rest } = x; void _d; out[k] = rest } return out }
/** the walker's solids: one box per BUILT cell. Ground (`ground`): a patio from under the ground up DECK_T. Upper: a slab whose top is the floor. */
/** `lift(i, j)` (M55 slice 2): a ground patio riding a raised house stands flush with its floor (from the ground up); upstairs, the
 *  house's foundation under that cell */
export function deckBoxes(d: Decks | undefined, base: number, ground: boolean, lift?: (i: number, j: number) => number): Box[] {
  return builtDeckCells(d).map(([i, j]) => { const h = lift?.(i, j) ?? 0
    return ground ? { x0: i, x1: i + 1, z0: j, z1: j + 1, y0: base - 0.5, y1: base + (h || DECK_T) } : { x0: i, x1: i + 1, z0: j, z1: j + 1, y0: base + h - DECK_SLAB_T, y1: base + h } })
}
/** the deck cells of an upper level the level below no longer holds ('i,j'); empty = sound */
export function deckFloating(below: Below, d: Decks | undefined): string[] {
  const s = supported(below); return Object.keys(d ?? {}).filter(k => { const [i, j] = parse(k)!; return !s(i, j) })
}
