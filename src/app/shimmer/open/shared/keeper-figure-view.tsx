'use client'
// <KeeperFigure look /> : the keeper's body in a scene (BETA M29; the builder is keeper-figure.ts). Rebuilt only when the look
// changes. `drive` (the third-person doll's ref: position, yaw, visible, action) places it; else it stands at the origin.
// `spin` turns it slowly (the creator's preview). The limbs float on their own (poseKeeper).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { buildKeeper, poseKeeper } from './keeper-figure'
import type { Look } from './keeper-look'
import type { DollDrive } from './keeper-doll'

export function KeeperFigure({ look, drive, spin = 0, yaw = 0 }: { look: Look; drive?: React.MutableRefObject<DollDrive>; spin?: number; yaw?: number }) {
  const body = useMemo(() => buildKeeper(look), [look])
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
    } else {
      if (spin) h.rotation.y += dt * spin
      poseKeeper(body, t.current, 0)
    }
  })
  return <group ref={host} rotation-y={yaw}><primitive object={body.group} /></group>
}
