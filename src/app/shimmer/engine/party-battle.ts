// Party turn-based battle engine (FF-style team combat).
//
// Direction (2026-06-19): Shimmer combat moves from 1v1 to party-vs-party so the
// player's bonded circle of spirits shows up together. Battle is the CHALLENGE
// pillar — cozy lives in the life-sim, fights need real teeth (struggle vs the
// Moglin strongholds). See memory project_shimmer_combat_direction.
//
// Built ALONGSIDE the live 1v1 engine (battle.ts) — not a mutation — so the
// playable game keeps working while this is proven headless. Reuses battle.ts's
// stat/damage core (createCombatant, calcDamage, getEffectiveStat) so there's
// one source of truth for the maths.
//
// Mana economy: every combatant always has a free basic Strike (0 mana), so it
// can act when dry. Real moves cost mana from a per-side pool that regens each
// round. Strong moves cost more — that's the constraint. The pool's starting/
// refill values are parameters, so "shared with overworld channelling" vs
// "battle-only" stays a deferrable policy decision, not baked into the engine.

import {
  BattleCombatant,
  createCombatant, calcDamage, getEffectiveStat,
} from './battle'
import type { Spirit } from '../spirits/spirit'
import type { Move } from './moves'

// ── Free basic attack (always affordable) ──
export const BASIC_STRIKE: Move = {
  id: 'strike',
  name: 'Strike',
  element: 'neutral',
  state: 'compact',
  power: 30,
  accuracy: 100,
  pp: 999,
  priority: 0,
  description: 'A plain bonded strike — costs no mana.',
}

/** Mana cost for a move — power-scaled. Status/utility (power 0) are cheap; basics are free. */
export function manaCostFor(move: Move): number {
  if (move.id === BASIC_STRIKE.id) return 0
  if (move.power === 0) return 2
  return Math.max(2, Math.round(move.power / 12))
}

export interface ManaPool { current: number; max: number; regen: number }

export interface PartyCombatant extends BattleCombatant {
  id: string
  side: 'ally' | 'enemy'
  alive: boolean
}

export type PartyEvent =
  | { type: 'ROUND'; round: number }
  | { type: 'MOVE'; actorId: string; moveName: string; targetId: string; manaSpent: number }
  | { type: 'DAMAGE'; targetId: string; amount: number; effectiveness: number; crit: boolean }
  | { type: 'KO'; targetId: string }
  | { type: 'MANA_DRY'; side: 'ally' | 'enemy' }       // a side couldn't afford its chosen move, fell back to Strike
  | { type: 'BATTLE_END'; outcome: 'win' | 'lose' }

export type PartyAction =
  | { type: 'move'; actorId: string; moveIdx: number; targetId: string }  // moveIdx -1 = basic Strike
  | { type: 'defend'; actorId: string }

export interface PartyBattleState {
  allies: PartyCombatant[]
  enemies: PartyCombatant[]
  mana: { ally: ManaPool; enemy: ManaPool }
  order: string[]   // combatant ids, initiative order for the current round
  turnIdx: number
  round: number
  outcome: 'pending' | 'win' | 'lose'
  events: PartyEvent[]
}

// ── Setup ──

export interface ManaConfig { start: number; max: number; regen: number }
const DEFAULT_MANA: ManaConfig = { start: 20, max: 30, regen: 6 }

function makeCombatant(spirit: Spirit, side: 'ally' | 'enemy', idx: number): PartyCombatant {
  const base = createCombatant(spirit)
  return { ...base, id: `${side}-${idx}-${spirit.species}`, side, alive: true }
}

export function createPartyBattle(
  allySpirits: Spirit[], enemySpirits: Spirit[],
  manaCfg: { ally?: Partial<ManaConfig>; enemy?: Partial<ManaConfig> } = {},
): PartyBattleState {
  const aCfg = { ...DEFAULT_MANA, ...manaCfg.ally }
  const eCfg = { ...DEFAULT_MANA, ...manaCfg.enemy }
  const state: PartyBattleState = {
    allies: allySpirits.map((s, i) => makeCombatant(s, 'ally', i)),
    enemies: enemySpirits.map((s, i) => makeCombatant(s, 'enemy', i)),
    mana: {
      ally: { current: aCfg.start, max: aCfg.max, regen: aCfg.regen },
      enemy: { current: eCfg.start, max: eCfg.max, regen: eCfg.regen },
    },
    order: [],
    turnIdx: 0,
    round: 0,
    outcome: 'pending',
    events: [],
  }
  startRound(state)
  return state
}

// ── Helpers ──

export function allCombatants(state: PartyBattleState): PartyCombatant[] {
  return [...state.allies, ...state.enemies]
}

export function findById(state: PartyBattleState, id: string): PartyCombatant | undefined {
  return allCombatants(state).find(c => c.id === id)
}

export function livingEnemiesOf(state: PartyBattleState, side: 'ally' | 'enemy'): PartyCombatant[] {
  return (side === 'ally' ? state.enemies : state.allies).filter(c => c.alive)
}

function livingAllies(state: PartyBattleState, side: 'ally' | 'enemy'): PartyCombatant[] {
  return (side === 'ally' ? state.allies : state.enemies).filter(c => c.alive)
}

/** Build initiative order for the round: all living combatants, fastest AGI first. */
function startRound(state: PartyBattleState) {
  state.round++
  state.events.push({ type: 'ROUND', round: state.round })
  const living = allCombatants(state).filter(c => c.alive)
  living.sort((a, b) => {
    const d = getEffectiveStat(b, 'agi') - getEffectiveStat(a, 'agi')
    return d !== 0 ? d : Math.random() - 0.5 // AGI ties coin-flip — no side bias
  })
  state.order = living.map(c => c.id)
  state.turnIdx = 0
}

/** The combatant whose turn it is, or undefined if the round is done. */
export function currentActor(state: PartyBattleState): PartyCombatant | undefined {
  while (state.turnIdx < state.order.length) {
    const c = findById(state, state.order[state.turnIdx])
    if (c && c.alive) return c
    state.turnIdx++ // skip the dead (KO'd mid-round)
  }
  return undefined
}

// ── Turn execution ──

/** Execute one combatant's action. Advances the turn. Caller drives currentActor() → submit. */
export function takeAction(state: PartyBattleState, action: PartyAction): void {
  if (state.outcome !== 'pending') return
  const actor = findById(state, action.actorId)
  if (!actor || !actor.alive) { state.turnIdx++; return }

  if (action.type === 'defend') {
    actor.statStages.grd = Math.min(4, actor.statStages.grd + 1)
    state.turnIdx++
    advanceIfRoundDone(state)
    return
  }

  const pool = state.mana[actor.side]
  let move: Move
  let manaSpent = 0

  if (action.moveIdx < 0) {
    move = BASIC_STRIKE
  } else {
    const entry = actor.moves[action.moveIdx]
    const chosen = entry?.move ?? BASIC_STRIKE
    const cost = manaCostFor(chosen)
    if (cost > pool.current) {
      // Can't afford it — fall back to the free Strike (the mana constraint biting)
      move = BASIC_STRIKE
      state.events.push({ type: 'MANA_DRY', side: actor.side })
    } else {
      move = chosen
      manaSpent = cost
      pool.current -= cost
    }
  }

  const target = findById(state, action.targetId)
  state.events.push({ type: 'MOVE', actorId: actor.id, moveName: move.name, targetId: action.targetId, manaSpent })

  if (target && target.alive && move.power > 0) {
    const { damage, crit, effectiveness } = calcDamage(actor, target, move)
    target.hp = Math.max(0, target.hp - damage)
    state.events.push({ type: 'DAMAGE', targetId: target.id, amount: damage, effectiveness, crit })
    if (target.hp <= 0) {
      target.alive = false
      state.events.push({ type: 'KO', targetId: target.id })
    }
  }

  state.turnIdx++
  checkOutcome(state)
  advanceIfRoundDone(state)
}

function advanceIfRoundDone(state: PartyBattleState) {
  if (state.outcome !== 'pending') return
  if (!currentActor(state)) {
    endOfRound(state)
    if (state.outcome === 'pending') startRound(state)
  }
}

function endOfRound(state: PartyBattleState) {
  for (const side of ['ally', 'enemy'] as const) {
    const pool = state.mana[side]
    pool.current = Math.min(pool.max, pool.current + pool.regen)
  }
}

function checkOutcome(state: PartyBattleState) {
  if (state.outcome !== 'pending') return
  if (state.enemies.every(c => !c.alive)) {
    state.outcome = 'win'
    state.events.push({ type: 'BATTLE_END', outcome: 'win' })
  } else if (state.allies.every(c => !c.alive)) {
    state.outcome = 'lose'
    state.events.push({ type: 'BATTLE_END', outcome: 'lose' })
  }
}

// ── Default AI (used by the headless sim and as the enemy brain) ──

export interface AIConfig {
  focusFire: boolean   // target the lowest-HP foe (true) vs random (false)
  spendMana: boolean   // use mana moves when affordable (true) vs Strike-only (false)
}

/** Pick an action for the actor: strongest affordable move at the chosen target. */
export function chooseAction(state: PartyBattleState, actor: PartyCombatant, ai: AIConfig): PartyAction {
  const foes = livingEnemiesOf(state, actor.side)
  if (foes.length === 0) return { type: 'defend', actorId: actor.id }

  const target = ai.focusFire
    ? foes.reduce((lo, c) => (c.hp < lo.hp ? c : lo), foes[0])
    : foes[Math.floor(Math.random() * foes.length)]

  if (!ai.spendMana) return { type: 'move', actorId: actor.id, moveIdx: -1, targetId: target.id }

  // Best damaging move we can afford this turn
  const pool = state.mana[actor.side]
  let bestIdx = -1
  let bestPower = BASIC_STRIKE.power
  actor.moves.forEach((entry, i) => {
    const m = entry.move
    if (m.power > bestPower && manaCostFor(m) <= pool.current) {
      bestPower = m.power
      bestIdx = i
    }
  })
  return { type: 'move', actorId: actor.id, moveIdx: bestIdx, targetId: target.id }
}
