'use client'
// The two ends of a standing Gate, drawn as plain turning rings (the canon look of the spiral is not locked): near and far,
// fading as the spiral ages toward its ceiling. Reads the hook's `gate` ref (shared/use-casts.ts); draws nothing when none stands.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { spiralAge, type GateSpiral } from '../../engine/gate-spiral'

export function GateRings({ gate }: { gate: React.MutableRefObject<GateSpiral | null> }) {
  const refs = useRef<(THREE.Mesh | null)[]>([null, null])
  useFrame(() => {
    const g = gate.current, now = performance.now()
    for (let i = 0; i < 2; i++) {
      const m = refs.current[i]; if (!m) continue
      m.visible = !!g
      if (!g) continue
      const e = i === 0 ? g.near : g.far
      m.position.set(e.x, e.y + 0.06, e.z); m.rotation.set(-Math.PI / 2, 0, now / 400 * (i ? -1 : 1))
      m.scale.setScalar(g.radius * (1 + 0.06 * Math.sin(now / 180 + i)))
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - spiralAge(g, now) * 0.6)
    }
  })
  return <>{[0, 1].map(i => (
    <mesh key={i} ref={el => { refs.current[i] = el }} visible={false}>
      <ringGeometry args={[0.7, 1, 28, 1, 0, Math.PI * 1.6]} /><meshBasicMaterial color="#aa8cff" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  ))}</>
}
