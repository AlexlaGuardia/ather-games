// ── THE KEEPER'S BODY, POSED NOT DEFORMED (Alex 11-17: "lets see results ... side by side") ───────────────────────────
// The open world is going multiplayer (the Wilds as servers), so other keepers will SEE you: the keeper needs a body.
// Same bet as the Clay Bench's moglin (play3d/moglin-pose.ts): rigid parts on a joint hierarchy, posed by a function of
// time, so there is no armature, no weights, no skinned mesh, no animation file. This module is that function; the parts
// hang off each other in keeper-doll.tsx. One rig, two looks under test: the SEGMENTED DOLL (every limb part drawn) and
// the RAYMAN (the same rig with the upper/lower limb parts hidden: hands and feet float where the chain puts them). Same
// pose, same clock, so the only thing that differs on the bench is the limbs.
//
// Facing +z. Rotation sign (three, about X): +a swings a hanging part BACKWARD (-z), so a forward arm swing is negative,
// a knee bends positive, an elbow bends negative. Lengths are metres (EYE_STAND ≈ a keeper's eye).
//
// Run: npx tsx src/app/shimmer/open/shared/keeper-pose.test.ts

export type KeeperAction = 'idle' | 'walk' | 'run' | 'swing' | 'cast' | 'aim'
export const KEEPER_ACTIONS: readonly KeeperAction[] = ['idle', 'walk', 'run', 'swing', 'cast', 'aim']

/** Body measures (metres). Hip at 0.92, shoulders at 1.42, eye about 1.62. */
export const BODY = {
  hipY: 0.92, hipHalf: 0.1, thigh: 0.42, shin: 0.42,
  torso: 0.5, shoulderHalf: 0.2, upperArm: 0.3, forearm: 0.27, headY: 0.2,
} as const

export interface Limb { pitch: number; roll: number; bend: number }   // shoulder/hip pitch + roll, elbow/knee bend
export interface KeeperPose {
  hipY: number          // bob, metres
  hipRoll: number       // weight shift onto the planted foot
  torsoPitch: number    // lean (negative = forward)
  torsoYaw: number      // the chop's twist
  headPitch: number
  armL: Limb; armR: Limb
  legL: Limb; legR: Limb
  /** 0..1 glow of the glove's seat (a cast lights it) */
  seat: number
  /** what the right hand holds, for the doll to draw */
  held: 'none' | 'blade' | 'gun'
}

/** Seconds of one full stride (two steps). */
export const STRIDE_S = { walk: 1.0, run: 0.62 } as const
const TAU = Math.PI * 2
const still = (pitch: number, roll = 0, bend = 0): Limb => ({ pitch, roll, bend })

/** The pose at time t (seconds). Pure; every angle comes from one t, so a stepped clock moves the figure as one. */
export function poseKeeper(action: KeeperAction, t: number): KeeperPose {
  const breathe = Math.sin(t * TAU / 3.6)
  const base: KeeperPose = {
    hipY: 0.006 * breathe, hipRoll: 0, torsoPitch: 0.02 * breathe, torsoYaw: 0, headPitch: -0.02 * breathe,
    armL: still(0.04, 0.1, -0.12), armR: still(0.04, -0.1, -0.12),
    legL: still(0, 0.02), legR: still(0, -0.02), seat: 0.15, held: 'none',
  }
  if (action === 'idle') return base

  if (action === 'walk' || action === 'run') {
    const run = action === 'run'
    const ph = (t / STRIDE_S[action]) * TAU              // one stride = one turn
    const s = Math.sin(ph), c = Math.cos(ph)
    const legAmp = run ? 0.75 : 0.45, armAmp = run ? 0.85 : 0.4
    // contralateral: the LEFT leg forward with the RIGHT arm (forward = negative pitch)
    const legL = -legAmp * s, legR = legAmp * s
    // knees bend on the swing (the leg travelling forward), straighten to plant
    // the left leg travels forward while d(legL)/dt < 0, i.e. while cos > 0
    const kneeL = Math.max(0, c) * (run ? 1.3 : 0.7) + 0.05, kneeR = Math.max(0, -c) * (run ? 1.3 : 0.7) + 0.05
    return {
      ...base,
      hipY: -(run ? 0.05 : 0.025) * Math.abs(Math.sin(ph)) + (run ? 0.02 : 0),   // bob at twice the stride: a dip each step
      hipRoll: (run ? 0.03 : 0.05) * s,
      torsoPitch: run ? -0.22 : -0.04,
      headPitch: run ? 0.15 : 0.03,
      armL: still(-armAmp * -s, 0.08, run ? -1.25 : -0.25),
      armR: still(-armAmp * s, -0.08, run ? -1.25 : -0.25),
      legL: still(legL, 0, kneeL), legR: still(legR, 0, kneeR),
    }
  }

  if (action === 'swing') {
    // a chop with the blade every 1.1 s: wind up over the shoulder, strike down and across, recover
    const u = (t % 1.1) / 1.1
    const wind = u < 0.45 ? u / 0.45 : 0, strike = u >= 0.45 && u < 0.6 ? (u - 0.45) / 0.15 : u >= 0.6 ? 1 - (u - 0.6) / 0.4 : 0
    const up = wind > 0 ? wind : 1 - Math.min(1, strike * 1.2)
    const pitchR = -2.5 * up + -0.9 * strike * (1 - up)
    return {
      ...base, held: 'blade',
      torsoYaw: 0.35 * up - 0.3 * strike, torsoPitch: -0.12 * strike,
      armR: still(pitchR, -0.25, -0.6 * up - 0.15),
      armL: still(-0.35, 0.25, -0.9),
      legL: still(-0.18, 0.05, 0.12), legR: still(0.15, -0.05, 0.08),
    }
  }

  if (action === 'cast') {
    // the glove raised and aimed, the seat brightening; the bracelet wrist comes up across (the tacticals)
    const pulse = 0.5 + 0.5 * Math.sin(t * TAU / 1.4)
    return {
      ...base, seat: 0.35 + 0.65 * pulse,
      torsoPitch: -0.05, headPitch: 0.02,
      armR: still(-1.45 - 0.08 * pulse, -0.05, -0.12),
      armL: still(-0.9, 0.35, -1.1),
      legL: still(-0.12, 0.03, 0.06), legR: still(0.1, -0.03, 0.04),
    }
  }

  // aim: the sidearm out in the right hand, the left steadying under it
  const sway = 0.015 * Math.sin(t * TAU / 2.2)
  return {
    ...base, held: 'gun',
    torsoPitch: -0.03, torsoYaw: -0.08,
    armR: still(-1.52 + sway, -0.02, -0.02),
    armL: still(-1.25 + sway, 0.45, -0.75),
    legL: still(-0.15, 0.04, 0.06), legR: still(0.12, -0.04, 0.05),
  }
}

/** Hold the clock to a stepped cadence (0 = smooth). Quantise the TIME, never the outputs (moglin-pose.ts). */
export const stepTime = (t: number, fps: number) => (fps > 0 ? Math.floor(t * fps) / fps : t)
