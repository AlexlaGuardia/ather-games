// M109 s2 Feed (spirit-feed.ts). Run: npx tsx src/app/shimmer/open/ather/spirit-feed.test.ts
import { feed, foodIn, withFed, SPIRIT_FOODS, type FedBook } from './spirit-feed'
import { countOf, type Inv } from '../shared/inventory'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const bag = (...st: [string, number][]): Inv => { const slots: Inv['slots'] = Array(32).fill(null); st.forEach(([id, n], i) => { slots[i + 4] = { id, n } }); return { v: 1, slots } }

ok(SPIRIT_FOODS.join() === 'glowfin,ather_wheat,moonkoi', 'canon foods only: Glowfin, Ather Wheat, Moonkoi')
ok(foodIn(bag()) === null && foodIn(bag(['waymark', 3], ['roast_rinn', 2])) === null, 'no spirit food = null (roast rinn is the keeper\'s dish)')
ok(foodIn(bag(['moonkoi', 1], ['glowfin', 2])) === 'glowfin', 'the commonest first: glowfin before moonkoi')
ok(foodIn(bag(['moonkoi', 1], ['crop:ather_wheat:B', 1], ['crop:ather_wheat:D', 1])) === 'crop:ather_wheat:D', 'wheat before moonkoi, lowest grade first')
ok(foodIn(bag(['moonkoi', 1])) === 'moonkoi', 'moonkoi when it is all there is')
ok(foodIn(bag(['seed:ather_wheat:D', 3])) === null, 'a wheat SEED is not food')

const inv = bag(['glowfin', 2], ['moonkoi', 1])
const r = feed(inv, {}, 'vx', 1000)
ok(!!r && r.item === 'glowfin' && countOf(r.inv, 'glowfin') === 1 && countOf(r.inv, 'moonkoi') === 1, 'feed takes exactly one food')
ok(countOf(inv, 'glowfin') === 2, 'the input bag is not mutated')
ok(!!r && r.book.vx.n === 1 && r.book.vx.last === 1000 && r.book.vx.item === 'glowfin', 'the fed record: n 1, last, item')
const r2 = feed(r!.inv, r!.book, 'vx', 2000), r3 = feed(r2!.inv, r2!.book, 'mx', 3000)
ok(!!r3 && r3.book.vx.n === 2 && r3.book.vx.item === 'glowfin' && r3.book.mx.n === 1 && r3.book.mx.item === 'moonkoi', 'per spirit, counts up')
ok(feed(r3!.inv, r3!.book, 'vx', 4000) === null, 'no food left: refused, nothing taken')
const b: FedBook = withFed({}, 'a', 'glowfin', 5)
ok(Object.keys(b.a).sort().join() === 'item,last,n', 'CARE NOT A LEASH: the record has no hunger, no meter, no obey field')

if (fails.length) { console.error(`spirit-feed: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`spirit-feed: ${pass}/0`)
