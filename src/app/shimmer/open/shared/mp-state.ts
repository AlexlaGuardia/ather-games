// ── OTHERS JUMP (and show their real moves) IN MULTIPLAYER (BETA M248, Alex 11-27: 'did we ever make it so players could see
// each other moving and jumping') ───────────────────────────────────────────────────────────────────────────────────────
// Until M248 the page sent y = the GROUND under the keeper, so a jump never showed: others glided along the ground.
// Now the page sends its REAL feet height plus a small STATE code, and the remote figure leaves the ground and lands.
//
// THE WIRE (no server change): the state rides the socket's `direction` field. shimmer-server keeps `direction` in PlayerState
// and forwards it on every move + join (it was the 2D client's 0-7 facing; the 3D clients always left it 0). A code is
//   MP_STATE_MARK (256) + the state's number
// so a value under 256 (an old open-world client's 0, a 2D client's facing) says "no M248 state": that sender's y is the
// GROUND it computed, and the receiver ground-snaps the figure to its own ground (old clients keep drawing exactly as before).
// A code past the known states (a newer client) reads as 'ground'.
// ★ PURE (no React, no socket, no three). Node test: mp-state.test.ts.

export const MP_STATE_MARK = 256
export const MP_STATES = { ground: 1, jump: 2, fall: 3, land: 4, sprint: 5, slide: 6, crouch: 7, punch: 8, aim: 9, climb: 10 } as const
export type MpState = keyof typeof MP_STATES
const BY_CODE = new Map<number, MpState>(Object.entries(MP_STATES).map(([k, v]) => [v, k as MpState]))

/** How long after touching down the figure still reads as landing (the squash). */
export const LAND_MS = 220
/** How long a thrown punch / swing shows on the remote figure (a 12 Hz sender needs 4+ packets to carry it). */
export const PUNCH_MS = 380
/** Rising faster than this (m/s) is a jump; anything else in the air is a fall. */
export const RISE_VY = 0.3

export interface BodyNow {
  airborne: boolean; vy: number
  /** ms since the keeper last touched down (Infinity = never / long ago) */
  landAgoMs: number
  climbing: boolean; sliding: boolean; crouching: boolean
  /** ms since the last punch / melee swing went (Infinity = never) */
  punchAgoMs: number
  aiming: boolean
  /** horizontal speed, m/s; `runAt` = the speed the gait calls a run */
  speed: number; runAt: number
}

/** The one state worth showing right now. The air outranks everything; a fist outranks the feet. */
export function pickState(b: BodyNow): MpState {
  if (b.climbing) return 'climb'
  if (b.airborne) return b.vy > RISE_VY ? 'jump' : 'fall'
  if (b.landAgoMs >= 0 && b.landAgoMs < LAND_MS) return 'land'
  if (b.punchAgoMs >= 0 && b.punchAgoMs < PUNCH_MS) return 'punch'
  if (b.sliding) return 'slide'
  if (b.crouching) return 'crouch'
  if (b.aiming) return 'aim'
  if (b.speed >= b.runAt) return 'sprint'
  return 'ground'
}

export const encodeState = (s: MpState): number => MP_STATE_MARK + MP_STATES[s]

/** A peer's `direction` field: their state, or null = an old client (no state; its y is ground, so snap it). */
export function decodeState(dir: unknown): MpState | null {
  if (typeof dir !== 'number' || !Number.isInteger(dir) || dir < MP_STATE_MARK || dir >= MP_STATE_MARK * 2) return null
  return BY_CODE.get(dir - MP_STATE_MARK) ?? 'ground'
}

export const isAir = (s: MpState | null) => s === 'jump' || s === 'fall'

/** y easing rates (1/s). In the air the figure follows its 12 Hz samples tightly, so a jump keeps its arc (LERP 10, the x/z
 *  rate, flattens a 1 m hop by a third); on the ground a gentler rate hides step noise. */
export const LERP_Y_AIR = 28, LERP_Y_GROUND = 12

/** One frame of a remote figure's height. `drawn` = where it is drawn now, `target` = the y they last sent, `groundY` = this
 *  client's ground under the figure (null when the page knows none). Old clients (state null) stand on our ground. */
export function stepRemoteY(drawn: number, target: number, state: MpState | null, groundY: number | null, dt: number): number {
  const g = groundY !== null && Number.isFinite(groundY) ? groundY : null
  if (state === null) {   // an old client: its y IS a ground height (or missing); our own ground is the honest one
    if (g !== null) return g
    if (!Number.isFinite(target)) return Number.isFinite(drawn) ? drawn : 0
    if (!Number.isFinite(drawn)) return target
    return drawn + (target - drawn) * (1 - Math.exp(-LERP_Y_GROUND * dt))
  }
  const t = Number.isFinite(target) ? target : g ?? (Number.isFinite(drawn) ? drawn : 0)
  if (!Number.isFinite(drawn)) return t
  const rate = isAir(state) || state === 'land' ? LERP_Y_AIR : LERP_Y_GROUND
  return drawn + (t - drawn) * (1 - Math.exp(-rate * dt))
}

/** Cheap pose hints for a remote figure (no rig has a jump clip): applied on top of the walk cycle each frame.
 *  tuck = feet up, armsUp = hands up, lean = forward tilt (rad), squash = body height scale, punch = right hand out, aim = both out. */
export interface PoseHint { tuck: number; armsUp: number; lean: number; squash: number; punch: number; aim: number }
const H0: PoseHint = { tuck: 0, armsUp: 0, lean: 0, squash: 1, punch: 0, aim: 0 }
export const POSE_HINTS: Record<MpState, PoseHint> = {
  ground: H0,
  jump: { ...H0, tuck: 0.7, armsUp: 0.6, lean: 0.08 },
  fall: { ...H0, tuck: 0.25, armsUp: 1, lean: -0.06 },
  land: { ...H0, squash: 0.86, lean: 0.1 },
  sprint: { ...H0, lean: 0.2 },
  slide: { ...H0, squash: 0.72, lean: -0.38 },
  crouch: { ...H0, squash: 0.8, lean: 0.12 },
  punch: { ...H0, punch: 1, lean: 0.12 },
  aim: { ...H0, aim: 1 },
  climb: { ...H0, armsUp: 1, tuck: 0.3 },
}
export const hintOf = (s: MpState | null): PoseHint => (s ? POSE_HINTS[s] : H0)

type Limb = { position: { x: number; y: number; z: number } }
/** Offset the keeper figure's floating limbs by a hint. Call AFTER poseKeeper (it re-seats every limb from its rest each frame,
 *  so nothing accumulates). The figure faces +Z. */
export function applyPoseHint(body: { getObjectByName(n: string): Limb | undefined }, h: PoseHint): void {
  if (h === H0) return
  for (const n of ['foot-l', 'foot-r']) { const p = body.getObjectByName(n); if (p) { p.position.y += h.tuck * 0.2; p.position.z -= h.tuck * 0.08 } }
  for (const n of ['hand-l', 'hand-r']) {
    const p = body.getObjectByName(n); if (!p) continue
    p.position.y += h.armsUp * 0.28 + h.aim * 0.14
    p.position.z += h.aim * 0.28 + (n === 'hand-r' ? h.punch * 0.4 : 0)
  }
}
