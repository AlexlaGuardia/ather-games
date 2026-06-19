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
  createCombatant,
} from './battle'
import type { Spirit } from '../spirits/spirit'
import type { Move, StatusId, CombatStat } from './moves'
import { getEffectiveness, MOVE_STILL_BREATH, MOVE_SPIRIT_WARD } from './moves'
import {
  PartyStats, derivePartyStats, calcPartyDamage, partyEvades, effectiveAgi, moveCategory,
} from './party-stats'

// ── Free basic attack (always affordable) ──
// Kept deliberately weak: it's the fallback when mana is dry, so being forced
// onto it should sting (otherwise mana is a no-op constraint and the move list
// collapses to "spam your biggest"). The whole tension is best-move-vs-affordable.
export const BASIC_STRIKE: Move = {
  id: 'strike',
  name: 'Strike',
  element: 'neutral',
  state: 'compact',
  power: 18,
  accuracy: 100,
  pp: 999,
  priority: 0,
  description: 'A plain bonded strike — costs no mana, but it is weak.',
}

/** Mana cost for a move — power-scaled with a premium spike on heavy hitters, so the
 *  top of the kit is a real commitment (you can't big-cast the whole party every round).
 *  Status/utility (power 0) are cheap; the free Strike is 0. Used by the party engine only. */
export function manaCostFor(move: Move): number {
  if (move.id === BASIC_STRIKE.id) return 0
  if (move.power === 0) return 3
  return Math.max(3, Math.round(move.power / 8)) + (move.power >= 60 ? 2 : 0)
}

export interface ManaPool { current: number; max: number; regen: number }

export interface PartyCombatant extends BattleCombatant {
  id: string
  side: 'ally' | 'enemy'
  alive: boolean
  pstats: PartyStats   // 6-stat phys/spirit model (party fork; replaces the 1v1 4-stat for combat)
}

export type PartyEvent =
  | { type: 'ROUND'; round: number }
  | { type: 'MOVE'; actorId: string; moveName: string; targetId: string; manaSpent: number }
  | { type: 'DAMAGE'; targetId: string; amount: number; effectiveness: number; crit: boolean }
  | { type: 'MISS'; targetId: string }                  // dodged via agility (evasion)
  | { type: 'STAT_CHANGE'; targetId: string; stat: CombatStat; stages: number }
  | { type: 'STATUS_INFLICT'; targetId: string; status: StatusId }
  | { type: 'STATUS_TICK'; targetId: string; status: StatusId; amount: number }   // amount>0 damage, <0 heal
  | { type: 'KO'; targetId: string }
  | { type: 'REACH'; captiveId: string; reach: number; reachMax: number; delta: number } // reach-encounter progress
  | { type: 'COLLAR_BREAK'; captiveId: string }                                            // the collar snaps — captive freed
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
  // Reach-encounter: one enemy is a collared captive you free by REACHING (not KO'ing). Win = collar
  // breaks; KO the captive = 'forced' soft-fail; party wiped = 'fainted'. KO'ing guards never wins.
  mode?: 'standard' | 'reach'
  reachResult?: 'freed' | 'forced' | 'fainted' | null
}

// Reach knobs (party fork of the 1v1 mechanic)
const REACH_MAX = 100
const LEASH_YANK = 9      // reach the collar drains each round (you can't free it with one move)
const COLLAR_DIM = 0.6    // the collar dims the captive's offense (canon) — also the survivability knob

// ── Setup ──

export interface ManaConfig { start: number; max: number; regen: number }
// Tight on purpose: the pool is shared across a 3-member side, so it can't fund
// everyone's premium move every round — you pick who goes big and who Strikes/Defends.
// regen < one premium cast/round keeps the tension going past the opening.
const DEFAULT_MANA: ManaConfig = { start: 16, max: 22, regen: 5 }

function makeCombatant(spirit: Spirit, side: 'ally' | 'enemy', idx: number): PartyCombatant {
  const base = createCombatant(spirit)
  const pstats = derivePartyStats(spirit) // party fork: 6-stat phys/spirit model drives HP + combat
  return { ...base, id: `${side}-${idx}-${spirit.species}`, side, alive: true, pstats, hp: pstats.maxHp, maxHp: pstats.maxHp }
}

export function createPartyBattle(
  allySpirits: Spirit[], enemySpirits: Spirit[],
  manaCfg: { ally?: Partial<ManaConfig>; enemy?: Partial<ManaConfig> } = {},
  reach?: { captiveIdx: number },
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

  // Reach-encounter setup: collar one enemy (the captive), dim its offense, and give every ally
  // the calming moves (Still-Breath / Spirit Ward) so the party can reach it while it fights under the collar.
  if (reach && state.enemies[reach.captiveIdx]) {
    state.mode = 'reach'
    state.reachResult = null
    const captive = state.enemies[reach.captiveIdx]
    captive.collared = true
    captive.reach = 0
    captive.reachMax = REACH_MAX
    captive.pstats = { ...captive.pstats, pwr: Math.round(captive.pstats.pwr * COLLAR_DIM), foc: Math.round(captive.pstats.foc * COLLAR_DIM) }
    const reachMoves = [
      { move: MOVE_STILL_BREATH, ppLeft: MOVE_STILL_BREATH.pp },
      { move: MOVE_SPIRIT_WARD, ppLeft: MOVE_SPIRIT_WARD.pp },
    ]
    for (const ally of state.allies) ally.moves = [...reachMoves, ...ally.moves].slice(0, 4)
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
    const d = effectiveAgi(b) - effectiveAgi(a)
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
    if (partyEvades(actor, target)) {
      state.events.push({ type: 'MISS', targetId: target.id })
    } else {
      const { damage, crit, effectiveness } = calcPartyDamage(actor, target, move, actor.spirit.level)
      target.hp = Math.max(0, target.hp - damage)
      state.events.push({ type: 'DAMAGE', targetId: target.id, amount: damage, effectiveness, crit })
      if (target.hp <= 0) {
        target.alive = false
        state.events.push({ type: 'KO', targetId: target.id })
      }
    }
  }

  // Non-damage effects (the support layer): stat changes, status riders. These make
  // support moves real and let attack moves carry DoT/debuff riders — both sides.
  applyMoveEffects(state, actor, target, move)

  // Reach-encounter: a calming move (one that `reaches`) aimed at the captive fills its Reach
  // instead of harming it. Fill the bar → the collar snaps → win.
  if (state.mode === 'reach' && actor.side === 'ally' && move.reaches && target?.collared && target.alive) {
    addPartyReach(state, target, move.reaches)
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
  // Status ticks first (DoTs/regen can KO or heal before mana refreshes).
  for (const c of allCombatants(state)) {
    if (!c.alive || !c.status) continue
    tickPartyStatus(state, c)
    c.statusTurns--
    if (c.statusTurns <= 0) {
      if (c.status === 'fortify') { applyStatStage(state, c, 'grd', -1); applyStatStage(state, c, 'agi', 1) }
      c.status = null
    }
    if (c.hp <= 0 && c.alive) {
      c.alive = false
      state.events.push({ type: 'KO', targetId: c.id })
    }
  }
  checkOutcome(state)

  // Reach: the collar resists — it yanks the leash each round, draining some Reach. You can't
  // free a captive with one calm move; you have to keep reaching while you weather the stronghold.
  if (state.mode === 'reach' && state.outcome === 'pending') {
    const captive = state.enemies.find(e => e.collared && e.alive)
    if (captive && (captive.reach ?? 0) > 0) addPartyReach(state, captive, -LEASH_YANK)
  }

  for (const side of ['ally', 'enemy'] as const) {
    const pool = state.mana[side]
    pool.current = Math.min(pool.max, pool.current + pool.regen)
  }
}

// ── Move effects (support layer) — ported from the 1v1 engine, party-aware ──

/** Apply a move's stat changes + status riders. self → actor, foe → the chosen target. */
function applyMoveEffects(state: PartyBattleState, actor: PartyCombatant, target: PartyCombatant | undefined, move: Move) {
  if (move.statChanges) {
    for (const sc of move.statChanges) {
      const t = sc.target === 'self' ? actor : target
      if (t && t.alive) applyStatStage(state, t, sc.stat, sc.stages)
    }
  }
  if (move.effect && move.effectChance && target && target.alive) {
    if (Math.random() * 100 < move.effectChance) inflictPartyStatus(state, target, move.effect)
  }
  if (move.selfEffect && move.selfEffectChance && actor.alive) {
    if (Math.random() * 100 < move.selfEffectChance) inflictPartyStatus(state, actor, move.selfEffect)
  }
}

function applyStatStage(state: PartyBattleState, c: PartyCombatant, stat: CombatStat, stages: number) {
  const prev = c.statStages[stat]
  c.statStages[stat] = Math.max(-4, Math.min(4, prev + stages))
  const actual = c.statStages[stat] - prev
  if (actual !== 0) state.events.push({ type: 'STAT_CHANGE', targetId: c.id, stat, stages: actual })
}

function statusDur(status: StatusId): number {
  switch (status) {
    case 'anchor': return 2
    case 'erosion': return 2 + (Math.random() < 0.5 ? 1 : 0)
    case 'surge': return 2
    case 'fortify': return 3
    default: return 3 // ignition, regen, crystallize
  }
}

function inflictPartyStatus(state: PartyBattleState, c: PartyCombatant, status: StatusId) {
  if (c.status) return // one status at a time
  c.status = status
  c.statusTurns = statusDur(status)
  state.events.push({ type: 'STATUS_INFLICT', targetId: c.id, status })
  if (status === 'fortify') { applyStatStage(state, c, 'grd', 1); applyStatStage(state, c, 'agi', -1) }
}

function tickPartyStatus(state: PartyBattleState, c: PartyCombatant) {
  switch (c.status) {
    case 'ignition': {
      const d = Math.max(1, Math.floor(c.maxHp / 12)); c.hp = Math.max(0, c.hp - d)
      state.events.push({ type: 'STATUS_TICK', targetId: c.id, status: 'ignition', amount: d }); break
    }
    case 'regen': {
      const h = Math.max(1, Math.floor(c.maxHp / 12)); c.hp = Math.min(c.maxHp, c.hp + h)
      state.events.push({ type: 'STATUS_TICK', targetId: c.id, status: 'regen', amount: -h }); break
    }
    case 'surge': {
      const d = Math.max(1, Math.floor(c.maxHp / 16)); c.hp = Math.max(0, c.hp - d)
      state.events.push({ type: 'STATUS_TICK', targetId: c.id, status: 'surge', amount: d }); break
    }
    case 'erosion': {
      const stats: CombatStat[] = ['pwr', 'grd', 'agi', 'vig']
      const stat = stats[Math.floor(Math.random() * stats.length)]
      if (c.statStages[stat] > -4) { c.statStages[stat]--; state.events.push({ type: 'STAT_CHANGE', targetId: c.id, stat, stages: -1 }) }
      state.events.push({ type: 'STATUS_TICK', targetId: c.id, status: 'erosion', amount: 0 }); break
    }
    case 'crystallize':
      state.events.push({ type: 'STATUS_TICK', targetId: c.id, status: 'crystallize', amount: 0 }); break
    case 'fortify':
      state.events.push({ type: 'STATUS_TICK', targetId: c.id, status: 'fortify', amount: 0 }); break
    case 'anchor':
      state.events.push({ type: 'STATUS_TICK', targetId: c.id, status: 'anchor', amount: 0 }); break
  }
}

function checkOutcome(state: PartyBattleState) {
  if (state.outcome !== 'pending') return
  if (state.mode === 'reach') {
    // Win is fired on collar-break (in addPartyReach). Here we only catch the fail states:
    // KO'ing the captive = forced (you killed who you came to save); party wiped = fainted.
    const captive = state.enemies.find(e => e.reachMax !== undefined)
    if (captive && !captive.alive) {
      state.reachResult = 'forced'; state.outcome = 'lose'
      state.events.push({ type: 'BATTLE_END', outcome: 'lose' })
    } else if (state.allies.every(c => !c.alive)) {
      state.reachResult = 'fainted'; state.outcome = 'lose'
      state.events.push({ type: 'BATTLE_END', outcome: 'lose' })
    }
    return
  }
  if (state.enemies.every(c => !c.alive)) {
    state.outcome = 'win'
    state.events.push({ type: 'BATTLE_END', outcome: 'win' })
  } else if (state.allies.every(c => !c.alive)) {
    state.outcome = 'lose'
    state.events.push({ type: 'BATTLE_END', outcome: 'lose' })
  }
}

/** Add (or drain, with negative delta) Reach on the captive. Filling it snaps the collar → win. */
function addPartyReach(state: PartyBattleState, captive: PartyCombatant, delta: number) {
  const max = captive.reachMax ?? REACH_MAX
  const before = captive.reach ?? 0
  captive.reach = Math.max(0, Math.min(max, before + delta))
  state.events.push({ type: 'REACH', captiveId: captive.id, reach: captive.reach, reachMax: max, delta: captive.reach - before })
  if (captive.reach >= max && state.outcome === 'pending') {
    captive.collared = false
    state.reachResult = 'freed'
    state.events.push({ type: 'COLLAR_BREAK', captiveId: captive.id })
    state.outcome = 'win'
    state.events.push({ type: 'BATTLE_END', outcome: 'win' })
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

  // Best EFFECTIVE move we can afford — score by category vs the target's weaker defense
  // (+ element matchup). This is the skill the split rewards, so the AI plays it too.
  const pool = state.mana[actor.side]
  let bestIdx = -1
  let bestScore = moveScore(BASIC_STRIKE, actor, target)
  actor.moves.forEach((entry, i) => {
    const m = entry.move
    if (m.power <= 0 || manaCostFor(m) > pool.current) return // AI skips pure-status moves for v1
    const sc = moveScore(m, actor, target)
    if (sc > bestScore) { bestScore = sc; bestIdx = i }
  })
  return { type: 'move', actorId: actor.id, moveIdx: bestIdx, targetId: target.id }
}

/** Rough expected-damage score: power × (attack/defense for the move's category) × element matchup. */
function moveScore(move: Move, atk: PartyCombatant, def: PartyCombatant): number {
  const cat = moveCategory(move)
  const a = cat === 'phys' ? atk.pstats.pwr : atk.pstats.foc
  const d = cat === 'phys' ? def.pstats.grd : def.pstats.res
  return move.power * (a / Math.max(1, d)) * getEffectiveness(move.element, def.element)
}
