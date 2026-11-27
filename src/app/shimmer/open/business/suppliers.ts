// ── BETA M205 s1 (+ the M115 supplier panel it needs): WHAT A SUPPLIER ZONE SELLS, AND THE ONE-TIME BULK BUY (pure) ──
// Alex 11-23 (M115): a Supplier on the Nyx side sells raw goods IN BULK. Alex 11-26 (M205): "add a farmers market supplier for
// rootbulb and capgrain". RULED athernyx 35c83eb (game/alchemy.md › THE COOKING ROAD, Nyx-side kitchen): Rootbulb + Capgrain are
// mortal crops "shipped in by Benji's Ather Trading Co. (the Nyx suppliers)": the stock-holder is the EXISTING Trading Co. (doors.ts
// FRONT_SHOPS['trade-co'], its own name), never a newly named market.
//   · A supplier KIND is what a zone's tag ref names (world/builder-zones.ts ZoneTag, picked in the Nyx builder). This slice has ONE
//     kind, 'trade-co', selling the canon staples Rootbulb + Capgrain (world/cuisine.md:19-20; ather/cooking.ts STAPLES).
//   · ONE-TIME BULK buy here (M115 way 1). The SEASON CONTRACT (M115 way 2) = business/contracts.ts (M115 s2).
//   · This slice's lots go to the BAG (they cook at the hearth). M115's garden-bank delivery is for building materials, later.
//   · Jin's: lot sizes + prices (the Smokehouse's scale: a contract run buys a few lots). The panel shows the zone's own tag name
//     (default: the Trading Co.'s own name); no keeper speaks, no lines.
// Marks leave the purse and the lot lands in the bag WHOLE, or nothing changes (half a lot is not a sale), like smokehouse.ts.
import { STAPLES } from '../ather/cooking'
import { FRONT_SHOPS } from './doors'
import { give, type Inv } from '../shared/inventory'
import type { Ledger } from '../trade'

export interface Lot { id: string; n: number; price: number }
export interface SupplierKind { /** the builder dropdown's label (the stock-holder's canon name) */ label: string; lots: readonly Lot[] }

/** the supplier kinds a zone tag can name (tag.ref) */
export const SUPPLIER_KINDS: Readonly<Record<string, SupplierKind>> = {
  'trade-co': { label: FRONT_SHOPS['trade-co'].name, lots: [
    { id: 'rootbulb', n: 10, price: 200 },
    { id: 'capgrain', n: 10, price: 250 },
    // ★ M223 (RULED athernyx e3c310e, 11-27): the Venium + Eurleen lots CAME OUT. They are the Ather's mana-grown metals, FOUND
    // (mined from seams the owner paints, prospecting.ts METAL_KINDS), not bought from the Co.; the Spine/Valkara sources retired.
  ] },
}
export const supplierKind = (ref: string | undefined | null): SupplierKind | null => (ref && Object.prototype.hasOwnProperty.call(SUPPLIER_KINDS, ref) ? SUPPLIER_KINDS[ref] : null)
/** the canon staples the Trading Co. supplier sells (its food lots) */
export const MARKET_GOODS = Object.keys(STAPLES)
/** M134 s2 -> M223: the edge metals it sells: NONE now (they are found in the Ather, never sold here); suppliers.test holds it */
export const METAL_LOTS = [] as const

export type LotBuy = { ok: true; ledger: Ledger; inv: Inv } | { ok: false; why: string }
/** `price` (M115 s2): the lot's price now (business/contracts.ts bulkPrice: 20% off while a season contract there runs) */
export function buyLot(ledger: Ledger, inv: Inv, kind: string, id: string, price?: number): LotBuy {
  const lot = supplierKind(kind)?.lots.find(l => l.id === id)
  if (!lot) return { ok: false, why: 'Not sold here.' }
  const cost = price ?? lot.price
  if (ledger.marks < cost) return { ok: false, why: `It costs ${cost.toLocaleString()} Marks. You have ${ledger.marks.toLocaleString()}.` }
  const g = give(inv, id, lot.n)
  if (g.left > 0) return { ok: false, why: 'No room in the bag for the lot.' }
  return { ok: true, ledger: { ...ledger, marks: ledger.marks - cost }, inv: g.inv }
}
