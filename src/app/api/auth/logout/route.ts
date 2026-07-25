import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/accounts/session'

// Sign out = drop the cookie. Nothing server-side to tear down; the token is stateless and
// its own expiry is the backstop.
export function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}
