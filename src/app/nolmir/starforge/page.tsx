'use client'

// THE STARFORGE — the tycoon half. Your ship holds the center of the system;
// planets unlock outward and feed the stockpile. Ores transmute to corelight
// or refine into castings. Corelight grows the forge; mana (the Crucible's
// harvest) buys the armory. One loop, two rooms.

import { useCallback, useEffect, useState } from 'react'
import { Chakra_Petch } from 'next/font/google'
import Orrery from '../components/Orrery'
import Emblem from '../components/Emblem'

// the display face — squared, industrial, the genre's voice (Eurostile's free cousin).
// labels/tabs/titles only; mono keeps the numbers and the flavor text.
const display = Chakra_Petch({ weight: ['500', '600'], subsets: ['latin'] })
import { HostState } from '../lib/types'
import { loadHost, saveHost, guardProgress } from '../lib/host'
import { sfx } from '../lib/sfx'
import WarpCeremony, { type WarpData } from '../components/WarpCeremony'
import {
  ForgeState,
  PLANETS,
  ORES,
  ORE_COLOR,
  ORE_VALUE,
  CASTINGS,
  OreId,
  loadForge,
  saveForge,
  settleForge,
  forgeRate,
  forgeMods,
  oreRates,
  planetLevelCost,
  transmute,
  transmuteValue,
  rigCost,
  conduitCost,
  depthCost,
  beaconCost,
  vigorCost,
  edgeCost,
  marksVigorCost,
  marksEdgeCost,
  championStats,
  ownedFor,
  defaultOwned,
  RESEARCH,
  researchLevel,
  researchCost,
  researchOpen,
  canResearch,
  doResearch,
  forgeHeat,
  HEAT_TIER_2,
  HEAT_TIER_3,
  settleConnections,
  upkeepRate,
  relinkCost,
  connectionOf,
  activePlanets,
  canWarp,
  warpPreview,
  doWarp,
  WARP_HEAT,
  echoMult,
} from '../lib/starforge'
import { unlockedTier } from '../lib/teams'

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`
  return Math.floor(n).toLocaleString()
}

// hand-drawn ore icons (Aseprite, via the dropbox) — style locked 2026-06-11:
// dark host rock + hard-edged faceted crystal in the ore's color.
const ORE_ICON: Partial<Record<OreId, string>> = {
  ferrite: '/nolmir/ores/ferrite.png',
  voidsteel: '/nolmir/ores/voidsteel.png',
}

type Room = 'core' | 'orrery' | 'refinery' | 'armory' | 'gate'

const ROOMS: { id: Room; name: string }[] = [
  { id: 'core', name: 'THE CORE' },
  { id: 'orrery', name: 'THE ORRERY' },
  { id: 'refinery', name: 'THE REFINERY' },
  { id: 'armory', name: 'THE ARMORY' },
  { id: 'gate', name: 'THE GATE' },
]

export default function StarforgePage() {
  const [forge, setForge] = useState<ForgeState | null>(null)
  const [host, setHost] = useState<HostState>({ mana: 0, exp: 0, ledger: [] })
  const [selected, setSelected] = useState<number | null>(null)
  const [sigilOpen, setSigilOpen] = useState<number | null>(null)
  const [room, setRoom] = useState<Room>('orrery')
  const [armed, setArmed] = useState(false)
  const [muted, setMuted] = useState(false)
  const [warpSeq, setWarpSeq] = useState<WarpData | null>(null)
  const [rehearsing, setRehearsing] = useState(false)

  useEffect(() => {
    const now = Date.now()
    const settled = settleForge(loadForge(now), now)
    saveForge(settled)
    setForge(settled)
    setHost(loadHost())
    setMuted(sfx.isMuted())

    const t = setInterval(() => {
      setForge((prev) => {
        if (!prev) return prev
        const next = settleForge(prev, Date.now())
        saveForge(next)
        return next
      })
    }, 250)
    // the supply lines drink on a slower beat
    const drink = setInterval(() => {
      const nw = Date.now()
      setForge((prev) => {
        if (!prev) return prev
        const h0 = loadHost()
        const sc = settleConnections(prev, h0.mana, nw)
        if (sc.drained > 0) {
          const nh = { ...h0, mana: sc.mana }
          saveHost(nh)
          setHost(nh)
        }
        saveForge(sc.forge)
        return sc.forge
      })
    }, 10_000)
    return () => {
      clearInterval(t)
      clearInterval(drink)
    }
  }, [])

  const mutate = useCallback((apply: (f: ForgeState) => ForgeState | null) => {
    setForge((prev) => {
      if (!prev) return prev
      const next = apply(prev)
      if (!next) return prev
      saveForge(next)
      return next
    })
  }, [])

  const buyCorelight = useCallback(
    (cost: number, apply: (f: ForgeState) => ForgeState) => {
      sfx.ensure()
      sfx.play('buy')
      mutate((f) => (f.corelight >= cost ? apply({ ...f, corelight: f.corelight - cost }) : null))
    },
    [mutate],
  )

  const buyMana = useCallback(
    (cost: number, apply: (f: ForgeState) => ForgeState) => {
      sfx.ensure()
      sfx.play('buy')
      setHost((prevHost) => {
        if (prevHost.mana < cost) return prevHost
        const nextHost = { ...prevHost, mana: prevHost.mana - cost }
        saveHost(nextHost)
        mutate((f) => apply(f))
        return nextHost
      })
    },
    [mutate],
  )

  const buyMarks = useCallback(
    (cost: number, apply: (f: ForgeState) => ForgeState) => {
      sfx.ensure()
      sfx.play('buy')
      setHost((prevHost) => {
        if ((prevHost.marks ?? 0) < cost) return prevHost
        const nextHost = { ...prevHost, marks: (prevHost.marks ?? 0) - cost }
        saveHost(nextHost)
        mutate((f) => apply(f))
        return nextHost
      })
    },
    [mutate],
  )

  if (!forge) return <div className="min-h-screen bg-[#070a10]" />

  const rate = forgeRate(forge)
  const mods = forgeMods(forge)
  const rates = oreRates(forge)
  const sellValue = transmuteValue(forge)

  const row = (
    label: string,
    desc: string,
    level: string,
    cost: number,
    currency: 'corelight' | 'mana',
    onBuy: () => void,
  ) => {
    const have = currency === 'corelight' ? forge.corelight : host.mana
    const afford = have >= cost
    return (
      <div key={label} className="flex items-center gap-3 py-2 border-b border-slate-900">
        <div className="flex-1 min-w-0">
          <div className="text-slate-200 text-sm">
            {label} <span className="text-slate-600 text-xs ml-1">{level}</span>
          </div>
          <div className="text-slate-600 text-xs">{desc}</div>
        </div>
        <button
          onClick={onBuy}
          disabled={!afford}
          className={`px-3 py-1 text-xs rounded border tabular-nums transition-colors ${
            afford
              ? currency === 'corelight'
                ? 'border-sky-600 text-sky-300 hover:bg-sky-950/40'
                : 'border-fuchsia-700 text-fuchsia-300 hover:bg-fuchsia-950/40'
              : 'border-slate-900 text-slate-700'
          }`}
        >
          {fmt(cost)} {currency === 'corelight' ? '◈' : 'mana'}
        </button>
      </div>
    )
  }

  const sel = selected !== null ? activePlanets(forge)[selected] : null
  const selLevel = selected !== null ? forge.planets[selected] : 0

  const finishWarp = () => {
    if (rehearsing) { setRehearsing(false); setWarpSeq(null); return } // a rehearsal spends nothing
    if (!forge) return
    const warped = doWarp(forge, Date.now())
    saveForge(warped)
    setForge(warped)
    setSelected(null)
    setRoom('orrery')
    setWarpSeq(null)
  }

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-300 font-mono overflow-hidden">
      {/* the system — always turning behind the rooms; clicks only land from the orrery room */}
      <div
        className={`fixed inset-0 z-0 flex items-center justify-center ${
          room === 'orrery' ? '' : 'pointer-events-none'
        }`}
      >
        <Orrery forge={forge} selected={selected} onSelect={setSelected} backdrop />
      </div>

      {/* the rooms float over the system; empty space passes clicks through */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 pointer-events-none [&>*]:pointer-events-auto">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between mb-4">
          <div>
            <h1 className={`${display.className} text-sky-300 text-xl tracking-[0.3em]`}>THE STARFORGE</h1>
            <p className="text-slate-500 text-xs mt-1">
              node {forge.node ?? 1} · the core hums · the system turns · nobody is watching
              {(forge.echoes ?? 0) > 0 && (
                <span className="text-amber-300/70"> · {forge.echoes} echoes ×{echoMult(forge).toFixed(2)}</span>
              )}
              {(forge.networkRate ?? 0) > 0 && (
                <span className="text-sky-300/60"> · the network sends {forge.networkRate!.toFixed(1)}/s</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-sky-300">
              ◈ <b className="tabular-nums">{fmt(forge.corelight)}</b>
              <span className="text-slate-600 text-xs ml-1">+{rate.toFixed(1)}/s</span>
            </span>
            <span className="text-fuchsia-300/90">
              mana <b className="tabular-nums">{fmt(host.mana)}</b>
            </span>
            <Emblem kind="crucible" href="/nolmir/crucible" label="CRUCIBLE" />
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
          </div>
        </header>

        {/* the deck — one room at a time */}
        <nav className="flex gap-1 mb-5 flex-wrap">
          {ROOMS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRoom(r.id)}
              className={`${display.className} px-3 py-1 text-[11px] tracking-[0.2em] rounded border transition-colors backdrop-blur-sm ${
                room === r.id
                  ? 'border-sky-500 text-sky-200 bg-sky-950/40'
                  : 'border-slate-800 text-slate-600 bg-[#070a10]/60 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              {r.name}
            </button>
          ))}
        </nav>

        {room === 'orrery' && (
        <>
        {/* the unobstructed view — the system IS the room; click a world to work it */}
        {sel && selected !== null && (
          <div className="rounded-lg border border-slate-800 bg-[#0b101c]/85 p-4 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-slate-100 text-sm">
                  {sel.name}{' '}
                  <span className="text-slate-600 text-xs">
                    {selLevel > 0 ? `mining level ${selLevel}` : 'unworked'}
                  </span>
                </div>
                <div className="text-xs mt-1 flex gap-3 flex-wrap">
                  {Object.entries(sel.ores).map(([ore, base]) => (
                    <span key={ore} style={{ color: ORE_COLOR[ore as OreId] }}>
                      {ore} {selLevel > 0 ? `+${((base as number) * Math.pow(1.25, selLevel - 1)).toFixed(2)}/s` : `(${base}/s base)`}
                    </span>
                  ))}
                  {selLevel > 0 && (
                    <span className={connectionOf(forge, selected) >= 100 ? 'text-emerald-400/70' : connectionOf(forge, selected) > 0 ? 'text-amber-400/80' : 'text-red-400'}>
                      line {Math.round(connectionOf(forge, selected))}%
                    </span>
                  )}
                  {sel.trait && <span className="text-violet-300/70">{sel.trait}</span>}
                </div>
              </div>
              {selLevel > 0 && connectionOf(forge, selected) < 100 && (
                <button
                  onClick={() => {
                    const cost = relinkCost(selLevel)
                    setHost((prevHost) => {
                      if (prevHost.mana < cost) return prevHost
                      const nh = { ...prevHost, mana: prevHost.mana - cost }
                      saveHost(nh)
                      mutate((f) => ({
                        ...f,
                        connections: (f.connections ?? PLANETS.map(() => 100)).map((c, i) => (i === selected ? 100 : c)),
                      }))
                      return nh
                    })
                  }}
                  disabled={host.mana < relinkCost(selLevel)}
                  className={`px-3 py-1 text-xs rounded border tabular-nums ${
                    host.mana >= relinkCost(selLevel)
                      ? 'border-fuchsia-700 text-fuchsia-300 hover:bg-fuchsia-950/40'
                      : 'border-slate-900 text-slate-700'
                  }`}
                >
                  re-link — {fmt(relinkCost(selLevel))} mana
                </button>
              )}
              {selLevel === 0 ? (
                <button
                  onClick={() =>
                    buyCorelight(sel.unlockCost, (f) => ({
                      ...f,
                      planets: f.planets.map((l, i) => (i === selected ? 1 : l)),
                    }))
                  }
                  disabled={forge.corelight < sel.unlockCost}
                  className={`px-3 py-1 text-xs rounded border tabular-nums ${
                    forge.corelight >= sel.unlockCost
                      ? 'border-sky-600 text-sky-300 hover:bg-sky-950/40'
                      : 'border-slate-900 text-slate-700'
                  }`}
                >
                  claim — {fmt(sel.unlockCost)} ◈
                </button>
              ) : (
                <button
                  onClick={() =>
                    buyCorelight(planetLevelCost(forge, selected, selLevel + 1), (f) => ({
                      ...f,
                      planets: f.planets.map((l, i) => (i === selected ? l + 1 : l)),
                    }))
                  }
                  disabled={forge.corelight < planetLevelCost(forge, selected, selLevel + 1)}
                  className={`px-3 py-1 text-xs rounded border tabular-nums ${
                    forge.corelight >= planetLevelCost(forge, selected, selLevel + 1)
                      ? 'border-sky-600 text-sky-300 hover:bg-sky-950/40'
                      : 'border-slate-900 text-slate-700'
                  }`}
                >
                  deepen mining — {fmt(planetLevelCost(forge, selected, selLevel + 1))} ◈
                </button>
              )}
            </div>
          </div>
        )}

        </>
        )}

        {room === 'refinery' && (
        <>
        <div className="mb-6">
          <section className="rounded-lg border border-slate-800 bg-[#0b101c]/85 p-4">
            <h2 className={`${display.className} text-slate-500 text-xs tracking-widest mb-2`}>REFINERY — castings are research fuel</h2>
            <div className="space-y-1">
              {CASTINGS.map((c) => {
                const active = forge.refining === c.id
                return (
                  <div key={c.id} className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => mutate((f) => ({ ...f, refining: active ? null : c.id, refineCarry: 0 }))}
                      className={`px-2 py-0.5 rounded border ${
                        active
                          ? 'border-emerald-500 text-emerald-300'
                          : 'border-slate-800 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      {active ? '■ halt' : '▶ refine'}
                    </button>
                    <span className="text-slate-200">{c.name}</span>
                    <span className="text-slate-600">
                      {Object.entries(c.inputs)
                        .map(([o, q]) => `${q} ${o}`)
                        .join(' + ')}{' '}
                      / {c.craftSec}s
                    </span>
                    <span className="flex-1" />
                    <span className="tabular-nums text-slate-300">×{fmt(forge.castings[c.id] ?? 0)}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* RESEARCH — the tree the castings were always for */}
        <section className="mb-6">
          <h2 className={`${display.className} text-slate-500 text-xs tracking-widest mb-2`}>
            RESEARCH <span className="text-slate-700">· knowledge outlives the node — it warps with the ship</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-3">
            {(['core', 'crucible', 'expedition'] as const).map((branch) => (
              <div key={branch} className="rounded-lg border border-slate-800 bg-[#0b101c]/85 p-3">
                <h3 className={`${display.className} text-[10px] tracking-[0.25em] text-slate-600 mb-2`}>{branch.toUpperCase()}</h3>
                <div className="space-y-2">
                  {RESEARCH.filter((r) => r.branch === branch).map((def) => {
                    const lv = researchLevel(forge, def.id)
                    const open = researchOpen(forge, def)
                    const maxed = lv >= def.cap
                    const can = canResearch(forge, def)
                    const cost = researchCost(def, lv)
                    return (
                      <div key={def.id} className={`text-xs ${open ? '' : 'opacity-40'}`}>
                        <div className="flex items-baseline justify-between">
                          <span className="text-slate-200">
                            {def.name} <span className="text-slate-600">{lv}/{def.cap}</span>
                          </span>
                          {maxed ? (
                            <span className="text-emerald-400/80 text-[10px]">mastered</span>
                          ) : (
                            <button
                              onClick={() => {
                                sfx.ensure()
                                sfx.play('unlock')
                                mutate((f) => doResearch(f, def))
                              }}
                              disabled={!can}
                              className={`px-2 py-0.5 rounded border text-[10px] ${
                                can
                                  ? 'border-emerald-600 text-emerald-300 hover:bg-emerald-950/40'
                                  : 'border-slate-900 text-slate-700'
                              }`}
                            >
                              study
                            </button>
                          )}
                        </div>
                        <div className="text-slate-600 text-[10px]">{def.line}</div>
                        {!maxed && open && (
                          <div className="text-[10px] mt-0.5 flex gap-2 flex-wrap">
                            {Object.entries(cost).map(([cid, n]) => {
                              const have = forge.castings[cid] ?? 0
                              return (
                                <span key={cid} className={have >= n ? 'text-emerald-400/70' : 'text-red-400/60'}>
                                  {n} {CASTINGS.find((c) => c.id === cid)?.name ?? cid} ({fmt(have)})
                                </span>
                              )
                            })}
                          </div>
                        )}
                        {!open && <div className="text-[10px] text-slate-700">study the node above first</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
        </>
        )}

        {room === 'core' && (
        <>
        {/* the heat gauge — the deep is loud */}
        <section className="mb-6 rounded-lg border border-slate-800 bg-[#0b101c]/85 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className={`${display.className} text-slate-500 text-xs tracking-widest`}>HEAT — how bright this node burns</h2>
            <span className="text-orange-300 text-sm tabular-nums">{forgeHeat(forge)}</span>
          </div>
          {(() => {
            const heat = forgeHeat(forge)
            const scale = Math.max(HEAT_TIER_3 * 1.3, heat * 1.1)
            const tier = unlockedTier({ heat, exp: host.exp })
            return (
              <>
                <div className="relative h-2 bg-slate-900 rounded">
                  <div
                    className="h-2 rounded bg-gradient-to-r from-sky-500 via-amber-500 to-red-500"
                    style={{ width: `${Math.min(100, (100 * heat) / scale)}%` }}
                  />
                  {[HEAT_TIER_2, HEAT_TIER_3].map((t) => (
                    <div key={t} className="absolute top-[-3px] h-3.5 w-px bg-slate-500" style={{ left: `${(100 * t) / scale}%` }} />
                  ))}
                </div>
                <p className="text-[10px] text-slate-600 mt-2">
                  drawing <span className="text-slate-300">tier {tier}</span> challengers · marks at {HEAT_TIER_2} and{' '}
                  {HEAT_TIER_3} · yield ×{mods.yieldMult.toFixed(2)} — heat pays · supply upkeep{' '}
                  <span className="text-fuchsia-300/80">{(upkeepRate(forge) * 3600).toFixed(0)} mana/hr</span> — heat
                  costs · only the gate will quiet it
                </p>
              </>
            )
          })()}
        </section>

        {/* supply lines — mana keeps what corelight claimed (moved from the orrery room) */}
        <div className="mb-3 rounded-lg border border-slate-800 bg-[#0b101c]/85 p-3">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className={`${display.className} text-slate-500 text-xs tracking-widest`}>SUPPLY LINES</h2>
            <span className="text-fuchsia-300/80 text-xs tabular-nums">
              upkeep {(upkeepRate(forge) * 3600).toFixed(0)} mana/hr
              <span className="text-slate-600 ml-1">· reserve {fmt(host.mana)}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5 text-[10px]">
            {activePlanets(forge).map((p, i) => {
              if (forge.planets[i] <= 0) return null
              const conn = connectionOf(forge, i)
              return (
                <div key={p.name}>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{p.name}</span>
                    <span className={conn >= 100 ? 'text-emerald-400/70' : conn > 0 ? 'text-amber-400/80' : 'text-red-400'}>
                      {Math.round(conn)}%
                    </span>
                  </div>
                  <div className="h-1 bg-slate-900 rounded mt-0.5">
                    <div
                      className={`h-1 rounded ${conn >= 100 ? 'bg-emerald-500/60' : conn > 0 ? 'bg-amber-500/70' : 'bg-red-500'}`}
                      style={{ width: `${Math.max(2, conn)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-slate-700 text-[10px] mt-2">
            heat strains the lines — unpaid upkeep frays them, a fallen vault cuts one · frayed lines ship less ore
          </p>
        </div>

        {/* stockpile */}
        <div className="mb-6">
          <section className="rounded-lg border border-slate-800 bg-[#0b101c]/85 p-4">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className={`${display.className} text-slate-500 text-xs tracking-widest`}>STOCKPILE</h2>
              <button
                onClick={() => mutate((f) => transmute(f))}
                disabled={sellValue <= 0}
                className={`px-3 py-1 text-xs rounded border tabular-nums ${
                  sellValue > 0
                    ? 'border-sky-600 text-sky-300 hover:bg-sky-950/40'
                    : 'border-slate-900 text-slate-700'
                }`}
              >
                transmute all → {fmt(sellValue)} ◈
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {ORES.map((ore) => (
                <div key={ore} className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5" style={{ color: ORE_COLOR[ore] }}>
                    {ORE_ICON[ore] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ORE_ICON[ore]} alt="" className="w-5 h-5 [image-rendering:pixelated]" />
                    )}
                    {ore}
                    {rates[ore] > 0 && <span className="text-slate-600"> +{rates[ore].toFixed(2)}/s</span>}
                  </span>
                  <span className="tabular-nums text-slate-300">{fmt(forge.stock[ore] ?? 0)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* forge growth — corelight */}
        <section className="mb-6 rounded-lg border border-slate-800 bg-[#0b101c]/85 p-4">
          <h2 className={`${display.className} text-slate-500 text-xs tracking-widest mb-1`}>THE FORGE — corelight</h2>
          {row('Mining Rig', 'another arm on the core · +1 base rate', `×${forge.rigs}`, rigCost(forge), 'corelight', () =>
            buyCorelight(rigCost(forge), (f) => ({ ...f, rigs: f.rigs + 1 })),
          )}
          {row('Conduit', 'refines the flow · ×1.5 rate per level', `lv ${forge.conduit}`, conduitCost(forge), 'corelight', () =>
            buyCorelight(conduitCost(forge), (f) => ({ ...f, conduit: f.conduit + 1 })),
          )}
          {row(
            'Core Depth',
            'tap deeper · ×2.2 rate per level — the deep is loud',
            `lv ${forge.depth}`,
            depthCost(forge),
            'corelight',
            () => buyCorelight(depthCost(forge), (f) => ({ ...f, depth: f.depth + 1 })),
          )}
          {row(
            'Beacon Tuning',
            `richer harvest from every fall · yield ×${mods.yieldMult.toFixed(2)}`,
            `lv ${forge.beaconTuning}`,
            beaconCost(forge),
            'corelight',
            () => buyCorelight(beaconCost(forge), (f) => ({ ...f, beaconTuning: f.beaconTuning + 1 })),
          )}
        </section>
        </>
        )}

        {/* THE ARMORY — the three slots. Guards are the collected shells;
            sigils are the stats. Click a slot for the profile. */}
        {room === 'armory' && (
        <section className="mb-6">
          <h2 className={`${display.className} text-slate-500 text-xs tracking-widest mb-2`}>
            THE ARMORY — your three Guards <span className="text-slate-700">· sigils fed by mana &amp; expedition marks</span>
          </h2>
          <div className="flex justify-center gap-4">
            {forge.sigils.map((s, i) => {
              const o = ownedFor(forge, s.profileId)
              const c = championStats(o)
              return (
                <button
                  key={i}
                  onClick={() => setSigilOpen(i)}
                  className="w-36 rounded-lg border border-amber-900/50 bg-[#0b101c]/85 p-4 hover:border-amber-500/70 transition-colors group"
                >
                  <div className="text-amber-300 text-4xl group-hover:scale-110 transition-transform">{s.glyph}</div>
                  <div className="text-slate-200 text-sm mt-2">{s.name}</div>
                  <div className="text-violet-300/70 text-[10px] mt-0.5 tabular-nums">lv {o.level}</div>
                  <div className="text-slate-600 text-[10px] mt-1">
                    vigor {o.vigor} · edge {o.edge}
                  </div>
                  <div className="text-amber-200/60 text-[10px] mt-1 tabular-nums">
                    {c.hp} hp · {c.atk} atk
                  </div>
                </button>
              )
            })}
          </div>
        </section>
        )}

        {/* THE GATE — the escape valve. warp when the node outpaces you */}
        {room === 'gate' &&
          (() => {
            const heat = forgeHeat(forge)
            const ready = canWarp(forge)
            const p = warpPreview(forge)
            return (
              <section className="mb-6 rounded-lg border border-slate-800 bg-[#0b101c]/85 p-6">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className={`${display.className} text-slate-400 text-sm tracking-[0.3em]`}>
                    THE GATE {ready ? '— KEYED' : '— SEALED'}
                  </h2>
                  <div className="flex items-baseline gap-3">
                    <button
                      onClick={() => {
                        const fromNode = forge.node ?? 1
                        const totalEchoes = (forge.echoes ?? 0) + p.echoesGained
                        setRehearsing(true)
                        setWarpSeq({
                          fromNode, toNode: fromNode + 1, echoesGained: p.echoesGained, networkGain: p.networkGain,
                          totalEchoes, rateMult: Math.pow(1.03, totalEchoes), planets: p.planets.map((pl) => ({ name: pl.name })),
                        })
                      }}
                      className="text-[10px] tracking-[0.2em] uppercase text-slate-600 hover:text-cyan-300"
                      title="watch the crossing — spends nothing"
                    >
                      rehearse ▸
                    </button>
                    <span className={`text-xs tabular-nums ${ready ? 'text-orange-300' : 'text-slate-600'}`}>
                      heat {fmt(heat)} / {WARP_HEAT}
                    </span>
                  </div>
                </div>

                {!ready ? (
                  <div className="text-center py-6">
                    <div className="text-5xl text-slate-700 mb-4">⬡</div>
                    <p className="text-slate-600 text-xs max-w-md mx-auto leading-relaxed">
                      the gate keys to a burning core. push the forge to heat {WARP_HEAT} and the way opens — until
                      then this node is all there is.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* the long-scan */}
                    <h3 className={`${display.className} text-[10px] tracking-[0.25em] text-slate-600 mb-2`}>
                      LONG-SCAN — the next system, as it will be
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                      {p.planets.map((pl) => (
                        <div key={pl.name} className="rounded border border-slate-800 bg-[#070a10] p-2 text-[10px]">
                          <div className="text-slate-200">{pl.name}</div>
                          <div className="flex gap-2 flex-wrap mt-0.5">
                            {Object.entries(pl.ores).map(([ore, r]) => (
                              <span key={ore} style={{ color: ORE_COLOR[ore as OreId] }}>
                                {ore} {r}/s
                              </span>
                            ))}
                          </div>
                          <div className="text-slate-600 mt-0.5">claim {fmt(pl.unlockCost)} ◈</div>
                          {pl.trait && <div className="text-violet-300/70 mt-0.5">{pl.trait}</div>}
                        </div>
                      ))}
                    </div>

                    {/* the ledger of the jump */}
                    <div className="grid md:grid-cols-2 gap-3 mb-4 text-xs">
                      <div className="rounded border border-emerald-900/40 bg-emerald-950/10 p-3">
                        <h4 className="text-emerald-400/80 text-[10px] tracking-widest mb-1.5">THE SHIP CARRIES</h4>
                        <p className="text-slate-400 leading-relaxed">
                          research · castings · the three Guards and their sigils · mana, exp, marks · the crucible,
                          every stone of it · <span className="text-amber-300/90">+{p.echoesGained} echoes</span>{' '}
                          (rates ×{Math.pow(1.03, (forge.echoes ?? 0) + p.echoesGained).toFixed(2)} forever) ·{' '}
                          <span className="text-sky-300/90">+{p.networkGain.toFixed(1)}/s</span> from this node,
                          beaming home for good
                        </p>
                      </div>
                      <div className="rounded border border-red-900/40 bg-red-950/10 p-3">
                        <h4 className="text-red-400/70 text-[10px] tracking-widest mb-1.5">THE NODE KEEPS</h4>
                        <p className="text-slate-400 leading-relaxed">
                          the corelight bank ({fmt(forge.corelight)} ◈) · rigs, conduit, depth, beacon · the ore
                          stockpile · every planet and its levels · the heat ({fmt(heat)}) dies with the distance
                        </p>
                      </div>
                    </div>

                    {!armed ? (
                      <button
                        onClick={() => setArmed(true)}
                        className={`${display.className} w-full py-2.5 rounded border border-orange-600 text-orange-300 hover:bg-orange-950/30 text-sm tracking-[0.25em]`}
                      >
                        OPEN THE GATE
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            sfx.ensure()
                            sfx.play('warp')
                            const fromNode = forge.node ?? 1
                            const totalEchoes = (forge.echoes ?? 0) + p.echoesGained
                            setWarpSeq({
                              fromNode,
                              toNode: fromNode + 1,
                              echoesGained: p.echoesGained,
                              networkGain: p.networkGain,
                              totalEchoes,
                              rateMult: Math.pow(1.03, totalEchoes),
                              planets: p.planets.map((pl) => ({ name: pl.name })),
                            })
                            setArmed(false)
                          }}
                          className={`${display.className} flex-1 py-2.5 rounded border border-orange-500 text-orange-200 bg-orange-950/30 hover:bg-orange-950/50 text-sm tracking-[0.25em]`}
                        >
                          STEP THROUGH — NODE {(forge.node ?? 1) + 1}
                        </button>
                        <button
                          onClick={() => setArmed(false)}
                          className="px-4 py-2.5 rounded border border-slate-700 text-slate-400 hover:border-slate-500 text-xs"
                        >
                          stay
                        </button>
                      </div>
                    )}
                    <p className="text-slate-700 text-[10px] mt-3 text-center">
                      the starforge stays behind, still running. somewhere out there, the others are still humming.
                    </p>
                  </>
                )}
              </section>
            )
          })()}

        {/* sigil profile */}
        {sigilOpen !== null && forge.sigils[sigilOpen] && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setSigilOpen(null)}
          >
            <div
              className="rounded-lg border border-amber-900/60 bg-[#0b101c] p-6 max-w-sm w-[90%]"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const s = forge.sigils[sigilOpen]
                const o = ownedFor(forge, s.profileId)
                const c = championStats(o)
                const prog = guardProgress(o.xp)
                // aspect investment lives on the CREATURE now, not the slot
                const bump = (key: 'vigor' | 'edge') => (f: ForgeState) => {
                  const cur = f.owned?.[s.profileId] ?? defaultOwned(s.profileId)
                  return {
                    ...f,
                    owned: { ...(f.owned ?? {}), [s.profileId]: { ...cur, [key]: cur[key] + 1 } },
                  }
                }
                const upgrade = (key: 'vigor' | 'edge', cost: number) => buyMana(cost, bump(key))
                const upgradeMarks = (key: 'vigor' | 'edge', cost: number) => buyMarks(cost, bump(key))
                return (
                  <>
                    {/* the collectible — pattern art lands here (Aseprite) */}
                    <div className="flex flex-col items-center border border-slate-800 rounded-lg py-6 mb-4 bg-[#070a10]">
                      <span className="text-amber-300 text-6xl">{s.glyph}</span>
                      <span className="text-slate-700 text-[10px] mt-2">pattern art — collectible shell</span>
                    </div>
                    <div className="flex items-baseline justify-between mb-1">
                      <h3 className={`${display.className} text-amber-200 tracking-[0.2em]`}>{s.name.toUpperCase()}</h3>
                      <span className="text-slate-500 text-xs tabular-nums">
                        {c.hp} hp · {c.atk} atk
                      </span>
                    </div>
                    {/* creature level — grows from use, travels with the creature */}
                    <div className="mb-3">
                      <div className="flex items-baseline justify-between text-[10px] mb-0.5">
                        <span className="text-violet-300 tracking-widest">LEVEL {prog.level}</span>
                        <span className="text-slate-600 tabular-nums">{prog.into}/{prog.span} xp</span>
                      </div>
                      <div className="h-1 bg-slate-900 rounded">
                        <div className="h-1 rounded bg-violet-400/80" style={{ width: `${(100 * prog.into) / prog.span}%` }} />
                      </div>
                      <p className="text-slate-700 text-[10px] mt-1">leveled by holding breaches — gates deeper talent</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">
                          Vigor <span className="text-slate-600 text-xs">lv {o.vigor} · +15% hp/lv</span>
                        </span>
                        <span className="flex gap-1">
                          <button
                            onClick={() => upgrade('vigor', vigorCost(o))}
                            disabled={host.mana < vigorCost(o)}
                            className={`px-3 py-1 text-xs rounded border tabular-nums ${
                              host.mana >= vigorCost(o)
                                ? 'border-fuchsia-700 text-fuchsia-300 hover:bg-fuchsia-950/40'
                                : 'border-slate-900 text-slate-700'
                            }`}
                          >
                            {fmt(vigorCost(o))} mana
                          </button>
                          <button
                            onClick={() => upgradeMarks('vigor', marksVigorCost(o))}
                            disabled={(host.marks ?? 0) < marksVigorCost(o)}
                            className={`px-3 py-1 text-xs rounded border tabular-nums ${
                              (host.marks ?? 0) >= marksVigorCost(o)
                                ? 'border-amber-700 text-amber-300 hover:bg-amber-950/30'
                                : 'border-slate-900 text-slate-700'
                            }`}
                          >
                            ✶{fmt(marksVigorCost(o))}
                          </button>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">
                          Edge <span className="text-slate-600 text-xs">lv {o.edge} · +12% atk/lv</span>
                        </span>
                        <span className="flex gap-1">
                          <button
                            onClick={() => upgrade('edge', edgeCost(o))}
                            disabled={host.mana < edgeCost(o)}
                            className={`px-3 py-1 text-xs rounded border tabular-nums ${
                              host.mana >= edgeCost(o)
                                ? 'border-fuchsia-700 text-fuchsia-300 hover:bg-fuchsia-950/40'
                                : 'border-slate-900 text-slate-700'
                            }`}
                          >
                            {fmt(edgeCost(o))} mana
                          </button>
                          <button
                            onClick={() => upgradeMarks('edge', marksEdgeCost(o))}
                            disabled={(host.marks ?? 0) < marksEdgeCost(o)}
                            className={`px-3 py-1 text-xs rounded border tabular-nums ${
                              (host.marks ?? 0) >= marksEdgeCost(o)
                                ? 'border-amber-700 text-amber-300 hover:bg-amber-950/30'
                                : 'border-slate-900 text-slate-700'
                            }`}
                          >
                            ✶{fmt(marksEdgeCost(o))}
                          </button>
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-700 text-[10px] mt-4">
                      the sigil is the host&apos;s investment — shells change, sigils endure · perks (venom &amp;c.) come
                      later · reserves: {fmt(host.mana)} mana · ✶{fmt(host.marks ?? 0)} marks
                    </p>
                    <button
                      onClick={() => setSigilOpen(null)}
                      className="mt-3 px-3 py-1 text-xs rounded border border-slate-800 text-slate-500 hover:border-slate-600"
                    >
                      close
                    </button>
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {/* flavor only — must not eat orrery taps (it sits dead-center over the rings on mobile) */}
        <footer className="text-xs text-slate-700 text-center" style={{ pointerEvents: 'none' }}>
          forge feeds crucible · crucible feeds the host · the deep is loud
        </footer>
      </div>

      {warpSeq && <WarpCeremony data={warpSeq} onEnter={finishWarp} />}
    </div>
  )
}
