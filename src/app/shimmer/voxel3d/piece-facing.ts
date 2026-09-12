// Which way a piece faces when it is placed — from the DIRECTION you look and the PLACEMENT you
// make (Alex, 2026-09-12: "the rotation of the piece being placed is decided by the direction and
// placement.. no?").
//
// ── the two inputs, and which wins ────────────────────────────────────────────────────────────
// Auto-facing (08-08) read the camera yaw alone. That is right on open ground, where the only
// "forward" is the way you look. Against a WALL it is not: the piece goes in the cell before the
// face you hit, and the face has a normal — a stair set against a wall should rise INTO the wall,
// a door should hang IN the wall's plane, whatever angle you were looking at it from. So a
// vertical hit face decides, and the yaw decides only when the face is horizontal (floor, ceiling)
// or there is no hit at all. `rot` — the R key — stays a manual quarter-turn on top of either.
//
// ★ ONE FORMULA FOR BOTH. "Forward" is a horizontal vector; the rotation is the same quantisation
// the 08-08 code used for the yaw. The stair is the anchor: authored rising toward −Z at rot 0,
// instanced at −rot·π/2 about Y, so rot 1 rises toward +X — and "rises AWAY from the player"
// works out to rot = 2 − round(atan2(fx, fz) / 90°), mod 4.
//
// ⚠ PURE. The frame hands in this frame's aim and hit; nothing here reads the scene.
import type { Rotation } from '../voxel/pieces'

export interface FacingHit {
  /** The cell the reticle hit. */
  x: number; y: number; z: number
  /** The empty cell before it — where the piece goes. */
  px: number; py: number; pz: number
}

/** The horizontal forward vector a placement should face along, before the manual turn. */
export function placementForward(aim: { x: number; z: number }, hit: FacingHit | null): { x: number; z: number } {
  if (hit) {
    // The face normal points from the hit cell to the placement cell. A vertical face has a
    // horizontal normal; the piece faces INTO the wall, i.e. against the normal.
    const nx = hit.x - hit.px, nz = hit.z - hit.pz
    if (nx !== 0 || nz !== 0) return { x: nx, z: nz }
  }
  return { x: aim.x, z: aim.z }
}

/** Quantise a forward vector to a quarter-turn — the 08-08 mapping, unchanged. */
export const rotationFor = (f: { x: number; z: number }): Rotation =>
  ((2 - Math.round(Math.atan2(f.x, f.z) / (Math.PI / 2)) + 8) % 4) as Rotation

/** The rotation a placement gets: placement/direction, then the manual quarter-turn on top. */
export const placementRotation = (aim: { x: number; z: number }, hit: FacingHit | null, manual: Rotation): Rotation =>
  (((rotationFor(placementForward(aim, hit)) + manual) % 4) as Rotation)
