// The open world's bag (inventory.ts). Run: npx tsx src/app/shimmer/open/shared/inventory.test.ts
import { newInv, give, take, move, split, quickMove, countOf, HOTBAR, SLOTS, itemDef } from './inventory'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const a = newInv(12)
ok(a.slots.length === SLOTS && a.slots[0]?.id === 'repeater' && a.slots[1]?.id === 'waymark' && a.slots[1]?.n === 12, 'new: a fresh bag holds the Repeater in 1 and 12 waymarks in 2')
ok(newInv(0).slots[1] === null, 'new: a keeper with every waymark planted starts with none in the bag')
ok(countOf(newInv(5), 'waymark') === 5, 'new: seeds the waymarks a keeper still has')
// take: bag first, then the hotbar; never below zero
let b = give(a, 'waymark', 0).inv
const t = take(a, 'waymark', 3)!
ok(countOf(t, 'waymark') === 9 && countOf(a, 'waymark') === 12, 'take: wrong count, or it mutated its input')
ok(take(a, 'waymark', 13) === null, 'take: took more than the bag holds')
ok(take(a, 'waymark', 12)!.slots[1] === null, 'take: an empty stack stays as a zero')
// give: tops up, respects the stack size, reports overflow
const g = give(t, 'waymark', 5)
ok(countOf(g.inv, 'waymark') === 14 && g.inv.slots[1]?.n === 12 && g.left === 0, 'give: did not top up to the stack size, then spill into a new slot')
const full = { v: 1 as const, slots: Array(SLOTS).fill(null).map(() => ({ id: 'repeater', n: 1 })) }
ok(give(full, 'waymark', 3).left === 3, 'give: a full bag swallowed items')
ok(itemDef('repeater').stack === 1 && give(a, 'repeater', 1).inv.slots.filter(s => s?.id === 'repeater').length === 2, 'give: a gun stacked')
// move: swap, merge with overflow, no-op on empty
b = move(a, 0, HOTBAR + 3)
ok(b.slots[0] === null && b.slots[HOTBAR + 3]?.id === 'repeater', 'move: did not move into an empty slot')
b = move(a, 0, 1)
ok(b.slots[0]?.id === 'waymark' && b.slots[1]?.id === 'repeater', 'move: did not swap different items')
let m = { v: 1 as const, slots: Array(SLOTS).fill(null) as ({ id: string; n: number } | null)[] }
m.slots[2] = { id: 'waymark', n: 10 }; m.slots[9] = { id: 'waymark', n: 5 }
m = move(m, 9, 2)
ok(m.slots[2]?.n === 12 && m.slots[9]?.n === 3, 'move: a merge past the stack size lost or invented items')
ok(move(a, 5, 0) === a, 'move: moving an empty slot changed something')
// split + quickMove
const s = split(a, 1)
ok(s.slots[1]?.n === 6 && countOf(s, 'waymark') === 12 && s.slots.filter(x => x?.id === 'waymark').length === 2, 'split: not half, or items lost')
ok(s.slots.findIndex((x, i) => i !== 1 && x?.id === 'waymark') < HOTBAR, 'split: a hotbar stack split into the bag (same section first)')
const q = quickMove(a, 0)
ok(q.slots[0] === null && q.slots.findIndex(x => x?.id === 'repeater') >= HOTBAR, 'quickMove: hotbar → bag failed')
ok(quickMove(q, q.slots.findIndex(x => x?.id === 'repeater')).slots.findIndex(x => x?.id === 'repeater') < HOTBAR, 'quickMove: bag → hotbar failed')

if (fails.length) { console.error(`inventory: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`inventory: ${pass}/0`)
