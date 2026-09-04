/**
 * The letters and the paper — RULED 2026-09-03 (`shimmer-skilling.md` § THE CASTING VESSELS).
 *
 * ★ THE CANON SENTENCE IS THE FIRST ASSERT: "two moves naming Barrier need two Barrier GEMS." A keeper
 * learns Barrier once; a second word consumes a second letter. Section A finds two moves that share a
 * rune across the two vessels and proves one gem is not enough and two are.
 *
 * ★ THE FLOOR IS ASSERTED, NOT DESCRIBED: a move written in the birth rune alone takes no gem and no
 * vessel, for every birthable rune — the line that keeps the gem economy from eating selfhood.
 *
 * Run: `npx tsx src/app/shimmer/play3d/gems.test.ts`
 */
import { readFileSync } from 'node:fs'
import {
  EMPTY_LETTERS, VESSEL_CAP, VESSEL_FOR_KIND, addGems, bindLetters, unbindLetters, isBodyHeld, lettersOf,
  missingLetters, seedLetters, loadLetters, GEMS_KEY, VESSELS_KEY, shortFor, type Letters,
} from './gems'
import { KEEPER_MOVES, moveById } from './keeper-moves'
import { ALL_BANDS, laneRunes, type SlotKind } from './cast'
import { resolveLoadout, setSlot, saveLoadout, LOADOUT_KEY } from './loadout'
import { keeperBook, saveBook } from './book'
import { setBirthRune, grantRune, saveRuneInventory, EMPTY_INVENTORY } from './rune-inventory'
import { RUNES, ELEMENTS, runesOf } from './birth/runes.data'
import { KEEPER_KEYS } from '@/lib/keeper-local'
import { noComments, declAt, declAfter } from '../testing/guard'


let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const store: Record<string, string> = {}
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
}
const wipe = () => { for (const k of Object.keys(store)) delete store[k] }
const TAC = ALL_BANDS.indexOf('tactical'), ULT = ALL_BANDS.indexOf('ultimate')
ok(TAC >= 0 && ULT >= 0, 'the band list has a tactical and an ultimate slot')
ok(KEEPER_KEYS.includes(GEMS_KEY) && KEEPER_KEYS.includes(VESSELS_KEY), 'both letter keys are registered per-keeper')

// ── A. ★ two moves naming one rune need two gems of it ──────────────────────────────────────
{
  // find a birthable birth and two NON-body-held moves, one per vessel, that share a rune — searched,
  // not hand-picked, so the assert survives the registry growing
  let found: { birth: string; tac: string; ult: string; shared: string } | null = null
  outer: for (const e of ELEMENTS) for (const r of runesOf(e.id)) {
    const birth = r.id
    const tacs = KEEPER_MOVES.filter((m) => m.tier === 'tactical' && !isBodyHeld(m, birth) && m.runes.every((x) => laneRunes(birth, 'element').has(x)))
    const ults = KEEPER_MOVES.filter((m) => m.tier === 'ultimate' && !isBodyHeld(m, birth) && m.runes.every((x) => laneRunes(birth, 'state').has(x)))
    for (const t of tacs) for (const u of ults) {
      const shared = t.runes.find((x) => u.runes.includes(x))
      if (shared) { found = { birth, tac: t.id, ult: u.id, shared }; break outer }
    }
  }
  ok(!!found, `a birth exists whose two lanes hold a tactical and a signature sharing a rune (${found ? `${found.birth}: ${found.tac} + ${found.ult} share ${found.shared}` : 'none — this section could not run'})`)
  if (found) {
    const { birth, tac, ult, shared } = found
    const t = moveById(tac)!, u = moveById(ult)!
    let l: Letters = EMPTY_LETTERS
    for (const r of [...t.runes, ...u.runes]) if (r !== shared) l = addGems(l, r)
    l = addGems(l, shared, 1)                                  // ONE gem of the shared rune
    const b1 = bindLetters(l, 'bracelet', t, birth)
    ok(!!b1, 'with one shared gem the first word binds')
    ok(!!b1 && bindLetters(b1, 'focus', u, birth) === null, `★ ...and the second word naming ${shared} is REFUSED — one gem is one letter`)
    const l2 = addGems(l, shared, 1)                           // TWO
    const b2 = bindLetters(l2, 'bracelet', t, birth)
    ok(!!b2 && !!bindLetters(b2, 'focus', u, birth), '★ with two gems of it both words bind — "two Barriers" means two GEMS')
  }
}

// ── B. ★ the floor: a move written in the birth rune alone takes no gem and no vessel ───────
{
  let floorHolds = true, floorCount = 0
  for (const e of ELEMENTS) for (const r of runesOf(e.id)) {
    for (const m of KEEPER_MOVES.filter((m) => m.runes.length === 1 && m.runes[0] === r.id && (m.tier === 'tactical' || m.tier === 'ultimate'))) {
      floorCount++
      if (!isBodyHeld(m, r.id) || lettersOf(m, r.id).length !== 0) floorHolds = false
      if (bindLetters(EMPTY_LETTERS, VESSEL_FOR_KIND[m.tier as SlotKind]!, m, r.id) !== EMPTY_LETTERS) floorHolds = false
    }
  }
  ok(floorCount > 0 && floorHolds, `★ every doubled-focus tactical and Manifestation is body-held and binds with an EMPTY bag (${floorCount} checked)`)
  const other = KEEPER_MOVES.find((m) => m.runes.length === 1 && m.tier === 'tactical')!
  const notBirth = RUNES.find((r) => r.id !== other.runes[0])!.id
  ok(!isBodyHeld(other, notBirth) && lettersOf(other, notBirth).length === 1, 'the SAME one-rune move is a written word for a keeper born of anything else')
  ok(KEEPER_MOVES.filter((m) => m.tier === 'passive').every((m) => isBodyHeld(m, null)), 'passives are body-held (an innate socket, canon) — no gem')
}

// ── C. the vessel: cap, lane gate, return on unbind ─────────────────────────────────────────
{
  ok(VESSEL_CAP === 3, 'a vessel bears at most three — canon\'s cap')
  ok(missingLetters(['a', 'a', 'b'], ['a', 'b']).join() === 'a', 'missing letters is a multiset difference, in need order')
  ok(missingLetters(['a'], ['a', 'a', 'b']).length === 0, 'and surplus is never "missing"')
  // an element-lane word cannot be set in the focus, and a state-lane word cannot be set in the bracelet
  const birth = 'tempest'
  const elem = KEEPER_MOVES.find((m) => m.tier === 'tactical' && !isBodyHeld(m, birth) && m.runes.every((x) => laneRunes(birth, 'element').has(x)) && m.runes.some((x) => !laneRunes(birth, 'state').has(x)))
  ok(!!elem, 'fixture: an element-lane tactical off the state lane exists for tempest')
  if (elem) {
    let l: Letters = EMPTY_LETTERS
    for (const r of elem.runes) l = addGems(l, r)
    ok(bindLetters(l, 'focus', elem, birth) === null, '★ the FOCUS refuses an element-lane gem — the vessel gates the lane physically')
    const set = bindLetters(l, 'bracelet', elem, birth)
    ok(!!set && Object.keys(set.bag).length === 0 && set.vessels.bracelet.length === elem.runes.length, 'the bracelet takes it, and the bag empties by exactly those letters')
    const back = set ? unbindLetters(set, 'bracelet') : l
    ok(back.vessels.bracelet.length === 0 && JSON.stringify(back.bag) === JSON.stringify(l.bag), '★ unbind returns every letter to the bag — free, Jin\'s call')
  }
}

// ── D. the seed IS the migration: a keeper keeps what they had bound; the gift arrives loose ─
{
  wipe()
  const birth = 'tempest'
  // a written (non-body) tactical on tempest's element lane, bound before gems existed
  const word = KEEPER_MOVES.find((m) => m.tier === 'tactical' && !isBodyHeld(m, birth) && m.runes.every((x) => laneRunes(birth, 'element').has(x)))!
  const bound = ALL_BANDS.map((k) => (k === 'tactical' ? word.id : null))
  const seeded = seedLetters(birth, bound, undefined)
  ok(missingLetters(word.runes, seeded.vessels.bracelet).length === 0, `★ a move bound before gems existed is seeded SET in the bracelet (${word.id}: ${seeded.vessels.bracelet.join(',')})`)
  const gift = KEEPER_MOVES.find((m) => m.tier === 'tactical' && !isBodyHeld(m, birth) && m.id !== word.id && m.runes.every((x) => laneRunes(birth, 'element').has(x)))
  if (gift) {
    const s2 = seedLetters(birth, bound, gift.id)
    ok(gift.runes.every((r) => (s2.bag[r] ?? 0) >= 1), 'Gregory\'s gift arrives WITH its letters, loose in the bag')
  }
  // and through the real reader: no save → seeded and persisted; a save → read back, not re-seeded
  const l1 = loadLetters(birth, bound, undefined)
  ok(store[VESSELS_KEY] !== undefined, 'first load persists the seed')
  const l2 = loadLetters(birth, [], undefined)   // a different `bound` must NOT change a saved answer
  ok(JSON.stringify(l1) === JSON.stringify(l2), 'a saved letters file is read back, never re-seeded from the loadout')
}

// ── E. through the consumers: resolveLoadout says no-gem; setSlot is a gem transaction ───────
{
  wipe()
  // searched, not assumed: a birth whose element lane holds a WRITTEN tactical; the keeper is granted
  // exactly that word's runes (my first fixture assumed tempest+freeze and the registry said no)
  let pick: { birth: string; word: (typeof KEEPER_MOVES)[number] } | null = null
  for (const e of ELEMENTS) for (const r of runesOf(e.id)) {
    const w = KEEPER_MOVES.find((m) => m.tier === 'tactical' && !isBodyHeld(m, r.id) && m.runes.every((x) => laneRunes(r.id, 'element').has(x)))
    if (w) { pick = { birth: r.id, word: w }; break }
  }
  ok(!!pick, `fixture: a birth with a written element-lane tactical exists (${pick ? `${pick.birth}: ${pick.word.id}` : 'none'})`)
  let inv = setBirthRune(EMPTY_INVENTORY, pick?.birth ?? 'tempest')
  for (const r of pick?.word.runes ?? []) inv = grantRune(inv, r)
  saveRuneInventory(inv)
  const birth = inv.birth
  const word = pick?.word
  const body = KEEPER_MOVES.find((m) => m.tier === 'tactical' && m.runes.length === 1 && m.runes[0] === birth)
  ok(!!body, `fixture: ${birth} has a doubled-focus tactical (${body?.id ?? 'none'})`)
  if (word) {
    saveBook({ learned: [word.id, ...(body ? [body.id] : [])] })
    saveLoadout(ALL_BANDS.map((k) => (k === 'tactical' ? word.id : null)))
    // the seed sets the letters, so the pre-gem keeper keeps their bind
    let res = resolveLoadout(inv.owned, birth, keeperBook(inv.owned))
    ok(res.slots[TAC] === word.id, `a keeper who had ${word.id} bound keeps it after the migration (why=${res.why[TAC]})`)
    // now strip the vessel: the bound word cannot be written → no-gem, not dropped
    store[VESSELS_KEY] = JSON.stringify({ bracelet: [], focus: [] }); store[GEMS_KEY] = '{}'
    res = resolveLoadout(inv.owned, birth, keeperBook(inv.owned))
    ok(res.slots[TAC] === null && res.why[TAC] === 'no-gem', `★ a bound word with no letters set resolves EMPTY as no-gem (got ${res.slots[TAC]} / ${res.why[TAC]})`)
    // setSlot refuses without letters, binds with them, and clearing returns them
    const before = ALL_BANDS.map(() => null)
    ok(setSlot(inv.owned, birth, before, TAC, word.id, keeperBook(inv.owned))[TAC] === null, '★ setSlot REFUSES a word the keeper cannot write')
    let l: Letters = { bag: {}, vessels: { bracelet: [], focus: [] } }
    for (const r of word.runes) l = addGems(l, r)
    store[GEMS_KEY] = JSON.stringify(l.bag)
    const after = setSlot(inv.owned, birth, before, TAC, word.id, keeperBook(inv.owned))
    ok(after[TAC] === word.id, 'with the letters in the bag, setSlot binds it')
    const v = JSON.parse(store[VESSELS_KEY]!)
    ok(missingLetters(word.runes, v.bracelet).length === 0 && JSON.stringify(JSON.parse(store[GEMS_KEY]!)) === '{}', '★ ...and the letters MOVED bag → bracelet, persisted')
    const cleared = setSlot(inv.owned, birth, after, TAC, null, keeperBook(inv.owned))
    const bag = JSON.parse(store[GEMS_KEY]!)
    ok(cleared[TAC] === null && word.runes.every((r) => (bag[r] ?? 0) >= 1) && JSON.parse(store[VESSELS_KEY]!).bracelet.length === 0, 'clearing the slot returns the letters to the bag')
    // body-held: Squall for a tempest-born binds with an empty bag
    store[GEMS_KEY] = '{}'
    if (body) ok(setSlot(inv.owned, birth, cleared, TAC, body.id, keeperBook(inv.owned))[TAC] === body.id, `★ the doubled focus (${body.id}) binds with an empty bag — the floor, through the consumer`)
  }
}

// ── F. the host: /gems and the picker read the same letters, and the panel names what is short ─
{
  const src = noComments(readFileSync(new URL('../voxel3d/VoxelWorld.tsx', import.meta.url), 'utf8'))
  const at = src.indexOf('gems: (arg, n) =>')
  ok(at >= 0, 'VoxelWorld has the gems op')
  const op = at >= 0 ? src.slice(at, src.indexOf('\n    },\n', at)) : ''
  ok(/keeperLetters\(/.test(op) && /addGems\(/.test(op) && /saveLetters\(/.test(op) && /setRuneTick\(/.test(op), 'the op reads through keeperLetters, adds, persists, and ticks the world')
  ok(/isOwner\) return/.test(op), 'granting is owner-gated inside the op; bare is not')
  // ★ RE-POINTED 2026-09-04 (hub): the cast bar is a READOUT now; the SATCHEL's vessel parts say what a
  // vessel is short (`shortOf`), and writing happens there. Same claim, new surface.
  ok(/shortOf\(/.test(src), 'the satchel asks shortOf — a vessel the keeper cannot write yet says which letters are short')
  // ★★ THE LETTERS, SPLIT BY WHERE THE THING LIVES (Alex, 2026-09-03): the BAG on the Satchel, the
  // VESSELS on Gear (was Loadout), and no Runes tab at all since 09-04. ⚠ RE-POINTED from `LettersCard`, which this block
  // anchored on until the split retired it. Every behavioural assert below is the original, re-aimed
  // at whichever half now owns it; the two-tab assert is REPLACED rather than dropped, because the
  // arrangement is exactly what was ruled and an unasserted arrangement drifts back.
  const cardAt = declAt(src, 'SatchelLetters')
  ok(cardAt >= 0, 'VoxelWorld has a SatchelLetters')
  const cardEnd = declAfter(src, 'VesselRack', cardAt)
  ok(cardAt >= 0 && cardEnd > cardAt, 'the card slice has BOTH anchors — an unanchored end slices to the file tail and every assert below passes anywhere')
  const card = cardAt >= 0 && cardEnd > cardAt ? src.slice(cardAt, cardEnd) : ''
  ok(/keeperLetters\(owned, birth\)/.test(card) && !/useState\(/.test(card), 'the card reads keeperLetters on every render — never pinned in useState')
  ok(/l\.bag/.test(card), 'the SATCHEL half renders the bag')
  const rackAt = declAt(src, 'VesselRack')
  const rackEnd = declAfter(src, 'GearTab', rackAt)
  ok(rackAt >= 0 && rackEnd > rackAt, 'the rack slice has BOTH anchors')
  const rack = rackAt >= 0 && rackEnd > rackAt ? src.slice(rackAt, rackEnd) : ''
  // ★ RE-POINTED 2026-09-04 (hub): seats come from the WORD (`seatCount`), not from the cap.
  ok(/VESSELS\.map\(/.test(rack) && /seatCount\(/.test(rack), 'the GEAR half renders both vessels from the list, not two literals, with seats from the word')
  // ⚠⚠ THE POSITIVE ABOVE IS NOT ENOUGH, AND A MUTATION PROVED IT (2026-09-03). The rack contains
  // TWO `VESSELS.map(` — the header's owned-count summary and the row loop — so replacing the ROW
  // loop with a hardcoded `['bracelet', 'focus']` left the header's match standing and the assert
  // passed. It could not tell WHICH one it had found: the cheapest wrong answer still satisfied it
  // (PATTERNS 08-23, *a guard satisfiable by being ANYWHERE*). The named negative closes it.
  ok(!/\[\s*'bracelet'\s*,\s*'focus'\s*\]/.test(rack) && !/\[\s*'focus'\s*,\s*'bracelet'\s*\]/.test(rack),
     '★ and the vessel names are NEVER paired as a literal array — that list is `VESSELS` or it is a mirror of it')
  ok(/keeperLetters\(owned, birth\)/.test(rack), 'and reads the letters fresh too — a bind two rows below moves them under the cursor')
  const bagUses = src.split('<SatchelLetters ').length - 1
  const rackUses = src.split('<VesselRack ').length - 1
  ok(bagUses === 1 && rackUses === 1, `★ ONE mount each — the bag on the satchel, the vessels on the loadout (${bagUses}/${rackUses})`)
  // ⚠ RE-POINTED 2026-09-04: this sliced RunesTab..ToolsTab to prove Runes carried no card. Both
  // functions are gone (Runes retired, Tools folded into Gear), and a slice between two missing
  // anchors is '' — every assert on it passes vacuously. So assert the retirement itself instead.
  ok(declAt(src, 'RunesTab') < 0 && declAt(src, 'ToolsTab') < 0,
     '★ no RUNES tab and no TOOLS tab — Runes retired, Tools folded into Gear (Alex, 2026-09-04)')
  const loadTab = src.slice(declAt(src, 'GearTab'), src.indexOf('ALL_BANDS.map((kind, i) =>', declAt(src, 'GearTab')))
  ok(/<VesselRack /.test(loadTab) && !/<SatchelLetters /.test(loadTab), 'the rack sits in GearTab above the slots, and the bag does not follow it there')
}

console.log(`gems: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
