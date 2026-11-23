// M110 s1 (sprites, 2026-11-23, owner + ?spirits=3d only): THE PER-SPIRIT STAT RECORD, beside the fed record (spirit-feed.ts),
// keyed by the same planter id. No React, no three. Canon (game/shimmer-battles.md › How stats grow: TRAINING FURNITURE, Magii
// RULED athernyx 3a77c87): party spirits PLAY at training furniture as they please; each piece leans to ONE stat (PWR / GRD /
// AGI / VIG); a stat never passes the form's cap (Base 50 / 2nd 75 / Awakened 100), only evolving lifts it.
// The record holds only what PLAY added (`g`, per stat), so a spirit starts from her species' base (engine/party-stats.ts
// SPECIES_STATS_V2) and a later species rebalance still reads through. Value = base + g.
//  - nothing drains, nothing decays, no timers: the record only ever counts up, and only through play.
//  - a species whose base is ALREADY past the cap (e.g. the firefly's AGI 70 in a Base form) is never lowered and never rises.
import { gardenKey } from '@/lib/keeper-local'
import { SPECIES_STATS_V2 } from '../../engine/party-stats'
import type { Species } from '../../spirits/spirit'

/** the four stats a training piece can lean to (canon: PWR / GRD / AGI / VIG) */
export const TRAIN_STATS = ['pwr', 'grd', 'agi', 'vig'] as const
export type TrainStat = typeof TRAIN_STATS[number]
export const isTrainStat = (s: unknown): s is TrainStat => typeof s === 'string' && (TRAIN_STATS as readonly string[]).includes(s)
/** canon stat caps by form */
export const FORM_CAP = { base: 50, second: 75, awakened: 100 } as const
export type Form = keyof typeof FORM_CAP
/** DIAL: stat points one play adds (Jin's). A Base spirit 16 under the cap reaches it in 16 plays. */
export const TRAIN = { gain: 1 }

export type StatRec = { form: Form; g: Partial<Record<TrainStat, number>>; plays: number }
export type StatBook = Record<string, StatRec>
type StatKey = keyof typeof SPECIES_STATS_V2[Species]

/** a spirit's value for one stat: species base + what play added */
export const statValue = (sp: Species, rec: StatRec | undefined, k: StatKey): number => SPECIES_STATS_V2[sp][k] + (isTrainStat(k) ? rec?.g[k] ?? 0 : 0)
/** pure: what one play adds to a stat at `cur` under `cap`: never past the cap, nothing for one at or over it (never lowered) */
export function gainFor(cur: number, cap: number, gain: number): number {
  if (!(gain > 0) || !(cur < cap)) return 0
  return Math.min(gain, cap - cur)
}
/** pure: the book after spirit `id` (species `sp`) played at a piece leaning to `stat`. `rose` = what the stat gained (0 at cap). */
export function withPlay(b: StatBook, id: string, sp: Species, stat: TrainStat, gain = TRAIN.gain): { book: StatBook; rose: number } {
  const rec: StatRec = b[id] ?? { form: 'base', g: {}, plays: 0 }
  const rose = gainFor(statValue(sp, rec, stat), FORM_CAP[rec.form], gain)
  const next: StatRec = { form: rec.form, g: { ...rec.g, ...(rose > 0 ? { [stat]: (rec.g[stat] ?? 0) + rose } : {}) }, plays: rec.plays + 1 }
  return { book: { ...b, [id]: next }, rose }
}

const KEY = 'ather.spiritStats.v1'
const subs = new Set<() => void>()
export function loadStats(): StatBook {
  try {
    const v = JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? '{}')
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: StatBook = {}
    for (const [id, r] of Object.entries(v as Record<string, Partial<StatRec>>)) {
      if (!r || typeof r !== 'object') continue
      const g: StatRec['g'] = {}
      for (const k of TRAIN_STATS) { const n = Number(r.g?.[k]); if (n > 0) g[k] = n }
      out[id] = { form: r.form && r.form in FORM_CAP ? r.form : 'base', g, plays: Math.max(0, Number(r.plays) || 0) }
    }
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
