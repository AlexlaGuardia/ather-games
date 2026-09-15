// The alchemy station panel — one component for the grinder, the still, the mixing vessel and
// the cauldron. Sibling of `StationPanel` (VoxelWorld.tsx) and shaped like it on purpose: a job
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
  routeOf, type AlchemyStationId, type AlchemyRecipe,
} from './alchemy-chain'
import type { OpenStation } from './VoxelWorld'

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
    const res = addSkillXP(skills.current.alchemy, xp)
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
  const potionId = (rec: AlchemyRecipe) => rec.id.startsWith('finish:') ? rec.id.slice(7) : rec.id.startsWith('mix:') ? rec.id.slice(4) : null

  return (
    <div className="absolute inset-0 grid place-items-center bg-black/50 pointer-events-auto" onClick={onClose}>
      <div className="w-[480px] max-h-[80vh] overflow-y-auto bg-[#0e1018]/95 border border-white/12 rounded-lg p-4 font-mono text-[11px]"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-white/95 font-semibold tracking-[.18em] uppercase">{def.name}</span>
          <span className="text-white/35">alchemy {level} · mana {Math.floor(mana.current.cur)}</span>
          <button onClick={onClose} className="text-white/40 hover:text-white/80">esc</button>
        </div>

        {busy && job && r ? (
          <div className="mb-4 rounded border border-amber-200/25 bg-amber-100/[0.03] px-3 py-2.5">
            <div className="flex justify-between items-baseline">
              <span className="text-amber-100/90">{r.name}</span>
              <span className="text-white/45 tabular-nums">{job.runs} left</span>
            </div>
            <div className="mt-2 h-1 rounded bg-white/10 overflow-hidden">
              <div className="h-full bg-amber-200/60 transition-[width] duration-500"
                   style={{ width: `${Math.round(alchemyRunProgress(job, now) * 100)}%` }} />
            </div>
            <div className="mt-2 flex justify-between items-center">
              <span className="text-white/40 tabular-nums">
                {ready > 0 ? `${ready * r.output.count}× ${ops.label(r.output.itemId)} waiting` : `${alchemySecondsToNext(job, now)}s to the next`}
              </span>
              <button disabled={ready <= 0} onClick={doTake}
                      className={`px-2.5 py-1 rounded border transition-colors ${
                        ready > 0 ? 'border-amber-200/50 text-amber-100/90 hover:bg-amber-200/10'
                                  : 'border-white/5 text-white/25 cursor-not-allowed'}`}>
                take
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4 text-white/35">
            {def.name.toLowerCase()} is idle — give it something to work on
            <span className="block mt-1 text-white/25">
              {st.feeds.length
                ? `drawing on ${st.feeds.length} chest${st.feeds.length === 1 ? '' : 's'} beside it`
                : 'set a chest against it and it will work out of that too'}
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          {rows.map(rec => {
            const locked = level < rec.minLevel
            const can = alchemyMaxRuns(rec, ops.have, mana.current.cur)
            const pid = potionId(rec)
            const route = pid ? routeOf(pid) : null
            const missing = rec.input.filter(i => ops.have(i.itemId) < i.count)
            return (
              <div key={rec.id} className={`rounded border px-3 py-2 ${locked ? 'border-white/5 opacity-40' : can > 0 && !busy ? 'border-white/12' : 'border-white/8'}`}>
                <div className="flex justify-between items-baseline gap-2">
                  <span className={locked ? 'text-white/50' : 'text-white/85'}>{rec.name}</span>
                  <span className="text-white/35 tabular-nums whitespace-nowrap">
                    {locked ? `alchemy ${rec.minLevel}` : `${Math.round(rec.runMs / 1000)}s${rec.mana ? ` · ${rec.mana} mana` : ''}`}
                  </span>
                </div>
                <div className="mt-1 text-white/40">
                  {rec.input.map(i => (
                    <span key={i.itemId} className={`mr-2 ${ops.have(i.itemId) >= i.count ? '' : 'text-rose-200/60'}`}>
                      {i.count}× {ops.label(i.itemId)} <span className="text-white/25">({ops.have(i.itemId)})</span>
                    </span>
                  ))}
                  <span className="text-white/25">→ {rec.output.count}× {ops.label(rec.output.itemId)}</span>
                </div>
                {route && (
                  <div className="mt-0.5 text-white/25">
                    {route.map(s => ALCHEMY_STATIONS[s].name.toLowerCase()).join(' → ')}
                  </div>
                )}
                {!locked && !busy && (
                  <div className="mt-1.5 flex gap-1.5">
                    {[1, 4, can].filter((n, i, a) => n > 0 && a.indexOf(n) === i && n <= can).map(n => (
                      <button key={n} onClick={() => doLoad(rec, n)}
                              className="px-2 py-0.5 rounded border border-amber-200/40 text-amber-100/85 hover:bg-amber-200/10">
                        {n === can && n !== 1 && n !== 4 ? `all (${n})` : `×${n}`}
                      </button>
                    ))}
                    {can <= 0 && (
                      <span className="text-white/30">
                        {missing.length ? `short of ${missing.map(m => ops.label(m.itemId).toLowerCase()).join(', ')}` : 'not enough mana — wait'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** For the host: the same `Workshop`-shaped record the panel commits. Re-exported so the host's
 *  mount needs one import. */
export type { Workshop }
