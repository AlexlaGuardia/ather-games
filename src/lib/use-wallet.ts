'use client'

import { useCallback, useEffect, useState } from 'react'
import { getMarks, addMarks, spendMarks, MARKS_EVENT } from './wallet'

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
export function useWallet() {
  const [marks, setMarks] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sync = () => setMarks(getMarks())
    sync()
    setLoading(false)
    window.addEventListener(MARKS_EVENT, sync)
    window.addEventListener('storage', sync) // another tab spent/earned
    return () => {
      window.removeEventListener(MARKS_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const earn = useCallback((amount: number) => { addMarks(amount) }, [])
  const spend = useCallback((amount: number): boolean => spendMarks(amount), [])

  return { marks, earn, spend, loading, isSignedIn: true }
}
