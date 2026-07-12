// Magii Card Game — Engine (Hotpot-style draw/discard rummy)
// Draw 1 card → have 9 → call Magii or discard 1 → back to 8

import { Card, buildDeck, Collection, TAVERN_STANDARD } from './data'

export interface Player {
  name: string
  hand: Card[]         // 8 cards (9 after drawing, before discarding)
  discardPile: Card[]
  isHuman: boolean
  doubled: boolean
}

export interface ValidSet {
  type: 'triad' | 'spectrum'
  cards: [Card, Card, Card]
  points: number
}

export type Phase = 'double-down' | 'playing' | 'game-over'
export type TurnPhase = 'draw' | 'discard'

export interface GameState {
  deck: Card[]
  players: Player[]
  currentPlayer: number
  phase: Phase
  turnPhase: TurnPhase
  turn: number
  winner: number | null
  calledBy: number | null   // who validly called Magii to end the race (null = deck ran out)
  scores: number[]
  log: string[]
}

const NPC_NAMES = ['Renna', 'Dorik', 'Sable']

export function initGame(collection: Collection = TAVERN_STANDARD): GameState {
  const deck = buildDeck(collection)
  const players: Player[] = [
    { name: 'You', hand: [], discardPile: [], isHuman: true, doubled: false },
    ...NPC_NAMES.map(name => ({
      name, hand: [] as Card[], discardPile: [] as Card[], isHuman: false, doubled: false,
    })),
  ]
  // Deal 8 cards to each player (32 of 96)
  let d = [...deck]
  for (const p of players) {
    p.hand = d.splice(0, 8)
  }
  return {
    deck: d,
    players,
    currentPlayer: 0,
    phase: 'double-down',
    turnPhase: 'draw',
    turn: 1,
    winner: null,
    calledBy: null,
    scores: [0, 0, 0, 0],
    log: ['The cards are dealt.'],
  }
}

export function setDoubleDown(state: GameState, playerId: number, doubled: boolean): GameState {
  const next = structuredClone(state)
  next.players[playerId].doubled = doubled
  return next
}

export function startPlaying(state: GameState): GameState {
  const next = structuredClone(state)
  next.phase = 'playing'
  next.currentPlayer = 0
  next.turnPhase = 'draw'
  next.log = [...next.log, 'The game begins.']
  return next
}

// Draw from the deck (blind draw)
export function drawFromDeck(state: GameState, playerId: number): GameState {
  if (state.deck.length === 0) return state
  const next = structuredClone(state)
  const card = next.deck.shift()!
  next.players[playerId].hand.push(card)
  next.turnPhase = 'discard'
  const name = next.players[playerId].name
  next.log = [...next.log, `${name === 'You' ? 'You draw' : `${name} draws`} from the deck.`]
  return next
}

// Draw from an opponent's discard pile (not your own)
export function drawFromDiscard(state: GameState, playerId: number, targetId: number): GameState {
  if (targetId === playerId) return state
  const target = state.players[targetId]
  if (target.discardPile.length === 0) return state
  const next = structuredClone(state)
  const card = next.players[targetId].discardPile.pop()!
  next.players[playerId].hand.push(card)
  next.turnPhase = 'discard'
  const name = next.players[playerId].name
  next.log = [...next.log, `${name === 'You' ? 'You take' : `${name} takes`} from ${next.players[targetId].name}'s discard.`]
  return next
}

// Discard a card from hand (must have 9 cards → back to 8)
export function discardCard(state: GameState, playerId: number, cardIdx: number): GameState {
  const player = state.players[playerId]
  if (player.hand.length !== 9 || cardIdx < 0 || cardIdx >= 9) return state
  const next = structuredClone(state)
  const [card] = next.players[playerId].hand.splice(cardIdx, 1)
  next.players[playerId].discardPile.push(card)
  // Advance turn
  next.currentPlayer = (next.currentPlayer + 1) % 4
  if (next.currentPlayer === 0) next.turn++
  next.turnPhase = 'draw'
  // Check deck empty
  if (next.deck.length === 0) {
    return endGame(next, null)
  }
  return next
}

// Call Magii — player must have 9 cards and valid 3×3 sets
export function callMagii(state: GameState, playerId: number): GameState {
  const player = state.players[playerId]
  if (player.hand.length !== 9) return state
  const sets = findBestSets(player.hand)
  if (!sets || sets.length < 3) {
    // False call — penalty
    const next = structuredClone(state)
    next.scores[playerId] = -50
    next.log = [...next.log, `${player.name} calls Magii on an incomplete hand. −50 penalty!`]
    return endGame(next, playerId === 0 ? findHighestNPC(next) : 0, false)
  }
  return endGame(state, playerId)
}

export function canCallMagii(player: Player): boolean {
  if (player.hand.length !== 9) return false
  return findBestSets(player.hand) !== null
}

function findHighestNPC(state: GameState): number {
  let best = 1, bestScore = -Infinity
  for (let i = 1; i < 4; i++) {
    const s = scoreHand(state.players[i])
    if (s > bestScore) { bestScore = s; best = i }
  }
  return best
}

// callerId !== null → that player ends the round (race winner, or false-call substitute).
// callerId === null → deck ran out, so the highest score wins instead.
function endGame(state: GameState, callerId: number | null, announceCall = true): GameState {
  const next = structuredClone(state)
  next.phase = 'game-over'
  for (let i = 0; i < 4; i++) {
    if (next.scores[i] === -50) continue
    const score = scoreHand(next.players[i])
    next.scores[i] = next.players[i].doubled ? score * 2 : score
  }

  let winnerId: number
  if (callerId !== null) {
    // Race: the caller takes the round regardless of others' point totals.
    winnerId = callerId
  } else {
    // Deck empty: most points wins.
    winnerId = 0
    let highScore = -Infinity
    for (let i = 0; i < 4; i++) {
      if (next.scores[i] > highScore) { highScore = next.scores[i]; winnerId = i }
    }
  }
  next.winner = winnerId
  next.calledBy = announceCall && callerId !== null ? callerId : null

  if (callerId !== null && announceCall) {
    const cName = next.players[callerId].name
    next.log = [...next.log, `${cName === 'You' ? 'You call' : `${cName} calls`} Magii and take the round!`]
  } else if (callerId === null) {
    next.log = [...next.log, 'The deck is empty. Most points wins.']
  }
  next.log = [...next.log, `${next.players[winnerId].name} wins with ${next.scores[winnerId]} points!`]
  return next
}

// --- Set Validation ---

function isTriad(a: Card, b: Card, c: Card): boolean {
  return a.element === b.element && b.element === c.element &&
         a.rune === b.rune && b.rune === c.rune &&
         a.spirit === b.spirit && b.spirit === c.spirit
}

function isSpectrum(a: Card, b: Card, c: Card): boolean {
  // Same rune (same category), all different spirits
  if (a.rune !== b.rune || b.rune !== c.rune) return false
  if (a.element !== b.element || b.element !== c.element) return false
  return a.spirit !== b.spirit && b.spirit !== c.spirit && a.spirit !== c.spirit
}

function classifySet(a: Card, b: Card, c: Card): ValidSet | null {
  if (isTriad(a, b, c)) return { type: 'triad', cards: [a, b, c], points: 40 }
  if (isSpectrum(a, b, c)) return { type: 'spectrum', cards: [a, b, c], points: 25 }
  return null
}

// Find best partition of 9 cards into 3 valid sets
export function findBestSets(cards: Card[]): ValidSet[] | null {
  if (cards.length !== 9) return null
  let bestSets: ValidSet[] | null = null
  let bestScore = -1
  const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8]

  for (let i = 0; i < 7; i++) {
    for (let j = i + 1; j < 8; j++) {
      for (let k = j + 1; k < 9; k++) {
        const set1 = classifySet(cards[i], cards[j], cards[k])
        if (!set1) continue
        const remaining = indices.filter(x => x !== i && x !== j && x !== k)
        for (let a = 0; a < 4; a++) {
          for (let b = a + 1; b < 5; b++) {
            for (let c = b + 1; c < 6; c++) {
              const set2 = classifySet(
                cards[remaining[a]], cards[remaining[b]], cards[remaining[c]]
              )
              if (!set2) continue
              const rest = [0, 1, 2, 3, 4, 5].filter(x => x !== a && x !== b && x !== c)
              const set3 = classifySet(
                cards[remaining[rest[0]]], cards[remaining[rest[1]]], cards[remaining[rest[2]]]
              )
              if (!set3) continue
              const total = set1.points + set2.points + set3.points
              if (total > bestScore) { bestScore = total; bestSets = [set1, set2, set3] }
            }
          }
        }
      }
    }
  }
  return bestSets
}

export function scoreHand(player: Player): number {
  // Try full 9-card scoring first (if still holding 9)
  if (player.hand.length === 9) {
    const sets = findBestSets(player.hand)
    if (sets) return sets.reduce((sum, s) => sum + s.points, 0)
  }
  // Partial scoring for 8-card hands (game ended by deck empty)
  return countPartialScore(player.hand)
}

function countPartialScore(cards: Card[]): number {
  let score = 0
  const used = new Set<number>()
  for (let i = 0; i < cards.length - 2; i++) {
    if (used.has(i)) continue
    for (let j = i + 1; j < cards.length - 1; j++) {
      if (used.has(j)) continue
      for (let k = j + 1; k < cards.length; k++) {
        if (used.has(k)) continue
        const set = classifySet(cards[i], cards[j], cards[k])
        if (set) {
          score += set.points
          used.add(i); used.add(j); used.add(k)
          break
        }
      }
      if (used.has(j)) break
    }
  }
  return score
}

export function getAvailableDiscardPiles(state: GameState, playerId: number): number[] {
  return state.players
    .map((p, i) => ({ i, len: p.discardPile.length }))
    .filter(x => x.i !== playerId && x.len > 0)
    .map(x => x.i)
}
