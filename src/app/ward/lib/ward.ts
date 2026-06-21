// WARD — Missile Command over the spires. The void rains blight down on the last
// standing spires of Aeterna; you answer by blooming Ather bursts in the sky, each
// an expanding ring that unmakes any blight it touches. Hold the line wave on wave.
//
// This module is the pure simulation: no canvas, no React. The page drives it with
// tick(world, dt) once per frame and reads the returned events to fire sound + FX.
// Deterministic from a seed (mulberry32) so a run is reproducible.

import { mulberry32, randInt, type Rng } from '@/lib/arcade/rng'

// ── virtual field ─────────────────────────────────────────────────────────────
// The sim works in a fixed 480×600 space; the renderer scales it to the canvas.
export const VW = 480
export const VH = 600
export const GROUND_Y = 556 // blight that crosses this line has reached the spires
export const NUM_SPIRES = 6
export const SPIRE_HALF = 18 // a spire's hit half-width at the ground

// battery: where Ather launches from (center of the spire line)
export const BATTERY = { x: VW / 2, y: GROUND_Y + 8 }

// bloom shape — an Ather burst grows fast, holds, then fades; it kills the whole life
export const BLOOM_MAX = 54
export const BLOOM_GROW = 0.16
export const BLOOM_HOLD = 0.12
export const BLOOM_FADE = 0.5
export const BLOOM_LIFE = BLOOM_GROW + BLOOM_HOLD + BLOOM_FADE

export const COMBO_MAX = 6
export const WAVE_BREAK = 2.2 // seconds of calm between waves
export const AMMO_REGEN = 1.15 // a charge trickles back this often (seconds)

// blight pacing
const BASE_SPEED = 44
const SPEED_INC = 6
const FX_CULL = 0.9

// splitters (MIRVs): from this wave on, some blight fork mid-flight. Pop them above
// splitY and you spend one bloom; let them fork and you chase splitN children.
export const SPLIT_MIN_WAVE = 3
const SPLIT_Y_MIN = 165
const SPLIT_Y_MAX = 300
const CLEAN_KILL_MULT = 3 // a splitter killed before it forks scores this much more
const MULTI_BONUS = 15 // per extra blight caught by one bloom (×combo, ×(kills-1))

// drifter (tracking skill): falls while weaving sideways — you must lead it
export const DRIFT_MIN_WAVE = 4
const DRIFT_AMP = 165 // lateral weave velocity (px/s)
const DRIFT_FREQ = 2.5 // weave frequency (rad/s)
const DRIFT_VY = 0.82 // drifters fall a touch slower (the weave is the threat)

// darter (reaction skill): hangs high winding up, then SNAPS into a fast dive
export const DART_MIN_WAVE = 6
const DART_HANG = 1.25 // seconds of wind-up before it darts
const DART_HANG_VY = 16 // slow creep during the wind-up
const DART_MULT = 2.6 // how much faster than the wave's blight it dives

// husk (follow-up skill): armored, slow + heavy — first bloom cracks it, second kills
export const HUSK_MIN_WAVE = 7
const HUSK_VY = 0.7 // husks fall slower (you need time for two shots)
const HUSK_HP = 2

export interface Spire {
  x: number
  alive: boolean
}

// Each kind trains a different aim skill: faller = placement, splitter = prioritise,
// drifter = TRACK (it weaves), darter = REACT (winds up then snaps), husk = FOLLOW-UP
// (two hits). Undefined kind reads as 'faller' so older constructions still work.
export type BlightKind = 'faller' | 'splitter' | 'drifter' | 'darter' | 'husk'

export interface Blight {
  x: number
  y: number
  ox: number // spawn origin — the renderer draws the trail from here
  oy: number
  vx: number
  vy: number
  target: number // spire index it is diving at
  alive: boolean
  kind?: BlightKind
  age?: number // seconds alive — drives the drifter weave + the darter wind-up
  hp?: number // hits to kill (husk = 2); undefined/1 = dies in one
  splitter?: boolean // a MIRV — forks into children at splitY if not killed first
  child?: boolean // spawned from a split; never splits again, normal value
  splitY?: number // altitude at which a splitter forks
  splitN?: number // how many children it forks into
  driftAmp?: number // drifter: lateral weave velocity amplitude (px/s)
  driftFreq?: number // drifter: weave frequency (rad/s)
  driftPhase?: number // drifter: weave phase offset so they don't sync
  darted?: boolean // darter: has it snapped into its dive yet
  hangT?: number // darter: wind-up time before it darts
}

export interface Bloom {
  x: number
  y: number
  age: number
  r: number
  kills: number // blight this single ring has caught over its life (for multi-kills)
  hit?: Set<Blight> // blight this ring has already struck (so a husk takes one hit per bloom, not per frame)
  landed?: boolean // has this ring connected with anything (crack or kill) — for accuracy
}

export type FxKind = 'intercept' | 'impact' | 'spire' | 'split' | 'multi' | 'crack' | 'dart'
export interface Fx {
  x: number
  y: number
  age: number
  life: number
  kind: FxKind
  n?: number // multi-kill count, for the ×N floater
}

export type WardState = 'spawning' | 'wavebreak' | 'over'

export interface World {
  spires: Spire[]
  blight: Blight[]
  blooms: Bloom[]
  fx: Fx[]
  toSpawn: Blight[]
  spawnGap: number
  spawnT: number
  wave: number
  ammo: number
  maxAmmo: number
  ammoT: number
  score: number
  combo: number
  breakT: number
  state: WardState
  rng: Rng
  // run stats (for the post-run scorecard)
  shots: number // blooms fired
  hits: number // blooms that caught at least one blight
  downed: number // total blight intercepted
  maxMulti: number // biggest single-bloom catch
  cleanTotal: number // splitters popped before they forked
}

export interface RunStats {
  score: number
  wave: number
  downed: number
  shots: number
  accuracy: number // % of blooms that hit something (0–100)
  maxMulti: number
  cleanTotal: number
}

export function runStats(w: World): RunStats {
  return {
    score: w.score,
    wave: w.wave,
    downed: w.downed,
    shots: w.shots,
    accuracy: w.shots ? Math.round((w.hits / w.shots) * 100) : 0,
    maxMulti: w.maxMulti,
    cleanTotal: w.cleanTotal,
  }
}

export interface TickEvents {
  intercepts: number
  spireHits: number
  cleanKills: number // splitters popped before they forked — the skill shot
  bestMulti: number // highest single-bloom kill count reached this frame (>=2 = a multi)
  waveCleared: boolean
  gameOver: boolean
}

// constant blight speed for a given wave (used by both spawns and split children)
function blightSpeed(wave: number): number {
  return BASE_SPEED + wave * SPEED_INC
}

// aim a velocity of magnitude v from (ox,oy) toward (tx,ty)
function aimVel(ox: number, oy: number, tx: number, ty: number, v: number) {
  const dx = tx - ox
  const dy = ty - oy
  const len = Math.hypot(dx, dy) || 1
  return { vx: (dx / len) * v, vy: (dy / len) * v }
}

export function aliveSpires(w: World): number {
  return w.spires.reduce((n, s) => n + (s.alive ? 1 : 0), 0)
}

function spireXs(): number[] {
  const margin = 46
  const span = VW - margin * 2
  return Array.from({ length: NUM_SPIRES }, (_, i) => margin + (span * i) / (NUM_SPIRES - 1))
}

export function makeWorld(seed: number): World {
  const xs = spireXs()
  const w: World = {
    spires: xs.map((x) => ({ x, alive: true })),
    blight: [],
    blooms: [],
    fx: [],
    toSpawn: [],
    spawnGap: 1,
    spawnT: 0,
    wave: 0,
    ammo: 0,
    maxAmmo: 0,
    ammoT: 0,
    score: 0,
    combo: 0,
    breakT: 0,
    state: 'spawning',
    rng: mulberry32(seed >>> 0),
    shots: 0,
    hits: 0,
    downed: 0,
    maxMulti: 0,
    cleanTotal: 0,
  }
  startWave(w, 1)
  return w
}

// Build the next wave's blight queue. Count + speed scale with the wave; ammo refills.
export function startWave(w: World, wave: number) {
  w.wave = wave
  const count = 4 + wave * 2
  const speed = BASE_SPEED + wave * SPEED_INC
  w.spawnGap = Math.max(0.4, 1.15 - wave * 0.05)
  w.spawnT = 0.35
  w.maxAmmo = Math.min(22, 12 + wave)
  w.ammo = w.maxAmmo
  w.ammoT = 0
  w.state = 'spawning'

  const live = w.spires.map((s, i) => i).filter((i) => w.spires[i].alive)
  const pickSpire = () => (live.length ? live[randInt(w.rng, 0, live.length - 1)] : randInt(w.rng, 0, NUM_SPIRES - 1))
  const queue: Blight[] = []
  for (let i = 0; i < count; i++) {
    const ox = randInt(w.rng, 24, VW - 24)
    const oy = -14
    const ti = pickSpire()
    const jitter = 0.88 + w.rng() * 0.26
    const { vx, vy } = aimVel(ox, oy, w.spires[ti].x, GROUND_Y, speed * jitter)
    queue.push({ x: ox, y: oy, ox, oy, vx, vy, target: ti, alive: true, kind: 'faller', age: 0 })
  }

  // mark types in distinct slots of the queue so a blight is only ever one kind.
  let slot = 0
  // from SPLIT_MIN_WAVE on, seed a growing number of splitters into the wave
  if (wave >= SPLIT_MIN_WAVE) {
    const nSplit = Math.min(queue.length - slot, 1 + Math.floor((wave - SPLIT_MIN_WAVE) / 2))
    for (let i = 0; i < nSplit; i++, slot++) {
      const b = queue[slot]
      b.kind = 'splitter'
      b.splitter = true
      b.splitN = 2 + (w.rng() < (wave >= 6 ? 0.6 : 0.25) ? 1 : 0)
      b.splitY = SPLIT_Y_MIN + w.rng() * (SPLIT_Y_MAX - SPLIT_Y_MIN)
    }
  }
  // DRIFTERS (tracking) — weave sideways as they fall; lead them
  if (wave >= DRIFT_MIN_WAVE) {
    const nDrift = Math.min(queue.length - slot, 1 + Math.floor((wave - DRIFT_MIN_WAVE) / 2))
    for (let i = 0; i < nDrift; i++, slot++) {
      const b = queue[slot]
      b.kind = 'drifter'
      b.vx = 0
      b.vy = speed * DRIFT_VY
      b.driftAmp = DRIFT_AMP * (0.85 + w.rng() * 0.3)
      b.driftFreq = DRIFT_FREQ * (0.85 + w.rng() * 0.3)
      b.driftPhase = w.rng() * Math.PI * 2
    }
  }
  // DARTERS (reaction) — creep down, then snap into a fast dive
  if (wave >= DART_MIN_WAVE) {
    const nDart = Math.min(queue.length - slot, 1 + Math.floor((wave - DART_MIN_WAVE) / 3))
    for (let i = 0; i < nDart; i++, slot++) {
      const b = queue[slot]
      b.kind = 'darter'
      b.vx = 0
      b.vy = DART_HANG_VY
      b.hangT = DART_HANG * (0.85 + w.rng() * 0.3)
      b.darted = false
    }
  }
  // HUSKS (follow-up) — armored, slow + heavy; two hits to down
  if (wave >= HUSK_MIN_WAVE) {
    const nHusk = Math.min(queue.length - slot, 1 + Math.floor((wave - HUSK_MIN_WAVE) / 3))
    for (let i = 0; i < nHusk; i++, slot++) {
      const b = queue[slot]
      b.kind = 'husk'
      b.hp = HUSK_HP
      const { vx, vy } = aimVel(b.ox, b.oy, w.spires[b.target].x, GROUND_Y, speed * HUSK_VY)
      b.vx = vx
      b.vy = vy
    }
  }
  w.toSpawn = queue
}

// Player fires an Ather bloom at (x,y). Costs one charge. Returns true if it launched.
export function fireBloom(w: World, x: number, y: number): boolean {
  if (w.state === 'over' || w.ammo <= 0) return false
  w.ammo--
  w.shots++
  w.blooms.push({ x, y, age: 0, r: 0, kills: 0 })
  return true
}

export function bloomRadius(age: number): number {
  if (age < BLOOM_GROW) {
    const t = age / BLOOM_GROW
    return BLOOM_MAX * (1 - (1 - t) * (1 - t)) // ease-out grow
  }
  if (age < BLOOM_GROW + BLOOM_HOLD) return BLOOM_MAX
  const t = (age - BLOOM_GROW - BLOOM_HOLD) / BLOOM_FADE
  return BLOOM_MAX * Math.max(0, 1 - t)
}

function addFx(w: World, x: number, y: number, kind: FxKind, life: number, n?: number) {
  w.fx.push({ x, y, age: 0, kind, life, n })
}

// Advance the world by dt seconds. Returns what happened this frame for sound/FX.
export function tick(w: World, dt: number): TickEvents {
  const ev: TickEvents = { intercepts: 0, spireHits: 0, cleanKills: 0, bestMulti: 0, waveCleared: false, gameOver: false }
  if (w.state === 'over') return ev

  // charge trickles back
  w.ammoT += dt
  while (w.ammoT >= AMMO_REGEN && w.ammo < w.maxAmmo) {
    w.ammoT -= AMMO_REGEN
    w.ammo++
  }

  // release queued blight
  if (w.state === 'spawning' && w.toSpawn.length) {
    w.spawnT -= dt
    if (w.spawnT <= 0) {
      w.blight.push(w.toSpawn.shift()!)
      w.spawnT = w.spawnGap
    }
  }

  // move blight; splitters fork at altitude; ground impacts kill spires
  const born: Blight[] = []
  const liveIdx = w.spires.map((s, i) => i).filter((i) => w.spires[i].alive)
  for (const b of w.blight) {
    if (!b.alive) continue
    b.age = (b.age ?? 0) + dt
    if (b.kind === 'drifter') {
      // weave sideways while falling — the player must LEAD it (tracking skill)
      b.x += Math.sin(b.age * (b.driftFreq ?? DRIFT_FREQ) + (b.driftPhase ?? 0)) * (b.driftAmp ?? DRIFT_AMP) * dt
      b.x = Math.max(10, Math.min(VW - 10, b.x))
      b.y += b.vy * dt
    } else if (b.kind === 'darter') {
      // wind up high, then SNAP into a fast dive at its spire (reaction skill)
      if (!b.darted && (b.age ?? 0) >= (b.hangT ?? DART_HANG)) {
        b.darted = true
        const sp = w.spires[b.target]
        const aimed = aimVel(b.x, b.y, sp ? sp.x : b.x, GROUND_Y, blightSpeed(w.wave) * DART_MULT)
        b.vx = aimed.vx
        b.vy = aimed.vy
        addFx(w, b.x, b.y, 'dart', 0.3)
      }
      b.x += b.vx * dt
      b.y += b.vy * dt
    } else {
      b.x += b.vx * dt
      b.y += b.vy * dt
    }
    // a splitter that survived to its fork altitude breaks into children
    if (b.splitter && !b.child && b.splitY !== undefined && b.y >= b.splitY) {
      b.alive = false
      addFx(w, b.x, b.y, 'split', 0.4)
      const n = b.splitN ?? 2
      const v = blightSpeed(w.wave)
      for (let k = 0; k < n; k++) {
        const ti = liveIdx.length ? liveIdx[randInt(w.rng, 0, liveIdx.length - 1)] : randInt(w.rng, 0, NUM_SPIRES - 1)
        const { vx, vy } = aimVel(b.x, b.y, w.spires[ti].x, GROUND_Y, v * (0.9 + w.rng() * 0.2))
        born.push({ x: b.x, y: b.y, ox: b.x, oy: b.y, vx, vy, target: ti, alive: true, child: true })
      }
      continue
    }
    if (b.y >= GROUND_Y) {
      b.alive = false
      // hit whichever spire is under the landing point (lateral kinds don't keep a target)
      let hit = -1, bestD = SPIRE_HALF
      for (let i = 0; i < w.spires.length; i++) {
        if (!w.spires[i].alive) continue
        const d = Math.abs(w.spires[i].x - b.x)
        if (d <= bestD) { bestD = d; hit = i }
      }
      if (hit >= 0) {
        w.spires[hit].alive = false
        ev.spireHits++
        w.combo = 0
        addFx(w, w.spires[hit].x, GROUND_Y, 'spire', 0.7)
      } else {
        addFx(w, b.x, GROUND_Y, 'impact', 0.4)
      }
    }
  }
  if (born.length) w.blight.push(...born)

  // grow blooms; intercept any blight inside the ring
  for (const bl of w.blooms) {
    bl.age += dt
    bl.r = bloomRadius(bl.age)
    if (bl.r <= 3) continue
    for (const b of w.blight) {
      if (!b.alive) continue
      const dx = b.x - bl.x
      const dy = b.y - bl.y
      if (dx * dx + dy * dy > bl.r * bl.r) continue
      if (bl.hit && bl.hit.has(b)) continue // this ring already struck it (a husk takes one hit per bloom)
      ;(bl.hit ??= new Set()).add(b)
      if (!bl.landed) { bl.landed = true; w.hits++ } // the ring connected (crack or kill)
      b.hp = (b.hp ?? 1) - 1
      if (b.hp > 0) {
        // survived — a husk's shell cracks; it needs a follow-up bloom to finish
        addFx(w, b.x, b.y, 'crack', 0.3)
        continue
      }
      b.alive = false
      w.combo = Math.min(COMBO_MAX, w.combo + 1)
      const clean = !!b.splitter && !b.child // popped a MIRV before it forked
      w.score += 10 * w.combo * (clean ? CLEAN_KILL_MULT : 1)
      ev.intercepts++
      w.downed++
      if (clean) { ev.cleanKills++; w.cleanTotal++ }
      addFx(w, b.x, b.y, 'intercept', 0.45)
      // multi-kill: this same ring catching more in one life pays escalating bonus
      bl.kills++
      if (bl.kills > w.maxMulti) w.maxMulti = bl.kills
      if (bl.kills >= 2) {
        w.score += MULTI_BONUS * w.combo * (bl.kills - 1)
        addFx(w, bl.x, bl.y, 'multi', 0.7, bl.kills)
        if (bl.kills > ev.bestMulti) ev.bestMulti = bl.kills
      }
    }
  }

  // cull
  w.blooms = w.blooms.filter((bl) => bl.age < BLOOM_LIFE)
  w.blight = w.blight.filter((b) => b.alive)
  for (const f of w.fx) f.age += dt
  w.fx = w.fx.filter((f) => f.age < Math.max(f.life, FX_CULL) && f.age < f.life)

  // lose the moment the last spire falls
  if (aliveSpires(w) === 0) {
    w.state = 'over'
    ev.gameOver = true
    return ev
  }

  // wave lifecycle
  if (w.state === 'spawning' && w.toSpawn.length === 0 && w.blight.length === 0) {
    w.score += aliveSpires(w) * 25 * w.wave // standing-spire bonus
    w.state = 'wavebreak'
    w.breakT = WAVE_BREAK
    ev.waveCleared = true
  } else if (w.state === 'wavebreak') {
    w.breakT -= dt
    if (w.breakT <= 0) startWave(w, w.wave + 1)
  }

  return ev
}

// Game-over taunts — the tease IS the replay button. Tier by how far they got
// (wave reached is the legible proxy for score); pick is stable within a run
// (salted by score) but varies run to run. Voice: the void, dry and goading.
const TAUNTS: string[][] = [
  // tier 0 — fell on wave 1
  [
    "That was the warmup. The void didn't even try.",
    "Blink, and the spires are gone. Blink again.",
  ],
  // tier 1 — waves 2-3
  [
    "The dark is still laughing. Wipe it off.",
    "You'll do better. You almost have to.",
    "Mercy, wasted. Run it back.",
  ],
  // tier 2 — waves 4-6
  [
    "Respectable. The void files it under minor inconvenience.",
    "Closer. Not enough.",
    "The spires remember you fondly. Briefly.",
  ],
  // tier 3 — waves 7-9
  [
    "Now the void is paying attention.",
    "Annoyingly good. Go further.",
    "The spires held longer than they had any right to.",
  ],
  // tier 4 — waves 10-14
  [
    "The dark knows your name now.",
    "Few last this long. Fewer go further.",
  ],
  // tier 5 — wave 15+
  [
    "You're not holding the line. You are the line.",
    "The void is genuinely concerned. Twist the knife.",
  ],
]

export function tauntTier(wave: number): number {
  return wave <= 1 ? 0 : wave <= 3 ? 1 : wave <= 6 ? 2 : wave <= 9 ? 3 : wave <= 14 ? 4 : 5
}

export function tauntFor(wave: number, salt: number, isBest = false): string {
  const pool = TAUNTS[tauntTier(wave)]
  const base = pool[Math.abs(Math.floor(salt)) % pool.length]
  return isBest ? `${base} New best, though. Now bury it.` : base
}

// localStorage high score, guarded for SSR / private mode.
const HS_KEY = 'ward.hiscore'
export function loadHiScore(): number {
  try {
    return +(localStorage.getItem(HS_KEY) || 0) || 0
  } catch {
    return 0
  }
}
export function saveHiScore(score: number): number {
  const best = Math.max(score, loadHiScore())
  try {
    localStorage.setItem(HS_KEY, String(best))
  } catch {
    /* storage unavailable */
  }
  return best
}
