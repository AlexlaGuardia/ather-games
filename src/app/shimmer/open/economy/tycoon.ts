// THE TYCOON LOOP, the core (Alex 11-15: "they can purchase up to 5 buildings not including shipyards.. but if they
// purchase a mine that feeds a moglin smithy ..then purchase a manalic shop to earn passive orders or set up a farm with
// the ingredients for a cooking moglin to feed a cafe and so on through trial and error the player can become a tycoon
// giving the player a wealthy feeling if they make the right moves and spend their marks eficiently").
//
// ★ THE SHAPE. Up to MAX_OWNED buildings (shipyards are not buildings here). Each one either MAKES a good, TURNS one good
// into a better one, or SELLS a finished good for Marks. Everything the keeper owns shares one store, so a chain works
// across towns (logistics by road / ship can come later). Two chains to find:
//     mine → ore → smithy → fittings → manalic shop → orders (Marks)
//     farm → produce → kitchen → meals → café → covers (Marks)
// ★ WHY IT FEELS LIKE A TYCOON: a lone building earns a trickle (a mine sells its ore raw, cheap; a shop gets walk-ins),
// a finished chain earns several times its parts, and EVERY building costs upkeep, so a bad mix (a smithy with no ore,
// a café with no kitchen) loses money. Trial and error is the game; Marks spent well are the reward.
//
// ⚖ CANON (CANON_GAPS › "the Nyx-side tycoon loop"): ★ ALEX ANSWERED (1) 11-15, verbatim: *"no the mogling dont work in
// the business, if the player buys a business it gets a gate that the moglin can drop off or recieve goods"*. So EVERY
// owned place has a GATE, and the shared store below IS that gate network: the garden's Moglins carry goods through the
// gates (that is how one keeper's mine feeds their smithy in another town). No Moglin works inside a business; WHO staffs
// one is still open with Magii, so staffing stays abstract here. (2) keeper-owned trade and (3) the water world: still
// [OPEN]. The kinds wear plain working names until ruled. Marks are canon (the one coin); ore + produce map onto canon's mortal goods (Spine ore, southern grain).
// Numbers are Jin's balance, tuned to the trade's scale (a courser part is 150 / 420 / 950 Marks, trade.ts): a whole
// chain nets ~11 Marks a minute (~660 an hour), a lone maker ~1, a lone turner LOSES its upkeep. ⚠ First cut paid ~25 a
// minute: 12k Marks over one night offline, which would have made every contract run pointless.
//
// ★ PURE. Time comes in as ms; the caller keeps the Marks (the trade ledger's wallet) and passes them in and out.

export type BizKind = 'mine' | 'smithy' | 'manalic_shop' | 'farm' | 'kitchen' | 'cafe'
export type Ware = 'ore' | 'fittings' | 'produce' | 'meals'

export interface BizDef {
  kind: BizKind
  name: string
  blurb: string
  price: number                                    // Marks, tier 0
  upkeep: number                                   // Marks a minute, whatever it does
  makes?: { ware: Ware; per: number }              // units a minute from nothing (mine, farm)
  turns?: { from: Ware; take: number; into: Ware } // one turn a minute when the store has `take` (smithy, kitchen)
  sells?: { ware: Ware; price: number }            // one sale a minute when the store has one (shop, café)
  walkIn: number                                   // Marks a minute with nothing to sell (shop, café) or for raw (mine, farm: per unit sold raw)
}

export const BIZ: Record<BizKind, BizDef> = {
  mine:         { kind: 'mine', name: 'Mine', blurb: 'Digs ore. Alone it sells the ore raw, cheap.', price: 600, upkeep: 1, makes: { ware: 'ore', per: 2 }, walkIn: 1 },
  smithy:       { kind: 'smithy', name: 'Smithy', blurb: 'Works ore into fittings. Needs ore coming in.', price: 900, upkeep: 1, turns: { from: 'ore', take: 2, into: 'fittings' }, walkIn: 0 },
  manalic_shop: { kind: 'manalic_shop', name: 'Manalic shop', blurb: 'Fills orders with fittings. Without stock it only gets walk-ins.', price: 1400, upkeep: 1, sells: { ware: 'fittings', price: 14 }, walkIn: 1 },
  farm:         { kind: 'farm', name: 'Farm', blurb: 'Grows produce. Alone it sells the produce raw, cheap.', price: 500, upkeep: 1, makes: { ware: 'produce', per: 2 }, walkIn: 0.75 },
  kitchen:      { kind: 'kitchen', name: 'Kitchen', blurb: 'Cooks produce into meals. Needs produce coming in.', price: 800, upkeep: 1, turns: { from: 'produce', take: 2, into: 'meals' }, walkIn: 0 },
  cafe:         { kind: 'cafe', name: 'Café', blurb: 'Serves meals. Without stock it only gets walk-ins.', price: 1200, upkeep: 1, sells: { ware: 'meals', price: 12 }, walkIn: 1 },
}
export const BIZ_KINDS = Object.keys(BIZ) as BizKind[]
export const MAX_OWNED = 5
/** A lot's tier (from the town plans): a bigger lot costs more and works faster. */
export const TIER_PRICE = [1, 1.6, 2.4] as const
export const TIER_RATE = [1, 1.3, 1.7] as const
/** Selling back returns this share of what you paid. */
export const RESALE = 0.5
/** Offline catch-up stops here: the shops do not run a fortune up while you are away for a week. */
export const MAX_CATCHUP_MIN = 4 * 60
/** Raw goods sold off when the store holds more than this (a mine that cannot keep it sells it cheap). */
export const STORE_CAP = 60

export interface Owned { lotId: string; kind: BizKind; tier: 0 | 1 | 2; paid: number }
export interface Tycoon { v: 1; owned: Owned[]; store: Record<Ware, number>; lastMin: number; earned: number }
export const newTycoon = (nowMs: number): Tycoon => ({ v: 1, owned: [], store: { ore: 0, fittings: 0, produce: 0, meals: 0 }, lastMin: Math.floor(nowMs / 60000), earned: 0 })

export const priceOf = (kind: BizKind, tier: 0 | 1 | 2) => Math.round(BIZ[kind].price * TIER_PRICE[tier])

export type BuyVerdict = { ok: true; cost: number } | { ok: false; why: string }
export function canBuy(t: Tycoon, lotId: string, kind: BizKind, tier: 0 | 1 | 2, marks: number): BuyVerdict {
  if (t.owned.some(o => o.lotId === lotId)) return { ok: false, why: 'You already own this place.' }
  if (t.owned.length >= MAX_OWNED) return { ok: false, why: `You own ${MAX_OWNED} places already. Sell one to buy another.` }
  const cost = priceOf(kind, tier)
  if (marks < cost) return { ok: false, why: `It costs ${cost} Marks. You have ${Math.floor(marks)}.` }
  return { ok: true, cost }
}
export function buy(t: Tycoon, lotId: string, kind: BizKind, tier: 0 | 1 | 2, marks: number): { ok: true; t: Tycoon; marks: number } | { ok: false; why: string } {
  const v = canBuy(t, lotId, kind, tier, marks)
  if (!v.ok) return v
  return { ok: true, t: { ...t, owned: [...t.owned, { lotId, kind, tier, paid: v.cost }] }, marks: marks - v.cost }
}
export function sell(t: Tycoon, lotId: string, marks: number): { ok: true; t: Tycoon; marks: number; refund: number } | { ok: false; why: string } {
  const o = t.owned.find(x => x.lotId === lotId)
  if (!o) return { ok: false, why: 'You do not own this place.' }
  const refund = Math.floor(o.paid * RESALE)
  return { ok: true, t: { ...t, owned: t.owned.filter(x => x !== o) }, marks: marks + refund, refund }
}

/** One minute of every owned building, in chain order (makers → turners → sellers), so a full chain moves a unit
 *  from the ground to the counter within the minute. Returns Marks earned net of upkeep (can be negative). */
function minute(t: Tycoon): number {
  const s = t.store
  let net = 0
  const by = (k: BizKind) => t.owned.filter(o => o.kind === k)
  for (const k of ['mine', 'farm'] as BizKind[]) for (const o of by(k)) s[BIZ[k].makes!.ware] += BIZ[k].makes!.per * TIER_RATE[o.tier]
  for (const k of ['smithy', 'kitchen'] as BizKind[]) for (const o of by(k)) {
    const tr = BIZ[k].turns!
    let turns = TIER_RATE[o.tier]
    while (turns > 0 && s[tr.from] >= tr.take * Math.min(1, turns)) { const f = Math.min(1, turns); s[tr.from] -= tr.take * f; s[tr.into] += f; turns -= f }
  }
  for (const k of ['manalic_shop', 'cafe'] as BizKind[]) for (const o of by(k)) {
    const sl = BIZ[k].sells!
    let sales = TIER_RATE[o.tier]
    if (s[sl.ware] <= 0) { net += BIZ[k].walkIn * TIER_RATE[o.tier]; continue }
    while (sales > 0 && s[sl.ware] > 0) { const f = Math.min(1, sales, s[sl.ware]); s[sl.ware] -= f; net += sl.price * f; sales -= f }
  }
  // raw goods nobody turns pile up: past the store's cap they are sold off at the raw price (the trickle a lone maker earns)
  for (const [ware, k] of [['ore', 'mine'], ['produce', 'farm']] as [Ware, BizKind][]) {
    const turner = ware === 'ore' ? 'smithy' : 'kitchen'
    if (by(turner).length) continue
    if (s[ware] > 0) { net += s[ware] * BIZ[k].walkIn; s[ware] = 0 }   // no one to turn it: sold raw as it comes up
  }
  // more raw than the turners keep up with: past the store's cap the surplus is sold raw (a second mine is never wasted);
  // finished goods past the cap simply wait (the shop / café is the bottleneck, which is a hint to the keeper)
  for (const [ware, k] of [['ore', 'mine'], ['produce', 'farm']] as [Ware, BizKind][]) if (s[ware] > STORE_CAP) { net += (s[ware] - STORE_CAP) * BIZ[k].walkIn; s[ware] = STORE_CAP }
  for (const w of ['fittings', 'meals'] as Ware[]) if (s[w] > STORE_CAP) s[w] = STORE_CAP
  for (const o of t.owned) net -= BIZ[o.kind].upkeep
  return net
}

/** Run the businesses up to now: whole minutes since the last run, capped at MAX_CATCHUP_MIN. */
export function tick(t: Tycoon, nowMs: number, marks: number): { t: Tycoon; marks: number; net: number; minutes: number } {
  const now = Math.floor(nowMs / 60000), n = Math.max(0, Math.min(MAX_CATCHUP_MIN, now - t.lastMin))
  const next: Tycoon = { ...t, store: { ...t.store }, lastMin: now }
  let net = 0
  for (let k = 0; k < n; k++) net += minute(next)
  // a wallet never goes below zero from upkeep: the hands go unpaid instead (and the keeper sees the loss in `net`)
  const after = Math.max(0, marks + net)
  next.earned = t.earned + net
  return { t: next, marks: after, net, minutes: n }
}

/** Marks a minute this set of buildings makes at steady state (the "what if I buy this" readout). */
export function rateOf(owned: Owned[]): number {
  const t: Tycoon = { v: 1, owned, store: { ore: 0, fittings: 0, produce: 0, meals: 0 }, lastMin: 0, earned: 0 }
  for (let k = 0; k < 10; k++) minute(t)                     // warm the store up
  let sum = 0; for (let k = 0; k < 60; k++) sum += minute(t)
  return sum / 60
}
