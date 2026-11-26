'use client'
// The controller's wiring (BETA M186): poll the pad every 16 ms, run shared/pad.ts › padStep, apply what it says to the
// touch store and the window, the same doors the phone uses. Mounted once by each open-world page (ather + continent).
// ⚠ Chrome hides a connected pad until a button is pressed with the page focused (gamepad.ts gotcha 1): nothing shows
// until then, and 'gamepadconnected' only wakes the loop sooner. The first press both reveals the pad and acts.

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { poll, resetEdges, type PadKind } from '@/lib/input/gamepad'
import { load as loadBindings } from '@/lib/input/bindings'
import { padName } from '@/lib/input/hints'
import { touch, TOUCH_LOOK_SENS } from './touch'
import { newPadState, padStep, releaseAll, PAD_HINTS, PAD_MENU_HINTS, type PadEffect, type PadState } from './pad'

// ── "a pad is in use" (for the hint and the click-to-play card) ───────────────────────────────────────────────────
let activeKind: PadKind | null = null
const subs = new Set<() => void>()
const setActive = (k: PadKind | null) => { if (k === activeKind) return; activeKind = k; subs.forEach(f => f()) }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
/** The kind of the pad in use, or null when none has spoken. */
export const usePadKind = () => useSyncExternalStore(subscribe, () => activeKind, () => null)

function key(type: 'keydown' | 'keyup', code: string): boolean {
  const k = code.startsWith('Key') ? code.slice(3).toLowerCase() : code === 'Space' ? ' ' : code
  return window.dispatchEvent(new KeyboardEvent(type, { code, key: k, bubbles: true, cancelable: true }))
}

// ── the menu's focus ring ─────────────────────────────────────────────────────────────────────────────────────────
const RING = 'data-pad-focus'
const FOCUSABLE = 'button, [role="button"], a[href], input, select, [data-dial-btn], [tabindex]:not([tabindex="-1"])'
function visible(el: Element): boolean {
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false
  const cs = getComputedStyle(el)
  return cs.visibility !== 'hidden' && cs.pointerEvents !== 'none' && !(el as HTMLButtonElement).disabled
}
const ringed = () => document.querySelector(`[${RING}]`) as HTMLElement | null
function ring(el: HTMLElement | null) {
  ringed()?.removeAttribute(RING)
  if (!el) return
  el.setAttribute(RING, '')
  el.focus?.({ preventScroll: true })
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
}
/** Spatial step: the nearest visible button in that direction from the ringed one (the first one when none is). */
function navigate(dir: 'up' | 'down' | 'left' | 'right') {
  const all = [...document.querySelectorAll(FOCUSABLE)].filter(e => !(e instanceof HTMLCanvasElement) && visible(e)) as HTMLElement[]
  if (!all.length) return
  const cur = ringed()
  if (!cur || !all.includes(cur)) { ring(all[0]); return }
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2
  let best: HTMLElement | null = null, bestD = Infinity
  for (const el of all) {
    if (el === cur) continue
    const b = el.getBoundingClientRect(), dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay
    const main = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx
    const side = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy)
    if (main <= 1) continue
    const d = main + side * 2
    if (d < bestD) { bestD = d; best = el }
  }
  if (best) ring(best)
}
const ARROW = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const

function apply(e: PadEffect) {
  switch (e.t) {
    case 'keydown': case 'keyup': key(e.t, e.code); return
    case 'tap': key('keydown', e.code); key('keyup', e.code); return
    case 'move': touch.move.x = e.x; touch.move.y = e.y; return
    case 'look': touch.look.dx += e.dx / TOUCH_LOOK_SENS; touch.look.dy += e.dy / TOUCH_LOOK_SENS; return
    case 'fire': touch.fire = e.on; return
    case 'aim': touch.aim = e.on; return
    case 'hotbar': window.dispatchEvent(new CustomEvent('pad:hotbar', { detail: e.dir })); return
    case 'nav': {
      const code = ARROW[e.dir]
      const free = key('keydown', code); key('keyup', code)
      if (free) navigate(e.dir)     // nobody took the arrow (a talk or the birth gate would have): move the ring
      return
    }
    case 'accept': {
      const free = key('keydown', 'Enter'); key('keyup', 'Enter')
      if (free) ringed()?.click()
      return
    }
  }
}

export function PadBridge({ menuOpen }: { menuOpen: boolean }) {
  const menu = useRef(menuOpen); menu.current = menuOpen
  const kind = usePadKind()
  useEffect(() => {
    if (!menuOpen) ring(null)
  }, [menuOpen])
  useEffect(() => {
    const s: PadState = newPadState()
    let last = performance.now(), map = loadBindings()
    // ⚠ A TIMER, NOT rAF (unlike voxel3d): the open world runs at a few fps on a weak GPU or a swiftshader check, and a
    // button tapped and let go inside one long frame is an edge rAF never sees (and a tap of Y read a frame late is a
    // HOLD that stows: stance HOLD_MS is 350 ms). 16 ms sampling catches a real tap at any frame rate; the stick's
    // move / look are rates (look is scaled by real dt), so they do not care which clock drives them. Same reason the
    // phone's fire button is polled on a timer (ather/page.tsx).
    const tick = () => {
      const now = performance.now(), dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now
      const pad = poll()
      setActive(pad ? pad.kind : null)
      for (const e of padStep(s, pad, map, menu.current, dt)) apply(e)
    }
    const id = setInterval(tick, 16)
    const blur = () => { for (const e of releaseAll(s)) apply(e); resetEdges() }
    const wake = () => { map = loadBindings() }     // a pad plugged in (or rebinds saved in voxel3d's panel): re-read the map
    window.addEventListener('blur', blur); window.addEventListener('gamepadconnected', wake)
    ;(window as unknown as { __pad?: unknown }).__pad = { kind: () => activeKind, held: () => [...s.down.values()], menu: () => menu.current }   // read-only probe (m186-pad-check)
    return () => {
      clearInterval(id); blur(); setActive(null); ring(null)
      window.removeEventListener('blur', blur); window.removeEventListener('gamepadconnected', wake)
    }
  }, [])
  if (!kind) return null
  const hints = menuOpen ? PAD_MENU_HINTS : PAD_HINTS
  return (
    <>
      <style>{`[${RING}]{outline:2px solid #d4a843 !important;outline-offset:2px}`}</style>
      <div data-pad-hint style={{ position: 'fixed', left: 8, top: 8, zIndex: 40, display: 'flex', gap: 10, padding: '3px 10px', borderRadius: 999, background: 'rgba(12,16,20,0.55)', color: '#eef3f6', font: '600 10px system-ui, sans-serif', letterSpacing: '0.06em', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        {hints.map(h => <span key={h.b}><span style={{ color: '#d4a843' }}>{padName(h.b, kind)}</span> {h.label}</span>)}
      </div>
    </>
  )
}
