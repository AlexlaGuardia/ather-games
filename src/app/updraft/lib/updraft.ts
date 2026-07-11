// UPDRAFT — a spark of Ather rides the rising light. A one-tap flight: tap to beat
// upward and rise, fall when you don't, thread the gaps in the void gates. Pure
// pick-up-die-retry. The rider is a mote of Ather-light on the updraft (canon ruling
// 2026-06-16, world/arcade.md: NOT Lazerin — his name stays in the main line).
// No combat, no canon weight. Endless score-chase.
//
// This module is the pure sim (no canvas, no React). The page calls flap()/tick()
// and reads the events for sound + FX. Deterministic from a seed (mulberry32).

import { mulberry32, type Rng } from '@/lib/arcade/rng'

// ── virtual field (portrait; the renderer scales it) ────────────────────────────
export const VW = 400
export const VH = 600
export const GROUND_Y = 560 // floor of the flight lane
export const BIRD_X = 116 // Lazerin holds a fixed x; the world scrolls past him
export const BIRD_R = 11

export const GRAVITY = 1350 // px/s²
export const FLAP_V = -392 // upward impulse per tap
export const SCROLL = 156 // px/s the gates drift left
export const GATE_W = 60
export const GAP_H = 172 // base opening (per-air + ramp adjust it)
export const GAP_MARGIN = 78 // keep a gap centre this far from ceiling/ground
export const SPAWN_DX = 212 // base horizontal spacing (per-air adjusts it)

// ── the four airs of the climb (canon: game/updraft.md) — they LOOP, climbing higher ──
// open current (wide breather) → gate-reach (crowded, tight) → rising thermal (a real updraft
// lifts you) → churn (turbulent; the void-gate openings drift). Endless, no arrival.
export type Air = 'open' | 'gates' | 'thermal' | 'churn'
const AIR_ORDER: Air[] = ['open', 'gates', 'thermal', 'churn']
export const AIR_LEN = 1000 // px of climb per air before the next
export function airAt(dist: number): Air { return AIR_ORDER[Math.floor(Math.max(0, dist) / AIR_LEN) % 4] }
const airGap: Record<Air, number> = { open: 206, gates: 150, thermal: 180, churn: 172 }
const airSpacing: Record<Air, number> = { open: 240, gates: 190, thermal: 210, churn: 206 }

export const THERMAL_G = 0.4 // gravity multiplier while riding the Rising Thermal (floaty lift)
export const CHURN_RATE = 1.7 // rad/s the Churn's openings drift
export const CHURN_AMP = 46 // px the opening centre drifts up/down in the Churn

// endless ramp: openings narrow + the scroll quickens a touch as you climb, both capped fair
function rampGap(dist: number): number { return Math.min(34, Math.max(0, dist) / 340) }
export function scrollAt(dist: number): number { return SCROLL + Math.min(54, Math.max(0, dist) / 260) }

export interface Gate {
  x: number // left edge
  gapY: number // gap centre (base; drifts in the Churn — see effGapY)
  gapH: number // this gate's opening height (per-air + ramp, set at spawn)
  air: Air // the air this gate belongs to (colour + behaviour)
  drift: boolean // Churn air: the opening drifts up and down
  phase: number // per-gate drift phase so churn gates aren't in lockstep
  passed: boolean
}

// a Churn gate's opening centre at time t (clamped inside the lane); others hold still.
// render + collision BOTH call this, so the drift you see is the drift that bites.
export function effGapY(g: Gate, t: number): number {
  if (!g.drift) return g.gapY
  const y = g.gapY + Math.sin(t * CHURN_RATE + g.phase) * CHURN_AMP
  return Math.max(GAP_MARGIN, Math.min(GROUND_Y - GAP_MARGIN, y))
}

export type UpdraftState = 'ready' | 'playing' | 'over'

export interface World {
  y: number // Lazerin's vertical position
  vy: number
  dist: number // total px climbed — drives which air you're in + the endless ramp
  t: number // elapsed sim seconds — drives the Churn's drift
  gates: Gate[]
  score: number
  state: UpdraftState
  rng: Rng
}

export interface TickEvents {
  pass: number // gates cleared this frame
  crash: boolean // died this frame
}

export function makeWorld(seed: number): World {
  return {
    y: VH * 0.42,
    vy: 0,
    dist: 0,
    t: 0,
    gates: [],
    score: 0,
    state: 'ready',
    rng: mulberry32(seed >>> 0),
  }
}

function spawnGate(w: World, x: number) {
  const air = airAt(w.dist)
  const gapH = Math.max(120, airGap[air] - rampGap(w.dist)) // ramp tightens; fair floor
  const m = Math.max(GAP_MARGIN, gapH / 2 + 12) // keep the whole opening inside the lane
  const gapY = m + w.rng() * (GROUND_Y - m * 2)
  w.gates.push({ x, gapY, gapH, air, drift: air === 'churn', phase: w.rng() * Math.PI * 2, passed: false })
}

// START owns launching the run now (the page calls launch()); flap only beats the wings mid-flight.
export function launch(w: World) {
  if (w.state !== 'ready') return
  w.state = 'playing'
  spawnGate(w, VW + 40) // first gate, with a little breathing room (restored)
}

// One tap beats the wings upward. No-op unless in flight — launching is START's job.
export function flap(w: World) {
  if (w.state !== 'playing') return
  w.vy = FLAP_V
}

function hitsGate(w: World, g: Gate): boolean {
  // horizontal overlap of Lazerin's circle with the gate column
  if (BIRD_X + BIRD_R < g.x || BIRD_X - BIRD_R > g.x + GATE_W) return false
  // safe only while fully inside the (possibly-drifting) opening
  const cy = effGapY(g, w.t)
  const top = cy - g.gapH / 2
  const bot = cy + g.gapH / 2
  return w.y - BIRD_R < top || w.y + BIRD_R > bot
}

// Advance dt seconds. Returns what happened (for sound/FX). No-op unless playing.
export function tick(w: World, dt: number): TickEvents {
  const ev: TickEvents = { pass: 0, crash: false }
  if (w.state !== 'playing') return ev
  w.t += dt
  const air = airAt(w.dist)
  const scroll = scrollAt(w.dist)
  w.dist += scroll * dt

  // gravity — the Rising Thermal eases it (a real updraft lifts the mote; you flap less)
  const grav = air === 'thermal' ? GRAVITY * THERMAL_G : GRAVITY
  w.vy += grav * dt
  w.y += w.vy * dt
  // ceiling clamps (fairer than instant death); floor kills
  if (w.y - BIRD_R < 0) {
    w.y = BIRD_R
    if (w.vy < 0) w.vy = 0
  }

  // scroll + spawn: keep a gate every (per-air) spacing; the scroll quickens as you climb
  const lastX = w.gates.length ? w.gates[w.gates.length - 1].x : -Infinity
  if (VW - lastX >= airSpacing[air]) spawnGate(w, VW)
  for (const g of w.gates) g.x -= scroll * dt
  w.gates = w.gates.filter((g) => g.x + GATE_W > -4)

  // collisions + scoring
  if (w.y + BIRD_R >= GROUND_Y) {
    w.state = 'over'
    ev.crash = true
    return ev
  }
  for (const g of w.gates) {
    if (hitsGate(w, g)) {
      w.state = 'over'
      ev.crash = true
      return ev
    }
    if (!g.passed && g.x + GATE_W < BIRD_X - BIRD_R) {
      g.passed = true
      w.score++
      ev.pass++
    }
  }
  return ev
}

// localStorage high score, guarded for SSR / private mode.
const HS_KEY = 'updraft.hiscore'
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
