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

export type Ease = 'linear' | 'in' | 'out' | 'inout'
export const EASES: Ease[] = ['linear', 'in', 'out', 'inout']
export interface ActionKey { x: number; y: number; z: number; pitch: number; roll: number; yaw: number; ms: number; hold: number; ease: Ease }
export type ActionItem = 'rinstick' | 'melee'
export interface HandAction { id: string; item: ActionItem; label: string; keys: ActionKey[] }
export interface ActionPose { x: number; y: number; z: number; pitch: number; roll: number; yaw: number; q: Quat }

export const POSE_FIELDS = ['x', 'y', 'z', 'pitch', 'roll', 'yaw'] as const

/** the shipped motions (right mitt, camera space, metres / radians / ms). Change them in the tuner, then paste them here. */
export const ACTION_DEFAULTS: Readonly<Record<string, HandAction>> = {
  'rinstick.cast': { id: 'rinstick.cast', item: 'rinstick', label: 'Rinstick · cast', keys: [
    { x: 0.355, y: -0.415, z: -0.56, pitch: -1.4, roll: 0.63, yaw: 0, ms: 260, hold: 120, ease: 'inout' },   // ready
    { x: 0.38, y: -0.2, z: -0.44, pitch: -0.6, roll: 0.35, yaw: 0, ms: 320, hold: 80, ease: 'out' },        // back over the shoulder
    { x: 0.3, y: -0.32, z: -0.74, pitch: -1.9, roll: 0.5, yaw: 0, ms: 140, hold: 260, ease: 'in' },          // the flick out
  ] },
  'melee.swing': { id: 'melee.swing', item: 'melee', label: 'Melee · swing', keys: [
    { x: 0.355, y: -0.415, z: -0.56, pitch: -1.4, roll: 0.63, yaw: 0, ms: 200, hold: 60, ease: 'inout' },   // ready
    { x: 0.44, y: -0.3, z: -0.46, pitch: -1.1, roll: 1.05, yaw: 0, ms: 180, hold: 40, ease: 'out' },        // wind up, out to the right
    { x: 0.06, y: -0.34, z: -0.76, pitch: -1.6, roll: -0.15, yaw: 0, ms: 110, hold: 120, ease: 'in' },       // the hit, across the middle
  ] },
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
