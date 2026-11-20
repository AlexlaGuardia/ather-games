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

export interface HandPose { x: number; y: number; z: number; pitch: number; roll: number }
export interface FpInput {
  now: number          // ms, the clock castAt / workAt are stamped on
  speed: number        // horizontal metres/second, from the walker
  airborne: boolean
  hidden: boolean      // a panel owns the screen, or the gun is out (it draws its own)
  castAt: number       // ms of the last paid cast; -Infinity for never
  working: boolean     // a node is being worked (prune / prospect): the right hand chops
  holding?: boolean    // M45: a hotbar item is out (the item stance): the right mitt turns to present it
}
export interface FpState { phase: number; run: number; air: number; low: number; wasAir: boolean; landAt: number; chop: number; hold: number; R: HandPose; L: HandPose }

/** The tunable numbers (the /shimmer/dev/hands tuner writes these; the defaults are what ships). Metres / radians. */
export interface FpTune {
  X: number; REST_Y: number; Z: number; PITCH: number; ROLL: number; SCALE: number
  DROP_Y: number; SWING_Z: number; STRIDE_M: number
  JUMP_Y_R: number; JUMP_Y_L: number; JUMP_SPREAD: number; JUMP_PITCH: number
  CAST_X: number; CAST_Y: number; CAST_PITCH: number
  HOLD_X: number; HOLD_Y: number; HOLD_Z: number; HOLD_PITCH: number; HOLD_ROLL: number
  ITEM_UP: number; ITEM_FWD: number; ITEM_SIZE: number; ITEM_TILT: number; ITEM_SPIN: number; ITEM_BOB: number
}
// ★ ALEX'S TUNE (11-17, from /shimmer/dev/hands "Copy values"): these ARE the shipped hands. Change them in the tuner, not here.
export const FP_DEFAULTS: Readonly<FpTune> = {
  // Alex 11-19 (/shimmer/dev/hands): wider apart, lower, less tilt, the cuffs turned in a little, bigger
  X: 0.355, REST_Y: -0.415, Z: -0.56,    // rest: apart, height, distance
  PITCH: -1.4,             // rest tilt
  ROLL: 0.63,              // the cuffs turned outward (a hand's cuff hangs at -y; +roll swings it toward +x)
  SCALE: 1.54,
  DROP_Y: 0.4,             // how far a hand drops on its step at a full run: clean out of view below the frame
  SWING_Z: 0.005,          // the hand that stays up comes a touch forward
  STRIDE_M: 5,             // metres per full stride (two steps): each hand drops once per stride
  JUMP_Y_R: 0.355, JUMP_Y_L: 0.17, JUMP_SPREAD: 0.13, JUMP_PITCH: 0.24,
  CAST_X: 0.345, CAST_Y: -0.12, CAST_PITCH: 0.68,
  // M45 (Alex 11-20: the voxel world's presented palm, "we want the mitt to turn" — tuned in /shimmer/dev/hands, Hold):
  // the right mitt's pose while a hotbar item is out (absolute, like rest), and the item floating over it (held-item.tsx)
  HOLD_X: 0.25, HOLD_Y: -0.33, HOLD_Z: -0.56, HOLD_PITCH: -1.4, HOLD_ROLL: 0.63,
  ITEM_UP: 0.075,          // metres above the mitt, in camera space (up the screen)
  ITEM_FWD: 0,             // metres toward (+) / away (-) from the eye
  ITEM_SIZE: 1,            // x the mini's own size
  ITEM_TILT: 0.35,         // tipped toward the eye so its top reads
  ITEM_SPIN: 0.9,          // radians a second about screen-up (the voxel rig's turn)
  ITEM_BOB: 0.006,         // metres of slow bob
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
const rest = (side: 1 | -1): HandPose => ({ x: side * FP.X, y: FP.REST_Y, z: FP.Z, pitch: FP.PITCH, roll: side * FP.ROLL })
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
  s.hold = approach(s.hold, i.holding ? 1 : 0, 9, dt)

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

  const tR: HandPose = {
    x: FP.X + s.air * FP.JUMP_SPREAD + cast * (FP.CAST_X - FP.X),
    y: FP.REST_Y - downR * FP.DROP_Y + s.air * FP.JUMP_Y_R + dip + cast * (FP.CAST_Y - FP.REST_Y) * (1 - s.air) + chop * 0.08 + hide,
    z: FP.Z - (1 - downR) * s.run * FP.SWING_Z,
    pitch: FP.PITCH + s.air * FP.JUMP_PITCH + cast * FP.CAST_PITCH - chop * FP.CHOP_PITCH,
    roll: FP.ROLL - s.air * 0.35 - cast * 0.8,   // a jump or a cast turns the glove upright toward the aim
  }
  if (hold > 0) {   // presenting: the rest numbers give way to the Hold numbers (run / jump / cast / chop stay on top)
    tR.x += hold * (FP.HOLD_X - FP.X); tR.y += hold * (FP.HOLD_Y - FP.REST_Y); tR.z += hold * (FP.HOLD_Z - FP.Z)
    tR.pitch += hold * (FP.HOLD_PITCH - FP.PITCH); tR.roll += hold * (FP.HOLD_ROLL - FP.ROLL)
  }
  const tL: HandPose = {
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
  return { R: s.R, L: s.L }
}
