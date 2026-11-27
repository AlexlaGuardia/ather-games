// ── THE GRAND EXCHANGE'S BOOK (BETA M228 s1): one shared order book at Lingston for every keeper. Goods only.
// Rules (shared with the hall panel): app/shimmer/open/ather/exchange-rules.ts. WHO YOU ARE is the session (api/exchange);
// the body only names the order. Anyone may read the book (it is the hall's public board); only a signed-in keeper posts
// or cancels, and only their own. s1 does NOT match orders: a posted order rests until its keeper cancels it.
// Run: npx tsx src/lib/accounts/exchange.test.ts
import { randomBytes } from 'node:crypto'
import { accountsDb } from './db'
import { checkOrder, sortBook, type BookRow, type Side } from '@/app/shimmer/open/ather/exchange-rules'

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }
interface Row { order_id: string; user_id: string; side: Side; item: string; n: number; price: number; created_at: number; who: string | null }
const SELECT = `SELECT o.order_id, o.user_id, o.side, o.item, o.n, o.price, o.created_at, a.username AS who
  FROM exchange_orders o LEFT JOIN accounts a ON a.user_id = o.user_id`
const view = (r: Row, viewer: string | null): BookRow => ({ order_id: r.order_id, side: r.side, item: r.item, n: r.n, price: r.price, who: r.who ?? 'a keeper', mine: !!viewer && r.user_id === viewer, at: r.created_at })

/** the whole book (sells cheapest first, buys dearest first) */
export function listBook(viewer: string | null): BookRow[] {
  return sortBook((accountsDb().prepare(`${SELECT} ORDER BY o.created_at LIMIT 2000`).all() as unknown as Row[]).map(r => view(r, viewer)))
}
export const openCount = (user_id: string) => Number((accountsDb().prepare('SELECT COUNT(*) AS c FROM exchange_orders WHERE user_id = ?').get(user_id) as { c: number }).c)

/** post an order. The caller's client has already set the goods (sell) or the Marks (buy) aside from the save. */
export function placeOrder(user_id: string, o: Record<string, unknown>, now = Date.now()): Result<BookRow> {
  const c = checkOrder(o, openCount(user_id))
  if (!c.ok) return c
  const id = `x_${randomBytes(8).toString('hex')}`
  accountsDb().prepare('INSERT INTO exchange_orders (order_id, user_id, side, item, n, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, user_id, c.order.side, c.order.item, c.order.n, c.order.price, now)
  const r = accountsDb().prepare(`${SELECT} WHERE o.order_id = ?`).get(id) as unknown as Row
  return { ok: true, value: view(r, user_id) }
}

/** cancel your own order. Answers the order that went, so the client hands its goods / Marks back exactly once. */
export function cancelOrder(user_id: string, order_id: string): Result<BookRow> {
  const r = accountsDb().prepare(`${SELECT} WHERE o.order_id = ?`).get(String(order_id)) as unknown as Row | undefined
  if (!r || r.user_id !== user_id) return { ok: false, error: 'No such order of yours.' }
  const del = accountsDb().prepare('DELETE FROM exchange_orders WHERE order_id = ? AND user_id = ?').run(r.order_id, user_id)
  if (Number(del.changes) !== 1) return { ok: false, error: 'No such order of yours.' }
  return { ok: true, value: view(r, user_id) }
}
