// Run: npx tsx src/app/shimmer/open/business/suppliers.test.ts
// BETA M205 s1: the farmers market supplier (business/suppliers.ts) + the Rootbulb roast (ather/cooking.ts). Canon pins read the
// canon file: Rootbulb + Capgrain are cuisine.md's own names; a lot lands WHOLE in the bag or nothing changes.
import { readFileSync, existsSync } from 'node:fs'
import { SUPPLIER_KINDS, supplierKind, buyLot, MARKET_GOODS } from './suppliers'
import { STAPLES, ROAST, DISHES, isDish } from '../ather/cooking'
import { roomAccepts } from '../ather/rooms'
import { OPEN_ITEMS, ITEM_GROUP, newInv, give, countOf, SLOTS } from '../shared/inventory'
import { NEW_LEDGER } from '../trade'
import { zoneUse, zonePrompt } from '../ather/zone-tags'
import { supplierChoices } from '../../dev/editors/zone-choices'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// canon: the names are cuisine.md's, word for word
const CUISINE = '/root/athernyx/CANON/world/cuisine.md'
if (existsSync(CUISINE)) {
  const c = readFileSync(CUISINE, 'utf8')
  ok(/\| \*\*Rootbulb\*\* \| Potato \|/.test(c) && /\| \*\*Capgrain\*\* \| Wheat\/rice \|/.test(c), 'canon: cuisine.md no longer names Rootbulb / Capgrain')
  ok(STAPLES.rootbulb.name === 'Rootbulb' && STAPLES.capgrain.name === 'Capgrain', 'canon: a staple name drifted from cuisine.md')
}
ok(MARKET_GOODS.sort().join() === 'capgrain,rootbulb', 'staples: something other than Rootbulb + Capgrain')
// the kind
const fm = SUPPLIER_KINDS['farmers-market']
ok(!!fm && fm.lots.map(l => l.id).sort().join() === 'capgrain,rootbulb', 'market: does not sell exactly Rootbulb + Capgrain')
ok(fm.lots.every(l => l.n >= 5 && l.price >= 100 && l.price <= 2_000), 'market: a lot is not bulk, or its price is off the Smokehouse scale')
ok(supplierKind('farmers-market') === fm && supplierKind('toString') === null && supplierKind(undefined) === null && supplierKind('grain') === null, 'kind lookup: wrong (or reads the prototype)')
// buying
const rich = { ...NEW_LEDGER, marks: 10_000 }
const r1 = buyLot(rich, newInv(12), 'farmers-market', 'rootbulb'), lot = fm.lots.find(l => l.id === 'rootbulb')!
ok(r1.ok && r1.ledger.marks === 10_000 - lot.price && countOf(r1.inv, 'rootbulb') === lot.n, 'buy: wrong Marks, or not the whole lot')
ok(rich.marks === 10_000, 'buy: mutated the ledger it was given')
const r2 = r1.ok ? buyLot(r1.ledger, r1.inv, 'farmers-market', 'capgrain') : null
ok(!!r2?.ok && r2.ok && countOf(r2.inv, 'capgrain') === 10 && countOf(r2.inv, 'rootbulb') === 10 && r2.ledger.marks === 10_000 - 200 - 250, 'buy: two lots do not stack up')
const poor = buyLot({ ...NEW_LEDGER, marks: 10 }, newInv(12), 'farmers-market', 'rootbulb')
ok(!poor.ok && /costs/.test(poor.why), 'buy: sold to a keeper who cannot pay')
ok(!buyLot(rich, newInv(12), 'farmers-market', 'tuskroot_cut').ok && !buyLot(rich, newInv(12), 'quarry', 'rootbulb').ok, 'buy: sold what is not stocked, or at an unknown kind')
const packed = { v: 1 as const, slots: Array(SLOTS).fill(null).map(() => ({ id: 'blankstone', n: 99 })) }
const full = buyLot(rich, packed, 'farmers-market', 'capgrain')
ok(!full.ok && /room/.test(full.why), 'buy: took Marks for a lot the bag could not hold')
// bag rows, the cooking room keeps them, Rootbulb roasts
ok(['rootbulb', 'capgrain', 'roast_rootbulb'].every(id => OPEN_ITEMS[id] && ITEM_GROUP[id] === 'cooking' && existsSync(`public${OPEN_ITEMS[id].icon}`)), 'items: a staple / roast is not a cooking bag row with an icon on disk')
ok(roomAccepts('cooking', 'rootbulb') && roomAccepts('cooking', 'capgrain'), 'room: the cooking store refuses a staple')
ok(ROAST.some(j => j.in.length === 1 && j.in[0].id === 'rootbulb' && j.in[0].n === 1 && j.out.id === 'roast_rootbulb') && isDish('roast_rootbulb') && DISHES.roast_rootbulb.heal > 0, 'hearth: 1 Rootbulb -> 1 Roast Rootbulb missing')
ok(!isDish('rootbulb') && !isDish('capgrain'), 'eat: a raw staple counts as a dish')
// the zone tag
ok(supplierChoices()[0]?.ref === 'farmers-market' && supplierChoices()[0]?.name === 'Farmers market', 'builder: Farmers market is not the first supplier pick')
const u = zoneUse({ tag: { kind: 'supplier', ref: 'farmers-market', name: 'North Market' } })
ok(u?.kind === 'supplier' && u.name === 'North Market' && u.sells === 'farmers-market' && zonePrompt(u) === 'E · North Market', 'zone: a market tag does not carry its kind + own name')
const u2 = zoneUse({ tag: { kind: 'supplier', ref: 'farmers-market' } })
ok(u2?.kind === 'supplier' && u2.name === 'Farmers market' && u2.sells === 'farmers-market', 'zone: a market tag with no name falls back to the kind label')
if (fails.length) { console.error(`suppliers: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`suppliers: ${pass}/0`)
