// The keeper's hands — the pose clock. PURE: no three, no DOM, so `hands-pose.test.ts` can drive
// it with numbers and the rig in `hands.ts` only ever reads what this returns.
//
// ★ WHY THE MOTION IS THE PRODUCT. A first-person hand that does not move is a sticker on the
// lens. What makes it a HAND is that it breathes when you stand, bobs when you walk, chops when
// you break, taps when you place, and rises when you cast — and that every one of those is a
// function of what the keeper is DOING, never a canned clip. That is why this file exists apart
// from the geometry: the shape can be replaced (a rendered glove, a Meshy mesh) and every one of
// these motions survives it.
//
// ★ THE GLOVE IS THE HAND (`design-briefs/shimmer-casting-vessels.md`, RULED 2026-09-03): *"the thing
// you raise and aim."* So a cast is the RIGHT hand rising to aim, and the bracelet — *"on you
// whether or not you reached for it"* — rides the LEFT wrist, which comes into frame only for the
// cast and drops out again. Two arms on screen all the time is a shooter; one hand and a wrist
// that answers a cast is a keeper.

import { WALK_SPEED, RUN_SPEED } from './locomotion'

/** Steps per second at a full run; walking scales down with speed so the bob never outruns the feet. */
export const STEP_HZ_RUN = 2.6
/** Bob amplitude at a full run, in camera units (the hand sits ~0.6 from the lens, so 2 cm reads). */
export const BOB_Y = 0.022
export const BOB_X = 0.012
/** Breathing, standing still: a slow small rise. */
export const BREATH_HZ = 0.22
export const BREATH_Y = 0.004
/** Chops per second while a block is being worked. `tickBreak` has no cadence of its own — a
 *  swing is a continuous drain — so this is the hand's rhythm, and the chips key off progress. */
export const SWING_HZ = 2.2
/** How far the chop pitches the arm, radians. Down-and-in, the way a blade or a spike lands. */
export const SWING_RAD = 0.55
/** A placed block: a short forward push, this long. */
export const PLACE_MS = 220
export const PLACE_PUSH = 0.05
/** A cast: the glove rises to aim, the bracelet comes up on the other wrist, both this long. */
export const CAST_MS = 640
export const RAISE_RAD = 0.45
/** How fast the hand drops out of frame (UI open, weapon out) and comes back. Per second. */
export const LOWER_RATE = 6
/** The whole rig sinks this far when lowered — enough to leave the frame at fov 75. */
export const LOWER_Y = 0.55

export interface HandsInput {
  /** Seconds, monotonic. */
  t: number
  /** Milliseconds, same clock the events below were stamped with. */
  now: number
  /** Horizontal speed, blocks/s. */
  speed: number
  /** Vertical speed, blocks/s. Airborne = the feet are not falling in step. */
  vy: number
  /** A block or piece is being worked this frame. */
  breaking: boolean
  /** `now` when the last block was placed; -Infinity for never. */
  placeAt: number
  /** `now` when the last cast landed; -Infinity for never. */
  castAt: number
  /** UI owns the screen, or the weapon is out — the hands leave the frame. */
  hidden: boolean
}

/** Eased state the clock carries between frames. `newHandsState()` makes one. */
export interface HandsState {
  /** 0 = in frame, 1 = fully lowered. Eased, so a menu does not snap the hand away. */
  lower: number
  /** Chop phase in [0,1); advances only while breaking, eases home when the swing stops. */
  swing: number
  /** Eased "a swing is on" so the arm settles instead of stopping mid-chop. */
  swingOn: number
  /** Distance walked, in bob cycles — advances by speed so the bob freezes when the feet do. */
  stride: number
  /** Eased horizontal speed — the raw camera delta is spiky frame to frame. */
  speed: number
  /** Eased 0..1 "the feet are on the ground". */
  ground: number
}

export const newHandsState = (): HandsState => ({ lower: 0, swing: 0, swingOn: 0, stride: 0, speed: 0, ground: 1 })

/** Above this vertical speed the feet have left the ground: no footfalls, the hand floats. */
export const AIRBORNE_VY = 1.5
/** The stride never advances faster than a full run's cadence — a slide is not a sprint of tiny steps. */
export const STRIDE_SPEED_CAP = RUN_SPEED

export interface HandsPose {
  /** Rig offset from its rest position, camera units. */
  dx: number
  dy: number
  dz: number
  /** Right arm pitch, radians. Negative = the chop (down and in). Positive = the raise. */
  pitch: number
  /** 0..1, the left wrist's rise into frame. */
  left: number
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * Math.min(1, rate * dt)

/** One frame of the clock. Mutates `s`, returns the pose to apply. */
export function stepHands(s: HandsState, i: HandsInput, dt: number): HandsPose {
  // ── lowered? ──
  s.lower = approach(s.lower, i.hidden ? 1 : 0, LOWER_RATE, dt)

  // ── the walk bob: driven by DISTANCE, not time, so it stops with the feet and never drifts ──
  // Cycles per block = STEP_HZ_RUN / RUN_SPEED; at a walk the same stride length gives fewer cycles
  // per second, which is what feet do.
  // ⚠ THREE GUARDS, ALL FROM ONE SLIDE-JUMP (Alex, 09-16: "shaking violently"). The raw camera
  // delta is spiky, so the speed is EASED; a slide runs at 10 blocks/s, so the stride rate is CAPPED
  // at the run's cadence; and in the air there are no footfalls at all, so `ground` eases to 0 and
  // takes the bob with it — the hand floats until the feet land.
  s.speed = approach(s.speed, i.speed, 14, dt)
  if (s.speed < 0.02) s.speed = 0   // an ease never reaches zero on its own, and a creeping stride is a hand that never quite stands still
  s.ground = approach(s.ground, Math.abs(i.vy) > AIRBORNE_VY ? 0 : 1, 12, dt)
  const gait = clamp01(s.speed / WALK_SPEED) * s.ground
  s.stride += Math.min(s.speed, STRIDE_SPEED_CAP) * (STEP_HZ_RUN / RUN_SPEED) * dt * s.ground
  const ph = s.stride * Math.PI * 2
  // Amplitude scales with speed past a walk, capped at the run, and only on the ground.
  const amp = clamp01(s.speed / RUN_SPEED) * s.ground
  let dy = -Math.abs(Math.sin(ph)) * BOB_Y * amp        // a footfall is a DIP, twice per cycle
  let dx = Math.sin(ph) * BOB_X * amp                     // and the sway is once per cycle
  // Breathing shows through when the feet are still.
  dy += Math.sin(i.t * Math.PI * 2 * BREATH_HZ) * BREATH_Y * (1 - gait)

  // ── the chop ──
  s.swingOn = approach(s.swingOn, i.breaking ? 1 : 0, 10, dt)
  if (i.breaking) s.swing = (s.swing + SWING_HZ * dt) % 1
  else if (s.swing > 0) { s.swing = s.swing + SWING_HZ * dt; if (s.swing >= 1) s.swing = 0 }  // finish the arc, then rest
  // A chop is fast down, slower back: sin over the first 40%, ease over the rest.
  const chop = s.swing < 0.4 ? Math.sin((s.swing / 0.4) * Math.PI / 2) : Math.cos(((s.swing - 0.4) / 0.6) * Math.PI / 2)
  let pitch = -chop * SWING_RAD * Math.max(s.swingOn, s.swing > 0 ? 1 : 0)

  // ── the place tap ──
  const pu = (i.now - i.placeAt) / PLACE_MS
  let dz = 0
  if (pu >= 0 && pu < 1) dz = -Math.sin(pu * Math.PI) * PLACE_PUSH

  // ── the cast: glove up to aim, bracelet into frame, both back down ──
  const cu = (i.now - i.castAt) / CAST_MS
  let left = 0
  if (cu >= 0 && cu < 1) {
    // fast up (first quarter), hold, ease down (last half)
    const env = cu < 0.25 ? Math.sin((cu / 0.25) * Math.PI / 2) : cu < 0.5 ? 1 : Math.cos(((cu - 0.5) / 0.5) * Math.PI / 2)
    pitch += env * RAISE_RAD
    dy += env * 0.03
    left = env
  }

  dy -= s.lower * LOWER_Y
  return { dx, dy, dz, pitch, left }
}
