import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { OAUTH_STATE_COOKIE, OAUTH_NEXT_COOKIE, OAUTH_COOKIE_OPTS, safeReturnPath } from '@/lib/accounts/oauth'

// Step 1 of the Google login dance: mint a CSRF nonce, remember where the player was, and
// hand them to Google's consent screen. Raw OAuth, no next-auth — the stack already does
// this for Drive/Gmail elsewhere and the whole flow is four small routes.

export function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'sign-in is not configured on this server' }, { status: 503 })
  }

  const state = randomBytes(16).toString('hex')
  const next = safeReturnPath(req.nextUrl.searchParams.get('next'))

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  // select_account, not consent: returning players get a picker, not a re-authorisation wall.
  url.searchParams.set('prompt', 'select_account')

  const res = NextResponse.redirect(url.toString())
  res.cookies.set(OAUTH_STATE_COOKIE, state, OAUTH_COOKIE_OPTS)
  res.cookies.set(OAUTH_NEXT_COOKIE, next, OAUTH_COOKIE_OPTS)
  return res
}
