// The alchemy station panel — one component for the mortar, the still, the bowl, the cauldron
// and (2026-09-15) the oven, which rides the same table with `craft: 'cooking'`: no alchemy line
// in the header, no level gate, no XP — a job you set going and take from. Sibling of `StationPanel` (VoxelWorld.tsx) and shaped like it on purpose: a job
// card while the station runs, a recipe list while it is idle, the chests beside it as extra
// pockets. What differs is the table (`alchemy-chain.ts`, not `RECIPES`), the mana a finishing run
// channels, the alchemy XP paid on TAKE, and the level gate.
//
// ★ THE PANEL DOES NOT TOUCH THE BAG. `ops` is handed in by the host — `have` / `spend` / `payout`
// already know about the chests standing against the block, and `give` (the world's one door into
// the satchel, the one that answers with what did not fit) lives in the host. A panel that imported
// the world would be a cycle; a panel that re-implemented `give` would be the 08-11 overflow bug
// wearing a new face.
//
// ★ TAKE PAYS XP, LOAD PAYS MANA. A run's mana is channelled when the pot is set going (a keeper
// three shards short of the mana is told to wait — `station.ts`'s `replenishing` argument), and
// the XP lands when the bottle is in hand, because a job abandoned in a broken pot paid nothing.
import { useEffect, useState } from 'react'
import type { Inventory } from '../engine/inventory'
import { addSkillXP, getMilestone, type SkillSet } from '../engine/skills'
import type { StationJob, Workshop } from '../voxel/workshop'
import {
  ALCHEMY_STATIONS, alchemyStationRecipes, alchemyRecipe, alchemyRunsReady, alchemyRunProgress,
  alchemySecondsToNext, alchemyMaxRuns, alchemyJobCost, alchemyLoadJob, alchemyCollect, alchemyBusy,
  routeOf, jobOf, JOB_LINE, type AlchemyStationId, type AlchemyRecipe,
} from './alchemy-chain'
import type { OpenStation } from './VoxelWorld'
import { PanelFrame } from './panel-frame'
import { H, HearthNote, HearthJob, HearthIdle, HearthRow, HearthRoad, HearthButton, CostChip } from '../ui/hearth'

export interface AlchemyOps {
  have: (itemId: string) => number
  spend: (itemId: string, n: number) => void
  /** Give to the bag, then the chests; returns what fit NOWHERE. */
  payout: (itemId: string, n: number) => number
  label: (itemId: string) => string
}

export function AlchemyPanel({ st, inv, skills, mana, ops, onChange, onLevel, onSay, onClose }: {
  st: OpenStation & { kind: AlchemyStationId }
  inv: React.RefObject<Inventory | null>
  skills: React.RefObject<SkillSet>
  mana: React.RefObject<{ cur: number; max: number; regen: number }>
  ops: AlchemyOps
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
  const cooking = def.craft === 'cooking'
  const key = `${st.x},${st.y},${st.z}`
  const [job, setJob] = useState<StationJob | undefined>(st.job)
  const now = Date.now()
  const level = skills.current.alchemy.level
  const ready = job ? alchemyRunsReady(job, now) : 0
  const r = job ? alchemyRecipe(job.recipeId) : undefined
  void inv

  const doTake = () => {
    if (!job || !r || ready <= 0) return
    const { shop, payout, xp } = alchemyCollect({ [key]: job }, key, now)
    if (!payout) return
    const lost = ops.payout(payout.itemId, payout.count)
    if (lost >= payout.count) { onSay('nowhere to put it — empty your bag, or set a chest beside it'); return }
    st.commit(shop)
    st.touchFeeds()
    setJob(shop[key])
    st.setLit?.(alchemyBusy(shop[key]))
    // A loaf pays no alchemy: `xp` is 0 on every cooking row and the skill is not touched at all.
    const res = xp > 0 ? addSkillXP(skills.current.alchemy, xp) : { leveled: false as const, newLevel: 0 }
    if (res.leveled) onLevel(`alchemy ${res.newLevel}${getMilestone(res.newLevel) ? ' — ' + getMilestone(res.newLevel) : ''}`)
    onChange()
    onSay(lost > 0
      ? `${def.name.toLowerCase()} hands you ${payout.count - lost}× ${ops.label(payout.itemId)} — ${lost} would not fit`
      : `${def.name.toLowerCase()} hands you ${payout.count}× ${ops.label(payout.itemId)}`)
  }

  const doLoad = (rec: AlchemyRecipe, runs: number) => {
    if (runs <= 0 || level < rec.minLevel) return
    const shop = alchemyLoadJob({}, key, rec.id, runs, now)
    if (!shop[key]) return
    for (const c of alchemyJobCost(rec, runs)) ops.spend(c.itemId, c.count)
    if (rec.mana > 0) mana.current.cur = Math.max(0, mana.current.cur - rec.mana * runs)
    st.commit(shop)
    st.touchFeeds()
    setJob(shop[key])
    st.setLit?.(true)
    onChange()
    onSay(`${def.name.toLowerCase()} sets to work — ${runs}× ${rec.name.toLowerCase()}`)
  }

  const busy = alchemyBusy(job)
  const rows = alchemyStationRecipes(st.kind)
  // Every road row and every finish names its potion (09-16); the cook rows name none.
  const potionId = (rec: AlchemyRecipe) => rec.potionId ?? null
  const isPour = (rec: AlchemyRecipe | undefined) => !!rec && rec.id.startsWith('finish:')

  return (
    <PanelFrame width="w-[480px]" title={def.name} onClose={onClose}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <HearthNote>{st.fromBank ? 'drawing on the bank' : st.feeds.length ? `drawing on ${st.feeds.length} chest${st.feeds.length === 1 ? '' : 's'} beside it` : 'set a chest against it and it will work out of that too'}</HearthNote>
          <span className="text-[12px] tabular-nums whitespace-nowrap" style={{ color: H.inkSoft }}>{cooking ? 'the fire is always lit' : `alchemy ${level} · mana ${Math.floor(mana.current.cur)}`}</span>
        </div>

        {busy && job && r ? (
          <HearthJob name={r.name} meta={`${job.runs} left`} progress={alchemyRunProgress(job, now)}
                     status={ready > 0 ? `${ready * r.output.count}× ${ops.label(r.output.itemId)} waiting` : `${alchemySecondsToNext(job, now)}s to the next`}>
            {/* ★ THE POUR (ruled 09-16): the liquid leaves the cauldron into its vessel and takes its
                word — the reward moment. Every other station's run is simply taken. */}
            <HearthButton small primary disabled={ready <= 0} onClick={doTake}>{isPour(r) ? 'pour' : 'take'}</HearthButton>
          </HearthJob>
        ) : (
          <HearthIdle>{def.name} is idle. Give it something to work on.</HearthIdle>
        )}

        <div className="space-y-2">
          {rows.map(rec => {
            const locked = level < rec.minLevel
            const can = alchemyMaxRuns(rec, ops.have, mana.current.cur)
            const pid = potionId(rec)
            const route = pid ? routeOf(pid) : null
            const missing = rec.input.filter(i => ops.have(i.itemId) < i.count)
            return (
              <HearthRow key={rec.id} dataRow={rec.id} itemId={rec.output.itemId} name={rec.name} locked={locked} dim={can <= 0 || busy}
                         meta={locked ? `alchemy ${rec.minLevel}` : `${rec.output.count}× · ${Math.round(rec.runMs / 1000)}s${rec.mana ? ` · ${rec.mana} mana` : ''}`}
                         inputs={rec.input.map(i => <CostChip key={i.itemId} itemId={i.itemId} label={ops.label(i.itemId)} have={ops.have(i.itemId)} need={i.count} />)}
                         road={route ? <HearthRoad steps={route.map(x => ALCHEMY_STATIONS[x].name.toLowerCase())} here={route.indexOf(st.kind)} after={pid && jobOf(pid) ? JOB_LINE[jobOf(pid)!] : undefined} /> : undefined}
                         note={!locked && !busy && can <= 0 ? (missing.length ? `short of ${missing.map(m => ops.label(m.itemId).toLowerCase()).join(', ')}` : 'not enough mana — wait') : undefined}>
                {!locked && !busy && [1, 4, can].filter((n, i, a) => n > 0 && a.indexOf(n) === i && n <= can).map((n, i) => (
                  <HearthButton key={n} small primary={i === 0} onClick={() => doLoad(rec, n)}>
                    {n === can && n !== 1 && n !== 4 ? `all (${n})` : `×${n}`}
                  </HearthButton>
                ))}
              </HearthRow>
            )
          })}
        </div>
    </PanelFrame>
  )
}

/** For the host: the same `Workshop`-shaped record the panel commits. Re-exported so the host's
 *  mount needs one import. */
export type { Workshop }
