// The open world's answer to the walker's six questions (see `LocoWorld` in voxel3d/locomotion.ts).
//
// ★ PURE. No three, no react, no DOM — the same file runs in the page and in `breach-server`, so the
// server can step the same body the client does. The world is a SHAPE: a heightfield (the land) plus
// axis-aligned boxes (rocks, ledges, walls, pieces you build) plus water boxes. Every query below is
// written against that shape and nothing else, so a test can hand it a synthetic one.
//
// ── Why these algorithms are shaped like the voxel ones (2026-11-13, the pivot) ───────────────
// The feel is the ruled thing, and 202 asserts pin it against a block grid. `gridShape` (below)
// presents any voxel probe AS a shape, so the whole oracle runs against THESE queries — a parity
// failure is a place where terrain would move differently from the walker Alex tuned. Every bound
// here (step 0.5, vault reach, mantle reach, the 2-high face) is the voxel rule restated for a
// world without cells, never a new number.

import {
  BODY_R, BODY_H, VAULT_REACH, MANTLE_REACH,
  type LocoWorld, type CellProbe, CELL_SOLID, CELL_WATER, CELL_HALF,
} from './shared/locomotion'

/** Half-open in every axis: a point is inside when x0 <= x < x1 (the voxel cell's own rule). */
export interface Box { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }

export interface Shape {
  /** Height of the land at (x, z); -Infinity where there is none. */
  ground(x: number, z: number): number
  /** Solid boxes that may touch the region. Extra boxes are fine; missing ones are a hole. */
  solids(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): readonly Box[]
  /** Water boxes that may touch the region. */
  water(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): readonly Box[]
}

const EPS = 0.01
const STEP_MAX = 0.5          // the walker's own step rule (`stepped`: rise ≤ 0.5)
const LIP_MIN = STEP_MAX + 0.05  // a walkable step never grabs — the voxel lip's "REAL rise"
const FLOOR_LOOK_DOWN = 1.4   // floorProbe scans this far below the feet
const FACE_SAMPLES = [BODY_R + 0.05, BODY_R + 0.35, BODY_R + 0.7]  // how far past the body a face counts as "beside"
const FACE_LO = 0.5, FACE_HI = 1.3  // waist and head: both solid = a face too tall to vault (climb country)
/** Land steeper than this is not a floor you walk UP — it blocks like a wall (and climbs, if tall).
 *  The voxel grid never needed it: a cell is flat or it is a face. ~46°. */
export const MAX_WALK_GRADIENT = 1.035
const SLOPE_H = 0.25

const inside = (b: Box, x: number, y: number, z: number) =>
  b.x0 <= x && x < b.x1 && b.y0 <= y && y < b.y1 && b.z0 <= z && z < b.z1
/** Box overlaps the closed footprint [x-R, x+R] × [z-R, z+R] — what a body's corners cover. */
const underFoot = (b: Box, x: number, z: number) =>
  b.x0 <= x + BODY_R && b.x1 > x - BODY_R && b.z0 <= z + BODY_R && b.z1 > z - BODY_R

/** The body's footprint samples: four corners (the voxel walker's) plus the centre, so a hump
 *  between the corners is still felt on real land. */
function footprint(x: number, z: number): [number, number][] {
  return [[x - BODY_R, z - BODY_R], [x + BODY_R, z - BODY_R], [x - BODY_R, z + BODY_R], [x + BODY_R, z + BODY_R], [x, z]]
}

export function terrainWorld(shape: Shape): LocoWorld {
  const solidAt = (x: number, y: number, z: number): boolean => {
    if (y < shape.ground(x, z)) return true
    for (const b of shape.solids(x, y, z, x, y, z)) if (inside(b, x, y, z)) return true
    return false
  }

  /** Land at this point is gentle enough to walk up onto. */
  const walkable = (x: number, z: number): boolean => {
    const gx = (shape.ground(x + SLOPE_H, z) - shape.ground(x - SLOPE_H, z)) / (2 * SLOPE_H)
    const gz = (shape.ground(x, z + SLOPE_H) - shape.ground(x, z - SLOPE_H)) / (2 * SLOPE_H)
    return Math.hypot(gx, gz) <= MAX_WALK_GRADIENT
  }

  /** Highest surface at the point (land or a box top) in [lo, hi], or null. */
  const surfaceAt = (x: number, z: number, lo: number, hi: number): number | null => {
    let best: number | null = null
    const g = shape.ground(x, z)
    if (g >= lo && g <= hi) best = g
    for (const b of shape.solids(x, lo - 1, z, x, hi, z)) {
      if (b.x0 <= x && x < b.x1 && b.z0 <= z && z < b.z1 && b.y1 >= lo && b.y1 <= hi && (best === null || b.y1 > best)) best = b.y1
    }
    return best
  }

  const bodyFree = (x: number, z: number, feetY: number): boolean => {
    for (const [fx, fz] of footprint(x, z)) if (shape.ground(fx, fz) > feetY + EPS) return false
    const top = feetY + BODY_H - EPS, bot = feetY + EPS
    for (const b of shape.solids(x - BODY_R, feetY, z - BODY_R, x + BODY_R, feetY + BODY_H, z + BODY_R)) {
      if (underFoot(b, x, z) && b.y0 <= top && b.y1 > bot) return false
    }
    return true
  }

  const floorAt = (x: number, z: number, feetY: number, capture: number): number | null => {
    const hi = feetY + capture, lo = feetY - FLOOR_LOOK_DOWN
    let best: number | null = null
    for (const [fx, fz] of footprint(x, z)) {
      const g = shape.ground(fx, fz)
      // Land ABOVE the feet is only a floor if it is a slope you could walk up; a steep rise is a wall.
      if (g > feetY + EPS && !walkable(fx, fz)) continue
      if (g >= lo && g <= hi && (best === null || g > best)) best = g
    }
    for (const b of shape.solids(x - BODY_R, lo - 1, z - BODY_R, x + BODY_R, hi, z + BODY_R)) {
      if (underFoot(b, x, z) && b.y1 >= lo && b.y1 <= hi && (best === null || b.y1 > best)) best = b.y1
    }
    return best
  }

  const waterAt = (x: number, y: number, z: number): boolean => {
    for (const b of shape.water(x, y, z, x, y, z)) if (inside(b, x, y, z)) return true
    return false
  }

  /** Clear headroom for a standing body at this point and height (the two cells above a lip). */
  const clearAbove = (x: number, y: number, z: number) =>
    !solidAt(x, y + 0.05, z) && !solidAt(x, y + 1.05, z) && !solidAt(x, y + 1.95, z)

  return {
    bodyFree,
    floorAt,
    waterAt,

    tallFace(px, pz, feetY, dx, dz) {
      for (const d of FACE_SAMPLES) {
        const x = px + dx * d, z = pz + dz * d
        if (solidAt(x, feetY + FACE_LO, z) && solidAt(x, feetY + FACE_HI, z)) return true
      }
      return false
    },

    vaultTarget(px, pz, feetY, dx, dz) {
      if (dx === 0 && dz === 0) return null
      const qx = px + dx * (BODY_R + VAULT_REACH), qz = pz + dz * (BODY_R + VAULT_REACH)
      if (!solidAt(qx, feetY + EPS, qz)) return null                  // nothing to step onto
      const top = surfaceAt(qx, qz, feetY + EPS, feetY + 1 + EPS)
      if (top === null || !clearAbove(qx, top, qz)) return null       // taller than one step: climb country
      const to = { x: px + dx * 0.85, y: top, z: pz + dz * 0.85 }
      return bodyFree(to.x, to.z, to.y) ? to : null
    },

    lipAt(px, pz, feetY, dx, dz) {
      for (const d of FACE_SAMPLES) {
        const x = px + dx * d, z = pz + dz * d
        const top = surfaceAt(x, z, feetY + LIP_MIN, feetY + MANTLE_REACH)
        if (top === null || !clearAbove(x, top, z)) continue
        // Hands go a little past the edge, onto the top — where the voxel walker put them at the
        // cell's centre. The mantle lands the body here, so it must be standable.
        return { x: x + dx * 0.25, y: top, z: z + dz * 0.25 }
      }
      return null
    },
  }
}

// ── A voxel probe presented as a shape ─────────────────────────────────────────────────────────
// For the parity oracle: the cells near each query become unit boxes (half cells, half boxes), and
// there is no land. Built per query, never cached — the oracle's probes are closures that change.
export function gridShape(probe: CellProbe): Shape {
  const cells = (want: (v: boolean | number) => boolean, toBox: (x: number, y: number, z: number, v: boolean | number) => Box) =>
    (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Box[] => {
      const out: Box[] = []
      for (let x = Math.floor(x0); x <= Math.floor(x1); x++)
        for (let z = Math.floor(z0); z <= Math.floor(z1); z++)
          for (let y = Math.floor(y0); y <= Math.floor(y1); y++) {
            const v = probe(x, y, z)
            if (want(v)) out.push(toBox(x, y, z, v))
          }
      return out
    }
  const unit = (x: number, y: number, z: number, v: boolean | number): Box =>
    ({ x0: x, y0: y, z0: z, x1: x + 1, y1: y + (v === CELL_HALF ? 0.5 : 1), z1: z + 1 })
  return {
    ground: () => -Infinity,
    solids: cells(v => v === true || v === CELL_SOLID || v === CELL_HALF, unit),
    water: cells(v => v === CELL_WATER, unit),
  }
}
