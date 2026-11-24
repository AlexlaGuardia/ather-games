// BETA M132 s2 (play, 2026-11-24): WHICH CLIP a rigged spirit plays, and how fast. Pure (no three, no React): spirit-model.tsx
// feeds it spirit-trot.ts's own pose each frame and spirit-rig-body.ts plays the answer. The trot still decides everything
// (where she goes, when she stops, sits, sniffs, plays); the rig only gives it legs.
//  - her gait clip is advanced by the METRES she really moved (not by time), so a planted foot stays where it is at any frame
//    rate; past CADENCE_MAX strides a second (a catch-up behind a running keeper) the legs stop speeding up and she slides.
//  - sit = lying along the ground (the sit beat, the perch, a long stand-by, an idle skit's lie); idle = everything else still.
import type { TrotPose } from './spirit-trot'

export type RigClip = 'idle' | 'walk' | 'run' | 'sit'
export const RIG_CLIPS: readonly RigClip[] = ['idle', 'walk', 'run', 'sit']
export type RigLook = {
  /** nose to tail in glb units, standing (the idle clip's mean); spirit-rig.test.ts measures the glb and pins it */
  glbLen: number
  /** the point of the glb she turns round: between her feet */
  pivot: { x: number; z: number }
  /** glb units per second each gait clip is made for (metres per second / the height it was built at) */
  clipV: { walk: number; run: number }
  /** m/s: a run from here up, back to a walk below the second */
  runAt: [number, number]
  /** hull thickness, glb units, pushed along the normals */
  hull: number
  /** bone names the trot's look / tilt / sniff turn */
  neck: string; head: string
}
/** strides a second the legs never pass */
export const CADENCE_MAX = 5.5
/** m/s of feet when she only turns on the spot: metres per radian */
export const TURN_R = 0.16
export const STILL = 0.03   // m/s under this she stands
/** s to fade INTO each clip (lying down and getting up are slow; her first step is not) */
export const FADE: Record<RigClip, number> = { idle: 0.25, walk: 0.14, run: 0.16, sit: 0.6 }

/** the clip for this pose; v = her real ground speed (smoothed), turn = |yaw rate| rad/s */
export function rigClip(p: Pick<TrotPose, 'mode' | 'sit'>, v: number, turn: number, prev: RigClip, runAt: [number, number]): RigClip {
  if (p.mode === 'hopDown' || p.mode === 'hopUp') return 'run'   // legs reaching through the air on and off the perch
  if (p.sit > 0.4) return 'sit'
  if (v > STILL) return v >= (prev === 'run' ? runAt[1] : runAt[0]) ? 'run' : 'walk'
  return turn > 0.5 ? 'walk' : 'idle'
}
/** metres of ground in one cycle of a gait clip at height h */
export const strideLen = (clipV: number, dur: number, h: number) => clipV * dur * h
/** how many cycles the gait moves on for `moved` metres in dt seconds (signed: backing off plays it backwards), and whether the
 *  cadence cap bit (= her feet slide this frame) */
export function gaitCycles(moved: number, dt: number, stride: number): { cycles: number; capped: boolean } {
  const c = moved / Math.max(stride, 1e-6), max = CADENCE_MAX * dt
  return Math.abs(c) > max ? { cycles: Math.sign(c) * max, capped: true } : { cycles: c, capped: false }
}
/** metres her feet cover this frame: what she moved along (or across) her facing, backwards when she backs off; turning on the
 *  spot steps too. A jump past 1.5 m is a set-down, not a step. */
export function groundMoved(dx: number, dz: number, yaw: number, dyaw: number): number {
  const d = Math.hypot(dx, dz)
  if (d > 1.5) return 0
  if (d < 1e-5) return Math.abs(dyaw) * TURN_R
  return (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d < -0.3 ? -d : d
}
/** weights one step nearer `want`, always summing to 1 (a clip is always playing: the bind pose has the tail straight out) */
export function fadeWeights(w: Record<RigClip, number>, want: RigClip, dt: number, fromSit = w.sit > 0.5): Record<RigClip, number> {
  const k = Math.min(1, dt / (want !== 'sit' && fromSit ? Math.max(FADE[want], 0.35) : FADE[want]))
  const out = { ...w }
  let rest = 0
  for (const c of RIG_CLIPS) if (c !== want) rest += w[c]
  const take = Math.min(rest, k), f = rest > 0 ? (rest - take) / rest : 0
  for (const c of RIG_CLIPS) if (c !== want) out[c] = w[c] * f < 1e-4 ? 0 : w[c] * f
  out[want] = 1; for (const c of RIG_CLIPS) if (c !== want) out[want] -= out[c]
  return out
}
