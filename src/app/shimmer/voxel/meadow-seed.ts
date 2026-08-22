// What a tuft of grass gives up — the front door's seed supply.
//
// ★ PURE. Read by `registry.ts` to build the grass drop tables, and by the oracles.
//
// ── ★★★ RULED 2026-08-22 (/magii + Alex): A GRASS TUFT YIELDS A COMMON CROP SEED ───────────────
// `game/shimmer-geography.md` › *★ A grass tuft yields a common crop seed*. The reason is the one
// canon already had: `world/flora.md` rules that all plant life here evolved from fungal ancestors
// — *"They LOOK like plants. They ARE fungi. Everything is one organism."* A meadow tuft and a wheat
// crop are not two species trading a seed; they are **one body fruiting twice**. A tuft handing over
// `seed_shimmerwheat` is offering what it already is.
//
// It also replaces something that had to go. Grass used to drop a generic `mana_seed`, and canon
// retired that model on 08-13: there are **ten** Mana Seeds, one per base form, and a seed already
// IS its species from the moment the Bloom cast it. So `mana_seed` named a thing canon does not
// have — a category error, not a balance problem. Deleting the drop outright would have been the
// other legal fix and it was the wrong one: the ruling **sanctions the finding** (*"the randomness
// lives in the wind and in the finding"*), so the find survives and only what is found changes.
//
// ⚠⚠ THE CONSTRAINT IS CANON AND IT IS THE WHOLE SHAPE OF THE FEATURE: **common crop seeds only.
// Never a Mana Seed — that is a spirit. Never one of the four element herbs** — those have their own
// ruled ground (basin · highland · woodland · shore) and handing them to anyone standing on grass
// would collapse the one thing that makes a herb *a reason to travel*.
import { CROP_DEFS, ELEMENT_HERBS } from './crops'

/**
 * The crops a meadow will offer, DERIVED — never hand-listed.
 *
 * ★ THREE CONDITIONS, EACH CARRYING ITS OWN REASON, so the day a crop is added it lands on the right
 * side without anyone remembering this file exists:
 *  · **tier 1** — a tuft is the beginning of the ladder, not a shortcut up it. Tier 2+ crops want
 *    their own source, which is a later question and deliberately not answered here.
 *  · **not `bloomsSpirit`** — the Mana Bloom pays out a SPIRIT. Canon's accounting for those is
 *    ceremonial and tiny (Greg's gift, two hold awards); grass cannot mint them.
 *  · **not an element herb** — canon ruled their ground, and this would undo it.
 *
 * ⚠ A HAND-WRITTEN LIST WOULD HAVE BEEN THREE NAMES AND WOULD HAVE BEEN WRONG WITHIN A MONTH — that
 * is this codebase's most-repeated failure this week (five stale enumerations in four days). The
 * oracle asserts the exclusions hold rather than asserting the three names.
 */
const HERB_CROPS: ReadonlySet<string> = new Set(Object.values(ELEMENT_HERBS).map(h => h.cropId))

/**
 * The rule itself, as a pure predicate over one crop.
 *
 * ⚠⚠ EXPORTED SO THE ELEMENT-HERB GUARD CAN BE FALSIFIED, and that is not tidiness. A mutation sweep
 * deleted `!isHerb` and **every assert stayed green** — because all four element herbs are tier 2
 * today, so the tier filter already excludes them and the canon guard is dominated. That makes the
 * ruling *"never one of the four element herbs"* enforced by an unrelated coincidence rather than by
 * this line, and a guard that cannot fail is indistinguishable from one that does not work.
 *
 * ★ The dominance is INCIDENTAL, not structural — canon could rule a tier-1 herb tomorrow and the
 * coincidence would evaporate silently, in the permissive direction. So the predicate takes its herb
 * set as a parameter and the oracle feeds it a synthetic tier-1 herb to prove the guard fires. Same
 * answer as the den anchor's dominated waterline check, one step further: that one was labelled
 * because it could not be reached; this one can be, so it is tested instead of excused.
 */
export const isMeadowCrop = (
  c: { id: string; tier: number; bloomsSpirit?: boolean },
  herbCrops: ReadonlySet<string> = HERB_CROPS,
): boolean => c.tier === 1 && !c.bloomsSpirit && !herbCrops.has(c.id)

export const MEADOW_CROPS: readonly string[] = Object.values(CROP_DEFS)
  .filter(c => isMeadowCrop(c))
  .map(c => c.id)

/** The seed items those crops are planted from — what a tuft actually hands over. */
export const MEADOW_SEEDS: readonly string[] = MEADOW_CROPS.map(id => CROP_DEFS[id].seedItemId)

/**
 * Chance per seed, per tuft broken.
 *
 * ⚠ MINE TO TUNE, AND IT REPLACES A RATE THAT WAS TUNED FOR A DIFFERENT KIND OF THING. The old
 * `MANA_SEED_CHANCE` was **1/2500** because the payout was a spirit — a lifetime event. A crop seed
 * is a consumable at the bottom of the ladder, and the beginner brew it feeds (`harvest_brew`) wants
 * shimmerwheat ×5 and glowroot ×3 against a yield of 2 per harvest, so a keeper needs roughly four
 * plantings to brew once. At 1/12 per seed per tuft, that is a few minutes in the grass rather than
 * an afternoon — findable without being litter.
 *
 * ★ EACH SEED ROLLS INDEPENDENTLY (`dropsFor` walks every entry), so one tuft can give two kinds and
 * usually gives none. That is deliberate: a table that picks exactly one winner per tuft makes the
 * rarer crops feel like they are competing with the common ones, which they are not.
 */
export const MEADOW_SEED_CHANCE = 1 / 12

/** The drop-table entries a grass block carries. Spread into `drops` beside the block's own item. */
export const meadowSeedDrops = (): { itemId: string; count: number; chance: number }[] =>
  MEADOW_SEEDS.map(itemId => ({ itemId, count: 1, chance: MEADOW_SEED_CHANCE }))
