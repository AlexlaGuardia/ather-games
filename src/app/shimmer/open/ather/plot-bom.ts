// ── PLOT BOM: the bill of materials for a house PLAN (BETA M37 slice 4; Alex 11-20) ──────────────────────────────────────
// "at the planning table once a plan has been made it should have a list of materials that it will need before starting ..
//  the parts are things like planks and bricks that can be processed at a room .. the furniture on the other hand will be
//  craftable items."
// What you draw in plan mode is a DRAFT (plot-walls.ts Wall.draft). This module prices the unbuilt part of the plan, checks it
// against the bag + the Keepstone bank, and turns the draft into standing walls when everything is there. Parts are REFINED
// items (planks: Carpentry; bricks and panes: Stonery, furniture.ts STONE_REFINE), never crafted wall pieces.
// DEFAULTS (Jin's, simple on purpose; change a number here and the list, the Build button and the refund all follow):
//   a wall piece = 1 plank of its wood per metre   a window = that plank + 1 crystal pane   a door = 2 m of plank wall, no extra
//   a room's floor = 1 goldwood plank per m²       a room's roof = 1 stone brick per m²   (a drawn room's own area, not the eaves)
import { findRooms, WALL_MATS, type Walls, type Paid } from './plot-walls'
import { payCost, haveFor } from './rooms'
import { give, itemDef, type Inv } from '../shared/inventory'
import type { Bank } from './garden-bank'

export const STONE_BRICK = 'stone_brick', CRYSTAL_PANE = 'crystal_pane', FLOOR_ITEM = 'goldwood_plank'
export const AMOUNTS = { wallPerM: 1, panePerWindow: 1, floorPerM2: 1, roofPerM2: 1 } as const
export interface Need { id: string; n: number }
export interface Line extends Need { have: number; short: boolean; name: string }

const add = (m: Map<string, number>, id: string, n: number) => { if (n > 0) m.set(id, (m.get(id) ?? 0) + n) }
const lines = (m: Map<string, number>): Need[] => [...m].map(([id, n]) => ({ id, n }))

/** a room's own cost: its floor and its roof */
export const roomCost = (m2: number): Need[] => [{ id: FLOOR_ITEM, n: m2 * AMOUNTS.floorPerM2 }, { id: STONE_BRICK, n: m2 * AMOUNTS.roofPerM2 }]

/** everything the UNBUILT part of the plan takes: draft pieces (plank per metre, a pane per draft window) and every room
 *  that is not yet in `paid`. Built things cost nothing here: they were paid for (or grandfathered). */
export function planNeeds(walls: Walls, paid: Paid | undefined): { needs: Need[]; pieces: number; rooms: number } {
  const m = new Map<string, number>(); let pieces = 0
  for (const w of Object.values(walls)) if (w.draft) { pieces++; add(m, WALL_MATS[w.mat].item, AMOUNTS.wallPerM); if (w.kind === 'window') add(m, CRYSTAL_PANE, AMOUNTS.panePerWindow) }
  const rooms = findRooms(walls).filter(r => !(paid ?? {})[r.key])
  for (const r of rooms) for (const c of roomCost(r.cells.length)) add(m, c.id, c.n)
  return { needs: lines(m), pieces, rooms: rooms.length }
}
/** the plan's list against the bag + bank: have / need per line, and whether Build may be pressed */
export function billOf(walls: Walls, paid: Paid | undefined, inv: Inv, bank?: Bank | null): { lines: Line[]; ok: boolean; empty: boolean; pieces: number; rooms: number } {
  const p = planNeeds(walls, paid)
  const ls = p.needs.map(c => { const have = haveFor(inv, bank, c.id); return { ...c, have, short: have < c.n, name: itemDef(c.id).name } })
  return { lines: ls, ok: ls.length > 0 && ls.every(l => !l.short), empty: ls.length === 0, pieces: p.pieces, rooms: p.rooms }
}
/** rooms that were built and no longer exist (a wall came down): their floor and roof come back to the bag. What a full
 *  bag cannot hold stays recorded, so nothing is lost. */
export function reconcile(walls: Walls, paid: Paid | undefined, inv: Inv): { paid: Paid; inv: Inv; back: Need[] } {
  const live = new Set(findRooms(walls).map(r => r.key)), next: Record<string, number> = { ...(paid ?? {}) }
  let bag = inv; const back = new Map<string, number>()
  for (const [k, m2] of Object.entries(next)) {
    if (live.has(k)) continue
    let ok = true, b = bag
    for (const c of roomCost(m2)) { const g = give(b, c.id, c.n); if (g.left) { ok = false; break } b = g.inv }
    if (!ok) continue
    bag = b; delete next[k]; for (const c of roomCost(m2)) add(back, c.id, c.n)
  }
  return { paid: next, inv: bag, back: lines(back) }
}
export type Built = { ok: true; walls: Walls; paid: Paid; inv: Inv; bank: Bank | null; spent: Need[] } | { ok: false; why: string }
/** Build: pay the list (the Keepstone first, the bag tops up) and turn every draft into a standing wall; every room the
 *  plan closes becomes a built room. Nothing is spent unless everything is there. */
export function buildPlan(walls: Walls, paid: Paid | undefined, inv: Inv, bank?: Bank | null): Built {
  const rc = reconcile(walls, paid, inv)
  const p = planNeeds(walls, rc.paid)
  if (!p.needs.length) return { ok: false, why: 'Nothing is planned.' }
  const short = p.needs.find(c => haveFor(rc.inv, bank, c.id) < c.n)
  if (short) return { ok: false, why: `${short.n} ${itemDef(short.id).name} needed, ${haveFor(rc.inv, bank, short.id)} on hand.` }
  const pay = payCost(p.needs, rc.inv, bank); if (!pay) return { ok: false, why: 'Not enough on hand.' }
  const out: Record<string, Walls[string]> = {}
  for (const [k, w] of Object.entries(walls)) { const { draft: _d, ...rest } = w; void _d; out[k] = rest }
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
