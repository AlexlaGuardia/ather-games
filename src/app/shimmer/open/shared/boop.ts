// THE BOOP (BETA M232, Alex 11-27 playtest): hands out (nothing drawn), the punch (pad R2, the mouse's right button, the
// phone's hit) lands on whatever stands in front: a Hollow takes the fist, another keeper takes NO damage. Either one is
// moved only a LITTLE and only when caught STANDING STILL; a body on the move gets a friendly tap (a hit reaction, no
// displacement). Alex: "not make it huge and no boop if the player is in motion.. so they have to catch you standing
// still to move you other wise its just a friendly tap.. apex did this well". Allowed everywhere, gardens included.
//
// ★ WHO MOVES A KEEPER: the keeper's OWN client. Each client owns its body (open-mp sends its pose at 12 Hz, nobody
// writes another's), so the puncher only SAYS 'boop' to the keeper it reached (openNet().relay(BOOP_KIND, dir, to)); the
// receiver decides still-or-moving from its own walker (the only honest reading of its speed) and moves itself, and its
// next pose carries the push to everyone. A push applied on the puncher's screen would be overwritten by the next pose.
//
// This file is pure + a tiny store (no DOM, no three): the rules have a test (boop.test.ts).

/** The relay kind a punch on another keeper travels as. */
export const BOOP_KIND = 'boop'
/** Reach of a fist, metres from the eye's foot, and how straight ahead it must be (cos of the half-angle). */
export const PUNCH_REACH = 1.9
export const PUNCH_CONE = 0.55
/** Seconds between punches (the swing's own cooldown, melee.ts canSwing, is shorter; this is the boop's). */
export const PUNCH_CD = 0.45
/** Horizontal speed (m/s) under which a keeper counts as STANDING STILL. A walk is 4+, an idle drift ~0. */
export const STILL_SPEED = 0.6
/** The push on a still keeper: a small hop away (launchKeeper fwd / up, m/s). ≈ 0.6 to 0.9 m all told: "not huge". */
export const PUSH_FWD = 2.2
export const PUSH_UP = 2.0
/** A Hollow punched while still is shoved this far (metres, before its weight); a moving one only flinches. */
export const PUSH_HOLLOW_M = 0.6
/** The fist's damage on a Hollow (players take none). Build number (Jin): ~1/6 of a shambler's 35 hp. */
export const FIST_DMG = 6

export type BoopOutcome = 'push' | 'tap'
/** Still = slow on the ground. Moving (or in the air) = a friendly tap. */
export function boopOutcome(speed: number, airborne: boolean): BoopOutcome {
  return !airborne && speed < STILL_SPEED ? 'push' : 'tap'
}
/** A Hollow is "standing still" unless it is walking, chasing, lunging or charging. */
const MOVING_STATES = new Set(['wander', 'chase', 'lunge', 'charge'])
export function hollowOutcome(state: string): BoopOutcome { return MOVING_STATES.has(state) ? 'tap' : 'push' }

export interface PunchCandidate { id: string; x: number; z: number; y?: number }
/** The nearest candidate inside the fist's reach and cone, from feet (x, z) facing yaw (yaw 0 looks down -z). */
export function pickPunchTarget<T extends PunchCandidate>(me: { x: number; z: number; y?: number; yaw: number }, cands: readonly T[]): T | null {
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw)
  let best: T | null = null, bestD = Infinity
  for (const c of cands) {
    const dx = c.x - me.x, dz = c.z - me.z, d = Math.hypot(dx, dz)
    if (d > PUNCH_REACH) continue
    if (me.y !== undefined && c.y !== undefined && Math.abs(c.y - me.y) > 1.6) continue
    if (d > 1e-4 && (dx * fx + dz * fz) / d < PUNCH_CONE) continue   // standing inside each other counts as in front
    if (d < bestD) { best = c; bestD = d }
  }
  return best
}
/** The unit push direction from the puncher to the target (falls back to the puncher's facing when they overlap). */
export function pushDir(me: { x: number; z: number; yaw: number }, t: { x: number; z: number }): { x: number; z: number } {
  const dx = t.x - me.x, dz = t.z - me.z, d = Math.hypot(dx, dz)
  return d > 1e-4 ? { x: dx / d, z: dz / d } : { x: -Math.sin(me.yaw), z: -Math.cos(me.yaw) }
}
/** Read a relayed boop; anything malformed is null (a peer's payload is data, never trusted). */
export function decodeBoop(data: unknown): { x: number; z: number } | null {
  const d = data as { x?: unknown; z?: unknown } | null
  if (!d || typeof d.x !== 'number' || typeof d.z !== 'number' || !Number.isFinite(d.x) || !Number.isFinite(d.z)) return null
  const l = Math.hypot(d.x, d.z); if (l < 1e-4 || l > 1.01) return null
  return { x: d.x / l, z: d.z / l }
}

// ── the store: a punch waiting for combat's frame, a boop waiting for the walker's ──────────────────────────────────
const S = { punch: null as null | { at: number }, boop: null as null | { x: number; z: number }, lastPunch: -1e9,
  log: [] as { at: number; kind: string; outcome?: BoopOutcome; who?: string }[] }
/** A punch was thrown now (true) or refused by the cooldown (false). Combat takes it on its next frame. */
export function throwPunch(now = performance.now()): boolean {
  if (now - S.lastPunch < PUNCH_CD * 1000) return false
  S.lastPunch = now; S.punch = { at: now }; return true
}
/** Combat's frame: the punch owed, at most 1 s old (a weak GPU's slow frame still lands it; a paused combat never lands a stale one). */
export function takePunch(now = performance.now()): boolean { const p = S.punch; S.punch = null; return !!p && now - p.at < 1000 }
/** A boop reached this keeper (from the net, or a check): the walker takes it on its next frame. */
export function receiveBoop(dir: { x: number; z: number }) { S.boop = dir }
export function takeBoop(): { x: number; z: number } | null { const b = S.boop; S.boop = null; return b }
/** For the checks (__boop): what happened, newest last. */
export function noteBoop(kind: string, outcome?: BoopOutcome, who?: string) { S.log.push({ at: Date.now(), kind, outcome, who }); if (S.log.length > 30) S.log.shift() }
export const boopLog = () => S.log.slice()
