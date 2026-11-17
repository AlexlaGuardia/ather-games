// BUYING AT THE SMOKEHOUSE (RULED 11-17, world/cuisine.md › THE SMOKEHOUSE; play / Jin 30bbef32). Pure, like decor-shop.ts:
// Marks leave the purse and the bundle lands in the bag WHOLE, or nothing changes (half a bundle is not a sale).
import { SMOKEHOUSE_STOCK } from '../ather/cooking'
import { give, type Inv } from '../shared/inventory'
import type { Ledger } from '../trade'

export type BundleBuy = { ok: true; ledger: Ledger; inv: Inv } | { ok: false; why: string }
export function buyBundle(ledger: Ledger, inv: Inv, id: string): BundleBuy {
  const b = SMOKEHOUSE_STOCK.find(x => x.id === id)
  if (!b) return { ok: false, why: 'Not sold here.' }
  if (ledger.marks < b.price) return { ok: false, why: `It costs ${b.price.toLocaleString()} Marks. You have ${ledger.marks.toLocaleString()}.` }
  const g = give(inv, id, b.n)
  if (g.left > 0) return { ok: false, why: 'No room in the bag for the bundle.' }
  return { ok: true, ledger: { ...ledger, marks: ledger.marks - b.price }, inv: g.inv }
}
