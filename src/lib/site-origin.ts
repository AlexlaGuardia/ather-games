// ── The public origin of this site ────────────────────────────────────────────
//
// ⚠ BEHIND THE CLOUDFLARE TUNNEL, `req.nextUrl.origin` AND `req.url` ARE NOT THE PUBLIC
// ORIGIN. The tunnel forwards to localhost:3200 and Next derives nextUrl from the incoming
// Host header, so anything built on them redirects the visitor to `https://localhost:3200`
// — a dead address on their machine. Two live examples, both real:
//   • a finished Google login landed on https://localhost:3200/room?auth=claim
//   • /owner?logout still answers https://localhost:3200/room
//
// Use this helper for ANY absolute redirect from a route handler. Note the exception:
// middleware (proxy.ts) is fine, because Next emits a RELATIVE Location when the redirect
// target is same-origin — only route handlers produce the absolute broken one.

export interface OriginSource {
  headers: Headers
  nextUrl: URL
}

export function siteOrigin(req: OriginSource): string {
  // 1. An explicit override, if this ever needs to be pinned.
  const explicit = process.env.ATHER_SITE_ORIGIN
  if (explicit) {
    try { return new URL(explicit).origin } catch { /* malformed — keep going */ }
  }
  // 2. The OAuth redirect URI. This is the sturdiest source available: Google enforces an
  //    EXACT match against it, so it cannot quietly drift from the real public origin
  //    without login breaking loudly first.
  const redirectUri = process.env.ATHER_GOOGLE_REDIRECT_URI
  if (redirectUri) {
    try { return new URL(redirectUri).origin } catch { /* malformed — keep going */ }
  }
  // 3. What the proxy says it was asked for.
  const fwdHost = req.headers.get('x-forwarded-host')
  if (fwdHost) return `${req.headers.get('x-forwarded-proto') ?? 'https'}://${fwdHost}`
  // 4. Last resort, and correct for a local `npm run dev`.
  return req.nextUrl.origin
}
