// ── HAND ACTIONS: an item's motion as a LOOP OF POSES (BETA M82, Alex 11-22) ───────────────────────────────────────────────
// The hands tuner (/shimmer/dev/hands, Actions) authors these: pick an item + an action, set a few key poses for the RIGHT
// mitt (where it sits and how it is turned, in camera space, the same numbers as the Hold), each with the time it takes to
// get there, how long it holds and how it eases, then play the loop. Export copies the JSON; pasted to Jin it becomes
// ACTION_DEFAULTS below, the shipped motion for everyone (like FP_DEFAULTS for the holds).
//
// Pure: no three, no React. The tuner and the game both sample with `sampleAction`.
//   key i is REACHED at the end of its `ms` (moving from key i-1, or from the last key when it loops), then HELD `hold` ms.
//   So a 3-key loop runs: [move to k0][hold k0][move to k1][hold k1][move to k2][hold k2] and wraps to k0.
//   Not looping (a one-shot, like the cast in game): the first key's move starts from the first key itself (no move), and
//   time past the end stays on the last key.
import { eulerQ, slerpQ, type Quat } from './fp-hands-pose'
// ★ Alex's punches, read AT BUILD TIME from the handoff file (hub 11-22: "read the file, not a copy, so later ones just land"):
// a new variant = one more entry in its variants[] (the tuner's Copy action pastes straight in)
import PUNCHES from '../../../../../docs/handoff/punch-actions-2026-11-22.json'

export type Ease = 'linear' | 'in' | 'out' | 'inout'
export const EASES: Ease[] = ['linear', 'in', 'out', 'inout']
export interface ActionKey { x: number; y: number; z: number; pitch: number; roll: number; yaw: number; ms: number; hold: number; ease: Ease }
export type ActionItem = 'rinstick' | 'melee'
export interface HandAction { id: string; item: ActionItem; label: string; keys: ActionKey[]; /** the key the blow lands on (default: the one reaching farthest forward) */ strike?: number }
export interface ActionPose { x: number; y: number; z: number; pitch: number; roll: number; yaw: number; q: Quat }

export const POSE_FIELDS = ['x', 'y', 'z', 'pitch', 'roll', 'yaw'] as const

/** the shipped motions (right mitt, camera space, metres / radians / ms). Change them in the tuner, then paste them here. */
export const ACTION_DEFAULTS: Readonly<Record<string, HandAction>> = {
  // in game it plays ONCE from the click (key 1's move is skipped), and the float leaves on the click: keep the flick early
  'rinstick.cast': { id: 'rinstick.cast', item: 'rinstick', label: 'Rinstick · cast', keys: [
    { x: 0.355, y: -0.415, z: -0.56, pitch: -1.4, roll: 0.63, yaw: 0, ms: 260, hold: 0, ease: 'inout' },     // ready
    { x: 0.38, y: -0.2, z: -0.44, pitch: -0.6, roll: 0.35, yaw: 0, ms: 150, hold: 40, ease: 'out' },        // back over the shoulder
    { x: 0.33, y: -0.36, z: -0.7, pitch: -1.75, roll: 0.55, yaw: 0, ms: 100, hold: 260, ease: 'in' },        // the flick out
  ] },
  // the swing the tuner opens on = Alex's punch #1 (the game plays the whole POOL below, one at random per punch)
  'melee.swing': { id: 'melee.swing', item: 'melee', label: 'Melee · swing', keys: [] },
}
export const ACTION_IDS = Object.keys(ACTION_DEFAULTS)

const ease = (e: Ease, u: number) => e === 'in' ? u * u : e === 'out' ? 1 - (1 - u) * (1 - u) : e === 'inout' ? u * u * (3 - 2 * u) : u
const qOf = (k: Pick<ActionKey, 'pitch' | 'roll' | 'yaw'>): Quat => eulerQ(k.pitch, k.yaw, k.roll)   // XYZ, as holdTurn
const span = (k: ActionKey) => Math.max(0, k.ms) + Math.max(0, k.hold)

/** one pass through the keys, ms (a one-shot skips the first key's move: it starts there) */
export function actionDuration(a: HandAction, loop = true): number {
  return a.keys.reduce((t, k, i) => t + (i === 0 && !loop ? Math.max(0, k.hold) : span(k)), 0)
}

/** where key i's move starts, in ms from the start of a pass */
export function keyStart(a: HandAction, i: number, loop = true): number {
  let t = 0
  for (let j = 0; j < i; j++) t += j === 0 && !loop ? Math.max(0, a.keys[0].hold) : span(a.keys[j])
  return t
}

/** the mitt's pose `t` ms into the action. Looping wraps; a one-shot clamps to its last key. */
export function sampleAction(a: HandAction, t: number, loop = true): ActionPose {
  const ks = a.keys, n = ks.length
  if (n === 0) return { x: 0, y: 0, z: 0, pitch: 0, roll: 0, yaw: 0, q: [0, 0, 0, 1] }
  const pose = (k: ActionKey): ActionPose => ({ x: k.x, y: k.y, z: k.z, pitch: k.pitch, roll: k.roll, yaw: k.yaw, q: qOf(k) })
  const dur = actionDuration(a, loop)
  if (n === 1 || dur <= 0) return pose(ks[0])
  let u = loop ? ((t % dur) + dur) % dur : Math.max(0, Math.min(dur, t))
  if (!loop && u >= dur) return pose(ks[n - 1])
  for (let i = 0; i < n; i++) {
    const k = ks[i], mv = i === 0 && !loop ? 0 : Math.max(0, k.ms), here = mv + Math.max(0, k.hold)
    if (u < here || i === n - 1) {
      if (u >= mv) return pose(k)
      const from = ks[i === 0 ? n - 1 : i - 1], w = ease(k.ease, u / mv)
      const L = (f: (typeof POSE_FIELDS)[number]) => from[f] + (k[f] - from[f]) * w
      return { x: L('x'), y: L('y'), z: L('z'), pitch: L('pitch'), roll: L('roll'), yaw: L('yaw'), q: slerpQ(qOf(from), qOf(k), w) }
    }
    u -= here
  }
  return pose(ks[n - 1])
}

// ── the draft (this browser, a DEVICE key like the hands tune: never synced) ──
export const ACTIONS_KEY = 'open:hands-actions.v1'
const num = (v: unknown, d: number) => typeof v === 'number' && Number.isFinite(v) ? v : d
/** a pasted / stored action, made safe: unknown fields dropped, numbers checked, at least one key */
export function cleanAction(raw: unknown, base: HandAction): HandAction {
  const r = (raw ?? {}) as Partial<HandAction>
  const keys = Array.isArray(r.keys) ? r.keys.map((k0): ActionKey => {
    const k = (k0 ?? {}) as Partial<ActionKey>, b = base.keys[0]
    return { x: num(k.x, b.x), y: num(k.y, b.y), z: num(k.z, b.z), pitch: num(k.pitch, b.pitch), roll: num(k.roll, b.roll), yaw: num(k.yaw, b.yaw),
      ms: Math.max(0, num(k.ms, b.ms)), hold: Math.max(0, num(k.hold, b.hold)), ease: EASES.includes(k.ease as Ease) ? k.ease as Ease : 'linear' }
  }) : []
  return { ...base, keys: keys.length ? keys : base.keys.map(k => ({ ...k })) }
}
const copyOf = (a: HandAction): HandAction => ({ ...a, keys: a.keys.map(k => ({ ...k })) })
/** LIVE actions: the defaults, overwritten by this browser's draft (loadActions). */
export const ACTIONS: Record<string, HandAction> = Object.fromEntries(ACTION_IDS.map(id => [id, copyOf(ACTION_DEFAULTS[id])]))
export function loadActions(): void {
  let saved: Record<string, unknown> = {}
  try { saved = JSON.parse(localStorage.getItem(ACTIONS_KEY) ?? '{}') ?? {} } catch { /* private window: the defaults */ }
  for (const id of ACTION_IDS) ACTIONS[id] = saved[id] ? cleanAction(saved[id], ACTION_DEFAULTS[id]) : copyOf(ACTION_DEFAULTS[id])
}
export function setAction(a: HandAction): void {
  if (!ACTION_DEFAULTS[a.id]) return
  ACTIONS[a.id] = cleanAction(a, ACTION_DEFAULTS[a.id])
  try { localStorage.setItem(ACTIONS_KEY, JSON.stringify(ACTIONS)) } catch { /* private window */ }
}
export function resetAction(id: string): void {
  if (!ACTION_DEFAULTS[id]) return
  ACTIONS[id] = copyOf(ACTION_DEFAULTS[id])
  try { localStorage.setItem(ACTIONS_KEY, JSON.stringify(ACTIONS)) } catch { /* private window */ }
}
/** the export: one action, as JSON to paste */
export const exportAction = (a: HandAction) => JSON.stringify({ id: a.id, keys: a.keys })

/** M82 s2: an action played ONCE from `t` = 0 (ms since it started), as the pose stepper's actionR: full weight through the
 *  action, then it hands the mitt back over FADE_MS; undefined before it starts and once it is done. */
export const FADE_MS = 220
export function oneShot(a: HandAction, t: number): (ActionPose & { w: number }) | undefined {
  if (!(t >= 0)) return undefined
  const dur = actionDuration(a, false)
  if (t >= dur + FADE_MS) return undefined
  return { ...sampleAction(a, t, false), w: t <= dur ? 1 : 1 - (t - dur) / FADE_MS }
}

// ── THE PUNCH POOL (Alex 11-22): every real punch picks one of his authored variants, never the same twice in a row ──
const SWING_BASE: HandAction = { id: 'melee.swing', item: 'melee', label: 'Melee · swing', keys: [
  { x: 0.355, y: -0.415, z: -0.56, pitch: -1.4, roll: 0.63, yaw: 0, ms: 200, hold: 0, ease: 'inout' },
  { x: 0.08, y: -0.34, z: -0.74, pitch: -1.6, roll: -0.15, yaw: 0, ms: 80, hold: 110, ease: 'in' },
] }
const rawPool = ((PUNCHES as { variants?: unknown[] }).variants ?? [])
export const MELEE_POOL: HandAction[] = (rawPool.length ? rawPool : [SWING_BASE]).map((v, i) => ({ ...cleanAction(v, SWING_BASE), label: `Melee · punch ${i + 1}` }))
;(ACTION_DEFAULTS as Record<string, HandAction>)['melee.swing'] = { ...MELEE_POOL[0], label: 'Melee · swing' }
ACTIONS['melee.swing'] = copyOf(ACTION_DEFAULTS['melee.swing'])
/** the key a blow lands on: `strike` if the variant names one, else the key reaching farthest forward (the punch's extension) */
export function strikeKey(a: HandAction): number {
  if (typeof a.strike === 'number' && a.strike >= 0 && a.strike < a.keys.length) return a.strike
  let best = 0; a.keys.forEach((k, i) => { if (k.z < a.keys[best].z) best = i }); return best
}
/** ms from the click to the blow landing, played as a one-shot (melee-view applies the hit then) */
export const strikeMs = (a: HandAction) => { const i = strikeKey(a); return keyStart(a, i, false) + (i === 0 ? 0 : a.keys[i].ms) }
const sameKeys = (a: HandAction, b: HandAction) => JSON.stringify(a.keys) === JSON.stringify(b.keys)
/** the punches this browser plays: the pool, plus a tuner draft that is not one of them yet (so Alex sees a new one in game) */
export function swingPool(): HandAction[] {
  const d = ACTIONS['melee.swing']
  return d && d.keys.length && !MELEE_POOL.some(v => sameKeys(v, d)) ? [...MELEE_POOL, d] : MELEE_POOL
}
/** pick the next punch: random, never the same as the last once there are 2+ */
export function pickSwing(prev: number, rand: () => number = Math.random): { i: number; action: HandAction } {
  const pool = swingPool()
  let i = Math.floor(rand() * pool.length) % pool.length
  if (pool.length > 1 && i === prev) i = (i + 1 + Math.floor(rand() * (pool.length - 1))) % pool.length
  return { i, action: pool[i] }
}
