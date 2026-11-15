// The tycoon core (Alex 11-15). Run: npx tsx src/app/shimmer/open/economy/tycoon.test.ts
import { BIZ, MAX_OWNED, MAX_CATCHUP_MIN, RESALE, newTycoon, buy, sell, canBuy, tick, rateOf, priceOf, type Owned, type BizKind } from './tycoon'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const o = (...k: BizKind[]): Owned[] => k.map((kind, i) => ({ lotId: 'l' + i, kind, tier: 0 as const, paid: 0 }))

// the shape Alex named: a mine feeds a smithy feeds a manalic shop; a farm feeds a kitchen feeds a café
ok(BIZ.smithy.turns?.from === 'ore' && BIZ.manalic_shop.sells?.ware === BIZ.smithy.turns?.into, 'chain: the smithy does not turn the mine\'s ore into what the shop sells')
ok(BIZ.kitchen.turns?.from === 'produce' && BIZ.cafe.sells?.ware === BIZ.kitchen.turns?.into, 'chain: the kitchen does not feed the café')
ok(MAX_OWNED === 5, 'cap: not five places')

// ★ a chain earns more than its parts alone, and a lone turner loses money (trial and error)
const chain = rateOf(o('mine', 'smithy', 'manalic_shop')), parts = rateOf(o('mine')) + rateOf(o('smithy')) + rateOf(o('manalic_shop'))
ok(chain > parts * 3, `chain: the ore chain (${chain.toFixed(1)}/min) is not well above its parts alone (${parts.toFixed(1)})`)
ok(rateOf(o('farm', 'kitchen', 'cafe')) > rateOf(o('farm')) * 5, 'chain: the food chain does not beat a lone farm by far')
ok(rateOf(o('smithy')) < 0 && rateOf(o('kitchen')) < 0, 'trial and error: a turner with nothing to turn does not lose money')
ok(rateOf(o('mine')) > 0 && rateOf(o('farm')) > 0, 'a lone maker does not earn its trickle')
// both chains need six buildings: the cap forces a choice
ok(o('mine', 'smithy', 'manalic_shop', 'farm', 'kitchen', 'cafe').length > MAX_OWNED, 'cap: both chains fit under the cap (no choice to make)')
// the scale: a chain must not swamp the trade (a courser part is 150 / 420 / 950 Marks)
ok(chain < 20 && chain * MAX_CATCHUP_MIN < 6000, `scale: the ore chain pays ${chain.toFixed(1)}/min, ${Math.round(chain * MAX_CATCHUP_MIN)} over a catch-up`)

// buying and selling
let t = newTycoon(0), marks = 5000
const b1 = buy(t, 'ashfeld:3', 'mine', 0, marks)
ok(b1.ok && b1.marks === 5000 - priceOf('mine', 0) && b1.t.owned.length === 1, 'buy: a mine did not cost its price')
if (b1.ok) { t = b1.t; marks = b1.marks }
ok(!canBuy(t, 'ashfeld:3', 'farm', 0, marks).ok, 'buy: bought a lot already owned')
ok(!canBuy(t, 'ashfeld:4', 'manalic_shop', 0, 100).ok, 'buy: bought without the Marks')
ok(priceOf('mine', 2) > priceOf('mine', 0), 'tier: a bigger lot does not cost more')
let full = t; let m2 = 1e6
for (let k = 0; k < MAX_OWNED - 1; k++) { const r = buy(full, `rh:${k}`, 'farm', 0, m2); if (r.ok) { full = r.t; m2 = r.marks } }
ok(full.owned.length === MAX_OWNED && !canBuy(full, 'rh:9', 'farm', 0, m2).ok, 'cap: a sixth place was for sale')
const s1 = sell(t, 'ashfeld:3', 0)
ok(s1.ok && s1.refund === Math.floor(priceOf('mine', 0) * RESALE) && s1.t.owned.length === 0, 'sell: the refund is not half what was paid')

// time: whole minutes since the last run, capped while away, a wallet never pushed below zero by upkeep
const c0 = { ...newTycoon(0), owned: o('mine', 'smithy', 'manalic_shop') }
const r10 = tick(c0, 10 * 60000, 0)
ok(r10.minutes === 10 && r10.net > 0 && r10.marks === r10.net, 'tick: ten minutes of a chain did not pay')
const away = tick(c0, 30 * 24 * 60 * 60000, 0)
ok(away.minutes === MAX_CATCHUP_MIN, `tick: a month away ran ${away.minutes} minutes (cap ${MAX_CATCHUP_MIN})`)
const lose = tick({ ...newTycoon(0), owned: o('smithy', 'kitchen') }, 60 * 60000, 10)
ok(lose.net < 0 && lose.marks === 0, 'tick: upkeep with nothing earning did not cost, or drove the wallet below zero')
ok(tick(r10.t, 10 * 60000, 0).minutes === 0, 'tick: the same minute ran twice')

if (fails.length) { console.error(`tycoon: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`tycoon: ${pass}/0`)
