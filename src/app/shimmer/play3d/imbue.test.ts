/**
 * Imbue — a gem bound from a crystal and a rune you hold. The in-world road to a letter.
 * Run: `npx tsx src/app/shimmer/play3d/imbue.test.ts`
 */
import { readFileSync } from 'node:fs'
import { ELEMENT_CRYSTAL, crystalFor, imbue, imbueWhy, imbueSentence } from './imbue'
import { EMPTY_LETTERS } from './gems'
import { RUNES, ELEMENTS } from './birth/runes.data'
import { createInventory, addItems, countItem } from '../engine/inventory'
import { BLOCKS } from '../voxel/registry'
import { noComments } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

// ── A. the map covers every element canon has, and every crystal it names is a real seam drop ──
{
  const elems = ELEMENTS.map((e) => e.id)
  ok(elems.every((e) => ELEMENT_CRYSTAL[e]), `every element has a crystal (${elems.join(', ')})`)
  const drops = new Set(BLOCKS.flatMap((b) => (b.drops ?? []).map((d) => d.itemId)))
  const missing = Object.values(ELEMENT_CRYSTAL).filter((id) => !drops.has(id))
  ok(missing.length === 0, `★ every crystal the map names is dropped by a seam in the registry${missing.length ? ` — not: ${missing.join(', ')}` : ''}`)
  ok(RUNES.every((r) => crystalFor(r.id) !== null), 'every rune resolves to a crystal')
  ok(crystalFor('nope') === null, 'an unknown rune resolves to none')
}

// ── B. the act: one crystal in, one gem out; nothing taken on a refusal ──────────────────────
{
  const rune = RUNES.find((r) => !r.lostState)!
  const crystal = crystalFor(rune.id)!
  const inv = createInventory()
  ok(imbueWhy(inv, [rune.id], rune.id) === 'no-crystal', 'no crystal → no-crystal')
  ok(imbueWhy(inv, [], rune.id) === 'not-held', '★ a rune you do not hold cannot be imbued — identity first, before the crystal is even checked')
  ok(imbueWhy(inv, [rune.id], 'nope') === 'unknown-rune', 'an unknown rune is refused')
  addItems(inv, crystal, 2)
  ok(imbueWhy(inv, [rune.id], rune.id) === null, 'held + crystal → can imbue')
  const r1 = imbue(inv, EMPTY_LETTERS, [rune.id], rune.id)
  ok(r1.why === null && r1.letters.bag[rune.id] === 1, `one gem of ${rune.name} in the bag`)
  ok(countItem(inv, crystal) === 1, '★ exactly one crystal consumed')
  const r2 = imbue(inv, r1.letters, [rune.id], rune.id)
  ok(r2.why === null && r2.letters.bag[rune.id] === 2 && countItem(inv, crystal) === 0, 'twice: two gems, no crystals')
  const r3 = imbue(inv, r2.letters, [rune.id], rune.id)
  ok(r3.why === 'no-crystal' && r3.letters === r2.letters, 'refused when the crystals run out, letters untouched')
  // the wrong element's crystal does not imbue this rune
  const other = RUNES.find((r) => r.element !== rune.element)!
  const inv2 = createInventory(); addItems(inv2, crystalFor(other.id)!, 3)
  const r4 = imbue(inv2, EMPTY_LETTERS, [rune.id], rune.id)
  ok(r4.why === 'no-crystal' && countItem(inv2, crystalFor(other.id)!) === 3, `★ a ${other.element} crystal does not carry a ${rune.element} rune, and is not taken`)
  for (const w of ['not-held', 'no-crystal', 'unknown-rune'] as const) ok(imbueSentence(w, rune.id).length > 10, `sentence for ${w}`)
}

// ── C. the host: the letters card offers imbue and refreshes the world after ─────────────────
{
  const src = noComments(readFileSync(new URL('../voxel3d/VoxelWorld.tsx', import.meta.url), 'utf8'))
  const at = src.indexOf('function LettersCard(')
  const cardEnd = src.indexOf('\nfunction RunesTab(', at)
  ok(at >= 0 && cardEnd > at, 'the card slice has BOTH anchors — my first version sliced to the file tail when the end anchor missed, and passed for the wrong reason')
  const card = at >= 0 && cardEnd > at ? src.slice(at, cardEnd) : ''
  ok(/imbueWhy\(/.test(card) && /imbue\(/.test(card), 'the card asks imbueWhy per held rune and calls imbue on press')
  ok(/saveLetters\(/.test(card), 'the imbued letters are persisted')
  ok(/onChange\(\)/.test(card) || /onInvChange\(\)/.test(card), 'the world is told the bag changed (hotbar/craft refresh)')
  const uses = src.split('<LettersCard ').length - 1
  ok(uses === 2 && (src.match(/<LettersCard [^>]*items=\{items\}/g) ?? []).length === 2, 'both tab usages hand the card the item inventory')
}

console.log(`imbue: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
