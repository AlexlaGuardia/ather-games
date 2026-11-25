'use client'
// THE MOGLIN LOOKS BENCH (BETA M162): the named Moglins front / side / back. ?who=hazel one of them at three turns; no who = the line,
// ?turn=90 turned; ?action=waddle|wave|work|shy. window.__moglinBench.calls() = the frame's draw calls (the ground is one).
import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { MoglinLookModel } from '../../open/shared/moglin-look-model'
import { MOGLIN_LOOKS } from '../../open/shared/moglin-figure'
import type { MoglinAction } from '../../open/shared/moglin-model'

function Probe({ far }: { far: number }) {
  const { gl, scene, camera, size } = useThree()
  useEffect(() => { camera.position.set(0, 0.62, Math.max(4.2, 2.95 * size.height / size.width * 3.15) * far); camera.lookAt(0, 0.47, 0); (window as unknown as { __moglinBench?: unknown }).__moglinBench = { calls: () => gl.info.render.calls, scene } }, [gl, scene, camera, size, far])
  return null
}
export default function MoglinLooksBench() {
  const [q, setQ] = useState<URLSearchParams | null>(null)
  useEffect(() => setQ(new URLSearchParams(window.location.search)), [])
  if (!q) return null
  const who = MOGLIN_LOOKS.find(k => k === q.get('who')), turn = Number(q.get('turn') ?? 0), action = (q.get('action') ?? 'idle') as MoglinAction
  const set = who ? [0, 90, 180].map(t => ({ id: who, t })) : MOGLIN_LOOKS.map(id => ({ id, t: turn }))
  return (
    <div style={{ height: '100dvh', background: '#f6efe0' }} data-bench="moglin-looks">
      <Canvas camera={{ position: [0, 0.62, 4.2], fov: 18 }}>
        <color attach="background" args={['#cfe3ef']} />
        <hemisphereLight args={['#cfe3ef', '#7d9455', 0.9]} />
        <directionalLight position={[3, 6, 4]} intensity={1.15} /><directionalLight position={[-2, 2, 5]} intensity={0.35} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#7d9455" roughness={1} /></mesh>
        {set.map((s, i) => <group key={i} position={[(i - (set.length - 1) / 2) * 0.92, 0, 0]} rotation-y={s.t * Math.PI / 180}><MoglinLookModel who={s.id} action={action} seed={i} /></group>)}
        <Probe far={Math.max(1, set.length / 3)} />
      </Canvas>
    </div>
  )
}
