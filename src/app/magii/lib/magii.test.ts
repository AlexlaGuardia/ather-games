// Magii engine oracle — run: npx tsx src/app/magii/lib/magii.test.ts
//
// The engine had no test at all, and it is about to carry netplay, so this guards the two
// properties multiplayer actually rests on:
//
// 1. DETERMINISM — same seed, same deal, on every machine and every run. If this ever
//    slips, two players sit at tables that merely look alike and the divergence surfaces
//    later as a card that exists for one of them and not the other.
// 2. PURITY — applying a move must not mutate the state handed in. Replaying a move log
//    means running the same reducer over the same history repeatedly; a reducer that
//    scribbles on its input corrupts every replay after the first.
//
// Plus conservation: 96 cards go in, 96 cards come out, no duplicates. A shuffle bug that
// eats or clones a card is invisible in a normal game right up until someone holds a set
// that cannot exist.

import { makeRng, newSeed } from './rng'
import { shuffle, buildDeck, TAVERN_STANDARD, WILDWOOD } from './data'
import { initGame, drawFromDeck, discardCard, startPlaying, scoreHand, type GameState } from './engine'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) return
  failures++
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}

const ids = (cards: { id: string }[]) => cards.map(c => c.id).join(',')
const tableFingerprint = (s: GameState) => `${ids(s.deck)}|${s.players.map(p => ids(p.hand)).join('/')}`

// ── the rng itself ────────────────────────────────────────────────────────────
console.log('rng')
{
  const a = makeRng('table-A'), b = makeRng('table-A'), c = makeRng('table-B')
  const seqA = Array.from({ length: 20 }, () => a())
  const seqB = Array.from({ length: 20 }, () => b())
  const seqC = Array.from({ length: 20 }, () => c())
  check('same seed gives the same sequence', seqA.join() === seqB.join())
  check('a different seed gives a different sequence', seqA.join() !== seqC.join())
  check('stays inside [0,1)', seqA.every(n => n >= 0 && n < 1))
  check('does not get stuck on one value', new Set(seqA).size > 15)
  check('numeric seeds work too', makeRng(42)() === makeRng(42)())
  check('newSeed is readable and unique', /^[A-Z2-9]{8}$/.test(newSeed()) && newSeed() !== newSeed())
}

// ── shuffle ───────────────────────────────────────────────────────────────────
console.log('shuffle')
{
  const source = Array.from({ length: 96 }, (_, i) => i)
  const once = shuffle(source, makeRng('S'))
  const twice = shuffle(source, makeRng('S'))
  check('seeded shuffle is reproducible', once.join() === twice.join())
  check('shuffle does not touch the input', source.join() === Array.from({ length: 96 }, (_, i) => i).join())
  check('every element survives', [...once].sort((x, y) => x - y).join() === source.join())
  check('it actually shuffles', once.join() !== source.join())
  check('unseeded still works', shuffle(source).length === 96)
}

// ── the deal ──────────────────────────────────────────────────────────────────
console.log('the deal')
{
  const deck = buildDeck(TAVERN_STANDARD, makeRng('D'))
  check('a collection builds 96 cards', deck.length === 96, `got ${deck.length}`)
  check('no duplicate cards', new Set(deck.map(c => c.id)).size === 96)

  const g1 = initGame(TAVERN_STANDARD, 'SEED-ONE')
  const g2 = initGame(TAVERN_STANDARD, 'SEED-ONE')
  const g3 = initGame(TAVERN_STANDARD, 'SEED-TWO')
  check('same seed deals an identical table', tableFingerprint(g1) === tableFingerprint(g2))
  check('a different seed deals a different table', tableFingerprint(g1) !== tableFingerprint(g3))
  check('the seed is recorded on the state', g1.seed === 'SEED-ONE')
  // Every game is seeded now, including a solo one: a table you cannot deal again is a bug
  // you cannot reproduce.
  const solo = initGame(TAVERN_STANDARD)
  check('an unseeded call mints its own seed', /^[A-Z2-9]{8}$/.test(solo.seed), solo.seed)
  check('two unseeded games get different seeds', initGame(TAVERN_STANDARD).seed !== initGame(TAVERN_STANDARD).seed)
  check('a minted seed deals the table it recorded', tableFingerprint(initGame(TAVERN_STANDARD, solo.seed)) === tableFingerprint(solo))

  check('four players are seated', g1.players.length === 4)
  check('one of them is you', g1.players.filter(p => p.isHuman).length === 1)
  check('everyone gets 8', g1.players.every(p => p.hand.length === 8))
  check('the rest stays in the deck', g1.deck.length === 96 - 32)

  // Conservation across the deal: every card is somewhere, exactly once.
  const all = [...g1.deck, ...g1.players.flatMap(p => p.hand)]
  check('no card is lost or cloned in the deal', all.length === 96 && new Set(all.map(c => c.id)).size === 96)

  // A different collection must not accidentally deal the same table for a shared seed.
  check('the collection is part of the deal', tableFingerprint(initGame(WILDWOOD, 'SEED-ONE')) !== tableFingerprint(g1))
}

// ── purity + replay ───────────────────────────────────────────────────────────
console.log('purity and replay')
{
  const start = startPlaying(initGame(TAVERN_STANDARD, 'REPLAY'))
  const before = JSON.stringify(start)

  const afterDraw = drawFromDeck(start, 0)
  check('drawing does not mutate the state it was given', JSON.stringify(start) === before)
  check('drawing adds a card to the drawer', afterDraw.players[0].hand.length === 9)
  check('drawing takes it off the deck', afterDraw.deck.length === start.deck.length - 1)
  check('drawing moves the turn to discard', afterDraw.turnPhase === 'discard')

  const afterDiscard = discardCard(afterDraw, 0, 0)
  check('discarding does not mutate its input', afterDiscard !== afterDraw && afterDraw.players[0].hand.length === 9)
  check('discarding returns the hand to 8', afterDiscard.players[0].hand.length === 8)
  check('discarding passes the turn', afterDiscard.currentPlayer === 1)

  // The real netplay property: the same seed and the same moves produce the same table,
  // twice, from scratch. This is what a client does when it replays a relayed move log.
  const replay = (): GameState => {
    let s = startPlaying(initGame(TAVERN_STANDARD, 'REPLAY'))
    for (let i = 0; i < 8; i++) {
      const p = s.currentPlayer
      s = drawFromDeck(s, p)
      s = discardCard(s, p, 0)
    }
    return s
  }
  const runA = replay(), runB = replay()
  check('replaying the same moves lands on the same table', tableFingerprint(runA) === tableFingerprint(runB))
  check('replay also agrees on whose turn it is', runA.currentPlayer === runB.currentPlayer && runA.turn === runB.turn)
  check('cards are still conserved after play',
    new Set([...runA.deck, ...runA.players.flatMap(p => [...p.hand, ...p.discardPile])].map(c => c.id)).size === 96)

  // An invalid move must be a no-op, not a corruption — the wire will carry bad moves.
  const stuck = discardCard(runA, runA.currentPlayer, 0) // hand is 8, not 9: not discardable yet
  check('an illegal discard is refused, unchanged', stuck === runA)
  check('drawing for a hand that has not discarded is still safe', drawFromDeck(runA, runA.currentPlayer).players[runA.currentPlayer].hand.length === 9)
}

// ── scoring sanity ────────────────────────────────────────────────────────────
console.log('scoring')
{
  const g = initGame(TAVERN_STANDARD, 'SCORE')
  const s = scoreHand(g.players[0])
  check('a dealt hand scores a number', Number.isFinite(s))
  check('scoring is not negative', s >= 0, `got ${s}`)
  check('scoring the same hand twice agrees', scoreHand(g.players[0]) === s)
}

console.log(failures === 0 ? '\nPASS — magii engine oracle clean' : `\nFAIL — ${failures} assertion(s)`)
process.exit(failures === 0 ? 0 : 1)
