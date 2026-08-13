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
import { MAT } from './depth'
import { PIECES } from './pieces'
import { TOOL_DEFS } from '../engine/tools'

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
  check('every refine step is makeable by hand',
    RECIPES.filter(r => r.id !== 'crafting_table').every(r => r.station === 'hand'),
    'v1 refining is deliberately station-free; mining is the gate, not furniture')
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
  const obtainable = new Set([...fromBlocks, ...RECIPE_OUTPUTS])

  const unreachable = (ids: string[]) => ids.filter(id => !obtainable.has(id))

  const recipeGaps = unreachable(RECIPES.flatMap(r => r.input.map(i => i.itemId)))
  check('every recipe input is reachable by mining', recipeGaps.length === 0, recipeGaps.join(', '))

  // The four ruled woods must all be cuttable AND refinable — this is the specific regression.
  for (const w of ['goldwood', 'shimmeroak', 'starwillow', 'dawnwood']) {
    check(`${w} log drops from a block`, fromBlocks.has(`${w}_log`))
    check(`${w} log refines into something`, RECIPES.some(r => r.input.some(i => i.itemId === `${w}_log`)))
  }

  // ── The tool ladder. Rinning is excluded WITH ITS REASON, not silently skipped ──────────────
  // `shimmerscale` / `clickclaw` are CREATURE drops. The voxel world has no creatures yet and water
  // is `placeable:false, drops:[]`, so rinning has no block answer at all. That is an open design
  // gap (Jin's — how a water skill works in a block world), not a canon gap and not a bug to patch
  // by inventing a fish block. Excluded explicitly so the sweep stays honest about what it covers.
  const RINNING_PENDING = new Set(['shimmerscale', 'clickclaw', 'glowfin_scale', 'moonkoi_scale'])
  const toolGaps: string[] = []
  for (const [id, def] of Object.entries(TOOL_DEFS)) {
    if (def.basic || def.skillId === 'rinning') continue   // farming (spades) IS swept — see below
    for (const i of def.recipe) {
      if (!obtainable.has(i.itemId) && !RINNING_PENDING.has(i.itemId)) toolGaps.push(`${id} needs ${i.itemId}`)
    }
  }
  check('every forestry + prospecting + farming tool is craftable from mined material', toolGaps.length === 0, toolGaps.join(' · '))

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

  // 6. NOTHING STILL ASKS FOR THE ITEM THAT NO LONGER EXISTS. `block_stone` was a real cost on a
  //    real piece (the stair) until this ruling, and an uncraftable piece is invisible until a
  //    player tries to build one.
  const dead = new Set(['block_stone', 'block_deep_stone'])
  check('no recipe still costs raw stone', !RECIPES.some(r => r.input.some(i => dead.has(i.itemId))))
  check('no piece still costs raw stone', !PIECES.some(p => p.cost.some(c => dead.has(c.itemId))),
    'the stair pointed at block_stone and would have become uncraftable in silence')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
