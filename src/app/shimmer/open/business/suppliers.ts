// ── BETA M205 s1 (+ the M115 supplier panel it needs): WHAT A SUPPLIER ZONE SELLS, AND THE ONE-TIME BULK BUY (pure) ──
// Alex 11-23 (M115): a Supplier on the Nyx side sells raw goods IN BULK. Alex 11-26 (M205): "add a farmers market supplier for
// rootbulb and capgrain". M211: suppliers = smokehouses, lumberyards, quarry offices, farmers markets (raw goods).
//   · A supplier KIND is what a zone's tag ref names (world/builder-zones.ts ZoneTag, picked in the Nyx builder). This slice has ONE
//     kind, the farmers market, selling the canon staples Rootbulb + Capgrain (world/cuisine.md:19-20; ather/cooking.ts STAPLES).
//   · ONE-TIME BULK buy only (M115 way 1). The SEASON CONTRACT (M115 way 2: 'contract', never deed / standing order) is a later slice.
//   · This slice's lots go to the BAG (they cook at the hearth). M115's garden-bank delivery is for building materials, later.
//   · Jin's: lot sizes + prices (the Smokehouse's scale: a contract run buys a few lots). The market's NAME + who runs it are Magii's
//     (CANON_GAPS cooking part 2, open): the panel shows the zone's own tag name; no keeper, no lines.
// Marks leave the purse and the lot lands in the bag WHOLE, or nothing changes (half a lot is not a sale), like smokehouse.ts.
import { STAPLES } from '../ather/cooking'
import { give, type Inv } from '../shared/inventory'
import type { Ledger } from '../trade'

export interface Lot { id: string; n: number; price: number }
export interface SupplierKind { /** the builder dropdown's label (Alex's word, M205 / M211) */ label: string; lots: readonly Lot[] }

/** the supplier kinds a zone tag can name (tag.ref) */
export const SUPPLIER_KINDS: Readonly<Record<string, SupplierKind>> = {
  'farmers-market': { label: 'Farmers market', lots: [
    { id: 'rootbulb', n: 10, price: 200 },
    { id: 'capgrain', n: 10, price: 250 },
  ] },
}
export const supplierKind = (ref: string | undefined | null): SupplierKind | null => (ref && Object.prototype.hasOwnProperty.call(SUPPLIER_KINDS, ref) ? SUPPLIER_KINDS[ref] : null)
/** every good a farmers market sells is a canon staple */
export const MARKET_GOODS = Object.keys(STAPLES)

export type LotBuy = { ok: true; ledger: Ledger; inv: Inv } | { ok: false; why: string }
export function buyLot(ledger: Ledger, inv: Inv, kind: string, id: string): LotBuy {
  const lot = supplierKind(kind)?.lots.find(l => l.id === id)
  if (!lot) return { ok: false, why: 'Not sold here.' }
  if (ledger.marks < lot.price) return { ok: false, why: `It costs ${lot.price.toLocaleString()} Marks. You have ${ledger.marks.toLocaleString()}.` }
  const g = give(inv, id, lot.n)
  if (g.left > 0) return { ok: false, why: 'No room in the bag for the lot.' }
  return { ok: true, ledger: { ...ledger, marks: ledger.marks - lot.price }, inv: g.inv }
}
