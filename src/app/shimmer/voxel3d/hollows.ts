// The Hollows — unanswered drain-grey, bodied. The pure half: eligibility, drift, guttering.
//
// ★ CANON (ruled 2026-08-07, CANON/game/shimmer-geography.md › THE HOLLOWS — read it before
// touching what these ARE): a Hollow is the greying wearing a shape. Not a spirit, not a Mana'mal,
// not a collared anything — absence given just enough form to move. It has HP because there is
// NOTHING IN IT TO FREE: the verb is DISPERSE (gun or cast puts frequency back into a place that
// had none), never kill, never un-collar. It forms ONLY where the ground was already drained —
// darkness is the CONDITION, never the CAUSE. A Hollow appearing on healthy ground is the
// 2026-06-16 failure returning; the eligibility gate below is that sentence as code.
//
// ⚠ BLOCKOUT. The locked look is owed a design-briefs + /picaso pass; this fixes behaviour only.
// Everything else — counts, tiers, drops, difficulty, whether they linger in deep-greyed pockets
// by day — is build tuning and is Jin's (the ruling says so explicitly).
//
// ★ THE BODY IS A GLIDE, NOT A WALKER. A smear has no feet: it drifts toward the keeper at a
// fixed hover above the ground line, unbothered by single blocks. That is cheaper than pathing
// and reads MORE wrong-in-the-right-way — terrain does not slow it, which is quietly the scariest
// thing about it. Speed sits under run speed: a keeper who runs, escapes. Menace, not a wall.

import { greyness } from '../voxel/biome'

export interface HollowState {
  x: number; y: number; z: number
  hp: number
  /** 0 = fully formed .. 1 = guttered out (despawn). Driven up by dawn, never down. */
  gutter: number
  /** Per-hollow phase so a pack never pulses in sync. */
  phase: number
}

export const HOLLOW_HP = 30
export const HOLLOW_CAP = 5          // at most this many bodied at once — a menace, not a horde
export const HOLLOW_HOVER = 1.15     // metres above the ground line
export const HOLLOW_SPEED = 3.4      // < run speed: running away always works
export const HOLLOW_RADIUS = 0.85    // hit sphere for projectiles
export const SPAWN_NEAR = 18         // ring around the player where one may body
export const SPAWN_FAR = 40
export const DESPAWN_DIST = 70
/** daylight() below this = the tide is in; above GUTTER_AT, any bodied Hollow gutters out. */
export const NIGHT_BELOW = 0.22
export const GUTTER_AT = 0.30

/**
 * May the grey body HERE, now? The whole ruling in one predicate:
 *   drained ground (the cause happened long ago) + dark (the condition) + dry land (a Hollow is
 *   a shape in the air over ground, not a thing in the water).
 * `daylightNow` is the day-cycle's 0..1; `surfaceH`/`seaLevel` come from the caller so this stays
 * a pure function of things already known.
 */
export function hollowEligible(
  x: number, z: number, seed: number,
  daylightNow: number, surfaceH: number, seaLevel: number,
): boolean {
  if (daylightNow >= NIGHT_BELOW) return false
  if (surfaceH <= seaLevel + 1) return false
  return greyness(x, z, seed) >= 0.5
}

/**
 * One drift step. Pure: returns nothing, mutates the state it is given (the caller owns the
 * matching mesh). `groundAt` is the carved surface line — the glide follows it at HOLLOW_HOVER,
 * eased so a bench edge reads as a swell in the drift, not a stair-step.
 */
export function hollowStep(
  h: HollowState, dt: number, px: number, pz: number,
  groundAt: (x: number, z: number) => number, time: number,
): void {
  const dx = px - h.x, dz = pz - h.z
  const d = Math.hypot(dx, dz)
  const speed = HOLLOW_SPEED * (1 - h.gutter)          // a guttering Hollow loses its will first
  if (d > 0.5) {
    h.x += (dx / d) * speed * dt
    h.z += (dz / d) * speed * dt
  }
  const want = groundAt(h.x, h.z) + 1 + HOLLOW_HOVER + Math.sin(time * 1.7 + h.phase) * 0.12
  h.y += (want - h.y) * Math.min(1, dt * 3)
}

/** Distance from point P to the segment A→A+D·len — the projectile hit test, shared with the
 *  oracle so "the gun can actually hit one" is an assertable claim, not a hope. */
export function segmentDist(
  ax: number, ay: number, az: number, dx: number, dy: number, dz: number, len: number,
  px: number, py: number, pz: number,
): number {
  const t = Math.max(0, Math.min(len, (px - ax) * dx + (py - ay) * dy + (pz - az) * dz))
  const qx = ax + dx * t, qy = ay + dy * t, qz = az + dz * t
  return Math.hypot(px - qx, py - qy, pz - qz)
}
