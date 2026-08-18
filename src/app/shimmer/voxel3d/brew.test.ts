// The cauldron oracle. Run: npx tsx src/app/shimmer/voxel3d/brew.test.ts
//
// This file exists because brewing arrives in a world the potion table was not written for. The
// table is shared with play3d — which farms, fishes and shops — so the interesting failures here are
// not "does the arithmetic work" but "does the panel tell the truth about a world that is missing
// two whole gathering systems". Every assert below is one sentence a keeper reads.
//
// ★ SECTION 4 WAS REWRITTEN THE SAME DAY IT WAS WRITTEN (2026-08-18) — AND IT IS A LOCATION THAT
// EXPIRED, NOT AN ASSERTION THAT WAS WRONG. It used to assert that all four flagship Infusions
// report `absent`, because their element herbs were farm crops and this world had no farm. Canon
// then ruled the herbs grow WILD and named the ground for each (`game/shimmer-geography.md`), they
// went into the generator, and the four rows went live **without a line of the panel changing** —
// which was the entire point of deriving the warning instead of hand-keeping it. The section now
// asserts the road is OPEN, and the `absent` machinery is still held by the brews that remain
// genuinely unreachable here. Do not read the diff as the rule being relaxed.

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
  // ⚠ THESE THREE USED TO BE ASKED OF `mana_infusion`, WHOSE HERB THIS WORLD DID NOT GROW. Canon
  // ruled the herbs wild on 2026-08-18 and that row went live, so the question moved to a brew that
  // is still stranded — `shimmer_salve` (shimmerscale + sunfruit, both play3d's). The RULE being
  // asserted has not changed by a word; only the row that can still demonstrate it has.
  const stranded = POTION_DEFS.shimmer_salve   // tier 1, alchemy 3, and unreachable here
  ok(brewBlocker(stranded, 99, 99, rich, inWorld, roomy) === 'absent',
    'an absent ingredient outranks everything a keeper could fix — a maxed keeper with a full bag '
    + 'and full mana still cannot brew what this world does not contain')
  // ★★ THE ONE THE PAGE HARNESS CAUGHT, and the reason it mattered: a level-first order told a
  // keeper *"alchemy 10 — you are 7"* about an Infusion whose herb did not exist, which is a promise
  // still false at 10 — five hundred XP of grinding toward nothing. A refusal that survives being
  // fixed must be said first. That case is now fixed at the world level; the ORDER still is not
  // allowed to regress, which is what this asserts.
  ok(brewBlocker(stranded, 1, 99, rich, inWorld, roomy) === 'absent',
    '★ and it outranks LEVEL too: an under-level keeper is told the ingredient is not here, rather '
    + 'than being sent to grind toward a row that will still be dead when they arrive')
}

// ── 4. ★★ THE FLAGSHIP ROAD IS OPEN — canon ruled the herbs wild, and nothing had to be rewired ─
// Canon (`game/alchemy.md`, RULED 2026-07-30) makes the four Infusions the spine of alchemy and the
// only road to an evolved form; the 2026-08-18 ruling put their herbs in the Wilds on one ground
// each. Every ingredient of all four is now obtainable in this world, so a keeper who reaches
// alchemy 10 can actually brew one — which is the sentence #594 existed to make true.
{
  const four = Object.values(INFUSION_BREWS).map(id => POTION_DEFS[id])
  ok(four.length === 4 && four.every(Boolean), 'all four canon Infusions are in the table')
  for (const def of four) {
    ok(absentInputs(def, inWorld).length === 0,
      `${def.id}: every ingredient is obtainable in this world — the road to an evolved spirit is open`)
    ok(brewBlocker(def, 10, 99, rich, inWorld, roomy) === 'ok',
      `${def.id}: a level-10 keeper with the ingredients and the mana can brew it`)
    ok(brewBlocker(def, 9, 99, rich, inWorld, roomy) === 'level',
      `${def.id}: and at 9 the refusal is LEVEL — a promise the world can now keep, which is exactly `
      + 'what it could not do while the herb was missing')
  }
  // ★ THE FOUR HERBS, BY NAME. This is the assert that would have caught the ruling being applied
  // to three of them, or to the wrong item ids — the recipes name these four strings and nothing
  // else in the chain checks that a block actually drops them.
  const herbs = ['violetbloom_petal', 'stormgrass_blade', 'rootvine_coil', 'tidepetal_bloom']
  ok(herbs.every(inWorld), 'all four element herbs are obtainable in the Wilds (ruled 2026-08-18)')
  ok(['violet_crystal', 'storm_crystal', 'earth_crystal', 'water_crystal', 'amber_sap'].every(inWorld),
    'and the crystals and the sap they brew with were already here')
}

// ── 4b. ★ THE `absent` MACHINERY IS STILL LOAD-BEARING — the herbs were not the only gap ────────
// Fishing, the Exchange Booth and the crop roster are still play3d's, so most of canon's table names
// something this world cannot produce. The refusal that saved the Infusions from a lying red `0/2`
// is the same one still speaking for those rows.
{
  const stranded = ALL_BREWS.map(id => POTION_DEFS[id]).filter(d => absentInputs(d, inWorld).length > 0)
  ok(stranded.length > 0, `brews still unreachable here (${stranded.length}) keep the refusal honest`)
  const salve = POTION_DEFS.shimmer_salve
  ok(brewBlocker(salve, 99, 99, rich, inWorld, roomy) === 'absent',
    'the tier-1 salve still says "in these lands" — shimmerscale and sunfruit have no source here')
  ok(absentInputs(salve, inWorld).length === 2, 'and it names both of them, not just the first')
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
