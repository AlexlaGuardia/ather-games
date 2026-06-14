// SEEDFALL — set a Mana Seed down softly. It drifts out of the sky on the wind;
// you feather the Ather to slow its fall and steer it onto the soil. Land gentle
// and it roots into your garden, which grows run over run. Come in hot or miss the
// soil and it shatters. Cozy precision, the slow lane of the arcade.
//
// Pure sim (no canvas, no React). The page sets input each frame and calls tick();
// it reads the events for sound + FX. Deterministic from a seed (mulberry32).

import { mulberry32, type Rng } from '@/lib/arcade/rng'

// ── virtual field (portrait; renderer scales it) ────────────────────────────────
export const VW = 400
export const VH = 600
export const GROUND_Y = 548 // soil line
export const SEED_R = 9

export const GRAVITY = 36 // gentle pull — this is the cozy lane
export const THRUST_UP = 150 // upward accel while thrusting (strong authority vs gravity)
export const THRUST_LAT = 105 // sideways accel from a single-side thrust
export const FUEL_MAX = 120
export const FUEL_BURN = 14 // fuel/sec while thrusting (both sides burns 1.4×) — Ather is abundant; the skill is the soft set-down, not scarcity

export const PAD_W_MIN = 90
export const PAD_W_MAX = 126
// landing tolerances — under these = a clean set-down (cozy-forgiving)
export const SOFT_VY = 80 // vertical impact speed for a safe landing
export const SOFT_VX = 55 // horizontal drift allowed at touchdown
export const PERFECT_VY = 38 // butter-soft, dead-center-ish

export type Rating = 'perfect' | 'soft' | 'rough'
export type SeedState = 'ready' | 'playing' | 'landed' | 'crashed'

export interface Input {
  left: boolean
  right: boolean
}

export interface World {
  x: number
  y: number
  vx: number
  vy: number
  fuel: number
  wind: number // current horizontal accel from wind
  windTarget: number // wind drifts toward this, re-rolled over time
  windT: number
  padX: number // pad center
  padW: number
  input: Input
  thrusting: boolean // was thrust applied this frame (for FX/SFX)
  state: SeedState
  rating: Rating | null
  rng: Rng
}

export interface TickEvents {
  thrust: boolean
  landed: boolean
  crashed: boolean
  rating: Rating | null
}

function rollWind(w: World) {
  // a slow horizontal breeze in [-46, 46]
  w.windTarget = (w.rng() * 2 - 1) * 46
  w.windT = 2.5 + w.rng() * 2.5
}

export function makeWorld(seed: number): World {
  const rng = mulberry32(seed >>> 0)
  const padW = PAD_W_MIN + rng() * (PAD_W_MAX - PAD_W_MIN)
  const padX = padW / 2 + 20 + rng() * (VW - padW - 40)
  const w: World = {
    x: 60 + rng() * (VW - 120),
    y: 40,
    vx: 0,
    vy: 0,
    fuel: FUEL_MAX,
    wind: 0,
    windTarget: 0,
    windT: 0,
    padX,
    padW,
    input: { left: false, right: false },
    thrusting: false,
    state: 'ready',
    rating: null,
    rng,
  }
  rollWind(w)
  w.wind = w.windTarget
  return w
}

export function setInput(w: World, left: boolean, right: boolean) {
  w.input.left = left
  w.input.right = right
  // first touch launches the drop
  if (w.state === 'ready' && (left || right)) w.state = 'playing'
}

function ratingFor(vy: number, vx: number, centered: boolean): Rating {
  if (vy <= PERFECT_VY && Math.abs(vx) <= SOFT_VX * 0.5 && centered) return 'perfect'
  return 'soft'
}

// Advance dt seconds. Returns events for sound/FX. No-op unless playing.
export function tick(w: World, dt: number): TickEvents {
  const ev: TickEvents = { thrust: false, landed: false, crashed: false, rating: null }
  if (w.state !== 'playing') {
    w.thrusting = false
    return ev
  }

  // wind drifts toward a re-rolled target
  w.windT -= dt
  if (w.windT <= 0) rollWind(w)
  w.wind += (w.windTarget - w.wind) * Math.min(1, dt * 0.8)

  // thrust (needs fuel)
  let ax = w.wind
  let ay = GRAVITY
  const { left, right } = w.input
  const wantThrust = (left || right) && w.fuel > 0
  if (wantThrust) {
    const both = left && right
    ay -= both ? THRUST_UP * 1.4 : THRUST_UP * 0.72
    if (!both && left) ax -= THRUST_LAT
    if (!both && right) ax += THRUST_LAT
    w.fuel = Math.max(0, w.fuel - FUEL_BURN * (both ? 1.4 : 1) * dt)
    ev.thrust = true
    w.thrusting = true
  } else {
    w.thrusting = false
  }

  // integrate
  w.vx += ax * dt
  w.vy += ay * dt
  w.x += w.vx * dt
  w.y += w.vy * dt

  // walls — soft bounce so you can't sail off-screen
  if (w.x < SEED_R) { w.x = SEED_R; w.vx = Math.abs(w.vx) * 0.4 }
  if (w.x > VW - SEED_R) { w.x = VW - SEED_R; w.vx = -Math.abs(w.vx) * 0.4 }
  // ceiling clamp — hold both too long and you just hug the top, you don't vanish
  if (w.y < SEED_R) { w.y = SEED_R; if (w.vy < 0) w.vy = 0 }

  // touchdown
  if (w.y + SEED_R >= GROUND_Y) {
    w.y = GROUND_Y - SEED_R
    const onPad = Math.abs(w.x - w.padX) <= w.padW / 2
    const soft = w.vy <= SOFT_VY && Math.abs(w.vx) <= SOFT_VX
    if (onPad && soft) {
      const centered = Math.abs(w.x - w.padX) <= w.padW * 0.3
      w.state = 'landed'
      w.rating = ratingFor(w.vy, w.vx, centered)
      ev.landed = true
      ev.rating = w.rating
      plant(w.rating)
    } else {
      w.state = 'crashed'
      ev.crashed = true
    }
  }
  return ev
}

// ── persistent garden (localStorage) ────────────────────────────────────────────
const GARDEN_KEY = 'seedfall.garden'
export interface Garden {
  planted: number
  perfect: number
}
export function loadGarden(): Garden {
  try {
    const raw = localStorage.getItem(GARDEN_KEY)
    if (raw) {
      const g = JSON.parse(raw)
      return { planted: g.planted || 0, perfect: g.perfect || 0 }
    }
  } catch {
    /* storage unavailable */
  }
  return { planted: 0, perfect: 0 }
}
export function plant(rating: Rating): Garden {
  const g = loadGarden()
  g.planted++
  if (rating === 'perfect') g.perfect++
  try {
    localStorage.setItem(GARDEN_KEY, JSON.stringify(g))
  } catch {
    /* storage unavailable */
  }
  return g
}
