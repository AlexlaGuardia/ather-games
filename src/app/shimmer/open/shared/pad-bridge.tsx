'use client'
// The controller's wiring (BETA M186): poll the pad every 16 ms, run shared/pad.ts › padStep, apply what it says to the
// touch store and the window, the same doors the phone uses. Mounted once by each open-world page (ather + continent).
// ⚠ Chrome hides a connected pad until a button is pressed with the page focused (gamepad.ts gotcha 1): nothing shows
// until then, and 'gamepadconnected' only wakes the loop sooner. The first press both reveals the pad and acts.

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { poll, resetEdges, type PadKind } from '@/lib/input/gamepad'
import { load as loadBindings, save as saveBindings, type BindingMap } from '@/lib/input/bindings'
import { PAD, type PadButton } from '@/lib/input/actions'
import { padName, hintFor } from '@/lib/input/hints'
import { touch, TOUCH_LOOK_SENS } from './touch'
import { newPadState, padStep, releaseAll, padActed, padPrompt, PAD_HINTS, PAD_MENU_HINTS, SOUND_OFF_NOTE, type PadEffect, type PadState, type PadCtx } from './pad'
import { audio, audioState } from './gun-sound'

// ── "a pad is in use" (for the hint and the click-to-play card) ───────────────────────────────────────────────────
let activeKind: PadKind | null = null
const subs = new Set<() => void>()
const setActive = (k: PadKind | null) => { if (k === activeKind) return; activeKind = k; subs.forEach(f => f()) }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
/** The kind of the pad in use, or null when none has spoken (or the mouse / keys took the game back: M186 s2). */
export const usePadKind = () => useSyncExternalStore(subscribe, () => activeKind, () => null)
/** M186 s2: the pad's button for 'use' (world.interact, X / □ by default) while a pad holds the game, else null. */
export function usePadGlyph(): string | null {
  const k = usePadKind()
  return k ? hintFor(loadBindings(), 'world.interact', 'pad', k) : null
}
// ── M189: the pad family last seen (Options draws its rows in that family's glyphs even after the mouse took over) ──
let seenKind: PadKind | null = null
const seenSubs = new Set<() => void>()
const setSeen = (k: PadKind | null) => { if (!k || k === seenKind) return; seenKind = k; seenSubs.forEach(f => f()) }
export const usePadSeenKind = () => useSyncExternalStore(f => { seenSubs.add(f); return () => { seenSubs.delete(f) } }, () => seenKind, () => null)

// ── M189: rebinding. Options asks for the NEXT pad press; while it waits the bridge hands that press over and does
// nothing else with it (no accept, no close). A save bumps mapVer, and the bridge re-reads the map on its next tick.
let capture: ((b: PadButton) => void) | null = null
/** Hand the next pad press to `f` (null stops listening). */
export const padCapture = (f: ((b: PadButton) => void) | null) => { capture = f }
let mapVer = 0
/** Save a rebound map (the 08-28 BindingMap, shimmer.voxel.bindings.v1) and make the live bridge use it. */
export function savePadMap(m: BindingMap) { saveBindings(m); mapVer++; seenSubs.forEach(f => f()) }

// ── M232: what the hands hold (the page says: nothing drawn = R2 punches, an item = L2 uses it) and whether the d-pad has
// a hotbar slot lit (game-hud says: then the use button holds it). Read by padStep every tick.
const ctx: PadCtx = { handsOut: false, holding: false, browsing: false }
export function setPadHands(handsOut: boolean, holding: boolean) { ctx.handsOut = handsOut; ctx.holding = holding }
export function setPadBrowsing(on: boolean) { ctx.browsing = on }

/** A world prompt as the player's device names it ('E · Gregory' / '□ · Gregory'). */
export { padPrompt }

// ── M186 s2: sound for a pad player ───────────────────────────────────────────────────────────────────────────────
// Chrome lets an AudioContext run only after a real click / key / tap on the page; a gamepad press is NOT a user gesture.
// So a player who starts on the pad (the pad hides Click-to-play) heard nothing, ever: the one context stayed suspended.
// Every real gesture resumes it inside the gesture (audio() resumes a suspended context), and while it is still locked
// with a pad in hand a note says to click / tap once.
let soundLocked = false
const lockSubs = new Set<() => void>()
const setLocked = (v: boolean) => { if (v === soundLocked) return; soundLocked = v; lockSubs.forEach(f => f()) }
const useSoundLocked = () => useSyncExternalStore(f => { lockSubs.add(f); return () => { lockSubs.delete(f) } }, () => soundLocked, () => false)
function readLocked(): boolean {
  const st = audioState()
  if (st === 'running' || st === 'closed') return false
  if (st === 'suspended') return true
  const ua = (navigator as unknown as { userActivation?: { hasBeenActive: boolean } }).userActivation
  return ua ? !ua.hasBeenActive : false
}

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

// ── M232: the menu POINTER (Alex 11-27: 'controller also needs to have a cursor in menus'). The left stick moves it; the
// button under it gets the ring (so the d-pad's focus-hopping and the pointer are ONE selection, never two); A clicks
// what the pointer is on. The d-pad moving the ring brings the pointer along. Shown only once the stick has moved.
const cur = { x: 0, y: 0, on: false, el: null as HTMLDivElement | null }
function drawCursor() { const el = cur.el; if (!el) return; el.style.display = cur.on ? 'block' : 'none'; el.style.transform = `translate(${cur.x - 7}px, ${cur.y - 7}px)` }
function cursorOff() { cur.on = false; drawCursor() }
function underCursor(): Element | null { return document.elementFromPoint(cur.x, cur.y) }
function moveCursor(dx: number, dy: number) {
  if (!cur.on) { const r = ringed()?.getBoundingClientRect(); cur.x = r ? r.left + r.width / 2 : innerWidth / 2; cur.y = r ? r.top + r.height / 2 : innerHeight / 2; cur.on = true }
  cur.x = Math.max(0, Math.min(innerWidth - 1, cur.x + dx)); cur.y = Math.max(0, Math.min(innerHeight - 1, cur.y + dy))
  drawCursor()
  const hit = underCursor()?.closest(FOCUSABLE) as HTMLElement | null
  if (hit && hit !== ringed() && !(hit instanceof HTMLCanvasElement) && visible(hit)) ring(hit)
}
/** A press of A on the pointer: the button under it (its own click), or the bare element there (a full mouse press). */
function clickCursor() {
  // a thumb is not a mouse: a pointer a few px off the ringed button's edge still means that button (the ring IS the aim)
  const rg = ringed(), rr = rg?.getBoundingClientRect(), SNAP = 10
  if (rg && rr && cur.x > rr.left - SNAP && cur.x < rr.right + SNAP && cur.y > rr.top - SNAP && cur.y < rr.bottom + SNAP) { rg.click(); return }
  const el = underCursor(); if (!el) return
  const btn = el.closest(FOCUSABLE) as HTMLElement | null
  if (btn && !(btn instanceof HTMLCanvasElement)) { ring(btn); btn.click(); return }
  const o = { bubbles: true, cancelable: true, clientX: cur.x, clientY: cur.y, button: 0 }
  el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new MouseEvent('mousedown', o))
  el.dispatchEvent(new PointerEvent('pointerup', o)); el.dispatchEvent(new MouseEvent('mouseup', o)); el.dispatchEvent(new MouseEvent('click', o))
}

let fireSeq = 0, firing = () => false
function apply(e: PadEffect) {
  switch (e.t) {
    case 'keydown': case 'keyup': key(e.t, e.code); return
    case 'tap': key('keydown', e.code); key('keyup', e.code); return
    case 'move': touch.move.x = e.x; touch.move.y = e.y; return
    case 'look': touch.look.dx += e.dx / TOUCH_LOOK_SENS; touch.look.dy += e.dy / TOUCH_LOOK_SENS; return
    case 'fire':
      // ⚠ a tap shorter than a frame: the timer sees RT go down and up between two of combat's frames, and a trigger
      // cleared before combat ever read it never fires. So the press is latched until a whole frame has passed
      // (two rAFs); combat clears it itself after a semi-auto shot, and a new press since then is left alone.
      if (e.on) { touch.fire = true; fireSeq++ }
      else { const at = fireSeq; requestAnimationFrame(() => requestAnimationFrame(() => { if (at === fireSeq && !firing()) touch.fire = false })) }
      return
    case 'aim': touch.aim = e.on; return
    case 'hotbar': window.dispatchEvent(new CustomEvent('pad:hotbar', { detail: e.dir })); return
    case 'nav': {
      const code = ARROW[e.dir]
      const free = key('keydown', code); key('keyup', code)
      if (free) navigate(e.dir)     // nobody took the arrow (a talk or the birth gate would have): move the ring
      if (free && cur.on) { const r = ringed()?.getBoundingClientRect(); if (r) { cur.x = r.left + r.width / 2; cur.y = r.top + r.height / 2; drawCursor() } }   // M232: the pointer follows
      return
    }
    case 'accept': {
      const free = key('keydown', 'Enter'); key('keyup', 'Enter')
      if (free) { if (cur.on) clickCursor(); else ringed()?.click() }   // M232: the pointer, once the stick has moved it
      return
    }
    case 'cursor': moveCursor(e.dx, e.dy); return
    case 'hold': window.dispatchEvent(new CustomEvent('pad:hold')); return
  }
}

export function PadBridge({ menuOpen }: { menuOpen: boolean }) {
  const menu = useRef(menuOpen); menu.current = menuOpen
  const kind = usePadKind()
  useEffect(() => {
    if (!menuOpen) ring(null)
    cursorOff()   // M232: a menu opens (or shuts) with the pointer hidden until the stick moves it
  }, [menuOpen])
  useEffect(() => {
    const s: PadState = newPadState()
    firing = () => s.fire
    let last = performance.now(), map = loadBindings(), ver = mapVer
    // ⚠ A TIMER, NOT rAF (unlike voxel3d): the open world runs at a few fps on a weak GPU or a swiftshader check, and a
    // button tapped and let go inside one long frame is an edge rAF never sees (and a tap of Y read a frame late is a
    // HOLD that stows: stance HOLD_MS is 350 ms). 16 ms sampling catches a real tap at any frame rate; the stick's
    // move / look are rates (look is scaled by real dt), so they do not care which clock drives them. Same reason the
    // phone's fire button is polled on a timer (ather/page.tsx).
    // M186 s2: the pad HOLDS the game from a press / a pushed stick until the mouse moves or a real key / click / tap
    // comes; then the cursor shows, Click-to-play is back and prompts say 'E'. The next pad press takes it again.
    let padOwns = false, n = 0
    const tick = () => {
      const now = performance.now(), dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now
      const pad = poll()
      if (ver !== mapVer) { ver = mapVer; map = loadBindings() }
      if (pad) setSeen(pad.kind)
      if (capture) {
        for (const e of releaseAll(s)) apply(e)
        const b = pad && (Object.keys(PAD) as PadButton[]).find(x => pad.pressed.has(x))
        if (b) { const f = capture; capture = null; f(b) }
        return
      }
      if (!pad) padOwns = false
      else if (padActed(pad) && !padOwns) {
        padOwns = true
        // a pad never needs the mouse captured: let it go, so the mouse moving next shows a cursor (Alex 11-26), not a spin
        if (document.pointerLockElement) document.exitPointerLock?.()
      }
      setActive(pad && padOwns ? pad.kind : null)
      if (++n % 8 === 0) setLocked(readLocked())
      for (const e of padStep(s, pad, map, menu.current, dt, ctx)) apply(e)
    }
    const id = setInterval(tick, 16)
    const handBack = () => { padOwns = false; setActive(null) }
    const gesture = (e: Event) => {
      if (!e.isTrusted) return     // the bridge's own synthetic keys are not a player's hand
      audio()                      // inside a real gesture: make / resume the one context (Chrome's rule)
      setLocked(readLocked())
      handBack()
    }
    const moved = (e: MouseEvent) => { if (e.isTrusted && Math.abs(e.movementX) + Math.abs(e.movementY) > 0) handBack() }
    const GESTURES = ['pointerdown', 'keydown', 'touchend', 'wheel'] as const
    for (const g of GESTURES) window.addEventListener(g, gesture, { capture: true, passive: true })
    window.addEventListener('mousemove', moved, { capture: true, passive: true })
    const blur = () => { for (const e of releaseAll(s)) apply(e); resetEdges() }
    const wake = () => { map = loadBindings() }     // a pad plugged in (or rebinds saved in voxel3d's panel): re-read the map
    window.addEventListener('blur', blur); window.addEventListener('gamepadconnected', wake)
    ;(window as unknown as { __pad?: unknown }).__pad = { kind: () => activeKind, held: () => [...s.down.values()], menu: () => menu.current, map: () => map,
      ctx: () => ({ ...ctx }), cursor: () => ({ x: cur.x, y: cur.y, on: cur.on }), ringed: () => ringed()?.textContent?.slice(0, 40) ?? null }   // M232 probes   // read-only probe (m186-pad-check)
    return () => {
      clearInterval(id); blur(); setActive(null); ring(null); cursorOff()
      for (const g of GESTURES) window.removeEventListener(g, gesture, { capture: true })
      window.removeEventListener('mousemove', moved, { capture: true })
      window.removeEventListener('blur', blur); window.removeEventListener('gamepadconnected', wake)
    }
  }, [])
  const locked = useSoundLocked()
  if (!kind) return null
  const binds = loadBindings()
  const hints = menuOpen ? PAD_MENU_HINTS.map(h => ({ key: h.b, glyph: padName(h.b, kind), label: h.label }))
    : PAD_HINTS.map(h => ({ key: h.id, glyph: hintFor(binds, h.id, 'pad', kind), label: h.label })).filter(h => h.glyph)
  const touchy = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  return (
    <>
      {/* the pad holds the game: no cursor (the mouse moving hands it back, and the cursor with it) */}
      <style>{`[${RING}]{outline:2px solid #d4a843 !important;outline-offset:2px} html, html *{cursor:none !important}`}</style>
      {locked && (
        <div data-audio-locked style={{ position: 'fixed', left: '50%', top: 40, transform: 'translateX(-50%)', zIndex: 40, padding: '5px 12px', borderRadius: 8, background: 'rgba(12,16,20,0.72)', color: '#f4efe2', font: '600 11px system-ui, sans-serif', letterSpacing: '0.04em', pointerEvents: 'none', whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 32px)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {touchy ? SOUND_OFF_NOTE.tap : SOUND_OFF_NOTE.click}
        </div>
      )}
      {/* M232: the menu pointer (drawn imperatively by the bridge's tick; hidden until the stick moves it) */}
      <div data-pad-cursor ref={el => { cur.el = el; drawCursor() }} style={{ position: 'fixed', left: 0, top: 0, width: 14, height: 14, borderRadius: 999, zIndex: 2147483000, pointerEvents: 'none', display: 'none', background: 'rgba(244,239,226,0.92)', border: '2px solid #d4a843', boxShadow: '0 1px 4px rgba(0,0,0,.5)' }} />
      <div data-pad-hint style={{ position: 'fixed', left: 8, top: 8, zIndex: 40, display: 'flex', gap: 10, padding: '3px 10px', borderRadius: 999, background: 'rgba(12,16,20,0.55)', color: '#eef3f6', font: '600 10px system-ui, sans-serif', letterSpacing: '0.06em', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        {hints.map(h => <span key={h.key}><span style={{ color: '#d4a843' }}>{h.glyph}</span> {h.label}</span>)}
      </div>
    </>
  )
}
