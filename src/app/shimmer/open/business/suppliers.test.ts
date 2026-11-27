// Run: npx tsx src/app/shimmer/open/business/suppliers.test.ts
// BETA M205 s1: the Ather Trading Co. supplier (business/suppliers.ts) + the Rootbulb roast (ather/cooking.ts). Canon pins read the
// canon file: Rootbulb + Capgrain are cuisine.md's own names; a lot lands WHOLE in the bag or nothing changes.
import { readFileSync, existsSync } from 'node:fs'
import { SUPPLIER_KINDS, supplierKind, buyLot, MARKET_GOODS, METAL_LOTS } from './suppliers'
import { STAPLES, ROAST, DISHES, isDish } from '../ather/cooking'
import { roomAccepts } from '../ather/rooms'
import { OPEN_ITEMS, ITEM_GROUP, newInv, give, countOf, SLOTS } from '../shared/inventory'
import { NEW_LEDGER } from '../trade'
import { zoneUse, zonePrompt } from '../ather/zone-tags'
import { supplierChoices } from '../../dev/editors/zone-choices'
import { FRONT_SHOPS } from './doors'
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
const fm = SUPPLIER_KINDS['trade-co']
// M134 s2 moved this assert: the Trading Co. now ALSO carries the Smithy's edge metals, so 'exactly Rootbulb + Capgrain' became
// 'its food lots are exactly Rootbulb + Capgrain, and its other lots are exactly the two edge metals'
ok(!!fm && fm.lots.filter(l => MARKET_GOODS.includes(l.id)).map(l => l.id).sort().join() === 'capgrain,rootbulb', 'market: its food lots are not exactly Rootbulb + Capgrain')
ok(!!fm && fm.lots.filter(l => !MARKET_GOODS.includes(l.id)).map(l => l.id).sort().join() === [...METAL_LOTS].sort().join(), 'market: its non-food lots are not exactly the edge metals')
// M223 (RULED athernyx e3c310e): Venium + Eurleen are FOUND in the Ather, so the Co. sells neither (the panel lists fm.lots)
ok(!fm.lots.some(l => l.id === 'venium' || l.id === 'eurleen') && METAL_LOTS.length === 0, 'M223: the Co. still lists a Venium / Eurleen lot')
const noMetal = buyLot({ ...NEW_LEDGER, marks: 10_000 }, newInv(12), 'trade-co', 'venium')
ok(!noMetal.ok && noMetal.why === 'Not sold here.', 'M223: Venium can still be bought from the Co.')
ok(fm.lots.every(l => l.n >= 5 && l.price >= 100 && l.price <= 2_000), 'market: a lot is not bulk, or its price is off the Smokehouse scale')
ok(supplierKind('trade-co') === fm && supplierKind('toString') === null && supplierKind(undefined) === null && supplierKind('grain') === null, 'kind lookup: wrong (or reads the prototype)')
// buying
const rich = { ...NEW_LEDGER, marks: 10_000 }
const r1 = buyLot(rich, newInv(12), 'trade-co', 'rootbulb'), lot = fm.lots.find(l => l.id === 'rootbulb')!
ok(r1.ok && r1.ledger.marks === 10_000 - lot.price && countOf(r1.inv, 'rootbulb') === lot.n, 'buy: wrong Marks, or not the whole lot')
ok(rich.marks === 10_000, 'buy: mutated the ledger it was given')
const r2 = r1.ok ? buyLot(r1.ledger, r1.inv, 'trade-co', 'capgrain') : null
ok(!!r2?.ok && r2.ok && countOf(r2.inv, 'capgrain') === 10 && countOf(r2.inv, 'rootbulb') === 10 && r2.ledger.marks === 10_000 - 200 - 250, 'buy: two lots do not stack up')
const poor = buyLot({ ...NEW_LEDGER, marks: 10 }, newInv(12), 'trade-co', 'rootbulb')
ok(!poor.ok && /costs/.test(poor.why), 'buy: sold to a keeper who cannot pay')
ok(!buyLot(rich, newInv(12), 'trade-co', 'tuskroot_cut').ok && !buyLot(rich, newInv(12), 'quarry', 'rootbulb').ok, 'buy: sold what is not stocked, or at an unknown kind')
const packed = { v: 1 as const, slots: Array(SLOTS).fill(null).map(() => ({ id: 'blankstone', n: 99 })) }
const full = buyLot(rich, packed, 'trade-co', 'capgrain')
ok(!full.ok && /room/.test(full.why), 'buy: took Marks for a lot the bag could not hold')
// bag rows, the cooking room keeps them, Rootbulb roasts
ok(['rootbulb', 'capgrain', 'roast_rootbulb'].every(id => OPEN_ITEMS[id] && ITEM_GROUP[id] === 'cooking' && existsSync(`public${OPEN_ITEMS[id].icon}`)), 'items: a staple / roast is not a cooking bag row with an icon on disk')
ok(roomAccepts('cooking', 'rootbulb') && roomAccepts('cooking', 'capgrain'), 'room: the cooking store refuses a staple')
ok(ROAST.some(j => j.in.length === 1 && j.in[0].id === 'rootbulb' && j.in[0].n === 1 && j.out.id === 'roast_rootbulb') && isDish('roast_rootbulb') && DISHES.roast_rootbulb.heal > 0, 'hearth: 1 Rootbulb -> 1 Roast Rootbulb missing')
ok(!isDish('rootbulb') && !isDish('capgrain'), 'eat: a raw staple counts as a dish')
// the zone tag
ok(supplierChoices()[0]?.ref === 'trade-co' && supplierChoices()[0]?.name === FRONT_SHOPS['trade-co'].name && FRONT_SHOPS['trade-co'].name === 'Ather Trading Co.', 'builder: the existing Ather Trading Co. (its own name) is not the first supplier pick')
const u = zoneUse({ tag: { kind: 'supplier', ref: 'trade-co', name: 'Tagged Name' } })
ok(u?.kind === 'supplier' && u.name === 'Tagged Name' && u.sells === 'trade-co' && zonePrompt(u) === 'E · Tagged Name', 'zone: a Trading Co. supplier tag does not carry its kind + own name')
const u2 = zoneUse({ tag: { kind: 'supplier', ref: 'trade-co' } })
ok(u2?.kind === 'supplier' && u2.name === 'Ather Trading Co.' && u2.sells === 'trade-co', 'zone: a Trading Co. supplier tag with no name falls back to the kind label')
if (fails.length) { console.error(`suppliers: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`suppliers: ${pass}/0`)
