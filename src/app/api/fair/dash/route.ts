import { NextResponse, type NextRequest } from 'next/server'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'
import { dashBoard, recordDash } from '@/lib/accounts/fair-dash'
import { DASH_SEASON as SEASON } from '@/app/shimmer/open/ather/fair-dash-rules'   // = Smash's season (network.ts SEASON)

// BETA M233 s2: the Thistledown Fair's DASH board + ghost pool (lib/accounts/fair-dash.ts). Same rule as /api/exchange: WHO YOU ARE comes
// from the session cookie; the body names the time and the racer. Anyone reads the board (and gets ghosts to race); signed out = no time kept.

const me = (req: NextRequest): string | null => readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)?.user_id ?? null
const noStore = { headers: { 'cache-control': 'no-store' } }

export function GET(req: NextRequest) {
  return NextResponse.json(dashBoard(SEASON, me(req)), noStore)
}

export async function POST(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return NextResponse.json({ error: 'Sign in to put a time on the board.' }, { status: 401 })
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const r = recordDash(user_id, SEASON, b)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json(r.value, noStore)
}
