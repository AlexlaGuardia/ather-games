'use client'

// NOLMIR — THE COMMAND DECK. One screen for the whole ship: Crucible, Orrery, Expeditions,
// each with a live "something's ready" pull, and a consolidated WHILE YOU HELD NO WATCH digest
// on return. The deep game, finally legible at a glance. A status hub — the real settling +
// collecting still happens inside each mode (this reads state and routes you in).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Chakra_Petch } from 'next/font/google'
import { saveHost, hostProgress } from './lib/host'
import {
  FORGE_KEY, forgeRate, forgeHeat, canWarp, activePlanets, WARP_HEAT,
  type ForgeState,
} from './lib/starforge'
import {
  loadExpedMeta, saveExpedMeta, settleGarrison, garrisonRatePerHour,
  championsOffPost, tiersUnlocked, bestWave, type ExpedMeta,
} from './lib/expedmeta'
import { settleHomecoming, type AwayDigest } from './lib/away'
import type { HostState } from './lib/types'
import { sfx } from './lib/sfx'

const display = Chakra_Petch({ weight: ['500', '600'], subsets: ['latin'] })
const MATCH_INTERVAL = 20 * 60 * 1000 // a match answers the beacon every 20 min (mirrors the hub)
const DIGEST_LEAD = 220 // ms before the first haul row lands (let the card settle in)
const DIGEST_STEP = 200 // ms between rows — the haul itemizes one beat at a time
const COUNT_MS = 620 // count-up duration per value

interface DigestSeg { n: number; unit: string }
interface DigestRowData { key: string; glyph: string; accent: string; text: string; segs?: DigestSeg[]; value?: string; loss?: boolean }

const fmt = (n: number): string => {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return Math.floor(n).toString()
}
const clock = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}
const dur = (ms: number): string => {
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60)
  if (h >= 1) return `${h}h ${m % 60}m`
  return `${m}m`
}

interface Snapshot {
  host: HostState
  forge: ForgeState
  meta: ExpedMeta
  loadedAt: number
  awayMs: number
  coreGained: number // corelight banked while away (truthful delta from settle)
  marksGained: number // garrison salvage banked while away (truthful delta)
  away: AwayDigest | null // the Crucible homecoming — matches answered, mana/exp banked
}

function snap(): Snapshot {
  const now = Date.now()
  // peek pre-settle corelight so we can show the honest Orrery away delta
  let prevCore = 0
  try {
    const raw = localStorage.getItem(FORGE_KEY)
    if (raw) prevCore = (JSON.parse(raw) as ForgeState).corelight ?? 0
  } catch {}
  // the FULL Crucible homecoming — forge tap + upkeep + away matches banked into
  // the host. Shared with the Crucible page (idempotent): the deck is the front
  // door, so it collects; entering a mode after sees an empty window.
  const hc = settleHomecoming(now)
  const host = hc.host
  // the expedition garrison's idle marks, banked on top (the third pillar)
  const g = settleGarrison(loadExpedMeta(), now)
  if (g.marks > 0) { host.marks = (host.marks ?? 0) + g.marks; saveHost(host) }
  saveExpedMeta(g.meta)
  return {
    host, forge: hc.forge, meta: g.meta, loadedAt: now, awayMs: hc.awayMs,
    coreGained: Math.max(0, hc.forge.corelight - prevCore),
    marksGained: g.marks,
    away: hc.away,
  }
}

export default function DeckPage() {
  const [s, setS] = useState<Snapshot | null>(null)
  const [now, setNow] = useState(0)
  const [digestOpen, setDigestOpen] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    const snapshot = snap()
    setS(snapshot)
    setNow(Date.now())
    if (snapshot.awayMs > 2 * 60 * 1000 && (snapshot.coreGained > 0 || snapshot.marksGained > 0 || (snapshot.away?.matches ?? 0) > 0)) { setDigestOpen(true); sfx.ensure() }
    started.current = true
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const tiles = useMemo(() => {
    if (!s) return null
    const { host, forge, meta } = s
    const level = hostProgress(host.exp).level
    const nextMark = Math.ceil(now / MATCH_INTERVAL) * MATCH_INTERVAL
    const heat = forgeHeat(forge)
    const warp = canWarp(forge)
    const live = championsOffPost(meta, now)
    const tiers = tiersUnlocked(meta)
    let best = 0
    for (let t = 0; t < tiers; t++) best = Math.max(best, bestWave(meta, t))
    // corelight ticks up live on the deck (display only; real accrual is in Orrery)
    const liveCore = forge.corelight + forgeRate(forge) * Math.max(0, (now - s.loadedAt) / 1000)

    return {
      crucible: {
        level,
        mana: host.mana,
        ready: (s.away?.matches ?? 0) > 0,
        line: (s.away?.matches ?? 0) > 0
          ? `${s.away!.matches} answered the beacon while away`
          : `next answer in ${clock(nextMark - now)}`,
        sub: host.ledger[0] ? lastResult(host.ledger[0]) : 'the beacon is quiet',
      },
      orrery: {
        core: liveCore,
        rate: forgeRate(forge),
        planets: activePlanets(forge).length,
        warp,
        heat,
        ready: warp,
        line: warp ? 'THE GATE IS KEYED' : `heat ${heat.toFixed(0)} / ${WARP_HEAT} to warp`,
      },
      expeditions: {
        marks: host.marks ?? 0,
        tiers,
        best,
        live,
        marksPerHr: garrisonRatePerHour(meta),
        ready: !live,
        line: live
          ? 'a breach holds the line'
          : garrisonRatePerHour(meta) > 0
            ? 'the garrison salvages on'
            : 'clear a breach to hold it',
      },
    }
  }, [s, now])

  const closeDigest = () => { sfx.ensure(); sfx.play('buy'); setDigestOpen(false) }

  if (!s || !tiles) return <div className={`min-h-screen bg-[#070a10] ${display.className}`} />

  const digestRows: DigestRowData[] = []
  if (s.coreGained > 0) digestRows.push({ key: 'core', glyph: '◉', accent: '#22d3ee', text: 'the Orrery tapped', segs: [{ n: s.coreGained, unit: 'corelight' }] })
  if (s.away && s.away.matches > 0) digestRows.push({ key: 'beacon', glyph: '▤', accent: '#22d3ee', text: `the beacon answered ${s.away.matches}×`, segs: [{ n: s.away.mana, unit: 'mana' }, { n: s.away.exp, unit: 'exp' }] })
  if (s.away && s.away.vaultFalls > 0) digestRows.push({ key: 'vault', glyph: '▤', accent: '#f43f5e', text: `${s.away.vaultFalls} vault${s.away.vaultFalls > 1 ? 's' : ''} fell`, value: `${s.away.vaultFalls} line${s.away.vaultFalls > 1 ? 's' : ''} cut`, loss: true })
  if (s.marksGained > 0) digestRows.push({ key: 'marks', glyph: '⛬', accent: '#34d399', text: 'the garrison salvaged', segs: [{ n: s.marksGained, unit: 'marks' }] })
  if (tiles.orrery.warp) digestRows.push({ key: 'warp', glyph: '◉', accent: '#fbbf24', text: 'the gate is keyed', value: 'warp ready' })

  return (
    <div className={`min-h-screen bg-[#070a10] text-slate-300 font-mono ${display.className}`}>
      <div className="mx-auto w-full max-w-[520px] px-4 py-6">
        <header className="flex items-center justify-between mb-5">
          <a href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-cyan-400/50 hover:text-cyan-300">&#8592; arcade</a>
          <div className="text-center">
            <div className="text-cyan-300 text-lg tracking-[0.4em] uppercase" style={{ textShadow: '0 0 10px #22d3ee70' }}>Nolmir</div>
            <div className="text-[9px] text-slate-500 tracking-[0.3em] uppercase">command deck</div>
          </div>
          <div className="text-right text-[9px] text-slate-500 tracking-[0.2em] uppercase leading-tight">
            <div>host <span className="text-cyan-300 tabular-nums">lv{tiles.crucible.level}</span></div>
            {(s.forge.echoes ?? 0) > 0 && <div>echoes <span className="text-amber-300 tabular-nums">{s.forge.echoes}</span></div>}
          </div>
        </header>

        {s.awayMs > 2 * 60 * 1000 && (
          <div className="mb-4 text-center text-[10px] tracking-[0.25em] uppercase text-slate-500">
            you held no watch for <span className="text-cyan-300">{dur(s.awayMs)}</span>
          </div>
        )}

        <div className="space-y-3">
          <Tile href="/nolmir/crucible" name="The Crucible" glyph="▤" ready={tiles.crucible.ready} accent="#22d3ee" line={tiles.crucible.line}>
            <Stat label="mana" value={fmt(tiles.crucible.mana)} />
            <div className="text-[10px] text-slate-500 italic truncate max-w-[160px]">{tiles.crucible.sub}</div>
          </Tile>

          <Tile href="/nolmir/starforge" name="The Orrery" glyph="◉" ready={tiles.orrery.ready} accent={tiles.orrery.warp ? '#fbbf24' : '#22d3ee'} line={tiles.orrery.line}>
            <Stat label="corelight" value={fmt(tiles.orrery.core)} live />
            <Stat label="+/s" value={fmt(tiles.orrery.rate)} />
            <Stat label="planets" value={String(tiles.orrery.planets)} />
          </Tile>

          <Tile href="/nolmir/expeditions" name="Expeditions" glyph="⛬" ready={tiles.expeditions.ready} accent="#34d399" line={tiles.expeditions.line}>
            <Stat label="marks" value={fmt(tiles.expeditions.marks)} />
            {tiles.expeditions.marksPerHr > 0 && <Stat label="✶/hr" value={fmt(tiles.expeditions.marksPerHr)} />}
            <Stat label="tiers" value={String(tiles.expeditions.tiers)} />
            {tiles.expeditions.best > 0 && <Stat label="best" value={`wv${tiles.expeditions.best}`} />}
          </Tile>
        </div>

        <p className="mt-5 text-center text-[10px] text-slate-600 tracking-wider">a pulsing room has something for you — tap in</p>
      </div>

      {digestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070a10]/80 px-4" onClick={closeDigest}>
          <div className="digest-card rounded-lg border border-cyan-900/60 bg-[#0b101c] p-6 max-w-md w-full text-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-cyan-300 tracking-[0.25em] text-xs uppercase mb-3">While you held no watch</h2>
            <p className="text-slate-400 text-[11px] mb-4">the ship kept its vigil for <span className="text-cyan-300">{dur(s.awayMs)}</span>.</p>
            <div className="space-y-2 text-[12px]">
              {digestRows.map((row, i) => (
                <DigestRow {...row} key={row.key} delay={DIGEST_LEAD + i * DIGEST_STEP} last={i === digestRows.length - 1} />
              ))}
            </div>
            <button onClick={closeDigest} className="mt-5 w-full rounded border border-cyan-800 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[11px] tracking-[0.25em] uppercase py-2">take the watch</button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes deck-pulse {
          0%, 100% { box-shadow: 0 0 0 1px var(--a)55, 0 0 14px -4px var(--a); }
          50% { box-shadow: 0 0 0 1px var(--a), 0 0 22px -2px var(--a); }
        }
        .digest-card { animation: digest-in 280ms cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes digest-in {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

function Tile({ href, name, glyph, ready, accent, line, children }: {
  href: string; name: string; glyph: string; ready: boolean; accent: string; line: string; children: React.ReactNode
}) {
  return (
    <a
      href={href}
      className="block rounded-lg border bg-[#0b101c]/85 p-4 transition-colors hover:bg-[#0b101c]"
      style={{ borderColor: ready ? accent : '#1e293b', ['--a' as string]: accent, animation: ready ? 'deck-pulse 2.2s ease-in-out infinite' : undefined }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xl" style={{ color: accent, textShadow: `0 0 10px ${accent}80` }}>{glyph}</span>
          <span className="tracking-[0.28em] uppercase text-slate-200 text-sm">{name}</span>
        </div>
        <span className="text-[10px] tracking-[0.2em] uppercase tabular-nums" style={{ color: ready ? accent : '#64748b' }}>
          {ready ? '● ready' : 'idle'}
        </span>
      </div>
      <div className="flex items-center gap-4 mb-1.5">{children}</div>
      <div className="text-[10px] tracking-[0.18em] uppercase" style={{ color: ready ? accent : '#64748b' }}>{line}</div>
    </a>
  )
}

function Stat({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] tracking-[0.2em] uppercase text-slate-500">{label}</span>
      <span className={`text-base tabular-nums leading-none ${live ? 'text-cyan-200' : 'text-slate-200'}`}>{value}</span>
    </div>
  )
}

// count a value up from 0 to target with an ease-out once `run` flips true. one-shot.
function useCountUp(target: number, run: boolean, onLand?: () => void): number {
  const [v, setV] = useState(0)
  const landed = useRef(false)
  const onLandRef = useRef(onLand); onLandRef.current = onLand
  useEffect(() => {
    if (!run) return
    let raf = 0, start = 0
    const land = () => { if (!landed.current) { landed.current = true; setV(target); onLandRef.current?.() } }
    const tick = (ts: number) => {
      if (!start) start = ts
      const p = Math.min(1, (ts - start) / COUNT_MS)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
      else land()
    }
    raf = requestAnimationFrame(tick)
    // rAF is paused in a hidden tab — a timeout still fires, so the haul never sticks at 0
    const fallback = window.setTimeout(land, COUNT_MS + 300)
    return () => { cancelAnimationFrame(raf); clearTimeout(fallback) }
  }, [target, run])
  return v
}

function CountSeg({ seg, accent, run, onLand }: { seg: DigestSeg; accent: string; run: boolean; onLand?: () => void }) {
  const v = useCountUp(seg.n, run, onLand)
  const done = v >= seg.n && seg.n > 0
  return <span className="tabular-nums transition-[text-shadow] duration-200" style={{ color: accent, textShadow: done ? `0 0 9px ${accent}` : 'none' }}>+{fmt(v)} {seg.unit}</span>
}

function DigestRow({ glyph, accent, text, segs, value, loss, delay, last }: DigestRowData & { delay: number; last: boolean }) {
  const [shown, setShown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShown(true), delay); return () => clearTimeout(t) }, [delay])
  // the first segment's landing is the row's "ka-ching" — tick (or a soft break on a loss row)
  const onLand = () => { sfx.play(loss ? 'break' : last ? 'unlock' : 'click') }
  return (
    <div className="flex items-center gap-2.5 transition-all duration-300" style={{ opacity: shown ? 1 : 0, transform: shown ? 'translateY(0)' : 'translateY(6px)' }}>
      <span style={{ color: accent }}>{glyph}</span>
      <span className="text-slate-400 flex-1">{text}</span>
      {segs
        ? <span className="flex items-center gap-1.5">{segs.map((seg, i) => (
            <CountSeg key={seg.unit} seg={seg} accent={accent} run={shown} onLand={i === 0 ? onLand : undefined} />
          )).reduce((acc: React.ReactNode[], el, i) => i === 0 ? [el] : [...acc, <span key={`d${i}`} className="text-slate-600">·</span>, el], [])}</span>
        : <span className="tabular-nums" style={{ color: accent }}>{value}</span>}
    </div>
  )
}

function lastResult(e: { victory?: boolean; reachedGauntlet?: boolean; teamName: string; omen?: boolean; deepest: number }): string {
  if (e.omen) return 'something else answered the beacon'
  if (e.victory) return `${e.teamName} took the vault`
  if (e.reachedGauntlet) return `${e.teamName} fell in the gauntlet`
  return `${e.teamName} went ${(e.deepest * 100).toFixed(0)}% deep`
}
