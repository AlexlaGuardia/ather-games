// The Passage's oracle. Run: npx tsx src/app/shimmer/play3d/scroll-market.test.ts
//
// Four of these asserts are CANON, not tuning, and are labelled so — if one goes red the fix is in
// this repo, never in the test:
//   • a scroll teaches a move, never a rune
//   • the rune is the filter: no rune, no reading
//   • ULTIMATES ARE NOT FOR SALE
//   • traders rotate, and a departed trader can return (no permanent miss)
// The rest — price shape, rack size, cadence — are the build's, and canon says so by name.

import {
  rackFor, cycleAt, msUntilRotation, ROTATION_MS, RACK_SIZE, TRADE_POOL, tradeable, priceOf,
  canRead, castable, learn, hasLearned, buy, seedBook, EMPTY_BOOK, type Book,
} from './scroll-market'
import { KEEPER_MOVES, knownMoves } from './keeper-moves'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const byId = (id: string) => KEEPER_MOVES.find((m) => m.id === id)!
const SEED = 1337

// ── 1. ★ CANON: ULTIMATES ARE NOT FOR SALE ──────────────────────────────────────────────────────
// Asserted three ways, because this one is a promise about what the game means, not a filter that
// happens to be convenient: not in the pool, never on a rack, refused at the counter.
{
  const ults = KEEPER_MOVES.filter((m) => m.tier === 'ultimate')
  ok(ults.length > 0, 'there ARE ultimates to exclude (a vacuous pass here would prove nothing)')
  ok(ults.every((m) => !tradeable(m)), 'no ultimate is tradeable')
  ok(TRADE_POOL.every((m) => m.tier !== 'ultimate' && m.tier !== 'combo'),
    'the pool is passives and tacticals only')
  let seen = false
  for (let c = 0; c < 400; c++) if (rackFor(SEED, c).some((m) => m.tier === 'ultimate')) seen = true
  ok(!seen, 'no ultimate appears on any rack across 400 cycles')
  // And at the counter, even if a caller hands one straight in.
  const ult = ults[0]
  const r = buy(EMPTY_BOOK, 99999, ult.runes, ult, [ult])
  ok(!r.ok && r.why === 'not-for-sale', 'the counter refuses an ultimate even when it is on the rack')
}

// ── 2. ★ CANON: A SCROLL TEACHES A MOVE, NEVER A RUNE ───────────────────────────────────────────
// The strongest form available in code: buying changes the BOOK and nothing else. If a future
// hand ever wires a rune grant into a purchase, this goes red.
{
  const m = TRADE_POOL.find((x) => x.runes.length === 1)!
  const r = buy(EMPTY_BOOK, 500, m.runes, m, [m])
  ok(r.ok, 'a readable, affordable, stocked scroll sells')
  ok(r.book.learned.length === 1 && r.book.learned[0] === m.id, 'the move landed in the book')
  ok(JSON.stringify(Object.keys(r)).indexOf('rune') === -1, 'a purchase hands back no runes at all')
}

// ── 3. ★ CANON: THE RUNE IS THE FILTER ──────────────────────────────────────────────────────────
{
  const m = TRADE_POOL.find((x) => x.runes.length === 1)!
  ok(canRead(m, m.runes), 'carrying its rune: readable')
  ok(!canRead(m, ['definitely-not-a-rune']), 'carrying the wrong rune: not readable')
  const r = buy(EMPTY_BOOK, 9999, ['definitely-not-a-rune'], m, [m])
  ok(!r.ok && r.why === 'unreadable', 'the counter refuses to sell what you cannot read')
  ok(r.marks === 9999, 'a refused purchase costs nothing')
  ok(r.say.includes('beautiful piece of paper'), 'and the trader says why, in canon\'s own words')
  // A two-rune move needs BOTH — canon's runeword compatibility rule, for free.
  const two = TRADE_POOL.find((x) => x.runes.length === 2)
  if (two) {
    ok(!canRead(two, [two.runes[0]]), 'half of a two-rune move is not readable')
    ok(canRead(two, two.runes), 'both runes: readable')
  }
}

// ── 4. ★ CANON: THE RACK ROTATES, AND WHAT LEAVES COMES BACK ────────────────────────────────────
// "Traders rotate and hold no permanent claim" — but canon never says a departed trader cannot
// return, so a missed cycle must never be a permanent loss. Asserted over a year of racks.
{
  const seenIn = new Map<string, number>()
  const CYCLES = 365
  for (let c = 0; c < CYCLES; c++) for (const m of rackFor(SEED, c)) seenIn.set(m.id, (seenIn.get(m.id) ?? 0) + 1)
  ok(seenIn.size === TRADE_POOL.length,
    `every one of ${TRADE_POOL.length} tradeable moves appears within ${CYCLES} cycles (saw ${seenIn.size})`)
  // It must actually CHANGE, too — a rack that never rotates would also pass a returning test if
  // the pool were small enough.
  let changed = 0
  for (let c = 1; c < 50; c++) {
    const a = rackFor(SEED, c - 1).map((m) => m.id).join()
    if (a !== rackFor(SEED, c).map((m) => m.id).join()) changed++
  }
  ok(changed >= 45, `the rack turns over cycle to cycle (${changed}/49)`)
}

// ── 5. THE RACK IS THE SAME FOR EVERYONE, AND STABLE WITHIN A CYCLE ─────────────────────────────
// The design this protects: "the same rack means something different to every keeper who walks
// past it." A rack pre-filtered per keeper would be tidier and would delete that sentence.
{
  const a = rackFor(SEED, 7).map((m) => m.id).join()
  ok(a === rackFor(SEED, 7).map((m) => m.id).join(), 'same seed + cycle = the same rack, always')
  ok(a !== rackFor(SEED + 1, 7).map((m) => m.id).join(), 'a different world deals a different rack')
  ok(rackFor(SEED, 7).length === RACK_SIZE, `the rack holds ${RACK_SIZE}`)
  ok(new Set(rackFor(SEED, 7).map((m) => m.id)).size === RACK_SIZE, 'no scroll stands twice on one rack')
}

// ── 6. ★ THE MODEL CHANGE: RUNES MAKE A MOVE READABLE, NOT KNOWN ────────────────────────────────
// This is the bug the whole feature rests on. `knownMoves` (runes alone) must NOT be castable.
{
  const m = TRADE_POOL.find((x) => x.runes.length === 1)!
  const runes = m.runes
  ok(knownMoves(runes).some((k) => k.id === m.id), 'runes alone make it READABLE')
  ok(!castable(EMPTY_BOOK, runes).some((k) => k.id === m.id), 'runes alone do NOT make it castable')
  const book = learn(EMPTY_BOOK, m.id)
  ok(castable(book, runes).some((k) => k.id === m.id), 'learned + runes = castable')
  // And the half that surprises: learning is not undone by losing the rune.
  ok(hasLearned(book, m.id), 'the book still holds it with the rune gone')
  ok(!castable(book, []).some((k) => k.id === m.id), 'but it cannot be cast without the rune')
  ok(castable(book, runes).some((k) => k.id === m.id), 'get the rune back and it is yours again')
}

// ── 7. LEARNING IS IDEMPOTENT, AND BUYING TWICE IS A REFUSAL NOT A CHARGE ──────────────────────
{
  const m = TRADE_POOL.find((x) => x.runes.length === 1)!
  const once = learn(EMPTY_BOOK, m.id)
  ok(learn(once, m.id).learned.length === 1, 'learning the same move twice adds one entry')
  const r = buy(once, 500, m.runes, m, [m])
  ok(!r.ok && r.why === 'already-known' && r.marks === 500, 'buying it again refuses and charges nothing')
}

// ── 8. PRICE AND PURSE ──────────────────────────────────────────────────────────────────────────
// Build-side numbers; what is asserted is the SHAPE, so retuning is free and inverting it is not.
{
  const psv = TRADE_POOL.find((m) => m.tier === 'passive' && m.runes.length === 1)!
  const tac = TRADE_POOL.find((m) => m.tier === 'tactical' && m.runes.length === 1)!
  ok(priceOf(tac) > priceOf(psv), 'a tactical costs more than a passive')
  ok(TRADE_POOL.every((m) => priceOf(m) > 0 && Number.isFinite(priceOf(m))), 'everything has a real price')
  const two = TRADE_POOL.find((m) => m.runes.length === 2 && m.tier === tac.tier)
  if (two) ok(priceOf(two) > priceOf(tac), 'rarer paper (two runes) costs more than one')
  const r = buy(EMPTY_BOOK, priceOf(tac) - 1, tac.runes, tac, [tac])
  ok(!r.ok && r.why === 'too-dear', 'one mark short is a refusal')
  ok(r.say.includes(String(priceOf(tac))), 'and the refusal names the price rather than just saying no')
  const r2 = buy(EMPTY_BOOK, priceOf(tac), tac.runes, tac, [tac])
  ok(r2.ok && r2.marks === 0, 'exactly the price is enough, and spends it all')
}

// ── 9. YOU CANNOT BUY WHAT IS NOT ON THE RACK ───────────────────────────────────────────────────
// Otherwise rotation is decoration: a panel bug that listed the whole pool would sell the whole pool.
{
  const rack = rackFor(SEED, 3)
  const off = TRADE_POOL.find((m) => !rack.some((r) => r.id === m.id))!
  const r = buy(EMPTY_BOOK, 9999, off.runes, off, rack)
  ok(!r.ok && r.why === 'not-stocked', 'a move that is not standing on the rack cannot be bought')
}

// ── 10. THE MIGRATION KEEPS WHAT A KEEPER CARRIES ──────────────────────────────────────────────
// The failure this exists to prevent: an existing keeper's cast keys going dead on deploy.
{
  const a = TRADE_POOL[0].id, b = TRADE_POOL[1].id
  const seeded = seedBook([a, null, b, null])
  ok(seeded.learned.length === 2 && hasLearned(seeded, a) && hasLearned(seeded, b),
    'every bound move survives the migration')
  ok(!seeded.learned.includes(''), 'empty slots do not become entries')
  const withStarter = seedBook([null, null, null, null], a)
  ok(withStarter.learned.length === 1 && hasLearned(withStarter, a),
    'an empty loadout still gets the starter, so a new keeper is never left with four dead keys')
  ok(seedBook([a], a).learned.length === 1, 'a starter already bound is not duplicated')
  // And the half that would silently cancel the feature:
  const richRunes = TRADE_POOL[0].runes
  ok(seedBook([]).learned.length < knownMoves(richRunes as string[]).length,
    'the migration does NOT hand over everything the runes allow — the rack must still have stock')
}

// ── 11. THE CLOCK ───────────────────────────────────────────────────────────────────────────────
{
  ok(cycleAt(0) === 0 && cycleAt(ROTATION_MS) === 1 && cycleAt(ROTATION_MS * 3 + 5) === 3,
    'the cycle index steps once per rotation')
  ok(msUntilRotation(0) === ROTATION_MS, 'a fresh rack stands for a full rotation')
  ok(msUntilRotation(ROTATION_MS - 1) === 1, 'one ms before changeover reads as one ms')
  const t = ROTATION_MS * 4 + 12345
  ok(cycleAt(t + msUntilRotation(t)) === cycleAt(t) + 1, 'waiting exactly that long lands on the next rack')
}

console.log(fails.length ? `scroll-market: ${pass} pass, ${fails.length} FAIL` : `Passage oracle ${pass} CLEAN`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
