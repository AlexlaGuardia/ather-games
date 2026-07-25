// Shared bits of the Google OAuth dance. These live here rather than in the route file
// because Next validates route modules' exports — a route may only export handlers and a
// small set of config keys, so a stray `export const` there is a build error.
//
// ⚠ THE ENV VARS ARE NAMESPACED `ATHER_GOOGLE_*` ON PURPOSE — DO NOT "TIDY" THEM BACK TO
// `GOOGLE_*`. The PM2 daemon on this box was started from a shell that had guardia-core's
// .env sourced, so its own environment carries GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
// GOOGLE_REDIRECT_URI (the cockpit's Google app, pointing at akatskii.com). Every process
// PM2 spawns inherits those, and in Next a real process env variable BEATS a .env file. So
// this app silently signed in with the cockpit's client and the cockpit's redirect URI while
// its own .env sat there looking correct — which is invisible unless you read the running
// process's environ, not the file.
//
// Clearing the daemon's environment would need `pm2 kill`, which is what took the whole
// stack down on 2026-07-19 (pm2 kill deactivates pm2-root.service and systemd cgroup-culls
// the resurrected apps). Namespacing is the safe fix and the more durable one: nothing
// global can shadow a name only this app uses.

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

/**
 * The PUBLIC origin of this site.
 *
 * ⚠ Do NOT build a redirect on `req.nextUrl.origin` here. Cloudflare's tunnel forwards to
 * localhost:3200 and Next derives nextUrl from the incoming Host header, so the origin comes
 * out as `https://localhost:3200` — the player finishes a perfectly good Google login and
 * gets dumped on a dead address. (Real: `https://localhost:3200/room?auth=claim`.)
 *
 * ATHER_GOOGLE_REDIRECT_URI is the reliable answer because Google enforces an EXACT match
 * against it, so it cannot drift from the real public origin without login breaking loudly
 * first. The forwarded headers are a second try, and nextUrl is the last resort so a local
 * `npm run dev` still works.
 */
export function siteOrigin(req: { headers: Headers; nextUrl: URL }): string {
  const configured = process.env.ATHER_GOOGLE_REDIRECT_URI
  if (configured) {
    try { return new URL(configured).origin } catch { /* malformed — fall through */ }
  }
  const fwdHost = req.headers.get('x-forwarded-host')
  if (fwdHost) return `${req.headers.get('x-forwarded-proto') ?? 'https'}://${fwdHost}`
  return req.nextUrl.origin
}
