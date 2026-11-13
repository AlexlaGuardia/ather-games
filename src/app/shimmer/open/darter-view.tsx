'use client'

// The DARTER's look, shared by every page that drives one (the test track, the continent). PLACEHOLDER geometry:
// a canon design brief for the Darter is Magii's, not yet asked. It borrows only what canon gives every manalic
// vehicle (world/transportation.md): a mana core and rune-lit channel trim. The group's userData.wheelAngle and
// the `steer` ref drive the wheels; the page places the group.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WHEEL_R } from './courser'

function Headlights() {
  const target = useMemo(() => { const o = new THREE.Object3D(); o.position.set(0, 0, -22); return o }, [])
  return (
    <>
      <primitive object={target} />
      <spotLight position={[0, 0.8, -2.2]} target={target} angle={0.55} penumbra={0.5} intensity={60} distance={70} decay={1.2} color="#fff2d0" />
      <pointLight position={[0, 0.3, 0]} color="#3ccfff" intensity={3} distance={5} decay={2} />
    </>
  )
}

// ── the Darter (placeholder geometry): a low coupe, channel trim and a mana core that glow ──
export function DarterModel({ car, steer }: { car: React.MutableRefObject<THREE.Group | null>; steer: React.MutableRefObject<number> }) {
  const wheels = useRef<(THREE.Group | null)[]>([])
  const spinners = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const g = car.current; if (!g) return
    const ang = (g.userData.wheelAngle as number) ?? 0
    spinners.current.forEach(w => { if (w) w.rotation.x = -ang })
    ;[0, 1].forEach(i => { const w = wheels.current[i]; if (w) w.rotation.y = -steer.current })
  })
  const wheelPos: [number, number, number][] = [[-0.86, WHEEL_R, -1.3], [0.86, WHEEL_R, -1.3], [-0.86, WHEEL_R, 1.25], [0.86, WHEEL_R, 1.25]]
  return (
    <group ref={car}>
      <group name="body">
        <mesh position={[0, 0.62, 0]}><boxGeometry args={[1.82, 0.5, 4.3]} /><meshStandardMaterial color="#2c5a86" metalness={0.45} roughness={0.32} /></mesh>
        <mesh position={[0, 0.98, 0.35]}><boxGeometry args={[1.45, 0.42, 1.9]} /><meshStandardMaterial color="#1b2c44" metalness={0.4} roughness={0.25} /></mesh>
        <mesh position={[0, 1.0, -0.62]} rotation-x={0.55}><boxGeometry args={[1.42, 0.05, 0.62]} /><meshStandardMaterial color="#7fd4ff" emissive="#2a6f99" emissiveIntensity={0.5} transparent opacity={0.75} /></mesh>
        {/* channel trim: the rune-lit line canon gives every manalic vehicle */}
        {[-0.92, 0.92].map(x => (
          <mesh key={x} position={[x, 0.6, 0]}><boxGeometry args={[0.04, 0.06, 3.9]} /><meshStandardMaterial color="#d4a843" emissive="#d4a843" emissiveIntensity={1.4} /></mesh>
        ))}
        {/* mana core, behind the cabin */}
        <mesh position={[0, 0.92, 1.75]}><boxGeometry args={[0.7, 0.18, 0.5]} /><meshStandardMaterial color="#6be4ff" emissive="#3ccfff" emissiveIntensity={2} /></mesh>
        {/* lamps */}
        {[-0.62, 0.62].map(x => (
          <mesh key={'h' + x} position={[x, 0.66, -2.16]}><boxGeometry args={[0.38, 0.1, 0.04]} /><meshStandardMaterial color="#fff6dc" emissive="#fff1c4" emissiveIntensity={2} /></mesh>
        ))}
        {[-0.66, 0.66].map(x => (
          <mesh key={'t' + x} position={[x, 0.7, 2.16]}><boxGeometry args={[0.4, 0.08, 0.04]} /><meshStandardMaterial color="#ff4a3a" emissive="#ff2a1a" emissiveIntensity={1.6} /></mesh>
        ))}
        {/* headlights that actually light the road: the track at night is the canon night */}
        <Headlights />
        {/* underglow */}
        <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[1.7, 4]} /><meshBasicMaterial color="#3ccfff" transparent opacity={0.22} /></mesh>
      </group>
      {wheelPos.map((wp, i) => (
        <group key={i} position={wp} ref={el => { wheels.current[i] = el }}>
          <mesh ref={el => { spinners.current[i] = el }} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.3, 12]} />
            <meshLambertMaterial color="#1a1a1e" flatShading />
          </mesh>
          <mesh rotation-z={Math.PI / 2} position={[wp[0] < 0 ? -0.16 : 0.16, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.02, 8]} />
            <meshStandardMaterial color="#d4a843" emissive="#d4a843" emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

