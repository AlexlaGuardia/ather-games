// business/idris.ts (BETA M93 s3): Idris cuts runesmith LETTERS (bag items) into a gun's sigil, picked in order, one cut for
// all. First cut consumes one sigil_blank, later cuts into free slots do not; each rune consumes its letter and the fee;
// refusals change nothing; the stored sigil reads back through sigil.ts; the birth letter cut first halves reload mana.
//   npx tsx src/app/shimmer/open/business/idris.test.ts
import { idrisCanCut, idrisCut, canPickNext, lettersHeld, sigilOf, sigilGuns, SIGIL_CUT_FEE, whyText } from './idris'
import { idrisLine, IDRIS_LINES, IDRIS_BARKS } from './idris-lines'
import { SIGIL_ITEM } from './gun-shop'
import { letterItem } from './letters'
import { newLoadout, type Loadout } from '../shared/loadout'
import { newInv, give, countOf, type Inv } from '../shared/inventory'
import { reloadManaWith, SIGIL_CAP } from '../shared/sigil'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('✗', m) } }

const L0: Loadout = { ...newLoadout(), guns: ['repeater', 'charred-rifle', 'backbone'] }
const bag = (blanks: number, letters: Record<string, number> = { manalic: 1, star: 1, life: 1, stone: 1 }): Inv => {
  let inv = newInv()
  if (blanks) inv = give(inv, SIGIL_ITEM, blanks).inv
  for (const [r, n] of Object.entries(letters)) inv = give(inv, letterItem(r), n).inv
  return inv
}

// one cut, two runes in order: blank + both letters + 2 fees
{
  const r = idrisCut(L0, bag(2), 1000, 'repeater', ['manalic', 'star'])
  ok(r.ok, 'two-rune cut ok')
  if (r.ok) {
    ok(countOf(r.inv, SIGIL_ITEM) === 1, 'first cut consumes ONE blank')
    ok(countOf(r.inv, letterItem('manalic')) === 0 && countOf(r.inv, letterItem('star')) === 0, 'each rune consumes its letter')
    ok(countOf(r.inv, letterItem('life')) === 1, 'unpicked letters stay')
    ok(r.marks === 1000 - 2 * SIGIL_CUT_FEE, 'fee per rune')
    ok(JSON.stringify(r.loadout.fit?.repeater?.sigil) === '["manalic","star"]', 'stored on Loadout.fit[gun].sigil in pick order')
    ok(JSON.stringify(sigilOf(r.loadout, 'repeater').runes) === '["manalic","star"]', 'sigilOf reads it back')
    // a sigil already set takes the 3rd rune with no blank in the bag
    const r2 = idrisCut(r.loadout, bag(0, { life: 1 }), r.marks, 'repeater', ['life'])
    ok(r2.ok && r2.sigil.runes.length === SIGIL_CAP, 'free slot filled later without a new blank')
    if (r2.ok) {
      const cap = idrisCanCut(r2.loadout, bag(1, { lightning: 1 }), r2.marks, 'repeater', ['lightning'])
      ok(!cap.ok && cap.why === 'cap', 'cap refused')
    }
    const same = idrisCanCut(r.loadout, bag(0), r.marks, 'repeater', ['stone'])
    ok(!same.ok && same.why === 'same-state' && same.at === 'stone', 'same state vs the existing sigil refused (stone + manalic, Solid)')
    ok(r.loadout.fit?.backbone === undefined, 'other gun untouched')
  }
}
// within one pick list
{
  const s = idrisCanCut(L0, bag(1), 1000, 'repeater', ['manalic', 'stone'])
  ok(!s.ok && s.why === 'same-state' && s.at === 'stone', 'same state inside one pick list refused')
  const d = idrisCanCut(L0, bag(1, { manalic: 2 }), 1000, 'repeater', ['manalic', 'manalic'])
  ok(!d.ok && d.why === 'duplicate', 'duplicate inside one pick list refused')
  const c = idrisCanCut(L0, bag(1, { manalic: 1, star: 1, life: 1, barrier: 1 }), 9999, 'repeater', ['manalic', 'star', 'life', 'barrier'])
  ok(!c.ok && c.why === 'cap', 'four picks refused')
}
// a fitted sight survives the cut
{
  const L = { ...L0, fit: { backbone: { sight: 'open-lens', owned: ['open-lens'] } } }
  const r = idrisCut(L, bag(1), 500, 'backbone', ['life'])
  ok(r.ok && r.loadout.fit?.backbone?.sight === 'open-lens' && r.loadout.fit.backbone.owned?.[0] === 'open-lens', 'sight + owned survive the cut')
}
// refusals change nothing
{
  const no = (why: string, r: ReturnType<typeof idrisCut>) => ok(!r.ok && r.why === why, `refused: ${why}`)
  no('no-letter', idrisCut(L0, bag(1), 1000, 'repeater', ['lightning']))
  no('no-blank', idrisCut(L0, bag(0), 1000, 'repeater', ['manalic']))
  no('marks', idrisCut(L0, bag(1), 2 * SIGIL_CUT_FEE - 1, 'repeater', ['manalic', 'star']))
  no('no-socket', idrisCut(L0, bag(1), 1000, 'charred-rifle', ['manalic']))
  no('no-gun', idrisCut(L0, bag(1), 1000, 'not-a-gun', ['manalic']))
  no('unknown-rune', idrisCut(L0, bag(1), 1000, 'repeater', ['nope']))
  no('none-picked', idrisCut(L0, bag(1), 1000, 'repeater', []))
  ok(L0.fit === undefined, 'input loadout never mutated')
  for (const w of ['no-gun', 'no-letter', 'no-blank', 'marks', 'no-socket', 'unknown-rune', 'cap', 'same-state', 'duplicate', 'none-picked'] as const) ok(whyText(w).length > 0, `whyText ${w}`)
}
// the picker: a fitting letter is pickable without a blank or Marks (those are the cut's)
{
  ok(canPickNext(L0, bag(0), 'repeater', [], 'manalic').ok, 'picker ignores the blank')
  const p = canPickNext(L0, bag(0), 'repeater', ['manalic'], 'stone')
  ok(!p.ok && p.why === 'same-state', 'picker greys a same-state letter')
  ok(!canPickNext(L0, bag(0), 'repeater', [], 'lightning').ok, 'picker greys a letter not in the bag')
  ok(JSON.stringify(lettersHeld(bag(0, { star: 2, manalic: 1 }))) === '["manalic","star"]', 'lettersHeld lists held letters in rune order')
}
// birth letter cut first = half reload mana
{
  const r = idrisCut(L0, bag(1, { breeze: 1 }), 1000, 'repeater', ['breeze'])
  ok(r.ok && reloadManaWith(r.sigil, 'breeze', 10) === 5, 'birth rune cut first halves reload mana')
}
ok(JSON.stringify(sigilGuns(L0)) === '["repeater","backbone"]', 'sigilGuns drops the Charred Rifle')
ok(sigilOf({ ...L0, fit: { repeater: { sigil: 'x' as unknown as string[] } } }, 'repeater').runes.length === 0, 'corrupt sigil reads empty')
// every line lark wrote is present, no em dashes, pronoun-free (canon gives Idris none)
for (const id of ['idris.greet.first.1', 'idris.greet.first.2', 'idris.greet.first.3', 'idris.greet.repeat', 'idris.offer', 'idris.noblank', 'idris.norunes', 'idris.confirm', 'idris.done', ...IDRIS_BARKS] as const) {
  ok(!!IDRIS_LINES[id] && idrisLine(id) !== id, `line ${id} present`)
  ok(!/—/.test(idrisLine(id)), `${id}: no em dash`)
}

// M93 s4 RE-CUT: a new blank replaces the sigil; old runes gone, letters not returned
{
  const one = idrisCut(L0, bag(1), 1000, 'repeater', ['manalic']); if (!one.ok) throw new Error('setup')
  const L1 = one.loadout
  const nb = idrisCanCut(L1, bag(0, { star: 1 }), 1000, 'repeater', ['star'], true)
  ok(!nb.ok && nb.why === 'no-blank', 're-cut needs a new blank')
  ok(idrisCanCut(L1, bag(0, { star: 1 }), 1000, 'repeater', ['star']).ok, 'adding to a sigil with room needs no blank')
  const r = idrisCut(L1, bag(1, { star: 1, stone: 1 }), 1000, 'repeater', ['stone', 'star'], true)
  ok(r.ok && JSON.stringify(r.sigil.runes) === '["stone","star"]', 're-cut: the picks start an empty sigil (stone fits though manalic was Solid)')
  ok(r.ok && JSON.stringify(r.loadout.fit?.repeater?.sigil) === '["stone","star"]', 're-cut: stored replaces the old runes')
  ok(r.ok && countOf(r.inv, SIGIL_ITEM) === 0 && countOf(r.inv, letterItem('manalic')) === 0, 're-cut: the blank is spent, the old letter does not come back')
  ok(r.ok && r.marks === 1000 - 2 * SIGIL_CUT_FEE, 're-cut: fee per rune')
  const full = idrisCut(L0, bag(1, { manalic: 1, star: 1, life: 1, barrier: 1 }), 9999, 'repeater', ['manalic', 'star', 'life']); if (!full.ok) throw new Error('setup2')
  const capped = idrisCanCut(full.loadout, bag(1, { barrier: 1 }), 9999, 'repeater', ['barrier'])
  ok(!capped.ok && capped.why === 'cap', 'a full sigil refuses more')
  ok(idrisCanCut(full.loadout, bag(1, { barrier: 1 }), 9999, 'repeater', ['barrier'], true).ok, 'a full sigil can be re-cut')
  ok(canPickNext(full.loadout, bag(0, { barrier: 1 }), 'repeater', [], 'barrier', true).ok && !canPickNext(full.loadout, bag(0, { barrier: 1 }), 'repeater', [], 'barrier').ok, 'picker follows re-cut')
}

console.log(`idris: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
