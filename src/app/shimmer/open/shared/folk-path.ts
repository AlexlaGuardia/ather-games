// FOLK WALK PATHS (BETA M32, Greg's tour, 11-19). Pure: a folk rig walking a polyline at a steady pace, turning toward where
// it is going (never snapping), plus an arc helper that walks AROUND something round (a pool) instead of through it.
// Yaw convention is the RIG's: a group with rotation-y = yaw faces (sin yaw, cos yaw) (the rig's face is +z). The keeper's
// walker uses the opposite sign; do not mix the two.

export interface Pt { x: number; z: number }
export interface Walk { x: number; z: number; yaw: number; leg: number }   // leg = index of the next point to reach

export const WALK_SPEED = 1.5   // m/s: an easy stroll, a little under the keeper's walk so a follower can keep up
export const TURN_RATE = 7      // rad/s

/** the yaw that faces `to` from `from` (rig convention) */
export const faceYaw = (from: Pt, to: Pt) => Math.atan2(to.x - from.x, to.z - from.z)

/** `yaw` turned toward `target` by at most `max`, the short way round */
export function turnToward(yaw: number, target: number, max: number): number {
  let d = (target - yaw) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d) <= max ? target : yaw + Math.sign(d) * max
}

export const startWalk = (at: Pt, yaw: number): Walk => ({ x: at.x, z: at.z, yaw, leg: 0 })

/** advance `w` along `pts` by `dt` seconds. Spends the whole step's distance, across several points when they are close.
 *  `done` once the last point is reached (the walker stands exactly on it). */
export function stepWalk(w: Walk, pts: readonly Pt[], dt: number, speed = WALK_SPEED): Walk & { done: boolean } {
  let { x, z, leg } = w, yaw = w.yaw, budget = Math.max(0, dt) * speed, heading = yaw
  while (leg < pts.length) {
    const p = pts[leg], dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz)
    if (d > 1e-6) heading = Math.atan2(dx, dz)
    if (d <= budget) { x = p.x; z = p.z; budget -= d; leg++; continue }
    x += (dx / d) * budget; z += (dz / d) * budget; budget = 0
    break
  }
  yaw = turnToward(yaw, heading, TURN_RATE * Math.max(0, dt))
  return { x, z, yaw, leg, done: leg >= pts.length }
}

/** points from `a` to `b` that keep at least `r` from `c`: straight when the line clears the circle, else round the short
 *  side of it on a ring of radius `r` (one point per ~0.5 rad). Ends exactly at `b`. */
export function aroundPath(a: Pt, b: Pt, c: Pt, r: number): Pt[] {
  if (segClear(a, b, c, r)) return [b]
  const aa = Math.atan2(a.x - c.x, a.z - c.z), ab = Math.atan2(b.x - c.x, b.z - c.z)
  let d = ab - aa
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  const n = Math.max(1, Math.ceil(Math.abs(d) / 0.5)), out: Pt[] = []
  for (let k = 0; k <= n; k++) { const t = aa + (d * k) / n; out.push({ x: c.x + Math.sin(t) * r, z: c.z + Math.cos(t) * r }) }
  out.push(b)
  return out
}

/** does the segment a→b stay at least `r` from `c`? */
export function segClear(a: Pt, b: Pt, c: Pt, r: number): boolean {
  const vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz
  const t = L2 ? Math.max(0, Math.min(1, ((c.x - a.x) * vx + (c.z - a.z) * vz) / L2)) : 0
  return Math.hypot(a.x + vx * t - c.x, a.z + vz * t - c.z) >= r - 1e-9
}
