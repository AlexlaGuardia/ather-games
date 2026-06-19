// Party-forked stat model — physical/spirit split (Alex, 2026-06-19).
//
// The party combat path uses 6 stats instead of the 1v1 engine's 4, so spirits split
// into physical and spirit (non-physical) attack/defense. A spirit can wall one damage
// type and fold to the other → every archetype has a niche, and the skill is reading the
// foe's weaker defense and hitting it.
//
//   pwr / grd  = physical attack / defense   (used by solid + compact moves)
//   foc / res  = spirit  attack / defense    (used by ignite/flow/scatter/expanding/bind)
//   agi        = speed → turn order AND evasion (so fast-frail spirits survive if played right)
//   vig        = vigor  → HP
//
// This file is SELF-CONTAINED and does NOT touch battle.ts — the live 1v1 keeps its own
// stats/damage until it's retired. Stat stages still cover only pwr/grd/agi/vig (the moves
// that buff/debuff target those); foc/res are unstaged for v1.

import type { Species, Spirit } from '../spirits/spirit'
import type { Move, BattleElement, StatusId, CombatStat } from './moves'
import { getEffectiveness, hasSTAB, toBattleElement } from './moves'

export interface PartyStats {
  pwr: number; grd: number; foc: number; res: number; agi: number; vig: number
  maxHp: number
}

// ── Archetypes (Alex-approved 2026-06-19) — pwr grd foc res agi vig ──
// Each line is a ROLE. The two walls (water-bear=physical, turtle=spirit) are the clearest
// expression of the split. Tuned against party-battle.sim's species matrix.
export const SPECIES_STATS_V2: Record<Species, Omit<PartyStats, 'maxHp'>> = {
  // FOC ceiling compressed to PWR's range (was 84/66 → casters out-scaled physical leaguewide,
  // and 5/7 move-states are already spirit-category). Now the two damage axes are at parity.
  fox:           { pwr: 54, grd: 40, foc: 36, res: 36, agi: 52, vig: 44 }, // balanced phys skirmisher
  axolotl:       { pwr: 25, grd: 46, foc: 44, res: 52, agi: 30, vig: 54 }, // spirit sustain wall (tamed bulk)
  owl:           { pwr: 30, grd: 38, foc: 50, res: 46, agi: 48, vig: 44 }, // spirit attacker / caster
  frog:          { pwr: 60, grd: 36, foc: 28, res: 32, agi: 58, vig: 46 }, // physical sweeper
  firefly:       { pwr: 28, grd: 26, foc: 62, res: 30, agi: 70, vig: 38 }, // spirit glass cannon (alpha-striker)
  rabbit:        { pwr: 48, grd: 42, foc: 30, res: 44, agi: 50, vig: 50 }, // physical bruiser (bulk, not speed)
  'water-bear':  { pwr: 34, grd: 70, foc: 26, res: 48, agi: 16, vig: 64 }, // physical wall
  hummingbird:   { pwr: 56, grd: 26, foc: 48, res: 30, agi: 72, vig: 38 }, // hyper-fast mixed evader
  turtle:        { pwr: 38, grd: 56, foc: 36, res: 64, agi: 16, vig: 60 }, // spirit wall / pivot
  bat:           { pwr: 44, grd: 34, foc: 50, res: 40, agi: 60, vig: 42 }, // fast spirit skirmisher
}

// Temperament nudges (physical + speed + hp axis; foc/res flat for v1). [pwr,grd,agi,vig]
const TEMPERAMENT_MODS: Record<string, [number, number, number, number]> = {
  bold: [1.1, 0.95, 0.95, 1.0], calm: [0.95, 1.05, 0.95, 1.05], swift: [0.95, 0.9, 1.15, 1.0],
  sturdy: [0.95, 1.15, 0.9, 1.0], bright: [1.05, 1.0, 1.05, 0.9], neutral: [1, 1, 1, 1],
}

/** Derive party stats from a spirit. Soft curve (no harsh cap that flattened the 1v1 model),
 *  lean HP so speed/evasion/hitting-the-weak-defense decide fights. seeds[0-5] → the 6 stats. */
export function derivePartyStats(spirit: Spirit): PartyStats {
  const base = SPECIES_STATS_V2[spirit.species]
  const k = 1 + spirit.level / 60
  const seeds = spirit.seeds ?? []
  const mods = TEMPERAMENT_MODS[spirit.temperament] ?? TEMPERAMENT_MODS.neutral
  const grow = (v: number, seed: number, mod = 1) => Math.round((v * k + (seed ?? 0) * spirit.level / 120) * mod)
  const pwr = grow(base.pwr, seeds[0], mods[0])
  const grd = grow(base.grd, seeds[1], mods[1])
  const agi = grow(base.agi, seeds[2], mods[2])
  const vig = grow(base.vig, seeds[3], mods[3])
  const foc = grow(base.foc, seeds[4])
  const res = grow(base.res, seeds[5])
  return { pwr, grd, foc, res, agi, vig, maxHp: Math.round(vig * 1.6 + 15) }
}

// ── Move category from canon MoveState ──
const PHYS_STATES = new Set(['solid', 'compact'])
export function moveCategory(move: Move): 'phys' | 'spirit' {
  return PHYS_STATES.has(move.state) ? 'phys' : 'spirit'
}

// ── Effective stat with stages (physical/agi only; foc/res unstaged) ──
const STAGE_MULT = [0.33, 0.5, 0.66, 0.8, 1.0, 1.25, 1.5, 2.0, 3.0]
function stageMult(stage: number): number { return STAGE_MULT[Math.max(0, Math.min(8, stage + 4))] }

export interface PartyDamageInput {
  pstats: PartyStats
  statStages: Record<CombatStat, number>
  element: BattleElement
  status: StatusId | null
}

function effPwr(c: PartyDamageInput, which: 'pwr' | 'grd' | 'agi'): number {
  return Math.max(1, Math.round(c.pstats[which] * stageMult(c.statStages[which])))
}

export function effectiveAgi(c: PartyDamageInput): number { return effPwr(c, 'agi') }

/** Evasion: a faster defender dodges sometimes (caps 40%). What keeps fast-frail spirits alive. */
export function partyEvades(atk: PartyDamageInput, def: PartyDamageInput): boolean {
  const gap = effectiveAgi(def) - effectiveAgi(atk)
  return Math.random() < Math.max(0, Math.min(0.28, gap * 0.006)) // tiebreaker, not a win-condition
}

export interface PartyDamageResult { damage: number; crit: boolean; effectiveness: number }

/** Category-correct damage: physical uses pwr/grd, spirit uses foc/res. STAB + element matchup
 *  + crystallize passive folded in. `level` is the attacker's (drives the level term so damage
 *  keeps pace with HP across levels). Caller checks partyEvades() first for the miss. */
export function calcPartyDamage(atk: PartyDamageInput, def: PartyDamageInput, move: Move, level: number): PartyDamageResult {
  const cat = moveCategory(move)
  const a = cat === 'phys' ? effPwr(atk, 'pwr') : atk.pstats.foc
  let d = cat === 'phys' ? effPwr(def, 'grd') : def.pstats.res
  let crystalBonus = 1
  if (def.status === 'crystallize') { d = Math.max(1, d * 0.8); crystalBonus = 1.25 }

  let dmg = ((2 * level / 5 + 2) * move.power * (a / Math.max(1, d))) / 50 + 2

  const stab = hasSTAB(atk.element, move.element) ? 1.5 : 1
  const eff = getEffectiveness(move.element, def.element)
  const crit = Math.random() < 0.0625
  const rand = 0.85 + Math.random() * 0.15
  dmg = dmg * stab * eff * crystalBonus * (crit ? 1.5 : 1) * rand
  return { damage: Math.max(1, Math.round(dmg)), crit, effectiveness: eff }
}
