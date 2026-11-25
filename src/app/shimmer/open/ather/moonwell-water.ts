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
/** the sheet's rings, as shares of the edge (more toward the shore: moonwell-rim.ts colours them) */
export const SHEET_RINGS = [0.35, 0.7, 0.9, 0.965, 1] as const
/** the water sheet: rings out from the middle (position + index), world coords, facing up */
export function poolSheet(ground: Ground): { pos: Float32Array; idx: number[] } {
  const e = poolEdge(ground), n = e.length, pos: number[] = [MOONWELL.x, POOL_Y, MOONWELL.z], idx: number[] = []
  SHEET_RINGS.forEach((f, r) => e.forEach((p, k) => {
    pos.push(MOONWELL.x + (p.x - MOONWELL.x) * f, POOL_Y, MOONWELL.z + (p.z - MOONWELL.z) * f)
    const a = 1 + r * n + k, b = 1 + r * n + (k + 1) % n
    if (!r) idx.push(0, b, a); else idx.push(a - n, b - n, a, a, b - n, b)
  }))
  return { pos: new Float32Array(pos), idx }
}
/** is the Moonwell's water over this spot (the builder's tile view) */
export const poolOver = (x: number, z: number, g: number) => g < POOL_Y && Math.hypot(x - MOONWELL.x, z - MOONWELL.z) <= shoreRadius(x, z)
