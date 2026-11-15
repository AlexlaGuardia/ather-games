import { NextResponse, type NextRequest } from 'next/server'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'
import { putGarden, mateGardens } from '@/lib/accounts/clusters'
import { readGarden, GARDEN_MAX_BYTES } from '@/app/shimmer/open/ather/garden-snapshot'

// Garden clusters in the OPEN WORLD (2026-11-15) — each keeper's Ather plot (the squares they hold) as a read-only
// picture for their mates. Same rule as /api/cluster and /api/cluster/plot: WHO YOU ARE comes from the session cookie,
// nothing in the body can name another keeper. POST stores YOUR garden (members only); GET returns your MATES'.

function me(req: NextRequest): string | null {
  return readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)?.user_id ?? null
}
const noStore = { headers: { 'cache-control': 'no-store' } }

export function GET(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return NextResponse.json({ gardens: {} }, noStore)
  return NextResponse.json({ gardens: mateGardens(user_id) }, noStore)
}

export async function POST(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const text = await req.text().catch(() => '')
  if (text.length > GARDEN_MAX_BYTES) return NextResponse.json({ error: 'Garden too large' }, { status: 413 })
  const snap = readGarden(text)
  if (!snap) return NextResponse.json({ error: 'Not a garden' }, { status: 400 })
  const r = putGarden(user_id, JSON.stringify(snap))
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 })
  return NextResponse.json({ ok: true }, noStore)
}
