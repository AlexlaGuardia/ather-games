// THE CONTROLLER IN THE OPEN WORLD (BETA M186, Alex 11-26: a PS5 pad on the elitedesk "doesnt seem to be responding
// although its connected"). The open world read no gamepad at all; only voxel3d did. This is NOT a second input system:
// it samples the SAME module (src/lib/input/gamepad.ts) and resolves it through the SAME bindings (the 08-28 map in
// src/lib/input/actions.ts, resolve.ts › padPressed / chords), then speaks to the open world the way the phone already
// does: the sticks and the triggers go into the touch store (shared/touch.ts), and every button becomes the key code the
// pages already listen for. So the pad drives the very same walker, gun and menus as WASD + mouse, never a fork of them.
//
//   left stick → touch.move (analog)        right stick → touch.look (px-equivalent, consumed by walker / continent)
//   A jump (Space, held)   L3 slide (ShiftLeft, held)   X use / talk / reload / mine (KeyE)   Y draw · swap · hold stow (KeyR)
//   RT fire (touch.fire)   LT sights (touch.aim, held)   RB charge the mana skin (KeyF, held)   LB tactical (KeyQ)
//   RB + LB signature (KeyX)   SELECT map (KeyM)   D-up bag (KeyI)   START options (KeyO)   B close (Escape)
//   D-left / D-right: the hotbar, one slot each way (the wheel needs pointer lock, a pad never has it)
// In a MENU (a panel, Options, a talk): the d-pad sends arrows (talk choices, the birth gate) and, when nothing took the
// arrow, moves a focus ring over the buttons on screen; A is Enter, or a click on the ringed button; LB/RB are Tab.
//
// This file is pure (no DOM): `padStep` turns one sample into a list of effects so the rules have a test (pad.test.ts).
// shared/pad-bridge.tsx applies them every frame.

import type { ActionId, PadButton } from '@/lib/input/actions'
import type { BindingMap } from '@/lib/input/bindings'
import type { PadSample } from '@/lib/input/gamepad'
import { chordOf, padPressed, stickMove } from '@/lib/input/resolve'

/** voxel3d action → the open-world key code it presses. Only actions the open world HAS are listed (no place, drop, craft, rotate). */
export const OPEN_CODE: Partial<Record<ActionId, string>> = {
  'move.jump': 'Space',
  'move.slide': 'ShiftLeft',
  'world.interact': 'KeyE',
  'item.draw': 'KeyR',
  'ui.map': 'KeyM',
  'ui.inventory': 'KeyI',
  'ui.close': 'Escape',
  'ui.settings': 'KeyO',
  'cast.tactical': 'KeyQ',
  'cast.signature': 'KeyX',
  'cast.focus': 'KeyF',
}
/** Actions whose pad button is read as the gun's trigger and sights, not as a key. */
export const FIRE_ACTION: ActionId = 'world.mine'
export const AIM_ACTION: ActionId = 'world.place'
/** In a menu these still mean what they mean outside it (close, options, map). Everything else is navigation. */
const MENU_PASS: readonly ActionId[] = ['ui.close', 'ui.settings', 'ui.map']

/** Full stick = this many radians a second of turn. A squared curve keeps a small push fine for aiming. */
export const PAD_LOOK_RAD_S = 3.2

export interface PadState {
  /** action → the code we sent a keydown for and still owe a keyup */
  down: Map<ActionId, string>
  fire: boolean
  aim: boolean
  moving: boolean
}
export const newPadState = (): PadState => ({ down: new Map(), fire: false, aim: false, moving: false })

export type PadEffect =
  | { t: 'keydown' | 'keyup'; code: string }
  | { t: 'tap'; code: string }                         // down + up at once (a chord, a menu key)
  | { t: 'move'; x: number; y: number }               // touch.move (x strafe right, y forward)
  | { t: 'look'; dx: number; dy: number }             // radians this frame (bridge converts to touch px)
  | { t: 'fire' | 'aim'; on: boolean }
  | { t: 'hotbar'; dir: 1 | -1 }
  | { t: 'nav'; dir: 'up' | 'down' | 'left' | 'right' }   // the menu's arrow: arrow key first, focus ring if unclaimed
  | { t: 'accept' }                                    // the menu's A: Enter first, click the ringed button if unclaimed

const anyDown = (map: BindingMap, id: ActionId, pad: PadSample) =>
  map[id].pad.some(b => pad.down.has(b)) || (chordOf(map[id]).length > 0 && chordOf(map[id]).every(b => pad.down.has(b)))

/** Let go of everything we are holding for the page (a menu opened, the pad went quiet, the window blurred). */
export function releaseAll(s: PadState): PadEffect[] {
  const out: PadEffect[] = []
  for (const code of s.down.values()) out.push({ t: 'keyup', code })
  s.down.clear()
  if (s.fire) { out.push({ t: 'fire', on: false }); s.fire = false }
  if (s.aim) { out.push({ t: 'aim', on: false }); s.aim = false }
  if (s.moving) { out.push({ t: 'move', x: 0, y: 0 }); s.moving = false }
  return out
}

/** One frame of controller → open world. Mutates `s` (what is held), returns what to do. */
export function padStep(s: PadState, pad: PadSample | null, map: BindingMap, menuOpen: boolean, dt: number): PadEffect[] {
  if (!pad) return releaseAll(s)
  const out: PadEffect[] = []
  const pressed = padPressed(map, pad)
  const edge = (b: PadButton) => pad.pressed.has(b)

  if (menuOpen) {
    out.push(...releaseAll(s))
    for (const id of MENU_PASS) if (pressed.has(id)) out.push({ t: 'tap', code: OPEN_CODE[id]! })
    if (edge('DUP')) out.push({ t: 'nav', dir: 'up' })
    if (edge('DDOWN')) out.push({ t: 'nav', dir: 'down' })
    if (edge('DLEFT')) out.push({ t: 'nav', dir: 'left' })
    if (edge('DRIGHT')) out.push({ t: 'nav', dir: 'right' })
    if (edge('A')) out.push({ t: 'accept' })
    if (edge('LB') || edge('RB')) out.push({ t: 'tap', code: 'Tab' })
    return out
  }

  // buttons → keys: down on the edge (a chord's trigger is eaten by padPressed), up when its buttons let go
  for (const id of pressed) {
    const code = OPEN_CODE[id]; if (!code) continue
    if (chordOf(map[id]).length >= 2 && !map[id].pad.some(b => pad.pressed.has(b))) { out.push({ t: 'tap', code }); continue }
    if (s.down.has(id)) continue
    s.down.set(id, code); out.push({ t: 'keydown', code })
  }
  for (const [id, code] of [...s.down]) if (!anyDown(map, id, pad)) { s.down.delete(id); out.push({ t: 'keyup', code }) }

  // the gun: RT is the trigger (set on the press only, so a semi-auto the combat clears does not refire while held), LT the sights
  const fireNow = map[FIRE_ACTION].pad.some(b => pad.down.has(b))
  if (fireNow && map[FIRE_ACTION].pad.some(edge)) { s.fire = true; out.push({ t: 'fire', on: true }) }
  else if (!fireNow && s.fire) { s.fire = false; out.push({ t: 'fire', on: false }) }
  const aimNow = map[AIM_ACTION].pad.some(b => pad.down.has(b))
  if (aimNow !== s.aim) { s.aim = aimNow; out.push({ t: 'aim', on: aimNow }) }

  if (edge('DLEFT')) out.push({ t: 'hotbar', dir: -1 })
  if (edge('DRIGHT')) out.push({ t: 'hotbar', dir: 1 })

  // sticks: written only while pushed (and once more to let go), so a resting pad never stomps the phone's own stick
  const m = stickMove(pad)
  if (m.forward || m.right) { s.moving = true; out.push({ t: 'move', x: m.right, y: m.forward }) }
  else if (s.moving) { s.moving = false; out.push({ t: 'move', x: 0, y: 0 }) }
  if (pad.rx || pad.ry) {
    const k = PAD_LOOK_RAD_S * dt
    out.push({ t: 'look', dx: pad.rx * Math.abs(pad.rx) * k, dy: pad.ry * Math.abs(pad.ry) * k })
  }
  return out
}

/** The small on-screen legend while a pad is in use. Placeholder words (for @lark). */
export const PAD_HINTS: { b: PadButton; label: string }[] = [
  { b: 'A', label: 'jump' }, { b: 'X', label: 'use' }, { b: 'Y', label: 'draw' }, { b: 'RT', label: 'fire' },
  { b: 'LT', label: 'aim' }, { b: 'DUP', label: 'bag' }, { b: 'SELECT', label: 'map' }, { b: 'START', label: 'options' },
]
export const PAD_MENU_HINTS: { b: PadButton; label: string }[] = [{ b: 'A', label: 'pick' }, { b: 'B', label: 'close' }]

// ── M186 s2: who holds the game, the pad or the mouse / keys (Alex 11-26: 'when the mouse takes over i need a cursor') ──
/** The pad TAKES the game on a button press or a stick pushed past half (not a resting drift inside the deadzone's edge). */
export const PAD_TAKE_STICK = 0.5
export function padActed(p: PadSample | null): boolean {
  if (!p) return false
  return p.pressed.size > 0 || Math.max(Math.abs(p.lx), Math.abs(p.ly), Math.abs(p.rx), Math.abs(p.ry)) > PAD_TAKE_STICK
}
/** A world prompt says the key ('E · Gregory'). With a pad in hand it says the pad's button for the same action instead
 *  ('□ · Gregory'): the leading 'E · ' and any 'hold E'. `glyph` null = no pad: the text as it is. */
export function padPrompt(text: string, glyph: string | null): string {
  if (!glyph) return text
  return text.replace(/^E · /, `${glyph} · `).replace(/\bhold E\b/g, `hold ${glyph}`)
}
/** Chrome runs audio only after a real click / key / tap; a pad press is not one. Placeholder words (for @lark). */
export const SOUND_OFF_NOTE = { click: 'Sound is off · click or press a key once to turn it on', tap: 'Sound is off · tap the screen once to turn it on' }
