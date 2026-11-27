// ── THE GRAND EXCHANGE'S BOOK (BETA M228 s1 + M228b): one shared order book at Lingston for every keeper. Goods only.
// Rules (shared with the hall panel): app/shimmer/open/ather/exchange-rules.ts; market math: ather/exchange-market.ts. WHO YOU ARE
// is the session (api/exchange); the body only names the order. Anyone may read the book; only a signed-in keeper posts, cancels
// or claims, and only their own.
//
// M228b ORDERS FILL: a posted order is matched at once against the other side of its item (the RESTING order's price, best price
// first then oldest first, partial fills fine, never against the keeper's own orders), all in ONE transaction. What a fill pays
// goes to the keeper's CLAIM BOX (exchange_claims): the buyer's goods (plus any Marks a buy held above the price it filled at),
// the seller's Marks less the 2% fee. The goods / Marks an open order holds still sit aside in the keeper's own save, as in s1.
// The ATHER TRADING CO. CLERKS (CLERK_ID) keep small buys and sells on the basic goods (tickClerks); their side of a fill is made
// from nothing and goes nowhere, so what they BUY is capped per day (clerkRoom) and the switch (exchange_config 'clerks' or env
// EXCHANGE_CLERKS=off) winds them down to no orders at all.
// Run: npx tsx src/lib/accounts/exchange.test.ts
import { randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { accountsDb } from './db'
import { checkOrder, feeOf, sortBook, type BookRow, type Side } from '@/app/shimmer/open/ather/exchange-rules'
import { CLERK_ID, CLERK_NAME, CLERK_ITEMS, CLAIM_MARKS, isClerk, dayStart, readDial, clerkQuote, clerkRoom, guidePrice, statsOf, WEEK_MS, type ClerkDial, type Fill, type Stats } from '@/app/shimmer/open/ather/exchange-market'

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }
interface Row { order_id: string; user_id: string; side: Side; item: string; n: number; price: number; created_at: number; who: string | null }
const SELECT = `SELECT o.order_id, o.user_id, o.side, o.item, o.n, o.price, o.created_at, a.username AS who
  FROM exchange_orders o LEFT JOIN accounts a ON a.user_id = o.user_id`
const view = (r: Row, viewer: string | null): BookRow => ({ order_id: r.order_id, side: r.side, item: r.item, n: r.n, price: r.price, who: isClerk(r.user_id) ? CLERK_NAME : r.who ?? 'a keeper', mine: !!viewer && r.user_id === viewer, at: r.created_at })

/** run fn inside one write transaction (all or nothing: a fill never half-lands) */
function tx<T>(fn: (d: DatabaseSync) => T): T {
  const d = accountsDb()
  d.exec('BEGIN IMMEDIATE')
  try { const v = fn(d); d.exec('COMMIT'); return v } catch (e) { d.exec('ROLLBACK'); throw e }
}

/** the whole book (sells cheapest first, buys dearest first) */
export function listBook(viewer: string | null): BookRow[] {
  return sortBook((accountsDb().prepare(`${SELECT} ORDER BY o.created_at LIMIT 2000`).all() as unknown as Row[]).map(r => view(r, viewer)))
}
export const openCount = (user_id: string) => Number((accountsDb().prepare('SELECT COUNT(*) AS c FROM exchange_orders WHERE user_id = ?').get(user_id) as { c: number }).c)

// ── the clerks' dial ──
/** the dial: exchange_config rows, the env switch on top (EXCHANGE_CLERKS=off always wins) */
export function clerkDial(): ClerkDial {
  const kv: Record<string, string> = {}
  for (const r of accountsDb().prepare('SELECT key, value FROM exchange_config').all() as unknown as { key: string; value: string }[]) kv[r.key] = r.value
  if (process.env.EXCHANGE_CLERKS) kv.clerks = process.env.EXCHANGE_CLERKS
  return readDial(kv)
}
/** set one dial key (the switch: setConfig('clerks', 'off')) */
export function setConfig(key: string, value: string) {
  accountsDb().prepare('INSERT INTO exchange_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

// ── the claim box ──
function credit(d: DatabaseSync, user_id: string, item: string, n: number) {
  if (n <= 0 || isClerk(user_id)) return
  d.prepare('INSERT INTO exchange_claims (user_id, item, n) VALUES (?, ?, ?) ON CONFLICT(user_id, item) DO UPDATE SET n = n + excluded.n').run(user_id, item, n)
}
/** what waits for a keeper at the counter: { item: n }, Marks under CLAIM_MARKS */
export function listClaims(user_id: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of accountsDb().prepare('SELECT item, n FROM exchange_claims WHERE user_id = ? AND n > 0').all(user_id) as unknown as { item: string; n: number }[]) out[r.item] = r.n
  return out
}
/** take up to n of one claim (all of it when n is missing). Answers what was taken, so the client adds it exactly once. */
export function takeClaim(user_id: string, item: string, n?: number): Result<{ item: string; n: number }> {
  return tx(d => {
    const r = d.prepare('SELECT n FROM exchange_claims WHERE user_id = ? AND item = ?').get(user_id, String(item)) as { n: number } | undefined
    const have = r ? Number(r.n) : 0
    const want = n === undefined ? have : Math.floor(Number(n))
    if (!Number.isFinite(want) || want < 1 || have < 1) return { ok: false as const, error: 'Nothing to claim.' }
    const take = Math.min(have, want)
    if (take === have) d.prepare('DELETE FROM exchange_claims WHERE user_id = ? AND item = ?').run(user_id, String(item))
    else d.prepare('UPDATE exchange_claims SET n = n - ? WHERE user_id = ? AND item = ?').run(take, user_id, String(item))
    return { ok: true as const, value: { item: String(item), n: take } }
  })
}

// ── matching ──
export interface FillOut { item: string; n: number; price: number; buyer: string; seller: string }
/** what the clerks have bought today: of this item, from this seller, and in all */
function clerkUsed(d: DatabaseSync, item: string, seller: string, now: number) {
  const since = dayStart(now)
  const q = (where: string, ...a: (string | number)[]) => Number((d.prepare(`SELECT COALESCE(SUM(${where.startsWith('U') ? 'n' : 'n * price'}), 0) AS s FROM exchange_fills WHERE buyer = ? AND at >= ? ${where.slice(1)}`).get(CLERK_ID, since, ...a) as { s: number }).s)
  return { itemUnits: q('U AND item = ?', item), sellerMarks: q('M AND seller = ?', seller), totalMarks: q('M') }
}
/** match one order against the book until it is filled or nothing crosses. Inside the caller's transaction. */
function matchOrder(d: DatabaseSync, order_id: string, now: number, dial: ClerkDial): FillOut[] {
  const fills: FillOut[] = []
  const skip = new Set<string>()
  for (let guard = 0; guard < 500; guard++) {
    const o = d.prepare('SELECT * FROM exchange_orders WHERE order_id = ?').get(order_id) as unknown as Row | undefined
    if (!o || o.n < 1) break
    const cands = (o.side === 'buy'
      ? d.prepare(`SELECT * FROM exchange_orders WHERE side = 'sell' AND item = ? AND price <= ? AND user_id != ? ORDER BY price ASC, created_at ASC, order_id ASC LIMIT 200`).all(o.item, o.price, o.user_id)
      : d.prepare(`SELECT * FROM exchange_orders WHERE side = 'buy' AND item = ? AND price >= ? AND user_id != ? ORDER BY price DESC, created_at ASC, order_id ASC LIMIT 200`).all(o.item, o.price, o.user_id)) as unknown as Row[]
    // two clerk orders never trade with each other (both sides are the Co.)
    const opp = cands.find(c => !skip.has(c.order_id) && !(isClerk(c.user_id) && isClerk(o.user_id)))
    if (!opp) break
    const buy = o.side === 'buy' ? o : opp, sell = o.side === 'sell' ? o : opp
    const price = opp.price
    let q = Math.min(o.n, opp.n)
    if (isClerk(buy.user_id)) {
      // the farm cap: the clerks only buy so much a day
      q = Math.min(q, dial.on ? clerkRoom(dial, clerkUsed(d, o.item, sell.user_id, now), price) : 0)
      if (q < 1) { skip.add(opp.order_id); continue }
    }
    for (const r of [o, opp]) {
      if (r.n - q < 1) d.prepare('DELETE FROM exchange_orders WHERE order_id = ?').run(r.order_id)
      else d.prepare('UPDATE exchange_orders SET n = n - ? WHERE order_id = ?').run(q, r.order_id)
    }
    d.prepare('INSERT INTO exchange_fills (item, n, price, buyer, seller, at) VALUES (?, ?, ?, ?, ?, ?)').run(o.item, q, price, buy.user_id, sell.user_id, now)
    credit(d, buy.user_id, o.item, q)
    // a buy that held more Marks than it filled at gets the difference back in the claim box
    if (buy.price > price) credit(d, buy.user_id, CLAIM_MARKS, q * (buy.price - price))
    credit(d, sell.user_id, CLAIM_MARKS, q * price - feeOf(q, price))
    fills.push({ item: o.item, n: q, price, buyer: buy.user_id, seller: sell.user_id })
  }
  return fills
}

function insertOrder(d: DatabaseSync, user_id: string, side: Side, item: string, n: number, price: number, now: number) {
  const id = `x_${randomBytes(8).toString('hex')}`
  d.prepare('INSERT INTO exchange_orders (order_id, user_id, side, item, n, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, user_id, side, item, n, price, now)
  return id
}

/** post an order and fill what crosses. The caller's client has already set the goods (sell) or the Marks (buy) aside. Answers
 *  the order as it rests after matching (n 0 = filled whole) and the fills it made. */
export function placeOrder(user_id: string, o: Record<string, unknown>, now = Date.now()): Result<BookRow & { fills: FillOut[] }> {
  if (isClerk(user_id)) return { ok: false, error: 'No.' }
  const c = checkOrder(o, openCount(user_id))
  if (!c.ok) return c
  return tx(d => {
    const id = insertOrder(d, user_id, c.order.side, c.order.item, c.order.n, c.order.price, now)
    const fills = matchOrder(d, id, now, clerkDial())
    const r = d.prepare(`${SELECT} WHERE o.order_id = ?`).get(id) as unknown as Row | undefined
    const left = r ? view(r, user_id) : { order_id: id, side: c.order.side, item: c.order.item, n: 0, price: c.order.price, who: '', mine: true, at: now }
    return { ok: true as const, value: { ...left, fills } }
  })
}

/** cancel your own order. Answers the order that went (what is LEFT of it), so the client hands its goods / Marks back once. */
export function cancelOrder(user_id: string, order_id: string): Result<BookRow> {
  const r = accountsDb().prepare(`${SELECT} WHERE o.order_id = ?`).get(String(order_id)) as unknown as Row | undefined
  if (!r || r.user_id !== user_id) return { ok: false, error: 'No such order of yours.' }
  const del = accountsDb().prepare('DELETE FROM exchange_orders WHERE order_id = ? AND user_id = ?').run(r.order_id, user_id)
  if (Number(del.changes) !== 1) return { ok: false, error: 'No such order of yours.' }
  return { ok: true, value: view(r, user_id) }
}

// ── the guide price + stats ──
/** an item's fills in the last 7 days; keepersOnly leaves out every fill a Co. clerk was in (the GUIDE reads only those, or the
 *  clerks' own trades at guide -/+ spread would walk the guide, and so the clerks, down or up a step at a time) */
function fillsOf(item: string, now: number, keepersOnly = false): Fill[] {
  return accountsDb().prepare(`SELECT n, price, at FROM exchange_fills WHERE item = ? AND at > ?${keepersOnly ? " AND buyer NOT LIKE 'co:%' AND seller NOT LIKE 'co:%'" : ''} ORDER BY at`).all(item, now - WEEK_MS) as unknown as Fill[]
}
const guideOf = (item: string, now: number) => guidePrice(item, fillsOf(item, now, true), now)
export function marketOf(item: string, now = Date.now()): { item: string; guide: number | null; stats: Stats | null } {
  return { item: String(item), guide: guideOf(String(item), now), stats: statsOf(fillsOf(String(item), now), now) }
}

// ── the Co. clerks ──
let lastTick = 0
/** keep a clerk buy and sell on each basic good at the guide's quote (a lot each), refreshing any that filled, moved or went;
 *  with the switch off, take every clerk order off the book. Throttled to once a minute unless forced. */
export function tickClerks(now = Date.now(), force = false): { placed: number; removed: number; fills: FillOut[] } {
  if (!force && now - lastTick < 60_000) return { placed: 0, removed: 0, fills: [] }
  lastTick = now
  const dial = clerkDial()
  return tx(d => {
    let placed = 0, removed = 0
    const fills: FillOut[] = []
    if (!dial.on || dial.lot < 1) {
      removed = Number(d.prepare('DELETE FROM exchange_orders WHERE user_id LIKE ?').run('co:%').changes)
      return { placed, removed, fills }
    }
    for (const item of CLERK_ITEMS) {
      const quote = clerkQuote(item, guideOf(item, now), dial.spread)
      if (!quote) continue
      for (const side of ['buy', 'sell'] as const) {
        const want = side === 'buy' ? quote.buy : quote.sell
        const mine = d.prepare('SELECT * FROM exchange_orders WHERE user_id = ? AND item = ? AND side = ?').all(CLERK_ID, item, side) as unknown as Row[]
        // a clerk buy stays off once today's cap for this good (or in all) is spent
        const capped = side === 'buy' && clerkRoom(dial, { ...clerkUsed(d, item, '', now), sellerMarks: 0 }, want) < 1
        if (!capped && mine.length === 1 && mine[0].price === want && mine[0].n === dial.lot) continue
        for (const m of mine) { d.prepare('DELETE FROM exchange_orders WHERE order_id = ?').run(m.order_id); removed++ }
        if (capped) continue
        const id = insertOrder(d, CLERK_ID, side, item, dial.lot, want, now)
        placed++
        fills.push(...matchOrder(d, id, now, dial))
      }
    }
    return { placed, removed, fills }
  })
}
/** test seam: forget the throttle */
export const _resetTick = () => { lastTick = 0 }
