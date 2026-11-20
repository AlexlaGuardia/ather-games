'use client'
// M45 (Alex 11-20: "i should be able to see the item in the right hand"): THE HELD ITEM, sat in the right mitten.
// Mounted by the page as OpenHands' `held` child, so it rides the right hand's group (open-hands.tsx portals it there):
// it bobs, runs and jumps with the hand, and hides with it (a drawn gun, the planner, third person).
//   furniture -> a mini of the piece itself (workshop PieceBody), scaled to a hand's size
//   Keepstone -> a mini pedestal with its crystal
//   dish -> a bowl · potion -> a bottle · waymark -> a little post · anything else -> a tinted parcel
// Placeholder craft until Alex draws held looks. Drawn over the world like the hands (ORDER, transparent list).
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { PieceBody } from './workshop'
import { FURNITURE, KEEPSTONES } from './furniture'
import { isDish } from './cooking'
import { isPotion } from './alchemy'
import { ORDER } from '../shared/open-hands'

/** Hand-local size the held thing fits in (the mitten is ~0.11 tall before the hand's own scale). */
const FIT = 0.075
const tintOf = (id: string) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 45% 55%)` }

function Body({ id }: { id: string }) {
  const f = FURNITURE[id]
  if (f) {
    const k = FIT / Math.max(f.w, f.d, f.h)
    return <group scale={k} position={[0, -0.02, -0.02]} rotation={[0.25, 0.6, 0]}><PieceBody item={id} /></group>
  }
  if (id in KEEPSTONES) return (
    <group position={[0, -0.03, -0.02]} scale={0.1}>
      <mesh position-y={0.25}><cylinderGeometry args={[0.3, 0.34, 0.5, 8]} /><meshLambertMaterial color="#b9b2a6" /></mesh>
      <mesh position-y={0.62}><octahedronGeometry args={[0.2, 0]} /><meshBasicMaterial color="#8fc6e8" /></mesh>
    </group>
  )
  if (isDish(id)) return <mesh position={[0, 0, -0.02]}><cylinderGeometry args={[0.055, 0.035, 0.03, 12]} /><meshLambertMaterial color="#c98a4a" /></mesh>
  if (isPotion(id)) return (
    <group position={[0, 0.0, -0.02]}>
      <mesh><sphereGeometry args={[0.035, 10, 8]} /><meshLambertMaterial color={tintOf(id)} /></mesh>
      <mesh position-y={0.045}><cylinderGeometry args={[0.012, 0.012, 0.04, 6]} /><meshLambertMaterial color="#d9d2c0" /></mesh>
    </group>
  )
  if (id === 'waymark') return <mesh position={[0, 0.03, -0.02]} rotation-x={0.3}><boxGeometry args={[0.018, 0.14, 0.018]} /><meshLambertMaterial color="#b0884f" /></mesh>
  return <mesh position={[0, 0, -0.02]} rotation={[0.3, 0.5, 0]}><boxGeometry args={[0.06, 0.06, 0.06]} /><meshLambertMaterial color={tintOf(id)} /></mesh>
}

/** The held thing in the right mitten (null = nothing in hand). Every mesh joins the hands' over-the-world pass. */
export function HeldItem({ id }: { id: string | null }) {
  const g = useRef<THREE.Group>(null)
  const seen = useMemo(() => new WeakSet<THREE.Object3D>(), [])
  useFrame(() => {
    g.current?.traverse(o => {
      if (seen.has(o) || !(o instanceof THREE.Mesh)) return
      seen.add(o); o.renderOrder = ORDER; o.frustumCulled = false
      const m = o.material as THREE.Material; m.transparent = true; m.needsUpdate = true
    })
  })
  if (!id) return null
  // in the mitten's palm, a touch forward of it and up (hand-local, before the hand's own scale)
  return <group ref={g} position={[0, 0.05, -0.03]} userData={{ held: id }}><Body key={id} id={id} /></group>
}
