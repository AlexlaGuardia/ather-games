'use client'
// THE TUTORIAL '!' in the world (BETA M212): a floating 3D '!' over the current First Steps target in this zone (the rule:
// shared/quest-bang.ts). Drawn by QuestGuide, so every page that has the glare + trail has this too and no page wires it.
// Look = Jin's guess for Alex's call: ember, a dark rim so it reads against sky and grass, a slow turn + bob, bigger far off.
// Reduced motion: still, no turn.
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getJournal, type Zone } from './shared/journal'
import { BANG_Y, bangScale, bangSpot } from './shared/quest-bang'

export function QuestBang({ zone, ground }: { zone: Zone; ground: (x: number, z: number) => number }) {
  const g = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const still = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])
  const mats = useMemo(() => ({
    face: new THREE.MeshBasicMaterial({ color: '#ffa44a', toneMapped: false }),
    rim: new THREE.MeshBasicMaterial({ color: '#3a2214', side: THREE.BackSide, toneMapped: false }),
  }), [])
  const geo = useMemo(() => ({
    bar: new THREE.CylinderGeometry(0.17, 0.1, 0.66, 14).translate(0, 0.52, 0),
    barRim: new THREE.CylinderGeometry(0.21, 0.14, 0.74, 14).translate(0, 0.52, 0),
    dot: new THREE.SphereGeometry(0.13, 16, 12),
    dotRim: new THREE.SphereGeometry(0.17, 16, 12),
  }), [])
  useFrame(({ clock }) => {
    const o = g.current; if (!o) return
    const at = bangSpot(getJournal().entries, zone)
    const w = window as unknown as { __questBang?: unknown }
    if (!at) { o.visible = false; w.__questBang = { on: false, zone }; return }
    const t = clock.elapsedTime, dist = Math.hypot(at.x - camera.position.x, at.z - camera.position.z), s = bangScale(dist)
    const y = ground(at.x, at.z) + BANG_Y + (still ? 0 : Math.sin(t * 2.2) * 0.12)
    o.visible = true; o.position.set(at.x, y, at.z); o.scale.setScalar(s); o.rotation.y = still ? Math.atan2(camera.position.x - at.x, camera.position.z - at.z) : t * 1.4
    w.__questBang = { on: true, zone, x: at.x, y, z: at.z, scale: s }
  })
  return (
    <group ref={g} visible={false} renderOrder={9}>
      <mesh geometry={geo.bar} material={mats.face} />
      <mesh geometry={geo.barRim} material={mats.rim} />
      <mesh geometry={geo.dot} material={mats.face} />
      <mesh geometry={geo.dotRim} material={mats.rim} />
    </group>
  )
}
