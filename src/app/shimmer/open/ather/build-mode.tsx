'use client'
// ── BUILD MODE: the flying planner over the home plot (Alex 11-18, Jin 3 25c51ac5) ───────────────────────────────────
// "a big plan button that puts the player in the flying build mode". The keeper stays where they stood (frozen, their
// doll visible below); the lens lifts into an overhead view you pan and zoom, and whatever is being placed follows the
// pointer instead of standing in front of the keeper.
//
//   desktop: WASD / arrows pan · wheel zooms · Q / Z turn the view · the ghost follows the mouse · click places
//   phone:   one finger drags the ground · two fingers pinch · a tap moves the ghost there (Place on the bar sets it)
//   Esc (nothing being placed) or "Back to keeper" lands the lens back in the keeper's eyes.
//
// This file knows nothing about rooms: workshop.tsx asks `buildPoint()` where the ghost goes and registers a tap
// handler (`onBuildTap`). The page calls `stepBuildCam` from the walker's onTick, after the first-person camera is set.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { GROUND_Y } from './plot'

export const BUILD_CAM = { PITCH: 0.98, H0: 22, HMIN: 7, HMAX: 48, REACH: 140, PAN: 1.15, EASE: 10, TURN: 1.6 } as const

let on = false
const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())
/** where the lens looks (ground point), how high, which way; `cur` eases toward `want` */
const want = { x: 0, z: 0, h: BUILD_CAM.H0 as number, yaw: 0 }
const cur = { x: 0, z: 0, h: BUILD_CAM.H0 as number, yaw: 0 }
const home = { x: 0, z: 0 }
let entered = false

export const isBuilding = () => on
export const useBuildMode = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => on, () => false)
/** Lift off from where the keeper stands, looking the way they look. */
export function enterBuild(at: { x: number; z: number; yaw: number }) {
  want.x = cur.x = home.x = at.x; want.z = cur.z = home.z = at.z; want.yaw = cur.yaw = at.yaw; want.h = BUILD_CAM.H0
  cur.h = 2   // start at eye height and rise: the lift reads as a lift, not a cut
  entered = true; on = true; emit()
}
export function exitBuild() { if (!on) return; on = false; held.clear(); point.has = false; tool = 'look'; draw?.cancel(); emit() }

// ── M37 (11-19): a DRAWING tool (plot-walls.ts). With 'walls' or 'erase' on, one finger / a left drag draws instead of
//    panning: the handler gets ground points at the start, along the way and at the end. Two fingers pinch AND pan; a
//    right or middle mouse drag pans; WASD still flies. 'look' = the old behaviour (a drag pans, a click places).
export type BuildTool = 'look' | 'walls' | 'erase' | 'door' | 'window' | 'paint' | 'blueprint'   // blueprint (M39): owner, a tap picks a building   // M37 slice 3: door / window / paint are taps
let tool: BuildTool = 'look'
export const buildTool = () => tool
export function setBuildTool(t: BuildTool) { if (t === tool) return; draw?.cancel(); tool = t; emit() }
export const useBuildTool = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => tool, () => 'look' as BuildTool)
type DrawHandler = { start(x: number, z: number): void; move(x: number, z: number): void; end(x: number, z: number): void; cancel(): void }
let draw: DrawHandler | null = null
/** workshop.tsx: what a drawing drag does. One handler; the last registered wins. */
export function onBuildDraw(h: DrawHandler | null) { draw = h }

// ── the ground point under the pointer (written by <BuildPointer/>, read by the ghosts) ──
const point = { x: 0, z: 0, has: false }
/** Where a ghost should stand in build mode: under the pointer, or the middle of the view before the pointer moves. */
export function buildPoint(): { x: number; z: number } | null {
  if (!on) return null
  return point.has ? { x: point.x, z: point.z } : { x: cur.x, z: cur.z }
}
let tap: (() => void) | null = null
/** workshop.tsx: what a click (desktop) does in build mode. One handler; the last registered wins. */
export function onBuildTap(f: (() => void) | null) { tap = f }

// ── keys: held while in build mode (the walker is frozen, so it never sees them move the keeper) ──
const held = new Set<string>()
const PAN_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyZ'])
export function useBuildKeys(placing: () => boolean) {
  const b = useBuildMode()
  useEffect(() => {
    if (!b) return
    const down = (e: KeyboardEvent) => {
      if (PAN_KEYS.has(e.code)) { held.add(e.code); e.preventDefault(); e.stopImmediatePropagation(); return }
      // Esc with nothing on the pointer leaves; while placing, workshop's keys take Esc first (cancel the ghost)
      if (e.code === 'Escape' && !placing()) { exitBuild(); e.preventDefault(); e.stopImmediatePropagation(); return }
      // the page's own keys (E to talk, I bag, M map, C cluster…) stay quiet while you fly: nothing near you is reachable
      if (['KeyE', 'KeyI', 'KeyJ', 'KeyP', 'KeyM', 'KeyC', 'KeyO', 'Tab', 'Space'].includes(e.code) && !placing()) { e.preventDefault(); e.stopImmediatePropagation() }
    }
    const up = (e: KeyboardEvent) => { held.delete(e.code) }
    const blur = () => held.clear()
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true); window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', blur); held.clear() }
  }, [b, placing])
}

/** Pure: the lens for a view. Looks down at (x, z) from height h, `pitch` below the horizon, facing `yaw` (yaw 0 = -z). */
export function lensFor(v: { x: number; z: number; h: number; yaw: number }, pitch: number = BUILD_CAM.PITCH) {
  const back = v.h / Math.tan(pitch)
  return { px: v.x + Math.sin(v.yaw) * back, py: GROUND_Y + v.h, pz: v.z + Math.cos(v.yaw) * back, pitch: -pitch, yaw: v.yaw }
}
/** Pure: keep the view within reach of where the keeper lifted off. */
export function clampView(x: number, z: number, hx: number, hz: number, reach: number = BUILD_CAM.REACH) {
  const dx = x - hx, dz = z - hz, d = Math.hypot(dx, dz)
  return d <= reach ? { x, z } : { x: hx + (dx / d) * reach, z: hz + (dz / d) * reach }
}

/** Called by the page from the walker's onTick (after the walker set the first-person camera): fly the lens. */
export function stepBuildCam(cam: THREE.Camera, dt: number) {
  if (!on) return
  const f = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0)
  const r = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0)
  const t = (held.has('KeyQ') ? 1 : 0) - (held.has('KeyZ') ? 1 : 0)
  want.yaw += t * BUILD_CAM.TURN * dt
  if (f || r) {
    const sp = want.h * BUILD_CAM.PAN * dt, s = Math.sin(want.yaw), c = Math.cos(want.yaw)
    // forward on the ground is (-sin, -cos); right is (cos, -sin)
    const c2 = clampView(want.x + (-s * f + c * r) * sp, want.z + (-c * f - s * r) * sp, home.x, home.z)
    want.x = c2.x; want.z = c2.z
  }
  const a = entered ? 1 - Math.exp(-BUILD_CAM.EASE * dt) : 1
  cur.x += (want.x - cur.x) * a; cur.z += (want.z - cur.z) * a; cur.h += (want.h - cur.h) * a * 0.6
  cur.yaw += Math.atan2(Math.sin(want.yaw - cur.yaw), Math.cos(want.yaw - cur.yaw)) * a
  const l = lensFor(cur)
  cam.position.set(l.px, l.py, l.pz)
  cam.rotation.set(l.pitch, l.yaw, 0, 'YXZ')
}

// pan by a screen drag: dx/dy in pixels, scaled so the ground follows the finger roughly at the view's centre
function dragPan(dx: number, dy: number, viewH: number) {
  const k = (want.h * 1.6) / Math.max(1, viewH), s = Math.sin(want.yaw), c = Math.cos(want.yaw)
  // drag right → the ground moves right → the view moves left; drag down → the view moves forward
  const c2 = clampView(want.x - (c * dx - s * dy) * k, want.z - (-s * dx - c * dy) * k, home.x, home.z)
  want.x = c2.x; want.z = c2.z
}
const zoom = (f: number) => { want.h = Math.max(BUILD_CAM.HMIN, Math.min(BUILD_CAM.HMAX, want.h * f)) }

/** Inside the Canvas: reads the pointer, pans on drag, zooms on wheel/pinch, raycasts the ground point every frame. */
export function BuildPointer() {
  const b = useBuildMode()
  const { gl, camera } = useThree()
  const ndc = useRef<{ x: number; y: number } | null>(null)
  const ray = useRef(new THREE.Raycaster()), plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y)), hit = useRef(new THREE.Vector3())
  // checks' hook (like __ather.tp): MOVE the view only, and read it. Placing still takes a real click.
  useEffect(() => {
    (window as unknown as { __build: unknown }).__build = {
      on: () => on, to: (x: number, z: number, yaw?: number) => { const c = clampView(x, z, home.x, home.z); want.x = c.x; want.z = c.z; if (yaw !== undefined) want.yaw = yaw },   // yaw: M37 checks square the view to the grid
      view: () => ({ ...cur }), point: () => (point.has ? { x: point.x, z: point.z } : null),
      tool: () => tool, drawer: () => !!draw,   // M37: which tool, and is a drawing handler registered
    }
  }, [])
  useEffect(() => {
    if (!b) return
    const el = gl.domElement
    const pts = new Map<number, { x: number; y: number; sx: number; sy: number }>()
    let moved = false, pinch0 = 0, drawing = false, mid: { x: number; y: number } | null = null
    const setNdc = (e: PointerEvent) => { const r = el.getBoundingClientRect(); ndc.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 } }
    // the ground under a pointer event NOW (the per-frame point lags a frame; a drag's ends must be exact)
    const groundAt = (e: PointerEvent) => {
      setNdc(e); const n = ndc.current!
      ray.current.setFromCamera(new THREE.Vector2(n.x, n.y), camera)
      return ray.current.ray.intersectPlane(plane.current, hit.current) ? { x: hit.current.x, z: hit.current.z } : null
    }
    const drawsWith = (e: PointerEvent) => tool !== 'look' && !!draw && (e.pointerType !== 'mouse' || e.button === 0)
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); moved = false
      if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch0 = Math.hypot(p.x - q.x, p.y - q.y); mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }; if (drawing) { drawing = false; draw?.cancel() } }
      else if (pts.size === 1 && drawsWith(e)) { const g = groundAt(e); if (g) { drawing = true; draw!.start(g.x, g.z) } }
      try { el.setPointerCapture(e.pointerId) } catch { /* old browsers */ }
    }
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (e.pointerType === 'mouse' && !p) { setNdc(e); return }   // hover: the ghost follows the mouse
      if (!p) return
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      p.x = e.clientX; p.y = e.clientY
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 6) moved = true
      if (pts.size === 2) {
        const [a, c] = [...pts.values()], d = Math.hypot(a.x - c.x, a.y - c.y)
        if (pinch0 > 0 && d > 0) zoom(pinch0 / d); pinch0 = d
        const m = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }   // M37: two fingers also pan (one finger may be drawing)
        if (mid) dragPan(m.x - mid.x, m.y - mid.y, el.clientHeight); mid = m
        return
      }
      if (drawing) { const g = groundAt(e); if (g) draw?.move(g.x, g.z); return }
      if (moved) dragPan(dx, dy, el.clientHeight)
      if (e.pointerType === 'mouse') setNdc(e)
    }
    const up = (e: PointerEvent) => {
      const p = pts.get(e.pointerId); pts.delete(e.pointerId)
      try { el.releasePointerCapture(e.pointerId) } catch { /* fine */ }
      if (pts.size < 2) mid = null
      if (drawing) { drawing = false; const g = groundAt(e); if (g && e.type === 'pointerup') draw?.end(g.x, g.z); else draw?.cancel(); return }
      if (!p || moved || pts.size) return
      // a tap, not a drag: touch moves the ghost there; a mouse click places (the ghost is already under it)
      setNdc(e)
      if (e.pointerType === 'mouse' && e.button === 0) tap?.()
    }
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0012)) }
    const menu = (e: Event) => e.preventDefault()   // a right drag pans; no menu
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false }); el.addEventListener('contextmenu', menu)
    const ta = el.style.touchAction; el.style.touchAction = 'none'
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel); el.removeEventListener('contextmenu', menu); el.style.touchAction = ta; ndc.current = null; point.has = false
      if (drawing) draw?.cancel()
    }
  }, [b, gl, camera])
  useFrame(() => {
    if (!on || !ndc.current) return
    ray.current.setFromCamera(new THREE.Vector2(ndc.current.x, ndc.current.y), camera)
    if (ray.current.ray.intersectPlane(plane.current, hit.current)) { point.x = hit.current.x; point.z = hit.current.z; point.has = true }
  })
  return null
}
