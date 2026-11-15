'use client'
// MENUS FREE THE MOUSE, CLOSING TAKES THE CAMERA BACK (Alex 11-15: "the mouse should free up to click around the menu
// then close it and automatically take the camera again"). One rule for every open-world page.
//
//   open  → if the pointer was locked, remember that and release it, so the menu is clickable.
//   close → if it was locked when the menu opened, lock it again on the game's canvas.
//
// ⚠ A browser grants pointer lock only inside a user gesture. Closing by a click (a ✕, a stop on the map) or by a
// key that opens/closes the menu (M, E, G) IS one, and the relock runs inside it: a layout effect flushes in the
// same event as the state change. ESCAPE IS NOT a gesture in Chrome, so a menu closed with Esc cannot relock; the
// page shows its "click to resume" instead. The rejected promise is swallowed on purpose: that is the expected case.

import { useLayoutEffect, useRef } from 'react'

export function relock(el: HTMLElement | null | undefined) {
  if (!el || document.pointerLockElement === el) return
  try { const r = el.requestPointerLock?.() as unknown as Promise<void> | undefined; r?.catch?.(() => {}) } catch { /* no gesture: click resumes */ }
}

/** `open` = any menu/panel is up. `target` = the element the game locks (the canvas). */
export function useMenuLock(open: boolean, target: () => HTMLElement | null | undefined) {
  const was = useRef(false)
  const prev = useRef(open)
  useLayoutEffect(() => {
    if (open === prev.current) return
    prev.current = open
    if (open) {
      was.current = !!document.pointerLockElement
      if (was.current) document.exitPointerLock()
    } else if (was.current) {
      was.current = false
      relock(target())
    }
  }, [open, target])
}
