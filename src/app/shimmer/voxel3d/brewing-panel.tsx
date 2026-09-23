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
import { ALCHEMY_STATIONS, ROAD_STATION, roadOf, jobOf, JOB_LINE, type AlchemyStationId } from './alchemy-chain'
import { cauldronMenu } from './brew'
import {
  startBrewing, beginStep, settle, light, pour, pourReady, brewProgress, runProgress, stepMs, brewMs,
  openFor, runningAt, nextStation, roadLine, abandonRefund, brewingKey, stationKeyOf,
  type Brewing, type Brewings,
} from './brewing'
import type { OpenStation } from './VoxelWorld'
import type { AlchemyOps } from './alchemy-panel'
import { PanelFrame } from './panel-frame'
import { H, HearthNote, HearthJob, HearthIdle, HearthRow, HearthRoad, HearthButton, CostChip } from '../ui/hearth'

export function BrewingPanel({ st, space, keeper, brewings, skills, mana, ops, known, onPoured, onBrewings, onChange, onLevel, onSay, onClose }: {
  st: OpenStation & { kind: AlchemyStationId }
  space: string
  keeper: { id: string; name: string }
  brewings: React.RefObject<Brewings>
  skills: React.RefObject<SkillSet>
  mana: React.RefObject<{ cur: number; max: number; regen: number }>
  ops: AlchemyOps
  /**
   * The keeper's recipe book (`recipe-book.ts`). Absent = every recipe in the window (a dev bench
   * with no keeper), so only the world narrows the menu.
   */
  known?: readonly string[]
  /** A pour landed in the keeper's hands: the book may gain a page. Returns the page's name, if any. */
  onPoured?: (potionId: string) => string | null
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
      // ★ ONE POUR, ONE PAGE — the pot is the teacher after Yarrow (recipe-book.ts).
      const page = mine > 0 ? onPoured?.(here.potionId) ?? null : null
      onSay((lost > 0
        ? `poured — ${mine - lost}× ${d.name.toLowerCase()}, ${lost} would not fit · ${xp} alchemy xp`
        : `poured — ${mine}× ${d.name.toLowerCase()} · ${xp} alchemy xp`)
        + (page ? ` · a new page: ${page}` : ''))
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

    const menu = cauldronMenu(level).filter(d => !known || known.includes(d.id))
    return (
      <PanelFrame width="w-[480px]" title={def.name} onClose={onClose} dataPanel="brewing">
        <div className="flex items-center justify-between gap-2 mb-3">
          <HearthNote>{st.fromBank ? 'drawing on the bank' : st.feeds.length ? `drawing on ${st.feeds.length} chest${st.feeds.length === 1 ? '' : 's'} beside it` : 'set a chest against it and it will draw on that too'}</HearthNote>
          <span className="text-[12px] tabular-nums whitespace-nowrap" style={{ color: H.inkSoft }}>alchemy {level} · mana {Math.floor(mana.current.cur)}</span>
        </div>

        {here ? (() => {
          const d = POTION_DEFS[here.potionId]
          const want = nextStation(here)
          const ready = pourReady(here, now)
          const prog = here.lit ? brewProgress(here, now) : runProgress(here, now)
          return (
            <HearthJob name={d.name} meta={jobOf(here.potionId) ? JOB_LINE[jobOf(here.potionId)!] : ''} sub={roadLine(here)}
                       progress={here.run || here.lit ? prog : null}
                       status={ready ? 'the pour is ready'
                         : here.lit ? `${Math.max(0, Math.ceil((brewMs(here) - (now - here.litAt!)) / 1000))}s to the pour`
                         : here.run ? `${ALCHEMY_STATIONS[want!].name.toLowerCase()} at work · ${Math.max(0, Math.ceil((stepMs(here) - (now - here.run.since)) / 1000))}s`
                         : want ? `waiting on a ${ALCHEMY_STATIONS[want].name.toLowerCase()} — any ${space === 'plot' ? 'on the plot' : 'nearby'}`
                         : `the road is walked — ${d.manaCost} mana to light`}>
              {!here.lit && <HearthButton small onClick={doTipOut}>tip out</HearthButton>}
              {!here.lit && !want && <HearthButton small primary onClick={doLight}>light</HearthButton>}
              {here.lit && <HearthButton small primary disabled={!ready} onClick={doPour}>pour</HearthButton>}
            </HearthJob>
          )
        })() : (
          <HearthIdle sub={`any ${space === 'plot' ? 'station on the plot' : 'station nearby'} can walk a step of the road`}>
            The pot is empty. Choose a potion and its ingredients go in.
          </HearthIdle>
        )}

        {!here && (
          <div className="space-y-2">
            {menu.length === 0 && <HearthNote>no recipes in your book yet</HearthNote>}
            {menu.map(d => {
              const locked = level < d.minAlchemyLevel
              const missing = d.recipe.filter(r => ops.have(r.itemId) < r.count)
              const can = !locked && missing.length === 0
              const road = roadOf(d.id)
              return (
                <HearthRow key={d.id} dataRow={d.id} itemId={d.id} name={d.name} locked={locked} dim={!can}
                           meta={locked ? `alchemy ${d.minAlchemyLevel}` : `${d.manaCost} mana to light`}
                           inputs={d.recipe.map(r => <CostChip key={r.itemId} itemId={r.itemId} label={ops.label(r.itemId)} have={ops.have(r.itemId)} need={r.count} />)}
                           road={<HearthRoad steps={road.map(x => ALCHEMY_STATIONS[ROAD_STATION[x]].name.toLowerCase())} after={jobOf(d.id) ? JOB_LINE[jobOf(d.id)!] : undefined} />}
                           note={!locked && !can ? `short of ${missing.map(m => ops.label(m.itemId).toLowerCase()).join(', ')}` : undefined}>
                  {can && <HearthButton small primary onClick={() => doStart(d)}>start · {d.resultCount}×</HearthButton>}
                </HearthRow>
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
    <PanelFrame width="w-[480px]" title={def.name} onClose={onClose} dataPanel="brewing">
      <div className="flex items-center justify-between gap-2 mb-3">
        <HearthNote>a step on the road</HearthNote>
        <span className="text-[12px] tabular-nums" style={{ color: H.inkSoft }}>alchemy {level}</span>
      </div>

      {running ? (
        <HearthJob name={POTION_DEFS[running.potionId].name} sub={roadLine(running)} progress={runProgress(running, now)}
                   status={`${Math.max(0, Math.ceil((stepMs(running) - (now - running.run!.since)) / 1000))}s — it goes back to the pot on its own`} />
      ) : (
        <HearthIdle sub={waiting.length ? 'take one and it runs here; the pot hears when it is done' : 'a brewing starts at a cauldron — its road brings it here'}>
          {waiting.length
            ? `${waiting.length} brewing${waiting.length === 1 ? '' : 's'} waiting on a ${def.name.toLowerCase()}`
            : `Nothing waiting on the ${def.name.toLowerCase()}.`}
        </HearthIdle>
      )}

      {!running && waiting.length > 0 && (
        <div className="space-y-2">
          {waiting.map(b => {
            const d = POTION_DEFS[b.potionId]
            return (
              <HearthRow key={brewingKey(b.at!)} dataRow={b.potionId} itemId={b.potionId} name={d.name} meta={`${Math.round(stepMs(b) / 1000)}s`}
                         road={<>{roadLine(b)}{space !== 'plot' && b.at ? ` · pot at ${b.at.x}, ${b.at.z}` : ''}</>}>
                <HearthButton small primary onClick={() => doTake(b)}>take</HearthButton>
              </HearthRow>
            )
          })}
        </div>
      )}
    </PanelFrame>
  )
}
