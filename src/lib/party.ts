'use client'

// ── The party — one group, every game ─────────────────────────────────────────
//
// A party is the answer to "who am I playing with", and it is deliberately the ONLY answer.
// It used to live inside play3d, which meant it was a Shimmer concept; now it lives here,
// above the games, so the same group carries from the world to the card table without
// anyone re-inviting anyone.
//
// Three mechanisms could each claim to define a group, so they are given separate jobs and
// never overlap:
//   • PARTY  — the group itself. Every game reads this.
//   • FRIENDS — the address book you populate a party FROM (see lib/accounts).
//   • CODE/LINK — the fallback address, for someone who is not signed in.
//
// Membership is possession of the code. That is friends-grade trust, not proof: player_id is
// still client-claimed until the WS trust bridge lands. Fine for sitting down with people you
// know; not something to hang an economy on.

import { useCallback, useEffect, useState } from 'react'

const KEY = 'ather:mp:party'
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no I/L/O/0/1 — read-aloud safe

export function sanitizePartyCode(raw: string): string | null {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  return clean.length >= 4 ? clean : null
}

export function newPartyCode(): string {
  let code = ''
  for (let i = 0; i < 5; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return code
}

export function storedParty(): string | null {
  try { return sanitizePartyCode(localStorage.getItem(KEY) ?? '') } catch { return null }
}

export function storeParty(code: string | null) {
  try {
    if (code) localStorage.setItem(KEY, code)
    else localStorage.removeItem(KEY)
  } catch { /* private mode — the party just will not survive a reload */ }
}

/**
 * An invite link. `path` is where it drops them: the room by default, because an invite is
 * now "come play with me" rather than "come to this one game". play3d passes its own path so
 * its panel keeps meaning what it says.
 */
export function inviteUrl(code: string, path = '/room'): string {
  return `${window.location.origin}${path}?party=${code}`
}

/** Fired whenever this tab changes the party, so every mounted reader updates at once. */
const PARTY_EVENT = 'ather:party'

export interface UseParty {
  party: string | null
  ready: boolean
  start: () => string
  join: (raw: string) => boolean
  leave: () => void
}

/**
 * Party state for any surface on the site.
 *
 * Two things it handles that a plain useState would not: an invite link (`?party=CODE`) is
 * consumed on ANY page and then stripped from the address bar, so a bookmarked or shared URL
 * cannot keep re-asserting a party you have since left; and every mounted copy of this hook
 * stays in step, including across tabs, so leaving in the widget does not leave the game
 * panel showing a party you are no longer in.
 */
export function useParty(): UseParty {
  const [party, setParty] = useState<string | null>(null)
  const [ready, setReady] = useState(false) // '' until mount: localStorage is not available during SSR

  useEffect(() => {
    const fromUrl = sanitizePartyCode(new URLSearchParams(window.location.search).get('party') ?? '')
    if (fromUrl) {
      storeParty(fromUrl)
      const u = new URL(window.location.href)
      u.searchParams.delete('party')
      window.history.replaceState(null, '', u.toString())
    }
    setParty(fromUrl ?? storedParty())
    setReady(true)

    const sync = () => setParty(storedParty())
    window.addEventListener(PARTY_EVENT, sync)
    window.addEventListener('storage', sync) // another tab changed it
    return () => {
      window.removeEventListener(PARTY_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const set = useCallback((code: string | null) => {
    storeParty(code)
    setParty(code)
    window.dispatchEvent(new Event(PARTY_EVENT))
  }, [])

  const start = useCallback(() => {
    const code = newPartyCode()
    set(code)
    return code
  }, [set])

  const join = useCallback((raw: string) => {
    const code = sanitizePartyCode(raw)
    if (!code) return false
    set(code)
    return true
  }, [set])

  const leave = useCallback(() => set(null), [set])

  return { party, ready, start, join, leave }
}
