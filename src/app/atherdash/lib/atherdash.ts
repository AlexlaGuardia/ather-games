// ATHERDASH — a spark of Ather dashes forward down four elemental lanes, the Dying
// chasing behind (same protagonist kind as Updraft's mote — keep the family).
//
// PHASE 1 (the core game): the four lanes ARE the canon elements (Water / Storm /
// Earth / Mana). Gates rush in from the horizon, each tuned to one element — its
// lane is the open door, the rest are wall. Be in the matching lane when the gate
// reaches you, or you hit the wall. The skill is READ-AHEAD under swap pressure:
// spot the gate's element, slide to that lane in time. (Updraft is timing; this is
// positional anticipation.) Pick-up-die-retry, score = gates threaded.
// NOT yet: the Dying-chase (Phase 2), speed ramp (Phase 3), sfx/juice (Phase 4).
//
// Pure sim + projection (no canvas, no React). The page steps tick()/swap()/start()
// and uses the exported projection so render and sim agree. Deterministic (mulberry32).

import { mulberry32, type Rng } from '@/lib/arcade/rng'

// ── virtual field (portrait; the renderer scales it) ────────────────────────────
export const VW = 400
export const VH = 600

// fake-3D ground plane: a vanishing point up in the upper third, lanes converge to it.
export const HORIZON_Y = 196 // where z=1 (far) projects
export const NEAR_Y = 624 // where z=0 (at camera) projects — just past the bottom edge
export const VANISH_X = VW / 2 // lanes converge here at the horizon
export const PERSP_K = 2.6 // perspective curve; higher = near-camera rushes harder

export const LANES = 4 // the four canon elements
export const NEAR_LANE_DX = 96 // lane spacing at the near plane (p=1) — 4 lanes fit VW
export const SPARK_Y = 516 // the spark holds a fixed screen Y; only its x swaps lanes

// forward motion ramps: opens slow + forgiving, earns its speed over distance.
export const SPEED = 0.6 // BASE z units/sec at the start (was a flat 0.74 — Alex: "a bit slower")
export const SPEED_MAX = 0.86 // top speed the run climbs toward
export const SPEED_RAMP_DIST = 70 // distance over which speed eases base→max (gentle, ~2 min)
export function speedAt(dist: number): number {
  const k = Math.min(1, Math.max(0, dist / SPEED_RAMP_DIST))
  return SPEED + (SPEED_MAX - SPEED) * k
}

export const SWAP_T = 0.12 // seconds for a full one-lane swap (crisp lerp)
export const DASH_COUNT = 14 // ground dashes per lane, scrolling z→0 to read as speed

export const GATE_GAP_Z = 1.0 // track distance between gates (was 0.6 — Alex: needs more runway
//   to line up multi-lane moves; one swipe = one lane, so packed gates were near-impossible)
export const LEAD_DIST = 1.0 // distance before the first gate spawns (a breath to start)
export const GATE_HIT_Z = 0.085 // depth at which a gate reaches the spark and resolves
//   (SPARK_Y projects to z≈0.085 — gate logic + the visual line up)

// ── the second axis: tap to JUMP, over pitfalls (gaps the floor drops out of) ────
export const JUMP_DUR = 0.6 // seconds airborne per hop (this IS the timing window to clear a pit)
export const JUMP_H = 64 // apex lift in near-pixels (render only — sim cares only about `air > 0`)
export const PIT_GAP_Z = 4.0 // multiple of GATE_GAP_Z → pits land CENTRED between gates (clean rhythm, no overlap)
export const PIT_LEAD = 3.5 // first pitfall — a few gates teach the slide before the hop arrives (lands mid-gap)
export const PIT_DEPTH_Z = 0.13 // visual z-thickness of the gap (render)

// ── canon elements (one per lane; colours match the Mana'nana orbs) ─────────────
export interface Element {
  id: string
  name: string
  base: string // lane / portal colour
  light: string // bright accent
  edge: string // dim edge
}
export const ELEMENTS: Element[] = [
  { id: 'water', name: 'Water', base: '#37a3e6', light: '#a6d8f7', edge: '#1d5f8e' },
  { id: 'storm', name: 'Storm', base: '#f0a526', light: '#ffd884', edge: '#9c6510' },
  { id: 'earth', name: 'Earth', base: '#48b56f', light: '#a4e7bb', edge: '#236e3f' },
  { id: 'mana', name: 'Mana', base: '#9b5ad2', light: '#d8b3f2', edge: '#5e3088' },
]

// ── projection (THE crux — exported so test + render share one truth) ───────────
// z ∈ [1 (far, at horizon) … 0 (near, at camera)]. p ∈ [0 … 1] eased for perspective.
export function persp(z: number): number {
  const zc = Math.max(0, Math.min(1, z))
  return (1 - zc) / (1 + zc * PERSP_K)
}
export function screenY(z: number): number {
  return HORIZON_Y + (NEAR_Y - HORIZON_Y) * persp(z)
}
export function laneNearX(laneF: number): number {
  return VANISH_X + (laneF - (LANES - 1) / 2) * NEAR_LANE_DX
}
export function screenX(laneF: number, z: number): number {
  return VANISH_X + (laneNearX(laneF) - VANISH_X) * persp(z)
}

export type GameState = 'ready' | 'playing' | 'over'

export interface Gate {
  z: number // depth, 1=horizon → 0=camera
  lane: number // the OPEN lane (its element) — be here to pass
  resolved: boolean // already judged at the hit plane
  passed: boolean // …and you made it
}

// pitfall: a gap spanning ALL lanes — you can't slide around it, you must JUMP it.
// (the clean axis split: gates = slide skill, pits = jump skill.)
export interface Pit {
  z: number
  resolved: boolean
  cleared: boolean // airborne when it passed underfoot
}

export interface World {
  state: GameState
  lane: number // target lane (integer, what input sets)
  x: number // current lane position (lerps toward lane — fractional mid-swap)
  air: number // seconds left in the current hop (>0 = airborne, clears pits)
  gates: Gate[]
  pits: Pit[]
  dashes: number[] // ground-dash z values, recycled 0→1
  dist: number // total forward distance travelled (drives cadence + speed ramp)
  nextGateAt: number // dist at which to spawn the next gate
  nextPitAt: number // dist at which to spawn the next pitfall
  score: number // obstacles cleared this run
  best: number
  rng: Rng
}

const START_LANE = (LANES - 1) >> 1 // lane 1 (Storm) — left-of-centre of the four

export function makeWorld(seed: number): World {
  return {
    state: 'ready',
    lane: START_LANE,
    x: START_LANE,
    air: 0,
    gates: [],
    pits: [],
    dashes: Array.from({ length: DASH_COUNT }, (_, i) => i / DASH_COUNT),
    dist: 0,
    nextGateAt: LEAD_DIST,
    nextPitAt: PIT_LEAD,
    score: 0,
    best: 0,
    rng: mulberry32(seed >>> 0),
  }
}

// First input launches the run.
export function start(w: World) {
  if (w.state === 'ready') w.state = 'playing'
}

// Move the target lane by ±1, clamped. Only while playing.
export function swap(w: World, dir: number) {
  if (w.state !== 'playing') return
  w.lane = Math.max(0, Math.min(LANES - 1, w.lane + Math.sign(dir)))
}

// Hop. Only while grounded — no double-hop, so you can't sit in the air forever.
export function jump(w: World) {
  if (w.state !== 'playing') return
  if (w.air > 0) return
  w.air = JUMP_DUR
}

// Lane choice is weighted toward the previous gate's lane so the run reads as a
// flowing path, not a teleport gauntlet. With one input = one lane, a long string
// of 3-lane jumps is what made it feel impossible — so far hops are rare, adjacent
// moves common, and an occasional repeat gives a beat of rest.
const LANE_WEIGHT = [1.4, 5, 2, 0.8] // index = |lane − prevLane|: rest / adjacent / two / three
function spawnGate(w: World) {
  const prev = w.gates.length ? w.gates[w.gates.length - 1].lane : Math.floor(LANES / 2)
  let total = 0
  for (let c = 0; c < LANES; c++) total += LANE_WEIGHT[Math.abs(c - prev)]
  let r = w.rng() * total
  let lane = 0
  for (let c = 0; c < LANES; c++) {
    r -= LANE_WEIGHT[Math.abs(c - prev)]
    if (r <= 0) { lane = c; break }
  }
  w.gates.push({ z: 1, lane, resolved: false, passed: false })
}

export interface TickEvents {
  pass: number // gates threaded this frame
  crash: boolean // hit a wall this frame
  jumpClear: number // pitfalls cleared (hopped) this frame
  fell: boolean // fell into a pitfall this frame
}

// One frame. Lerps x toward target, ages the hop, rushes the world (speed ramps
// with distance), spawns + resolves gates and pitfalls.
export function tick(w: World, dt: number): TickEvents {
  const ev: TickEvents = { pass: 0, crash: false, jumpClear: 0, fell: false }
  const sp = speedAt(w.dist) // current forward speed (climbs base→max over distance)

  // ground dashes always rush (the road reads alive on the ready screen too)
  for (let i = 0; i < w.dashes.length; i++) {
    let z = w.dashes[i] - sp * dt
    while (z < 0) z += 1
    w.dashes[i] = z
  }

  if (w.state !== 'playing') return ev

  // age the hop — airborne while air > 0
  if (w.air > 0) w.air = Math.max(0, w.air - dt)

  // crisp lane-swap: linear toward target, full lane in SWAP_T seconds
  const step = dt / SWAP_T
  if (w.x < w.lane) w.x = Math.min(w.lane, w.x + step)
  else if (w.x > w.lane) w.x = Math.max(w.lane, w.x - step)

  // advance the world + spawn gates and pitfalls on their cadences
  w.dist += sp * dt
  while (w.dist >= w.nextGateAt) {
    spawnGate(w)
    w.nextGateAt += GATE_GAP_Z
  }
  while (w.dist >= w.nextPitAt) {
    w.pits.push({ z: 1, resolved: false, cleared: false })
    w.nextPitAt += PIT_GAP_Z
  }

  // ride gates forward; resolve each once it reaches the spark's plane (lane skill)
  for (const g of w.gates) {
    g.z -= sp * dt
    if (!g.resolved && g.z <= GATE_HIT_Z) {
      g.resolved = true
      if (Math.round(w.x) === g.lane) {
        g.passed = true
        w.score += 1
        ev.pass += 1
      } else {
        ev.crash = true
      }
    }
  }
  w.gates = w.gates.filter((g) => g.z > -0.06)

  // ride pitfalls forward; clear by being airborne when the gap is underfoot (jump skill)
  for (const p of w.pits) {
    p.z -= sp * dt
    if (!p.resolved && p.z <= GATE_HIT_Z) {
      p.resolved = true
      if (w.air > 0) {
        p.cleared = true
        w.score += 1
        ev.jumpClear += 1
      } else {
        ev.fell = true
      }
    }
  }
  w.pits = w.pits.filter((p) => p.z > -0.06)

  if (ev.crash || ev.fell) {
    w.state = 'over'
    if (w.score > w.best) w.best = w.score
  }
  return ev
}

// ── hi-score persistence (localStorage; safe on the server) ─────────────────────
const HS_KEY = 'atherdash_best'
export function loadHiScore(): number {
  try {
    return Math.max(0, parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0)
  } catch {
    return 0
  }
}
export function saveHiScore(score: number): number {
  try {
    const best = Math.max(score, loadHiScore())
    localStorage.setItem(HS_KEY, String(best))
    return best
  } catch {
    return score
  }
}
