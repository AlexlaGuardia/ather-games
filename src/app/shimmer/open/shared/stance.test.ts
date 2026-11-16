// The stance (Alex 11-15): stowed by default; R tap draws / swaps / reloads, R hold stows; 1-8 / the wheel pick a
// hotbar item while no weapon is drawn. Run: npx tsx src/app/shimmer/open/shared/stance.test.ts
import { newInv, OPEN_ITEMS, give, SLOTS, type Inv } from './inventory'
import { STOWED, STOWED_SPEED, HOLD_MS, tapR, holdR, selectSlot, equipSlot, heldOf, litSlot, settle, weapons } from './stance'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

OPEN_ITEMS.test_gun = { name: 'Test Gun', blurb: '', icon: '', stack: 1, kind: 'gun' }
const one: Inv = newInv(12)                                   // repeater in slot 0, waymarks in slot 1
const two: Inv = give(newInv(12), 'test_gun', 1).inv           // + a second gun (lands in slot 2)

ok(STOWED.kind === 'stowed' && STOWED_SPEED > 1 && HOLD_MS >= 200, 'stance: not stowed by default, or stowed is not quicker')
ok(weapons(one).join() === 'repeater' && weapons(two).join() === 'repeater,test_gun', `stance: weapons are ${weapons(two)}`)
// R tap
let r = tapR(STOWED, one)
ok(r.stance.kind === 'weapon' && r.stance.which === 0 && !r.reload, 'R: a tap from stowed did not draw the primary')
ok(heldOf(r.stance, one) === 'repeater', 'R: the primary is not the repeater')
r = tapR(r.stance, one)
ok(r.reload && r.stance.kind === 'weapon', 'R: with one gun, a second tap did not reload')
r = tapR({ kind: 'weapon', which: 0 }, two)
ok(r.stance.kind === 'weapon' && r.stance.which === 1 && heldOf(r.stance, two) === 'test_gun' && !r.reload, 'R: with two guns, a tap did not swap to the secondary')
ok(tapR(r.stance, two).stance.kind === 'weapon' && (tapR(r.stance, two).stance as { which: number }).which === 0, 'R: a tap on the secondary did not swap back')
ok(tapR({ kind: 'item', slot: 1 }, one).stance.kind === 'weapon', 'R: a tap while holding an item did not draw the primary')
const noGun: Inv = { v: 1, slots: Array(SLOTS).fill(null) }
ok(tapR(STOWED, noGun).stance.kind === 'stowed', 'R: drew a weapon from a bag with no gun')
// R hold
ok(holdR({ kind: 'weapon', which: 1 }).kind === 'stowed' && holdR({ kind: 'item', slot: 1 }).kind === 'stowed', 'R: a hold did not stow')
// 1-8 / the wheel
ok(equipSlot({ kind: 'weapon', which: 0 }, 1, one).kind === 'item' && heldOf(equipSlot({ kind: 'weapon', which: 0 }, 1, one), one) === 'waymark', 'wheel click: a drawn gun did not give way to the lit item')
ok(equipSlot(STOWED, 1, one).kind === 'item', 'wheel click: stowed did not take the lit item')
ok(selectSlot(STOWED, 1, one).kind === 'item' && heldOf(selectSlot(STOWED, 1, one), one) === 'waymark', 'select: stowed, slot 2 did not hold the waymark')
ok(selectSlot({ kind: 'weapon', which: 0 }, 1, one).kind === 'weapon', 'select: a slot key changed hands while a weapon was drawn')
ok(selectSlot(STOWED, 5, one).kind === 'stowed', 'select: an empty slot did not leave the hands empty')
ok(selectSlot({ kind: 'item', slot: 1 }, 0, one).kind === 'weapon', 'select: picking the gun slot did not draw it')
// what the bar lights, and falling back when the hand empties
ok(litSlot(STOWED, one) === -1 && litSlot({ kind: 'item', slot: 1 }, one) === 1 && litSlot({ kind: 'weapon', which: 0 }, one) === 0, 'bar: the wrong slot lights')
const spent: Inv = { v: 1, slots: one.slots.map((s, i) => (i === 1 ? null : s)) }
ok(settle({ kind: 'item', slot: 1 }, spent).kind === 'stowed', 'settle: an emptied hand did not fall back to stowed')
ok(heldOf(STOWED, one) === null, 'stowed: something is in hand')

if (fails.length) { console.error(`stance: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`stance: ${pass}/0`)
