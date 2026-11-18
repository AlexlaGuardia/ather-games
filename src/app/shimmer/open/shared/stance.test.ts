// The stance (Alex 11-15): stowed by default; R tap draws / swaps / reloads, R hold stows; 1-8 / the wheel pick a hotbar
// item while no weapon is drawn. ★ 11-18 (Alex): the weapons are the loadout's PRIMARY + SECONDARY (the Character tab), never
// bag items. Run: npx tsx src/app/shimmer/open/shared/stance.test.ts
import { newInv, SLOTS, type Inv } from './inventory'
import { newLoadout, setLoadout, claimKaelsArms, equip, KAEL_PRIMARY, KAEL_SECONDARY } from './loadout'
import { STOWED, STOWED_SPEED, HOLD_MS, tapR, holdR, selectSlot, equipSlot, heldOf, litSlot, settle, weapons } from './stance'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const bag: Inv = newInv(12)                                     // waymarks in slot 0, bait in slot 1, no gun
const none = newLoadout(), kael = claimKaelsArms(none).loadout
const oneGun = equip(kael, 'primary', null)                     // only the sidearm equipped
const wield = (l: typeof none) => setLoadout(l)

ok(STOWED.kind === 'stowed' && STOWED_SPEED > 1 && HOLD_MS >= 200, 'stance: not stowed by default, or stowed is not quicker')
wield(none); ok(weapons(bag).join() === 'repeater', 'weapons: a new keeper starts with the Repeater (Alex 11-18), worn as the sidearm')
ok(tapR(STOWED, bag).stance.kind === 'weapon' && heldOf(tapR(STOWED, bag).stance, bag) === 'repeater', 'R: a new keeper draws the starting Repeater')
wield(kael); ok(weapons(bag).join() === `${KAEL_PRIMARY},${KAEL_SECONDARY}`, `weapons: Kael's chest gives primary + secondary (${weapons(bag)})`)
// R tap
wield(equip(none, 'secondary', null)); ok(tapR(STOWED, bag).stance.kind === 'stowed', 'R: drew a weapon with nothing equipped')
wield(oneGun)
let r = tapR(STOWED, bag)
ok(r.stance.kind === 'weapon' && r.stance.which === 0 && !r.reload && heldOf(r.stance, bag) === KAEL_SECONDARY, 'R: with only the sidearm, a tap did not draw it')
r = tapR(r.stance, bag)
ok(r.reload && r.stance.kind === 'weapon', 'R: with one gun, a second tap did not reload')
wield(kael)
r = tapR(STOWED, bag)
ok(heldOf(r.stance, bag) === KAEL_PRIMARY, 'R: the first tap did not draw the primary')
r = tapR(r.stance, bag)
ok(r.stance.kind === 'weapon' && r.stance.which === 1 && heldOf(r.stance, bag) === KAEL_SECONDARY && !r.reload, 'R: with two guns, a tap did not swap to the secondary')
ok((tapR(r.stance, bag).stance as { which: number }).which === 0, 'R: a tap on the secondary did not swap back')
ok(tapR({ kind: 'item', slot: 0 }, bag).stance.kind === 'weapon', 'R: a tap while holding an item did not draw the primary')
// R hold
ok(holdR({ kind: 'weapon', which: 1 }).kind === 'stowed' && holdR({ kind: 'item', slot: 1 }).kind === 'stowed', 'R: a hold did not stow')
// 1-8 / the wheel: bag items only
ok(equipSlot({ kind: 'weapon', which: 0 }, 0, bag).kind === 'item' && heldOf(equipSlot({ kind: 'weapon', which: 0 }, 0, bag), bag) === 'waymark', 'wheel click: a drawn gun did not give way to the lit item')
ok(equipSlot(STOWED, 0, bag).kind === 'item', 'wheel click: stowed did not take the lit item')
ok(selectSlot(STOWED, 0, bag).kind === 'item' && heldOf(selectSlot(STOWED, 0, bag), bag) === 'waymark', 'select: stowed, slot 1 did not hold the waymark')
ok(selectSlot({ kind: 'weapon', which: 0 }, 0, bag).kind === 'weapon', 'select: a slot key changed hands while a weapon was drawn')
ok(selectSlot(STOWED, 5, bag).kind === 'stowed', 'select: an empty slot did not leave the hands empty')
// what the bar lights: an item's slot; a drawn gun is not on the bar any more, so nothing lights
ok(litSlot(STOWED, bag) === -1 && litSlot({ kind: 'item', slot: 1 }, bag) === 1 && litSlot({ kind: 'weapon', which: 0 }, bag) === -1, 'bar: the wrong slot lights')
// falling back when the hand empties, or the equipped gun goes away
const spent: Inv = { v: 1, slots: bag.slots.map((s, i) => (i === 1 ? null : s)) }
ok(settle({ kind: 'item', slot: 1 }, spent).kind === 'stowed', 'settle: an emptied hand did not fall back to stowed')
wield(equip(none, 'secondary', null)); ok(settle({ kind: 'weapon', which: 0 }, bag).kind === 'stowed', 'settle: unequipping every gun did not stow')
ok(heldOf(STOWED, bag) === null, 'stowed: something is in hand')
void SLOTS
if (fails.length) { for (const f of fails) console.log('  ✗', f); console.log(`stance: ${pass} pass, ${fails.length} FAIL`); process.exit(1) }
console.log(`stance: ${pass}/0`)
