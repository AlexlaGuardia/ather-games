// ── The controller source ─────────────────────────────────────────────────────────────────────
//
// The Gamepad API is polled, not evented, and it has three behaviours that bite anyone who assumes
// otherwise. All three are handled here so no call site has to remember them.
//
//   1. ⚠ **A CONNECTED PAD IS INVISIBLE UNTIL THE PLAYER PRESSES SOMETHING.** Browsers withhold
//      gamepads from `getGamepads()` until a button is pressed on them, as a fingerprinting defence.
//      So "no pad found" NEVER means "no pad plugged in" — it means "no pad has spoken yet". Any UI
//      built on the opposite reading tells the player their controller is unsupported while it sits
//      there working. `status()` reports `'silent'` for that case and never `'none'`.
//
//   2. ⚠ **THERE ARE NO BUTTON EVENTS.** State must be sampled each frame and edges derived by
//      comparing against the previous sample, which is what `poll()` returns. A missed frame is a
//      missed press, so this must be driven from the render loop, not a timer.
//
//   3. ⚠ **NON-STANDARD MAPPINGS ARE REFUSED, NOT GUESSED.** `Gamepad.mapping` is `'standard'` only
//      when the browser recognises the layout. On anything else the indices mean whatever the
//      driver decided, so treating `buttons[0]` as A would scramble a stranger's controls with no
//      way for them to tell why. We report it and let the UI say so plainly.
//
// PERF: `poll()` allocates one object and reads at most 17 booleans + 4 floats. It is meant to be
// called once per frame from the existing rAF loop — deliberately NOT a `setInterval`, which would
// sample out of step with rendering and drop edges. Naming this because the fold's frame budget is
// under active measurement: this is microseconds, but it is microseconds INSIDE the frame.

import { PAD, type PadButton } from './actions'

export type PadKind = 'xbox' | 'playstation' | 'generic'
export type PadStatus = 'active' | 'silent' | 'unsupported-mapping'

export interface PadSample {
  /** Buttons currently down, by name. */
  down: Set<PadButton>
  /** Buttons that went down THIS sample — edges, derived by diffing against the previous sample. */
  pressed: Set<PadButton>
  /** Left stick, deadzoned. -1..1, y is negative-up as the API reports it. */
  lx: number; ly: number
  /** Right stick, deadzoned — the look axis. */
  rx: number; ry: number
  kind: PadKind
}

/**
 * Radial deadzone.
 *
 * ⚠ RADIAL, NOT PER-AXIS. Deadzoning x and y independently leaves a cross-shaped live area, so a
 * stick pushed lightly on a diagonal reads as pure horizontal and the player walks sideways when
 * they asked for diagonal. Cheap to get wrong, obvious once felt, invisible in code review.
 */
export function deadzone(x: number, y: number, dz = 0.18): [number, number] {
  const m = Math.hypot(x, y)
  if (m < dz) return [0, 0]
  const scaled = (m - dz) / (1 - dz)      // rescale so travel starts at 0 just outside the zone
  return [(x / m) * scaled, (y / m) * scaled]
}

export function kindOf(id: string): PadKind {
  const s = id.toLowerCase()
  if (s.includes('xbox') || s.includes('xinput')) return 'xbox'
  if (s.includes('054c') || s.includes('dualsense') || s.includes('dualshock') || s.includes('playstation')) return 'playstation'
  return 'generic'
}

/** The first pad the browser is willing to tell us about, or null. */
function firstPad(): Gamepad | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
  for (const g of navigator.getGamepads()) if (g) return g
  return null
}

export function status(): PadStatus {
  const g = firstPad()
  if (!g) return 'silent'                              // NOT 'none' — see gotcha 1
  return g.mapping === 'standard' ? 'active' : 'unsupported-mapping'
}

let prevDown = new Set<PadButton>()

/** Sample the pad. Call once per frame. Returns null when no pad has spoken yet. */
export function poll(): PadSample | null {
  const g = firstPad()
  if (!g || g.mapping !== 'standard') { prevDown = new Set(); return null }

  const down = new Set<PadButton>()
  for (const [name, idx] of Object.entries(PAD) as [PadButton, number][]) {
    if (g.buttons[idx]?.pressed) down.add(name)
  }
  const pressed = new Set<PadButton>()
  for (const b of down) if (!prevDown.has(b)) pressed.add(b)
  prevDown = down

  const [lx, ly] = deadzone(g.axes[0] ?? 0, g.axes[1] ?? 0)
  const [rx, ry] = deadzone(g.axes[2] ?? 0, g.axes[3] ?? 0)
  return { down, pressed, lx, ly, rx, ry, kind: kindOf(g.id) }
}

/** Reset edge state — call when the window loses focus, or a held button survives the blur. */
export function resetEdges(): void { prevDown = new Set() }
