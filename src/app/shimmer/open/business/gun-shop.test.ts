// business/gun-shop.ts: the five base guns sell for Marks; owned / unsold / short purse are refused with nothing spent.
import { RANGE_GUNS, type RangeGun } from '../shared/gunplay'
import { newLoadout, slotOfGun } from '../shared/loadout'
import { NEW_LEDGER, type Ledger } from '../trade'
import { give, countOf, newInv, SLOTS } from '../shared/inventory'
import { buyGun, buySigil, GUN_PRICES, SIGIL_PRICE, buySight, stockOf, shopGunsOf, SIGHT_PRICES, GUNSHOP_STOCK, DEFAULT_STOCK } from './gun-shop'
import { ownedSights } from '../shared/gun-fit'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const rich = (n: number): Ledger => ({ ...NEW_LEDGER, marks: n })
const BASE = ['repeater', 'spitter', 'backbone', 'roar', 'lance']
const slotOf = (id: string) => slotOfGun(RANGE_GUNS.find(g => g.id === id) as RangeGun)

for (const id of BASE) ok(typeof GUN_PRICES[id] === 'number' && GUN_PRICES[id] > 0, `${id} has a price`)
ok(GUN_PRICES.repeater === Math.min(...BASE.map(i => GUN_PRICES[i])), 'the Repeater is the cheapest')
ok(GUN_PRICES.lance === Math.max(...BASE.map(i => GUN_PRICES[i])), 'the Lance is the dearest')

// buy succeeds and spends exactly the price
const base = newLoadout(), L0 = rich(10000)
const r = buyGun(base, L0, 'spitter')
ok(r.ok, 'the Spitter sells')
ok(r.ledger.marks === 10000 - GUN_PRICES.spitter, 'spends exactly the price')
ok(r.loadout.guns.includes('spitter'), 'the Spitter is in the bag of guns')
ok(base.guns.length === 1 && L0.marks === 10000, 'inputs are not mutated')

// already owned
const again = buyGun(r.loadout, r.ledger, 'spitter')
ok(!again.ok && again.why === 'Already yours.', 'owned is refused')
ok(again.ledger.marks === r.ledger.marks && again.loadout.guns.length === r.loadout.guns.length, 'owned: nothing spent, nothing added')
const own = buyGun(base, L0, 'repeater')   // the starter gun
ok(!own.ok && own.ledger.marks === 10000, 'the starting Repeater is already yours')

// short purse
const poor = buyGun(base, rich(GUN_PRICES.lance - 1), 'lance')
ok(!poor.ok && poor.ledger.marks === GUN_PRICES.lance - 1 && !poor.loadout.guns.includes('lance'), 'short purse: refused, nothing spent')
ok(/4,500|4500/.test(poor.why ?? ''), `short purse says the price (${poor.why})`)
ok(buyGun(base, rich(GUN_PRICES.lance), 'lance').ok, 'exact purse is enough')

// not for sale
for (const id of ['charred-rifle', 'nope', '']) {
  const x = buyGun(base, rich(99999), id)
  ok(!x.ok && x.ledger.marks === 99999 && x.loadout.guns.length === base.guns.length, `"${id}" is not for sale`)
}

// slots: an empty one is filled, a filled one is left alone
ok(base.primary === null && base.secondary === 'repeater', 'fixture: a new keeper has an empty primary, a filled secondary')
const pri = BASE.find(i => slotOf(i) === 'primary')!, sec = BASE.find(i => slotOf(i) === 'secondary' && i !== 'repeater')
const bp = buyGun(base, L0, pri)
ok(bp.ok && bp.loadout.primary === pri, `an empty primary gets the ${pri}`)
const bp2 = buyGun(bp.loadout, bp.ledger, BASE.find(i => slotOf(i) === 'primary' && i !== pri)!)
ok(bp2.ok && bp2.loadout.primary === pri, 'a filled primary is left alone')
if (sec) { const bs = buyGun(base, L0, sec); ok(bs.ok && bs.loadout.secondary === 'repeater', 'a filled secondary is left alone') }
const bare = { ...base, secondary: null }
const bs2 = buyGun({ ...bare, guns: [] }, L0, 'repeater')
ok(bs2.ok && bs2.loadout.secondary === 'repeater', 'an empty secondary gets the sidearm')

// M93 s2: the blank sigil
{
  const inv0 = newInv(), L = rich(1000)
  const b = buySigil(L, inv0)
  ok(b.ok && b.ledger.marks === 1000 - SIGIL_PRICE, 'sigil: Marks down by exactly the price')
  ok(countOf(b.inv, 'sigil_blank') === 1, 'sigil: one lands in the bag')
  const s = buySigil(rich(SIGIL_PRICE - 1), inv0)
  ok(!s.ok && !!s.why && s.why.includes('Marks') && s.ledger.marks === SIGIL_PRICE - 1 && s.inv === inv0, 'sigil: short Marks refused, nothing changed')
  let full = newInv(); for (let i = 0; i < SLOTS; i++) full = give(full, 'repeater', 1).inv
  const f = buySigil(L, full)
  ok(!f.ok && f.ledger.marks === 1000 && countOf(f.inv, 'sigil_blank') === 0, 'sigil: full bag refused, nothing changed')
  const b2 = buySigil(b.ledger, b.inv)
  ok(b2.ok && countOf(b2.inv, 'sigil_blank') === 2 && b2.ledger.marks === 1000 - 2 * SIGIL_PRICE, 'sigil: two buys stack to 2')
}


// ── M81 s3a: sights at the five sight dealers ──
{
  const withBB = { ...newLoadout(), guns: ['repeater', 'backbone'], kael: true }
  const L = rich(2000)
  ok(Object.keys(GUNSHOP_STOCK).length === 5, `five sight dealers (${Object.keys(GUNSHOP_STOCK)})`)
  ok(stockOf('unnamed-village-0') === DEFAULT_STOCK && DEFAULT_STOCK.sights.length === 0 && shopGunsOf('unnamed-village-0').length === 5, 'any other gun shop: the five guns, no sights')
  ok(Object.values(GUNSHOP_STOCK).every(s => s.sights.length >= 1 && s.sights.length <= 2 && s.guns.length >= 4), 'each dealer: 1-2 sights, a slightly different gun list')
  ok(new Set(Object.values(GUNSHOP_STOCK).map(s => s.guns.join())).size >= 3, 'the dealers do not all sell the same guns')
  ok(shopGunsOf('ashfeld').some(g => g.id === 'spitter'), 'Ashfeld still sells the Spitter (gunshop-check buys it there)')
  const b = buySight(withBB, L, 'rune-hold', 'backbone', 'lens')
  ok(b.ok && b.ledger.marks === 2000 - SIGHT_PRICES.lens && ownedSights(b.loadout, 'backbone').includes('lens'), 'Rune Hold: the lens for the Backbone, Marks down by its price, owned')
  ok(!buySight(b.loadout, b.ledger, 'rune-hold', 'backbone', 'lens').ok, 'a second buy: already yours')
  ok(!buySight(withBB, L, 'ashfeld', 'backbone', 'lens').ok, 'not stocked in this town: refused')
  ok(!buySight(withBB, L, 'veradyn', 'charred-rifle', 'lens').ok, 'a sight for a gun you do not have: refused')
  const poor = buySight(withBB, rich(SIGHT_PRICES.lens - 1), 'rune-hold', 'backbone', 'lens')
  ok(!poor.ok && poor.ledger.marks === SIGHT_PRICES.lens - 1 && !ownedSights(poor.loadout, 'backbone').includes('lens'), 'short Marks: refused, nothing changed')
  ok(!buySight(withBB, L, 'rune-hold', 'backbone', 'hood').ok, "a free sight is never sold (the Backbone's hood)")
  const cit = buySight(withBB, L, 'citadel', 'backbone', 'ring')
  ok(cit.ok && ownedSights(cit.loadout, 'backbone').includes('ring'), "the Citadel sells the Charred Rifle's ring for the Backbone")
}

console.log(`gun-shop: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
