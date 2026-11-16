// business/letters.ts: every rune has a seat per canon, a cut takes the recipe + fee, Scatter needs a blueprint,
// Idony inscribes blank vessels (never Greg's glove), the word's letters come out of the bag.
import { RUNES } from '../../play3d/birth/runes.data'
import { RUNE_SEATS, SEATS, SCATTER, lettersAt, recipeOf, cut, canCut, letterItem, imbuable, wordsFor, imbue, CUT_FEE, IMBUE_FEE, lightsFor } from './letters'
import { newInv, give, countOf, type Inv } from '../shared/inventory'
import { newLoadout } from '../shared/loadout'
import { BLANKSTONE, CRYSTAL_ITEM } from '../ather/prospecting'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

ok(RUNES.every(r => (RUNE_SEATS[r.id] ?? []).length > 0), 'every rune has a runesmith seat (schools.md: "Every rune now has a seat")')
ok(['magma', 'tempest', 'star'].every(r => RUNE_SEATS[r].length === 2), 'the three overlap runes cut at either seat')
ok(RUNE_SEATS.illuminate.join() === 'wind' && RUNE_SEATS.manalic.join() === 'enchant', 'Illuminate at Galecrest, Manalic at the Citadel')
ok(SEATS.star.place === null && SEATS.earth.place === 'the-moldy-boulder', 'Star has no place yet; Earth is the Cairn behind the Moldy Boulder')
ok(lettersAt('fire').join() === 'star,tempest,magma', `Redstair cuts ${lettersAt('fire').join()}`)
const stock = (inv: Inv, rune: string, k = 1) => { let o = inv; for (const x of recipeOf(rune)) o = give(o, x.id, x.n * k).inv; return o }
ok(recipeOf('magma').map(x => x.id).join() === [BLANKSTONE, CRYSTAL_ITEM.raw, CRYSTAL_ITEM.earth].join(), 'a Magma letter: Blankstone + raw shards + an earth crystal')
let inv = stock(newInv(), 'magma')
ok(!canCut(inv, 1500, 'water', 'magma').ok, 'the Water School does not cut Magma')
ok(!canCut(newInv(), 1500, 'fire', 'magma').ok, 'no material, no letter')
ok(!canCut(inv, CUT_FEE - 1, 'fire', 'magma').ok, 'short of the fee, no letter')
const c = cut(inv, 1500, 'earth', 'magma')
ok(c.ok && countOf(c.inv, letterItem('magma')) === 1 && c.marks === 1500 - CUT_FEE && countOf(c.inv, BLANKSTONE) === 0, 'a cut takes the recipe + fee and gives the letter')
ok([...SCATTER].every(r => !canCut(stock(newInv(), r), 1e6, RUNE_SEATS[r][0], r, false).ok), 'a Scatter letter needs its blueprint')
ok(canCut(stock(newInv(), 'dust'), 1e6, 'earth', 'dust', true).ok, 'with the blueprint, the Cairn cuts Dust')
// Idony
const l = newLoadout()
ok(imbuable(l).map(v => v.id).join() === 'starter-bracelet', "Idony inscribes Greg's bracelet; Greg's glove stays earned")
const w = wordsFor('bracelet').find(x => x.letters.length === 1)!
ok(!!w, `a one-letter tactical word exists (${w?.name})`)
const noLetter = imbue(l, newInv(), 1500, 'starter-bracelet', w.id)
ok(!noLetter.ok, 'no letter, no imbue')
const withLetter = give(newInv(), letterItem(w.letters[0]), 1).inv
const im = imbue(l, withLetter, 1500, 'starter-bracelet', w.id)
ok(im.ok && im.loadout.vessels.find(v => v.id === 'starter-bracelet')!.word === w.id && countOf(im.inv, letterItem(w.letters[0])) === 0 && im.marks === 1500 - IMBUE_FEE, 'the imbue sets the word, spends the letter + fee')
ok(!imbue(l, withLetter, 1500, 'starter-glove', w.id).ok, "Greg's glove refused")
ok(CUT_FEE + IMBUE_FEE <= 1500, 'a new keeper can afford their birth word out of the emergency fund')
ok(lightsFor([w.letters[0]], w.letters[0]) && !lightsFor(['freeze'], 'magma'), 'lights on the birth rune; off-lane stays dark')
ok(wordsFor('glove').length === 0 && wordsFor('bracelet').length > 20, `a glove takes no cut word (signature words are earned); bracelets take ${wordsFor('bracelet').length} tactical words`)
console.log(`letters: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
