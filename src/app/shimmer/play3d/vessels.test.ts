/**
 * The vessels a keeper owns, and the letters that ride them.
 * Run: `npx tsx src/app/shimmer/play3d/vessels.test.ts`
 *
 * ★ WHAT THIS SUITE EXISTS TO CATCH, in one line: a bracelet equip that moves the FOCUS. The
 * retired pair could not express that bug because the two vessels were one object; splitting them
 * is the whole feature, so the assert that the other kind never moves is the load-bearing one.
 */
import { readFileSync } from 'node:fs'
import {
  STOWED_KEY, LEGACY_PAIRS_KEY, VESSEL_PRICE, MAX_PER_KIND, BAND_FOR_VESSEL,
  loadStowed, saveStowed, buyVessel, equip, ownedCount, emptyVessel, equippedVessel,
} from './vessels'
import { saveLoadout, rawLoadout, resolveLoadout, setSlot } from './loadout'
import { GEMS_KEY, VESSELS_KEY, addGems, isBodyHeld, saveLetters, loadLetters, VESSELS, type Letters } from './gems'
import { keeperBook, saveBook } from './book'
import { setBirthRune, grantRune, saveRuneInventory, EMPTY_INVENTORY } from './rune-inventory'
import { KEEPER_MOVES } from './keeper-moves'
import { ALL_BANDS, laneRunes } from './cast'
import { RUNES, ELEMENTS, runesOf } from './birth/runes.data'
import { KEEPER_KEYS } from '@/lib/keeper-local'
import { noComments, declAt, declAfter } from '../testing/guard'


let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const store: Record<string, string> = {}
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] },
}
const wipe = () => { for (const k of Object.keys(store)) delete store[k] }
const TAC = ALL_BANDS.indexOf('tactical')
const ULT = ALL_BANDS.indexOf('ultimate')

ok(KEEPER_KEYS.includes(STOWED_KEY), 'the stowed-vessels key is registered per keeper')
ok(KEEPER_KEYS.includes(LEGACY_PAIRS_KEY), 'the legacy pairs key is STILL registered — it ships, so it is claimed')

// ── A. the band map is DERIVED, and derived correctly ───────────────────────────────────────
{
  ok(BAND_FOR_VESSEL.bracelet === TAC, 'the bracelet bears the tactical band')
  ok(BAND_FOR_VESSEL.focus === ULT, 'the focus bears the ultimate band')
  ok(BAND_FOR_VESSEL.bracelet !== BAND_FOR_VESSEL.focus, '★ and the two vessels are not the same band — a swapped map would make an equip write the wrong word')
}

// ── B. buying one at a time: price, per-KIND cap, arrives empty ─────────────────────────────
{
  wipe()
  ok(ownedCount('bracelet') === 1 && ownedCount('focus') === 1, 'a keeper starts wearing one of each')
  ok(buyVessel('bracelet', VESSEL_PRICE - 1).why === 'too-dear' && loadStowed().length === 0, 'too dear buys nothing')
  const r = buyVessel('bracelet', VESSEL_PRICE)
  ok(r.ok && r.marks === 0 && ownedCount('bracelet') === 2, 'the bracelet is bought and stowed')
  ok(ownedCount('focus') === 1, '★ buying a bracelet did NOT hand out a focus — that is the pair, retired')
  const v = loadStowed()[0]!
  ok(v.kind === 'bracelet' && v.gems.length === 0 && v.move === null, '★ a new vessel arrives EMPTY — no letters, no word')
  ok(buyVessel('bracelet', 1000).ok && ownedCount('bracelet') === MAX_PER_KIND, 'a third bracelet is the cap')
  ok(buyVessel('bracelet', 1000).why === 'at-cap' && ownedCount('bracelet') === MAX_PER_KIND, '★ and a fourth bracelet is refused')
  ok(buyVessel('focus', 1000).ok && ownedCount('focus') === 2, '★ the focus cap is its OWN — three bracelets do not crowd it out')
}

// ── C. ★ THE RULING: gems ride the vessel, and only the vessel you equipped moves ───────────
{
  wipe()
  // a birth whose element lane holds a written tactical — the word the bracelet will carry
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
    let l: Letters = { bag: {}, vessels: { bracelet: [], focus: [] } }
    for (const r of word.runes) l = addGems(l, r)
    saveLetters(l); saveLoadout(ALL_BANDS.map(() => null))
    const s1 = setSlot(inv.owned, birth, ALL_BANDS.map(() => null), TAC, word.id, keeperBook(inv.owned))
    saveLoadout(s1)
    ok(s1[TAC] === word.id && JSON.parse(store[GEMS_KEY]!)[word.runes[0]!] === undefined,
       'the worn bracelet is written: the word binds and its letters left the bag')

    // a SPARE gem in the bag, so "the equip drops the bag" has something to drop
    const spare = RUNES.find(r => !word.runes.includes(r.id))!.id
    saveLetters(addGems(loadLetters(birth, rawLoadout()), spare, 1))

    // mark the FOCUS so a bracelet equip touching it is visible
    const before = loadLetters(birth, rawLoadout())
    saveLetters({ ...before, vessels: { ...before.vessels, focus: [birth] } })

    ok(buyVessel('bracelet', VESSEL_PRICE).ok, 'a second bracelet is bought')
    ok(equip('bracelet', 0, birth), 'equip the second bracelet')

    ok(JSON.parse(store[GEMS_KEY]!)[spare] === 1,
       "★ the BAG survives an equip untouched — loose letters are the keeper's, not the paper's")
    ok(rawLoadout()[TAC] === null, 'the worn bracelet is now the empty one: no word on the tactical band')
    ok(JSON.parse(store[VESSELS_KEY]!).focus.length === 1 && rawLoadout()[ULT] === null,
       '★★ THE FOCUS DID NOT MOVE. A bracelet equip touches the bracelet alone — the whole point of retiring the pair')

    const stowed = loadStowed()[0]!
    ok(stowed.kind === 'bracelet' && stowed.move === word.id && stowed.gems.length === word.runes.length,
       '★ the bracelet you took off keeps its word AND its letters — the gems ride the vessel')

    // with one set of letters, the empty bracelet cannot be written with the same word
    const s2 = setSlot(inv.owned, birth, rawLoadout(), TAC, word.id, keeperBook(inv.owned))
    ok(s2[TAC] === null, '★ one gem is one letter: the second bracelet cannot write a word whose letters are on the first')

    // equip back: the word and its letters return together
    ok(equip('bracelet', 0, birth) && rawLoadout()[TAC] === word.id, 'equipping the first bracelet back restores its word')
    ok(loadLetters(birth, rawLoadout()).vessels.bracelet.length === word.runes.length, 'and its letters came back with it')
    const res = resolveLoadout(inv.owned, birth, keeperBook(inv.owned))
    ok(res.slots[TAC] === word.id && res.why[TAC] === null,
       'the worn vessel resolves seated through the real consumer after two equips')
    const worn = equippedVessel('bracelet', birth)
    ok(worn.move === word.id && worn.gems.length === word.runes.length, 'equippedVessel reads the same vessel the world is wearing')
  }
}

// ── D. equip edges: nothing there, and the worn slot refuses the other kind ─────────────────
{
  wipe()
  ok(equip('bracelet', 0, 'tempest') === false, 'equipping a vessel you do not own does nothing')
  saveStowed([emptyVessel('focus')])
  ok(equip('bracelet', 0, 'tempest') === false, '★ the worn slot refuses a FOCUS — a vessel is not a generic holder')
  ok(equip('focus', 0, 'tempest') === true, 'and the held slot takes it')
  wipe()
  store[STOWED_KEY] = '{"not":"a list"}'
  ok(loadStowed().length === 0, 'a corrupt stowed save reads as none, not a crash')
  wipe()
  saveStowed([emptyVessel('bracelet'), emptyVessel('bracelet'), emptyVessel('bracelet'), emptyVessel('focus')])
  const capped = loadStowed()
  ok(capped.filter(v => v.kind === 'bracelet').length === MAX_PER_KIND - 1, 'the stowed list is capped PER KIND on save and on read')
  ok(capped.filter(v => v.kind === 'focus').length === 1, '★ and the cap is per kind, so bracelets cannot evict the focus')
}

// ── E. ★ THE LEGACY DOOR: keepers paid 150 Marks for pairs the day before this shipped ──────
{
  wipe()
  const slots = ALL_BANDS.map(() => null) as (string | null)[]
  slots[TAC] = 'a-word'; slots[ULT] = 'another-word'
  store[LEGACY_PAIRS_KEY] = JSON.stringify([{ slots, vessels: { bracelet: ['stone'], focus: ['ember'] } }])
  const migrated = loadStowed()
  ok(migrated.length === 2, '★ one retired pair becomes the TWO vessels it always was')
  // ⚠ NO `!` HERE, AND THAT IS THE POINT (found by mutation, 2026-09-03). With non-null assertions a
  // migration that returns NOTHING threw on `b.gems` and took the whole run down — and a crash reads
  // as neither pass nor fail, so the boarded-up-legacy-door mutation scored as "the suite errored"
  // rather than "this guard fires". The sanity assert above had already caught it; the throw buried it.
  const b = migrated.find(v => v.kind === 'bracelet')
  const f = migrated.find(v => v.kind === 'focus')
  ok(!!b && b.gems[0] === 'stone' && b.move === 'a-word', 'the bracelet keeps its letters and the word on its band')
  ok(!!f && f.gems[0] === 'ember' && f.move === 'another-word', 'the focus keeps its own — the two words did not cross bands')
  ok(store[LEGACY_PAIRS_KEY] === undefined, '★ the legacy key is REMOVED after migrating, so it cannot double-credit')
  ok(loadStowed().length === 2, 'and a second read is served from the new key, not migrated again')
  wipe()
  store[LEGACY_PAIRS_KEY] = '{"not":"a list"}'
  ok(loadStowed().length === 0, 'a corrupt legacy save migrates to none, not a crash')
}

// ── F. the hosts: the rack equips, the satchel carries the letters, the Passage sells one ───
{
  const src = noComments(readFileSync(new URL('../voxel3d/VoxelWorld.tsx', import.meta.url), 'utf8'))
  const at = declAt(src, 'VesselRack')
  const end = declAfter(src, 'GearTab', at)
  ok(at >= 0 && end > at, 'VoxelWorld has a VesselRack, sliced on both anchors')
  const rack = at >= 0 && end > at ? src.slice(at, end) : ''
  ok(/equip\(kind, i, birth/.test(rack) && /loadStowed\(\)/.test(rack) && /onEquipped\(/.test(rack),
     'the rack equips through vessels.ts and hands the tab its new slots')
  const useAt = src.indexOf('<VesselRack ')
  ok(useAt >= 0 && /onLetters\(\)/.test(src.slice(useAt, useAt + 400)),
     'the tab re-resolves and tells the world (onLetters → runeTick) after an equip')

  // ★ Alex's split, asserted as a split: the letters are on the satchel and NOWHERE else.
  ok(/\{tab === 'satchel' && <>\{satchel\}<SatchelLetters /.test(src), '★ the SATCHEL carries the letters card')
  ok(!/LettersCard/.test(src) && !/<RunesTab /.test(src),
     '★ the retired LettersCard is gone entirely — and so is the Runes tab that carried it (Alex, 2026-09-04: Gear holds the vessels)')
  const satchelUses = src.match(/<SatchelLetters /g) ?? []
  ok(satchelUses.length === 1, '★ ONE mount of the letters card. Two was the bug Alex ruled out; three tabs would be worse')
  ok(!/<LoadoutSwitch/.test(src) && !/swapTo\(/.test(src), 'the pair-swap is gone from the host, not merely unused')

  const panel = noComments(readFileSync(new URL('./PassagePanel.tsx', import.meta.url), 'utf8'))
  ok(/buyVessel\(/.test(panel) && /VESSEL_PRICE/.test(panel) && /spendMarks\(/.test(panel), 'the Passage sells a vessel for Marks')
  ok(/VESSELS\.map\(/.test(panel), '★ the shelf DERIVES its rows from VESSELS — a hand-written pair of rows would go stale the day a third vessel is ruled')
  ok(!/buyPair|PAIR_PRICE/.test(panel), 'and the pair is gone from the shelf, not merely hidden')
}

console.log(`vessels: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
