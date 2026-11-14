'use client'

// The Wilds' scene: the biome-tinted tile, water, instanced trees and the waymark stones. Split out of page.tsx.

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BIOME, type Wilds, type BiomeId } from './wilds'
import { GREG_WAYMARK, type Waymark } from './waymarks'
import { P } from './palette'

function wildsGeometry(W: Wilds): THREE.BufferGeometry {
  const { nx, nz, cell, sizeX, sizeZ } = W.meta
  const hx = sizeX / 2, hz = sizeZ / 2
  const pos = new Float32Array((nx - 1) * (nz - 1) * 18), col = new Float32Array((nx - 1) * (nz - 1) * 18)
  const c = new THREE.Color()
  let o = 0
  const vh = (i: number, j: number) => W.h[j * nx + i]
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const b = W.biomes[j * (nx - 1) + i] as BiomeId
    const x0 = i * cell - hx, z0 = j * cell - hz, x1 = x0 + cell, z1 = z0 + cell
    const y00 = vh(i, j), y10 = vh(i + 1, j), y01 = vh(i, j + 1), y11 = vh(i + 1, j + 1)
    const tris = [[x0, y00, z0, x1, y11, z1, x1, y10, z0], [x0, y00, z0, x0, y01, z1, x1, y11, z1]]
    for (let t = 0; t < 2; t++) {
      const n = ((i * 7 + j * 13 + t * 5) % 11) / 11
      if (b === BIOME.water) c.copy(P.bed)
      else if (b === BIOME.shore) c.copy(P.shore)
      else if (b === BIOME.rock) c.copy(P.rock)
      else if (b === BIOME.woods) c.copy(P.woods).lerp(P.woodsHi, n * 0.5)
      else c.copy(P.grass).lerp(P.grassHi, n * 0.45).lerp(P.gold, ((i * 3 + j) % 17) / 17 * 0.15)
      const tri = tris[t]
      for (let k = 0; k < 9; k++) pos[o + k] = tri[k]
      for (let k = 0; k < 3; k++) { col[o + k * 3] = c.r; col[o + k * 3 + 1] = c.g; col[o + k * 3 + 2] = c.b }
      o += 9
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function Trees({ W }: { W: Wilds }) {
  const trunk = useRef<THREE.InstancedMesh>(null), crown = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color()
    W.trees.forEach((t, k) => {
      p.set(t.x, t.y + 1.4, t.z); s.set(1, 2.8, 1); trunk.current!.setMatrixAt(k, m.compose(p, q, s))
      p.set(t.x, t.y + 2.4 + t.tall / 2, t.z); s.set(t.r, t.tall, t.r); crown.current!.setMatrixAt(k, m.compose(p, q, s))
      const inWoods = W.biomeAt(t.x, t.z) === BIOME.woods
      c.set(inWoods ? '#4e8a52' : '#79ad5a').offsetHSL(((k * 0.07) % 0.05) - 0.025, 0, ((k * 0.11) % 0.1) - 0.05)
      crown.current!.setColorAt(k, c)
    })
    trunk.current!.instanceMatrix.needsUpdate = true; crown.current!.instanceMatrix.needsUpdate = true
    if (crown.current!.instanceColor) crown.current!.instanceColor.needsUpdate = true
  }, [W])
  // frustumCulled off: an InstancedMesh is culled by its base geometry's bounds at the origin (see open/hillside/page.tsx)
  return (
    <>
      <instancedMesh frustumCulled={false} ref={trunk} args={[undefined, undefined, W.trees.length]}>
        <cylinderGeometry args={[0.24, 0.32, 1, 6]} /><meshLambertMaterial color="#7a5c40" flatShading />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={crown} args={[undefined, undefined, W.trees.length]}>
        <coneGeometry args={[1, 1, 7]} /><meshLambertMaterial flatShading />
      </instancedMesh>
    </>
  )
}

/** A waymark in the world: a standing stone with Enchant's binding ring hovering over it. */
export function WaymarkStone({ w, greg }: { w: Waymark; greg?: boolean }) {
  const glow = greg ? '#e7c766' : '#6fd3c4'
  return (
    <group position={[w.x, w.y, w.z]}>
      <mesh position-y={0.8}><boxGeometry args={[0.55, 1.6, 0.45]} /><meshLambertMaterial color="#b8ae9c" flatShading /></mesh>
      <mesh position-y={2.15} rotation-x={Math.PI / 2}><torusGeometry args={[0.55, 0.06, 5, 16]} /><meshLambertMaterial color={glow} emissive={glow} emissiveIntensity={0.9} /></mesh>
      <mesh position-y={0.02} rotation-x={-Math.PI / 2}><ringGeometry args={[1.2, 1.5, 16]} /><meshBasicMaterial color={glow} transparent opacity={0.55} /></mesh>
    </group>
  )
}

export function WildsScene({ W, waymarks }: { W: Wilds; waymarks: Waymark[] }) {
  const geo = useMemo(() => wildsGeometry(W), [W])
  const greg = { ...GREG_WAYMARK, y: W.heightAt(GREG_WAYMARK.x, GREG_WAYMARK.z) }
  return (
    <>
      <mesh geometry={geo}><meshLambertMaterial vertexColors flatShading /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={W.meta.waterY - 0.15}>
        <planeGeometry args={[W.meta.sizeX, W.meta.sizeZ]} /><meshLambertMaterial color={P.water} transparent opacity={0.8} />
      </mesh>
      <Trees W={W} />
      <WaymarkStone w={greg} greg />
      {waymarks.filter(w => w.tile === W.meta.name).map(w => <WaymarkStone key={w.id} w={w} />)}
    </>
  )
}

