'use client'
// THE GREG + BLUE BENCH (BETA M166): Gregory front / side / back in his locked look, and Blue (his old Dewbear).
// ?pose=sit seated; ?action=talk|wave|walk; ?who=blue Blue at three turns (&clip=lie resting); ?who=pair the two at the bench;
// ?old=1 the folk rig he was before (for the draw-call count); ?turn=40 turns the single views. window.__gregBench.calls().
import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { GregModel } from '../../open/shared/greg-model'
import { FolkModel, folkLook, type FolkAction, type FolkPose } from '../../open/shared/folk-model'
import { Blue } from '../../open/ather/glade-blue'
import { BLUE_AT } from '../../open/ather/blue-look'

function Probe({ y }: { y: number }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => { camera.lookAt(0, y, 0); (window as unknown as { __gregBench?: unknown }).__gregBench = { calls: () => gl.info.render.calls, scene } }, [gl, scene, camera, y])
  return null
}
export default function GregBlueBench() {
  const [q, setQ] = useState<URLSearchParams | null>(null)
  useEffect(() => setQ(new URLSearchParams(window.location.search)), [])
  if (!q) return null
  const who = q.get('who') ?? 'greg', action = (q.get('action') ?? 'idle') as FolkAction, pose = (q.get('pose') ?? 'stand') as FolkPose, old = q.get('old') === '1'
  const clip = (q.get('clip') ?? 'idle') as 'idle' | 'lie', one = q.get('turn'), turns = one !== null ? [Number(one)] : [0, 90, 180]
  const blue = who === 'blue', pair = who === 'pair'
  return (
    <div style={{ height: '100dvh', background: '#f6efe0' }} data-bench="greg-blue">
      <Canvas camera={blue ? { position: [0, 0.6, 3.6], fov: 30 } : { position: [0, 1.0, 4.6], fov: 30 }}>
        <color attach="background" args={['#cfe3ef']} />
        <hemisphereLight args={['#cfe3ef', '#7d9455', 0.9]} />
        <directionalLight position={[3, 6, 4]} intensity={1.15} /><directionalLight position={[-2, 2, 5]} intensity={0.35} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#7d9455" roughness={1} /></mesh>
        {!blue && !pair && turns.map((t, i) => <group key={t} position={[(i - (turns.length - 1) / 2) * 1.0, 0, 0]} rotation-y={t * Math.PI / 180}>
          {old ? <FolkModel look={folkLook('gregory')} action={action} pose={pose} seed={i} /> : <GregModel action={action} pose={pose} seed={i} />}</group>)}
        {blue && turns.map((t, i) => <group key={t} position={[(i - (turns.length - 1) / 2) * 1.0, 0, 0]} rotation-y={t * Math.PI / 180}><Blue clip={clip} /></group>)}
        {pair && <group rotation-y={0.5} position={[-0.5, 0, 0]}><GregModel pose="sit" /><group position={[BLUE_AT.x, 0, BLUE_AT.z]} rotation-y={BLUE_AT.yaw}><Blue clip={clip} /></group>
          <mesh position={[0, 0.45, 0.05]}><boxGeometry args={[1.5, 0.06, 0.6]} /><meshLambertMaterial color="#8a6a44" /></mesh></group>}
        <Probe y={blue ? 0.25 : 0.78} />
      </Canvas>
    </div>
  )
}
