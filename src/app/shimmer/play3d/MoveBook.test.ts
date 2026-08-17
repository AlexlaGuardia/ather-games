// The book panel's oracle. Run: npx tsx src/app/shimmer/play3d/MoveBook.test.ts
//
// ★ WHY THIS FILE EXISTS, AND IT IS NOT "the component needed coverage".
// The defect it was written for could not be caught by any test that existed: `MoveRow` HARDCODED
// the string `NOT YET LEARNED` on every move, so the panel kept asserting a state the game had
// already left behind — the Passage shipped, the rack said "known", the key fired, and the book
// went on saying the move was not learned. A hardcoded status is not a wrong value, it is a value
// that cannot be wrong, which is exactly what no assert was watching.
//
// So the load-bearing assert here is the LAST one: no status is a constant. Everything above it
// checks a specific mapping; that one checks that the mapping is a mapping at all, and it is the
// assert that would have gone red on the old code.

import { statusOf } from './MoveBook'
import { KEEPER_MOVES } from './keeper-moves'
import { priceOf, tradeable, EMPTY_BOOK, type Book } from './scroll-market'

let pass = 0, fail = 0
function ok(cond: boolean, what: string) {
  if (cond) { pass++; return }
  fail++
  console.error(`  ✗ ${what}`)
}

const book = (...ids: string[]): Book => ({ learned: ids })
const byId = (id: string) => KEEPER_MOVES.find((m) => m.id === id)!

// A single-rune tactical the Passage stocks, and a signature — the two halves of canon's sale rule.
const soloTradeable = KEEPER_MOVES.find((m) => m.runes.length === 1 && tradeable(m))!
const signature = KEEPER_MOVES.find((m) => m.runes.length === 1 && m.tier === 'ultimate')!
const twoRune = KEEPER_MOVES.find((m) => m.runes.length === 2)!

console.log(`\nfixtures: ${soloTradeable.name} (${soloTradeable.tier}) · ${signature.name} (signature) · ${twoRune.name} (two-rune)\n`)

// ── the four states ─────────────────────────────────────────────────────────────────────────────
{
  const m = soloTradeable
  const rune = m.runes[0]

  const known = statusOf(m, book(m.id), [rune])
  ok(known.label === 'KNOWN', 'learned + rune carried reads KNOWN')
  ok(known.lit === true, 'and KNOWN is the only lit state — the row a keeper can act on')

  // ★ The surprising half of `castable()`, said out loud: knowledge survives losing the rune.
  const quiet = statusOf(m, book(m.id), [])
  ok(quiet.label.startsWith('KNOWN'), 'learned but rune lost still reads as KNOWN — the book is not edited behind the player')
  ok(quiet.label !== 'KNOWN', 'but not a plain KNOWN, which would sit next to a dead key')
  ok(quiet.lit === false, 'and it is unlit, because it cannot be cast right now')

  const forSale = statusOf(m, EMPTY_BOOK, [rune])
  ok(forSale.label.includes('SCROLL'), 'unlearned + readable + stocked reads as a scroll you can read')
  ok(forSale.label.includes(String(priceOf(m))), 'and it names the real price rather than just saying buyable')

  const locked = statusOf(m, EMPTY_BOOK, [])
  ok(locked.label === 'LOCKED', 'unlearned + rune not carried reads LOCKED')
}

// ── canon's sale rule reaches the panel ─────────────────────────────────────────────────────────
{
  const s = statusOf(signature, EMPTY_BOOK, [signature.runes[0]])
  ok(!s.label.includes('SCROLL'), 'a signature is never offered as a scroll — canon does not sell ultimates')
  ok(!/✦/.test(s.label), 'and it carries no price at all')

  const combo = KEEPER_MOVES.find((m) => m.tier === 'combo')
  if (combo) {
    const c = statusOf(combo, EMPTY_BOOK, combo.runes)
    ok(c.label.includes('RUNEWORD'), 'a combo reads as a runeword, not as an unsold ultimate')
  }
}

// ── a two-rune move is locked by the rune you lack, not by the page you are on ──────────────────
{
  const [a, b] = twoRune.runes
  ok(statusOf(twoRune, EMPTY_BOOK, [a]).label === 'LOCKED', 'holding one of two runes is LOCKED')
  const both = statusOf(twoRune, EMPTY_BOOK, [a, b])
  ok(both.label !== 'LOCKED', 'holding both stops being locked — the cross-hatch is reachable')
  ok(statusOf(twoRune, book(twoRune.id), [a, b]).label === 'KNOWN', 'and learning it makes it KNOWN')
}

// ── the status is independent of whether the sim can run it ─────────────────────────────────────
// 13 of the 68 are archetype 'unbuilt'. They are SHOWN, with their own separate label, because
// hiding a registered move is how a keeper concludes their book is short.
{
  const unbuiltIds = ['waymark', 'meltbore', 'gate']
  for (const id of unbuiltIds) {
    const m = KEEPER_MOVES.find((x) => x.id === id)
    if (!m) continue
    const st = statusOf(m, book(m.id), m.runes)
    ok(st.label === 'KNOWN', `${m.name} is unbuilt yet still reports KNOWN — buildability is a separate axis`)
  }
}

// ── ★ THE ASSERT THE OLD CODE FAILS ─────────────────────────────────────────────────────────────
// A hardcoded status passes every mapping test you forget to write. This one asks whether the
// function discriminates at all: one keeper, the whole registry, more than one answer.
{
  const keeper = [soloTradeable.runes[0]]
  const labels = new Set(KEEPER_MOVES.map((m) => statusOf(m, book(soloTradeable.id), keeper).label))
  ok(labels.size >= 3, `one keeper sees at least 3 distinct statuses across the registry (saw ${labels.size})`)
  ok(labels.has('KNOWN'), 'including the one they own')
  ok(labels.has('LOCKED'), 'and the ones they cannot read')

  // Same shape, aimed at the other direction: a status must be able to CHANGE for a fixed move.
  const m = soloTradeable
  const seen = new Set([
    statusOf(m, EMPTY_BOOK, []).label,
    statusOf(m, EMPTY_BOOK, m.runes).label,
    statusOf(m, book(m.id), m.runes).label,
  ])
  ok(seen.size === 3, 'a single move reports three different statuses as the keeper changes')
}

console.log(`\nMoveBook oracle: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
