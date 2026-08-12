// vitals.ts — keeper health, shields, and the ONE order in which damage lands.
//
// ★ PURE. No react, no three, no refs. Third extraction on the same seam as `weapons.ts` (guns) and
// `cast-dispatch.ts` (casting): the rules travel, the state does not.
//
// ── ★ WHY THIS LEFT Shimmer3D (2026-08-12) ──────────────────────────────────────────────────────
// Alex ruled HP + shields into the voxel world: "100hp and another 100 barrier shields (the barrier
// birth rune affords an extra 25 to their base)". Every one of those numbers ALREADY EXISTED in
// play3d — `MAX_HP`, `MAX_SHIELD`, `BARRIER_SHIELD_BONUS`, and a `hurtPlayer` that had been tuned
// against real fights. Writing a second health model for the voxel world would have produced two
// worlds that disagree about what a hit does, which is the failure the guns extraction was created
// to prevent and the reason it is worth doing this a third time rather than typing four constants.
//
// ── ★ THE ORDER IS THE WHOLE FILE ───────────────────────────────────────────────────────────────
//   resist (a held stance) → shield → the SPILL reaches HP
// It has to be one function because both halves of it are easy to get subtly wrong in ways nothing
// visibly breaks: apply resist after the shield and a Barrier stance protects only your health;
// forget the spill and a 90-damage hit onto a 10-point shield costs you 10 instead of 10-and-80.
// play3d found this the hard way — its comment records that unifying its two damage sources was
// what stopped a counter-hit leaving HP at 0 with the run still live.
//
// ── BOUNDARY ────────────────────────────────────────────────────────────────────────────────────
// The 100/100/+25 spread and the Apex-style "two bars, 200 effective" shape are Alex's. Which RUNE
// grants which lean is canon (`birth-affinity.ts`, transcribed from CANON/game/shimmer-birth-rune.md).
// The arithmetic below is Jin's.

import type { Affinity } from '../play3d/birth-affinity'

/** Health and shields each count 100 — 200 effective, Apex-style. Alex's number, verbatim. */
export const MAX_HP = 100
export const MAX_SHIELD = 100

/**
 * The Barrier birth rune's extra shield: 125 total for that mage.
 *
 * ⚠ THIS IS NOT BARRIER-ONLY, AND THE GENERALISATION IS ALREADY CANON. `birth-affinity.ts` gives
 * EVERY rune a lean, and `defense` (+25 shield) covers Barrier AND Stone, while `vitality` (+25 HP)
 * covers Life. So the rule Alex stated for one rune is the rule the table already applies to a
 * family — read the caps off the affinity via `capsFor`, never off a rune id, or the day Stone stops
 * granting its shield nobody will know why.
 */
export const BARRIER_SHIELD_BONUS = 25

export interface Vitals {
  hp: number
  hpMax: number
  shield: number
  shieldMax: number
}

/** Caps implied by a keeper's birth affinity. The single place a bonus becomes a number. */
export function capsFor(affinity: Pick<Affinity, 'hpBonus' | 'shieldBonus'> | null | undefined): {
  hpMax: number; shieldMax: number
} {
  return {
    hpMax: MAX_HP + (affinity?.hpBonus ?? 0),
    shieldMax: MAX_SHIELD + (affinity?.shieldBonus ?? 0),
  }
}

/** A keeper at full, for the caps their birth rune implies. */
export function freshVitals(affinity?: Pick<Affinity, 'hpBonus' | 'shieldBonus'> | null): Vitals {
  const { hpMax, shieldMax } = capsFor(affinity)
  return { hp: hpMax, hpMax, shield: shieldMax, shieldMax }
}

export interface DamageResult {
  vitals: Vitals
  /** How much the held stance absorbed before anything was touched. */
  resisted: number
  /** How much the shield soaked. */
  toShield: number
  /** How much reached health. */
  toHp: number
  /**
   * HP hit zero. ⚠ REPORTED, NOT ACTED ON — what "down" means is host policy (play3d resets to full
   * and restarts the run; the voxel garden may well want something gentler). A pure rule that also
   * respawned you would force both worlds to share a death they have not agreed on.
   */
  downed: boolean
}

/**
 * The ONE place a keeper takes damage. Every source must route here — a stance that applies to
 * Hollow drain but not to a guard orb is a bug you only find by being killed by the wrong thing.
 *
 * `resist` is 0..1 from the held stance (Barrier .35, Bulwark .55, Iron Skin .45).
 */
export function damage(v: Vitals, raw: number, resist = 0): DamageResult {
  const r = Math.min(1, Math.max(0, resist))
  const dmg = Math.max(0, raw) * (1 - r)
  const toShield = Math.min(v.shield, dmg)
  const spill = dmg - toShield
  const toHp = Math.min(v.hp, spill)
  const hp = v.hp - toHp
  return {
    vitals: { ...v, hp, shield: v.shield - toShield },
    resisted: Math.max(0, raw) - dmg,
    toShield,
    toHp,
    downed: hp <= 0,
  }
}

/** Restore health and/or shield, each clamped to its own cap. Mend, potions, a bed, a dawn. */
export function heal(v: Vitals, hpAmount = 0, shieldAmount = 0): Vitals {
  return {
    ...v,
    hp: Math.min(v.hpMax, v.hp + Math.max(0, hpAmount)),
    shield: Math.min(v.shieldMax, v.shield + Math.max(0, shieldAmount)),
  }
}

/**
 * Re-cap an existing keeper when their affinity changes (the owner rune-swap dev tool, or a rune
 * granted mid-run). Current values follow the cap DOWN but are never topped up — gaining a rune
 * should not be a free full heal mid-fight.
 */
export function recap(v: Vitals, affinity?: Pick<Affinity, 'hpBonus' | 'shieldBonus'> | null): Vitals {
  const { hpMax, shieldMax } = capsFor(affinity)
  return { hp: Math.min(v.hp, hpMax), hpMax, shield: Math.min(v.shield, shieldMax), shieldMax }
}
