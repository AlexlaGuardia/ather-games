// The honesty gate's oracle. Run: npx tsx src/app/shimmer/voxel/obtainable.test.ts
//
// ★ THE PROPERTY, IN ONE LINE: **nothing this world actually yields may be reported absent.**
// Every assert here is a way of asking that question, because the bug it exists for shipped five
// times in four days and was silent every time — a greyed brew row reads as content that has not
// been built yet, not as a lie.
import { WORLD_ITEMS, FROM_BLOCKS, FROM_RINNING, FROM_FELLING, inWorld } from './obtainable'
import { BLOCKS, materialForItem } from './registry'
import { RECIPE_OUTPUTS, RECIPES } from './recipes'
import { TREE_NODES } from './tree-node'
import { RIN_TIERS } from '../engine/rin-catch'
import { POTION_DEFS, POTION_IDS } from '../engine/alchemy'
import { TOOL_DEFS } from '../engine/tools'
import { ITEMS } from '../sprites/items'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. EVERY REGISTERED SOURCE IS FULLY COVERED ─────────────────────────────────────────────────
// Asked of each yield table directly, so a source that stops being spread into the set goes red
// here rather than surfacing as a wrong brew row weeks later.
{
  const missBlocks = BLOCKS.flatMap(b => b.drops.map(d => d.itemId)).filter(id => !WORLD_ITEMS.has(id))
  ok(missBlocks.length === 0, `every block drop is obtainable (missing: ${missBlocks.join(', ') || 'none'})`)

  const missRecipes = [...RECIPE_OUTPUTS].filter(id => !WORLD_ITEMS.has(id))
  ok(missRecipes.length === 0, `every recipe output is obtainable (missing: ${missRecipes.join(', ') || 'none'})`)

  const missRin = RIN_TIERS.flatMap(t => t.items).filter(id => !WORLD_ITEMS.has(id))
  ok(missRin.length === 0, `★★ every rin catch is obtainable — rinning shipped 08-20 and was invisible for two days (missing: ${missRin.join(', ') || 'none'})`)

  const missFell = Object.values(TREE_NODES).map(d => d.secondary.itemId).filter(id => !WORLD_ITEMS.has(id))
  ok(missFell.length === 0, `★★★ every tree's secondary yield is obtainable — this is the one that gated ather_infusion and dawn_cordial (missing: ${missFell.join(', ') || 'none'})`)

  // ⚠ The four source lists must be non-empty. A source that silently derives to [] would satisfy
  // every assert above by having nothing to miss — the vacuous-pass shape this codebase has been
  // bitten by before (a canon grep that matched nothing and went green).
  ok(FROM_BLOCKS.length > 0, 'FROM_BLOCKS is non-empty — an empty source passes coverage vacuously')
  ok(FROM_RINNING.length > 0, 'FROM_RINNING is non-empty')
  ok(FROM_FELLING.length > 0, 'FROM_FELLING is non-empty')
  ok(RECIPE_OUTPUTS.size > 0, 'RECIPE_OUTPUTS is non-empty')
}

// ── 2. ★★★ CRYSTALLIZED SAP, BY NAME — the fifth instance, so a regression names itself ─────────
// `TREE_NODES.dawnwood` drops it at 25%. It is the SOLE missing input of two brews, so if it ever
// falls out of the set again, two of canon's seventeen brews go dark and nothing else changes.
{
  ok(inWorld('crystallized_sap'),
    '★★★ crystallized_sap is obtainable — dawnwood drops it, and the cauldron said otherwise for four days')
  const gatedBySap = Object.values(POTION_DEFS)
    .filter(d => d.recipe.some(r => r.itemId === 'crystallized_sap'))
    .map(d => d.id)
  ok(gatedBySap.length >= 2,
    `the sap really does gate more than one brew, else this assert is about nothing (gates: ${gatedBySap.join(', ')})`)
  for (const id of gatedBySap) {
    const def = POTION_DEFS[id]
    const absent = def.recipe.filter(r => !inWorld(r.itemId)).map(r => r.itemId)
    ok(absent.length === 0, `${id} is brewable here — nothing in its recipe is absent (absent: ${absent.join(', ') || 'none'})`)
  }
}

// ── 3. ★★ NOTHING OBTAINABLE IS A TOTAL ORPHAN ─────────────────────────────────────────────────
// The `glowfin_scale` shape, asked from the other end: an id the world HANDS YOU that names nothing
// and that nothing consumes. Both halves matter and neither alone is the defect —
//   · `goldwood_log` has no `ItemDef` and no material, and is completely fine: `itemLabel`
//     title-cases it and three recipes eat it. It wants an icon, not a rescue.
//   · `cut_stone`, `cauldron`, `mushroom_cap` and every sapling have no `ItemDef` either — they are
//     MATERIALS and resolve through `materialForItem`. **28 ids are in that class**, which is why
//     "must have an ItemDef" is the wrong question. My first cut asked it, went red, and I nearly
//     carved an exemption list to fit a test I had specified wrongly.
// So the property is: nameable OR consumed. An id that is neither is a reward with no downstream
// and no face — which is precisely what shipped on tiers 2 and 3 of the rinning ladder.
{
  const known = new Set(ITEMS.map(d => d.id))
  const nameable = (id: string) => known.has(id) || materialForItem(id) !== undefined
  const consumed = new Set<string>([
    ...RECIPES.flatMap(r => r.input.map(i => i.itemId)),
    ...Object.values(TOOL_DEFS).flatMap(t => t.recipe.map(r => r.itemId)),
    ...Object.values(POTION_DEFS).flatMap(d => d.recipe.map(r => r.itemId)),
  ])
  const orphans = [...WORLD_ITEMS].filter(id => !nameable(id) && !consumed.has(id)).sort()

  // ⚠⚠ PINNED, NOT EXEMPTED — and the difference is the point of the whole day. An open exemption
  // ("ignore mana_seed") admits every future orphan too and quietly promises someone is watching.
  // Pinning the EXACT set means a new orphan goes red, and FIXING this one also goes red so nobody
  // can close the hole and leave a stale allowance behind. The assert expires by design.
  //
  // ★ `mana_seed` is real and it is on the farming thread: canon has Gregory hand a keeper a Mana
  // Seed to plant in his clay pot, `engine/farming.ts` exports `MANA_SEED_ITEM`/`MANA_BLOOM_CROP` —
  // and the voxel world has no planting, so the seed it drops into your bag can never be used.
  // The day the front door can farm, this list becomes empty and this assert says so.
  const KNOWN_ORPHANS = ['mana_seed']
  ok(JSON.stringify(orphans) === JSON.stringify(KNOWN_ORPHANS),
    `★★ the orphan set is exactly the pinned one — nothing new is unnameable AND unconsumed (found: ${orphans.join(', ') || 'none'}, pinned: ${KNOWN_ORPHANS.join(', ')})`)
  ok(!nameable('glowfin_scale') && !consumed.has('glowfin_scale'),
    '★ and the check has teeth: the id that shipped for two days is an orphan by this definition')
}

// ── 4. THE POTIONS-EXCLUDED PREMISE, ASSERTED RATHER THAN TRUSTED ───────────────────────────────
// The set deliberately omits brews. That is only free while no recipe takes a potion as an input —
// the day one does, this set needs a fixpoint and the omission becomes a bug.
{
  const potions = new Set(POTION_IDS)
  const potionInputs = [
    ...Object.values(POTION_DEFS).flatMap(d => d.recipe.map(r => r.itemId)),
    ...RECIPES.flatMap(r => r.input.map(i => i.itemId)),
  ].filter(id => potions.has(id))
  ok(potionInputs.length === 0,
    `★ no recipe takes a potion as an input, so excluding brews from the set costs nothing (found: ${potionInputs.join(', ') || 'none'})`)
}

if (fails.length) {
  console.log(`\n${fails.map(f => `  ✗ ${f}`).join('\n')}\n`)
  console.log(`❌ ${fails.length} failed, ${pass} passed`)
  process.exit(1)
}
console.log(`✅ the world's honesty gate knows every source — ${pass} passed`)
