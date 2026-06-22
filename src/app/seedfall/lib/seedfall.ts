// SEEDFALL — the long drop. A Mana Seed falls down the canopy on the wind; you feather
// the Ather to weave through branches and out-drift a curious Havari (a bird spirit that
// swoops to snatch it), then set it down soft on the garden soil at the bottom. DEPTH is
// the score; the soft-landing is the payoff. Floaty drift physics: gentle gravity, lateral
// Ather thrust, a wandering breeze. Deterministic from a seed (mulberry32) for the Daily.
//
// Pure sim (no canvas, no React). The page sets input each frame and calls tick(); it reads
// the events for sound + FX, and reads camera/world fields to render the scrolling descent.

import { mulberry32, type Rng } from '@/lib/arcade/rng'

// ── virtual field (portrait; renderer scales it) ────────────────────────────────
export const VW = 400
export const VH = 600
export const SEED_R = 9
export const SEED_SCREEN_Y = 200 // the seed holds here on screen; the world scrolls past it

// physics — kept floaty from the original soft-lander, retuned for a continuous fall.
// Languid on purpose: a slow drift gives time to weave the gaps (the cozy lane).
export const GRAVITY = 54 // steady downward pull — gentle, this is a drift not a plummet
export const THRUST_UP = 168 // both-side hold: slow the fall / briefly rise
export const THRUST_LAT = 165 // single-side: steer (the drift authority that out-runs the Havari)
export const THRUST_LIFT = 0.42 // a single-side thrust also gives this fraction of lift
export const MAX_VY = 170 // terminal fall speed
export const FUEL_MAX = 130
export const FUEL_BURN = 15 // fuel/sec while thrusting (both sides burns 1.35×)
export const FUEL_REGEN = 11 // trickles back when you let off — a soft limit on hovering, never a doom-lock

// the well
export const DEPTH_GOAL = 4200 // world-px of fall to reach the soil floor
export const THICK = 12 // branch limb thickness
export const SEED_START_Y = 0

// branches: a leafy limb spans the width with ONE opening; the opening centre walks by a
// bounded step each branch so you weave gently (never teleport-chase). Gap narrows + branches
// tighten the deeper you fall.
export interface Branch {
  y: number // world-y of the limb centre
  gap: number // opening width
  gapX: number // opening centre x
  passed: boolean
}

// the Havari doesn't track you — it commits to a SWOOP: enters from one side and arcs down
// across the screen (an inverted-U), diving to one intercept point, then climbs out the far
// side. You read the telegraph + the dive line and drift off it. A pass, not a hover.
export type HavariState = 'warn' | 'sweep' | 'gone'
export interface Havari {
  x: number // current screen-x (x isn't scrolled)
  dy: number // vertical offset from the seed centre (negative = above the seed)
  side: -1 | 1 // enters from left(-1)/right(1)
  targetX: number // the low-point x it dives at (snapshot when the sweep begins)
  state: HavariState
  t: number // time in current state
}
export const HAVARI_R = 13
export const HAVARI_CATCH = SEED_R + HAVARI_R - 3 // ~19px — must really meet the seed to snatch it
export const HAVARI_WARN_T = 1.4 // telegraph (danger band shows the dive point) before it commits — your reaction window
export const HAVARI_SWEEP_T = 1.6 // seconds to cross the screen
export const HAVARI_SWOOP_H = 122 // how high above the seed it rides at the edges
export const HAVARI_DIP = 4 // how far past the seed's centre the dive bottoms out
export const HAVARI_DIP_W = 56 // half-width of the dive's influence — a tight plunge = a narrow, dodgeable kill-zone
// the actual danger half-width in x: where the dive comes low enough to catch you. Drift past this and you're clear.
export const HAVARI_KILL_W = Math.round(HAVARI_DIP_W * 0.48) // ~27px — render a band this wide so the dodge is honest

// landing tolerances at the soil — under these = a clean set-down (cozy-forgiving)
export const PAD_W_MIN = 96
export const PAD_W_MAX = 132
export const SOFT_VY = 95
export const SOFT_VX = 60
export const PERFECT_VY = 46

export type Rating = 'perfect' | 'soft' | 'rough'
export type SeedState = 'ready' | 'playing' | 'landed' | 'crashed' | 'caught'

export interface Input {
  left: boolean
  right: boolean
}

export interface World {
  x: number
  y: number // world-y; also the depth fallen (starts at 0)
  vx: number
  vy: number
  fuel: number
  wind: number
  windTarget: number
  windT: number
  input: Input
  thrusting: boolean
  branches: Branch[]
  havari: Havari | null
  nextHavariDepth: number
  padX: number
  padW: number
  threads: number // branches threaded
  dodges: number // havari out-drifted
  bonus: number // event bonuses (threads/dodges/landing) added to the depth score
  score: number
  state: SeedState
  rating: Rating | null
  rng: Rng
}

export interface TickEvents {
  thrust: boolean
  thread: boolean // passed a branch cleanly
  havariWarn: -1 | 1 | null // a Havari is about to enter from this side
  havariEnter: boolean
  dodged: boolean // a Havari gave up and peeled off
  caught: boolean
  landed: boolean
  crashed: boolean
  rating: Rating | null
}

function rollWind(w: World) {
  w.windTarget = (w.rng() * 2 - 1) * 52
  w.windT = 2.2 + w.rng() * 2.4
}

// difficulty 0→1 over the descent (eased a touch so the top is gentle)
function diffAt(depth: number): number {
  const d = Math.min(1, depth / DEPTH_GOAL)
  return d * d * 0.6 + d * 0.4
}

function genBranches(rng: Rng): Branch[] {
  const out: Branch[] = []
  let y = 380 // first limb — a beat of free fall to settle in
  let gapX = VW / 2
  while (y < DEPTH_GOAL - 300) {
    const k = diffAt(y)
    const gap = Math.round(190 - k * 70) // 190 → ~120
    const maxStep = 80 + k * 54 // how far the opening can shift from the last one (80 → ~134)
    gapX += (rng() * 2 - 1) * maxStep
    gapX = Math.max(gap / 2 + 10, Math.min(VW - gap / 2 - 10, gapX))
    out.push({ y, gap, gapX, passed: false })
    y += Math.round(264 - k * 74) // 264 → ~190 spacing
  }
  return out
}

export function makeWorld(seed: number): World {
  const rng = mulberry32(seed >>> 0)
  const padW = PAD_W_MIN + rng() * (PAD_W_MAX - PAD_W_MIN)
  const padX = padW / 2 + 24 + rng() * (VW - padW - 48)
  const w: World = {
    x: VW / 2 + (rng() * 2 - 1) * 40,
    y: SEED_START_Y,
    vx: 0,
    vy: 0,
    fuel: FUEL_MAX,
    wind: 0,
    windTarget: 0,
    windT: 0,
    input: { left: false, right: false },
    thrusting: false,
    branches: genBranches(rng),
    havari: null,
    nextHavariDepth: 780,
    padX,
    padW,
    threads: 0,
    dodges: 0,
    bonus: 0,
    score: 0,
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
  if (w.state === 'ready' && (left || right)) w.state = 'playing'
}

// is x inside the OPENING of this branch? (else it's under a limb → collision)
function inGap(b: Branch, x: number): boolean {
  return Math.abs(x - b.gapX) <= b.gap / 2 - SEED_R * 0.5
}

function spawnHavari(w: World) {
  const side: -1 | 1 = w.rng() < 0.5 ? -1 : 1
  w.havari = {
    x: side < 0 ? -HAVARI_R : VW + HAVARI_R,
    dy: -HAVARI_SWOOP_H,
    side,
    targetX: w.x, // refreshed when the sweep actually begins
    state: 'warn',
    t: 0,
  }
}

const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)

function ratingFor(vy: number, vx: number, centered: boolean): Rating {
  if (vy <= PERFECT_VY && Math.abs(vx) <= SOFT_VX * 0.5 && centered) return 'perfect'
  return 'soft'
}

// Advance dt seconds. Returns events for sound/FX. No-op unless playing.
export function tick(w: World, dt: number): TickEvents {
  const ev: TickEvents = { thrust: false, thread: false, havariWarn: null, havariEnter: false, dodged: false, caught: false, landed: false, crashed: false, rating: null }
  if (w.state !== 'playing') {
    w.thrusting = false
    return ev
  }

  // wind drifts toward a re-rolled target
  w.windT -= dt
  if (w.windT <= 0) rollWind(w)
  w.wind += (w.windTarget - w.wind) * Math.min(1, dt * 0.8)

  // thrust
  let ax = w.wind
  let ay = GRAVITY
  const { left, right } = w.input
  const wantThrust = (left || right) && w.fuel > 0
  if (wantThrust) {
    const both = left && right
    ay -= both ? THRUST_UP * 1.25 : THRUST_UP * THRUST_LIFT
    if (!both && left) ax -= THRUST_LAT
    if (!both && right) ax += THRUST_LAT
    w.fuel = Math.max(0, w.fuel - FUEL_BURN * (both ? 1.35 : 1) * dt)
    ev.thrust = true
    w.thrusting = true
  } else {
    w.fuel = Math.min(FUEL_MAX, w.fuel + FUEL_REGEN * dt)
    w.thrusting = false
  }

  // integrate
  w.vx += ax * dt
  w.vy += ay * dt
  w.vy = Math.max(-THRUST_UP, Math.min(MAX_VY, w.vy))
  w.vx *= 0.985 // mild drag so drift settles
  w.x += w.vx * dt
  const prevY = w.y
  w.y += w.vy * dt

  // walls — soft bounce so you can't sail off-screen
  if (w.x < SEED_R) { w.x = SEED_R; w.vx = Math.abs(w.vx) * 0.4 }
  if (w.x > VW - SEED_R) { w.x = VW - SEED_R; w.vx = -Math.abs(w.vx) * 0.4 }
  // can't climb back above the start
  if (w.y < SEED_START_Y) { w.y = SEED_START_Y; if (w.vy < 0) w.vy = 0 }

  // ── branch collisions + thread scoring ─────────────────────────────────────
  for (const b of w.branches) {
    if (b.passed) continue
    const band = THICK / 2 + SEED_R
    // crossed into the limb's y-band this frame?
    if (w.y + SEED_R >= b.y - band && prevY - SEED_R <= b.y + band) {
      if (!inGap(b, w.x)) {
        w.state = 'crashed'
        ev.crashed = true
        return ev
      }
    }
    // fully cleared it
    if (prevY <= b.y && w.y > b.y) {
      b.passed = true
      w.threads++
      w.bonus += 6
      ev.thread = true
    }
  }

  // ── Havari: telegraph → enter → hunt → peel off ────────────────────────────
  if (!w.havari && w.y >= w.nextHavariDepth && w.y < DEPTH_GOAL - 360) {
    spawnHavari(w)
    ev.havariWarn = w.havari!.side
    // next one comes sooner the deeper you are (but never back-to-back)
    w.nextHavariDepth = w.y + 660 - diffAt(w.y) * 240
  }
  const h = w.havari
  if (h) {
    h.t += dt
    if (h.state === 'warn') {
      // park at the entry edge, telegraphing the side, then commit the swoop
      h.x = h.side < 0 ? -HAVARI_R : VW + HAVARI_R
      h.dy = -HAVARI_SWOOP_H
      // targetX stays as snapshot at SPAWN — so drifting away during the warn actually counts
      if (h.t >= HAVARI_WARN_T) { h.state = 'sweep'; h.t = 0; ev.havariEnter = true }
    } else if (h.state === 'sweep') {
      const p = h.t / HAVARI_SWEEP_T
      if (p >= 1) {
        // crossed the screen without snatching it — a clean dodge
        w.havari = null
        w.dodges++
        w.bonus += 12
        ev.dodged = true
      } else {
        const entryX = h.side < 0 ? -HAVARI_R : VW + HAVARI_R
        const exitX = h.side < 0 ? VW + HAVARI_R : -HAVARI_R
        h.x = entryX + (exitX - entryX) * easeInOut(p)
        // inverted-U dive: rides high at the edges, plunges to the seed's band at targetX
        const f = Math.max(0, 1 - ((h.x - h.targetX) / HAVARI_DIP_W) ** 2)
        h.dy = -HAVARI_SWOOP_H + (HAVARI_SWOOP_H + HAVARI_DIP) * f
        // caught only when the dive actually meets the seed (near targetX AND near the seed's x)
        if (Math.hypot(h.x - w.x, h.dy) <= HAVARI_CATCH) {
          w.state = 'caught'
          ev.caught = true
          return ev
        }
      }
    }
  }

  // ── the soil floor: the soft-landing payoff ────────────────────────────────
  if (w.y + SEED_R >= DEPTH_GOAL) {
    w.y = DEPTH_GOAL - SEED_R
    const onPad = Math.abs(w.x - w.padX) <= w.padW / 2
    const soft = w.vy <= SOFT_VY && Math.abs(w.vx) <= SOFT_VX
    if (onPad && soft) {
      const centered = Math.abs(w.x - w.padX) <= w.padW * 0.3
      w.rating = ratingFor(w.vy, w.vx, centered)
      w.bonus += w.rating === 'perfect' ? 400 : 220
      w.state = 'landed'
      ev.landed = true
      ev.rating = w.rating
      plant(w.rating)
    } else {
      w.state = 'crashed'
      ev.crashed = true
    }
  }

  // depth-driven score (+ accumulated bonuses). 1 point per ~7px fallen.
  w.score = Math.floor(w.y / 7) + w.bonus
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
