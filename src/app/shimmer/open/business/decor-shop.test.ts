// Run: npx tsx src/app/shimmer/open/business/decor-shop.test.ts
import { buyDecor } from './decor-shop'
import { FURNITURE, PIECE_JOBS, stockOf } from '../ather/furniture'
import { FRONT_SHOPS } from './doors'
import { newInv, countOf, SLOTS } from '../shared/inventory'
import { NEW_LEDGER } from '../trade'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const rich = { ...NEW_LEDGER, marks: 50_000 }
const r = buyDecor(rich, newInv(12), 'iron_lantern', 'smithy')
ok(r.ok && r.ledger.marks === 50_000 - FURNITURE.iron_lantern.sold!.price && countOf(r.inv, 'iron_lantern') === 1, 'buy: wrong Marks or no lantern')
ok(rich.marks === 50_000, 'buy: mutated the ledger it was given')
const poor = buyDecor({ ...NEW_LEDGER, marks: 100 }, newInv(12), 'iron_lantern', 'smithy')
ok(!poor.ok && /costs/.test(poor.why), 'buy: sold to a keeper who cannot pay')
ok(!buyDecor(rich, newInv(12), 'iron_lantern', 'grand-exchange').ok && !buyDecor(rich, newInv(12), 'goldwood_stool', 'smithy').ok, 'buy: sold at the wrong shop, or sold a craftable piece')
const packed = { v: 1 as const, slots: Array(SLOTS).fill(null).map(() => ({ id: 'blankstone', n: 99 })) }
const full = buyDecor(rich, packed, 'iron_lantern', 'smithy')
ok(!full.ok && /room/.test(full.why), 'buy: took Marks for a lantern the bag could not hold')
// every shop piece is stocked at a real storefront, is never craftable, and every storefront named stocks something
const sold = Object.entries(FURNITURE).filter(([, f]) => f.sold)
ok(sold.length > 0 && sold.every(([id, f]) => f.sold!.at in FRONT_SHOPS && f.recipe.length === 0 && !PIECE_JOBS.some(j => j.id === id)), 'stock: a shop piece is craftable, or stocked at a door that does not exist')
ok(stockOf('smithy').length > 0 && stockOf('grand-exchange').length > 0 && stockOf('kindled-mug').length === 0, 'stock: wrong shops stock decor')
ok(sold.every(([, f]) => f.sold!.price >= 1_000 && f.sold!.price <= 20_000), 'stock: a price is off the ladder scale')
if (fails.length) { console.error(`decor-shop: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`decor-shop: ${pass}/0`)
