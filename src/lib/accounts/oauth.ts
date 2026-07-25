// Shared bits of the Google OAuth dance. These live here rather than in the route file
// because Next validates route modules' exports — a route may only export handlers and a
// small set of config keys, so a stray `export const` there is a build error.

export const OAUTH_STATE_COOKIE = 'ather_oauth_state'
export const OAUTH_NEXT_COOKIE = 'ather_oauth_next'

/** Short-lived cookies that only have to survive the round trip to Google. */
export const OAUTH_COOKIE_OPTS = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 600 }

export const DEFAULT_RETURN = '/shimmer/play3d'

/** Only ever return to a path on this site — an absolute or protocol-relative URL is an open redirect. */
export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return DEFAULT_RETURN
  return raw
}
