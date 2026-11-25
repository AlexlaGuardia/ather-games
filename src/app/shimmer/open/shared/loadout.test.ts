// M179 (Alex 11-25): any owned gun in either slot; one gun never worn twice (its clip is keyed by gun id); equipping the gun the
// other slot wears swaps the two. Landing (Kael's chest, the starter, the gun shop) still goes to a gun's home slot.
// Run: npx tsx src/app/shimmer/open/shared/loadout.test.ts
import { newLoadout, setLoadout, equip, gunsFor, claimKaelsArms, slotOfGun, STARTER_GUN, KAEL_PRIMARY, type Loadout } from './loadout'
import { RANGE_GUNS } from './gunplay'
import { buyGun } from '../business/gun-shop'
import { NEW_LEDGER } from '../trade'
import { weapons } from './stance'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const all = (l: Loadout): Loadout => ({ ...l, guns: RANGE_GUNS.map(g => g.id) })
const noDup = (l: Loadout) => !(l.primary && l.primary === l.secondary)

// old behaviour: a newborn, Kael's chest
const nb = newLoadout()
ok(nb.primary === null && nb.secondary === STARTER_GUN, 'newborn: the Repeater is the secondary, no primary')
const k = claimKaelsArms(nb).loadout
ok(k.primary === KAEL_PRIMARY && k.secondary === STARTER_GUN, 'Kael: the Charred Rifle lands primary, the Repeater stays secondary')

// every owned gun is offered in both slots
const L = all(k)
for (const s of ['primary', 'secondary'] as const) ok(gunsFor(L, s).length === RANGE_GUNS.length, `${s} offers every owned gun`)
ok(gunsFor(nb, 'primary').map(g => g.id).join() === STARTER_GUN, 'a newborn\'s primary offers the Repeater (only owned gun)')
ok(gunsFor(k, 'secondary').some(g => g.id === KAEL_PRIMARY), 'a long gun is offered in the secondary')

// two long guns
const twoLong = equip(L, 'secondary', 'backbone')
ok(twoLong.primary === 'charred-rifle' && twoLong.secondary === 'backbone', `two long guns: ${twoLong.primary}/${twoLong.secondary}`)
ok(slotOfGun(RANGE_GUNS.find(g => g.id === 'backbone')!) === 'primary', 'fixture: the Backbone is a long gun')
// a sidearm as the primary, a long gun as the secondary
const flip = equip(equip(L, 'primary', 'repeater'), 'secondary', 'lance')
ok(flip.primary === 'repeater' && flip.secondary === 'lance', `repeater primary + lance secondary: ${flip.primary}/${flip.secondary}`)
// swap: the gun the other slot wears
const sw = equip(k, 'primary', STARTER_GUN)
ok(sw.primary === STARTER_GUN && sw.secondary === KAEL_PRIMARY, `swap: ${sw.primary}/${sw.secondary}`)
const sw2 = equip(sw, 'secondary', STARTER_GUN)
ok(sw2.primary === KAEL_PRIMARY && sw2.secondary === STARTER_GUN, 'swap back')
// the other slot empty: the gun moves, it is not copied
const moved = equip(nb, 'primary', STARTER_GUN)
ok(moved.primary === STARTER_GUN && moved.secondary === null, `moved into the empty primary: ${moved.primary}/${moved.secondary}`)
// never twice, over every pair of moves
let dupFree = true
for (const a of RANGE_GUNS) for (const b of RANGE_GUNS) for (const s1 of ['primary', 'secondary'] as const) for (const s2 of ['primary', 'secondary'] as const) {
  const r = equip(equip(L, s1, a.id), s2, b.id); if (!noDup(r) || !r.guns.every(g => L.guns.includes(g))) dupFree = false
}
ok(dupFree, 'no sequence of two equips wears one gun in both slots')
// refusals
ok(equip(nb, 'primary', 'lance') === nb, 'an unowned gun is refused')
ok(equip(nb, 'primary', 'nope') === nb, 'an unknown gun is refused')
ok(equip(nb, 'tactical', STARTER_GUN) === nb, 'a gun does not fit a vessel slot')
ok(equip(k, 'secondary', null).secondary === null, 'a gun slot can be emptied')

// Kael's chest after mixing: never a duplicate
const repPri = claimKaelsArms(moved).loadout   // the Repeater worn as the primary, the secondary empty
ok(noDup(repPri) && repPri.primary === STARTER_GUN, `Kael after the Repeater moved to primary: ${repPri.primary}/${repPri.secondary}`)
ok(repPri.guns.includes(KAEL_PRIMARY), 'the rifle is still owned')
// M140's lent rifle worn as the secondary before the chest is opened: the chest does not wear it twice
const lentRifle = equip(equip({ ...nb, guns: [STARTER_GUN, KAEL_PRIMARY], lent: [KAEL_PRIMARY] }, 'secondary', KAEL_PRIMARY), 'primary', null)
const kl = claimKaelsArms(lentRifle).loadout
ok(noDup(kl) && kl.secondary === KAEL_PRIMARY, `Kael with the lent rifle in the secondary: ${kl.primary}/${kl.secondary}`)

// the gun shop: a bought gun lands only in its home slot, if empty (unchanged)
const bought = buyGun(nb, { ...NEW_LEDGER, marks: 99999 }, 'backbone')
ok(bought.loadout.primary === 'backbone' && bought.loadout.secondary === STARTER_GUN, 'shop: a long gun lands in the empty primary')
const bought2 = buyGun(moved, { ...NEW_LEDGER, marks: 99999 }, 'backbone')
ok(bought2.loadout.primary === STARTER_GUN && bought2.loadout.secondary === null, 'shop: a filled home slot is left alone')

// R draws the primary first: the stance reads the slots in order
setLoadout(flip); ok(weapons().join() === 'repeater,lance', `stance order: ${weapons().join()}`)

console.log(fails.length ? `FAIL ${fails.length}\n  ${fails.join('\n  ')}` : `loadout.test: ${pass} ok`)
process.exit(fails.length ? 1 : 0)
