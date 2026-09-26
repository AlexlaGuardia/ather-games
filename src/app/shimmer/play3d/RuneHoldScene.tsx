'use client'

/**
 * Rune Hold's look — the Passage's materials over the town's own grid (`rune-hold-look.ts`).
 *
 * ★ A BLOCKOUT WITH A MOOD, not final art (the art-medium law: generated first, Alex judges). Canon's
 * words are the brief: *"stone buildings stacked along winding streets. Warm lantern light."* So the
 * brown boxes become coursed stone with a timber band, lit windows, a slate gable and a chimney; the
 * long east run becomes the dug hillside the town is carved into; the paths are laid as cobbles and the
 * grass goes from lawn to mountain meadow; lanterns stand on the street edges.
 *
 * `ZoneGeometry` is told `ownSolids` for this zone, so its brown blocks are not drawn and these are.
 * The ground is laid a hair ABOVE the zone's own floor tiles, which still draw underneath (editing and
 * the warp glow keep working). Collision is untouched: the walker still reads the grid.
 *
 * ⚠ LIGHT BUDGET (memory: reference_alex_desktop_gpu): the town has a sun, so lanterns are emissive
 * glass and only the few round the square carry a real light.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { blocksOf, lanternsOf, openSides, hash, isBuilding, PATH, BUILDING, type Block } from './rune-hold-look'
import { runeHold as RH, passage as P } from './scene-palette'
import { LANDING, PIERS } from '../world/landing'

interface Inst { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw?: number; tilt?: number; c: string }

/** One instanced mesh of unit boxes (or planes laid flat), each placed, scaled and coloured. */
function Instances({ items, flat, emissive, cast = true }: { items: Inst[]; flat?: boolean; emissive?: number; cast?: boolean }) {
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
        ? <meshStandardMaterial color={RH.window} emissive={RH.window} emissiveIntensity={emissive} roughness={0.6} />
        : <meshStandardMaterial roughness={0.95} />}
    </instancedMesh>
  )
}

const pick = <T,>(arr: readonly T[], x: number, z: number, k: number) => arr[Math.floor(hash(x, z, k) * arr.length) % arr.length]

/** A gable per house: one merged mesh, vertex-coloured, eaves past the walls. */
function roofsOf(blocks: Block[], heightAt: (x: number, z: number) => number): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = []
  const c = new THREE.Color()
  const tri = (a: number[], b: number[], d: number[], hex: string, shade = 1) => {
    pos.push(...a, ...b, ...d)
    c.set(hex).multiplyScalar(shade)
    for (let i = 0; i < 3; i++) col.push(c.r, c.g, c.b)
  }
  const quad = (a: number[], b: number[], d: number[], e: number[], hex: string, shade = 1) => { tri(a, b, d, hex, shade); tri(a, d, e, hex, shade) }
  for (const b of blocks) {
    if (b.kind !== 'house') continue
    const eave = 0.45
    const x0 = b.x0 - 0.5 - eave, x1 = b.x1 + 0.5 + eave, z0 = b.z0 - 0.5 - eave, z1 = b.z1 + 0.5 + eave
    const base = heightAt(b.x0, b.z0) + b.h
    const span = b.ridgeX ? z1 - z0 : x1 - x0
    const rise = Math.min(4.2, span * 0.32)
    const hex = pick(RH.roof, b.x0, b.z0, 9)
    if (b.ridgeX) {
      const zm = (z0 + z1) / 2
      quad([x0, base, z0], [x0, base + rise, zm], [x1, base + rise, zm], [x1, base, z0], hex, 1)
      quad([x1, base, z1], [x1, base + rise, zm], [x0, base + rise, zm], [x0, base, z1], hex, 0.82)
      // gable ends in stone, set back under the eave
      const gx0 = b.x0 - 0.5, gx1 = b.x1 + 0.5, gz0 = b.z0 - 0.5, gz1 = b.z1 + 0.5
      const s = pick(RH.stone, b.x0, b.z0, 11)
      tri([gx0, base, gz0], [gx0, base, gz1], [gx0, base + rise * ((gz1 - gz0) / (z1 - z0)), zm], s, 0.9)
      tri([gx1, base, gz1], [gx1, base, gz0], [gx1, base + rise * ((gz1 - gz0) / (z1 - z0)), zm], s, 0.9)
    } else {
      const xm = (x0 + x1) / 2
      quad([x0, base, z1], [xm, base + rise, z1], [xm, base + rise, z0], [x0, base, z0], hex, 1)
      quad([x1, base, z0], [xm, base + rise, z0], [xm, base + rise, z1], [x1, base, z1], hex, 0.82)
      const gx0 = b.x0 - 0.5, gx1 = b.x1 + 0.5, gz0 = b.z0 - 0.5, gz1 = b.z1 + 0.5
      const s = pick(RH.stone, b.x0, b.z0, 11)
      tri([gx1, base, gz0], [gx0, base, gz0], [xm, base + rise * ((gx1 - gx0) / (x1 - x0)), gz0], s, 0.9)
      tri([gx0, base, gz1], [gx1, base, gz1], [xm, base + rise * ((gx1 - gx0) / (x1 - x0)), gz1], s, 0.9)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

export function RuneHoldScene({ grid, heights, version = 0 }: { grid: number[][]; heights?: number[][]; version?: number }) {
  const look = useMemo(() => {
    const g = grid
    const heightAt = (x: number, z: number) => heights?.[z]?.[x] ?? 0
    const blocks = blocksOf(g)
    const owner = new Map<string, Block>()
    for (const b of blocks) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) if (isBuilding(g, x, z)) owner.set(`${x},${z}`, b)

    const stone: Inst[] = [], hill: Inst[] = [], timber: Inst[] = [], windows: Inst[] = [], sills: Inst[] = []
    const ground: Inst[] = [], chimneys: Inst[] = []
    for (let z = 0; z < g.length; z++) for (let x = 0; x < g[z].length; x++) {
      const v = g[z][x]
      if (v === undefined || v < 0) continue
      const y0 = heightAt(x, z)
      if ((v & 0xff) !== BUILDING) {
        // the ground: cobbles on the streets, meadow elsewhere, worn bare where the two meet
        const t = v & 0xff
        if (t === PATH) {
          // a mortar bed, then four setts on it: a metre-square slab read as floor tiles on a lawn
          ground.push({ x, y: y0 + 0.03, z, sx: 1, sy: 1, sz: 1, c: RH.mortar })
          for (let q = 0; q < 4; q++) {
            const ox = (q & 1 ? 0.25 : -0.25) + (hash(x, z, 20 + q) - 0.5) * 0.05, oz = (q & 2 ? 0.25 : -0.25) + (hash(x, z, 24 + q) - 0.5) * 0.05
            ground.push({ x: x + ox, y: y0 + 0.045, z: z + oz, sx: 0.44, sy: 0.44, sz: 1, yaw: (hash(x, z, 1 + q) - 0.5) * 0.25, c: pick(RH.cobble, x, z, 2 + q * 3) })
          }
        }
        else if (t === 97) {
          let nearPath = false
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (((g[z + dz]?.[x + dx] ?? -1) & 0xff) === PATH) nearPath = true
          ground.push({ x, y: y0 + 0.025, z, sx: 1, sy: 1, sz: 1, c: nearPath && hash(x, z, 3) < 0.55 ? pick(RH.worn, x, z, 4) : pick(RH.meadow, x, z, 5) })
        }
        continue
      }
      const b = owner.get(`${x},${z}`)!
      const sides = openSides(g, x, z)
      if (b.kind === 'hillside') {
        if (!sides.length) {
          // the hill's back: a grassy crest nobody walks, broken so it reads as ground and not a lid
          hill.push({ x, y: y0 + b.h - 0.3 + hash(x, z, 6) * 1.2, z, sx: 1.02, sy: 0.6, sz: 1.02, c: pick(RH.hillTop, x, z, 7) })
          continue
        }
        // the Passage's dug rock: stacked chunks, each its own size, colour and lean
        let y = y0 - 0.4, k = 0
        const top = y0 + b.h + hash(x, z, 8) * 1.6
        while (y < top) {
          const tall = Math.min(top - y, 0.8 + hash(x, z, 10 + k) * 0.9)
          hill.push({ x: x + (hash(x, z, 20 + k) - 0.5) * 0.2, y: y + tall / 2, z: z + (hash(x, z, 30 + k) - 0.5) * 0.2,
            sx: 1 + hash(x, z, 50 + k) * 0.3, sy: tall, sz: 1 + hash(x, z, 55 + k) * 0.3,
            yaw: (hash(x, z, 4 + k) - 0.5) * 0.9, tilt: (hash(x, z, 60 + k) - 0.5) * 0.12, c: pick(RH.hill, x, z, 40 + k) })
          y += tall * 0.92; k++
        }
        continue
      }
      if (!sides.length) continue // buried: under the roof, never seen
      // CUT stone: even courses, a little play in each block, so it reads as masonry and not dug rock
      const course = 0.55
      const n = Math.round(b.h / course)
      for (let k = 0; k < n; k++) {
        const inset = (hash(x, z, 70 + k) - 0.5) * 0.06
        stone.push({ x: x + inset, y: y0 + course * (k + 0.5), z: z + inset, sx: 1.02, sy: course * 0.97, sz: 1.02,
          yaw: (hash(x, z, 80 + k) - 0.5) * 0.05, c: pick(RH.stone, x, z, 90 + k) })
      }
      // the timber band under the eave (a pier gets a stone capstone instead, below)
      if (b.kind === 'kiosk') continue
      timber.push({ x, y: y0 + b.h + 0.12, z, sx: 1.08, sy: 0.26, sz: 1.08, c: RH.timber })
      if (b.kind !== 'house') continue
      // windows: a lit pane on an outer face, one storey or two, never at a corner
      if (sides.length === 1) {
        const [dx, dz] = sides[0]
        const along = dx !== 0
        const floors = b.h > 4.8 ? [1.7, 3.5] : [1.7]
        floors.forEach((wy, i) => {
          if (hash(x, z, 100 + i) > 0.34) return
          const ox = x + dx * 0.52, oz = z + dz * 0.52
          windows.push({ x: ox, y: y0 + wy, z: oz, sx: along ? 0.06 : 0.5, sy: 0.72, sz: along ? 0.5 : 0.06, c: RH.window })
          sills.push({ x: x + dx * 0.56, y: y0 + wy - 0.42, z: z + dz * 0.56, sx: along ? 0.14 : 0.66, sy: 0.1, sz: along ? 0.66 : 0.14, c: RH.sill })
          sills.push({ x: x + dx * 0.55, y: y0 + wy + 0.42, z: z + dz * 0.55, sx: along ? 0.12 : 0.62, sy: 0.12, sz: along ? 0.62 : 0.12, c: RH.timber })
        })
      }
    }
    // one chimney per house, near the ridge, at the gable the hash picks
    for (const b of blocks) {
      if (b.kind !== 'house') continue
      const cx = b.ridgeX ? b.x0 + 1.5 + hash(b.x0, b.z0, 12) * (b.x1 - b.x0 - 3) : (b.x0 + b.x1) / 2 + 1.2
      const cz = b.ridgeX ? (b.z0 + b.z1) / 2 + 1.2 : b.z0 + 1.5 + hash(b.x0, b.z0, 13) * (b.z1 - b.z0 - 3)
      const base = heightAt(b.x0, b.z0) + b.h
      chimneys.push({ x: cx, y: base + 1.6, z: cz, sx: 0.9, sy: 3.2, sz: 0.9, c: pick(RH.stone, b.x0, b.z0, 14) })
      chimneys.push({ x: cx, y: base + 3.3, z: cz, sx: 1.05, sy: 0.22, sz: 1.05, c: RH.timber })
    }

    // THE LANDING is a FRAMED gate (canon `world/gates.md`): capstones on its piers and a lintel across
    // the door. Placement comes from `world/landing.ts`, never restated here.
    if (PIERS.every(([px, py]) => isBuilding(g, px, py))) {
      const xs = PIERS.map(p => p[0]), zs = PIERS.map(p => p[1])
      const x0 = Math.min(...xs) - 0.5, x1 = Math.max(...xs) + 0.5
      const z0 = Math.min(...zs, LANDING.y) - 0.5, z1 = Math.max(...zs, LANDING.y + LANDING.h - 1) + 0.5
      const top = heightAt(LANDING.x, LANDING.y) + 3.4
      const s = pick(RH.stone, LANDING.x, LANDING.y, 15)
      chimneys.push({ x: (x0 + x1) / 2, y: top + 0.35, z: (z0 + z1) / 2, sx: x1 - x0 + 0.3, sy: 0.7, sz: z1 - z0 + 0.3, c: s })
      chimneys.push({ x: (x0 + x1) / 2, y: top + 0.8, z: (z0 + z1) / 2, sx: x1 - x0 - 0.6, sy: 0.2, sz: z1 - z0 - 0.4, c: RH.timber })
    }

    // lanterns: the square's few carry a real light
    const lamps = lanternsOf(g)
    const kiosks = blocks.filter(b => b.kind === 'kiosk')
    const sq = kiosks.length
      ? { x: kiosks.reduce((s, b) => s + (b.x0 + b.x1) / 2, 0) / kiosks.length, z: kiosks.reduce((s, b) => s + (b.z0 + b.z1) / 2, 0) / kiosks.length }
      : { x: g[0].length / 2, z: g.length / 2 }
    const lit = new Set([...lamps].sort((a, b) => Math.hypot(a.x - sq.x, a.z - sq.z) - Math.hypot(b.x - sq.x, b.z - sq.z)).slice(0, 5))
    const posts: Inst[] = [], glass: Inst[] = []
    for (const l of lamps) {
      const y0 = heightAt(l.x, l.z)
      posts.push({ x: l.x, y: y0 + 1.15, z: l.z, sx: 0.09, sy: 2.3, sz: 0.09, c: P.iron })
      posts.push({ x: l.x, y: y0 + 2.62, z: l.z, sx: 0.44, sy: 0.08, sz: 0.44, c: P.iron })
      glass.push({ x: l.x, y: y0 + 2.36, z: l.z, sx: 0.32, sy: 0.42, sz: 0.32, c: P.glass })
    }
    const lights = lamps.filter(l => lit.has(l)).map(l => ({ x: l.x, y: heightAt(l.x, l.z) + 2.2, z: l.z }))

    return { stone, hill, timber, windows, sills, ground, chimneys, posts, glass, lights, roof: roofsOf(blocks, heightAt) }
  // `version` bumps when the map editor paints — the grid is the same array, mutated in place
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, heights, version])

  return (
    <>
      <Instances items={look.ground} flat cast={false} />
      <Instances items={look.stone} />
      <Instances items={look.hill} />
      <Instances items={look.timber} />
      <Instances items={look.sills} cast={false} />
      <Instances items={look.chimneys} />
      <Instances items={look.posts} />
      <Instances items={look.windows} emissive={0.9} cast={false} />
      <Instances items={look.glass} emissive={1.1} cast={false} />
      <mesh geometry={look.roof} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {look.lights.map((l, i) => <pointLight key={i} position={[l.x, l.y, l.z]} color={P.lamp} intensity={10} distance={10} decay={1.6} />)}
    </>
  )
}
