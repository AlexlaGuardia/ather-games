'use client'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { pinPrograms } from './program-keeper'
/** Always mounted inside the Canvas (outside any zone): pins each shader program the frame after it first exists. */
export function ProgramKeeper() {
  useFrame(({ gl, scene }) => {
    pinPrograms(gl.info.programs as unknown as { usedTimes: number }[] | undefined)
    const w = window as unknown as { __programs?: () => { name: string; key: string }[] }
    const o = window as unknown as { __programOwners?: () => unknown[] }
    if (!o.__programOwners) o.__programOwners = () => {   // read-only probe (M44 warm-up diag): which object + material holds each live program
      const out: unknown[] = []
      scene.traverse(ob => { const m = (ob as THREE.Mesh).material; if (!m) return; for (const mat of Array.isArray(m) ? m : [m]) {
        const pr = (gl.properties.get(mat) as { currentProgram?: { cacheKey: string } }).currentProgram; if (!pr) continue
        let path = ''; for (let q: THREE.Object3D | null = ob; q && path.length < 120; q = q.parent) path = `${q.name || q.type}/${path}`
        out.push({ key: pr.cacheKey, obj: ob.type, mat: mat.type, inst: (ob as THREE.InstancedMesh).isInstancedMesh ?? false, geo: (ob as THREE.Mesh).geometry?.type, n: (ob as THREE.InstancedMesh).count, col: (mat as THREE.MeshLambertMaterial).color?.getHexString?.(), flat: (mat as THREE.MeshLambertMaterial).flatShading, mapImg: (() => { const im = (mat as THREE.MeshLambertMaterial).map?.image as { width?: number; height?: number } | undefined; return im ? `${im.width}x${im.height}` : null })(), map: !!(mat as THREE.MeshStandardMaterial).map, env: !!(mat as THREE.MeshStandardMaterial).envMap, path })
      } })
      return out
    }
    const mm = window as unknown as { __glMemory?: () => unknown }
    if (!mm.__glMemory) mm.__glMemory = () => ({ ...gl.info.memory, programs: (gl.info.programs ?? []).length })   // read-only probe (M9 leak check): live geometries/textures in the renderer
    if (!w.__programs) w.__programs = () => ((gl.info.programs ?? []) as unknown as { name: string; cacheKey: string }[]).map(q => ({ name: q.name, key: q.cacheKey }))   // read-only probe (M44 warm-up diag)
  })
  return null
}
