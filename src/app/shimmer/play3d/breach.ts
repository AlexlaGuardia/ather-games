// breach.ts — the bore: a held channel spent against one spot until the spot stops existing.
//
// ★ PURE. No react, no three, no DOM. Sits beside `sustain.ts`, which supplies the seconds this
// module spends — mana buys seconds, seconds buy hardness, and neither step is free.
//
// ── CANON, `moves.md:82` (Meltbore — Magma) ─────────────────────────────────────────────────────
//   "Molten focus held against one spot until the spot stops existing. Slow, undramatic, and
//    nothing refuses it forever — the breach move, and the reason a Magma mage is patient."
//
// Four claims in one sentence, and every rule below is one of them: it is HELD, it is against ONE
// SPOT, it is SLOW, and NOTHING REFUSES IT.
//
// ── ★★★ "NOTHING REFUSES IT FOREVER" IS A PRECISE STATEMENT ABOUT THE TOOL GATES ────────────────
// `registry.ts` › `breakSeconds` returns Infinity for THREE different reasons, and they are not the
// same kind of thing at all:
//
//   1. `def.hardness === Infinity`   — the material is not matter (water, cloud-wall, conjured)
//   2. `toolSkill !== def.skill`     — wrong tool family entirely
//   3. `toolTier < def.minTier`      — *"too weak — refused, not slowed"*
//
// 2 and 3 are refusals BY A TOOL. Canon says the bore is not refused, and the reason is simply that
// **a bore has no tool**: there is no family to mismatch and no tier to fall short of. So it spends
// its seconds against raw `hardness` and ignores both gates. That is the whole move — where a
// keeper with the wrong pick is told no, a Magma mage is told *wait*.
//
// ⚠⚠ REASON 1 IS NOT A REFUSAL AND MUST NOT BE TREATED AS ONE. `hardness: Infinity` is how this
// world spells *"this is not a thing that can stop existing"* — water, cloud-wall, and `MAT.CONJURED`
// all carry it, and the registry says so in its own words: *"`hardness: Infinity` ⇒ `breakSeconds`
// returns Infinity ⇒ `canBreak` is false. That single value..."* Honouring it needs no canon ruling
// from me and creates no exception: the bore asks the same question mining asks and gets the same
// answer, because the answer is about the material rather than about who is asking.
// ★ A pleasant consequence that nobody designed: a Stonewall is `MAT.CONJURED`, so conjured matter
//   is the one thing a bore cannot chew through. Stonewall answers Meltbore, for free.
//
// ── ★★ AND IT IS `absolute`, NOT SILENCE ────────────────────────────────────────────────────────
// A player holding a channel against water must be TOLD, not left to wonder whether it is slow.
// Progress on an absolute block does not creep and does not accumulate — a bar that fills toward
// something unreachable is worse than no bar. Same honesty rule `cast-dispatch` applies to refusals.
//
// ── ⚠ IT YIELDS NOTHING, ON PURPOSE ─────────────────────────────────────────────────────────────
// A bore ignores both tool gates, so if it dropped what mining drops it would BE mining — a strictly
// better pick that needs no tools, no skill and no tier, and the whole progression underneath
// `registry.ts` would evaporate. Canon's words are *"until the spot stops existing"*, not "until you
// have it". The spot stops existing. That is the entire product.

import { blockDef } from '../voxel/registry'

/**
 * How much slower a bore is than a bare-handed tier-1 tool on the same block.
 *
 * ★ A MAGNITUDE, SO IT IS JIN'S — but the reason it is above 1 is canon's: *"Slow, undramatic, and
 * ... the reason a Magma mage is patient."* At 1.0 the bore would match a basic tool while ignoring
 * every gate, which makes patience free and the word "slow" decorative. The trade a player should
 * feel is: slower than the right tool, and it works where the right tool does not exist.
 */
export const BORE_PATIENCE = 1.6

/** A voxel, by integer coordinate. */
export interface BoreTarget { x: number; y: number; z: number }

/** A bore in progress. `at` is the ONE SPOT; `spent` is channel-seconds sunk into it. */
export interface Bore {
  at: BoreTarget | null
  spent: number
}

export const freshBore = (): Bore => ({ at: null, spent: 0 })

export const sameSpot = (a: BoreTarget | null, b: BoreTarget | null): boolean =>
  !!a && !!b && a.x === b.x && a.y === b.y && a.z === b.z

/**
 * Seconds of channel this material costs a bore.
 *
 * ⚠ Deliberately NOT `breakSeconds`: that function's job is to apply the tool gates, and the bore's
 * defining property is that they do not apply to it. It reads the same `hardness` from the same
 * registry row, so the two can never disagree about how hard a rock is — only about who may.
 */
export function boreSeconds(material: number): number {
  const def = blockDef(material)
  if (!def) return Infinity              // unknown material — fail closed, never bore a mystery
  // ⚠ THIS LINE LOOKS REDUNDANT AND IS NOT — a mutation sweep proved it by failing to break
  // anything when removed. `Infinity * 1.6` is still `Infinity`, so the arithmetic below happens to
  // cover the absolute case TODAY, for a reason that has nothing to do with intent. The day
  // `BORE_PATIENCE` is ever 0, `Infinity * 0` is **NaN**, every comparison against it is false, and
  // the bore would report `boring` forever at `NaN` progress against a block made of water — a
  // channel that can never finish and never says so. Keep the guard; it is the statement of intent,
  // and the arithmetic is a coincidence.
  if (def.hardness === Infinity) return Infinity
  return def.hardness * BORE_PATIENCE
}

/** Whether a material is the kind of thing that can stop existing at all. */
export const isBorable = (material: number): boolean => boreSeconds(material) !== Infinity

export type BoreState =
  | 'idle'      // nothing aimed at
  | 'boring'    // sinking seconds into a spot
  | 'broke'     // the spot stopped existing, this frame
  | 'absolute'  // this material is not matter; holding will never finish, and the host must say so

export interface BoreStep {
  bore: Bore
  state: BoreState
  /** 0..1 for a readout. Always 0 when `absolute` — never a bar that fills toward nothing. */
  progress: number
}

/**
 * Advance a bore by the seconds a channel actually paid for.
 *
 * `credited` comes from `sustain.ts` › `sustainStep().credited`, which is only ever the time the
 * keeper's mana covered. So an empty pool bores nothing, and the chain mana → seconds → hardness has
 * no free step anywhere along it.
 *
 * ★★ AIMING AT A DIFFERENT VOXEL RESETS THE PROGRESS, AND THAT IS CANON'S "ONE SPOT". Without it a
 * player could sweep the reticle across a wall and collapse the whole thing on accumulated time that
 * belonged to no particular block — patience would stop being the cost, and the move would become a
 * fast area-clear, which is the opposite of what canon describes.
 */
export function boreStep(b: Bore, target: BoreTarget | null, material: number, credited: number): BoreStep {
  if (!target) return { bore: freshBore(), state: 'idle', progress: 0 }

  // A new spot starts from nothing. Same spot keeps what it has paid for.
  const base: Bore = sameSpot(b.at, target) ? b : { at: target, spent: 0 }

  const need = boreSeconds(material)
  if (need === Infinity) {
    // ⚠ Progress is pinned at 0 rather than allowed to creep: see the header. The keeper is told.
    return { bore: { at: target, spent: 0 }, state: 'absolute', progress: 0 }
  }

  const spent = base.spent + (credited > 0 ? credited : 0)
  if (spent >= need) return { bore: freshBore(), state: 'broke', progress: 1 }
  return { bore: { at: target, spent }, state: 'boring', progress: spent / need }
}
