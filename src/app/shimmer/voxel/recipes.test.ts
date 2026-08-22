// Run: npx tsx src/app/shimmer/voxel/recipes.test.ts
//
// ★ THE POINT OF THIS FILE IS THE REACHABILITY SWEEP AT THE BOTTOM.
//
// The unit asserts above it are ordinary. The sweep is the one that earns its place: it walks every
// recipe input and every tool recipe back to a block drop, and fails if anything cannot be reached
// by mining. That is the exact bug this module was written to fix — three forestry blades costing
// bark and sap that no block produced, so the tier never rose, so two of the four ruled tree species
// could never be cut. Nothing failed. It just quietly was not a game.
//
// A cost table is a promise that the thing is obtainable. This is the test that checks the promise.

import { RECIPES, recipeDef, canCraft, craftPlan, availableRecipes, RECIPE_OUTPUTS } from './recipes'
import { BLOCKS, ALL_BLOCKS, materialForItem } from './registry'
import { STATION_ITEMS } from './workshop'
import { MAT } from './depth'
import { isLogMat } from './trees'
import { PIECES } from './pieces'
import { TOOL_DEFS } from '../engine/tools'
import { WORLD_ITEMS, isFixture, craftSurface } from '../voxel3d/obtainable'

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++ } else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const bag = (items: Record<string, number>) => (id: string) => items[id] ?? 0

// ── table shape ───────────────────────────────────────────────────────────────
console.log('recipe table')
{
  check('ids are unique', new Set(RECIPES.map(r => r.id)).size === RECIPES.length)
  check('every recipe has at least one input', RECIPES.every(r => r.input.length > 0))
  check('every count is a positive integer', RECIPES.every(r =>
    r.output.count > 0 && Number.isInteger(r.output.count) &&
    r.input.every(i => i.count > 0 && Number.isInteger(i.count))))
  check('no recipe consumes what it produces', RECIPES.every(r => !r.input.some(i => i.itemId === r.output.itemId)),
    'a recipe that eats its own output is a loop, not a recipe')
  check('lookup by id works', recipeDef('goldwood_planks')?.output.itemId === 'goldwood_plank')
  check('unknown id is undefined, not a throw', recipeDef('nope') === undefined)
}

// ── the bootstrap ─────────────────────────────────────────────────────────────
console.log('bootstrap')
{
  // A crafting table gated behind a crafting table is a game that cannot start. This assert exists
  // because that is an easy line to "tidy up" later.
  check('the crafting table is makeable by hand', recipeDef('crafting_table')?.station === 'hand')
  // ★ NARROWED 2026-08-13 (the sawmill), and narrowed rather than weakened. The old form was
  // "every recipe except `crafting_table` is hand" — a blanket rule with one id carved out, which
  // grows a second carve-out the moment a second station exists and then means nothing.
  //
  // What it was always DEFENDING is materials: a player who mined a thing must be able to make it
  // useful where he stands, because mining is the gate and not furniture. A STATION is not a
  // material — it is a thing you build, and gating one behind the bench is the same call the tool
  // ladder already makes ("you cannot shape a blade on your knee"). So the rule now says that, and
  // says it about a derived set rather than a list of ids.
  //
  // ⚠ If this ever fails because someone gated a plank, that is the bug. Do not add an id to an
  // exemption list — there is no exemption list on purpose.
  //
  // ★ NARROWED AGAIN 2026-08-15 (the waymark), and again by widening the DERIVED set rather than
  // carving out an id. The sawmill pass replaced "every recipe except `crafting_table`" with "every
  // recipe that is not a STATION" — right in spirit, too narrow in fact. A waymark is not a station
  // and it is not a material either; it is FURNITURE, the same category the rule already excused,
  // and `STATION_ITEMS` just happened to be the only furniture that existed when the line was
  // written. Left alone, the next lamp-post trips a rule aimed at planks.
  //
  // So the set is now derived from what the output PLACES: `noSlab` marks a block that is not a
  // full cube — a bench, a chest, a pot, a lantern, a waymark — which is exactly the build's
  // existing word for furniture. Everything else (planks, bark, sap, cut stone, bricks, sandstone,
  // planking, and every non-block item) is a MATERIAL and must stay hand-makeable anywhere.
  //
  // ⚠ Still no exemption list, and still do not add one. If this fails because someone gated a
  // plank, that is the bug. If it fails because someone gated a new *fixture*, the fixture is
  // missing `noSlab` — fix the registry row, not this test.
  // ⚠ WAS A LOCAL RE-IMPLEMENTATION OF THIS EXACT DERIVATION (2026-08-22). Two copies of one rule
  // agree until they do not, and agreement between a copy and its original is not evidence about
  // either — so the panel, this sweep and the craft surface now all import the one function.
  const isFurniture = isFixture
  const gatedMaterials = RECIPES.filter(r => !isFurniture(r.output.itemId) && r.station !== 'hand')
  check('every MATERIAL recipe is makeable by hand',
    gatedMaterials.length === 0,
    'refining is deliberately station-free; mining is the gate, not furniture — '
    + gatedMaterials.map(r => r.id).join(', '))
  // ...and the derivation must actually SEE the furniture, or the rule above passes by being blind.
  check('the furniture set is non-empty and holds the things it should',
    ['crafting_table', 'sawmill', 'stonecutter', 'waymark', 'chest', 'clay_pot', 'mana_lantern'].every(isFurniture),
    ['crafting_table', 'sawmill', 'stonecutter', 'waymark', 'chest', 'clay_pot', 'mana_lantern'].filter(i => !isFurniture(i)).join(', '))
  check('...and does NOT hold a building material',
    !['cut_stone', 'stone_brick', 'pale_brick', 'sandstone', 'planking'].some(isFurniture))

  // A station MAY be gated, but the chain has to terminate or the game cannot bootstrap into it.
  // Walks each station's gate back to 'hand'; a cycle (bench behind mill behind bench) runs out of
  // hops and fails instead of hanging.
  check("every station's gate chain reaches the hand", RECIPES
    .filter(r => STATION_ITEMS.has(r.output.itemId))
    .every((r) => {
      let at: string = r.station, hops = 0
      while (at !== 'hand' && hops++ < STATION_ITEMS.size + 1) {
        const gate = RECIPES.find(x => x.output.itemId === at)
        if (!gate) return false          // gated behind a station nothing can make
        at = gate.station
      }
      return at === 'hand'
    }))
}

// ── mana ──────────────────────────────────────────────────────────────────────
console.log('mana')
{
  // Carpentry is not a channelling act. If this starts failing, someone has re-added the tile
  // world's blanket toll — read the note on RecipeDef.mana before "fixing" it.
  check('no refine step charges mana', RECIPES.every(r => r.mana === 0))
  check('a zero-mana recipe is craftable with zero mana',
    canCraft('goldwood_planks', bag({ goldwood_log: 1 }), 'hand', 0))
}

// ── canCraft ──────────────────────────────────────────────────────────────────
console.log('canCraft')
{
  check('enough materials → yes', canCraft('goldwood_planks', bag({ goldwood_log: 3 })))
  check('exactly enough → yes', canCraft('goldwood_planks', bag({ goldwood_log: 1 })))
  check('one short → no', canCraft('crafting_table', bag({ goldwood_plank: 3 })) === false)
  check('empty bag → no', canCraft('goldwood_planks', bag({})) === false)
  check('unknown recipe → no, not a throw', canCraft('nope', bag({ goldwood_log: 99 })) === false)
  // Station gating: `hand` recipes work anywhere, so standing at a table must never LOSE you options.
  check('hand recipes work at a table too', canCraft('goldwood_planks', bag({ goldwood_log: 1 }), 'crafting_table'))
}

// ── craftPlan ─────────────────────────────────────────────────────────────────
console.log('craftPlan')
{
  const plan = craftPlan('goldwood_planks')!
  check('plan takes the input', plan.take[0].itemId === 'goldwood_log' && plan.take[0].count === 1)
  check('plan gives the output', plan.give.itemId === 'goldwood_plank' && plan.give.count === 4)
  check('unknown recipe plans to null', craftPlan('nope') === null)
  // The core hands back copies, never its own table rows — a host that mutated a plan in place
  // would silently rewrite the recipe for every later craft in the session.
  plan.take[0].count = 999
  check('plan is a copy, not the table row', recipeDef('goldwood_planks')!.input[0].count === 1)
}

// ── availableRecipes ──────────────────────────────────────────────────────────
console.log('availableRecipes')
{
  check('empty bag → nothing', availableRecipes(bag({})).length === 0)
  const withLog = availableRecipes(bag({ goldwood_log: 1 })).map(r => r.id)
  check('one goldwood log opens both goldwood options',
    withLog.includes('goldwood_planks') && withLog.includes('goldwood_bark'),
    `got ${JSON.stringify(withLog)}`)
  check('a log does not open the table', withLog.includes('crafting_table') === false)
}

// ── ★ REACHABILITY — the assert this file exists for ──────────────────────────
console.log('reachability')
{
  // What mining can put in your hands, directly.
  const fromBlocks = new Set(BLOCKS.flatMap(b => b.drops.map(d => d.itemId)))
  // ...plus anything the recipe table can make from those. One pass is enough today (refining is
  // one step deep); if the table ever grows a chain, this becomes a fixpoint loop and the assert
  // below is what will tell you.
  // ...plus everything else this world hands over. ⚠ THIS USED TO BUILD ITS OWN SET, which made it
  // the THIRD copy of one derivation — and the copies drifted apart exactly as you would expect: this
  // one could not see rinning (so the sweep exempted the skill) and none of them could see FELLING.
  // `voxel/obtainable.ts` is the single home now; a source registered there is visible to every
  // reader at once, which is the only version of this that stays true.
  const obtainable = WORLD_ITEMS

  const unreachable = (ids: string[]) => ids.filter(id => !obtainable.has(id))

  const recipeGaps = unreachable(RECIPES.flatMap(r => r.input.map(i => i.itemId)))
  check('every recipe input is reachable by mining', recipeGaps.length === 0, recipeGaps.join(', '))

  // The four ruled woods must all be cuttable AND refinable — this is the specific regression.
  for (const w of ['goldwood', 'shimmeroak', 'starwillow', 'dawnwood']) {
    check(`${w} log drops from a block`, fromBlocks.has(`${w}_log`))
    check(`${w} log refines into something`, RECIPES.some(r => r.input.some(i => i.itemId === `${w}_log`)))
  }

  // ── The tool ladder. RINNING IS NOW SWEPT LIKE THE REST — the exemption expired (2026-08-22) ──
  // What stood here excluded rinning "with its reason": *"the voxel world has no creatures yet and
  // water is `placeable:false, drops:[]`, so rinning has no block answer at all."* Every word of
  // that was true when written and it stopped being true on 2026-08-20, when rinning shipped: the
  // answer was never going to be a block, it is `RIN_TIERS`.
  //
  // ★★★ AND AN EXEMPTION IS NOT A NEUTRAL OMISSION — IT IS A SILENT PROMISE THAT SOMEONE IS
  // WATCHING THAT CORNER. While this skipped, `glowfin_rinstick` asked for `glowfin` while tier-2
  // water dealt `glowfin_scale`, so the ladder ended at tier 1 and this sweep — the file that
  // exists to prove a tool is craftable — reported every tool craftable. The stale ids sat in
  // `RINNING_PENDING` in plain sight; nothing read them, because rinning `continue`d one line
  // above and that list could never fire.
  const toolGaps: string[] = []
  for (const [id, def] of Object.entries(TOOL_DEFS)) {
    if (def.basic) continue
    for (const i of def.recipe) {
      if (!obtainable.has(i.itemId)) toolGaps.push(`${id} needs ${i.itemId}`)
    }
  }
  check('every non-basic tool in every skill is craftable from what this world gives up', toolGaps.length === 0, toolGaps.join(' · '))

  // ── the spade must never become a KEY ────────────────────────────────────────────────────────
  // Farming's tool was added 2026-08-07 with no basic tier on purpose: soil and sand stay
  // `skill: null` so bare hands dig them, and the spade is a speed step via `fastSkill`. If someone
  // later "tidies" soil to `skill: 'farming'`, a fresh keeper with no spade can no longer dig dirt
  // — and there is no starter spade to save them. This asserts the capability, not the table.
  {
    const soil = BLOCKS.filter(b => b.fastSkill === 'farming')
    check('soil/sand are marked as spade work', soil.length >= 3)
    check('...and every one of them is still diggable BARE-HANDED',
      soil.every(b => b.skill === null && b.minTier === 0),
      'a fresh keeper has no spade — gating soil strands them at spawn')
    check('there is no basic spade to rescue that', !Object.values(TOOL_DEFS).some(d => d.basic && d.skillId === 'farming'),
      'if one is ever added, the assert above can be relaxed — not before')
  }

  // Nail the specific three that were dead, by name, so a regression names itself.
  for (const id of ['goldwood_blade', 'shimmeroak_blade', 'starwillow_blade']) {
    const gaps = unreachable(TOOL_DEFS[id].recipe.map(i => i.itemId))
    check(`${id} is craftable`, gaps.length === 0, `missing ${gaps.join(', ')}`)
  }
}

// ── ★ THE BUILDING GRAMMAR (2026-08-13, Alex's ruling) ────────────────────────
// "Blocks when broken give items… stone turns into rubble when mined." The rule is easy to state
// and easy to erode one convenient `placeable: true` at a time, so it is asserted rather than
// merely written down. Each of these is a way the ruling dies quietly.
console.log('building grammar')
{
  const def = (m: number) => ALL_BLOCKS.find(b => b.material === m)!

  // 1. YOU CANNOT PUT THE MOUNTAIN BACK. The whole ruling in one property.
  check('raw stone is not placeable', def(MAT.STONE).placeable === false,
    'placing back what you dug is the Minecraft loop this ruling replaces')
  check('deep stone is not placeable', def(MAT.DEEP_STONE).placeable === false)

  // 2. ...AND IT GIVES YOU A MATERIAL, not itself. A drop of `block_stone` would satisfy (1) while
  //    quietly restoring the old loop the moment anything made that item placeable again.
  check('quarrying stone yields rubble', def(MAT.STONE).drops[0].itemId === 'rubble')
  check('deep stone yields the same rubble', def(MAT.DEEP_STONE).drops[0].itemId === 'rubble',
    'one broken-rock economy, not two — the tier lives in what it costs to break')

  // 3. THE FORGIVENESS VALVE. Rubble goes back down, and only ever as rubble.
  check('rubble is placeable', def(MAT.RUBBLE).placeable === true,
    'a cozy game cannot make every mis-swing a permanent scar')
  check('rubble places as rubble, never as stone', materialForItem('rubble') === MAT.RUBBLE,
    'a patch has to show — that is what makes it forgiving rather than an undo')
  check('a bare hand can move rubble', def(MAT.RUBBLE).skill === null)

  // 4. SOIL, SUBSOIL AND SAND ARE EXEMPT — Alex ruled landscaping stays. This is the assert that
  //    catches someone "finishing" the ruling by sweeping every terrain block into it.
  for (const m of [MAT.TOPSOIL, MAT.SUBSOIL, MAT.SAND])
    check(`${def(m).name} stays placeable for landscaping`, def(m).placeable === true,
      'shaping your own plot is the cozy loop, not the Minecraft one')

  // 5. THE RUNG THAT MAKES IT BUILDABLE. Pieces alone do not make a house; without a crafted
  //    surface the ruling just removes building.
  check('cut stone is placeable', def(MAT.CUT_STONE).placeable === true)
  check('cut stone is CRAFTED, never dug', !ALL_BLOCKS.some(b => b.drops.some(d => d.itemId === 'cut_stone') && b.material !== MAT.CUT_STONE),
    'if any terrain block dropped it, the refine step is decoration')
  check('and the refine step exists', recipeDef('cut_stone')?.input[0].itemId === 'rubble')

  // ── ★ 5b. THE SAME RULE OVER THE WHOLE MASONRY PALETTE (2026-08-15) ────────────────────────
  // Generalised rather than repeated three times: any block whose item the recipe table can PRODUCE
  // must be reachable only by crafting it, or the refine step is decoration and the material is
  // just something you dig. The version above named `cut_stone`, so the three surfaces added with
  // the palette would each have needed someone to remember to copy it.
  {
    // ⚠ THE POT'S TWO GROWN STATES ARE EXCLUDED WITH THEIR REASON, not silently skipped. POT_SEEDED
    // and POT_BLOOM drop `clay_pot`, which IS a recipe output whose material is the empty POT — so
    // they trip the letter of this rule while being exactly right: the material IS the state
    // (depth.ts), and breaking a planted pot must hand back the pot you made. That is a state
    // machine over one crafted item, not a second way to obtain it. Anything else appearing here
    // is the real bug.
    const POT_STATES = new Set<number>([MAT.POT_SEEDED, MAT.POT_BLOOM])
    const dugCrafted = ALL_BLOCKS.filter(b => !POT_STATES.has(b.material) &&
      b.drops.some(d => RECIPE_OUTPUTS.has(d.itemId) && materialForItem(d.itemId) !== b.material))
    check('no terrain block drops a crafted surface', dugCrafted.length === 0,
      dugCrafted.map(b => b.name).join(', '))
    // And each new surface actually goes back down as itself — the `BY_ITEM` round-trip that makes
    // a placeable block's drop resolve to a voxel. A collision here silently steals another id.
    for (const id of ['stone_brick', 'pale_brick', 'sandstone'])
      check(`${id} places as itself`, ALL_BLOCKS.some(b => b.material === materialForItem(id) && b.drops[0].itemId === id))
  }

  // 6. THE WOOD HALF. A log is raw material; the PLANK is what you both spend and place.
  //
  // ── ★★★ THIS SECTION ASSERTED THE OPPOSITE UNTIL 2026-08-22, AND THAT IS THE POINT ───────────
  // It used to pin Alex's 08-13 ruling — *"actual planks not the block, not placeable, but can be
  // used to craft materials to build with"* — with `materialForItem('goldwood_plank') === undefined`
  // and a `planking` tier as the wooden surface. He reversed that on 08-22, asked twice and
  // confirmed twice, having played it: planking read as *"a bit out of place when each tree gives
  // logs that can already be turned into planks"*.
  //
  // ⚠ THE REVERSAL IS RECORDED RATHER THAN QUIETLY REWRITTEN, because a test that flips its own
  // assertion with no note reads like a bug someone patched. `pieces.ts` is the evidence that
  // settled it: doorway, window, roof, beam, fence and half slab already spent RAW planks in two
  // species, so the build's carpentry grammar had never been the one this section was defending.
  check('a log is not placeable', ALL_BLOCKS.filter(b => isLogMat(b.material)).every(b => b.placeable === false),
    'putting the trunk back up is the loop this ruling replaces')
  check('★ a plank PLACES, and is still what pieces cost', materialForItem('goldwood_plank') !== undefined,
    'the 08-13 ruling made this undefined; Alex reversed it 08-22')
  check('...and it places as ITSELF, so the round trip closes',
    def(materialForItem('goldwood_plank')!).drops[0].itemId === 'goldwood_plank',
    'a wall that gives back something other than what built it is a farm or a loss')
  // ★ ALL THREE PLANK WOODS, not just the day-one tree. This is what the cut bought: `planking`
  // hardcoded goldwood, so shimmeroak could roof a house and not wall one.
  for (const wood of ['goldwood', 'shimmeroak', 'dawnwood']) {
    const m = materialForItem(`${wood}_plank`)
    check(`${wood} planks are a wall`, m !== undefined && def(m).placeable === true,
      'the whole reason the planking tier was cut')
  }
  // ...and starwillow is NOT, because it yields branches. Guards the other direction: a fourth
  // wall nobody can craft is the shape of bug this week has been made of.
  check('starwillow has no wall, because it has no plank',
    materialForItem('starwillow_plank') === undefined)
  // ⚠ AND THE TIER IS ACTUALLY GONE, not merely unused — a recipe left behind would still show in
  // the craft surface and still be makeable.
  check('★ the planking tier is gone from the table', recipeDef('planking') === undefined)
  check('...and nothing still costs it', !RECIPES.some(r => r.input.some(i => i.itemId === 'planking')),
    'a cost pointing at an item no block drops is the uncraftable-forestry-ladder bug again')

  // 7. THE TWO HALVES MUST NOT COST THE SAME. Stone runs at a net loss (2 mined -> 1 placed) and
  //    wood at a net gain; that asymmetry IS the economy, and it is the kind of thing a later
  //    balance pass flattens without noticing what it was for.
  //
  // ⚠ WOOD IS MEASURED THROUGH ONE FEWER STEP SINCE 2026-08-22 and the assert is unchanged in
  // MEANING: it was `4 planks / 2 per panel = 2` placed blocks per log, and it is now `4 planks =
  // 4` placed blocks per log, because a plank places directly. Cutting the planking tier made wood
  // twice as cheap to build in, which only WIDENS the gap this section defends — so the check still
  // passes for the right reason rather than by luck. Stated because a reader who finds the number
  // doubled deserves to know it was a ruling and not a slip.
  {
    const perLog = recipeDef('goldwood_planks')!.output.count
    const woodOut = perLog                               // placed blocks per block mined
    // ⚠ WAS `1 / input.count`, WHICH HARDCODED AN OUTPUT OF ONE. It read as "placed per mined" and
    // was really "one over the input", so the 2026-08-15 re-granulation of cut_stone from 2→1 to
    // 4→2 — the SAME 2:1 ratio, by construction — would have reported the stone economy as having
    // silently halved and failed for a change that altered nothing. A ratio assert that only reads
    // one side of the ratio is a weak proxy wearing arithmetic.
    const cut = recipeDef('cut_stone')!
    const stoneOut = cut.output.count / cut.input[0].count
    check('wood is cheaper to build in than stone', woodOut > stoneOut,
      `wood ${woodOut} vs stone ${stoneOut} placed per block mined — timber is renewable and should feel it`)
    // And the loss itself, stated directly: hand-cutting stone must never break even, or "a quarry
    // is a real trip" stops being true and §7's asymmetry is decoration.
    check('hand-cut stone runs at a net loss', stoneOut < 1, `${stoneOut} placed per rubble`)
  }

  // 8. NOTHING STILL ASKS FOR THE ITEM THAT NO LONGER EXISTS. `block_stone` was a real cost on a
  //    real piece (the stair) until this ruling, and an uncraftable piece is invisible until a
  //    player tries to build one.
  const dead = new Set(['block_stone', 'block_deep_stone'])
  check('no recipe still costs raw stone', !RECIPES.some(r => r.input.some(i => dead.has(i.itemId))))
  check('no piece still costs raw stone', !PIECES.some(p => p.cost.some(c => dead.has(c.itemId))),
    'the stair pointed at block_stone and would have become uncraftable in silence')
}

// ── 9. THE CRAFTING SURFACE SHOWS ITS GOALS ───────────────────────────────────────────────────
//
// ★ THE BUG THIS EXISTS FOR, FOUND BY ALEX PLAYING ON 2026-08-22: the Garden Bed had shipped and
// could not be found in the C panel. The panel filtered to recipes where you hold ≥1 of every
// input, so a fixture whose ingredients you have never made is not greyed — it is absent. The
// reachability sweep above proved the bed was craftable in principle and never asked whether a
// keeper could SEE it. A cost table is a promise the thing is obtainable; this is the promise that
// it is FINDABLE.
{
  // An empty satchel is the honest fixture: a keeper on their first minute, holding nothing.
  const empty = () => 0
  const surface = craftSurface(empty)
  const shown = (id: string) => surface.some(r => r.id === id)

  // Named individually rather than as a count, because the tempting fix for a red count is to make
  // the count agree — the 08-22 law about asserting the NAME of what is missing.
  const goals = RECIPES.filter(r => isFixture(r.output.itemId)).map(r => r.id)
  const hidden = goals.filter(id => !shown(id))
  check('every fixture is visible with an EMPTY satchel', hidden.length === 0,
    `a goal you cannot see is not a goal — hidden: ${hidden.join(', ')}`)

  // The specific regression, by name, so this file says out loud what went wrong. All three woods,
  // because the bed became three recipes the same afternoon and "the goldwood one is visible" is
  // exactly the two-of-three green this day keeps producing.
  const beds = ['garden_bed_goldwood', 'garden_bed_shimmeroak', 'garden_bed_dawnwood']
  const missingBeds = beds.filter(id => !shown(id))
  check('...including every garden bed, which is what went missing', missingBeds.length === 0,
    `a bed cost planks nobody had made, so the row vanished instead of greying — missing: ${missingBeds.join(', ')}`)

  // ⚠ AND THE OTHER DIRECTION, or the assert above is satisfied by showing EVERYTHING — which is
  // the wall of 60-odd species rows the filter was written to prevent. A material naming a tree
  // this keeper has never met must stay off the surface until they meet it.
  check('a material you have never met stays off the surface', !shown('dawnwood_planks'),
    'the empty-satchel surface must not be the whole table')

  // ...and the heuristic still opens up once you hold the input, so the material half is not simply
  // dead. One dawnwood log is the whole qualification.
  const withLog = (id: string) => (id === 'dawnwood_log' ? 1 : 0)
  check('...and appears once you hold one', craftSurface(withLog).some(r => r.id === 'dawnwood_planks'))

  // The fixture set has to actually SEE something, or every assert above passes by being blind —
  // the same guard the hand-makeable rule carries.
  check('the fixture set is non-empty', goals.length > 0)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
