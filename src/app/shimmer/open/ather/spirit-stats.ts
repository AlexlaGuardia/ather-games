// M110 s1 (sprites, 2026-11-23, owner + ?spirits=3d only): THE PER-SPIRIT STAT RECORD, beside the fed record (spirit-feed.ts),
// keyed by the same planter id. No React, no three. Party spirits PLAY at training furniture as they please; each piece leans
// to ONE stat (PWR / GRD / AGI / VIG). The record holds what PLAY added (`g`, per stat) and, since M118 s1, her GROWTH
// (`xp` into the bar, `grown` = growths so far; spirit-growth.ts). Value = species base x growth + trained points.
// M118 s1 (play, 2026-11-24, canon RULED c01931e/05f3d0d): the form caps 50/75/100 are RETIRED for spirits; the base is the
// rebased low table (spirit-growth.ts SPECIES_BASE). `form` stays in the record for old saves; nothing reads it.
// M118 s2 (play, 2026-11-24, canon c01931e/05f3d0d item 3): THE TRAINING POOL. Each spirit has a FIXED pool of training points
// (TRAIN.pool) and a per-stat cap (TRAIN.cap); a play at a piece spends from it, IRREVERSIBLY (nothing here ever lowers `g`
// or refunds a point). Only a spirit the keeper has ASSIGNED to a piece trains there (train-assign.ts); within that she still
// plays as she pleases. previewPlay() is what a play WILL spend, and withPlay() spends exactly that (the panel shows it first).
//  - nothing drains, nothing decays, no timers: the record only ever counts up.
//  - old (M110) saves load as they are: g kept (clamped to the cap), xp 0, grown 0. No NaN reaches a value.
import { gardenKey } from '@/lib/keeper-local'
import type { Species } from '../../spirits/spirit'
import { grownStat, withExp, type BaseStat } from './spirit-growth'
import { loadAssign, mayUse } from './train-assign'   // M118 s2: the keeper's assign-a-piece gate

/** the four stats a training piece can lean to (canon: PWR / GRD / AGI / VIG) */
export const TRAIN_STATS = ['pwr', 'grd', 'agi', 'vig'] as const
export type TrainStat = typeof TRAIN_STATS[number]
export const isTrainStat = (s: unknown): s is TrainStat => typeof s === 'string' && (TRAIN_STATS as readonly string[]).includes(s)
export type Form = 'base' | 'second' | 'awakened'
const FORMS: readonly Form[] = ['base', 'second', 'awakened']
/** DIALS (Jin's): stat points one play adds (= points it spends); a spirit's whole training pool; the most one stat may take */
export const TRAIN = { gain: 1, pool: 40, cap: 20 }

export type StatRec = { form: Form; g: Partial<Record<TrainStat, number>>; plays: number; xp?: number; grown?: number }
export type StatBook = Record<string, StatRec>

/** a spirit's value for one stat (real; the panel rounds): species base x her growth + what play added */
export const statValue = (sp: Species, rec: StatRec | undefined, k: BaseStat): number =>
  grownStat(sp, k, rec?.grown ?? 0) + (isTrainStat(k) ? rec?.g[k] ?? 0 : 0)
/** pure: what one play adds to a stat that play has already raised by `trained`, under the play cap `cap` (never lowers) */
export function gainFor(trained: number, cap: number, gain: number): number {
  if (!(gain > 0) || !(trained < cap)) return 0
  return Math.min(gain, cap - trained)
}
const blank = (): StatRec => ({ form: 'base', g: {}, plays: 0, xp: 0, grown: 0 })
/** points already spent (= everything play has added) */
export const poolSpent = (rec: StatRec | undefined) => TRAIN_STATS.reduce((n, k) => n + (rec?.g[k] ?? 0), 0)
/** points left in her pool (never below 0) */
export const poolLeft = (rec: StatRec | undefined) => Math.max(0, TRAIN.pool - poolSpent(rec))
export type PlayPreview = { stat: TrainStat; spend: number; from: number; to: number; left: number; why: 'ok' | 'cap' | 'pool' }
/** pure: what ONE play at a piece leaning to `stat` will spend, BEFORE it is spent: the points, the stat before/after (as the
 *  panel shows it, rounded), the pool after. why = 'cap' (this stat is at its limit) / 'pool' (no points left) when spend is 0. */
export function previewPlay(rec: StatRec | undefined, sp: Species, stat: TrainStat, gain = TRAIN.gain): PlayPreview {
  const left0 = poolLeft(rec), byCap = gainFor(rec?.g[stat] ?? 0, TRAIN.cap, gain), spend = Math.min(byCap, left0)
  const v = statValue(sp, rec, stat)
  return { stat, spend, from: Math.round(v), to: Math.round(v + spend), left: left0 - spend, why: spend > 0 ? 'ok' : byCap <= 0 ? 'cap' : 'pool' }
}
/** pure: the book after spirit `id` played at a piece leaning to `stat`. `rose` = what the stat gained = previewPlay().spend. */
export function withPlay(b: StatBook, id: string, sp: Species, stat: TrainStat, gain = TRAIN.gain): { book: StatBook; rose: number } {
  const rec: StatRec = b[id] ?? blank()
  const rose = previewPlay(rec, sp, stat, gain).spend
  const next: StatRec = { ...rec, g: { ...rec.g, ...(rose > 0 ? { [stat]: (rec.g[stat] ?? 0) + rose } : {}) }, plays: rec.plays + 1 }
  return { book: { ...b, [id]: next }, rose }
}
/** pure: spirits `ids` earned `exp` fighting beside the keeper. `grew` = the ids whose bar filled (each may grow more than once). */
export function withFight(b: StatBook, ids: readonly string[], exp: number): { book: StatBook; grew: string[] } {
  const book = { ...b }, grew: string[] = []
  for (const id of ids) {
    const rec = book[id] ?? blank(), r = withExp({ xp: rec.xp ?? 0, grown: rec.grown ?? 0 }, exp)
    book[id] = { ...rec, xp: r.g.xp, grown: r.g.grown }
    if (r.grew > 0) grew.push(id)
  }
  return { book, grew }
}
/** pure: one stored record (any shape: an M110 save, a hand-edited one, junk) -> a clean record, or null */
export function parseRec(r: unknown): StatRec | null {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null
  const o = r as Record<string, unknown>, gin = (o.g && typeof o.g === 'object' ? o.g : {}) as Record<string, unknown>
  const g: StatRec['g'] = {}
  for (const k of TRAIN_STATS) { const n = Number(gin[k]); if (n > 0) g[k] = Math.min(TRAIN.cap, n) }
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0 }
  const form = FORMS.includes(o.form as Form) ? o.form as Form : 'base'
  return { form, g, plays: Math.floor(num(o.plays)), xp: num(o.xp), grown: Math.floor(num(o.grown)) }
}

const KEY = 'ather.spiritStats.v1'
const subs = new Set<() => void>()
export function loadStats(): StatBook {
  try {
    const v = JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? '{}')
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: StatBook = {}
    for (const [id, r] of Object.entries(v as Record<string, unknown>)) { const rec = parseRec(r); if (rec) out[id] = rec }
    return out
  } catch { return {} }
}
export function saveStats(b: StatBook) {
  try { localStorage.setItem(gardenKey(KEY), JSON.stringify(b)) } catch { /* private mode: this session only */ }
  for (const f of subs) f()
}
export const subscribeStats = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
/** a play finished at piece `pieceId`: if the keeper assigned her there, spend from her pool and tell the panel. Returns
 *  what the stat rose by (0 = not assigned / nothing left to spend). */
export function trainPlay(id: string, sp: Species, stat: TrainStat, pieceId: string): number {
  if (!mayUse(loadAssign(), pieceId, id)) return 0
  const r = withPlay(loadStats(), id, sp, stat); saveStats(r.book); return r.rose
}
/** M118 s1: a Hollow went down with spirits `ids` beside the keeper: their bars fill. Returns the ids that grew stronger. */
export function fightExp(ids: readonly string[], exp: number): string[] {
  if (!ids.length) return []
  const r = withFight(loadStats(), ids, exp); saveStats(r.book); return r.grew
}
