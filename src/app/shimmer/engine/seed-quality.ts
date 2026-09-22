// A crop line that got looked after — the PRIME seed.
//
// ★ PURE. No inventory, no three, no host state: ids, rolls and rates, testable on their own.
//
// ── ★ WHAT ALEX ASKED FOR, AND WHAT THE GENRE SAYS ABOUT IT ──────────────────────────────────
// Alex, 2026-09-22: *"give crops seed drops to keep the flow going with a chance depending on how
// well it was tended to drop a premium seed of that crop which then has a guarantee of dropping
// more premium seeds."* Built, with one correction that keeps it from collapsing — see PRIME_BACK.
//
// The two games that ship this bracket the design, and neither goes as far as a free guarantee:
//   · **Palia** — QualityUp fertilizer gives +50% star chance and keeps the harvest AMOUNT the
//     same; a star seed does not guarantee alone, seed + fertilizer stack toward 100%.
//   · **Stardew** — quality does not propagate AT ALL: a gold crop makes exactly the same seeds as
//     a base one. The genre's blunt answer to the closed loop is to break heredity outright.
// So heredity here is deliberately stronger than either, because a line you can lose by accident
// is not the feel Alex asked for — and it is made safe by the count rather than by the chance.
//
// ── ★★ WHY "FED" AND NOT "WELL TENDED" — THE MEASURE HAD NO GRADIENT ─────────────────────────
// The obvious reading of *"how well it was tended"* is the fraction of a crop's life under care,
// and the integrator in `watering.ts` already computes exactly that. **It would have been a
// constant.** That file says it plainly: *"Crops take 5–16 minutes and the day is 24h, so in
// practice: water the beds once when you come out in the morning, sow all day."* One pour covers a
// crop's whole life about a hundred times over, so a care fraction is ~100% for everybody, always,
// and a prime chance scaled by it would fire on every harvest and mean nothing.
//
// ★ So it keys to the SCARCE care act. The bed brew is one bottle per bed per day and costs a real
// recipe; water is free and unlimited. Feeding is therefore the only tending decision a keeper
// actually makes, which is what makes it the honest input — and it makes the fertilizer system
// load-bearing instead of a small growth bonus nobody needed.
//
// ── ★ CANON: THIS AXIS PAYS IN VALUE, NEVER IN POTENCY ───────────────────────────────────────
// `CANON/game/alchemy.md` (Q3, ruled) grades ingredients by *where a thing was got, not by who
// planted it* — common = gardening AND easy foraging, rare = deep wilderness — and states outright:
// ***"Do not build a wild/cultivated quality axis"***, with any future axis keying to **depth of
// country**. It then hands Jin *"whether a quality axis is built at all, and every number in it."*
// A tended-vs-neglected grade is not the forbidden wild-vs-farmed one, but it WOULD collapse
// canon's near/deep seam if a home-grown prime crop made a more potent infusion — the whole point
// of that seam is that potency is the reward for going far. So the prime line pays in yield and
// in heredity, and **nothing here touches infusion potency**. Logged as a gap for Magii.

import type { CropDef } from '../voxel/crops'

/**
 * ⚠ `prime` IS A BUILD WORD AND IS EXPECTED TO BE RENAMED. The adjective a keeper reads on an item
 * is world vocabulary, which is Magii's, exactly as the water vessel's noun was before Alex ruled
 * "Clay Jug" live. Canon's existing quality words (*weak / potent*) are spoken for by infusions and
 * would be actively misleading here, since this axis must NOT touch potency. The ids below are what
 * the save stores, so a ruling renames the LABEL and never the id — `watering.ts`'s own precedent.
 */
export const PRIME_SUFFIX = '_prime'

/** The prime seed for a base seed id. Id-carried, like `vessel_<noun>_t<tier>`. */
export const primeSeedId = (seedItemId: string): string =>
  seedItemId.endsWith(PRIME_SUFFIX) ? seedItemId : seedItemId + PRIME_SUFFIX

/** The ordinary seed a prime one descends from; unchanged for a seed that is already ordinary. */
export const baseSeedId = (seedItemId: string): string =>
  seedItemId.endsWith(PRIME_SUFFIX) ? seedItemId.slice(0, -PRIME_SUFFIX.length) : seedItemId

export const isPrimeSeed = (seedItemId: string): boolean => seedItemId.endsWith(PRIME_SUFFIX)

/**
 * The chance an ORDINARY crop hands back a prime seed.
 *
 * ⚠ ZERO WHEN UNFED, AND THAT IS THE DESIGN RATHER THAN A HARSH NUMBER. Palia gives an unfertilised
 * crop a 25% base star chance; here water is free and universal, so a non-zero unfed chance would
 * make the prime line arrive on its own and feeding would only change how fast. Feeding IS the
 * decision, so it is the whole gate.
 */
export const PRIME_CHANCE_FED = 0.25
export const PRIME_CHANCE_UNFED = 0
/** A little for mastery, so a high farming level is felt here too. Capped so it never reaches 1. */
export const PRIME_CHANCE_PER_LEVEL = 0.01
export const PRIME_CHANCE_CAP = 0.5

export function primeSeedChance(fed: boolean, levelAboveMin: number): number {
  if (!fed) return PRIME_CHANCE_UNFED
  return Math.min(PRIME_CHANCE_CAP, PRIME_CHANCE_FED + Math.max(0, levelAboveMin) * PRIME_CHANCE_PER_LEVEL)
}

/**
 * ── ★★★ THE CORRECTION THAT KEEPS THE LOOP OPEN ──────────────────────────────────────────────
 * Alex's *"guarantee of dropping more premium seeds"* is kept exactly — a prime crop ALWAYS returns
 * at least one prime seed, so a line can never be lost to bad luck. But a guarantee alone is a
 * CLOSED LOOP: one prime seed would mean prime forever, tending would stop mattering the instant it
 * fired, and a per-harvest reward would have quietly become a one-time unlock.
 *
 * ★ So the guarantee is on the KIND and the growth is on the COUNT. Neglect a prime line and it
 * returns exactly 1 and stays flat for ever; feed it and it returns 2 and multiplies. Tending
 * therefore matters on every single harvest for the whole life of the line, which is the thing the
 * feature was for. This is `SEED_BACK`'s own shape (one always, a second on a roll), pointed at
 * quality instead of quantity.
 */
export const PRIME_BACK_BASE = 1
export const PRIME_BACK_BONUS_FED = 1

export const primeSeedsBack = (fed: boolean): number =>
  PRIME_BACK_BASE + (fed ? PRIME_BACK_BONUS_FED : 0)

/**
 * What a prime seed is worth in the ground: a bigger harvest of the SAME produce.
 *
 * ⚠ MORE OF THE SAME ITEM, NOT A DIFFERENT ITEM, and that is a deliberate scope line rather than a
 * shortcut. A distinct "prime carrot" would be a new id, and every recipe, gift and craft names the
 * ORDINARY id — so prime produce would be unusable in the very recipes its ordinary twin feeds, and
 * a keeper holding only prime produce would be strictly worse off. Premium PRODUCE waits until an
 * ingredient check can accept a prime item as its base (`canAfford` / `spendMaterials` / the host's
 * `have` closure — three sites, already scouted). Until then the prime line is felt as abundance.
 */
export const PRIME_YIELD_MULT = 1.5

/** The produce count a prime planting gives, from the count an ordinary one would have given. */
export const primeYield = (count: number): number => Math.max(1, Math.round(count * PRIME_YIELD_MULT))

/**
 * Every prime seed the game can contain — derived from the crop table, never hand-listed.
 * ⚠ A hand-kept list here is the bug this repo has paid for repeatedly: a crop added next month
 * would silently have no prime line and nothing would say so. `seed-quality.test` holds the pairing.
 */
export const primeSeedIdsFor = (defs: readonly CropDef[]): string[] =>
  defs.filter(d => !d.bloomsSpirit).map(d => primeSeedId(d.seedItemId))
