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
import type { Spirit, Species } from '../spirits/spirit'
import { createSpirit } from '../spirits/spirit'
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
  // Keeper companion (canon: rare support mage, the anti-collar). AI-driven, own mana pool.
  isKeeper?: boolean
  archetype?: KeeperArchetype
  keeperMana?: ManaPool
  braced?: boolean   // defended this round → halves incoming damage until round end (Guard stance teeth)
}

// Support archetypes map to the canon keeper-skills (Heslur→Breaker, Maizie→Mender,
// Gregory→Warden, a Mana-keeper→Channeler). One support-AI drives all four.
export type KeeperArchetype = 'warden' | 'mender' | 'breaker' | 'channeler'
export type KeeperActKind = 'ward' | 'mend' | 'break' | 'channel' | 'rest'

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
  | { type: 'HEAL'; targetId: string; amount: number }                    // keeper Mender restores HP
  | { type: 'MANA_GRANT'; amount: number }                                // keeper Channeler feeds your pool
  | { type: 'KEEPER_ACT'; keeperId: string; kind: KeeperActKind; targetId: string } // keeper's chosen support
  | { type: 'BATTLE_END'; outcome: 'win' | 'lose' }

export type PartyAction =
  | { type: 'move'; actorId: string; moveIdx: number; targetId: string }  // moveIdx -1 = basic Strike
  | { type: 'defend'; actorId: string }
  | { type: 'keeper'; actorId: string; kind: KeeperActKind; targetId: string } // AI-only: a keeper's support

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

// ── Keeper companion ──
// Archetype → a body species for HP/agi (Warden tanky, Mender bulky, casters squishier).
const KEEPER_BODY: Record<KeeperArchetype, Species> = { warden: 'turtle', mender: 'axolotl', breaker: 'owl', channeler: 'bat' }
const KEEPER_MANA = { current: 12, max: 16, regen: 5 }

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

/** Build a Keeper companion combatant (AI-driven support, own mana, neutral/amber token). */
export function createKeeperCombatant(archetype: KeeperArchetype, level: number, idx: number, name?: string): PartyCombatant {
  const s = createSpirit(KEEPER_BODY[archetype], name ?? `${cap(archetype)}`, 0, 0)
  s.level = level
  s.element = 'base' // neutral token — visually distinct from the element-coloured spirits
  const c = makeCombatant(s, 'ally', idx)
  c.isKeeper = true
  c.archetype = archetype
  c.keeperMana = { ...KEEPER_MANA }
  return c
}

export function createPartyBattle(
  allySpirits: Spirit[], enemySpirits: Spirit[],
  manaCfg: { ally?: Partial<ManaConfig>; enemy?: Partial<ManaConfig> } = {},
  reach?: { captiveIdx: number },
  keeper?: { archetype: KeeperArchetype; name?: string },
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

  // A Keeper companion joins the ally side (rare narrative support — own mana, AI-driven).
  if (keeper) {
    const lvl = Math.round(allySpirits.reduce((s, sp) => s + sp.level, 0) / Math.max(1, allySpirits.length)) || 5
    state.allies.push(createKeeperCombatant(keeper.archetype, lvl, state.allies.length, keeper.name))
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
    actor.braced = true // halves all incoming damage until the round ends
    state.turnIdx++
    advanceIfRoundDone(state)
    return
  }

  if (action.type === 'keeper') {
    applyKeeperAction(state, actor, action.kind, action.targetId)
    state.turnIdx++
    checkOutcome(state)
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
      const dmg = target.braced ? Math.max(1, Math.round(damage * 0.5)) : damage // brace soaks half
      target.hp = Math.max(0, target.hp - dmg)
      state.events.push({ type: 'DAMAGE', targetId: target.id, amount: dmg, effectiveness, crit })
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
  // Keepers regen their own (separate) mana pool
  for (const c of state.allies) {
    if (c.isKeeper && c.alive && c.keeperMana) c.keeperMana.current = Math.min(c.keeperMana.max, c.keeperMana.current + c.keeperMana.regen)
  }
  // Brace lasts until the round ends
  for (const c of allCombatants(state)) c.braced = false
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
  // Half-director: the Keeper sets a STANCE for the round; the spirits riff within it,
  // colored by their temperament (bold spirits stay aggressive even on Guard, etc.).
  stance?: 'press' | 'guard' | 'focus' | 'reach'
  focusTargetId?: string   // for 'focus' — the enemy the Keeper points the party at
}

// Temperament → attack-probability BEND. The stance sets the base lean; temperament nudges it,
// so a directive is GUIDANCE, not a puppet-string (the bond philosophy, mechanical). A hard Press
// is mostly obeyed (small bend); on Guard the bend matters more, so a bold spirit still pokes.
const TEMPERAMENT_BEND: Record<string, number> = {
  bold: 0.10, bright: 0.05, swift: 0.03, neutral: 0, calm: -0.12, sturdy: -0.18,
}

/** Pick an action for the actor under the Keeper's stance, bent by the spirit's temperament. */
export function chooseAction(state: PartyBattleState, actor: PartyCombatant, ai: AIConfig): PartyAction {
  const foes = livingEnemiesOf(state, actor.side)
  if (foes.length === 0) return { type: 'defend', actorId: actor.id }

  // Reach directive: calm the collared captive (a `reaches` move) instead of fighting it.
  if (ai.stance === 'reach') {
    const captive = foes.find(f => f.collared)
    const reachIdx = actor.moves.findIndex(e => (e.move.reaches ?? 0) > 0)
    if (captive && reachIdx >= 0) return { type: 'move', actorId: actor.id, moveIdx: reachIdx, targetId: captive.id }
    // no captive / no calm move in kit → fall through and fight the guards
  }

  // Targeting: Focus points anywhere the Keeper chose (even the captive = a deliberate brute-force).
  // Otherwise the party spares the collared captive and hits the guards — Press/Guard never force-fail it.
  const targetPool = ai.stance === 'focus' ? foes : foes.filter(f => !f.collared)
  if (targetPool.length === 0) return { type: 'defend', actorId: actor.id } // only the captive left — hold, await a Reach call
  let target: PartyCombatant | undefined
  if (ai.stance === 'focus' && ai.focusTargetId) target = foes.find(f => f.id === ai.focusTargetId)
  if (!target) target = ai.focusFire ? targetPool.reduce((lo, c) => (c.hp < lo.hp ? c : lo), targetPool[0]) : targetPool[Math.floor(Math.random() * targetPool.length)]

  // Stance sets the attack-vs-brace lean; temperament bends it (the spirit's own nature shows).
  // No stance (e.g. enemy AI) = aggressive default so foes press unless told otherwise.
  const stanceBase = ai.stance === 'guard' ? 0.40 : (ai.stance === 'press' || ai.stance === 'focus') ? 1.0 : 0.92
  const attackProb = Math.max(0.05, Math.min(1, stanceBase + (TEMPERAMENT_BEND[actor.spirit.temperament] ?? 0)))
  if (Math.random() >= attackProb) return { type: 'defend', actorId: actor.id } // braces this turn

  if (!ai.spendMana) return { type: 'move', actorId: actor.id, moveIdx: -1, targetId: target.id }

  // Move choice: Press/Focus = the strongest effective move; Guard = conserve (cheapest real move).
  const pool = state.mana[actor.side]
  const guarding = ai.stance === 'guard'
  let bestIdx = -1
  let bestScore = guarding ? Infinity : moveScore(BASIC_STRIKE, actor, target)
  actor.moves.forEach((entry, i) => {
    const m = entry.move
    if (m.power <= 0 || manaCostFor(m) > pool.current) return // skip pure-status for v1
    if (guarding) {
      const cost = manaCostFor(m) // conserve: prefer the cheapest affordable real move
      if (cost < bestScore) { bestScore = cost; bestIdx = i }
    } else {
      const sc = moveScore(m, actor, target) // press/focus: hit the weaker defense hardest
      if (sc > bestScore) { bestScore = sc; bestIdx = i }
    }
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

// ── Keeper support (one AI, four archetypes) ──

const KEEPER_COST: Record<KeeperActKind, number> = { ward: 5, mend: 6, break: 5, channel: 4, rest: 0 }

/** Apply a keeper's chosen support, spending its own mana. Falls back to rest if it can't afford. */
function applyKeeperAction(state: PartyBattleState, keeper: PartyCombatant, kind: KeeperActKind, targetId: string) {
  const pool = keeper.keeperMana
  let act = kind
  if (pool && KEEPER_COST[kind] > pool.current) act = 'rest' // can't afford → rest (recover mana)
  if (pool) pool.current = Math.max(0, pool.current - KEEPER_COST[act])
  state.events.push({ type: 'KEEPER_ACT', keeperId: keeper.id, kind: act, targetId })
  const target = findById(state, targetId)
  switch (act) {
    case 'ward': // Warden (Gregory): shore up an ally's physical guard
      if (target && target.alive) applyStatStage(state, target, 'grd', 2)
      break
    case 'mend': // Mender (Maizie): restore an ally's HP
      if (target && target.alive) {
        const before = target.hp
        target.hp = Math.min(target.maxHp, target.hp + Math.max(1, Math.round(target.maxHp * 0.3)))
        state.events.push({ type: 'HEAL', targetId: target.id, amount: target.hp - before })
      }
      break
    case 'break': // Breaker (Heslur, the anti-collar): crack a foe's defense + start it eroding
      if (target && target.alive) { applyStatStage(state, target, 'grd', -1); inflictPartyStatus(state, target, 'erosion') }
      break
    case 'channel': { // Channeler: feed YOUR pool so you cast bigger
      const p = state.mana.ally
      const before = p.current
      p.current = Math.min(p.max, p.current + 8)
      state.events.push({ type: 'MANA_GRANT', amount: p.current - before })
      break
    }
    case 'rest':
      if (pool) pool.current = Math.min(pool.max, pool.current + 4)
      break
  }
}

/** The keeper support-AI: pick the archetype's best play for the current board. */
export function chooseKeeperAction(state: PartyBattleState, keeper: PartyCombatant): PartyAction {
  const afford = (k: KeeperActKind) => !keeper.keeperMana || keeper.keeperMana.current >= KEEPER_COST[k]
  const mates = state.allies.filter(c => c.alive && c.id !== keeper.id)
  const foes = livingEnemiesOf(state, keeper.side)
  const rest: PartyAction = { type: 'keeper', actorId: keeper.id, kind: 'rest', targetId: keeper.id }

  switch (keeper.archetype) {
    case 'mender': {
      const hurt = mates.filter(c => c.hp < c.maxHp * 0.7).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
      if (hurt && afford('mend')) return { type: 'keeper', actorId: keeper.id, kind: 'mend', targetId: hurt.id }
      break
    }
    case 'warden': {
      const ward = mates.filter(c => c.statStages.grd < 3).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
      if (ward && afford('ward')) return { type: 'keeper', actorId: keeper.id, kind: 'ward', targetId: ward.id }
      break
    }
    case 'breaker': {
      const foe = foes.filter(f => f.statStages.grd > -3).sort((a, b) => b.hp - a.hp)[0] ?? foes[0]
      if (foe && afford('break')) return { type: 'keeper', actorId: keeper.id, kind: 'break', targetId: foe.id }
      break
    }
    case 'channeler': {
      const p = state.mana.ally
      if (p.current < p.max * 0.7 && afford('channel')) return { type: 'keeper', actorId: keeper.id, kind: 'channel', targetId: keeper.id }
      break
    }
  }
  return rest
}
