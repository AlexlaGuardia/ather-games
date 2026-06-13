// Spirit AI — behavior tree + velocity-driven animation state machine
// Runs every logic tick (15 TPS)
// Companion uses A* pathfinding for follow behavior

import { Spirit, Direction } from './spirit'
import { SOLID } from '../world/tiles'
import { TILE } from '../engine/renderer'
import { findPath, smoothPath, nearestAdjacent } from '../engine/pathfinder'
import { MovementPhase, isPlayOncePhase } from '../engine/player'

/** Animation state for followers — driven by velocity + behavior */
export type FollowerAnimState = 'idle' | 'walk' | 'run' | 'pet' | 'happy' | 'eat' | 'sleep'

/** Per-species movement capabilities */
export interface FollowerMovementStyle {
  walkSpeed: number       // base pixels per tick
  catchupSpeed: number    // speed when far behind player
  catchupDistance: number  // tile distance before catchup kicks in
  // Phase thresholds (mirrors player's MovementStyle)
  longPathThreshold?: number   // tiles — paths >= this use staged run (default: 6)
  specialThreshold?: number    // tiles — min path length for special trigger (default: 8)
  endRunTiles?: number         // tiles before destination to begin end_run (default: 2)
}

export const DEFAULT_FOLLOWER_MOVEMENT: FollowerMovementStyle = {
  walkSpeed: 2,
  catchupSpeed: 3,
  catchupDistance: 4,
  longPathThreshold: 6,
  specialThreshold: 8,
  endRunTiles: 2,
}

/** Common shape for anything that can follow the player (Mana'mals only — spirits are battle-only) */
export interface Followable {
  x: number
  y: number
  targetX: number | null
  targetY: number | null
  direction: Direction
  animFrame: number
  animTimer: number
  animState: FollowerAnimState   // velocity-driven animation state
  speed: number                  // current speed in px/tick
  movementStyle: FollowerMovementStyle
  blinkTimer: number
  state: 'idle' | 'wander' | 'pet' | 'happy' | 'eat' | 'sleep'
  stateTimer: number
  followQueue: { x: number; y: number }[]
  followGoal: { x: number; y: number } | null
  // Staged movement phases (mirrors player system)
  movementPhase: MovementPhase
  phaseAnimDone: boolean
  pathLength: number
  tilesWalked: number
  specialUsed: boolean
}

/** Transition to a new movement phase — resets animation */
function setFollowerPhase(f: Followable, phase: MovementPhase): void {
  if (phase === f.movementPhase) return
  f.movementPhase = phase
  f.phaseAnimDone = false
  f.animFrame = 0
  f.animTimer = 0
}

/** Phase transition logic — runs each tick after movement update (mirrors player's updateMovementPhase) */
function updateFollowerMovementPhase(f: Followable): void {
  const phase = f.movementPhase
  const remaining = f.pathLength - f.tilesWalked
  const style = f.movementStyle
  const endRunTiles = style.endRunTiles ?? 2
  const specialThreshold = style.specialThreshold ?? 8

  // Behavior states override — don't touch phase
  if (f.state !== 'wander' && f.state !== 'idle') return

  // Stopped — go to idle
  if (f.targetX === null && f.followQueue.length === 0) {
    if (phase !== 'idle') setFollowerPhase(f, 'idle')
    return
  }

  switch (phase) {
    case 'idle': {
      const isLong = f.pathLength >= (style.longPathThreshold ?? 6)
      setFollowerPhase(f, isLong ? 'start_run' : 'walk')
      break
    }
    case 'start_run': {
      if (f.phaseAnimDone) setFollowerPhase(f, 'run')
      break
    }
    case 'run': {
      if (!f.specialUsed && f.pathLength >= specialThreshold && f.tilesWalked >= 3 && remaining > endRunTiles + 2) {
        setFollowerPhase(f, 'special')
        f.specialUsed = true
        break
      }
      if (remaining <= endRunTiles && remaining > 0) {
        setFollowerPhase(f, 'end_run')
      }
      break
    }
    case 'special': {
      if (f.phaseAnimDone) setFollowerPhase(f, 'run')
      break
    }
    case 'end_run': break  // hold until arrival
    case 'walk': break     // walk until arrival
  }
}

/** Derive follower animation state from behavior state + movement phase */
function deriveFollowerAnimState(f: Followable): FollowerAnimState {
  // Behavior states override movement-based states
  if (f.state === 'pet') return 'pet'
  if (f.state === 'happy') return 'happy'
  if (f.state === 'eat') return 'eat'
  if (f.state === 'sleep') return 'sleep'
  if (f.state === 'idle') return 'idle'
  // Wander state — derive from movement phase
  const phase = f.movementPhase
  if (phase === 'run' || phase === 'start_run' || phase === 'special' || phase === 'end_run') return 'run'
  return 'walk'
}

/** Check if a tile is walkable (masks rotation bits) */
function walkable(grid: number[][], tx: number, ty: number): boolean {
  if (ty < 0 || ty >= grid.length) return false
  if (tx < 0 || tx >= (grid[0]?.length ?? 0)) return false
  return !SOLID[grid[ty][tx] & 0xFF]
}

/** Snap pixel position to nearest tile */
function tileOf(px: number): number {
  return Math.round(px / TILE)
}

const DIR_OFFSET: Record<Direction, [number, number]> = {
  up:        [0, -1],
  down:      [0,  1],
  left:      [-1, 0],
  right:     [ 1, 0],
  upleft:    [-1, -1],
  upright:   [ 1, -1],
  downleft:  [-1,  1],
  downright: [ 1,  1],
}

/** Derive facing direction from current tile to next tile (8-way) */
function directionTo(fromX: number, fromY: number, toX: number, toY: number): Direction {
  const dx = toX - fromX
  const dy = toY - fromY
  if (dx === 0 && dy === 0) return 'down'
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  // If one axis is dominant (>2x the other), use cardinal
  if (adx > ady * 2) return dx > 0 ? 'right' : 'left'
  if (ady > adx * 2) return dy > 0 ? 'down' : 'up'
  // Otherwise diagonal
  if (dx > 0) return dy > 0 ? 'downright' : 'upright'
  return dy > 0 ? 'downleft' : 'upleft'
}

/** Pick a random walkable adjacent tile (1 step, cardinal only) */
function randomStep(grid: number[][], tx: number, ty: number): Direction | null {
  const dirs: Direction[] = ['up', 'down', 'left', 'right']
  // Shuffle
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]]
  }
  for (const d of dirs) {
    const [dx, dy] = DIR_OFFSET[d]
    if (walkable(grid, tx + dx, ty + dy)) return d
  }
  return null
}

/** Update one spirit/beast for one tick */
export function updateSpirit(spirit: Followable, grid: number[][], playerX?: number, playerY?: number): void {
  // Advance animation timer
  spirit.animTimer++

  // Blink timer runs during idle/happy (not sleep/pet)
  if (spirit.state === 'idle' || spirit.state === 'happy') {
    spirit.blinkTimer--
    if (spirit.blinkTimer <= -3) {
      // Blink lasted 3 ticks, reset
      spirit.blinkTimer = 45 + Math.floor(Math.random() * 30)
    }
  }

  // Face toward player when idle and player is adjacent (within 2 tiles)
  if (spirit.state === 'idle' && playerX !== undefined && playerY !== undefined) {
    const dx = playerX - spirit.x
    const dy = playerY - spirit.y
    const dist = Math.abs(dx) + Math.abs(dy)
    if (dist <= TILE * 2) {
      // Pick dominant axis
      if (Math.abs(dx) >= Math.abs(dy)) {
        spirit.direction = dx >= 0 ? 'right' : 'left'
      } else {
        spirit.direction = dy >= 0 ? 'down' : 'up'
      }
    }
  }

  switch (spirit.state) {
    case 'idle': {
      spirit.stateTimer--
      if (spirit.stateTimer <= 0) {
        const tx = tileOf(spirit.x)
        const ty = tileOf(spirit.y)
        const dir = randomStep(grid, tx, ty)
        if (dir) {
          const [dx, dy] = DIR_OFFSET[dir]
          spirit.state = 'wander'
          spirit.direction = dir
          spirit.targetX = (tx + dx) * TILE
          spirit.targetY = (ty + dy) * TILE
          spirit.animFrame = 0
          spirit.animTimer = 0
        } else {
          spirit.stateTimer = 20 + Math.floor(Math.random() * 20)
        }
      }
      break
    }

    case 'wander': {
      if (spirit.targetX === null || spirit.targetY === null) {
        spirit.state = 'idle'
        spirit.stateTimer = 30 + Math.floor(Math.random() * 45)
        setFollowerPhase(spirit, 'idle')
        break
      }

      // Determine speed: catch up if far from target in follow queue
      const ms = spirit.movementStyle
      const followDist = spirit.followGoal
        ? Math.abs(tileOf(spirit.x) - spirit.followGoal.x) + Math.abs(tileOf(spirit.y) - spirit.followGoal.y)
        : 0
      const speed = followDist >= ms.catchupDistance ? ms.catchupSpeed : ms.walkSpeed
      spirit.speed = speed

      // Step toward target tile
      const dx = spirit.targetX - spirit.x
      const dy = spirit.targetY - spirit.y
      const dist = Math.max(Math.abs(dx), Math.abs(dy))

      if (dist <= speed) {
        // Arrived at tile — snap
        spirit.x = spirit.targetX
        spirit.y = spirit.targetY
        spirit.tilesWalked++

        // Check follow queue for seamless path following
        if (spirit.followQueue.length > 0) {
          const wp = spirit.followQueue.shift()!
          const tx = tileOf(spirit.x)
          const ty = tileOf(spirit.y)
          spirit.direction = directionTo(tx, ty, wp.x, wp.y)
          spirit.targetX = wp.x * TILE
          spirit.targetY = wp.y * TILE
          // Stay in wander — seamless chain
        } else {
          spirit.targetX = null
          spirit.targetY = null
          spirit.state = 'idle'
          spirit.stateTimer = 30 + Math.floor(Math.random() * 45)
          spirit.animFrame = 0
          spirit.animTimer = 0
          setFollowerPhase(spirit, 'idle')
        }
      } else {
        // Move toward target — diagonal when both axes need adjustment
        const diag = dx !== 0 && dy !== 0
        const moveSpeed = diag ? speed * 0.7071 : speed
        if (dx !== 0) {
          const step = Math.min(Math.abs(dx), moveSpeed)
          spirit.x += dx > 0 ? step : -step
        }
        if (dy !== 0) {
          const step = Math.min(Math.abs(dy), moveSpeed)
          spirit.y += dy > 0 ? step : -step
        }
      }
      break
    }

    case 'happy': {
      spirit.stateTimer--
      if (spirit.stateTimer <= 0) {
        spirit.state = 'idle'
        spirit.stateTimer = 30 + Math.floor(Math.random() * 20)
        spirit.animFrame = 0
        spirit.animTimer = 0
      }
      break
    }

    case 'pet': {
      spirit.stateTimer--
      if (spirit.stateTimer <= 0) {
        spirit.state = 'happy'
        spirit.stateTimer = 12 // ~0.8s happy bounce
        spirit.animFrame = 0
        spirit.animTimer = 0
      }
      break
    }

    case 'eat': {
      spirit.stateTimer--
      if (spirit.stateTimer <= 0) {
        spirit.state = 'idle'
        spirit.stateTimer = 20 + Math.floor(Math.random() * 30)
        spirit.animFrame = 0
        spirit.animTimer = 0
      }
      break
    }

    case 'sleep': {
      spirit.stateTimer--
      if (spirit.stateTimer <= 0) {
        spirit.state = 'idle'
        spirit.stateTimer = 30 + Math.floor(Math.random() * 30)
        spirit.animFrame = 0
        spirit.animTimer = 0
      }
      break
    }
  }

  // --- Animation State Machine ---
  const newAnimState = deriveFollowerAnimState(spirit)
  if (newAnimState !== spirit.animState) {
    spirit.animState = newAnimState
    spirit.animFrame = 0
    spirit.animTimer = 0
  }

  // --- Movement Phase State Machine ---
  updateFollowerMovementPhase(spirit)
}

/**
 * Complete per-tick update for a companion spirit using A* pathfinding.
 * Self-contained: handles path computation, tile-to-tile movement, animation,
 * and blink timer. Call this INSTEAD of updateSpirit for the companion.
 */
export function followWithPath(
  spirit: Followable,
  targetX: number, targetY: number,
  grid: number[][],
  playerX: number, playerY: number,
): void {
  spirit.animTimer++

  // Blink timer
  if (spirit.state === 'idle' || spirit.state === 'happy') {
    spirit.blinkTimer--
    if (spirit.blinkTimer <= -3) {
      spirit.blinkTimer = 45 + Math.floor(Math.random() * 30)
    }
  }

  // Let pet/happy/eat animations finish before following
  if (spirit.state === 'pet') {
    spirit.stateTimer--
    if (spirit.stateTimer <= 0) {
      spirit.state = 'happy'
      spirit.stateTimer = 12
      spirit.animFrame = 0
      spirit.animTimer = 0
    }
    return
  }
  if (spirit.state === 'happy') {
    spirit.stateTimer--
    if (spirit.stateTimer <= 0) {
      spirit.state = 'idle'
      spirit.stateTimer = 15
      spirit.animFrame = 0
      spirit.animTimer = 0
    }
    return
  }
  if (spirit.state === 'eat') {
    spirit.stateTimer--
    if (spirit.stateTimer <= 0) {
      spirit.state = 'idle'
      spirit.stateTimer = 15
      spirit.animFrame = 0
      spirit.animTimer = 0
    }
    return
  }

  // Currently moving toward a tile — process movement
  if (spirit.targetX !== null && spirit.targetY !== null) {
    spirit.state = 'wander'
    const ms = spirit.movementStyle
    const followDist = spirit.followGoal
      ? Math.abs(tileOf(spirit.x) - spirit.followGoal.x) + Math.abs(tileOf(spirit.y) - spirit.followGoal.y)
      : 0
    const speed = followDist >= ms.catchupDistance ? ms.catchupSpeed : ms.walkSpeed
    spirit.speed = speed

    const dx = spirit.targetX - spirit.x
    const dy = spirit.targetY - spirit.y
    const dist = Math.max(Math.abs(dx), Math.abs(dy))

    if (dist <= speed) {
      // Arrived at tile — snap
      spirit.x = spirit.targetX
      spirit.y = spirit.targetY
      spirit.tilesWalked++

      // Consume next waypoint for seamless chain
      if (spirit.followQueue.length > 0) {
        const wp = spirit.followQueue.shift()!
        spirit.direction = directionTo(tileOf(spirit.x), tileOf(spirit.y), wp.x, wp.y)
        spirit.targetX = wp.x * TILE
        spirit.targetY = wp.y * TILE
      } else {
        spirit.targetX = null
        spirit.targetY = null
        spirit.state = 'idle'
        spirit.stateTimer = 15
        spirit.speed = 0
        spirit.followGoal = null
        setFollowerPhase(spirit, 'idle')
      }
    } else {
      // Step toward target — diagonal when both axes need adjustment
      const diag = dx !== 0 && dy !== 0
      const moveSpeed = diag ? speed * 0.7071 : speed
      if (dx !== 0) {
        const step = Math.min(Math.abs(dx), moveSpeed)
        spirit.x += dx > 0 ? step : -step
      }
      if (dy !== 0) {
        const step = Math.min(Math.abs(dy), moveSpeed)
        spirit.y += dy > 0 ? step : -step
      }
    }

    // Derive anim state + update movement phase
    const newAS = deriveFollowerAnimState(spirit)
    if (newAS !== spirit.animState) {
      spirit.animState = newAS
      spirit.animFrame = 0
      spirit.animTimer = 0
    }
    updateFollowerMovementPhase(spirit)
    return
  }

  // Not moving — compute path if needed
  const spiritTX = tileOf(spirit.x)
  const spiritTY = tileOf(spirit.y)
  const goalTX = tileOf(targetX)
  const goalTY = tileOf(targetY)

  // Already at goal — face player and idle
  if (spiritTX === goalTX && spiritTY === goalTY) {
    spirit.state = 'idle'
    spirit.followQueue = []
    spirit.followGoal = null
    // Face toward player when close
    const pdx = playerX - spirit.x
    const pdy = playerY - spirit.y
    if (Math.abs(pdx) + Math.abs(pdy) <= TILE * 3) {
      if (Math.abs(pdx) >= Math.abs(pdy)) {
        spirit.direction = pdx >= 0 ? 'right' : 'left'
      } else {
        spirit.direction = pdy >= 0 ? 'down' : 'up'
      }
    }
    return
  }

  // Recompute path when goal tile changes
  if (!spirit.followGoal || spirit.followGoal.x !== goalTX || spirit.followGoal.y !== goalTY) {
    const rawPath = findPath(grid, spiritTX, spiritTY, goalTX, goalTY)
    if (rawPath) {
      spirit.followQueue = smoothPath(grid, rawPath, spiritTX, spiritTY)
      spirit.followGoal = { x: goalTX, y: goalTY }
      // Initialize phase tracking for new path
      spirit.pathLength = spirit.followQueue.length
      spirit.tilesWalked = 0
      spirit.specialUsed = false
      spirit.phaseAnimDone = false
      const isLong = spirit.pathLength >= (spirit.movementStyle.longPathThreshold ?? 6)
      setFollowerPhase(spirit, isLong ? 'start_run' : 'walk')
    } else {
      // Path failed — escalating recovery so the spirit never permanently stalls

      // Strategy 1: Path to a walkable tile adjacent to the goal instead
      const adjGoal = nearestAdjacent(grid, goalTX, goalTY, spiritTX, spiritTY)
      const altPath = adjGoal ? findPath(grid, spiritTX, spiritTY, adjGoal.x, adjGoal.y) : null
      if (altPath && altPath.length > 0) {
        spirit.followQueue = smoothPath(grid, altPath, spiritTX, spiritTY)
        spirit.followGoal = { x: goalTX, y: goalTY }
        spirit.pathLength = spirit.followQueue.length
        spirit.tilesWalked = 0
        spirit.specialUsed = false
        spirit.phaseAnimDone = false
        const isLongAlt = spirit.pathLength >= (spirit.movementStyle.longPathThreshold ?? 6)
        setFollowerPhase(spirit, isLongAlt ? 'start_run' : 'walk')
      } else {
        // Strategy 2: Greedy single step — pick walkable neighbor closest to player
        const ptx = tileOf(playerX)
        const pty = tileOf(playerY)
        let bestStep: { x: number; y: number } | null = null
        let bestDist = Infinity
        for (const d of (['up', 'down', 'left', 'right'] as Direction[])) {
          const [ddx, ddy] = DIR_OFFSET[d]
          const nx = spiritTX + ddx
          const ny = spiritTY + ddy
          if (!walkable(grid, nx, ny)) continue
          const md = Math.abs(nx - ptx) + Math.abs(ny - pty)
          if (md < bestDist) { bestDist = md; bestStep = { x: nx, y: ny } }
        }
        if (bestStep) {
          spirit.followQueue = [bestStep]
          spirit.followGoal = { x: goalTX, y: goalTY }
          spirit.pathLength = 1
          spirit.tilesWalked = 0
          spirit.specialUsed = false
          setFollowerPhase(spirit, 'walk')
        } else {
          // Strategy 3: Completely boxed in — teleport adjacent to player
          const pAdj = nearestAdjacent(grid, ptx, pty, spiritTX, spiritTY)
          if (pAdj) {
            spirit.x = pAdj.x * TILE
            spirit.y = pAdj.y * TILE
          }
          spirit.followQueue = []
          spirit.followGoal = null
          return
        }
      }
    }
  }

  // Start moving to first waypoint
  if (spirit.followQueue.length > 0) {
    const wp = spirit.followQueue.shift()!
    spirit.direction = directionTo(spiritTX, spiritTY, wp.x, wp.y)
    spirit.state = 'wander'
    spirit.targetX = wp.x * TILE
    spirit.targetY = wp.y * TILE
    spirit.animFrame = 0
    spirit.animTimer = 0
  }
}

/** Pet a spirit or beast (external trigger from player click) */
export function petSpirit(spirit: Followable): void {
  if (spirit.state === 'sleep') return // don't wake them
  spirit.state = 'pet'
  spirit.stateTimer = 10 // ~0.67s pet animation
  spirit.animFrame = 0
  spirit.animTimer = 0
}

/** Find a spirit occupying a given tile */
export function spiritAtTile(spirits: Spirit[], tx: number, ty: number): Spirit | null {
  for (const s of spirits) {
    const stx = Math.round(s.x / 16)
    const sty = Math.round(s.y / 16)
    if (stx === tx && sty === ty) return s
  }
  return null
}
