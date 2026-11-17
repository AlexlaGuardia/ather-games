// business/errand.ts: the first errand's stage is read off facts (gems given, the letter in the bag, Greg's bracelet).
import { stageOf, gregsGems, birthSeat, errandEntries } from './errand'
import { cut, letterItem, imbue, wordsFor } from './letters'
import { newInv, countOf } from '../shared/inventory'
import { newLoadout } from '../shared/loadout'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const l = newLoadout()
ok(stageOf(null, newInv(), l, false) === 'none', 'no birth rune, no errand')
ok(stageOf('star', newInv(), l, false) === 'greg', 'born: see Greg first')
const g = gregsGems(newInv(), 'star')
ok(g.left === 0 && countOf(g.inv, 'blankstone') === 1, "Greg's gems = one letter's material")
ok(stageOf('star', g.inv, l, true) === 'smith', 'gems in hand: to the runesmith')
ok(birthSeat('star') === 'fire' && birthSeat('enchant') === 'enchant' && birthSeat('fluid') === 'water', 'the birth seat: Star at Redstair (the Star Temple has no place yet), Enchant in the Citadel')
const c = cut(g.inv, 1500, 'fire', 'star')
ok(c.ok && stageOf('star', c.inv, l, true) === 'temple', 'letter cut: to the Enchant Temple')
const w = wordsFor('bracelet').find(x => x.letters.join() === 'star')!
const im = c.ok ? imbue(l, c.inv, c.marks, 'starter-bracelet', w.id) : null
ok(!!im && im.ok && stageOf('star', im.inv, im.loadout, true) === 'done', 'imbued: done')
ok(countOf(newInv(), letterItem('star')) === 0, 'a fresh bag holds no letter')
ok(errandEntries('greg', 'star', { greg: { x: 1, z: 2 } })[0].where?.zone === 'ather' && errandEntries('smith', 'star', { smith: { x: 3, z: 4 } })[0].where?.zone === 'continent', 'Greg on the Ather, the runesmith on the continent')
{ const g = { x: 5, z: 6 }, s = errandEntries('smith', 'star', { gate: g })[0].where, m = errandEntries('temple', 'star', { gate: g, temple: { x: 7, z: 8 } })[0].where
  ok(s?.zone === 'ather' && s.x === 5 && m?.zone === 'continent' && m.x === 7, 'M5: on the Ather the smith line points at the gate; the continent door wins where seen') }
ok(errandEntries('done', 'star', {}).length === 0, 'done: the line comes off the page')
console.log(`errand: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
