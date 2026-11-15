'use client'

// THE JOURNAL, in the world: a light pillar over every entry whose WAYMARK is on, and a trail of glowing marks along the
// ground toward every entry whose TRAIL is on (Alex 11-15: "toggle way point markers and quest trails"). The active
// entry burns ember; the rest are a quieter gold. The compass half is `questMarks()` (shared/journal.ts), which the page
// merges into the template's marks. World-space, so it lives outside the HUD template.
//
// The trail is drawn from where you stand toward the mark, the first TRAIL_REACH metres of it, flowing forward so the
// direction reads at a glance. It hugs `ground`; where the ground under it is far from your feet (indoors: the Passage,
// the bore), it runs at your own height instead, so it never climbs the mountain over your head.

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { guides, type Zone } from './shared/journal'

const TRAIL_REACH = 48, TRAIL_STEP = 1.6, MAX_DOTS = 3 * Math.ceil(TRAIL_REACH / TRAIL_STEP), MAX_BEACONS = 8
const EMBER = new THREE.Color('#ff9a4a'), GOLD = new THREE.Color('#e8cf8a')

export function QuestGuide({ zone, ground, feetY }: { zone: Zone; ground: (x: number, z: number) => number; feetY?: () => number | null }) {
  const { camera } = useThree()
  const dots = useRef<THREE.InstancedMesh>(null), beams = useRef<THREE.InstancedMesh>(null), rings = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), flat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2) }), [])
  const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false } as const
  const mats = useMemo(() => ({
    dot: new THREE.MeshBasicMaterial({ ...add, opacity: 0.85 }),
    beam: new THREE.MeshBasicMaterial({ ...add, opacity: 0.32, side: THREE.DoubleSide }),
    ring: new THREE.MeshBasicMaterial({ ...add, opacity: 0.6, side: THREE.DoubleSide }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])
  // a beam: an open cylinder, base at the origin, 1 m tall (scaled up)
  const beamGeo = useMemo(() => new THREE.CylinderGeometry(0.55, 0.9, 1, 12, 1, true).translate(0, 0.5, 0), [])
  useFrame(({ clock }) => {
    const { m, q, p, s, c, flat } = tmp
    const g = guides(zone), t = clock.elapsedTime
    const fx = camera.position.x, fz = camera.position.z
    const feet = feetY?.() ?? camera.position.y - 1.62
    let nd = 0
    for (const tr of g.trails) {
      const dx = tr.x - fx, dz = tr.z - fz, dist = Math.hypot(dx, dz)
      if (dist < 2) continue
      const ux = dx / dist, uz = dz / dist, reach = Math.min(TRAIL_REACH, dist - 1)
      c.copy(tr.active ? EMBER : GOLD)
      // the marks flow toward the target: their phase slides forward with time
      const phase = (t * 2.2) % TRAIL_STEP
      for (let d = 1.4 + phase; d < reach && nd < MAX_DOTS; d += TRAIL_STEP) {
        const x = fx + ux * d, z = fz + uz * d
        const gy = ground(x, z), y = Math.abs(gy - feet) > 4 ? feet : gy
        const fade = Math.min(1, (reach - d) / 6) * Math.min(1, (d - 1.2) / 2)
        p.set(x, y + 0.07, z); m.compose(p, flat, s.set(0.22 * fade + 0.02, 0.22 * fade + 0.02, 1)); dots.current?.setMatrixAt(nd, m)
        dots.current?.setColorAt(nd, c); nd++
      }
    }
    if (dots.current) { dots.current.count = nd; dots.current.instanceMatrix.needsUpdate = true; if (dots.current.instanceColor) dots.current.instanceColor.needsUpdate = true }
    let nb = 0
    for (const mk of g.markers.slice(0, MAX_BEACONS)) {
      const y = ground(mk.x, mk.z)
      c.copy(mk.active ? EMBER : GOLD)
      // arriving: the pillar thins and the ring shrinks away inside ~14 m, so standing at the mark is not standing in a light
      const near = Math.max(0, Math.min(1, (Math.hypot(mk.x - fx, mk.z - fz) - 4) / 10))
      const pulse = (1 + Math.sin(t * 2.4 + nb) * 0.06) * Math.max(0.001, near)
      p.set(mk.x, y, mk.z); m.compose(p, q.identity(), s.set(pulse, mk.active ? 46 : 30, pulse)); beams.current?.setMatrixAt(nb, m); beams.current?.setColorAt(nb, c)
      const r = (1.2 + ((t * 0.8 + nb * 0.3) % 1) * 2.2) * Math.max(0.001, near)
      p.set(mk.x, y + 0.1, mk.z); m.compose(p, flat, s.set(r, r, 1)); rings.current?.setMatrixAt(nb, m); rings.current?.setColorAt(nb, c)
      nb++
    }
    for (const mesh of [beams.current, rings.current]) if (mesh) { mesh.count = nb; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true }
  })
  return (
    <>
      <instancedMesh ref={dots} args={[undefined, mats.dot, MAX_DOTS]} frustumCulled={false} renderOrder={8}><circleGeometry args={[1, 10]} /></instancedMesh>
      <instancedMesh ref={beams} args={[beamGeo, mats.beam, MAX_BEACONS]} frustumCulled={false} renderOrder={8} />
      <instancedMesh ref={rings} args={[undefined, mats.ring, MAX_BEACONS]} frustumCulled={false} renderOrder={8}><ringGeometry args={[0.86, 1, 28]} /></instancedMesh>
    </>
  )
}
