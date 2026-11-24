// GATHERING BY MANA PER SECOND (BETA M136, Alex 11-24; it replaced the chips of 11-17). Numbers: gather-dials.ts.
// Canon (game/shimmer-skilling.md › gathering tools): tools are CHANNELING FOCUSES, never swung: the focus hovers at the node
// (channel-fx.tsx) and the mana does the work.
//
// ★ ONE CYCLE, ONE ROLL, ONE YIELD. The first touch rolls the node's whole yield (prunePlan / minePlan, unchanged odds) and
//   starts its RESET timer. Letting go (out of reach, a weapon drawn, dry) keeps the progress; a reload keeps it; everything
//   drops at the end, and the finished node stays spent for what is LEFT of that same timer (pruneCommit / mineCommit take
//   `until`). At zero the record is gone: unfinished progress and its roll with it.
// ★ PROGRESS IS A FRACTION, not mana: a better focus picked up half way makes the rest cheaper.
// Saved per garden (GARDEN_KEY_SPECS), beside open.pruned.v1 / open.mined.v1: a node is the plot's, every keeper of an account
// sees the same trees, so a per-keeper record would let two keepers take two yields out of one cycle.
import { gardenKey } from '@/lib/keeper-local'
import { ownerSlot } from '../shared/owner-store'
import { manaNeed, type GatherDial } from './gather-dials'

export type NodeKind = 'tree' | 'crystal'
export interface Stack { id: string; n: number }
/** A touched node: how far (0..1), when it resets (ms), and its roll. */
export interface Work { node: NodeKind; id: string; p: number; until: number; drops: Stack[]; extra?: unknown }

const KEY = 'open.gather.v1'
const keyOf = (node: NodeKind, id: string) => `${node}:${id}`
let works: Record<string, Work> = {}
const slot = ownerSlot(() => gardenKey(KEY), () => { works = {} })
const valid = (w: unknown): w is Work => {
  const x = w as Work
  return !!x && (x.node === 'tree' || x.node === 'crystal') && typeof x.id === 'string' && Number.isFinite(x.p) && x.p >= 0 && x.p <= 1
    && Number.isFinite(x.until) && Array.isArray(x.drops) && x.drops.every(d => !!d && typeof d.id === 'string' && Number.isFinite(d.n))
}
function load(): void {
  if (!slot.due()) return
  works = {}
  try {
    const s = JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? 'null')
    if (s && typeof s === 'object' && !Array.isArray(s)) for (const [k, w] of Object.entries(s)) if (valid(w)) works[k] = w
  } catch { /* fresh */ }
}
/** Write it down (the page calls this on let-go, once a second while working, and as the tab hides). */
export function saveWork(now = Date.now()): void {
  load()
  for (const k of Object.keys(works)) if (works[k].until <= now) delete works[k]
  if (slot.writable()) try { localStorage.setItem(gardenKey(KEY), JSON.stringify(works)) } catch { /* private window */ }
}
/** This cycle's record of a node, or undefined (never touched, finished, or reset). */
export function workOf(node: NodeKind, id: string, now = Date.now()): Work | undefined {
  load()
  const w = works[keyOf(node, id)]
  return w && w.until > now ? w : undefined
}
/** Touch a node: this cycle's record, or a fresh one (rolled now, its reset timer starting now). The caller has checked it
 *  is not spent (pruneCheck / mineCheck). */
export function beginWork(node: NodeKind, id: string, plan: () => { drops: Stack[]; extra?: unknown }, respawnMs: number, now = Date.now()): Work {
  const had = workOf(node, id, now)
  if (had) return had
  const r = plan()
  const w: Work = { node, id, p: 0, until: now + respawnMs, drops: r.drops, extra: r.extra }
  works[keyOf(node, id)] = w
  saveWork(now)
  return w
}
/** The mana still to go with a focus of `rung`. */
export const manaLeft = (d: GatherDial, rung: number, w?: Work) => manaNeed(d, rung) * (1 - (w?.p ?? 0))
/** The same as a number to show (never 0 while there is work left). */
export const manaShown = (d: GatherDial, rung: number, w?: Work) => { const m = manaLeft(d, rung, w); return m < 1e-6 ? 0 : Math.max(1, Math.round(m)) }

export type Step = 'working' | 'done' | 'dry' | 'reset'
/** One frame of work: spends up to drain × dt off the bar into the node. */
export function stepWork(w: Work, d: GatherDial, rung: number, dt: number, mana: { cur: number }, now = Date.now()): Step {
  if (workOf(w.node, w.id, now) !== w) return 'reset'
  const need = manaNeed(d, rung), left = need * (1 - w.p)
  const spend = Math.max(0, Math.min(d.drain * dt, left, mana.cur))
  mana.cur -= spend
  w.p = spend >= left - 1e-9 ? 1 : w.p + spend / need
  if (w.p >= 1) return 'done'
  return mana.cur <= 1e-6 ? 'dry' : 'working'
}
/** The yield is paid: forget the record. Its `until` is when the spent node resets. Null = there was nothing to pay. */
export function finishWork(w: Work, now = Date.now()): { until: number } | null {
  if (w.p < 1 || workOf(w.node, w.id, now) !== w) return null
  delete works[keyOf(w.node, w.id)]
  saveWork(now)
  return { until: w.until }
}
/** Test hook. */
export const _resetWork = () => { load(); works = {} }
