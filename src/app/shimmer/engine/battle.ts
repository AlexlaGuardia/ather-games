// Battle engine — pure state machine for spirit-vs-spirit combat
// Canon: shimmer-battles.md — energy clashes, not physical fights
// Engine emits events; renderer subscribes and plays animations (Phase 9B)
// Pattern: same as skills.ts, harvesting.ts — pure functions, mutate in-place

import type { Spirit, Species, Element } from '../spirits/spirit'
import { formStage } from '../spirits/spirit'
import { ELEMENT_STAT_MODS } from '../spirits/evolution-config'
import type { Move, BattleElement, CombatStat, StatusId } from './moves'
import { getEffectiveness, effectivenessLabel, hasSTAB, toBattleElement, getMovesForSpirit, MOVE_STILL_BREATH } from './moves'
import { applyPassiveHeldItem, checkBerryTrigger, checkStatusCureTrigger, getCharmSTABBonus, getCharmEndureBoost, getCharmAccuracyBonus } from './held-items'

// ============================================
// Combat Stats
// ============================================

export interface CombatStats {
  pwr: number   // Power — damage dealt
  grd: number   // Guard — damage reduced
  agi: number   // Agility — turn order + dodge
  vig: number   // Vigor — HP pool
}

// Species base stats (sum ~150 each, identity-defining)
const SPECIES_STATS: Record<Species, CombatStats> = {
  fox:          { pwr: 40, grd: 30, agi: 45, vig: 35 },
  axolotl:      { pwr: 25, grd: 35, agi: 30, vig: 50 },
  owl:          { pwr: 45, grd: 35, agi: 35, vig: 35 },
  frog:         { pwr: 35, grd: 25, agi: 50, vig: 30 },
  firefly:      { pwr: 50, grd: 20, agi: 40, vig: 30 },
  rabbit:       { pwr: 30, grd: 30, agi: 45, vig: 40 },
  'water-bear': { pwr: 20, grd: 50, agi: 15, vig: 50 },
  hummingbird:  { pwr: 45, grd: 20, agi: 50, vig: 25 },
  turtle:       { pwr: 30, grd: 50, agi: 10, vig: 45 },
  bat:          { pwr: 40, grd: 25, agi: 45, vig: 35 },
}

// Temperament modifiers: [pwr, grd, agi, vig] multipliers
const TEMPERAMENT_MODS: Record<string, [number, number, number, number]> = {
  bold:    [1.1, 0.95, 0.95, 1.0],
  calm:    [0.95, 1.05, 0.95, 1.05],
  swift:   [0.95, 0.9, 1.15, 1.0],
  sturdy:  [0.95, 1.15, 0.9, 1.0],
  bright:  [1.05, 1.0, 1.05, 0.9],
  neutral: [1.0, 1.0, 1.0, 1.0],
}

// Stat caps by form stage
const STAT_CAPS: Record<string, number> = { base: 50, second: 75, awakened: 100 }

/** Derive combat stats from a Spirit. Called once at battle start. */
export function deriveCombatStats(spirit: Spirit): CombatStats {
  const base = SPECIES_STATS[spirit.species]
  const stage = formStage(spirit.level)
  const cap = STAT_CAPS[stage]
  const mods = TEMPERAMENT_MODS[spirit.temperament] ?? TEMPERAMENT_MODS.neutral

  // seeds[0-3] map to pwr/grd/agi/vig (0-31 each)
  const seeds = spirit.seeds
  const stats: [CombatStat, number, number, number][] = [
    ['pwr', base.pwr, seeds[0] ?? 0, mods[0]],
    ['grd', base.grd, seeds[1] ?? 0, mods[1]],
    ['agi', base.agi, seeds[2] ?? 0, mods[2]],
    ['vig', base.vig, seeds[3] ?? 0, mods[3]],
  ]

  // Element evolution stat modifiers (applied when spirit has evolved element)
  const elMods = spirit.element !== 'base' ? ELEMENT_STAT_MODS[spirit.element] : []

  const result: CombatStats = { pwr: 0, grd: 0, agi: 0, vig: 0 }
  for (const [stat, baseStat, seed, mod] of stats) {
    // Scale with level, add seed bonus, apply temperament
    const scaled = baseStat * (1 + spirit.level / 50) + seed * spirit.level / 100
    let val = scaled * mod
    // Apply element evolution bonus
    const elMod = elMods.find(m => m.stat === stat)
    if (elMod) val *= elMod.mod
    result[stat] = Math.min(cap, Math.round(val))
  }
  return result
}

/** HP from vigor stat */
export function maxHP(vig: number): number {
  return vig * 2 + 20
}

// ============================================
// Stat Stages
// ============================================

// Index 0 = -4, index 4 = 0, index 8 = +4
const STAGE_MULTIPLIERS = [0.33, 0.5, 0.66, 0.8, 1.0, 1.25, 1.5, 2.0, 3.0]

export function stageMultiplier(stage: number): number {
  return STAGE_MULTIPLIERS[Math.max(0, Math.min(8, stage + 4))]
}

// ============================================
// Battle Events (consumed by renderer)
// ============================================

export type BattleEvent =
  | { type: 'BATTLE_START'; playerSpecies: Species; enemySpecies: Species }
  | { type: 'MOVE_ANNOUNCE'; attacker: 'player' | 'enemy'; moveName: string; spiritName: string }
  | { type: 'DAMAGE'; target: 'player' | 'enemy'; amount: number; effective: 'super' | 'neutral' | 'weak'; crit: boolean }
  | { type: 'MISS'; attacker: 'player' | 'enemy' }
  | { type: 'STAT_CHANGE'; target: 'player' | 'enemy'; stat: CombatStat; stages: number }
  | { type: 'STATUS_INFLICT'; target: 'player' | 'enemy'; status: StatusId }
  | { type: 'STATUS_TICK'; target: 'player' | 'enemy'; status: StatusId; damage?: number }
  | { type: 'ENDURE'; target: 'player' | 'enemy' }
  | { type: 'KO'; target: 'player' | 'enemy' }
  | { type: 'REACH'; reach: number; reachMax: number; delta: number }  // Reach-encounter: progress toward freeing the collar
  | { type: 'COLLAR_BREAK' }                                            // the collar snaps — the spirit chooses again
  | { type: 'BATTLE_END'; outcome: 'win' | 'lose' | 'flee' }
  | { type: 'HELD_ITEM_TRIGGER'; target: 'player' | 'enemy'; itemName: string; effect: string }
  | { type: 'TEXT'; message: string }

// ============================================
// Battle State
// ============================================

export interface BattleCombatant {
  spirit: Spirit
  stats: CombatStats
  hp: number
  maxHp: number
  element: BattleElement
  moves: { move: Move; ppLeft: number }[]
  statStages: Record<CombatStat, number>
  status: StatusId | null
  statusTurns: number
  enduredThisBattle: boolean
  heldItem?: string
  heldItemConsumed?: boolean
  // Reach-encounter (collared spirit only): you free it by REACHING it, not KO'ing it.
  collared?: boolean
  reach?: number
  reachMax?: number
}

export type BattlePhase =
  | 'intro'
  | 'select_action'
  | 'resolve'
  | 'execute_first'
  | 'execute_second'
  | 'end_of_turn'
  | 'battle_end'

export type PlayerAction =
  | { type: 'fight'; moveIndex: number }
  | { type: 'flee' }

export interface BattleState {
  player: BattleCombatant
  enemy: BattleCombatant
  phase: BattlePhase
  turn: number
  events: BattleEvent[]
  outcome: 'pending' | 'win' | 'lose' | 'flee'
  playerAction: PlayerAction | null
  enemyAction: PlayerAction | null
  firstAttacker: 'player' | 'enemy' | null
  // Reach-encounter: mode flag + how it resolved. 'freed' = collar broken (win); 'forced' = brute-KO'd
  // the collared spirit (the cruelty, a soft fail); 'fainted' = your spirit retreated (standard loss).
  mode?: 'standard' | 'reach'
  reachResult?: 'freed' | 'forced' | 'fainted' | null
}

// ============================================
// Battle Setup
// ============================================

export function createCombatant(spirit: Spirit): BattleCombatant {
  const rawStats = deriveCombatStats(spirit)
  const stats = applyPassiveHeldItem(rawStats, spirit.heldItem)
  const hp = maxHP(stats.vig)
  const moves = getMovesForSpirit(spirit.species, spirit.element, spirit.level, spirit.bond)
  return {
    spirit,
    stats,
    hp,
    maxHp: hp,
    element: toBattleElement(spirit.element),
    moves: moves.map(m => ({ move: m, ppLeft: m.pp })),
    statStages: { pwr: 0, grd: 0, agi: 0, vig: 0 },
    status: null,
    statusTurns: 0,
    enduredThisBattle: false,
    heldItem: spirit.heldItem,
    heldItemConsumed: false,
  }
}

/** Create a new battle between two spirits */
export function createBattle(playerSpirit: Spirit, enemySpirit: Spirit): BattleState {
  const state: BattleState = {
    player: createCombatant(playerSpirit),
    enemy: createCombatant(enemySpirit),
    phase: 'intro',
    turn: 0,
    events: [],
    outcome: 'pending',
    playerAction: null,
    enemyAction: null,
    firstAttacker: null,
  }
  state.events.push({
    type: 'BATTLE_START',
    playerSpecies: playerSpirit.species,
    enemySpecies: enemySpirit.species,
  })
  state.phase = 'select_action'
  return state
}

// ============================================
// Reach Encounter (free a collared spirit) — tuning knobs
// ============================================
// The lesson made mechanical: you free a collared spirit by REACHING the one underneath
// (calming/honest moves that grant `reaches`), not by KO'ing it. The collar fights back —
// each turn it yanks the leash and drains some Reach. Brute-KO the collared spirit and you've
// forced it past its retreat (the cruelty) = soft fail. Fill Reach = collar snaps = win.
export const REACH_MAX = 100
export const LEASH_YANK = 9          // Reach drained at end of each turn (the collar resisting)
export const DIM_FACTOR = 0.6        // the collar dims the spirit's power (canon) — also the survivability knob

/** Create a Reach-encounter: the enemy is a collared spirit you free by reaching, not defeating. */
export function createReachBattle(playerSpirit: Spirit, collaredSpirit: Spirit): BattleState {
  const state = createBattle(playerSpirit, collaredSpirit)
  state.mode = 'reach'
  state.reachResult = null
  state.enemy.collared = true
  state.enemy.reach = 0
  state.enemy.reachMax = REACH_MAX
  // Grant Still-Breath for the encounter. It is deliberately absent from the general learnset
  // (a power-0 move sitting in every low-level combat kit diluted fights badly), so reach mode
  // hands it over here. Granting it per-encounter also means it can never rotate out of a kit
  // and leave a player with no honest way to free the spirit in front of them.
  if (!state.player.moves.some(m => m.move.id === MOVE_STILL_BREATH.id)) {
    state.player.moves.push({ move: MOVE_STILL_BREATH, ppLeft: MOVE_STILL_BREATH.pp })
  }
  // The collar DIMS the spirit (canon: grays its light, silences its burst) — so it hits softer.
  // This is also the survivability knob: a dimmer spirit = a more weatherable, reachable fight.
  state.enemy.stats.pwr = Math.round(state.enemy.stats.pwr * DIM_FACTOR)
  return state
}

/** Add Reach to the collared spirit (clamped). Emits a REACH event. Player-only. */
function addReach(state: BattleState, delta: number): void {
  const e = state.enemy
  if (!e.collared) return
  const max = e.reachMax ?? REACH_MAX
  const before = e.reach ?? 0
  e.reach = Math.max(0, Math.min(max, before + delta))
  state.events.push({ type: 'REACH', reach: e.reach, reachMax: max, delta: e.reach - before })
}

// ============================================
// Damage Calculation
// ============================================

export function getEffectiveStat(combatant: BattleCombatant, stat: CombatStat): number {
  return Math.max(1, Math.round(combatant.stats[stat] * stageMultiplier(combatant.statStages[stat])))
}

function isCritical(combatant: BattleCombatant): boolean {
  let chance = 0.0625  // 6.25% base
  if (combatant.spirit.bond > 200) chance += 0.05
  if (combatant.status === 'crystallize') return false  // stress blocks crits (re-using crystallize for simplicity here — stress is hidden)
  return Math.random() < chance
}

function getBondModifier(spirit: Spirit): number {
  if (spirit.happiness > 200) return 1.05
  if (spirit.happiness < 50) return 0.95
  return 1.0
}

/** Calculate damage for a move. Returns 0 for status-only moves. */
export function calcDamage(
  attacker: BattleCombatant,
  defender: BattleCombatant,
  move: Move,
): { damage: number; crit: boolean; effectiveness: number } {
  if (move.power === 0) return { damage: 0, crit: false, effectiveness: 1.0 }

  const pwr = getEffectiveStat(attacker, 'pwr')
  const grd = getEffectiveStat(defender, 'grd')

  // Crystallize: GRD -20%, incoming hit +25%
  const crystalGrd = defender.status === 'crystallize' ? grd * 0.8 : grd
  const crystalBonus = defender.status === 'crystallize' ? 1.25 : 1.0

  // Divisor (2.5) tunes for 4-6 hit kills at L10, scaling naturally with level
  const base = ((pwr * move.power) / ((crystalGrd + 20) * 2.5)) + 2

  const effectiveness = getEffectiveness(move.element, defender.element)
  const stab = hasSTAB(attacker.element, move.element) ? 1.25 + getCharmSTABBonus(attacker.heldItem) : 1.0
  const crit = isCritical(attacker)
  const critMult = crit ? 1.5 : 1.0
  const random = 0.85 + Math.random() * 0.15
  const bondMod = getBondModifier(attacker.spirit)

  const final = Math.max(1, Math.floor(base * effectiveness * stab * critMult * random * bondMod * crystalBonus))
  return { damage: final, crit, effectiveness }
}

// ============================================
// Turn Flow
// ============================================

/** Submit the player's action for this turn */
export function submitPlayerAction(state: BattleState, action: PlayerAction): void {
  state.playerAction = action
}

/** Submit the enemy's action (called by AI) */
export function submitEnemyAction(state: BattleState, action: PlayerAction): void {
  state.enemyAction = action
}

/** Resolve action order: compare AGI + priority. Sets firstAttacker. */
export function resolveActions(state: BattleState): void {
  state.phase = 'resolve'
  state.turn++

  const pAction = state.playerAction
  const eAction = state.enemyAction
  if (!pAction || !eAction) return

  // Flee always resolves first
  if (pAction.type === 'flee') {
    state.firstAttacker = 'player'
    return
  }
  if (eAction.type === 'flee') {
    state.firstAttacker = 'enemy'
    return
  }

  const pPriority = pAction.type === 'fight' ? (state.player.moves[pAction.moveIndex]?.move.priority ?? 0) : 0
  const ePriority = eAction.type === 'fight' ? (state.enemy.moves[eAction.moveIndex]?.move.priority ?? 0) : 0

  if (pPriority !== ePriority) {
    state.firstAttacker = pPriority > ePriority ? 'player' : 'enemy'
    return
  }

  const pAgi = getEffectiveStat(state.player, 'agi')
  const eAgi = getEffectiveStat(state.enemy, 'agi')
  if (pAgi !== eAgi) {
    state.firstAttacker = pAgi > eAgi ? 'player' : 'enemy'
  } else {
    state.firstAttacker = Math.random() < 0.5 ? 'player' : 'enemy'
  }
}

/** Execute one combatant's action. Call for first attacker, then second. */
export function executeAction(state: BattleState, who: 'player' | 'enemy'): void {
  const action = who === 'player' ? state.playerAction : state.enemyAction
  const attacker = who === 'player' ? state.player : state.enemy
  const defender = who === 'player' ? state.enemy : state.player
  const target = who === 'player' ? 'enemy' : 'player'

  if (!action) return

  // Flee attempt
  if (action.type === 'flee') {
    // Anchor prevents fleeing
    if (attacker.status === 'anchor') {
      state.events.push({ type: 'TEXT', message: `${attacker.spirit.name} is anchored and can't flee!` })
      return
    }
    const escapeChance = getEffectiveStat(attacker, 'agi') / (getEffectiveStat(defender, 'agi') + 1)
    if (Math.random() < Math.min(0.9, escapeChance)) {
      state.outcome = 'flee'
      state.phase = 'battle_end'
      state.events.push({ type: 'BATTLE_END', outcome: 'flee' })
      return
    }
    state.events.push({ type: 'TEXT', message: `${attacker.spirit.name} couldn't escape!` })
    return
  }

  // Fight
  if (action.type === 'fight') {
    const moveSlot = attacker.moves[action.moveIndex]
    if (!moveSlot || moveSlot.ppLeft <= 0) {
      // Struggle fallback
      executeStruggle(state, who)
      return
    }

    const move = moveSlot.move
    moveSlot.ppLeft--

    state.events.push({
      type: 'MOVE_ANNOUNCE',
      attacker: who,
      moveName: move.name,
      spiritName: attacker.spirit.name,
    })

    // Accuracy check — anchor locks accuracy to 100% for both sides
    // Focus Charm adds flat accuracy bonus
    const anchorActive = attacker.status === 'anchor' || defender.status === 'anchor'
    const accuracyBonus = getCharmAccuracyBonus(attacker.heldItem)
    if (!anchorActive && Math.random() * 100 >= move.accuracy + accuracyBonus) {
      state.events.push({ type: 'MISS', attacker: who })
      return
    }

    // Damage
    if (move.power > 0) {
      const { damage, crit, effectiveness } = calcDamage(attacker, defender, move)
      applyDamage(state, target as 'player' | 'enemy', damage)
      state.events.push({
        type: 'DAMAGE',
        target: target as 'player' | 'enemy',
        amount: damage,
        effective: effectivenessLabel(effectiveness),
        crit,
      })

      // Clear crystallize on hit
      if (defender.status === 'crystallize') {
        defender.status = null
        defender.statusTurns = 0
      }

      // Check KO
      if (defender.hp <= 0) {
        state.events.push({ type: 'KO', target: target as 'player' | 'enemy' })
        return
      }
    }

    // Stat changes
    if (move.statChanges) {
      for (const sc of move.statChanges) {
        const t = sc.target === 'self' ? who : (target as 'player' | 'enemy')
        applyStatChange(state, t, sc.stat, sc.stages)
      }
    }

    // Status effect on foe
    if (move.effect && move.effectChance) {
      if (Math.random() * 100 < move.effectChance) {
        inflictStatus(state, target as 'player' | 'enemy', move.effect)
        // Vigor Berry: cure status immediately after infliction
        const defCombatant = (target === 'player') ? state.player : state.enemy
        if (defCombatant.status && !defCombatant.heldItemConsumed) {
          const cure = checkStatusCureTrigger(defCombatant.heldItem, !!defCombatant.heldItemConsumed)
          if (cure) {
            defCombatant.heldItemConsumed = true
            defCombatant.status = null
            defCombatant.statusTurns = 0
            state.events.push({ type: 'HELD_ITEM_TRIGGER', target: target as 'player' | 'enemy', itemName: cure.message, effect: 'cure' })
          }
        }
      }
    }

    // Status effect on self (e.g. flow moves granting regen)
    if (move.selfEffect && move.selfEffectChance) {
      if (Math.random() * 100 < move.selfEffectChance) {
        inflictStatus(state, who, move.selfEffect)
      }
    }

    // Reach-encounter: a calming move reaches the spirit under the collar (player-only, honest moves)
    if (state.mode === 'reach' && who === 'player' && move.reaches && state.enemy.collared) {
      addReach(state, move.reaches)
    }
  }
}

function executeStruggle(state: BattleState, who: 'player' | 'enemy'): void {
  const attacker = who === 'player' ? state.player : state.enemy
  const defender = who === 'player' ? state.enemy : state.player
  const target = who === 'player' ? 'enemy' : 'player'

  state.events.push({
    type: 'MOVE_ANNOUNCE', attacker: who,
    moveName: 'Struggle', spiritName: attacker.spirit.name,
  })

  // Struggle: 30 power neutral, 25% recoil
  const baseDmg = ((getEffectiveStat(attacker, 'pwr') * 30) / ((getEffectiveStat(defender, 'grd') + 20) * 2.5)) + 2
  const damage = Math.max(1, Math.floor(baseDmg * (0.85 + Math.random() * 0.15)))
  applyDamage(state, target as 'player' | 'enemy', damage)
  state.events.push({
    type: 'DAMAGE', target: target as 'player' | 'enemy',
    amount: damage, effective: 'neutral', crit: false,
  })

  // Recoil
  const recoil = Math.max(1, Math.floor(damage * 0.25))
  applyDamage(state, who, recoil)
  state.events.push({ type: 'TEXT', message: `${attacker.spirit.name} is hurt by recoil!` })

  if (defender.hp <= 0) state.events.push({ type: 'KO', target: target as 'player' | 'enemy' })
  if (attacker.hp <= 0) state.events.push({ type: 'KO', target: who })
}

// ============================================
// Damage & Status Application
// ============================================

function applyDamage(state: BattleState, target: 'player' | 'enemy', amount: number): void {
  const combatant = target === 'player' ? state.player : state.enemy
  combatant.hp -= amount

  // Bond endure: survive lethal hit at 1 HP (once per battle, bond > 200)
  // Endurance Charm doubles the chance (15% → 30%)
  if (combatant.hp <= 0 && !combatant.enduredThisBattle && combatant.spirit.bond > 200) {
    const endureChance = 0.15 + getCharmEndureBoost(combatant.heldItem)
    if (Math.random() < endureChance) {
      combatant.hp = 1
      combatant.enduredThisBattle = true
      state.events.push({ type: 'ENDURE', target })
    }
  }

  if (combatant.hp < 0) combatant.hp = 0

  // Berry trigger: check after damage for HP-threshold berries
  if (combatant.hp > 0 && !combatant.heldItemConsumed) {
    const trigger = checkBerryTrigger(combatant.heldItem, !!combatant.heldItemConsumed, combatant.hp, combatant.maxHp)
    if (trigger) {
      combatant.heldItemConsumed = true
      if (trigger.healPercent) {
        const heal = Math.max(1, Math.floor(combatant.maxHp * trigger.healPercent))
        combatant.hp = Math.min(combatant.maxHp, combatant.hp + heal)
      }
      if (trigger.statBoost) {
        applyStatChange(state, target, trigger.statBoost.stat, trigger.statBoost.stages)
      }
      state.events.push({ type: 'HELD_ITEM_TRIGGER', target, itemName: trigger.message, effect: 'berry' })
    }
  }
}

function applyStatChange(state: BattleState, target: 'player' | 'enemy', stat: CombatStat, stages: number): void {
  const combatant = target === 'player' ? state.player : state.enemy
  const prev = combatant.statStages[stat]
  combatant.statStages[stat] = Math.max(-4, Math.min(4, prev + stages))
  const actual = combatant.statStages[stat] - prev
  if (actual !== 0) {
    state.events.push({ type: 'STAT_CHANGE', target, stat, stages: actual })
  }
}

/** Status duration by type */
function statusDuration(status: StatusId): number {
  switch (status) {
    case 'anchor': return 2
    case 'erosion': return 2 + (Math.random() < 0.5 ? 1 : 0)  // 2-3 turns
    case 'surge': return 2
    case 'fortify': return 3
    default: return 3  // ignition, regen, crystallize
  }
}

/** Inflict a status effect on a combatant. Handles fortify stat mods. */
function inflictStatus(state: BattleState, target: 'player' | 'enemy', status: StatusId): void {
  const tgt = target === 'player' ? state.player : state.enemy
  if (tgt.status) return  // already has a status

  tgt.status = status
  tgt.statusTurns = statusDuration(status)
  state.events.push({ type: 'STATUS_INFLICT', target, status })

  // Fortify: immediate +25% GRD (as +1 stage), -1 AGI stage
  if (status === 'fortify') {
    applyStatChange(state, target, 'grd', 1)
    applyStatChange(state, target, 'agi', -1)
  }
}

// ============================================
// End of Turn
// ============================================

/** Process end-of-turn effects: status ticks, bond adjustments */
export function endOfTurn(state: BattleState): void {
  state.phase = 'end_of_turn'

  for (const side of ['player', 'enemy'] as const) {
    const combatant = state[side]
    if (combatant.hp <= 0) continue

    if (combatant.status && combatant.statusTurns > 0) {
      tickStatus(state, side)
      combatant.statusTurns--
      if (combatant.statusTurns <= 0) {
        // Revert fortify stat mods on expire
        if (combatant.status === 'fortify') {
          applyStatChange(state, side, 'grd', -1)
          applyStatChange(state, side, 'agi', 1)
        }
        combatant.status = null
      }
    }
  }

  // Check KO from status damage
  if (state.player.hp <= 0) state.events.push({ type: 'KO', target: 'player' })
  if (state.enemy.hp <= 0) state.events.push({ type: 'KO', target: 'enemy' })

  // Reach-encounter: the collar resists — it yanks the leash and drains some Reach each turn,
  // so you can't free a spirit with one calm move; you have to keep reaching while you weather it.
  if (state.mode === 'reach' && state.enemy.collared && state.enemy.hp > 0 && (state.enemy.reach ?? 0) > 0) {
    addReach(state, -LEASH_YANK)
  }

  // Reset actions for next turn
  state.playerAction = null
  state.enemyAction = null
  state.firstAttacker = null
}

function tickStatus(state: BattleState, target: 'player' | 'enemy'): void {
  const combatant = target === 'player' ? state.player : state.enemy
  if (!combatant.status) return

  switch (combatant.status) {
    case 'ignition': {
      const damage = Math.max(1, Math.floor(combatant.maxHp / 12))
      combatant.hp = Math.max(0, combatant.hp - damage)
      state.events.push({ type: 'STATUS_TICK', target, status: 'ignition', damage })
      break
    }
    case 'regen': {
      const heal = Math.max(1, Math.floor(combatant.maxHp / 12))
      combatant.hp = Math.min(combatant.maxHp, combatant.hp + heal)
      state.events.push({ type: 'STATUS_TICK', target, status: 'regen', damage: -heal })
      break
    }
    case 'crystallize':
      // Passive effect (GRD -20%, hit +25%) handled in calcDamage
      state.events.push({ type: 'STATUS_TICK', target, status: 'crystallize' })
      break
    case 'fortify':
      // Passive: +25% GRD but -1 AGI (applied on inflict, reverted on expire)
      state.events.push({ type: 'STATUS_TICK', target, status: 'fortify' })
      break
    case 'surge': {
      // 30% of last damage dealt splashes to the other side (bench spirit concept)
      // In 1v1: treated as minor residual damage each turn (1/16 maxHP)
      const splashDmg = Math.max(1, Math.floor(combatant.maxHp / 16))
      combatant.hp = Math.max(0, combatant.hp - splashDmg)
      state.events.push({ type: 'STATUS_TICK', target, status: 'surge', damage: splashDmg })
      break
    }
    case 'erosion': {
      // Random stat -1 each turn
      const stats: CombatStat[] = ['pwr', 'grd', 'agi', 'vig']
      const stat = stats[Math.floor(Math.random() * stats.length)]
      if (combatant.statStages[stat] > -4) {
        combatant.statStages[stat]--
        state.events.push({ type: 'STAT_CHANGE', target, stat, stages: -1 })
      }
      state.events.push({ type: 'STATUS_TICK', target, status: 'erosion' })
      break
    }
    case 'anchor':
      // Can't switch, can't flee, accuracy locked at 100% both ways
      // Flee prevention handled in executeAction; accuracy lock handled in accuracy check
      state.events.push({ type: 'STATUS_TICK', target, status: 'anchor' })
      break
  }
}

// ============================================
// Battle End Check
// ============================================

/** Check if either combatant is KO'd, set outcome. Returns true if battle is over. */
export function checkBattleEnd(state: BattleState): boolean {
  if (state.outcome !== 'pending') return true

  // Reach-encounter: the win/lose conditions are inverted around the collar.
  if (state.mode === 'reach' && state.enemy.collared) {
    // Reach full → the collar snaps → the spirit chooses again. WIN by freeing.
    if ((state.enemy.reach ?? 0) >= (state.enemy.reachMax ?? REACH_MAX)) {
      state.outcome = 'win'
      state.reachResult = 'freed'
      state.phase = 'battle_end'
      state.events.push({ type: 'COLLAR_BREAK' })
      state.events.push({ type: 'BATTLE_END', outcome: 'win' })
      return true
    }
    // You KO'd the collared spirit — forced it past its retreat (the cruelty). SOFT FAIL.
    if (state.enemy.hp <= 0) {
      state.outcome = 'lose'
      state.reachResult = 'forced'
      state.phase = 'battle_end'
      state.events.push({ type: 'BATTLE_END', outcome: 'lose' })
      return true
    }
    // Your spirit retreated. Standard loss.
    if (state.player.hp <= 0) {
      state.outcome = 'lose'
      state.reachResult = 'fainted'
      state.phase = 'battle_end'
      state.events.push({ type: 'BATTLE_END', outcome: 'lose' })
      return true
    }
    state.phase = 'select_action'
    return false
  }

  if (state.enemy.hp <= 0) {
    state.outcome = 'win'
    state.phase = 'battle_end'
    state.events.push({ type: 'BATTLE_END', outcome: 'win' })
    return true
  }
  if (state.player.hp <= 0) {
    state.outcome = 'lose'
    state.phase = 'battle_end'
    state.events.push({ type: 'BATTLE_END', outcome: 'lose' })
    return true
  }
  // Continue — back to select_action
  state.phase = 'select_action'
  return false
}

// ============================================
// Post-Battle Rewards
// ============================================

export interface BattleRewards {
  xp: number              // spirit XP (level-based)
  gold: number            // currency
  manaRecharge: number    // % of mana pool to restore
  bondChange: number      // bond adjustment
  happinessChange: number // happiness adjustment
}

/** Calculate rewards for winning a battle */
export function calculateRewards(state: BattleState): BattleRewards {
  const enemyLevel = state.enemy.spirit.level
  const basexp = Math.floor(50 + enemyLevel * 8)
  const gold = Math.floor(10 + enemyLevel * 3)
  return {
    xp: basexp,
    gold,
    manaRecharge: 0.15, // 15% mana pool restored
    bondChange: state.outcome === 'win' ? 5 : -2,
    happinessChange: state.outcome === 'win' ? 3 : -1,
  }
}
