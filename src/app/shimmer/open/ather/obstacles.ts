// BETA M117: entities stop passing through things. ONE obstacle query, shared: slice 3 wires the Hollows to it (they
// steer round structures, their shots stop on a wall); s1 (spirits / NPCs) and s2 (Greg's tour) reuse the same calls.
// PURE: no three, no react. Tested in obstacles.test.ts.
//
// A STRUCTURE is a solid box something can't step over: a settlement building's walls, a placed solid piece (a zone part).
// What counts is whatever the `Structures` query returns; the Wilds' query is `wildsStructures` below (settlementSolids +
// the zone parts the page registers). Trunks and rocks are not here: Terrain.walkable already keeps a Hollow off them.
import type { Box } from '../terrain-world'
import { settlementSolids } from './settlement-lots'
import { FURNITURE } from './furniture'

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

// ── M117 s1: the PLOT's footprints (planters, training pieces, decor) for a spirit's body ──────────────────────────────────
// A garden spirit is not a keeper: she cannot step onto a bench or under an arch, and a bloomed spirit has left her planter
// behind, so every placed piece is in her way (bar a floor slab / a lift, which are ground). Each piece gives its whole turned
// RECT (what she keeps her whole body clear of on a roam: distance >= her body radius) and its PARTS (the bits that really
// stand there: a hurdle's two end posts, the guard posts' two posts, the running ring's 16 posts; any other piece = its rect).
// The piece she is heading to / playing at keeps only its parts, unpadded: she bounds over the hurdle's rail, stands in the
// guard gap, runs inside the ring, but her body centre never stands in a post. Pure: tested in obstacles.test.ts.
/** an xz rectangle */
export type Foot = { x0: number; x1: number; z0: number; z1: number }
export type PieceFoot = { id: string; rect: Foot; parts: Foot[]; train: boolean }
type PlotPiece = { id: string; item: string; x: number; z: number; q?: number }

/** a body's footprint radius from its size (metres): half its nose-to-tail length, or (no length) half its height x 1.2 */
export function bodyRadius(size: { height: number; length?: number }): number {
  return Math.max(0.15, size.length !== undefined ? size.length / 2 : size.height * 0.6)
}
/** pieces that are ground, not things: she walks on them */
const isGround = (item: string) => item.includes('_slab') || item === 'lift'
/** a w x d rect at local (lx, lz) of a piece at (x, z) turned q quarter-turns, as its xz bounds */
function turned(x: number, z: number, q: number, lx: number, lz: number, w: number, d: number): Foot {
  const a = -q * Math.PI / 2, c = Math.cos(a), s = Math.sin(a)
  const cx = x + lx * c + lz * s, cz = z - lx * s + lz * c   // local x = (cos a, -sin a), local z = (sin a, cos a)
  const hx = (w / 2) * Math.abs(c) + (d / 2) * Math.abs(s), hz = (w / 2) * Math.abs(s) + (d / 2) * Math.abs(c)
  return { x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz }
}
/** every placed piece's footprint (rect + parts) */
export function plotFootprints(pieces: readonly PlotPiece[]): PieceFoot[] {
  const out: PieceFoot[] = []
  for (const p of pieces) {
    const f = FURNITURE[p.item]; if (!f || isGround(p.item)) continue
    const q = p.q ?? 0, rect = turned(p.x, p.z, q, 0, 0, f.w, f.d), kind = f.train ? (f.play ?? 'leap') : null
    const parts = kind === 'leap' ? [-1, 1].map(k => turned(p.x, p.z, q, k * (f.w / 2 - 0.05), 0, 0.1, f.d))
      : kind === 'guard' ? [-1, 1].map(k => turned(p.x, p.z, q, k * (f.w / 2 - 0.1), 0, 0.22, f.d))
      : kind === 'laps' ? Array.from({ length: 16 }, (_, k) => { const a = k / 16 * Math.PI * 2, r = f.w / 2 - 0.05; return turned(p.x, p.z, q, Math.cos(a) * r, Math.sin(a) * r, 0.07, 0.07) })
      : [rect]
    out.push({ id: p.id, rect, parts, train: !!f.train })
  }
  return out
}
/** distance in xz from (x, z) to a rect (0 inside) */
export const footDist = (b: Foot, x: number, z: number) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1))
const inside = (b: Foot, x: number, z: number) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1
/** may a body of radius r NOT stand at (x, z)? Clear of every rect by r; `toyId` (the piece she is heading to / playing at):
 *  only its parts count, and only the body centre */
export function footBlocked(feet: readonly PieceFoot[], x: number, z: number, r: number, toyId?: string): boolean {
  for (const f of feet) {
    if (f.id === toyId) { if (f.parts.some(b => inside(b, x, z))) return true; continue }
    if (footDist(f.rect, x, z) < r) return true
  }
  return false
}
/** the check's invariant: is a body CENTRE inside a piece? A training piece counts its parts (she plays in its rect), any
 *  other piece its whole rect. Returns the piece id, or null. */
export function centreIn(feet: readonly PieceFoot[], x: number, z: number): string | null {
  for (const f of feet) if ((f.train ? f.parts : [f.rect]).some(b => inside(b, x, z))) return f.id
  return null
}
/** clearance of a body centre from the nearest piece by the same rule as centreIn (negative = never: 0 inside) */
export function centreClear(feet: readonly PieceFoot[], x: number, z: number): number {
  let m = Infinity
  for (const f of feet) for (const b of f.train ? f.parts : [f.rect]) m = Math.min(m, footDist(b, x, z))
  return m
}
