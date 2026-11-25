// ── A MATE'S GAIT (BETA M156): how a peer's drawn body moves, read from how fast it is DRAWN travelling. The socket's `moving`
// flag cannot say it: the last packet before a keeper stops still reads true, and the next one is a 4 s keepalive. PURE; mate-gait.test.ts.
export type Gait = 'idle' | 'walk' | 'run'
/** faster than any body moves = a teleport being eased out, not steps (SPEED_CAP and slides are well under it) */
export const TELEPORT_AT = 30
/** start / stop apart, so a body easing to rest never flickers between two poses */
export const START_AT = 0.5, STOP_AT = 0.25
/** the same two bands the keeper's own third-person body uses (THIRD.RUN_AT is passed in) */
export function gaitOf(prev: Gait, speed: number, runAt: number): Gait {
  if (!Number.isFinite(speed) || speed > TELEPORT_AT) return 'idle'
  if (speed < (prev === 'idle' ? START_AT : STOP_AT)) return 'idle'
  return speed >= (prev === 'run' ? runAt - 0.4 : runAt) ? 'run' : 'walk'
}
/** the drawn speed, smoothed over ~0.15 s (12 Hz targets eased at 60 fps pulse) */
export const smoothSpeed = (cur: number, dist: number, dt: number) => dt > 0 ? cur + (dist / dt - cur) * (1 - Math.exp(-dt / 0.15)) : cur
/** poseKeeper's walk amount */
export const GAIT_WALK: Readonly<Record<Gait, number>> = { idle: 0, walk: 0.6, run: 1 }
