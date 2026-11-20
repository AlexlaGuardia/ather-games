// STATION QUEUE: batch crafting at a workshop room (BETA M43; Alex 11-20 playtest: "no click-per-plank").
// A job gets a CRAFT TIME per item and a quantity up to 99. The station works its queue: inputs leave the station's STORE
// ONE RUN AT A TIME (never the whole batch up front), a finished run lands in the station's OUTPUT, which holds OUT_CAP of an
// item. The queue pauses when the store has no inputs for the next run, or when the output has no room for it, and resumes by
// itself when the player stocks the store / empties the output. Nothing is burned for nowhere to put it.
// WHO WORKS IT (hub default): the room's own Moglin, at its CRAFT grade's pace, ALSO while you are away (offline catch-up
// from timestamps). With no Moglin the keeper works it themselves, only while the bench panel is open (speed 1). Time on a
// blocked queue is not banked (no debt). ★ PURE: no React, no DOM.
import { putIn } from './garden-bank'
import { REFINE, STONE_REFINE, PIECE_JOBS, type Job } from './furniture'
import { ROAST } from './cooking'
import { BREW } from './alchemy'
import type { Stack } from '../shared/inventory'

export const OUT_CAP = 30
export const MAX_QTY = 99
export const QTY_PICKS = [1, 10, 99] as const

/** one queued job: `left` = RUNS still to make (the one in progress included) */
export interface QItem { job: string; left: number }
/** The queue on a Room. `run` = the head's inputs are already out of the store and `t` ms of its work are done. */
export interface Queue { items: QItem[]; t: number; run: boolean; last: number }
/** what the engine reads off a Room */
export interface Station { store?: Stack[]; out?: Stack[]; queue?: Queue }
export type Status = 'idle' | 'working' | 'empty' | 'full'

export const ALL_JOBS: readonly Job[] = [...REFINE, ...STONE_REFINE, ...PIECE_JOBS, ...ROAST, ...BREW]
export const jobById = (id: string): Job | undefined => ALL_JOBS.find(j => j.id === id)

/** Craft time per OUTPUT ITEM, in ms (Jin's defaults, hub 11-20: plank 4 s, brick 6 s, pane 8 s, furniture 20-60 s). */
export function itemMs(j: Job): number {
  const o = j.out.id
  if (/_plank$/.test(o)) return 4000
  if (o === 'stone_brick') return 6000
  if (o === 'crystal_pane') return 8000
  if (/_bark$|_branch$|_sap$/.test(o)) return 4000
  if (j.id.startsWith('roast-')) return 8000
  if (j.id.startsWith('brew-')) return 15000
  if (j.in.length && PIECE_JOBS.some(p => p.id === j.id)) return Math.max(20000, Math.min(60000, j.in.reduce((a, c) => a + c.n, 0) * 5000))
  return 6000
}
/** one RUN (the job once: it may make several items) */
export const runMs = (j: Job) => itemMs(j) * j.out.n
/** a Moglin's pace by its CRAFT grade 1..5: fair = x1, rare = x2 */
export const moglinSpeed = (craft: number) => 1 + 0.25 * (Math.max(1, Math.min(5, craft)) - 1)

const have = (stacks: readonly Stack[] | undefined, id: string) => (stacks ?? []).reduce((a, s) => a + (s.id === id ? s.n : 0), 0)
const BIG = 1e9
/** runs a quantity of OUTPUT items takes */
export const runsFor = (j: Job, qty: number) => Math.ceil(Math.max(0, Math.min(MAX_QTY, qty)) / j.out.n)
/** the most output items worth queueing for a job from what the store holds right now (1 / 10 / 99 / MAX), capped at 99 */
export function maxAffordable(j: Job, store: readonly Stack[] | undefined): number {
  const runs = Math.min(...j.in.map(c => Math.floor(have(store, c.id) / c.n)))
  return Math.max(0, Math.min(MAX_QTY, runs * j.out.n))
}
/** items still to make across the whole queue, per job id */
export const queued = (q: Queue | undefined, job: string) => (q?.items ?? []).reduce((a, i) => a + (i.job === job ? i.left : 0), 0)
export const totalLeft = (q: Queue | undefined) => (q?.items ?? []).reduce((a, i) => a + i.left, 0)

/** Add `qty` output items of a job to the tail of the queue (merging into an equal tail). The 99 cap is per queued job. */
export function enqueue(s: Station, job: string, qty: number, now: number): Station {
  const j = jobById(job); if (!j || !(qty >= 1)) return s
  const q: Queue = s.queue ? { ...s.queue, items: s.queue.items.map(i => ({ ...i })) } : { items: [], t: 0, run: false, last: now }
  const runs = runsFor(j, qty), cap = runsFor(j, MAX_QTY)
  const cur = q.items.find(i => i.job === job)
  if (cur) cur.left = Math.min(cap, cur.left + runs); else q.items.push({ job, left: Math.min(cap, runs) })
  if (!s.queue) q.last = now
  return { ...s, queue: q }
}
/** Cancel everything. Inputs are only ever taken for the run in progress, so that is the only thing to hand back. */
export function cancel(s: Station): Station {
  const q = s.queue; if (!q) return s
  let store = s.store ?? []
  const head = q.items[0], j = head && jobById(head.job)
  if (q.run && j) for (const c of j.in) store = putIn({ v: 1, stacks: store }, BIG, c.id, c.n).bank.stacks
  return { ...s, store, queue: undefined }
}
/** Drop one queued job (not the head while it is mid-run: cancel hands that back). Returns the station. */
export function dequeue(s: Station, job: string): Station {
  const q = s.queue; if (!q) return s
  if (q.items[0]?.job === job) { if (q.items.length === 1) return cancel(s); if (!q.run) return { ...s, queue: { ...q, items: q.items.slice(1), t: 0 } }; return s }
  const items = q.items.filter(i => i.job !== job)
  return { ...s, queue: items.length ? { ...q, items } : undefined }
}

export function statusOf(s: Station): Status {
  const q = s.queue; if (!q?.items.length) return 'idle'
  if (q.run) return 'working'
  const j = jobById(q.items[0].job); if (!j) return 'idle'
  if (!j.in.every(c => have(s.store, c.id) >= c.n)) return 'empty'
  if (have(s.out, j.out.id) + j.out.n > OUT_CAP) return 'full'
  return 'working'
}

/** Take a run's inputs out of a stack list (null if short). */
function takeRun(stacks: readonly Stack[], j: Job): Stack[] | null {
  let left = stacks.map(s => ({ ...s }))
  for (const c of j.in) {
    if (have(left, c.id) < c.n) return null
    let need = c.n
    for (const s of left) if (need > 0 && s.id === c.id) { const t = Math.min(need, s.n); s.n -= t; need -= t }
    left = left.filter(s => s.n > 0)
  }
  return left
}

/** Move the station to `now` at `speed` (1 = the keeper's own pace, 0 = nobody works it: the clock just moves on, no time
 *  is banked). Pure: returns the new station, the items made this call and the status it stopped in. The loop makes at most
 *  MAX_QTY*something runs: bounded by the queue itself. */
export function advance(s: Station, now: number, speed: number): { station: Station; made: Stack[]; status: Status } {
  const q0 = s.queue
  if (!q0?.items.length) return { station: s, made: [], status: 'idle' }
  let store = s.store ?? [], out = s.out ?? []
  const q: Queue = { ...q0, items: q0.items.map(i => ({ ...i })) }
  let budget = speed > 0 ? Math.max(0, now - q.last) * speed : 0
  q.last = now
  const made: Stack[] = []
  let status: Status = 'working'
  for (let guard = 0; guard < 5000; guard++) {
    const head = q.items[0]
    if (!head) break
    const j = jobById(head.job)
    if (!j || head.left <= 0) { q.items.shift(); q.run = false; q.t = 0; continue }
    if (!q.run) {
      const rest = takeRun(store, j)
      if (!rest) { status = 'empty'; q.t = 0; break }
      if (have(out, j.out.id) + j.out.n > OUT_CAP) { status = 'full'; q.t = 0; break }
      if (budget <= 0) break   // nobody is working it: inputs stay in the store
      store = rest; q.run = true; q.t = 0
    }
    if (budget <= 0) break
    const need = runMs(j) - q.t
    if (budget >= need) {
      budget -= need
      out = putIn({ v: 1, stacks: out }, BIG, j.out.id, j.out.n).bank.stacks
      const m = made.find(x => x.id === j.out.id); if (m) m.n += j.out.n; else made.push({ id: j.out.id, n: j.out.n })
      head.left--; q.run = false; q.t = 0
    } else { q.t += budget; budget = 0; break }
  }
  while (q.items.length && q.items[0].left <= 0) q.items.shift()
  const station: Station = { ...s, store, out, queue: q.items.length ? q : undefined }
  if (!station.queue) status = 'idle'
  return { station, made, status }
}

/** Collect an output stack into somewhere (the caller gives it to the bag): `n` of `id` out of the output, or everything of it. */
export function takeOut(s: Station, id: string, n = BIG): { station: Station; took: number } {
  let left = Math.min(n, have(s.out, id)); const took = left
  const out = (s.out ?? []).map(x => ({ ...x })).filter(x => { if (x.id === id && left > 0) { const t = Math.min(left, x.n); x.n -= t; left -= t } return x.n > 0 })
  return { station: { ...s, out }, took }
}
/** put back what the bag could not take */
export const putOut = (s: Station, id: string, n: number): Station => (n > 0 ? { ...s, out: putIn({ v: 1, stacks: s.out ?? [] }, BIG, id, n).bank.stacks } : s)

/** Off disk: a queue from before M43 is absent; anything unreadable becomes absent too. */
export function adoptQueue(v: unknown): Queue | undefined {
  const q = v as Partial<Queue> | null
  if (!q || !Array.isArray(q.items)) return undefined
  const items = q.items.filter((i): i is QItem => !!i && typeof i.job === 'string' && !!jobById(i.job) && Number.isFinite(i.left) && i.left >= 1).map(i => ({ job: i.job, left: Math.min(MAX_QTY, Math.floor(i.left)) }))
  if (!items.length) return undefined
  return { items, t: Number.isFinite(q.t) && q.t! >= 0 ? q.t! : 0, run: q.run === true, last: Number.isFinite(q.last) ? q.last! : Date.now() }
}
export function adoptOut(v: unknown): Stack[] | undefined {
  if (!Array.isArray(v)) return undefined
  const s = v.filter((x): x is Stack => !!x && typeof x.id === 'string' && Number.isFinite(x.n) && x.n >= 1).map(x => ({ id: x.id, n: Math.floor(x.n) }))
  return s.length ? s : undefined
}
