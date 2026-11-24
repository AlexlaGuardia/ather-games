// Run: npx tsx src/app/shimmer/open/ather/focuses.test.ts
// Blades + spikes (ather/focuses.ts, BETA M17): the engine's ladder at its bench, the rungs (M136; costs per node are channel.test's),
// the xpBonus, the bench's refusals at or below the tier in hand, and that nothing wears (M133).
import { FOCUSES, BENCH, rungOf, reachOf, bonusXp, makeFocus, ownedWhy, focusName } from './focuses'
import { TOOL_DEFS, ensureBasicTools, makeBasicTool } from '../../engine/tools'
import { freshWorks, type Works, type Room } from './rooms'
import { newInv, give, countOf, OPEN_ITEMS, type Inv } from '../shared/inventory'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const bag = (...xs: [string, number][]) => xs.reduce<Inv>((a, [id, n]) => give(a, id, n).inv, newInv(16))

ok(Object.entries(FOCUSES).every(([s, ids]) => ids.length === 3 && ids.every((id, i) => TOOL_DEFS[id]?.skillId === s && TOOL_DEFS[id].tier === i + 1 && !TOOL_DEFS[id].basic)), 'ladder: not the engine\'s three tiers per family')
ok(Object.values(FOCUSES).flat().every(id => TOOL_DEFS[id].recipe.every(c => !!OPEN_ITEMS[c.itemId])), 'reach: a recipe needs something the open world never gives')
const worn = makeBasicTool('forestry')!, gold = { toolId: 'goldwood_blade', usesRemaining: 50, xpBonus: 1.1 }, star = { toolId: 'starwillow_blade', usesRemaining: 9, xpBonus: 1.35 }
ok(rungOf(worn) === 1 && rungOf(undefined) === 1 && rungOf(gold) === 1 && rungOf(star) === 3, 'rung: worn and Goldwood 1, Starwillow 3 (M136)')
ok(reachOf(worn) === 2 && reachOf(gold) === 2 && reachOf(star) === 4, 'reach: rung 1 works tiers 1 and 2 cleanly, each rung one more (M136)')
ok(bonusXp(worn, 40) === 0 && bonusXp(gold, 40) === 4 && bonusXp(star, 40) === 14, 'xp: the bonus is the engine\'s xpBonus')
ok(focusName(undefined, 'prospecting') === 'Worn Spike' && focusName(gold, 'forestry') === 'Goldwood Pruner', 'names')

const carp: Room = { id: 'carpentry-1', kind: 'carpentry', x: 0, z: 0, q: 0, placedAt: 0, doneAt: 0, store: [{ id: 'goldwood_plank', n: 3 }] }
const mason: Room = { id: 'stonemason-1', kind: 'stonemason', x: 9, z: 0, q: 0, placedAt: 0, doneAt: 0, store: [] }
const W: Works = { ...freshWorks(), rooms: [carp, mason] }
const T0 = ensureBasicTools({})
ok(BENCH.forestry === 'carpentry' && BENCH.prospecting === 'stonemason', 'bench: the proposal moved without the test')
const m = makeFocus(W, carp.id, bag(['goldwood_plank', 4], ['goldwood_bark', 3]), T0, 'goldwood_blade')
ok(m.ok && m.tools.forestry?.toolId === 'goldwood_blade' && m.tools.forestry.usesRemaining === TOOL_DEFS.goldwood_blade.durability, 'make: no fresh Goldwood Blade equipped')
ok(m.ok && countOf(m.inv, 'goldwood_plank') === 2 && countOf(m.inv, 'goldwood_bark') === 0 && !m.works.rooms[0].store?.length, 'make: not store-first (3 planks from the room, 2 from the bag)')
ok(m.ok && m.tools.prospecting?.toolId === T0.prospecting?.toolId, 'make: a blade touched the spike slot')
ok(!makeFocus(W, mason.id, bag(['goldwood_plank', 9], ['goldwood_bark', 9]), T0, 'goldwood_blade').ok, 'bench: a blade made at the Stonery')
ok(!makeFocus(W, carp.id, bag(['goldwood_plank', 1]), T0, 'goldwood_blade').ok, 'make: short inputs not refused')
const s = makeFocus(W, mason.id, bag(['raw_mana_shard', 8]), T0, 'mana_spike')
ok(s.ok && s.tools.prospecting?.toolId === 'mana_spike' && countOf(s.inv, 'raw_mana_shard') === 0, 'make: the Mana Spike at the Stonery')
// M133: tools are permanent, so the bench refuses (spending nothing) a lower tier and the same one again; a higher one is made
const full = bag(['goldwood_plank', 9], ['goldwood_bark', 9])
const better = { ...T0, forestry: { toolId: 'shimmeroak_blade', usesRemaining: 4, xpBonus: 1.2 } }
const down = makeFocus(W, carp.id, full, better, 'goldwood_blade')
ok(!down.ok && down.why === 'Your Shimmeroak Pruner is better.', 'M133: a lower tier is not plainly refused: ' + JSON.stringify(!down.ok && down.why))
const same = makeFocus(W, carp.id, full, { ...T0, forestry: gold }, 'goldwood_blade')
ok(!same.ok && same.why === 'You already have the Goldwood Pruner.', 'M133: the same tier again is not refused as owned')
ok(ownedWhy(gold, 'shimmeroak_blade') === null && ownedWhy(worn, 'goldwood_blade') === null && ownedWhy(undefined, 'goldwood_blade') === null, 'M133: an upgrade refused')
const upIn = TOOL_DEFS.shimmeroak_blade.recipe.reduce<Inv>((a, c) => give(a, c.itemId, c.count).inv, newInv(16))
ok(makeFocus(W, carp.id, upIn, { ...T0, forestry: gold }, 'shimmeroak_blade').ok, 'M133: the next tier up is not made over the one in hand')

// BETA M69 (Magii 43fef80 #5): the forestry tool is a PRUNER. Ids stay *_blade so saves keep their tool (no migration);
// every name a player reads says pruner, never blade.
import { ITEMS } from '../../sprites/items'
import { TAB_LABEL } from './bench-tabs'
const forestryTools = Object.values(TOOL_DEFS).filter(t => t.skillId === 'forestry')
ok(forestryTools.length >= 5 && forestryTools.every(t => /Pruner/.test(t.name) && !/blade/i.test(t.name)), 'M69: a forestry tool name still says blade: ' + forestryTools.map(t => t.name).join(', '))
ok(makeBasicTool('forestry')?.toolId === 'worn_blade' && TOOL_DEFS.worn_blade.name === 'Worn Pruner', 'M69: an old save\'s worn_blade must load as the Worn Pruner')
ok(focusName(undefined, 'forestry') === 'Worn Pruner', 'M69: the empty forestry slot names the Worn Pruner')
const forestryItems = ITEMS.filter(i => FOCUSES.forestry.includes(i.id))
ok(forestryItems.length === 3 && forestryItems.every(i => /Pruner/.test(i.name) && !/blade/i.test(i.name + ' ' + i.description)), 'M69: a pruner item still reads blade')
ok(TAB_LABEL.blades === 'Pruners', 'M69: the Carpentry bench tab still says Blades')

console.log(`focuses: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
