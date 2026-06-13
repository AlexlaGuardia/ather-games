// A* pathfinding on a 2D tile grid
// Manhattan heuristic with cross-product tie-breaking for straighter paths
// Post-processed with LOS string-pulling to eliminate zigzag staircasing
// Returns tile positions from start to end (exclusive of start)

import { SOLID } from '../world/tiles'

interface Node {
  x: number
  y: number
  g: number       // cost from start
  f: number       // g + heuristic
  parent: Node | null
}

const CARDINAL: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]]
const DIAGONAL: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
const DIRS: [number, number][] = [...CARDINAL, ...DIAGONAL]
const DIAG_COST = 1.414
const MAX_NODES = 2000

function walkable(grid: number[][], tx: number, ty: number, blockedTiles?: Set<string>): boolean {
  if (ty < 0 || ty >= grid.length) return false
  if (tx < 0 || tx >= (grid[0]?.length ?? 0)) return false
  if (SOLID[grid[ty][tx] & 0xFF]) return false
  if (blockedTiles?.has(`${tx},${ty}`)) return false
  return true
}

/**
 * Bresenham line-of-sight check between two tiles.
 * Returns true if every tile along the line is walkable.
 */
function hasLineOfSight(
  grid: number[][],
  ax: number, ay: number,
  bx: number, by: number,
  blockedTiles?: Set<string>,
): boolean {
  let x = ax, y = ay
  const dx = Math.abs(bx - ax), dy = Math.abs(by - ay)
  const sx = ax < bx ? 1 : -1
  const sy = ay < by ? 1 : -1
  let err = dx - dy

  while (!(x === bx && y === by)) {
    if (!walkable(grid, x, y, blockedTiles)) return false
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx) { err += dx; y += sy }
  }
  return walkable(grid, bx, by, blockedTiles)
}

/**
 * Generate 8-directional steps between two tiles.
 * Moves diagonally when both axes need adjustment, cardinal when only one does.
 * Each step is exactly 1 tile in one of 8 directions (grid-safe).
 */
function directSteps(
  ax: number, ay: number,
  bx: number, by: number,
): { x: number; y: number }[] {
  const steps: { x: number; y: number }[] = []
  let x = ax, y = ay

  while (x !== bx || y !== by) {
    const dx = Math.sign(bx - x)
    const dy = Math.sign(by - y)
    x += dx
    y += dy
    steps.push({ x, y })
  }

  return steps
}

/**
 * Smooth a raw A* path using LOS checkpoints + interleaved stepping.
 *
 * 1. Find LOS checkpoints: key turning points where line-of-sight breaks.
 *    This collapses long straight stretches into direct segments.
 * 2. Between each pair of checkpoints, generate Bresenham-style interleaved
 *    cardinal steps (RDRDRDR instead of RRRRDDD) for natural diagonal feel.
 * 3. Validate every interleaved step is walkable — if any hits a wall,
 *    fall back to the raw A* steps for that segment.
 *
 * Result: every step is exactly 1 tile in a cardinal direction (grid-safe),
 * but the overall path follows natural diagonals through open space.
 */
export function smoothPath(
  grid: number[][],
  path: { x: number; y: number }[],
  startX: number, startY: number,
  blockedTiles?: Set<string>,
): { x: number; y: number }[] {
  if (path.length <= 1) return path

  // Step 1: Find LOS checkpoints
  const full = [{ x: startX, y: startY }, ...path]
  const checkpoints: number[] = [0]  // indices into full[]
  let ci = 0

  while (ci < full.length - 1) {
    let j = full.length - 1
    while (j > ci + 1) {
      if (hasLineOfSight(grid, full[ci].x, full[ci].y, full[j].x, full[j].y, blockedTiles)) break
      j--
    }
    checkpoints.push(j)
    ci = j
  }

  // Step 2: Between each checkpoint pair, generate direct 8-dir steps
  const result: { x: number; y: number }[] = []

  for (let c = 0; c < checkpoints.length - 1; c++) {
    const from = full[checkpoints[c]]
    const to = full[checkpoints[c + 1]]
    const direct = directSteps(from.x, from.y, to.x, to.y)

    // Validate all direct steps are walkable
    let valid = true
    for (const step of direct) {
      if (!walkable(grid, step.x, step.y, blockedTiles)) { valid = false; break }
    }

    if (valid) {
      result.push(...direct)
    } else {
      // Fall back to raw A* steps for this segment
      const rawStart = checkpoints[c] + 1
      const rawEnd = checkpoints[c + 1]
      for (let r = rawStart; r <= rawEnd; r++) {
        result.push(full[r])
      }
    }
  }

  return result
}

/**
 * Find a path from (sx,sy) to (ex,ey) on the tile grid.
 * Returns array of {x,y} tile positions (excludes start, includes end),
 * or null if no path exists.
 */
export function findPath(
  grid: number[][],
  sx: number, sy: number,
  ex: number, ey: number,
  blockedTiles?: Set<string>,
): { x: number; y: number }[] | null {
  // Same tile
  if (sx === ex && sy === ey) return []

  // Target not walkable
  if (!walkable(grid, ex, ey, blockedTiles)) return null

  const cols = grid[0]?.length ?? 0
  if (cols === 0) return null
  const key = (x: number, y: number) => y * cols + x

  const open: Node[] = [{ x: sx, y: sy, g: 0, f: Math.abs(ex - sx) + Math.abs(ey - sy), parent: null }]
  const closed = new Set<number>()
  let explored = 0

  while (open.length > 0 && explored < MAX_NODES) {
    // Find lowest f in open list (small grid — linear scan is fine)
    let bestIdx = 0
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i
    }
    const current = open[bestIdx]
    open.splice(bestIdx, 1)

    const k = key(current.x, current.y)
    if (closed.has(k)) continue
    closed.add(k)
    explored++

    // Reached goal — reconstruct path
    if (current.x === ex && current.y === ey) {
      const path: { x: number; y: number }[] = []
      let node: Node | null = current
      while (node && !(node.x === sx && node.y === sy)) {
        path.push({ x: node.x, y: node.y })
        node = node.parent
      }
      path.reverse()
      return path
    }

    // Expand neighbors (cardinal + diagonal)
    for (const [dx, dy] of DIRS) {
      const nx = current.x + dx
      const ny = current.y + dy
      if (closed.has(key(nx, ny))) continue
      if (!walkable(grid, nx, ny, blockedTiles)) continue
      // Diagonal corner-cutting prevention: at least one adjacent cardinal must be open
      const diag = dx !== 0 && dy !== 0
      if (diag && !walkable(grid, current.x + dx, current.y, blockedTiles) && !walkable(grid, current.x, current.y + dy, blockedTiles)) continue

      const g = current.g + (diag ? DIAG_COST : 1)
      // Chebyshev heuristic (consistent with 8-dir movement)
      const h = Math.max(Math.abs(ex - nx), Math.abs(ey - ny))
      const dx1 = nx - ex, dy1 = ny - ey
      const dx2 = sx - ex, dy2 = sy - ey
      const cross = Math.abs(dx1 * dy2 - dx2 * dy1)
      open.push({ x: nx, y: ny, g, f: g + h + cross * 0.001, parent: current })
    }
  }

  return null // unreachable
}

/**
 * Find the nearest walkable tile adjacent to (tx,ty).
 * Used for click-on-spirit: path to a tile next to the spirit.
 * Returns the adjacent tile closest to the player, or null if all blocked.
 */
export function nearestAdjacent(
  grid: number[][],
  tx: number, ty: number,
  playerX: number, playerY: number,
  blockedTiles?: Set<string>,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null
  let bestDist = Infinity

  for (const [dx, dy] of DIRS) {
    const nx = tx + dx
    const ny = ty + dy
    if (!walkable(grid, nx, ny, blockedTiles)) continue
    const dist = Math.abs(nx - playerX) + Math.abs(ny - playerY)
    if (dist < bestDist) {
      bestDist = dist
      best = { x: nx, y: ny }
    }
  }

  return best
}

/**
 * Find the nearest walkable tile within `range` Chebyshev distance of (tx,ty).
 * Player stops when within range tiles of the target (e.g. 3 for harvesting).
 * Returns the walkable tile closest to the player that's within range of the target.
 */
export function nearestInRange(
  grid: number[][],
  tx: number, ty: number,
  playerX: number, playerY: number,
  range: number,
  blockedTiles?: Set<string>,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null
  let bestDist = Infinity

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const nx = tx + dx
      const ny = ty + dy
      if (Math.max(Math.abs(dx), Math.abs(dy)) > range) continue
      if (!walkable(grid, nx, ny, blockedTiles)) continue
      const dist = Math.abs(nx - playerX) + Math.abs(ny - playerY)
      if (dist < bestDist) {
        bestDist = dist
        best = { x: nx, y: ny }
      }
    }
  }

  return best
}
