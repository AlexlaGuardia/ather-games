'use client'
// <KeeperFigure look /> : the keeper's body in a scene (BETA M29; the builder is keeper-figure.ts). Rebuilt only when the look
// changes. `drive` (the third-person doll's ref: position, yaw, visible, action) places it; else it stands at the origin.
// `spin` turns it slowly (the creator's preview). The limbs float on their own (poseKeeper).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { buildKeeper, poseKeeper } from './keeper-figure'
import { gunProp } from './held-gun-prop'   // M27 slice 4: a peer's held gun on the right hand
import type { Look } from './keeper-look'
import type { Proportions } from './keeper-proportions'
import type { DollDrive } from './keeper-doll'

export function KeeperFigure({ look, drive, spin = 0, yaw = 0, gun = null, shape, walk }: { look: Look; drive?: React.MutableRefObject<DollDrive>; spin?: number; yaw?: number
  /** BETA M103: proportions to build with instead of the shipped ones (the body bench's live sliders) */
  shape?: Proportions
  /** BETA M27 slice 4: a gun id held in the right hand (a remote keeper's), null = hands empty */
  gun?: string | null
  /** BETA M156: a remote keeper's walk amount, read each frame (0 stands, 0.6 walks, 1 runs) */
  walk?: React.RefObject<number> }) {
  const body = useMemo(() => shape ? buildKeeper(look, shape) : buildKeeper(look), [look, shape])
  // the gun rides the BODY, following 'hand-r' each frame (the hand mesh is scaled to a mitten: a child would shrink with it)
  const prop = useRef<THREE.Group | null>(null)
  useEffect(() => {
    if (!gun) return
    const g = gunProp(gun); g.rotation.y = Math.PI   // the figure faces +Z; the prop's barrel is built down -Z
    body.group.add(g); prop.current = g
    return () => { body.group.remove(g); prop.current = null }
  }, [gun, body])
  const host = useRef<THREE.Group>(null)
  const t = useRef(0)
  useEffect(() => () => { body.group.clear() }, [body])   // geometry + materials are shared caches: only the meshes go
  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.1)
    const h = host.current; if (!h) return
    const d = drive?.current
    if (d) {
      h.visible = d.visible; if (!d.visible) return
      h.position.set(d.x, d.y, d.z); h.rotation.set(0, d.yaw, 0)
      poseKeeper(body, t.current, d.action === 'run' ? 1 : d.action === 'walk' ? 0.6 : 0)
      d.handR = body.group.getObjectByName('hand-r')?.getWorldPosition(d.handR ?? new THREE.Vector3())   // M136: the gather tether starts here
    } else {
      if (spin) h.rotation.y += dt * spin
      poseKeeper(body, t.current, walk?.current ?? 0)
    }
    const hand = prop.current && body.group.getObjectByName('hand-r')
    if (prop.current && hand) prop.current.position.set(hand.position.x, hand.position.y + 0.02, hand.position.z + 0.06)
  })
  return <group ref={host} rotation-y={yaw}><primitive object={body.group} /></group>
}
