// business/gun-shop.ts: the five base guns sell for Marks; owned / unsold / short purse are refused with nothing spent.
import { RANGE_GUNS, type RangeGun } from '../shared/gunplay'
import { newLoadout, slotOfGun } from '../shared/loadout'
import { NEW_LEDGER, type Ledger } from '../trade'
import { buyGun, GUN_PRICES } from './gun-shop'

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

console.log(`gun-shop: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
