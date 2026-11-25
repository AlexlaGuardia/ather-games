'use client'
// THE FRIENDS BENCH (BETA M154): Bonn, Otto, Tess front / side / back. ?who=bonn one of them at three turns; no who = all three,
// ?turn=90 turned; ?who=momo (M155) = Momo front / side / back, ?who=bonnmomo = him by Bonn's boots; ?action=talk|wave|walk. window.__friendBench.calls() = the frame's draw calls (the ground is one).
import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { FriendModel } from '../../open/shared/friend-model'
import { MomoModel } from '../../open/shared/momo-model'
import { FRIEND_IDS, isFriend } from '../../open/shared/friend-figure'
import type { FolkAction } from '../../open/shared/folk-model'

function Probe() {
  const { gl, scene, camera } = useThree()
  useEffect(() => { camera.lookAt(0, 0.86, 0); (window as unknown as { __friendBench?: unknown }).__friendBench = { calls: () => gl.info.render.calls, scene } }, [gl, scene, camera])
  return null
}
export default function FriendsBench() {
  const [q, setQ] = useState<URLSearchParams | null>(null)
  useEffect(() => setQ(new URLSearchParams(window.location.search)), [])
  if (!q) return null
  const who = q.get('who') ?? '', turn = Number(q.get('turn') ?? 0), action = (q.get('action') ?? 'idle') as FolkAction
  const momo = who === 'momo'
  const set = momo ? [] : isFriend(who) ? [0, 90, 180].map(t => ({ id: who, t })) : FRIEND_IDS.map(id => ({ id, t: turn }))
  return (
    <div style={{ height: '100dvh', background: '#f6efe0' }} data-bench="friends">
      <Canvas camera={{ position: [0, 1.15, 4.6], fov: 30 }}>
        <color attach="background" args={['#cfe3ef']} />
        <hemisphereLight args={['#cfe3ef', '#7d9455', 0.9]} />
        <directionalLight position={[3, 6, 4]} intensity={1.15} /><directionalLight position={[-2, 2, 5]} intensity={0.35} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#7d9455" roughness={1} /></mesh>
        {who === 'bonnmomo' && <FriendModel who="bonn" />}
        {who !== 'bonnmomo' && set.map((s, i) => <group key={i} position={[(i - 1) * 0.95, 0, 0]} rotation-y={s.t * Math.PI / 180}><FriendModel who={s.id} action={action} seed={i} /></group>)}
        {momo && [0, -90, 180].map((t, i) => <group key={t} position={[(i - 1) * 0.6, 0.6, 0]} rotation-y={t * Math.PI / 180} scale={1.5}><MomoModel still /></group>)}
        {who === 'bonnmomo' && <group position={[0.46, 0, 0.14]}><MomoModel still /></group>}
        <Probe />
      </Canvas>
    </div>
  )
}
