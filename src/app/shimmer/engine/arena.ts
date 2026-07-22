// ── Keeper's Arena — real-time battle sim (sim-first, no renderer) ──────────────
//
// Direction (2026-07-04, Alex): replace turn-based party combat with a real-time
// bounded arena. Spirits fight ON THEIR OWN by instinct (a live-nudgeable stance);
// the player is the KEEPER, whose agency is a scarce, timing-gated support kit —
// NOT a move menu. This is the anti-collar identity made mechanical: you coach and
// enable, you don't command. Pokémon = collar (order every move); Shimmer = Keeper.
//
// CINEMATIC PASS (2026-07-22, Alex): the fight is a performance the renderer plays
// back — spirits fight with their REAL canon kits (engine/arena-moves.ts ← moves.ts
// ← CANON/game/moves.md). Every attack is a timed move action (windup → execute →
// recover) with cooldowns replacing PP; misses are VISIBLE dodges (the target
// sidesteps); heavies telegraph. Because the sim is pure + seeded, the whole fight
// can be pre-scripted at mount (see simulate()) and replayed identically live.
//
// This module is PURE + DETERMINISTIC (seeded rng, fixed-timestep tick) so the feel
// can be oracle-proven headless before a single triangle is drawn — the same
// sim-first discipline every arcade cabinet shipped on.
//
// Coordinate space: a flat disc of radius R. Fighters carry (x,y) on that floor;
// the 3D renderer maps y→z and lifts a 3/4 iso camera over the ring.

import type { Species, Element, Spirit } from '../spirits/spirit'
import { derivePartyStats } from './party-stats'
import {
  kitForSpirit, chooseMove, hitChance, moveDamage, applyStatus, stageMult,
  freshStatus, freshStages, toBattleElement,
  type ArenaMove, type ArenaAITier, type StatusState, type StageState, type MoveState, type StatusId, type BattleElement,
} from './arena-moves'

export type { ArenaAITier }

export type Side = 'ally' | 'enemy'
export type Stance = 'aggressive' | 'defend'   // the live-nudgeable instinct (Speak flicks this)
export type AidId = 'flash' | 'breeze' | 'reach' | 'wardcoil' | 'witherbloom'

// A move in flight: windup (telegraphed if heavy) → execute at t=dur → recover.
export interface Act {
  move: ArenaMove
  phase: 'windup' | 'recover'
  t: number; dur: number
  targetId: string
}

export interface Fighter {
  id: string
  side: Side
  species: Species
  element: Element
  bElement: BattleElement   // element in move-space (base → neutral), computed once
  name: string
  x: number; y: number
  facing: number            // radians — toward target / move dir (renderer turns the blockout to face)
  hp: number; maxHp: number
  level: number             // display only (team cards)
  pwr: number; grd: number; agi: number
  radius: number            // body scale — the "little one" reads small, gets swarmed
  speed: number             // floor units / sec
  reach: number             // spacing anchor for the between-moves dance
  orbitDir: 1 | -1          // which way this one circles (deterministic per slot)
  tier: ArenaAITier         // decision quality — never stats (champion reads, doesn't cheat)
  collared: boolean         // a captive compelled to fight — renders collared, freed on the win
  // fight personality (seeded per fighter) — breaks the mirror: two spirits must never
  // share a metronome. Different nerve, different circling, different spacing.
  thinkT: number            // beat of consideration before the next move
  orbitPace: number         // how hard this one circles (multiplier on the tangential drift)
  spaceJitter: number       // personal comfort distance offset for the dance
  stance: Stance
  targetId: string | null
  kit: ArenaMove[]          // the canon 4-move kit as timed actions (cdLeft lives here)
  act: Act | null           // current move in flight
  st: StatusState           // canon statuses (ignition/regen/crystallize/fortify/surge/erosion/anchor)
  stage: StageState         // stat stages ±3 (pwr/grd/agi)
  // status timers, in seconds remaining (Keeper-aid layer)
  flinch: number            // stunned — cannot act, interrupts windups (Momo's flash)
  defDownT: number; defDownAmt: number   // grd reduced (Bonn's Reach)
  shieldT: number           // incoming damage reduced (Coilguard's Wardcoil)
  numbT: number             // Witherbloom — numbed strikes often whiff
  braceT: number            // defending → incoming halved
  hitFlash: number          // took a hit → renderer flashes the body white (impact read)
}

export interface AidSlot { id: AidId; name: string; cost: number; cd: number; cdLeft: number }

export interface Keeper {
  mana: number; maxMana: number; manaRegen: number
  breezeBoostT: number      // cool breeze: extra regen active (seconds)
  aid: AidSlot[]
  bagCdLeft: number         // potion lockout (80s) so you can't spam-heal through a fight
}

export type ArenaEvent =
  | { type: 'hit'; from: string; to: string; dmg: number; moveId: string; eff: 'super' | 'weak' | 'neutral' }
  | { type: 'move_start'; who: string; target: string; moveId: string; name: string; state: MoveState; heavy: boolean; windup: number }
  | { type: 'move_interrupt'; who: string; moveId: string }
  | { type: 'dodge'; who: string; from: string; moveId: string }        // the visible sidestep
  | { type: 'status'; who: string; status: StatusId }
  | { type: 'stat'; who: string; stat: 'pwr' | 'grd' | 'agi'; stages: number }
  | { type: 'aid'; id: AidId; target?: string }
  | { type: 'bag' }
  | { type: 'miss'; who: string }                                       // a self-fumble (numbed), NOT a dodge
  | { type: 'ko'; who: string }

export interface ArenaState {
  t: number
  R: number
  fighters: Fighter[]
  keeper: Keeper
  outcome: 'ongoing' | 'win' | 'lose' | 'fled'
  events: ArenaEvent[]      // drained by the renderer each frame; kept here for headless assertions
  rng: () => number
}

export type KeeperCommand =
  | { type: 'aid'; id: AidId; targetId?: string }
  | { type: 'speak'; fighterId: string; stance: Stance }
  | { type: 'bag'; targetId?: string }
  | { type: 'flee' }

// ── deterministic rng (mulberry32) — same family the cabinets seed the Daily with ──
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Aid technique catalog + Keeper kits ─────────────────────────────────────────
// Canon (game/shimmer-combat.md): Aid = 3 techniques = 2 the KEEPER'S own channeled
// magic + 1 the bonded MANA'MAL'S gift. Aid enables, never deals damage. A bonded
// Mana'mal never fights — it does its natural thing and that helps you. So a kit is
// the Keeper's two channels plus whichever Mana'mal is bonded (the swappable 3rd slot).
type AidDef = { id: AidId; name: string; cost: number; cd: number }

// Keeper channels — Bonn's own runes (the only ruled Keeper so far).
const CHANNELS: Record<string, AidDef> = {
  breeze: { id: 'breeze', name: 'Cool Breeze', cost: 2, cd: 8 },  // Flow sustain — mana trickle
  reach:  { id: 'reach',  name: 'Reach',       cost: 3, cd: 5 },  // single-target defence-down
}
// Mana'mal gifts — the 3rd slot, keyed by the bonded companion. Each is that creature's
// canonical natural behaviour turned mechanical (mechanic = Jin; the technique NAME/lore
// is Magii's — 'flash'/Momo is ruled, the rest carry mechanic-labels pending a ruling).
const GIFTS: Record<string, AidDef> = {
  duskpuff:   { id: 'flash',       name: 'Rainbow Flash', cost: 4, cd: 6 },   // Momo — startle-burst → flinch/interrupt (RULED)
  coilguard:  { id: 'wardcoil',    name: 'Wardcoil',      cost: 3, cd: 9 },   // Coilguard — plates lock + tail-coil shelters an ally, damage cut (RULED 2026-07-05)
  frilldrift: { id: 'witherbloom', name: 'Witherbloom',   cost: 4, cd: 10 },  // Frilldrift — contact toxin numbs a foe; its strikes often whiff (RULED 2026-07-05)
}
export type ManamalId = keyof typeof GIFTS
export interface AidKit { channels: AidId[]; gift: AidId }

// Bonn + Momo — the ruled starter kit.
export const BONN_MOMO_KIT: AidKit = { channels: ['breeze', 'reach'], gift: 'flash' }
export function kitForManamal(m: ManamalId): AidKit { return { channels: ['breeze', 'reach'], gift: GIFTS[m].id } }

const AID_DEFS: Record<AidId, AidDef> = {
  ...Object.fromEntries(Object.values(CHANNELS).map(d => [d.id, d])),
  ...Object.fromEntries(Object.values(GIFTS).map(d => [d.id, d])),
} as Record<AidId, AidDef>

// Build the keeper's 3 live Aid slots from a kit: gift first (top corner), then channels.
function buildAid(kit: AidKit): AidSlot[] {
  return [kit.gift, ...kit.channels].map(id => ({ ...AID_DEFS[id], cdLeft: 0 }))
}

// Fights are duels, not pings — HP is padded well above the turn-based pool so the
// telegraph→react→payoff loop cycles many times before anyone falls.
const HP_MULT = 2.6

function fighterFromSpirit(spirit: Spirit, id: string, side: Side, x: number, y: number, slot: number, tier: ArenaAITier, collared: boolean): Fighter {
  const s = derivePartyStats(spirit)
  const speed = 1.6 + s.agi / 40           // agi → footspeed
  const maxHp = Math.round(s.maxHp * HP_MULT)
  // Attack = the spirit's real damage axis. Physical units hit on pwr, casters channel on foc
  // (owl/firefly/bat). Reading pwr alone gimped every caster — use whichever is their strength.
  const atk = Math.max(s.pwr, s.foc)
  return {
    id, side, species: spirit.species, element: spirit.element, bElement: toBattleElement(spirit.element),
    name: spirit.name,
    x, y, facing: side === 'ally' ? 0 : Math.PI,
    hp: maxHp, maxHp, level: spirit.level, pwr: atk, grd: s.grd, agi: s.agi,
    radius: 0.35 + s.maxHp / 260, speed,
    reach: 0.9, orbitDir: slot % 2 === 0 ? 1 : -1,
    tier, collared,
    thinkT: 0, orbitPace: 0.55, spaceJitter: 0,
    stance: 'aggressive', targetId: null,
    kit: kitForSpirit(spirit), act: null, st: freshStatus(), stage: freshStages(),
    flinch: 0, defDownT: 0, defDownAmt: 0, shieldT: 0, numbT: 0, braceT: 0, hitFlash: 0,
  }
}

export interface ArenaSpec {
  allies: Spirit[]
  enemies: Spirit[]
  seed: number
  R?: number
  aidKit?: AidKit           // the Keeper's kit (2 channels + bonded Mana'mal gift); defaults to Bonn + Momo
  enemyTier?: ArenaAITier   // enemy decision quality (holds pass 'champion'); default wild instinct
  collared?: number[]       // enemy indices that are collared captives (compelled fighters, freed on win)
}

export function createArena(spec: ArenaSpec): ArenaState {
  const R = spec.R ?? 7
  const fighters: Fighter[] = []
  spec.allies.forEach((sp, i) => {
    const n = spec.allies.length
    fighters.push(fighterFromSpirit(sp, `a${i}`, 'ally', spread(i, n) * 2.2, -R * 0.55, i, 'wild', false))
  })
  spec.enemies.forEach((sp, i) => {
    const n = spec.enemies.length
    fighters.push(fighterFromSpirit(sp, `e${i}`, 'enemy', spread(i, n) * 2.2, R * 0.55, i, spec.enemyTier ?? 'wild', spec.collared?.includes(i) ?? false))
  })
  const rng = mulberry32(spec.seed)
  // Break the mirror before the first tick: stagger each fighter's opening clocks and
  // seed a personal movement temperament, all off the arena seed (still deterministic).
  for (const f of fighters) {
    f.thinkT = rng() * 0.7
    for (const m of f.kit) m.cdLeft = rng() * 0.9
    f.orbitPace = 0.3 + rng() * 0.5
    f.spaceJitter = (rng() - 0.5) * 0.7
  }
  return {
    t: 0, R, fighters,
    keeper: { mana: 6, maxMana: 12, manaRegen: 1.1, breezeBoostT: 0, aid: buildAid(spec.aidKit ?? BONN_MOMO_KIT), bagCdLeft: 0 },
    outcome: 'ongoing', events: [], rng,
  }
}

// spread combatants across a row: -0.5..0.5 for n>1, 0 for a lone fighter
function spread(i: number, n: number): number { return n <= 1 ? 0 : i / (n - 1) - 0.5 }

const alive = (f: Fighter) => f.hp > 0
const dist = (a: Fighter, b: Fighter) => Math.hypot(a.x - b.x, a.y - b.y)

function nearestEnemy(state: ArenaState, f: Fighter): Fighter | null {
  let best: Fighter | null = null, bd = Infinity
  for (const g of state.fighters) {
    if (g.side === f.side || !alive(g)) continue
    const d = dist(f, g)
    if (d < bd) { bd = d; best = g }
  }
  return best
}

// Trained/champion fighters FOCUS: they hunt the weakest standing foe (distance breaks
// ties) instead of whoever's closest. This is the real boss difficulty — coordinated
// pressure — with zero stat cheating.
function pickTarget(state: ArenaState, f: Fighter): Fighter | null {
  if (f.tier === 'wild') {
    // instinct is sticky: keep the current quarrel while it stands, else nearest
    const cur = f.targetId ? state.fighters.find(g => g.id === f.targetId && g.side !== f.side && alive(g)) : null
    return cur ?? nearestEnemy(state, f)
  }
  let best: Fighter | null = null, bs = Infinity
  for (const g of state.fighters) {
    if (g.side === f.side || !alive(g)) continue
    const s = g.hp / g.maxHp + dist(f, g) * 0.01
    if (s < bs) { bs = s; best = g }
  }
  return best
}

// ── effective stats — Keeper aids + canon statuses + stat stages, one place ────
function effGrd(f: Fighter): number {
  let g = f.grd * stageMult(f.stage.grd)
  if (f.defDownT > 0) g *= 1 - f.defDownAmt
  if (f.st.fortifyT > 0) g *= 1.25
  if (f.st.crystallized) g *= 0.8
  return g
}
function effAgi(f: Fighter): number { return f.agi * stageMult(f.stage.agi) }
function effSpeed(f: Fighter): number {
  if (f.st.anchorT > 0) return 0                  // rooted
  return f.speed * (f.st.fortifyT > 0 ? 0.7 : 1)  // locked in place is slow
}

/** An enemy heavy is winding at `id` — the clock defensive reads run on. */
function incomingHeavy(state: ArenaState, id: string): Fighter | null {
  return state.fighters.find(g =>
    alive(g) && g.act?.phase === 'windup' && g.act.move.heavy && g.act.targetId === id) ?? null
}

// Guard mitigates as a RATIO, never a wall: dmg = base * K/(K+grd). A stacked tank
// shrugs hits down to a third, but nothing reaches immunity — the linear subtraction
// this replaced let a +2-warded water-bear take literal 1s forever (96% stalemates).
const GRD_K = 80

function applyDamage(state: ArenaState, from: Fighter, to: Fighter, base: number, moveId: string, eff: 'super' | 'weak' | 'neutral', braceHalves = true) {
  const braced = braceHalves && to.braceT > 0
  let dmg = Math.max(1, Math.round(base * GRD_K / (GRD_K + effGrd(to))))
  if (braced) dmg = Math.max(1, Math.round(dmg * 0.5))
  if (to.shieldT > 0) dmg = Math.max(1, Math.round(dmg * 0.45))          // guarded → incoming softened
  if (to.st.crystallized) { dmg = Math.round(dmg * 1.25); to.st.crystallized = false }  // brittle shatters
  if (to.st.surgeT > 0) dmg = Math.round(dmg * 1.15)                     // rattled defenses
  to.hp = Math.max(0, to.hp - dmg)
  to.hitFlash = 0.16
  // knockback — the hit visibly lands (shoved along the attacker→target axis)
  const kb = braced ? 0.06 : 0.17
  const ang = Math.atan2(to.y - from.y, to.x - from.x)
  to.x += Math.cos(ang) * kb; to.y += Math.sin(ang) * kb
  state.events.push({ type: 'hit', from: from.id, to: to.id, dmg, moveId, eff })
  if (to.hp <= 0) state.events.push({ type: 'ko', who: to.id })
}

const WITHER_MISS = 0.5   // numbed → half its strikes whiff (knob)

// ── the tick — fixed dt, deterministic ─────────────────────────────────────────
export function tick(state: ArenaState, dt: number, commands: KeeperCommand[] = []) {
  // A settled fight must also settle its event buffer — leaving the killing blow's
  // events in place had the renderer re-performing them every frame (dmg-number spam
  // under the result overlay).
  if (state.outcome !== 'ongoing') { state.events.length = 0; return }
  state.events.length = 0
  state.t += dt

  // 1) Keeper commands
  for (const cmd of commands) applyCommand(state, cmd)
  if (state.outcome !== 'ongoing') return

  // 2) Keeper resource clocks
  const k = state.keeper
  const regen = k.manaRegen * (k.breezeBoostT > 0 ? 2 : 1)
  k.mana = Math.min(k.maxMana, k.mana + regen * dt)
  k.breezeBoostT = Math.max(0, k.breezeBoostT - dt)
  k.bagCdLeft = Math.max(0, k.bagCdLeft - dt)
  for (const a of k.aid) a.cdLeft = Math.max(0, a.cdLeft - dt)

  // 3) per-fighter clocks + statuses + AI
  for (const f of state.fighters) {
    if (!alive(f)) continue
    f.flinch = Math.max(0, f.flinch - dt)
    f.defDownT = Math.max(0, f.defDownT - dt)
    f.shieldT = Math.max(0, f.shieldT - dt)
    f.numbT = Math.max(0, f.numbT - dt)
    f.braceT = Math.max(0, f.braceT - dt)
    f.hitFlash = Math.max(0, f.hitFlash - dt)
    for (const m of f.kit) m.cdLeft = Math.max(0, m.cdLeft - dt)

    // canon status clocks
    const st = f.st
    if (st.ignitionT > 0) {                          // burning mana — DOT
      st.ignitionT = Math.max(0, st.ignitionT - dt)
      f.hp = Math.max(0, f.hp - (f.maxHp / 36) * dt)
      if (f.hp <= 0) { state.events.push({ type: 'ko', who: f.id }); continue }
    }
    if (st.regenT > 0) {                             // mending current
      st.regenT = Math.max(0, st.regenT - dt)
      f.hp = Math.min(f.maxHp, f.hp + (f.maxHp / 45) * dt)
    }
    if (st.erosionT > 0) {                           // stats crumble
      st.erosionT = Math.max(0, st.erosionT - dt)
      st.erosionTick -= dt
      if (st.erosionTick <= 0) {
        st.erosionTick = 2
        const stats: ('pwr' | 'grd' | 'agi')[] = ['pwr', 'grd', 'agi']
        const pick = stats[Math.floor(state.rng() * 3)]
        f.stage[pick] = Math.max(-3, f.stage[pick] - 1)
        state.events.push({ type: 'stat', who: f.id, stat: pick, stages: -1 })
      }
    }
    st.fortifyT = Math.max(0, st.fortifyT - dt)
    st.surgeT = Math.max(0, st.surgeT - dt)
    st.anchorT = Math.max(0, st.anchorT - dt)

    // flinch: frozen — and it breaks a windup (the Keeper's interrupt, and canon's)
    if (f.flinch > 0) {
      if (f.act?.phase === 'windup') {
        state.events.push({ type: 'move_interrupt', who: f.id, moveId: f.act.move.id })
        f.act = null
      }
      continue
    }

    const target = pickTarget(state, f)
    if (!target) continue
    f.targetId = target.id
    const d = dist(f, target)

    // a move in flight owns the fighter until it lands
    if (f.act) {
      const a = f.act
      a.t += dt
      if (a.phase === 'windup') {
        const tgt = state.fighters.find(g => g.id === a.targetId && alive(g))
        if (tgt) f.facing = Math.atan2(tgt.y - f.y, tgt.x - f.x)   // track through the windup
        if (a.t >= a.dur) {
          executeMove(state, f, a)
          f.act = { ...a, phase: 'recover', t: 0, dur: a.move.recover }
        }
      } else {
        // recover: give ground — the strike-and-reposition tempo, no glued scrum
        if (d < f.reach + f.radius + target.radius + 1.2) moveAway(f, target, dt * 0.85)
        if (a.t >= a.dur) {
          f.act = null
          // a beat of consideration — different nerve per spirit, so cadences drift
          // apart instead of locking step (champions barely hesitate)
          f.thinkT = f.tier === 'champion' ? 0.05 : 0.12 + state.rng() * 0.5
        }
      }
      clampToRing(state, f)
      continue
    }

    f.facing = Math.atan2(target.y - f.y, target.x - f.x)

    // considering: keep the feet moving (the dance) but hold the next move a beat
    if (f.thinkT > 0) {
      f.thinkT = Math.max(0, f.thinkT - dt)
      if (f.stance !== 'defend') orbit(f, target, dt)
      clampToRing(state, f)
      continue
    }

    // defending: hold at mid range; brace when a heavy is bearing down on me
    if (f.stance === 'defend') {
      const inc = incomingHeavy(state, f.id)
      if (inc && inc.act && inc.act.t / inc.act.dur > 0.45) f.braceT = Math.max(f.braceT, 0.4)
      const want = f.reach * 1.6
      if (d < want) moveAway(f, target, dt)
      else if (d > want + 0.6) moveToward(f, target, dt)
    }

    // pick the next move by instinct
    const mv = chooseMove(f.kit, {
      hpFrac: f.hp / f.maxHp,
      stages: f.stage,
      fortified: f.st.fortifyT > 0,
      incomingHeavy: !!incomingHeavy(state, f.id),
      targetElement: target.bElement,
      targetAnchored: target.st.anchorT > 0,
      defending: f.stance === 'defend',
      tier: f.tier,
    }, state.rng)

    if (mv) {
      const inRange = mv.range === 0 || d <= mv.range + f.radius + target.radius
      if (inRange) {
        mv.cdLeft = mv.cd
        f.act = { move: mv, phase: 'windup', t: 0, dur: mv.windup, targetId: target.id }
        state.events.push({ type: 'move_start', who: f.id, target: target.id, moveId: mv.id, name: mv.name, state: mv.state, heavy: mv.heavy, windup: mv.windup })
      } else if (f.stance !== 'defend') {
        moveTowardSpd(f, target, dt, effSpeed(f))
      }
    } else if (f.stance !== 'defend') {
      // the between-moves dance: circle the foe at strike range, visibly alive
      orbit(f, target, dt)
    }
    clampToRing(state, f)
  }

  // 4) outcome
  const allyLeft = state.fighters.some(f => f.side === 'ally' && alive(f))
  const enemyLeft = state.fighters.some(f => f.side === 'enemy' && alive(f))
  if (!enemyLeft) state.outcome = 'win'
  else if (!allyLeft) state.outcome = 'lose'
}

// ── move execution — dodges are events, damage is elemental, statuses are canon ──
function executeMove(state: ArenaState, f: Fighter, a: Act) {
  const m = a.move
  // numbed (Witherbloom) → the whole technique can fumble
  if (f.numbT > 0 && state.rng() < WITHER_MISS) { state.events.push({ type: 'miss', who: f.id }); return }

  // self-directed pieces land regardless of the foe
  if (m.selfEffect && state.rng() * 100 < (m.selfEffectChance ?? 100)) {
    applyStatus(f.st, m.selfEffect)
    state.events.push({ type: 'status', who: f.id, status: m.selfEffect })
  }
  for (const c of m.statChanges ?? []) {
    if (c.target !== 'self') continue
    if (!(c.stat in f.stage)) continue
    const key = c.stat as keyof StageState
    f.stage[key] = Math.max(-3, Math.min(3, f.stage[key] + c.stages))
    state.events.push({ type: 'stat', who: f.id, stat: key, stages: c.stages })
  }

  const foeDirected = m.power > 0 || m.effect || (m.statChanges ?? []).some(c => c.target === 'foe')
  if (!foeDirected) return

  let primary = state.fighters.find(g => g.id === a.targetId && alive(g))
  if (!primary) primary = nearestEnemy(state, f) ?? undefined
  if (!primary) return

  // the field moved during the windup — a foe that broke away simply isn't there
  const slack = 0.8
  const targets = m.aoe > 0
    ? state.fighters.filter(g => g.side !== f.side && alive(g) && Math.hypot(g.x - primary!.x, g.y - primary!.y) <= m.aoe)
    : (dist(f, primary) <= m.range + f.radius + primary.radius + slack ? [primary] : [])
  if (!targets.length) { state.events.push({ type: 'miss', who: f.id }); return }

  for (const tgt of targets) {
    // accuracy vs agility — resolved as a VISIBLE dodge
    const p = hitChance(m.accuracy, effAgi(f), effAgi(tgt), tgt.st.anchorT > 0)
    if (state.rng() >= p) {
      sidestep(state, f, tgt)
      state.events.push({ type: 'dodge', who: tgt.id, from: f.id, moveId: m.id })
      continue
    }
    if (m.power > 0) {
      const { base, label } = moveDamage(f.pwr, f.stage.pwr, m, f.bElement, tgt.bElement, state.t)
      applyDamage(state, f, tgt, base, m.id, label)
      if (!alive(tgt)) continue
    }
    if (m.effect && state.rng() * 100 < (m.effectChance ?? 100)) {
      applyStatus(tgt.st, m.effect)
      state.events.push({ type: 'status', who: tgt.id, status: m.effect })
    }
    for (const c of m.statChanges ?? []) {
      if (c.target !== 'foe') continue
      if (!(c.stat in tgt.stage)) continue
      const key = c.stat as keyof StageState
      tgt.stage[key] = Math.max(-3, Math.min(3, tgt.stage[key] + c.stages))
      state.events.push({ type: 'stat', who: tgt.id, stat: key, stages: c.stages })
    }
  }
}

/** The dodge made flesh: the target darts perpendicular to the attack axis. */
function sidestep(state: ArenaState, from: Fighter, tgt: Fighter) {
  const ang = Math.atan2(tgt.y - from.y, tgt.x - from.x) + (state.rng() < 0.5 ? 1 : -1) * Math.PI / 2
  tgt.x += Math.cos(ang) * 0.9
  tgt.y += Math.sin(ang) * 0.9
  clampToRing(state, tgt)
}

function moveToward(f: Fighter, t: Fighter, dt: number) { moveTowardSpd(f, t, dt, f.speed) }
function moveTowardSpd(f: Fighter, t: Fighter, dt: number, spd: number) {
  const a = Math.atan2(t.y - f.y, t.x - f.x)
  f.x += Math.cos(a) * spd * dt; f.y += Math.sin(a) * spd * dt
}
function moveAway(f: Fighter, t: Fighter, dt: number) {
  const a = Math.atan2(t.y - f.y, t.x - f.x) + Math.PI
  const spd = effSpeed(f)
  f.x += Math.cos(a) * spd * dt; f.y += Math.sin(a) * spd * dt
}

/** Hold strike range and circle — the fight breathes between moves instead of hugging. */
function orbit(f: Fighter, t: Fighter, dt: number) {
  const spd = effSpeed(f)
  if (spd <= 0) return
  const want = f.reach + f.radius + t.radius + 1.1 + f.spaceJitter
  const d = dist(f, t)
  if (d > want + 0.5) moveTowardSpd(f, t, dt, spd)
  else if (d < want - 0.5) moveAway(f, t, dt)
  const a = Math.atan2(t.y - f.y, t.x - f.x) + (Math.PI / 2) * f.orbitDir
  f.x += Math.cos(a) * spd * f.orbitPace * dt
  f.y += Math.sin(a) * spd * f.orbitPace * dt
}

function clampToRing(state: ArenaState, f: Fighter) {
  const lim = state.R * 0.97
  const r = Math.hypot(f.x, f.y)
  if (r > lim) { f.x *= lim / r; f.y *= lim / r }
}

function applyCommand(state: ArenaState, cmd: KeeperCommand) {
  const k = state.keeper
  if (cmd.type === 'flee') { state.outcome = 'fled'; return }
  if (cmd.type === 'speak') {
    const f = state.fighters.find(g => g.id === cmd.fighterId && g.side === 'ally')
    if (f) f.stance = cmd.stance
    return
  }
  if (cmd.type === 'bag') {
    if (k.bagCdLeft > 0) return
    const f = cmd.targetId ? state.fighters.find(g => g.id === cmd.targetId) : state.fighters.find(g => g.side === 'ally' && alive(g))
    if (!f || !alive(f)) return
    f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.4))
    k.bagCdLeft = 80
    state.events.push({ type: 'bag' })
    return
  }
  // aid
  const slot = k.aid.find(a => a.id === cmd.id)
  if (!slot || slot.cdLeft > 0 || k.mana < slot.cost) return
  k.mana -= slot.cost; slot.cdLeft = slot.cd
  state.events.push({ type: 'aid', id: slot.id, target: cmd.targetId })
  if (slot.id === 'flash') {
    for (const g of state.fighters) if (g.side === 'enemy' && alive(g)) g.flinch = Math.max(g.flinch, 0.9)
  } else if (slot.id === 'breeze') {
    k.breezeBoostT = Math.max(k.breezeBoostT, 5)
  } else if (slot.id === 'reach') {
    const g = cmd.targetId
      ? state.fighters.find(x => x.id === cmd.targetId && x.side === 'enemy' && alive(x))
      : nearestEnemyForKeeper(state)
    if (g) { g.defDownT = 5; g.defDownAmt = 0.5 }
  } else if (slot.id === 'wardcoil') {
    // Coilguard's gift — plates lock, tail-coil throws round the ally under the most pressure
    // (targeted by a heavy windup, else the lowest-HP standing ally). Incoming damage softened ~6s.
    const winding = state.fighters.filter(x => x.side === 'enemy' && alive(x) && x.act?.phase === 'windup' && x.act.move.heavy).map(x => x.act!.targetId)
    const g = cmd.targetId
      ? state.fighters.find(x => x.id === cmd.targetId && x.side === 'ally' && alive(x))
      : state.fighters.filter(x => x.side === 'ally' && alive(x))
          .sort((a, b) => (winding.includes(b.id) ? 1 : 0) - (winding.includes(a.id) ? 1 : 0) || a.hp - b.hp)[0]
    if (g) g.shieldT = 6
  } else if (slot.id === 'witherbloom') {
    // Frilldrift's gift — its contact toxin numbs a foe (canon: "burning numbness"). While
    // numbed the enemy's strikes often whiff — an enabler debuff, no damage. Targets the
    // picked enemy, else the hardest-hitting one (highest pwr) — numb the biggest threat.
    const g = cmd.targetId
      ? state.fighters.find(x => x.id === cmd.targetId && x.side === 'enemy' && alive(x))
      : state.fighters.filter(x => x.side === 'enemy' && alive(x)).sort((a, b) => b.pwr - a.pwr)[0]
    if (g) g.numbT = 8   // 8s of numbness (knob)
  }
}

function nearestEnemyForKeeper(state: ArenaState): Fighter | null {
  return state.fighters.filter(f => f.side === 'enemy' && alive(f)).sort((a, b) => a.hp - b.hp)[0] ?? null
}

// ── pre-script the whole fight at mount ─────────────────────────────────────────
// Runs the sim headless to completion and returns the outcome + the full event
// timeline. Because tick() is deterministic per seed, a renderer can then replay the
// SAME seed live — pacing it with hit-stop and KO slow-mo — and land on this exact
// outcome; skip jumps straight here.
export interface SimFrame { t: number; e: ArenaEvent }
export interface SimResult { outcome: ArenaState['outcome']; duration: number; timeline: SimFrame[] }

export function simulate(spec: ArenaSpec, capS = 90, commandsAt?: (s: ArenaState) => KeeperCommand[]): SimResult {
  const s = createArena(spec)
  const dt = 1 / 30
  const timeline: SimFrame[] = []
  while (s.outcome === 'ongoing' && s.t < capS) {
    tick(s, dt, commandsAt ? commandsAt(s) : [])
    for (const e of s.events) timeline.push({ t: s.t, e })
  }
  return { outcome: s.outcome, duration: s.t, timeline }
}
