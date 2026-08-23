'use client'
// ── WHO IS PLAYING, ANSWERED ONCE FOR THE WHOLE SITE ────────────────────────────────────────────
//
// Shimmer's two routes each resolve the session in their own boot gate, because each has to hold a
// world behind it. The MARKS PURSE has no such gate and never could: `SiteNav` renders the balance
// on every page in the arcade, and the card game reads it at `/magii`. Splitting the purse per
// account (Alex, 2026-08-23) therefore needed an answer that arrives everywhere, not per route.
//
// ★ WHY NOT READ THE COOKIE IN THE SERVER LAYOUT, which would be race-free and obvious: reading
// cookies in the root layout opts the ENTIRE SITE out of static rendering. Most of ather.games is
// `○ Static` today — the arcade, the cabinets, every game shell — and turning all of it into
// per-request server work to learn a name that only the purse needs is a bad trade for a public
// games site. So the answer arrives a few frames late, and the surfaces that can ACT on it wait.
//
// ⚠ WHAT ARRIVING LATE MEANS, AND WHY IT IS SAFE. Until this resolves, `saveKey()` and `gameSlot()`
// answer with the ANONYMOUS slot. That is fine for a READ (you see the anonymous purse for a
// moment, then the event corrects it) and dangerous for a WRITE — coins earned into the anonymous
// purse in the first frames are coins the account never sees. So writes gate on
// `saveOwnerResolved()` via `useWallet().loading`, which already existed for exactly this shape of
// problem: the card game's one-time welcome stake was already waiting on it so a returning player
// is never re-seeded.
//
// ⚠ A FAILED FETCH RESOLVES TO ANONYMOUS, DELIBERATELY — the same rule the game routes use. Offline
// means we cannot prove who this is, and the safe direction is a signed-in player seeing their
// anonymous purse (confusing, reversible) rather than guessing a name and spending someone's coins.
import { useEffect } from 'react'
import { setSaveOwner, adoptAnonSlots } from '@/lib/save-slot'

export default function SaveOwnerBoot() {
  useEffect(() => {
    let cancelled = false
    void (async () => {
      let userId: string | null = null
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' })
        const body = (await res.json()) as { session: { user_id: string } | null }
        userId = body.session?.user_id ?? null
      } catch { /* offline — anonymous, local-only */ }
      if (cancelled) return
      setSaveOwner(userId)                 // fires SAVE_OWNER_EVENT; live readouts re-read
      // First sign-in moves this browser's anonymous purse and card save into the account. Once,
      // ever — `planSlotAdoption` has the rules and why an already-claimed browser is left alone.
      const plan = adoptAnonSlots(userId)
      if (plan.reason === 'adopted' && plan.moves.length) {
        console.info(`[save] adopted this browser's anonymous ${plan.moves.length === 1 ? 'slot' : 'slots'} into the account signing in`)
      }
    })()
    return () => { cancelled = true }
  }, [])
  return null
}
