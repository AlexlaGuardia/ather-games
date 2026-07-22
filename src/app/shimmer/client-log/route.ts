// TEMP debug sink — the play3d page beacons uncaught client errors here so they land in
// pm2 logs (browser console access isn't always available). Remove when stable.
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  const text = (await req.text()).slice(0, 4000)
  console.error('[client-error]', text)
  return NextResponse.json({ ok: true })
}
