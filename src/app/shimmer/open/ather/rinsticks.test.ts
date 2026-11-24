// Run: npx tsx src/app/shimmer/open/ather/rinsticks.test.ts
// Rinsticks at the Rinnshop (ather/rinsticks.ts). Canon pins: built from rinn (every recipe's first inputs are catches), no
// rinstick wears (M133); the reel's zone widens with the tier and never past a felt step.
import { RINSTICKS, EASE_BY_TIER, easeOf, xpOf, makeRinstick, rinstickName } from './rinsticks'
import { TOOL_DEFS, ensureBasicTools, makeBasicTool } from '../../engine/tools'
import { freshWorks, type Works, type Room } from './rooms'
import { newInv, give, countOf, ITEM_GROUP, OPEN_ITEMS, type Inv } from '../shared/inventory'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const bag = (...xs: [string, number][]) => xs.reduce<Inv>((a, [id, n]) => give(a, id, n).inv, newInv(12))

ok(RINSTICKS.every(id => TOOL_DEFS[id]?.skillId === 'rinning' && !TOOL_DEFS[id].basic), 'ladder: a rinstick is not an engine rinning upgrade')
ok(RINSTICKS.every(id => TOOL_DEFS[id].recipe.some(c => ITEM_GROUP[c.itemId] === 'rinning')), 'canon: a rinstick not built from rinn')
ok(RINSTICKS.every(id => TOOL_DEFS[id].recipe.every(c => !!OPEN_ITEMS[c.itemId])), 'reach: a rinstick needs something the open world never gives')
ok(EASE_BY_TIER[0] === 1 && EASE_BY_TIER.every((e, i) => i === 0 || (e > EASE_BY_TIER[i - 1] && e <= 1.5)), 'ease: not a rising felt step, or past 1.5')
ok(easeOf(makeBasicTool('rinning')!) === 1 && easeOf(undefined) === 1, 'ease: the worn rinstick widens the zone')
ok(easeOf({ toolId: 'moonkoi_rinstick', usesRemaining: 3 }) === EASE_BY_TIER[3], 'ease: the moonkoi rinstick is not the top step')
ok(xpOf({ toolId: 'glowfin_rinstick', usesRemaining: 1, xpBonus: 1.2 }, 45) === 54 && xpOf(makeBasicTool('rinning')!, 45) === 45, 'xp: the bonus is wrong')

const room: Room = { id: 'rinnshop-1', kind: 'rinnshop', x: 0, z: 0, q: 0, placedAt: 0, doneAt: 0, store: [{ id: 'shimmerscale', n: 4 }] }
const W: Works = { ...freshWorks(), rooms: [room] }
const T0 = ensureBasicTools({})
const m = makeRinstick(W, room.id, bag(['clickclaw', 5]), T0, 'basic_rinstick')
ok(m.ok && m.tools.rinning?.toolId === 'basic_rinstick' && m.tools.rinning.usesRemaining === TOOL_DEFS.basic_rinstick.durability, 'make: did not equip a fresh Basic Rinstick')
ok(m.ok && countOf(m.inv, 'clickclaw') === 1 && (m.works.rooms[0].store ?? []).length === 0, 'make: did not take the scale from the store and the claw from the bag')
ok(!makeRinstick(W, room.id, newInv(12), T0, 'basic_rinstick').ok, 'make: built from nothing')
ok(!makeRinstick(W, room.id, bag(['clickclaw', 4], ['shimmerscale', 4]), T0, 'worn_rinstick').ok, 'make: made the free starter')
const best = { ...T0, rinning: { toolId: 'moonkoi_rinstick', usesRemaining: 50 } }
const down = makeRinstick(W, room.id, bag(['clickclaw', 4]), best, 'basic_rinstick')
ok(!down.ok && down.why === 'Your Moonkoi Rinstick is better.', 'M133: a lower tier not plainly refused: ' + JSON.stringify(!down.ok && down.why))
const again = makeRinstick(W, room.id, bag(['clickclaw', 9]), { ...T0, rinning: { toolId: 'basic_rinstick', usesRemaining: 3 } }, 'basic_rinstick')
ok(!again.ok && again.why === 'You already have the Basic Rinstick.', 'M133: the same rinstick again is not refused as owned')
const carp: Room = { ...room, id: 'carp', kind: 'carpentry' }
ok(!makeRinstick({ ...W, rooms: [carp] }, 'carp', bag(['clickclaw', 4], ['shimmerscale', 4]), T0, 'basic_rinstick').ok, 'make: a rinstick made outside the Rinnshop')
ok(rinstickName(T0.rinning) === 'Worn Rinstick', 'name: the starter is not the Worn Rinstick')
if (fails.length) { console.error(`rinsticks: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`rinsticks: ${pass}/0`)
