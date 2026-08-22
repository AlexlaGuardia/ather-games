// The honesty gate's oracle. Run: npx tsx src/app/shimmer/voxel3d/obtainable.test.ts
//
// ★ THE PROPERTY, IN ONE LINE: **nothing this world actually yields may be reported absent.**
// Every assert here is a way of asking that question, because the bug it exists for shipped five
// times in four days and was silent every time — a greyed brew row reads as content that has not
// been built yet, not as a lie.
import { WORLD_ITEMS, FROM_BLOCKS, FROM_RINNING, FROM_FELLING, FROM_FARMING, cropYieldsFrom, inWorld } from './obtainable'
import { BLOCKS, materialForItem } from '../voxel/registry'
import { RECIPE_OUTPUTS, RECIPES } from '../voxel/recipes'
import { TREE_NODES } from '../voxel/tree-node'
import { RIN_TIERS } from '../engine/rin-catch'
import { POTION_DEFS, POTION_IDS } from '../engine/alchemy'
import { TOOL_DEFS } from '../engine/tools'
import { CROP_DEFS } from '../engine/farming'
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

  // ⚠ The five source lists must be non-empty. A source that silently derives to [] would satisfy
  // every assert above by having nothing to miss — the vacuous-pass shape this codebase has been
  // bitten by before (a canon grep that matched nothing and went green).
  ok(FROM_BLOCKS.length > 0, 'FROM_BLOCKS is non-empty — an empty source passes coverage vacuously')
  ok(FROM_RINNING.length > 0, 'FROM_RINNING is non-empty')
  ok(FROM_FELLING.length > 0, 'FROM_FELLING is non-empty')
  ok(FROM_FARMING.length > 0, 'FROM_FARMING is non-empty')
  ok(RECIPE_OUTPUTS.size > 0, 'RECIPE_OUTPUTS is non-empty')
}

// ── 5. ★★★ FARMING — THE SIXTH SOURCE, AND A GATE THAT HAS TO HOLD IN BOTH DIRECTIONS ──────────
// Instance six of the one bug: farming shipped on the front door on 08-22 and the set did not hear
// about it, so `harvest_brew` (lv2, 18 xp) read "not in these lands" while a keeper could make it.
//
// ⚠⚠ AND THIS SOURCE IS THE FIRST ONE THAT CAN BE WRONG IN THE OPPOSITE DIRECTION, which is why it
// gets two asserts and the other four get one. Every earlier source is a table of things the world
// hands over unconditionally — a block drops what it drops. A crop hands over nothing unless its
// SEED can be got, so an ungated derivation would tell the panel that Moonvine and Dreamroot are in
// these lands and let a keeper gather four ingredients before discovering the fifth cannot exist.
// That failure is quieter and lands later than the greyed row this file was written for.
{
  const crops = Object.values(CROP_DEFS)

  // (a) COVERAGE — the direction the bug actually shipped in.
  const missFarm = FROM_FARMING.filter(id => !WORLD_ITEMS.has(id))
  ok(missFarm.length === 0,
    `★★★ every yield of a crop this world can seed is obtainable — this is the one that kept harvest_brew dark (missing: ${missFarm.join(', ') || 'none'})`)

  // (b) THE GATE IS REACHABLE AND IT FIRES — proved by feeding the derivation its own extremes,
  // never by naming a crop. `cropYieldsFrom([])` is the floor and the full roster is the ceiling; a
  // gate that has stopped excluding anything shows up as those two being equal.
  const everySeed = crops.map(c => c.seedItemId)
  const ceiling = new Set(cropYieldsFrom(everySeed))
  ok(cropYieldsFrom([]).length === 0,
    '★ with no seed obtainable the derivation yields nothing — the gate can exclude')
  const excluded = [...ceiling].filter(id => !FROM_FARMING.includes(id))
  ok(excluded.length > 0,
    `★★ the seed gate is NOT dominated — it is really holding crops back today, so deleting it would go red (holding: ${excluded.join(', ') || 'NOTHING'})`)
  ok(FROM_FARMING.every(id => ceiling.has(id)),
    'and it admits nothing the full roster would not')

  // ⚠ (b) IS DELIBERATELY ASKED OF `FROM_FARMING`, NOT OF `WORLD_ITEMS`, and the four element herbs
  // are the reason. Violetbloom and its three kin are tier-2 CROPS whose harvest items also drop
  // from wild herb blocks, so `violetbloom_petal` is legitimately in the world while
  // `seed_violetbloom` is not obtainable at all. A crop being unseedable does not make its produce
  // absent — it makes FARMING not the way you get it. Asking the wider set would read that correct
  // arrangement as a leak.

  // (c) BY NAME, so a regression says what broke — the `crystallized_sap` treatment for the brew
  // that was actually dark. Derived from the recipe, so if harvest_brew is ever re-costed off
  // shimmerwheat this assert goes red rather than testing a recipe that no longer exists.
  ok(inWorld('shimmerwheat_grain'),
    '★★★ shimmerwheat_grain is obtainable — grass yields the seed, a bed grows it, and the cauldron said otherwise on the day farming shipped')
  const hbAbsent = POTION_DEFS['harvest_brew'].recipe.filter(r => !inWorld(r.itemId)).map(r => r.itemId)
  ok(hbAbsent.length === 0,
    `★★★ harvest_brew is brewable — lv2, 18 xp, and it was greyed out on the day the front door learned to farm (absent: ${hbAbsent.join(', ') || 'none'})`)
  ok(POTION_DEFS['harvest_brew'].recipe.some(r => FROM_FARMING.includes(r.itemId)),
    'and it really does take a farmed input, else the assert above is about nothing')

  // ⚠⚠ FOUR BREWS ARE STILL STRANDED AND THAT IS CORRECT — do not "fix" this by widening the set.
  // They are blocked on CANON, not on this file: `sunfruit` and `moonberry` name things canon does
  // not have, and Moonvine/Crystalcap/Dreamroot are tier 2-3 crops whose seeds a meadow does not
  // yield under canon's *"common, level-1 stock"*. Both are queued in `CANON_GAPS.md`.
  //
  // ★ SO THE ASSERT IS ABOUT THE REASON, NOT THE COUNT. A tally would go red for good reasons and
  // invite the cheapest edit that makes it green; this goes red only if FARMING is what is holding
  // a brew back, which is the failure this section owns. It stays true whichever way Magii rules.
  const seedable = new Set(crops.filter(c => FROM_FARMING.some(y => c.yields.some(v => v.itemId === y))).map(c => c.id))
  const blamedOnFarming = Object.values(POTION_DEFS)
    .flatMap(d => d.recipe.map(r => ({ brew: d.id, item: r.itemId })))
    .filter(x => !inWorld(x.item))
    .filter(x => crops.some(c => seedable.has(c.id) && c.yields.some(y => y.itemId === x.item)))
  ok(blamedOnFarming.length === 0,
    `★ no brew is stranded on the produce of a crop this world can seed — whatever is still dark, farming is not the reason (found: ${blamedOnFarming.map(x => `${x.brew}/${x.item}`).join(', ') || 'none'})`)
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
  // ★★ THE PIN CLOSED ITSELF, WHICH IS WHAT IT WAS FOR (2026-08-22, same day it was written).
  // `mana_seed` was pinned here as a known orphan — no ItemDef, no material, no consumer — with the
  // note that fixing it would ALSO go red so nobody could close the hole and leave a stale allowance
  // behind. Canon then retired the generic seed, grass now yields common crop seeds instead, and
  // this assert duly went red saying "found: none, pinned: mana_seed". **An exemption would have
  // stayed quiet through all of that and would still be sitting here.**
  const KNOWN_ORPHANS: string[] = []
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
