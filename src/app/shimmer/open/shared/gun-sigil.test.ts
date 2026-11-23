// A fitted sigil tunes the gun in hand (BETA M93 s4). Run: npx tsx src/app/shimmer/open/shared/gun-sigil.test.ts
import { armedGun, sigilOf, sigilKey, reloadPayOf } from './gun-sigil'
import { tuneGun } from './sigil'
import { RANGE_GUNS, holdGun, reloadGun } from './gunplay'
import { ECON, payReload } from './vitals-economy'
import { newLoadout, type Loadout } from './loadout'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('✗', m) } }
const rep = RANGE_GUNS.find(g => g.id === 'repeater')!, charred = RANGE_GUNS.find(g => g.id === 'charred-rifle')!
const L = (fit: Loadout['fit']): Loadout => ({ ...newLoadout(), guns: ['repeater', 'charred-rifle'], fit })

ok(armedGun(rep, L(undefined)) === rep, 'no sigil: the same row object (plays exactly as before)')
ok(armedGun(rep, L({ repeater: { sigil: [] } })) === rep, 'empty sigil: untouched')
ok(armedGun(charred, L({ 'charred-rifle': { sigil: ['manalic'] } })) === charred, 'Charred Rifle: never tuned, even with a stray sigil')
const eng = { id: 'repeater', clip: 5 }   // an engine weapon shape without the range fields
ok(armedGun(eng, L({ repeater: { sigil: ['manalic'] } })) === eng, 'a gun without the tunable fields is untouched')
const t = armedGun(rep, L({ repeater: { sigil: ['manalic', 'life'] } }), 'star')
const want = tuneGun({ ...rep, reloadMana: ECON.reloadMana }, { gunId: 'repeater', runes: ['manalic', 'life'] }, 'star')
ok(t !== rep && JSON.stringify({ ...t, reloadMana: 0, reloadPay: 0 }) === JSON.stringify({ ...want, reloadMana: 0, reloadPay: 0 }), 'tuned exactly as sigil.ts tuneGun')
ok(t.reloadMana === rep.reloadMana && t.reloadPay === want.reloadMana, "the row's play3d reloadMana is untouched; the tuned M78 dial rides reloadPay")
ok(reloadPayOf(rep) === ECON.reloadMana, 'an untuned gun pays the M78 dial, not its row reloadMana')
const ench = armedGun(rep, L({ repeater: { sigil: ['enchant'] } }))
ok(ench.reloadPay! < ECON.reloadMana, 'enchant (+mana cost) makes the reload cheaper than the dial')
ok(t.reloadTime < rep.reloadTime, 'life cut: the reload is quicker')
ok(t.damage === rep.damage && t.clip === rep.clip, 'tuning never touches damage or clip')
const mine = armedGun(rep, L({ repeater: { sigil: ['star'] } }), 'star'), theirs = armedGun(rep, L({ repeater: { sigil: ['star'] } }), 'life')
ok(Math.abs(mine.reloadPay! * 2 - theirs.reloadPay!) < 1e-9 && theirs.reloadPay === ECON.reloadMana, 'birth rune first: half the reload mana')
// reloads PAY the tuned cost
{ const p = { cur: 10 }; ok(payReload(p, 2.5) && p.cur === 7.5, 'payReload takes the cost given') }
{ const p = { cur: 10 }; ok(payReload(p) && p.cur === 10 - ECON.reloadMana, 'payReload default = the M78 dial') }
{ const p = { cur: ECON.reloadMana / 2 }; ok(payReload(p, ECON.reloadMana / 2) && p.cur === 0, 'half price affordable at half the dial') }
{
  const g = { ...holdGun(mine), mana: { cur: 100 } }; g.ammo = 0
  reloadGun(g); ok(Math.abs(g.mana.cur - (100 - mine.reloadPay!)) < 1e-9 && g.reloading > 0, `reloadGun pays the gun's tuned mana (${100 - g.mana.cur})`)
  const u = { ...holdGun(rep), mana: { cur: 100 } }; u.ammo = 0
  reloadGun(u); ok(u.mana.cur === 100 - ECON.reloadMana, 'an untuned gun pays the dial')
}
ok(sigilKey(L({ repeater: { sigil: ['star'] } }), 'repeater', 'life') !== sigilKey(L({ repeater: { sigil: ['star', 'life'] } }), 'repeater', 'life'), 'sigilKey changes on a new cut')
ok(sigilOf(L({ repeater: { sigil: 'x' as unknown as string[] } }), 'repeater').runes.length === 0, 'corrupt sigil reads empty')

console.log(`gun-sigil: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
