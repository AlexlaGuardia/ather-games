'use client'
// <FriendModel who /> : Bonn, Otto or Tess (friend-figure.ts) on the folk rig's poses. FRIEND_CALLS draw calls a figure.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { poseFolk, folkRamp, folkInk, type FolkAction } from './folk-model'
import { friendFigure, type FriendId, type JointName } from './friend-figure'

let mats: { toon: THREE.MeshToonMaterial; flat: THREE.MeshBasicMaterial } | null = null
const mat = () => (mats ??= { toon: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: folkRamp() }), flat: new THREE.MeshBasicMaterial({ vertexColors: true }) })

export function FriendModel({ who, action = 'idle', seed = 0, speed = 1 }: { who: FriendId; action?: FolkAction; seed?: number; speed?: number }) {
  const f = friendFigure(who), m = mat()
  const j = useRef<Record<JointName | 'eyes', THREE.Object3D | null>>({ body: null, head: null, armL: null, armR: null, legL: null, legR: null, eyes: null })
  const root = useRef<THREE.Group>(null)
  const t = useRef(seed * 1.3)
  // the pose's bob goes to the whole figure, as on FolkModel
  useFrame((_, dt) => poseFolk({ ...j.current, body: root.current }, action, t.current += Math.min(0.05, dt) * speed, seed))
  return (
    <group ref={root} userData={{ friend: who }}>
      {(Object.keys(f.joints) as JointName[]).map(n => {
        const J = f.joints[n], s = n === 'armL' ? -1 : n === 'armR' ? 1 : 0
        return (
          <group key={n} ref={o => { j.current[n] = o }} position={J.at}>
            <group rotation={[0, 0, s * 0.14]}>
              <mesh geometry={J.toon} material={m.toon} /><mesh geometry={J.ink} material={folkInk()} />
              {n === 'head' && <><mesh geometry={f.face} material={m.flat} /><mesh ref={o => { j.current.eyes = o }} geometry={f.eyes} material={m.flat} position={f.eyesAt} /></>}
            </group>
          </group>
        )
      })}
    </group>
  )
}
