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
 * Every item a keeper can obtain HERE by playing. No Exchange Booth, no crops — this world has
 * neither, and when it grows one, it registers above and this comment changes with it.
 *
 * ⚠ POTIONS ARE DELIBERATELY EXCLUDED. They are obtainable (the cauldron makes them), but no recipe
 * in the table takes a potion as an INPUT, so leaving them out costs nothing and keeps this from
 * needing a fixpoint. `obtainable.test.ts` asserts that premise rather than trusting it.
 */
export const WORLD_ITEMS: ReadonlySet<string> = new Set<string>([
  ...FROM_BLOCKS,
  ...RECIPE_OUTPUTS,
  ...FROM_RINNING,
  ...FROM_FELLING,
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
