// Grand Exchange book oracle (BETA M228 s1) — run: npx tsx src/lib/accounts/exchange.test.ts
import { unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { _openAt, upsertGoogleAccount, claimUsername, deleteAccount } from './db'
import * as X from './exchange'
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
try { unlinkSync(path) } catch { /* fine */ }

console.log(`${passes}/${passes + failures} exchange asserts${failures ? ` · ${failures} FAILED` : ''}`)
if (failures) process.exit(1)
