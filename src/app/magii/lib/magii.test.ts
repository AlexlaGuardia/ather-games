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
import {
  initGame, drawFromDeck, discardCard, startPlaying, scoreHand, applySeats, soloSeats,
  NPC_NAMES, type GameState, type SeatSpec,
} from './engine'
import { getNPCDifficulty } from './npc'
import { replay, reduceMove, tableSeats, type StampedMove, type SeatInfo } from './table'

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

// ── seating ───────────────────────────────────────────────────────────────────
//
// The netplay-bearing property here is the NEGATIVE one: seating must have no effect on the
// deal. Four clients each label the chairs from their own point of view — everyone calls
// their own seat "You" — so if a name could reach the shuffle, every player would be holding
// a different hand while believing they shared a table.
console.log('seating')
{
  const roster: SeatSpec[] = [
    { name: 'Ana', isHuman: true },
    { name: 'Bo', isHuman: true },
    { name: 'Renna', isHuman: false },
    { name: 'Dorik', isHuman: false },
  ]
  const seated = initGame(TAVERN_STANDARD, 'SEATS', roster)
  check('the roster is seated in order', seated.players.map(p => p.name).join() === 'Ana,Bo,Renna,Dorik')
  check('people and regulars are distinguished', seated.players.map(p => p.isHuman).join() === 'true,true,false,false')

  const mine = initGame(TAVERN_STANDARD, 'SEATS', [{ name: 'You', isHuman: true }, ...roster.slice(1)])
  check('★ what the chairs are called cannot change the deal',
    tableFingerprint(seated) === tableFingerprint(mine))
  check('and neither can who is a person',
    tableFingerprint(initGame(TAVERN_STANDARD, 'SEATS', roster.map(s => ({ ...s, isHuman: !s.isHuman })))) === tableFingerprint(seated))
  check('an unseated call still deals the solo table', initGame(TAVERN_STANDARD, 'SEATS').players[0].name === 'You')
  check('the default table is you and the three regulars',
    soloSeats().map(s => s.name).join() === ['You', ...NPC_NAMES].join())

  // Re-labelling is how a drop or a join is handled mid-hand: the hand belongs to the SEAT,
  // so not one card may move.
  const played = discardCard(drawFromDeck(startPlaying(seated), 0), 0, 2)
  const relabelled = applySeats(played, [
    { name: 'You', isHuman: true }, { name: 'Renna', isHuman: false },
    { name: 'Dorik', isHuman: false }, { name: 'Cyd', isHuman: true },
  ])
  check('re-seating renames the chairs', relabelled.players.map(p => p.name).join() === 'You,Renna,Dorik,Cyd')
  check('★ re-seating does not move a single card', tableFingerprint(relabelled) === tableFingerprint(played))
  check('re-seating keeps the discards', relabelled.players[0].discardPile.length === played.players[0].discardPile.length)
  check('a dropped player becomes a regular', relabelled.players[1].isHuman === false)
  check('re-seating does not mutate its input', played.players[1].name === 'Bo')
  check('re-seating twice is the same as once',
    JSON.stringify(applySeats(relabelled, soloSeats())) === JSON.stringify(applySeats(applySeats(played, soloSeats()), soloSeats())))

  // Seat 0 can be a regular now (the first player to sit left), and difficulty is indexed off
  // the seat — unclamped that asked for −1, which no branch handles, so the abandoned chair
  // would have played as the SHARPEST opponent at the table.
  check('every seat maps to a real difficulty',
    [0, 1, 2, 3].every(i => [0, 1, 2].includes(getNPCDifficulty(i))),
    String([0, 1, 2, 3].map(getNPCDifficulty)))
  check('the regulars keep their solo difficulties', [1, 2, 3].map(getNPCDifficulty).join() === '0,1,2')
}

// ── the table's seat map ──────────────────────────────────────────────────────
console.log('the table seat map')
{
  const r = (occ: boolean[], names: string[] = []): SeatInfo[] =>
    occ.map((o, i) => ({ seat: i, name: names[i] ?? `P${i}`, occupied: o, trusted: true }))

  const two = r([true, true, false, false], ['Ana', 'Bo'])
  const asAna = tableSeats(two, 0)
  const asBo = tableSeats(two, 1)
  check('you are always "You" to yourself', asAna[0].name === 'You' && asBo[1].name === 'You')
  check('and named to everyone else', asAna[1].name === 'Bo' && asBo[0].name === 'Ana')
  // ★ Two people must not disagree about which chair "Renna" is, or they cannot talk about
  // the game they are both looking at.
  check('★ every client agrees which regular holds which chair',
    asAna.slice(2).map(s => s.name).join() === asBo.slice(2).map(s => s.name).join(),
    `${asAna.slice(2).map(s => s.name)} vs ${asBo.slice(2).map(s => s.name)}`)
  check('empty chairs are played by regulars', asAna.slice(2).every(s => !s.isHuman))
  check('the regulars keep the seats they have in solo play',
    asAna[2].name === NPC_NAMES[1] && asAna[3].name === NPC_NAMES[2])

  // Seat 0 empty happens when the host leaves; there is no fourth regular to name (that is a
  // canon call, not a build one), so it borrows a freed name and must not collide.
  const hostGone = tableSeats(r([false, true, false, false], ['', 'Bo']), 1)
  check('an abandoned seat 0 still gets a regular', !hostGone[0].isHuman && hostGone[0].name.length > 0)
  check('and no two chairs share a name', new Set(hostGone.map(s => s.name)).size === 4,
    String(hostGone.map(s => s.name)))
  const onlySeat3 = tableSeats(r([false, false, false, true], ['', '', '', 'Dez']), 3)
  check('the same holds when only the last chair is taken', new Set(onlySeat3.map(s => s.name)).size === 4,
    String(onlySeat3.map(s => s.name)))

  const impostor = tableSeats(r([true, true, false, false], ['Ana', 'You']), 0)
  check('a player calling themselves "You" is disambiguated', impostor[1].name !== 'You', impostor[1].name)
}

// ── replay: what a latecomer runs ─────────────────────────────────────────────
//
// A friend who joins mid-hand is handed (seed, collection, log) and rebuilds the present from
// it. If this ever stops landing where everyone else already is, they sit at a table that
// merely resembles the real one.
console.log('replay from a move log')
{
  const seats = tableSeats(
    [0, 1, 2, 3].map(i => ({ seat: i, name: ['Ana', 'Bo', '', ''][i], occupied: i < 2, trusted: true })),
    0,
  )
  const log: StampedMove[] = [
    { seq: 1, seat: 0, move: { kind: 'draw-deck' } },
    { seq: 2, seat: 0, move: { kind: 'discard', cardIdx: 4 } },
    { seq: 3, seat: 1, move: { kind: 'draw-deck' } },
    { seq: 4, seat: 1, move: { kind: 'discard', cardIdx: 0 } },
    { seq: 5, seat: 2, move: { kind: 'draw-discard', targetId: 1 } },
    { seq: 6, seat: 2, move: { kind: 'discard', cardIdx: 8 } },
  ]
  const live = replay(TAVERN_STANDARD, 'NETPLAY', seats, log)
  const latecomer = replay(TAVERN_STANDARD, 'NETPLAY', seats, log)
  check('★ two machines replaying one log land on the same table',
    tableFingerprint(live) === tableFingerprint(latecomer))
  check('replay agrees on whose turn it is', live.currentPlayer === 3 && latecomer.currentPlayer === 3,
    `${live.currentPlayer}`)
  check('replay reaches the playing phase', live.phase === 'playing')
  check('cards are conserved through a replay',
    new Set([...live.deck, ...live.players.flatMap(p => [...p.hand, ...p.discardPile])].map(c => c.id)).size === 96)
  check('a take from a discard actually took it', live.players[1].discardPile.length === 0)

  // Applying moves one at a time as they arrive — what a client that was present the whole
  // time does — must land exactly where a from-scratch replay lands. This is the assertion
  // that says a latecomer and a veteran are looking at the same table.
  let stepwise = replay(TAVERN_STANDARD, 'NETPLAY', seats, [])
  for (const m of log) stepwise = reduceMove(stepwise, m)
  check('★ move-by-move play and a from-scratch replay agree',
    tableFingerprint(stepwise) === tableFingerprint(live))
  check('and they agree on the turn too',
    stepwise.currentPlayer === live.currentPlayer && stepwise.turn === live.turn)

  // The wire will carry a move from a client this one does not understand yet.
  const withJunk = replay(TAVERN_STANDARD, 'NETPLAY', seats, [
    ...log,
    { seq: 7, seat: 3, move: { kind: 'somersault' } as unknown as StampedMove['move'] },
  ])
  check('an unknown move is skipped, not fatal', tableFingerprint(withJunk) === tableFingerprint(live))

  check('a different seed replays a different table',
    tableFingerprint(replay(TAVERN_STANDARD, 'OTHERSEED', seats, log)) !== tableFingerprint(live))
  check('a different collection replays a different table',
    tableFingerprint(replay(WILDWOOD, 'NETPLAY', seats, log)) !== tableFingerprint(live))
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
