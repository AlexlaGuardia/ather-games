'use client'
// ── HOLD THE GAME UNTIL WE KNOW WHOSE SAVE IT IS (Alex 11-18 playtest: built three rooms, refreshed, and the plot showed
// only the planning table + a Keepstone; "it seems like I spent all my goldwood") ──────────────────────────────────────────
// The open world's stores read their save ONCE, lazily, on first use (workshop.tsx works + bank, bag.tsx inv, farm-room,
// journal prefs, loadout, the rinquest flag...) and keep it. On a fresh load the account lands a few frames late
// (SaveOwnerBoot), and until it does gardenKey()/keeperKey() answer the ANONYMOUS slot. A page that drew in that window
// cached the anonymous plot (in Alex's browser an old one: table + Keepstone) and never re-read it; the account's real
// works (farm, cooking, carpentry, on the server rev 531-536) were untouched, just not shown. Worse, the next build or
// placement would have written that anonymous view OVER the account's real save.
// ★ The fix is one gate, not twelve re-read hooks: nothing in the game mounts until saveOwnerResolved(), so every lazy
//   store's first read is already the right key. SaveOwnerBoot always resolves (offline = anonymous), so this never hangs.
import { useEffect, useState, type ReactNode } from 'react'
import { saveOwnerResolved, SAVE_OWNER_EVENT } from '@/lib/save-slot'

export function useOwnerReady(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const on = () => { if (saveOwnerResolved()) setReady(true) }
    on()
    window.addEventListener(SAVE_OWNER_EVENT, on)
    return () => window.removeEventListener(SAVE_OWNER_EVENT, on)
  }, [])
  return ready
}

/** Renders `children` only once the save owner is known; a plain dark screen until then (a few frames). */
export function OwnerReady({ children }: { children: ReactNode }) {
  const ready = useOwnerReady()
  if (!ready) return <div data-owner-wait style={{ position: 'fixed', inset: 0, background: '#0b0d12' }} />
  return <>{children}</>
}
