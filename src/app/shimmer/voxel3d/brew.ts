// What a cauldron will and will not brew, and WHY it refuses.
//
// ★ PURE. No react/three/DOM. `engine/alchemy.ts` owns what a potion IS (canon's table, the four
// Infusions, the mana costs, the XP) and already does the brewing; this file owns the one question
// the voxel world has to answer at the block: *given this keeper, this bag, this world — what does
// pressing brew do, and if nothing, what sentence does the panel say?*
//
// ── ★ WHY A BLOCKER AND NOT A BOOLEAN (the lesson slice ④ paid for, 2026-08-18) ────────────────
// `canBrew` already exists and answers true/false. That is the right shape for the engine and the
// wrong shape for a panel: a greyed row that will not say why is how a keeper decides a feature is
// broken. The evolution pass hit this exactly — `evolutionBlocker` returns settled/too-young/
// no-infusions/tied because *"tied" is the one a keeper reads as a bug* — and the four refusals here
// are just as different from each other. Two of them mean "go do a thing", one means "wait twenty
// seconds", and one means "stop looking, it is not in this world".
//
// ── ★★ `absent` IS THE ONE THAT EXISTS FOR THIS WORLD SPECIFICALLY ─────────────────────────────
// The potion table is shared with play3d, which has fishing, an Exchange Booth, a farm and ten crops.
// The voxel world has ore, trees, and a pot. So most of canon's 17 brews name at least one ingredient
// that CANNOT BE OBTAINED HERE AT ALL — and the four flagship Infusions are among them, because their
// element herbs (Violetbloom · Stormgrass · Rootvine · Tidepetal) are farm crops and this world has
// no farming. A red `violetbloom petal 0/2` is indistinguishable from *"go and find some"*, so
// without this refusal the cauldron's most important row sends every keeper who reaches alchemy 10
// on a hunt through a world that does not contain the thing.
//
// ⚠ IT IS DERIVED, NEVER HAND-KEPT. The host passes `inWorld`, built from the same
// `BLOCKS.drops + RECIPE_OUTPUTS` set `/give` validates against — so the day herbs arrive as a crop
// or as wild flora, the warning disappears BY ITSELF and the row goes live. A hand-written list of
// "the ones we can't do yet" is the thing that would still be there a month after they shipped.

import { POTION_DEFS, getVisiblePotions, elementForInfusion, type PotionDef } from '../engine/alchemy'
import { stationBlocker, type StationDef, type StationRecipe } from './station'
import { MAT } from '../voxel/depth'

/**
 * The cauldron, as a station.
 *
 * ★ THE LADDER MOVED OUT AND THE REASONING WENT WITH IT (2026-08-29). Every argument this file's
 * header makes about the ORDER of refusals — absent before level, room before spending, the
 * self-healing cost last — turned out to be about stations in general rather than about alchemy, so
 * it lives in `station.ts` now and every future station inherits it instead of re-deriving it.
 * What stayed here is what is genuinely alchemy's: canon's menu window, the Infusion label, and the
 * `absent` set that exists because this world has no farming.
 *
 * ★ `replenishing` IS THE LOAD-BEARING FIELD. Mana refills on its own clock, which is the entire
 * reason it is checked last — a keeper three shards short is told to wait, and waiting works. A
 * station whose cost is CONSUMED must not inherit that position; see `station.ts`.
 */
export const CAULDRON: StationDef<PotionDef> = {
  id: 'cauldron',
  material: MAT.CAULDRON,
  // ⚠ CANON'S OWN WORD. `game/alchemy.md` says brewing happens in a cauldron; `depth.ts` records why
  // that matters (an invented "alchemy bench" would be a build word for a thing canon named).
  name: 'Cauldron',
  verb: 'Brew',
  cost: 'replenishing',
  menu: (level: number) => getVisiblePotions(level),
  toRecipe: (d: PotionDef): StationRecipe => ({
    id: d.id,
    inputs: d.recipe,
    outputId: d.id,
    outputCount: d.resultCount,
    minLevel: d.minAlchemyLevel,
    power: d.manaCost,
  }),
}

/**
 * Why the brew button is not going to work, or `'ok'`.
 *
 * Ordered by what the keeper should do about it, which is also the order they are checked:
 *  - `absent`      — an ingredient this world does not contain. Nothing to do at all; say so.
 *  - `level`       — canon's own progression. Nothing to do but brew what you can.
 *  - `ingredients` — you can get these; you do not have them yet.
 *  - `room`        — the bottles have nowhere to go. Empty a slot.
 *  - `mana`        — you have everything. Stand still for a moment.
 */
export type BrewBlock = 'ok' | 'level' | 'absent' | 'ingredients' | 'room' | 'mana'

/**
 * @param have    count of an item in the keeper's satchel
 * @param inWorld can this item be obtained in THIS world at all (see the header — derived, host-side)
 * @param room    how many more of an item the bag could take right now
 *
 * ★★ `room` IS CHECKED BEFORE ANYTHING IS SPENT, AND THAT IS THE WHOLE REASON IT IS A REFUSAL
 * RATHER THAN A DETAIL. A brew takes four gathered ingredients out of the bag and puts bottles back
 * in; if they do not fit, the run has destroyed the ingredients and produced nothing — and the bag
 * being full is the exact condition under which a keeper is most likely to be brewing (you brew to
 * turn a pile of rubble-grade herbs into one bottle). The chest pass settled this shape for the
 * workshop payout in the same words: *a payout that fits nowhere REFUSES rather than commits.*
 *
 * ★ MANA IS CHECKED LAST, ON PURPOSE. It is the only refusal that fixes itself: the pool refills on
 * its own clock while you stand there. Checked first, a keeper three shards short of a draught would
 * be told "not enough mana", wait for the bar, press again and get a different answer — the panel
 * would have made them wait to learn the real problem.
 */
export function brewBlocker(
  def: PotionDef,
  alchemyLevel: number,
  manaCurrent: number,
  have: (itemId: string) => number,
  inWorld: (itemId: string) => boolean,
  room: (itemId: string) => number,
): BrewBlock {
  // ★★ `absent` OUTRANKS `level`, AND THE PAGE HARNESS IS WHAT CAUGHT IT (2026-08-18).
  // I checked level first — the obvious order, since it is canon's own progression — and the four
  // Infusions are visible from alchemy 7 but gated at 10. So a keeper standing at 7 was told
  // *"alchemy 10 — you are 7"*: a promise the world cannot keep, because at 10 the row is still dead
  // for want of a herb that does not grow here. They would have ground five hundred XP toward it.
  // A refusal that will still be true after you fix it must be said FIRST; `level` is the answer
  // only when reaching that level is actually enough.
  // ★ THE LADDER IS `stationBlocker` NOW. This is a NAME ADAPTER, not a second implementation — the
  // panel's vocabulary ('ingredients', 'mana') is alchemy's and stays, while the ordering rule lives
  // in one place where a second station cannot fork it. Proven byte-identical over an exhaustive
  // 21,420-row grid: see `brew.test.ts` s extraction hash.
  const b = stationBlocker(CAULDRON, def, alchemyLevel, manaCurrent, have, inWorld, room)
  return b === 'inputs' ? 'ingredients' : b === 'power' ? 'mana' : b
}

/**
 * The ingredients in this recipe that this world does not produce, in recipe order.
 *
 * The panel names them rather than printing "unavailable": *"these lands grow no violetbloom petal"*
 * is a fact a keeper can carry, and it is also the exact sentence that tells the next person reading
 * a bug report which system is missing (here, farming) instead of which bottle looked broken.
 */
export function absentInputs(def: PotionDef, inWorld: (itemId: string) => boolean): string[] {
  return def.recipe.filter(r => !inWorld(r.itemId)).map(r => r.itemId)
}

/**
 * What the cauldron's panel lists, in canon's own order.
 *
 * ★ THE SAME LEVEL+3 WINDOW THE OTHER WORLD USES (`getVisiblePotions`), NOT A VOXEL-SPECIFIC ONE.
 * The temptation is to show only what this world can actually make — it would be a tidier panel and
 * it would quietly delete the Infusions from the game's most important shelf. A keeper is supposed to
 * see the four of them coming at alchemy 7 and want them; what they must not do is walk away thinking
 * they already own the ingredients. So the list stays canon's and the ROW carries the bad news.
 *
 * ⚠ A brew whose ingredients are all absent is still listed. Filtering it would leave the panel
 * saying nothing at all about the flagship of the whole skill — see the header.
 */
export function cauldronMenu(alchemyLevel: number): PotionDef[] {
  return getVisiblePotions(alchemyLevel)
}

/**
 * Is this row one of canon's four elemental Infusions — the brews that are poured into a SPIRIT
 * rather than drunk by the keeper? The panel labels them differently because they do a different
 * thing, and a keeper who drinks their way through four tier-2 bottles looking for a buff has been
 * lied to by a list.
 *
 * ⚠ ASKS `elementForInfusion`, NEVER THE SPELLING. `ather_infusion` is a tier-4 player buff with
 * nothing to do with the elemental spine, and an `endsWith('_infusion')` test sweeps it in — the
 * exact trap `engine/alchemy.ts` warns about at that function, one file over. I wrote the spelling
 * test first and it was wrong within four minutes of being written.
 */
export const isInfusionBrew = (potionId: string): boolean => elementForInfusion(potionId) !== null

/** Every potion id, for the reachability oracle. */
export const ALL_BREWS: readonly string[] = Object.keys(POTION_DEFS)
