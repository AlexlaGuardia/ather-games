// The cauldron oracle. Run: npx tsx src/app/shimmer/voxel3d/brew.test.ts
//
// This file exists because brewing arrives in a world the potion table was not written for. The
// table is shared with play3d — which farms, fishes and shops — so the interesting failures here are
// not "does the arithmetic work" but "does the panel tell the truth about a world that is missing
// two whole gathering systems". Every assert below is one sentence a keeper reads.
//
// The one that matters most is section 4: canon's four flagship Infusions are visible at alchemy 7,
// need a farm crop, and this world has no farm. If that row ever prints a red `0/2` instead of
// saying so, every keeper who reaches level 10 goes looking for a herb that is not here.

import { brewBlocker, absentInputs, cauldronMenu, isInfusionBrew, ALL_BREWS } from './brew'
import { POTION_DEFS, INFUSION_BREWS } from '../engine/alchemy'
import { MAX_INFUSIONS_PER_ELEMENT } from '../spirits/spirit'
import { BLOCKS } from '../voxel/registry'
import { RECIPE_OUTPUTS, RECIPES } from '../voxel/recipes'
import { MAT } from '../voxel/depth'
import { STATION_MAT } from '../voxel/workshop'
import { rightClickIntent } from './interact'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

/** The world's real item universe — the same derivation the host hands the panel as `inWorld`. */
const WORLD_ITEMS = new Set<string>([
  ...BLOCKS.flatMap(b => b.drops.map(d => d.itemId)),
  ...RECIPE_OUTPUTS,
])
const inWorld = (id: string) => WORLD_ITEMS.has(id)
const rich = () => 99
const broke = () => 0
const roomy = () => 99
const full = () => 0

// ── 1. ★ THE CAULDRON IS A THING YOU USE, NOT A BLOCK YOU BUILD ON ─────────────────────────────
// The dead-click family, third time: a chest that would not open empty-handed, a bench that stacked
// a second bench, and now a cauldron. A keeper standing at their cauldron is very likely holding
// another one (they stack to 16), which is exactly the hand that would have placed one on top.
{
  ok(rightClickIntent(MAT.CAULDRON, null, false) === 'brew',
    'an EMPTY HAND at a cauldron opens the brew list — the normal way anyone uses a station')
  ok(rightClickIntent(MAT.CAULDRON, 'cauldron', false) === 'brew',
    'holding ANOTHER cauldron opens the one you aimed at rather than stacking a second onto it')
  ok(rightClickIntent(MAT.CAULDRON, 'block_stone', false) === 'brew',
    'and a fistful of stone does not turn the cauldron into a floor tile')
  // ★ THE ONE THAT PROTECTS THE STATION MODEL. `'work'` opens a workshop JOB panel — queued runs on
  // a wall clock. Brewing spends the keeper's mana and pays the keeper's XP, neither of which a
  // bench three hundred blocks away has access to. If the cauldron ever lands in STATION_MAT, the
  // brew list silently becomes a job queue and the panel's whole vocabulary is wrong.
  ok(!(MAT.CAULDRON in STATION_MAT) && STATION_MAT[MAT.CAULDRON] === undefined,
    'the cauldron is NOT a workshop station — brewing cannot happen while the keeper is away')
  ok(Object.keys(STATION_MAT).every(m => rightClickIntent(Number(m), null, false) === 'work'),
    'and every real station still opens its job, unchanged by the new branch')
}

// ── 2. the four refusals are four different sentences ──────────────────────────────────────────
// A boolean `canBrew` cannot tell a keeper which of these is true, and a greyed row that will not
// say why is how someone decides a feature is broken (the lesson slice ④ paid for on evolution).
{
  const draught = POTION_DEFS.mana_draught          // lv1, 5 mana, 5× raw_mana_shard — all local
  ok(brewBlocker(draught, 1, 99, rich, inWorld, roomy) === 'ok',
    'a level-1 draught with a full bag, mana and room brews')
  ok(brewBlocker(draught, 1, 99, broke, inWorld, roomy) === 'ingredients',
    'no shards → ingredients, the refusal you can go and fix')
  ok(brewBlocker(draught, 1, 0, rich, inWorld, roomy) === 'mana',
    'no mana → mana, and the pool refills itself while you stand there')
  ok(brewBlocker(draught, 1, 99, rich, inWorld, full) === 'room',
    'a full satchel REFUSES rather than brewing bottles into nowhere')
  const elixir = POTION_DEFS.crystal_elixir         // lv7, and every ingredient is local
  ok(brewBlocker(elixir, 1, 99, rich, inWorld, roomy) === 'level',
    'under-level on a row this world CAN make → level, the promise the world can keep')
}

// ── 3. ★ ORDER IS THE DESIGN, NOT AN ACCIDENT ──────────────────────────────────────────────────
// Mana last, because it is the only refusal that fixes itself. Checked first, a keeper three shards
// short would be told "not enough mana", wait for the bar to fill, press again and get a DIFFERENT
// answer — the panel would have made them wait to find out the real problem.
{
  const draught = POTION_DEFS.mana_draught
  ok(brewBlocker(draught, 1, 0, broke, inWorld, roomy) === 'ingredients',
    'short on BOTH mana and ingredients reports the ingredients — the thing you must go do')
  ok(brewBlocker(draught, 1, 0, rich, inWorld, full) === 'room',
    'and a full bag outranks empty mana for the same reason')
  const infusion = POTION_DEFS.mana_infusion
  ok(brewBlocker(infusion, 99, 99, rich, inWorld, roomy) === 'absent',
    'an absent ingredient outranks everything a keeper could fix — a maxed keeper with a full bag '
    + 'and full mana still cannot brew what this world does not contain')
  // ★★ THE ONE THE PAGE HARNESS CAUGHT. Infusions are visible at alchemy 7 and gated at 10, so a
  // level-first order told a keeper at 7 *"alchemy 10 — you are 7"* — a promise that is still false
  // at 10, and five hundred XP of grinding toward nothing. A refusal that survives being fixed must
  // be said first.
  ok(brewBlocker(infusion, 7, 99, rich, inWorld, roomy) === 'absent',
    '★ and it outranks LEVEL too: a keeper at 7 is told the herb is not here, not to come back at 10')
  ok(brewBlocker(POTION_DEFS.shimmer_salve, 1, 99, rich, inWorld, roomy) === 'absent',
    'same for the tier-1 salve at alchemy 1 — absence is reported at every level, not just past the gate')
}

// ── 4. ★★ THE FLAGSHIP ROW TELLS THE TRUTH ABOUT THIS WORLD ────────────────────────────────────
// Canon (`game/alchemy.md`, RULED 2026-07-30) makes the four Infusions the spine of alchemy and the
// only road to an evolved form. They are visible from alchemy 7 (the level+3 window) and every one
// of them needs its element herb, which is a FARM CROP — and this world has no farming. The whole
// value of `absent` is that this fact is stated rather than implied by a red zero.
{
  const four = Object.values(INFUSION_BREWS).map(id => POTION_DEFS[id])
  ok(four.length === 4 && four.every(Boolean), 'all four canon Infusions are in the table')
  for (const def of four) {
    const missing = absentInputs(def, inWorld)
    ok(missing.length > 0, `${def.id}: names at least one ingredient this world cannot produce`)
    ok(brewBlocker(def, 99, 99, rich, inWorld, roomy) === 'absent',
      `${def.id}: refuses with 'absent', so the panel says "in these lands" and not "0/2"`)
  }
  // ★ AND THE HERB IS THE ONE MISSING — the crystal and the sap are already here. That is what
  // makes this ONE slice away rather than a system away, and it is the sentence the next session
  // needs: bring the four element herbs into this world and all four rows go live untouched.
  const herbs = ['violetbloom_petal', 'stormgrass_blade', 'rootvine_coil', 'tidepetal_bloom']
  ok(herbs.every(h => !inWorld(h)), 'none of the four element herbs is obtainable here (no farming)')
  ok(['violet_crystal', 'storm_crystal', 'earth_crystal', 'water_crystal', 'amber_sap'].every(inWorld),
    'but every OTHER infusion ingredient already drops here — the crystals and the sap')
  for (const def of four) {
    ok(absentInputs(def, inWorld).every(id => herbs.includes(id)),
      `${def.id}: the herb is the ONLY thing standing between this world and an evolved spirit`)
  }
}

// ── 5. ★ SOMETHING IS ACTUALLY BREWABLE — this is not a shelf with nothing on it ───────────────
// The failure the gboard keeps warning about (a crop with no seed source, a station whose only
// product is elapsed time). A cauldron a keeper cannot use on the day they build it is worse than no
// cauldron, because it teaches them the feature is dead.
{
  const live = ALL_BREWS.map(id => POTION_DEFS[id]).filter(d => absentInputs(d, inWorld).length === 0)
  ok(live.length >= 3, `at least three brews are fully local (found ${live.length}: ${live.map(d => d.id).join(', ')})`)
  ok(live.some(d => d.minAlchemyLevel === 1),
    'and at least one is reachable at alchemy 1 — the level every keeper starts on')
  // The XP road: brewing is the ONLY source of alchemy XP in this world, so the local set has to be
  // able to carry a keeper up. Stated as a floor, not a curve — the tuning is a later question.
  ok(live.reduce((n, d) => n + d.xpGrant, 0) >= 50,
    'the locally-brewable set grants real XP, so alchemy can actually be levelled here')
}

// ── 6. the menu is CANON'S list, not a filtered one ────────────────────────────────────────────
// The tempting bug: hide what this world cannot make. It would be a tidier panel and it would delete
// the Infusions from the game's most important shelf — a keeper is supposed to see them coming.
{
  const menu = cauldronMenu(7).map(d => d.id)
  ok(menu.includes('crystal_elixir'), 'level 7 sees the tier-2 elixir it just unlocked')
  ok(Object.values(INFUSION_BREWS).every(id => menu.includes(id)),
    'and sees all four Infusions at 7 (level+3), absent herbs and all — the wanting is the point')
  ok(cauldronMenu(1).every(d => d.minAlchemyLevel <= 4),
    'a fresh keeper is not shown the whole table')
}

// ── 7. ★ `ather_infusion` IS NOT AN INFUSION, and the spelling test says it is ─────────────────
// I wrote `endsWith('_infusion')` first. It was wrong inside four minutes: `ather_infusion` is a
// tier-4 player buff (mana regen ×10) with nothing to do with the elemental spine, and labelling it
// "for a spirit" would offer a keeper a pour that `applyInfusion` refuses as 'not-an-infusion'.
{
  ok(POTION_DEFS.ather_infusion !== undefined, 'the trap still exists in the table (if it is gone, delete this)')
  ok(!isInfusionBrew('ather_infusion'), 'ather_infusion is NOT labelled as a spirit infusion')
  ok(Object.values(INFUSION_BREWS).every(isInfusionBrew), 'and all four real ones are')
  ok(ALL_BREWS.filter(isInfusionBrew).length === 4, 'exactly four rows wear the spirit label')
}

// ── 8. ★ THE REACHABILITY PREMISE `WORLD_ITEMS` RESTS ON ───────────────────────────────────────
// The host's set deliberately excludes potions, which is only safe because no recipe anywhere takes
// a potion as an input. Asserted rather than assumed: the day one does, `inWorld` needs a fixpoint
// and this assert is what will say so instead of a row silently going grey.
{
  const brews = new Set(ALL_BREWS)
  ok(ALL_BREWS.every(id => POTION_DEFS[id].recipe.every(r => !brews.has(r.itemId))),
    'no potion is an ingredient of another potion, so the world-item set needs no fixpoint')
  ok(RECIPES.every(r => r.input.every(i => !brews.has(i.itemId))),
    'and no voxel recipe eats a potion either')
}

// ── 9. the cauldron itself is craftable and placeable ──────────────────────────────────────────
// A station you cannot make is a station that does not exist. Same shape as slice ①'s seed check:
// *a crop with no seed source is the same middle-removed failure this row exists to fix.*
{
  ok(RECIPE_OUTPUTS.has('cauldron'), 'the cauldron is on the recipe table')
  const def = RECIPES.find(r => r.id === 'cauldron')!
  ok(def.station === 'crafting_table', 'it is bench work — a keeper who wants to brew owns a table')
  ok(def.input.every(i => inWorld(i.itemId)), 'and every ingredient of the cauldron is obtainable here')
  const block = BLOCKS.find(b => b.material === MAT.CAULDRON)!
  ok(block !== undefined && block.placeable === true, 'the block can be placed')
  ok(block.drops.some(d => d.itemId === 'cauldron'), 'and breaking it gives it back — furniture rules hold')
  ok(block.skill === null && Number.isFinite(block.hardness),
    'breakable by hand, so moving your brewer costs a walk and nothing else')
}

// ── 10. a stack of potions is one spirit's worth ───────────────────────────────────────────────
// The host derives the stack from the infusion cap so the number says something. Asserted here
// because the constant it is derived FROM lives in another file and a change there is silent.
{
  ok(MAX_INFUSIONS_PER_ELEMENT === 9,
    'the per-element cap is 9, which is what makes a 10-stack "one spirit\'s worth" true')
}

console.log(`${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
