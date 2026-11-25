'use client'
// THE WALKER BENCH (BETA M163 s1): the Walker Hollow on grass, front / side / back, in the surface the Wilds draw it with.
// ?act=rest|tell|fall|walk|knock; ?turns=0,90,180 (which views); ?ground=9cc46a (what it borrows). window.__walkerBench.calls().
import { useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { makeWalker, poseWalker, spillGeometry } from '../../open/ather/walker-body'
import { sharedGoop } from '../../open/ather/hollow-goop'

const POSE = { rest: {}, tell: { tell: 1 }, fall: { fall: 1 }, walk: { walk: 1 }, knock: { knock: 1 } } as const
function One({ act, ground, turn, x }: { act: keyof typeof POSE; ground: string; turn: number; x: number }) {
  const W = useMemo(() => makeWalker(sharedGoop(ground, true, 'skin')), [ground])
  useEffect(() => () => W.dispose(), [W])
  useFrame(() => poseWalker(W.bones, { t: act === 'walk' ? 0.28 : 0.4, tell: 0, fall: 0, walk: 0, knock: 0, ...POSE[act] }))
  return <group position-x={x} rotation-y={turn * Math.PI / 180}><primitive object={W.mesh} dispose={null} />
    <mesh position-y={0.02} rotation-x={-Math.PI / 2} geometry={spillGeometry()} dispose={null}><meshBasicMaterial color="#17181b" transparent opacity={0.85} /></mesh></group>
}
function Probe() {
  const { gl, camera } = useThree()
  useEffect(() => { camera.lookAt(0, 0.9, 0); (window as unknown as { __walkerBench?: unknown }).__walkerBench = { calls: () => gl.info.render.calls } }, [gl, camera])
  return null
}
export default function WalkerBench() {
  const [q, setQ] = useState<URLSearchParams | null>(null)
  useEffect(() => setQ(new URLSearchParams(window.location.search)), [])
  if (!q) return null
  const act = (q.get('act') ?? 'rest') as keyof typeof POSE, ground = '#' + (q.get('ground') ?? '9cc46a'), turns = (q.get('turns') ?? '0,-90,180').split(',').map(Number)
  return (
    <div style={{ height: '100dvh' }} data-bench="walker">
      <Canvas camera={{ position: [0, 1.25, turns.length > 1 ? 6.4 : 4], fov: 30 }}>
        <color attach="background" args={['#cfe3ef']} /><hemisphereLight args={['#cfe3ef', '#7d9455', 0.9]} /><directionalLight position={[3, 6, 4]} intensity={1.15} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[40, 40]} /><meshStandardMaterial color={ground} roughness={1} /></mesh>
        {turns.map((t, i) => <One key={i} act={act in POSE ? act : 'rest'} ground={ground} turn={t} x={(i - (turns.length - 1) / 2) * 1.35} />)}
        <Probe />
      </Canvas>
    </div>
  )
}
