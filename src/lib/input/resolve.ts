// ── Raw input state → action state ────────────────────────────────────────────────────────────
//
// The bridge the game actually calls. Pure on purpose: `VoxelWorld.tsx` currently decides what a
// key means inline, 25 times, inside three separate listeners — so the meaning of a key is spread
// across an 8540-line component and cannot be tested at all. Everything here is data-in/data-out so
// the rules live somewhere with an oracle, and the component is left holding only the wiring.
//
// The conversion this enables is mechanical:
//     if (e.code === 'KeyF')            →  if (matches(map, e.code, 'item.draw'))
//     if (k.KeyW)                       →  if (held.has('move.forward'))
// which matters, because a wide shallow diff over 25 sites is exactly the kind that hides a
// transcription slip. A mechanical swap against a tested matcher is reviewable; 25 bespoke edits
// are not.

import { ALL_ACTIONS, STICK_DRIVEN, type ActionId } from './actions'
import type { BindingMap } from './bindings'
import type { PadSample } from './gamepad'

/** Does this `KeyboardEvent.code` trigger this action under the player's bindings? */
export function matches(map: BindingMap, code: string, id: ActionId): boolean {
  return map[id].keys.includes(code)
}

/**
 * Every action this key triggers.
 *
 * ⚠ RETURNS A LIST, NOT AN ACTION. KeyQ genuinely drives both Drop and Cycle, and the shipped
 * handler picks between them by whether the weapon is drawn. A `actionFor(code): ActionId` shape
 * would have to invent a winner, silently dropping the other — so the ambiguity is handed to the
 * caller, which is the only place that knows the context.
 */
export function actionsFor(map: BindingMap, code: string): ActionId[] {
  return ALL_ACTIONS.filter(id => map[id].keys.includes(code))
}

/**
 * The set of actions currently HELD, from both devices at once.
 *
 * ⚠ THE TWO DEVICES UNION, THEY DO NOT SWITCH. A player with a pad connected may still have a hand
 * on the keyboard — and more to the point, an "active device" flag has to be decided by something,
 * and every rule for deciding it is wrong at some moment (last-input-wins makes a resting stick
 * beat a held key; pad-present-wins makes a plugged-in-but-idle controller kill the keyboard).
 * Unioning has no such moment. Device detection is for what to DISPLAY, never for what to obey.
 */
export function heldActions(map: BindingMap, downCodes: Iterable<string>, pad: PadSample | null): Set<ActionId> {
  const out = new Set<ActionId>()
  const codes = new Set(downCodes)
  for (const id of ALL_ACTIONS) {
    if (map[id].keys.some(k => codes.has(k))) { out.add(id); continue }
    if (pad && map[id].pad.some(b => pad.down.has(b))) out.add(id)
  }
  return out
}

/** Actions whose controller button went down THIS frame — the pad's edge-triggered half. */
export function padPressed(map: BindingMap, pad: PadSample | null): Set<ActionId> {
  const out = new Set<ActionId>()
  if (!pad) return out
  for (const id of ALL_ACTIONS) if (map[id].pad.some(b => pad.pressed.has(b))) out.add(id)
  return out
}

/**
 * The left stick as a movement wish, in the same shape the keyboard produces.
 *
 * ⚠ RETURNS ANALOG MAGNITUDES, NOT BOOLEANS, and that is the point of having a stick. Collapsing
 * it to `forward: true` throws away the difference between a walk and a sprint and makes a £60
 * controller strictly worse than four keys. The caller scales its move vector by these.
 *
 * ⚠ `y` IS NEGATED HERE. The Gamepad API reports up as NEGATIVE on the vertical axis; the game's
 * forward wish is positive. Doing it at the boundary means exactly one place can get it wrong,
 * instead of every caller getting a chance to.
 */
export function stickMove(pad: PadSample | null): { forward: number; right: number } {
  if (!pad) return { forward: 0, right: 0 }
  return { forward: -pad.ly, right: pad.lx }
}

/** Actions the keyboard alone can never trigger — used to decide what a hint may promise. */
export function keyboardOnlyUnreachable(map: BindingMap): ActionId[] {
  return ALL_ACTIONS.filter(id => map[id].keys.length === 0 && !STICK_DRIVEN.includes(id))
}
