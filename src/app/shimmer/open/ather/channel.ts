// GATHERING BY MANA PER SECOND (BETA M136, Alex 11-24; it replaced the chips of 11-17). Numbers: gather-dials.ts.
// Canon (game/shimmer-skilling.md › gathering tools): tools are CHANNELING FOCUSES, never swung: the focus hovers at the node
// (channel-fx.tsx) and the mana does the work.
//
// ★ ONE CYCLE, ONE ROLL, ONE YIELD. The first touch rolls the node's whole yield (prunePlan / minePlan, unchanged odds) and
//   starts its RESET timer. Letting go (out of reach, a weapon drawn, dry) keeps the progress; a reload keeps it; everything
//   drops at the end (on the ground: ground-loot.ts, M141), and the finished node stays spent for what is LEFT of that same timer (pruneCommit / mineCommit take
//   `until`). At zero the record is gone: unfinished progress and its roll with it.
// ★ PROGRESS IS A FRACTION, not mana: a better focus picked up half way makes the rest cheaper.
// Saved per garden (GARDEN_KEY_SPECS), beside open.pruned.v1 / open.mined.v1: a node is the plot's, every keeper of an account
// sees the same trees, so a per-keeper record would let two keepers take two yields out of one cycle.
import { gardenKey, keeperKey } from '@/lib/keeper-local'
import { ownerSlot, type OwnerSlot } from '../shared/owner-store'
import { isKeeperNode } from './keeper-nodes'
import { manaNeed, type GatherDial } from './gather-dials'

export type NodeKind = 'tree' | 'crystal'
export interface Stack { id: string; n: number }
/** A touched node: how far (0..1), when it resets (ms), and its roll. */
export interface Work { node: NodeKind; id: string; p: number; until: number; drops: Stack[]; extra?: unknown }

const KEY = 'open.gather.v1'
const keyOf = (node: NodeKind, id: string) => `${node}:${id}`
// M153 s1b: a Glade node (keeper-nodes.ts) is the KEEPER's copy, so its record has a key of its own; the rest is the garden's.
const KKEY = 'open.gladework.v1'
interface Shelf { works: Record<string, Work>; slot: OwnerSlot; get(): string | null; put(s: string): void }
const shelf = (keyOf: () => string, get: () => string | null, put: (s: string) => void): Shelf => { const h: Shelf = { works: {}, slot: ownerSlot(keyOf, () => { h.works = {} }), get, put }; return h }
const garden = shelf(() => gardenKey(KEY), () => localStorage.getItem(gardenKey(KEY)), s => localStorage.setItem(gardenKey(KEY), s))
const keeper = shelf(() => keeperKey(KKEY), () => localStorage.getItem(keeperKey(KKEY)), s => localStorage.setItem(keeperKey(KKEY), s))
const of = (id: string) => (isKeeperNode(id) ? keeper : garden)
const valid = (w: unknown): w is Work => {
  const x = w as Work
  return !!x && (x.node === 'tree' || x.node === 'crystal') && typeof x.id === 'string' && Number.isFinite(x.p) && x.p >= 0 && x.p <= 1
    && Number.isFinite(x.until) && Array.isArray(x.drops) && x.drops.every(d => !!d && typeof d.id === 'string' && Number.isFinite(d.n))
}
function load(h: Shelf): void {
  if (!h.slot.due()) return
  h.works = {}
  try {
    const s = JSON.parse(h.get() ?? 'null')
    if (s && typeof s === 'object' && !Array.isArray(s)) for (const [k, w] of Object.entries(s)) if (valid(w)) h.works[k] = w
  } catch { /* fresh */ }
}
function saveShelf(h: Shelf, now: number): void {
  load(h)
  for (const k of Object.keys(h.works)) if (h.works[k].until <= now) delete h.works[k]
  if (h.slot.writable()) try { h.put(JSON.stringify(h.works)) } catch { /* private window */ }
}
/** Write it down (the page calls this on let-go, once a second while working, and as the tab hides). */
export function saveWork(now = Date.now()): void {
  saveShelf(garden, now)
  load(keeper); if (Object.keys(keeper.works).length) saveShelf(keeper, now)   // a keeper who never touched a Glade node writes nothing
}
/** This cycle's record of a node, or undefined (never touched, finished, or reset). */
export function workOf(node: NodeKind, id: string, now = Date.now()): Work | undefined {
  const h = of(id); load(h)
  const w = h.works[keyOf(node, id)]
  return w && w.until > now ? w : undefined
}
/** Touch a node: this cycle's record, or a fresh one (rolled now, its reset timer starting now). The caller has checked it
 *  is not spent (pruneCheck / mineCheck). */
export function beginWork(node: NodeKind, id: string, plan: () => { drops: Stack[]; extra?: unknown }, respawnMs: number, now = Date.now()): Work {
  const had = workOf(node, id, now)
  if (had) return had
  const r = plan()
  const w: Work = { node, id, p: 0, until: now + respawnMs, drops: r.drops, extra: r.extra }
  of(id).works[keyOf(node, id)] = w
  saveShelf(of(id), now)
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
  delete of(w.id).works[keyOf(w.node, w.id)]
  saveShelf(of(w.id), now)
  return { until: w.until }
}
/** Test hook. */
export const _resetWork = () => { for (const h of [garden, keeper]) { load(h); h.works = {} } }
