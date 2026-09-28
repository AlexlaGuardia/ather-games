'use client'
// ── Play together: FRIENDS, and the invite that finds you in the world (2026-09-28, Alex) ─────────────
//
// Alex: *"there should be a way to see/add friends and then theres the party screen to invite those friends;
// when partied up they should automatically join the same server."* The server half already existed (a party
// code is its own instance per zone, `shimmer-server/instances.py`; invites ride the site-wide presence
// socket, `lib/presence.ts`). What had been left behind was the game: friends lived only in the site's account
// widget, which mounts on /room alone, so an invite sent to someone standing in play3d was reported "invited"
// and never shown. This file is the in-game half, on the Carved Hearth:
//   · `FriendsTab`    — your friends (online first), requests in and out, add by name, invite to your party
//   · `InvitePrompt`  — "X invites you to their party": Join / Not now, over the world
//   · `useFriends`    — the list, refreshed while the tab is open (online state comes from the presence server,
//                       asked server-to-server by /api/friends, so a browser can never probe a stranger)
// It renders and calls back; the party itself stays `lib/party`'s, the socket `lib/presence`'s.
import { useCallback, useEffect, useState } from 'react'
import { H, hearthBody } from '../ui/hearth'
import type { PartyInvite } from '@/lib/presence'

export interface FriendRow {
  user_id: string
  username: string
  status: string          // 'accepted' | 'pending'
  incoming: boolean       // they asked you, and you have not answered
  online?: boolean
}

export function useFriends(active: boolean, signedIn: boolean) {
  const [friends, setFriends] = useState<FriendRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const refresh = useCallback(async () => {
    if (!signedIn) { setFriends([]); setLoaded(true); return }
    try {
      const res = await fetch('/api/friends', { cache: 'no-store' })
      const body = (await res.json()) as { friends?: FriendRow[] }
      setFriends(body.friends ?? [])
    } catch { /* keep what we had; the next tick tries again */ }
    setLoaded(true)
  }, [signedIn])
  useEffect(() => {
    if (!active) return
    void refresh()
    const t = setInterval(() => { void refresh() }, 20_000)   // who is online drifts; 20s is plenty for a list
    return () => clearInterval(t)
  }, [active, refresh])
  const act = useCallback(async (action: 'add' | 'accept' | 'remove', target: { username?: string; friendUserId?: string }) => {
    const res = await fetch('/api/friends', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...target }),
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    await refresh()
    return res.ok ? null : (body.error ?? 'Something went wrong')
  }, [refresh])
  return { friends, loaded, refresh, act }
}

const label = 'hk-label text-[13px] hk-soft'
const input: React.CSSProperties = {
  flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '6px 9px', borderRadius: 7, border: `1px solid ${H.rule}`,
  background: H.paperHi, color: H.ink, ...hearthBody, fontWeight: 700, fontSize: 13, outline: 'none',
}

function Dot({ on }: { on: boolean }) {
  return <span aria-label={on ? 'online' : 'offline'} className="inline-block w-2 h-2 rounded-full shrink-0"
               style={{ background: on ? H.moss : 'rgba(58,39,22,.25)', boxShadow: on ? `0 0 4px ${H.moss}` : 'none' }} />
}

export function FriendsTab({ signedIn, friends, loaded, act, onInvite, inParty }: {
  signedIn: boolean
  friends: FriendRow[]
  loaded: boolean
  act: (action: 'add' | 'accept' | 'remove', target: { username?: string; friendUserId?: string }) => Promise<string | null>
  /** invite this friend to your party (starting one if you have none); resolves to a short row note */
  onInvite: (f: FriendRow) => Promise<string>
  inParty: boolean
}) {
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [rowNote, setRowNote] = useState<Record<string, string>>({})
  if (!signedIn) {
    return <div className="text-[12px] leading-snug hk-faint pt-3">Sign in on the Party tab to keep a friends list. A party link still works without one.</div>
  }
  const accepted = friends.filter(f => f.status === 'accepted').sort((a, b) => Number(!!b.online) - Number(!!a.online) || a.username.localeCompare(b.username))
  const incoming = friends.filter(f => f.status === 'pending' && f.incoming)
  const outgoing = friends.filter(f => f.status === 'pending' && !f.incoming)
  const add = async () => {
    const name = draft.trim()
    if (!name) return
    const err = await act('add', { username: name })
    setNote(err ?? `Asked ${name}`)
    if (!err) setDraft('')
  }
  const invite = async (f: FriendRow) => {
    setRowNote(r => ({ ...r, [f.user_id]: '…' }))
    const out = await onInvite(f)
    setRowNote(r => ({ ...r, [f.user_id]: out }))
  }
  return (
    <div className="hk-ink" style={{ ...hearthBody }}>
      {incoming.length > 0 && (
        <>
          <div className={label} style={{ margin: '10px 0 4px' }}>Asking to be friends</div>
          {incoming.map(f => (
            <div key={f.user_id} className="flex items-center gap-1.5 py-1 text-[13px] font-bold">
              <span className="flex-1 truncate">{f.username}</span>
              <button className="hk-btn px-2.5 py-0.5 text-[12px] hk-fill-moss" onClick={() => void act('accept', { friendUserId: f.user_id })}>Accept</button>
              <button className="hk-btn px-2.5 py-0.5 text-[12px]" onClick={() => void act('remove', { friendUserId: f.user_id })}>No</button>
            </div>
          ))}
        </>
      )}

      <div className={label} style={{ margin: '10px 0 4px' }}>Friends{accepted.length ? ` · ${accepted.filter(f => f.online).length} here` : ''}</div>
      {!loaded && <div className="text-[12px] hk-faint italic">…</div>}
      {loaded && accepted.length === 0 && <div className="text-[12px] hk-faint italic">No friends yet. Add someone by their name below.</div>}
      {accepted.map(f => (
        <div key={f.user_id} className="flex items-center gap-1.5 py-1 text-[13px] font-bold" data-friend={f.username}>
          <Dot on={!!f.online} />
          <span className={`flex-1 truncate ${f.online ? '' : 'hk-soft'}`}>{f.username}</span>
          {rowNote[f.user_id] && <span className="text-[10px] hk-faint">{rowNote[f.user_id]}</span>}
          {f.online && (
            <button className="hk-btn px-2.5 py-0.5 text-[12px]" title={inParty ? 'Invite to your party' : 'Start a party and invite them'}
                    onClick={() => void invite(f)}>Invite</button>
          )}
          <button className="hk-btn px-1.5 py-0.5 text-[11px]" title="Remove friend" aria-label={`Remove ${f.username}`}
                  onClick={() => void act('remove', { friendUserId: f.user_id })}>✕</button>
        </div>
      ))}

      {outgoing.length > 0 && (
        <div className="text-[11px] leading-snug hk-faint mt-2">Waiting on: {outgoing.map(f => f.username).join(', ')}</div>
      )}

      <div className={label} style={{ margin: '12px 0 4px' }}>Add a friend</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={draft} placeholder="their name" maxLength={24} style={input}
               onChange={(e) => setDraft(e.target.value)}
               onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void add() }} />
        <button onClick={() => void add()} className="hk-btn px-3.5 py-1 text-[12px]">Add</button>
      </div>
      {note && <div className="text-[11px] leading-snug hk-faint mt-1.5">{note}</div>}
    </div>
  )
}

/** "X invites you to their party" — over the world, wherever you are standing. */
export function InvitePrompt({ invite, inParty, onJoin, onDismiss }: {
  invite: PartyInvite
  inParty: boolean
  onJoin: () => void
  onDismiss: () => void
}) {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 top-16 z-[60] pointer-events-auto" data-panel="party-invite">
      <div className="rounded-[12px] px-4 py-3 flex items-center gap-3 hk-ink"
           style={{ ...hearthBody, background: 'linear-gradient(180deg, #fffaf0, #f6ead2)', boxShadow: '0 8px 20px rgba(58,39,22,.35), 0 1px 2px rgba(58,39,22,.3)' }}>
        <span className="text-[18px]" aria-hidden>👥</span>
        <div className="text-[13px] leading-snug">
          <div className="font-extrabold">{invite.from_name} invites you to their party</div>
          {inParty && <div className="text-[11px] hk-faint">You will leave the party you are in.</div>}
        </div>
        <button className="hk-btn px-3 py-1 text-[12px] hk-fill-moss" onClick={onJoin}>Join</button>
        <button className="hk-btn px-3 py-1 text-[12px]" onClick={onDismiss}>Not now</button>
      </div>
    </div>
  )
}
