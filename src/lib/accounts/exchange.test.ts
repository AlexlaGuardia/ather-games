// Grand Exchange book oracle (BETA M228 s1) — run: npx tsx src/lib/accounts/exchange.test.ts
import { unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { _openAt, upsertGoogleAccount, claimUsername, deleteAccount } from './db'
import * as X from './exchange'
import { accountsDb } from './db'
import { CLAIM_MARKS, CLERK_ID, CLERK_NAME, CLERK_ITEMS, CLERK_DEFAULT, SEED_PRICE, WEEK_MS, clerkQuote, medianPrice, readDial } from '@/app/shimmer/open/ather/exchange-market'
import { checkOrder, feeOf, sortBook, searchBook, MAX_OPEN, EXCHANGE_FEE, type BookRow } from '@/app/shimmer/open/ather/exchange-rules'
import { LINGSTON, attendantAt, attendantSpots, toWorld, toLocal, ATTENDANT_X, COUNTER, onLingston } from '@/app/shimmer/open/ather/lingston'

let failures = 0, passes = 0
const ok = (c: boolean, label: string) => { if (c) passes++; else { failures++; console.log(`  FAIL  ${label}`) } }

// ── rules ──
ok(EXCHANGE_FEE === 0.02 && feeOf(10, 50) === 10 && feeOf(1, 3) === 1 && feeOf(0, 9) === 0, 'fee: 2% of a sale, at least 1 Mark')
ok(checkOrder({ side: 'sell', item: 'goldwood_plank', n: 5, price: 12 }).ok, 'a plain goods order is fine')
ok(!checkOrder({ side: 'gift', item: 'goldwood_plank', n: 5, price: 12 }).ok, 'side must be buy or sell')
ok(!checkOrder({ side: 'buy', item: 'repeater', n: 1, price: 12 }).ok && !checkOrder({ side: 'buy', item: 'spirit_x', n: 1, price: 1 }).ok, 'guns / spirits are not goods')
ok(!checkOrder({ side: 'buy', item: 'Bad Id!', n: 1, price: 1 }).ok, 'an id that is not a bag id is refused')
ok(!checkOrder({ side: 'buy', item: 'moonkoi', n: 0, price: 1 }).ok && !checkOrder({ side: 'buy', item: 'moonkoi', n: 1.5, price: 1 }).ok && !checkOrder({ side: 'buy', item: 'moonkoi', n: 1, price: 0 }).ok, 'whole counts and prices only')
ok(!checkOrder({ side: 'buy', item: 'moonkoi', n: 1, price: 1 }, MAX_OPEN).ok, `at most ${MAX_OPEN} open orders`)
const R = (o: Partial<BookRow>): BookRow => ({ order_id: 'a', side: 'sell', item: 'moonkoi', n: 1, price: 1, who: 'x', mine: false, at: 0, ...o })
const s = sortBook([R({ order_id: 'b1', side: 'buy', price: 5 }), R({ order_id: 's2', price: 9 }), R({ order_id: 'b2', side: 'buy', price: 8 }), R({ order_id: 's1', price: 3 })])
ok(s.map(r => r.order_id).join() === 's1,s2,b2,b1', `book order: sells cheapest first, buys dearest first (${s.map(r => r.order_id)})`)
const nm = (id: string) => ({ moonkoi: 'Moonkoi', goldwood_plank: 'Goldwood Plank' } as Record<string, string>)[id] ?? id
ok(searchBook([R({ item: 'goldwood_plank' }), R({ item: 'moonkoi' })], 'gold plank', nm).length === 1 && searchBook([R({}), R({})], '', nm).length === 2, 'search: every word of the query, by id or name')

// ── the hall's counter ──
const back = toLocal(toWorld(3, -7).x, toWorld(3, -7).z)
ok(Math.abs(back.x - 3) < 1e-9 && Math.abs(back.z + 7) < 1e-9, 'the square frame round-trips')
const front = toWorld(ATTENDANT_X[1], COUNTER.z + 1.2), behind = toWorld(ATTENDANT_X[1], COUNTER.z - 2), far = toWorld(0, 12)
ok(attendantAt(front.x, front.z) === 1, 'a keeper in front of the middle attendant speaks to them')
ok(attendantAt(behind.x, behind.z) === -1 && attendantAt(far.x, far.z) === -1, 'not from behind the counter, not from across the square')
ok(attendantSpots().length === 3 && onLingston(LINGSTON.x, LINGSTON.z) && !onLingston(LINGSTON.x + 80, LINGSTON.z), 'three attendants; the square names itself')

// ── the book ──
const path = join(tmpdir(), `exchange-${process.pid}.db`)
_openAt(path)
const mk = (name: string) => { const a = upsertGoogleAccount(`g-${name}`, null, null); claimUsername(a.user_id, name); return a.user_id }
const [a, b] = ['seller_a', 'buyer_b'].map(mk)
const p1 = X.placeOrder(a, { side: 'sell', item: 'moonkoi', n: 3, price: 40 }, 1000)
const p2 = X.placeOrder(b, { side: 'buy', item: 'goldwood_plank', n: 20, price: 6 }, 2000)
ok(p1.ok && p2.ok, 'two keepers post a sell and a buy')
const seenByB = X.listBook(b)
ok(seenByB.length === 2 && seenByB.some(r => r.item === 'moonkoi' && r.who === 'seller_a' && !r.mine) && seenByB.some(r => r.item === 'goldwood_plank' && r.mine), "B sees A's sell (not B's) and B's own buy in the ONE book")
ok(X.listBook(null).length === 2 && X.listBook(null).every(r => !r.mine), 'signed out reads the same book, nothing is theirs')
ok(!X.placeOrder(a, { side: 'sell', item: 'repeater', n: 1, price: 1 }).ok, 'the server refuses non-goods too')
const id1 = p1.ok ? p1.value.order_id : ''
ok(!X.cancelOrder(b, id1).ok, "B cannot cancel A's order")
const c1 = X.cancelOrder(a, id1)
ok(c1.ok && c1.value.n === 3 && c1.value.item === 'moonkoi' && !X.cancelOrder(a, id1).ok, 'A cancels once (answers the order for the refund), never twice')
for (let i = 0; i < MAX_OPEN; i++) X.placeOrder(a, { side: 'buy', item: 'moonkoi', n: 1, price: 1 })
ok(!X.placeOrder(a, { side: 'buy', item: 'moonkoi', n: 1, price: 1 }).ok && X.openCount(a) === MAX_OPEN, 'the open-order cap holds on the server')
deleteAccount(a)
ok(X.listBook(null).length === 1, "a deleted account's orders leave the book")

// ── M228b: orders FILL, the claim box, the guide price + stats, the Co. clerks ──
const T = Date.UTC(2026, 10, 27, 12)
const [c, e, f] = ['fill_c', 'fill_e', 'fill_f'].map(mk)
const cs = X.placeOrder(c, { side: 'sell', item: 'moonkoi', n: 10, price: 30 }, T)
const db1 = X.placeOrder(e, { side: 'buy', item: 'moonkoi', n: 4, price: 35 }, T + 1)
ok(cs.ok && cs.value.fills.length === 0 && cs.value.n === 10, 'a sell with nothing across rests whole')
ok(db1.ok && db1.value.fills.length === 1 && db1.value.fills[0].n === 4 && db1.value.fills[0].price === 30 && db1.value.n === 0, `a crossing buy fills at the RESTING price (${db1.ok ? JSON.stringify(db1.value.fills) : ''})`)
const fillRows = () => Number((accountsDb().prepare("SELECT COUNT(*) AS c FROM exchange_fills WHERE item = 'moonkoi'").get() as { c: number }).c)
ok(fillRows() === 1, 'two crossing orders fill ONCE (one fill row)')
ok(X.listBook(null).filter(r => r.item === 'moonkoi').map(r => `${r.side}${r.n}`).join() === 'sell6', 'the sell rests with what is left; the filled buy is gone')
ok(X.listClaims(e).moonkoi === 4 && X.listClaims(e)[CLAIM_MARKS] === 4 * 5, "the buyer's claim: the goods + the Marks held above the fill price")
ok(X.listClaims(c)[CLAIM_MARKS] === 4 * 30 - feeOf(4, 30) && !X.listClaims(c).moonkoi, "the seller's claim: the Marks less the 2% fee")
const tk = X.takeClaim(e, 'moonkoi', 3)
ok(tk.ok && tk.value.n === 3 && X.listClaims(e).moonkoi === 1, 'claim part of a claim')
const tk2 = X.takeClaim(e, 'moonkoi'), tk3 = X.takeClaim(e, 'moonkoi')
ok(tk2.ok && tk2.value.n === 1 && !tk3.ok && !X.listClaims(e).moonkoi, 'claim the rest once, never twice')
ok(!X.takeClaim(f, CLAIM_MARKS).ok, "nothing to claim for a keeper with no fills (and nobody claims another's)")
const db2 = X.placeOrder(e, { side: 'buy', item: 'moonkoi', n: 10, price: 30 }, T + 2)
ok(db2.ok && db2.value.fills.length === 1 && db2.value.fills[0].n === 6 && db2.value.n === 4 && fillRows() === 2, 'partial fill: the buy takes the 6 left and rests with 4')
// oldest first at one price, best price first across prices
X.placeOrder(f, { side: 'sell', item: 'glowfin', n: 2, price: 50 }, T + 10)
X.placeOrder(c, { side: 'sell', item: 'glowfin', n: 2, price: 40 }, T + 11)
X.placeOrder(e, { side: 'sell', item: 'glowfin', n: 2, price: 40 }, T + 12)
const pick = X.placeOrder(f, { side: 'buy', item: 'glowfin', n: 3, price: 60 }, T + 13)
ok(pick.ok && pick.value.fills.map(x => `${x.seller === c ? 'c' : x.seller === e ? 'e' : 'f'}${x.n}@${x.price}`).join() === 'c2@40,e1@40', `best price first, then oldest; never against your own order (${pick.ok ? pick.value.fills.map(x => x.n + '@' + x.price) : ''})`)
const self = X.placeOrder(c, { side: 'buy', item: 'moonkoi', n: 1, price: 99 }, T + 14)
ok(self.ok && self.value.fills.length === 0, 'a keeper never fills against their own order')
// guide + stats
const m = X.marketOf('moonkoi', T + 100)
ok(m.stats !== null && m.stats.high === 30 && m.stats.low === 30 && m.stats.last === 30 && m.stats.volume === 10 && m.guide === 30, `7-day stats + guide from fills (${JSON.stringify(m)})`)
ok(X.marketOf('moonkoi', T + WEEK_MS + 100).stats === null, 'a fill older than 7 days leaves the stats')
ok(X.marketOf('goldwood_plank', T).guide === SEED_PRICE.goldwood_plank && X.marketOf('goldwood_plank', T).stats === null, 'no fills: the seed price, empty stats')
ok(X.marketOf('pearlshell', T).guide === null, 'no fills, no seed: no guide')
ok(medianPrice([{ n: 1, price: 10, at: T }, { n: 1, price: 50, at: T }, { n: 1, price: 20, at: T }], T) === 20 && medianPrice([{ n: 1, price: 10, at: T }, { n: 1, price: 20, at: T }], T) === 10, 'median (lower middle on an even count)')
const qq = clerkQuote('goldwood_plank', 1_000_000, 0.1)
ok(qq !== null && qq.sell <= Math.ceil(SEED_PRICE.goldwood_plank * 2 * 1.1) && qq.buy <= SEED_PRICE.goldwood_plank * 2, 'a silly guide cannot drag the clerks past twice the seed')
ok(readDial({ clerks: 'off' }).on === false && readDial({}).on === true && readDial({ clerk_lot: '9999' }).lot === 50, 'the dial: the switch + clamped numbers')

// the clerks
X.setConfig('clerks', 'on'); X.setConfig('clerk_day_marks_keeper', '300'); X._resetTick()
const t1 = X.tickClerks(T, true)
const clerkRows = () => X.listBook(null).filter(r => r.who === CLERK_NAME)
ok(t1.placed === CLERK_ITEMS.length * 2 && clerkRows().length === CLERK_ITEMS.length * 2 && CLERK_ITEMS.length >= 8, `a clerk buy + sell on every basic good (${clerkRows().length})`)
ok(clerkRows().every(r => r.n === CLERK_DEFAULT.lot && !r.mine), 'clerk orders are small lots, shown as Co. clerk')
const qb = clerkQuote('blankstone', SEED_PRICE.blankstone, CLERK_DEFAULT.spread)!
ok(clerkRows().some(r => r.item === 'blankstone' && r.side === 'buy' && r.price === qb.buy) && clerkRows().some(r => r.item === 'blankstone' && r.side === 'sell' && r.price === qb.sell) && qb.buy < SEED_PRICE.blankstone && qb.sell > SEED_PRICE.blankstone, 'they buy below and sell above the guide')
ok(X.tickClerks(T + 1000, true).placed === 0, 'a tick with nothing moved changes nothing')
const sc = X.placeOrder(f, { side: 'sell', item: 'blankstone', n: 3, price: 1 }, T + 2000)
ok(sc.ok && sc.value.fills.length === 1 && sc.value.fills[0].price === qb.buy && sc.value.fills[0].buyer === CLERK_ID, "a keeper's sell fills a clerk buy at the clerk's price")
const fClaim = X.listClaims(f)[CLAIM_MARKS] ?? 0
ok(fClaim >= 3 * qb.buy - feeOf(3, qb.buy), 'and the Marks land in the claim box')
const bm = X.marketOf('blankstone', T + 2500)
ok(bm.stats?.last === qb.buy && bm.guide === SEED_PRICE.blankstone, `a clerk fill shows in the stats but never moves the guide (${JSON.stringify(bm)})`)
ok(X.tickClerks(T + 2600, true).placed === 1, 'so the clerks refresh only the lot that filled, at the same quote')
// FARM CAP: one keeper sells to the clerks all day; they pay at most clerk_day_marks_keeper
const g = mk('farm_g')
let farmed = 0
for (let i = 0; i < 40; i++) {
  X.tickClerks(T + 3000 + i * 100, true)
  const r = X.placeOrder(g, { side: 'sell', item: 'raw_mana_shard', n: 5, price: 1 }, T + 3000 + i * 100 + 1)
  if (r.ok) { farmed += r.value.fills.filter(x => x.buyer === CLERK_ID).reduce((s2, x) => s2 + x.n * x.price, 0); if (r.value.n > 0) X.cancelOrder(g, r.value.order_id) }
}
ok(farmed > 0 && farmed <= 300, `the farm cap: one keeper takes at most 300 Marks a day from the clerks (${farmed})`)
const h = mk('farm_h')
const rh = X.placeOrder(h, { side: 'sell', item: 'raw_mana_shard', n: 5, price: 1 }, T + 9000)
ok(rh.ok && rh.value.fills.some(x => x.buyer === CLERK_ID), 'another keeper can still sell to them')
X.setConfig('clerk_day_units', '0'); X.tickClerks(T + 9500, true)
ok(!clerkRows().some(r => r.side === 'buy'), 'with the day cap spent, the clerks post no buys')
X.setConfig('clerk_day_units', '60'); X.tickClerks(T + 86_400_000, true)
ok(clerkRows().some(r => r.side === 'buy'), 'a new day, the clerks buy again')
X.setConfig('clerks', 'off')
const off = X.tickClerks(T + 86_400_000 + 10, true)
ok(off.removed > 0 && clerkRows().length === 0, 'the switch off: no clerk orders at all')
ok(!X.placeOrder(CLERK_ID, { side: 'sell', item: 'blankstone', n: 1, price: 1 }).ok, 'nobody posts as a clerk through placeOrder')
deleteAccount(e)
ok(!Object.keys(X.listClaims(e)).length, "a deleted account's claims go with it")

try { unlinkSync(path) } catch { /* fine */ }

console.log(`${passes}/${passes + failures} exchange asserts${failures ? ` · ${failures} FAILED` : ''}`)
if (failures) process.exit(1)
