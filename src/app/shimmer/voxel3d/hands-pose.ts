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
/** ★ THE REACH (Alex, 09-17: "for mining it should extend the fingers forward as if reaching for
 *  it"). A bare hand does not chop a block; it reaches for it, fingers open, and grasps in a rhythm.
 *  How far forward the hand goes (camera units), and how far the grasp pulse adds on top. The chop
 *  stays for a TOOL in the fist — a blade needs its swing. */
export const REACH = 0.16
export const REACH_PULSE = 0.05
/** Holding a hotbar item: the palm turns UP (a roll about the fingers) and the thing floats over it. */
export const PRESENT_ROLL = Math.PI
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
/** On a wall the raise fights the drop; this much more takes the hands clean out of frame. */
export const WALL_DROP_EXTRA = 0.45

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
  /** A gathering focus is in the fist (the host names a family while a block is worked). With a
   *  tool the break is a CHOP; bare-handed it is a REACH. */
  tool: boolean
  /** `now` when the last block was placed; -Infinity for never. */
  placeAt: number
  /** `now` when the last cast landed; -Infinity for never. */
  castAt: number
  /** UI owns the screen, or the weapon is out — the hands leave the frame. */
  hidden: boolean
  /** ── the body's verbs, straight off `LocoState` (2026-09-16, Alex: "animations? climbing,
   *  grabbing a ledge, holding an item, anything else that comes up") ── */
  airborne: boolean
  sliding: boolean
  crouching: boolean
  /** Wall climb in progress — the alternating reach. */
  climbing: boolean
  /** Pinned on a wall in the catch beat — one hand flat on it. */
  wallCatch: boolean
  /** Hanging from a ledge — both hands on the lip. */
  hanging: boolean
  /** Mantle progress 0..1 while pulling up over a ledge; -1 when not. Hands press the lip down. */
  mantle: number
  swimming: boolean
  /** `now` of the last landing and how hard (blocks/s downward). The hand dips with the knees. */
  landAt: number
  landVy: number
  /** Something is in the fist (a block or a piece): the hand carries it a little raised. */
  holding: boolean
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
  /** Extra drop on a wall (climb / hang / mantle / catch), over `lower`. */
  wallDrop: number
  /** Eased weights, one per verb, so a pose BLENDS in and out instead of snapping. */
  w: { air: number; slide: number; crouch: number; climb: number; wallCatch: number; hang: number; swim: number; hold: number; reach: number }
  /** The climb's and the stroke's own clocks. */
  climbPh: number
  swimPh: number
}

export const newHandsState = (): HandsState => ({
  lower: 0, swing: 0, swingOn: 0, stride: 0, speed: 0, ground: 1, wallDrop: 0,
  w: { air: 0, slide: 0, crouch: 0, climb: 0, wallCatch: 0, hang: 0, swim: 0, hold: 0, reach: 0 },
  climbPh: 0, swimPh: 0,
})

/** How fast a verb's pose blends in (per second). A grab is quick; a swim stroke settles. */
export const BLEND_RATE = 10
/** Reaches per second on a wall climb, and strokes per second in the water. */
export const CLIMB_HZ = 1.6
export const SWIM_HZ = 0.8
/** A landing: the dip's length and how deep a hard one goes. */
export const LAND_MS = 260
export const LAND_DIP = 0.07
export const LAND_HARD_VY = 12

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
  /** Right hand roll about its own fingers, radians. π = palm up, presenting. */
  roll: number
  /** 0..1, how OPEN the right hand is (the rig shows the open glove past 0.5, the fist under). */
  open: number
  /** 0..1, the left wrist's rise into frame. */
  left: number
  /** The left arm's own offset and pitch on top of its rise — a grip, a stroke, a press. */
  leftDy: number
  leftPitch: number
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * Math.min(1, rate * dt)

/** One frame of the clock. Mutates `s`, returns the pose to apply. */
export function stepHands(s: HandsState, i: HandsInput, dt: number): HandsPose {
  // ── lowered? ── The UI owning the screen, the weapon out — and THE WALL (Alex, 09-16, on the
  // climb pose: "the hand looks like climbing sticks when scaling a wall, that's not going to
  // work"). A stick reaching hand-over-hand is a ski pole; a placeholder rig cannot sell a grip,
  // and on a wall you are looking at the wall. So climb, hang, mantle and the catch take the
  // hands out of frame, and they come back when the feet land. The wall poses below still
  // compute (they are tested, and a real hand mesh will want them) but ride under the drop.
  const onWall = i.climbing || i.hanging || i.mantle >= 0 || i.wallCatch
  s.lower = approach(s.lower, i.hidden || onWall ? 1 : 0, LOWER_RATE, dt)
  // The wall poses RAISE the hands by up to 0.28 while the drop sinks them 0.55 — not enough on its
  // own. The wall gets its own extra drop, eased on the same clock, so the raise never peeks back in.
  s.wallDrop = approach(s.wallDrop, onWall ? 1 : 0, LOWER_RATE, dt)

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

  // ── the chop (a tool in the fist) / the reach (a bare hand) — one clock, two shapes ──
  const chopping = i.breaking && i.tool
  s.swingOn = approach(s.swingOn, chopping ? 1 : 0, 10, dt)
  if (i.breaking) s.swing = (s.swing + SWING_HZ * dt) % 1
  else if (s.swing > 0) { s.swing = s.swing + SWING_HZ * dt; if (s.swing >= 1) s.swing = 0 }  // finish the arc, then rest
  // A chop is fast down, slower back: sin over the first 40%, ease over the rest.
  const chop = s.swing < 0.4 ? Math.sin((s.swing / 0.4) * Math.PI / 2) : Math.cos(((s.swing - 0.4) / 0.6) * Math.PI / 2)
  let pitch = -chop * SWING_RAD * Math.max(s.swingOn, s.swing > 0 && s.swingOn > 0 ? 1 : 0)

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

  // ── the body's verbs, blended ──────────────────────────────────────────────────────────────
  // Each verb has an eased weight; the pose is the rest pose plus each verb's offset times its
  // weight. So a hang that ends in a mantle CROSSFADES from "hands on the lip" to "hands pressing
  // it down" instead of cutting, and a slide into a jump lets go of the brace over a tenth of a
  // second rather than on one frame. Priority is by exclusion at the INPUT, not by order here:
  // hanging outranks airborne (you are in the air, but your hands are on the lip).
  const w = s.w
  const hangOn = i.hanging || i.mantle >= 0
  const target = {
    hang: hangOn ? 1 : 0,
    climb: !hangOn && i.climbing ? 1 : 0,
    wallCatch: !hangOn && !i.climbing && i.wallCatch ? 1 : 0,
    swim: i.swimming ? 1 : 0,
    air: !hangOn && !i.climbing && !i.wallCatch && !i.swimming && i.airborne ? 1 : 0,
    slide: i.sliding ? 1 : 0,
    crouch: !i.sliding && i.crouching ? 1 : 0,
    // a bare-handed break REACHES; a held thing gives way to the reach (you cannot present and grab)
    reach: i.breaking && !i.tool ? 1 : 0,
    hold: i.holding && !i.breaking ? 1 : 0,
  }
  for (const k of Object.keys(target) as (keyof typeof target)[]) w[k] = approach(w[k], target[k], BLEND_RATE, dt)
  let leftDy = 0, leftPitch = 0

  // airborne: the hand drifts up and open — floaty, nothing to brace against
  dy += w.air * 0.02; pitch += w.air * 0.12
  // landing: a dip with the knees, deeper the harder you came down
  const lu = (i.now - i.landAt) / LAND_MS
  if (lu >= 0 && lu < 1) dy -= Math.sin(lu * Math.PI) * LAND_DIP * clamp01(i.landVy / LAND_HARD_VY)
  // slide: braced low and out to the side; crouch: just low
  dy -= w.slide * 0.06; dx += w.slide * 0.05; pitch -= w.slide * 0.25
  dy -= w.crouch * 0.035
  // wall catch: one hand flat on the wall in front, the other coming up to it
  pitch += w.wallCatch * 0.95; dz -= w.wallCatch * 0.14; dy += w.wallCatch * 0.16
  left = Math.max(left, w.wallCatch); leftPitch += w.wallCatch * 0.7
  // wall climb: the alternating reach — one hand up while the other pulls
  if (target.climb) s.climbPh += CLIMB_HZ * dt
  const cph = Math.sin(s.climbPh * Math.PI * 2)
  pitch += w.climb * (0.9 + 0.35 * cph); dy += w.climb * (0.14 + 0.09 * cph); dz -= w.climb * 0.1
  left = Math.max(left, w.climb); leftDy += w.climb * 0.09 * -cph; leftPitch += w.climb * (0.8 - 0.3 * cph)
  // hang: both hands on the lip, high and close to centre; mantle: pressing the lip down and past
  const mp = i.mantle >= 0 ? clamp01(i.mantle) : 0
  const press = Math.sin(mp * Math.PI)         // rises then settles as the body comes over
  pitch += w.hang * (1.2 - 0.9 * mp); dy += w.hang * (0.28 - 0.30 * mp - 0.05 * press); dx -= w.hang * 0.12
  left = Math.max(left, w.hang); leftDy += w.hang * (0.12 - 0.30 * mp); leftPitch += w.hang * (1.0 - 0.8 * mp)
  // swim: a slow alternating stroke, both arms
  if (target.swim) s.swimPh += SWIM_HZ * dt
  const sph = Math.sin(s.swimPh * Math.PI * 2)
  pitch += w.swim * (0.45 + 0.5 * sph); dz -= w.swim * (0.08 + 0.06 * sph); dy += w.swim * 0.06
  left = Math.max(left, w.swim); leftDy += w.swim * 0.08 * -sph; leftPitch += w.swim * (0.45 - 0.5 * sph)
  // the reach: fingers forward toward the block at the crosshair — in, up, and OUT — with a grasp
  // that closes and opens on the swing clock (the pulse is what says "working", not a chop)
  const grasp = 0.5 - 0.5 * Math.cos(s.swing * Math.PI * 2)
  dz -= w.reach * (REACH + REACH_PULSE * grasp); dx -= w.reach * 0.10; dy += w.reach * 0.06; pitch += w.reach * 0.10
  // holding: the palm turns up and the hand lifts a touch toward centre so the thing over it is seen
  const roll = w.hold * PRESENT_ROLL
  // ⚠ after the π roll the pitch axis is reversed: a NEGATIVE pitch here tips the fingers forward,
  // a waiter's tray, so the thing sits ABOVE the palm rather than in front of a raised hand
  pitch -= w.hold * 0.35; dy += w.hold * 0.05; dx -= w.hold * 0.04
  // how open the hand is: a reach, a presented palm, a cast's aim, any hand on a wall
  const open = Math.max(w.reach, w.hold, left, w.wallCatch, w.climb, w.hang)

  dy -= s.lower * LOWER_Y + s.wallDrop * WALL_DROP_EXTRA
  leftDy -= s.wallDrop * WALL_DROP_EXTRA
  return { dx, dy, dz, pitch, roll, open, left, leftDy, leftPitch }
}
