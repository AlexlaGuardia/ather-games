import { NextResponse, type NextRequest } from 'next/server'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'
import { smashBoard, recordSmash } from '@/lib/accounts/fair-smash'
import { SMASH_SEASON as SEASON } from '@/app/shimmer/open/ather/fair-smash-rules'   // = network.ts SEASON (a test holds them equal; network.ts reaches a client module)

// BETA M233 s1: the Thistledown Fair's SMASH board (lib/accounts/fair-smash.ts). Same rule as /api/exchange: WHO YOU ARE comes
// from the session cookie; the body only names the hit and the spirit. Anyone reads the board; signed out = no swing.

const me = (req: NextRequest): string | null => readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)?.user_id ?? null
const noStore = { headers: { 'cache-control': 'no-store' } }

export function GET(req: NextRequest) {
  return NextResponse.json(smashBoard(SEASON, me(req)), noStore)
}

export async function POST(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return NextResponse.json({ error: 'Sign in to put a hit on the board.' }, { status: 401 })
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const r = recordSmash(user_id, SEASON, b)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json(r.value, noStore)
}
