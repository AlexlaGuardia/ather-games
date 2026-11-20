// STATION WORK: stockpile + focus crafting at a workshop room (BETA M43; Alex 11-20 playtest: "no click-per-plank", then
// "the Moglin works a STOCKPILE, not a manual queue").
// STOCKPILE (default, the room's Moglin only): the station keeps RESERVE (30) of each RAW input in its store for the player;
// from the surplus above that it refines, ONE item's worth of input at a time, until the output holds OUT_CAP (30) of each
// product; it works one product to its stack, then swaps to the next (planks to 30, then bark to 30 ...), then idles. Only
// REFINE / STONE_REFINE / ROAST / BREW are stockpiled (cook + alchemist rooms too, M43 fold); furniture is FOCUS only.
// FOCUS (the player picks ONE job + a quantity 1/10/99/max): ignores both the reserve and the cap, uses ALL matching material in
// the store to make that item asap, then drops back to stockpile (also when the inputs run out). The Moglin works it at its
// CRAFT grade; with no Moglin the keeper works a focus themselves, only while the bench panel is open (speed 1).
// Time passes offline: `last` is a timestamp; advance() credits (now - last) * speed, bounded by inputs and the caps. Time with
// nothing to do is never banked. ★ PURE: no React, no DOM.
import { putIn } from './garden-bank'
import { REFINE, STONE_REFINE, PIECE_JOBS, type Job } from './furniture'
import { ROAST } from './cooking'
import { BREW } from './alchemy'
import type { Stack } from '../shared/inventory'
import { luckBonus } from './moglin-skills'
import type { Grade } from './moglins'

export const OUT_CAP = 30
export const RESERVE = 30
export const MAX_QTY = 99
export const QTY_PICKS = [1, 10, 99] as const

/** The station's work state. `run` = one run's inputs are out of the store and `t` ms of it are done (`f` = a focus run).
 *  `cur` = the stockpile's position in its product list. Present on a room that has been worked or focused. */
export interface Focus { job: string; left: number; /** runs asked for when it was set (the crafting panel's overall bar); absent on older saves */ of?: number }
export interface Work { focus?: Focus; run?: { job: string; t: number; f?: boolean }; cur: number; last: number }
/** what the engine reads off a Room */
export interface Station { store?: Stack[]; out?: Stack[]; work?: Work }
export type Status = 'idle' | 'working' | 'focus'

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
/** the jobs a room stockpiles: refining, plus the hearth's roasts and the cauldron's brews (M43 fold; never furniture) */
export function stockJobs(kind: string): readonly Job[] {
  return kind === 'carpentry' ? REFINE : kind === 'stonemason' ? STONE_REFINE : kind === 'cooking' ? ROAST : kind === 'alchemy' ? BREW : []
}
/** runs a quantity of OUTPUT items takes */
export const runsFor = (j: Job, qty: number) => Math.ceil(Math.max(0, Math.min(MAX_QTY, qty)) / j.out.n)
/** Max for a FOCUS: every run the store's inputs allow (ALL the matching material), in output items, capped at 99. */
export function maxAffordable(j: Job, store: readonly Stack[] | undefined): number {
  const runs = Math.min(...j.in.map(c => Math.floor(have(store, c.id) / c.n)))
  return Math.max(0, Math.min(MAX_QTY, runs * j.out.n))
}
const affords = (store: readonly Stack[] | undefined, j: Job, reserve = 0) => j.in.every(c => have(store, c.id) - reserve >= c.n)
/** the stockpile may start a run of j now: its surplus (above the reserve) pays, and the output has room for the stack */
const stockOk = (s: { store?: Stack[]; out?: Stack[] }, j: Job) => affords(s.store, j, RESERVE) && have(s.out, j.out.id) + j.out.n <= OUT_CAP

/** Start a FOCUS: `qty` output items of one job (replaces a focus not yet mid-run; a run in progress is finished first). */
export function setFocus(s: Station, job: string, qty: number, now: number): Station {
  const j = jobById(job); if (!j || !(qty >= 1)) return s
  const w: Work = { cur: 0, last: now, ...s.work, focus: { job, left: runsFor(j, qty), of: runsFor(j, qty) } }
  return { ...s, work: w }
}
/** THE RUN IN PROGRESS, live (the crafting panel's bar): `t` is banked at the last tick, the time since is worked at `speed`.
 *  Pure read, never writes: frac 0..1 of this run, ms left at that pace (Infinity when no one works it). Null = nothing running. */
export function runProgress(s: Station, now: number, speed: number): { job: Job; frac: number; msLeft: number } | null {
  const run = s.work?.run, j = run && jobById(run.job); if (!run || !j) return null
  const total = runMs(j), done = Math.min(total, run.t + (speed > 0 ? Math.max(0, now - s.work!.last) * speed : 0))
  return { job: j, frac: total > 0 ? done / total : 1, msLeft: speed > 0 ? (total - done) / speed : Infinity }
}
/** Drop the focus. A focus run in progress hands its inputs back (inputs are only ever taken for the run in progress). */
export function cancelFocus(s: Station): Station {
  const w = s.work; if (!w?.focus && !w?.run?.f) return s
  let store = s.store ?? [], run = w.run
  const j = run?.f ? jobById(run.job) : undefined
  if (run?.f && j) { for (const c of j.in) store = putIn({ v: 1, stacks: store }, BIG, c.id, c.n).bank.stacks; run = undefined }
  return { ...s, store, work: { ...w, focus: undefined, run } }
}
/** Re-start the clock (the worker changed or the stock changed): idle or unstaffed time is never banked. */
export const touch = (s: Station, now: number): Station => (s.work ? { ...s, work: { ...s.work, last: now } } : { ...s, work: { cur: 0, last: now } })

export function statusOf(s: Station, stock: readonly Job[]): Status {
  const w = s.work
  if (w?.run) return w.run.f ? 'focus' : 'working'
  const fj = w?.focus && jobById(w.focus.job)
  if (fj && affords(s.store, fj)) return 'focus'
  return stock.some(j => stockOk(s, j)) ? 'working' : 'idle'
}
/** Where a stockpiled product stands: for the panel's list (made / 30, and whether the surplus could make more). */
export const stockLine = (s: Station, j: Job) => ({ made: have(s.out, j.out.id), cap: OUT_CAP, waiting: affords(s.store, j, RESERVE) })

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

/** Move the station to `now` at `speed` (0 = nobody works it: the clock moves on, nothing is banked, no input is taken).
 *  `stock` = the jobs to stockpile (empty = focus only: the keeper's own work). Pure. `active` = there is work state worth saving. */
export function advance(s: Station, now: number, speed: number, stock: readonly Job[], luck?: { grade: Grade; rnd: () => number }): { station: Station; made: Stack[]; status: Status; active: boolean } {
  const w: Work = s.work ? { ...s.work, run: s.work.run && { ...s.work.run }, focus: s.work.focus && { ...s.work.focus } } : { cur: 0, last: now }
  let store = s.store ?? [], out = s.out ?? []
  let budget = speed > 0 ? Math.max(0, now - w.last) * speed : 0
  w.last = now
  const made: Stack[] = []
  for (let guard = 0; guard < 20000; guard++) {
    if (!w.run) {
      let pick: Job | null = null, f = false
      if (w.focus) {
        const fj = jobById(w.focus.job)
        if (!fj || w.focus.left <= 0 || !affords(store, fj)) { w.focus = undefined; continue }   // done, or the inputs ran out: back to stockpile
        pick = fj; f = true
      } else if (stock.length) {
        const st = { store, out }
        for (let k = 0; k < stock.length; k++) { const idx = (w.cur + k) % stock.length; if (stockOk(st, stock[idx])) { pick = stock[idx]; w.cur = idx; break } }
      }
      if (!pick || budget <= 0) break
      store = takeRun(store, pick)!; w.run = { job: pick.id, t: 0, ...(f ? { f: true } : {}) }
    }
    const j = jobById(w.run.job)
    if (!j) { w.run = undefined; continue }
    const need = runMs(j) - w.run.t
    if (budget >= need) {
      budget -= need
      const n = j.out.n + (luck ? luckBonus(luck.grade, luck.rnd) : 0)   // M46: a lucky run brings one extra
      out = putIn({ v: 1, stacks: out }, BIG, j.out.id, n).bank.stacks
      const m = made.find(x => x.id === j.out.id); if (m) m.n += n; else made.push({ id: j.out.id, n })
      if (w.run.f && w.focus?.job === j.id) { w.focus.left--; if (w.focus.left <= 0) w.focus = undefined }
      w.run = undefined
    } else { w.run.t += budget; budget = 0; break }
  }
  const station: Station = { ...s, store, out, work: w }
  return { station, made, status: statusOf(station, stock), active: !!(w.run || w.focus || made.length) }
}

/** Collect an output stack into somewhere (the caller gives it to the bag): `n` of `id` out of the output, or everything of it. */
export function takeOut(s: Station, id: string, n = BIG): { station: Station; took: number } {
  let left = Math.min(n, have(s.out, id)); const took = left
  const out = (s.out ?? []).map(x => ({ ...x })).filter(x => { if (x.id === id && left > 0) { const t = Math.min(left, x.n); x.n -= t; left -= t } return x.n > 0 })
  return { station: { ...s, out }, took }
}
/** put back what the bag could not take */
export const putOut = (s: Station, id: string, n: number): Station => (n > 0 ? { ...s, out: putIn({ v: 1, stacks: s.out ?? [] }, BIG, id, n).bank.stacks } : s)

/** Off disk: a save from before M43 has none; anything unreadable becomes absent too. */
export function adoptWork(v: unknown): Work | undefined {
  const w = v as Partial<Work> | null
  if (!w || typeof w !== 'object' || !Number.isFinite(w.last)) return undefined
  const f = w.focus, r = w.run
  const focus = f && typeof f.job === 'string' && jobById(f.job) && Number.isFinite(f.left) && f.left >= 1 ? { job: f.job, left: Math.min(MAX_QTY, Math.floor(f.left)), ...(Number.isFinite(f.of) && f.of! >= f.left ? { of: Math.min(MAX_QTY, Math.floor(f.of!)) } : {}) } : undefined
  const run = r && typeof r.job === 'string' && jobById(r.job) && Number.isFinite(r.t) && r.t >= 0 ? { job: r.job, t: r.t, ...(r.f ? { f: true as const } : {}) } : undefined
  return { cur: Number.isFinite(w.cur) && w.cur! >= 0 ? Math.floor(w.cur!) : 0, last: w.last!, focus, run }
}
export function adoptOut(v: unknown): Stack[] | undefined {
  if (!Array.isArray(v)) return undefined
  const s = v.filter((x): x is Stack => !!x && typeof x.id === 'string' && Number.isFinite(x.n) && x.n >= 1).map(x => ({ id: x.id, n: Math.floor(x.n) }))
  return s.length ? s : undefined
}
