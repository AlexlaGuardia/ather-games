'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Terrarium from '../components/Terrarium'
import Drift from '../components/Drift'
import Emblem from '../components/Emblem'
import { loadHost, saveHost, hostProgress, HOST_UNLOCKS } from '../lib/host'
import {
  loadForge,
  saveForge,
  settleForge,
  settleConnections,
  cutConnection,
  activePlanets,
} from '../lib/starforge'
import { settleHomecoming, teamName, MATCH_INTERVAL, type AwayDigest } from '../lib/away'
import { CrucibleDoc, HostState, LedgerEntry, MatchMods, MatchResult, TEAM_COLORS } from '../lib/types'
import { sfx } from '../lib/sfx'
import { useGainFx, FloatLayer, flashCls, GainFxStyles } from '../components/gainfx'

interface Toast {
  id: number
  text: string
  color: string
  mana: number
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

  const manaFx = useGainFx()
  // host level-up beat — watch the displayed level; fires for live wins AND the away-settle
  const [levelFlash, setLevelFlash] = useState(false)
  const levelRef = useRef<number | null>(null)
  useEffect(() => {
    const lvl = hostProgress(host.exp).level
    if (levelRef.current !== null && lvl > levelRef.current) {
      setLevelFlash(true)
      sfx.ensure(); sfx.play('levelUp')
      window.setTimeout(() => setLevelFlash(false), 900)
    }
    levelRef.current = lvl
  }, [host.exp])

  useEffect(() => {
    setMuted(sfx.isMuted())

    const now = Date.now()
    // the full homecoming settle — shared with the Command Deck (idempotent by
    // lastSeenAt). If you came in via the deck it already banked the haul, so
    // `away` is null here; entering the Crucible directly settles + shows it.
    const hc = settleHomecoming(now)
    setDoc(hc.doc)
    setMods(hc.mods)
    setCorelight(hc.corelight)
    if (hc.away) setAway(hc.away)
    setHost(hc.host)

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
    if (r.manaYield > 0) manaFx.push(r.manaYield, 'mana')

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
            <span className="text-cyan-300 relative">
              mana <b className={`tabular-nums inline-block ${flashCls(manaFx.flash)}`}>{host.mana.toLocaleString()}</b>
              <FloatLayer floaters={manaFx.floaters} />
            </span>
            <span
              className="text-violet-300"
              title={(() => {
                const p = hostProgress(host.exp)
                const next = HOST_UNLOCKS.find((u) => u.level > p.level)
                return `host level ${p.level} — next at ${p.next.toLocaleString()} exp${next ? ` · lv ${next.level}: ${next.what}` : ''}`
              })()}
            >
              host <b className={`tabular-nums inline-block ${levelFlash ? 'nolmir-levelup' : ''}`}>lv {hostProgress(host.exp).level}</b>
              <span className="text-violet-300/60 text-xs ml-1.5">{host.exp.toLocaleString()} exp</span>
            </span>
            <span className="text-sky-300/90" title="corelight — the forge's bank">
              ◈ <b className="tabular-nums">{Math.floor(corelight).toLocaleString()}</b>
            </span>
            <a href="/nolmir" className="tracking-[0.2em] text-xs uppercase text-cyan-400/70 hover:text-cyan-300 border border-cyan-900/60 rounded px-2 py-1" title="the command deck — the whole ship at a glance">⌂ deck</a>
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
      <GainFxStyles />
    </div>
  )
}
