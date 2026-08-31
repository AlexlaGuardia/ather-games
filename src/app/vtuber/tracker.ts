/**
 * A WEBCAM BECOMES AN `ExpressionState`, AND NOTHING DOWNSTREAM LEARNS THAT IT WAS A WEBCAM.
 *
 * ⚠⚠ THE AXIS CONVENTION HERE IS THE ONE THING IN THIS BUILD THAT HAS NOT BEEN SEEN TO WORK.
 * This box has no camera, so every pure part of the pipeline is guarded and measured and this
 * file's head-pose extraction is REASONED. Euler-from-rotation-matrix has a half-dozen equally
 * standard conventions that differ only in sign, and picking wrong yields an avatar that leans
 * the wrong way — which is subtle enough to look like bad tuning rather than a flipped axis.
 * So the signs are exposed as `flip` rather than baked, and the page has a control for them.
 * PATTERNS' rule about a wrong DIRECTION being worse than a wrong magnitude applies exactly.
 */
import {
  type ExpressionState, type Channel,
  DEFAULT_CHANNELS, normalise, clamp11, NEUTRAL,
} from './expression'

export interface TrackerFlip { yaw: 1 | -1; pitch: 1 | -1; roll: 1 | -1 }
export const DEFAULT_FLIP: TrackerFlip = { yaw: 1, pitch: 1, roll: 1 }

/** How far the head must turn to count as "fully turned". Radians. */
const POSE_RANGE = 0.52   // ~30 degrees

type Blend = Record<string, number>

/** MediaPipe hands back a category list; this is the only place that shape is known. */
export function blendMap(categories: { categoryName: string; score: number }[]): Blend {
  const out: Blend = {}
  for (const c of categories) out[c.categoryName] = c.score
  return out
}

/**
 * ★ EULER FROM A COLUMN-MAJOR 4x4. MediaPipe's `facialTransformationMatrixes[0].data` is 16
 * floats, column-major, so element (row r, col c) is `data[c * 4 + r]`. Getting that indexing
 * backwards transposes the rotation, which silently swaps yaw and roll — a failure that still
 * produces plausible-looking motion, which is what makes it expensive.
 */
export function poseFromMatrix(data: number[] | Float32Array, flip: TrackerFlip = DEFAULT_FLIP) {
  const m = (r: number, c: number) => data[c * 4 + r]
  const sy = Math.hypot(m(0, 0), m(1, 0))
  // Gimbal-degenerate when the head is pitched to near-vertical. Falling back keeps the value
  // finite; without this the avatar snaps to a NaN pose and every downstream smooth is poisoned
  // permanently, because NaN propagates through the filter and never recovers.
  const degenerate = sy < 1e-6
  // ⚠⚠ THESE TWO WERE SWAPPED IN THE FIRST DRAFT AND IT LOOKED COMPLETELY FINE. In the standard
  // XYZ decomposition the rotation about Y is the head TURNING (yaw) and the rotation about X is
  // it NODDING (pitch); assigning `atan2(-R20, sy)` to pitch reported a pure 25-degree turn as
  // 25 degrees of nod and zero turn. Measured, not reasoned — see `rig.test.ts`, which drives
  // pure rotations through this function and asserts which channel answers. A swapped axis still
  // produces smooth plausible motion, which is exactly why it survives being looked at.
  const yaw   = Math.atan2(-m(2, 0), sy)
  const pitch = degenerate ? 0 : Math.atan2(m(2, 1), m(2, 2))
  const roll  = degenerate ? Math.atan2(-m(0, 1), m(1, 1)) : Math.atan2(m(1, 0), m(0, 0))
  return {
    yaw:   clamp11((yaw   / POSE_RANGE) * flip.yaw),
    pitch: clamp11((pitch / POSE_RANGE) * flip.pitch),
    roll:  clamp11((roll  / POSE_RANGE) * flip.roll),
  }
}

export interface TrackerTuning {
  channels: Record<keyof typeof DEFAULT_CHANNELS, Channel>
  gain: number
  flip: TrackerFlip
}

export const DEFAULT_TUNING: TrackerTuning = {
  channels: { ...DEFAULT_CHANNELS },
  gain: 1,
  flip: DEFAULT_FLIP,
}

/**
 * Blendshapes + head matrix -> the one struct the rig accepts.
 *
 * ★ `mouthWide` IS A MAX OF THE TWO SMILE SIDES, NOT A MEAN. A mean halves the reading whenever
 * the face is even slightly off-axis to the camera, because the far corner of the mouth is
 * partly occluded and scores low. That reads as a grin that fades whenever the head turns.
 *
 * ★ AND `eyeBlink` IS INVERTED ON THE WAY IN. MediaPipe scores blink as 1 = CLOSED; the rig
 * speaks in openness because a renderer wants to know how much eye to draw. Converting here
 * keeps the inversion in one place instead of at every read site.
 */
export function stateFromBlend(
  b: Blend,
  matrix: number[] | Float32Array | null,
  t: TrackerTuning,
  at: number,
): ExpressionState {
  const c = t.channels
  const pose = matrix ? poseFromMatrix(matrix, t.flip) : { yaw: 0, pitch: 0, roll: 0 }
  const smile = Math.max(b.mouthSmileLeft ?? 0, b.mouthSmileRight ?? 0)
  return {
    mouthOpen: normalise(b.jawOpen ?? 0, c.jawOpen, t.gain),
    mouthWide: normalise(smile, c.mouthWide, t.gain),
    eyeOpenL: 1 - normalise(b.eyeBlinkLeft  ?? 0, c.blink, t.gain),
    eyeOpenR: 1 - normalise(b.eyeBlinkRight ?? 0, c.blink, t.gain),
    browRaise: normalise(
      Math.max(b.browInnerUp ?? 0, b.browOuterUpLeft ?? 0, b.browOuterUpRight ?? 0),
      c.browRaise, t.gain),
    ...pose,
    source: 'face',
    at,
  }
}

/**
 * ── CALIBRATION: MEASURE THIS FACE'S REST, DO NOT ASSUME IT ─────────────────────────────────
 * Accumulates samples of a deliberately neutral face and returns channels whose `rest` is what
 * this person, camera and room actually produce. The defaults are a starting guess; a real rest
 * point differs enough between people that an uncalibrated rig is the single commonest reason a
 * tracker "does not work".
 */
export class Calibrator {
  private samples: Blend[] = []
  add(b: Blend) { this.samples.push(b) }
  get count() { return this.samples.length }
  reset() { this.samples = [] }

  /** Returns null below a usable sample count rather than a confident average of three frames. */
  finish(base = DEFAULT_CHANNELS): TrackerTuning['channels'] | null {
    if (this.samples.length < 20) return null
    const mean = (k: string) =>
      this.samples.reduce((s, b) => s + (b[k] ?? 0), 0) / this.samples.length
    const smile = this.samples.reduce(
      (s, b) => s + Math.max(b.mouthSmileLeft ?? 0, b.mouthSmileRight ?? 0), 0) / this.samples.length
    const brow = this.samples.reduce(
      (s, b) => s + Math.max(b.browInnerUp ?? 0, b.browOuterUpLeft ?? 0, b.browOuterUpRight ?? 0), 0)
      / this.samples.length
    // Span is kept from the defaults: rest is a property of this face, span is a property of how
    // far a face TRAVELS, and twenty frames of a still face contains no information about travel.
    return {
      jawOpen:   { rest: mean('jawOpen'), span: base.jawOpen.span },
      mouthWide: { rest: smile,           span: base.mouthWide.span },
      blink:     { rest: Math.min(mean('eyeBlinkLeft'), mean('eyeBlinkRight')), span: base.blink.span },
      browRaise: { rest: brow,            span: base.browRaise.span },
    }
  }
}

export { NEUTRAL }
