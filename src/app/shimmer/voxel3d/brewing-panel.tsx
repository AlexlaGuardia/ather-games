// The brewing panel — the four alchemy stations, since the brewing became the plot's event.
//
// ── ★ TWO FACES, ONE RECORD (2026-09-21, Alex: "started at the cauldron but triggers other
// workstations across the map… any of them can complete the required step") ──────────────────
// THE POT: no brewing → the potion list (level gate, ingredients from bag/chests/bank, the road
// each one walks). Start → the ingredients go in and the record opens. With a brewing → its road
// with the live step, [light] when the road is walked (channels the potion's mana), the pot's own
// run, [pour] → bottles + XP, [tip out] gives the ingredients back before lighting.
// A ROAD STATION (mortar / still / bowl): running a step → its progress card; idle → every brewing
// in reach waiting on THIS station's step, oldest first, [take]. Nothing waiting → say where the
// road starts. No recipe list: a station has no recipes of its own any more, it has hands.
//
// ★ THE PANEL DOES NOT TOUCH THE BAG — `ops` is the host's (the `AlchemyPanel` rule). And it
// does not own the record: `brewings` is the keeper's, the host saves it; the panel edits through
// `brewing.ts`'s pure functions and calls `onBrewings` so the host marks it dirty.
//
// ★ XP AT THE POUR, MANA AT THE LIGHT. The ledger pays every step's slice to the hand that ran it
// when the bottle is in hand (`pour`); solo, that is the keeper, and the total is the potion's
// `xpGrant` exactly. Mana is channelled when the pot is lit — a keeper short of it is told to wait.
import { useEffect, useState } from 'react'
import { POTION_DEFS, type PotionDef } from '../engine/alchemy'
import { addSkillXP, getMilestone, type SkillSet } from '../engine/skills'
import { ALCHEMY_STATIONS, routeOf, jobOf, JOB_LINE, type AlchemyStationId } from './alchemy-chain'
import { cauldronMenu } from './brew'
import {
  startBrewing, beginStep, settle, light, pour, pourReady, brewProgress, runProgress, stepMs, brewMs,
  openFor, runningAt, nextStation, roadLine, abandonRefund, brewingKey, stationKeyOf,
  type Brewing, type Brewings,
} from './brewing'
import type { OpenStation } from './VoxelWorld'
import type { AlchemyOps } from './alchemy-panel'
import { PanelFrame } from './panel-frame'

export function BrewingPanel({ st, space, keeper, brewings, skills, mana, ops, onBrewings, onChange, onLevel, onSay, onClose }: {
  st: OpenStation & { kind: AlchemyStationId }
  space: string
  keeper: { id: string; name: string }
  brewings: React.RefObject<Brewings>
  skills: React.RefObject<SkillSet>
  mana: React.RefObject<{ cur: number; max: number; regen: number }>
  ops: AlchemyOps
  /** The record changed — save it. */
  onBrewings: () => void
  onChange: () => void
  onLevel: (line: string) => void
  onSay: (t: string) => void
  onClose: () => void
}) {
  const [, setBeat] = useState(0)
  useEffect(() => {
    const h = setInterval(() => setBeat(b => b + 1), 500)
    return () => clearInterval(h)
  }, [])

  const def = ALCHEMY_STATIONS[st.kind]
  const now = Date.now()
  const level = skills.current.alchemy.level
  const myKey = stationKeyOf(st.x, st.y, st.z)
  const all = brewings.current

  // ★ SETTLE ON EVERY READ. A step finishes on the clock whether anyone watched the station or
  // not; the first panel to look writes it down. Idempotent, so looking twice costs nothing.
  let settledAny = false
  for (const k of Object.keys(all)) {
    const s = settle(all[k], now)
    if (s !== all[k]) { all[k] = s; settledAny = true }
  }
  if (settledAny) onBrewings()

  const write = (b: Brewing) => { all[brewingKey(b.at!)] = b; onBrewings() }
  const drop = (b: Brewing) => { delete all[brewingKey(b.at!)]; onBrewings() }

  // ── the pot ────────────────────────────────────────────────────────────────────────────────
  if (st.kind === 'cauldron') {
    const at = { space, x: st.x, y: st.y, z: st.z }
    const here = all[brewingKey(at)]

    const doStart = (d: PotionDef) => {
      if (level < d.minAlchemyLevel || here) return
      if (d.recipe.some(r => ops.have(r.itemId) < r.count)) return
      const b = startBrewing(d.id, keeper, now, at)
      if (!b) return
      for (const r of d.recipe) ops.spend(r.itemId, r.count)
      b.hands[keeper.id].ingredients = d.recipe.reduce((n, r) => n + r.count, 0)
      write(b)
      st.touchFeeds()
      onChange()
      const first = nextStation(b)
      onSay(first
        ? `the ${d.name.toLowerCase()} is in the pot — it wants a ${ALCHEMY_STATIONS[first].name.toLowerCase()} next`
        : `the ${d.name.toLowerCase()} is in the pot — light it`)
    }
    const doLight = () => {
      if (!here) return
      const d = POTION_DEFS[here.potionId]
      if (mana.current.cur < d.manaCost) { onSay(`not enough mana to light it — ${d.manaCost} · wait`); return }
      const lit = light(here, now)
      if (!lit) return
      mana.current.cur = Math.max(0, mana.current.cur - d.manaCost)
      write(lit)
      st.setLit?.(true)
      onChange()
      onSay(`the cauldron is lit — ${Math.round(brewMs(lit) / 1000)}s to the pour`)
    }
    const doPour = () => {
      if (!here || !pourReady(here, now)) return
      const p = pour(here)
      if (!p) return
      const d = POTION_DEFS[here.potionId]
      const mine = p.bottles[keeper.id] ?? 0
      const lost = mine > 0 ? ops.payout(here.potionId, mine) : 0
      if (mine > 0 && lost >= mine) { onSay('nowhere to put it — empty your bag, or set a chest beside it'); return }
      drop(here)
      st.setLit?.(false)
      st.touchFeeds()
      const xp = p.xp[keeper.id] ?? 0
      const res = xp > 0 ? addSkillXP(skills.current.alchemy, xp) : { leveled: false as const, newLevel: 0 }
      if (res.leveled) onLevel(`alchemy ${res.newLevel}${getMilestone(res.newLevel) ? ' — ' + getMilestone(res.newLevel) : ''}`)
      onChange()
      onSay(lost > 0
        ? `poured — ${mine - lost}× ${d.name.toLowerCase()}, ${lost} would not fit · ${xp} alchemy xp`
        : `poured — ${mine}× ${d.name.toLowerCase()} · ${xp} alchemy xp`)
    }
    const doTipOut = () => {
      if (!here || here.lit) return
      const back = abandonRefund(here)
      for (const r of back) ops.payout(r.itemId, r.count)
      drop(here)
      st.touchFeeds()
      onChange()
      onSay(`tipped out — ${back.map(r => `${r.count}× ${ops.label(r.itemId).toLowerCase()}`).join(', ')} back in the bag`)
    }

    const menu = cauldronMenu(level)
    return (
      <PanelFrame width="w-[480px]" onClose={onClose} dataPanel="brewing">
        <div className="flex items-baseline justify-between mb-3 pr-6">
          <span className="text-white/95 font-semibold tracking-[.18em] uppercase">{def.name}</span>
          <span className="text-white/35">alchemy {level} · mana {Math.floor(mana.current.cur)}</span>
        </div>

        {here ? (() => {
          const d = POTION_DEFS[here.potionId]
          const want = nextStation(here)
          const ready = pourReady(here, now)
          const prog = here.lit ? brewProgress(here, now) : runProgress(here, now)
          return (
            <div className="mb-4 rounded border border-amber-200/25 bg-amber-100/[0.03] px-3 py-2.5">
              <div className="flex justify-between items-baseline">
                <span className="text-amber-100/90">{d.name}</span>
                <span className="text-white/45">{jobOf(here.potionId) ? JOB_LINE[jobOf(here.potionId)!] : ''}</span>
              </div>
              <div className="mt-1 text-white/45">{roadLine(here)}</div>
              {(here.run || here.lit) && (
                <div className="mt-2 h-1 rounded bg-white/10 overflow-hidden">
                  <div className="h-full bg-amber-200/60 transition-[width] duration-500" style={{ width: `${Math.round(prog * 100)}%` }} />
                </div>
              )}
              <div className="mt-2 flex justify-between items-center">
                <span className="text-white/40 tabular-nums">
                  {ready ? 'the pour is ready'
                    : here.lit ? `${Math.max(0, Math.ceil((brewMs(here) - (now - here.litAt!)) / 1000))}s to the pour`
                    : here.run ? `${ALCHEMY_STATIONS[want!].name.toLowerCase()} at work · ${Math.max(0, Math.ceil((stepMs(here) - (now - here.run.since)) / 1000))}s`
                    : want ? `waiting on a ${ALCHEMY_STATIONS[want].name.toLowerCase()} — any ${space === 'plot' ? 'on the plot' : 'nearby'}`
                    : `the road is walked — ${d.manaCost} mana to light`}
                </span>
                <span className="flex gap-1.5">
                  {!here.lit && (
                    <button onClick={doTipOut} className="px-2 py-1 rounded border border-white/10 text-white/40 hover:border-white/30">tip out</button>
                  )}
                  {!here.lit && !want && (
                    <button onClick={doLight} className="px-2.5 py-1 rounded border border-amber-200/50 text-amber-100/90 hover:bg-amber-200/10">light</button>
                  )}
                  {here.lit && (
                    <button disabled={!ready} onClick={doPour}
                            className={`px-2.5 py-1 rounded border transition-colors ${ready ? 'border-amber-200/50 text-amber-100/90 hover:bg-amber-200/10' : 'border-white/5 text-white/25 cursor-not-allowed'}`}>
                      pour
                    </button>
                  )}
                </span>
              </div>
            </div>
          )
        })() : (
          <div className="mb-4 text-white/35">
            the pot is empty — choose a potion and its ingredients go in
            <span className="block mt-1 text-white/25">
              {st.fromBank ? 'drawing on the bank' : st.feeds.length ? `drawing on ${st.feeds.length} chest${st.feeds.length === 1 ? '' : 's'} beside it` : 'set a chest against it and it will draw on that too'}
              {' · '}any {space === 'plot' ? 'station on the plot' : 'station nearby'} can walk a step of the road
            </span>
          </div>
        )}

        {!here && (
          <div className="space-y-1.5">
            {menu.map(d => {
              const locked = level < d.minAlchemyLevel
              const missing = d.recipe.filter(r => ops.have(r.itemId) < r.count)
              const can = !locked && missing.length === 0
              const route = routeOf(d.id)
              return (
                <div key={d.id} className={`rounded border px-3 py-2 ${locked ? 'border-white/5 opacity-40' : can ? 'border-white/12' : 'border-white/8'}`}>
                  <div className="flex justify-between items-baseline gap-2">
                    <span className={locked ? 'text-white/50' : 'text-white/85'}>{d.name}</span>
                    <span className="text-white/35 tabular-nums whitespace-nowrap">{locked ? `alchemy ${d.minAlchemyLevel}` : `${d.manaCost} mana to light`}</span>
                  </div>
                  <div className="mt-1 text-white/40">
                    {d.recipe.map(r => (
                      <span key={r.itemId} className={`mr-2 ${ops.have(r.itemId) >= r.count ? '' : 'text-rose-200/60'}`}>
                        {r.count}× {ops.label(r.itemId)} <span className="text-white/25">({ops.have(r.itemId)})</span>
                      </span>
                    ))}
                    <span className="text-white/25">→ {d.resultCount}× {d.name}</span>
                  </div>
                  <div className="mt-0.5 text-white/25">
                    {route.map((s, i) => <span key={i}>{i > 0 ? ' → ' : ''}{ALCHEMY_STATIONS[s].name.toLowerCase()}</span>)}
                    <span> → pour</span>
                    {jobOf(d.id) && <span className="ml-2 text-white/20">· {JOB_LINE[jobOf(d.id)!]}</span>}
                  </div>
                  {!locked && (
                    <div className="mt-1.5 flex gap-1.5 items-center">
                      {can ? (
                        <button onClick={() => doStart(d)} className="px-2 py-0.5 rounded border border-amber-200/40 text-amber-100/85 hover:bg-amber-200/10">start</button>
                      ) : (
                        <span className="text-white/30">short of {missing.map(m => ops.label(m.itemId).toLowerCase()).join(', ')}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </PanelFrame>
    )
  }

  // ── a road station ─────────────────────────────────────────────────────────────────────────
  const running = runningAt(all, myKey)
  const waiting = openFor(all, st.kind, space, st.x, st.z)
  const doTake = (b: Brewing) => {
    const next = beginStep(b, myKey, keeper.id, now)
    if (!next) return
    write(next)
    onChange()
    onSay(`${def.name.toLowerCase()} sets to work on the ${POTION_DEFS[b.potionId].name.toLowerCase()} — ${Math.round(stepMs(b) / 1000)}s`)
  }

  return (
    <PanelFrame width="w-[480px]" onClose={onClose} dataPanel="brewing">
      <div className="flex items-baseline justify-between mb-3 pr-6">
        <span className="text-white/95 font-semibold tracking-[.18em] uppercase">{def.name}</span>
        <span className="text-white/35">alchemy {level}</span>
      </div>

      {running ? (
        <div className="mb-4 rounded border border-amber-200/25 bg-amber-100/[0.03] px-3 py-2.5">
          <div className="flex justify-between items-baseline">
            <span className="text-amber-100/90">{POTION_DEFS[running.potionId].name}</span>
            <span className="text-white/45">{roadLine(running)}</span>
          </div>
          <div className="mt-2 h-1 rounded bg-white/10 overflow-hidden">
            <div className="h-full bg-amber-200/60 transition-[width] duration-500" style={{ width: `${Math.round(runProgress(running, now) * 100)}%` }} />
          </div>
          <div className="mt-2 text-white/40 tabular-nums">
            {Math.max(0, Math.ceil((stepMs(running) - (now - running.run!.since)) / 1000))}s — it goes back to the pot on its own
          </div>
        </div>
      ) : (
        <div className="mb-4 text-white/35">
          {waiting.length
            ? `${waiting.length} brewing${waiting.length === 1 ? '' : 's'} waiting on a ${def.name.toLowerCase()}`
            : `nothing waiting on the ${def.name.toLowerCase()}`}
          <span className="block mt-1 text-white/25">
            {waiting.length ? 'take one and it runs here; the pot hears when it is done' : 'a brewing starts at a cauldron — its road brings it here'}
          </span>
        </div>
      )}

      {!running && waiting.length > 0 && (
        <div className="space-y-1.5">
          {waiting.map(b => {
            const d = POTION_DEFS[b.potionId]
            return (
              <div key={brewingKey(b.at!)} className="rounded border border-white/12 px-3 py-2">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-white/85">{d.name}</span>
                  <span className="text-white/35 tabular-nums whitespace-nowrap">{Math.round(stepMs(b) / 1000)}s</span>
                </div>
                <div className="mt-0.5 text-white/25">{roadLine(b)}{space !== 'plot' && b.at ? ` · pot at ${b.at.x}, ${b.at.z}` : ''}</div>
                <div className="mt-1.5">
                  <button onClick={() => doTake(b)} className="px-2 py-0.5 rounded border border-amber-200/40 text-amber-100/85 hover:bg-amber-200/10">take</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PanelFrame>
  )
}
