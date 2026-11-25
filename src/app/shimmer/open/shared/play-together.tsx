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
import { usePartyLobby, type LobbyMember } from '@/lib/party-lobby'
import { selfPlayerId, storedName } from '../../play3d/multiplayer'
import { hostOfZone, plotZone, GLADE_LOBBY } from '../ather/plot-visit'

// ── BETA M61 PLOT VISITS: the party lobby (lib/party-lobby, a roster that holds across zones) says where each mate is; a mate
// on a plot can be visited. The page says which zone this keeper is in (setLobbyZone); the Ather page registers how a visit
// starts (setVisitHandler); anywhere else, Visit walks to the Ather page with ?visit=. ──────────────────────────────────────
let lobbyZone = '', visitHandler: ((host: string, name: string) => void) | null = null
const zsubs = new Set<() => void>()
export function setLobbyZone(z: string) { if (z === lobbyZone) return; lobbyZone = z; zsubs.forEach(f => f()) }
const useLobbyZone = () => useSyncExternalStore(f => { zsubs.add(f); return () => { zsubs.delete(f) } }, () => lobbyZone, () => '')
/** M156: is this keeper standing on their own plot right now, by the party's roster? null = the roster does not hold them (yet) */
export function hostHome(host: string): boolean | null {
  const m = lobbyBox.members.find(x => x.look === host)
  return m ? m.zone === plotZone(host) : null
}
export function setVisitHandler(f: typeof visitHandler) { visitHandler = f }
function requestVisit(host: string, name: string) {
  if (visitHandler) { visitHandler(host, name); return }
  window.location.href = `/shimmer/open/ather?visit=${encodeURIComponent(host)}&vn=${encodeURIComponent(name)}`
}
/** where a mate is, in words, and the plot they stand on (whose and its host id), if any */
export function whereOf(m: LobbyMember, all: LobbyMember[]): { text: string; plotHost: string | null; plotName: string | null } {
  const host = hostOfZone(m.zone)
  if (host) {
    const owner = all.find(x => x.look === host)
    const name = owner?.name ?? m.name
    return { text: owner && owner.id !== m.id ? `visiting ${name}'s plot` : 'on their plot', plotHost: host, plotName: name }
  }
  return { text: m.zone === 'open:wilds' ? 'in the Wilds' : m.zone === 'open:continent' ? 'on the continent' : m.zone === GLADE_LOBBY ? 'in Moonwell Glade' : 'about', plotHost: null, plotName: null }
}
let lobbyBox: { members: LobbyMember[]; me: string } = { members: [], me: '' }

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

function PartyTab({ party, start, join, leave, mates }: { party: string | null; start: () => void; join: (c: string) => boolean; leave: () => void; mates: LobbyMember[] }) {
  const roster = useRoster(openPeers())
  const me = selfPlayerId(), others = mates.filter(m => m.look !== me)
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
      {party && (
        <>
          <div className={label} style={{ margin: '12px 0 4px' }}>Your party</div>
          <div className="text-[12px] leading-[1.7] font-bold hk-ink" data-party-mates>
            {others.map(m => {
              const w = whereOf(m, mates)
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }} data-mate={m.look}>
                  <span>{m.name} <span className="hk-faint font-semibold">· {w.text}</span></span>
                  {w.plotHost && w.plotHost !== me && (
                    <button onClick={() => { setPlayTogether(false); requestVisit(w.plotHost!, w.plotName ?? m.name) }} className="hk-btn px-2 py-0.5 text-[11px]" data-act="visit-plot">Visit</button>
                  )}
                </div>
              )
            })}
            {others.length === 0 && <div className="hk-faint font-semibold italic">no one else in the party yet</div>}
          </div>
          <div className={hint}>A mate on their plot can be visited: walk round their house, look, but only they can change it.</div>
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

function Panel({ presence, account, onClose, mates }: { presence: UsePresence; account: UseAccount; onClose: () => void; mates: LobbyMember[] }) {
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
            : <PartyTab party={party} start={() => { start() }} join={join} leave={leave} mates={mates} />}
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
  // M61: the party's cross-zone roster (only while in a party; `look` carries the socket id the plot zones are named by)
  const zoneNow = useLobbyZone()
  const [me, setMe] = useState<string | null>(null)
  useEffect(() => { setMe(selfPlayerId()) }, [])
  const lobby = usePartyLobby({ code: party, userId: account.session?.user_id ?? me, name: account.session?.username ?? (me ? storedName() : ''), zone: zoneNow, look: me ?? '' })
  const mates = lobby.state?.members ?? []
  lobbyBox = { members: mates, me: me ?? '' }
  if (typeof window !== 'undefined') (window as unknown as { __lobby?: unknown }).__lobby = { members: () => lobbyBox.members, zone: () => lobbyZone }
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.code === 'Escape' && open) setPlayTogether(false) }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [])
  return (
    <>
      {presence.incoming && (
        <InvitePrompt invite={presence.incoming} inParty={!!party && party !== presence.incoming.party}
          onJoin={() => { const inv = presence.incoming!; join(inv.party); presence.dismiss(); hudSay(`Joined ${inv.from_name}'s party`, 'info', 4) }}
          onDismiss={presence.dismiss} />
      )}
      {isOpen && <Panel presence={presence} account={account} mates={mates} onClose={() => setPlayTogether(false)} />}
    </>
  )
}
