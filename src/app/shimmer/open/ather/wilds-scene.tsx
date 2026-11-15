'use client'

// The Wilds' scene: the biome-tinted tile, water, instanced trees and the waymark stones. Split out of page.tsx.

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { BIOME, type Wilds, type BiomeId, type Tree } from './wilds'
import { TREE_KINDS, isPruned, subscribeForestry, forestryRev, type TreeKind } from './forestry'
import { GREG_WAYMARK, type Waymark } from './waymarks'
import { P } from './palette'
import { GROUND, useGroundMaterial } from './ground-look'

function wildsGeometry(W: Wilds): THREE.BufferGeometry {
  const { nx, nz, cell, sizeX, sizeZ } = W.meta
  const hx = sizeX / 2, hz = sizeZ / 2
  const pos = new Float32Array((nx - 1) * (nz - 1) * 18), col = new Float32Array((nx - 1) * (nz - 1) * 18), lay = new Float32Array((nx - 1) * (nz - 1) * 6)
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
      const L = b === BIOME.water || b === BIOME.shore ? GROUND.sand : b === BIOME.rock ? GROUND.stone : b === BIOME.woods ? GROUND.loam : GROUND.grass
      lay[o / 3] = L; lay[o / 3 + 1] = L; lay[o / 3 + 2] = L
      o += 9
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aLayer', new THREE.BufferAttribute(lay, 1))
  g.computeVertexNormals()
  return g
}

// The Ather's four trees, each its own look (canon: game/shimmer-skilling.md › Tree Types). A pruned tree stands
// thinned (a smaller, duller crown) until it regrows: forestry.ts keeps the timers, this only draws them.
const LOOK: Record<TreeKind, { trunk: string; crown: string; emissive?: string; trunkW: number; shape: 'round' | 'dome' | 'weep' | 'giant' }> = {
  goldwood:   { trunk: '#8a6a45', crown: '#c9c25e', trunkW: 1, shape: 'round' },     // warm golden bark, round canopy
  shimmeroak: { trunk: '#5f4430', crown: '#6f9b4f', trunkW: 1.35, shape: 'dome' },   // larger, harder bark, rich grain
  starwillow: { trunk: '#9a8160', crown: '#e7d78e', emissive: '#f2e3a0', trunkW: 0.8, shape: 'weep' },   // weeping, glowing tips
  dawnwood:   { trunk: '#6e4a2c', crown: '#d79b45', trunkW: 2, shape: 'giant' },    // ancient thick trunk, amber-gold
}
function TreeKindMesh({ trees, kind }: { trees: Tree[]; kind: TreeKind }) {
  const trunk = useRef<THREE.InstancedMesh>(null), crown = useRef<THREE.InstancedMesh>(null)
  const frev = useSyncExternalStore(subscribeForestry, forestryRev, () => 0)
  const L = LOOK[kind]
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color()
    const now = Date.now()
    trees.forEach((t, k) => {
      const cut = isPruned(t.id, now), w = L.trunkW, h = L.shape === 'giant' ? 4.2 : 2.8
      p.set(t.x, t.y + h / 2, t.z); s.set(w, h, w); trunk.current!.setMatrixAt(k, m.compose(p, q, s))
      const f = cut ? 0.55 : 1
      if (L.shape === 'weep') { p.set(t.x, t.y + 1.2 + t.tall * 0.42, t.z); s.set(t.r * 1.15 * f, t.tall * 0.9 * f, t.r * 1.15 * f) }
      else if (L.shape === 'giant') { p.set(t.x, t.y + h + t.tall * 0.32, t.z); s.set(t.r * 1.1 * f, t.tall * 0.62 * f, t.r * 1.1 * f) }
      else { p.set(t.x, t.y + 2.4 + t.tall * 0.3, t.z); s.set(t.r * f, t.tall * 0.55 * f, t.r * f) }
      crown.current!.setMatrixAt(k, m.compose(p, q, s))
      c.set(L.crown).offsetHSL(((k * 0.07) % 0.04) - 0.02, cut ? -0.15 : 0, (((k * 0.11) % 0.08) - 0.04) - (cut ? 0.06 : 0))
      crown.current!.setColorAt(k, c)
    })
    trunk.current!.instanceMatrix.needsUpdate = true; crown.current!.instanceMatrix.needsUpdate = true
    if (crown.current!.instanceColor) crown.current!.instanceColor.needsUpdate = true
  }, [trees, frev, L])
  if (trees.length === 0) return null
  // frustumCulled off: an InstancedMesh is culled by its base geometry's bounds at the origin (see open/hillside/page.tsx)
  return (
    <>
      <instancedMesh frustumCulled={false} ref={trunk} args={[undefined, undefined, trees.length]}>
        <cylinderGeometry args={[0.24, 0.32, 1, 6]} /><meshLambertMaterial color={L.trunk} flatShading />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={crown} args={[undefined, undefined, trees.length]}>
        {L.shape === 'weep' ? <coneGeometry args={[1, 1, 9, 1, true]} /> : L.shape === 'dome' ? <dodecahedronGeometry args={[1, 0]} /> : <icosahedronGeometry args={[1, 0]} />}
        <meshLambertMaterial flatShading side={L.shape === 'weep' ? THREE.DoubleSide : THREE.FrontSide} emissive={L.emissive ?? '#000000'} emissiveIntensity={L.emissive ? 0.22 : 0} />
      </instancedMesh>
    </>
  )
}
function Trees({ W }: { W: Wilds }) {
  const byKind = useMemo(() => TREE_KINDS.map(k => [k, W.trees.filter(t => t.kind === k)] as const), [W])
  return <>{byKind.map(([k, ts]) => <TreeKindMesh key={k} kind={k} trees={ts} />)}</>
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
  const ground = useGroundMaterial()
  const greg = { ...GREG_WAYMARK, y: W.heightAt(GREG_WAYMARK.x, GREG_WAYMARK.z) }
  return (
    <>
      <mesh geometry={geo} material={ground} />
      <mesh rotation-x={-Math.PI / 2} position-y={W.meta.waterY - 0.15}>
        <planeGeometry args={[W.meta.sizeX, W.meta.sizeZ]} /><meshLambertMaterial color={P.water} transparent opacity={0.8} />
      </mesh>
      <Trees W={W} />
      {W.meta.name === GREG_WAYMARK.tile && <WaymarkStone w={greg} greg />}
      {waymarks.filter(w => w.tile === W.meta.name).map(w => <WaymarkStone key={w.id} w={w} />)}
    </>
  )
}

