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
    /**
     * The grin's own edges, sampled every `step` px from `x0`. `upperBottom[i]` is the lowest
     * lit pixel of the upper row in that column, `lowerTop[i]` the highest of the lower row.
     * `null` where a row has no pixel — at the crescent's tapering ends, which is exactly where
     * an interpolated guess would be visible.
     */
    profile: { x0: number; step: number; upperBottom: (number | null)[]; lowerTop: (number | null)[] }
    corePx: number; layerPx: number; dominance: number
  }
  eyes: { leftX: number; rightX: number; y: number; r: number }
}

/**
 * The mouth set, as the cutter registered it. `ramp` is ordered shut -> open and every
 * `openness` on it was DERIVED from the art's own hollowness, never typed.
 */
export interface VisemeSet {
  name: string
  scale: number
  ramp: string[]
  shapes: Record<string, { file: string; openness: number | null; fill: number }>
}

/**
 * Which two shapes to draw and how much of each.
 *
 * ★★ TWO SHAPES AND A BLEND, NEVER ONE. Snapping to the nearest viseme makes the mouth POP
 * between four states, which is the other classic puppet tell — it is what a cheap flipbook
 * rig looks like. Crossfading adjacent shapes turns four drawings into a continuum.
 */
export interface VisemePick {
  a: string
  b: string
  /** 0 = all `a`, 1 = all `b`. */
  t: number
  /** Weight of the pucker shape drawn OVER the ramp blend. */
  round: number
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
  /** Scale applied to the LOWER row only, as the jaw swings back about its hinge. */
  jawScale: number
  backdrop: LayerPose
  eyes: EyePose | null
  /** Null when no viseme set is loaded — the renderer then falls back to the legacy jaw. */
  viseme: VisemePick | null
  /** Multiplier on the mouth's bloom. 1 = as painted. */
  glow: number
}

/**
 * Pick two adjacent shapes off the ramp and the blend between them.
 *
 * ⚠ THE RAMP'S SPACING IS UNEVEN AND THAT IS FINE — it is measured, not designed (closed 0.00,
 * ajar 0.55, mid 0.69, wide 1.00). Interpolating BETWEEN the measured points is exactly what
 * makes uneven spacing harmless; forcing them to equal steps would be re-typing the fact the
 * cutter measured.
 */
/** Below this openness a pucker cannot take over — a closed mouth is not an "oh". */
export const PUCKER_MIN_OPEN = 0.30

export function pickViseme(open: number, pucker: number, set: VisemeSet): VisemePick {
  const ramp = set.ramp
  const o = open < 0 ? 0 : open > 1 ? 1 : open
  let a = ramp[0], b = ramp[0], t = 0
  for (let i = 0; i < ramp.length - 1; i++) {
    const lo = set.shapes[ramp[i]].openness ?? 0
    const hi = set.shapes[ramp[i + 1]].openness ?? 1
    if (o >= lo && o <= hi) {
      a = ramp[i]; b = ramp[i + 1]
      t = hi > lo ? (o - lo) / (hi - lo) : 0
      break
    }
    if (o > hi) { a = ramp[i + 1]; b = ramp[i + 1]; t = 0 }
  }
  // ★★ A PUCKER IS A SHAPE AN OPEN MOUTH MAKES. Ungated, a high pucker replaced the ramp
  // entirely and a SHUT mouth rendered as an "oh" — caught in a photograph, where the shut and
  // blink frames both came back as a glowing O. You cannot say "oh" with your mouth closed, so
  // the round shape fades in with openness rather than overriding it.
  // ⚠ SQUARED. A linear gate still let a few percent of the O bleed through a nearly-shut
  // mouth, and a 5%-alpha ring ghosting over a closed grin is visible — the crossfade is doing
  // exactly what it was told, which is why this is fixed in the curve and not in the blend.
  const gate = clamp01(o / PUCKER_MIN_OPEN) ** 2
  return { a, b, t, round: 'round' in set.shapes ? clamp01(pucker) * gate : 0 }
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
// ★★★ THE TWO DIALS THAT STOP IT READING AS A PUPPET (Alex's note, 2026-08-31).
// A marionette's jaw is a rigid trapdoor: same width at every opening, sliding straight down on
// a visible hinge. A real mouth does neither. The corners PULL IN as it opens — the crescent
// genuinely gets shorter, which is the single strongest tell — and the lower row RECEDES a
// little as the jaw swings back about a hinge behind the face, rather than sliding down the
// picture plane. Both are cheap, and together they are most of the difference.
const MOUTH_NARROW = 0.26    // corners pull in this much of the width at full open
const JAW_RECEDE   = 0.12    // the lower row shrinks this much as it swings back
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
  visemes: VisemeSet | null = null,
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
    // ⚠ Widening and narrowing are DIFFERENT AXES and both apply: a grin can be wide while the
    // jaw is open, and the corners still come in. Multiplying rather than picking one is what
    // keeps "smiling" and "speaking" independent.
    scaleX: (1 + wide * GRIN_WIDEN) * (1 - open * MOUTH_NARROW),
    // ⚠ Deliberately 1. A vertical scale here is the melting-teeth defect; the jaw is a
    // translation of one half, and it lives in `jawDrop`.
    scaleY: 1,
    rotate: rot,
    opacity: 1,
  }
  const grinHeight = meta.mouth.coreBottom - meta.mouth.coreTop
  const jawDrop = open * JAW_DROP * grinHeight
  // The lower row is drawn slightly smaller as it drops — a jaw hinges behind the face, so the
  // chin travels back as well as down, and in a flat front view recession IS that back-travel.
  const jawScale = 1 - open * JAW_RECEDE

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
    base, backdrop, mouth, jawDrop, jawScale, eyes,
    viseme: visemes ? pickViseme(open, s.mouthPucker, visemes) : null,
    glow: 0.78 + open * 0.55 + wide * 0.12,
  }
}
