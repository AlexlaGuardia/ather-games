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
  STOWED_KEY, LEGACY_PAIRS_KEY, WORN_TIER_KEY, VESSEL_PRICE, MAX_PER_KIND, BAND_FOR_VESSEL, FLOOR_TIER, FLOOR_SEATS,
  loadStowed, saveStowed, buyVessel, equip, ownedCount, emptyVessel, equippedVessel,
  dismantleWorn, placeGems, seatCount, shortOf, isComplete, isFloor, seatCapOf, grantVessel, setWord, wornTier, clearStowed, TIER_MATERIAL,
} from './vessels'
import { saveLoadout, rawLoadout, resolveLoadout, setSlot } from './loadout'
import { GEMS_KEY, VESSELS_KEY, VESSEL_CAP as _CAP, addGems, isBodyHeld, saveLetters, loadLetters, VESSELS, type Letters } from './gems'
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
ok(KEEPER_KEYS.includes(WORN_TIER_KEY), 'the worn-tier key is registered per keeper')
/** the vessels a keeper ACQUIRED — the floor is always there and is not what these sections count */
const acquired = () => loadStowed().filter(v => !isFloor(v))
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
  // ★ RE-COUNTED 2026-09-04 (the no-craft ruling): `ownedCount` is what a keeper ACQUIRED. A fresh keeper
  // has acquired nothing — their birth move is body-held and Greg's pair sits under the count.
  ok(ownedCount('bracelet') === 0 && ownedCount('focus') === 0, 'a fresh keeper has acquired no vessel; Greg\'s pair is the floor, outside the count')
  ok(buyVessel('bracelet', VESSEL_PRICE - 1).why === 'too-dear' && acquired().length === 0, 'too dear buys nothing')
  const r = buyVessel('bracelet', VESSEL_PRICE)
  ok(r.ok && r.marks === 0 && ownedCount('bracelet') === 1, 'the bracelet is bought and stowed')
  ok(ownedCount('focus') === 0, '★ buying a bracelet did NOT hand out a focus — that is the pair, retired')
  const v = loadStowed()[0]!
  ok(v.kind === 'bracelet' && v.gems.length === 0 && v.move === null && v.tier === 1, '★ a new vessel arrives EMPTY — no letters, no word — and it is GOLDWOOD (tier 1, the Passage\'s stock)')
  ok(buyVessel('bracelet', 1000).ok && buyVessel('bracelet', 1000).ok && ownedCount('bracelet') === MAX_PER_KIND, 'a third bracelet is the cap')
  ok(buyVessel('bracelet', 1000).why === 'at-cap' && ownedCount('bracelet') === MAX_PER_KIND, '★ and a fourth bracelet is refused')
  ok(buyVessel('focus', 1000).ok && ownedCount('focus') === 1, '★ the focus cap is its OWN — three bracelets do not crowd it out')
  ok(loadStowed().filter(v => v.kind === 'bracelet' && isFloor(v)).length === 1, '★ and Greg\'s bracelet is STILL there under three goldwood ones — the cap never touched it')
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

    // ★ RE-POINTED 2026-09-04 (hub) TO ALEX'S RULING: a vessel is MADE for one word and bears exactly its
    // seats; only a WRITTEN vessel is gear. So the parking move is DISMANTLE (letters to the bag, the empty
    // paper to the satchel still cut for its word), and an unwritten vessel refuses to be worn.
    ok(dismantleWorn('bracelet', birth), 'dismantle the worn bracelet')
    ok(JSON.parse(store[GEMS_KEY]!)[spare] === 1,
       "★ the BAG's spare survives a dismantle untouched — loose letters are the keeper's, not the paper's")
    for (const r of word.runes) ok((loadLetters(birth, rawLoadout()).bag[r] ?? 0) >= 1, `the word's letter ${r} came back to the bag`)
    ok(rawLoadout()[TAC] === null, 'nothing worn on the tactical band now')
    ok(JSON.parse(store[VESSELS_KEY]!).focus.length === 1 && rawLoadout()[ULT] === null,
       '★★ THE FOCUS DID NOT MOVE. A bracelet dismantle touches the bracelet alone')
    const parked = loadStowed()[0]!
    ok(parked.kind === 'bracelet' && parked.move === word.id && parked.gems.length === 0,
       '★ the paper went to the satchel EMPTY and still cut for its word')
    ok(seatCount(parked, birth) === word.runes.length, `★ its seats are the word's letters (${word.runes.length}), not the cap`)
    ok(!isComplete(parked, birth) && shortOf(parked, birth).length === word.runes.length, 'unwritten, and short every one of its letters')
    ok(equip('bracelet', 0, birth) === false, '★ an unwritten vessel refuses to be worn')
    const placed = placeGems(0, birth, loadLetters(birth, rawLoadout()))
    ok(placed.r.ok && placed.r.complete && placed.r.placed.length === word.runes.length, 'placing from the bag writes it in one press when the bag holds every letter')
    saveLetters(placed.letters)
    ok((loadLetters(birth, rawLoadout()).bag[spare] ?? 0) === 1, 'the spare stayed in the bag; only the word\'s letters moved')
    ok(isComplete(loadStowed()[0]!, birth), 'written now')
    ok(equip('bracelet', 0, birth) && rawLoadout()[TAC] === word.id, 'and a written vessel goes on: its word is on the band')
    ok(loadLetters(birth, rawLoadout()).vessels.bracelet.length === word.runes.length, 'and its letters came with it')
    ok(acquired().filter(v => v.kind === 'bracelet').length === 0, '★ wearing nothing minted no blank — the slot was simply taken')
    const res = resolveLoadout(inv.owned, birth, keeperBook(inv.owned))
    ok(res.slots[TAC] === word.id && res.why[TAC] === null, 'the worn vessel resolves seated through the real consumer')
    const worn = equippedVessel('bracelet', birth)
    ok(worn.move === word.id && worn.gems.length === word.runes.length, 'equippedVessel reads the same vessel the world is wearing')
    // the Passage cuts to order
    const cut = buyVessel('bracelet', VESSEL_PRICE, word.id)
    ok(cut.ok && loadStowed().some(v => v.move === word.id && v.gems.length === 0), '★ the Passage cuts a bracelet FOR a word: it arrives empty, cut for that word')
    ok(buyVessel('bracelet', VESSEL_PRICE, 'no-such-move').why === 'no-such-word', 'a word nobody has heard of is refused')
    ok(buyVessel('focus', VESSEL_PRICE, word.id).why === 'no-such-word', '★ a tactical word cannot be cut into a FOCUS — the kind gates the band')
  }
}

// ── D. equip edges: nothing there, and the worn slot refuses the other kind ─────────────────
{
  wipe()
  ok(equip('bracelet', 0, 'tempest') === false, 'equipping a vessel you do not own does nothing')
  saveStowed([emptyVessel('focus')])
  ok(equip('bracelet', 0, 'tempest') === false, '★ the worn slot refuses a FOCUS — a vessel is not a generic holder')
  ok(equip('focus', 0, 'tempest') === false, '★ and an UNWRITTEN focus refuses too — only written vessels are gear (2026-09-04)')
  wipe()
  store[STOWED_KEY] = '{"not":"a list"}'
  ok(acquired().length === 0, 'a corrupt stowed save reads as none, not a crash')
  wipe()
  saveStowed([emptyVessel('bracelet'), emptyVessel('bracelet'), emptyVessel('bracelet'), emptyVessel('bracelet'), emptyVessel('focus')])
  const capped = acquired()
  // ★ the list holds MAX_PER_KIND, not MAX_PER_KIND - 1: with nothing (or Greg's) worn, all three acquired
  // ones may sit in the satchel. The old `- 1` refused to let a keeper with two spares take off the third.
  ok(capped.filter(v => v.kind === 'bracelet').length === MAX_PER_KIND, 'the stowed list is capped PER KIND on save and on read — at the cap, not one under it')
  ok(capped.filter(v => v.kind === 'focus').length === 1, '★ and the cap is per kind, so bracelets cannot evict the focus')
}

// ── E. ★ THE LEGACY DOOR: keepers paid 150 Marks for pairs the day before this shipped ──────
{
  wipe()
  const slots = ALL_BANDS.map(() => null) as (string | null)[]
  slots[TAC] = 'a-word'; slots[ULT] = 'another-word'
  store[LEGACY_PAIRS_KEY] = JSON.stringify([{ slots, vessels: { bracelet: ['stone'], focus: ['ember'] } }])
  const migrated = acquired()
  ok(migrated.length === 2, '★ one retired pair becomes the TWO vessels it always was')
  ok(migrated.every(v => v.tier === 1), '★ and both read as GOLDWOOD — a pair bought before tiers was bought at the Passage')
  // ⚠ NO `!` HERE, AND THAT IS THE POINT (found by mutation, 2026-09-03). With non-null assertions a
  // migration that returns NOTHING threw on `b.gems` and took the whole run down — and a crash reads
  // as neither pass nor fail, so the boarded-up-legacy-door mutation scored as "the suite errored"
  // rather than "this guard fires". The sanity assert above had already caught it; the throw buried it.
  const b = migrated.find(v => v.kind === 'bracelet')
  const f = migrated.find(v => v.kind === 'focus')
  ok(!!b && b.gems[0] === 'stone' && b.move === 'a-word', 'the bracelet keeps its letters and the word on its band')
  ok(!!f && f.gems[0] === 'ember' && f.move === 'another-word', 'the focus keeps its own — the two words did not cross bands')
  ok(store[LEGACY_PAIRS_KEY] === undefined, '★ the legacy key is REMOVED after migrating, so it cannot double-credit')
  ok(acquired().length === 2, 'and a second read is served from the new key, not migrated again')
  wipe()
  store[LEGACY_PAIRS_KEY] = '{"not":"a list"}'
  ok(acquired().length === 0, 'a corrupt legacy save migrates to none, not a crash')
}

// ── G. ★★ THE TIER MODEL AGAINST THE NO-CRAFT RULING (2026-09-04): the floor, the doors, the material ──
{
  wipe()
  const floors = loadStowed().filter(isFloor)
  ok(floors.length === 2 && VESSELS.every(k => floors.some(v => v.kind === k)), '★ a fresh keeper holds Greg\'s pair: one tier-0 vessel of EACH kind, from the first read')
  ok(floors.every(v => v.move === null && v.gems.length === 0), 'the pair arrives uncut and empty — the word is the keeper\'s first one-letter choice')
  ok(seatCapOf(FLOOR_TIER) === FLOOR_SEATS && FLOOR_SEATS === 1 && seatCapOf(1) === _CAP && seatCapOf(3) === _CAP, '★ the floor bears ONE seat; every other tier bears what its word needs, up to the cap')
  ok(loadStowed().every((v, i, a) => !isFloor(v) || a.slice(i).every(isFloor)), 'the floor sorts LAST — acquired vessels keep their indices')
  // never lost: a rebirth, a corrupt save, a save that dropped them — every read hands them back
  clearStowed()
  ok(loadStowed().filter(isFloor).length === 2, '★★ a rebirth (clearStowed) cannot take Greg\'s pair — it is derived on read, like the Worn tools')
  saveStowed([emptyVessel('bracelet', 1)])
  ok(loadStowed().filter(isFloor).length === 2 && acquired().length === 1, 'a save without the floor reads WITH it; the acquired vessel is untouched')
  saveStowed([emptyVessel('bracelet', 0), emptyVessel('bracelet', 0)])
  ok(loadStowed().filter(v => isFloor(v) && v.kind === 'bracelet').length === 1, '★ two saved floors of a kind read as ONE — Greg gave one, a save that says two lied')
  wipe()
  store[STOWED_KEY] = JSON.stringify([{ kind: 'bracelet', gems: [], move: null, tier: 9 }, { kind: 'focus', gems: [], move: null }])
  ok(acquired().every(v => v.tier === 1), 'an unknown or missing tier reads as goldwood (bought), never as the floor or a crash')

  // the doors: given is refused (Greg gave it), bought is tier 1, found/won carry their tier
  wipe()
  ok(grantVessel('bracelet', 0, null, 'found').why === 'not-given' && grantVessel('bracelet', 2, null, 'given').why === 'not-given',
     '★ nothing grants a tier-0 vessel and nothing is "given" but Greg\'s — a second floor is refused')
  const found = grantVessel('focus', 3, null, 'found')
  ok(found.ok && acquired()[found.index!]?.tier === 3 && acquired()[found.index!]?.kind === 'focus', '★ a FOUND vessel lands in the satchel with its tier — the world\'s door, no shelf, no recipe')
  ok(/starwillow/.test(found.say), `the grant says the material, not a number (${found.say})`)
  ok(TIER_MATERIAL.focus[3] === 'starwillow' && TIER_MATERIAL.bracelet[3] === 'pearlshell' && TIER_MATERIAL.focus[2] === 'shimmeroak' && TIER_MATERIAL.bracelet[2] === 'shimmerscale',
     '★ tier = material, the brief\'s rows: the two kinds differ at tiers 2 and 3')
  ok(grantVessel('focus', 2, null, 'won').ok && grantVessel('focus', 2, null, 'won').ok && grantVessel('focus', 1, null, 'won').why === 'at-cap',
     '★ found and won count against the same cap as bought — three acquired of a kind, however they came')
  ok(loadStowed().filter(v => v.kind === 'focus' && isFloor(v)).length === 1, 'and Greg\'s glove is still under the three')

  // a word must fit the tier's seats; the floor takes ONE letter, and never a body-held word
  wipe()
  let pick: { birth: string; one: string; two: string } | null = null
  for (const e of ELEMENTS) for (const r of runesOf(e.id)) {
    const inLane = (m: (typeof KEEPER_MOVES)[number]) => m.tier === 'tactical' && !isBodyHeld(m, r.id) && m.runes.every(x => laneRunes(r.id, 'element').has(x))
    const one = KEEPER_MOVES.find(m => inLane(m) && m.runes.length === 1)
    const two = KEEPER_MOVES.find(m => inLane(m) && m.runes.length === 2)
    if (one && two) { pick = { birth: r.id, one: one.id, two: two.id }; break }
  }
  ok(!!pick, `fixture: a birth with a one-letter AND a two-letter written tactical in its lane (${pick ? `${pick.birth}: ${pick.one} / ${pick.two}` : 'none'})`)
  if (pick) {
    const { birth, one, two } = pick
    ok(grantVessel('bracelet', 1, two, 'bought').ok, 'goldwood takes a two-letter word')
    ok(grantVessel('bracelet', 1, one, 'bought').ok, 'and a one-letter word')
    const blank = grantVessel('bracelet', 1, null, 'bought')
    ok(blank.ok && loadStowed()[blank.index!]?.move === null && !isFloor(loadStowed()[blank.index!]!), 'and an uncut one, whose index names it on the next read')
    const floorAt = loadStowed().findIndex(v => v.kind === 'bracelet' && isFloor(v))
    ok(floorAt >= 0 && setWord(floorAt, two, birth) === false, '★ Greg\'s bracelet REFUSES a two-letter word — one seat (ruled)')
    ok(setWord(floorAt, one, birth) === true && loadStowed()[floorAt]?.move === one, '★ and takes a one-letter word: the floor is cut, the keeper\'s first choice')
    ok(setWord(floorAt, one, birth) === false, 'once cut, it is that word\'s paper — not a re-cuttable blank (the one-word law)')
    ok(seatCount(loadStowed()[floorAt] ?? { move: null }, birth) === 1, 'its seat count is the word\'s: one')
    const bodyHeld = KEEPER_MOVES.find(m => m.tier === 'tactical' && m.runes.length === 1 && m.runes[0] === birth)
    if (bodyHeld) ok(setWord(blank.index!, bodyHeld.id, birth) === false, '★ a body-held word (your birth rune alone) is never cut into paper — it needs none')

    // the worn tier rides the equip and comes back on the dismantle
    let inv = setBirthRune(EMPTY_INVENTORY, birth); inv = grantRune(inv, KEEPER_MOVES.find(m => m.id === one)!.runes[0]!)
    saveRuneInventory(inv); saveBook({ learned: [one] })
    saveLoadout(ALL_BANDS.map(() => null))
    let l: Letters = { bag: {}, vessels: { bracelet: [], focus: [] } }
    l = addGems(l, KEEPER_MOVES.find(m => m.id === one)!.runes[0]!, 1)
    saveLetters(l)
    const fl = loadStowed().findIndex(v => v.kind === 'bracelet' && isFloor(v))
    const placed = placeGems(fl, birth, loadLetters(birth, rawLoadout()))
    ok(placed.r.ok && placed.r.complete, 'the floor is written with its one letter')
    saveLetters(placed.letters)
    ok(equip('bracelet', fl, birth) === true && rawLoadout()[TAC] === one, '★ Greg\'s written bracelet goes ON — the floor is gear like any written vessel')
    ok(wornTier('bracelet') === FLOOR_TIER && equippedVessel('bracelet', birth).tier === FLOOR_TIER, '★ and the worn tier says mortal cord — the material went on with the paper')
    ok(loadStowed().filter(v => v.kind === 'bracelet' && isFloor(v)).length === 0, '★ while worn, the floor is NOT also in the satchel — one pair, not one plus a copy')
    ok(ownedCount('bracelet') === MAX_PER_KIND, '★ wearing Greg\'s counts NOTHING against the cap: three acquired in the satchel, the worn one is the floor — and it still went on AT the cap')
    ok(dismantleWorn('bracelet', birth) === true, 'take it off')
    const back = loadStowed().filter(v => v.kind === 'bracelet' && isFloor(v))
    // ⚠ `?.`, not `!`: with the floor gone this must FAIL BY NAME, not throw (the 09-03 migration lesson)
    ok(back.length === 1 && back[0]?.move === one && back[0]?.gems.length === 0, '★ it comes back to the satchel as the FLOOR, empty, still cut for its word — not as a goldwood copy')
    ok(loadStowed().filter(v => v.kind === 'bracelet' && isFloor(v)).length === 1, 'and exactly one — the read did not add a second on top of the returned one')
  }

  // ★ the stuck case the old cap had: three acquired, one worn — the worn one can still come off
  wipe()
  if (pick) {
    const { birth, one } = pick
    let inv = setBirthRune(EMPTY_INVENTORY, birth); inv = grantRune(inv, KEEPER_MOVES.find(m => m.id === one)!.runes[0]!)
    saveRuneInventory(inv); saveBook({ learned: [one] })
    saveLoadout(ALL_BANDS.map(() => null)); saveLetters(addGems({ bag: {}, vessels: { bracelet: [], focus: [] } }, KEEPER_MOVES.find(m => m.id === one)!.runes[0]!, 1))
    const g = grantVessel('bracelet', 2, one, 'found'); ok(g.ok, 'a shimmerscale bracelet for the word')
    const p = placeGems(g.index!, birth, loadLetters(birth, rawLoadout())); saveLetters(p.letters)
    ok(equip('bracelet', g.index!, birth) && wornTier('bracelet') === 2, 'worn: the shimmerscale one')
    ok(grantVessel('bracelet', 1, null, 'bought').ok && grantVessel('bracelet', 1, null, 'bought').ok && ownedCount('bracelet') === MAX_PER_KIND, 'two goldwood spares: three acquired, at the cap')
    ok(dismantleWorn('bracelet', birth) === true, '★★ at the cap, the WORN vessel still comes off — the old `- 1` refused this and left a keeper unable to undress')
    ok(acquired().filter(v => v.kind === 'bracelet').length === MAX_PER_KIND && acquired().some(v => v.kind === 'bracelet' && v.tier === 2 && v.move === one),
       'and it is in the satchel as shimmerscale, cut for its word, with the two goldwood ones')
  }
}

// ── F. the hosts: the rack equips, the satchel carries the letters, the Passage sells one ───
{
  const src = noComments(readFileSync(new URL('../voxel3d/VoxelWorld.tsx', import.meta.url), 'utf8'))
  const at = declAt(src, 'VesselRack')
  const end = declAfter(src, 'GearTab', at)
  ok(at >= 0 && end > at, 'VoxelWorld has a VesselRack, sliced on both anchors')
  const rack = at >= 0 && end > at ? src.slice(at, end) : ''
  // ★ RE-POINTED 2026-09-04 (hub): the rack reads the stowed list through `completeVessels` (written only).
  ok(/equip\(kind, i, birth/.test(rack) && /completeVessels\(/.test(rack) && /onEquipped\(/.test(rack),
     'the rack equips through vessels.ts (written vessels only) and hands the tab its new slots')
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
