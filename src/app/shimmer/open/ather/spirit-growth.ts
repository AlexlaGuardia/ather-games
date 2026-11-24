// BETA M118 s1 (play, 2026-11-24): SPIRIT GROWTH, PURE (no React, no DOM, no storage). Canon RULED athernyx c01931e /
// 05f3d0d (game/shimmer-battles.md › How stats grow, re-ruled 11-24): species base spreads are FIXED (no roll) and rebased
// LOW; spirits that fight Hollows beside the keeper fill a GROWTH BAR; a full bar = she has grown stronger (every stat up
// along her species' curve); levels are HIDDEN (no number anywhere); each bar asks more than the last; the hidden ceiling is
// 9999; what a growth adds TAPERS so the ceiling is huge but bounded. Form caps 50/75/100 are retired for spirits.
//  - SPECIES_BASE = the live party table's SHAPE (engine/party-stats.ts SPECIES_STATS_V2, the archetypes Alex approved
//    06-19) mapped onto the low band: 10 + 0.3 x the old value, so 16..72 becomes 15..32 and each species' signature stat
//    stays its highest. Fixed per species; the old 1v1/party battle engine keeps SPECIES_STATS_V2 for its own sims.
//  - growthMult(n) = 1 + (MULT-1) * ln(1 + n/K) / ln(1 + MAX_GROWN/K): 1 at bloom, MULT at the ceiling, strictly rising and
//    concave (each growth adds less than the one before). Values are real; the panel rounds.
//  - expNeed(n) = what bar n asks: strictly rising (n + n^1.5/4 on top of a first bar of 4), so 9999 is nearly impossible.
// Words (★ SIGNED athernyx 1be3a9f, shimmer-lines-batch-2026-11-24a.md › D; lines-batch-24a.test.ts): the bar label 'Growth', the moment '{name} has grown stronger.'
import { SPECIES_STATS_V2 } from '../../engine/party-stats'
import type { Species } from '../../spirits/spirit'

export const BASE_STATS = ['pwr', 'grd', 'foc', 'res', 'agi', 'vig'] as const
export type BaseStat = typeof BASE_STATS[number]
/** the old-table -> low-band map (Jin's dial, derived once; the table below is its fixed output) */
export const rebase = (v: number) => Math.round(10 + 0.3 * v)
/** FIXED species base: no RNG, the same for every spirit of a species */
export const SPECIES_BASE: Record<Species, Record<BaseStat, number>> = Object.fromEntries(
  (Object.keys(SPECIES_STATS_V2) as Species[]).map(sp => [sp, Object.fromEntries(BASE_STATS.map(k => [k, rebase(SPECIES_STATS_V2[sp][k])]))]),
) as Record<Species, Record<BaseStat, number>>

/** DIALS (Jin's): MULT = how many times her base a spirit at the ceiling stands; K = how early the curve bends */
export const GROWTH = { MULT: 9, K: 10, MAX_LEVEL: 9999, KILL_EXP: 1, CHAMP_EXP: 10 }
/** growths a spirit can ever have: the hidden level runs 1..MAX_LEVEL, so MAX_LEVEL - 1 growths */
export const MAX_GROWN = GROWTH.MAX_LEVEL - 1

const clampGrown = (n: number) => Math.max(0, Math.min(MAX_GROWN, Math.floor(Number.isFinite(n) ? n : 0)))
/** how many times her base she stands after `n` growths */
export function growthMult(n: number): number {
  const g = clampGrown(n)
  return 1 + (GROWTH.MULT - 1) * Math.log(1 + g / GROWTH.K) / Math.log(1 + MAX_GROWN / GROWTH.K)
}
/** EXP bar n asks (n = growths so far). Infinity at the ceiling: the bar never fills again. */
export function expNeed(n: number): number {
  const g = clampGrown(n)
  if (g >= MAX_GROWN) return Infinity
  return 4 + g + Math.floor(g ** 1.5 / 4)
}
/** a stat's grown value (real): species base x her growth */
export const grownStat = (sp: Species, k: BaseStat, grown: number) => SPECIES_BASE[sp][k] * growthMult(grown)

export type Growth = { xp: number; grown: number }
/** pure: `exp` earned. Carries over full bars (several growths at once is fine); stops at the ceiling. */
export function withExp(g: Growth, exp: number): { g: Growth; grew: number } {
  let xp = Math.max(0, Number.isFinite(g.xp) ? g.xp : 0) + (exp > 0 && Number.isFinite(exp) ? exp : 0), grown = clampGrown(g.grown), grew = 0
  while (grown < MAX_GROWN && xp >= expNeed(grown)) { xp -= expNeed(grown); grown++; grew++ }
  if (grown >= MAX_GROWN) xp = 0
  return { g: { xp, grown }, grew }
}
/** the bar's fill, 0..1 (1 at the ceiling). The only thing the panel shows of her growth: never a level number. */
export function barFill(g: Growth | undefined): number {
  const grown = clampGrown(g?.grown ?? 0)
  if (grown >= MAX_GROWN) return 1
  return Math.max(0, Math.min(1, (g?.xp ?? 0) / expNeed(grown)))
}

/** player-facing words (UNSIGNED, lark draft aa22eef; @lark to sign) */
export const GROWTH_LABEL = 'Growth'
export const grownLine = (name: string) => `${name} has grown stronger.`
