import { NextResponse, type NextRequest } from 'next/server'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'
import { getOpenSave, takeOpenLease } from '@/lib/accounts/db'
import { allowSavePush, sameOriginPost } from '@/lib/accounts/save-guards'

// Take the open-world write lease for a device (docs/M12-cloud-save.md §4). Returns the current doc + rev.
export async function POST(req: NextRequest) {
  if (!sameOriginPost(req)) return NextResponse.json({ error: 'Cross-site request refused' }, { status: 403 })
  const userId = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)?.user_id
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  if (!allowSavePush(userId)) return NextResponse.json({ error: 'Too many saves, slow down' }, { status: 429 })
  const body = (await req.json().catch(() => null)) as { device?: unknown } | null
  const device = body?.device
  if (typeof device !== 'string' || !device || device.length > 128) return NextResponse.json({ error: 'device required' }, { status: 400 })
  takeOpenLease(userId, device)   // no row yet: nothing to lease, the first push claims it
  const row = getOpenSave(userId)
  const headers = { 'cache-control': 'no-store' }
  if (!row) return NextResponse.json({ doc: null, rev: 0 }, { headers })
  return NextResponse.json({ doc: JSON.parse(row.data), rev: row.rev, lease: { device, at: row.lease_at } }, { headers })
}
