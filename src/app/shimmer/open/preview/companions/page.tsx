'use client'
// Dev preview: the open world's Mana'mal companions (shared/companion-follower.tsx), each trailing a keeper marker.
// /shimmer/open/preview/companions  (?still=1 = the keepers stand, so Gemdigger sits up; ?hour=22 for night; ?id=gemdigger)
import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type * as THREE from 'three'
import { Follower, type FollowPose } from '../../shared/companion-follower'
import { COMPANIONS, type CompanionId } from '../../shared/companion'

export default function Page() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return ready ? <Preview /> : null
}
const ground = () => 0
function Keeper({ id, x, still }: { id: CompanionId; x: number; still: boolean }) {
  const pose = useRef<FollowPose>({ x, z: 0, yaw: 0 })
  const mark = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.45
    pose.current = still ? { x, z: 0, yaw: Math.PI + 0.6 } : { x: x + Math.sin(t) * 2.2, z: Math.cos(t) * 2.2, yaw: -t - Math.PI / 2 }
    mark.current?.position.set(pose.current.x, 0.9, pose.current.z)
  })
  return (
    <>
      <mesh ref={mark}><capsuleGeometry args={[0.25, 1.2, 4, 10]} /><meshStandardMaterial color="#7a8aa0" transparent opacity={0.35} /></mesh>
      <Follower id={id} pose={pose} ground={ground} />
    </>
  )
}
function Preview() {
  const q = new URLSearchParams(window.location.search)
  const night = Number(q.get('hour') ?? 12) >= 20, still = q.get('still') === '1', one = q.get('id') as CompanionId | null
  const ids: CompanionId[] = one ? [one] : ['glowmite', 'gemdigger', ...COMPANIONS.map(c => c.id).filter(i => i !== 'glowmite' && i !== 'gemdigger').slice(0, 1)]
  const step = 6.5, x0 = -((ids.length - 1) * step) / 2
  const cam: [number, number, number] = one ? [1.8, 1.4, 2.6] : [0, 6, 12]
  return (
    <div style={{ position: 'fixed', inset: 0, background: night ? '#141a26' : '#a9c6dc' }}>
      <Canvas camera={{ position: cam, fov: 50 }}>
        <color attach="background" args={[night ? '#141a26' : '#a9c6dc']} />
        <hemisphereLight args={[night ? '#3a4560' : '#dfe9f5', '#6a5e4c', night ? 0.25 : 0.9]} />
        <directionalLight position={[20, 30, 15]} intensity={night ? 0.15 : 1.4} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[60, 30]} /><meshStandardMaterial color={night ? '#2c3a2a' : '#7d9a5c'} /></mesh>
        {ids.map((id, i) => <Keeper key={id} id={id} x={x0 + i * step} still={still} />)}
        <OrbitControls target={one ? [0.9, 0.5, 0] : [0, 0.8, 0]} />
      </Canvas>
      <div style={{ position: 'absolute', left: 12, top: 10, color: night ? '#dde' : '#223', font: '13px system-ui' }}>{ids.join(' · ')} {still ? '(standing)' : '(walking)'}</div>
    </div>
  )
}
