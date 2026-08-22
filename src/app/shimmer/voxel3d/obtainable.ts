// What this world can actually put in a keeper's hands. ONE derivation, one home.
//
// ★ PURE. No react/three/DOM. Imported by `voxel3d/VoxelWorld.tsx` (the `/give` allowlist and the
// cauldron's honesty gate), by `voxel3d/brew.ts`'s callers, and by the oracles.
//
// ── ★★★ WHY THIS FILE EXISTS: THE SAME BUG SHIPPED FIVE TIMES (2026-08-22) ──────────────────────
// This set used to be a `const` inside `VoxelWorld.tsx` that enumerated its sources by hand. Every
// time the world grew a NEW way to obtain something, the set did not hear about it, and the failure
// is silent and directional: the cauldron greys out a brew a keeper CAN already make and tells them
// to go and find an ingredient they are holding. **Wrong in the direction that sends people away.**
//
//   1. herbs shipped as wild flora   → the four Infusions read "not in these lands" (fixed 08-18)
//   2. rinning shipped               → four catches read absent (found 08-22)
//   3. `brew.test.ts` kept a hand-kept MIRROR of the set, stale the same way, so the copy and its
//      source AGREED PERFECTLY AND WERE BOTH WRONG (found 08-22)
//   4. `recipes.test.ts` exempted rinning from its reachability sweep on an expired premise
//   5. FELLING — `TREE_NODES.dawnwood` drops `crystallized_sap` at 25%, so `ather_infusion` and
//      `dawn_cordial` were greyed out while the ingredient grew on trees.
//
// ⚠ FOUR OF THE FIVE WERE THE SET BEING WRONG; THE THIRD WAS A COPY OF IT AGREEING THAT IT WAS
// RIGHT. Agreement between a copy and its original is not evidence about either — so the fix is not
// a better mirror, it is **no mirror**: one exported derivation that every reader imports.
//
// ⚠ THE REMAINING HOLE, STATED RATHER THAN LEFT TO BE FOUND: a source that never registers here is
// still invisible. `obtainable.test.ts` asserts every table this file names is fully covered, which
// makes a REGRESSION impossible and a brand-new unregistered source merely unlikely. **When you add
// a way to obtain an item, add it here** — that is the whole contract, and it is one file now
// instead of three.
import { BLOCKS, ALL_BLOCKS, materialForItem } from '../voxel/registry'
import { RECIPE_OUTPUTS, RECIPES, canCraft, type RecipeDef, type Station } from '../voxel/recipes'
import { TREE_NODES, saplingItem, logItem } from '../voxel/tree-node'
import { SPECIES } from '../voxel/trees'
import { RIN_TIERS } from '../engine/rin-catch'
import { CROP_DEFS } from '../engine/farming'

/** Everything a block hands over when it is broken. */
export const FROM_BLOCKS: readonly string[] = BLOCKS.flatMap(b => b.drops.map(d => d.itemId))

/**
 * Everything a cast pulls out of the water.
 *
 * ⚠ A RIN CATCH IS NOT A BLOCK DROP AND NEVER WILL BE — water is `placeable:false, drops:[]` on
 * purpose. Any reachability set derived from `BLOCKS` alone is structurally incapable of seeing
 * rinning, which is why the sweep in `recipes.test.ts` exempted the skill rather than failing on it.
 */
export const FROM_RINNING: readonly string[] = RIN_TIERS.flatMap(t => [...t.items])

/**
 * Everything felling a tree yields — the trunk, the sapling, and the species' secondary.
 *
 * ★ THE SECONDARIES ARE THE HALF THAT GOT MISSED, and they are not decoration: `crystallized_sap`
 * (dawnwood, 25%) is the sole input gating `ather_infusion` and `dawn_cordial`. Felling is its own
 * verb with its own yield table, and `fellTree` is the only thing that reads it.
 */
export const FROM_FELLING: readonly string[] = [
  ...Object.values(TREE_NODES).map(d => d.secondary.itemId),
  ...SPECIES.map(s => saplingItem(s.id)),
  ...SPECIES.map(s => logItem(s.id)),
]

/**
 * Every source that costs a keeper nothing but the going and getting — break it, cast for it, fell
 * it, or make it out of what you broke.
 *
 * ★ IT EXISTS AS ITS OWN LIST SO THAT FARMING CAN ASK IT A QUESTION, and that is the only reason.
 * A crop's yield is obtainable only if its SEED is, so `FROM_FARMING` has to read the rest of the
 * world before it can answer. Writing that list out a second time inside the farming derivation is
 * the **mirror** — the fourth costume of the 08-22 sweep, and the one that manufactures a green:
 * a copy and its source agree perfectly right up until a fifth source lands in one of them.
 * One list, read twice.
 */
const BEFORE_FARMING: readonly string[] = [
  ...FROM_BLOCKS,
  ...RECIPE_OUTPUTS,
  ...FROM_RINNING,
  ...FROM_FELLING,
]

/**
 * Everything the ground gives back for a seed you put in it.
 *
 * ── ★★★ THE SIXTH INSTANCE, AND THE HEADER ABOVE NAMED THE HOLE IT CAME THROUGH ────────────────
 * *"a source that never registers here is still invisible... When you add a way to obtain an item,
 * add it here."* Farming shipped on the front door on 2026-08-22 — grass yields `seed_shimmerwheat`
 * / `seed_glowroot` / `seed_sunpetal`, a crafted bed takes one, and `harvestBed` → `harvestCrop`
 * puts `shimmerwheat_grain` / `glowroot_bulb` / `sunpetal_bloom` in the satchel. The set did not
 * hear about it. So the cauldron greyed out `harvest_brew` — **lv2, 18 xp, the second-cheapest rung
 * on a ladder whose open complaint is that alchemy 10 costs 1151 xp with brewing the only source**
 * — and told a keeper to go and find an ingredient they were holding. Wrong in the direction that
 * sends people away, exactly like the four before it.
 *
 * ★★ GATED ON THE SEED, NOT LISTED. A crop whose seed this world has no source for is NOT
 * obtainable, and saying otherwise would break the gate in the opposite and worse direction: the
 * panel would offer a brew that cannot be made, which is a lie a keeper only discovers after
 * gathering everything else. Today that gate is load-bearing — grass yields tier-1 seeds only, so
 * Moonvine, Crystalcap and Dreamroot are correctly absent and `moonvine_tonic` / `dreamroot_elixir`
 * correctly read as out of reach. See `CANON_GAPS.md` › *MEADOW AND THE TEN CROPS*; that is a canon
 * scoping question, and the day it is ruled this derivation changes by nothing at all.
 *
 * ★ `bloomsSpirit` NEEDS NO SPECIAL CASE. The Mana Seed's `yields` is `[]` because it pays out a
 * spirit, so it contributes nothing here on its own. A branch asking about it would be a rule with
 * no work to do, and the next reader would have to check whether it still had any.
 *
 * ⚠ ONE PASS, NOT A FIXPOINT, AND THE PREMISE IS ASSERTED RATHER THAN TRUSTED — the same deal
 * `WORLD_ITEMS` makes about potions below. No crop yields a seed today, so a seed can never be
 * downstream of a harvest and one pass is complete. The day a crop returns its own seed (the
 * "reliable supply" half of canon's split, and a live design question), this needs to iterate, and
 * `obtainable.test.ts` goes red saying so instead of quietly under-reporting a crop line.
 *
 * ⚠⚠ THE SEED SOURCE IS A PARAMETER SO THE GATE CAN BE FALSIFIED, and that is not tidiness — it is
 * the `isMeadowCrop(c, herbCrops)` lesson one file over, where a mutation deleted the canon guard
 * and every assert stayed green because an unrelated filter already covered it. **A guard that
 * cannot fail is indistinguishable from one that does not work.** Feeding this every seed id in the
 * roster must admit crops that `FROM_FARMING` excludes; feeding it none must admit nothing. The
 * oracle asks it both, so the exclusion is proved rather than assumed — and it proves it without
 * naming a single crop, which is the enumeration that would have gone stale by the next ruling.
 */
export const cropYieldsFrom = (seedSource: Iterable<string>): readonly string[] => {
  const seeded = new Set(seedSource)
  return Object.values(CROP_DEFS)
    .filter(c => seeded.has(c.seedItemId))
    .flatMap(c => c.yields.map(y => y.itemId))
}

export const FROM_FARMING: readonly string[] = cropYieldsFrom(BEFORE_FARMING)

/**
 * Every item a keeper can obtain HERE by playing. No Exchange Booth — this world has none, and when
 * it grows one, it registers above and this comment changes with it.
 *
 * ⚠ POTIONS ARE DELIBERATELY EXCLUDED. They are obtainable (the cauldron makes them), but no recipe
 * in the table takes a potion as an INPUT, so leaving them out costs nothing and keeps this from
 * needing a fixpoint. `obtainable.test.ts` asserts that premise rather than trusting it.
 */
export const WORLD_ITEMS: ReadonlySet<string> = new Set<string>([
  ...BEFORE_FARMING,
  ...FROM_FARMING,
])

/** The cauldron's honesty gate, as the panel wants it. */
export const inWorld = (itemId: string): boolean => WORLD_ITEMS.has(itemId)

// ── THE CRAFTING SURFACE: WHAT C SHOWS, WHICH IS NOT WHAT C LETS YOU PRESS ─────────────────────
//
// ★ FOUND 2026-08-22 BY ALEX, PLAYING: the Garden Bed shipped 08-22 and could not be found. The
// panel filtered to recipes where you already hold ≥1 of EVERY input, so a bed costing topsoil and
// `planking` was not greyed — it was ABSENT, because nobody had ever made planking. The panel's own
// docstring said it lists what you cannot afford, "and that is the point... which is why nobody
// noticed the entire forestry ladder was uncraftable". The prose was true when written and the
// filter one line below it had stopped honouring it. Same family as the 08-22 mirror: a comment
// cannot check anything.
//
// ⚠ THE OLD FILTER WAS NOT NOISE AND MUST NOT SIMPLY BE DELETED. Without it the surface lists all
// of RECIPES — every species' planks, bark and sap, most of which name a tree the keeper has not
// met. That wall is what the heuristic exists to prevent, and deleting it trades an invisible goal
// for an unreadable list.
//
// So the rule is split by what the output IS, derived and not listed:
//   · a FIXTURE (bench, mill, cutter, chest, pot, lantern, waymark, garden bed) is a GOAL and is
//     ALWAYS shown, costs in red, whether or not you hold a single ingredient. A goal you cannot
//     see is not a goal.
//   · a MATERIAL is shown once you have met it (hold ≥1 of every input) or can make it now.
//
// `noSlab` is the build's existing word for "not a full cube" = furniture, the same derivation
// `recipes.test.ts` uses for its hand-makeable rule. Deriving from it means a NEW fixture is a goal
// the day its registry row lands, with nobody remembering to add it to a list here.

/**
 * Is this recipe's output a FIXTURE — a thing you place in the world rather than a material you
 * spend? Derived from `noSlab`, never enumerated.
 */
export const isFixture = (itemId: string): boolean => {
  const m = materialForItem(itemId)
  return m !== undefined && ALL_BLOCKS.some(b => b.material === m && b.noSlab === true)
}

/**
 * The rows the crafting surface should render, in table order. Craftability is still decided by
 * `canCraft` at press time — this only decides what a keeper can SEE.
 *
 * ⚠ ONE derivation, imported by both the panel and its test. Do not re-implement this filter in
 * `VoxelWorld.tsx`; that is exactly how it drifted from its own docstring.
 */
export function craftSurface(
  have: (itemId: string) => number,
  station: Station = 'hand',
): readonly RecipeDef[] {
  return RECIPES.filter(r =>
    isFixture(r.output.itemId)
    || r.input.every(i => have(i.itemId) > 0)
    || canCraft(r.id, have, station))
}
