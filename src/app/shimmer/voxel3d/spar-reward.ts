// What a spar PAYS — the last piece of the 2026-08-09 mist ruling that was left to Jin.
//
// ★ THE CONSTRAINT CANON SETS, and every number below is that constraint in arithmetic: **a spar
// takes nothing.** `mist-encounter.ts` holds the half of that sentence about the other spirit — no
// capture, no roster addition, ever. This file holds the other half: nothing leaves the GROUND
// either. No marks, no materials, no drop. play3d already rules that a wild spirit carries no purse
// (marks come from the liberation holds, a broken hold's spoils); mist is weather, not a container,
// so a patch that paid out loot would be a chest that happens to fight back — and the fog wall, the
// consent design and the withdrawal would all be dressing on a farm.
//
// So a spar pays exactly what practice pays, and ALL of it is internal to the party: the spirit got
// better at fighting (XP), and keeper and spirit read each other a little quicker (bond). Shimmer IS
// the Alkin's practice game and a mist patch is where you practise — the payout is the feature's
// own thesis stated in two numbers. If a third number ever wants to join them, check first that it
// is not smuggling loot into a place canon said has none.
//
// ★ WHY THE CURVE IS BORROWED AND NOT INVENTED. The fraction-of-the-bar shape comes from play3d's
// battle-end block (`Shimmer3D.tsx`), which exists because flat XP stopped visibly moving the bar
// past ~L15 against a quadratic curve — Alex's dew bear caught that one. Re-deriving a second curve
// here would let the two drift apart until an hour of sparring and an hour of fighting paid
// incomparable amounts. Same shape, smaller fraction, and the reason for the smaller fraction is
// stakes: a patrol can take your marks and a hold gates the story, while a spar risks nothing but
// the walk home.

import { addXP, xpForLevel, type Spirit } from '../spirits/spirit'

/** Bar-fraction one same-level opponent pays EACH ally on a won spar. play3d's wild fight pays 0.08. */
export const SPAR_XP_FRAC = 0.05
/**
 * What a LOST spar still pays, as a fraction of the won one. Practice teaches you when it goes badly
 * — that is most of what practice is for, and a mist patch is the one place in the game where losing
 * is meant to be instructive rather than purely punitive.
 *
 * It is not farmable: a loss means the whole party went down, so it costs real mend potions, and the
 * patch goes quiet for `WITHDRAW_MS` either way. Losing is strictly the slower road.
 */
export const SPAR_LOSS_FRAC = 0.35
/** Coaching a spirit through a spar. play3d's win pays 4; a spar is lighter contact. */
export const SPAR_BOND_WIN = 2
export const SPAR_BOND_LOSS = 1
export const SPAR_HAPPINESS_WIN = 2
/** Floor, so a low-level spar never reads as "nothing happened". */
export const SPAR_XP_MIN = 3

export type SparOutcome = 'win' | 'lose' | 'fled'

/**
 * XP paid to EACH ally that took the field — per-ally, never divided. A shared victory is shared,
 * which is also what keeps a four-spirit party from levelling four times slower than a solo one.
 *
 * ⚠ FLIGHT PAYS NOTHING, deliberately. A withdrawal costs the party no HP and no items, so any
 * positive number here would be a free tick every `WITHDRAW_MS` per patch for walking up and walking
 * away — the degenerate loop that consolation XP invites. Nothing was practised, so nothing is paid.
 */
export function sparXp(allyLevels: number[], enemyLevels: number[], outcome: SparOutcome): number {
  if (outcome === 'fled') return 0
  if (!allyLevels.length || !enemyLevels.length) return 0
  const avgAlly = Math.max(1, allyLevels.reduce((s, l) => s + l, 0) / allyLevels.length)
  // Scales with the level RELATION, not the raw level: punching up pays up to 2×, stomping something
  // far below you pays a quarter. ★ LIVE SINCE 2026-08-10 — a resident's level is the REGION's now,
  // not the party's average (mist-difficulty.ts), so this term finally does something: walking out
  // to stiffer mist pays for it, and farming the gentlest patch you can reach decays toward the
  // floor. That is the whole reward for progress the absolute-band doctrine exists to protect.
  const raw = enemyLevels.reduce((s, lv) => {
    const diff = Math.min(2, Math.max(0.25, lv / avgAlly))
    return s + xpForLevel(avgAlly) * SPAR_XP_FRAC * diff
  }, 0)
  return Math.max(SPAR_XP_MIN, Math.round(raw * (outcome === 'win' ? 1 : SPAR_LOSS_FRAC)))
}

export interface SparRow {
  name: string
  xp: number
  fromLevel: number
  toLevel: number
}

/**
 * Pay the party for the spar it just had. MUTATES the spirits (the caller persists them to the
 * shared save) and returns one row per ally for the ledger the HUD shows.
 *
 * `allies` must be the exact objects that FOUGHT — the same discipline play3d's battle end uses, so
 * a dev-conjured throwaway roster can never write XP into the real save.
 */
export function applySparPayout(allies: Spirit[], enemies: Spirit[], outcome: SparOutcome): SparRow[] {
  const xp = sparXp(allies.map(a => a.level), enemies.map(e => e.level), outcome)
  if (xp <= 0) return []
  const rows: SparRow[] = []
  for (const s of allies) {
    const fromLevel = s.level
    addXP(s, xp)
    s.bond = Math.min(255, s.bond + (outcome === 'win' ? SPAR_BOND_WIN : SPAR_BOND_LOSS))
    if (outcome === 'win') s.happiness = Math.min(255, s.happiness + SPAR_HAPPINESS_WIN)
    rows.push({ name: s.name, xp, fromLevel, toLevel: s.level })
  }
  return rows
}

/** The HUD line for a finished spar. Null when nothing was paid — no banner beats an empty one. */
export function sparLedgerLines(rows: SparRow[]): string[] | null {
  if (!rows.length) return null
  return rows.map(r => r.toLevel > r.fromLevel
    ? `${r.name}  +${r.xp} xp  ·  level ${r.toLevel}`
    : `${r.name}  +${r.xp} xp`)
}
