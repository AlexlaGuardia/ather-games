// EXPEDITIONS — the breach sim, overhauled (see EXPEDITIONS_DESIGN.md).
// Tower-style survival on a 64x64 open arena: your core at the center, three
// guard posts in a TRINITY around it (engagement radius invisible in combat,
// shown only at placement). The FLOOD — fluid creatures — pours in from every
// direction, slow-leaning, and pools/merges into bigger forms near the core.
// There is no winning. You survive and chase score. When the core fills, the
// Tsunamizilla rises and washes the board out — the fail state IS the boss.
// Deterministic: (tier, seed, loadout) -> identical run.
//
// What the tide is stays unnamed. (Rule of Drowning — see world/nolmir.md.)

import { mulberry32, Rng } from './rng'
import { GuardCategory, ProfileRole, SkillEffect } from './profiles'

// ---- the arena ----
export const BREACH_W = 64 // kept names for the renderer's import surface
export const BREACH_H = 64
export const GATE_X = 32 // the core sits at center
export const GATE_Y = 32
const CORE_BODY = 1 // chebyshev radius of the impassable core block (3x3)
const CORE_HIT = 2 // flood within this chebyshev range strikes the core
const PERIM = 1 // flood spawns this far inside the border

export const LEASH_R = 12 // guard engagement radius (drawn only while placing)
const GUARD_RANGE = LEASH_R
const GUARD_COOLDOWN = 2 // ticks between shots
const GUARD_RESPAWN = 90 // ticks a downed post stays dark before it re-forms
const KIT_HP = 2.0
const KIT_ATK = 1.4

// flood speed in tiles/tick — slow-leaning. (continuous glide; ~1/old-step.)
const DRIFT_SPEED = 0.34
const SWIFT_SPEED = 0.5
const BULK_SPEED = 0.25
const BEHEMOTH_SPEED = 0.2

// 8-neighbour offsets — diagonals included for octile pathing + smooth headings
const NEI8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const
const WAVE_BREAK = 36 // ticks of quiet between waves
const BREAK_MEND = 0.18 // share of missing core integrity mended in the lull
const GATE_BASE = 240 // core integrity
const MAX_TICKS = 120_000 // backstop — endless, but bounded

const MERGE_RING = 10 // flood within this gradient-distance of the core can pool
const MERGE_EVERY = 4 // ticks between merge passes
const MAX_MERGE_HP = 5 // a behemoth caps at ~5x a drift's mass
const SURGE_EVERY = 6 // every Nth wave the tide swells against one arc
const TSUNAMI_TICKS = 42 // the wash holds the run open so the spectacle can play

// ---- role effects ----
const SPLASH_R = 2.4 // splash hits flood within this radius of the primary
const SPLASH_FRAC = 0.5 // splash deals this fraction to the neighbours
const FROST_R = 1.8 // frost slows flood within this radius of the primary
const FROST_DUR = 36 // ticks a slow lasts
const FROST_SLOW = 0.5 // slowed flood move at this fraction of speed
const PULSE_KB = 4 // tiles a pulse shoves the primary back out from the core
const PULSE_STUN = 12 // ticks a shoved unit is stunned (can't act)
const EXECUTE_RING = 12 // gradient-distance within which 'execute' skills bite extra

// ---- menders (sustain) — hybrid: they chip the flood AND mend the line ----
// All tunable. A mender bites at MEND_CHIP_FRAC of a dealer's damage, and on the
// same cycle heals wounded allies: single-target (role 'sniper') by MEND_HEAL_FRAC
// x atk, or area (role 'splash') across MEND_SPLASH_R at MEND_SPLASH_SCALE of that.
const MEND_CHIP_FRAC = 0.5 // menders' flood damage vs a full dealer
const MEND_HEAL_FRAC = 1.6 // single-target heal per cycle = this x the mender's atk
const MEND_SPLASH_SCALE = 0.6 // area heal per ally = this x the single-target heal
const MEND_SPLASH_R = 3.5 // tiles — bloom's mend radius (extended by splashR skills)

// ---- doctrines — the hand the host keeps after the gate closes ----

export type DoctrineId = 'aggressive' | 'bulwark' | 'balanced'

export const DOCTRINES: { id: DoctrineId; name: string; line: string; weights: [number, number, number] }[] = [
  { id: 'aggressive', name: 'Assault', line: 'drown them before they reach the core', weights: [0.6, 0.2, 0.2] },
  { id: 'bulwark', name: 'Bulwark', line: 'the posts hold, the core holds', weights: [0.2, 0.6, 0.2] },
  { id: 'balanced', name: 'Doctrine of the Line', line: 'spend where the line bends', weights: [1, 1, 1] },
]

const TRACK_BASE_COST = 18
const TRACK_COST_RAMP = 1.5

// ---- the arena map — open ground around an impassable core ----

export interface BreachMap {
  w: number
  h: number
  walls: Uint8Array // 1 = wall (the core body)
  dist: Int32Array // BFS gradient: 0 at the core ring, rising outward
}

function inCoreBody(x: number, y: number): boolean {
  return Math.max(Math.abs(x - GATE_X), Math.abs(y - GATE_Y)) <= CORE_BODY
}

export function makeBreachMap(): BreachMap {
  const walls = new Uint8Array(BREACH_W * BREACH_H) // open field
  for (let y = 0; y < BREACH_H; y++) {
    for (let x = 0; x < BREACH_W; x++) {
      if (inCoreBody(x, y)) walls[y * BREACH_W + x] = 1
    }
  }
  // gradient: seed every floor cell adjacent to the core body at 0, BFS outward
  const dist = new Int32Array(BREACH_W * BREACH_H).fill(-1)
  const queue: number[] = []
  for (let y = 0; y < BREACH_H; y++) {
    for (let x = 0; x < BREACH_W; x++) {
      if (walls[y * BREACH_W + x]) continue
      if (Math.max(Math.abs(x - GATE_X), Math.abs(y - GATE_Y)) <= CORE_BODY + 1) {
        dist[y * BREACH_W + x] = 0
        queue.push(y * BREACH_W + x)
      }
    }
  }
  let head = 0
  while (head < queue.length) {
    const idx = queue[head++]
    const x = idx % BREACH_W
    const y = (idx / BREACH_W) | 0
    for (const [dx, dy] of NEI8) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= BREACH_W || ny >= BREACH_H) continue
      const nidx = ny * BREACH_W + nx
      if (dist[nidx] !== -1 || walls[nidx]) continue
      dist[nidx] = dist[idx] + 1
      queue.push(nidx)
    }
  }
  return { w: BREACH_W, h: BREACH_H, walls, dist }
}

// default trinity — three posts ~120deg around the core, overridden by placement
export function defaultAnchors(): { x: number; y: number }[] {
  // ~120deg apart at radius ~10 so each post's range covers the core it guards
  return [
    { x: GATE_X, y: GATE_Y - 10 }, // top
    { x: GATE_X - 9, y: GATE_Y + 5 }, // lower-left
    { x: GATE_X + 9, y: GATE_Y + 5 }, // lower-right
  ]
}

export function validAnchor(x: number, y: number): boolean {
  if (x < 1 || y < 1 || x >= BREACH_W - 1 || y >= BREACH_H - 1) return false
  const cheb = Math.max(Math.abs(x - GATE_X), Math.abs(y - GATE_Y))
  return cheb >= 4 && cheb <= 26 // a ring around the core, off the body, off the rim
}

// ---- units ----

export type TideKind = 'drift' | 'swift' | 'bulk' | 'behemoth'

export interface TideUnit {
  id: number
  kind: TideKind
  x: number // float — sub-tile position (continuous movement)
  y: number
  fx: number // heading / facing — unit vector toward travel (0,0 = up/idle)
  fy: number
  hp: number
  maxHp: number
  atk: number
  speed: number // tiles per tick — higher is faster
  mass: number // merge weight (drift = 1)
  slowUntil: number // frost — moves at FROST_SLOW until this tick (0 = none)
  stunUntil: number // pulse — can't act until this tick (0 = none)
  alive: boolean
  spawnAt: number // tick it enters the arena
}

export interface ExpedGuard {
  name: string
  glyph: string
  x: number
  y: number
  anchorX: number
  anchorY: number
  hp: number
  maxHp: number
  atk: number
  cooldown: number
  range: number // engagement radius (from the equipped profile)
  role: ProfileRole // attack effect
  category: GuardCategory // sustain guards mend the line instead of pure damage
  sprite?: string // shared profile art — drawn on the post when present
  skills: SkillEffect // talent-unlocked modifiers
  alive: boolean
  downUntil: number // tick the post re-forms (0 = up)
}

export interface ExpedShot {
  x0: number
  y0: number
  x1: number
  y1: number
  at: number
}

export interface GuardLoadout {
  name: string
  glyph: string
  hp: number
  atk: number
  range?: number // per-profile engagement radius (defaults to GUARD_RANGE)
  role?: ProfileRole // drives the attack effect (sniper/splash/frost/bulwark/pulse)
  category?: GuardCategory // sustain = a mender (heals the line)
  sprite?: string // shared profile art path (drawn on the post when it loads)
  skills?: SkillEffect // talent-unlocked lineup modifiers
}

export interface RunConfig {
  tier: number
  seed: number
  doctrine: DoctrineId
  squad: GuardLoadout[]
  anchors: { x: number; y: number }[]
  gateBonus: number // extra core integrity from workshop plating
  salvageMult: number
  gateMult?: number
  trackCostMult?: number
}

export interface RunResult {
  tier: number
  seed: number
  doctrine: DoctrineId
  roster: string[]
  wave: number
  kills: number
  salvageEarned: number
  ticks: number
  marks: number
  milestones: number
  gateFell: boolean // true = the core filled (Tsunamizilla); false = backstop
  at?: number
}

export interface ExpedState {
  cfg: RunConfig
  map: BreachMap
  rng: Rng
  tick: number
  wave: number
  waveCleared: number
  phase: 'breaking' | 'wave'
  breakLeft: number
  spawnQueue: TideUnit[]
  tide: TideUnit[]
  guards: ExpedGuard[]
  shots: ExpedShot[]
  gate: number // core integrity remaining
  gateMax: number
  salvage: number
  salvageEarned: number
  kills: number
  tracks: [number, number, number] // assault / bulwark / logistics
  feed: string[]
  surge: boolean // this wave swells against one arc
  tsunami: boolean // the core fell — the wash is rising (renderer flag)
  tsunamiAt: number // tick the wash began (0 = not falling)
  sfx: string[] // sound tags pushed this tick — the renderer drains + plays them
  done: boolean
  result: RunResult | null
}

// ---- scaling ----

function tierMult(tier: number): number {
  return Math.pow(2.2, tier - 1)
}

function waveCount(wave: number): number {
  return 4 + Math.floor(wave * 0.8)
}

function tideHp(wave: number, tier: number): number {
  return Math.round(9 * Math.pow(1.13, wave - 1) * tierMult(tier))
}

function tideAtk(wave: number, tier: number): number {
  return Math.round(3 * Math.pow(1.09, wave - 1) * tierMult(tier))
}

function salvageValue(kind: TideKind, wave: number): number {
  const base = kind === 'behemoth' ? 8 : kind === 'bulk' ? 5 : 2
  return base * (1 + 0.06 * wave)
}

export function marksForWave(wave: number, tier: number): number {
  return Math.round(Math.pow(wave, 1.5) * Math.pow(2, tier - 1))
}

// the grid cell a (float-positioned) unit currently occupies
function tileIdx(u: { x: number; y: number }): number {
  const tx = Math.max(0, Math.min(BREACH_W - 1, Math.round(u.x)))
  const ty = Math.max(0, Math.min(BREACH_H - 1, Math.round(u.y)))
  return ty * BREACH_W + tx
}

// ---- spawning: omnidirectional, biased toward the seams ----

let unitId = 0

// the angle of each live post from the core — used to find the gaps
function guardAngles(s: ExpedState): number[] {
  return s.guards.filter((g) => g.alive).map((g) => Math.atan2(g.anchorY - GATE_Y, g.anchorX - GATE_X))
}

function angDist(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2)
  if (d > Math.PI) d = Math.PI * 2 - d
  return d
}

// pick a spawn angle, rejection-sampled toward the arc least covered by a post
function spawnAngle(s: ExpedState): number {
  const angles = guardAngles(s)
  if (angles.length === 0) return s.rng() * Math.PI * 2
  let best = s.rng() * Math.PI * 2
  let bestGap = -1
  for (let i = 0; i < 3; i++) {
    const cand = s.rng() * Math.PI * 2
    const gap = Math.min(...angles.map((a) => angDist(cand, a)))
    if (gap > bestGap) {
      bestGap = gap
      best = cand
    }
  }
  return best
}

// project an angle onto the arena rim
function rimCell(angle: number): { x: number; y: number } {
  const r = BREACH_W / 2 - PERIM
  const x = Math.round(GATE_X + Math.cos(angle) * r)
  const y = Math.round(GATE_Y + Math.sin(angle) * r)
  return {
    x: Math.max(PERIM, Math.min(BREACH_W - 1 - PERIM, x)),
    y: Math.max(PERIM, Math.min(BREACH_H - 1 - PERIM, y)),
  }
}

function buildWave(s: ExpedState): TideUnit[] {
  const { rng, wave } = s
  const tier = s.cfg.tier
  const surge = wave % SURGE_EVERY === 0
  s.surge = surge
  if (surge) s.feed.unshift(`the tide swells — it gathers against one arc`)
  // a surge concentrates the flood on a single arc; otherwise spread the field
  const surgeAngle = surge ? spawnAngle(s) : 0
  const n = waveCount(wave) + (surge ? Math.floor(wave * 0.4) : 0)
  const units: TideUnit[] = []
  for (let i = 0; i < n; i++) {
    const angle = surge ? surgeAngle + (rng() - 0.5) * 0.5 : spawnAngle(s)
    const cell = rimCell(angle)
    let kind: TideKind = 'drift'
    if (wave >= 4 && rng() < 0.22) kind = 'swift'
    if (wave >= 5 && rng() < 0.16) kind = 'bulk'
    const mass = kind === 'bulk' ? 2 : 1
    const hp = Math.round(tideHp(wave, tier) * (kind === 'bulk' ? 3 : kind === 'swift' ? 0.6 : 1))
    units.push({
      id: ++unitId,
      kind,
      x: cell.x,
      y: cell.y,
      fx: 0,
      fy: 0,
      hp,
      maxHp: hp,
      atk: tideAtk(wave, tier),
      speed: kind === 'swift' ? SWIFT_SPEED : kind === 'bulk' ? BULK_SPEED : DRIFT_SPEED,
      mass,
      slowUntil: 0,
      stunUntil: 0,
      alive: false,
      spawnAt: s.tick + i * 3,
    })
  }
  return units
}

export function startRun(cfg: RunConfig): ExpedState {
  const map = makeBreachMap()
  const gateMax = Math.round((GATE_BASE + cfg.gateBonus) * (cfg.gateMult ?? 1))
  const s: ExpedState = {
    cfg,
    map,
    rng: mulberry32(cfg.seed),
    tick: 0,
    wave: 1,
    waveCleared: 0,
    phase: 'breaking',
    breakLeft: 12,
    spawnQueue: [],
    tide: [],
    guards: cfg.squad.map((g, i) => {
      const a = cfg.anchors[i] ?? defaultAnchors()[i] ?? defaultAnchors()[0]
      const hp = Math.round(g.hp * KIT_HP)
      return {
        name: g.name,
        glyph: g.glyph,
        x: a.x,
        y: a.y,
        anchorX: a.x,
        anchorY: a.y,
        hp,
        maxHp: hp,
        atk: Math.round(g.atk * KIT_ATK),
        cooldown: 0,
        range: g.range ?? GUARD_RANGE,
        role: g.role ?? 'sniper',
        category: g.category ?? 'vanguard',
        sprite: g.sprite,
        skills: g.skills ?? {},
        alive: true,
        downUntil: 0,
      }
    }),
    shots: [],
    gate: gateMax,
    gateMax,
    salvage: 0,
    salvageEarned: 0,
    kills: 0,
    tracks: [0, 0, 0],
    feed: [],
    surge: false,
    tsunami: false,
    tsunamiAt: 0,
    sfx: [],
    done: false,
    result: null,
  }
  return s
}

function trackCost(level: number): number {
  return Math.round(TRACK_BASE_COST * Math.pow(TRACK_COST_RAMP, level))
}

// the squad manages itself — salvage spent automatically, steered by doctrine
function autoSpend(s: ExpedState) {
  const weights = DOCTRINES.find((d) => d.id === s.cfg.doctrine)!.weights
  const costMult = s.cfg.trackCostMult ?? 1
  const cost = (lv: number) => Math.round(trackCost(lv) * costMult)
  for (;;) {
    let best = -1
    let bestScore = -1
    for (let t = 0; t < 3; t++) {
      const score = weights[t] / (s.tracks[t] + 1)
      if (score > bestScore && s.salvage >= cost(s.tracks[t])) {
        bestScore = score
        best = t
      }
    }
    if (best === -1) return
    s.salvage -= cost(s.tracks[best])
    s.tracks[best]++
    const lv = s.tracks[best]
    if (best === 0) {
      for (const g of s.guards) g.atk = Math.round(g.atk * 1.15)
      s.feed.unshift(`assault ${lv} — the volleys bite harder`)
    } else if (best === 1) {
      for (const g of s.guards) {
        g.maxHp = Math.round(g.maxHp * 1.15)
        if (g.alive) g.hp = Math.min(g.maxHp, g.hp + Math.round((g.maxHp - g.hp) * 0.25))
      }
      s.feed.unshift(`bulwark ${lv} — the posts thicken, the core holds`)
    } else {
      s.gate = Math.min(s.gateMax, s.gate + 10)
      s.feed.unshift(`logistics ${lv} — salvage runs richer, the core mends`)
    }
    s.feed = s.feed.slice(0, 5)
  }
}

function salvageGain(s: ExpedState, kind: TideKind): number {
  const logi = 1 + 0.15 * s.tracks[2]
  return salvageValue(kind, s.wave) * logi * s.cfg.salvageMult
}

// deal damage to a flood unit, banking the kill + salvage if it drops
function damageUnit(s: ExpedState, u: TideUnit, dmg: number) {
  if (!u.alive) return
  u.hp -= dmg
  if (u.hp <= 0) {
    u.alive = false
    s.kills++
    s.sfx.push('death')
    const gain = salvageGain(s, u.kind)
    s.salvage += gain
    s.salvageEarned += gain
  }
}

// fluid-merge: flood that pools near the core combines into bigger forms.
// deterministic — iterate in id order, fold a smaller neighbour into a larger.
function mergePass(s: ExpedState) {
  const near = s.tide.filter(
    (u) => u.alive && u.kind !== 'behemoth' && (s.map.dist[tileIdx(u)] ?? 99) <= MERGE_RING,
  )
  near.sort((a, b) => a.id - b.id)
  for (const u of near) {
    if (!u.alive) continue
    if (u.mass >= MAX_MERGE_HP) continue
    // find an adjacent live poolable unit to fold in (float positions)
    let mate: TideUnit | null = null
    for (const o of near) {
      if (o === u || !o.alive) continue
      if (Math.abs(o.x - u.x) < 1.4 && Math.abs(o.y - u.y) < 1.4) {
        mate = o
        break
      }
    }
    if (!mate) continue
    const mass = Math.min(MAX_MERGE_HP, u.mass + mate.mass)
    u.hp += mate.hp
    u.maxHp += mate.maxHp
    u.atk = Math.round((u.atk + mate.atk) * 0.7) // bigger but not strictly additive
    u.mass = mass
    u.kind = mass >= 4 ? 'behemoth' : mass >= 2 ? 'bulk' : u.kind
    u.speed = mass >= 4 ? BEHEMOTH_SPEED : BULK_SPEED // the bigger it gets, the slower it wallows
    mate.alive = false
  }
}

function endRun(s: ExpedState, gateFell: boolean) {
  s.done = true
  if (gateFell) s.tsunami = true
  const wave = s.waveCleared
  s.result = {
    tier: s.cfg.tier,
    seed: s.cfg.seed,
    doctrine: s.cfg.doctrine,
    roster: s.cfg.squad.map((g) => g.name),
    wave,
    kills: s.kills,
    salvageEarned: Math.round(s.salvageEarned),
    ticks: s.tick,
    marks: marksForWave(Math.max(1, wave), s.cfg.tier),
    milestones: Math.floor(wave / 5),
    gateFell,
  }
}

export function stepRun(s: ExpedState) {
  if (s.done) return
  s.tick++
  // the wash — once the core falls, freeze the sim and let the Tsunamizilla
  // rise for TSUNAMI_TICKS before the run finalizes (so the spectacle plays).
  if (s.tsunamiAt > 0) {
    if (s.tick - s.tsunamiAt >= TSUNAMI_TICKS) endRun(s, true)
    return
  }
  if (s.tick >= MAX_TICKS) return endRun(s, false)

  // --- post respawn: downed trinity posts re-form on a cooldown ---
  for (const g of s.guards) {
    if (!g.alive && g.downUntil > 0 && s.tick >= g.downUntil) {
      g.alive = true
      g.hp = Math.round(g.maxHp * 0.6) // re-forms wounded
      g.downUntil = 0
      g.x = g.anchorX
      g.y = g.anchorY
      s.feed.unshift(`${g.name} re-forms at the post`)
      s.feed = s.feed.slice(0, 5)
    }
  }

  // --- wave flow ---
  if (s.phase === 'breaking') {
    s.breakLeft--
    if (s.breakLeft <= 0) {
      s.phase = 'wave'
      s.spawnQueue = buildWave(s)
    }
  } else {
    for (const u of s.spawnQueue) {
      if (!u.alive && u.hp > 0 && u.spawnAt <= s.tick) {
        u.alive = true
        s.tide.push(u)
      }
    }
    s.spawnQueue = s.spawnQueue.filter((u) => !u.alive && u.hp > 0)
    if (s.spawnQueue.length === 0 && s.tide.every((u) => !u.alive)) {
      s.waveCleared = s.wave
      s.wave++
      s.sfx.push('waveClear')
      s.phase = 'breaking'
      s.breakLeft = WAVE_BREAK
      s.tide = s.tide.filter((u) => u.alive)
      // the lull — the core knits a little
      s.gate = Math.min(s.gateMax, s.gate + Math.round((s.gateMax - s.gate) * BREAK_MEND))
    }
  }

  // --- guards: stationary posts, shoot the nearest-to-core flood in range ---
  for (const g of s.guards) {
    if (!g.alive) continue
    if (g.cooldown > 0) g.cooldown--
    let shoot: TideUnit | null = null
    let shootCoreD = Infinity
    for (const u of s.tide) {
      if (!u.alive) continue
      const d = Math.abs(u.x - g.x) + Math.abs(u.y - g.y)
      if (d <= g.range) {
        const cd = s.map.dist[tileIdx(u)]
        if (cd !== -1 && cd < shootCoreD) {
          shootCoreD = cd
          shoot = u
        }
      }
    }
    // a mender acts when there's a wound to tend, even with no flood in range
    let mendNeeded = false
    if (g.category === 'sustain') {
      const r = g.role === 'splash' ? MEND_SPLASH_R + (g.skills.splashR ?? 0) : g.range
      for (const o of s.guards) {
        if (o === g || !o.alive || o.hp >= o.maxHp) continue
        const within =
          g.role === 'splash'
            ? Math.hypot(o.x - g.x, o.y - g.y) <= r
            : Math.abs(o.x - g.x) + Math.abs(o.y - g.y) <= r
        if (within) {
          mendNeeded = true
          break
        }
      }
    }

    const acts = g.cooldown === 0 && (shoot || mendNeeded)
    if (acts) {
      g.cooldown = GUARD_COOLDOWN
      const sk = g.skills

      // menders mend — the heal shape follows the role: pick one wound (sniper)
      // or blossom over the line (splash). atk doubles as mend potency.
      if (g.category === 'sustain') {
        const heal = g.atk * MEND_HEAL_FRAC * (g.role === 'splash' ? MEND_SPLASH_SCALE : 1)
        let healed = false
        if (g.role === 'splash') {
          const r = MEND_SPLASH_R + (sk.splashR ?? 0)
          for (const o of s.guards) {
            if (o === g || !o.alive || o.hp >= o.maxHp) continue
            if (Math.hypot(o.x - g.x, o.y - g.y) <= r) {
              o.hp = Math.min(o.maxHp, o.hp + heal)
              healed = true
            }
          }
        } else {
          // single — the most-wounded ally in range
          let tgt: ExpedGuard | null = null
          let worst = 1
          for (const o of s.guards) {
            if (o === g || !o.alive || o.hp >= o.maxHp) continue
            if (Math.abs(o.x - g.x) + Math.abs(o.y - g.y) > g.range) continue
            const frac = o.hp / o.maxHp
            if (frac < worst) {
              worst = frac
              tgt = o
            }
          }
          if (tgt) {
            tgt.hp = Math.min(tgt.maxHp, tgt.hp + heal)
            healed = true
          }
        }
        if (healed) s.sfx.push('heal')
      }
    }

    // chip the flood — a mender bites at reduced damage; a dealer bites full
    if (acts && shoot) {
      s.shots.push({ x0: g.x, y0: g.y, x1: shoot.x, y1: shoot.y, at: s.tick })
      if (g.category !== 'sustain') s.sfx.push('shot') // dealers pew; menders chime
      const sk = g.skills
      // execute — extra bite vs a target already pressing the core (dealers only)
      let dmg = g.atk
      if (g.category === 'sustain') dmg = Math.round(dmg * MEND_CHIP_FRAC)
      else if (sk.execute && shootCoreD <= EXECUTE_RING) dmg = Math.round(dmg * sk.execute)
      damageUnit(s, shoot, dmg)
      // pierce — the bolt carries into a second target in range (dealers only)
      if (g.category !== 'sustain' && sk.pierce) {
        let second: TideUnit | null = null
        let secondD = Infinity
        for (const o of s.tide) {
          if (!o.alive || o === shoot) continue
          if (Math.abs(o.x - g.x) + Math.abs(o.y - g.y) > g.range) continue
          const cd = s.map.dist[tileIdx(o)]
          if (cd !== -1 && cd < secondD) {
            secondD = cd
            second = o
          }
        }
        if (second) damageUnit(s, second, g.atk)
      }
      if (g.role === 'splash') {
        // AoE — bleeds into the pool around the primary (bloom chips reduced)
        const r = SPLASH_R + (sk.splashR ?? 0)
        for (const o of s.tide) {
          if (!o.alive || o === shoot) continue
          if (Math.hypot(o.x - shoot.x, o.y - shoot.y) <= r) damageUnit(s, o, dmg * SPLASH_FRAC)
        }
      } else if (g.role === 'frost') {
        // chills the primary and its neighbours — buys the line time
        const dur = FROST_DUR + (sk.slowDur ?? 0)
        shoot.slowUntil = s.tick + dur
        for (const o of s.tide) {
          if (!o.alive || o === shoot) continue
          if (Math.hypot(o.x - shoot.x, o.y - shoot.y) <= FROST_R) o.slowUntil = s.tick + dur
        }
      } else if (g.role === 'pulse') {
        // shove the primary back out from the core + a brief stun
        const dx = shoot.x - GATE_X
        const dy = shoot.y - GATE_Y
        const l = Math.hypot(dx, dy) || 1
        const kb = PULSE_KB + (sk.kb ?? 0)
        shoot.x = Math.max(0, Math.min(BREACH_W - 1, shoot.x + (dx / l) * kb))
        shoot.y = Math.max(0, Math.min(BREACH_H - 1, shoot.y + (dy / l) * kb))
        shoot.stunUntil = s.tick + PULSE_STUN + (sk.stun ?? 0)
      }
    }
  }

  // --- the flood: strike an adjacent post, strike the core, else glide in ---
  // movement is continuous every tick; damage is dealt per-tick at u.atk*speed
  // so blocked DPS matches the old "u.atk every (1/speed) ticks" cadence.
  for (const u of s.tide) {
    if (!u.alive) continue
    if (u.stunUntil > s.tick) continue // shoved — reeling, can't act
    const ux = Math.round(u.x)
    const uy = Math.round(u.y)
    // adjacent post? wear it down (this is the flood's teeth)
    let struck = false
    for (const g of s.guards) {
      if (!g.alive) continue
      if (Math.hypot(g.x - u.x, g.y - u.y) <= 1.3) {
        g.hp -= u.atk * u.speed
        if (g.hp <= 0) {
          g.alive = false
          g.downUntil = s.tick + GUARD_RESPAWN
          s.feed.unshift(`${g.name} goes dark — the post is down`)
          s.feed = s.feed.slice(0, 5)
        }
        struck = true
        break
      }
    }
    if (struck) continue
    // at the core? it fills — bulwark plating blunts the strike
    if (Math.max(Math.abs(u.x - GATE_X), Math.abs(u.y - GATE_Y)) <= CORE_HIT) {
      s.gate -= u.atk * u.speed * Math.pow(0.9, s.tracks[1])
      continue
    }
    // a bulwark in range taunts — the tide piles onto the wall, not the core
    let tauntG: ExpedGuard | null = null
    let tauntD = Infinity
    for (const g of s.guards) {
      if (!g.alive || g.role !== 'bulwark') continue
      const d = Math.hypot(g.x - u.x, g.y - u.y)
      if (d <= g.range && d < tauntD) {
        tauntD = d
        tauntG = g
      }
    }
    let tx: number
    let ty: number
    if (tauntG) {
      tx = tauntG.x
      ty = tauntG.y
    } else {
      // pick the lowest-gradient 8-neighbour of the current tile, then glide
      // toward it — continuous, normalized so diagonals aren't faster
      const here = s.map.dist[uy * s.map.w + ux]
      let bx = ux
      let by = uy
      let bd = here
      for (const [dx, dy] of NEI8) {
        const nx = ux + dx
        const ny = uy + dy
        if (nx < 0 || ny < 0 || nx >= s.map.w || ny >= s.map.h) continue
        const nidx = ny * s.map.w + nx
        if (s.map.walls[nidx]) continue
        const d = s.map.dist[nidx]
        if (d !== -1 && d < bd) {
          bd = d
          bx = nx
          by = ny
        }
      }
      // if nothing descends (at the ring), aim straight at the core
      tx = bx === ux && by === uy ? GATE_X : bx
      ty = bx === ux && by === uy ? GATE_Y : by
    }
    let hx = tx - u.x
    let hy = ty - u.y
    const len = Math.hypot(hx, hy) || 1
    hx /= len
    hy /= len
    u.fx = hx
    u.fy = hy
    const spd = u.slowUntil > s.tick ? u.speed * FROST_SLOW : u.speed
    u.x += hx * spd
    u.y += hy * spd
  }

  if (s.tick % MERGE_EVERY === 0) mergePass(s)
  s.shots = s.shots.filter((sh) => s.tick - sh.at < 3)
  autoSpend(s)

  // --- end conditions ---
  // the core fills -> the Tsunamizilla rises. the LINE going dark is survivable
  // now (posts re-form) — the run ends only when the core is overwhelmed.
  // don't finalize yet: trigger the wash and hold the run open for the payoff.
  if (s.gate <= 0) {
    s.gate = 0
    if (!s.tsunami) {
      s.tsunami = true
      s.tsunamiAt = s.tick
      s.sfx.push('wash')
    }
  }
}
