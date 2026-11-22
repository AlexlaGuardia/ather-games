// ── THE OPEN WORLD'S FIRST-PERSON HANDS, POSED (Alex 11-17) ─────────────────────────────────────────────────────────────
// Alex, after the ported voxel rig still jittered on a run (and then, correcting v2: "the cuffs should be pointed away from
// each other and then as the player runs they alternate moving out of view towards the bottom of the screen"): "what if we try having both hands just barely showing at the
// bottom of the screen alternating as the player runs then if the player jumps both hands go in the air with the right a
// little higher". This is that, as a pure function of the WALKER's own state (speed, airborne), never of the camera's
// travel, so a slope or an uneven frame cannot shake it. Every output is eased, so nothing snaps.
//
// Camera space: x right, y up, z toward the viewer (the hands sit at negative z). At fov 75 and z = -0.55 the bottom of
// the frame is y ≈ -0.42. At rest both gloves sit just above it, ROLLED so each cuff points outward (right cuff to the
// right, left to the left) and the knuckles point in; on a run they take turns dropping below the edge, out of view.
//
// Run: npx tsx src/app/shimmer/open/shared/fp-hands-pose.test.ts

/** q = the hand's ORIENTATION as a quaternion [x, y, z, w], what the rig applies (11-21). pitch / roll stay as the readable
 *  angles (= q whenever no Hold blend is running); the rig never reads them, because blending two angle pairs component by
 *  component tumbles the glove (Alex 11-21: "the rotation from idle to HOLD looks unnatural": pitch -1.4 -> 1.89 and roll
 *  0.63 -> -3.05 at once swung it through more than half a turn). Orientations blend by slerp on the shortest arc instead. */
export type Quat = [number, number, number, number]
export interface HandPose { x: number; y: number; z: number; pitch: number; roll: number; q: Quat }
/** = three.js Euler(x, y, z, 'XYZ') -> quaternion: what `rotation.set(pitch, 0, roll)` meant */
export function eulerQ(x: number, y: number, z: number): Quat {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2)
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3]
}
/** spherical blend a -> b by t. `side` picks the way round: omitted = the SHORTEST arc (b flipped when the two sit on opposite
 *  hemispheres); +1 / -1 = b taken as given / negated, so a near-half-turn blend cannot change direction from frame to frame. */
export function slerpQ(a: Quat, b: Quat, t: number, side?: 1 | -1): Quat {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], bb = b
  if (side ? side < 0 : d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]] }
  if (d > 0.9995 || d < -0.9995) { const r: Quat = [a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]; const n = Math.hypot(...r); return [r[0] / n, r[1] / n, r[2] / n, r[3] / n] }
  const th = Math.acos(Math.max(-1, Math.min(1, d))), sn = Math.sin(th), wa = Math.sin((1 - t) * th) / sn, wb = Math.sin(t * th) / sn
  return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb]
}
/** the angle (radians) between two orientations */
export const angleQ = (a: Quat, b: Quat) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])))
const smooth = (t: number) => t * t * (3 - 2 * t)
/** which way round the Hold turn goes, fixed from the tuned rest + hold attitudes (their arc is ~178 deg, so the run / jump / cast
 *  offsets could otherwise tip the "shortest" side mid-blend and swing the glove the other way). Read per step: Alex tunes live. */
const holdSide = (): 1 | -1 => { const a = eulerQ(FP.PITCH, 0, FP.ROLL), b = eulerQ(FP.HOLD_PITCH, FP.HOLD_YAW, FP.HOLD_ROLL); return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1 }
/** the right mitt's attitude `w` (0..1, already eased) of the way into the Hold, from the angles it would have at rest (run /
 *  jump / cast / chop offsets included): rest attitude slerped toward the same offsets on the Hold numbers, the fixed way round.
 *  HOLD_YAW (Alex 11-21: the twist the Hold lacked) is the hold attitude's Y angle, composed in the same XYZ order
 *  (q = qx(pitch) * qy(yaw) * qz(roll)); the rest attitude has none, so yaw 0 = the pose before the twist existed. */
export function holdTurn(pitch: number, roll: number, w: number): Quat {
  const a = eulerQ(pitch, 0, roll)
  return w > 0 ? slerpQ(a, eulerQ(pitch + (FP.HOLD_PITCH - FP.PITCH), FP.HOLD_YAW, roll + (FP.HOLD_ROLL - FP.ROLL)), w, holdSide()) : a
}
export interface FpInput {
  now: number          // ms, the clock castAt / workAt are stamped on
  speed: number        // horizontal metres/second, from the walker
  airborne: boolean
  hidden: boolean      // a panel owns the screen, or the gun is out (it draws its own)
  castAt: number       // ms of the last paid cast; -Infinity for never
  working: boolean     // a node is being worked (prune / prospect): the right hand chops
  holding?: boolean    // M45: a hotbar item is out (the item stance): the right mitt turns to present it
  holdW?: number       // dev only (/shimmer/dev/hands ?hold=): pins the Hold weight 0..1, to look at a frame mid-turn
  /** M82: an authored action (fp-actions.ts) drives the RIGHT mitt: its sampled pose, weighted w 0..1 over everything else */
  actionR?: { x: number; y: number; z: number; pitch: number; roll: number; q: Quat; w: number }
}
export interface FpState { phase: number; run: number; air: number; low: number; wasAir: boolean; landAt: number; chop: number; hold: number; R: HandPose; L: HandPose }

/** The tunable numbers (the /shimmer/dev/hands tuner writes these; the defaults are what ships). Metres / radians. */
export interface FpTune {
  X: number; REST_Y: number; Z: number; PITCH: number; ROLL: number; SCALE: number
  DROP_Y: number; SWING_Z: number; STRIDE_M: number
  JUMP_Y_R: number; JUMP_Y_L: number; JUMP_SPREAD: number; JUMP_PITCH: number
  CAST_X: number; CAST_Y: number; CAST_PITCH: number
  HOLD_X: number; HOLD_Y: number; HOLD_Z: number; HOLD_PITCH: number; HOLD_ROLL: number; HOLD_YAW: number
  ITEM_UP: number; ITEM_FWD: number; ITEM_SIZE: number; ITEM_TILT: number; ITEM_SPIN: number; ITEM_BOB: number
}
// ★ ALEX'S TUNE (11-17, from /shimmer/dev/hands "Copy values"): these ARE the shipped hands. Change them in the tuner, not here.
export const FP_DEFAULTS: Readonly<FpTune> = {
  // Alex 11-19 (/shimmer/dev/hands): wider apart, lower, less tilt, the cuffs turned in a little, bigger
  X: 0.355, REST_Y: -0.415, Z: -0.56,    // rest: apart, height, distance
  PITCH: -1.4,             // rest tilt
  ROLL: 0.63,              // the cuffs turned outward (a hand's cuff hangs at -y; +roll swings it toward +x)
  SCALE: 2,
  DROP_Y: 0.4,             // how far a hand drops on its step at a full run: clean out of view below the frame
  SWING_Z: 0.005,          // the hand that stays up comes a touch forward
  STRIDE_M: 5,             // metres per full stride (two steps): each hand drops once per stride
  JUMP_Y_R: 0.355, JUMP_Y_L: 0.17, JUMP_SPREAD: 0.13, JUMP_PITCH: 0.24,
  CAST_X: 0.365, CAST_Y: -0.11, CAST_PITCH: 0.84,
  // M45 (Alex 11-20: the voxel world's presented palm, "we want the mitt to turn" — tuned in /shimmer/dev/hands, Hold):
  // the right mitt's pose while a hotbar item is out (absolute, like rest), and the item floating over it (held-item.tsx)
  // Alex 11-21 pm: the hold re-tuned from a natural base with the twist axis, so the glove is no longer flipped
  HOLD_X: 0.335, HOLD_Y: -0.415, HOLD_Z: -0.635, HOLD_PITCH: -1.3616, HOLD_ROLL: 0.4184,
  HOLD_YAW: 2.6984,        // the twist about the glove's Y (11-21)
  ITEM_UP: 0.195,         // metres above the mitt, in camera space (up the screen)
  ITEM_FWD: 0,             // metres toward (+) / away (-) from the eye
  ITEM_SIZE: 0.63,            // x the mini's own size
  ITEM_TILT: 0.35,         // tipped toward the eye so its top reads
  ITEM_SPIN: 0.25,          // radians a second about screen-up (the voxel rig's turn)
  ITEM_BOB: 0.016,         // metres of slow bob
}
/** LIVE numbers: the defaults, overwritten by this browser's tune (loadFpTune). Read every frame, so a slider moves the hands. */
export const FP = {
  ...FP_DEFAULTS,
  RUN_SPEED: 6.5,        // full alternation here (shared/locomotion RUN_SPEED)
  LAND_MS: 260, LAND_DIP: 0.05,
  CAST_MS: 640,
  CHOP_HZ: 2.2, CHOP_PITCH: 0.6,
  HIDE_Y: 0.6,
  EASE: 16,              // per second, every output
}
/** This browser's tune (a DEVICE key, like the keymap: never synced). */
export const FP_TUNE_KEY = 'open:hands-tune.v1'
export const FP_TUNE_KEYS = Object.keys(FP_DEFAULTS) as (keyof FpTune)[]
export function loadFpTune(): void {
  try {
    const t = JSON.parse(localStorage.getItem(FP_TUNE_KEY) ?? 'null') as Partial<FpTune> | null
    for (const k of FP_TUNE_KEYS) FP[k] = typeof t?.[k] === 'number' && Number.isFinite(t[k]) ? t[k]! : FP_DEFAULTS[k]
  } catch { /* private window: the defaults */ }
}
export function setFpTune(patch: Partial<FpTune>): void {
  for (const k of FP_TUNE_KEYS) if (typeof patch[k] === 'number') FP[k] = patch[k]!
  try { localStorage.setItem(FP_TUNE_KEY, JSON.stringify(Object.fromEntries(FP_TUNE_KEYS.map(k => [k, FP[k]])))) } catch { /* private window */ }
}
export function resetFpTune(): void { try { localStorage.removeItem(FP_TUNE_KEY) } catch { /* */ } for (const k of FP_TUNE_KEYS) FP[k] = FP_DEFAULTS[k] }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const approach = (cur: number, to: number, rate: number, dt: number) => cur + (to - cur) * (1 - Math.exp(-rate * dt))
const rest = (side: 1 | -1): HandPose => ({ x: side * FP.X, y: FP.REST_Y, z: FP.Z, pitch: FP.PITCH, roll: side * FP.ROLL, q: eulerQ(FP.PITCH, 0, side * FP.ROLL) })
export const newFpState = (): FpState => ({ phase: 0, run: 0, air: 0, low: 0, wasAir: false, landAt: -Infinity, chop: 0, hold: 0, R: rest(1), L: rest(-1) })
/** How far the right mitt has turned to present (0..1), written each step by the rig; the held item grows in with it. */
export const fpLive = { hold: 0 }

/** Advance the state by dt seconds and return the two hands (R = right/glove, L = left/bracelet). */
export function stepFpHands(s: FpState, i: FpInput, dt: number): { R: HandPose; L: HandPose } {
  // the stride: driven by DISTANCE, so it stops with the feet; no footfalls in the air
  if (!i.airborne) s.phase += (i.speed / FP.STRIDE_M) * dt * Math.PI * 2
  s.run = approach(s.run, i.airborne ? 0 : clamp01(i.speed / FP.RUN_SPEED), 8, dt)
  s.air = approach(s.air, i.airborne ? 1 : 0, 10, dt)
  s.low = approach(s.low, i.hidden ? 1 : 0, 8, dt)
  if (s.wasAir && !i.airborne) s.landAt = i.now
  s.wasAir = i.airborne
  if (i.working) s.chop += FP.CHOP_HZ * dt; else s.chop = 0
  s.hold = i.holdW !== undefined ? clamp01(i.holdW) : approach(s.hold, i.holding ? 1 : 0, 9, dt)

  const sw = Math.sin(s.phase)
  // alternating: the right hand rises while the left sinks, then the other way; up also means a little forward
  // a full sine each, opposite: one drops out of view exactly as the other comes back (no kink at a half-wave)
  const hold = s.hold
  // holding: the right hand mostly stays up on a run (the thing in it stays in view); the left still swings
  const downR = (1 - sw) / 2 * s.run * (1 - 0.75 * hold), downL = (1 + sw) / 2 * s.run
  const landU = (i.now - s.landAt) / FP.LAND_MS
  const dip = landU >= 0 && landU < 1 ? -Math.sin(landU * Math.PI) * FP.LAND_DIP : 0
  const castU = (i.now - i.castAt) / FP.CAST_MS
  const cast = castU >= 0 && castU < 1 ? (castU < 0.25 ? Math.sin((castU / 0.25) * Math.PI / 2) : castU < 0.5 ? 1 : Math.cos(((castU - 0.5) / 0.5) * Math.PI / 2)) : 0
  const chop = i.working ? Math.abs(Math.sin(s.chop * Math.PI)) : 0
  const hide = -s.low * FP.HIDE_Y

  const tR: Omit<HandPose, 'q'> = {
    x: FP.X + s.air * FP.JUMP_SPREAD + cast * (FP.CAST_X - FP.X),
    y: FP.REST_Y - downR * FP.DROP_Y + s.air * FP.JUMP_Y_R + dip + cast * (FP.CAST_Y - FP.REST_Y) * (1 - s.air) + chop * 0.08 + hide,
    z: FP.Z - (1 - downR) * s.run * FP.SWING_Z,
    pitch: FP.PITCH + s.air * FP.JUMP_PITCH + cast * FP.CAST_PITCH - chop * FP.CHOP_PITCH,
    roll: FP.ROLL - s.air * 0.35 - cast * 0.8,   // a jump or a cast turns the glove upright toward the aim
  }
  // presenting: the rest numbers give way to the Hold numbers (run / jump / cast / chop stay on top). The weight is EASED
  // (smoothstep: no lurch at the start or the end); the position lerps, the ORIENTATION slerps from the rest attitude to the
  // hold attitude on the shortest arc, so the glove turns the short way round instead of tumbling (11-21).
  const h = smooth(hold), qR = holdTurn(tR.pitch, tR.roll, h)
  if (h > 0) {
    tR.x += h * (FP.HOLD_X - FP.X); tR.y += h * (FP.HOLD_Y - FP.REST_Y); tR.z += h * (FP.HOLD_Z - FP.Z)
    tR.pitch += h * (FP.HOLD_PITCH - FP.PITCH); tR.roll += h * (FP.HOLD_ROLL - FP.ROLL)   // readable angles only: the rig applies qR
  }
  // M82: an action takes the right mitt over (position lerps, orientation slerps), weighted so it can ease in and out
  const aw = i.actionR ? clamp01(i.actionR.w) : 0
  let qA = qR
  if (aw > 0 && i.actionR) {
    const A = i.actionR
    for (const k of ['x', 'y', 'z', 'pitch', 'roll'] as const) tR[k] += aw * (A[k] - tR[k])
    qA = slerpQ(qR, A.q, aw)
  }
  const tL: Omit<HandPose, 'q'> = {
    x: -FP.X - s.air * FP.JUMP_SPREAD,
    y: FP.REST_Y - downL * FP.DROP_Y + s.air * FP.JUMP_Y_L + dip + hide,
    z: FP.Z - (1 - downL) * s.run * FP.SWING_Z,
    pitch: FP.PITCH + s.air * FP.JUMP_PITCH,
    roll: -FP.ROLL + s.air * 0.35,
  }
  for (const k of ['x', 'y', 'z', 'pitch', 'roll'] as const) {
    s.R[k] = approach(s.R[k], tR[k], FP.EASE, dt)
    s.L[k] = approach(s.L[k], tL[k], FP.EASE, dt)
  }
  const e = 1 - Math.exp(-FP.EASE * dt)   // the same ease as every other output, on the sphere
  s.R.q = slerpQ(s.R.q, qA, e); s.L.q = slerpQ(s.L.q, eulerQ(tL.pitch, 0, tL.roll), e)
  return { R: s.R, L: s.L }
}
