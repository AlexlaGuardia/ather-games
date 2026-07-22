'use client'
// Shimmer Garden — ground detail scatter (art lane / Jin).
// Breaks up the flat-shaded floor with grass tufts, warm pebbles, and sparse flower pops.
// Purely ADDITIVE: it seats instanced detail ON TOP of the existing FloorTerrain, changing
// nothing about the terrain mesh — so it mounts one line inside ZoneGeometry, no engine edit.
//
// Mount (one line, inside ZoneGeometry, right after <FloorTerrain floors={floors} .../>):
//   <GroundDetail floors={floors} heights={heights} />
//
// Canon: generic scenery, canon-free (shimmer-garden-atmosphere.md: scatter is Jin's to place).
// FEEL constants are grouped at the top. Mood-tinting by zone (lush gold vs sparse grey) is a
// later hook — needs zoneId threaded into ZoneGeometry; for now the whole garden reads tended.

import { useMemo, useRef, useLayoutEffect } from 'react'
import * as THREE from 'three'

const STEP = 1.0 // mirrors Shimmer3D's STEP; the floor top face sits at height*STEP

type Cell = [number, number]
type Inst = { x: number; y: number; z: number; rot: number; scale: number; color: THREE.Color }

// ── FEEL constants ─────────────────────────────────────────────────────────────
const TUFT_CHANCE = 0.6    // per sub-slot; two slots per cell → up to 2 tufts/cell
const PEBBLE_CHANCE = 0.16
const FLOWER_CHANCE = 0.05
const GRASS_COLORS = ['#7cc46a', '#8fd074', '#6aa651', '#a6cf6b', '#71b85c'] // varied greens, some golden
const PEBBLE_COLORS = ['#b3a78f', '#c3b79b', '#9c917b']                       // warm stone (reads under gold fog)
const FLOWER_COLORS = ['#ffd34d', '#f2a3c4', '#eaf3ff']                       // gold / pink / silver blooms

// deterministic pseudo-random from a cell + salt, so scatter is stable across renders (no flicker)
const fract = (x: number) => x - Math.floor(x)
const rnd = (c: number, r: number, s: number) => fract(Math.sin(c * 127.1 + r * 311.7 + s * 74.7) * 43758.5453)

function buildField(
  floors: Cell[], heights: number[][], salts: number[], chance: number,
  o: { yBase: number; jitter: number; minScale: number; maxScale: number; colors: string[]; colorSalt: number },
): Inst[] {
  const out: Inst[] = []
  const palette = o.colors.map((c) => new THREE.Color(c))
  for (const [c, r] of floors) {
    const top = (heights[r]?.[c] ?? 0) * STEP
    for (const s of salts) {
      if (rnd(c, r, s) > chance) continue
      const jx = (rnd(c, r, s + 11) - 0.5) * o.jitter
      const jz = (rnd(c, r, s + 23) - 0.5) * o.jitter
      const rot = rnd(c, r, s + 31) * Math.PI * 2
      const scale = o.minScale + rnd(c, r, s + 41) * (o.maxScale - o.minScale)
      const color = palette[Math.floor(rnd(c, r, s + o.colorSalt) * palette.length)]
      out.push({ x: c + jx, y: top + o.yBase, z: r + jz, rot, scale, color })
    }
  }
  return out
}

function InstancedField({ insts, children }: { insts: Inst[]; children: React.ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
    const pos = new THREE.Vector3(), scl = new THREE.Vector3()
    insts.forEach((it, i) => {
      e.set(0, it.rot, 0); q.setFromEuler(e)
      pos.set(it.x, it.y, it.z); scl.setScalar(it.scale)
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, it.color) // per-instance colour so no two tufts are the same green
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [insts])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(insts.length, 1)]} frustumCulled={false}>
      {children}
    </instancedMesh>
  )
}

export function GroundDetail({ floors, heights }: { floors: Cell[]; heights: number[][] }) {
  const tufts = useMemo(
    () => buildField(floors, heights, [1, 2], TUFT_CHANCE, { yBase: 0.12, jitter: 0.62, minScale: 0.8, maxScale: 1.4, colors: GRASS_COLORS, colorSalt: 51 }),
    [floors, heights],
  )
  const pebbles = useMemo(
    () => buildField(floors, heights, [3], PEBBLE_CHANCE, { yBase: 0.05, jitter: 0.55, minScale: 0.6, maxScale: 1.15, colors: PEBBLE_COLORS, colorSalt: 61 }),
    [floors, heights],
  )
  const flowers = useMemo(
    () => buildField(floors, heights, [4], FLOWER_CHANCE, { yBase: 0.13, jitter: 0.5, minScale: 0.7, maxScale: 1.2, colors: FLOWER_COLORS, colorSalt: 71 }),
    [floors, heights],
  )
  return (
    <>
      {/* grass tufts — thin faceted blades, the main texture win */}
      <InstancedField insts={tufts}>
        <coneGeometry args={[0.055, 0.26, 4]} />
        <meshStandardMaterial roughness={0.85} flatShading />
      </InstancedField>
      {/* warm pebbles — small dead-grey stone, matte */}
      <InstancedField insts={pebbles}>
        <dodecahedronGeometry args={[0.09, 0]} />
        <meshStandardMaterial roughness={0.95} flatShading />
      </InstancedField>
      {/* sparse flower blooms — little colour pops of life */}
      <InstancedField insts={flowers}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial roughness={0.5} />
      </InstancedField>
    </>
  )
}

export default GroundDetail
