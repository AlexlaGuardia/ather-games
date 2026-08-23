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
  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(data) as Record<string, unknown> } catch { return NextResponse.json({ error: 'data must be JSON' }, { status: 400 }) }

  // ── ⚠ THE LAST LINE OF DEFENCE (#682, 2026-08-23) ──────────────────────────────────────────────
  // Until today this wrote whatever arrived, under whoever's cookie arrived with it. That is what
  // made the bug DESTRUCTIVE rather than merely confusing: the client had one save slot with no
  // account in it, so account B's session posted account A's world and `putSave` replaced B's
  // garden with it. Reproduced end to end, and found already done once in production.
  //
  // The client is fixed (per-account slots), but a server that trusts the client is one stale
  // bundle away from the same loss — and a browser tab open across a sign-in is exactly that. A
  // blob stamped for a DIFFERENT account is refused here no matter what the cookie says.
  //
  // ★ UNSTAMPED IS ACCEPTED, DELIBERATELY. Every save written before today carries no stamp, and
  // every client still running yesterday's bundle sends none. Refusing those would stop the world
  // saving for everyone mid-rollout — a self-inflicted outage in place of a rare overwrite. The
  // check is "does it name someone else", never "does it name me".
  const owner = parsed?.['_owner']
  if (typeof owner === 'string' && owner && owner !== userId) {
    return NextResponse.json({ error: 'That save belongs to another account' }, { status: 409 })
  }
  putSave(userId, game, data)
  return NextResponse.json({ ok: true })
}
