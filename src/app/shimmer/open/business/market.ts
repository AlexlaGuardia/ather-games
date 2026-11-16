// THE BUSINESS MARKET: which lots a town actually offers (play lane, 2026-11-16).
//
// ★ WHY A MARKET AND NOT EVERY LOT. towns/lots.ts makes every generated house sellable: ~1,700 of them, 270 in Gale
// Haven alone. A board on each is noise, and a keeper who can turn ANY house into ANY trade has nothing to find. So each
// town offers a few lots, and each lot is ALREADY a kind of business (Alex 11-16 agreed: "purchase a mine" = the place is
// a mine). Where the trades sit is the trial and error: a whole ore chain stands in Rune Hold under the Spine, a whole
// food chain in Shoalhaven, and everywhere else a chain means owning across towns (the gates carry goods between them).
//
// ★ THE TRADES PER TOWN are build (Jin's balance + flavour), read off the world's own lines where it has them: Rune Hold's
// soot and forge glow (rune-hold.md), Spine ore, southern grain, the cities as the counters. Not canon facts: no names,
// no NPCs. A village not in the table offers a farm and one food trade.
//
// ★ WHICH LOT: makers (mine, farm) take a lot at the town's EDGE (a yard needs room), sellers (shop, café) the lots
// nearest the core (the high street), turners the middle. Deterministic, so every keeper sees the same market.
//
// ★ PURE, node-safe. Offer ids are towns/lots.ts ids, the key the tycoon saves.
import type { Region } from '../region'
import { cachedPlan } from '../foot-solids'
import type { Building } from '../towns/plan'
import { lotsForSale, type Lot } from '../towns/lots'
import { BIZ, priceOf, type BizKind } from '../economy/tycoon'

/** trades a town offers, in the order its lots are handed out */
export const TOWN_TRADES: Record<string, BizKind[]> = {
  'rune-hold': ['mine', 'smithy', 'manalic_shop'],
  ashfeld: ['mine', 'farm', 'kitchen'],
  'unnamed-village-17': ['mine', 'farm'],     // Copperlee
  'unnamed-village-5': ['mine', 'farm'],      // Stonebarrow
  'unnamed-village-15': ['mine', 'farm'],     // Windle, the highest village
  citadel: ['manalic_shop', 'cafe', 'smithy', 'kitchen'],
  'gale-haven': ['manalic_shop', 'cafe', 'kitchen'],
  veradyn: ['cafe', 'manalic_shop', 'kitchen'],
  shoalhaven: ['farm', 'kitchen', 'cafe'],
}
const SELLS: BizKind[] = ['manalic_shop', 'cafe'], MAKES: BizKind[] = ['mine', 'farm']

/** the trades a town offers ([] for spots, schools and anything not a town) */
export function tradesOf(R: Region, townId: string): BizKind[] {
  const p = R.meta.places.find(q => q.id === townId)
  if (!p || !['village', 'settlement', 'city'].includes(p.kind)) return []
  if (TOWN_TRADES[townId]) return TOWN_TRADES[townId]
  let h = 0; for (const c of townId) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return ['farm', h % 2 ? 'kitchen' : 'cafe']
}

export interface Offer {
  lot: Lot
  /** the plan's building under the lot (for the dressing) */
  b: Building
  kind: BizKind
  /** `${town name} ${trade}`: unique, since a town never offers one trade twice */
  name: string
  /** the lot's size band is the business's tier: a bigger place costs more and works faster */
  price: number
}

const cache = new WeakMap<Region, Map<string, Offer[]>>()

/** The lots a town has up for sale, one per trade it offers. */
export function marketFor(R: Region, townId: string): Offer[] {
  let m = cache.get(R); if (!m) cache.set(R, m = new Map())
  const hit = m.get(townId); if (hit) return hit
  const out: Offer[] = []
  const trades = tradesOf(R, townId)
  const i = R.meta.places.findIndex(p => p.id === townId)
  if (trades.length && i >= 0) {
    // the same filter and order as lotsForSale, so the two lists zip
    const bs = cachedPlan(R, i).buildings.filter(b => !b.core && !b.front), lots = lotsForSale(R, townId)
    const town = R.meta.places[i].name ?? townId
    const taken = new Set<number>()
    for (const kind of trades) {
      // edge for makers, core for sellers, the middle for turners; a little size bias so a mine is not a shed
      const want = MAKES.includes(kind) ? 1 : SELLS.includes(kind) ? 0 : 0.5
      let best = -1, score = Infinity
      bs.forEach((b, k) => {
        if (taken.has(k)) return
        const s = Math.abs(b.rim - want) - lots[k].tier * 0.04 + b.v * 0.01
        if (s < score) { score = s; best = k }
      })
      if (best < 0) break
      taken.add(best)
      const lot = lots[best]
      out.push({ lot, b: bs[best], kind, name: `${town} ${BIZ[kind].name}`, price: priceOf(kind, lot.tier) })
    }
  }
  m.set(townId, out)
  return out
}

/** Every offer on the continent (the deed lookup and the journal). */
export function allOffers(R: Region): Offer[] {
  return R.meta.places.flatMap(p => marketFor(R, p.id))
}

export function offerById(R: Region, lotId: string): Offer | undefined {
  return marketFor(R, lotId.split(':')[0]).find(o => o.lot.id === lotId)
}
