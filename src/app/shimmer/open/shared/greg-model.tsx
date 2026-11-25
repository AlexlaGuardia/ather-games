'use client'
// <GregModel /> : Gregory in his locked look (greg-figure.ts), on the folk rig's poses (poseFolk, unchanged). GREG_CALLS
// draw calls, standing or seated. Everywhere Greg is drawn uses this: the Glade (glade-greg.tsx) and the plot's table stop.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { poseFolk, folkInk, type FolkAction, type FolkPose } from './folk-model'
import { figureMats } from './friend-model'
import { gregFigure } from './greg-figure'
import type { JointName } from './friend-figure'

/** how far his arms hang out from the shoulder (rad): clear of the belly */
export const GREG_SPLAY = 0.2

export function GregModel({ action = 'idle', seed = 0, speed = 1, pose = 'stand' }: { action?: FolkAction; seed?: number; speed?: number; pose?: FolkPose }) {
  const f = gregFigure(), m = figureMats(), sit = pose === 'sit'
  const j = useRef<Record<JointName | 'eyes', THREE.Object3D | null>>({ body: null, head: null, armL: null, armR: null, legL: null, legR: null, eyes: null })
  const root = useRef<THREE.Group>(null)
  const t = useRef(seed * 1.3)
  // the pose's bob goes to the whole figure, as on FolkModel; seated legs are not the rig's (no ref), as on FolkModel
  useFrame((_, dt) => poseFolk({ ...j.current, body: root.current, ...(sit ? { legL: null, legR: null } : {}) }, action, t.current += Math.min(0.05, dt) * speed, seed))
  return (
    <group ref={root} userData={{ greg: pose }}>
      {(Object.keys(f.joints) as JointName[]).map(n => {
        const leg = n === 'legL' || n === 'legR', J = sit && leg ? f.sit[n] : f.joints[n], s = n === 'armL' ? -1 : n === 'armR' ? 1 : 0
        return (
          <group key={sit && leg ? `${n}:sit` : n} ref={o => { j.current[n] = o }} position={J.at}>
            <group rotation={[0, 0, s * GREG_SPLAY]}>
              <mesh geometry={J.toon} material={m.toon} /><mesh geometry={J.ink} material={folkInk()} />
              {n === 'head' && <><mesh geometry={f.face} material={m.flat} /><mesh ref={o => { j.current.eyes = o }} geometry={f.eyes} material={m.flat} position={f.eyesAt} /></>}
            </group>
          </group>
        )
      })}
    </group>
  )
}
