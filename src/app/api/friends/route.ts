import { NextResponse, type NextRequest } from 'next/server'
import { listFriends, addFriend, acceptFriend, removeFriend } from '@/lib/accounts/db'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'

// Friends. Signed-in only — there is no anonymous friends list, and that is the point of
// the account layer: before it, "who is my friend" was a claim the client made about itself.
//
// Every action derives WHO YOU ARE from the session cookie and only ever takes the OTHER
// party from the request body. There is no code path here that lets a caller act as someone
// else, which is what makes the invite gate downstream worth anything.

function me(req: NextRequest): string | null {
  return readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)?.user_id ?? null
}

export function GET(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return NextResponse.json({ friends: [] }, { headers: { 'cache-control': 'no-store' } })
  return NextResponse.json({ friends: listFriends(user_id) }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const user_id = me(req)
  if (!user_id) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { action?: string; username?: string; friendUserId?: string }
  const action = String(body.action ?? '')

  if (action === 'add') {
    const username = String(body.username ?? '').trim()
    if (!username) return NextResponse.json({ error: 'Who?' }, { status: 400 })
    const result = addFriend(user_id, username)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    // `accepted` tells the panel this closed a request they had already sent, rather than
    // opening a new one — a different sentence for the player, same call.
    return NextResponse.json({ sent_to: result.friend.username, accepted: result.accepted ?? false })
  }

  const otherId = String(body.friendUserId ?? '')
  if (!otherId) return NextResponse.json({ error: 'Which player?' }, { status: 400 })

  if (action === 'accept') {
    if (!acceptFriend(user_id, otherId)) return NextResponse.json({ error: 'No pending request from them' }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'remove') {
    removeFriend(user_id, otherId) // idempotent: removing a non-friend is a no-op, not an error
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
