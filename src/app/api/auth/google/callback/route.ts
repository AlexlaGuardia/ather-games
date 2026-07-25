import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { upsertGoogleAccount } from '@/lib/accounts/db'
import { mintSession, sessionSecret, SESSION_COOKIE, sessionCookieOptions } from '@/lib/accounts/session'
import { OAUTH_STATE_COOKIE, OAUTH_NEXT_COOKIE, safeReturnPath } from '@/lib/accounts/oauth'

// Step 2: Google hands back a code, we trade it for an id_token, and that becomes an
// account + a session cookie. Failures always land the player back in the game with a
// ?auth=<reason> marker rather than on a JSON error page — a broken login should never be
// a dead end.

interface GoogleTokenResponse {
  id_token?: string
  error?: string
  error_description?: string
}

interface IdTokenClaims {
  sub?: string
  aud?: string
  iss?: string
  exp?: number
  email?: string
  picture?: string
  email_verified?: boolean
}

const GOOGLE_ISS = new Set(['accounts.google.com', 'https://accounts.google.com'])

function decodeSegment(seg: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(seg, 'base64url').toString()) as Record<string, unknown>
  } catch {
    return null
  }
}

function fail(req: NextRequest, reason: string, back = '/shimmer/play3d') {
  const url = new URL(back, req.nextUrl.origin)
  url.searchParams.set('auth', reason)
  const res = NextResponse.redirect(url.toString())
  res.cookies.delete(OAUTH_STATE_COOKIE)
  res.cookies.delete(OAUTH_NEXT_COOKIE)
  return res
}

export async function GET(req: NextRequest) {
  const clientId = process.env.ATHER_GOOGLE_CLIENT_ID
  const clientSecret = process.env.ATHER_GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.ATHER_GOOGLE_REDIRECT_URI
  const back = safeReturnPath(req.cookies.get(OAUTH_NEXT_COOKIE)?.value ?? null)

  if (!clientId || !clientSecret || !redirectUri || !sessionSecret()) return fail(req, 'unconfigured', back)

  const err = req.nextUrl.searchParams.get('error')
  if (err) return fail(req, 'denied', back) // player hit Cancel on the consent screen

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state') ?? ''
  const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value ?? ''
  if (!code) return fail(req, 'nocode', back)

  // CSRF: the state we planted must come back verbatim. Constant-time, and length-guarded
  // because timingSafeEqual throws on mismatched lengths.
  const a = Buffer.from(state)
  const b = Buffer.from(stateCookie)
  if (!stateCookie || a.length !== b.length || !timingSafeEqual(a, b)) return fail(req, 'state', back)

  // Exchange the code. This is a server-to-server call over TLS.
  let token: GoogleTokenResponse
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    token = (await tokenRes.json()) as GoogleTokenResponse
    if (!tokenRes.ok || !token.id_token) return fail(req, 'exchange', back)
  } catch {
    return fail(req, 'network', back)
  }

  // Per Google's own guidance, an id_token received DIRECTLY from the token endpoint over a
  // verified TLS channel does not need its signature re-checked — nobody else could have put
  // it there. We still validate the claims that decide who this is (aud/iss/exp/sub), because
  // those are what we are about to trust.
  const parts = token.id_token.split('.')
  const claims = parts.length === 3 ? (decodeSegment(parts[1]) as IdTokenClaims | null) : null
  if (!claims?.sub) return fail(req, 'badtoken', back)
  if (claims.aud !== clientId) return fail(req, 'aud', back)
  if (!claims.iss || !GOOGLE_ISS.has(claims.iss)) return fail(req, 'iss', back)
  if (!claims.exp || claims.exp * 1000 <= Date.now()) return fail(req, 'expired', back)

  const account = upsertGoogleAccount(claims.sub, claims.email ?? null, claims.picture ?? null)

  // Land back where they were. The client reads /api/auth/session on mount; a null username
  // is what opens the picker, so no extra flag is needed in the URL.
  const dest = new URL(back, req.nextUrl.origin)
  dest.searchParams.set('auth', account.username ? 'ok' : 'claim')
  const res = NextResponse.redirect(dest.toString())
  res.cookies.set(SESSION_COOKIE, mintSession(account.user_id, account.username), sessionCookieOptions())
  res.cookies.delete(OAUTH_STATE_COOKIE)
  res.cookies.delete(OAUTH_NEXT_COOKIE)
  return res
}
