// The Passage vessel shelf, by numbers. Run: npx tsx src/app/shimmer/open/shared/vessel-shelf.test.ts
import { baselineShelf, fitOf } from './vessel-shelf'
import { RUNES } from '../../play3d/birth/runes.data'
import { laneRunes } from '../../play3d/cast'
import { newLoadout, addVessel, MAX_PER_KIND } from './loadout'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const shelf = baselineShelf()
ok(shelf.length >= 15, `the baseline shelf is thin (${shelf.length})`)
ok(shelf.filter(i => i.kind === 'glove').every(g => g.word === null), 'a glove on the shelf carries a word (canon: no ultimate word is ever sold)')
ok(shelf.filter(i => i.kind === 'bracelet').every(b => b.runes.length === 1), 'the baseline is one-letter words only')
ok(new Set(shelf.map(i => i.key)).size === shelf.length, 'two shelf items share a key')
ok(shelf.every(i => i.price > 0 && Number.isInteger(i.price)), 'a price is not a whole positive number')
// every birth rune finds something written for it on the shelf (its own rune or its lane)
const starved = RUNES.filter(r => !shelf.some(i => { const f = fitOf(i, r.id); return f === 'birth' || f === 'lane' })).map(r => r.id)
ok(starved.length === 0, `birth runes with nothing on their lane: ${starved.join(', ')}`)
// fit agrees with the Lane Law: every rune of the word on the keeper's ELEMENT lane
for (const r of RUNES) for (const i of shelf) {
  const f = fitOf(i, r.id), lane = laneRunes(r.id, 'element')
  if (i.kind === 'glove') { if (f !== 'any') fails.push(`glove fit ${f}`); continue }
  const want = i.runes[0] === r.id ? 'birth' : i.runes.every(x => lane.has(x)) ? 'lane' : 'off'
  if (f !== want) fails.push(`${r.id} × ${i.key}: fit ${f}, Lane Law says ${want}`)
}
pass++
ok(fitOf(shelf.find(i => i.kind === 'bracelet')!, null) === 'off', 'with no birth rune a bracelet reads as written for you')
// the carry cap
let l = newLoadout()
for (let k = 0; k < 5; k++) l = addVessel(l, { kind: 'bracelet', label: 'Bracelet', word: 'X', tier: 1 }).loadout
ok(l.vessels.filter(v => v.kind === 'bracelet').length === MAX_PER_KIND, 'a keeper carried more than three bracelets')
console.log(`vessel-shelf: ${pass} passed, ${fails.length} failed`)
for (const f of fails.slice(0, 10)) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
