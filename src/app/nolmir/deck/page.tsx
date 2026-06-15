'use client'

// NOLMIR — THE COMMAND DECK. One screen for the whole ship: Crucible, Orrery, Expeditions,
// each with a live "something's ready" pull, and a consolidated WHILE YOU HELD NO WATCH digest
// on return. The deep game, finally legible at a glance. A status hub — the real settling +
// collecting still happens inside each mode (this reads state and routes you in).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Chakra_Petch } from 'next/font/google'
import { loadHost, hostProgress } from '../lib/host'
import {
  loadForge, FORGE_KEY, forgeRate, forgeHeat, canWarp, activePlanets, WARP_HEAT,
  type ForgeState,
} from '../lib/starforge'
import { loadExpedMeta, championsOffPost, tiersUnlocked, bestWave, type ExpedMeta } from '../lib/expedmeta'
import type { HostState } from '../lib/types'

const display = Chakra_Petch({ weight: ['500', '600'], subsets: ['latin'] })
const MATCH_INTERVAL = 20 * 60 * 1000 // a match answers the beacon every 20 min (mirrors the hub)
const AWAY_CAP = 144

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
  matchesAwaited: number
}

function snap(): Snapshot {
  const now = Date.now()
  const host = loadHost()
  // peek pre-settle corelight so we can show the honest away delta
  let prevCore = 0
  try {
    const raw = localStorage.getItem(FORGE_KEY)
    if (raw) prevCore = (JSON.parse(raw) as ForgeState).corelight ?? 0
  } catch {}
  const forge = loadForge(now) // settles offline accrual into the save
  const meta = loadExpedMeta()
  const lastSeen = host.lastSeenAt ?? now
  const awayMs = Math.max(0, now - lastSeen)
  return {
    host, forge, meta, loadedAt: now, awayMs,
    coreGained: Math.max(0, forge.corelight - prevCore),
    matchesAwaited: host.lastSeenAt ? Math.min(AWAY_CAP, Math.floor(awayMs / MATCH_INTERVAL)) : 0,
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
    if (snapshot.awayMs > 2 * 60 * 1000 && (snapshot.coreGained > 0 || snapshot.matchesAwaited > 0)) setDigestOpen(true)
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
        ready: s.matchesAwaited > 0,
        line: s.matchesAwaited > 0 ? `${s.matchesAwaited} answer${s.matchesAwaited > 1 ? 's' : ''} await tending` : `next answer in ${clock(nextMark - now)}`,
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
        ready: !live,
        line: live ? 'a breach holds the line' : 'the champions are rested',
      },
    }
  }, [s, now])

  if (!s || !tiles) return <div className={`min-h-screen bg-[#070a10] ${display.className}`} />

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
          <Tile href="/nolmir" name="The Crucible" glyph="▤" ready={tiles.crucible.ready} accent="#22d3ee" line={tiles.crucible.line}>
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
            <Stat label="tiers" value={String(tiles.expeditions.tiers)} />
            {tiles.expeditions.best > 0 && <Stat label="best" value={`wv${tiles.expeditions.best}`} />}
          </Tile>
        </div>

        <p className="mt-5 text-center text-[10px] text-slate-600 tracking-wider">a pulsing room has something for you — tap in</p>
      </div>

      {digestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070a10]/80 px-4" onClick={() => setDigestOpen(false)}>
          <div className="rounded-lg border border-cyan-900/60 bg-[#0b101c] p-6 max-w-md w-full text-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-cyan-300 tracking-[0.25em] text-xs uppercase mb-3">While you held no watch</h2>
            <p className="text-slate-400 text-[11px] mb-4">the ship kept its vigil for <span className="text-cyan-300">{dur(s.awayMs)}</span>.</p>
            <div className="space-y-2 text-[12px]">
              {s.coreGained > 0 && <DigestRow glyph="◉" accent="#22d3ee" text="the Orrery tapped" value={`+${fmt(s.coreGained)} corelight`} />}
              {s.matchesAwaited > 0 && <DigestRow glyph="▤" accent="#22d3ee" text="the beacon was answered" value={`${s.matchesAwaited} match${s.matchesAwaited > 1 ? 'es' : ''} — tend the node`} />}
              {tiles.orrery.warp && <DigestRow glyph="◉" accent="#fbbf24" text="the gate is keyed" value="warp ready" />}
            </div>
            <button onClick={() => setDigestOpen(false)} className="mt-5 w-full rounded border border-cyan-800 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[11px] tracking-[0.25em] uppercase py-2">take the watch</button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes deck-pulse {
          0%, 100% { box-shadow: 0 0 0 1px var(--a)55, 0 0 14px -4px var(--a); }
          50% { box-shadow: 0 0 0 1px var(--a), 0 0 22px -2px var(--a); }
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

function DigestRow({ glyph, accent, text, value }: { glyph: string; accent: string; text: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span style={{ color: accent }}>{glyph}</span>
      <span className="text-slate-400 flex-1">{text}</span>
      <span className="tabular-nums" style={{ color: accent }}>{value}</span>
    </div>
  )
}

function lastResult(e: { victory?: boolean; reachedGauntlet?: boolean; teamName: string; omen?: boolean; deepest: number }): string {
  if (e.omen) return 'something else answered the beacon'
  if (e.victory) return `${e.teamName} took the vault`
  if (e.reachedGauntlet) return `${e.teamName} fell in the gauntlet`
  return `${e.teamName} went ${(e.deepest * 100).toFixed(0)}% deep`
}
