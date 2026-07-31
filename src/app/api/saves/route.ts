import { NextResponse, type NextRequest } from 'next/server'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'
import { getSave, putSave } from '@/lib/accounts/db'

// Cloud saves — stage 2 of per-keeper Home Plots. The client stays authoritative while
// playing (localStorage); this is the copy that survives the browser. Signed-out players
// get 401 and the client treats it as "no cloud", so anonymous play never meets a wall.
//
// Conflict policy (deliberate, keep it dumb): pushes overwrite, pulls only fill a BLANK
// device. The client never overwrites a local save with the server copy on its own — a
// stale cloud clobbering live play is the one unrecoverable failure here, and "local wins
// when present" removes it entirely at the cost of last-writer-wins across devices.

const GAMES = new Set(['shimmer', 'wallet', 'magii'])
const MAX_BYTES = 512 * 1024 // a real shimmer save is a few KB; 512KB is a runaway guard

function auth(req: NextRequest): string | null {
  const claims = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  return claims?.user_id ?? null
}

export function GET(req: NextRequest) {
  const userId = auth(req)
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const game = req.nextUrl.searchParams.get('game') ?? ''
  if (!GAMES.has(game)) return NextResponse.json({ error: 'Unknown game' }, { status: 400 })
  const row = getSave(userId, game)
  if (!row) return NextResponse.json({ save: null }, { headers: { 'cache-control': 'no-store' } })
  return NextResponse.json(
    { save: { data: row.data, updated_at: row.updated_at } },
    { headers: { 'cache-control': 'no-store' } },
  )
}

export async function POST(req: NextRequest) {
  const userId = auth(req)
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { game?: string; data?: string } | null
  const game = String(body?.game ?? '')
  const data = body?.data
  if (!GAMES.has(game)) return NextResponse.json({ error: 'Unknown game' }, { status: 400 })
  if (typeof data !== 'string' || data.length === 0) return NextResponse.json({ error: 'data must be a non-empty string' }, { status: 400 })
  if (data.length > MAX_BYTES) return NextResponse.json({ error: 'Save too large' }, { status: 413 })
  try { JSON.parse(data) } catch { return NextResponse.json({ error: 'data must be JSON' }, { status: 400 }) }
  putSave(userId, game, data)
  return NextResponse.json({ ok: true })
}
