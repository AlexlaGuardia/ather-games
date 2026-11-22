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
import { ORDER } from './open-hands'

export const ROD = { len: 0.46, base: [0.01, -0.01, 0.02] as const, tilt: 0.12 }
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
  const tip = useRef<THREE.Object3D>(null)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9a8160', roughness: 0.8, transparent: true, opacity: 1 }), [])
  useEffect(() => {
    const t = tip.current; live.tip = t
    // probe for checks (reading only): the tip's world position, or null when no rod is in a visible mitt
    ;(window as unknown as { __heldRod?: unknown }).__heldRod = { tip: () => { const v = new THREE.Vector3(); return heldRodTip(v) ? { x: v.x, y: v.y, z: v.z } : null } }
    return () => { if (live.tip === t) live.tip = null; mat.dispose() }
  }, [mat])
  return (
    <group position={[ROD.base[0], ROD.base[1], ROD.base[2]]} rotation={[ROD.tilt, 0, 0]}>
      <mesh material={mat} position={[0, ROD.len / 2, 0]} renderOrder={ORDER} frustumCulled={false}><cylinderGeometry args={[0.0035, 0.007, ROD.len, 6]} /></mesh>
      <object3D ref={tip} position={[0, ROD.len, 0]} />
    </group>
  )
}
