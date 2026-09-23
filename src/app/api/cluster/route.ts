import { NextResponse, type NextRequest } from 'next/server'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'
import {
  getCluster, offersFor, foldCluster, offerQuarter, consentOffer, withdrawOffer, answerOffer, reportFold,
  takeBackCorner, isQuarter,
} from '@/lib/accounts/clusters'

// Garden clusters — the shared record (lib/accounts/clusters.ts carries canon's four guards).
// Same rule as /api/friends: WHO YOU ARE comes from the session cookie and only the OTHER party
// comes from the body. There is no action here that names another member to act on — the only
// exit is your own corner, which is the first landlord guard expressed as an API.

function me(req: NextRequest): string | null {
  return readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)?.user_id ?? null
}
const noStore = { headers: { 'cache-control': 'no-store' } }
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) | 0 : 0)

export function GET(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return NextResponse.json({ cluster: null, offers: [] }, noStore)
  return NextResponse.json({ cluster: getCluster(user_id), offers: offersFor(user_id) }, noStore)
}

export async function POST(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return bad('Sign in first', 401)
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = String(b.action ?? '')
  const quarter = b.quarter
  const needQ = () => (isQuarter(quarter) ? null : bad('Which quarter?'))

  let r: { ok: boolean; error?: string; value?: unknown }
  switch (action) {
    case 'fold': { const e = needQ(); if (e) return e
      r = foldCluster(user_id, quarter as never, b.enchant === true, int(b.seed), int(b.tier)); break }
    case 'offer': { const e = needQ(); if (e) return e
      const username = String(b.username ?? '').trim(); if (!username) return bad('Who?')
      r = offerQuarter(user_id, username, quarter as never); break }
    case 'consent': { const e = needQ(); if (e) return e; r = consentOffer(user_id, quarter as never); break }
    case 'withdraw': { const e = needQ(); if (e) return e; r = withdrawOffer(user_id, quarter as never); break }
    case 'answer': { const e = needQ(); if (e) return e
      r = answerOffer(user_id, String(b.cluster_id ?? ''), quarter as never, b.yes === true, int(b.seed), int(b.tier)); break }
    case 'report': r = { ok: reportFold(user_id, int(b.seed), int(b.tier)), error: 'You do not stand in a cluster' }; break
    case 'takeBack': r = takeBackCorner(user_id); break
    default: return bad('Unknown action')
  }
  if (!r.ok) return bad(r.error ?? 'No')
  return NextResponse.json({ cluster: getCluster(user_id), offers: offersFor(user_id) }, noStore)
}
