// SQUALL — a mote of Ather caught in the void's squall. No offense, no shots, no shield:
// pure evasion. The void rains telegraphed projectile PATTERNS that escalate the longer you
// last; you read them, weave the gaps, and graze close for extra score. Score = survival time
// (+ graze risk-reward). A brand-new mood for the lineup: defenseless survival. Deterministic
// from a seed (mulberry32) for the Daily.
//
// Pure sim (no canvas, no React). The page sets a heading each frame and calls tick(); it reads
// the events for sound/FX and the world fields (bullets, warnings) to render the vector-glow storm.

import { mulberry32, type Rng } from '@/lib/arcade/rng'

// ── arena (portrait; the renderer scales the virtual field) ──────────────────────
export const VW = 420
export const VH = 620
export const WALL = 14 // bullets despawn this far beyond the arena edge

// ── the mote (you) ───────────────────────────────────────────────────────────────
export const PLAYER_R = 5 // a TINY hitbox — bullet-hell convention; you thread gaps
export const GRAZE_R = 24 // pass a bullet this close (without dying) → graze score
export const PLAYER_SPEED = 250 // responsive; this is precise dodging, not languid drift
export const PLAYER_EASE = 20 // velocity lerp toward target/sec (snappy, slight smoothing)

// ── difficulty ramp over the run ─────────────────────────────────────────────────
export const RAMP_T = 115 // seconds to reach full intensity (gentle on-ramp for casual play)
export function diffAt(t: number): number {
  const d = Math.min(1, t / RAMP_T)
  return d * d * 0.55 + d * 0.45 // eased: gentle open, steepens
}

// ── projectiles + telegraphs ─────────────────────────────────────────────────────
export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  grazed: boolean // already counted a graze (so one bullet grazes once)
}

// a fair warning that resolves into bullets/an emitter when its timer elapses
export type WarnKind = 'aim' | 'burst' | 'spiral'
export interface Warning {
  x: number
  y: number
  kind: WarnKind
  t: number // elapsed
  warn: number // total telegraph time before it fires
  ang: number // facing (aim/spiral)
  power: number // count/intensity, scaled by difficulty at spawn
}

// a short-lived rotating spawner (the spiral pattern's source)
export interface Emitter {
  x: number
  y: number
  t: number
  life: number
  ang: number
  spin: number // rad/sec
  speed: number // bullet speed
  every: number // seconds between emits
  acc: number // emit accumulator
}

export type SquallState = 'ready' | 'playing' | 'dead'

export interface World {
  x: number
  y: number
  vx: number
  vy: number
  hx: number // heading (unit-ish; 0,0 = hold)
  hy: number
  bullets: Bullet[]
  warnings: Warning[]
  emitters: Emitter[]
  time: number // survival seconds — the score spine
  graze: number // close passes banked
  score: number
  nextPattern: number // time of the next director fire
  state: SquallState
  spawnPaused: boolean // tests freeze the director
  rng: Rng
}

export interface TickEvents {
  spawned: boolean // a pattern just telegraphed
  fired: boolean // a telegraph just resolved into bullets
  grazed: boolean // a graze banked this tick
  dead: boolean // a bullet hit you
}
const noEvents = (): TickEvents => ({ spawned: false, fired: false, grazed: false, dead: false })

export function makeWorld(seed: number): World {
  const rng = mulberry32(seed >>> 0)
  return {
    x: VW / 2,
    y: VH * 0.62, // start low-centre (room to read the storm coming from above)
    vx: 0,
    vy: 0,
    hx: 0,
    hy: 0,
    bullets: [],
    warnings: [],
    emitters: [],
    time: 0,
    graze: 0,
    score: 0,
    nextPattern: 1.1, // a beat before the first wave
    state: 'ready',
    spawnPaused: false,
    rng,
  }
}

// heading points where the mote should move (joystick offset / cursor / WASD). magnitude
// clamped to 1; (0,0) = hold position. First real heading launches the run.
export function setHeading(w: World, dx: number, dy: number) {
  const m = Math.hypot(dx, dy)
  if (m > 1e-4) {
    const c = Math.min(1, m) / m
    w.hx = dx * c
    w.hy = dy * c
    if (w.state === 'ready') w.state = 'playing'
  } else {
    w.hx = 0
    w.hy = 0
  }
}

// ── helpers tests + patterns share ───────────────────────────────────────────────
export function addBullet(w: World, x: number, y: number, vx: number, vy: number, r = 6) {
  w.bullets.push({ x, y, vx, vy, r, grazed: false })
}
function spd(diff: number, base: number, top: number) {
  return base + (top - base) * diff
}

// ── the patterns (each clears the gap-or-die test; all telegraphed/edge-entered) ──
// 1) RAIN — a comb of bullets falls from the top with ONE walkable gap.
function rain(w: World, diff: number) {
  const speed = spd(diff, 104, 244)
  const gapW = 104 - diff * 40 // 104 → ~64px gap (roomy opening)
  const gapX = 40 + w.rng() * (VW - 80)
  for (let x = 18; x < VW - 10; x += 30) {
    if (Math.abs(x - gapX) < gapW / 2) continue
    addBullet(w, x, -8, 0, speed, 6)
  }
}
// 2) SWEEP — a column from one side crosses with a moving gap.
function sweep(w: World, diff: number) {
  const speed = spd(diff, 112, 244)
  const fromLeft = w.rng() < 0.5
  const gapH = 132 - diff * 46
  const gapY = 60 + w.rng() * (VH - 120)
  for (let y = 24; y < VH - 16; y += 32) {
    if (Math.abs(y - gapY) < gapH / 2) continue
    addBullet(w, fromLeft ? -8 : VW + 8, y, fromLeft ? speed : -speed, 0, 6)
  }
}
// 3) AIM — telegraph from an edge, then a tight fan snapped at the mote's position.
function aimWarn(w: World, diff: number) {
  const edge = Math.floor(w.rng() * 4)
  const x = edge === 1 ? VW + 8 : edge === 3 ? -8 : w.rng() * VW
  const y = edge === 0 ? -8 : edge === 2 ? VH + 8 : w.rng() * VH
  w.warnings.push({ x, y, kind: 'aim', t: 0, warn: 0.9 - diff * 0.35, ang: 0, power: 3 + Math.round(diff * 4) })
}
// 4) BURST — telegraph a point, then a full ring blooms outward.
function burstWarn(w: World, diff: number) {
  w.warnings.push({
    x: 40 + w.rng() * (VW - 80),
    y: 40 + w.rng() * (VH * 0.6),
    kind: 'burst', t: 0, warn: 0.8 - diff * 0.3, ang: 0, power: 10 + Math.round(diff * 12),
  })
}
// 5) SPIRAL — telegraph a point, then a rotating spawner runs for a couple seconds.
function spiralWarn(w: World, diff: number) {
  w.warnings.push({
    x: 50 + w.rng() * (VW - 100),
    y: 40 + w.rng() * (VH * 0.5),
    kind: 'spiral', t: 0, warn: 0.85 - diff * 0.3, ang: w.rng() * Math.PI * 2, power: 0,
  })
}

// resolve a telegraph into its bullets / emitter
function fireWarning(w: World, wn: Warning, diff: number) {
  if (wn.kind === 'aim') {
    const ax = Math.atan2(w.y - wn.y, w.x - wn.x) // toward the mote at fire time
    const speed = spd(diff, 170, 300)
    const n = wn.power
    for (let i = 0; i < n; i++) {
      const a = ax + (i - (n - 1) / 2) * 0.12 // a tight fan
      addBullet(w, wn.x, wn.y, Math.cos(a) * speed, Math.sin(a) * speed, 6)
    }
  } else if (wn.kind === 'burst') {
    const speed = spd(diff, 110, 200)
    const n = wn.power
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      addBullet(w, wn.x, wn.y, Math.cos(a) * speed, Math.sin(a) * speed, 6)
    }
  } else {
    w.emitters.push({
      x: wn.x, y: wn.y, t: 0, life: 1.8 + diff * 1.2, ang: wn.ang,
      spin: 2.4 + diff * 1.6, speed: spd(diff, 95, 165), every: 0.085, acc: 0,
    })
  }
}

// the director: pick a pattern by difficulty, then schedule the next (tighter as you survive).
function fireDirector(w: World, diff: number) {
  const r = w.rng()
  if (diff < 0.2) {
    r < 0.6 ? rain(w, diff) : sweep(w, diff)
  } else if (diff < 0.5) {
    if (r < 0.4) rain(w, diff)
    else if (r < 0.7) sweep(w, diff)
    else aimWarn(w, diff)
  } else {
    if (r < 0.25) rain(w, diff)
    else if (r < 0.45) sweep(w, diff)
    else if (r < 0.68) aimWarn(w, diff)
    else if (r < 0.86) burstWarn(w, diff)
    else spiralWarn(w, diff)
  }
  const gap = (1.95 - diff * 1.2) // 1.95s → ~0.75s between waves (breathing room early)
  w.nextPattern = w.time + gap
}

// Advance dt seconds. Returns events for sound/FX. No-op unless playing.
export function tick(w: World, dt: number): TickEvents {
  const ev = noEvents()
  if (w.state !== 'playing') return ev
  w.time += dt
  const diff = diffAt(w.time)

  // ── mote movement: snappy ease toward the heading, clamp to the arena ─────────
  const tvx = w.hx * PLAYER_SPEED
  const tvy = w.hy * PLAYER_SPEED
  const k = Math.min(1, dt * PLAYER_EASE)
  w.vx += (tvx - w.vx) * k
  w.vy += (tvy - w.vy) * k
  w.x = Math.max(PLAYER_R, Math.min(VW - PLAYER_R, w.x + w.vx * dt))
  w.y = Math.max(PLAYER_R, Math.min(VH - PLAYER_R, w.y + w.vy * dt))

  // ── director + telegraphs ─────────────────────────────────────────────────────
  if (!w.spawnPaused && w.time >= w.nextPattern) {
    fireDirector(w, diff)
    ev.spawned = true
  }
  for (let i = w.warnings.length - 1; i >= 0; i--) {
    const wn = w.warnings[i]
    wn.t += dt
    if (wn.t >= wn.warn) {
      fireWarning(w, wn, diff)
      w.warnings.splice(i, 1)
      ev.fired = true
    }
  }

  // ── rotating emitters (spiral) ────────────────────────────────────────────────
  for (let i = w.emitters.length - 1; i >= 0; i--) {
    const em = w.emitters[i]
    em.t += dt
    em.ang += em.spin * dt
    em.acc += dt
    while (em.acc >= em.every) {
      em.acc -= em.every
      addBullet(w, em.x, em.y, Math.cos(em.ang) * em.speed, Math.sin(em.ang) * em.speed, 6)
    }
    if (em.t >= em.life) w.emitters.splice(i, 1)
  }

  // ── bullets: move, despawn off-arena, graze + collision ───────────────────────
  for (let i = w.bullets.length - 1; i >= 0; i--) {
    const b = w.bullets[i]
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.x < -WALL || b.x > VW + WALL || b.y < -WALL || b.y > VH + WALL) {
      w.bullets.splice(i, 1)
      continue
    }
    const d = Math.hypot(b.x - w.x, b.y - w.y)
    if (d <= b.r + PLAYER_R) {
      w.state = 'dead'
      ev.dead = true
      w.score = Math.floor(w.time * 10) + w.graze * 5
      return ev
    }
    if (!b.grazed && d <= b.r + GRAZE_R) {
      b.grazed = true
      w.graze++
      ev.grazed = true
    }
  }

  w.score = Math.floor(w.time * 10) + w.graze * 5
  return ev
}

// ── best-score persistence (localStorage) — the chase ────────────────────────────
const BEST_KEY = 'squall.best'
export function loadBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY)
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0
  } catch {
    return 0 // storage unavailable
  }
}
export function saveBest(score: number): number {
  const best = Math.max(loadBest(), Math.max(0, Math.floor(score)))
  try {
    localStorage.setItem(BEST_KEY, String(best))
  } catch {
    /* storage unavailable */
  }
  return best
}
