'use client'
// ── REAL PLAYERS, REAL REPLAYS ────────────────────────────────────────────────────────────────────
//
// PostHog on the arcade: pageviews, autocapture, and session replay of the DOM layer. Same project
// as alexlaguardia.dev (605903); `$host` tells the two sites apart. The key is NEXT_PUBLIC_, so it
// is baked in by `next build` from .env — a keyless build initialises nothing and the site runs as
// before.
//
// ★ INIT AT MODULE LOAD, NOT IN AN EFFECT. Child effects run before a parent's, so anything that
// later reads a flag would see an uninitialised client if this waited for useEffect (learned on
// the portfolio, a31e21f there).
//
// ⚠ CANVAS IS NOT RECORDED, ON PURPOSE. Replay captures DOM mutations; the game worlds are canvas
// and WebGL, and `record_canvas` would ship frames from the main thread of a machine already
// fighting for it (Alex's UHD 630 rule). A replay shows the gx-* UI layer over a blank stage, which
// is enough to see where a player goes and where they stop. Turn canvas on deliberately, never by
// default.
import posthog from 'posthog-js'

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

if (typeof window !== 'undefined' && KEY && !posthog.__loaded) {
  posthog.init(KEY, {
    api_host: HOST,
    defaults: '2025-05-24',
    capture_pageview: 'history_change',
    capture_pageleave: true,
    session_recording: { maskAllInputs: true },
    person_profiles: 'identified_only',
  })
}

export default function AnalyticsBoot() {
  return null
}
