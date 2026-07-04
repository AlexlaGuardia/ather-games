// ── Keeper's Arena — real-time battle sim (sim-first, no renderer) ──────────────
//
// Direction (2026-07-04, Alex): replace turn-based party combat with a real-time
// bounded arena. Spirits fight ON THEIR OWN by instinct (a live-nudgeable stance);
// the player is the KEEPER, whose agency is a scarce, timing-gated support kit —
// NOT a move menu. This is the anti-collar identity made mechanical: you coach and
// enable, you don't command. Pokémon = collar (order every move); Shimmer = Keeper.
//
// This module is PURE + DETERMINISTIC (seeded rng, fixed-timestep tick) so the feel
// can be oracle-proven headless before a single triangle is drawn — the same
// sim-first discipline every arcade cabinet shipped on. The proof we want: a good
// Keeper turns a losing fight (see arena.test.ts).
//
// Coordinate space: a flat disc of radius R. Fighters carry (x,y) on that floor;
// the 3D renderer (later) maps y→z and lifts a 3/4 iso camera over the ring.

import type { Species, Element, Spirit } from '../spirits/spirit'
import { derivePartyStats } from './party-stats'

export type Side = 'ally' | 'enemy'
export type Stance = 'aggressive' | 'defend'   // the live-nudgeable instinct (Speak flicks this)
export type AidId = 'flash' | 'breeze' | 'reach' | 'guard'

export interface Fighter {
  id: string
  side: Side
  species: Species
  element: Element
  name: string
  x: number; y: number
  facing: number            // radians — toward target / move dir (renderer turns the blockout to face)
  hp: number; maxHp: number
  pwr: number; grd: number; agi: number
  radius: number            // body scale — the "little one" reads small, gets swarmed
  speed: number             // floor units / sec
  reach: number             // melee range
  atkCd: number; atkInterval: number
  stance: Stance
  targetId: string | null
  // status timers, in seconds remaining
  flinch: number            // stunned — cannot act (Momo's flash)
  defDownT: number; defDownAmt: number   // grd reduced (Bonn's Reach)
  shieldT: number           // incoming damage reduced (a bonded guardian Mana'mal's gift)
  braceT: number            // defending → incoming halved
  recoverT: number          // just struck → give ground (the strike-and-reposition tempo, no glued scrum)
  hitFlash: number          // took a hit → renderer flashes the body white (impact read)
  // enemy heavy attack telegraph (the CLOCK the Keeper reads)
  wind: { t: number; dur: number; range: number; dmg: number; targetId: string } | null
  winCd: number
}

export interface AidSlot { id: AidId; name: string; cost: number; cd: number; cdLeft: number }

export interface Keeper {
  mana: number; maxMana: number; manaRegen: number
  breezeBoostT: number      // cool breeze: extra regen active (seconds)
  aid: AidSlot[]
  bagCdLeft: number         // potion lockout (80s) so you can't spam-heal through a fight
}

export type ArenaEvent =
  | { type: 'hit'; from: string; to: string; dmg: number }
  | { type: 'wind_start'; who: string; target: string }
  | { type: 'wind_land'; who: string; target: string; dmg: number }
  | { type: 'wind_interrupt'; who: string }
  | { type: 'aid'; id: AidId; target?: string }
  | { type: 'bag' }
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
  duskpuff:  { id: 'flash', name: 'Rainbow Flash', cost: 4, cd: 6 },  // Momo — startle-burst → flinch/interrupt (RULED)
  coilguard: { id: 'guard', name: 'Guard',         cost: 3, cd: 9 },  // sentinel — shelters an ally (damage taken cut)
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
// telegraph→react→payoff loop cycles many times before anyone falls (~5-6x longer).
const HP_MULT = 2.6

function fighterFromSpirit(spirit: Spirit, id: string, side: Side, x: number, y: number): Fighter {
  const s = derivePartyStats(spirit)
  const speed = 1.6 + s.agi / 40           // agi → footspeed
  const maxHp = Math.round(s.maxHp * HP_MULT)
  // Attack = the spirit's real damage axis. Physical units hit on pwr, casters channel on foc
  // (owl/firefly/bat). Reading pwr alone gimped every caster — use whichever is their strength.
  const atk = Math.max(s.pwr, s.foc)
  return {
    id, side, species: spirit.species, element: spirit.element, name: spirit.name,
    x, y, facing: side === 'ally' ? 0 : Math.PI,
    hp: maxHp, maxHp, pwr: atk, grd: s.grd, agi: s.agi,
    radius: 0.35 + s.maxHp / 260, speed,
    reach: 0.9, atkCd: 0.4, atkInterval: Math.max(0.95, 1.9 - s.agi / 70),
    stance: 'aggressive', targetId: null,
    flinch: 0, defDownT: 0, defDownAmt: 0, shieldT: 0, braceT: 0, recoverT: 0, hitFlash: 0,
    wind: null, winCd: 2.5,
  }
}

export interface ArenaSpec {
  allies: Spirit[]
  enemies: Spirit[]
  seed: number
  R?: number
  aidKit?: AidKit           // the Keeper's kit (2 channels + bonded Mana'mal gift); defaults to Bonn + Momo
}

export function createArena(spec: ArenaSpec): ArenaState {
  const R = spec.R ?? 7
  const fighters: Fighter[] = []
  spec.allies.forEach((sp, i) => {
    const n = spec.allies.length
    fighters.push(fighterFromSpirit(sp, `a${i}`, 'ally', spread(i, n) * 2.2, -R * 0.55))
  })
  spec.enemies.forEach((sp, i) => {
    const n = spec.enemies.length
    fighters.push(fighterFromSpirit(sp, `e${i}`, 'enemy', spread(i, n) * 2.2, R * 0.55))
  })
  return {
    t: 0, R, fighters,
    keeper: { mana: 6, maxMana: 12, manaRegen: 1.1, breezeBoostT: 0, aid: buildAid(spec.aidKit ?? BONN_MOMO_KIT), bagCdLeft: 0 },
    outcome: 'ongoing', events: [], rng: mulberry32(spec.seed),
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

function effGrd(f: Fighter): number { return f.defDownT > 0 ? f.grd * (1 - f.defDownAmt) : f.grd }

function applyDamage(state: ArenaState, from: Fighter, to: Fighter, base: number, braceHalves = true) {
  const braced = braceHalves && to.braceT > 0
  let dmg = Math.max(1, Math.round(base - effGrd(to) * 0.25))
  if (braced) dmg = Math.max(1, Math.round(dmg * 0.5))
  if (to.shieldT > 0) dmg = Math.max(1, Math.round(dmg * 0.45))   // guarded → incoming softened
  to.hp = Math.max(0, to.hp - dmg)
  to.hitFlash = 0.16
  // knockback — the hit visibly lands (shoved along the attacker→target axis)
  const kb = braced ? 0.06 : 0.17
  const ang = Math.atan2(to.y - from.y, to.x - from.x)
  to.x += Math.cos(ang) * kb; to.y += Math.sin(ang) * kb
  state.events.push({ type: 'hit', from: from.id, to: to.id, dmg })
  if (to.hp <= 0) state.events.push({ type: 'ko', who: to.id })
}

// ── the tick — fixed dt, deterministic ─────────────────────────────────────────
export function tick(state: ArenaState, dt: number, commands: KeeperCommand[] = []) {
  if (state.outcome !== 'ongoing') return
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

  // 3) per-fighter status clocks + AI
  for (const f of state.fighters) {
    if (!alive(f)) continue
    f.flinch = Math.max(0, f.flinch - dt)
    f.defDownT = Math.max(0, f.defDownT - dt)
    f.shieldT = Math.max(0, f.shieldT - dt)
    f.braceT = Math.max(0, f.braceT - dt)
    f.recoverT = Math.max(0, f.recoverT - dt)
    f.hitFlash = Math.max(0, f.hitFlash - dt)
    f.atkCd = Math.max(0, f.atkCd - dt)
    f.winCd = Math.max(0, f.winCd - dt)

    if (f.flinch > 0) { if (f.wind) { state.events.push({ type: 'wind_interrupt', who: f.id }); f.wind = null; f.winCd = Math.max(f.winCd, 1.2) } continue }

    const target = f.targetId ? state.fighters.find(g => g.id === f.targetId && alive(g)) ?? nearestEnemy(state, f) : nearestEnemy(state, f)
    if (!target) continue
    f.targetId = target.id
    f.facing = Math.atan2(target.y - f.y, target.x - f.x)
    const d = dist(f, target)

    // heavy wind-up — both sides channel one (spirits fight on their own). A defending spirit
    // holds instead. Enemy winds telegraph a danger-ring the Keeper times against; ally winds
    // just fire (your spirits doing their thing).
    if (f.stance !== 'defend') { stepWind(state, f, target, d, dt); if (f.wind) continue }

    const inReach = d <= f.reach + f.radius + target.radius
    if (f.stance === 'defend') {
      // hold at mid range; brace when a wind-up is bearing down on me
      const incoming = state.fighters.find(g => g.wind && g.wind.targetId === f.id)
      if (incoming && incoming.wind && incoming.wind.t / incoming.wind.dur > 0.45) f.braceT = Math.max(f.braceT, 0.4)
      const want = f.reach * 1.6
      if (d < want) moveAway(f, target, dt)
      else if (d > want + 0.6) moveToward(f, target, dt)
      if (inReach && f.atkCd <= 0) { basicAttack(state, f, target); f.atkCd = f.atkInterval * 1.25 }
    } else {
      // aggressive: strike-and-reposition — dart in, hit, give ground, re-close (no glued hug)
      if (f.recoverT > 0) {
        const space = f.reach + f.radius + target.radius + 1.2
        if (d < space) moveAway(f, target, dt * 0.85)
      } else if (!inReach) {
        moveToward(f, target, dt)
      } else if (f.atkCd <= 0) {
        moveToward(f, target, dt)      // small lunge into the blow
        basicAttack(state, f, target)
        f.atkCd = f.atkInterval; f.recoverT = f.atkInterval * 0.6
      }
    }
  }

  // 4) outcome
  const allyLeft = state.fighters.some(f => f.side === 'ally' && alive(f))
  const enemyLeft = state.fighters.some(f => f.side === 'enemy' && alive(f))
  if (!enemyLeft) state.outcome = 'win'
  else if (!allyLeft) state.outcome = 'lose'
}

function basicAttack(state: ArenaState, f: Fighter, target: Fighter) {
  applyDamage(state, f, target, f.pwr * 0.34)   // light — the heavy wind-up is the real threat
}

function stepWind(state: ArenaState, f: Fighter, target: Fighter, d: number, dt: number) {
  const foeSide: Side = f.side === 'ally' ? 'enemy' : 'ally'
  if (f.wind) {
    f.wind.t += dt
    if (f.wind.t >= f.wind.dur) {
      // land it on the opposite side within range of the strike point (target's position at fire)
      const tgt = state.fighters.find(g => g.id === f.wind!.targetId && alive(g))
      if (tgt) {
        for (const g of state.fighters) {
          if (g.side !== foeSide || !alive(g)) continue
          if (Math.hypot(g.x - tgt.x, g.y - tgt.y) <= f.wind.range) applyDamage(state, f, g, f.wind.dmg)
        }
        state.events.push({ type: 'wind_land', who: f.id, target: tgt.id, dmg: f.wind.dmg })
      }
      f.wind = null
      f.winCd = 5.5
    }
    return
  }
  // start a wind-up when off cooldown and roughly in position
  if (f.winCd <= 0 && d <= f.reach + 2.5) {
    f.wind = { t: 0, dur: 1.5, range: 1.0, dmg: f.pwr * 0.58, targetId: target.id }
    state.events.push({ type: 'wind_start', who: f.id, target: target.id })
  }
}

function moveToward(f: Fighter, t: Fighter, dt: number) {
  const a = Math.atan2(t.y - f.y, t.x - f.x)
  f.x += Math.cos(a) * f.speed * dt; f.y += Math.sin(a) * f.speed * dt
}
function moveAway(f: Fighter, t: Fighter, dt: number) {
  const a = Math.atan2(t.y - f.y, t.x - f.x) + Math.PI
  f.x += Math.cos(a) * f.speed * dt; f.y += Math.sin(a) * f.speed * dt
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
  } else if (slot.id === 'guard') {
    // Coilguard's gift — shelter the ally under the most pressure (targeted by a wind-up,
    // else the lowest-HP standing ally). Incoming damage softened for a few seconds.
    const winding = state.fighters.filter(f => f.side === 'enemy' && f.wind && alive(f)).map(f => f.wind!.targetId)
    const g = cmd.targetId
      ? state.fighters.find(x => x.id === cmd.targetId && x.side === 'ally' && alive(x))
      : state.fighters.filter(x => x.side === 'ally' && alive(x))
          .sort((a, b) => (winding.includes(b.id) ? 1 : 0) - (winding.includes(a.id) ? 1 : 0) || a.hp - b.hp)[0]
    if (g) g.shieldT = 6
  }
}

function nearestEnemyForKeeper(state: ArenaState): Fighter | null {
  return state.fighters.filter(f => f.side === 'enemy' && alive(f)).sort((a, b) => a.hp - b.hp)[0] ?? null
}
