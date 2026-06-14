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

export interface Spire {
  x: number
  alive: boolean
}

export interface Blight {
  x: number
  y: number
  ox: number // spawn origin — the renderer draws the trail from here
  oy: number
  vx: number
  vy: number
  target: number // spire index it is diving at
  alive: boolean
}

export interface Bloom {
  x: number
  y: number
  age: number
  r: number
}

export type FxKind = 'intercept' | 'impact' | 'spire'
export interface Fx {
  x: number
  y: number
  age: number
  life: number
  kind: FxKind
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
}

export interface TickEvents {
  intercepts: number
  spireHits: number
  waveCleared: boolean
  gameOver: boolean
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
  const queue: Blight[] = []
  for (let i = 0; i < count; i++) {
    const ox = randInt(w.rng, 24, VW - 24)
    const oy = -14
    const ti = live.length ? live[randInt(w.rng, 0, live.length - 1)] : randInt(w.rng, 0, NUM_SPIRES - 1)
    const tx = w.spires[ti].x
    const ty = GROUND_Y
    const dx = tx - ox
    const dy = ty - oy
    const len = Math.hypot(dx, dy) || 1
    const jitter = 0.88 + w.rng() * 0.26
    const v = speed * jitter
    queue.push({ x: ox, y: oy, ox, oy, vx: (dx / len) * v, vy: (dy / len) * v, target: ti, alive: true })
  }
  w.toSpawn = queue
}

// Player fires an Ather bloom at (x,y). Costs one charge. Returns true if it launched.
export function fireBloom(w: World, x: number, y: number): boolean {
  if (w.state === 'over' || w.ammo <= 0) return false
  w.ammo--
  w.blooms.push({ x, y, age: 0, r: 0 })
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

function addFx(w: World, x: number, y: number, kind: FxKind, life: number) {
  w.fx.push({ x, y, age: 0, kind, life })
}

// Advance the world by dt seconds. Returns what happened this frame for sound/FX.
export function tick(w: World, dt: number): TickEvents {
  const ev: TickEvents = { intercepts: 0, spireHits: 0, waveCleared: false, gameOver: false }
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

  // move blight; ground impacts kill spires
  for (const b of w.blight) {
    if (!b.alive) continue
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.y >= GROUND_Y) {
      b.alive = false
      const s = w.spires[b.target]
      if (s && s.alive) {
        s.alive = false
        ev.spireHits++
        w.combo = 0
        addFx(w, s.x, GROUND_Y, 'spire', 0.7)
      } else {
        addFx(w, b.x, GROUND_Y, 'impact', 0.4)
      }
    }
  }

  // grow blooms; intercept any blight inside the ring
  for (const bl of w.blooms) {
    bl.age += dt
    bl.r = bloomRadius(bl.age)
    if (bl.r <= 3) continue
    for (const b of w.blight) {
      if (!b.alive) continue
      const dx = b.x - bl.x
      const dy = b.y - bl.y
      if (dx * dx + dy * dy <= bl.r * bl.r) {
        b.alive = false
        w.combo = Math.min(COMBO_MAX, w.combo + 1)
        w.score += 10 * w.combo
        ev.intercepts++
        addFx(w, b.x, b.y, 'intercept', 0.45)
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
