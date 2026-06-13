// Player entity — controllable character in the Shimmer
// Click-to-move pathfinding with staged movement animation system
// 8-directional facing, 15 TPS, A* path following
//
// Movement phases: idle → start_run → run → special → end_run → idle
// Short paths use walk instead. Each phase maps to hand-painted sprite keys.

import { InputState } from './input'
import { SOLID } from '../world/tiles'
import { TILE } from './renderer'

export type PlayerDirection = 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right'

// --- Movement Phase State Machine ---
// Phases driven by path distance + progress. Each phase maps to a sprite animation key.
export type MovementPhase = 'idle' | 'walk' | 'start_run' | 'run' | 'special' | 'end_run'

// Phases that play once then transition (don't loop)
const PLAY_ONCE_PHASES: Set<MovementPhase> = new Set(['start_run', 'special', 'end_run'])

export function isPlayOncePhase(phase: MovementPhase): boolean {
  return PLAY_ONCE_PHASES.has(phase)
}

// Backward compat — beasts and some UI still reference AnimState
export type AnimState = 'idle' | 'walk' | 'run'

/** Per-character movement capabilities and thresholds */
export interface MovementStyle {
  walkSpeed: number       // base pixels per tick
  runSpeed: number        // max pixels per tick (0 = character can't run)
  rampTiles: number       // tiles to accelerate walk → run
  brakeTiles: number      // tiles to decelerate run → walk
  // Phase thresholds
  longPathThreshold?: number   // tiles — paths >= this use staged run (default: 6)
  specialThreshold?: number    // tiles — minimum path length for special trigger (default: 8)
  endRunTiles?: number         // tiles before destination to begin end_run (default: 2)
}

export const DEFAULT_MOVEMENT: MovementStyle = {
  walkSpeed: 3,
  runSpeed: 5.2,
  rampTiles: 3,
  brakeTiles: 3,
  longPathThreshold: 6,
  specialThreshold: 8,
  endRunTiles: 2,
}

export interface PathTarget {
  x: number
  y: number
  pixelX?: number            // exact click pixel (for free-pixel final positioning)
  pixelY?: number
  interactSpiritId?: string  // auto-pet spirit on arrival
  interactConsole?: boolean  // auto-open Spirit Console on arrival
  interactNpcId?: string     // auto-talk to NPC on arrival
  interactNodeId?: string    // auto-interact with resource node on arrival
  interactPlant?: { seedItemId: string; tileX: number; tileY: number }  // auto-plant seed on arrival
  interactPickupId?: string  // auto-collect static pickup on arrival
  interactFurniture?: string  // auto-open furniture panel on arrival (furniture instance id)
}

export interface Player {
  x: number              // pixel position (logic tick)
  y: number
  prevX: number          // position at start of tick (for render interpolation)
  prevY: number
  tileX: number          // grid tile
  tileY: number
  direction: PlayerDirection
  moving: boolean        // mid-tile transition
  targetX: number        // pixel target when moving
  targetY: number
  animFrame: number
  animTimer: number
  animState: AnimState           // backward compat — derived from movementPhase
  movementPhase: MovementPhase   // staged movement phase
  phaseAnimDone: boolean         // set by renderer when play-once anim finishes its last frame
  specialUsed: boolean           // special already triggered on this path
  speed: number                  // current speed in px/tick (drives actual movement)
  movementStyle: MovementStyle   // per-character movement config
  pathQueue: { x: number; y: number }[]  // click-to-move waypoints
  pathTarget: PathTarget | null          // final destination metadata
  arrivedAtPath: boolean                 // signals page.tsx to handle arrival
  pathLength: number                     // total tiles in current path (for momentum)
  tilesWalked: number                    // tiles completed in current path
  momentumBoost: number                  // virtual ramp progress carried into a redirect (only feeds accel, not brake)
}

export function createPlayer(tileX: number, tileY: number, style?: MovementStyle): Player {
  return {
    x: tileX * TILE,
    y: tileY * TILE,
    prevX: tileX * TILE,
    prevY: tileY * TILE,
    tileX,
    tileY,
    direction: 'down',
    moving: false,
    targetX: tileX * TILE,
    targetY: tileY * TILE,
    animFrame: 0,
    animTimer: 0,
    animState: 'idle',
    movementPhase: 'idle',
    phaseAnimDone: false,
    specialUsed: false,
    speed: 0,
    movementStyle: style ?? DEFAULT_MOVEMENT,
    pathQueue: [],
    pathTarget: null,
    arrivedAtPath: false,
    pathLength: 0,
    tilesWalked: 0,
    momentumBoost: 0,
  }
}

/** Set a click-to-move path on the player — handles phase interrupts */
export function setPath(player: Player, path: { x: number; y: number }[], target?: PathTarget) {
  const prevPhase = player.movementPhase
  const isLong = path.length >= (player.movementStyle.longPathThreshold ?? 6)
  const wasRunning = prevPhase === 'run' || prevPhase === 'special' || prevPhase === 'end_run'

  player.pathQueue = path
  player.pathTarget = target ?? null
  player.arrivedAtPath = false
  player.pathLength = path.length
  player.tilesWalked = 0
  // Preserve momentum on mid-run redirects: feed the accel curve a virtual head
  // start so pathSpeed() stays at runSpeed from tick 1, but leave tilesWalked
  // honest so the brake (which uses pathLength - tilesWalked) engages correctly
  // at the end of the new path.
  player.momentumBoost = (wasRunning && isLong) ? (player.movementStyle.rampTiles ?? 1) : 0
  player.specialUsed = false
  player.phaseAnimDone = false

  // Interrupt logic — pick the right starting phase based on current state
  if (wasRunning) {
    // Already moving at speed — skip start_run, go straight to run or walk
    setPhase(player, isLong ? 'run' : 'walk')
  } else if (prevPhase === 'start_run') {
    // Let start_run finish, path is already recalculated
  } else {
    // From idle or walk — start fresh
    setPhase(player, isLong ? 'start_run' : 'walk')
  }
}

/** Clear any active path (called on zone warp) */
export function clearPath(player: Player) {
  player.pathQueue = []
  player.pathTarget = null
  player.arrivedAtPath = false
  player.pathLength = 0
  player.tilesWalked = 0
  setPhase(player, 'idle')
}

/** Transition to a new movement phase — resets animation */
function setPhase(player: Player, phase: MovementPhase) {
  if (phase === player.movementPhase) return
  player.movementPhase = phase
  player.phaseAnimDone = false
  player.animFrame = 0
  player.animTimer = 0
  // Sync backward-compat animState
  player.animState = phaseToAnimState(phase)
}

/** Map MovementPhase → legacy AnimState for backward compat */
function phaseToAnimState(phase: MovementPhase): AnimState {
  switch (phase) {
    case 'idle': return 'idle'
    case 'walk': return 'walk'
    case 'start_run': case 'run': case 'special': case 'end_run': return 'run'
  }
}

const DIAG_FACTOR = 0.7071 // 1/√2 — normalize diagonal speed

/** Momentum speed — ramps up over first tiles, holds run, decelerates at end */
function pathSpeed(walked: number, totalLen: number, style: MovementStyle, momentumBoost = 0): number {
  if (style.runSpeed <= 0 || totalLen <= 5) return style.walkSpeed // short paths or no-run chars stay at walk
  const remaining = totalLen - walked
  // momentumBoost only feeds accel — preserves run speed across mid-run redirects
  // without lying about path progress (which would break the brake calc and
  // produce negative speed when tilesWalked exceeds pathLength).
  // Clamps protect against any bookkeeping drift producing negative speeds.
  const accelT = Math.max(0, Math.min((walked + momentumBoost) / style.rampTiles, 1))
  const brakeT = Math.max(0, Math.min(remaining / style.brakeTiles, 1))
  return style.walkSpeed + (style.runSpeed - style.walkSpeed) * Math.min(accelT, brakeT)
}

const DIR_OFFSET: Record<PlayerDirection, [number, number]> = {
  up:           [ 0, -1],
  down:         [ 0,  1],
  left:         [-1,  0],
  right:        [ 1,  0],
  'up-left':    [-1, -1],
  'up-right':   [ 1, -1],
  'down-left':  [-1,  1],
  'down-right': [ 1,  1],
}

export function walkable(grid: number[][], tx: number, ty: number, blockedTiles?: Set<string>): boolean {
  if (ty < 0 || ty >= grid.length) return false
  if (tx < 0 || tx >= (grid[0]?.length ?? 0)) return false
  if (SOLID[grid[ty][tx] & 0xFF]) return false
  if (blockedTiles?.has(`${tx},${ty}`)) return false
  return true
}

/** Derive facing direction from current tile to next tile (8-directional) */
function directionTo(fromX: number, fromY: number, toX: number, toY: number): PlayerDirection {
  const dx = toX - fromX
  const dy = toY - fromY
  if (dx > 0 && dy < 0) return 'up-right'
  if (dx < 0 && dy < 0) return 'up-left'
  if (dx > 0 && dy > 0) return 'down-right'
  if (dx < 0 && dy > 0) return 'down-left'
  if (dx > 0) return 'right'
  if (dx < 0) return 'left'
  if (dy < 0) return 'up'
  return 'down'
}

/** Map PlayerDirection to sprite lookup + flip flag (supports diagonal sprites) */
export function spriteDir(dir: PlayerDirection): { dir: string; flip: boolean } {
  switch (dir) {
    case 'up':         return { dir: 'up',        flip: false }
    case 'down':       return { dir: 'down',      flip: false }
    case 'right':      return { dir: 'right',     flip: false }
    case 'left':       return { dir: 'right',     flip: true }
    case 'up-right':   return { dir: 'upright',   flip: false }
    case 'up-left':    return { dir: 'upright',   flip: true }
    case 'down-right': return { dir: 'downright', flip: false }
    case 'down-left':  return { dir: 'downright', flip: true }
  }
}

/** Map PlayerDirection to cardinal sprite dir for channels (no diagonal channel art) */
export function channelDir(dir: PlayerDirection): { dir: 'up' | 'down' | 'right'; flip: boolean } {
  switch (dir) {
    case 'up': case 'up-right':     return { dir: 'up',    flip: false }
    case 'up-left':                 return { dir: 'up',    flip: true }
    case 'down': case 'down-right': return { dir: 'down',  flip: false }
    case 'down-left':               return { dir: 'down',  flip: true }
    case 'right':                   return { dir: 'right', flip: false }
    case 'left':                    return { dir: 'right', flip: true }
  }
}

/** Update player for one logic tick (click-to-move with staged movement phases) */
export function updatePlayer(player: Player, _input: InputState, grid: number[][], _blockedTiles?: Set<string>): void {
  // Snapshot position for render interpolation
  player.prevX = player.x
  player.prevY = player.y
  player.animTimer++

  if (player.moving) {
    const speed = pathSpeed(player.tilesWalked, player.pathLength, player.movementStyle, player.momentumBoost)
    player.speed = speed
    const dx = player.targetX - player.x
    const dy = player.targetY - player.y
    const dist = Math.max(Math.abs(dx), Math.abs(dy))

    if (dist <= speed) {
      // Arrived at target tile
      player.x = player.targetX
      player.y = player.targetY
      player.tileX = Math.round(player.x / TILE)
      player.tileY = Math.round(player.y / TILE)
      player.tilesWalked++

      if (player.pathQueue.length > 0) {
        // Consume next waypoint — seamless path following
        const wp = player.pathQueue.shift()!
        player.direction = directionTo(player.tileX, player.tileY, wp.x, wp.y)
        player.targetX = wp.x * TILE
        player.targetY = wp.y * TILE
      } else {
        // Path complete
        player.moving = false
        player.speed = 0
        if (player.pathTarget) {
          player.arrivedAtPath = true
        }
      }
    } else {
      // Step toward target — normalize diagonal speed
      const diag = dx !== 0 && dy !== 0
      const moveSpeed = diag ? speed * DIAG_FACTOR : speed
      if (dx !== 0) {
        const step = Math.min(Math.abs(dx), moveSpeed)
        player.x += dx > 0 ? step : -step
      }
      if (dy !== 0) {
        const step = Math.min(Math.abs(dy), moveSpeed)
        player.y += dy > 0 ? step : -step
      }
    }
  } else if (player.pathQueue.length > 0) {
    // Start moving along path
    const wp = player.pathQueue.shift()!
    player.direction = directionTo(player.tileX, player.tileY, wp.x, wp.y)
    player.moving = true
    player.targetX = wp.x * TILE
    player.targetY = wp.y * TILE
    player.speed = player.movementStyle.walkSpeed
  } else {
    player.speed = 0
  }

  // --- Movement Phase State Machine ---
  updateMovementPhase(player)
}

/** Phase transition logic — runs each tick after movement update */
function updateMovementPhase(player: Player): void {
  const phase = player.movementPhase
  const remaining = player.pathLength - player.tilesWalked
  const style = player.movementStyle
  const endRunTiles = style.endRunTiles ?? 2
  const specialThreshold = style.specialThreshold ?? 8

  if (!player.moving && player.pathQueue.length === 0) {
    // Stopped — go to idle
    if (phase !== 'idle') setPhase(player, 'idle')
    return
  }

  switch (phase) {
    case 'idle': {
      // Just started moving — setPath already picked the initial phase,
      // but if we got here it means movement started from pathQueue consumption
      const isLong = player.pathLength >= (style.longPathThreshold ?? 6)
      setPhase(player, isLong ? 'start_run' : 'walk')
      break
    }

    case 'start_run': {
      // Wait for play-once animation to complete, then transition to run
      if (player.phaseAnimDone) {
        setPhase(player, 'run')
      }
      break
    }

    case 'run': {
      // Check for special trigger
      if (!player.specialUsed &&
          player.pathLength >= specialThreshold &&
          player.tilesWalked >= 3 &&
          remaining > endRunTiles + 2) {
        setPhase(player, 'special')
        player.specialUsed = true
        break
      }
      // Check for end_run — approaching destination
      if (remaining <= endRunTiles && remaining > 0) {
        setPhase(player, 'end_run')
      }
      break
    }

    case 'special': {
      // Wait for play-once animation, then back to run
      if (player.phaseAnimDone) {
        setPhase(player, 'run')
      }
      break
    }

    case 'end_run': {
      // Arrival is handled by movement code above (sets moving=false)
      // If phaseAnimDone and still moving, hold last frame until arrival
      break
    }

    case 'walk': {
      // Walk stays walk until arrival (handled by idle check at top)
      break
    }
  }
}

/** Get the tile position the player is facing */
export function facingTile(player: Player): { tx: number; ty: number } {
  const [dtx, dty] = DIR_OFFSET[player.direction]
  return { tx: player.tileX + dtx, ty: player.tileY + dty }
}
