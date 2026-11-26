// BETA M173: A FLIER'S HEIGHT (Athowl, Noctyx). Pure. The trot still owns where she goes; this owns how high she travels and how
// fast her wings beat. Her `run` clip IS the flight (its own feet are ~0.12 / 0.17 m up, drawn in the clip); `alt` is the metres
// ON TOP of that, eased up while she travels and back to 0 before she lands, so on the ground nothing is added and the walk (the
// two-footed hop), idle, sit and sleep stay planted exactly as the walkers' are.
import type { RigClip } from './spirit-rig'
import type { TrotMode } from './spirit-trot'

export type FlyLook = {
  /** metres over the clip's own height while she travels */
  alt: number
  /** ease up / down, per second */
  up: number; down: number
  /** wing beats, as a multiple of the clip's own pace: never slower / faster than this (hovering and landing beat too) */
  flap: [number, number]
}
/** m: below this she is down (the next clip may take over) */
export const DOWN = 0.02
/** THE DEADZONE: anything (the keeper, another spirit) this near her in plan while she is up: she holds her height, neither
 *  settling onto them nor climbing off, until it is past `out`, for at most `hold` s (two fliers never hold each other up) */
export const DEADZONE = { in: 0.55, out: 0.75, hold: 1.5 } as const
export type FlyState = { alt: number; inside: boolean; held: number }
export const GROUNDED: FlyState = { alt: 0, inside: false, held: 0 }

/** does this clip + mode travel in the air? (a hop on / off the perch and a play keep to the piece: the clip's own height only) */
export const travels = (clip: RigClip, mode: TrotMode) => clip === 'run' && (mode === 'trot' || mode === 'follow')

export function flyStep(s: FlyState, f: FlyLook, up: boolean, near: number, dt: number): FlyState {
  const airborne = s.alt > DOWN
  const inside = airborne && near < (s.inside ? DEADZONE.out : DEADZONE.in)
  const held = inside ? s.held + dt : Math.max(0, s.held - dt)
  if (inside && held < DEADZONE.hold) return { alt: s.alt, inside, held }
  const to = up ? f.alt : 0, alt = s.alt + (to - s.alt) * (1 - Math.exp(-dt * (up ? f.up : f.down)))
  return { alt: !up && alt < 1e-3 ? 0 : alt, inside, held }
}
/** the clip a flier plays: still up = still flying, whatever the trot has gone on to */
export const flyClip = (want: RigClip, alt: number): RigClip => (alt > DOWN ? 'run' : want)
/** wing-beat cycles for this frame, by time, paced a little by her speed (never by the ground she covers: nothing is planted) */
export function flapCycles(f: Pick<FlyLook, 'flap'>, v: number, clipV: number, dur: number, dt: number): number {
  return dt / dur * Math.min(f.flap[1], Math.max(f.flap[0], v / Math.max(clipV, 1e-6)))
}
