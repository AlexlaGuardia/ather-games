// ── THE OPEN WORLD'S FIRST-PERSON HANDS, POSED (Alex 11-17) ─────────────────────────────────────────────────────────────
// Alex, after the ported voxel rig still jittered on a run: "what if we try having both hands just barely showing at the
// bottom of the screen alternating as the player runs then if the player jumps both hands go in the air with the right a
// little higher". This is that, as a pure function of the WALKER's own state (speed, airborne), never of the camera's
// travel, so a slope or an uneven frame cannot shake it. Every output is eased, so nothing snaps.
//
// Camera space: x right, y up, z toward the viewer (the hands sit at negative z). At fov 75 and z = -0.55 the bottom of
// the frame is y ≈ -0.42, so a resting glove centred at -0.45 shows only its knuckles: "just barely showing".
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
}
export interface FpState { phase: number; run: number; air: number; low: number; wasAir: boolean; landAt: number; chop: number; R: HandPose; L: HandPose }

export const FP = {
  Z: -0.55, REST_Y: -0.47, X: 0.25,
  STRIDE_M: 2.4,         // metres per full stride (two steps): each hand rises once per stride
  RUN_SPEED: 6.5,        // full alternation here (shared/locomotion RUN_SPEED)
  SWING_Y: 0.075,        // how far a hand rises on its step at a full run
  SWING_Z: 0.05,         // and how far it comes forward
  JUMP_Y_R: 0.24, JUMP_Y_L: 0.19, JUMP_SPREAD: 0.05, JUMP_PITCH: 0.35,
  LAND_MS: 260, LAND_DIP: 0.05,
  CAST_MS: 640, CAST: { x: 0.15, y: -0.24, pitch: 0.55 },
  CHOP_HZ: 2.2, CHOP_PITCH: 0.6,
  HIDE_Y: 0.6,
  EASE: 16,              // per second, every output
} as const

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const approach = (cur: number, to: number, rate: number, dt: number) => cur + (to - cur) * (1 - Math.exp(-rate * dt))
const rest = (side: 1 | -1): HandPose => ({ x: side * FP.X, y: FP.REST_Y, z: FP.Z, pitch: 0, roll: side * -0.15 })
export const newFpState = (): FpState => ({ phase: 0, run: 0, air: 0, low: 0, wasAir: false, landAt: -Infinity, chop: 0, R: rest(1), L: rest(-1) })

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

  const sw = Math.sin(s.phase)
  // alternating: the right hand rises while the left sinks, then the other way; up also means a little forward
  // a full sine each, opposite: one rises exactly as the other sinks (no kink at the bottom of a half-wave)
  const upR = (1 + sw) / 2 * s.run, upL = (1 - sw) / 2 * s.run
  const landU = (i.now - s.landAt) / FP.LAND_MS
  const dip = landU >= 0 && landU < 1 ? -Math.sin(landU * Math.PI) * FP.LAND_DIP : 0
  const castU = (i.now - i.castAt) / FP.CAST_MS
  const cast = castU >= 0 && castU < 1 ? (castU < 0.25 ? Math.sin((castU / 0.25) * Math.PI / 2) : castU < 0.5 ? 1 : Math.cos(((castU - 0.5) / 0.5) * Math.PI / 2)) : 0
  const chop = i.working ? Math.abs(Math.sin(s.chop * Math.PI)) : 0
  const hide = -s.low * FP.HIDE_Y

  const tR: HandPose = {
    x: FP.X + s.air * FP.JUMP_SPREAD + cast * (FP.CAST.x - FP.X),
    y: FP.REST_Y + upR * FP.SWING_Y + s.air * FP.JUMP_Y_R + dip + cast * (FP.CAST.y - FP.REST_Y) * (1 - s.air) + chop * 0.08 + hide,
    z: FP.Z - upR * FP.SWING_Z,
    pitch: s.air * FP.JUMP_PITCH + cast * FP.CAST.pitch - chop * FP.CHOP_PITCH,
    roll: -0.15 + s.air * -0.1,
  }
  const tL: HandPose = {
    x: -FP.X - s.air * FP.JUMP_SPREAD,
    y: FP.REST_Y + upL * FP.SWING_Y + s.air * FP.JUMP_Y_L + dip + hide,
    z: FP.Z - upL * FP.SWING_Z,
    pitch: s.air * FP.JUMP_PITCH,
    roll: 0.15 + s.air * 0.1,
  }
  for (const k of ['x', 'y', 'z', 'pitch', 'roll'] as const) {
    s.R[k] = approach(s.R[k], tR[k], FP.EASE, dt)
    s.L[k] = approach(s.L[k], tL[k], FP.EASE, dt)
  }
  return { R: s.R, L: s.L }
}
