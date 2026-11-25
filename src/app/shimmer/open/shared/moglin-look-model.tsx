'use client'
// <NamedMoglin id />: a Moglin by its id. The named ones (moglin-figure.ts: Hazel, Sax, Yarrow in the Glade, BETA M162) draw in
// their locked looks; every other id is the plain chibi in its id's own coat, as before. Same poses (moglinPose), one rig.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { MoglinModel, furOf, moglinPose, moglinBlink, type MoglinAction } from './moglin-model'
import { figureMats } from './friend-model'
import { folkInk } from './folk-model'
import { moglinFigure, moglinLook, holdPose, type MoglinJoint, type MoglinLook } from './moglin-figure'

export function NamedMoglin({ id, seed = 0 }: { id: string; seed?: number }) {
  const look = moglinLook(id)
  return look ? <MoglinLookModel who={look} seed={seed} /> : <MoglinModel build="chibi" action="idle" tone={furOf(id)} seed={seed} />
}

export function MoglinLookModel({ who, action = 'idle', seed = 0, speed = 1 }: { who: MoglinLook; action?: MoglinAction; seed?: number; speed?: number }) {
  const f = moglinFigure(who), m = figureMats()
  const j = useRef<Partial<Record<MoglinJoint | 'eyes', THREE.Object3D | null>>>({})
  const t0 = useRef(seed * 1.7)
  useFrame((_, dt) => {
    const t = (t0.current += Math.min(0.05, dt) * speed), p = holdPose(moglinPose(action, t), f.holds, action), o = j.current
    if (o.body) { o.body.rotation.z = p.roll; o.body.position.y = p.bob }
    if (o.head) { o.head.rotation.x = p.headPitch; o.head.rotation.z = p.headRoll }
    if (o.earL) o.earL.rotation.z = 0.78 + p.earDroop * 0.6
    if (o.earR) o.earR.rotation.z = -0.78 - p.earDroop * 0.6
    if (o.armL) o.armL.rotation.set(p.aL[0], 0, -p.aL[1])
    if (o.armR) o.armR.rotation.set(p.aR[0], 0, -p.aR[1])
    if (o.legL) o.legL.rotation.x = p.lL * f.stride
    if (o.legR) o.legR.rotation.x = p.lR * f.stride
    if (o.eyes) o.eyes.scale.y = moglinBlink(t, seed)
  })
  const part = (n: MoglinJoint, kids?: React.ReactNode) => {
    const J = f.joints[n]
    return <group key={n} ref={o => { j.current[n] = o }} position={J.at}><mesh geometry={J.toon} material={m.toon} castShadow /><mesh geometry={J.ink} material={folkInk()} />{kids}</group>
  }
  return (
    <group userData={{ moglinLook: who }}>
      {part('body', <>
        {part('legL')}{part('legR')}{part('armL')}{part('armR')}
        {part('head', <>
          {part('earL')}{part('earR')}
          <mesh geometry={f.face} material={m.flat} /><mesh ref={o => { j.current.eyes = o }} geometry={f.eyes} material={m.flat} position={f.eyesAt} />
        </>)}
      </>)}
    </group>
  )
}
