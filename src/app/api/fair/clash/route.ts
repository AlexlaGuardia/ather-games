import { NextResponse, type NextRequest } from 'next/server'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'
import { clashState, recordClash } from '@/lib/accounts/fair-clash'
import { CLASH_SEASON as SEASON } from '@/app/shimmer/open/ather/fair-clash-rules'   // = network.ts SEASON (fair-clash.test holds them equal)

// BETA M233 s3: the Thistledown Fair's CLASH tents (lib/accounts/fair-clash.ts). WHO YOU ARE comes from the session cookie; the
// body names the tent won. GET = the tents you have won this season; POST = a win (the prize pays once per tent per season).

const me = (req: NextRequest): string | null => readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)?.user_id ?? null
const noStore = { headers: { 'cache-control': 'no-store' } }

export function GET(req: NextRequest) {
  return NextResponse.json(clashState(SEASON, me(req)), noStore)
}

export async function POST(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return NextResponse.json({ error: 'Sign in to win the prize.' }, { status: 401 })
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const r = recordClash(user_id, SEASON, b)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json(r.value, noStore)
}
