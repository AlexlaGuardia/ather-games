'use client'

import { useState } from 'react'
import { useParty, inviteUrl } from '@/lib/party'

// ── The party control, wherever you are on the site ───────────────────────────
//
// This used to be a panel inside the 3D walker, which made "who am I playing with" a
// Shimmer-only idea. It is site-level now, so the group you form here is the group that
// walks into the world AND sits down at the card table — nobody re-invites anybody when the
// game changes.
//
// Signing in is not required to have a party: a code in a link is a perfectly good address,
// and that is the path for a friend who has no account. Signed in, you get to skip the code
// and pick a name off your friends list instead.

export default function PartyBlock({ signedIn, onInviteFriend }: {
  signedIn: boolean
  onInviteFriend?: () => void
}) {
  const { party, ready, start, join, leave } = useParty()
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)

  if (!ready) return null

  const btn = 'w-full px-3 py-2 rounded-md text-[12px] transition-colors'
  const gold = `${btn} border border-[#d4a843]/35 bg-[#d4a843]/10 text-[#d4a843] hover:bg-[#d4a843]/20`
  const quiet = `${btn} border border-white/10 text-[#8a879a] hover:text-[#e2e0ea] hover:border-white/20`

  const copy = async () => {
    if (!party) return
    try { await navigator.clipboard.writeText(inviteUrl(party)) } catch { /* denied — the code is on screen to read out */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.07]">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#5a576a] mb-2">Party</p>

      {party ? (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[15px] tracking-[0.18em] text-[#d4a843]">{party}</span>
            <button onClick={leave} className="px-2 py-1 rounded text-[11px] text-[#8a879a] hover:text-red-300 transition-colors">
              Leave
            </button>
          </div>
          <button onClick={copy} className={quiet}>{copied ? '✓ Link copied' : '⧉ Copy invite link'}</button>
          {signedIn && onInviteFriend && (
            <button onClick={onInviteFriend} className={`${gold} mt-2`}>Invite a friend</button>
          )}
          <p className="text-[11px] leading-relaxed text-[#8a879a] mt-2">
            Your party follows you between games.
          </p>
        </>
      ) : (
        <>
          <button onClick={start} className={gold}>⚑ Start a party</button>
          <div className="flex gap-2 mt-2">
            <input
              value={draft}
              placeholder="CODE"
              maxLength={12}
              onChange={e => setDraft(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter' && join(draft)) setDraft('') }}
              className="flex-1 min-w-0 px-3 py-2 rounded-md border border-white/10 bg-[#0a0a12] text-[#e2e0ea] text-[12px] tracking-[0.14em] outline-none focus:border-[#d4a843]/50"
            />
            <button
              onClick={() => { if (join(draft)) setDraft('') }}
              disabled={draft.trim().length < 4}
              className="px-3 py-2 rounded-md border border-white/10 text-[#8a879a] text-[12px] hover:text-[#e2e0ea] disabled:opacity-30 transition-colors"
            >
              Join
            </button>
          </div>
        </>
      )}
    </div>
  )
}
