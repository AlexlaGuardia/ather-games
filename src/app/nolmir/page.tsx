'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Terrarium from './components/Terrarium'
import Drift from './components/Drift'
import Emblem from './components/Emblem'
import { demoCrucible, loadCrucible } from './lib/crucible'
import { runMatch } from './lib/sim'
import { loadHost, saveHost, hostProgress, HOST_UNLOCKS } from './lib/host'
import {
  loadForge,
  saveForge,
  settleForge,
  forgeMods,
  forgeHeat,
  settleConnections,
  cutConnection,
  activePlanets,
} from './lib/starforge'
import { loadExpedMeta, championsOffPost } from './lib/expedmeta'
import { unlockedTier } from './lib/teams'
import { CrucibleDoc, HostState, LedgerEntry, MatchMods, MatchResult, TEAM_COLORS, TEAM_NAMES } from './lib/types'
import { mulberry32, pick } from './lib/rng'
import { sfx } from './lib/sfx'

// a match answers the beacon every 20 minutes, watched or not — matches
// are EVENTS now, not a back-to-back blur (Alex, 2026-06-10 night)
const MATCH_INTERVAL = 20 * 60 * 1000
const AWAY_CAP = 144 // beyond two days, the beacon dims

const TEAM_EPITHETS = ['Cohort', 'Wardens', 'Reavers', 'Pilgrims', 'Sworn', 'Hunters', 'Vanguard', 'Chorus', 'Tide', 'Kin']

function teamName(seed: number, team: number): string {
  const rng = mulberry32((seed ^ 0x9e3779b9) + team * 0x85ebca6b)
  return `${TEAM_NAMES[team % TEAM_NAMES.length]} ${pick(rng, TEAM_EPITHETS)}`
}

interface Toast {
  id: number
  text: string
  color: string
  mana: number
}

interface AwayDigest {
  matches: number
  mana: number
  exp: number
  vaultFalls: number
  best: LedgerEntry | null
}

function entryText(e: LedgerEntry): string {
  if (e.omen) return 'something else answered the beacon. the match did not happen.'
  if (e.victory) return `${e.teamName} took the vault`
  if (e.reachedGauntlet) return `${e.teamName} fell in the gauntlet — ${(e.deepest * 100).toFixed(0)}% deep`
  return `the arena consumed all — ${e.teamName} went deepest (${(e.deepest * 100).toFixed(0)}%)`
}

export default function NolmirPage() {
  const [doc, setDoc] = useState<CrucibleDoc | null>(null)
  const [host, setHost] = useState<HostState>({ mana: 0, exp: 0, ledger: [] })
  const [toasts, setToasts] = useState<Toast[]>([])
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [driftOpen, setDriftOpen] = useState(false)
  const toastId = useRef(0)

  const [away, setAway] = useState<AwayDigest | null>(null)
  const [mods, setMods] = useState<MatchMods | undefined>(undefined)
  const [corelight, setCorelight] = useState(0)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    const d = loadCrucible() ?? demoCrucible()
    setDoc(d)
    setMuted(sfx.isMuted())

    const now = Date.now()
    // the forge hums whether or not you visit it
    let forge = settleForge(loadForge(now), now)
    const h = loadHost()
    // supply lines drink first — unpaid upkeep frays them
    const sc = settleConnections(forge, h.mana, now)
    forge = sc.forge
    h.mana = sc.mana
    saveForge(forge)
    const m = forgeMods(forge)
    // a guard on a live expedition is off their crucible post
    if (championsOffPost(loadExpedMeta(), now)) m.champions = undefined
    // louder crucibles draw harder challengers — roster tier rides heat
    m.rosterTier = unlockedTier({ heat: forgeHeat(forge), exp: h.exp })
    m.heat = forgeHeat(forge) // drives challenger level (slice 5; off by default)
    setMods(m)
    setCorelight(forge.corelight)

    // settle the marks that passed while the host was gone — wall-clock
    // aligned, deterministic seeds, so a reload can't reroll history and
    // the live scheduler's marks line up with the away ledger's
    const since = h.lastSeenAt ?? now
    const marks: number[] = []
    for (let at = (Math.floor(since / MATCH_INTERVAL) + 1) * MATCH_INTERVAL; at <= now; at += MATCH_INTERVAL) {
      marks.push(at)
    }
    const missedMarks = marks.slice(-AWAY_CAP)
    if (missedMarks.length > 0) {
      const digest: AwayDigest = { matches: missedMarks.length, mana: 0, exp: 0, vaultFalls: 0, best: null }
      const heat = forgeHeat(forge)
      for (const at of missedMarks) {
        const seed = Math.floor(at / 1000) >>> 0
        // past the heat ceiling, rarely, the beacon draws... nothing that fights
        if (heat > 250 && seed % 17 === 0) {
          const omen: LedgerEntry = {
            seed, victory: false, winnerTeam: null, deepestTeam: 0, reachedGauntlet: false,
            fallen: 0, deepest: 0, manaYield: 0, ticks: 0, at, teamName: '', omen: true,
          }
          h.ledger = [omen, ...h.ledger].slice(0, 100)
          continue
        }
        const r = runMatch(d, seed, m)
        const namedTeam = r.victory && r.winnerTeam !== null ? r.winnerTeam : r.deepestTeam
        const entry: LedgerEntry = { ...r, at, teamName: r.teamNames?.[namedTeam] ?? teamName(r.seed, namedTeam) }
        h.ledger = [entry, ...h.ledger].slice(0, 100)
        h.mana += r.manaYield
        h.exp += r.fallen * 5 + Math.round(r.deepest * 20)
        digest.mana += r.manaYield
        digest.exp += r.fallen * 5 + Math.round(r.deepest * 20)
        if (r.victory) {
          digest.vaultFalls++
          // they take a Wonder and cut a line on the way out
          h.mana = Math.max(0, h.mana - Math.max(100, Math.round(h.mana * 0.15)))
          const cut = cutConnection(forge, seed)
          forge = cut.forge
        }
        if (!digest.best || entry.deepest > digest.best.deepest) digest.best = entry
      }
      saveForge(forge)
      setAway(digest)
    }
    h.lastSeenAt = now
    saveHost(h)
    setHost(h)

    // keep the watch current while the tab is open — the forge hums and
    // the supply lines drink their upkeep
    const beat = setInterval(() => {
      const nw = Date.now()
      const f0 = settleForge(loadForge(nw), nw)
      const h0 = loadHost()
      const tick = settleConnections(f0, h0.mana, nw)
      saveForge(tick.forge)
      const nh = { ...h0, mana: tick.mana, lastSeenAt: nw }
      saveHost(nh)
      setHost(nh)
      setCorelight(tick.forge.corelight)
    }, 60_000)
    return () => clearInterval(beat)
  }, [])

  const onMatchEnd = useCallback((r: MatchResult) => {
    const namedTeam = r.victory && r.winnerTeam !== null ? r.winnerTeam : r.deepestTeam
    const entry: LedgerEntry = { ...r, at: Date.now(), teamName: r.teamNames?.[namedTeam] ?? teamName(r.seed, namedTeam) }

    // a vault loss costs: they take a Wonder, and cut a supply line out
    let cutName: string | null = null
    if (r.victory) {
      const f = loadForge(Date.now())
      const cut = cutConnection(f, r.seed)
      if (cut.planet !== null) {
        saveForge(cut.forge)
        cutName = activePlanets(f)[cut.planet].name
      }
    }
    setHost((prev) => {
      let mana = prev.mana + r.manaYield
      if (r.victory) {
        mana = Math.max(0, mana - Math.max(100, Math.round(mana * 0.15)))
      }
      const next: HostState = {
        ...prev,
        mana,
        exp: prev.exp + r.fallen * 5 + Math.round(r.deepest * 20),
        ledger: [entry, ...prev.ledger].slice(0, 100),
      }
      saveHost(next)
      return next
    })

    // pop a toast, fade it out later
    const id = ++toastId.current
    const text = entryText(entry) + (r.victory ? ` — a Wonder taken${cutName ? `, the line to ${cutName} cut` : ''}` : '')
    setToasts((prev) => [
      { id, text, color: TEAM_COLORS[namedTeam % TEAM_COLORS.length], mana: r.manaYield },
      ...prev.slice(0, 3),
    ])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000)
  }, [])

  if (!doc) return <div className="min-h-screen bg-[#070a10]" />

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-300 font-mono overflow-x-hidden">
      {/* toasts — top right, pop and fade */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="px-3 py-2 rounded border border-slate-800 bg-[#0b101c]/95 text-xs animate-[nolmir-toast_6s_ease-in-out_forwards]"
          >
            <span style={{ color: t.color }}>{t.text}</span>
            {t.mana > 0 && <span className="text-cyan-400/90 ml-2">+{t.mana}</span>}
          </div>
        ))}
      </div>
      <style>{`@keyframes nolmir-toast { 0% { opacity: 0; transform: translateY(-6px); } 6% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; } 100% { opacity: 0; } }`}</style>

      <Drift open={driftOpen} onClose={() => setDriftOpen(false)} />

      {/* while you were away */}
      {away && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setAway(null)}>
          <div
            className="rounded-lg border border-cyan-900/60 bg-[#0b101c] p-6 max-w-md w-[90%] text-sm space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-cyan-300 tracking-[0.25em] text-xs">WHILE YOU HELD NO WATCH</h2>
            <p className="text-slate-300">
              <b className="text-slate-100">{away.matches}</b> {away.matches === 1 ? 'team' : 'teams'} answered the
              beacon.
            </p>
            <div className="flex gap-5">
              <span className="text-cyan-300">
                +<b className="tabular-nums">{away.mana.toLocaleString()}</b> mana
              </span>
              <span className="text-violet-300">
                +<b className="tabular-nums">{away.exp.toLocaleString()}</b> exp
              </span>
              {away.vaultFalls > 0 && (
                <span className="text-yellow-300">
                  vault fell <b>{away.vaultFalls}×</b>
                </span>
              )}
            </div>
            {away.best && (
              <p className="text-slate-500 text-xs">
                closest call: {entryText(away.best)}
              </p>
            )}
            <button
              onClick={() => setAway(null)}
              className="mt-2 px-3 py-1 text-xs rounded border border-cyan-800 text-cyan-300 hover:bg-cyan-950/40"
            >
              resume the watch
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1200px] mx-auto px-4 py-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between mb-4">
          <div>
            <h1 className="text-cyan-300 text-xl tracking-[0.3em]">NOLMIR</h1>
            <p className="text-slate-500 text-xs mt-1">
              {doc.name} · the beacon is lit · challengers are coming
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-cyan-300">
              mana <b className="tabular-nums">{host.mana.toLocaleString()}</b>
            </span>
            <span
              className="text-violet-300"
              title={(() => {
                const p = hostProgress(host.exp)
                const next = HOST_UNLOCKS.find((u) => u.level > p.level)
                return `host level ${p.level} — next at ${p.next.toLocaleString()} exp${next ? ` · lv ${next.level}: ${next.what}` : ''}`
              })()}
            >
              host <b className="tabular-nums">lv {hostProgress(host.exp).level}</b>
              <span className="text-violet-300/60 text-xs ml-1.5">{host.exp.toLocaleString()} exp</span>
            </span>
            <span className="text-sky-300/90" title="corelight — the forge's bank">
              ◈ <b className="tabular-nums">{Math.floor(corelight).toLocaleString()}</b>
            </span>
            <a href="/nolmir/deck" className="tracking-[0.2em] text-xs uppercase text-cyan-400/70 hover:text-cyan-300 border border-cyan-900/60 rounded px-2 py-1" title="the command deck — the whole ship at a glance">⌂ deck</a>
            <Emblem kind="starforge" href="/nolmir/starforge" label="STARFORGE" />
            <Emblem kind="expeditions" href="/nolmir/expeditions" label="EXPEDITIONS" />
            <button
              onClick={() => {
                sfx.ensure()
                const m = !muted
                sfx.setMuted(m)
                setMuted(m)
                if (!m) sfx.play('click')
              }}
              title={muted ? 'sound off — click to enable' : 'sound on'}
              className="text-base leading-none text-slate-500 hover:text-cyan-300 transition-colors"
            >
              {muted ? '🔇' : '🔊'}
            </button>
            {/* ledger icon — placeholder glyph until Alex draws the real one */}
            <button
              onClick={() => setLedgerOpen((v) => !v)}
              className={`relative px-2 py-0.5 rounded border text-base leading-none transition-colors ${
                ledgerOpen
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
              }`}
              title="the ledger"
            >
              ▤
              {host.ledger.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-cyan-900 text-cyan-200 rounded-full px-1 tabular-nums">
                  {host.ledger.length}
                </span>
              )}
            </button>
            <a href="/nolmir/dev" className="text-slate-500 hover:text-cyan-300 transition-colors">
              [edit]
            </a>
          </div>
        </header>

        <div className="relative">
          <div className="flex justify-center">
            <Terrarium doc={doc} mods={mods} onMatchEnd={onMatchEnd} scheduleMs={MATCH_INTERVAL} onLogs={() => setLedgerOpen((v) => !v)} onDrift={() => setDriftOpen(true)} />
          </div>

          {/* the ledger panel */}
          {ledgerOpen && (
            <div className="absolute top-2 right-2 w-[26rem] max-w-[90%] max-h-[80%] overflow-y-auto rounded-lg border border-slate-800 bg-[#0b101c]/95 p-3 z-40">
              <h2 className="text-slate-500 text-xs tracking-widest mb-2">THE LEDGER</h2>
              {host.ledger.length === 0 ? (
                <p className="text-slate-600 text-sm">No teams have answered the beacon yet. They will.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {host.ledger.map((e, i) => (
                    <li key={`${e.at}-${i}`} className="flex gap-2 items-baseline">
                      <span className="text-slate-600 tabular-nums w-14 shrink-0">
                        {new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={e.victory ? 'text-yellow-300' : 'text-slate-300'}>{entryText(e)}</span>
                      {!e.victory && <span className="text-cyan-400/80 shrink-0">+{e.manaYield}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <footer className="mt-6 text-xs text-slate-700 text-center space-y-1">
          <div>arena: 4 teams of 3 · last standing ascends · the gauntlet decides</div>
          <div>an Athernyx story · the machines were left running</div>
        </footer>
      </div>
    </div>
  )
}
