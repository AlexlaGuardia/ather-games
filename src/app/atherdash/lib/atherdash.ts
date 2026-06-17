// ATHERDASH — a spark of Ather dashes forward down receding elemental lanes, the
// Dying chasing behind (same protagonist kind as Updraft's mote — keep the family).
// THIS IS THE SLICE: pure forward motion + clean lane-swaps on a fake-3D ground.
// NO gates / elements / obstacles / score / juice / chase yet — those are phases
// after the feel is proven (see DESIGN.md, Gravitar lesson: the tell is in the build).
//
// This module is the pure sim + projection (no canvas, no React). The page steps
// tick()/swap() and uses the exported projection so render and sim agree exactly.
// Deterministic from a seed (mulberry32).

import { mulberry32, randInt, type Rng } from '@/lib/arcade/rng'

// ── virtual field (portrait; the renderer scales it) ────────────────────────────
export const VW = 400
export const VH = 600

// fake-3D ground plane: a vanishing point up in the upper third, lanes converge to it.
export const HORIZON_Y = 196 // where z=1 (far) projects
export const NEAR_Y = 624 // where z=0 (at camera) projects — just past the bottom edge
export const VANISH_X = VW / 2 // lanes converge here at the horizon
export const PERSP_K = 2.6 // perspective curve; higher = near-camera rushes harder

export const LANES = 3 // slice starts at 3; widen to 4 elements after feel is proven
export const NEAR_LANE_DX = 120 // lane spacing at the near plane (p=1)
export const SPARK_Y = 516 // the spark holds a fixed screen Y; only its x swaps lanes

export const SPEED = 0.92 // z units/sec the world rushes toward the camera
export const SWAP_T = 0.12 // seconds for a full one-lane swap (crisp lerp)
export const MARKER_EVERY = 0.42 // seconds between inert depth markers
export const DASH_COUNT = 14 // ground dashes scrolling z→0 to read as speed

// ── projection (THE crux — exported so test + render share one truth) ───────────
// z ∈ [1 (far, at horizon) … 0 (near, at camera)]. p ∈ [0 … 1] eased for perspective.
export function persp(z: number): number {
  const zc = Math.max(0, Math.min(1, z))
  return (1 - zc) / (1 + zc * PERSP_K)
}
export function screenY(z: number): number {
  return HORIZON_Y + (NEAR_Y - HORIZON_Y) * persp(z)
}
// lane index (may be fractional, mid-swap) → its x at the near plane
export function laneNearX(laneF: number): number {
  return VANISH_X + (laneF - (LANES - 1) / 2) * NEAR_LANE_DX
}
export function screenX(laneF: number, z: number): number {
  return VANISH_X + (laneNearX(laneF) - VANISH_X) * persp(z)
}

export interface Marker {
  z: number // depth, 1=horizon → 0=camera
  lane: number // which lane it rides
}

export type DashState = 'running' // slice has one state; phases add ready/over later

export interface World {
  lane: number // target lane (integer, what input sets)
  x: number // current lane position (lerps toward lane — fractional mid-swap)
  markers: Marker[]
  dashes: number[] // ground-dash z values, recycled 0→1
  spawnT: number // accumulator for marker spawns
  rng: Rng
}

export function makeWorld(seed: number): World {
  const startLane = (LANES - 1) >> 1 // center lane
  return {
    lane: startLane,
    x: startLane,
    markers: [],
    // dashes evenly spaced in depth so the stream reads continuous from frame 1
    dashes: Array.from({ length: DASH_COUNT }, (_, i) => i / DASH_COUNT),
    spawnT: 0,
    rng: mulberry32(seed >>> 0),
  }
}

// Move the target lane by ±1, clamped to the field. Input calls this.
export function swap(w: World, dir: number) {
  w.lane = Math.max(0, Math.min(LANES - 1, w.lane + Math.sign(dir)))
}

function spawnMarker(w: World) {
  w.markers.push({ z: 1, lane: randInt(w.rng, 0, LANES - 1) })
}

// One frame. Lerps x toward the target lane, rushes the world toward the camera,
// recycles ground dashes, spawns + retires inert depth markers.
export function tick(w: World, dt: number) {
  // crisp lane-swap: linear toward target, full lane in SWAP_T seconds
  const step = dt / SWAP_T
  if (w.x < w.lane) w.x = Math.min(w.lane, w.x + step)
  else if (w.x > w.lane) w.x = Math.max(w.lane, w.x - step)

  // ground dashes rush toward the camera, recycle to the horizon
  for (let i = 0; i < w.dashes.length; i++) {
    let z = w.dashes[i] - SPEED * dt
    while (z < 0) z += 1
    w.dashes[i] = z
  }

  // inert markers ride their lane forward; drop the ones that reach the camera
  for (const m of w.markers) m.z -= SPEED * dt
  w.markers = w.markers.filter((m) => m.z > 0)

  // spawn a steady stream from the horizon
  w.spawnT += dt
  while (w.spawnT >= MARKER_EVERY) {
    w.spawnT -= MARKER_EVERY
    spawnMarker(w)
  }
}
