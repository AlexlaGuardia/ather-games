'use client'
// Dev preview of one building, alone on a patch of Ashfeld ground, before the play lane mounts it on the continent.
// /shimmer/open/preview/fallen-cap  (?hour=21 for night, ?az=deg to turn round it, ?far=1 for the street view)
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { FallenCap } from '../../towns/fallen-cap'

export default function Page() {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const az = (Number(q.get('az') ?? 25) * Math.PI) / 180, far = q.get('far') ? 34 : 22
  const eye = !!q.get('eye'), dist = eye ? 15 : far
  const cam: [number, number, number] = [Math.sin(az) * dist, eye ? 1.7 : far * 0.42, Math.cos(az) * dist]
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#9fc3dc' }}>
      <Canvas camera={{ position: cam, fov: 50 }}>
        <color attach="background" args={['#a9c6dc']} />
        <hemisphereLight args={['#dfe9f5', '#8a7a5c', 0.9]} />
        <directionalLight position={[30, 40, 20]} intensity={1.6} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><circleGeometry args={[60, 48]} /><meshLambertMaterial color="#b9a173" /></mesh>
        <FallenCap x={0} z={0} y={0} yaw={Math.PI / 2} w={14} d={12} />
        <OrbitControls target={[0, eye ? 5.5 : 4.5, 0]} />
      </Canvas>
    </div>
  )
}
