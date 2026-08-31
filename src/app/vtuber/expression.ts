/**
 * WHAT A FACE IS, ONCE NOTHING KNOWS WHERE IT CAME FROM.
 *
 * ★★★ THIS STRUCT IS THE WHOLE ARCHITECTURE. A webcam, a microphone with no camera at
 * all, and (later) an iPhone's ARKit feed are three completely different instruments
 * that answer ONE question: what is this face doing right now. If the renderer is
 * allowed to ask the tracker directly, then every new input source has to re-implement
 * the rig, and the day the camera is off the avatar is dead rather than degraded.
 * So every source produces an `ExpressionState` and the rig accepts nothing else.
 *
 * ⚠ AND THE UNITS ARE NORMALISED ON PURPOSE. MediaPipe blendshapes, mic amplitude and
 * ARKit coefficients share no scale whatsoever. Normalising at the SOURCE boundary is
 * what stops a raw vendor number leaking into the rig, where it would silently become
 * a magic constant nobody can re-derive. Same reasoning as PATTERNS' repeated finding
 * that two readings taken at different layers cannot be compared however careful each
 * one was: pick the layer once, convert at the door.
 */

export type FaceSource = 'face' | 'audio' | 'idle'

export interface ExpressionState {
  /** 0 = shut, 1 = as open as this person's jaw goes. Never a raw blendshape. */
  mouthOpen: number
  /** 0 = neutral, 1 = full grin. Drives the crescent's width, not its height. */
  mouthWide: number
  /**
   * 0 = neutral, 1 = fully pursed. Its own channel because a pucker is NOT a point on the
   * open/shut ramp — "oh" is narrow AND open, so a single openness dial can never reach it.
   */
  mouthPucker: number
  /** 1 = open, 0 = closed. Two channels so a wink survives the trip. */
  eyeOpenL: number
  eyeOpenR: number
  /** 0 = neutral, 1 = raised. */
  browRaise: number
  /** All three in -1..1. Yaw positive = subject's own left. */
  yaw: number
  pitch: number
  roll: number
  source: FaceSource
  /** performance.now() of the sample this came from. */
  at: number
}

export const NEUTRAL: ExpressionState = {
  mouthOpen: 0, mouthWide: 0, mouthPucker: 0,
  eyeOpenL: 1, eyeOpenR: 1,
  browRaise: 0,
  yaw: 0, pitch: 0, roll: 0,
  source: 'idle', at: 0,
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const clamp11 = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v)

/**
 * ── CALIBRATION, AND WHY IT IS NOT OPTIONAL ──────────────────────────────────────
 *
 * ★★ A RAW BLENDSHAPE FED STRAIGHT TO A DISPLAY LOOKS BROKEN, AND THE ART GETS BLAMED.
 * `jawOpen` does not read 0 on a resting face — it idles around 0.05-0.15 depending on
 * the person and the camera — and during ordinary speech it rarely passes 0.4. Map that
 * range 1:1 onto a mouth and you get a mouth that is slightly open at rest and never
 * more than half open while talking. It reads as a dead rig, and the instinct is to go
 * redraw the mouth, which fixes nothing.
 *
 * So each channel carries a REST point (measured from this face, in this light) and a
 * SPAN (how far above rest counts as fully on). Rest is measured; span is a tuned
 * default the user can trim with one gain dial.
 */
export interface Channel { rest: number; span: number }

export const DEFAULT_CHANNELS = {
  // Spans are what a normal speaking face actually reaches, not the 0..1 the API offers.
  jawOpen:   { rest: 0.05, span: 0.38 },
  mouthWide: { rest: 0.10, span: 0.55 },
  mouthPucker: { rest: 0.05, span: 0.40 },
  blink:     { rest: 0.06, span: 0.45 },
  browRaise: { rest: 0.08, span: 0.42 },
} satisfies Record<string, Channel>

/** Raw vendor value -> 0..1 against this face's own rest point. */
export function normalise(raw: number, c: Channel, gain = 1): number {
  if (c.span <= 0) return 0
  return clamp01(((raw - c.rest) / c.span) * gain)
}

/**
 * ── SMOOTHING IS ASYMMETRIC, AND THAT IS THE ENTIRE DIFFERENCE BETWEEN ALIVE AND MUSHY ──
 *
 * ★★ A mouth must OPEN faster than it CLOSES. Consonants are transients; if the attack
 * is slowed to match the release the avatar lags behind the voice and reads as dubbed.
 * If the release is sped up to match the attack it chatters on every syllable gap and
 * reads as a machine. Symmetric smoothing cannot be tuned to avoid both — there is no
 * single value that is fast enough for the onset and slow enough for the tail, which is
 * why one dial always feels wrong somewhere.
 *
 * ⚠ EYES ARE NOT MOUTHS. A blink is ~100ms end to end; the mouth's release constant
 * applied to an eyelid turns every blink into a slow sleepy droop. Separate constants,
 * deliberately.
 */
export interface Smoothing { attack: number; release: number }

export const MOUTH_SMOOTH: Smoothing = { attack: 0.55, release: 0.20 }
export const EYE_SMOOTH:   Smoothing = { attack: 0.90, release: 0.55 }
export const POSE_SMOOTH:  Smoothing = { attack: 0.18, release: 0.18 }

/** One step of the asymmetric filter. `cur` toward `target`. */
export function approach(cur: number, target: number, s: Smoothing): number {
  const k = target > cur ? s.attack : s.release
  return cur + (target - cur) * k
}

/** Apply the right filter to every channel of a state. Pure; the caller owns `prev`. */
export function smooth(prev: ExpressionState, next: ExpressionState): ExpressionState {
  return {
    mouthOpen: approach(prev.mouthOpen, next.mouthOpen, MOUTH_SMOOTH),
    mouthWide: approach(prev.mouthWide, next.mouthWide, MOUTH_SMOOTH),
    mouthPucker: approach(prev.mouthPucker, next.mouthPucker, MOUTH_SMOOTH),
    eyeOpenL:  approach(prev.eyeOpenL,  next.eyeOpenL,  EYE_SMOOTH),
    eyeOpenR:  approach(prev.eyeOpenR,  next.eyeOpenR,  EYE_SMOOTH),
    browRaise: approach(prev.browRaise, next.browRaise, MOUTH_SMOOTH),
    yaw:       approach(prev.yaw,   next.yaw,   POSE_SMOOTH),
    pitch:     approach(prev.pitch, next.pitch, POSE_SMOOTH),
    roll:      approach(prev.roll,  next.roll,  POSE_SMOOTH),
    source: next.source,
    at: next.at,
  }
}
