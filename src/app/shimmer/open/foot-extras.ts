// EXTRA GROUND + SOLIDS FOR THE WALKER (M49 s2, 2026-11-21, world). Things the town plan does not know about (the keeper's
// shipyard yard: its built deck, the ramp at its gate, the fence on its rim, the pieces placed in it) register here, and
// on-foot.ts › footWorld reads them on every ask. A registry, not props: the walker's world is built once per region in the
// Driver, while what stands in a yard changes whenever the keeper sets or lifts a piece.
// ★ PURE (no three, no react). A source registers under a key and must unregister when it leaves the scene.
import { bodyHits, type OBox } from './foot-solids'

export interface FootExtra {
  /** raised ground at (x, z), or -Infinity where this source adds nothing */
  ground?: (x: number, z: number) => number
  /** solid boxes (read on every ask: keep the array current, swap it rather than mutate it mid-tick) */
  boxes?: () => readonly OBox[]
  /** M49 s5: the COURSER's raised ground here (a shipyard's floor + its ramps), -Infinity where none */
  carGround?: (x: number, z: number) => number
  /** M49 s5: walls a courser cannot drive through (read on every tick, same rule as `boxes`) */
  carBoxes?: () => readonly OBox[]
}
const extras = new Map<string, FootExtra>()
export function setFootExtra(key: string, e: FootExtra | null) { if (e) extras.set(key, e); else extras.delete(key) }

export function extraGround(x: number, z: number): number {
  let g = -Infinity
  for (const e of extras.values()) if (e.ground) g = Math.max(g, e.ground(x, z))
  return g
}
export function extraHit(x: number, z: number, feetY: number): boolean {
  for (const e of extras.values()) if (e.boxes) for (const b of e.boxes()) if (bodyHits(b, x, z, feetY)) return true
  return false
}

// ── M49 s5: THE COURSER's extras (a shipyard plot's floor, ramps, walls) ──
export function extraCarGround(x: number, z: number): number {
  let g = -Infinity
  for (const e of extras.values()) if (e.carGround) g = Math.max(g, e.carGround(x, z))
  return g
}
/** a courser as two discs along its length (nose + tail), each CAR_DISC_R across: fits a 3.7 m bay, stops a nose in a wall */
export const CAR_DISC_R = 1.0, CAR_DISC_OFF = 1.2
export interface CarBody { x: number; y: number; z: number; yaw: number; vx: number; vz: number }
/** push a courser out of every extra wall it overlaps and take away its speed INTO the wall (a little bounce); true = hit.
 *  A wall counts when the car's height is inside it (a courser on the terrace floor ignores the retaining wall below it). */
export function carPush(c: CarBody, boxes: readonly OBox[] = allCarBoxes()): boolean {
  let hit = false
  const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw)
  for (const b of boxes) {
    if (c.y + 0.3 <= b.y0 || c.y + 0.2 >= b.y1) continue
    for (const s of [CAR_DISC_OFF, -CAR_DISC_OFF]) {
      const px = c.x + fx * s, pz = c.z + fz * s, dx = px - b.cx, dz = pz - b.cz
      const u = dx * b.ux + dz * b.uz, v = dx * b.vx + dz * b.vz
      const pu = b.hu + CAR_DISC_R - Math.abs(u), pv = b.hv + CAR_DISC_R - Math.abs(v)
      if (pu <= 0 || pv <= 0) continue
      hit = true
      const [nx, nz, d] = pu < pv ? [b.ux * Math.sign(u || 1), b.uz * Math.sign(u || 1), pu] : [b.vx * Math.sign(v || 1), b.vz * Math.sign(v || 1), pv]
      c.x += nx * d; c.z += nz * d
      const vn = c.vx * nx + c.vz * nz
      if (vn < 0) { c.vx -= nx * vn * 1.2; c.vz -= nz * vn * 1.2 }
    }
  }
  return hit
}
function allCarBoxes(): OBox[] {
  const out: OBox[] = []
  for (const e of extras.values()) if (e.carBoxes) out.push(...e.carBoxes())
  return out
}
