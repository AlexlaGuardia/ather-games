'use client'

// EXPEDITIONS — send your guards through the gate to a drowned node and
// hold the breach against the tide. There is no winning. You survive longer.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Breach, { HudSnapshot } from '../components/Breach'
import Emblem from '../components/Emblem'
import Panel from '../components/Panel'
import { useFitScale } from '../components/useFitScale'
import SiteNav from '../../_components/SiteNav'
import { nolmirCrumbs } from '../lib/nav'

const VIOLET = '#a78bfa'
const BREACH_PX = 640 // the arena's natural square size (see Breach.tsx)
import { useGainFx, FloatLayer, flashCls, GainFxStyles } from '../components/gainfx'
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
  settleGarrison,
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
  const marksFx = useGainFx()
  const [tier, setTier] = useState(1)
  const [anchors, setAnchors] = useState(defaultAnchors())
  const [placeIdx, setPlaceIdx] = useState(0)
  const [overlay, setOverlay] = useState<null | 'setup' | 'workshop'>(null)
  const fit = useFitScale(BREACH_PX, BREACH_PX)
  const [cfg, setCfg] = useState<RunConfig | null>(null)
  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [after, setAfter] = useState<AfterState | null>(null)
  const [mounted, setMounted] = useState(false)
  const [muted, setMuted] = useState(false)
  const toggleMute = useCallback(() => {
    sfx.ensure()
    const m = !sfx.isMuted()
    sfx.setMuted(m)
    setMuted(m)
    if (!m) sfx.play('click')
  }, [])
  const [awayMarks, setAwayMarks] = useState(0)

  useEffect(() => {
    const now = Date.now()
    const h = loadHost()
    // collect the garrison's idle salvage banked while away (idempotent by tick)
    const g = settleGarrison(loadExpedMeta(), now)
    if (g.marks > 0) {
      h.marks = (h.marks ?? 0) + g.marks
      saveHost(h)
      setAwayMarks(g.marks)
    }
    saveExpedMeta(g.meta)
    setHost(h)
    setMeta(g.meta)
    setForge(loadForge(now))
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
    marksFx.push(-cost, '✶')
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
    if (r.marks > 0) marksFx.push(r.marks, '✶')

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
    marksFx.push(-cost, '✶')
    const m = { ...meta, workshop: { ...meta.workshop, [id]: lv + 1 } }
    saveExpedMeta(m)
    setMeta(m)
  }

  const r = after?.result

  // localStorage feeds the squad/meta — render nothing until the client owns the page
  if (!mounted) return <div className="min-h-screen bg-[#070a10]" />

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[#070a10] text-slate-300 font-mono">
      <SiteNav gameId="nolmir" wall={1} crumbs={nolmirCrumbs('Expeditions')} soundOn={!muted} onToggleSound={toggleMute} />

      {/* header — pinned, compact */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <h1 className="text-violet-300 text-lg sm:text-xl tracking-[0.3em]">EXPEDITIONS</h1>
          <p className="text-slate-500 text-[11px] mt-0.5 hidden sm:block">hold the breach · there is no winning · you survive longer</p>
        </div>
        <div className="flex gap-3 sm:gap-5 text-sm items-center">
          <span className="text-amber-300 relative" title="marks — the workshop's coin">
            ✶ <b className={`tabular-nums inline-block ${flashCls(marksFx.flash)}`}>{(host.marks ?? 0).toLocaleString()}</b>
            <FloatLayer floaters={marksFx.floaters} />
            {awayMarks > 0 && (
              <span className="ml-1.5 text-[11px] text-emerald-300/90" title="salvage the garrison gathered while you were away">+{awayMarks.toLocaleString()} held</span>
            )}
          </span>
          <div className="hidden sm:flex gap-3 items-center">
            <Emblem kind="deck" href="/nolmir" label="DECK" />
            <Emblem kind="crucible" href="/nolmir/crucible" label="CRUCIBLE" />
            <Emblem kind="starforge" href="/nolmir/starforge" label="STARFORGE" />
          </div>
        </div>
      </header>

      {/* HERO: the arena fills the space, scaled to fit; controls dock at the bottom */}
      <main className="flex-1 min-h-0 relative">
        <div ref={fit.ref} className="absolute inset-0 grid place-items-center overflow-hidden px-2 pb-[96px]">
          <div style={{ width: BREACH_PX, height: BREACH_PX, transform: `scale(${fit.scale})` }} className="origin-center shrink-0">
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
        </div>

        {/* control dock — over the arena, never scrolls the page */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="mx-auto max-w-3xl rounded-lg border border-violet-900/50 bg-[#0b101c]/92 backdrop-blur px-3 py-2">
            {phase === 'prep' && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1.5">
                  {squad.map((g, i) => (
                    <button
                      key={i}
                      onClick={() => setPlaceIdx(i)}
                      title={`${g.name} lv${g.level} · click, then click the arena to set its post`}
                      className={`flex items-center gap-1 px-2 py-1 rounded border text-xs ${
                        placeIdx === i ? 'border-amber-400 text-amber-200 bg-amber-950/20' : 'border-slate-800 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-amber-300">{g.glyph}</span>
                      <span className="hidden sm:inline">{g.name}</span>
                      <span className="text-violet-300/70 tabular-nums">lv{g.level}</span>
                    </button>
                  ))}
                </div>
                <span className="text-slate-600 text-[10px] hidden md:inline">click a post, then the arena</span>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={() => setOverlay('setup')} className="px-2.5 py-1 rounded border border-slate-700 text-slate-300 text-xs hover:border-violet-500 hover:text-violet-200">⚙ staging</button>
                  <button onClick={() => setOverlay('workshop')} className="px-2.5 py-1 rounded border border-slate-700 text-slate-300 text-xs hover:border-amber-600 hover:text-amber-200">⚒ workshop</button>
                  <button onClick={deploy} className="px-3 py-1 rounded border border-violet-500 text-violet-100 text-xs tracking-widest hover:bg-violet-950/40">OPEN THE GATE</button>
                </div>
              </div>
            )}

            {phase === 'run' && hud && (
              <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs">
                <span className="text-violet-300">wave <b className="tabular-nums">{hud.wave}</b></span>
                <span className="text-slate-500">{hud.phase === 'breaking' ? 'the lull' : 'the tide'}</span>
                <div className="flex-1 min-w-[130px]">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                    <span>the core</span>
                    <span className="tabular-nums">{hud.gate}/{hud.gateMax}</span>
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded">
                    <div className={`h-1.5 rounded ${hud.gate / hud.gateMax > 0.35 ? 'bg-cyan-400' : 'bg-red-400'}`} style={{ width: `${(100 * hud.gate) / hud.gateMax}%` }} />
                  </div>
                </div>
                <span className="text-amber-300">salvage <b className="tabular-nums">{hud.salvage}</b></span>
                <span className="text-slate-400">fallen <b className="tabular-nums">{hud.kills}</b></span>
                <div className="flex gap-2">
                  {hud.guards.map((g) => (
                    <span key={g.name} title={g.name} className="flex items-center gap-1">
                      <span className={`text-[10px] ${g.alive ? 'text-amber-300' : 'text-slate-600 line-through'}`}>{g.name}</span>
                      <span className="w-8 h-1 bg-slate-900 rounded inline-block align-middle">
                        <span className="block h-1 rounded bg-green-400" style={{ width: `${(100 * g.hp) / g.maxHp}%` }} />
                      </span>
                    </span>
                  ))}
                </div>
                {hud.feed[0] && <span className="text-slate-500 w-full text-[10px] truncate">{hud.feed[0]}</span>}
              </div>
            )}

            {phase === 'after' && (
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-500">the breach washed — read the salvage</span>
                <button onClick={() => { setPhase('prep'); setHud(null); setAfter(null) }} className="px-3 py-1 rounded border border-slate-700 text-slate-300 tracking-widest hover:border-violet-500 hover:text-violet-200">BACK TO STAGING</button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* STAGING overlay — roster + talents + doctrine + breach tier */}
      {overlay === 'setup' && phase === 'prep' && (
        <Panel title="STAGING GROUND" accent={VIOLET} wide onClose={() => setOverlay(null)}>
          <div className="space-y-5 text-sm">
            <div>
              <div className="text-slate-500 text-xs tracking-widest mb-2">ROSTER — equip slot {placeIdx + 1}</div>
              <div className="flex gap-1.5 mb-2">
                {squad.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setPlaceIdx(i)}
                    className={`px-2 py-1 rounded border text-xs ${placeIdx === i ? 'border-amber-400 text-amber-200 bg-amber-950/20' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}
                  >
                    slot {i + 1} · {g.name}
                  </button>
                ))}
              </div>
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
                        equippedHere ? 'border-amber-400 text-amber-200 bg-amber-950/20' : 'border-slate-800 text-slate-400 hover:border-slate-600'
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
                      <div className="flex items-baseline justify-between mb-0.5">
                        <span className="text-violet-300 text-xs tracking-widest">LEVEL {prog.level}</span>
                        <span className="text-slate-600 text-[10px] tabular-nums">{prog.into}/{prog.span} xp</span>
                      </div>
                      <div className="h-1 bg-slate-900 rounded mb-2">
                        <div className="h-1 rounded bg-violet-400/80" style={{ width: `${(100 * prog.into) / prog.span}%` }} />
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-500 text-xs tracking-widest">{prof.name.toUpperCase()} · TALENT {tal}/{TALENT_CAP}</span>
                        <button
                          onClick={() => upgradeTalent(placeIdx)}
                          disabled={!can}
                          title={levelGated ? `needs level ${levelReq}` : ''}
                          className={`text-xs px-2 py-0.5 rounded border tabular-nums ${
                            can ? 'border-amber-700 text-amber-300 hover:bg-amber-950/30' : 'border-slate-900 text-slate-700 cursor-not-allowed'
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
                              {!unlocked && o.level < reqFor && <span className="text-slate-700"> · lv {reqFor}</span>}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })()}
            </div>

            <div>
              <div className="text-slate-500 text-xs tracking-widest mb-2">DOCTRINE</div>
              <div className="space-y-1">
                {DOCTRINES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDoctrine(d.id)}
                    className={`block w-full text-left px-2 py-1 rounded border text-xs ${
                      doctrine === d.id ? 'border-violet-500 text-violet-200 bg-violet-950/30' : 'border-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <b>{d.name}</b> — {d.line}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-slate-500 text-xs tracking-widest mb-2">THE BREACH</div>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: unlocked }, (_, i) => i + 1).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    className={`px-2 py-1 rounded border text-xs ${tier === t ? 'border-violet-500 text-violet-200' : 'border-slate-800 text-slate-400 hover:border-slate-600'}`}
                  >
                    breach {t}
                    <span className="text-slate-600 ml-1">best {bestWave(meta, t)}</span>
                  </button>
                ))}
                <span className="px-2 py-1 text-xs text-slate-700 border border-slate-900 rounded">hold wave {TIER_UNLOCK_WAVE} to descend</span>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* WORKSHOP overlay — upgrades + records */}
      {overlay === 'workshop' && (
        <Panel title="THE WORKSHOP" accent={VIOLET} onClose={() => setOverlay(null)}>
          <ul className="space-y-1.5 text-xs">
            {WORKSHOP.map((w) => {
              const lv = meta.workshop[w.id] ?? 0
              const cost = workshopCost(lv)
              const can = (host.marks ?? 0) >= cost
              return (
                <li key={w.id} className="flex items-center gap-2">
                  <span className="text-slate-300 w-36">{w.name}</span>
                  <span className="text-slate-600 flex-1">lv {lv} — {w.line}</span>
                  <button
                    onClick={() => buyWorkshop(w.id)}
                    disabled={!can}
                    className={`px-2 py-0.5 rounded border tabular-nums ${can ? 'border-amber-700 text-amber-300 hover:bg-amber-950/30' : 'border-slate-900 text-slate-700 cursor-not-allowed'}`}
                  >
                    ✶{cost}
                  </button>
                </li>
              )
            })}
          </ul>
          {meta.records.length > 0 && (
            <div className="mt-4 border-t border-slate-800 pt-3">
              <div className="text-slate-500 text-xs tracking-widest mb-2">DEEPEST HOLDS</div>
              <ul className="space-y-1 text-xs">
                {meta.records.map((rec) => (
                  <li key={rec.tier} className="flex gap-2 items-baseline">
                    <span className="text-violet-300 w-20">breach {rec.tier}</span>
                    <span className="text-slate-200">wave {rec.wave}</span>
                    <span className="text-slate-600 truncate">{rec.roster.join(' · ')} — {rec.doctrine}</span>
                    <span className="text-slate-700 ml-auto shrink-0">{new Date(rec.at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}

      {/* RESULTS overlay — the after-run salvage */}
      {phase === 'after' && r && (
        <Panel title="THE WASH TOOK THE BREACH" accent={VIOLET} onClose={() => { setPhase('prep'); setHud(null); setAfter(null) }}>
          <p className="text-slate-300">
            breach {r.tier} · held to wave <b className="text-slate-100">{r.wave}</b>
            {after?.newRecord && <span className="text-amber-300 ml-2">— a deeper hold than any before</span>}
          </p>
          <p className="text-slate-500 text-xs mt-1">
            {r.gateFell ? 'the core filled — the Tsunamizilla rose and washed the board' : 'the breach reached its end'} · {r.kills} of the flood undone
          </p>
          <div className="flex gap-4 text-sm pt-2">
            <span className="text-amber-300">+<b className="tabular-nums">{r.marks}</b> marks</span>
            <span className="text-violet-300 text-xs">+<b className="tabular-nums">{guardXpGain(r.wave, r.tier)}</b> xp each</span>
            {after?.oreDrop && (
              <span className="text-sky-300 text-xs">+{after.oreDrop.aetherite} aetherite · +{after.oreDrop.manapearl} manapearl</span>
            )}
          </div>
          {after && after.levelUps.length > 0 && (
            <p className="text-violet-200 text-xs pt-1">{after.levelUps.map((l) => `${l.name} → lv ${l.level}`).join(' · ')}</p>
          )}
          <button
            onClick={() => { setPhase('prep'); setHud(null); setAfter(null) }}
            className="mt-4 w-full py-2 rounded border border-slate-700 text-slate-300 hover:border-violet-500 hover:text-violet-200 text-sm tracking-widest"
          >
            BACK TO THE STAGING GROUND
          </button>
        </Panel>
      )}

      <GainFxStyles />
    </div>
  )
}
