// GRAVITAR — slingshot a spark of Ather through the Orrery's gravity. You pilot a mote of
// light: rotate + thrust, but the planets pull you the whole time. Round their wells to fling
// yourself toward the dim cores; gather one and it relights you (score + fuel). Crash into a
// world, or drift past the edge into the void, and the run ends. Thrust is scarce — gravity is
// the real engine. Pure sim — deterministic from a seed. The page drives it with tick(input).

import { mulberry32, type Rng } from '@/lib/arcade/rng'

// ── tuning ──────────────────────────────────────────────────────────────────────
export const G = 1700 // gravitational constant (felt strength of the wells)
export const SOFT = 14 // softening — keeps gravity finite at a body's centre
export const MAXV = 215 // hard speed cap — tames a runaway slingshot WITHOUT decaying stable orbits (damping did, and that forced constant thrust → fuel death)
export const SHIP_R = 6
export const TURN_RATE = 3.3 // rad/s
export const THRUST = 200 // accel units/s² while burning
export const FUEL_MAX = 100
export const FUEL_DRAIN = 17 // fuel/s while thrusting
export const CORE_FUEL = 46 // fuel a core gives back
export const CORE_R = 18 // pickup radius
export const ARENA_R = 620 // beyond this from centre = lost to the void
export const TARGET_CORES = 6 // the system tries to keep this many cores lit

export interface Body { x: number; y: number; r: number; mass: number }
export interface Core { x: number; y: number } // a dim core adrift in open space between the wells
export interface Ship {
  x: number; y: number; vx: number; vy: number
  angle: number; fuel: number; alive: boolean; thrusting: boolean
}

export interface World {
  bodies: Body[]
  cores: Core[]
  ship: Ship
  score: number
  best: number
  t: number
  arenaR: number
  over: boolean
  rng: Rng
}

export interface Input { rotate: number; thrust: boolean } // rotate: -1 | 0 | 1
export interface TickEvents { collected: number; crashed: boolean; lost: boolean }

const hyp = (x: number, y: number) => Math.sqrt(x * x + y * y)

// place a fresh core in open space — well clear of every world, inside the arena
function spawnCore(w: World): Core {
  for (let tries = 0; tries < 60; tries++) {
    const a = w.rng() * Math.PI * 2
    const r = 140 + w.rng() * (w.arenaR - 200)
    const x = Math.cos(a) * r, y = Math.sin(a) * r
    let ok = true
    for (const b of w.bodies) if (hyp(b.x - x, b.y - y) < b.r + 72) { ok = false; break }
    if (ok) return { x, y }
  }
  return { x: 0, y: -w.arenaR * 0.6 } // fallback: a safe high core
}

export function makeWorld(seed: number, best = 0): World {
  const rng = mulberry32((seed >>> 0) || 1)
  // a central heavy world + two lighter companions, deterministically placed
  const bodies: Body[] = [
    { x: 0, y: 0, r: 56, mass: 320 },
    { x: -250, y: -130, r: 32, mass: 110 },
    { x: 270, y: 140, r: 38, mass: 140 },
  ]
  // insert the spark on a BOUND orbit: tangential speed below escape (circular ≈ 46 here),
  // so it loops the central well toward the cores rather than flinging straight to the void.
  const w: World = {
    bodies, cores: [], score: 0, best, t: 0, arenaR: ARENA_R, over: false, rng,
    ship: { x: 0, y: -400, vx: 28, vy: 0, angle: 0, fuel: FUEL_MAX, alive: true, thrusting: false },
  }
  for (let i = 0; i < TARGET_CORES; i++) w.cores.push(spawnCore(w))
  return w
}

// acceleration on a point from all bodies (exposed for the renderer's ghost-trail predictor)
export function gravityAt(w: World, x: number, y: number): { ax: number; ay: number } {
  let ax = 0, ay = 0
  for (const b of w.bodies) {
    const dx = b.x - x, dy = b.y - y
    const d2 = dx * dx + dy * dy + SOFT * SOFT
    const a = (G * b.mass) / d2
    const inv = 1 / Math.sqrt(d2)
    ax += a * dx * inv
    ay += a * dy * inv
  }
  return { ax, ay }
}

export function tick(w: World, dt: number, input: Input): TickEvents {
  const ev: TickEvents = { collected: 0, crashed: false, lost: false }
  if (w.over) return ev
  w.t += dt
  const s = w.ship

  // steer
  s.angle += TURN_RATE * input.rotate * dt
  s.thrusting = input.thrust && s.fuel > 0
  if (s.thrusting) {
    s.vx += Math.cos(s.angle) * THRUST * dt
    s.vy += Math.sin(s.angle) * THRUST * dt
    s.fuel = Math.max(0, s.fuel - FUEL_DRAIN * dt)
  }

  // gravity + integrate (semi-implicit Euler)
  const g = gravityAt(w, s.x, s.y)
  s.vx += g.ax * dt
  s.vy += g.ay * dt
  const sp = hyp(s.vx, s.vy) // cap only the extremes; stable orbits sit well under MAXV and are untouched
  if (sp > MAXV) { const k = MAXV / sp; s.vx *= k; s.vy *= k }
  s.x += s.vx * dt
  s.y += s.vy * dt

  // cores — gathered on contact, then a fresh one lights elsewhere
  for (let i = w.cores.length - 1; i >= 0; i--) {
    const c = w.cores[i]
    if (hyp(c.x - s.x, c.y - s.y) < CORE_R + SHIP_R) {
      w.cores.splice(i, 1)
      w.score++
      s.fuel = Math.min(FUEL_MAX, s.fuel + CORE_FUEL)
      ev.collected++
    }
  }
  while (w.cores.length < TARGET_CORES) w.cores.push(spawnCore(w))

  // the void-wall turns you back (a soft reflective bound) — you don't die out here, you're penned in
  const dC = hyp(s.x, s.y)
  if (dC > w.arenaR) {
    const nx = s.x / dC, ny = s.y / dC
    const vdot = s.vx * nx + s.vy * ny
    if (vdot > 0) { s.vx -= 2 * vdot * nx; s.vy -= 2 * vdot * ny; s.vx *= 0.6; s.vy *= 0.6 }
    s.x = nx * (w.arenaR - 1); s.y = ny * (w.arenaR - 1)
    ev.lost = true // (kept as a "bounced" signal for sfx)
  }

  // death — only a world's surface
  for (const b of w.bodies) {
    if (hyp(b.x - s.x, b.y - s.y) < b.r + SHIP_R) { s.alive = false; w.over = true; ev.crashed = true; break }
  }

  if (w.over && w.score > w.best) w.best = w.score
  return ev
}

const HS_KEY = 'gravitar.best'
export function loadBest(): number {
  try { return Number(localStorage.getItem(HS_KEY)) || 0 } catch { return 0 }
}
export function saveBest(best: number) {
  try { localStorage.setItem(HS_KEY, String(best)) } catch { /* unavailable */ }
}
