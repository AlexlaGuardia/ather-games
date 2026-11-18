// Run: npx tsx src/app/shimmer/open/ather/focuses.test.ts
// Blades + spikes (ather/focuses.ts, BETA M17): the engine's ladder at its bench, the soft penalty (double mana above the reach),
// the xpBonus, wear per node, and the worn starter back when a focus wears out.
import { FOCUSES, BENCH, PENALTY, reachOf, manaFor, bonusXp, makeFocus, wearFocus, focusName } from './focuses'
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
ok(reachOf(worn) === 1 && reachOf(undefined) === 1 && reachOf(gold) === 2 && reachOf(star) === 4, 'reach: worn 1, a crafted tier k reaches k + 1')
ok(manaFor(worn, 1, 5) === 5 && manaFor(worn, 2, 5) === 5 * PENALTY && manaFor(worn, 4, 7) === 7 * PENALTY, 'penalty: the worn focus pays double above tier 1, its own cost on tier 1')
ok(manaFor(gold, 2, 5) === 5 && manaFor(gold, 3, 5) === 10 && manaFor(star, 4, 5) === 5, 'penalty: a crafted focus works its reach cleanly, double above')
ok(bonusXp(worn, 40) === 0 && bonusXp(gold, 40) === 4 && bonusXp(star, 40) === 14, 'xp: the bonus is the engine\'s xpBonus')
ok(focusName(undefined, 'prospecting') === 'Worn Spike' && focusName(gold, 'forestry') === 'Goldwood Blade', 'names')

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
const better = { ...T0, forestry: { toolId: 'shimmeroak_blade', usesRemaining: 4, xpBonus: 1.2 } }
const down = makeFocus(W, carp.id, bag(['goldwood_plank', 9], ['goldwood_bark', 9]), better, 'goldwood_blade')
ok(!down.ok && /better/.test(down.why), 'make: a downgrade over a better focus with uses left is not refused')

ok(wearFocus(T0, 'forestry').tools === T0 && wearFocus(T0, 'forestry').broke === null, 'wear: the worn starter wore')
const one = { ...T0, forestry: { ...gold, usesRemaining: 2 } }
const w1 = wearFocus(one, 'forestry'), w2 = wearFocus(w1.tools, 'forestry')
ok(w1.tools.forestry?.usesRemaining === 1 && w1.broke === null, 'wear: one node, one use')
ok(w2.broke === 'Goldwood Blade' && w2.tools.forestry?.toolId === worn.toolId, 'wear: worn out did not hand the worn starter back')

console.log(`focuses: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
