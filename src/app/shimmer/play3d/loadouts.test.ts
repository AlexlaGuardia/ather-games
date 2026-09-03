/**
 * More than one loadout — the paper is per loadout, the bag is shared. Run: `npx tsx src/app/shimmer/play3d/loadouts.test.ts`
 */
import { readFileSync } from 'node:fs'
import { LOADOUTS_KEY, PAIR_PRICE, MAX_LOADOUTS, loadParked, saveParked, buyPair, swapTo, loadoutCount, emptyParked } from './loadouts'
import { LOADOUT_KEY, saveLoadout, rawLoadout, resolveLoadout, setSlot } from './loadout'
import { GEMS_KEY, addGems, isBodyHeld, saveLetters, loadLetters, type Letters } from './gems'
import { keeperBook, saveBook } from './book'
import { setBirthRune, grantRune, saveRuneInventory, EMPTY_INVENTORY } from './rune-inventory'
import { KEEPER_MOVES } from './keeper-moves'
import { ALL_BANDS, laneRunes } from './cast'
import { RUNES, ELEMENTS, runesOf } from './birth/runes.data'
import { KEEPER_KEYS } from '@/lib/keeper-local'
import { noComments } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const store: Record<string, string> = {}
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] },
}
const wipe = () => { for (const k of Object.keys(store)) delete store[k] }
const TAC = ALL_BANDS.indexOf('tactical')
ok(KEEPER_KEYS.includes(LOADOUTS_KEY), 'the parked-loadouts key is registered per keeper')

// ── A. buying a pair: price, cap, arrives empty ─────────────────────────────────────────────
{
  wipe()
  ok(loadoutCount() === 1, 'a keeper starts with one loadout — one focus, one bracelet')
  ok(buyPair(PAIR_PRICE - 1).why === 'too-dear' && loadParked().length === 0, 'too dear buys nothing')
  const r = buyPair(PAIR_PRICE)
  ok(r.ok && r.marks === 0 && loadParked().length === 1 && loadoutCount() === 2, 'the pair is bought and parked')
  const p = loadParked()[0]!
  ok(p.slots.every(s => s === null) && p.vessels.bracelet.length === 0 && p.vessels.focus.length === 0, '★ a new pair arrives EMPTY — no slots, no letters')
  ok(buyPair(1000).ok && loadoutCount() === MAX_LOADOUTS, 'a third is the cap')
  ok(buyPair(1000).why === 'at-cap' && loadoutCount() === MAX_LOADOUTS, '★ and a fourth is refused')
}

// ── B. ★ the canon sentence: two builds that both want Barrier want two gems AND two vessels ──
{
  wipe()
  // a birth whose element lane holds a written tactical — the word both loadouts want
  let pick: { birth: string; word: (typeof KEEPER_MOVES)[number] } | null = null
  for (const e of ELEMENTS) for (const r of runesOf(e.id)) {
    const w = KEEPER_MOVES.find(m => m.tier === 'tactical' && !isBodyHeld(m, r.id) && m.runes.every(x => laneRunes(r.id, 'element').has(x)))
    if (w) { pick = { birth: r.id, word: w }; break }
  }
  ok(!!pick, `fixture: a written element-lane tactical exists (${pick ? `${pick.birth}: ${pick.word.id}` : 'none'})`)
  if (pick) {
    const { birth, word } = pick
    let inv = setBirthRune(EMPTY_INVENTORY, birth); for (const r of word.runes) inv = grantRune(inv, r)
    saveRuneInventory(inv); saveBook({ learned: [word.id] })
    // ONE set of the word's letters in the bag; loadout 1 binds it
    let l: Letters = { bag: {}, vessels: { bracelet: [], focus: [] } }
    for (const r of word.runes) l = addGems(l, r)
    saveLetters(l); saveLoadout(ALL_BANDS.map(() => null))
    const s1 = setSlot(inv.owned, birth, ALL_BANDS.map(() => null), TAC, word.id, keeperBook(inv.owned))
    saveLoadout(s1)
    ok(s1[TAC] === word.id && JSON.parse(store[GEMS_KEY]!)[word.runes[0]!] === undefined, 'loadout 1 binds the word; its letters left the bag')
    // a SPARE gem in the bag, so a swap that drops the bag has something to drop (found by mutation:
    // with an empty bag at swap time, "swap drops the bag" survived every assert here)
    // ⚠ a rune NOT in the word — my first spare was the word's own rune, which handed the second build a
    // full set for a one-rune word and broke the assert below for the wrong reason
    const spare = RUNES.find(r => !word.runes.includes(r.id))!.id
    saveLetters(addGems(loadLetters(birth, rawLoadout()), spare, 1))
    // buy a second pair and swap to it
    ok(buyPair(PAIR_PRICE).ok, 'a second pair is bought')
    ok(swapTo(0, birth), 'swap to loadout 2')
    ok(JSON.parse(store[GEMS_KEY]!)[spare] === 1, '★ the BAG survives a swap untouched — loose letters are the keeper\'s, not the paper\'s')
    ok(rawLoadout().every(s => s === null), 'the active slots are now the EMPTY pair')
    const parked = loadParked()[0]!
    ok(parked.slots[TAC] === word.id && parked.vessels.bracelet.length === word.runes.length, '★ loadout 1 is parked WITH its slots and its set letters — the paper is per loadout')
    // the same word cannot be written on the second pair with the bag empty
    const s2 = setSlot(inv.owned, birth, rawLoadout(), TAC, word.id, keeperBook(inv.owned))
    ok(s2[TAC] === null, '★ with one set of letters, the second build cannot write the same word — one gem is one letter')
    // a second set of letters, and it can
    let l2 = loadLetters(birth, rawLoadout()); for (const r of word.runes) l2 = addGems(l2, r); saveLetters(l2)
    const s3 = setSlot(inv.owned, birth, rawLoadout(), TAC, word.id, keeperBook(inv.owned))
    ok(s3[TAC] === word.id, '★ two builds that both want the word need two gems and two vessels — and then both hold it')
    saveLoadout(s3)
    // swap back: loadout 1 returns intact, loadout 2 is parked intact; the bag never moved
    ok(swapTo(0, birth) && rawLoadout()[TAC] === word.id, 'swapping back restores loadout 1')
    const p2 = loadParked()[0]!
    ok(p2.slots[TAC] === word.id && p2.vessels.bracelet.length === word.runes.length, 'and loadout 2 is parked with ITS letters')
    const res = resolveLoadout(inv.owned, birth, keeperBook(inv.owned))
    ok(res.slots[TAC] === word.id && res.why[TAC] === null, 'the active loadout resolves seated through the real consumer after two swaps')
  }
}

// ── C. swap edge: nothing to swap to; a corrupt save parses to empty ────────────────────────
{
  wipe()
  ok(swapTo(0, 'tempest') === false, 'swapping to a pair you do not own does nothing')
  store[LOADOUTS_KEY] = '{"not":"a list"}'
  ok(loadParked().length === 0, 'a corrupt parked save reads as none, not a crash')
  saveParked([emptyParked(), emptyParked(), emptyParked(), emptyParked()])
  ok(loadParked().length === MAX_LOADOUTS - 1, 'the parked list is capped on save and on read')
}

// ── D. the hosts: the Loadout tab can swap; the Passage sells the pair ──────────────────────
{
  const src = noComments(readFileSync(new URL('../voxel3d/VoxelWorld.tsx', import.meta.url), 'utf8'))
  const at = src.indexOf('function LoadoutSwitch(')
  const end = src.indexOf('\nfunction LoadoutTab(', at)
  ok(at >= 0 && end > at, 'VoxelWorld has a LoadoutSwitch, sliced on both anchors')
  const sw = at >= 0 && end > at ? src.slice(at, end) : ''
  ok(/swapTo\(/.test(sw) && /loadParked\(\)/.test(sw) && /onSwapped\(/.test(sw), 'the switch swaps through loadouts.ts and hands the tab its new slots')
  ok(/<LoadoutSwitch [^>]*onSwapped=/.test(src) && /onLetters\(\)/.test(src.slice(src.indexOf('<LoadoutSwitch '), src.indexOf('<LoadoutSwitch ') + 400)), 'the tab re-resolves and tells the world (onLetters → runeTick) after a swap')
  const panel = noComments(readFileSync(new URL('./PassagePanel.tsx', import.meta.url), 'utf8'))
  ok(/buyPair\(/.test(panel) && /PAIR_PRICE/.test(panel) && /spendMarks\(/.test(panel), 'the Passage sells the pair for Marks')
  ok(!/not on the shelves yet/.test(panel), 'the "vessels not yet" line is gone — it would be a note that rotted')
}

console.log(`loadouts: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
