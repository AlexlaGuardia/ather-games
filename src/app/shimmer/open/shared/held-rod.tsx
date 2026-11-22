'use client'
// ── THE RINSTICK IN THE MITT (BETA M82 s2) ────────────────────────────────────────────────────────────────────────────────
// One rod, drawn as a child of the right mitt (open-hands portals `held` into it), so it moves with every pose and every
// authored action (fp-actions.ts). The hands tuner draws the SAME prop, so what Alex tunes there is what the game shows.
// Hand-local numbers: at rest the mitt's +y points ahead of the eye; the rig scales the hand x2, so 0.46 here is ~0.9 m.
//
// The line (rinning-fx.tsx) leaves from the rod's TIP: `heldRodTip` gives its world position this frame, or false when no
// rod is in a visible mitt (third person, a world without first-person hands like the continent), and the line falls back to
// its old camera-fixed rod.
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { ORDER } from './open-hands'

/** THE GRIP (Alex 11-22: "the rinnstick and the hand can be moved independently.. which makes it hard to get it right"): where the
 *  rod sits IN the mitt, set once in the hands tuner (Actions › Grip), so every pose after only moves the hand and the rod rides it.
 *  Hand-local metres / radians. These defaults ship; the tuner saves this browser's own (ROD_KEY, a device key) for pasting. */
export interface RodGrip { x: number; y: number; z: number; tilt: number; turn: number; roll: number; len: number }
export const ROD_DEFAULTS: Readonly<RodGrip> = { x: 0.01, y: -0.01, z: 0.02, tilt: 0.12, turn: 0, roll: 0, len: 0.46 }
export const ROD: RodGrip = { ...ROD_DEFAULTS }
export const ROD_KEY = 'open:rod-grip.v1'
export const ROD_KEYS = Object.keys(ROD_DEFAULTS) as (keyof RodGrip)[]
export function loadRodGrip(): void {
  try { const t = JSON.parse(localStorage.getItem(ROD_KEY) ?? 'null') as Partial<RodGrip> | null; for (const k of ROD_KEYS) ROD[k] = typeof t?.[k] === 'number' && Number.isFinite(t[k]) ? t[k]! : ROD_DEFAULTS[k] } catch { /* private window */ }
}
export function setRodGrip(patch: Partial<RodGrip>): void {
  for (const k of ROD_KEYS) if (typeof patch[k] === 'number' && Number.isFinite(patch[k])) ROD[k] = patch[k]!
  try { localStorage.setItem(ROD_KEY, JSON.stringify(ROD)) } catch { /* private window */ }
}
export function resetRodGrip(): void { try { localStorage.removeItem(ROD_KEY) } catch { /* */ } for (const k of ROD_KEYS) ROD[k] = ROD_DEFAULTS[k] }
const live = { tip: null as THREE.Object3D | null }

/** the rod tip's world position into `out`, from the transforms as they stand NOW (the hands were posed this frame) */
export function heldRodTip(out: THREE.Vector3): boolean {
  const t = live.tip
  if (!t) return false
  for (let o: THREE.Object3D | null = t; o; o = o.parent) if (!o.visible) return false
  t.updateWorldMatrix(true, false)
  t.getWorldPosition(out)
  return true
}

export function HeldRod() {
  const tip = useRef<THREE.Object3D>(null), grip = useRef<THREE.Group>(null), shaft = useRef<THREE.Mesh>(null)
  // the grip is read every frame, so a tuner slider moves the rod in the mitt at once
  useFrame(() => {
    const g = grip.current, m = shaft.current, t = tip.current; if (!g || !m || !t) return
    g.position.set(ROD.x, ROD.y, ROD.z); g.rotation.set(ROD.tilt, ROD.turn, ROD.roll)
    m.position.set(0, ROD.len / 2, 0); m.scale.set(1, ROD.len / ROD_DEFAULTS.len, 1); t.position.set(0, ROD.len, 0)
  })
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9a8160', roughness: 0.8, transparent: true, opacity: 1 }), [])
  useEffect(() => {
    loadRodGrip()
    const t = tip.current; live.tip = t
    // probe for checks (reading only): the tip's world position, or null when no rod is in a visible mitt
    ;(window as unknown as { __heldRod?: unknown }).__heldRod = { tip: () => { const v = new THREE.Vector3(); return heldRodTip(v) ? { x: v.x, y: v.y, z: v.z } : null } }
    return () => { if (live.tip === t) live.tip = null; mat.dispose() }
  }, [mat])
  return (
    <group ref={grip} position={[ROD.x, ROD.y, ROD.z]} rotation={[ROD.tilt, ROD.turn, ROD.roll]}>
      <mesh ref={shaft} material={mat} position={[0, ROD.len / 2, 0]} renderOrder={ORDER} frustumCulled={false}><cylinderGeometry args={[0.0035, 0.007, ROD_DEFAULTS.len, 6]} /></mesh>
      <object3D ref={tip} position={[0, ROD.len, 0]} />
    </group>
  )
}
