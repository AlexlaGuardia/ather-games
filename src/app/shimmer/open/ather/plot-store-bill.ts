// BETA M144: the plan card and Build with the garden's store (plot-store.ts) giving its pieces first. Apart from plot-store.ts
// because plot-bom imports rooms.ts, which loads the store.
import { billOfAll, buildAll, type Line, type Need } from './plot-bom'
import { applyStore, type Storing } from './plot-store'
import type { Inv } from '../shared/inventory'
import type { Bank } from './garden-bank'

export type StoreBill = { lines: Line[]; ok: boolean; empty: boolean; pieces: number; rooms: number; set: Need[]; stored: number }
/** the plan card: the list after the store has given what it holds (`stored` = pieces it gives). A plan the store covers
 *  completely is not empty: it builds for nothing. */
export function billWithStore(w: Storing, inv: Inv, bank?: Bank | null): StoreBill {
  const a = applyStore(w), b = billOfAll(a.works, inv, bank)
  if (!a.used) return { ...b, stored: 0 }
  return { ...b, pieces: b.pieces + a.used, stored: a.used, empty: false, ok: b.empty ? true : b.ok }
}
/** Build: the store's pieces first, then the bill for the rest (buildAll). Nothing changes unless all of it is there. */
export function buildWithStore<T extends Storing>(w: T, inv: Inv, bank?: Bank | null): { ok: true; works: T; inv: Inv; bank: Bank | null; spent: Need[]; stored: number } | { ok: false; why: string } {
  const a = applyStore(w), r = buildAll(a.works, inv, bank)
  if (r.ok) return { ...r, stored: a.used }
  if (a.used && r.why === 'Nothing is planned.') return { ok: true, works: a.works, inv, bank: bank ?? null, spent: [], stored: a.used }
  return r
}
