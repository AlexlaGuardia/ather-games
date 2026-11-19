'use client'
// ── THE WILDS TERRAIN EDITOR (BETA M38 slice 1, Alex 11-19) ─────────────────────────────────────────────────────────────────
// Owner only (the ather_owner cookie via /api/owner, the same gate play3d's B editor uses). B toggles edit mode in the Wilds.
// With the pointer locked, HOLD the left button: the brush works the ground under the crosshair (a ring shows where).
//   , .   brush (raise / lower / flatten / smooth)      [ ]   radius      - =   strength
// While held, the ground you STAND on changes at once (the tile's heights are edited in place); on release the touched tiles
// re-parse (mesh, trees and crystals follow) and their edit maps are saved (POST /shimmer/save-wilds-edit). The data and the
// brush math: wilds-edits.ts. Desktop only (the 3D editors are; memory feedback_shimmer3d_editor_desktop_only).
// Checks read window.__wildsEdit (READ only).

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { applyBrush, mergeEdits, allEdits, saveTile, BRUSHES, RADII, STRENGTHS, type Brush, type BrushTile } from './wilds-edits'
import { reloadTiles, TILE_M, type WildsWorld } from './wilds-world'
import { hudSay } from '../shared/hud-say'

interface EdState { owner: boolean; on: boolean; brush: Brush; ri: number; si: number; painting: boolean; hit: { x: number; y: number; z: number } | null; saving: number; saved: number; failed: number; strokes: number }
const ed: EdState = { owner: false, on: false, brush: 'raise', ri: 1, si: 2, painting: false, hit: null, saving: 0, saved: 0, failed: 0, strokes: 0 }
const subs = new Set<() => void>()
let snap = { ...ed }
const emit = () => { snap = { ...ed }; subs.forEach(f => f()) }
const useEd = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => snap, () => snap)
/** Is the editor holding the mouse? Other systems can ask (they don't need to: the editor eats its own clicks). */
export const wildsEditing = () => ed.on

const APPLY_EVERY = 0.12   // s between brush applications while the button is held
const RING_N = 48

/** Inside the Canvas. `onChanged` = the page's re-render after tiles were replaced (setWrev). */
export function WildsEditorRig({ ww, onChanged }: { ww: WildsWorld; onChanged: () => void }) {
  const { camera } = useThree()
  const ringObj = useMemo(() => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((RING_N + 1) * 3), 3))
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffd27a', depthTest: false, transparent: true, opacity: 0.9 }))
    l.frustumCulled = false; l.renderOrder = 10; l.visible = false; return l
  }, [])
  useEffect(() => () => { ringObj.geometry.dispose(); (ringObj.material as THREE.Material).dispose() }, [ringObj])
  const ring = useRef<THREE.Line>(ringObj); ring.current = ringObj
  const touched = useRef(new Set<string>()), acc = useRef(0), target = useRef<number | null>(null)
  const wwRef = useRef(ww); wwRef.current = ww
  const changedRef = useRef(onChanged); changedRef.current = onChanged

  useEffect(() => {
    let alive = true
    fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(j => { if (alive) { ed.owner = !!j?.owner; emit() } }).catch(() => {})
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'KeyB') {
        if (!ed.owner) return
        ed.on = !ed.on; ed.painting = false; emit()
        hudSay(ed.on ? 'Terrain editor: hold click to sculpt · B to leave' : 'Terrain editor off', 'info'); return
      }
      if (!ed.on) return
      if (e.code === 'Comma' || e.code === 'Period') { const i = BRUSHES.indexOf(ed.brush); ed.brush = BRUSHES[(i + (e.code === 'Period' ? 1 : BRUSHES.length - 1)) % BRUSHES.length]; emit() }
      else if (e.code === 'BracketLeft' || e.code === 'BracketRight') { ed.ri = Math.max(0, Math.min(RADII.length - 1, ed.ri + (e.code === 'BracketRight' ? 1 : -1))); emit() }
      else if (e.code === 'Minus' || e.code === 'Equal') { ed.si = Math.max(0, Math.min(STRENGTHS.length - 1, ed.si + (e.code === 'Equal' ? 1 : -1))); emit() }
    }
    // capture phase on window: runs before the gun and the stowed 'work the node' click, and stops them while editing
    const down = (e: MouseEvent) => {
      if (!ed.on || e.button !== 0 || !document.pointerLockElement) return
      e.stopPropagation(); e.preventDefault()
      ed.painting = true; acc.current = APPLY_EVERY; target.current = ed.hit?.y ?? null; emit()
    }
    const up = (e: MouseEvent) => {
      if (e.button !== 0 || !ed.painting) return
      e.stopPropagation(); ed.painting = false; ed.strokes++; emit()
      const names = [...touched.current]; touched.current.clear()
      if (!names.length) return
      void reloadTiles(wwRef.current, names).then(ch => { if (ch) changedRef.current() })
      ed.saving += names.length; emit()
      for (const n of names) void saveTile(n).then(ok => { ed.saving--; if (ok) ed.saved++; else ed.failed++; emit(); if (!ok) hudSay('Terrain edit NOT saved (owner only)', 'info') })
    }
    window.addEventListener('keydown', key); window.addEventListener('mousedown', down, true); window.addEventListener('mouseup', up, true)
    const g = window as unknown as { __wildsEdit?: unknown }
    g.__wildsEdit = { state: () => ({ ...ed }), heightAt: (x: number, z: number) => wwRef.current.heightAt(x, z), edits: () => JSON.parse(JSON.stringify(allEdits())) }
    return () => { alive = false; window.removeEventListener('keydown', key); window.removeEventListener('mousedown', down, true); window.removeEventListener('mouseup', up, true); delete g.__wildsEdit; ed.on = false; ed.painting = false }
  }, [])

  const dir = useRef(new THREE.Vector3())
  useFrame((_, dt) => {
    const W = wwRef.current
    if (!ed.on) { if (ring.current) ring.current.visible = false; if (ed.hit) { ed.hit = null } return }
    // the ground under the crosshair: march the view ray, then halve the last step
    camera.getWorldDirection(dir.current)
    const o = camera.position, d = dir.current
    let hit: { x: number; y: number; z: number } | null = null, prev = 0
    for (let t = 0.5; t < 160; t += 0.5) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, h = W.heightAt(x, z)
      if (!Number.isFinite(h)) break
      if (y <= h) {
        let a = prev, b = t
        for (let k = 0; k < 8; k++) { const m = (a + b) / 2; if (o.y + d.y * m <= W.heightAt(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m }
        const x2 = o.x + d.x * b, z2 = o.z + d.z * b; hit = { x: x2, y: W.heightAt(x2, z2), z: z2 }; break
      }
      prev = t
    }
    ed.hit = hit
    const r = RADII[ed.ri]
    if (ring.current) {
      ring.current.visible = !!hit
      if (hit) {
        const p = ring.current.geometry.getAttribute('position') as THREE.BufferAttribute
        for (let i = 0; i <= RING_N; i++) { const a = (i / RING_N) * Math.PI * 2, x = hit.x + Math.cos(a) * r, z = hit.z + Math.sin(a) * r; p.setXYZ(i, x, W.heightAt(x, z) + 0.15, z) }
        p.needsUpdate = true; ring.current.geometry.computeBoundingSphere()
      }
    }
    if (!ed.painting || !hit) return
    acc.current += dt
    if (acc.current < APPLY_EVERY) return
    acc.current = 0
    const tiles: BrushTile[] = []
    for (const [name, T] of W.loaded) {
      const e = W.byName.get(name); if (!e) continue
      const ox = e.tx * TILE_M, oz = e.ty * TILE_M
      if (Math.abs(hit.x - ox) > TILE_M / 2 + r || Math.abs(hit.z - oz) > TILE_M / 2 + r) continue
      tiles.push({ name, ox, oz, nx: T.meta.nx, nz: T.meta.nz, cell: T.meta.cell, sizeX: T.meta.sizeX, sizeZ: T.meta.sizeZ })
    }
    const cur = allEdits()
    const res = applyBrush(W.heightAt, tiles, cur, { kind: ed.brush, x: hit.x, z: hit.z, r, s: STRENGTHS[ed.si], target: target.current ?? hit.y })
    // the ground you stand on changes NOW: shift the loaded tile's heights by the change in delta
    for (const [name, verts] of Object.entries(res)) {
      const T = W.loaded.get(name); if (!T) continue
      const was = cur[name] ?? {}
      for (const [k, v] of Object.entries(verts)) { const i = +k; if (i >= 0 && i < T.h.length) T.h[i] += (v - (was[k] ?? 0)) / 10 }
      touched.current.add(name)
    }
    mergeEdits(cur, res)
  })

  return <primitive object={ringObj} />
}

/** Outside the Canvas: what the brush is, on a plate (game-UI rule: never raw on the scene). */
export function WildsEditorPanel() {
  const s = useEd()
  if (!s.on) return null
  const k = (t: string) => <span style={{ color: '#ffd27a', fontWeight: 800 }}>{t}</span>
  return (
    <div data-wilds-editor style={{ position: 'fixed', top: 12, right: 12, zIndex: 40, pointerEvents: 'none', background: 'rgba(16,22,30,.82)', border: '1px solid rgba(255,210,122,.55)', borderRadius: 10, padding: '8px 12px', color: '#eaf4fb', font: '600 12px/1.5 system-ui, sans-serif', fontVariantNumeric: 'tabular-nums', minWidth: 210 }}>
      <div style={{ letterSpacing: '.14em', textTransform: 'uppercase', fontSize: 11, color: '#ffd27a', marginBottom: 4 }}>Terrain editor</div>
      <div>Brush {k(s.brush.toUpperCase())} · radius {k(`${RADII[s.ri]} m`)} · strength {k(`${STRENGTHS[s.si]}`)}</div>
      <div style={{ color: '#9fb3c4', fontSize: 11 }}>hold click sculpt · , . brush · [ ] radius · - = strength · B leave</div>
      <div style={{ color: s.failed ? '#ff6a5c' : '#9fb3c4', fontSize: 11 }}>{s.painting ? 'sculpting…' : s.saving ? 'saving…' : s.failed ? `${s.failed} save(s) failed` : s.saved ? 'saved' : ' '}</div>
    </div>
  )
}
