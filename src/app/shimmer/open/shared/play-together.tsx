'use client'
// ── PLAY TOGETHER IN THE OPEN WORLD, slice 2: THE PARTY (BETA M27, Alex 11-18) ──────────────────────────────────────────
// Options › Game › "Play together" opens this panel: PARTY (start one, join by code, copy the invite link, leave, who is in
// your world) and FRIENDS (play3d's FriendsTab: your list, online first, add by name, Invite). An invite from a friend pops
// over the world wherever you stand (InvitePrompt), because presence is held by <OpenSocial/>, which both open-world
// pages mount once. A party code is lib/party's (every game reads it), so joining one here reconnects the open-world
// socket (shared/open-mp.tsx) into the party's own instance, which strangers never join.
// The pieces are play3d's (play3d/play-together.tsx, lib/presence, lib/party); this file is the open world's frame.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { HearthFrame, HearthTabs, H, hearthBody } from '../../ui/hearth'
import { FriendsTab, InvitePrompt, useFriends } from '../../play3d/play-together'
import { useRoster } from '../../play3d/RemotePlayers'
import { useParty, newPartyCode, sanitizePartyCode, inviteUrl } from '@/lib/party'
import { usePresence, type UsePresence } from '@/lib/presence'
import { useAccount, type UseAccount } from '@/lib/accounts/use-account'
import { useMenuLock } from './menu-lock'
import { hudSay } from './hud-say'
import { openPeers } from './open-mp'

// ── open / closed: one store, so Options (another file) can open it ──────────────────────────────────────────────────
let open = false
const subs = new Set<() => void>()
export function setPlayTogether(v: boolean) { open = v; subs.forEach(f => f()) }
export const usePlayTogetherOpen = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => open, () => false)

const label = 'hk-label text-[13px] hk-soft'
const hint = 'text-[11px] leading-snug hk-faint mt-1.5'
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: 7, border: `1px solid ${H.rule}`,
  background: H.paperHi, color: H.ink, ...hearthBody, fontWeight: 700, fontSize: 13, outline: 'none',
}

function Account({ account }: { account: UseAccount }) {
  const { session, loading, signIn } = account
  if (loading) return null
  if (!session) return (
    <>
      <button onClick={signIn} className="hk-btn w-full py-1.5 text-[12px]" data-act="sign-in">◆ Sign in with Google</button>
      <div className={hint}>Sign in to add friends and send invites. A party code works without it.</div>
    </>
  )
  return <div className="hk-title text-[15px] hk-ember">◆ {session.username ?? 'no name yet (claim one in The Room)'}</div>
}

function PartyTab({ party, start, join, leave }: { party: string | null; start: () => void; join: (c: string) => boolean; leave: () => void }) {
  const roster = useRoster(openPeers())
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [bad, setBad] = useState(false)
  const copy = async () => {
    if (!party) return
    try { await navigator.clipboard.writeText(inviteUrl(party, window.location.pathname)) } catch { /* the code is on screen to copy by hand */ }
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }
  const doJoin = () => { const ok = !!sanitizePartyCode(draft) && join(draft); setBad(!ok); if (ok) setDraft('') }
  return (
    <>
      <div className={label} style={{ margin: '12px 0 4px' }}>Party</div>
      {party ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="hk-ember tabular-nums font-extrabold text-[19px] tracking-[.18em]" data-party-code>{party}</span>
            <button onClick={leave} className="hk-btn px-3 py-1 text-[12px]" data-act="leave-party">Leave</button>
          </div>
          <button onClick={copy} className={`hk-btn w-full py-1.5 text-[12px] ${copied ? 'hk-fill-moss' : ''}`}>{copied ? '✓ Link copied' : '⧉ Copy invite link'}</button>
          <div className={hint}>Friends who open the link, or enter the code, play in your world: the Wilds and the continent.</div>
        </>
      ) : (
        <>
          <button onClick={start} className="hk-btn w-full py-1.5 text-[12px]" data-act="start-party">⚑ Start a party</button>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input value={draft} placeholder="CODE" maxLength={12} style={{ ...input, letterSpacing: '0.14em' }} data-party-input
              onChange={e => { setDraft(e.target.value.toUpperCase()); setBad(false) }}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') doJoin() }} />
            <button onClick={doJoin} className="hk-btn px-3.5 py-1 text-[12px]" data-act="join-party">Join</button>
          </div>
          {bad && <div className={`${hint} hk-rust`}>That is not a party code.</div>}
        </>
      )}
      <div className={label} style={{ margin: '12px 0 4px' }}>In your world</div>
      <div className="text-[12px] leading-[1.7] font-bold hk-ink" data-roster>
        {roster.map(p => <div key={p.id}>{p.name}</div>)}
        {roster.length === 0 && <div className="hk-faint font-semibold italic">no one else here yet</div>}
      </div>
    </>
  )
}

function Panel({ presence, account, onClose }: { presence: UsePresence; account: UseAccount; onClose: () => void }) {
  const { party, start, join, leave } = useParty()
  const [tab, setTab] = useState<'party' | 'friends'>('party')
  const signedIn = !!account.session?.username
  const fr = useFriends(tab === 'friends', signedIn)
  const onlineFriends = fr.friends.filter(f => f.status === 'accepted' && f.online).length
  const invite = async (f: { user_id: string; username: string }): Promise<string> => {
    const code = party ?? start()
    const r = await presence.invite(f.user_id, code)
    return r.ok ? 'invited' : r.reason === 'offline' ? 'offline' : r.reason === 'unverified' ? 'sign in again' : 'not connected'
  }
  return (
    <div className="absolute top-5 right-5 z-[41] pointer-events-auto" data-panel="play-together">
      <HearthFrame title="Play together" maxWidth={320} backdrop={false} onClose={onClose}>
        <div className="px-3.5 pt-5 pb-3.5 hk-ink" style={{ ...hearthBody }}>
          <HearthTabs tabs={[{ id: 'party', label: 'Party' }, { id: 'friends', label: 'Friends', count: signedIn ? onlineFriends : undefined }]}
                      active={tab} onPick={id => setTab(id as 'party' | 'friends')} />
          <div style={{ marginTop: 10 }}><Account account={account} /></div>
          {tab === 'friends'
            ? <FriendsTab signedIn={signedIn} friends={fr.friends} loaded={fr.loaded} act={fr.act} onInvite={invite} inParty={!!party} />
            : <PartyTab party={party} start={() => { start() }} join={join} leave={leave} />}
        </div>
      </HearthFrame>
    </div>
  )
}

/** Mount ONCE per open-world page (outside the Canvas): presence (so an invite finds you anywhere), the invite prompt,
 *  and the panel when Options opens it. Signed out = no presence socket; a party code still works. */
export function OpenSocial() {
  const account = useAccount()
  const userId = account.session?.username ? account.session.user_id : null
  const presence = usePresence(userId, account.session?.username ?? '')
  const isOpen = usePlayTogetherOpen()
  const { party, join } = useParty()
  useMenuLock(isOpen, () => document.querySelector('canvas'))
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.code === 'Escape' && open) setPlayTogether(false) }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [])
  return (
    <>
      {presence.incoming && (
        <InvitePrompt invite={presence.incoming} inParty={!!party && party !== presence.incoming.party}
          onJoin={() => { const inv = presence.incoming!; join(inv.party); presence.dismiss(); hudSay(`Joined ${inv.from_name}'s party`, 'info', 4) }}
          onDismiss={presence.dismiss} />
      )}
      {isOpen && <Panel presence={presence} account={account} onClose={() => setPlayTogether(false)} />}
    </>
  )
}
