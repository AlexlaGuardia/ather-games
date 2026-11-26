'use client'
// ── THE CHORDSTONE'S THREE CARDS (BETA M188 s2; Alex 11-26 + his three-card doodle) ──────────────────────────────────────
// E at the Chordstone (chordstone-view.tsx) opens three cards, the centre one in front:
//   CENTRE (data-card="friends")  friends online, find a friend by name, send chord invites: the Chord tab's plumbing
//                                 (shared/play-together.tsx ChordTab, `stone`), so one code path serves both.
//   LEFT   (data-card="cluster")  the garden cluster card: drawn as its layout, 'coming' until M188 s3.
//   RIGHT  (data-card="brewings") the brewings posted to the stone (Host / Find): drawn as its layout, 'coming' until s4.
// Desktop: the three side by side, the centre raised and wider. Phone (< 720 px): a three-tab rail, the centre card first.
// ⚠ Card words are neutral placeholders for @lark (canon: the word is 'a brewing'; never 'podium' / 'potion party' / 'swaray').
// Guard (canon): a brewing gives MORE, never ONLY; nothing sits behind friends online.
import { useEffect, useState } from 'react'
import { HearthFrame, HearthTabs, H } from '../../ui/hearth'
import { ChordTab } from '../shared/play-together'
import { useChordBox } from '../shared/chord'
import { chordLights } from './chordstone'

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

function ClusterCard() {
  const { members, me, code } = useChordBox()
  const names = chordLights(members, me, !!code).map(l => l.name)
  return (
    <div data-card="cluster">
      <div className={cardTitle}>Garden cluster<Coming /></div>
      <div className={line}>Make a cluster with at least one friend. No cost. Up to four keepers, each with their own garden round the Green.</div>
      <div className="mt-3 rounded-[10px] px-2.5 py-2" style={{ boxShadow: `inset 0 0 0 1.5px ${H.rule}` }}>
        <div className="text-[13px] font-extrabold hk-faint italic">Cluster name</div>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between text-[12px] font-bold mt-1.5" data-cluster-seat={i}>
            <span className={names[i] ? '' : 'hk-faint italic font-semibold'}>{names[i] ?? 'open seat'}</span>
            <span className="hk-faint text-[11px]">+ inv</span>
          </div>
        ))}
      </div>
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
export function ChordstonePanel({ onClose }: { onClose: () => void }) {
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
  const body = (id: CardId) => id === 'friends' ? <div data-card="friends"><ChordTab stone /></div> : id === 'cluster' ? <ClusterCard /> : <BrewingsCard />
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
