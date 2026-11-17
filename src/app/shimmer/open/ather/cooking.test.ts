// Run: npx tsx src/app/shimmer/open/ather/cooking.test.ts
// The cooking room's hearth + the Smokehouse (ather/cooking.ts, business/smokehouse.ts). Canon pins: the hearth ROASTS,
// Shimmerscale is the one rinn that roasts (Glowfin / Moonkoi are spirit food, never a roast row), the Smokehouse sells
// only the three farmed kinds, by the bundle, and nothing roasts a follower species.
import { DISHES, MEATS, ROAST, SMOKEHOUSE_STOCK, isDish, healOf } from './cooking'
import { ROOMS, roomAccepts, freshWorks, craftAt, type Works, type Room } from './rooms'
import { buyBundle } from '../business/smokehouse'
import { FRONT_SHOPS } from '../business/doors'
import { OPEN_ITEMS, ITEM_GROUP, newInv, give, countOf, SLOTS } from '../shared/inventory'
import { NEW_LEDGER } from '../trade'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// canon
ok(ROAST.some(j => j.in[0].id === 'shimmerscale' && j.out.id === 'roast_rinn'), 'canon: 1 Shimmerscale → 1 Roast Rinn is missing')
ok(!ROAST.some(j => j.in.some(c => c.id === 'glowfin' || c.id === 'moonkoi')), 'canon: a spirit-food rinn roasts (Glowfin / Moonkoi stay raw)')
ok(Object.keys(MEATS).sort().join() === 'drifthorn_cut,hearthwing_eggs,tuskroot_cut', 'canon: the Smokehouse sells something other than the three farmed kinds')
ok(!Object.keys({ ...MEATS, ...DISHES }).some(id => /dustwhisker|sporeling/.test(id)), 'canon: a follower species is food')
ok(SMOKEHOUSE_STOCK.every(b => b.id in MEATS && b.n > 1), 'stock: a Smokehouse line is not a bundle of farmed meat')
ok(FRONT_SHOPS.smokehouse?.name === 'The Smokehouse', 'doors: no Smokehouse storefront')
// every roast job is 1 in → 1 dish out, every dish is made by a job, every dish heals
ok(ROAST.every(j => j.in.length === 1 && j.in[0].n === 1 && j.out.n === 1 && isDish(j.out.id)), 'roast: a job is not 1 → 1 dish')
ok(Object.keys(DISHES).every(id => ROAST.some(j => j.out.id === id)), 'roast: a dish nothing makes')
ok(Object.keys(DISHES).every(id => healOf(id) > 0 && healOf(id) < 100), 'heal: a dish heals nothing, or a whole bar')
ok(healOf('roast_tuskroot') > healOf('roast_drifthorn') && healOf('roast_drifthorn') > healOf('roast_rinn') && healOf('roast_rinn') > healOf('roast_eggs'), 'heal: the ladder is out of order')
ok(!isDish('shimmerscale') && !isDish('drifthorn_cut') && !isDish(null), 'eat: raw food counts as a dish')
// bag rows + room
ok(Object.keys({ ...MEATS, ...DISHES }).every(id => OPEN_ITEMS[id] && ITEM_GROUP[id] === 'cooking'), 'items: a food is not a bag row in the cooking group')
ok(ROOMS.cooking.open, 'room: the cooking room is not buildable')
ok(roomAccepts('cooking', 'shimmerscale') && roomAccepts('cooking', 'tuskroot_cut') && roomAccepts('cooking', 'roast_rinn') && !roomAccepts('cooking', 'bait') && !roomAccepts('cooking', 'goldwood_log'), 'room: the cooking store keeps the wrong things')
// the hearth works from the room's store first, then the bag
const room: Room = { id: 'cooking-1', kind: 'cooking', x: 0, z: 0, q: 0, placedAt: 0, doneAt: 0, store: [{ id: 'drifthorn_cut', n: 2 }] }
const W: Works = { ...freshWorks(), rooms: [room] }
const j = ROAST.find(x => x.out.id === 'roast_drifthorn')!
const m = craftAt(W, room.id, give(newInv(12), 'drifthorn_cut', 1).inv, j)!
ok(!!m && countOf(m.inv, 'roast_drifthorn') === 1 && countOf(m.inv, 'drifthorn_cut') === 1 && m.works.rooms[0].store![0].n === 1, 'hearth: did not roast from the store first')
ok(craftAt({ ...W, rooms: [{ ...room, store: [] }] }, room.id, newInv(12), j) === null, 'hearth: roasted from nothing')
// the Smokehouse
const rich = { ...NEW_LEDGER, marks: 10_000 }, b = SMOKEHOUSE_STOCK.find(x => x.id === 'tuskroot_cut')!
const r = buyBundle(rich, newInv(12), 'tuskroot_cut')
ok(r.ok && r.ledger.marks === 10_000 - b.price && countOf(r.inv, 'tuskroot_cut') === b.n, 'buy: wrong Marks, or not the whole bundle')
ok(rich.marks === 10_000, 'buy: mutated the ledger it was given')
const poor = buyBundle({ ...NEW_LEDGER, marks: 10 }, newInv(12), 'tuskroot_cut')
ok(!poor.ok && /costs/.test(poor.why), 'buy: sold to a keeper who cannot pay')
ok(!buyBundle(rich, newInv(12), 'goldwood_log').ok, 'buy: sold something the Smokehouse does not stock')
const packed = { v: 1 as const, slots: Array(SLOTS).fill(null).map(() => ({ id: 'blankstone', n: 99 })) }
const full = buyBundle(rich, packed, 'tuskroot_cut')
ok(!full.ok && /room/.test(full.why), 'buy: took Marks for a bundle the bag could not hold')
ok(SMOKEHOUSE_STOCK.every(x => x.price >= 100 && x.price <= 2_000), 'stock: a price is off the scale (a run should buy a few bundles)')
if (fails.length) { console.error(`cooking: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`cooking: ${pass}/0`)
