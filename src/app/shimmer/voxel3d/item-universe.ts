// What a keeper can end up holding — ONE derivation, two consumers.
//
// ── ★ WHY THIS IS A MODULE AND NOT A LOOP INSIDE THE CHECKLIST (2026-08-26) ─────────────────────
// This block lived in `scripts/item-art.mts`. `dev/icons` — the page Alex looks at to see every icon
// at once — needs the same universe, and a page that rebuilt it would be a hand-kept MIRROR of the
// script: the two would agree perfectly while drifting from the game, and they would drift the first
// time a new way to obtain something shipped. That is not hypothetical here. The comments below
// count SEVEN instances of exactly that failure in this one derivation's history.
//
// So the script and the page import this, and neither restates it. If an eighth way to obtain an
// item ships, it goes in HERE and both consumers hear about it in the same edit.
//
// ⚠ Pure, and importable from both app code and a node script: no react, no DOM, no fs.

import { ALL_BLOCKS } from '../voxel/registry'
import { RECIPES } from '../voxel/recipes'
import { TOOL_DEFS } from '../engine/tools'
import { WORLD_ITEMS, FROM_FARMING, FROM_RINNING, FROM_FELLING } from './obtainable'
import { POTION_DEFS } from '../engine/alchemy'

/** Every reachable item id, mapped to the places it can come from. */
export function itemUniverse(): Map<string, Set<string>> {
  // ── The reachable item universe ────────────────────────────────────────────────────────────────
  // Everything a keeper can end up holding, gathered from the tables that can actually produce one.
  // `from` is kept per item because "where does this even come from" is the first question asked
  // about anything on the missing list, and answering it from memory is how the wrong thing gets
  // drawn first.
  const sources = new Map<string, Set<string>>()
  const note = (id: string, where: string) => {
    if (!sources.has(id)) sources.set(id, new Set())
    sources.get(id)!.add(where)
  }

  for (const b of ALL_BLOCKS) {
    for (const d of b.drops) note(d.itemId, `drop: ${b.name}`)
  }
  for (const r of RECIPES) {
    note(r.output.itemId, 'crafted')
    for (const i of r.input) note(i.itemId, 'ingredient')
  }
  for (const t of Object.values(TOOL_DEFS)) note(t.id, `tool: ${t.skillId} t${t.tier}`)

  // ── ★★★ AND THE THREE TABLES ABOVE ARE A HAND-ENUMERATED SOURCE LIST (2026-08-26) ──────────────
  // Which is the exact shape `voxel3d/obtainable.ts` was written to end, and its header numbers five
  // prior instances. This is the sixth, and it is the funniest one: the checklist whose entire purpose
  // is to stop a stale hand-kept list asserting what art exists was keeping a stale hand-kept list of
  // what a keeper can hold. Blocks, recipes and tools were the ways to obtain something on the day
  // this file was written; FARMING, RINNING and FELLING all shipped afterwards and none of them told
  // it. `WORLD_ITEMS` is the one derivation that hears about all of them.
  //
  // ⚠ THE MISS WAS NOT COSMETIC. `shimmerwheat_grain` renders as a SOLID MAGENTA BLOB — 171 of 171
  // pixels the no-palette sentinel — and it is provably obtainable: `crops.ts` yields it and
  // `obtainable.test.ts` asserts it by name. It was outside this file's universe, so the sweep below
  // could not see it, so the worst-looking item in the game was the one item the report was blind to.
  // An instrument that cannot see its subject reports nothing wrong.
  //
  // Union, never replacement: the loops above carry PROVENANCE ("drop: Deadfall", "tool: farming t1")
  // that `WORLD_ITEMS` flattens away, and "where does this even come from" is the first question asked
  // about anything on the missing list. So the buckets answer first and the set backstops them.
  for (const id of FROM_FARMING) note(id, 'crop yield')
  for (const id of FROM_RINNING) note(id, 'rinning catch')
  for (const id of FROM_FELLING) note(id, 'felling drop')
  for (const id of WORLD_ITEMS) note(id, 'in world')

  // ── ★★ AND THE SEVENTH INSTANCE, FOUND THE DAY AFTER THE SIXTH (2026-08-26) ────────────────────
  // `WORLD_ITEMS` answers *what can the WORLD put in a keeper's hands* — blocks, farming, rinning,
  // felling. A brew is not put in your hands by the world; it comes off the cauldron, and
  // `engine/alchemy.ts`'s `POTION_DEFS` is a table neither this file nor `obtainable.ts` had joined.
  // So **all 17 potions were outside the universe**, and with them four more items wearing the
  // no-palette sentinel — `shard_tonic` 44%, `harvest_brew` 44%, `ather_infusion` 34%, `dawn_cordial`
  // 33%. The report said 20 and the true number was 24.
  //
  // ⚠ NOTED HERE AND DELIBERATELY *NOT* IN `obtainable.ts`. That file is the cauldron's honesty gate;
  // its question is whether you can get the INGREDIENTS. Adding brew OUTPUTS to `WORLD_ITEMS` would
  // answer a different question with the same set and could make a recipe wanting a brew read as
  // craftable. Same trap as `materialForItem`: two questions, one map. Give the second one its own.
  for (const id of Object.keys(POTION_DEFS)) note(id, 'brewed')

  // ⚠ AND THE OPPOSITE ERROR IS REAL: this universe is "reachable IN VOXEL3D", so joining a table the
  // live surface does not use would INFLATE it and invent art debt for items nobody can hold. Five
  // other engine tables define item outputs — crafting, quests, exchange, harvesting, world-items —
  // and all five belong to the archived 2D game. The discriminator is not a judgement call, it is a
  // grep: `grep -rl "engine/<name>'" src/app/shimmer/voxel3d/`. Alchemy answers with four files
  // (brew.ts, brew-panel.tsx, VoxelWorld.tsx, and its own oracle); the other five answer with ZERO.
  // Re-run that before adding a table here, and before concluding one is missing.

  return sources
}

/** The tables this universe is joined from — printed by the checklist, shown on the page. */
export const UNIVERSE_SOURCES =
  'blocks · recipes · tools · farming · rinning · felling · WORLD_ITEMS · potions'
