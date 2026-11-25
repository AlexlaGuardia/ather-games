// THE MOONWELL'S WATER, OVER THE GROUND AS IT IS (BETA M157). The pool is one level plane at POOL_Y inside the pond's ellipse; the
// ground (bowl + the owner's sculpting, 4 m triangles) decides what of it shows: ground above POOL_Y hides it by depth, ground under
// it is under water. The ground's 4 m triangles can dip a little past the ellipse where a sunk vertex meets a dry one, so along each
// bearing the sheet's edge runs on over ground still under DRY_Y (EDGE_MAX m at most): no floating lip of water over a dry dip.
// The game (moonwell-quest.tsx) and the builder's Fly draw the same sheet. Pure; glade-layer.test.ts.
import { MOONWELL, shoreRadius } from './moonwell'
import { GLADE, WATER_DROP } from './relief'

type Ground = (x: number, z: number) => number
export const POOL_Y = GLADE.y - WATER_DROP
/** ground at or above this is bank (the level Glade is GLADE.y; 12 cm of slack keeps the shore the ellipse) */
const DRY_Y = GLADE.y - 0.12
const EDGE_MAX = 4, STEP = 0.25
export const POOL_SEGS = 128

/** the sheet's edge on each bearing, world coords */
export function poolEdge(ground: Ground): { x: number; z: number; r: number }[] {
  return Array.from({ length: POOL_SEGS }, (_, k) => {
    const a = (k / POOL_SEGS) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a), r0 = shoreRadius(MOONWELL.x + cx, MOONWELL.z + cz)
    let r = r0
    while (r < r0 + EDGE_MAX && ground(MOONWELL.x + cx * r, MOONWELL.z + cz * r) < DRY_Y) r += STEP
    return { x: MOONWELL.x + cx * r, z: MOONWELL.z + cz * r, r }
  })
}
/** the water sheet: a fan (position + index), world coords, facing up */
export function poolSheet(ground: Ground): { pos: Float32Array; idx: number[] } {
  const e = poolEdge(ground), pos = new Float32Array((e.length + 1) * 3), idx: number[] = []
  pos.set([MOONWELL.x, POOL_Y, MOONWELL.z])
  e.forEach((p, k) => { pos.set([p.x, POOL_Y, p.z], (k + 1) * 3); idx.push(0, 1 + (k + 1) % e.length, 1 + k) })
  return { pos, idx }
}
/** the stone rim: a 1 m band outside the sheet's edge, laid ON the ground (4 cm over it, a few rings so it follows a slope) */
export function poolRim(ground: Ground): { pos: Float32Array; idx: number[] } {
  const e = poolEdge(ground), W = 1.1, R = 4, pos = new Float32Array(e.length * (R + 1) * 3), idx: number[] = []
  e.forEach((p, k) => {
    for (let n = 0; n <= R; n++) {
      const f = (p.r + (n / R) * W) / p.r, x = MOONWELL.x + (p.x - MOONWELL.x) * f, z = MOONWELL.z + (p.z - MOONWELL.z) * f, g = ground(x, z)
      pos.set([x, (Number.isFinite(g) ? g : GLADE.y) + 0.04, z], (k * (R + 1) + n) * 3)
      if (n < R) { const a = k * (R + 1) + n, b = ((k + 1) % e.length) * (R + 1) + n; idx.push(a, b, a + 1, a + 1, b, b + 1) }
    }
  })
  return { pos, idx }
}
/** is the Moonwell's water over this spot (the builder's tile view) */
export const poolOver = (x: number, z: number, g: number) => g < POOL_Y && Math.hypot(x - MOONWELL.x, z - MOONWELL.z) <= shoreRadius(x, z)
