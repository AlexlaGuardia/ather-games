// M58 (2) ATHER-SIDE PATHS AS RIBBONS (2026-11-21, Jin world). The Wilds network paths were drawn per tile as one strip per
// polyline, its width wandering, a one-sided edge tint across it. Three defects, all in how the ground is drawn:
//  (1) where paths meet (every settlement is a junction) two strips lay coplanar and z-fought, and each strip's dark edge
//      tint showed as a stripe across the other path;
//  (2) a tile clipped its piece at the LAST SAMPLE INSIDE, so the path broke for up to one sample step (2 m) at every tile
//      seam: a bare gap across the road;
//  (3) joins took the averaged tangent with no mitre limit, so a sharp turn pinched.
// The fix is play's road-ribbon.ts (mitred joins, round fills, caps) in two passes, widest first: an EDGE ribbon (the path's
// darker rim) under every SURFACE ribbon, so where paths meet one surface paints over the other's rim across the mouth. A
// tile reaches ONE sample past its own square, so neighbours overlap instead of gapping (same layer, same colour, no depth
// write: an overlap is invisible). Triangles are split before draping so the ribbon follows a crowned path, which is why the
// old strip carried three points across (M18).
// ⚖ OPT-IN `?roads=ribbon` (ribbonsOn), the same flag as the Nyx side; default unchanged until Alex looks.
import { ribbonXZ, drape } from '../shared/road-ribbon'
import { pathsIn, PATH_HALF, type Network } from './network'

/** The surface sits this far inside the path's edge (the sculpted width), leaving a darker rim. */
export const PATH_RIM = 0.35
/** Sample step along a path, metres. */
export const PATH_STEP = 2
/** Lift above the ground (12 cm: at 6 the old strip z-fought the ground past ~50 m, M18). */
export const PATH_LIFT = 0.12

/** The path pieces a tile draws, in WORLD coords: its own square grown by one sample step, so a path crossing a seam is
 *  drawn by both neighbours for a step (never by neither). */
export function tilePathLines(net: Network, cx: number, cz: number, hx: number, hz: number): [number, number][][] {
  const m = PATH_STEP + 0.01
  return pathsIn(net, cx - hx - m, cz - hz - m, cx + hx + m, cz + hz + m, PATH_STEP)
}

/** Split every flat xz triangle into four (midpoints), `times` times. */
export function split4(xz: readonly number[], times = 1): number[] {
  let cur = xz as number[]
  for (let n = 0; n < times; n++) {
    const out: number[] = []
    for (let i = 0; i < cur.length; i += 6) {
      const [ax, az, bx, bz, cx, cz] = [cur[i], cur[i + 1], cur[i + 2], cur[i + 3], cur[i + 4], cur[i + 5]]
      const abx = (ax + bx) / 2, abz = (az + bz) / 2, bcx = (bx + cx) / 2, bcz = (bz + cz) / 2, cax = (cx + ax) / 2, caz = (cz + az) / 2
      out.push(ax, az, abx, abz, cax, caz, abx, abz, bx, bz, bcx, bcz, cax, caz, bcx, bcz, cx, cz, abx, abz, bcx, bcz, cax, caz)
    }
    cur = out
  }
  return cur
}

/** Both passes for a set of path lines, flat xz triangles in the coordinates the lines are in. */
export function pathRibbonsXZ(lines: readonly (readonly [number, number][])[]): { edge: number[]; surf: number[] } {
  const edge: number[] = [], surf: number[] = []
  for (const L of lines) {
    for (const v of ribbonXZ(L, PATH_HALF)) edge.push(v)
    for (const v of ribbonXZ(L, PATH_HALF - PATH_RIM)) surf.push(v)
  }
  return { edge, surf }
}

/** A tile's two passes as xyz positions in TILE-LOCAL coords, draped on `heightAt` (tile-local) + PATH_LIFT. */
export function tilePathRibbons(net: Network, off: { x: number; z: number }, hx: number, hz: number, heightAt: (x: number, z: number) => number) {
  const lines = tilePathLines(net, off.x, off.z, hx, hz).map(L => L.map(([x, z]) => [x - off.x, z - off.z] as [number, number]))
  if (!lines.length) return null
  const { edge, surf } = pathRibbonsXZ(lines)
  const y = (x: number, z: number) => heightAt(x, z) + PATH_LIFT
  return { edge: drape(split4(edge), y), surf: drape(split4(surf), y) }
}
