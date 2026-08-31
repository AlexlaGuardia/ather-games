// sustain.ts — a cast that is HELD: it runs while the key is down and bills by the second.
//
// ★ PURE. No react, no three, no DOM, no refs — same rule as `cast.ts`, `tremor-sense.ts` and
// `engine/cast-dispatch.ts`. It lives in `play3d/` because that is already where the SHARED cast
// layer lives (`engine/cast-dispatch.ts` imports `play3d/cast`), not because it belongs to play3d.
//
// ── CANON ───────────────────────────────────────────────────────────────────────────────────────
// Sustained casting is a category canon names in its own right, not a meltbore special case:
//   · `runes.md:948` — *"Sustained casting (holding a barrier, maintaining a technique)"*
//   · `runes.md:85`  — *"maintain — burns mana fast"*
//   · `runes.md:1057` — Barrier-class passives *"drain you while held"*
// And the move this was built for, `moves.md:82`: *"Molten focus held against one spot until the
// spot stops existing. Slow, undramatic, and nothing refuses it forever."*
//
// ⚠⚠ WHAT IT DELIBERATELY IS NOT: a long cooldown, or a cast that fires N times. The whole point of
// canon's *"slow, undramatic, and nothing refuses it forever"* is that the resource being spent is
// TIME, continuously, and the thing being bought is progress that a tap cannot buy at any price. A
// channel modelled as a repeating cast would let a player mash for the same result, which deletes
// the one property canon gives the move.
//
// ── ★★★ THE THREE RULES, AND EACH ONE IS A BUG THAT WOULD NOT LOOK LIKE ONE ─────────────────────
//   1. **TIME IS ONLY CREDITED FOR MANA ACTUALLY PAID.** `held` is what a breach, a bore or a beam
//      will eventually read to decide whether it is done. If a channel could accrue seconds it did
//      not pay for, a keeper with an empty pool would finish the same bore as a keeper with a full
//      one — slower, but free. The drain would still LOOK correct in a mana bar the whole time.
//   2. **A PARTIAL SECOND IS PAID FOR AND CREDITED PARTIALLY.** The frame the pool runs dry is not
//      free and is not full: you get exactly the fraction you could afford. Anything else is a
//      rounding gift or a rounding theft at the one moment the player is watching the bar.
//   3. **THE COOLDOWN STARTS ON RELEASE, NEVER ON PRESS.** Starting it at the press makes a ten
//      second channel cost the same recovery as a tap — which quietly makes holding strictly better
//      than tapping, for free, and nothing on screen would say so.

/** A channel in flight. Created by `beginSustain`, advanced by `sustainStep`, closed by the host. */
export interface Sustain {
  moveId: string
  slot: number
  /**
   * Seconds of channel the keeper has actually PAID for. This is the number a breach reads.
   * ⚠ Not wall-clock since the press — see rule 1.
   */
  held: number
  /** Total mana spent so far. Kept for an honest readout; nothing branches on it. */
  paid: number
}

/** Why a channel stopped. Never null at the moment it ends, so a host cannot drop the reason. */
export type SustainEnd =
  | 'released'  // the key came up — the ordinary case
  | 'dry'       // the pool ran out mid-channel; canon's "burns mana fast"
  | 'broken'    // the host interrupted it (a status, a death, a world change)

export const beginSustain = (slot: number, moveId: string): Sustain =>
  ({ moveId, slot, held: 0, paid: 0 })

export interface SustainStep {
  sustain: Sustain
  /** Mana the host must deduct this frame. Never more than the pool it was given. */
  manaSpent: number
  /** Seconds credited this frame — `dt`, or the fraction that could be afforded. */
  credited: number
  /** Non-null exactly on the frame the channel stops. */
  ended: SustainEnd | null
}

/**
 * Advance a held channel by one frame.
 *
 * `mana` is the pool as it stands NOW; `drain` is the spec's cost per second. The caller applies
 * `manaSpent` afterwards — this function never mutates anything, so a host can run it twice (a
 * prediction and a commit) and get the same answer.
 *
 * ⚠ A NON-POSITIVE `drain` ENDS THE CHANNEL RATHER THAN RUNNING IT FREE. A move with no drain is
 * not a sustained move, and a free infinite channel is the most expensive possible way to find that
 * out. Same fail-closed instinct as the empty-secret rule: a missing cost must stop the thing, not
 * make it free.
 */
export function sustainStep(s: Sustain, dt: number, mana: number, drain: number): SustainStep {
  const idle: SustainStep = { sustain: s, manaSpent: 0, credited: 0, ended: null }
  if (!(dt > 0)) return idle                                    // a stalled or backwards frame
  if (!(drain > 0)) return { ...idle, ended: 'broken' }          // not a sustained move — see above
  if (!(mana > 0)) return { ...idle, ended: 'dry' }              // nothing left to burn

  const want = drain * dt
  if (mana >= want) {
    return {
      sustain: { ...s, held: s.held + dt, paid: s.paid + want },
      manaSpent: want,
      credited: dt,
      ended: null,
    }
  }

  // Rule 2 — the last, partial frame. Buy the fraction the pool can afford, credit exactly that,
  // and end. `mana / drain` is safe: `drain > 0` is established above.
  const afford = mana / drain
  return {
    sustain: { ...s, held: s.held + afford, paid: s.paid + mana },
    manaSpent: mana,
    credited: afford,
    ended: 'dry',
  }
}

/**
 * When the channel's cooldown expires, given the moment it STOPPED.
 *
 * ★ Rule 3 lives here rather than in the host so neither world can get it wrong on its own, and so
 * it is assertable. Takes the release instant explicitly rather than reading a clock, for the same
 * reason `CastEnv` takes `now`: a test must be able to sit at an exact moment.
 */
export const sustainCooldownUntil = (releasedAt: number, cooldownMs: number): number =>
  releasedAt + cooldownMs
