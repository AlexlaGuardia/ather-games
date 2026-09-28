/**
 * THE GLOVE'S ROAD (RULED 2026-09-28, casting-vessels › HOW GREG'S GLOVE IS EARNED): after the bracelet is lit,
 * Idony names the Breach; a cache past a real round holds the glove's stones; she weaves them and the glove lights.
 * Run: `npx tsx src/app/shimmer/play3d/glove-road.test.ts`
 */
import { gloveErrand, gloveStones, gregWord, imbueGregBracelet, imbueGregGlove, markGloveAsked, markGloveStones,
  breachOwesGloveStones, loadStowed, isFloor, isLit, seatLights } from './vessels'
import { gloveRoad, seatGemWords, clearImbued } from './greg-pair'
import { eligibleMoves, ALL_BANDS } from './cast'
import { setBirthRune, saveRuneInventory, EMPTY_INVENTORY } from './rune-inventory'
import { saveBook, keeperBook } from './book'
import { saveLoadout } from './loadout'
import { parseLanding, startHold, rollChests, chestTick, HOLD_TUNING } from './hold'
import { ELEMENTS, runesOf } from './birth/runes.data'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const store: Record<string, string> = {}
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] },
}
const wipe = () => { for (const k of Object.keys(store)) delete store[k] }
const fresh = (birth: string) => {
  wipe(); saveRuneInventory(setBirthRune(EMPTY_INVENTORY, birth)); saveBook({ learned: [] }); saveLoadout(ALL_BANDS.map(() => null))
}

// ── A. the road, on one keeper ─────────────────────────────────────────────────────────────────────────
const birth = 'lightning'
fresh(birth)
const owned = [birth]
const gw = gregWord('focus')!
ok(gw === 'stormbank', `Greg's glove on a Lightning birth is the ruled word (${gw})`)
ok(gloveErrand() === 'locked' && !breachOwesGloveStones(), '★ the glove\'s road is LOCKED until the bracelet is lit')
imbueGregBracelet(birth, keeperBook(owned))
ok(gloveErrand() === 'ask', 'the bracelet lit: Greg points back to the Temple, Idony has not yet read the glove')
ok(!breachOwesGloveStones(), '⛔ the Breach owes nothing until Idony has named it')
ok(imbueGregGlove(birth, keeperBook(owned)).ok === false, '⛔ no weave without the stones')
markGloveAsked()
ok(gloveErrand() === 'breach' && breachOwesGloveStones(), '★★ Idony named the Breach: it now owes the glove\'s stones')
ok(gloveStones(birth).length >= 1 && !gloveStones(birth).includes(birth), `the stones are the glove word's letters after the birth letter (${gloveStones(birth).join('+')})`)
const glove = loadStowed().find(v => v.kind === 'focus' && isFloor(v))!
ok(!isLit(glove, owned, birth, keeperBook(owned)), 'the glove is still dark')

// ── B. the Breach pays it: only past a real round, never before ────────────────────────────────────────
const map = parseLanding()
const s = startHold(map, 11)
s.gloveOwed = breachOwesGloveStones()
s.round = HOLD_TUNING.gloveRound - HOLD_TUNING.chestEvery
rollChests(s, HOLD_TUNING, 1)
ok(!s.chests.some(c => c?.stones), `⛔ before round ${HOLD_TUNING.gloveRound}, no cache holds the stones`)
s.chests = s.chests.map(() => null)
s.round = HOLD_TUNING.gloveRound
rollChests(s, HOLD_TUNING, 0)   // a wave that rolled NOTHING
const spot = s.chests.findIndex(c => c?.stones)
ok(spot >= 0, '★★ at the glove round the stones appear even when the wave rolled no cache')
ok(s.rooms[map.chestSpots[spot].room] || !map.chestSpots.some(c => s.rooms[c.room]), 'in an opened room when there is one')
rollChests(s, HOLD_TUNING, 1)
ok(s.chests.filter(c => c?.stones).length === 1, 'only one stones cache stands at a time')
let got = null
for (let i = 0; i < 200 && !got; i++) got = chestTick(s, spot, 0.15)
ok(got?.kind === 'stones' && s.loot.some(l => l.kind === 'stones') && !s.gloveOwed, '★ opening it gives the stones and settles the debt')
const s2 = startHold(map, 12); s2.round = HOLD_TUNING.gloveRound
rollChests(s2, HOLD_TUNING, 1)
ok(!s2.chests.some(c => c?.stones), '⛔ a keeper the Breach owes nothing never sees a stones cache')

// ── C. home to Idony: the weave, the word, the glove lit ───────────────────────────────────────────────
markGloveStones()
ok(gloveErrand() === 'weave' && !breachOwesGloveStones(), 'stones in hand: back to the Temple')
const r = imbueGregGlove(birth, keeperBook(owned))
ok(r.ok && r.word === gw && keeperBook(owned).learned.includes(gw), '★★ Idony weaves them and TEACHES the glove\'s word')
ok(gloveErrand() === 'done' && gloveRoad().imbued === gw && seatGemWords().includes(gw), 'the road is done; the seat-gem exception now covers the glove\'s word too')
ok(eligibleMoves(owned, birth, 'ultimate', keeperBook(owned)).some(m => m.id === gw), '★★ the glove\'s word is castable on the birth rune alone (Greg\'s pair only)')
const glove2 = loadStowed().find(v => v.kind === 'focus' && isFloor(v))
ok(!glove2 || seatLights(glove2, owned, birth, keeperBook(owned)).every(x => x === 'lit'), 'every seat of the glove reads lit')
ok(!imbueGregGlove(birth, keeperBook(owned)).ok, 'a second weave does nothing')
clearImbued()
ok(gloveRoad().imbued === null && !gloveRoad().asked, 'a rebirth starts the glove\'s road over')

// ── D. the same road for every birth ───────────────────────────────────────────────────────────────────
for (const b of ELEMENTS.flatMap(e => runesOf(e.id).map(x => x.id))) {
  fresh(b)
  imbueGregBracelet(b, keeperBook([b])); markGloveAsked(); markGloveStones()
  const rr = imbueGregGlove(b, keeperBook([b]))
  ok(rr.ok && eligibleMoves([b], b, 'ultimate', keeperBook([b])).some(m => m.id === rr.word), `${b}: the glove lights for its ruled word (${rr.ok ? rr.word : 'none'})`)
}

console.log(`glove-road: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
