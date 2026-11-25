'use client'
// THE GLADE'S GROWN GATE, DRAWN (BETA M165 s1; glade-gate-figure.ts). Mounted by glade-cluster-view.tsx in the 'glade' zone only, where
// the plot islands' gold ring is off (four stood in each other: the keeper's island and the three friends'). GATE_CALLS draw calls.
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { figureMats } from '../shared/friend-model'
import { folkInk } from '../shared/folk-model'
import { GATE_FACE, GROUND_Y } from './plot'
import { GLADE_GATE } from './glade-cluster'
import { GATE_BASE, LIGHT, gladeGateFigure } from './glade-gate-figure'

let mat: THREE.MeshBasicMaterial | null = null
const lightMat = () => (mat ??= new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }))

export function GladeGate() {
  const f = gladeGateFigure(), spin = useRef<THREE.Mesh>(null), scene = useThree(s => s.scene)
  useFrame(({ clock }) => { const s = spin.current; if (s) s.rotation.z = -clock.elapsedTime * 0.35 })
  // READ only (m165-glade-look): how many of each gate this frame holds
  useEffect(() => {
    const w = window as unknown as { __gladeGate?: unknown }
    w.__gladeGate = { drawn: () => { let grown = 0, ring = 0; scene.traverse(o => { if (o.userData?.gladeGate) grown++; if (o.userData?.foldGate) ring++ }); return { grown, ring } } }
    return () => { delete w.__gladeGate }
  }, [scene])
  return (
    <group position={[GLADE_GATE.x, GROUND_Y - GATE_BASE, GLADE_GATE.z]} rotation-y={GATE_FACE} userData={{ gladeGate: true }}>
      <mesh geometry={f.toon} material={figureMats().toon} /><mesh geometry={f.ink} material={folkInk()} />
      <mesh ref={spin} position-y={LIGHT.y} geometry={f.light} material={lightMat()} renderOrder={2} />
      <pointLight position-y={LIGHT.y} color="#f2d88a" intensity={14} distance={18} />
    </group>
  )
}
