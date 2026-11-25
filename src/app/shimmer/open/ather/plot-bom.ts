// ── PLOT BOM: the bill of materials for a house PLAN (BETA M37 slice 4; Alex 11-20) ──────────────────────────────────────
// "at the planning table once a plan has been made it should have a list of materials that it will need before starting ..
//  the parts are things like planks and bricks that can be processed at a room .. the furniture on the other hand will be
//  craftable items."
// What you draw in plan mode is a DRAFT (plot-walls.ts Wall.draft). This module prices the unbuilt part of the plan, checks it
// against the bag + the Keepstone bank, and turns the draft into standing walls when everything is there. Parts are REFINED
// items (planks: Carpentry; bricks and panes: Stonery, furniture.ts STONE_REFINE), never crafted wall pieces.
// DEFAULTS (Jin's, simple on purpose; change a number here and the list, the Build button and the refund all follow):
//   a wall piece = 1 plank of its wood per metre (M56 (c): a railing RAIL_FRAC of that)   a window = that plank + 1 crystal pane   a door = 2 m of plank wall, no extra
//   a room's floor = 1 goldwood plank per m²       a room's roof = 1 stone brick per m²   (a drawn room's own area, not the eaves)
import { draftCols, colNeeds, standCols } from './plot-cols'
import { draftStairs, stairNeeds, standStairs } from './plot-stairs'
import { draftDecks, deckNeeds, standDecks } from './plot-decks'
import { liftOf, plinthPerM2 } from './plot-found'
import { findRooms, RAIL_FRAC, WALL_PER_M, wallRate, WALL_MATS, FLOOR_PATS, FLOOR_PER_M2, roomFloor, floorByKey, type Walls, type Paid, type Floors } from './plot-walls'
import { payCost, haveFor } from './rooms'
import { give, itemDef, type Inv } from '../shared/inventory'
import type { Bank } from './garden-bank'
import { FURNITURE } from './furniture'
import { levelsOf, levelOf, levelCount, withLevel, type Stacked } from './plot-floors'

export const STONE_BRICK = 'stone_brick', CRYSTAL_PANE = 'crystal_pane', FLOOR_ITEM = 'goldwood_plank'
// M50: walls stand 1.5x taller (4.8 m), so a piece costs 1.5 planks; a list rounds UP per line (lines())
export const AMOUNTS = { wallPerM: WALL_PER_M, panePerWindow: 1, floorPerM2: FLOOR_PER_M2, roofPerM2: 1 } as const
/** M55: Stone Brick for the plinth under the ground floor's UNBUILT rooms, at the height of the house each one joins (slice 2) */
export function plinthNeed(w: Stacked & { found?: number; foundCells?: Readonly<Record<string, number>> }): number {
  if (!w.found && !w.foundCells) return 0
  const paid = w.paid ?? {}, L = liftOf(w)
  return findRooms(w.walls ?? {}).filter(r => !paid[r.key]).reduce((t, r) => t + r.cells.reduce((u, [i, j]) => u + plinthPerM2(L.cell(i, j)), 0), 0)
}
/** M54: a column costs 2 m of its wall */
export const PER_COL = 2 * AMOUNTS.wallPerM
export interface Need { id: string; n: number }
export interface Line extends Need { have: number; short: boolean; name: string }

const add = (m: Map<string, number>, id: string, n: number) => { if (n > 0) m.set(id, (m.get(id) ?? 0) + n) }
const lines = (m: Map<string, number>): Need[] => [...m].map(([id, n]) => ({ id, n: Math.ceil(n - 1e-9) }))   // whole items: half-plank walls round up per line

/** a room's own cost: its floor and its roof */
export const roomCost = (m2: number, floorItem: string = FLOOR_ITEM, roofed = true): Need[] => {
  const m = new Map<string, number>(); add(m, floorItem, m2 * AMOUNTS.floorPerM2); if (roofed) add(m, STONE_BRICK, m2 * AMOUNTS.roofPerM2); return lines(m)   // a tile floor and the roof both want bricks: one line
}

/** everything the UNBUILT part of the plan takes: draft pieces (plank per metre, a pane per draft window) and every room
 *  that is not yet in `paid`. Built things cost nothing here: they were paid for (or grandfathered). */
export function planNeeds(walls: Walls, paid: Paid | undefined, floors?: Floors, roofed = true): { needs: Need[]; pieces: number; rooms: number } {
  const m = new Map<string, number>(); let pieces = 0
  for (const w of Object.values(walls)) if (w.draft) { pieces++; add(m, WALL_MATS[w.mat].item, AMOUNTS.wallPerM * (w.kind === 'rail' ? RAIL_FRAC : 1)); if (w.kind === 'window') add(m, CRYSTAL_PANE, AMOUNTS.panePerWindow) }
  const rooms = findRooms(walls).filter(r => !(paid ?? {})[r.key])
  for (const r of rooms) for (const c of roomCost(r.cells.length, FLOOR_PATS[roomFloor(floors, r).pat].item, roofed)) add(m, c.id, c.n)   // the floor's pattern picks its base material
  return { needs: lines(m), pieces, rooms: rooms.length }
}
/** the plan's list against the bag + bank: have / need per line, and whether Build may be pressed */
export function billOf(walls: Walls, paid: Paid | undefined, inv: Inv, bank?: Bank | null, floors?: Floors): { lines: Line[]; ok: boolean; empty: boolean; pieces: number; rooms: number } {
  const p = planNeeds(walls, paid, floors)
  const ls = p.needs.map(c => { const have = haveFor(inv, bank, c.id); return { ...c, have, short: have < c.n, name: itemDef(c.id).name } })
  return { lines: ls, ok: ls.length > 0 && ls.every(l => !l.short), empty: ls.length === 0, pieces: p.pieces, rooms: p.rooms }
}
/** rooms that were built and no longer exist (a wall came down): their floor and roof come back to the bag. What a full
 *  bag cannot hold stays recorded, so nothing is lost. */
export function reconcile(walls: Walls, paid: Paid | undefined, inv: Inv, floors?: Floors, roofed = true): { paid: Paid; inv: Inv; back: Need[] } {
  const live = new Set(findRooms(walls).map(r => r.key)), next: Record<string, number> = { ...(paid ?? {}) }
  let bag = inv; const back = new Map<string, number>()
  for (const [k, m2] of Object.entries(next)) {
    if (live.has(k)) continue
    let ok = true, b = bag
    for (const c of roomCost(m2, FLOOR_PATS[floorByKey(floors, k).pat].item, roofed)) { const g = give(b, c.id, c.n); if (g.left) { ok = false; break } b = g.inv }
    if (!ok) continue
    bag = b; delete next[k]; for (const c of roomCost(m2, FLOOR_PATS[floorByKey(floors, k).pat].item, roofed)) add(back, c.id, c.n)
  }
  return { paid: next, inv: bag, back: lines(back) }
}
export type Built = { ok: true; walls: Walls; paid: Paid; inv: Inv; bank: Bank | null; spent: Need[] } | { ok: false; why: string }
/** Build: pay the list (the Keepstone first, the bag tops up) and turn every draft into a standing wall; every room the
 *  plan closes becomes a built room. Nothing is spent unless everything is there. */
export function buildPlan(walls: Walls, paid: Paid | undefined, inv: Inv, bank?: Bank | null, floors?: Floors, roofed = true): Built {
  const rc = reconcile(walls, paid, inv, floors, roofed)
  const p = planNeeds(walls, rc.paid, floors, roofed)
  if (!p.needs.length) return { ok: false, why: 'Nothing is planned.' }
  const short = p.needs.find(c => haveFor(rc.inv, bank, c.id) < c.n)
  if (short) return { ok: false, why: `${short.n} ${itemDef(short.id).name} needed, ${haveFor(rc.inv, bank, short.id)} on hand.` }
  const pay = payCost(p.needs, rc.inv, bank); if (!pay) return { ok: false, why: 'Not enough on hand.' }
  // 11-22: each draft piece records what it was charged (Wall.paid), so a take-down gives back exactly that. A piece's share is
  // its rate; a line rounds UP, and that round-up goes on the line's last piece, so the pieces add up to what the list spent
  // (rooms' floor and roof lines are whole m², so any fraction in a line is the walls').
  const exact = new Map<string, number>(), lastOf = new Map<string, string>()
  for (const [k, w] of Object.entries(walls)) if (w.draft) { const it = WALL_MATS[w.mat].item; exact.set(it, (exact.get(it) ?? 0) + wallRate(w)); lastOf.set(it, k) }
  const out: Record<string, Walls[string]> = {}
  for (const [k, w] of Object.entries(walls)) {
    const { draft: _d, ...rest } = w; void _d
    if (!w.draft) { out[k] = rest; continue }
    const it = WALL_MATS[w.mat].item, e = exact.get(it)!, up = lastOf.get(it) === k ? Math.ceil(e - 1e-9) - e : 0
    out[k] = { ...rest, paid: wallRate(w) + Math.max(0, up) }
  }
  const np: Record<string, number> = { ...rc.paid }; for (const r of findRooms(out)) np[r.key] = r.cells.length
  return { ok: true, walls: out, paid: np, inv: pay.inv, bank: pay.bank, spent: p.needs }
}
/** a window cut into a BUILT wall is paid when it is cut (its pane leaves the bank / bag) and refunded when it is filled in;
 *  a draft window is just on the list. `from` = the wall before the tap, `to` = after. */
export function paneFor(from: Walls, to: Walls, k: string, inv: Inv, bank?: Bank | null): { inv: Inv; bank: Bank | null } | { why: string } {
  const a = from[k], b = to[k]
  if (!a || !b || a.draft) return { inv, bank: bank ?? null }
  if (a.kind !== 'window' && b.kind === 'window') {
    const pay = payCost([{ id: CRYSTAL_PANE, n: AMOUNTS.panePerWindow }], inv, bank)
    return pay ?? { why: `A Crystal Pane is needed: cut one at your Stonery (${haveFor(inv, bank, CRYSTAL_PANE)} on hand).` }
  }
  if (a.kind === 'window' && b.kind !== 'window') {
    const g = give(inv, CRYSTAL_PANE, AMOUNTS.panePerWindow); return g.left ? { why: 'Your bag is full: no room for the pane.' } : { inv: g.inv, bank: bank ?? null }
  }
  return { inv, bank: bank ?? null }
}

// ── M47 slice 1: the whole STACK. Level 0 is the house as before (floor + roof per room); every level above pays its SLAB
// (the floor, planks / bricks per m²) and no roof of its own: the plain default, one number to change if Alex wants a roof bill.
/** M143: the planned slabs and wall panels: each at its recipe, the price it was crafted for */
export type PlannedPiece = { item: string }
export const plannedNeeds = (ps: readonly PlannedPiece[] | undefined): Need[] => { const m = new Map<string, number>(); for (const p of ps ?? []) for (const c of FURNITURE[p.item]?.recipe ?? []) add(m, c.id, c.n); return lines(m) }
/** how many of each are planned, for the plan card */
export const plannedCount = (ps: readonly PlannedPiece[] | undefined): Need[] => { const m = new Map<string, number>(); for (const p of ps ?? []) add(m, p.item, 1); return lines(m) }
type Billed = Stacked & { found?: number; foundCells?: Readonly<Record<string, number>>; planned?: readonly PlannedPiece[]; pieces?: readonly PlannedPiece[] }
export function billOfAll(w: Billed, inv: Inv, bank?: Bank | null): { lines: Line[]; ok: boolean; empty: boolean; pieces: number; rooms: number; set: Need[] } {
  const m = new Map<string, number>(); let pieces = 0, rooms = 0
  levelsOf(w).forEach((lv, k) => { const p = planNeeds(lv.walls, lv.paid, lv.floors, k === 0); pieces += p.pieces; rooms += p.rooms; for (const c of p.needs) add(m, c.id, c.n)
    pieces += draftCols(lv.cols); for (const c of colNeeds(lv.cols, PER_COL)) add(m, c.id, c.n)   // M54: columns, 2 m of their wall each
    pieces += draftStairs(lv.stairs); for (const c of stairNeeds(lv.stairs)) add(m, c.id, c.n)   // M56: stairs, a step's worth each
    pieces += draftDecks(lv.decks); for (const c of deckNeeds(lv.decks)) add(m, c.id, c.n) })   // M56 (a): open floor, a room floor's worth per m²
  for (const c of plannedNeeds(w.planned)) add(m, c.id, c.n)   // M143
  const pl = plinthNeed(w); if (pl) add(m, STONE_BRICK, pl)   // M55: a new room on a raised house pays its plinth
  const ls = lines(m).map(c => { const have = haveFor(inv, bank, c.id); return { ...c, have, short: have < c.n, name: itemDef(c.id).name } })
  return { lines: ls, ok: ls.length > 0 && ls.every(l => !l.short), empty: ls.length === 0, pieces, rooms, set: plannedCount(w.planned) }
}
export type BuiltAll = { ok: true; works: Stacked; inv: Inv; bank: Bank | null; spent: Need[] } | { ok: false; why: string }
/** Build spends EVERY level's draft: the whole list is checked first, then each level builds in turn (nothing is spent unless all of it is there) */
export function buildAll<T extends Billed>(w: T, inv: Inv, bank?: Bank | null): { ok: true; works: T; inv: Inv; bank: Bank | null; spent: Need[] } | { ok: false; why: string } {
  const b = billOfAll(w, inv, bank)
  if (b.empty) return { ok: false, why: 'Nothing is planned.' }
  const short = b.lines.find(l => l.short); if (short) return { ok: false, why: `${short.n} ${short.name} needed, ${short.have} on hand.` }
  let cur: T = w, bag = inv, bk: Bank | null = bank ?? null; const spent = new Map<string, number>()
  const plinth = plinthNeed(w)   // M55: read before the rooms below become paid
  for (let k = 0; k < levelCount(w); k++) {
    const lv = levelOf(cur, k), r = buildPlan(lv.walls, lv.paid, bag, bk, lv.floors, k === 0)
    if (!r.ok) { if (r.why === 'Nothing is planned.') continue; return { ok: false, why: r.why } }
    cur = withLevel(cur, k, { ...lv, walls: r.walls, floors: lv.floors, paid: r.paid }); bag = r.inv; bk = r.bank
    for (const c of r.spent) add(spent, c.id, c.n)
  }
  // M54: then every level's draft columns, paid as one list (billOfAll already checked the whole of it is on hand)
  const cm = new Map<string, number>(); if (plinth) add(cm, STONE_BRICK, plinth); levelsOf(cur).forEach(lv => { for (const c of colNeeds(lv.cols, PER_COL)) add(cm, c.id, c.n); for (const c of stairNeeds(lv.stairs)) add(cm, c.id, c.n); for (const c of deckNeeds(lv.decks)) add(cm, c.id, c.n) })   // + M56 stairs + decks
  for (const c of plannedNeeds(cur.planned)) add(cm, c.id, c.n)   // M143: the planned slabs and panels
  if (cm.size) {
    const need = lines(cm), pay = payCost(need, bag, bk); if (!pay) return { ok: false, why: 'Not enough on hand.' }
    bag = pay.inv; bk = pay.bank; for (const c of need) add(spent, c.id, c.n)
    for (let k = 0; k < levelCount(cur); k++) { const lv = levelOf(cur, k); if (draftCols(lv.cols) || draftStairs(lv.stairs) || draftDecks(lv.decks)) cur = withLevel(cur, k, { ...lv, cols: standCols(lv.cols), stairs: standStairs(lv.stairs), ...(lv.decks ? { decks: standDecks(lv.decks) } : {}) }) }
  }
  if (cur.planned) { const { planned, ...rest } = cur; cur = { ...rest, pieces: [...(cur.pieces ?? []), ...planned!] } as unknown as T }
  return { ok: true, works: cur, inv: bag, bank: bk, spent: lines(spent) }
}
