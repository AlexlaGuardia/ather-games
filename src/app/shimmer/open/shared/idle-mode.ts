// M91 s1: THE FOLLOWER'S ROOM + THE IDLE MODE (Alex 11-22: "like a tail right behind me at all times.. give it some room, and if
// i stand still for too long an idle mode.. the follower walks around, naps.. the camera looks around.. just randomly").
// PURE, so the test drives it: the follow decision (gap + hysteresis), the follower's idle behaviour (wander / sit / nap),
// and the camera's idle (store the keeper's yaw/pitch, drift, hand it back EXACTLY on any input). A tiny module store at the
// bottom connects the window's input and the two worlds' camera drivers (ather/walker.tsx, continent/page.tsx) to it.

// ── 1. following with room ────────────────────────────────────────────────────────────────────────────────────
/** the follower holds a 3-6 m gap: it does not move until the keeper is FOLLOW_START away, then ambles to REST_GOAL and
 *  stops once inside SETTLE (hysteresis: START > SETTLE, so a small step never makes it twitch) */
export const FOLLOW = { START: 6, SETTLE: 4.6, GOAL: 4.2, MIN_SPEED: 1.2, MAX_SPEED: 9, TELEPORT: 24 }
export interface FollowState { x: number; z: number; speed: number; moving: boolean }

export function followStep(s: FollowState, px: number, pz: number, dt: number): FollowState {
  const dx = s.x - px, dz = s.z - pz, d = Math.hypot(dx, dz)
  let moving = s.moving
  if (!moving && d > FOLLOW.START) moving = true
  if (moving && d <= FOLLOW.SETTLE) moving = false
  // it comes to a point GOAL from the keeper on the line to where it already stands, not the keeper's own path
  const ux = d > 1e-6 ? dx / d : 0, uz = d > 1e-6 ? dz / d : 1
  const gx = px + ux * FOLLOW.GOAL, gz = pz + uz * FOLLOW.GOAL
  const want = moving ? Math.min(FOLLOW.MAX_SPEED, FOLLOW.MIN_SPEED + Math.max(0, d - FOLLOW.GOAL) * 1.4) : 0
  const speed = s.speed + (want - s.speed) * Math.min(1, dt * 4)
  let x = s.x, z = s.z
  const rx = gx - x, rz = gz - z, rd = Math.hypot(rx, rz)
  if (speed > 1e-3 && rd > 1e-4) { const step = Math.min(rd, speed * dt); x += (rx / rd) * step; z += (rz / rd) * step }
  return { x, z, speed, moving }
}

// ── 2. the follower while the keeper idles: wander near them, sit, nap ───────────────────────────────────────────
export type IdlePhase = 'wander' | 'sit' | 'nap'
export interface IdleFollowState { phase: IdlePhase; t: number; goalX: number; goalZ: number; x: number; z: number; speed: number }
export const IDLE_FOLLOW = { WALK: 1.1, RING_MIN: 3, RING_MAX: 6, SIT: [3, 6], NAP: [12, 22] } as const
const span = (r: readonly [number, number] | readonly number[], rand: () => number) => r[0] + (r[1] - r[0]) * rand()

export function pickWanderGoal(px: number, pz: number, rand: () => number): { x: number; z: number } {
  const a = rand() * Math.PI * 2, r = IDLE_FOLLOW.RING_MIN + (IDLE_FOLLOW.RING_MAX - IDLE_FOLLOW.RING_MIN) * rand()
  return { x: px + Math.cos(a) * r, z: pz + Math.sin(a) * r }
}
export function idleFollowStart(x: number, z: number): IdleFollowState { return { phase: 'sit', t: 2, goalX: x, goalZ: z, x, z, speed: 0 } }

export function idleFollowStep(s: IdleFollowState, px: number, pz: number, dt: number, rand: () => number): IdleFollowState {
  let { phase, t, goalX, goalZ, x, z } = s
  let speed = 0
  if (phase === 'wander') {
    const rx = goalX - x, rz = goalZ - z, rd = Math.hypot(rx, rz)
    if (rd < 0.15) { phase = 'sit'; t = span(IDLE_FOLLOW.SIT, rand) }
    else { speed = IDLE_FOLLOW.WALK; const step = Math.min(rd, speed * dt); x += (rx / rd) * step; z += (rz / rd) * step }
  } else {
    t -= dt
    if (t <= 0) {
      if (phase === 'sit' && rand() < 0.55) { phase = 'nap'; t = span(IDLE_FOLLOW.NAP, rand) }
      else { phase = 'wander'; const g = pickWanderGoal(px, pz, rand); goalX = g.x; goalZ = g.z }
    }
  }
  return { phase, t, goalX, goalZ, x, z, speed }
}

// ── 3. the camera's idle: store the view, drift about it, give it back EXACTLY ───────────────────────────────────
export const IDLE_AFTER = 25   // seconds with no key / mouse / touch
/** TODO(M82): the 'inspect' / glance-at-hands action goes here once the hands tuner exports its poses; look-around only for now */
export const IDLE_ACTIONS = ['look-around'] as const
export type IdleAction = typeof IDLE_ACTIONS[number]
export interface View { yaw: number; pitch: number }
export interface IdleCamState { idle: boolean; quiet: number; seq: number; base: View; off: View; goal: View; hold: number; action: IdleAction }
export const idleCamFresh = (seq = 0): IdleCamState => ({ idle: false, quiet: 0, seq, base: { yaw: 0, pitch: 0 }, off: { yaw: 0, pitch: 0 }, goal: { yaw: 0, pitch: 0 }, hold: 0, action: 'look-around' })

const PITCH_LO = -0.3, PITCH_HI = 0.2
/**
 * One frame. `seq` is a counter the window bumps on every input; `blocked` is combat / a menu / driving.
 * Returns the next state plus `apply`: the view to write into the camera driver this frame (null = leave the player's own).
 * Input or a block while idle returns the stored base, so the keeper gets the exact view they left, same frame.
 */
export function idleCamStep(s: IdleCamState, dt: number, seq: number, blocked: boolean, look: View, rand: () => number): { state: IdleCamState; apply: View | null } {
  if (seq !== s.seq || blocked) {
    const apply = s.idle ? { yaw: s.base.yaw, pitch: s.base.pitch } : null
    return { state: { ...idleCamFresh(seq) }, apply }
  }
  if (!s.idle) {
    const quiet = s.quiet + dt
    if (quiet < IDLE_AFTER) return { state: { ...s, quiet }, apply: null }
    const base = { yaw: look.yaw, pitch: look.pitch }
    return { state: { ...s, idle: true, quiet, base, off: { yaw: 0, pitch: 0 }, goal: { yaw: 0, pitch: 0 }, hold: 0, action: IDLE_ACTIONS[0] }, apply: null }
  }
  let { hold, goal } = s
  hold -= dt
  if (hold <= 0) {   // a new glance: somewhere within ~70 degrees either side, a little up or down, then rest on it
    hold = 2.5 + rand() * 3.5
    goal = { yaw: (rand() * 2 - 1) * 1.2, pitch: Math.max(PITCH_LO - s.base.pitch, Math.min(PITCH_HI - s.base.pitch, (rand() * 2 - 1) * 0.2)) }
  }
  const k = Math.min(1, dt * 0.9)
  const off = { yaw: s.off.yaw + (goal.yaw - s.off.yaw) * k, pitch: s.off.pitch + (goal.pitch - s.off.pitch) * k }
  return { state: { ...s, hold, goal, off }, apply: { yaw: s.base.yaw + off.yaw, pitch: s.base.pitch + off.pitch } }
}

// ── 4. the store: one per page ─────────────────────────────────────────────────────────────────────────────────
let seq = 0, clock = 0, combatUntil = -1, cam = idleCamFresh()
/** the window saw the keeper do something */
export const noteInput = () => { seq++ }
/** a hit landed or the keeper was hurt: no idling for a while */
export const noteCombat = () => { combatUntil = clock + 8; seq++ }
export const isIdle = () => cam.idle
/** the camera drivers call this once per frame with their own view; it rewrites `look` while idle and restores it on input */
export function tickIdleCam(dt: number, look: View, blocked: boolean, rand: () => number = Math.random): boolean {
  clock += dt
  const r = idleCamStep(cam, dt, seq, blocked || clock < combatUntil, look, rand)
  cam = r.state
  if (r.apply) { look.yaw = r.apply.yaw; look.pitch = r.apply.pitch }
  return cam.idle
}
/** window listeners that count as "the keeper did something"; returns the cleanup */
export function installIdleInput(): () => void {
  if (typeof window === 'undefined') return () => {}
  const bump = () => { seq++ }
  const move = (e: MouseEvent) => { if (e.movementX || e.movementY) seq++ }
  const ev = ['keydown', 'mousedown', 'pointerdown', 'touchstart', 'touchmove', 'wheel'] as const
  ev.forEach(n => window.addEventListener(n, bump, { passive: true, capture: true }))
  window.addEventListener('mousemove', move, { passive: true, capture: true })
  return () => { ev.forEach(n => window.removeEventListener(n, bump, { capture: true })); window.removeEventListener('mousemove', move, { capture: true }) }
}
/** Test hook. */
export function _resetIdle() { seq = 0; clock = 0; combatUntil = -1; cam = idleCamFresh() }
