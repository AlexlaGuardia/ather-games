// THE CROSSHAIR'S RAY — a voxel walk from the eye to the first solid cell (2026-09-16).
//
// ★ WHY NOT A MESH RAYCAST: the worktable's blocks are instanced cubes and its pad is a box, and a
// `THREE.Raycaster` against them answers in floating point on a surface — then the page has to guess
// which cell that surface belongs to by stepping half a block along a normal. That is the click math
// the mouse-pointer editor used, and it is the source of "I clicked the top and it went on the side"
// on every edge and corner. A grid walk (Amanatides & Woo) never leaves the grid: it visits cells in
// the order the ray crosses them and reports the cell it stopped in and the FACE it came through, so
// the placed block is `hit + normal` by definition, not by rounding.
//
// Pure — no three, no DOM — so the walk is pinned by `creative-ray.test.ts` on exact cells.

export type Vec3 = { x: number; y: number; z: number }

export type RayHit = {
  /** The solid cell the ray stopped in. */
  cell: Vec3
  /** The face it entered through, as a unit axis step — `cell + normal` is the empty cell in front. Zero when the eye started inside a solid. */
  normal: Vec3
  /** Distance along the ray, in blocks. */
  dist: number
}

/**
 * Walk the grid from `origin` along `dir` (need not be unit) up to `reach` blocks and return the
 * first cell `solid` says yes to, or null. Cells are unit cubes on integer corners, the convention
 * the whole voxel tree fills against.
 */
export function voxelRay(origin: Vec3, dir: Vec3, solid: (x: number, y: number, z: number) => boolean, reach: number): RayHit | null {
  const len = Math.hypot(dir.x, dir.y, dir.z)
  if (!(len > 0)) return null
  const dx = dir.x / len, dy = dir.y / len, dz = dir.z / len
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z)
  // Inside a solid already: that cell is the target and there is no face to build on.
  if (solid(x, y, z)) return { cell: { x, y, z }, normal: { x: 0, y: 0, z: 0 }, dist: 0 }
  const sx = dx > 0 ? 1 : dx < 0 ? -1 : 0
  const sy = dy > 0 ? 1 : dy < 0 ? -1 : 0
  const sz = dz > 0 ? 1 : dz < 0 ? -1 : 0
  // Distance along the ray to the next grid plane on each axis, and the distance between planes.
  const tDeltaX = sx ? Math.abs(1 / dx) : Infinity
  const tDeltaY = sy ? Math.abs(1 / dy) : Infinity
  const tDeltaZ = sz ? Math.abs(1 / dz) : Infinity
  let tMaxX = sx ? ((sx > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX) : Infinity
  let tMaxY = sy ? ((sy > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY) : Infinity
  let tMaxZ = sz ? ((sz > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ) : Infinity
  let t = 0
  // Bounded by reach in distance AND by a step count, so a degenerate direction cannot spin.
  for (let i = 0; i < reach * 3 + 8; i++) {
    let nx = 0, ny = 0, nz = 0
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += sx; t = tMaxX; tMaxX += tDeltaX; nx = -sx }
    else if (tMaxY < tMaxZ)             { y += sy; t = tMaxY; tMaxY += tDeltaY; ny = -sy }
    else                                { z += sz; t = tMaxZ; tMaxZ += tDeltaZ; nz = -sz }
    if (t > reach) return null
    if (solid(x, y, z)) return { cell: { x, y, z }, normal: { x: nx, y: ny, z: nz }, dist: t }
  }
  return null
}
