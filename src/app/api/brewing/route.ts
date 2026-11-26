import { NextResponse, type NextRequest } from 'next/server'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'
import { hostBrewing, cancelBrewing, listBrewings, takeSeat, leaveSeat, myRsvps, postDoor, sweepBrewings } from '@/lib/accounts/brewings'

// BETA M188 s4: brewings posted to the Chordstone (lib/accounts/brewings.ts). Same rule as /api/cluster: WHO YOU ARE comes
// from the session cookie; the body only names the brewing and the step. Signed out = nothing listed, nothing to do.

function me(req: NextRequest): string | null {
  return readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)?.user_id ?? null
}
const noStore = { headers: { 'cache-control': 'no-store' } }
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })
const state = (user_id: string) => { const now = Date.now(); sweepBrewings(now); return { brewings: listBrewings(user_id, now), rsvps: myRsvps(user_id, now), now } }

export function GET(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return NextResponse.json({ brewings: [], rsvps: [], now: Date.now() }, noStore)
  return NextResponse.json(state(user_id), noStore)
}

export async function POST(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return bad('Sign in first', 401)
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const id = String(b.brewing_id ?? '')
  let r: { ok: boolean; error?: string }
  switch (String(b.action ?? '')) {
    case 'host': r = hostBrewing(user_id, { potion: b.potion, at: b.at, public: b.public, seats: b.seats }); break
    case 'cancel': r = cancelBrewing(user_id, id); break
    case 'seat': r = takeSeat(user_id, id, Number(b.step)); break
    case 'unseat': r = leaveSeat(user_id, id); break
    case 'door': r = postDoor(user_id, id, b.code, b.look); break
    default: return bad('Unknown action')
  }
  if (!r.ok) return bad(r.error ?? 'No')
  return NextResponse.json(state(user_id), noStore)
}
