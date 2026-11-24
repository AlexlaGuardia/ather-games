// M110 s1 (sprites, 2026-11-23, owner + ?spirits=3d only): THE PER-SPIRIT STAT RECORD, beside the fed record (spirit-feed.ts),
// keyed by the same planter id. No React, no three. Party spirits PLAY at training furniture as they please; each piece leans
// to ONE stat (PWR / GRD / AGI / VIG). The record holds what PLAY added (`g`, per stat) and, since M118 s1, her GROWTH
// (`xp` into the bar, `grown` = growths so far; spirit-growth.ts). Value = species base x growth + trained points.
// M118 s1 (play, 2026-11-24, canon RULED c01931e/05f3d0d): the form caps 50/75/100 are RETIRED for spirits; the base is the
// rebased low table (spirit-growth.ts SPECIES_BASE). Training stays bounded by a per-stat cap on what PLAY adds (TRAIN.cap,
// a placeholder until M118 s2's fixed, irreversible point pool). `form` stays in the record for old saves; nothing reads it.
//  - nothing drains, nothing decays, no timers: the record only ever counts up.
//  - old (M110) saves load as they are: g kept (clamped to the cap), xp 0, grown 0. No NaN reaches a value.
import { gardenKey } from '@/lib/keeper-local'
import type { Species } from '../../spirits/spirit'
import { grownStat, withExp, type BaseStat } from './spirit-growth'

/** the four stats a training piece can lean to (canon: PWR / GRD / AGI / VIG) */
export const TRAIN_STATS = ['pwr', 'grd', 'agi', 'vig'] as const
export type TrainStat = typeof TRAIN_STATS[number]
export const isTrainStat = (s: unknown): s is TrainStat => typeof s === 'string' && (TRAIN_STATS as readonly string[]).includes(s)
export type Form = 'base' | 'second' | 'awakened'
const FORMS: readonly Form[] = ['base', 'second', 'awakened']
/** DIALS (Jin's): stat points one play adds; the most PLAY may add to one stat (placeholder until M118 s2's pool) */
export const TRAIN = { gain: 1, cap: 20 }

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
/** pure: the book after spirit `id` played at a piece leaning to `stat`. `rose` = what the stat gained (0 at the play cap). */
export function withPlay(b: StatBook, id: string, _sp: Species, stat: TrainStat, gain = TRAIN.gain): { book: StatBook; rose: number } {
  const rec: StatRec = b[id] ?? blank()
  const rose = gainFor(rec.g[stat] ?? 0, TRAIN.cap, gain)
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
/** a play finished: add its gain to the record and tell the panel. Returns what the stat rose by. */
export function trainPlay(id: string, sp: Species, stat: TrainStat): number {
  const r = withPlay(loadStats(), id, sp, stat); saveStats(r.book); return r.rose
}
/** M118 s1: a Hollow went down with spirits `ids` beside the keeper: their bars fill. Returns the ids that grew stronger. */
export function fightExp(ids: readonly string[], exp: number): string[] {
  if (!ids.length) return []
  const r = withFight(loadStats(), ids, exp); saveStats(r.book); return r.grew
}
