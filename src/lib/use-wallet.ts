'use client'

import { useCallback, useEffect, useState } from 'react'
import { getMarks, addMarks, spendMarks, MARKS_EVENT } from './wallet'
import { saveOwnerResolved, SAVE_OWNER_EVENT } from './save-slot'

// Thin React wrapper over lib/wallet.ts — the single shared Marks store. API-compatible
// with the old hook ({ marks, earn, spend, loading, isSignedIn }) so the Magii card game
// and Shimmer compile unchanged; the difference is every surface now shares ONE store and
// the balance updates live across components (MARKS_EVENT), instead of each hook holding
// its own copy.
//
// `loading` is preserved deliberately: it starts true and flips false after the mount
// read. That keeps SSR/first-render at marks=0 (no hydration mismatch) AND lets callers
// that gate on it — e.g. the card game's one-time WELCOME_STAKE seed — wait for the real
// balance before acting, so a returning player is never re-seeded.
//
// ── ★★ AND SINCE 2026-08-23 IT MEANS ONE MORE THING: WE DO NOT YET KNOW WHOSE PURSE THIS IS ──────
// The wallet is per-account now, and the account is answered a few frames into the page by
// `SaveOwnerBoot` — so between mount and that answer, `getMarks()` is reading the ANONYMOUS purse.
// A read there is merely stale and self-corrects on the event. A WRITE is money earned into a purse
// the account will never see.
//
// ★ THIS FLAG ALREADY EXISTED FOR THE SAME SHAPE OF PROBLEM, which is why it is the right place:
// its whole purpose was "wait for the real balance before acting". "Real" now includes "the right
// player's". The card game's welcome-stake gate therefore covers the new race for free — and that
// matters, because the stake fires on `marks === 0`, and an unresolved read of an EMPTY anonymous
// purse looks exactly like a new player.
//
// ⚠⚠ AND THE FIRST VERSION OF THIS COMMENT OVERSTATED IT, so here is the measured truth: removing
// this gate does NOT re-grant the stake. A mutation sweep took out this gate AND the card page's,
// and the browser probe stayed green — the stake is really held by the persisted `seeded` flag
// inside the (now per-account) card save. So this is defence in depth with no demonstrated failing
// case, kept because the contract it states is the one every future writer will read, and the next
// automatic earner will not have a `seeded` flag of its own. **A guard I have not seen fail is a
// guard I have not tested** — this one is labelled rather than trusted.
export function useWallet() {
  const [marks, setMarks] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sync = () => {
      setMarks(getMarks())
      // Only claim to be loaded once somebody has answered who is playing.
      if (saveOwnerResolved()) setLoading(false)
    }
    sync()
    window.addEventListener(MARKS_EVENT, sync)
    window.addEventListener(SAVE_OWNER_EVENT, sync)  // the answer landed — re-read the right purse
    window.addEventListener('storage', sync) // another tab spent/earned
    return () => {
      window.removeEventListener(MARKS_EVENT, sync)
      window.removeEventListener(SAVE_OWNER_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const earn = useCallback((amount: number) => { addMarks(amount) }, [])
  const spend = useCallback((amount: number): boolean => spendMarks(amount), [])

  return { marks, earn, spend, loading, isSignedIn: true }
}
