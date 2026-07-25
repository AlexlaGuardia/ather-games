'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAccount } from '@/lib/accounts/use-account'
import FriendsPanel from '@/app/shimmer/components/FriendsPanel'
import PartyBlock from './PartyBlock'

// ── Floating account control ──────────────────────────────────────────────────
//
// The site-wide "who you are" chip. Sits in a corner next to the other floating chrome
// (the room's mute toggle), collapsed to a single pill until you open it.
//
// There is no separate sign-up: Google is one door, and the first time through it creates
// the account. So the pill says one thing at a time, and which thing it says IS the state —
// signed out, signed in but nameless, or named.
//
// Reusable on purpose: any page can drop <AccountWidget /> into its corner cluster.

export default function AccountWidget({ className = '' }: { className?: string }) {
  const { session, loading, signIn, signOut, claimName } = useAccount()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showFriends, setShowFriends] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Click-away and Escape both close it. A floating panel that only closes by re-clicking
  // its own trigger is the kind of thing you notice once and resent forever.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (loading) return null

  const needsName = !!session && !session.username
  const pillLabel = !session ? 'Sign in' : needsName ? 'Claim name' : session.username!

  const claim = async () => {
    setBusy(true); setError(null)
    const res = await claimName(draft.trim())
    if (res.ok) setOpen(false)
    else setError(res.error ?? 'Could not claim that name')
    setBusy(false)
  }

  const chrome = 'rounded-md border bg-[#12121e]/70 backdrop-blur transition'
  const linkish = 'text-[10px] uppercase tracking-[0.18em] text-[#5a576a] hover:text-[#8a879a] transition-colors'

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`${chrome} h-10 px-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] ${
          needsName
            ? 'border-[#d4a843]/45 text-[#d4a843] hover:border-[#d4a843]/70'
            : 'border-white/10 text-[#8a879a] hover:text-[#d4a843] hover:border-[#d4a843]/40'
        }`}
      >
        <span className="text-sm leading-none">{session ? '◆' : '✦'}</span>
        <span className="max-w-[9rem] truncate normal-case tracking-normal text-[12px]">{pillLabel}</span>
      </button>

      {open && (
        <div className={`${chrome} border-white/10 absolute top-12 right-0 w-60 p-3.5 z-50 shadow-xl shadow-black/40`}>
          {!session && (
            <>
              <button
                onClick={signIn}
                className="w-full px-3 py-2 rounded-md border border-[#d4a843]/35 bg-[#d4a843]/10 text-[#d4a843] text-[12px] hover:bg-[#d4a843]/20 transition-colors"
              >
                Sign in with Google
              </button>
              <p className="text-[11px] leading-relaxed text-[#8a879a] mt-3">
                First time here? Signing in creates your account. It is optional, and every game
                works without it.
              </p>
            </>
          )}

          {needsName && (
            <>
              <p className="text-[11px] leading-relaxed text-[#8a879a] mb-2.5">
                Pick the name other players see. Yours to keep.
              </p>
              <input
                value={draft}
                placeholder="username"
                maxLength={16}
                autoFocus
                onChange={e => setDraft(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter' && draft.length >= 3 && !busy) claim() }}
                className="w-full px-3 py-2 rounded-md border border-white/10 bg-[#0a0a12] text-[#e2e0ea] text-[13px] outline-none focus:border-[#d4a843]/50"
              />
              <button
                onClick={claim}
                disabled={draft.length < 3 || busy}
                className="w-full mt-2 px-3 py-2 rounded-md border border-[#d4a843]/35 bg-[#d4a843]/10 text-[#d4a843] text-[12px] hover:bg-[#d4a843]/20 disabled:opacity-30 transition-colors"
              >
                {busy ? 'Claiming...' : 'Claim it'}
              </button>
              {error && <p className="text-red-400/80 text-[11px] mt-2">{error}</p>}
            </>
          )}

          {session?.username && (
            <>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#5a576a]">Signed in as</p>
              <p className="text-[#d4a843] text-[15px] mt-0.5 truncate">{session.username}</p>
              <button
                onClick={() => { setShowFriends(true); setOpen(false) }}
                className="w-full mt-3 px-3 py-2 rounded-md border border-[#d4a843]/30 bg-[#d4a843]/10 text-[#d4a843] text-[12px] hover:bg-[#d4a843]/20 transition-colors"
              >
                Friends
              </button>
              <button
                onClick={() => { signOut(); setOpen(false) }}
                className="w-full mt-2 px-3 py-2 rounded-md border border-white/10 text-[#8a879a] text-[12px] hover:text-[#e2e0ea] hover:border-white/20 transition-colors"
              >
                Sign out
              </button>
            </>
          )}

          {/* Party sits below the account block on purpose: you can have one signed out
              (a code in a link is a fine address), so it must not read as an account feature. */}
          <PartyBlock signedIn={!!session?.username} onInviteFriend={() => { setShowFriends(true); setOpen(false) }} />

          <div className="mt-3 pt-3 border-t border-white/[0.07]">
            <Link href="/privacy" className={linkish}>What we store</Link>
          </div>
        </div>
      )}

      {/* Friends live in a modal rather than the dropdown: the panel is a real surface with
          tabs and a list, and squeezing it into a 240px chip menu would make it unusable on
          a phone. Fixed overlay, so it works from whatever page carries the widget. */}
      {showFriends && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => setShowFriends(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-white/10 bg-[#0d0d18] p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <FriendsPanel onClose={() => setShowFriends(false)} />
            <button
              onClick={() => setShowFriends(false)}
              className="w-full mt-4 px-3 py-2 rounded-md border border-white/10 text-[#8a879a] text-[12px] hover:text-[#e2e0ea] hover:border-white/20 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
