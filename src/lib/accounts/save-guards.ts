// ── GUARDS SHARED BY THE SAVE ROUTES (serb, 2026-11-17, docs/M12-cloud-save.md §6 + §8) ─────────────────────
//
// `/api/saves` and (next) `/api/saves/open` both take a signed-in player's blob and write it to the account. These are
// the checks that are about the REQUEST, not about the save format, so both routes take them from one place.

import type { NextRequest } from 'next/server'
import { siteOrigin } from '@/lib/site-origin'

/** Size in BYTES on the wire. `string.length` counts UTF-16 units and under-counts non-ASCII up to 3x. */
export function byteLength(s: string): number {
  return Buffer.byteLength(s, 'utf8')
}

/**
 * Is this POST from a page on our own origin?
 *
 * SameSite=Lax already keeps the session cookie off a cross-site form POST, but `req.json()` parses any body
 * whatever its Content-Type, so that protection is a side effect of a cookie default. This makes it explicit.
 *
 * Rule: the Origin's host must be the site's configured public host, or the host this request was addressed to
 * (`x-forwarded-host`, else `host`). See the note in the body for why both.
 * - No Origin header → allowed. Browsers always send Origin on a cross-site POST (and on fetch/sendBeacon POSTs),
 *   so a missing one is a non-browser client (test scripts, curl), which a CSRF guard has nothing to say about.
 * - `Origin: null` (sandboxed frame, opaque redirect) → refused.
 */
export function sameOriginPost(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (origin === null) return true
  let originHost: string
  try { originHost = new URL(origin).host } catch { return false }   // includes the literal "null"
  // ★ TWO ACCEPTED HOSTS, BECAUSE THE TUNNEL MAY HAND US `localhost:3200` AS THE HOST (memory: tunnel origin is not
  // the public origin). The configured public origin (`siteOrigin`: ATHER_SITE_ORIGIN, else the Google redirect URI,
  // which Google pins exactly) covers prod whatever cloudflared sends; the request's own host covers every devwin and
  // local dev, where the browser talks to localhost:<port> directly.
  const allowed = new Set<string>()
  const reqHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (reqHost) allowed.add(reqHost.toLowerCase())
  try { allowed.add(new URL(siteOrigin(req)).host.toLowerCase()) } catch { /* no configured origin */ }
  return allowed.has(originHost.toLowerCase())
}

// ── per-account push rate limit ──────────────────────────────────────────────────────────────────────────────
// In-process sliding window. One next-server process serves the site, so in-memory is the whole truth; a restart
// forgets the window, which errs open, the right direction for a save path.
// ⚠ LOOSE ON PURPOSE: the client debounces 8 s per game and adds one pagehide beacon, so real play is ~8/min/game.
// A limit that ever bites real play eats the beacon, which is the player's LAST save. This only stops a runaway.
export const SAVE_PUSHES_PER_MIN = 30
const WINDOW_MS = 60_000
const hits = new Map<string, number[]>()

/** Record a push for this account; false = over the limit (answer 429, write nothing). */
export function allowSavePush(userId: string, now = Date.now()): boolean {
  const recent = (hits.get(userId) ?? []).filter(t => now - t < WINDOW_MS)
  if (recent.length >= SAVE_PUSHES_PER_MIN) { hits.set(userId, recent); return false }
  recent.push(now)
  hits.set(userId, recent)
  if (hits.size > 10_000) {   // bound the map: drop accounts with no push in the window
    for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k)
  }
  return true
}

/** Test seam. */
export function _resetSaveRateLimit(): void {
  hits.clear()
}
