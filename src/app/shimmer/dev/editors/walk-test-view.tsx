'use client'

// ── BETA M87 (World Builder p5): the WALK TEST and the COST METER in the Fly view.
// WalkTest (inside the Canvas): H drops the keeper on foot at the crosshair spot of the DRAFT (walk-test.ts: the draft's ground +
// its solid pieces + the zone builds, the game's own walker); WASD walks, Space jumps, C crouches, the mouse (locked) or a
// right-drag turns the view; H again = back to Fly over where the keeper stands. While walking, Fly's rig and the brush sleep.
// CostProbe (inside the Canvas) + CostMeter (over it): the view's draw calls + triangles (three's renderer.info, last frame) and
// the frame's CPU time (before the frame's callbacks to after its render), against cost-meter.ts's budget, green/amber/red.

import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree, addEffect, addAfterEffect } from '@react-three/fiber'
import * as THREE from 'three'
import { NO_KEYS, type Cam, type Keys } from './fly-cam'
import { walkShape, enterWalk, stepWalk, exitWalk, walkEye, type Walk } from './walk-test'
import { BUDGETS, readMeter, smoothMs, fmtCount, type Budget, type Level, type Sample } from './cost-meter'
import { sceneryBoxes, sceneryPlaced } from '../../open/ather/scenery'
import { padGround } from '../../open/ather/glade-pads'
import { gladeShapeOver } from '../../open/ather/glade-people-check'
import type { Box } from '../../open/terrain-world'
import type { PlaceApi } from './place-mode'

type Ground = (x: number, z: number) => number
export const WALK_KEY = 'KeyH'
const KEYMAP: Record<string, keyof Keys> = { KeyW: 'f', KeyS: 'b', KeyA: 'l', KeyD: 'r', Space: 'up', KeyC: 'down', ShiftLeft: 'fast', ShiftRight: 'fast' }
const typing = (e: Event) => { const el = e.target as HTMLElement | null; return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') }
const CENTRE = new THREE.Vector2(0, 0)

/** the draft's walker boxes right now: its solid scenery (as the game stands it) + the zone builds */
export function draftBoxes(place: PlaceApi | undefined, heightAt: Ground, solids: readonly Box[]): Box[] {
  const props = place?.props ?? []
  return [...solids, ...sceneryBoxes(sceneryPlaced(props, padGround(props, heightAt), heightAt, place?.water))]
}

export function WalkTest({ camRef, walkRef, setWalking, heightAt, place, solids, glade }: {
  camRef: React.MutableRefObject<Cam | null>; walkRef: React.MutableRefObject<Walk | null>; setWalking: (on: boolean) => void
  heightAt: Ground; place?: PlaceApi; solids: readonly Box[]; glade: boolean
}) {
  const { camera, scene, raycaster } = useThree()
  const keys = useRef<Keys>({ ...NO_KEYS })
  const live = useRef({ heightAt, place, solids, glade }); live.current = { heightAt, place, solids, glade }
  useEffect(() => {
    const spot = () => {
      camera.updateMatrixWorld(); raycaster.setFromCamera(CENTRE, camera)
      const terrain: THREE.Object3D[] = []; scene.traverse(o => { if (o.userData?.terrain) terrain.push(o) })
      const h = raycaster.intersectObjects(terrain, false)[0]
      return h ? { x: h.point.x, z: h.point.z } : null
    }
    const toggle = () => {
      const c = camRef.current; if (!c) return false
      const L = live.current
      if (walkRef.current) { camRef.current = exitWalk(walkRef.current, c, L.heightAt); walkRef.current = null; setWalking(false); return true }
      const boxes = draftBoxes(L.place, L.heightAt, L.solids)
      const w = enterWalk(c, spot(), L.glade ? gladeShapeOver(L.heightAt, boxes) : walkShape(L.heightAt, boxes))
      if (!w) return false
      walkRef.current = w; keys.current = { ...NO_KEYS }
      camRef.current = { ...c, top: false, pitch: 0 }   // eye level: the walk looks ahead, the mouse turns it
      setWalking(true); return true
    }
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.metaKey) return
      if (e.code === WALK_KEY && !e.repeat) { toggle(); return }
      if (!walkRef.current) return
      const k = KEYMAP[e.code]; if (k) { keys.current[k] = true; if (e.code === 'Space') e.preventDefault() }
    }
    const up = (e: KeyboardEvent) => { const k = KEYMAP[e.code]; if (k) keys.current[k] = false }
    const blur = () => { keys.current = { ...NO_KEYS } }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
    // test hook (scripts/m87-walk-meter-check.mts)
    ;(window as unknown as { __walkTest?: unknown }).__walkTest = {
      walking: () => !!walkRef.current,
      toggle,
      body: () => { const w = walkRef.current; return w ? { x: w.loco.px, y: w.loco.py, z: w.loco.pz, airborne: w.loco.airborne, climbing: w.loco.climbing } : null },
      boxes: () => draftBoxes(live.current.place, live.current.heightAt, live.current.solids),
    }
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur)
      delete (window as unknown as { __walkTest?: unknown }).__walkTest
      if (walkRef.current) { walkRef.current = null; setWalking(false) }
    }
  }, [camera, scene, raycaster, camRef, walkRef, setWalking])
  useFrame((_, dt) => {
    const w = walkRef.current, c = camRef.current; if (!w || !c) return
    stepWalk(w, keys.current, c.yaw, Math.min(dt, 0.1))
    const e = walkEye(w)
    camera.position.set(e.x, e.y, e.z)
    camera.rotation.set(c.pitch, c.yaw, 0, 'YXZ')
  })
  return null
}

/** reads the renderer; leaves a sample in `sample` 4 times a second (the meter polls it, so the view never re-renders for it) */
export function CostProbe({ sample }: { sample: React.MutableRefObject<Sample | null> }) {
  const { gl } = useThree()
  const ms = useRef(0), t0 = useRef(0), last = useRef(0)
  useEffect(() => {
    const a = addEffect(() => { t0.current = performance.now() })
    const b = addAfterEffect(() => { if (t0.current) ms.current = smoothMs(ms.current, performance.now() - t0.current) })
    return () => { a(); b() }
  }, [])
  useFrame(() => {
    const now = performance.now(); if (now - last.current < 250) return
    last.current = now
    const r = gl.info.render   // three resets these at each render: this is the LAST frame's whole draw
    const s = { calls: r.calls, tris: r.triangles, ms: ms.current }
    sample.current = s
    ;(window as unknown as { __costMeter?: unknown }).__costMeter = s
  })
  return null
}

const COLOR: Record<Level, string> = { green: '#4ade80', amber: '#fbbf24', red: '#f87171' }
const pct = (v: number) => `${Math.round(v * 100)}%`
/** the readout, top right of the Fly view; the budget name toggles desktop / phone */
export function CostMeter({ sample: src, walking }: { sample: React.MutableRefObject<Sample | null>; walking: boolean }) {
  const [sample, setSample] = useState<Sample | null>(null), [budget, onBudget] = useState<Budget>(BUDGETS.desktop)
  useEffect(() => { const t = setInterval(() => setSample(src.current), 250); return () => clearInterval(t) }, [src])
  const r = sample ? readMeter(sample, budget) : null
  const row = (k: 'calls' | 'tris' | 'ms', v: string, of: string, unit: string) => r && (
    <div className="flex justify-between gap-2 tabular-nums" data-testid={`meter-${k}`} data-level={r.level[k]} style={{ color: COLOR[r.level[k]] }}>
      <span>{v} / {of} <span className="text-white/50">{unit}</span></span><span>{pct(r.share[k])}</span>
    </div>)
  // compact and click-through (only the budget button takes the mouse): the small Fly frame is ~400 px wide, its centre is the lock click
  return (
    <div className="absolute right-1.5 top-1.5 z-10 rounded bg-black/65 border px-1.5 py-0.5 text-[10px] leading-[1.35] font-mono text-white/80 w-[9.5rem] pointer-events-none" style={{ borderColor: r ? COLOR[r.worst] : 'rgba(255,255,255,0.1)' }} data-testid="cost-meter" data-level={r?.worst ?? ''}>
      <div className="flex justify-between gap-1 items-center">
        <span style={{ color: r ? COLOR[r.worst] : undefined }}>● cost</span>
        <button className="pointer-events-auto rounded bg-white/10 hover:bg-white/20 px-1" onClick={() => onBudget(budget.name === 'desktop' ? BUDGETS.phone : BUDGETS.desktop)} data-testid="meter-budget" title="budget: desktop (Intel UHD 630) or phone">{budget.label}</button>
      </div>
      {row('calls', String(r?.calls ?? 0), String(budget.calls), 'draws')}
      {row('tris', fmtCount(r?.tris ?? 0), fmtCount(budget.tris), 'tris')}
      {row('ms', (r?.ms ?? 0).toFixed(1), budget.ms.toFixed(1), 'ms')}
      <div className="text-white/50" data-testid="walk-hint">{walking ? 'on foot · H back to Fly' : 'H walks at the crosshair'}</div>
    </div>)
}
