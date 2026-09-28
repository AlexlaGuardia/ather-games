/**
 * GREG'S PAIR, per birth rune — THE BIRTH LETTER COMES FIRST (ruled 2026-09-28, /magii + Alex).
 * Both vessels are cut for a word that begins with the birth rune; the birth letter glows from day one; the
 * seats after it stand empty. Greg gives the bracelet's GEMS, the Enchant Temple imbues them and teaches the
 * word, and a gem in the seat counts as holding its rune INSIDE GREG'S PAIR ONLY.
 * Run: `npx tsx src/app/shimmer/play3d/floor-pair.test.ts`
 */
import {
  floorCandidates, floorVessel, floorWordFor, seatLetters, seatLights, gregWord, gregGems, gregGemsInHand,
  imbueGregBracelet, isLit, loadStowed, saveStowed, isFloor, grantVessel, wornWord, STOWED_KEY, WORN_TIER_KEY, FLOOR_TIER, BAND_FOR_VESSEL, isFloorWord, GREG_BRACELET_PICK,
} from './vessels'
import { KEEPER_MOVES, moveById } from './keeper-moves'
import { lettersOf, saveWornWord, saveLetters } from './gems'
import { laneRunes, eligibleMoves, ALL_BANDS, isBuilt } from './cast'
import { ELEMENTS, runesOf } from './birth/runes.data'
import { setBirthRune, saveRuneInventory, EMPTY_INVENTORY } from './rune-inventory'
import { saveBook, keeperBook } from './book'
import { saveLoadout, rawLoadout } from './loadout'
import { imbuedWord } from './greg-pair'
import { keeperKey } from '@/lib/keeper-local'
import { rebirth } from './reborn'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const store: Record<string, string> = {}
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] },
}
const wipe = () => { for (const k of Object.keys(store)) delete store[k] }
const births = ELEMENTS.flatMap(e => runesOf(e.id).map(r => r.id))
const TAC = ALL_BANDS.indexOf('tactical')

// ── A. the cut, for every birth rune on the carousel ──────────────────────────────────────────────────
ok(births.length === 17 && births.every(b => !!GREG_BRACELET_PICK[b]), `★★ every one of the 17 births has a ruled bracelet word`)
for (const b of births) {
  for (const kind of ['bracelet', 'focus'] as const) {
    const w = floorWordFor(kind, b)
    ok(!!w, `★★ ${b}: Greg's ${kind} is cut for a word (the birth-first pass closed every lane)`)
    if (!w) continue
    const seats = seatLetters({ move: w }, b)
    ok(seats[0] === b, `★★ ${b}: the ${kind}'s FIRST letter is the birth rune (${w}: ${seats.join('+')})`)
    ok(seats.length >= 2, `★ ${b}: the ${kind} has a seat for more than the birth letter (${w})`)
    const band = ALL_BANDS[BAND_FOR_VESSEL[kind]]!
    const on = laneRunes(b, kind === 'bracelet' ? 'element' : 'state')
    ok(moveById(w)!.tier === band && moveById(w)!.runes.every(r => on.has(r)), `${b}: the ${kind}'s word is on its lane (${w})`)
    const sizes = KEEPER_MOVES.filter(m => m.tier === band && !m.birthExclusive && m.runes.includes(b) && m.runes.every(r => on.has(r)))
      .map(m => lettersOf(m, b).length).filter(n => n >= 2)
    // the bracelet's word is RULED per birth (the 17, athernyx 8432ebf); the glove's is the smallest signature
    if (kind === 'bracelet') ok(w === GREG_BRACELET_PICK[b], `★★ ${b}: the bracelet is cut for the ruled word (${w} vs ${GREG_BRACELET_PICK[b]})`)
    else ok(seats.length === Math.min(...sizes), `★ ${b}: the ${kind}'s word is the SMALLEST birth-first word (${seats.length})`)
    if (kind === 'focus') ok(isBuilt(w) || floorCandidates(kind, b).every(m => !isBuilt(m.id)), `${b}: a word the sim runs is cut before one it cannot (${w})`)
    ok(floorVessel(kind, b).gems.length === seats.length, `${b}: the ${kind} arrives with its letters grown in`)
    ok(isFloorWord(kind, b, w), `${b}: the cut passes its own floor test`)
  }
}

// ── B. the first errand, on one keeper ────────────────────────────────────────────────────────────────
wipe()
const birth = 'life'
saveRuneInventory(setBirthRune(EMPTY_INVENTORY, birth))
saveBook({ learned: [] })
saveLoadout(ALL_BANDS.map(() => null))
const owned = [birth]
const w = gregWord('bracelet')
ok(w === floorWordFor('bracelet', birth), `the stowed floor bracelet is cut for the birth-first word (${w})`)
const fl = loadStowed().find(v => v.kind === 'bracelet' && isFloor(v))!
ok(!!fl && !isLit(fl, owned, birth, keeperBook(owned)), 'before the Temple, Greg\'s bracelet is not lit')
const lights = seatLights(fl, owned, birth, keeperBook(owned))
ok(lights[0] === 'lit' && lights.slice(1).every(s => s === 'empty'), `★★ the birth letter glows from day one; the seats after it stand EMPTY (${lights.join(' ')})`)
ok(gregGemsInHand() && gregGems(birth).length === lights.length - 1 && !gregGems(birth).includes(birth), `★ Greg's gems are in hand, one per empty seat (${gregGems(birth).join('+')})`)
ok(!eligibleMoves(owned, birth, 'tactical', keeperBook(owned)).some(m => m.id === w), 'not castable before the Temple')
// a word the keeper was TAUGHT elsewhere but whose runes they lack stays dark: the exception is the Temple's, not the book's
saveBook({ learned: [w!] })
ok(!isLit(fl, owned, birth, keeperBook(owned)), '★ knowing the word is not enough: without the seat-gems its runes are not held')
saveBook({ learned: [] })

const r = imbueGregBracelet(birth, keeperBook(owned))
ok(r.ok && r.word === w && imbuedWord() === w, '★★ the Enchant Temple imbues Greg\'s bracelet for its word')
ok(keeperBook(owned).learned.includes(w!), '★★ and TEACHES the word as it does (it goes in the book)')
ok(r.ok && r.worn && wornWord('bracelet') === w && rawLoadout()[TAC] === w, '★ nothing was on the wrist, so it goes on and its band is bound')
ok(eligibleMoves(owned, birth, 'tactical', keeperBook(owned)).some(m => m.id === w), '★★ the imbued word is castable though the keeper holds only the birth rune (the seat-gems count)')
ok(!gregGemsInHand(), 'Greg\'s gems are no longer in hand')
const again = imbueGregBracelet(birth, keeperBook(owned))
ok(!again.ok && again.why === 'already', 'a second visit does nothing but say so')

// ── C. ⛔ NEVER GENERAL ──────────────────────────────────────────────────────────────────────────────────
// the glove's word is not granted by the bracelet's imbue, even learned
const gw = floorWordFor('focus', birth)!
saveBook({ learned: [...keeperBook(owned).learned, gw] })
ok(!eligibleMoves(owned, birth, 'ultimate', keeperBook(owned)).some(m => m.id === gw), '⛔ the glove\'s word is NOT lit by the bracelet\'s gems: the exception is one word in one vessel')
// another tactical sharing a non-birth rune of the imbued word stays unheld
const other = gregGems(birth)[0]!
const cousin = KEEPER_MOVES.find(m => m.tier === 'tactical' && m.id !== w && m.runes.includes(other) && !m.runes.includes(birth))
if (cousin) {
  saveBook({ learned: [...keeperBook(owned).learned, cousin.id] })
  ok(!eligibleMoves(owned, birth, 'tactical', keeperBook(owned)).some(m => m.id === cousin.id), `⛔ the seat-gem teaches nothing of ${other} beyond the word (${cousin.id} stays unheld)`)
}

// ── D. a pre-09-28 save is recut on read, worn or stowed ────────────────────────────────────────────────
wipe()
saveRuneInventory(setBirthRune(EMPTY_INVENTORY, birth))
saveStowed([{ kind: 'bracelet', gems: ['star'], move: 'firewall', tier: 0 }])
ok(JSON.parse(store[Object.keys(store).find(k => k.startsWith(STOWED_KEY))!]!)[0].move === 'firewall', '(the stale save is really on disk)')
const recut = loadStowed().find(v => v.kind === 'bracelet' && isFloor(v))
ok(recut?.move === floorWordFor('bracelet', birth), `★ a stowed floor cut for a one-letter word before 09-28 is recut for the birth-first word (${recut?.move})`)
ok(recut?.tier === FLOOR_TIER, 'and it stays Greg\'s')
// worn: the wrist carries a pre-09-28 floor word
saveWornWord('bracelet', 'firewall'); store[Object.keys(store).find(k => k.startsWith(STOWED_KEY))!] = '[]'
store[keeperKey(WORN_TIER_KEY)] = JSON.stringify({ bracelet: 0, focus: 1 }); saveLetters({ bag: {}, vessels: { bracelet: ['star'], focus: [] } })
loadStowed()
ok(wornWord('bracelet') === floorWordFor('bracelet', birth), `★ a WORN floor cut before 09-28 is recut on the wrist (${wornWord('bracelet')})`)

// ── E. a rebirth puts Greg's gems back in hand ──────────────────────────────────────────────────────────
rebirth('stone')
ok(imbuedWord() === null, '★ a different keeper carries Greg\'s gems again')
ok(grantVessel('bracelet', 1, null, 'bought').ok, '(the satchel still works after a rebirth)')

console.log(`floor-pair: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗', f)
if (fails.length) process.exit(1)
