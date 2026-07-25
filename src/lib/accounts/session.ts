// ── ather.games session tokens ────────────────────────────────────────────────
//
// The identity bridge between the two processes: the Next app (:3200) MINTS a signed
// token, the FastAPI WS server (:8400) VERIFIES it. Both sides share ATHER_SESSION_SECRET
// and nothing else — no shared DB, no token in the URL. Because the WS lives at
// wss://ather.games/shimmer-ws/ws (same origin), the browser sends the httpOnly cookie on
// the upgrade automatically and FastAPI reads it off the Cookie header (PyJWT, HS256).
//
// Hand-rolled rather than pulling `jose`/`jsonwebtoken`: it is standard-compliant HS256 in
// ~40 lines, PyJWT verifies it as-is, and this repo keeps its dependency list short on
// purpose. The rules that keep hand-rolled JWT safe are all here: constant-time compare,
// the header's alg is NEVER trusted (we only ever accept HS256), and exp is mandatory.

import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'ather_session'
export const SESSION_TTL_SEC = 30 * 24 * 60 * 60 // 30d

export interface SessionClaims {
  user_id: string
  username: string | null
  exp: number
  iat: number
}

const b64url = (buf: Buffer): string => buf.toString('base64url')
const unb64url = (s: string): Buffer => Buffer.from(s, 'base64url')

function hmac(data: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(data).digest()
}

/** Sign an arbitrary payload as a compact HS256 JWT. `exp`/`iat` are stamped by the caller. */
export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const head = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = b64url(Buffer.from(JSON.stringify(payload)))
  const data = `${head}.${body}`
  return `${data}.${b64url(hmac(data, secret))}`
}

/**
 * Verify + decode. Returns null on ANY problem (shape, signature, expiry) — callers treat
 * null as "anonymous", never as an error to surface.
 */
export function verifyJwt(token: string | undefined | null, secret: string): Record<string, unknown> | null {
  if (!token || !secret) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [head, body, sig] = parts

  const expected = hmac(`${head}.${body}`, secret)
  let given: Buffer
  try {
    given = unb64url(sig)
  } catch {
    return null
  }
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  let claims: Record<string, unknown>
  try {
    const header = JSON.parse(unb64url(head).toString()) as { alg?: string }
    // Never honour the token's own algorithm choice — that is the alg-confusion hole.
    if (header.alg !== 'HS256') return null
    claims = JSON.parse(unb64url(body).toString()) as Record<string, unknown>
  } catch {
    return null
  }

  const exp = typeof claims.exp === 'number' ? claims.exp : 0
  if (!exp || exp <= Math.floor(Date.now() / 1000)) return null
  return claims
}

/** The shared secret. Read lazily — a missing env must not crash the build, only the login. */
export function sessionSecret(): string {
  return process.env.ATHER_SESSION_SECRET || ''
}

export function mintSession(user_id: string, username: string | null, nowSec = Math.floor(Date.now() / 1000)): string {
  return signJwt(
    { user_id, username, iat: nowSec, exp: nowSec + SESSION_TTL_SEC },
    sessionSecret(),
  )
}

/** Read the session out of a raw cookie value. Null = anonymous (the normal, supported state). */
export function readSessionToken(token: string | undefined): SessionClaims | null {
  const claims = verifyJwt(token, sessionSecret())
  if (!claims || typeof claims.user_id !== 'string') return null
  return {
    user_id: claims.user_id,
    username: typeof claims.username === 'string' ? claims.username : null,
    exp: claims.exp as number,
    iat: (claims.iat as number) ?? 0,
  }
}

/** Cookie options shared by every place that sets the session (login, username claim). */
export function sessionCookieOptions(maxAgeSec = SESSION_TTL_SEC) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSec,
  }
}
