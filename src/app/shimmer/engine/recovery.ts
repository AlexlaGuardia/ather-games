// recovery.ts — how a keeper gets back what a fight took.
//
// ── ★★★ THE SHAPE ALEX RULED (2026-08-27) ────────────────────────────────────────────────────────
// Three rules, and they only make sense together:
//   · HEALTH knits on its own, slowly, a short while after the last hit. It is the thing you cannot
//     buy back, so it comes back for free and it comes back late.
//   · SHIELD does NOT return on its own any more. You FOCUS — a held action that pours mana into a
//     buffer at a price per point, interruptible by being hit or by moving.
//   · MANA therefore stops being flavour and becomes the survival resource, which is why its rate
//     was raised in the same breath.
//
// ⚠ WHAT THIS REPLACES, STATED PLAINLY BECAUSE IT WAS THE ONLY RECOVERY IN THE GAME. The voxel world
// regenerated SHIELD at 17/sec once you had been out of contact for 3s, and healed HP never. So the
// inversion is total: the thing that came back free now costs mana and attention, and the thing that
// never came back now does. A keeper who disengages still recovers — that is the behaviour the
// collar ruling wants and it is preserved — but disengaging now buys health, not armour.
//
// ⚠⚠ FOCUS IS NOT BARRIER, AND THE DISTINCTION IS FILED WITH MAGII RATHER THAN ASSUMED. Canon's
// Barrier is a rune-gated passive: *"a held defensive shell that disperses impact"* — it REDUCES
// incoming damage continuously while worn (`CastSpec.resist`). Focus is universal and builds a POOL
// that damage spends first (`vitals.damage` soaks shield before health). One is a multiplier, one is
// a quantity. If Magii rules the overlap too close, the lever is here and it is one constant.

/** Seconds after the last wound before health begins to knit. */
export const HP_CALM_S = 6
/** Fraction of `hpMax` returned per second once calm. ~60s from near-death to full. */
export const HP_REGEN_FRAC = 0.015
/** Shield points a focusing keeper raises per second. */
export const FOCUS_SHIELD_PER_SEC = 25
/** Mana spent per point of shield raised. Above 1 so armour is never free. */
export const FOCUS_MANA_PER_SHIELD = 1.2

/**
 * Health returned this tick. Zero while the wound is fresh, zero at full, never negative.
 *
 * ⚠ TAKES SECONDS-SINCE-DAMAGE, NOT A TIMESTAMP. The two worlds keep different clocks — the voxel
 * world runs on `state.clock.elapsedTime` and play3d on `performance.now()` — and a rule that took
 * an absolute time would silently be right in one and wrong in the other. This is the same trap the
 * bag's expiries hit; the caller owns its clock and hands over an interval.
 */
export function hpRegenTick(hp: number, hpMax: number, sinceDamageS: number, dt: number): number {
  if (hp <= 0 || hp >= hpMax) return 0
  if (sinceDamageS < HP_CALM_S) return 0
  return Math.min(hpMax - hp, hpMax * HP_REGEN_FRAC * dt)
}

export interface FocusTick {
  /** Shield points to add. */
  shield: number
  /** Mana to spend for them. */
  mana: number
  /** Why nothing happened, for the say line. `null` when it did. */
  refused: 'full' | 'no-mana' | null
}

/**
 * One tick of focusing. Pure: says what to move, moves nothing.
 *
 * ⚠ IT IS CLAMPED BY MANA *AND* BY THE SHIELD CAP, IN THAT ORDER, AND THE ORDER MATTERS. Clamping to
 * the cap first and then to mana would let a keeper pay full price for the last sliver of a shield
 * that was already nearly full. Clamping to affordable first means you are never charged for shield
 * you did not receive.
 */
export function focusTick(
  shield: number, shieldMax: number, mana: number, dt: number,
): FocusTick {
  if (shield >= shieldMax) return { shield: 0, mana: 0, refused: 'full' }
  const wanted = FOCUS_SHIELD_PER_SEC * dt
  const affordable = mana / FOCUS_MANA_PER_SHIELD
  const gained = Math.min(wanted, affordable, shieldMax - shield)
  if (gained <= 0) return { shield: 0, mana: 0, refused: 'no-mana' }
  return { shield: gained, mana: gained * FOCUS_MANA_PER_SHIELD, refused: null }
}
