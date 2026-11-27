import { NextResponse, type NextRequest } from 'next/server'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'
import { listBook, placeOrder, cancelOrder, listClaims, takeClaim, marketOf, tickClerks } from '@/lib/accounts/exchange'

// BETA M228 s1 + M228b: the Grand Exchange's one shared book at Lingston (lib/accounts/exchange.ts). Same rule as /api/brewing: WHO
// YOU ARE comes from the session cookie; the body only names the order. Anyone reads the book (and an item's guide price + 7-day
// stats with ?item=); signed out = nothing to post or claim. Every call gives the Co. clerks their (throttled) turn first.

function me(req: NextRequest): string | null {
  return readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)?.user_id ?? null
}
const noStore = { headers: { 'cache-control': 'no-store' } }
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })
const clerksTurn = () => { try { tickClerks() } catch (e) { console.error('[exchange] clerks', e) } }

export function GET(req: NextRequest) {
  clerksTurn()
  const user_id = me(req)
  const item = req.nextUrl.searchParams.get('item')
  return NextResponse.json({ book: listBook(user_id), signedIn: !!user_id, claims: user_id ? listClaims(user_id) : {}, market: item ? marketOf(item) : null, now: Date.now() }, noStore)
}

export async function POST(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return bad('Sign in to place orders.', 401)
  clerksTurn()
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = String(b.action ?? '')
  const r = action === 'place' ? placeOrder(user_id, b)
    : action === 'cancel' ? cancelOrder(user_id, String(b.order_id ?? ''))
    : action === 'claim' ? takeClaim(user_id, String(b.item ?? ''), b.n === undefined ? undefined : Number(b.n))
    : null
  if (!r) return bad('Unknown action')
  if (!r.ok) return bad(r.error)
  const item = typeof b.item === 'string' ? b.item : null
  return NextResponse.json({ order: action === 'claim' ? null : r.value, claimed: action === 'claim' ? r.value : null, book: listBook(user_id), claims: listClaims(user_id), market: item && action === 'place' ? marketOf(item) : null, signedIn: true, now: Date.now() }, noStore)
}
