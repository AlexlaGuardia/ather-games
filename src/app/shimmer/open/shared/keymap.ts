// KEY REBINDING for the open world (Alex 11-15, after the Options port). Every open-world page listens for FIXED key
// codes ('KeyE', 'Space', ...) in its own handlers; rewriting each one to ask a keymap would touch every file and drift.
// Instead this is a TRANSLATION LAYER: one capture listener, installed before any page listener, rewrites the key you
// pressed into the code the page already expects, and swallows a default key whose action you moved elsewhere.
//
//   bound: action (named by its DEFAULT code) → the physical code you chose
//   a trusted press of P:  P bound to action A  → re-dispatch as A's default code (pages see what they always saw)
//                          P is some action's default but that action moved → swallowed (else the old action fires too)
//                          otherwise → untouched
// Synthetic events (the phone's buttons call pressKey with default codes, and our own re-dispatch) are never
// translated: `isTrusted` is false, so there is no loop and touch keeps working whatever the keyboard says.
// Not rebindable on purpose: Esc (the browser owns it for pointer lock), Tab / arrows (menu navigation, driving
// alternates), the mouse buttons, and the dev keys.

import { useSyncExternalStore } from 'react'

export interface Action { code: string; label: string }
/** Every rebindable action, by its default code. Labels say what the key does across the open world's pages. */
export const ACTIONS: Action[] = [
  { code: 'KeyW', label: 'forward · throttle' }, { code: 'KeyS', label: 'back · brake' },
  { code: 'KeyA', label: 'left · steer left' }, { code: 'KeyD', label: 'right · steer right' },
  { code: 'Space', label: 'jump · climb · drift' }, { code: 'ShiftLeft', label: 'slide' },
  { code: 'KeyE', label: 'use · talk · take' }, { code: 'KeyF', label: 'get in / out · plant a waymark' },
  { code: 'KeyL', label: 'lift your waymark' }, { code: 'KeyR', label: 'draw · swap · hold to stow · back to the road' },
  { code: 'KeyH', label: 'home (the Wilds)' }, { code: 'KeyM', label: 'map' },
  { code: 'KeyI', label: 'bag' }, { code: 'KeyJ', label: 'journal' }, { code: 'KeyP', label: 'character' },
  { code: 'KeyQ', label: 'tactical cast (the bracelet)' }, { code: 'KeyX', label: 'signature cast (the glove)' },
  { code: 'KeyO', label: 'options' }, { code: 'KeyC', label: 'camera · linked plots' }, { code: 'KeyG', label: 'garage' },
  { code: 'KeyV', label: 'first / third person' },
]
const DEFAULTS = new Set(ACTIONS.map(a => a.code))
/** Keys that can never be bound (the browser's, menu navigation, the dev keys). */
export const RESERVED = new Set(['Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'BracketLeft', 'BracketRight', 'MetaLeft', 'MetaRight', 'F5', 'F11', 'F12'])

export interface Keymap { v: 1; bound: Record<string, string> }   // default code → physical code (only the moved ones)
const KEY = 'open.keymap.v1'
const subs = new Set<() => void>()
let cur: Keymap | null = null
const EMPTY: Keymap = { v: 1, bound: {} }
const load = (): Keymap => { try { const k = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (k && k.v === 1 && k.bound) return k } catch { /* private */ } return EMPTY }
const get = () => { if (typeof window === 'undefined') return EMPTY; if (!cur) cur = load(); return cur }
const save = (k: Keymap) => { cur = k; try { localStorage.setItem(KEY, JSON.stringify(k)) } catch { /* private */ } subs.forEach(f => f()) }
export const getKeymap = get
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
const server = () => EMPTY
export const useKeymap = () => useSyncExternalStore(subscribe, get, server)

/** The physical key an action is on now. */
export const keyFor = (k: Keymap, action: string) => k.bound[action] ?? action
/** The action a physical key drives now, or null. */
export function actionOf(k: Keymap, physical: string): string | null {
  for (const a of ACTIONS) if (keyFor(k, a.code) === physical) return a.code
  return null
}

/** Bind `action` to `physical`. A key already driving another action SWAPS with it (nothing is left dead silently). */
export function bind(k: Keymap, action: string, physical: string): Keymap {
  if (!DEFAULTS.has(action) || RESERVED.has(physical)) return k
  const was = keyFor(k, action), other = actionOf(k, physical)
  const bound = { ...k.bound, [action]: physical }
  if (other && other !== action) bound[other] = was
  for (const a of Object.keys(bound)) if (bound[a] === a) delete bound[a]     // a key back on its own default is no rebind
  return { v: 1, bound }
}
export const setBinding = (action: string, physical: string) => save(bind(get(), action, physical))
export const resetKeymap = () => save(EMPTY)

/** Pure translation: what code should the page see for this physical press? `null` = swallow it. */
export function translate(k: Keymap, physical: string): string | null {
  const a = actionOf(k, physical)
  if (a) return a
  if (DEFAULTS.has(physical)) return null       // a default key whose action moved away: it does nothing now
  return physical
}

/** A readable name for a code: KeyF → F, Digit3 → 3, ShiftLeft → L Shift. */
export function keyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6)
  const names: Record<string, string> = { Space: 'Space', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', AltLeft: 'L Alt', AltRight: 'R Alt', CapsLock: 'Caps', Backquote: '`', Minus: '-', Equal: '=', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Enter: 'Enter', Backspace: 'Backspace' }
  return names[code] ?? code
}

// ── the layer ──────────────────────────────────────────────────────────────────────────────────────────────────────
let installed = 0
/** While true, presses are not translated (the Options panel is listening for a key to bind). */
let capturing = false
export const setCapturing = (v: boolean) => { capturing = v }

function onKey(e: KeyboardEvent) {
  if (!e.isTrusted || capturing) return
  const k = get()
  if (!Object.keys(k.bound).length) return                   // nothing moved: the fast path, every page untouched
  const to = translate(k, e.code)
  if (to === e.code) return
  e.stopImmediatePropagation(); e.preventDefault()
  if (to === null) return
  const out = new KeyboardEvent(e.type, { code: to, key: e.key, repeat: e.repeat, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, bubbles: true, cancelable: true })
  window.dispatchEvent(out)
}
/** Install the layer (idempotent; returns the uninstall). Capture phase on window, so it runs before every page listener. */
export function installKeymap(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (installed++ === 0) { window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true) }
  return () => { if (--installed === 0) { window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true) } }
}
