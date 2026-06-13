// Battle AI — opponent move selection across 3 difficulty tiers
// Canon: shimmer-battles.md Section 8 — wild/trained/champion
// Pure functions — no side effects, returns move index
//
// Wild:     HP-scaled flee, STAB-weighted random picks
// Trained:  Type-aware, HP-aware buff timing, anti-overkill, status awareness
// Champion: Combo synergy, heal-vs-attack, HP differential aggression, PP conservation

import type { BattleState, BattleCombatant, PlayerAction } from './battle'
import { getEffectiveStat } from './battle'
import type { Move, CombatStat } from './moves'
import { getEffectiveness, hasSTAB } from './moves'

export type AITier = 'wild' | 'trained' | 'champion'

// ============================================
// Helpers
// ============================================

function hpPct(c: BattleCombatant): number {
  return c.hp / c.maxHp
}

/** Estimate raw damage for a move (no random, no crit) */
function estimateDamage(attacker: BattleCombatant, defender: BattleCombatant, move: Move): number {
  if (move.power === 0) return 0
  const pwr = getEffectiveStat(attacker, 'pwr')
  const grd = getEffectiveStat(defender, 'grd')
  const base = ((pwr * move.power) / ((grd + 20) * 2.5)) + 2
  const eff = getEffectiveness(move.element, defender.element)
  const stab = hasSTAB(attacker.element, move.element) ? 1.25 : 1.0
  return base * eff * stab
}

/** Check if attacker already has a positive stage in a stat */
function hasBuffActive(c: BattleCombatant, stat: CombatStat): boolean {
  return c.statStages[stat] > 0
}

/** Check if a move is primarily a healing/sustain move (flow state with selfEffect regen) */
function isHealMove(move: Move): boolean {
  return move.selfEffect === 'regen' && (move.selfEffectChance ?? 0) >= 50
}

// ============================================
// AI Entry Point
// ============================================

/** AI selects an action for the enemy combatant */
export function aiSelectAction(state: BattleState, tier: AITier): PlayerAction {
  const enemy = state.enemy
  const availableMoves = enemy.moves
    .map((slot, i) => ({ slot, index: i }))
    .filter(m => m.slot.ppLeft > 0)

  // No PP left — engine will use Struggle
  if (availableMoves.length === 0) {
    return { type: 'fight', moveIndex: 0 }
  }

  // === WILD TIER ===
  // HP-scaled flee + STAB-weighted random
  if (tier === 'wild') {
    return wildAction(enemy, availableMoves)
  }

  // === TRAINED / CHAMPION ===
  // Score each move with full context
  const scored = availableMoves.map(m => ({
    index: m.index,
    score: scoreMove(enemy, state.player, m.slot.move, m.slot.ppLeft, tier, state),
  }))

  scored.sort((a, b) => b.score - a.score)

  // Champion: small chance to pick 2nd-best move (unpredictability)
  if (tier === 'champion' && scored.length > 1 && Math.random() < 0.12) {
    return { type: 'fight', moveIndex: scored[1].index }
  }

  return { type: 'fight', moveIndex: scored[0].index }
}

// ============================================
// Wild Tier
// ============================================

function wildAction(
  enemy: BattleCombatant,
  moves: { slot: { move: Move; ppLeft: number }; index: number }[],
): PlayerAction {
  // HP-scaled flee: 10% at full HP → 50% near death
  const fleeChance = 0.1 + 0.4 * (1 - hpPct(enemy))
  if (Math.random() < fleeChance) return { type: 'flee' }

  // STAB-weighted random pick (STAB moves get 2x weight)
  const weighted = moves.map(m => ({
    index: m.index,
    weight: hasSTAB(enemy.element, m.slot.move.element) ? 2 : 1,
  }))
  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0)
  let roll = Math.random() * totalWeight
  for (const w of weighted) {
    roll -= w.weight
    if (roll <= 0) return { type: 'fight', moveIndex: w.index }
  }
  return { type: 'fight', moveIndex: weighted[0].index }
}

// ============================================
// Trained / Champion Scoring
// ============================================

function scoreMove(
  attacker: BattleCombatant,
  defender: BattleCombatant,
  move: Move,
  ppLeft: number,
  tier: AITier,
  state: BattleState,
): number {
  let score = 0
  const aHp = hpPct(attacker)
  const dHp = hpPct(defender)
  const isChampion = tier === 'champion'

  // ── Damage Moves ──
  if (move.power > 0) {
    score = estimateDamage(attacker, defender, move)

    // Kill-range bonus (both tiers)
    if (score >= defender.hp) {
      score *= 1.5
    }

    // Anti-overkill: don't waste big moves on low HP targets
    if (score > defender.hp * 1.5) {
      score *= 0.6
    }

    // Crystallize vulnerability: hit harder when defender is crystallized
    if (defender.status === 'crystallize') {
      score *= 1.2
    }

    // Champion: combo off anchor (trapped target = guaranteed hits)
    if (isChampion && defender.status === 'anchor') {
      score *= 1.4
    }

    // Champion: HP differential aggression
    if (isChampion) {
      if (aHp > dHp + 0.3) score *= 1.3  // winning → push harder
      if (aHp < dHp - 0.3) score *= 0.85 // losing → consider defense instead
    }

    // Champion: PP conservation (don't burn low-PP moves on non-kills)
    if (isChampion && ppLeft <= 3 && score < defender.hp) {
      score *= 0.6
    }

    // Factor in secondary effects on damage moves
    if (move.effect && move.effectChance) {
      // Bonus for damage moves that also inflict status
      const statusValue = defender.status ? 0 : (move.effectChance / 100) * 15
      score += statusValue
    }

  // ── Status / Buff Moves ──
  } else {
    score = scoreStatusMove(attacker, defender, move, tier)
  }

  // Small random jitter (prevents perfectly predictable patterns)
  score += Math.random() * 3

  return score
}

/** Score a non-damage move (buffs, debuffs, status, heals) */
function scoreStatusMove(
  attacker: BattleCombatant,
  defender: BattleCombatant,
  move: Move,
  tier: AITier,
): number {
  let score = 0
  const aHp = hpPct(attacker)
  const isChampion = tier === 'champion'

  // ── Heal / Regen Moves ──
  if (isHealMove(move)) {
    if (aHp < 0.4) {
      // Low HP: healing is very valuable
      score += 50 + (1 - aHp) * 40 // 50-90 score at low HP
    } else if (aHp < 0.7) {
      score += 25 // moderate value at mid HP
    } else {
      score += 5  // low value when healthy
    }

    // Champion: smarter heal timing
    if (isChampion) {
      if (aHp < 0.3) score *= 1.5    // critical: definitely heal
      if (aHp > 0.7) score *= 0.3    // healthy: don't waste turns
      // If attacker already has regen, don't stack it
      if (attacker.status === 'regen') score *= 0.2
    }

    return score
  }

  // ── Stat Change Moves ──
  if (move.statChanges) {
    for (const sc of move.statChanges) {
      if (sc.target === 'self') {
        // Buff self — valuable when healthy (time to capitalize)
        let buffVal = sc.stages * 15 * aHp

        // Don't stack buffs already active
        if (hasBuffActive(attacker, sc.stat)) {
          buffVal *= 0.4 // diminishing returns
        }

        // At max stages, worthless
        if (attacker.statStages[sc.stat] >= 3) {
          buffVal = 0
        }

        score += buffVal
      } else {
        // Debuff foe — always somewhat useful
        let debuffVal = Math.abs(sc.stages) * 12

        // Less useful if stat already tanked
        if (defender.statStages[sc.stat] <= -2) {
          debuffVal *= 0.3
        }

        score += debuffVal
      }
    }

    // Trained: buff early, attack late
    if (aHp > 0.7) score *= 1.3
    else if (aHp < 0.3) score *= 0.4

    // Champion: even more disciplined timing
    if (isChampion) {
      if (aHp > 0.7) score *= 1.4
      else score *= 0.5
    }
  }

  // ── Status Infliction ──
  if (move.effect && move.effectChance) {
    if (defender.status) {
      // Defender already has a status — don't bother
      score += 2
    } else {
      let statusVal = (move.effectChance / 100) * 25

      // Champion: value control statuses more
      if (isChampion) {
        if (move.effect === 'anchor') statusVal *= 1.5  // trap → combo setup
        if (move.effect === 'ignition') statusVal *= 1.3 // DoT = free damage
        if (move.effect === 'erosion') statusVal *= 1.2  // stat drain over time
      }

      score += statusVal
    }
  }

  return score
}
