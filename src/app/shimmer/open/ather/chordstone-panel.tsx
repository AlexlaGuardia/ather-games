'use client'
// ── THE CHORDSTONE'S THREE CARDS (BETA M188 s2; Alex 11-26 + his three-card doodle) ──────────────────────────────────────
// E at the Chordstone (chordstone-view.tsx) opens three cards, the centre one in front:
//   CENTRE (data-card="friends")  friends online, find a friend by name, send chord invites: the Chord tab's plumbing
//                                 (shared/play-together.tsx ChordTab, `stone`), so one code path serves both.
//   LEFT   (data-card="cluster")  the garden cluster card (M188 s3): make a cluster WITH a friend (free, four seats), its
//                                 name (any member names it: canon guard 3, no title), who is in, ask a friend into an open
//                                 seat, invite a member into your chord from their row. The record is /api/cluster's.
//   RIGHT  (data-card="brewings") the brewings posted to the stone (Host / Find): drawn as its layout, 'coming' until s4.
// Desktop: the three side by side, the centre raised and wider. Phone (< 720 px): a three-tab rail, the centre card first.
// ⚠ Card words are neutral placeholders for @lark (canon: the word is 'a brewing'; never 'podium' / 'potion party' / 'swaray').
// Guard (canon): a brewing gives MORE, never ONLY; nothing sits behind friends online.
import { useEffect, useState } from 'react'
import { HearthFrame, HearthTabs, H } from '../../ui/hearth'
import { ChordTab, useChordInvite } from '../shared/play-together'
import { useChordBox } from '../shared/chord'
import { chordLights, clusterSeats } from './chordstone'
import type { useCluster } from './cluster-panel'
import { CLUSTER_NAME_MAX } from '@/lib/accounts/cluster-name'

type CardId = 'cluster' | 'friends' | 'brewings'
const CARDS: { id: CardId; label: string }[] = [
  { id: 'cluster', label: 'Cluster' },
  { id: 'friends', label: 'Friends' },
  { id: 'brewings', label: 'Brewings' },
]

const cardBox = (front: boolean): React.CSSProperties => ({
  background: front ? 'linear-gradient(180deg, #fffaf0, #f6ead2)' : 'linear-gradient(180deg, #f8f0de, #eedfc2)',
  boxShadow: front ? '0 10px 22px rgba(58,39,22,.28), 0 1px 2px rgba(58,39,22,.25)' : '0 4px 10px rgba(58,39,22,.18)',
  borderRadius: 12, padding: '12px 12px 14px', color: H.ink,
})
const Coming = () => <span data-coming className="ml-2 align-middle text-[10.5px] font-extrabold uppercase tracking-[.12em] px-1.5 py-[2px] rounded-full" style={{ background: 'rgba(95,125,69,.16)', color: H.moss }}>coming</span>
const cardTitle = 'hk-title text-[16px] hk-ember'
const line = 'text-[12px] leading-snug hk-soft mt-1.5'

type Cl = ReturnType<typeof useCluster>
const seatRow = 'flex items-center justify-between gap-2 text-[12px] font-bold mt-1.5 min-h-[26px]'
const smallBtn = 'hk-btn px-2 py-[3px] text-[11px]'

function ClusterCard({ c }: { c: Cl }) {
  const { menu, act, busy, signedIn, view, friends, me } = c
  // fresh on open, then every 8 s while the card is up (the world's own poll is 30 s): an ask, a join, a rename by a mate show soon
  const { refresh } = c
  useEffect(() => { refresh(); const id = setInterval(refresh, 8000); return () => clearInterval(id) }, [refresh])
  const invite = useChordInvite()
  const [err, setErr] = useState<string | null>(null)
  const [naming, setNaming] = useState<string | null>(null)      // the name being typed (null = not editing)
  const [asking, setAsking] = useState(false)                     // the friend picker under an open seat
  const [sent, setSent] = useState<Record<string, string>>({})    // a member's chord-invite answer, by id
  const run = async (a: string, b?: Record<string, unknown>) => { const e = await act(a, b); setErr(e); return !e }
  const seats = clusterSeats(view, me)
  const inCluster = menu.mode !== 'none'
  const pals = friends.filter(f => f.status === 'accepted' && f.username)
  const nameBox = (onSave: (n: string) => void, label: string) => (
    <form className="flex gap-1.5 mt-1" onSubmit={e => { e.preventDefault(); onSave(naming ?? '') }}>
      <input data-cluster-name-input value={naming ?? ''} maxLength={CLUSTER_NAME_MAX} onChange={e => setNaming(e.target.value)} placeholder="Cluster name"
        onKeyDown={e => e.stopPropagation()} className="flex-1 min-w-0 rounded-[8px] px-2 py-1 text-[12px] font-bold" style={{ background: '#fffaf0', boxShadow: `inset 0 0 0 1.5px ${H.rule}`, color: H.ink }} />
      <button type="submit" data-cluster-save className={`${smallBtn} hk-fill-moss`}>{label}</button>
    </form>
  )
  return (
    <div data-card="cluster" data-cluster-mode={!signedIn ? 'signed-out' : menu.mode}>
      <div className={cardTitle}>Garden cluster</div>
      <div className={line}>Make a cluster with at least one friend. No cost. Up to four keepers, each with their own garden round the Green.</div>
      {!signedIn ? (
        <div className={line} data-cluster-signin>Sign in on the front page to make a cluster with friends.</div>
      ) : (
        <div className="mt-3 rounded-[10px] px-2.5 py-2" style={{ boxShadow: `inset 0 0 0 1.5px ${H.rule}` }}>
          {inCluster ? (naming === null ? (
            <div className="flex items-center justify-between gap-2">
              <span data-cluster-name className={`text-[14px] font-extrabold ${view?.name ? '' : 'hk-faint italic'}`}>{view?.name ?? 'Unnamed cluster'}</span>
              <button data-cluster-rename className={smallBtn} onClick={() => setNaming(view?.name ?? '')}>{view?.name ? 'Rename' : 'Name it'}</button>
            </div>
          ) : nameBox(async n => { if (await run('name', { name: n })) setNaming(null) }, 'Save')) : (
            <>
              <div className="text-[13px] font-extrabold hk-faint italic">Cluster name</div>
              {nameBox(() => {}, 'Keep')}
            </>
          )}
          {seats.map((st, i) => (
            <div key={i} className={seatRow} data-cluster-seat={i} data-seat-kind={st.kind} data-seat-name={st.kind === 'open' ? '' : st.name}>
              {st.kind === 'member' ? (<>
                <span>{st.name}{st.me ? <span className="hk-faint font-semibold"> · you</span> : null}</span>
                {!st.me && invite && (sent[st.user_id]
                  ? <span className="hk-faint text-[11px]" data-seat-chord-said>{sent[st.user_id]}</span>
                  : <button data-seat-chord className={smallBtn} onClick={async () => { const r = await invite(st.user_id); setSent(x => ({ ...x, [st.user_id]: r })) }}>Chord</button>)}
              </>) : st.kind === 'asked' ? (<>
                <span>{st.name} <span className="hk-faint font-semibold">· asked{st.waiting ? ` · ${st.waiting} yes to come` : ''}</span></span>
                {!st.youSaidYes && inCluster ? <button data-seat-yes className={smallBtn} onClick={() => run('consent', { quarter: st.quarter })}>Say yes</button> : null}
              </>) : (<>
                <span className="hk-faint italic font-semibold">open seat</span>
                {inCluster && menu.nextOpen && <button data-cluster-inv className={smallBtn} onClick={() => setAsking(a => !a)}>+ inv</button>}
              </>)}
            </div>
          ))}
          {inCluster && asking && menu.nextOpen && (
            <div className="mt-2" data-cluster-ask>
              {menu.askable.length ? menu.askable.map(f => (
                <div key={f.username} className={seatRow}>
                  <span>{f.username}</span>
                  <button data-cluster-ask-one={f.username} className={smallBtn} onClick={async () => { if (await run('offer', { quarter: menu.nextOpen, username: f.username })) setAsking(false) }}>Ask</button>
                </div>
              )) : <div className={line}>No friends left to ask. Add friends on the Friends card.</div>}
            </div>
          )}
          {inCluster && !menu.nextOpen && seats.every(x => x.kind === 'member') && <div className={line} data-cluster-full>All four seats are taken.</div>}
        </div>
      )}
      {signedIn && !inCluster && menu.invites.map(iv => (
        <div key={iv.cluster_id + iv.quarter} className="mt-2 rounded-[10px] px-2.5 py-2" data-cluster-invite style={{ background: 'rgba(200,100,42,.12)', boxShadow: 'inset 0 0 0 1.5px #c8642a' }}>
          <div className="text-[12px] font-bold">{iv.keepers.join(', ')} asked you into their cluster{iv.waiting ? ` · ${iv.waiting} still to say yes` : ''}</div>
          <div className="flex gap-1.5 mt-1.5">
            <button data-cluster-join className={`${smallBtn} hk-fill-moss`} disabled={iv.waiting > 0} onClick={() => run('answer', { cluster_id: iv.cluster_id, quarter: iv.quarter, yes: true })}>Join</button>
            <button className={smallBtn} onClick={() => run('answer', { cluster_id: iv.cluster_id, quarter: iv.quarter, yes: false })}>No</button>
          </div>
        </div>
      ))}
      {signedIn && !inCluster && (
        <div className="mt-2" data-cluster-make>
          <div className="text-[11px] font-extrabold uppercase tracking-[.1em] hk-faint">Make one with</div>
          {pals.length ? pals.map(f => (
            <div key={f.user_id} className={seatRow}>
              <span>{f.username}</span>
              <button data-cluster-create={f.username} className={smallBtn} disabled={busy === 'create'}
                onClick={async () => { if (await run('create', { username: f.username, name: naming ?? '' })) setNaming(null) }}>Ask in</button>
            </div>
          )) : <div className={line}>No friends yet. Add one on the Friends card.</div>}
        </div>
      )}
      {inCluster && <div className="mt-2 text-right"><button data-cluster-leave className={smallBtn} onClick={() => run('takeBack')}>Leave</button></div>}
      {err && <div className="mt-1.5 text-[12px] font-bold" data-cluster-err style={{ color: H.rust }}>{err}</div>}
    </div>
  )
}

function BrewingsCard() {
  const [tab, setTab] = useState<'find' | 'host'>('find')
  return (
    <div data-card="brewings">
      <div className={cardTitle}>Brewings<Coming /></div>
      <div className="flex gap-1.5 mt-2">
        {(['find', 'host'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} data-brew-tab={t} className={`hk-btn px-3 py-1 text-[12px] ${tab === t ? 'hk-fill-moss' : ''}`}>{t === 'find' ? 'Find' : 'Host'}</button>
        ))}
      </div>
      {tab === 'find' ? (
        <>
          <div className="mt-3 text-[12px] hk-faint italic font-semibold" data-brew-list>No brewings posted yet.</div>
          <div className={line}>Brewings posted to the Chordstone will show here: the time, the host, the potion and the open seats.</div>
        </>
      ) : (
        <div className={line}>Hosting a brewing (a time, public or private, the potion, which steps are open) is not open yet.</div>
      )}
    </div>
  )
}

/** The Chordstone's panel. `phone` = the narrow layout (a tab rail, one card at a time). */
export function ChordstonePanel({ onClose, cluster }: { onClose: () => void; cluster: Cl }) {
  const [narrow, setNarrow] = useState(true)
  useEffect(() => {
    const q = window.matchMedia('(max-width: 719px)')
    const on = () => setNarrow(q.matches)
    on(); q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  const [pick, setPick] = useState<CardId>('friends')
  const { members, me, code } = useChordBox()
  const lights = chordLights(members, me, !!code)
  const body = (id: CardId) => id === 'friends' ? <div data-card="friends"><ChordTab stone /></div> : id === 'cluster' ? <ClusterCard c={cluster} /> : <BrewingsCard />
  const lightsRow = (
    <div className="flex items-center gap-2 flex-wrap text-[12px] font-bold" data-stone-lights={lights.length}>
      {lights.length ? lights.map(l => (
        <span key={l.id} className="flex items-center gap-1" data-stone-light={l.colour}>
          <span className="inline-block w-[10px] h-[10px] rounded-full" style={{ background: l.colour, boxShadow: `0 0 6px ${l.colour}` }} />{l.name}{l.me ? <span className="hk-faint font-semibold"> · you</span> : null}
        </span>
      )) : <span className="hk-faint italic font-semibold">The stone is dark: no chord rung in.</span>}
    </div>
  )
  return (
    <HearthFrame title="Chordstone" maxWidth={narrow ? 460 : 980} onClose={onClose} fixed dataPanel="chordstone"
      head={<>{lightsRow}{narrow && <div className="mt-2"><HearthTabs tabs={CARDS} active={pick} onPick={id => setPick(id as CardId)} /></div>}</>}>
      {narrow ? (
        <div style={{ padding: '12px 14px 16px' }} data-cards="tabs">
          <div style={cardBox(true)}>{body(pick)}</div>
        </div>
      ) : (
        <div style={{ padding: '18px 16px 20px', display: 'grid', gridTemplateColumns: '1fr 1.25fr 1fr', gap: 12, alignItems: 'start' }} data-cards="three">
          <div style={{ ...cardBox(false), marginTop: 18, transform: 'rotate(-1deg)' }}>{body('cluster')}</div>
          <div style={{ ...cardBox(true), position: 'relative', zIndex: 1 }}>{body('friends')}</div>
          <div style={{ ...cardBox(false), marginTop: 18, transform: 'rotate(1deg)' }}>{body('brewings')}</div>
        </div>
      )}
    </HearthFrame>
  )
}
