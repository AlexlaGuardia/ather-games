// LAZ — Lazerin rides the Ather. A one-tap flight: tap to beat your wings and rise,
// fall when you don't, thread the gaps in the void gates. Pure pick-up-die-retry.
// Lazerin is the Crucible's announcer who watches from the Vault — here he's just
// out riding the currents, no combat, no canon weight. Endless score-chase.
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
export const GAP_H = 172
export const GAP_MARGIN = 78 // keep a gap center this far from ceiling/ground
export const SPAWN_DX = 212 // horizontal spacing between gates

export interface Gate {
  x: number // left edge
  gapY: number // gap center
  passed: boolean
}

export type LazState = 'ready' | 'playing' | 'over'

export interface World {
  y: number // Lazerin's vertical position
  vy: number
  gates: Gate[]
  score: number
  state: LazState
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
    gates: [],
    score: 0,
    state: 'ready',
    rng: mulberry32(seed >>> 0),
  }
}

function spawnGate(w: World, x: number) {
  const gapY = GAP_MARGIN + w.rng() * (GROUND_Y - GAP_MARGIN * 2)
  w.gates.push({ x, gapY, passed: false })
}

// One tap. From 'ready' it launches the run; while 'playing' it beats the wings.
export function flap(w: World) {
  if (w.state === 'over') return
  if (w.state === 'ready') {
    w.state = 'playing'
    spawnGate(w, VW + 40) // first gate, with a little breathing room
  }
  w.vy = FLAP_V
}

function hitsGate(w: World, g: Gate): boolean {
  // horizontal overlap of Lazerin's circle with the gate column
  if (BIRD_X + BIRD_R < g.x || BIRD_X - BIRD_R > g.x + GATE_W) return false
  // safe only while fully inside the gap
  const top = g.gapY - GAP_H / 2
  const bot = g.gapY + GAP_H / 2
  return w.y - BIRD_R < top || w.y + BIRD_R > bot
}

// Advance dt seconds. Returns what happened (for sound/FX). No-op unless playing.
export function tick(w: World, dt: number): TickEvents {
  const ev: TickEvents = { pass: 0, crash: false }
  if (w.state !== 'playing') return ev

  // gravity
  w.vy += GRAVITY * dt
  w.y += w.vy * dt
  // ceiling clamps (fairer than instant death); floor kills
  if (w.y - BIRD_R < 0) {
    w.y = BIRD_R
    if (w.vy < 0) w.vy = 0
  }

  // scroll + spawn: keep a gate every SPAWN_DX
  const lastX = w.gates.length ? w.gates[w.gates.length - 1].x : -Infinity
  if (VW - lastX >= SPAWN_DX) spawnGate(w, VW)
  for (const g of w.gates) g.x -= SCROLL * dt
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
const HS_KEY = 'laz.hiscore'
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
