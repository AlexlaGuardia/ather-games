// Touch input for the open world (2026-11-15, hub). ONE mutable store the touch overlay writes and the walker /
// combat read every frame, so a phone drives the very same body and gun as WASD + mouse, never a fork of them.
//
//   · move    the left stick, x = strafe right, y = forward (both -1..1, analog: a half push walks slower)
//   · look    pixels dragged since the walker last read them (it consumes and zeroes them each frame)
//   · held    the hold-buttons, as the key codes the walker already knows (Space, ShiftLeft)
//   · fire    the fire button is down; combat clears it after a semi-auto shot, same as the mouse trigger
// Taps that are page ACTIONS (E use, M map, F plant...) are not in here: pressKey() sends a real keydown/keyup,
// so the page's one key handler decides what they mean.

export const touch = {
  move: { x: 0, y: 0 },
  look: { dx: 0, dy: 0 },
  held: new Set<string>(),
  fire: false,
}

/** Radians per dragged pixel. The mouse is 0.0022 per count; a thumb covers far less ground, so it turns more. */
export const TOUCH_LOOK_SENS = 0.0055

/** A device whose ONLY pointer is coarse: a phone, a tablet without a trackpad. A touch laptop keeps the mouse. */
export function isTouchOnly(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches
}

export function pressKey(code: string) {
  const key = code.startsWith('Key') ? code.slice(3).toLowerCase() : code
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true }))
  window.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true }))
}

export function resetTouch() {
  touch.move.x = 0; touch.move.y = 0; touch.look.dx = 0; touch.look.dy = 0; touch.held.clear(); touch.fire = false
}
