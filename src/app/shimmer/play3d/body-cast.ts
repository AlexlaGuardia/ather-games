// body-cast.ts — the casts that move the KEEPER, as play3d's tile walker runs them (2026-09-28).
//
// ★ PURE. No react, no three, no DOM. The walker (`Shimmer3D.tsx` › Player) owns its refs and its
// collision; this owns the three decisions, so each one is an assert and not a playtest:
//   · launchVy  — how a launch meets a body that is already moving vertically
//   · blinkLand — where a blink arrives (walk back from the reticle to the first cell you can stand in)
//   · sightClear — whether the Gate's far end is in the caster's sight (RULED 09-28, moves.md GATE IN A FIGHT)
//
// ── WHY A MAILBOX (`BodyCast`) AND NOT A CALL ────────────────────────────────────────────────────
// The cast dispatch lives in the page component (it owns mana, cooldowns, the toast); the body lives
// inside Player's frame loop (vy, hvel, airborne are its refs, and only it knows the floor). A launch
// written from outside would be overwritten by the same frame's velocity pass. So the dispatch POSTS a
// request and the walker applies it at the top of its next tick, before velocity — one writer per ref.
//
// ── PROVENANCE ───────────────────────────────────────────────────────────────────────────────────
// Same verbs as the voxel world (`voxel3d/locomotion.ts` › launchKeeper / blinkKeeper), re-grounded on
// play3d's tile collision instead of a block probe — the split the guns already use (shared maths, each
// walker owns its hits). The numbers are the CastSpec's; nothing here is tuned.

/** What the dispatch asks the walker to do on its next tick. */
// No direction rides on the request: the walker reads the camera's flat forward on the tick it applies
// it, which is the frame the keeper sees. The cast decides its own arc (never the camera's pitch).
export type BodyCast =
  | { kind: 'launch'; label: string; fwd: number; up: number; keepMomentum?: boolean; airJumps?: number; airJumpSecs?: number }
  | { kind: 'blink'; label: string; range: number }
  | { kind: 'gate'; label: string; moveId: string; range: number; manaCost: number; slot: number }
  /** the Gate stepping the body through: arrive at the other end, standing */
  | { kind: 'warp'; x: number; y: number; z: number }

export interface GatePoint { x: number; y: number; z: number }
/** What the walker reports back to the dispatch: always a sentence; a refund when nothing happened. */
export interface BodyCastResult {
  say: string
  /** the Gate struck nothing it could stand or see: give the press back, clear its cooldown */
  refund?: { slot: number; mana: number }
  /** the Gate struck both ends: the page opens the spiral */
  gate?: { moveId: string; near: GatePoint; far: GatePoint }
}

/**
 * ★ A FLOOR ON VERTICAL SPEED — the voxel world's rule, carried unchanged (locomotion.ts explains the
 * two wrong forms: plain assignment cuts a keeper already rising faster, addition stacks two casts into
 * the skybox). A fall is fully cancelled; an existing climb is never reduced or compounded.
 */
export const launchVy = (up: number, vy: number): number => (up > 0 ? Math.max(up, vy) : vy)

/**
 * Where a blink lands: try the reticle point, then walk back toward the caster in `steps` even cuts,
 * and take the FIRST point the body can stand in (`canStand` = floor reachable, no wall, room for the
 * body). Null when nothing on the line will hold her — the host says so, it never fails silently.
 * ⚠ Aimed AT the destination and searched BACK: searching forward from the caster would always take
 * the first step and a blink would never go further than one cut.
 */
export function blinkLand(
  fromX: number, fromZ: number, toX: number, toZ: number,
  canStand: (x: number, z: number) => boolean, steps = 8,
): { x: number; z: number; dist: number } | null {
  const dx = toX - fromX, dz = toZ - fromZ
  for (let i = steps; i >= 1; i--) {
    const t = i / steps
    const x = fromX + dx * t, z = fromZ + dz * t
    if (canStand(x, z)) return { x, z, dist: Math.hypot(x - fromX, z - fromZ) }
  }
  return null
}

/**
 * The reticle's flat reach: camera forward flattened, walked `range` out. A blink has a destination;
 * a launch has only a direction, which is why the launch never calls this (it would cap Overcharge's
 * ride at a range it does not have).
 */
export function flatAim(fx: number, fz: number, px: number, pz: number, range: number): { x: number; z: number } {
  const len = Math.hypot(fx, fz) || 1
  return { x: px + (fx / len) * range, z: pz + (fz / len) * range }
}

/**
 * ★ BOTH ENDS IN SIGHT (RULED 09-28). Sample the eye-to-eye line; any sample inside something taller
 * than the line at that point blocks it. `topAt` answers the tallest solid thing in a cell (a wall, a
 * cliff face, a tile with no floor you could see over = +Infinity). Ten samples, as the voxel world.
 */
export function sightClear(
  ax: number, ay: number, az: number, bx: number, by: number, bz: number,
  topAt: (cx: number, cz: number) => number, samples = 10,
): boolean {
  for (let i = 1; i < samples; i++) {
    const t = i / samples
    const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t
    if (topAt(Math.round(x), Math.round(z)) > y) return false
  }
  return true
}

/** the shortest blink that still counts as having gone somewhere (the voxel world's 1.5 for the Gate, 1 for a step) */
export const GATE_MIN_REACH = 1.5
export const BLINK_MIN_REACH = 1
