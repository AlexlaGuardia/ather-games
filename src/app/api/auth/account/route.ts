import { NextResponse, type NextRequest } from 'next/server'
import { deleteAccount } from '@/lib/accounts/db'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'

// Delete your account. Signed-in only, no admin path, no "are you sure" on the server —
// the confirmation belongs in the UI, and by the time a request lands here the answer is
// yes. Clearing the cookie in the same response means the browser can't keep presenting a
// token for a user_id that no longer exists.
export function DELETE(req: NextRequest) {
  const claims = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (!claims) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  deleteAccount(claims.user_id)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}
