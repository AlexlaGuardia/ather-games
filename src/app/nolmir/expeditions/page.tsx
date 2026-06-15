'use client'

// EXPEDITIONS — send your guards through the gate to a drowned node and
// hold the breach against the tide. There is no winning. You survive longer.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Breach, { HudSnapshot } from '../components/Breach'
import Emblem from '../components/Emblem'
import { DOCTRINES, DoctrineId, RunConfig, RunResult, defaultAnchors } from '../lib/expedition'
import {
  ExpedMeta,
  TIER_UNLOCK_WAVE,
  WORKSHOP,
  bestWave,
  defaultExpedMeta,
  loadExpedMeta,
  recordRun,
  saveExpedMeta,
  tiersUnlocked,
  workshopCost,
} from '../lib/expedmeta'
import { loadHost, saveHost, guardProgress, guardXpGain, guardLevelForXp } from '../lib/host'
import { ForgeState, profileChampion, expeditionResearch, loadForge, saveForge, marksTalentCost, TALENT_CAP, ownedFor, talentLevelReq } from '../lib/starforge'
import { profileById, profileSkills, ROLE_LABEL } from '../lib/profiles'
import { HostState } from '../lib/types'
import { sfx } from '../lib/sfx'

type Phase = 'prep' | 'run' | 'after'

interface AfterState {
  result: RunResult
  newRecord: boolean
  oreDrop: { aetherite: number; manapearl: number } | null
  levelUps: { name: string; level: number }[] // creatures that climbed this hold
}

export default function ExpeditionsPage() {
  const [phase, setPhase] = useState<Phase>('prep')
  const [host, setHost] = useState<HostState>({ mana: 0, exp: 0, marks: 0, ledger: [] })
  const [meta, setMeta] = useState<ExpedMeta>(defaultExpedMeta())
  const [forge, setForge] = useState<ForgeState | null>(null)
  const [doctrine, setDoctrine] = useState<DoctrineId>('balanced')
  const [tier, setTier] = useState(1)
  const [anchors, setAnchors] = useState(defaultAnchors())
  const [placeIdx, setPlaceIdx] = useState(0)
  const [cfg, setCfg] = useState<RunConfig | null>(null)
  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [after, setAfter] = useState<AfterState | null>(null)
  const [mounted, setMounted] = useState(false)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    setHost(loadHost())
    setMeta(loadExpedMeta())
    setForge(loadForge(Date.now()))
    setMounted(true)
    setMuted(sfx.isMuted())
  }, [])

  // squad = the three equipped profiles, workshop floor + role bias + range
  const squad = useMemo(() => {
    if (!forge) return []
    const vig = 1 + 0.1 * (meta.workshop.vigor ?? 0)
    const edg = 1 + 0.1 * (meta.workshop.edge ?? 0)
    return forge.sigils.map((s) => {
      const o = ownedFor(forge, s.profileId)
      const c = profileChampion(o)
      return {
        name: c.name,
        glyph: c.glyph,
        hp: Math.round(c.hp * vig),
        atk: Math.round(c.atk * edg),
        range: c.range,
        role: c.role,
        category: c.category,
        sprite: c.sprite,
        skills: c.skills,
        level: o.level,
      }
    })
  }, [forge, meta])

  // swap the profile equipped in a given slot (placeIdx) from the collection
  const equipProfile = (slot: number, profileId: string) => {
    if (!forge) return
    const p = profileById(profileId)
    const sigils = forge.sigils.map((s, i) =>
      i === slot ? { ...s, profileId: p.id, name: p.name, glyph: p.glyph } : s,
    )
    const next = { ...forge, sigils }
    saveForge(next)
    setForge(next)
    sfx.ensure()
    sfx.play('click')
  }

  // spend marks to deepen the equipped CREATURE's talent — walks its lineup.
  // talent is EARNED: each rank needs a minimum creature level (slice 4b).
  const upgradeTalent = (slot: number) => {
    if (!forge) return
    const sig = forge.sigils[slot]
    const o = ownedFor(forge, sig.profileId)
    const cur = o.talent ?? 0
    if (cur >= TALENT_CAP) return
    if (o.level < talentLevelReq(cur + 1)) return // not yet earned
    const cost = marksTalentCost(o)
    if ((host.marks ?? 0) < cost) return
    const h = { ...host, marks: (host.marks ?? 0) - cost }
    saveHost(h)
    setHost(h)
    const owned = { ...(forge.owned ?? {}), [sig.profileId]: { ...o, talent: cur + 1 } }
    const next = { ...forge, owned }
    saveForge(next)
    setForge(next)
    sfx.ensure()
    sfx.play('unlock')
  }

  const unlocked = tiersUnlocked(meta)

  const deploy = () => {
    sfx.ensure() // first user gesture of the run — unlock audio
    sfx.play('buy')
    const er = expeditionResearch(loadForge(Date.now()))
    setCfg({
      tier,
      seed: Math.floor(Date.now() / 1000) >>> 0,
      doctrine,
      squad,
      anchors,
      gateBonus: 30 * (meta.workshop.plating ?? 0),
      salvageMult: 1 + 0.12 * (meta.workshop.scanner ?? 0),
      gateMult: er.gateMult,
      trackCostMult: er.trackCostMult,
    })
    setHud(null)
    setAfter(null)
    setPhase('run')
  }

  const onEnd = useCallback((r: RunResult) => {
    // spoils: marks to the host, milestone ores to the forge stockpile
    const h = loadHost()
    h.marks = (h.marks ?? 0) + r.marks
    saveHost(h)
    setHost(h)

    // the fielded creatures LEVEL from the hold — xp travels with the creature,
    // not the slot, so it carries across swaps and into the Crucible (slice 5)
    const forge = loadForge(Date.now())
    const gain = guardXpGain(r.wave, r.tier)
    const owned = { ...(forge.owned ?? {}) }
    const levelUps: AfterState['levelUps'] = []
    for (const sig of forge.sigils) {
      const pid = sig.profileId
      if (!pid) continue
      const cur = owned[pid] ?? { profileId: pid, level: 1, xp: 0, vigor: 0, edge: 0, talent: 0 }
      const xp = cur.xp + gain
      const level = guardLevelForXp(xp)
      if (level > cur.level) levelUps.push({ name: profileById(pid).name, level })
      owned[pid] = { ...cur, xp, level }
    }
    forge.owned = owned

    let oreDrop: AfterState['oreDrop'] = null
    if (r.milestones > 0) {
      const aetherite = 4 * r.milestones * r.tier
      const manapearl = 2 * r.milestones * r.tier
      forge.stock.aetherite = (forge.stock.aetherite ?? 0) + aetherite
      forge.stock.manapearl = (forge.stock.manapearl ?? 0) + manapearl
      oreDrop = { aetherite, manapearl }
    }
    saveForge(forge)
    setForge(forge)

    const m = loadExpedMeta()
    const newRecord = recordRun(m, r)
    saveExpedMeta(m)
    setMeta(m)
    setAfter({ result: r, newRecord, oreDrop, levelUps })
    if (levelUps.length) sfx.play('levelUp')
    setPhase('after')
  }, [])

  const buyWorkshop = (id: string) => {
    const lv = meta.workshop[id] ?? 0
    const cost = workshopCost(lv)
    if ((host.marks ?? 0) < cost) return
    const h = { ...host, marks: (host.marks ?? 0) - cost }
    saveHost(h)
    setHost(h)
    const m = { ...meta, workshop: { ...meta.workshop, [id]: lv + 1 } }
    saveExpedMeta(m)
    setMeta(m)
  }

  const r = after?.result

  // localStorage feeds the squad/meta — render nothing until the client owns the page
  if (!mounted) return <div className="min-h-screen bg-[#070a10]" />

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-300 font-mono">
      <div className="max-w-[1200px] mx-auto px-4 py-6">
        <header className="flex items-baseline justify-between mb-4">
          <div>
            <h1 className="text-violet-300 text-xl tracking-[0.3em]">EXPEDITIONS</h1>
            <p className="text-slate-500 text-xs mt-1">
              hold the breach · there is no winning · you survive longer
            </p>
          </div>
          <div className="flex gap-5 text-sm items-center">
            <span className="text-amber-300" title="marks — the workshop's coin">
              ✶ <b className="tabular-nums">{(host.marks ?? 0).toLocaleString()}</b>
            </span>
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
            <Emblem kind="crucible" href="/nolmir/crucible" label="CRUCIBLE" />
            <Emblem kind="starforge" href="/nolmir/starforge" label="STARFORGE" />
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* the breach */}
          <div className="overflow-x-auto flex justify-center">
            <Breach
              placing={phase === 'prep'}
              anchors={anchors}
              onPlace={(x, y) => {
                sfx.ensure()
                sfx.play('click')
                setAnchors((prev) => {
                  const next = [...prev]
                  next[placeIdx] = { x, y }
                  return next
                })
                setPlaceIdx((i) => (i + 1) % 3)
              }}
              cfg={phase === 'run' ? cfg : null}
              onHud={setHud}
              onEnd={onEnd}
            />
          </div>

          {/* the panel */}
          <div className="flex-1 min-w-[18rem] space-y-3 text-sm">
            {phase === 'prep' && (
              <>
                <section className="rounded-lg border border-slate-800 bg-[#0b101c]/80 p-3">
                  <h2 className="text-slate-500 text-xs tracking-widest mb-2">THE SQUAD</h2>
                  <ul className="space-y-1">
                    {squad.map((g, i) => (
                      <li key={i} className="flex items-baseline gap-2">
                        <span className="text-amber-300">{g.glyph}</span>
                        <span className="text-slate-200 w-14">{g.name}</span>
                        <span className="text-violet-300/80 text-xs tabular-nums w-8">lv{g.level}</span>
                        <span className="text-slate-500 text-xs">
                          {g.role} · v{g.hp} e{g.atk} r{g.range}
                        </span>
                        <button
                          onClick={() => setPlaceIdx(i)}
                          className={`ml-auto text-xs px-2 rounded border ${
                            placeIdx === i
                              ? 'border-amber-400 text-amber-300'
                              : 'border-slate-800 text-slate-500 hover:border-slate-600'
                          }`}
                        >
                          place
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-slate-600 text-xs mt-2">
                    click the arena to set {squad[placeIdx]?.name ?? 'a guard'}&apos;s post — the trinity holds the core, ranges go dark once the tide comes
                  </p>
                </section>

                <section className="rounded-lg border border-slate-800 bg-[#0b101c]/80 p-3">
                  <h2 className="text-slate-500 text-xs tracking-widest mb-2">
                    YOUR ROSTER — equip slot {placeIdx + 1}
                  </h2>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(forge?.collection ?? []).map((id) => {
                      const p = profileById(id)
                      const equippedHere = forge?.sigils[placeIdx]?.profileId === id
                      const equippedElsewhere = forge?.sigils.some((s, i) => i !== placeIdx && s.profileId === id)
                      return (
                        <button
                          key={id}
                          onClick={() => equipProfile(placeIdx, id)}
                          className={`text-left px-2 py-1 rounded border text-xs ${
                            equippedHere
                              ? 'border-amber-400 text-amber-200 bg-amber-950/20'
                              : 'border-slate-800 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          <span className="text-amber-300 mr-1">{p.glyph}</span>
                          <b>{p.name}</b>
                          <span className="text-slate-600"> · t{p.tier}</span>
                          <div className="text-slate-600 leading-tight">
                            {ROLE_LABEL[p.role]}
                            {equippedElsewhere ? ' · equipped' : ''}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {forge &&
                    (() => {
                      const sig = forge.sigils[placeIdx]
                      const o = ownedFor(forge, sig.profileId)
                      const prof = profileById(sig.profileId ?? 'lancer')
                      const skills = profileSkills(prof.id)
                      const tal = o.talent ?? 0
                      const cost = marksTalentCost(o)
                      const prog = guardProgress(o.xp)
                      const levelReq = talentLevelReq(tal + 1)
                      const levelGated = tal < TALENT_CAP && o.level < levelReq
                      const can = (host.marks ?? 0) >= cost && tal < TALENT_CAP && !levelGated
                      return (
                        <div className="mt-3 border-t border-slate-800 pt-2">
                          {/* the equipped creature's level — grows from holding breaches */}
                          <div className="flex items-baseline justify-between mb-0.5">
                            <span className="text-violet-300 text-xs tracking-widest">LEVEL {prog.level}</span>
                            <span className="text-slate-600 text-[10px] tabular-nums">{prog.into}/{prog.span} xp</span>
                          </div>
                          <div className="h-1 bg-slate-900 rounded mb-2">
                            <div className="h-1 rounded bg-violet-400/80" style={{ width: `${(100 * prog.into) / prog.span}%` }} />
                          </div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-slate-500 text-xs tracking-widest">
                              {prof.name.toUpperCase()} · TALENT {tal}/{TALENT_CAP}
                            </span>
                            <button
                              onClick={() => upgradeTalent(placeIdx)}
                              disabled={!can}
                              title={levelGated ? `needs level ${levelReq}` : ''}
                              className={`text-xs px-2 py-0.5 rounded border tabular-nums ${
                                can
                                  ? 'border-amber-700 text-amber-300 hover:bg-amber-950/30'
                                  : 'border-slate-900 text-slate-700 cursor-not-allowed'
                              }`}
                            >
                              {tal >= TALENT_CAP ? 'maxed' : levelGated ? `lv ${levelReq}` : `✶${cost}`}
                            </button>
                          </div>
                          <ul className="space-y-0.5 text-xs">
                            {skills.map((sk, i) => {
                              const unlocked = i < tal
                              const reqFor = talentLevelReq(i + 1)
                              return (
                                <li key={i} className={unlocked ? 'text-violet-200' : 'text-slate-600'}>
                                  <span className="mr-1">{unlocked ? '◆' : '◇'}</span>
                                  <b>{sk.name}</b> <span className="text-slate-600">— {sk.line}</span>
                                  {!unlocked && o.level < reqFor && (
                                    <span className="text-slate-700"> · lv {reqFor}</span>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )
                    })()}
                  <p className="text-slate-600 text-xs mt-2">
                    pick a slot above (place), then equip a profile + spend marks on talent — combinations beat raw power
                  </p>
                </section>

                <section className="rounded-lg border border-slate-800 bg-[#0b101c]/80 p-3">
                  <h2 className="text-slate-500 text-xs tracking-widest mb-2">DOCTRINE</h2>
                  <div className="space-y-1">
                    {DOCTRINES.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setDoctrine(d.id)}
                        className={`block w-full text-left px-2 py-1 rounded border text-xs ${
                          doctrine === d.id
                            ? 'border-violet-500 text-violet-200 bg-violet-950/30'
                            : 'border-slate-800 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <b>{d.name}</b> — {d.line}
                      </button>
                    ))}
                  </div>
                  <p className="text-slate-600 text-xs mt-2">
                    salvage spends itself — the squad manages the hold. your hand stays on this side of the gate.
                  </p>
                </section>

                <section className="rounded-lg border border-slate-800 bg-[#0b101c]/80 p-3">
                  <h2 className="text-slate-500 text-xs tracking-widest mb-2">THE BREACH</h2>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: unlocked }, (_, i) => i + 1).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTier(t)}
                        className={`px-2 py-1 rounded border text-xs ${
                          tier === t
                            ? 'border-violet-500 text-violet-200'
                            : 'border-slate-800 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        breach {t}
                        <span className="text-slate-600 ml-1">best {bestWave(meta, t)}</span>
                      </button>
                    ))}
                    <span className="px-2 py-1 text-xs text-slate-700 border border-slate-900 rounded">
                      hold wave {TIER_UNLOCK_WAVE} to descend
                    </span>
                  </div>
                </section>

                <button
                  onClick={deploy}
                  className="w-full py-2 rounded border text-sm tracking-widest border-violet-500 text-violet-200 hover:bg-violet-950/40"
                >
                  OPEN THE GATE
                </button>
              </>
            )}

            {phase === 'run' && hud && (
              <>
                <section className="rounded-lg border border-slate-800 bg-[#0b101c]/80 p-3 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-violet-300 text-lg">
                      wave <b className="tabular-nums">{hud.wave}</b>
                    </span>
                    <span className="text-xs text-slate-500">{hud.phase === 'breaking' ? 'the lull' : 'the tide'}</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>the core</span>
                      <span className="tabular-nums">
                        {hud.gate}/{hud.gateMax}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-900 rounded">
                      <div
                        className={`h-1.5 rounded ${hud.gate / hud.gateMax > 0.35 ? 'bg-cyan-400' : 'bg-red-400'}`}
                        style={{ width: `${(100 * hud.gate) / hud.gateMax}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-amber-300">
                      salvage <b className="tabular-nums">{hud.salvage}</b>
                    </span>
                    <span className="text-slate-400">
                      fallen <b className="tabular-nums">{hud.kills}</b>
                    </span>
                    <span className="text-slate-500 tabular-nums">
                      A{hud.tracks[0]} · B{hud.tracks[1]} · L{hud.tracks[2]}
                    </span>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-800 bg-[#0b101c]/80 p-3">
                  <h2 className="text-slate-500 text-xs tracking-widest mb-2">THE LINE</h2>
                  <ul className="space-y-1 text-xs">
                    {hud.guards.map((g) => (
                      <li key={g.name} className="flex items-center gap-2">
                        <span className={`w-12 ${g.alive ? 'text-amber-300' : 'text-slate-600 line-through'}`}>{g.name}</span>
                        <div className="flex-1 h-1 bg-slate-900 rounded">
                          <div className="h-1 rounded bg-green-400" style={{ width: `${(100 * g.hp) / g.maxHp}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                {hud.feed.length > 0 && (
                  <section className="rounded-lg border border-slate-800 bg-[#0b101c]/80 p-3">
                    <ul className="space-y-1 text-xs text-slate-500">
                      {hud.feed.map((f, i) => (
                        <li key={i} className={i === 0 ? 'text-slate-300' : ''}>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            {phase === 'after' && r && (
              <>
                <section className="rounded-lg border border-violet-900/60 bg-[#0b101c]/90 p-4 space-y-2">
                  <h2 className="text-violet-300 text-xs tracking-[0.25em]">THE WASH TOOK THE BREACH</h2>
                  <p className="text-slate-300">
                    breach {r.tier} · held to wave <b className="text-slate-100">{r.wave}</b>
                    {after?.newRecord && <span className="text-amber-300 ml-2">— a deeper hold than any before</span>}
                  </p>
                  <p className="text-slate-500 text-xs">
                    {r.gateFell ? 'the core filled — the Tsunamizilla rose and washed the board' : 'the breach reached its end'} ·{' '}
                    {r.kills} of the flood undone
                  </p>
                  <div className="flex gap-4 text-sm pt-1">
                    <span className="text-amber-300">
                      +<b className="tabular-nums">{r.marks}</b> marks
                    </span>
                    <span className="text-violet-300 text-xs">
                      +<b className="tabular-nums">{guardXpGain(r.wave, r.tier)}</b> xp each
                    </span>
                    {after?.oreDrop && (
                      <span className="text-sky-300 text-xs">
                        +{after.oreDrop.aetherite} aetherite · +{after.oreDrop.manapearl} manapearl
                      </span>
                    )}
                  </div>
                  {after && after.levelUps.length > 0 && (
                    <p className="text-violet-200 text-xs pt-1">
                      {after.levelUps.map((l) => `${l.name} → lv ${l.level}`).join(' · ')}
                    </p>
                  )}
                </section>

                <button
                  onClick={() => {
                    setPhase('prep')
                    setHud(null)
                  }}
                  className="w-full py-2 rounded border border-slate-700 text-slate-300 hover:border-violet-500 hover:text-violet-200 text-sm tracking-widest"
                >
                  BACK TO THE STAGING GROUND
                </button>
              </>
            )}

            {/* workshop + records — always visible below the fold */}
            {phase !== 'run' && (
              <>
                <section className="rounded-lg border border-slate-800 bg-[#0b101c]/80 p-3">
                  <h2 className="text-slate-500 text-xs tracking-widest mb-2">THE WORKSHOP</h2>
                  <ul className="space-y-1.5 text-xs">
                    {WORKSHOP.map((w) => {
                      const lv = meta.workshop[w.id] ?? 0
                      const cost = workshopCost(lv)
                      const can = (host.marks ?? 0) >= cost
                      return (
                        <li key={w.id} className="flex items-center gap-2">
                          <span className="text-slate-300 w-36">{w.name}</span>
                          <span className="text-slate-600 flex-1">
                            lv {lv} — {w.line}
                          </span>
                          <button
                            onClick={() => buyWorkshop(w.id)}
                            disabled={!can}
                            className={`px-2 py-0.5 rounded border tabular-nums ${
                              can
                                ? 'border-amber-700 text-amber-300 hover:bg-amber-950/30'
                                : 'border-slate-900 text-slate-700 cursor-not-allowed'
                            }`}
                          >
                            ✶{cost}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>

                {meta.records.length > 0 && (
                  <section className="rounded-lg border border-slate-800 bg-[#0b101c]/80 p-3">
                    <h2 className="text-slate-500 text-xs tracking-widest mb-2">DEEPEST HOLDS</h2>
                    <ul className="space-y-1 text-xs">
                      {meta.records.map((rec) => (
                        <li key={rec.tier} className="flex gap-2 items-baseline">
                          <span className="text-violet-300 w-20">breach {rec.tier}</span>
                          <span className="text-slate-200">wave {rec.wave}</span>
                          <span className="text-slate-600">
                            {rec.roster.join(' · ')} — {rec.doctrine}
                          </span>
                          <span className="text-slate-700 ml-auto">{new Date(rec.at).toLocaleDateString()}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        </div>

        <footer className="mt-6 text-xs text-slate-700 text-center space-y-1">
          <div>one core · three posts · the flood from every side — wave after wave until the wash takes it</div>
          <div>an Athernyx story · what took them is not named here</div>
        </footer>
      </div>
    </div>
  )
}
