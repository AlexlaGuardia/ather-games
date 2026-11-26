'use client'
// ── BETA M188 s4: the client side of /api/brewing (brewings posted to the Chordstone). ─────────────────────────────────────
// useBrewings: the Chordstone's brewings card + the map door read it (fresh on mount, then every `pollMs`).
// useBrewingDoor: mounted once per open-world page (OpenSocial). When a brewing THIS keeper hosts enters its door window
// (brewing-rules.ts › doorOpen), it makes sure the host stands in a chord (starts one if none) and posts that chord code +
// its plot id, so its seat holders' map door can bring them to the host's garden. Nothing is posted outside the window.
import { useCallback, useEffect, useRef, useState } from 'react'
import { doorOpen } from '@/lib/accounts/brewing-rules'
import type { BrewingView, Rsvp } from '@/lib/accounts/brewings'

export type { BrewingView, Rsvp }
export interface BrewState { brewings: BrewingView[]; rsvps: Rsvp[]; now: number; loaded: boolean }

export function useBrewings(active: boolean, pollMs = 8000) {
  const [s, setS] = useState<BrewState>({ brewings: [], rsvps: [], now: Date.now(), loaded: false })
  const [busy, setBusy] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/brewing', { cache: 'no-store' })
      const b = await r.json() as Partial<BrewState>
      setS({ brewings: b.brewings ?? [], rsvps: b.rsvps ?? [], now: b.now ?? Date.now(), loaded: true })
    } catch { /* keep what we had; the next tick tries again */ }
  }, [])
  useEffect(() => {
    if (!active) return
    refresh(); const id = setInterval(refresh, pollMs)
    return () => clearInterval(id)
  }, [active, pollMs, refresh])
  /** run an action; returns the server's error, or null */
  const act = useCallback(async (action: string, body: Record<string, unknown> = {}): Promise<string | null> => {
    setBusy(action)
    try {
      const r = await fetch('/api/brewing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
      const b = await r.json() as Partial<BrewState> & { error?: string }
      if (!r.ok) return b.error ?? 'That did not work'
      setS({ brewings: b.brewings ?? [], rsvps: b.rsvps ?? [], now: b.now ?? Date.now(), loaded: true })
      return null
    } catch { return 'Could not reach the Chordstone' } finally { setBusy(null) }
  }, [])
  return { ...s, busy, refresh, act }
}

const DOOR_POLL_MS = 30_000
export function useBrewingDoor(signedIn: boolean, party: string | null, start: () => string, look: string | null) {
  const partyRef = useRef(party), startRef = useRef(start), posted = useRef<Record<string, string>>({})
  partyRef.current = party; startRef.current = start
  useEffect(() => {
    if (!signedIn || !look) return
    let stop = false
    const tick = async () => {
      try {
        const r = await fetch('/api/brewing', { cache: 'no-store' })
        const b = await r.json() as Partial<BrewState>
        const now = b.now ?? Date.now()
        for (const x of b.brewings ?? []) {
          if (stop || !x.mine || !doorOpen(x.at, now)) continue
          const code = partyRef.current ?? startRef.current()
          if (posted.current[x.brewing_id] === `${code}:${look}`) continue
          const p = await fetch('/api/brewing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'door', brewing_id: x.brewing_id, code, look }) })
          if (p.ok) posted.current[x.brewing_id] = `${code}:${look}`
        }
      } catch { /* the next tick tries again */ }
    }
    tick(); const id = setInterval(tick, DOOR_POLL_MS)
    return () => { stop = true; clearInterval(id) }
  }, [signedIn, look])
  // a chord change inside the window re-posts on the next tick (the posted key holds the code)
}
