// Magii Card Game — NPC AI (draw/discard rummy)
// Two decisions per turn: what to draw, what to discard

import { Card } from './data'
import { GameState, Player, getAvailableDiscardPiles, canCallMagii, findBestSets } from './engine'

// How valuable is this card to the current hand?
function scoreCardFit(card: Card, hand: Card[]): number {
  let score = 0
  for (const c of hand) {
    // Identical card (same element + rune + spirit) = triad progress
    if (c.element === card.element && c.rune === card.rune && c.spirit === card.spirit) {
      score += 20
    }
    // Same category (same element + rune, different spirit) = spectrum progress
    else if (c.element === card.element && c.rune === card.rune) {
      score += 10
    }
  }
  return score
}

// Find the weakest card in hand (lowest contribution)
function findWeakestIdx(hand: Card[]): number {
  let worstIdx = 0, worstScore = Infinity
  for (let i = 0; i < hand.length; i++) {
    const others = hand.filter((_, j) => j !== i)
    const score = scoreCardFit(hand[i], others)
    if (score < worstScore) { worstScore = score; worstIdx = i }
  }
  return worstIdx
}

export interface NPCDrawAction {
  type: 'draw-deck' | 'draw-discard'
  targetId?: number
}

export interface NPCDiscardAction {
  cardIdx: number
}

// Decide where to draw from
export function chooseDrawAction(
  playerId: number,
  state: GameState,
  difficulty: number,
): NPCDrawAction {
  const player = state.players[playerId]

  // Random chance for easy NPC to just draw from deck
  if (difficulty === 0 && Math.random() < 0.3) {
    return { type: 'draw-deck' }
  }

  // Check discard piles for useful cards
  const available = getAvailableDiscardPiles(state, playerId)
  if (available.length > 0) {
    let bestPile = -1, bestFit = -1
    for (const targetId of available) {
      const top = state.players[targetId].discardPile
      const card = top[top.length - 1]
      const fit = scoreCardFit(card, player.hand)
      if (fit > bestFit) { bestFit = fit; bestPile = targetId }
    }
    // Take from discard if the card is actually useful
    const threshold = difficulty === 0 ? 15 : difficulty === 1 ? 8 : 5
    if (bestFit >= threshold) {
      return { type: 'draw-discard', targetId: bestPile }
    }
  }

  return { type: 'draw-deck' }
}

// Decide which card to discard (hand has 9 cards)
export function chooseDiscardAction(
  playerId: number,
  state: GameState,
  difficulty: number,
): NPCDiscardAction {
  const hand = state.players[playerId].hand
  // Don't discard a card we just drew if it's good
  const worstIdx = findWeakestIdx(hand)

  // Easy NPC sometimes discards suboptimally
  if (difficulty === 0 && Math.random() < 0.15) {
    const randomIdx = Math.floor(Math.random() * hand.length)
    return { cardIdx: randomIdx }
  }

  return { cardIdx: worstIdx }
}

// Should NPC call Magii, or push a valid hand for a higher score?
// Min valid hand = 75 (3 spectrums), max = 120 (3 triads). The deeper NPCs
// gamble on breaking a spectrum to chase a triad while the deck is still healthy.
export function shouldCallMagii(player: Player, difficulty: number, state: GameState): boolean {
  if (!canCallMagii(player)) return false

  const sets = findBestSets(player.hand)!
  const score = sets.reduce((sum, s) => sum + s.points, 0)
  const triads = sets.filter(s => s.type === 'triad').length
  const deckLeft = state.deck.length

  // Deck almost gone — a forced empty-deck end scores partial hands. Bank it now.
  if (deckLeft <= 8) return true
  // Already maxed (3 triads) — nothing to push for.
  if (triads === 3) return true

  // Cautious: bird in hand, always bank a valid hand.
  if (difficulty === 0) return true

  // Balanced: lock strong hands; push weak (all-spectrum) hands only early.
  if (difficulty === 1) {
    if (score >= 90) return true
    return deckLeft < 20
  }

  // Sharp: push hardest, and a doubled stake makes the upside worth more risk.
  const pushUntil = player.doubled ? 105 : 90
  if (score >= pushUntil) return true
  return deckLeft < 14
}

export function decideDoubleDown(player: Player, difficulty: number): boolean {
  // Analyze starting hand for set potential
  const combos: Record<string, number> = {}
  for (const c of player.hand) {
    const key = `${c.element}-${c.rune}-${c.spirit}`
    combos[key] = (combos[key] || 0) + 1
  }
  const maxCombo = Math.max(0, ...Object.values(combos))

  // Category analysis
  const categories: Record<string, Set<string>> = {}
  for (const c of player.hand) {
    const catKey = `${c.element}-${c.rune}`
    if (!categories[catKey]) categories[catKey] = new Set()
    categories[catKey].add(c.spirit)
  }
  const maxCategory = Math.max(0, ...Object.values(categories).map(s => s.size))

  const strength = maxCombo * 12 + maxCategory * 6
  const threshold = difficulty === 0 ? 30 : difficulty === 1 ? 24 : 18
  return strength >= threshold
}

export function getNPCDifficulty(playerId: number): number {
  return playerId - 1  // 0=cautious, 1=balanced, 2=sharp
}
