import { NextResponse, type NextRequest } from 'next/server'
import { claimUsername, getAccount } from '@/lib/accounts/db'
import { readSessionToken, mintSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/accounts/session'

// The Shimmerfile — Shimmer's profile surface (username + character). Backed by a real
// account since the accounts layer landed; before that it was a stub that always answered
// "player"/"local".
//
// Anonymous stays a first-class state: a signed-out player gets the same benign profile the
// stub used to return, so single-player Shimmer never meets a login wall.

const ANON = { username: 'player', character_id: null, user_id: 'local', claimed: false }

export function GET(req: NextRequest) {
  const claims = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  const account = claims ? getAccount(claims.user_id) : null
  if (!account) return NextResponse.json({ shimmerfile: ANON }, { headers: { 'cache-control': 'no-store' } })

  return NextResponse.json(
    {
      shimmerfile: {
        username: account.username ?? 'player',
        character_id: account.character_id,
        user_id: account.user_id,
        claimed: account.username !== null,
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}

/** Claim (or change) the username on the signed-in account — what UsernamePicker posts to. */
export async function POST(req: NextRequest) {
  const claims = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (!claims) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { username?: string; characterId?: string }
  const username = String(body.username ?? '').trim()
  const characterId = body.characterId ? String(body.characterId).slice(0, 24) : null

  const result = claimUsername(claims.user_id, username, characterId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const res = NextResponse.json({
    shimmerfile: {
      username: result.account.username,
      character_id: result.account.character_id,
      user_id: result.account.user_id,
      claimed: true,
    },
  })
  // Re-mint: the token carries the username, so an un-refreshed 30-day cookie would keep
  // reporting the old name (or null) to the WS server long after the claim.
  res.cookies.set(SESSION_COOKIE, mintSession(result.account.user_id, result.account.username), sessionCookieOptions())
  return res
}
