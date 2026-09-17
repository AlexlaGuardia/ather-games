'use client'

// CREATIVE MODE FOR THE WORKTABLE (Alex, 2026-09-16: *"id like it to feel like minecraft creative mode"*).
//
// The mouse-pointer editor placed where the POINTER was: a click raycast through the cursor, stepped
// half a block along a normal, and the author guessed which cell that meant. The only thing the
// hand learns from a block editor is where the next block goes, and the grammar every builder
// already has is the one Minecraft taught: the camera is a body, the cursor is a crosshair in the
// middle of the screen, the cell it is looking at wears an outline, LEFT BREAKS and RIGHT PLACES,
// the wheel walks a hotbar of nine, and E opens the inventory. This file is that grammar, and the
// page keeps the panel (save / load / place-in-world / the palette) as the inventory behind E.
//
// ★ THE RAY IS A GRID WALK, NOT A MESH RAYCAST (`creative-ray.ts`) — the target cell and the face
// it was seen through come out of the walk exactly, so "which cell did that click mean" is not a
// question any more. The outline is drawn on that cell; the placed block goes on `cell + normal`.
//
// ⚠ POINTER LOCK OWNS THE PANEL. While the pointer is locked the panel is hidden and every key is
// the editor's; Esc (the browser's own exit) or E unlocks and the panel returns as the inventory.
// Clicking the canvas while unlocked LOCKS and does nothing else — the two mouse buttons only build
// while locked, because a locked pointer is the only one that is where the crosshair is.
//
// ⚠ SPRINT IS DOUBLE-TAP W, NOT CTRL. Minecraft's sprint key is Ctrl, and Ctrl+W closes the tab in
// every browser — no `preventDefault` reaches it. Double-tap W is Minecraft's other sprint and it
// costs the browser nothing.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { voxelRay, type Vec3 } from './creative-ray'
import { buildTileArray, sliceLayer, layerOf, TOP, SIDE } from '../../voxel3d/tex/tiles'
import { blockDef } from '../../voxel/registry'
import { isGlassMat } from '../../voxel/depth'
import { pieceDef } from '../../voxel/pieces'

/** What a hotbar slot holds. */
export type Slot = { kind: 'block'; m: number } | { kind: 'piece'; id: string } | null
export const HOTBAR_SIZE = 9

/** How far the crosshair reaches, in blocks. Minecraft creative is 5; an editor wants a little more. */
export const REACH = 10
/** Base fly speed, blocks/s. `-`/`=` scale it; double-tap W sprints at 2.5×. */
const BASE_SPEED = 10
const SPRINT = 2.5
/** Mouse look, radians per locked pixel. */
const LOOK = 0.0022
/** Held-button repeat, seconds — Minecraft's creative cadence — when the crosshair stays on ONE cell. */
const REPEAT = 0.22
/**
 * ★ DRAG-PLACING (GBOARD's "hold-to-place along a line"). With a button held, moving the crosshair
 * onto a NEW cell fires at once rather than waiting out the repeat: sweep the crosshair along a wall
 * and every cell it crosses gets a block, no gaps at any hand speed. The repeat only paces the case
 * where the target has not moved (a tower toward you, a hole straight down). Minecraft's own
 * creative break works this way — a fresh block under the crosshair breaks immediately.
 *
 * ⚠ THE HAND MUST HAVE MOVED, and the world changing under the crosshair does not count: a place
 * puts a new block where the eye is looking, so "the target changed" is true after every place
 * with the hand dead still, and firing on it towers toward the camera at 25 blocks a second. The
 * evidence is the LOOK swept since the last fire, in radians, against half a cell's angle at the
 * hit distance — jitter is a hundredth of that; a sweep that actually crossed to the next cell is
 * at least that by construction.
 */
const DRAG_MIN = 0.04
/**
 * And the repeat is for a STILL hand only: a sweeping hand fires on cell crossings and nothing
 * else, so a drag draws a line rather than Minecraft's line-with-lumps (its repeat keeps firing
 * while you sweep, stacking a second block wherever the tick lands on one you just placed). Under
 * this much look per repeat interval the hand counts as still — 0.02 rad is ~9 px, above a
 * resting hand's tremor and far below any sweep.
 */
const STILL = 0.02

export type CreativeActions = {
  /** Cells the crosshair's walk treats as solid: blocks, piece footprints, the pad. */
  solid: (x: number, y: number, z: number) => boolean
  /**
   * The cells to outline in gold at `at` — a block: one; refused or nothing in range (`at` null): none.
   * Called EVERY frame, with `at` null when the crosshair looks at nothing it can build on, so the
   * page can show its own preview (the shipped piece ghost) and hide it again when the look leaves.
   * `eye` is where the body stands — the page refuses to build into it, Minecraft's rule.
   */
  ghost: (at: Vec3 | null, eye: Vec3) => Vec3[]
  onBreak: (cell: Vec3) => void
  onPlace: (cell: Vec3, normal: Vec3, eye: Vec3) => void
  /**
   * ★ BOX FILL (F). Two corners, inclusive, and what to do with every cell between: `fill` with the
   * held block (cells already taken, off the pad or in the body are skipped, not refused), `clear`
   * every block (pieces are left standing — clearing a wall should not eat its door).
   */
  onFill: (a: Vec3, b: Vec3, op: 'fill' | 'clear', eye: Vec3) => void
  onPick: (cell: Vec3) => void
  /** Wheel over the hotbar: +1 down, -1 up. */
  onScroll: (delta: 1 | -1) => void
  onLocked: (locked: boolean) => void
  /** One line for the readout under the crosshair. */
  describe: (cell: Vec3) => string
}

const isTyping = () => {
  const t = document.activeElement
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')
}

/**
 * The body, the look, the crosshair's walk and the outlines. Mounted inside the Canvas. `actions` is
 * read through a ref every frame, so the page can hand a fresh closure per render without this
 * component's listeners being torn down and rebuilt on every block placed.
 */
export function CreativeRig({ active, actions, readout, start }: {
  active: boolean
  actions: CreativeActions
  readout: React.RefObject<HTMLDivElement | null>
  /** Where the body stands the FIRST time creative is entered — the orbit's pose, so the structure is in view. */
  start: { position: Vec3; lookAt: Vec3 }
}) {
  const { camera, gl } = useThree()
  const act = useRef(actions); act.current = actions
  const s = useRef({
    yaw: 0, pitch: 0, speed: BASE_SPEED, sprint: false, lastW: -1, held: new Set<string>(),
    locked: false, button: -1 as number, nextAt: 0, lastFired: '', swept: 0,
    target: null as null | { cell: Vec3; normal: Vec3; dist: number }, ghostKey: '', readoutText: '',
    // the fill tool: armed by F; `a` is the first corner once a click has set it
    fill: false, a: null as Vec3 | null, aClear: false, fillKey: '',
  })

  // The outlines: the looked-at cell (dark, thin) and the cells a place would fill (gold, faint).
  const group = useMemo(() => {
    const g = new THREE.Group()
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004))
    const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthTest: true }))
    outline.name = 'outline'; outline.visible = false
    g.add(outline)
    const ghost = new THREE.Group(); ghost.name = 'ghost'
    g.add(ghost)
    // the fill box: ONE unit box + its edges, scaled to the span — a 20×20×10 fill is one mesh, not
    // four thousand
    const fillBox = new THREE.Group(); fillBox.name = 'fill'; fillBox.visible = false
    g.add(fillBox)
    return g
  }, [])
  const ghostMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.22, depthWrite: false }), [])
  const ghostEdge = useMemo(() => new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.7 }), [])
  const unitBox = useMemo(() => new THREE.BoxGeometry(0.98, 0.98, 0.98), [])
  const unitEdges = useMemo(() => new THREE.EdgesGeometry(unitBox), [unitBox])
  const fillMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x7ad7ff, transparent: true, opacity: 0.18, depthWrite: false }), [])
  const fillEdge = useMemo(() => new THREE.LineBasicMaterial({ color: 0x7ad7ff, transparent: true, opacity: 0.9 }), [])
  const oneBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const oneEdges = useMemo(() => new THREE.EdgesGeometry(oneBox), [oneBox])
  useEffect(() => {
    const fb = group.getObjectByName('fill') as THREE.Group
    fb.add(new THREE.Mesh(oneBox, fillMat), new THREE.LineSegments(oneEdges, fillEdge))
    return () => { fb.clear() }
  }, [group, oneBox, oneEdges, fillMat, fillEdge])
  useEffect(() => () => { unitBox.dispose(); unitEdges.dispose(); ghostMat.dispose(); ghostEdge.dispose(); oneBox.dispose(); oneEdges.dispose(); fillMat.dispose(); fillEdge.dispose() },
    [unitBox, unitEdges, ghostMat, ghostEdge, oneBox, oneEdges, fillMat, fillEdge])

  // Enter where the previous stance left the camera, facing the way it faced. The FIRST entry has no
  // previous stance — creative is the default and the Canvas camera sits at its own origin — so it
  // takes the orbit's pose instead; without this the page opened on empty sky with the station off
  // the right edge (seen 09-16).
  const entered = useRef(false)
  const startRef = useRef(start); startRef.current = start
  useEffect(() => {
    if (!active) { group.visible = false; return }
    if (!entered.current) {
      entered.current = true
      const p = startRef.current.position, l = startRef.current.lookAt
      camera.position.set(p.x, p.y, p.z)
      camera.lookAt(l.x, l.y, l.z)
    }
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
    s.current.yaw = e.y; s.current.pitch = e.x
    group.visible = true
  }, [active, camera, group])

  useEffect(() => {
    const el = gl.domElement
    const st = s.current
    // Losing the lock disarms the fill too — Esc is the browser's own exit, and it is also the key
    // every hand reaches for to cancel a tool.
    const setLocked = (v: boolean) => { st.locked = v; if (!v) { st.held.clear(); st.button = -1; st.fill = false; st.a = null } act.current.onLocked(v) }
    const lockChange = () => setLocked(document.pointerLockElement === el)
    const lock = () => {
      if (document.pointerLockElement === el) return
      // ⚠ Blur whatever was clicked last. A focused button re-fires on Space, and Space is "up".
      ;(document.activeElement as HTMLElement | null)?.blur?.()
      // Chrome throws / rejects when a lock is requested inside the ~1s cooldown after an Esc; that
      // is a "try again", not an error worth surfacing.
      try { const p = el.requestPointerLock() as unknown; if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => {}) } catch { /* cooldown */ }
    }
    const mouseMove = (e: MouseEvent) => {
      if (!active || !st.locked) return
      st.yaw -= e.movementX * LOOK
      st.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, st.pitch - e.movementY * LOOK))
      st.swept += Math.hypot(e.movementX, e.movementY) * LOOK
    }
    const fire = (button: number) => {
      const t = st.target
      if (!t) return
      if (st.fill) {
        // a corner: right names the cell a block would go in, left the solid cell under the crosshair
        const c = button === 2 ? ((t.normal.x || t.normal.y || t.normal.z) ? { x: t.cell.x + t.normal.x, y: t.cell.y + t.normal.y, z: t.cell.z + t.normal.z } : null)
                : button === 0 ? t.cell : null
        if (!c) return
        if (!st.a) { st.a = c; st.aClear = button === 0; return }
        act.current.onFill(st.a, c, button === 0 ? 'clear' : 'fill', camera.position)
        st.fill = false; st.a = null
        return
      }
      st.lastFired = `${t.cell.x},${t.cell.y},${t.cell.z}`; st.swept = 0
      if (button === 0) act.current.onBreak(t.cell)
      else if (button === 2) { if (t.normal.x || t.normal.y || t.normal.z) act.current.onPlace({ x: t.cell.x + t.normal.x, y: t.cell.y + t.normal.y, z: t.cell.z + t.normal.z }, t.normal, camera.position) }
      else if (button === 1) act.current.onPick(t.cell)
    }
    const mouseDown = (e: MouseEvent) => {
      if (!active) return
      if (!st.locked) { lock(); return }
      e.preventDefault()
      fire(e.button)
      // ⚠ WALL TIME, NOT THE FRAME CLOCK. `clock.elapsedTime` is the LAST frame's stamp; a press that
      // lands late in a frame read a stale clock and the repeat fired on the very next frame — one
      // click, two blocks. Invisible at 60 fps (≤16 ms stale), a certainty at the harness's 3 fps.
      if ((e.button === 0 || e.button === 2) && !st.fill) { st.button = e.button; st.nextAt = performance.now() / 1000 + REPEAT * 1.6 }
    }
    const mouseUp = () => { st.button = -1 }
    const wheel = (e: WheelEvent) => {
      if (!active) return
      e.preventDefault()
      if (e.deltaY !== 0) act.current.onScroll(e.deltaY > 0 ? 1 : -1)
    }
    const keyDown = (e: KeyboardEvent) => {
      if (!active || isTyping()) return
      // Only while locked or with nothing focused does the editor own the keyboard.
      switch (e.code) {
        case 'KeyW': {
          if (!st.held.has('KeyW')) {
            const now = performance.now()
            if (now - st.lastW < 300) st.sprint = true
            st.lastW = now
          }
          st.held.add(e.code); return
        }
        case 'KeyA': case 'KeyS': case 'KeyD': case 'ShiftLeft': case 'ShiftRight':
          st.held.add(e.code); return
        case 'Space':
          e.preventDefault(); st.held.add(e.code); return
        case 'Minus': st.speed = Math.max(2, st.speed / 1.25); return
        case 'Equal': st.speed = Math.min(60, st.speed * 1.25); return
        case 'KeyE':
          e.preventDefault()
          if (st.locked) document.exitPointerLock(); else lock()
          return
        case 'KeyF':
          // arm the fill (or disarm it, corner and all); only while locked — a fill needs a crosshair
          if (!st.locked) return
          st.fill = !st.fill; st.a = null; st.button = -1
          return
      }
    }
    const keyUp = (e: KeyboardEvent) => {
      st.held.delete(e.code)
      if (e.code === 'KeyW') st.sprint = false
    }
    const blur = () => { st.held.clear(); st.sprint = false; st.button = -1 }
    document.addEventListener('pointerlockchange', lockChange)
    el.addEventListener('mousedown', mouseDown)
    window.addEventListener('mouseup', mouseUp)
    window.addEventListener('mousemove', mouseMove)
    el.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    // A readout for a harness: where the body is and what it looks at. Dev page, dev handle.
    ;(window as unknown as { __worktable?: unknown }).__worktable = {
      eye: () => camera.position.toArray(), target: () => st.target, locked: () => st.locked,
    }
    return () => {
      delete (window as unknown as { __worktable?: unknown }).__worktable
      document.removeEventListener('pointerlockchange', lockChange)
      el.removeEventListener('mousedown', mouseDown)
      window.removeEventListener('mouseup', mouseUp)
      window.removeEventListener('mousemove', mouseMove)
      el.removeEventListener('wheel', wheel)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', blur)
      if (document.pointerLockElement === el) document.exitPointerLock()
    }
  }, [active, gl, camera])

  useFrame((_, dt) => {
    if (!active) return
    const st = s.current
    camera.quaternion.setFromEuler(new THREE.Euler(st.pitch, st.yaw, 0, 'YXZ'))

    // ── the body ──────────────────────────────────────────────────────────────────────────────
    const k = st.held
    if (k.size) {
      const step = st.speed * (st.sprint ? SPRINT : 1) * Math.min(dt, 0.1)
      // Horizontal movement follows the YAW only — Minecraft's fly walks level when you look down.
      const fwd = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw))
      const right = new THREE.Vector3(Math.cos(st.yaw), 0, -Math.sin(st.yaw))
      const m = new THREE.Vector3()
      if (k.has('KeyW')) m.add(fwd)
      if (k.has('KeyS')) m.sub(fwd)
      if (k.has('KeyD')) m.add(right)
      if (k.has('KeyA')) m.sub(right)
      if (k.has('Space')) m.y += 1
      if (k.has('ShiftLeft') || k.has('ShiftRight')) m.y -= 1
      if (m.lengthSq() > 0) camera.position.addScaledVector(m.normalize(), step)
    }

    // ── the crosshair's walk ──────────────────────────────────────────────────────────────────
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const hit = voxelRay(camera.position, dir, act.current.solid, REACH)
    st.target = hit ? { cell: hit.cell, normal: hit.normal, dist: hit.dist } : null
    const outline = group.getObjectByName('outline')!
    const ghost = group.getObjectByName('ghost') as THREE.Group
    // The page hears about the looked-at place every frame — a null when there is none — so its own
    // preview (the piece ghost) tracks the crosshair and leaves with it. The gold boxes are only what
    // it returns; the outline meshes below are reused per distinct set, not rebuilt per frame.
    const at = hit && (hit.normal.x || hit.normal.y || hit.normal.z)
      ? { x: hit.cell.x + hit.normal.x, y: hit.cell.y + hit.normal.y, z: hit.cell.z + hit.normal.z } : null
    const cells = act.current.ghost(at, camera.position)
    const gk = cells.map(c => `${c.x},${c.y},${c.z}`).join('|')
    if (gk !== st.ghostKey) {
      st.ghostKey = gk
      ghost.clear()
      for (const c of cells) {
        const box = new THREE.Mesh(unitBox, ghostMat); box.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5); ghost.add(box)
        const ln = new THREE.LineSegments(unitEdges, ghostEdge); ln.position.copy(box.position); ghost.add(ln)
      }
    }
    // ── the fill box ──────────────────────────────────────────────────────────────────────────
    // From the first corner to the cell the crosshair would build in now (a block's place cell);
    // before a corner is set, nothing but the readout's "fill: pick a corner".
    const fb = group.getObjectByName('fill') as THREE.Group
    let fillText = ''
    if (st.fill) {
      // the first corner's button says which cell the second is: a clear reaches to the solid cell
      // under the crosshair, a fill to the cell a block would go in
      const b = st.aClear ? (hit ? hit.cell : null) : (at ?? (hit ? hit.cell : null))
      if (st.a && b) {
        const lo = { x: Math.min(st.a.x, b.x), y: Math.min(st.a.y, b.y), z: Math.min(st.a.z, b.z) }
        const hi = { x: Math.max(st.a.x, b.x), y: Math.max(st.a.y, b.y), z: Math.max(st.a.z, b.z) }
        const w = hi.x - lo.x + 1, h = hi.y - lo.y + 1, d = hi.z - lo.z + 1
        const fk = `${lo.x},${lo.y},${lo.z}|${w},${h},${d}`
        if (fk !== st.fillKey) {
          st.fillKey = fk
          fb.position.set(lo.x + w / 2, lo.y + h / 2, lo.z + d / 2); fb.scale.set(w + 0.01, h + 0.01, d + 0.01)
        }
        fb.visible = true
        fillText = `fill ${w}×${h}×${d} = ${w * h * d} · right fills, left clears · `
      } else if (st.a) {
        fb.position.set(st.a.x + 0.5, st.a.y + 0.5, st.a.z + 0.5); fb.scale.set(1.01, 1.01, 1.01); fb.visible = true; st.fillKey = ''
        fillText = 'fill: corner set · look at the other · '
      } else { fb.visible = false; st.fillKey = ''; fillText = 'fill: click a corner (right = a place, left = a block) · F cancels · ' }
    } else if (fb.visible) { fb.visible = false; st.fillKey = '' }

    if (hit) {
      outline.visible = true
      outline.position.set(hit.cell.x + 0.5, hit.cell.y + 0.5, hit.cell.z + 0.5)
    } else outline.visible = false
    const text = fillText + (hit ? act.current.describe(hit.cell) : '')
    if (text !== st.readoutText && readout.current) { st.readoutText = text; readout.current.textContent = text }

    // ── held-button repeat ────────────────────────────────────────────────────────────────────
    if (st.button >= 0 && st.locked) {
      const t = st.target
      const now = performance.now() / 1000
      const k = t ? `${t.cell.x},${t.cell.y},${t.cell.z}` : ''
      const go = () => {
        if (!t) return
        st.lastFired = k
        if (st.button === 0) act.current.onBreak(t.cell)
        else if (t.normal.x || t.normal.y || t.normal.z) act.current.onPlace({ x: t.cell.x + t.normal.x, y: t.cell.y + t.normal.y, z: t.cell.z + t.normal.z }, t.normal, camera.position)
      }
      // a new cell the HAND swept to fires now (drag-placing) …
      if (t && k !== st.lastFired && st.swept >= 0.5 / Math.max(1, t.dist) && now >= st.nextAt - REPEAT + DRAG_MIN) {
        go(); st.nextAt = now + REPEAT; st.swept = 0
      } else if (now >= st.nextAt) {
        // … and the repeat tick fires only if the hand was still for its whole interval — the same
        // cell (a tower toward you, a hole straight down), never a lump on a line being drawn
        if (st.swept < STILL) go()
        st.nextAt = now + REPEAT; st.swept = 0
      }
    }
  })

  return <primitive object={group} />
}

// ── the HUD ─────────────────────────────────────────────────────────────────────────────────────

/** Two hairlines that invert whatever is behind them, so they read on sky and on stone alike. */
export function Crosshair() {
  const bar: React.CSSProperties = { position: 'absolute', background: '#fff', mixBlendMode: 'difference' }
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none' }}>
      <div style={{ ...bar, left: -9, top: -1, width: 18, height: 2 }} />
      <div style={{ ...bar, left: -1, top: -9, width: 2, height: 18 }} />
    </div>
  )
}

/**
 * A block's swatch — the shipped tile drawn as a little isometric cube (top + two sides), which is the
 * shape a hand recognises in a hotbar. Cached per material; the tile array is built once.
 */
let tiles: Uint8Array | null = null
const swatches = new Map<number, string>()
export function blockSwatch(m: number): string {
  const hit = swatches.get(m)
  if (hit) return hit
  if (typeof document === 'undefined') return ''
  tiles ??= buildTileArray(16)
  const face = (f: number) => {
    const px = sliceLayer(tiles!, 16, layerOf(m, f))
    // ⚠ THE ATLAS ALPHA IS AN EMISSIVE MASK, NOT OPACITY (`tiles.ts` › writeOre) — drawn as-is, every
    // opaque block is invisible. Glass is the one family whose alpha is COVERAGE, and the glass pass
    // discards below half; the same rule here.
    const glass = isGlassMat(m)
    for (let i = 3; i < px.length; i += 4) px[i] = glass ? (px[i] >= 128 ? 255 : 0) : 255
    const c = document.createElement('canvas'); c.width = 16; c.height = 16
    c.getContext('2d')!.putImageData(new ImageData(px, 16, 16), 0, 0)
    return c
  }
  const top = face(TOP), side = face(SIDE)
  const S = 44, cx = S / 2, w = 19, h = 9.5, v = 20, y0 = 3
  const c = document.createElement('canvas'); c.width = S; c.height = S
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  // top: left corner → top corner is u, left corner → bottom corner is v
  ctx.setTransform(w / 16, -h / 16, w / 16, h / 16, cx - w, y0 + h); ctx.drawImage(top, 0, 0)
  // left side: from the left corner down-right to the bottom corner, then straight down
  ctx.setTransform(w / 16, h / 16, 0, v / 16, cx - w, y0 + h); ctx.drawImage(side, 0, 0)
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, 0, 16, 16)
  // right side: from the bottom corner up-right to the right corner, then straight down
  ctx.setTransform(w / 16, -h / 16, 0, v / 16, cx, y0 + 2 * h); ctx.drawImage(side, 0, 0)
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 0, 16, 16)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const url = c.toDataURL()
  swatches.set(m, url)
  return url
}

/**
 * A swatch URL that is EMPTY on the server and on the hydrating render, then filled. `blockSwatch`
 * needs a canvas; computing it during render made the server's `src=""` disagree with the client's
 * data URL, React refused to patch the attribute, and every slot rendered blank (09-16).
 */
export function useSwatch(m: number | null): string {
  const [url, setUrl] = useState('')
  useEffect(() => { setUrl(m === null ? '' : blockSwatch(m)) }, [m])
  return url
}
export function Swatch({ m, size }: { m: number; size: number }) {
  const url = useSwatch(m)
  return url
    ? <img src={url} alt="" width={size} height={size} style={{ imageRendering: 'pixelated', flex: 'none' }} draggable={false} />
    : <span style={{ width: size, height: size, flex: 'none', display: 'inline-block' }} />
}

export const slotLabel = (s: Slot): string =>
  !s ? '' : s.kind === 'block' ? (blockDef(s.m)?.name ?? `#${s.m}`) : (pieceDef(s.id)?.name ?? s.id)

/** Nine slots along the bottom. Digits and the wheel select; the inventory fills. */
export function Hotbar({ slots, index, onSelect, pieceRot, dim }: {
  slots: Slot[]; index: number; onSelect: (i: number) => void; pieceRot: number; dim?: boolean
}) {
  const cur = slots[index]
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)', pointerEvents: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: dim ? 0.55 : 1 }}>
      <div style={{ font: '13px/1.2 ui-monospace, Menlo, monospace', color: '#fff', textShadow: '0 1px 2px #000, 0 0 6px #000',
                    minHeight: 16, letterSpacing: '0.02em' }}>
        {slotLabel(cur)}{cur?.kind === 'piece' ? <span style={{ opacity: 0.7 }}> · rot {pieceRot} (R)</span> : ''}
      </div>
      <div style={{ display: 'flex', gap: 2, padding: 3, background: 'rgba(8,12,16,0.72)', border: '1px solid rgba(150,180,210,0.3)',
                    borderRadius: 4, pointerEvents: 'auto' }}>
        {slots.map((s, i) => (
          <div key={i} onMouseDown={e => { e.stopPropagation(); onSelect(i) }} title={slotLabel(s) || 'empty — pick from the inventory (E)'}
               style={{ width: 46, height: 46, boxSizing: 'border-box', position: 'relative', cursor: 'pointer',
                        border: i === index ? '2px solid #fff' : '2px solid rgba(255,255,255,0.12)',
                        background: i === index ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {s?.kind === 'block' && <Swatch m={s.m} size={40} />}
            {s?.kind === 'piece' && (
              <span style={{ font: '9px/1.1 ui-monospace, Menlo, monospace', color: '#ffcf8a', textAlign: 'center', padding: 2, wordBreak: 'break-word' }}>
                {slotLabel(s)}
              </span>
            )}
            <span style={{ position: 'absolute', left: 3, top: 1, font: '9px ui-monospace, Menlo, monospace', color: 'rgba(255,255,255,0.55)' }}>{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
