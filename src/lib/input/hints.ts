// ── What to SHOW the player for an action ─────────────────────────────────────────────────────
//
// A control hint is a CLAIM ABOUT A BINDING. Today the fold's hints are string literals in a div —
// `click to look · WASD · space jump · shift slide` — which is a claim nothing checks, and it is
// wrong the moment a player rebinds a key or picks up a controller. Same family as the comment that
// claimed the tool row followed a rule it did not: accurate when written, silently false later.
//
// So hints are RESOLVED from the live binding map, never typed out. That is what makes them safe to
// move into the tutorial, which is where Alex ruled they belong (2026-08-23) — the two-line dump in
// the HUD corner is onboarding wearing a HUD's clothes.
//
// ⚠⚠ THE FACE BUTTONS ARE NOT CALLED THE SAME THING ON EVERY PAD, AND THIS IS THE BUG THAT WOULD
// SHIP. Standard mapping is by INDEX: index 0 is Xbox A and PlayStation Cross; index 2 is Xbox X
// and PlayStation Square. Print the Xbox name to someone on a DualSense and you have told them to
// press a button that exists, is the wrong one, and sits where they will not question it — X and
// Square are not even in the same position. The shoulders are worse: Xbox LB/RB are PlayStation
// L1/R1, and LT/RT are L2/R2.

import { LABEL, type ActionId, type PadButton } from './actions'
import type { BindingMap } from './bindings'
import type { PadKind } from './gamepad'
import { chordOf } from './resolve'

/** `KeyboardEvent.code` → what a human calls that key. */
const KEY_NAME: Record<string, string> = {
  Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab',
  BracketLeft: '[', BracketRight: ']',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
}
export function keyName(code: string): string {
  if (KEY_NAME[code]) return KEY_NAME[code]
  if (code.startsWith('Key')) return code.slice(3)        // KeyF -> F
  if (code.startsWith('Digit')) return code.slice(5)      // Digit3 -> 3
  return code
}

/** Per-family button names for the SAME standard-mapping index. */
const PAD_NAME: Record<PadKind, Partial<Record<PadButton, string>>> = {
  xbox: {
    A: 'A', B: 'B', X: 'X', Y: 'Y',
    LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', SELECT: 'View', START: 'Menu',
  },
  playstation: {
    A: '✕', B: '○', X: '□', Y: '△',
    LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', SELECT: 'Create', START: 'Options',
  },
  generic: {},
}
const FALLBACK: Record<PadButton, string> = {
  A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT',
  SELECT: 'Select', START: 'Start', L3: 'L3', R3: 'R3',
  DUP: 'D-Up', DDOWN: 'D-Down', DLEFT: 'D-Left', DRIGHT: 'D-Right',
}
export function padName(b: PadButton, kind: PadKind): string {
  return PAD_NAME[kind][b] ?? FALLBACK[b]
}

/**
 * The hint for one action on the device the player is currently using.
 *
 * Returns `null` when the action has no binding on that device — the caller must omit the hint
 * rather than print an empty one. A hint reading "press  to craft" is worse than no hint.
 */
export function hintFor(map: BindingMap, id: ActionId, device: 'key' | 'pad', kind: PadKind = 'generic'): string | null {
  const b = map[id]
  if (device === 'pad') {
    if (b.pad.length) return padName(b.pad[0], kind)
    /**
     * ── ★★ A CHORD IS A BINDING, AND A HINT THAT CANNOT SEE ONE LIES ABOUT IT ────────────────
     * `cast.signature` is bound to RB+LB and has no single-button `pad` entry, so the old
     * one-line version above returned `null` for it — and `null` here means the caller OMITS the
     * hint. A controller player would be told the signature has no controller binding, on the
     * one screen whose whole job is to answer that. Silent, and it looks like a design decision.
     *
     * ⚠ RENDERED IN CHORD ORDER, WHICH IS PERFORMANCE ORDER: `[modifier, …, trigger]` reads
     * "RB + LB" = hold RB, tap LB. Sorting or reversing it for looks would teach the wrong hand.
     */
    const ch = chordOf(b)
    return ch.length ? ch.map(x => padName(x, kind)).join(' + ') : null
  }
  return b.keys.length ? keyName(b.keys[0]) : null
}

export interface Hint { id: ActionId; label: string; input: string }

/**
 * Resolve a list of actions into printable hints, dropping any the current device cannot perform.
 *
 * This is what a tutorial step calls: it names the ACTIONS the step is teaching and gets back
 * whatever the player's own controls happen to say — rebound keys and controller glyphs included,
 * with no per-step string to go stale.
 */
export function hintsFor(map: BindingMap, ids: readonly ActionId[], device: 'key' | 'pad', kind: PadKind = 'generic'): Hint[] {
  const out: Hint[] = []
  for (const id of ids) {
    const input = hintFor(map, id, device, kind)
    if (input) out.push({ id, label: LABEL[id], input })
  }
  return out
}
