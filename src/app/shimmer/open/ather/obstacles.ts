// BETA M117: entities stop passing through things. ONE obstacle query, shared: slice 3 wires the Hollows to it (they
// steer round structures, their shots stop on a wall); s1 (spirits / NPCs) and s2 (Greg's tour) reuse the same calls.
// PURE: no three, no react. Tested in obstacles.test.ts.
//
// A STRUCTURE is a solid box something can't step over: a settlement building's walls, a placed solid piece (a zone part).
// What counts is whatever the `Structures` query returns; the Wilds' query is `wildsStructures` below (settlementSolids +
// the zone parts the page registers). Trunks and rocks are not here: Terrain.walkable already keeps a Hollow off them.
import type { Box } from '../terrain-world'
import { settlementSolids } from './settlement-lots'

/** The boxes that may touch the ground rectangle [x0,x1] x [z0,z1] (extra boxes are fine; missing ones are a hole). */
export type Structures = (x0: number, z0: number, x1: number, z1: number) => readonly Box[]

/** A body steps over anything lower than `step` above its feet (a floor slab, a doorstep) and is stopped by the rest. */
export const OBSTACLE = { step: 0.6, height: 1.8 } as const

/** Is a body of radius r, feet at y, standing in a structure? (circle as its square: a few cm generous at the corners) */
export function bodyBlocked(q: Structures, x: number, y: number, z: number, r: number, h: number = OBSTACLE.height, step: number = OBSTACLE.step): boolean {
  for (const b of q(x - r, z - r, x + r, z + r))
    if (b.y1 > y + step && b.y0 < y + h && b.x0 < x + r && b.x1 > x - r && b.z0 < z + r && b.z1 > z - r) return true
  return false
}

/** Where the segment a→b first enters a structure: t in [0,1] along it, and the point. null = the line is clear. */
export function segmentHit(q: Structures, ax: number, ay: number, az: number, bx: number, by: number, bz: number): { t: number; x: number; y: number; z: number } | null {
  const dx = bx - ax, dy = by - ay, dz = bz - az
  let best = Infinity
  for (const b of q(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz))) {
    let t0 = 0, t1 = 1, out = false
    for (const [o, d, lo, hi] of [[ax, dx, b.x0, b.x1], [ay, dy, b.y0, b.y1], [az, dz, b.z0, b.z1]] as const) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { out = true; break } continue }
      let ta = (lo - o) / d, tb = (hi - o) / d
      if (ta > tb) [ta, tb] = [tb, ta]
      if (ta > t0) t0 = ta
      if (tb < t1) t1 = tb
      if (t0 > t1) { out = true; break }
    }
    if (!out && t0 < best) best = t0
  }
  return best === Infinity ? null : { t: best, x: ax + dx * best, y: ay + dy * best, z: az + dz * best }
}

/** Can a see b (no structure between)? */
export const lineOfSight = (q: Structures, ax: number, ay: number, az: number, bx: number, by: number, bz: number) => !segmentHit(q, ax, ay, az, bx, by, bz)

/** What a steering body remembers: which way round it committed to, and for how long more. */
export interface SteerMem { side?: number; sideT?: number }
/** Turns tried when the way ahead is blocked (degrees), each to the committed side first. */
const TURNS = [30, 60, 90, 120, 150]
/** Seconds a body keeps its side once the straight way clears (so a corner does not flip it back into the wall). */
export const STEER_HOLD = 1.5

/** Steer round obstacles: the unit direction to move in, wanting (dx,dz). `free(x,z)` says whether a body may stand there;
 *  a direction is good when the spots `look`, `look/2` and a step ahead are all free. Blocked, it turns to one side (kept in `mem`, so it
 *  walks ROUND a building rather than dithering at its face) by the smallest turn that is free. Nothing free: null. */
export function steer(free: (x: number, z: number) => boolean, x: number, z: number, dx: number, dz: number, look: number, mem: SteerMem, dt: number): { x: number; z: number } | null {
  const l = Math.hypot(dx, dz)
  if (l < 1e-6) return null
  const ux = dx / l, uz = dz / l
  const ok = (vx: number, vz: number) => free(x + vx * look * 0.15, z + vz * look * 0.15) && free(x + vx * look * 0.5, z + vz * look * 0.5) && free(x + vx * look, z + vz * look)
  const rot = (deg: number) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return { x: ux * c - uz * s, z: ux * s + uz * c } }
  if (mem.sideT !== undefined) { mem.sideT -= dt; if (mem.sideT <= 0) { mem.side = undefined; mem.sideT = undefined } }
  if (ok(ux, uz)) return { x: ux, z: uz }
  // blocked: the smallest turn that is free, the kept side first (so it hugs one face round, never flips back and forth)
  const tries = mem.side ? [mem.side, -mem.side].flatMap(s => TURNS.map(d => d * s)) : TURNS.flatMap(d => [d, -d])
  for (const deg of tries) {
    const v = rot(deg)
    if (ok(v.x, v.z)) { mem.side = Math.sign(deg); mem.sideT = STEER_HOLD; return v }
  }
  return null
}

// ── the Wilds' structures: settlement buildings + the zone parts the page registers ─────────────────────────────────────
let parts: readonly Box[] = []
/** The page registers the Wilds' solid zone parts (zone-parts.ts zonePartBoxes) whenever they change. */
export function setWildsPartBoxes(boxes: readonly Box[]) { parts = boxes }
export const wildsStructures: Structures = (x0, z0, x1, z1) => {
  const s = settlementSolids(x0, z0, x1, z1)
  const p = parts.filter(b => b.x0 <= x1 && b.x1 >= x0 && b.z0 <= z1 && b.z1 >= z0)
  return p.length ? [...s, ...p] : s
}
