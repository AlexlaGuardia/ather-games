// Frame derivation engine for sprites (spirits + player characters)
//
// Design 3 keyframes (down, up, right idle) → get a full animation set.
// Override any derived frame that doesn't look right.
// Size is auto-detected from array length (supports any square dimension).
//
// Usage (spirit 16x16):
//   const TURTLE_SPRITES = deriveSprites({
//     down: DOWN_IDLE, up: UP_IDLE, right: RIGHT_IDLE,
//     eyeColor: 3, legRows: 2,
//   })
//
// Usage (player 16x16):
//   const CHAR_SPRITES = derivePlayerSprites({
//     down: DOWN_IDLE, up: UP_IDLE, right: RIGHT_IDLE,
//     legRows: 2,
//   })

import { SpriteAnim } from './sprite-data'

/** Infer sprite dimension from pixel array (assumes square) */
function dim(f: Uint8Array): number { return Math.round(Math.sqrt(f.length)) }

// ── Pixel Operations ─────────────────────────────────

function clone(f: Uint8Array): Uint8Array { return new Uint8Array(f) }

/** Shift entire sprite up 1px — used for breathing bob & happy bounce */
export function shiftUp(f: Uint8Array): Uint8Array {
  const S = dim(f)
  const out = new Uint8Array(S * S)
  out.set(f.subarray(S))
  return out
}

/** Shift entire sprite down 1px */
export function shiftDown(f: Uint8Array): Uint8Array {
  const S = dim(f)
  const out = new Uint8Array(S * S)
  out.set(f.subarray(0, S * (S - 1)), S)
  return out
}

/** Horizontal flip */
export function flipH(f: Uint8Array): Uint8Array {
  const S = dim(f)
  const out = new Uint8Array(S * S)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      out[y * S + x] = f[y * S + (S - 1 - x)]
  return out
}

/** Replace one palette index with another (for blink) */
export function replaceColor(f: Uint8Array, from: number, to: number): Uint8Array {
  const out = clone(f)
  for (let i = 0; i < out.length; i++)
    if (out[i] === from) out[i] = to
  return out
}

/** Convert frame back to visual hex digit string (for editor/debugging) */
export function toDigitString(f: Uint8Array): string {
  const S = dim(f)
  let s = ''
  for (let y = 0; y < S; y++) {
    s += '  '
    for (let x = 0; x < S; x++) s += f[y * S + x].toString(16)
    if (y < S - 1) s += '\n'
  }
  return s
}

// ── Walk Step Helpers ────────────────────────────────

/** Center X of all non-transparent pixels */
function centerX(f: Uint8Array): number {
  const S = dim(f)
  let sum = 0, n = 0
  for (let i = 0; i < S * S; i++)
    if (f[i]) { sum += i % S; n++ }
  return n ? Math.round(sum / n) : S / 2
}

/** Find bottom-most row with non-zero pixels */
function bottomRow(f: Uint8Array): number {
  const S = dim(f)
  for (let y = S - 1; y >= 0; y--)
    for (let x = 0; x < S; x++)
      if (f[y * S + x]) return y
  return -1
}

/** Find contiguous groups of non-zero pixels in a row within [xStart, xEnd) */
function pixelGroups(f: Uint8Array, y: number, xStart: number, xEnd: number): number[][] {
  const S = dim(f)
  const groups: number[][] = []
  let cur: number[] = []
  for (let x = xStart; x < xEnd; x++) {
    if (f[y * S + x] !== 0) {
      cur.push(x)
    } else if (cur.length) {
      groups.push(cur)
      cur = []
    }
  }
  if (cur.length) groups.push(cur)
  return groups
}

/** Shift the leftmost pixel group in a row 1px to the left */
function shiftGroupLeft(f: Uint8Array, out: Uint8Array, y: number, cx: number): void {
  const S = dim(f)
  const groups = pixelGroups(f, y, 0, cx)
  if (!groups.length) return
  const g = groups[0]
  if (g[0] === 0) return
  if (f[y * S + g[0] - 1] !== 0) return
  for (const x of g) {
    out[y * S + (x - 1)] = f[y * S + x]
    out[y * S + x] = 0
  }
}

/** Shift the rightmost pixel group in a row 1px to the right */
function shiftGroupRight(f: Uint8Array, out: Uint8Array, y: number, cx: number): void {
  const S = dim(f)
  const groups = pixelGroups(f, y, cx, S)
  if (!groups.length) return
  const g = groups[groups.length - 1]
  if (g[g.length - 1] >= S - 1) return
  if (f[y * S + g[g.length - 1] + 1] !== 0) return
  for (let i = g.length - 1; i >= 0; i--) {
    out[y * S + (g[i] + 1)] = f[y * S + g[i]]
    out[y * S + g[i]] = 0
  }
}

/** Walk step: shift left-side foot pixels 1px outward (left) */
export function stepLeft(f: Uint8Array, legRows = 2): Uint8Array {
  const out = clone(f)
  const cx = centerX(f)
  const bot = bottomRow(f)
  if (bot < 0) return out
  for (let r = 0; r < legRows; r++) {
    const y = bot - r
    if (y < 0) break
    shiftGroupLeft(f, out, y, cx)
  }
  return out
}

/** Walk step: shift right-side foot pixels 1px outward (right) */
export function stepRight(f: Uint8Array, legRows = 2): Uint8Array {
  const out = clone(f)
  const cx = centerX(f)
  const bot = bottomRow(f)
  if (bot < 0) return out
  for (let r = 0; r < legRows; r++) {
    const y = bot - r
    if (y < 0) break
    shiftGroupRight(f, out, y, cx)
  }
  return out
}

// ── Main Derivation ──────────────────────────────────

export interface DeriveInput {
  /** Front-facing idle keyframe (canonical view) */
  down: Uint8Array
  /** Back-facing idle keyframe */
  up: Uint8Array
  /** Side profile idle keyframe (right = canonical, left = auto-flip) */
  right: Uint8Array

  /** Manual overrides — provide any key to skip its auto-derivation */
  overrides?: Partial<Record<string, SpriteAnim>>

  /** Palette index used for eyes — replaced on blink (default: 3) */
  eyeColor?: number
  /** Palette index to replace eyes with on blink (default: 1) */
  blinkColor?: number
  /** How many bottom rows to modify for walk steps (default: 2) */
  legRows?: number

  /** Ticks per frame at 15 TPS */
  idleRate?: number  // default 8
  walkRate?: number  // default 4
  happyRate?: number // default 3
}

/**
 * Derive a complete sprite animation set from 3 keyframes.
 *
 * Returns the same Record<string, SpriteAnim> format used by FOX_SPRITES etc.
 * Any key in `overrides` replaces the auto-derived version.
 */
export function deriveSprites(input: DeriveInput): Record<string, SpriteAnim> {
  const {
    down, up, right,
    overrides = {},
    eyeColor = 3,
    blinkColor = 1,
    legRows = 2,
    idleRate = 8,
    walkRate = 4,
    happyRate = 3,
  } = input

  const o = (key: string, auto: SpriteAnim): SpriteAnim => overrides[key] ?? auto

  // Derived frames
  const downBob  = shiftUp(down)
  const upBob    = shiftUp(up)
  const rightBob = shiftUp(right)

  return {
    // ── Directional idle (2-frame breathing bob) ──
    down_idle:  o('down_idle',  { frames: [down, downBob], rate: idleRate }),
    up_idle:    o('up_idle',    { frames: [up, upBob], rate: idleRate }),
    right_idle: o('right_idle', { frames: [right, rightBob], rate: idleRate }),

    // ── Directional walk (Pokemon Gen 1: idle → stepL → idle → stepR) ──
    down_walk: o('down_walk', {
      frames: [down, stepLeft(down, legRows), down, stepRight(down, legRows)],
      rate: walkRate,
    }),
    up_walk: o('up_walk', {
      frames: [up, stepLeft(up, legRows), up, stepRight(up, legRows)],
      rate: walkRate,
    }),
    right_walk: o('right_walk', {
      frames: [right, stepRight(rightBob, legRows), right, stepLeft(rightBob, legRows)],
      rate: walkRate,
    }),

    // ── Non-directional aliases (backwards compat with spirit AI) ──
    idle: o('idle', { frames: [right, rightBob], rate: idleRate }),
    walk: o('walk', {
      frames: [right, stepRight(rightBob, legRows), right, stepLeft(rightBob, legRows)],
      rate: walkRate,
    }),

    // ── Blink (eye color → body color) ──
    idle_blink: o('idle_blink', {
      frames: [replaceColor(right, eyeColor, blinkColor)],
      rate: idleRate,
    }),

    // ── Happy (bounce cycle) ──
    happy: o('happy', {
      frames: [right, rightBob, right, rightBob],
      rate: happyRate,
    }),

    // ── Eat (head dip — override for better version) ──
    eat: o('eat', {
      frames: [right, shiftDown(right)],
      rate: 6,
    }),

    // ── Sleep (placeholder — override with hand-drawn pose) ──
    sleep: o('sleep', {
      frames: [right, right],
      rate: 12,
    }),

    // ── Battle frames (spirits fight, not follow) ──
    battle_front: o('battle_front', { frames: [down, downBob], rate: idleRate }),
    battle_back: o('battle_back', { frames: [up, upBob], rate: idleRate }),
    battle_attack: o('battle_attack', { frames: [down, downBob, down], rate: 3 }),
    battle_hit_front: o('battle_hit_front', { frames: [shiftDown(down)], rate: idleRate }),
    battle_hit_back: o('battle_hit_back', { frames: [shiftDown(up)], rate: idleRate }),
    battle_faint: o('battle_faint', { frames: [down, shiftDown(down)], rate: 4 }),
  }
}

// ── Player Character Derivation (32x32) ─────────────

export interface PlayerDeriveInput {
  /** Front-facing idle keyframe */
  down: Uint8Array
  /** Back-facing idle keyframe */
  up: Uint8Array
  /** Side profile idle keyframe (right = canonical, left = auto-flip) */
  right: Uint8Array

  /** Manual overrides — provide any key to skip its auto-derivation */
  overrides?: Partial<Record<string, SpriteAnim>>

  /** How many bottom rows to modify for walk steps (default: 2) */
  legRows?: number

  /** Ticks per frame at 15 TPS */
  idleRate?: number  // default 15
  walkRate?: number  // default 4
}

/**
 * Derive a complete player character animation set from 3 keyframes.
 *
 * Returns 6 animations: down/up/right × idle/walk.
 * Left-facing is auto-flipped from right at render time.
 */
export function derivePlayerSprites(input: PlayerDeriveInput): Record<string, SpriteAnim> {
  const {
    down, up, right,
    overrides = {},
    legRows = 2,
    idleRate = 15,
    walkRate = 4,
  } = input

  const o = (key: string, auto: SpriteAnim): SpriteAnim => overrides[key] ?? auto

  const downBob  = shiftUp(down)
  const upBob    = shiftUp(up)
  const rightBob = shiftUp(right)

  return {
    down_idle:  o('down_idle',  { frames: [down, downBob], rate: idleRate }),
    down_walk:  o('down_walk',  { frames: [down, stepLeft(down, legRows), down, stepRight(down, legRows)], rate: walkRate }),
    up_idle:    o('up_idle',    { frames: [up, upBob], rate: idleRate }),
    up_walk:    o('up_walk',    { frames: [up, stepLeft(up, legRows), up, stepRight(up, legRows)], rate: walkRate }),
    right_idle: o('right_idle', { frames: [right, rightBob], rate: idleRate }),
    right_walk: o('right_walk', { frames: [right, stepLeft(right, legRows), right, stepRight(right, legRows)], rate: walkRate }),
  }
}
