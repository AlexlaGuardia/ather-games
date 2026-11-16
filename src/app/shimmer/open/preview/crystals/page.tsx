'use client'
// Dev preview: the eight crystal node kinds (ather/crystal-nodes.tsx) side by side on crag, plus one worked node (chips).
// /shimmer/open/preview/crystals  (?hour=22 for night, ?close=<kind> to look at one)
import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Crystals } from '../../ather/crystal-nodes'
import { CRYSTAL_KINDS, CRYSTAL_NAME, type CrystalKind } from '../../ather/prospecting'
import type { Wilds, Crystal } from '../../ather/wilds'

export default function Page() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (!ready) return null
  return <Preview />
}
function Preview() {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const night = Number(q.get('hour') ?? 12) >= 20, close = q.get('close') as CrystalKind | null
  const kinds = close ? [close] : CRYSTAL_KINDS
  const step = 3.2, x0 = -((kinds.length - 1) * step) / 2
  const crystals: Crystal[] = kinds.map((k, i) => ({ x: x0 + i * step, z: 0, y: 0, kind: k, s: 1.05, rot: i * 0.9, id: `prev:${k}` }))
  const W = { crystals } as unknown as Wilds
  const cam: [number, number, number] = close ? [0, 1.6, 3.4] : [0, 5, 17]
  return (
    <div style={{ position: 'fixed', inset: 0, background: night ? '#141a26' : '#a9c6dc' }}>
      <Canvas camera={{ position: cam, fov: 50 }}>
        <color attach="background" args={[night ? '#141a26' : '#a9c6dc']} />
        <hemisphereLight args={[night ? '#3a4560' : '#dfe9f5', '#6a5e4c', night ? 0.3 : 0.9]} />
        <directionalLight position={[20, 30, 15]} intensity={night ? 0.2 : 1.5} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><planeGeometry args={[80, 40]} /><meshLambertMaterial color="#8c847a" /></mesh>
        <Crystals W={W} />
        <OrbitControls target={close ? [0, 0.6, 0] : [0, 0.8, 0]} />
      </Canvas>
      {!close && <div style={{ position: 'fixed', bottom: 18, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 0, font: '600 12px system-ui', color: night ? '#e8e4dc' : '#2a2620', pointerEvents: 'none' }}>
        {kinds.map(k => <div key={k} style={{ width: `${100 / kinds.length}%`, textAlign: 'center' }}>{CRYSTAL_NAME[k]}</div>)}
      </div>}
    </div>
  )
}
