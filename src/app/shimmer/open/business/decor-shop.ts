// BUYING DECOR at a Nyx-side storefront (2026-11-17, play / Jin 2 95f19652). Pure: Marks leave the purse (the garden's
// trade ledger, trade-ui.tsx), the piece lands in the bag, or nothing changes. The pieces + prices: ather/furniture.ts.
import { FURNITURE } from '../ather/furniture'
import { give, type Inv } from '../shared/inventory'
import type { Ledger } from '../trade'

export type DecorBuy = { ok: true; ledger: Ledger; inv: Inv } | { ok: false; why: string }
export function buyDecor(ledger: Ledger, inv: Inv, id: string, front: string): DecorBuy {
  const f = FURNITURE[id]
  if (!f?.sold || f.sold.at !== front) return { ok: false, why: 'Not sold here.' }
  if (ledger.marks < f.sold.price) return { ok: false, why: `It costs ${f.sold.price.toLocaleString()} Marks. You have ${ledger.marks.toLocaleString()}.` }
  const g = give(inv, id, 1)
  if (g.left > 0) return { ok: false, why: 'No room in the bag.' }
  return { ok: true, ledger: { ...ledger, marks: ledger.marks - f.sold.price }, inv: g.inv }
}
