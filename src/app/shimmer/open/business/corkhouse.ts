// THE CORKHOUSE (RULED 11-21, game/alchemy.md › THE ALCHEMY SET; glossary): the continent's potion shop, one name in every town
// that has one; the first stands in Rune Hold, by the shipyard. The ONLY place a keeper sells bottles (Nyx-side only; no Moglin
// buys brews). Pure, like smokehouse.ts: the bottles leave the bag and the Marks land in the purse, both or neither.
// Prices are build (Jin): a bottle's base by potion, times its grade's potency (alchemy-set.ts POTENCY), rounded.
import { ALC_POTIONS, POTENCY, gradeOf, isAlcPotion } from '../ather/alchemy-set'
import { take, type Inv } from '../shared/inventory'
import type { Ledger } from '../trade'

export const CORK_BASE: Readonly<Record<string, number>> = { health: 60, mana: 60, wisdom: 90 }
/** what the Corkhouse pays for ONE bottle of this id, or null when it is not a bottle it buys */
export function corkPrice(id: string): number | null {
  if (!isAlcPotion(id)) return null
  const p = id.split(':')[1], g = gradeOf(id)
  const base = CORK_BASE[p]
  if (!base || !g || !ALC_POTIONS[p]) return null
  return Math.round(base * POTENCY[g])
}
/** the bottles in a bag the Corkhouse buys, one row per id, best price first */
export function bottlesIn(inv: Inv): { id: string; n: number; each: number }[] {
  const have: Record<string, number> = {}
  for (const s of inv.slots) if (s && corkPrice(s.id) !== null) have[s.id] = (have[s.id] ?? 0) + s.n
  return Object.entries(have).map(([id, n]) => ({ id, n, each: corkPrice(id)! })).sort((a, b) => b.each - a.each || a.id.localeCompare(b.id))
}
export type BottleSale = { ok: true; ledger: Ledger; inv: Inv; paid: number } | { ok: false; why: string }
/** sell `n` bottles of `id`: all of them leave the bag and the Marks land, or nothing changes */
export function sellBottles(ledger: Ledger, inv: Inv, id: string, n: number): BottleSale {
  const each = corkPrice(id)
  if (each === null) return { ok: false, why: 'The Corkhouse buys bottles, not that.' }
  if (!Number.isInteger(n) || n < 1) return { ok: false, why: 'Nothing to sell.' }
  const bag = take(inv, id, n)
  if (!bag) return { ok: false, why: 'You do not have that many.' }
  const paid = each * n
  return { ok: true, ledger: { ...ledger, marks: ledger.marks + paid }, inv: bag, paid }
}
