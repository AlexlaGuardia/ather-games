// ── BETA M144: DEMOLISHED PIECES GO INTO THE CATALOG'S STORE (Alex 11-24) ──────────────────────────────────────────────
// Taking down a BUILT piece (a wall metre by its wood, a window, a door, a railing metre, a column, stairs, a metre of open
// floor, a slab, a panel) puts THAT PIECE in the garden's store (Works.stored) instead of giving its materials to the bag. A
// plan takes stored pieces FIRST: the plan card and Build charge only for what the store does not cover. The store has no cap,
// so a full bag never stops a take-down. 'Break down' (the catalog) turns stored pieces back into exactly what a take-down gave
// before M144 (plot-walls raze with its carried fractions, plot-cols / plot-stairs refunds, plot-decks m², a piece's own item).
// NOT stored (reported, no rule invented): a built room's floor + roof. They are not pieces of their own (a room is whatever the
// walls close; its floor + roof are paid per m² of that room), so reconcile still gives them back to the bag as before.
// PURE: no React, no storage.
import { WALL_MATS, wallRate, WALL_PER_M, FLOOR_PATS, FLOOR_PER_M2, type Wall, type Walls, type WallMat, type FloorPat } from './plot-walls'
import type { Col, Cols } from './plot-cols'
import type { Stair, Stairs } from './plot-stairs'
import { stairCost } from './plot-stairs'
import type { Deck, Decks } from './plot-decks'
// no plot-bom import here: rooms.ts loads the store (adoptStore) and plot-bom imports rooms. The two numbers are pinned equal
// to plot-bom's in plot-store.test.ts; the bill side lives in plot-store-bill.ts.
const PER_COL = 2 * WALL_PER_M, CRYSTAL_PANE = 'crystal_pane'
type Need = { id: string; n: number }
import { levelCount, levelOf, withLevel, type Stacked } from './plot-floors'
import { FURNITURE } from './furniture'
import { give, type Inv } from '../shared/inventory'
import type { Bank } from './garden-bank'

/** one stored kind: `n` pieces; walls also keep `v`, the planks those pieces were paid in all (Wall.paid, exact fractions) */
export interface Stored { n: number; v?: number }
export type PieceStore = Readonly<Record<string, Stored>>

// ── keys: what a piece IS (its shape + material), so a plan's draft of the same shape can take it ──
export const wallKey = (w: Pick<Wall, 'mat' | 'kind'>) => `${w.kind ?? 'wall'}:${w.mat}`
export const colKey = (c: Pick<Col, 'mat'>) => `col:${c.mat}`
export const stairKey = (s: Pick<Stair, 'mat' | 'turn'>) => `${s.turn ? 'stair-turn' : 'stair'}:${s.mat}`
export const deckKey = (d: Pick<Deck, 'pat'>) => `deck:${d.pat}`
export const pieceKey = (item: string) => `piece:${item}`

/** is `k` a key this store understands (load-side) */
function knownKey(k: string): boolean {
  const [kind, m] = k.split(':'); if (!m) return false
  if (kind === 'wall' || kind === 'window' || kind === 'door' || kind === 'rail' || kind === 'col' || kind === 'stair' || kind === 'stair-turn') return m in WALL_MATS
  if (kind === 'deck') return m in FLOOR_PATS
  if (kind === 'piece') return !!FURNITURE[m]?.build
  return false
}
/** the catalog's name for a stored kind (plain UI words, placeholders for @lark) */
export function storedName(k: string): string {
  const [kind, m] = k.split(':')
  if (kind === 'deck') return `${FLOOR_PATS[m as FloorPat]?.name ?? m} floor`
  if (kind === 'piece') return FURNITURE[m]?.name ?? m
  const mat = WALL_MATS[m as WallMat]?.name ?? m
  return `${mat} ${kind === 'stair-turn' ? 'stairs with a turn' : kind === 'stair' ? 'stairs' : kind === 'col' ? 'column' : kind === 'rail' ? 'railing' : kind}`
}
export const storedCount = (s: PieceStore | undefined, k: string) => s?.[k]?.n ?? 0
/** every stored kind with the given prefix test, summed (a catalog card can stand for several kinds) */
export const storedWhere = (s: PieceStore | undefined, f: (k: string) => boolean) => Object.entries(s ?? {}).reduce((t, [k, e]) => t + (f(k) ? e.n : 0), 0)

function put(s: Record<string, Stored>, k: string, v?: number) {
  const e = s[k] ?? { n: 0 }
  s[k] = v == null ? { n: e.n + 1 } : { n: e.n + 1, v: (e.v ?? 0) + v }
}
/** take one piece of `k` out: its share of `v` (the last one takes all that is left, so the shares add up exactly) */
function take(s: Record<string, Stored>, k: string): number | undefined {
  const e = s[k]; if (!e || e.n < 1) return undefined
  const share = e.v == null ? undefined : e.n === 1 ? e.v : e.v / e.n
  if (e.n === 1) delete s[k]; else s[k] = e.v == null ? { n: e.n - 1 } : { n: e.n - 1, v: e.v - share! }
  return share
}

// ── TAKE-DOWNS: built pieces into the store (a draft just goes: nothing was spent) ──
/** the Erase tool on walls: every piece under `keys` comes down; a built one goes into the store at what it was paid */
export function stowWalls(walls: Walls, keys: string[], store: PieceStore | undefined): { walls: Walls; down: number; store: PieceStore } {
  const next: Record<string, Wall> = { ...walls }, s: Record<string, Stored> = { ...(store ?? {}) }; let down = 0
  for (const k of keys) {
    const w = next[k]; if (!w) continue
    if (!w.draft) put(s, wallKey(w), w.paid ?? wallRate(w))
    delete next[k]; down++
  }
  return { walls: next, down, store: s }
}
export const stowCol = (store: PieceStore | undefined, c: Col): PieceStore => { const s = { ...(store ?? {}) }; put(s, colKey(c)); return s }
export const stowStair = (store: PieceStore | undefined, st: Stair): PieceStore => { const s = { ...(store ?? {}) }; put(s, stairKey(st)); return s }
export const stowPiece = (store: PieceStore | undefined, item: string): PieceStore => { const s = { ...(store ?? {}) }; put(s, pieceKey(item)); return s }
/** the Floor tool's take-up: a built cell goes into the store, a draft just goes */
export function stowDecks(decks: Decks | undefined, cells: [number, number][], store: PieceStore | undefined): { decks: Decks; up: number; store: PieceStore } {
  const next: Record<string, Deck> = { ...(decks ?? {}) }, s: Record<string, Stored> = { ...(store ?? {}) }; let up = 0
  for (const [i, j] of cells) {
    const k = `${i},${j}`, d = next[k]; if (!d) continue
    if (!d.draft) put(s, deckKey(d))
    delete next[k]; up++
  }
  return { decks: next, up, store: s }
}

// ── BREAK DOWN: stored pieces back into exactly the pre-M144 refund ──
/** what ONE stored piece of `k` gives back (walls: planks owed, fractional, via the carry; `share` = its part of `v`) */
function refundOf(k: string, share: number | undefined): Need[] {
  const [kind, m] = k.split(':')
  if (kind === 'wall' || kind === 'door' || kind === 'rail' || kind === 'window') {
    const out: Need[] = [{ id: WALL_MATS[m as WallMat].item, n: share ?? wallRate({ kind: kind === 'wall' ? undefined : kind as Wall['kind'] }) }]
    if (kind === 'window') out.push({ id: CRYSTAL_PANE, n: 1 }); return out
  }
  if (kind === 'col') return [{ id: WALL_MATS[m as WallMat].item, n: Math.ceil(PER_COL - 1e-9) }]
  if (kind === 'stair' || kind === 'stair-turn') return [{ id: WALL_MATS[m as WallMat].item, n: stairCost({ turn: kind === 'stair-turn' ? 'l' : undefined }) }]
  if (kind === 'deck') return [{ id: FLOOR_PATS[m as FloorPat].item, n: FLOOR_PER_M2 }]
  return [{ id: m, n: 1 }]   // a slab / panel: the piece itself, as liftPiece gave it
}
const isWallKind = (k: string) => /^(wall|door|rail|window):/.test(k)
/** break every stored piece of `k` down into the bag, one at a time. A wall's planks go through `carry` (item -> 0..1) exactly
 *  like raze: whole planks as they come due, the fraction kept. What the bag cannot hold stays stored (`full`). */
export function breakDown(store: PieceStore | undefined, k: string, inv: Inv, carry: Readonly<Record<string, number>> = {}): { store: PieceStore; inv: Inv; carry: Record<string, number>; done: number; full: boolean } {
  const s: Record<string, Stored> = { ...(store ?? {}) }, owed: Record<string, number> = { ...carry }
  let bag = inv, done = 0, full = false
  while ((s[k]?.n ?? 0) > 0) {
    const trial = { ...s }, share = take(trial, k), back = refundOf(k, share)
    let b = bag, ok = true; const owedNext = { ...owed }
    for (const c of back) {
      if (isWallKind(k) && c.id !== CRYSTAL_PANE) {
        const before = owedNext[c.id] ?? 0, after = before + c.n, whole = Math.floor(after + 1e-9) - Math.floor(before + 1e-9)
        if (whole > 0) { const g = give(b, c.id, whole); if (g.left) { ok = false; break } b = g.inv }
        owedNext[c.id] = after
      } else { const g = give(b, c.id, c.n); if (g.left) { ok = false; break } b = g.inv }
    }
    if (!ok) { full = true; break }
    bag = b; Object.assign(owed, owedNext); Object.keys(s).forEach(x => delete s[x]); Object.assign(s, trial); done++
  }
  const left: Record<string, number> = {}
  for (const [id, n] of Object.entries(owed)) { const f = n - Math.floor(n + 1e-9); if (f > 1e-9) left[id] = f }
  return { store: s, inv: bag, carry: left, done, full }
}

// ── PLANS TAKE STORED PIECES FIRST ──
export type Storing = Stacked & { stored?: PieceStore; planned?: readonly { item: string }[]; pieces?: readonly { item: string }[] }
/** the plan with every draft the store covers already standing (a wall at its stored share, so a later take-down gives back
 *  exactly that) and the store less those pieces. Order: level by level, walls, columns, stairs, floor cells, then slabs and
 *  panels. `used` = how many pieces came out of the store. */
export function applyStore<T extends Storing>(w: T): { works: T; store: PieceStore; used: number } {
  const s: Record<string, Stored> = { ...(w.stored ?? {}) }; let cur = w, used = 0
  if (!Object.keys(s).length) return { works: w, store: s, used: 0 }
  for (let k = 0; k < levelCount(w); k++) {
    const L = levelOf(cur, k); let changed = false
    const walls: Record<string, Wall> = { ...L.walls }
    for (const [key, x] of Object.entries(walls)) if (x.draft && (s[wallKey(x)]?.n ?? 0) > 0) { const share = take(s, wallKey(x)); const { draft: _d, ...rest } = x; void _d; walls[key] = { ...rest, paid: share ?? wallRate(x) }; used++; changed = true }
    const cols: Record<string, Col> = { ...(L.cols ?? {}) }
    for (const [key, x] of Object.entries(cols)) if (x.draft && (s[colKey(x)]?.n ?? 0) > 0) { take(s, colKey(x)); const { draft: _d, ...rest } = x; void _d; cols[key] = rest; used++; changed = true }
    const stairs: Record<string, Stair> = { ...(L.stairs ?? {}) }
    for (const [key, x] of Object.entries(stairs)) if (x.draft && (s[stairKey(x)]?.n ?? 0) > 0) { take(s, stairKey(x)); const { draft: _d, ...rest } = x; void _d; stairs[key] = rest; used++; changed = true }
    const decks: Record<string, Deck> = { ...(L.decks ?? {}) }
    for (const [key, x] of Object.entries(decks)) if (x.draft && (s[deckKey(x)]?.n ?? 0) > 0) { take(s, deckKey(x)); const { draft: _d, ...rest } = x; void _d; decks[key] = rest; used++; changed = true }
    if (changed) cur = withLevel(cur, k, { ...L, walls, ...(L.cols ? { cols: cols as Cols } : {}), ...(L.stairs ? { stairs: stairs as Stairs } : {}), ...(L.decks ? { decks: decks as Decks } : {}) })
  }
  if (cur.planned?.length) {
    const keep: { item: string }[] = [], up: { item: string }[] = []
    for (const p of cur.planned) if ((s[pieceKey(p.item)]?.n ?? 0) > 0) { take(s, pieceKey(p.item)); up.push(p); used++ } else keep.push(p)
    if (up.length) { const { planned: _p, ...rest } = cur; void _p; cur = { ...rest, ...(keep.length ? { planned: keep } : {}), pieces: [...(cur.pieces ?? []), ...up] } as unknown as T }
  }
  return { works: { ...cur, stored: s } as T, store: s, used }
}
/** load-side: well-formed stored kinds only (a save from before M144 has none) */
export function adoptStore(v: unknown): Record<string, Stored> {
  const out: Record<string, Stored> = {}
  if (v && typeof v === 'object') for (const [k, e] of Object.entries(v as Record<string, Stored>)) {
    if (!knownKey(k) || !e || !Number.isInteger(e.n) || e.n < 1) continue
    out[k] = isWallKind(k) ? { n: e.n, v: typeof e.v === 'number' && Number.isFinite(e.v) && e.v > 0 ? e.v : e.n * wallRate({ kind: k.startsWith('rail') ? 'rail' : undefined }) } : { n: e.n }
  }
  return out
}
