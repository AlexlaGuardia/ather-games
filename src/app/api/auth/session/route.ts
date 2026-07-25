import { NextResponse, type NextRequest } from 'next/server'
import { getAccount } from '@/lib/accounts/db'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'

// "Who am I" — the real answer, replacing the anonymous shimmerfile stub. Returns null for
// a signed-out player, which is a fully supported state (login is OPTIONAL by design call 2:
// Shimmer and the arcade stay playable anonymously; signing in unlocks friends, garden
// visits, and a trusted leaderboard row).

export function GET(req: NextRequest) {
  const claims = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (!claims) return NextResponse.json({ session: null }, { headers: { 'cache-control': 'no-store' } })

  // Read the account, not just the token: the username in a 30-day cookie goes stale the
  // moment someone claims or changes a name, and the DB is the source of truth.
  const account = getAccount(claims.user_id)
  if (!account) return NextResponse.json({ session: null }, { headers: { 'cache-control': 'no-store' } })

  return NextResponse.json(
    {
      session: {
        user_id: account.user_id,
        username: account.username,
        character_id: account.character_id,
        avatar: account.avatar,
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
