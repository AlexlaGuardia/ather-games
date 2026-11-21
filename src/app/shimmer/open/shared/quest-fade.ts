// BETA M63: the quest trail FADES in when you face the glare and out when you look away (Alex 11-21: "fades in", hub: ~0.3 s).
// Pure, so the rate is pinned by a unit test: in a headless browser at 1-3 fps a 0.3 s fade fits inside one frame and is
// indistinguishable from a pop by any outside measurement (quest-guide-check, 11-21).
export const FADE_S = 0.3
/** One frame of the fade: toward 1 while facing, toward 0 while not, at 1 per `fadeS` seconds, clamped. */
export function fadeStep(op: number, facing: boolean, dt: number, fadeS = FADE_S): number {
  return facing ? Math.min(1, op + dt / fadeS) : Math.max(0, op - dt / fadeS)
}
