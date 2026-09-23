import { NextResponse, type NextRequest } from 'next/server'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'
import { putPlotSnapshot, matePlotSnapshots } from '@/lib/accounts/clusters'
import { readSnapshot, SNAPSHOT_MAX_BYTES } from '@/app/shimmer/voxel/plot-snapshot'

// Cluster phase 3 — each keeper's plot as a read-only picture for their cluster-mates.
// Same rule as /api/cluster: WHO YOU ARE comes from the session cookie and nothing in the body can
// name another keeper. POST stores YOUR OWN snapshot (members only); GET returns your MATES' (never
// your own, never anyone outside your cluster). The store and its guards live in clusters.ts; what a
// snapshot is, and checking it, in plot-snapshot.ts — run on the way in here and again on the way
// into the world, because a mate's snapshot is somebody else's data.

function me(req: NextRequest): string | null {
  return readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)?.user_id ?? null
}
const noStore = { headers: { 'cache-control': 'no-store' } }

export function GET(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return NextResponse.json({ plots: {} }, noStore)
  return NextResponse.json({ plots: matePlotSnapshots(user_id) }, noStore)
}

export async function POST(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const text = await req.text().catch(() => '')
  if (text.length > SNAPSHOT_MAX_BYTES) return NextResponse.json({ error: 'Plot too large' }, { status: 413 })
  const snap = readSnapshot(text)
  if (!snap) return NextResponse.json({ error: 'Not a plot snapshot' }, { status: 400 })
  const r = putPlotSnapshot(user_id, JSON.stringify(snap))
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 })
  return NextResponse.json({ ok: true }, noStore)
}
