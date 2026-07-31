// Burrows — the moglin half of living-spawners. Canon ruled 2026-07-30
// (CANON/game/shimmer-geography.md): "a burrow is a mouth, a hold is the hand behind it."
// Collared moglins press into a plot through burrows near its edge for as long as that
// area's hold still stands; free the hold and the tunnelling STOPS. Warrens and Gloview
// are free homes — nothing hostile ever comes out of one (they are simply never authored
// as spawners, and nothing here can conjure a burrow that was not placed by hand).
//
// Build reading of the ruling (rates/placement/cadence are Jin's per the boundary line):
//   • The spawner placements (world/spawn-placements.ts, editor-authored) ARE the burrows.
//     One authoring surface, same rule as the spawn board's resource locations.
//   • A patrol is OUT whenever its hold stands and it has not been beaten THIS WINDOW.
//     Beating one sends it back down the mouth for the rest of the current spawn-board
//     window; the next deal presses again. This replaces the old 10-minute real-time
//     cooldown (`SPAWNER_COOLDOWN_MS`) — one clock for everything living, and the only
//     stored bit shrinks from a timestamp to the window index it was beaten in.
//   • The patrol's position is DERIVED from wall-clock time, like the board and the hour:
//     two keepers in the same field watch the same moglin round the same corner with
//     nothing synced. Nothing is simulated, so a closed tab costs nothing.
//
// The walk itself: a loop of walkable waypoints around the mouth, picked deterministically
// per burrow. The engine never sees the grid — the caller hands in a walkability test —
// so this stays pure and the oracle can shape terrain freely.

import type { DealWindow } from './spawn-board'

/** How far patrol waypoints reach from the mouth, in tiles. */
export const PATROL_RADIUS = 3.5
/** Patrol walking pace, tiles per second. Unhurried — a bored sentry, not a hunter. */
export const PATROL_SPEED = 1.1
/** Pause at each waypoint, seconds. The look-around beat that makes it read as a patrol. */
export const PATROL_PAUSE_S = 1.6
/** How long an emerging patrol spends rising out of the mouth at a window boundary. */
export const EMERGE_MS = 2_500

// ── the beaten record ───────────────────────────────────────────────────────
// Stored per save as { [burrowKey]: windowIndex }. A patrol is down iff its stored index
// equals the CURRENT window — any other value (older window, or a pin elsewhere) means
// the world has re-dealt and the burrow presses again. Old entries are self-expiring
// garbage; prune() keeps the record from accreting one key per burrow forever.

export type BeatenRecord = Record<string, number>

export function patrolDown(beaten: BeatenRecord, key: string, win: DealWindow): boolean {
  return beaten[key] === win.index
}

export function markBeaten(beaten: BeatenRecord, key: string, win: DealWindow): BeatenRecord {
  return { ...beaten, [key]: win.index }
}

/** Drop entries from past windows — they can never read as down again. */
export function pruneBeaten(beaten: BeatenRecord, win: DealWindow): BeatenRecord {
  const out: BeatenRecord = {}
  for (const [k, v] of Object.entries(beaten)) if (v === win.index) out[k] = v
  return out
}

// ── deterministic per-burrow randomness ─────────────────────────────────────
// Same FNV-1a + murmur3-finalizer shape as spawn-board's hash01 — patrols need their own
// stream so a burrow's walk is independent of what the resource deal rolled next door.

function hashKey(key: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

function mulberry(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── the loop ────────────────────────────────────────────────────────────────

export interface PatrolLoop {
  /** Ordered waypoints in the caller's tile space (fractional ok). Closed: last→first. */
  points: { x: number; y: number }[]
  /** Total loop time in seconds (walk legs + pauses). */
  periodS: number
  /** Per-burrow phase offset so neighbouring patrols never march in step. */
  phaseS: number
  /** Leg lengths (tiles) between consecutive points, wrapping. */
  legs: number[]
  /** Walk pace + pause beat this loop was built with — pose math reads THESE, so a loop
   *  built with custom dials (plot spirits ambling vs moglins patrolling) stays coherent. */
  speed: number
  pauseS: number
}

/** Optional pacing dials for patrolLoop — defaults are the moglin constants, so existing
 *  callers change nothing. The Home Plot spirit ring reuses this machinery at amble pace. */
export interface WanderDials { radius?: number; speed?: number; pauseS?: number }

/**
 * Build a burrow's patrol loop. Candidate waypoints ring the mouth at seeded angles and
 * radii; each must be walkable AND reachable in a straight sampled line from the previous
 * kept point (a body gliding through a wall corner reads as a bug, so a leg that clips is
 * simply dropped). Under 3 survivors → the patrol idles at the mouth instead (empty loop).
 */
export function patrolLoop(
  cx: number, cy: number,
  isWalkable: (x: number, y: number) => boolean,
  key: string,
  dials?: WanderDials,
): PatrolLoop {
  const radius = dials?.radius ?? PATROL_RADIUS
  const speed = dials?.speed ?? PATROL_SPEED
  const pauseS = dials?.pauseS ?? PATROL_PAUSE_S
  const rnd = mulberry(hashKey(key))
  const phaseS = rnd() * 40
  const CANDIDATES = 7
  const start = rnd() * Math.PI * 2
  const kept: { x: number; y: number }[] = []
  for (let i = 0; i < CANDIDATES; i++) {
    const a = start + (i / CANDIDATES) * Math.PI * 2 + (rnd() - 0.5) * 0.5
    const r = radius * (0.6 + rnd() * 0.4)
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (!isWalkable(Math.round(x), Math.round(y))) continue
    const prev = kept.length ? kept[kept.length - 1] : { x: cx, y: cy }
    if (!clearLine(prev.x, prev.y, x, y, isWalkable)) continue
    kept.push({ x, y })
  }
  // The loop closes last→first: that leg must be clear too, or trim until it is.
  while (kept.length >= 3 && !clearLine(kept[kept.length - 1].x, kept[kept.length - 1].y, kept[0].x, kept[0].y, isWalkable)) {
    kept.pop()
  }
  if (kept.length < 3) return { points: [], periodS: 1, phaseS, legs: [], speed, pauseS }
  const legs = kept.map((p, i) => {
    const q = kept[(i + 1) % kept.length]
    return Math.hypot(q.x - p.x, q.y - p.y)
  })
  const walkS = legs.reduce((a, b) => a + b, 0) / speed
  const periodS = walkS + kept.length * pauseS
  return { points: kept, periodS, phaseS, legs, speed, pauseS }
}

/** Straight line between two points stays walkable, sampled every half tile. */
function clearLine(x0: number, y0: number, x1: number, y1: number, isWalkable: (x: number, y: number) => boolean): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0)
  const steps = Math.max(1, Math.ceil(d * 2))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    if (!isWalkable(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t))) return false
  }
  return true
}

export interface PatrolPose {
  x: number
  y: number
  /** Facing angle, radians, atan2 convention in tile space. */
  facing: number
  /** true while paused at a waypoint (the look-around beat). */
  paused: boolean
  /** 0→1 during the emerge beat at a window boundary, 1 after. Scale/opacity hook. */
  emerge: number
}

/**
 * Where the patrol stands NOW — pure function of wall-clock ms, the loop, and the window
 * (for the emerge beat at each boundary). Empty loop → stands at the mouth, slowly turning.
 */
export function patrolPose(loop: PatrolLoop, cx: number, cy: number, nowMs: number, win: DealWindow): PatrolPose {
  const emerge = Math.min(1, Math.max(0, (nowMs - win.startMs) / EMERGE_MS))
  if (loop.points.length < 3) {
    return { x: cx, y: cy, facing: ((nowMs / 1000 + loop.phaseS) * 0.35) % (Math.PI * 2), paused: true, emerge }
  }
  const legS = loop.legs.map(l => l / loop.speed)
  let t = ((nowMs / 1000 + loop.phaseS) % loop.periodS + loop.periodS) % loop.periodS
  for (let i = 0; i < loop.points.length; i++) {
    const p = loop.points[i]
    const q = loop.points[(i + 1) % loop.points.length]
    if (t < loop.pauseS) {
      // Paused at p, facing where it will walk next.
      return { x: p.x, y: p.y, facing: Math.atan2(q.y - p.y, q.x - p.x), paused: true, emerge }
    }
    t -= loop.pauseS
    if (t < legS[i]) {
      const f = t / legS[i]
      return {
        x: p.x + (q.x - p.x) * f,
        y: p.y + (q.y - p.y) * f,
        facing: Math.atan2(q.y - p.y, q.x - p.x),
        paused: false, emerge,
      }
    }
    t -= legS[i]
  }
  // Numerical spill (t ≈ period) lands back at the first point's pause.
  const p = loop.points[0], q = loop.points[1]
  return { x: p.x, y: p.y, facing: Math.atan2(q.y - p.y, q.x - p.x), paused: true, emerge }
}
