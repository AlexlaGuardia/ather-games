// ON FOOT on the continent (Alex 11-14: "id like the player to be able to get out of the car and walk around as they
// want… seemless like warzone… keep the fps feel once we exit the courser"). The walker is voxel3d/locomotion.ts,
// untouched, the same body /shimmer/open tuned; the world it asks is the REGION, through open/terrain-world.ts.
//
// ★ PURE (no three, no react) so the test drives the same functions the page does.
//
// The one subtlety: the region has LAYERS (a bridge deck over a river, a bore's floor under a mountain), and
// terrain-world's Shape has a single ground(x, z). So the shape reads the ground at the walker's own height, the same
// trick the courser uses: the host sets `hint.y` to the feet before each tick. Under the Passage's hill that is the
// floor; on the hill above it, the hill.

import { terrainWorld, type Box } from './terrain-world'
import { createLoco, tickLocomotion, type LocoState, type LocoInput, type LocoWorld } from '../voxel3d/locomotion'
import { tunnelWall, type Region } from './region'

/** Water plane the page draws (Water: y = -0.15). Land under it is a river or the sea: the walker swims. */
export const WATER_Y = -0.15
/** Reach to get back in: horizontal metres from the courser's centre, and the height window. */
export const ENTER_REACH = 3.4, ENTER_DY = 2.2
/** Fastest the courser may be rolling when you step out (m/s). Warzone lets you bail at speed; a Darter at 30 mph
 *  throwing its driver onto the road is a later, deliberate verb (with a stumble), not a free exit. */
export const EXIT_MAX_SPEED = 9

export interface FootWorld { world: LocoWorld; hint: { y: number } }

export function footWorld(R: Region): FootWorld {
  const hint = { y: 0 }
  const world = terrainWorld({
    ground: (x, z) => R.groundAt(x, z, hint.y + 0.6),
    solids: () => [],
    water: (x0, _y0, z0, x1, _y1, z1): readonly Box[] => {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
      return R.heightAt(cx, cz) < WATER_Y ? [{ x0: x0 - 1, y0: -80, z0: z0 - 1, x1: x1 + 1, y1: WATER_Y, z1: z1 + 1 }] : []
    },
  })
  return { world, hint }
}

/** One walker tick on the region: ground hint from the feet, then the bore's walls, then the map's edge. */
export function tickFoot(fw: FootWorld, R: Region, s: LocoState, input: LocoInput) {
  fw.hint.y = s.py
  tickLocomotion(s, input, fw.world)
  const b = { x: s.px, y: s.py, z: s.pz, vx: s.hvx, vz: s.hvz }
  if (tunnelWall(R, b)) { s.px = b.x; s.pz = b.z; s.hvx = b.vx; s.hvz = b.vz }
  const lx = R.meta.sizeX / 2 - 3, lz = R.meta.sizeZ / 2 - 3
  if (Math.abs(s.px) > lx) { s.px = Math.sign(s.px) * lx; s.hvx = 0 }
  if (Math.abs(s.pz) > lz) { s.pz = Math.sign(s.pz) * lz; s.hvz = 0 }
}

/** Where the driver steps out: the DRIVER'S side first (right-hand traffic: the driver sits on the left), then the
 *  passenger side, then behind, then ahead. A spot is good when the body fits there and the ground is within a step
 *  or two of the car's (never off a parapet into the river, never inside a bore's wall). Null = nowhere to stand. */
export function exitSpot(fw: FootWorld, R: Region, car: { x: number; y: number; z: number; yaw: number }): { x: number; y: number; z: number } | null {
  const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw)
  const tries: [number, number][] = [[-1.8, 0.3], [1.8, 0.3], [-2.6, -0.8], [2.6, -0.8], [0, -3.4], [0, 3.4]]
  fw.hint.y = car.y
  for (const [side, along] of tries) {
    const x = car.x + rx * side + fx * along, z = car.z + rz * side + fz * along
    const y = R.groundAt(x, z, car.y + 0.6)
    if (!Number.isFinite(y) || Math.abs(y - car.y) > 1.3 || y < WATER_Y + 0.2) continue
    const t = R.tunnelAt(x, z)
    if (t && t.cover > 2 && Math.abs(t.off) > t.tunnel.width / 2 + 0.6) continue      // the walkway, not the wall
    fw.hint.y = y
    // the body's footprint corners stand on a cambered road a few cm higher than its centre: test (and stand) the
    // feet a hand above the centre's ground, and the walker settles onto the real floor on its first tick
    if (!fw.world.bodyFree(x, z, y + 0.15)) continue
    return { x, y: y + 0.05, z }
  }
  return null
}

export function canEnter(s: LocoState, car: { x: number; y: number; z: number }) {
  return Math.hypot(s.px - car.x, s.pz - car.z) <= ENTER_REACH && Math.abs(s.py - car.y) <= ENTER_DY
}

/** A walker standing at the spot, carrying a share of the courser's motion (a step out of a rolling car, not a dive). */
export function stepOut(spot: { x: number; y: number; z: number }, car: { vx: number; vz: number }): LocoState {
  const s = createLoco(spot.x, spot.y, spot.z)
  const sp = Math.hypot(car.vx, car.vz), k = sp > 0 ? Math.min(1, 3.5 / sp) * 0.5 : 0
  s.hvx = car.vx * k; s.hvz = car.vz * k
  return s
}
