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

/**
 * Where sign-in lands when there is no explicit `next`. Followed play3d → voxel3d on 2026-08-07.
 *
 * ⚠ This is not cosmetic: play3d became owner-gated in the same change, so leaving it here would
 * have bounced every non-owner who signed in straight to /room — a sign-in that silently fails to
 * return you to the game. A gated route can never be a default landing.
 */
export const DEFAULT_RETURN = '/shimmer/voxel3d'

/** Only ever return to a path on this site — an absolute or protocol-relative URL is an open redirect. */
export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return DEFAULT_RETURN
  return raw
}
