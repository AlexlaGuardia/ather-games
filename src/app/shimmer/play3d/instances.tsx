'use client'
// Instanced unit boxes (or flat planes), each placed, scaled and coloured — the one helper the town's and the
// Station's scenes both draw with. Its own file so neither scene imports the other.
import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { runeHold as RH } from './scene-palette'

export interface Inst { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw?: number; tilt?: number; c: string }

/** One instanced mesh of unit boxes (or planes laid flat). `emissive` lights every instance; `glow` is its
 *  colour (the town's window glass unless told otherwise). */
export function Instances({ items, flat, emissive, glow = RH.window, cast = true }: { items: Inst[]; flat?: boolean; emissive?: number; glow?: string; cast?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const r = ref.current
    if (!r) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color()
    const v = new THREE.Vector3(), s = new THREE.Vector3()
    items.forEach((b, i) => {
      e.set(flat ? -Math.PI / 2 : (b.tilt ?? 0), flat ? 0 : (b.yaw ?? 0), flat ? (b.yaw ?? 0) : (b.tilt ?? 0) * 0.7, flat ? 'YXZ' : 'XYZ')
      q.setFromEuler(e)
      m.compose(v.set(b.x, b.y, b.z), q, s.set(b.sx, b.sy, b.sz))
      r.setMatrixAt(i, m); r.setColorAt(i, col.set(b.c))
    })
    r.instanceMatrix.needsUpdate = true
    if (r.instanceColor) r.instanceColor.needsUpdate = true
    r.computeBoundingSphere()
  }, [items, flat])
  if (!items.length) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={cast && !flat} receiveShadow>
      {flat ? <planeGeometry args={[1, 1]} /> : <boxGeometry args={[1, 1, 1]} />}
      {emissive
        ? <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={emissive} roughness={0.6} />
        : <meshStandardMaterial roughness={0.95} />}
    </instancedMesh>
  )
}

