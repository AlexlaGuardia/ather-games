import { NextResponse, type NextRequest } from 'next/server'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'
import { listBook, placeOrder, cancelOrder } from '@/lib/accounts/exchange'

// BETA M228 s1: the Grand Exchange's one shared book at Lingston (lib/accounts/exchange.ts). Same rule as /api/brewing: WHO
// YOU ARE comes from the session cookie; the body only names the order. Anyone reads the book; signed out = nothing to post.

function me(req: NextRequest): string | null {
  return readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)?.user_id ?? null
}
const noStore = { headers: { 'cache-control': 'no-store' } }
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export function GET(req: NextRequest) {
  const user_id = me(req)
  return NextResponse.json({ book: listBook(user_id), signedIn: !!user_id, now: Date.now() }, noStore)
}

export async function POST(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return bad('Sign in to place orders.', 401)
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const r = String(b.action ?? '') === 'place' ? placeOrder(user_id, b) : String(b.action ?? '') === 'cancel' ? cancelOrder(user_id, String(b.order_id ?? '')) : null
  if (!r) return bad('Unknown action')
  if (!r.ok) return bad(r.error)
  return NextResponse.json({ order: r.value, book: listBook(user_id), signedIn: true, now: Date.now() }, noStore)
}
