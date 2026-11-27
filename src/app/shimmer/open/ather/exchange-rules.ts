// ── THE EXCHANGE'S RULES (BETA M228 s1): one shared order book at Lingston, goods only (canon world/gates.md › LINGSTON IS THE
// GRAND EXCHANGE: "deals what the Co. deals: goods, never spirits, never coursers ... One shared book for all players").
// Pure and import-free: the API route (server) and the hall panel (client) validate with the same code.
//
// Jin's numbers (M228): FEE 2% of a sale, taken from the seller when an order fills (rounded down, at least 1 Mark); a keeper
// holds at most MAX_OPEN orders. ★ s1 posts and lists orders; it does NOT match them yet (the fill rules are a design call,
// reported to the hub): a posted order holds its goods (sell) or its Marks (buy) until it is cancelled, which gives them back.

export type Side = 'buy' | 'sell'
export const EXCHANGE_FEE = 0.02
export const MAX_OPEN = 12, MAX_N = 999, MAX_PRICE = 1_000_000
/** an item id as the bag writes them (the server never trusts a name; the client names ids with itemDef) */
export const ITEM_RE = /^[a-z0-9][a-z0-9_:.-]{0,47}$/
/** never on the book: not goods (the Co. never trades spirits or coursers; tools, guns and one-off keepsakes stay yours) */
export const NOT_GOODS = /^(repeater|waymark|shed_scale|pruner|spike|sigil_blank|kael_|spirit|courser|bait_page)/

export interface OrderIn { side: Side; item: string; n: number; price: number }
export type Check = { ok: true; order: OrderIn } | { ok: false; error: string }

/** the fee on a sale of n at price each (what the seller gives up when it fills) */
export const feeOf = (n: number, price: number) => (n * price > 0 ? Math.max(1, Math.floor(n * price * EXCHANGE_FEE)) : 0)

export function checkOrder(o: { side?: unknown; item?: unknown; n?: unknown; price?: unknown }, open = 0): Check {
  const side = o.side === 'buy' || o.side === 'sell' ? o.side : null
  if (!side) return { ok: false, error: 'Buy or sell?' }
  const item = String(o.item ?? '')
  if (!ITEM_RE.test(item) || NOT_GOODS.test(item)) return { ok: false, error: 'That is not traded here.' }
  const n = Number(o.n), price = Number(o.price)
  if (!Number.isInteger(n) || n < 1 || n > MAX_N) return { ok: false, error: `How many? 1 to ${MAX_N}.` }
  if (!Number.isInteger(price) || price < 1 || price > MAX_PRICE) return { ok: false, error: `Price each: 1 to ${MAX_PRICE.toLocaleString('en-US')} Marks.` }
  if (open >= MAX_OPEN) return { ok: false, error: `You already have ${MAX_OPEN} orders open.` }
  return { ok: true, order: { side, item, n, price } }
}

export interface BookRow { order_id: string; side: Side; item: string; n: number; price: number; who: string; mine: boolean; at: number }
/** the book a panel shows: sells cheapest first, buys dearest first, then oldest first */
export function sortBook(rows: readonly BookRow[]): BookRow[] {
  return [...rows].sort((a, b) => (a.side !== b.side ? (a.side === 'sell' ? -1 : 1) : a.side === 'sell' ? a.price - b.price || a.at - b.at : b.price - a.price || a.at - b.at))
}
/** search: rows whose item id or shown name holds every word of the query (case-blind) */
export function searchBook(rows: readonly BookRow[], q: string, name: (id: string) => string): BookRow[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return [...rows]
  return rows.filter(r => { const hay = `${r.item.replace(/_/g, ' ')} ${name(r.item)}`.toLowerCase(); return words.every(w => hay.includes(w)) })
}
