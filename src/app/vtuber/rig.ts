/**
 * A FACE'S STATE BECOMES A SET OF TRANSFORMS. NO CANVAS IN SIGHT, ON PURPOSE.
 *
 * ★★ THIS FILE IS PURE SO THAT A GUARD CAN SEE IT. PATTERNS 2026-08-22 is a catalogue of
 * tests that went green because they could not reach their subject; the commonest cause
 * is behaviour that only exists once a rendering context does. Everything here is
 * arithmetic on plain objects, so `rig.test.ts` asks the SHIPPED function the same
 * question the page asks it, rather than re-deriving the answer beside it.
 *
 * ★ AND EVERY ANCHOR ARRIVES AS DATA. `AvatarMeta` is read from the JSON that
 * `scripts/vtuber-layers.py` writes next to the pixels it cut. Nothing in this file
 * knows where a mouth is; it knows how a mouth MOVES.
 */
import {
  type ExpressionState, clamp01,
} from './expression'

export interface AvatarMeta {
  name: string
  w: number
  h: number
  mouth: {
    pivotX: number; pivotY: number
    box: [number, number, number, number]
    splitY: number
    coreTop: number; coreBottom: number; coreLeft: number; coreRight: number
    corePx: number; layerPx: number; dominance: number
  }
  eyes: { leftX: number; rightX: number; y: number; r: number }
}

export interface LayerPose {
  x: number; y: number
  scaleX: number; scaleY: number
  rotate: number
  opacity: number
}

export interface EyePose {
  leftX: number; rightX: number; y: number
  rx: number; ry: number
  opacity: number
}

export interface RigPose {
  base: LayerPose
  /** Shared placement for both halves of the mouth. `scaleY` stays 1 — see `jawDrop`. */
  mouth: LayerPose
  /**
   * How far the LOWER half of the grin travels down, in art-space px. The upper half never
   * moves. ★★★ This replaced a vertical SCALE on the whole crescent, which stretched the teeth
   * themselves and read, unmistakably once photographed, as the face melting.
   */
  jawDrop: number
  backdrop: LayerPose
  eyes: EyePose | null
  /** Multiplier on the mouth's bloom. 1 = as painted. */
  glow: number
}

export interface RigOptions {
  /** Draw the hood's eye glows. Off returns `eyes: null` and nothing downstream draws. */
  eyes: boolean
  /** Global multiplier on head motion. 0 pins the head still. */
  motion: number
  /** Seconds-scale clock for idle life. Pass performance.now(). */
  now: number
}

export const DEFAULT_OPTIONS: RigOptions = { eyes: true, motion: 1, now: 0 }

// ── HOW FAR EACH CHANNEL IS ALLOWED TO PUSH THE ART ────────────────────────────────
// These are feel dials, and they are the only invented numbers in the file. Each is
// expressed against the ART'S OWN measurements where one exists, so redrawing the
// avatar at another size does not silently rescale the performance.
const HEAD_SHIFT   = 0.018   // of frame width, at full yaw
const HEAD_RISE    = 0.014   // of frame height, at full pitch
const HEAD_TILT    = 0.10    // radians at full roll
const PARALLAX     = -0.34   // backdrop moves AGAINST the head, and less. This is the depth.
const JAW_DROP     = 0.62    // of the grin's own height, at full open — a distance, not a scale
const GRIN_WIDEN   = 0.17    // ...and its width at full grin
const BREATH_PX    = 0.0026  // of frame height
const BREATH_MS    = 2600

/**
 * ★★★ THE MOUTH OPENS BY DROPPING A JAW, NOT BY SCALING A CRESCENT — AND THE DIFFERENCE WAS
 * ONLY VISIBLE IN A PHOTOGRAPH. The first version scaled the whole grin vertically. Every
 * number was right, the guard was green, and the render was obviously wrong the moment anyone
 * looked at it: teeth are rigid, so stretching them read as the face dripping. The upper row
 * now holds still, the lower row travels `jawDrop`, and the renderer opens a dark cavity
 * between. ⚠ Same family as everything in PATTERNS about a self-consistent instrument — the
 * arithmetic was never the thing that was wrong.
 *
 * ★ AND THE GLOW RIDES THE OPENING. A mouth this bright is a light source; opening it
 * wider should put more light on the scene, not stretch a constant amount of it. That
 * single coupling is most of what makes the rig read as alive rather than as a sticker
 * being squashed.
 */
export function rig(
  s: ExpressionState,
  meta: AvatarMeta,
  opts: RigOptions = DEFAULT_OPTIONS,
): RigPose {
  const m = opts.motion
  const dx = s.yaw   * HEAD_SHIFT * meta.w * m
  const dy = -s.pitch * HEAD_RISE  * meta.h * m
  const rot = s.roll * HEAD_TILT * m

  // Idle life. A perfectly still avatar reads as a frozen stream, and the fix is small
  // and slow rather than large and fast.
  const breath = Math.sin(opts.now / BREATH_MS) * BREATH_PX * meta.h

  const base: LayerPose = {
    x: dx, y: dy + breath,
    scaleX: 1, scaleY: 1,
    rotate: rot,
    opacity: 1,
  }

  // The backdrop counter-moves. Without this the whole picture slides as one flat card
  // and the head might as well be painted on the wall behind it.
  const backdrop: LayerPose = {
    x: dx * PARALLAX, y: (dy + breath) * PARALLAX,
    scaleX: 1, scaleY: 1,
    rotate: rot * PARALLAX * 0.5,
    opacity: 1,
  }

  const open = clamp01(s.mouthOpen)
  const wide = clamp01(s.mouthWide)

  const mouth: LayerPose = {
    x: dx, y: dy + breath,
    scaleX: 1 + wide * GRIN_WIDEN,
    // ⚠ Deliberately 1. A vertical scale here is the melting-teeth defect; the jaw is a
    // translation of one half, and it lives in `jawDrop`.
    scaleY: 1,
    rotate: rot,
    opacity: 1,
  }
  const grinHeight = meta.mouth.coreBottom - meta.mouth.coreTop
  const jawDrop = open * JAW_DROP * grinHeight

  const eyes: EyePose | null = opts.eyes ? {
    leftX:  meta.eyes.leftX  + dx,
    rightX: meta.eyes.rightX + dx,
    y:      meta.eyes.y + dy + breath,
    rx:     meta.eyes.r * (1 + s.browRaise * 0.14),
    // A lid closes vertically. `eyeOpen` 0 must reach a hard 0 height or a "blink"
    // leaves a bright line across the face, which is worse than not blinking at all.
    ry:     meta.eyes.r * 0.62 * clamp01((s.eyeOpenL + s.eyeOpenR) / 2),
    opacity: 0.55 + s.browRaise * 0.25,
  } : null

  return {
    base, backdrop, mouth, jawDrop, eyes,
    glow: 0.78 + open * 0.55 + wide * 0.12,
  }
}
