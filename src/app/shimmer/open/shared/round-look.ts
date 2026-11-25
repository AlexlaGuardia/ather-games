// BETA M177 (Alex 11-25: "the visible projectile is still too bulky and slow"): how a round in the open world is DRAWN.
// PURE. What a round HITS is combat.ts's (a point swept along its step, tested against the bodies' own radii): nothing here
// changes that. Before M177 every gun drew the same 5 cm x 5 cm x 90 cm box CENTRED on the round, so half of it ran ahead of
// where the round really was, and its first frames, 0.4 m from the eye, filled a phone's view (5 cm at 0.4 m is ~7 degrees).
// Now each gun draws its own needle, trailing BEHIND the round (its front is the hit point), grown out of the barrel rather
// than spawned whole beside the eye, and never thinner on screen than about a pixel, so a far round does not vanish.

export interface RoundLook { /** metres across, up close */ w: number; /** metres long, at full length */ len: number }
/** before M177, every gun */
export const ROUND_LOOK_BEFORE: RoundLook = { w: 0.05, len: 0.9 }
/** per gun: the needle keeps each gun's character (Lance the long fine one, Charred Rifle the heavy bolt, Roar's pellets short) */
export const ROUND_LOOK: Record<string, RoundLook> = {
  repeater: { w: 0.016, len: 1.1 },
  spitter: { w: 0.013, len: 0.9 },
  backbone: { w: 0.018, len: 1.3 },
  roar: { w: 0.02, len: 0.45 },
  lance: { w: 0.011, len: 2.0 },
  'charred-rifle': { w: 0.03, len: 2.2 },
}
export const roundLook = (gun: string | undefined): RoundLook => (gun && ROUND_LOOK[gun]) || ROUND_LOOK.repeater
/** the streak does not start until the round is this far past where it left (the muzzle, not the eye's cheek) */
export const MUZZLE_CLEAR = 0.5
/** the thinnest a streak draws, as an angle (radians): about a pixel and a half on a phone's 70 degree view */
export const MIN_ANGLE = 0.0022

/** The streak to draw for a round `traveled` metres from where it left, `camDist` metres from the camera: {w, len}, its front
 *  on the round. len 0 = nothing to draw yet. */
export function streakOf(look: RoundLook, traveled: number, camDist: number): { w: number; len: number } {
  const len = Math.max(0, Math.min(look.len, traveled - MUZZLE_CLEAR))
  return { w: Math.max(look.w, camDist * MIN_ANGLE), len }
}
