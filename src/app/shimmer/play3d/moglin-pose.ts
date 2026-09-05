/**
 * A CLAY DOLL IS POSED, NOT DEFORMED — the joint angles for a rigid-part moglin.
 *
 * ★★★ WHY THIS EXISTS (2026-09-04, sprites lane). Alex asked how clay-doll character models are
 * done "as far as the rigging and etc". The answer this file bets on is that for THIS look the
 * rigging step does not exist: real claymation does not deform a skin over bones. Wallace and
 * Gromit, The Neverhood, Armikrog — the figure is a stack of rigid parts and the animator moves
 * them between frames. `Shimmer3D.tsx:561-565` already draws a moglin as a capsule, a sphere and
 * two ear spheres, so the build is most of the way to a clay doll already. What it is missing is
 * a JOINT HIERARCHY and a reason for the parts to move, and neither of those is a skinned mesh.
 *
 * So there is no armature here, no vertex weights, no GLB, no Blender. There is a function from
 * time to angles, and the parts hang off each other in `MoglinDoll.tsx`.
 *
 * ── WHY THE CLOCK IS STEPPED, WHICH IS THE WHOLE TRICK ────────────────────────────────────────
 * The strongest claymation tell is not a texture, it is the CADENCE. Stop motion is shot at one
 * pose per frame at 12-ish frames a second, and the eye reads that judder as "a hand moved this"
 * long before it reads the surface as clay. `stepTime` is that, and it is why this module exists
 * as its own file rather than as a few sines inside a component.
 *
 * ⚠ QUANTIZE THE TIME, NEVER THE OUTPUTS. Every angle below is derived from one `t`, so stepping
 * `t` once makes the entire figure hold still and then snap together, which is what a physical
 * puppet does. Rounding each angle separately would let the head land on a new frame while an arm
 * is still on the old one — the parts would slide against each other and the look collapses into
 * "low framerate" instead of "stop motion". Those two read completely differently and the
 * difference is entirely whether the parts move as one.
 *
 * ── THE FOUR THINGS THAT MAKE A WALK READ AS A WALK ──────────────────────────────────────────
 * 1. CONTRALATERAL swing. The left arm goes forward with the RIGHT leg. Get this backwards and it
 *    reads as deeply wrong without a viewer being able to say why.
 * 2. The bob runs at TWICE the stride. One stride is two steps, and the body drops on each one.
 * 3. Knees bend on the swing and straighten to plant. A stiff-legged cycle reads as a doll being
 *    slid along the floor, which is the exact failure this whole approach is accused of.
 * 4. The ears LAG. A rigid part hung off another rigid part is the puppet-maker's whole vocabulary
 *    for aliveness, and lag is what sells it as weight rather than as a rotation.
 *
 * Run: `npx tsx src/app/shimmer/play3d/moglin-pose.test.ts` (repo convention — there is no vitest).
 */

/**
 * Frames per second the FIGURE is posed at, while the world still renders at 60.
 * 12 is the traditional stop-motion "shooting on twos" rate at 24fps film.
 */
export const STEP_FPS = 12

/** Seconds of one full stride (left step + right step) at unit speed. */
export const STRIDE_S = 0.9

export interface MoglinPose {
  /** Vertical bob of the whole body, in blocks. Negative is a dip. */
  hipY: number
  /** Weight shift, radians. Rolls onto the planted foot. */
  hipRoll: number
  torsoPitch: number
  headPitch: number
  headYaw: number
  /** Ear flop, radians. Lags the head — see the header. */
  earL: number
  earR: number
  /** Shoulder swing, radians. Positive is forward. */
  armL: number
  armR: number
  /** Hip swing, radians. Positive is forward. */
  legL: number
  legR: number
  /** Knee bend, radians. Always >= 0 — a knee does not bend backwards. */
  kneeL: number
  kneeR: number
}

/**
 * Snap a continuous clock onto a stepped one.
 *
 * ⚠ `Math.floor`, not `Math.round`: a pose must never be shown before its time. Rounding would
 * make the figure reach a frame half a step early, which on a 12fps cadence is 40ms of lead and
 * reads as the animation anticipating itself.
 */
export function stepTime(t: number, fps: number = STEP_FPS): number {
  if (!(fps > 0)) return t          // fps 0 or nonsense means "do not step" — render smooth.
  return Math.floor(t * fps) / fps
}

/**
 * Radians of phase the ears trail the head by. About an eighth of a cycle: enough to see, not so
 * much that the ears look detached from the turn that caused them.
 */
const EAR_LAG = Math.PI / 4

/** Rest. Breathing only, so a stopped moglin is not a statue. */
export function idlePose(t: number): MoglinPose {
  const breathe = Math.sin(t * 1.6)
  return {
    hipY: breathe * 0.008,
    hipRoll: 0,
    torsoPitch: breathe * 0.02,
    headPitch: breathe * 0.03,
    headYaw: Math.sin(t * 0.5) * 0.12,
    // Even at rest the ears trail the head turn. Same lag as the walk, smaller amplitude.
    earL: Math.sin(t * 0.5 - EAR_LAG) * 0.10,
    earR: Math.sin(t * 0.5 - EAR_LAG) * 0.10,
    armL: 0, armR: 0,
    legL: 0, legR: 0,
    kneeL: 0, kneeR: 0,
  }
}

/**
 * A walk cycle.
 *
 * @param t     seconds. Step it with `stepTime` before calling if you want the clay cadence.
 * @param speed 0 = standing. 1 = normal patrol pace. Amplitudes scale with it, so a moglin
 *              easing to a halt winds its own swing down instead of stopping mid-stride.
 */
export function walkPose(t: number, speed: number): MoglinPose {
  const s = Math.max(0, Math.min(1.6, speed))
  // ⚠ At a standstill this must be EXACTLY the idle pose, not a small walk. A figure that keeps
  // swinging while its feet do not move is the "sliding doll" read we are trying to kill.
  if (s === 0) return idlePose(t)

  const phase = (t / STRIDE_S) * Math.PI * 2
  const swing = Math.sin(phase)
  const opp = -swing                                   // contralateral: see the header, point 1.

  // The bob runs at twice the stride — one dip per step, two per cycle. `-Math.abs` keeps it a
  // DIP: the body falls onto a planted foot and rises over it, it never floats above the rest line.
  const bob = -Math.abs(Math.sin(phase)) * 0.045 * s

  // A knee bends only while its leg swings FORWARD, and straightens to plant.
  // ⚠ THE PHASE HERE IS THE WHOLE ASSERT, and the obvious version is wrong. `legL` is at its most
  // BACKWARD at phase pi/2 and most forward at 3pi/2, so the leg travels forward BETWEEN those —
  // and the knee must peak in the middle of that travel (phase pi), not at either end. Keying the
  // bend straight off `swing` peaks it at maximum backward extension, which reads as the doll
  // kicking its heel up on the wrong beat. Hence the quarter-cycle shift.
  // `Math.max(0, ...)` is what makes it a knee rather than a hinge that folds both ways.
  const kneePhase = Math.sin(phase - Math.PI / 2)
  const kneeL = Math.max(0, kneePhase) * 0.55 * s
  const kneeR = Math.max(0, -kneePhase) * 0.55 * s

  return {
    hipY: bob,
    hipRoll: Math.sin(phase) * 0.06 * s,
    torsoPitch: 0.05 * s + Math.abs(swing) * 0.02 * s,  // leans into the walk, bounces a little
    headPitch: -0.04 * s,                                // head comes up as the body leans in
    headYaw: Math.sin(phase * 0.5) * 0.10,               // a slow look-about, half stride rate
    earL: Math.sin(phase - EAR_LAG) * 0.34 * s,
    earR: Math.sin(phase - EAR_LAG) * 0.30 * s,          // not identical: a puppet is never symmetric
    armL: swing * 0.52 * s,
    armR: opp * 0.52 * s,
    legL: opp * 0.46 * s,                                // left leg opposes the LEFT arm
    legR: swing * 0.46 * s,
    kneeL, kneeR,
  }
}
