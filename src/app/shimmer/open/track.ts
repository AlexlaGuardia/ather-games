// The Darter's TEST TRACK (OPEN_WORLD_PLAN.md › P5). Not a place in the world: a proving ground to judge
// the courser's handling before the km-scale map exists. No canon here.
//
// An oval road (a 150×90 m ellipse, 14 m wide) with three things on it, plus an infield:
//   · the JUMP on the north straight: a wedge rising 2.6 m over 16 m along +x, then a sheer lip
//   · the WHOOPS on the south straight: a run of rolling bumps that unsettle the car
//   · a long HILL east, past the oval, to feel the engine fight a slope and the car crest it
//   · the infield: a slalom line of cones and an open skidpad for drifting circles
// Spawn: the west end of the oval, nose north (yaw 0), so the first straight runs into the jump.
//
// ★ As with land.ts, what you see is what you drive on: the page meshes the jump and the whoops from these
// very functions at fine spacing, and the open ground (smooth) on a coarser grid.

export const TRACK_SIZE = 520
export const HALF = TRACK_SIZE / 2
export const OVAL_A = 150, OVAL_B = 90, ROAD_W = 14
export const SPAWN = { x: -OVAL_A, z: 20, yaw: 0 }

const smooth = (t: number) => t * t * (3 - 2 * t)
const s01 = (e0: number, e1: number, v: number) => smooth(Math.min(1, Math.max(0, (v - e0) / (e1 - e0))))

/** The open ground: flat, with one long hill to the east beyond the oval. Smooth everywhere. */
export function baseHeight(x: number, z: number): number {
  const d = Math.hypot(x - 225, z)
  return 13 * (1 - s01(0, 70, d))
}

// ── the jump: a wedge on the north straight, centred on x = 0, rising along +x ──
export const JUMP = { x0: -14, x1: 2, z0: -OVAL_B - 6, z1: -OVAL_B + 6, h: 2.6 }
export function jumpHeight(x: number, z: number): number {
  const j = JUMP
  if (z < j.z0 || z > j.z1 || x < j.x0 || x > j.x1) return 0
  return j.h * (x - j.x0) / (j.x1 - j.x0)
}

// ── the whoops: bumps across the south straight ──
export const WHOOPS = { x0: -36, x1: 36, z0: OVAL_B - 7, z1: OVAL_B + 7, amp: 0.45, wave: 7 }
export function whoopsHeight(x: number, z: number): number {
  const w = WHOOPS
  if (z < w.z0 || z > w.z1 || x < w.x0 || x > w.x1) return 0
  const edge = s01(w.x0, w.x0 + 6, x) * (1 - s01(w.x1 - 6, w.x1, x))
  return w.amp * (1 - Math.cos(((x - w.x0) / w.wave) * Math.PI * 2)) * edge
}

/** What a courser drives on. Off the slab: no ground (the page fences the edge). */
export function trackHeight(x: number, z: number): number {
  if (Math.abs(x) > HALF || Math.abs(z) > HALF) return -Infinity
  return baseHeight(x, z) + jumpHeight(x, z) + whoopsHeight(x, z)
}

/** Signed distance (approx, metres) from the oval's centre line: 0 on the line, ±ROAD_W/2 at the kerbs. */
export function ovalOffset(x: number, z: number): number {
  const r = Math.hypot(x / OVAL_A, z / OVAL_B)
  if (r === 0) return -OVAL_B
  // scale back to metres along the local radius
  const ex = x / r, ez = z / r
  return (r - 1) * Math.hypot(ex, ez)
}

export interface Cone { x: number; z: number }
export function cones(): Cone[] {
  const out: Cone[] = []
  // slalom down the infield's long axis, every 12 m
  for (let k = -5; k <= 5; k++) out.push({ x: k * 12, z: -6 + (k % 2 === 0 ? 0 : 0) })
  // skidpad: a ring of 12 cones, radius 14, west infield
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    out.push({ x: -95 + Math.cos(a) * 14, z: 20 + Math.sin(a) * 14 })
  }
  // gate the jump's run-up so it reads as "aim here"
  out.push({ x: JUMP.x0 - 12, z: JUMP.z0 - 1 }, { x: JUMP.x0 - 12, z: JUMP.z1 + 1 })
  return out
}
