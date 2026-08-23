'use client'

import { useCallback, useEffect, useState } from 'react'
import { setSaveOwner } from '@/lib/save-slot'

// Client-side view of "who am I". One fetch of /api/auth/session on mount; null means
// signed out, which is a normal state, not an error — every caller must render fine without
// an account.

export interface AccountSession {
  user_id: string
  username: string | null
  character_id: string | null
  avatar: string | null
}

export interface UseAccount {
  session: AccountSession | null
  loading: boolean
  signIn: () => void
  signOut: () => Promise<void>
  claimName: (username: string, characterId?: string) => Promise<{ ok: boolean; error?: string }>
  deleteAccount: () => Promise<{ ok: boolean; error?: string }>
  refresh: () => Promise<void>
}

export function useAccount(): UseAccount {
  const [session, setSession] = useState<AccountSession | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' })
      const data = (await res.json()) as { session: AccountSession | null }
      setSession(data.session ?? null)
    } catch {
      setSession(null) // offline or server down — play on, anonymously
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const signIn = useCallback(() => {
    // Full-page redirect (OAuth cannot happen in a fetch); come back to exactly this page.
    const next = window.location.pathname + window.location.search
    window.location.href = `/api/auth/google/start?next=${encodeURIComponent(next)}`
  }, [])

  const signOut = useCallback(async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* cookie may outlive this */ }
    setSession(null)
    // ★ AND THE SAVE OWNER WITH IT (2026-08-23). Sign-out does NOT reload the page — it only clears
    // React state — so without this the purse and every other scoped slot would keep reading and
    // WRITING into the account that just left, for as long as the tab stays open. Sign-IN needs no
    // equivalent: it is a full-page OAuth redirect, so `SaveOwnerBoot` runs again from scratch.
    setSaveOwner(null)
  }, [])

  const claimName = useCallback(async (username: string, characterId?: string) => {
    try {
      const res = await fetch('/api/shimmerfile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, characterId }),
      })
      const data = (await res.json()) as { error?: string; shimmerfile?: { username: string; character_id: string | null; user_id: string } }
      if (!res.ok || !data.shimmerfile) return { ok: false, error: data.error ?? 'Could not claim that name' }
      setSession(s => (s ? { ...s, username: data.shimmerfile!.username, character_id: data.shimmerfile!.character_id } : s))
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error' }
    }
  }, [])

  const deleteAccount = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/account', { method: 'DELETE' })
      if (!res.ok) return { ok: false, error: 'Could not delete the account' }
      setSession(null)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error' }
    }
  }, [])

  return { session, loading, signIn, signOut, claimName, deleteAccount, refresh }
}
