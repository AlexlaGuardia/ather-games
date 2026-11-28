'use client'
// ── DASH at the Thistledown Fair (BETA M233 s2). E at the Dash tent opens its SIGN-UP panel (fair-signup.tsx, as Smash's): pick
// ONE of your party spirits and Enter. The heat is FIVE: yours + up to four GHOSTS (other keepers' spirits from the season's
// pool, /api/fair/dash: their spirit + stats re-run here, never a live player), filled with fair entrants (a roster species at
// its base stats) when the pool is thin. The race (dash-view.tsx) runs on its own; the one input is CHEER. Your time goes to the
// SEASON BOARD (best time per keeper) and your spirit becomes your ghost for the others. DASH_TRIES a day.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { H, HearthButton } from '../../ui/hearth'
import { FairSignup, type Entrant } from './fair-signup'
import { spiritFormName, type Element, type Species } from '../../spirits/spirit'
import { LAUNCHED_SPECIES } from '../../engine/spirit-index'
import { speciesOf } from './spirit-seeds'
import { useBook } from './spirit-panels'
import { partyIds, subscribeParty } from './spirit-party'
import { loadStats, statValue } from './spirit-stats'
import { SPECIES_BASE } from './spirit-growth'
import { fillIn } from './fair-dash-race'
import { DashRace, type Entry, type RaceResult } from './dash-view'
import { cleanCourse, type DashCourse } from './dash-course'
import { DASH_UI as L, RACERS, RACE_STATS, fmtTime, type DashBoard, type RaceStats } from './fair-dash-rules'

const NONE: readonly string[] = []
const baseStats = (sp: string): RaceStats => { const b = SPECIES_BASE[sp as Species]; return { pwr: b.pwr, grd: b.grd, agi: b.agi, vig: b.vig } }

export function DashPanel({ onClose }: { onClose: () => void }) {
  const book = useBook()
  const party = useSyncExternalStore(subscribeParty, partyIds, () => NONE)
  const spirits = useMemo(() => party.flatMap(id => {
    const pot = book.pots[id], sp = pot?.bloomed ? speciesOf(pot.seed) : null
    return sp ? [{ id, sp, element: (pot.element ?? 'base') as Element, name: spiritFormName(sp, pot.element) }] : []
  }), [party, book])
  const [pick, setPick] = useState<string | null>(null)
  const [board, setBoard] = useState<DashBoard | null>(null)
  const [race, setRace] = useState<{ racers: Entry[]; seed: number } | null>(null)
  const [result, setResult] = useState<RaceResult | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { const r = await fetch('/api/fair/dash', { cache: 'no-store' }); if (r.ok) setBoard(await r.json()) } catch { /* offline: the board stays blank */ }
  }, [])
  useEffect(() => { void load() }, [load])
  // M247 s2: the course Alex published in Creative (none / offline = the fixed course: the race always runs)
  const [course, setCourse] = useState<DashCourse | null>(null)
  useEffect(() => { let alive = true
    fetch('/shimmer/open/dash-edits', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => { if (alive) setCourse(cleanCourse(j)) }).catch(() => {})
    return () => { alive = false } }, [])
  useEffect(() => { if (!pick && spirits.length) setPick(spirits[0].id) }, [pick, spirits])

  const chosen = spirits.find(s => s.id === pick) ?? null
  // the heat's other four: ghosts from the pool, then fair entrants (seeded by the day, so the sign-up list and the race agree)
  const [seed] = useState(() => Math.floor(Math.random() * 1e9))
  const others: Entry[] = useMemo(() => {
    const ghosts: Entry[] = (board?.ghosts ?? []).slice(0, RACERS - 1).map(g => ({ who: g.who, name: g.spirit, species: g.species, element: g.element, stats: g.stats }))
    const fill = fillIn(LAUNCHED_SPECIES, baseStats, seed, RACERS - 1 - ghosts.length)
      .map(r => ({ ...r, who: L.entrant, name: spiritFormName(r.species as Species, null) }))
    return [...ghosts, ...fill]
  }, [board, seed])
  const canEnter = !!chosen && !!board?.signedIn && (board?.triesLeft ?? 0) > 0 && !race
  const entrants: Entrant[] = [{ who: 'you', you: true, spirit: chosen?.name ?? null }, ...others.map(o => ({ who: o.who, spirit: o.name }))]

  const enter = () => {
    if (!chosen || !canEnter) return
    const rec = loadStats()[chosen.id]
    const stats = Object.fromEntries(RACE_STATS.map(k => [k, Math.round(statValue(chosen.sp, rec, k) * 10) / 10])) as RaceStats
    const mine: Entry = { who: 'you', you: true, name: chosen.name, species: chosen.sp, element: chosen.element, stats }
    const racers = [...others]; racers.splice(Math.floor(others.length / 2), 0, mine)   // yours runs a middle lane
    setResult(null); setMsg(null); setRace({ racers, seed: seed + Date.now() % 100000 })
  }
  const done = async (r: RaceResult) => {
    setResult(r)
    const me = race!.racers.find(x => x.you)!
    try {
      const x = await fetch('/api/fair/dash', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ms: r.ms, spirit: me.name, species: me.species, element: me.element, stats: me.stats }) })
      const j = await x.json().catch(() => ({}))
      if (x.ok) setBoard(j as DashBoard); else setMsg(String((j as { error?: string }).error ?? 'Could not reach the board.'))
    } catch { setMsg('Could not reach the board.') }
  }
  const phone = typeof window !== 'undefined' && window.innerWidth < 700

  const boardView = (
    <div style={{ marginTop: 12, borderTop: `1px solid ${H.rule}`, paddingTop: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{L.board}</div>
      <div data-dash-best={board?.best ?? ''} style={{ fontSize: 13, fontWeight: 700, color: H.inkSoft, marginBottom: 4 }}>{L.best(board?.best ?? null)}</div>
      {!board?.top.length && <div style={{ fontSize: 13, fontStyle: 'italic', color: H.inkFaint }}>{L.empty}</div>}
      <div style={{ display: 'grid', gap: 2, maxHeight: 180, overflowY: 'auto' }}>
        {board?.top.map((r, i) => (
          <div key={`${r.who}:${i}`} data-dash-row={r.who} data-ms={r.ms} data-mine={r.mine ? '1' : '0'}
            style={{ display: 'flex', gap: 8, fontSize: 13, padding: '2px 6px', borderRadius: 6, background: r.mine ? 'rgba(200,100,42,.12)' : 'transparent', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ width: 22, color: H.inkFaint }}>{i + 1}.</span>
            <span style={{ fontWeight: 700, color: H.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.who} <span style={{ fontWeight: 400, color: H.inkFaint }}>· {r.spirit}</span></span>
            <span style={{ fontWeight: 800, color: H.ink }}>{fmtTime(r.ms)}</span>
          </div>
        ))}
      </div>
    </div>
  )

  if (race && !result) return <DashRace racers={race.racers} seed={race.seed} phone={phone} course={course} onDone={r => { void done(r) }} />
  return (
    <FairSignup title={L.title} dataPanel="dash" onClose={onClose} spirits={spirits} pick={pick} onPick={setPick}
      entrants={entrants} canEnter={canEnter && !result} onEnter={enter}
      note={board?.signedIn ? <span data-dash-tries={board.triesLeft} style={{ fontSize: 12, color: H.inkFaint }}>{board.triesLeft > 0 ? L.tries(board.triesLeft) : L.noTries}</span> : null}>
      {board && !board.signedIn && <div style={{ fontSize: 12, color: H.inkFaint, marginTop: 6 }}>{L.signIn}</div>}
      {result && (
        <div data-dash-result={result.ms} data-dash-place={result.place} style={{ marginTop: 10, display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: H.ink }}>{L.place(result.place)} · {L.yourTime(result.ms)}</div>
          {result.order.map((o, i) => (
            <div key={i} style={{ fontSize: 13, color: o.you ? H.ink : H.inkSoft, fontWeight: o.you ? 800 : 500 }}>{i + 1}. {o.name} · {o.you ? 'you' : o.who} {o.ms != null ? `· ${fmtTime(o.ms)}` : ''}</div>
          ))}
          <span><HearthButton onClick={() => { setRace(null); setResult(null) }}>{L.again}</HearthButton></span>
        </div>
      )}
      {msg && <div data-dash-msg style={{ fontSize: 12, color: H.rust }}>{msg}</div>}
      {boardView}
    </FairSignup>
  )
}
