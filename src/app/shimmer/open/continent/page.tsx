'use client'

// /shimmer/open/continent — the Darter on REAL ground: a region of the Athernyx continent (OPEN_WORLD_PLAN.md › P4/P5).
// The land is the painted map made terrain (tools/worldmap/derive_height.py); the roads are the Atlas's, edited in
// akatskii /canon World and cut into the ground by export_region.py; the handling is open/courser.ts. First region:
// the Ashfeld → Millbrook → Rune Hold corridor, 2.0 × 2.9 km.
//
// Terrain streams as CHUNKS whose detail follows distance (5 m near, 10 m, 20 m far), with skirts so LOD seams never
// show sky. Houses and trees are placeholder geometry: towns read as towns, nothing more is claimed.
// Desktop only for now (keys). ?region=<name> picks another exported region.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelDayNight } from '../../voxel3d/day-night'
import { createCourser, tickCourser, bodySpeeds, slipAngle, type Courser, type CourserInput, type CourserTune } from '../courser'
import { GaragePanel, useCourserBuild } from '../garage'
import { DarterModel, DriftFx, RoadPosts, SpeedStreaks, chaseShape, speedRumble } from '../darter-view'
import { loadRegion, nearestRoad, type Region, type RegionRoad } from '../region'

const STEP = 1 / 120
const FOV = 64
const CHUNK = 40                         // cells per chunk side (200 m)
const FOG_NEAR = 380, FOG_FAR = 1300

const hash = (a: number, b: number) => {
  let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

// ── terrain colour: sand at the water, grass, darker on steep, rock past a cart's grade, pale high ground ──
const COL = {
  sand: new THREE.Color('#cdb98a'), grass: new THREE.Color('#6f9a45'), grass2: new THREE.Color('#82ab4e'),
  dark: new THREE.Color('#4e7a38'), rock: new THREE.Color('#8b7f70'), high: new THREE.Color('#a9a69a'), bed: new THREE.Color('#5d7f78'),
}
function tint(out: THREE.Color, y: number, slope: number, x: number, z: number) {
  if (y < -0.3) return out.copy(COL.bed)
  if (y < 1.6) return out.copy(COL.sand)
  if (slope > 0.75) return out.copy(COL.rock)
  out.copy(COL.grass).lerp(COL.grass2, hash(Math.floor(x / 23), Math.floor(z / 23)) * 0.8)
  if (slope > 0.35) out.lerp(COL.dark, Math.min(1, (slope - 0.35) * 2.5))
  if (y > 180) out.lerp(COL.high, Math.min(1, (y - 180) / 120))
  return out
}

function chunkGeometry(R: Region, ci: number, cj: number, step: number): THREE.BufferGeometry {
  const { nx, nz, cell, sizeX, sizeZ } = R.meta
  const i0 = ci * CHUNK, j0 = cj * CHUNK
  const i1 = Math.min(nx - 1, i0 + CHUNK), j1 = Math.min(nz - 1, j0 + CHUNK)
  const is: number[] = [], js: number[] = []
  for (let i = i0; i < i1; i += step) is.push(i); is.push(i1)
  for (let j = j0; j < j1; j += step) js.push(j); js.push(j1)
  const W = is.length, H = js.length
  const pos = new Float32Array((W * H + 2 * (W + H)) * 3), col = new Float32Array(pos.length)
  const c = new THREE.Color()
  const put = (k: number, i: number, j: number, drop: number) => {
    const x = i * cell - sizeX / 2, z = j * cell - sizeZ / 2, y = R.vertex(i, j)
    const sx = (R.vertex(Math.min(nx - 1, i + 1), j) - R.vertex(Math.max(0, i - 1), j)) / (2 * cell)
    const sz = (R.vertex(i, Math.min(nz - 1, j + 1)) - R.vertex(i, Math.max(0, j - 1))) / (2 * cell)
    pos[k * 3] = x; pos[k * 3 + 1] = y - drop; pos[k * 3 + 2] = z
    tint(c, y, Math.hypot(sx, sz), x, z)
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b
  }
  for (let b = 0; b < H; b++) for (let a = 0; a < W; a++) put(b * W + a, is[a], js[b], 0)
  const idx: number[] = []
  for (let b = 0; b < H - 1; b++) for (let a = 0; a < W - 1; a++) {
    const p00 = b * W + a, p10 = p00 + 1, p01 = p00 + W, p11 = p01 + 1
    // ★ the same diagonal heightAt interpolates (00→11), wound to face up
    idx.push(p00, p11, p10, p00, p01, p11)
  }
  // skirts: each edge vertex dropped 6 m, so a coarser neighbour never opens a crack to the sky
  let k = W * H
  const edges: number[][] = [
    Array.from({ length: W }, (_, a) => a), Array.from({ length: W }, (_, a) => (H - 1) * W + a),
    Array.from({ length: H }, (_, b) => b * W), Array.from({ length: H }, (_, b) => b * W + W - 1),
  ]
  for (const e of edges) {
    const start = k
    for (const v of e) { const a = v % W, b = Math.floor(v / W); put(k++, is[a], js[b], 6) }
    for (let n = 0; n < e.length - 1; n++) { const t0 = e[n], t1 = e[n + 1], s0 = start + n, s1 = start + n + 1; idx.push(t0, s0, t1, t1, s0, s1, t0, t1, s0, t1, s1, s0) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 3), 3))
  g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, k * 3), 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

/** Streams the land: every 0.4 s each chunk picks a detail from its distance; at most 3 rebuilds a frame. */
function Terrain({ R, focus }: { R: Region; focus: React.MutableRefObject<THREE.Vector3> }) {
  const group = useRef<THREE.Group>(null)
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), [])
  const chunks = useRef(new Map<string, { mesh: THREE.Mesh; step: number }>())
  const queue = useRef<{ key: string; ci: number; cj: number; step: number; d: number }[]>([])
  const t = useRef(0)
  const nci = Math.ceil((R.meta.nx - 1) / CHUNK), ncj = Math.ceil((R.meta.nz - 1) / CHUNK)
  useEffect(() => () => { for (const c of chunks.current.values()) c.mesh.geometry.dispose() }, [])
  useFrame((_, dt) => {
    const g = group.current; if (!g) return
    t.current -= dt
    if (t.current <= 0) {
      t.current = 0.4
      const f = focus.current, span = CHUNK * R.meta.cell
      const want: typeof queue.current = []
      for (let cj = 0; cj < ncj; cj++) for (let ci = 0; ci < nci; ci++) {
        const cx = (ci + 0.5) * span - R.meta.sizeX / 2, cz = (cj + 0.5) * span - R.meta.sizeZ / 2
        const d = Math.max(0, Math.hypot(cx - f.x, cz - f.z) - span * 0.7)
        const key = `${ci},${cj}`, have = chunks.current.get(key)
        if (d > FOG_FAR + 100) { if (have) { g.remove(have.mesh); have.mesh.geometry.dispose(); chunks.current.delete(key) } continue }
        const step = d < 260 ? 1 : d < 650 ? 2 : 4
        if (!have || have.step !== step) want.push({ key, ci, cj, step, d })
      }
      queue.current = want.sort((a, b) => a.d - b.d)
    }
    for (let n = 0; n < 3 && queue.current.length; n++) {
      const q = queue.current.shift()!
      const geo = chunkGeometry(R, q.ci, q.cj, q.step)
      const have = chunks.current.get(q.key)
      if (have) { have.mesh.geometry.dispose(); have.mesh.geometry = geo; have.step = q.step }
      else { const mesh = new THREE.Mesh(geo, mat); g.add(mesh); chunks.current.set(q.key, { mesh, step: q.step }) }
    }
  })
  return <group ref={group} />
}

// ── roads: a ribbon laid on the ground the car drives, coloured by canon tier ──
const ROAD_COL: Record<RegionRoad['kind'], string> = { paved: '#b9b2a2', road: '#a08a68', trail: '#7d6447', pass: '#8a7462' }
function Roads({ R }: { R: Region }) {
  const geos = useMemo(() => {
    const byKind = new Map<string, { pos: number[] }>()
    // the proposer's shared trunks arrive as near-parallel copies a few metres apart; the GROUND is already one
    // surface (export_region.py), so paint one ribbon too: skip centre-line points another road already covers
    const drawn = new Set<string>()
    const cellOf = (x: number, z: number) => `${Math.round(x / 4)},${Math.round(z / 4)}`
    const covered = (x: number, z: number) => {
      const cx = Math.round(x / 4), cz = Math.round(z / 4)
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (drawn.has(`${cx + dx},${cz + dz}`)) return true
      return false
    }
    const widest = [...R.meta.roads].sort((a, b) => b.width - a.width)
    for (const r of widest) {
      const out = byKind.get(r.kind) ?? { pos: [] }; byKind.set(r.kind, out)
      // densify the centre line to 2.5 m
      const line: [number, number][] = []
      for (let k = 0; k < r.pts.length - 1; k++) {
        const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1]
        const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 2.5))
        for (let s = 0; s < n; s++) line.push([ax + (bx - ax) * s / n, az + (bz - az) * s / n])
      }
      line.push([r.pts[r.pts.length - 1][0], r.pts[r.pts.length - 1][1]])
      const hw = r.width / 2
      const mine: [number, number][] = []
      let prevL: number[] | null = null, prevR: number[] | null = null
      for (let k = 0; k < line.length; k++) {
        const a = line[Math.max(0, k - 1)], b = line[Math.min(line.length - 1, k + 1)]
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1
        const nx = -dz / L, nz = dx / L
        const [x, z] = line[k]
        const lx = x + nx * hw, lz = z + nz * hw, rx = x - nx * hw, rz = z - nz * hw
        const Lp = [lx, R.heightAt(lx, lz) + 0.07, lz], Rp = [rx, R.heightAt(rx, rz) + 0.07, rz]
        // off the region's edge there is no ground (−∞): never let such a point into a quad, or the whole mesh's
        // bounds go NaN and three.js culls every road of that kind
        if (!Number.isFinite(Lp[1]) || !Number.isFinite(Rp[1])) { prevL = prevR = null; continue }
        if (covered(x, z) && k > 0 && k < line.length - 1) { prevL = prevR = null; mine.push([x, z]); continue }
        mine.push([x, z])
        if (prevL && prevR) out.pos.push(...prevL, ...Lp, ...prevR, ...prevR, ...Lp, ...Rp)
        prevL = Lp; prevR = Rp
      }
      for (const [x, z] of mine) drawn.add(cellOf(x, z))
    }
    return [...byKind.entries()].map(([kind, { pos }]) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.computeVertexNormals()
      return { kind, g }
    })
  }, [R])
  return (
    <>
      {geos.map(({ kind, g }) => (
        <mesh key={kind} geometry={g}>
          <meshLambertMaterial color={ROAD_COL[kind as RegionRoad['kind']]} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      ))}
    </>
  )
}

// ── roadside posts every 25 m on both edges of every road (one row where trunks share; none in water) ──
function Posts({ R }: { R: Region }) {
  const posts = useMemo(() => {
    const out: [number, number][] = []
    const taken = new Set<string>()
    const key = (x: number, z: number) => `${Math.round(x / 8)},${Math.round(z / 8)}`
    for (const r of [...R.meta.roads].sort((a, b) => b.width - a.width)) {
      let acc = 0
      for (let k = 0; k < r.pts.length - 1; k++) {
        const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1]
        const L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue
        const nx = -(bz - az) / L, nz = (bx - ax) / L
        for (let s = 0; s < L; s += 2.5) {
          acc += 2.5
          if (acc < 25) continue
          acc = 0
          const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L
          for (const side of [1, -1]) {
            const px = x + nx * side * (r.width / 2 + 1.8), pz = z + nz * side * (r.width / 2 + 1.8)
            const y = R.heightAt(px, pz), kk = key(px, pz)
            if (!Number.isFinite(y) || y < 0.6 || taken.has(kk)) continue
            if (nearestRoad(R, px, pz).d < r.width / 2 + 0.5) continue     // inside another road's surface
            taken.add(kk); out.push([px, pz])
          }
        }
      }
    }
    return out
  }, [R])
  return <RoadPosts posts={posts} ground={R.heightAt} />
}

// ── towns: a beacon of light at each named place + a scatter of houses that keeps off the road ──
function Towns({ R }: { R: Region }) {
  const houses = useMemo(() => {
    const out: { x: number; y: number; z: number; rot: number; s: number }[] = []
    R.meta.places.forEach((p, pi) => {
      const n = p.kind === 'city' ? 26 : p.kind === 'settlement' ? 16 : p.kind === 'village' ? 9 : p.kind === 'spot' ? 1 : 3
      for (let k = 0, tries = 0; k < n && tries < n * 12; tries++) {
        const a = hash(pi, tries) * Math.PI * 2, r = 10 + hash(tries, pi) * (n > 10 ? 90 : 45)
        const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, y = R.heightAt(x, z)
        if (!Number.isFinite(y) || y < 1.5) continue
        if (nearestRoad(R, x, z).d < 9) continue
        const sl = Math.abs(R.heightAt(x + 3, z) - R.heightAt(x - 3, z)) + Math.abs(R.heightAt(x, z + 3) - R.heightAt(x, z - 3))
        if (sl > 3) continue
        out.push({ x, y, z, rot: hash(k, pi + 7) * Math.PI, s: 0.8 + hash(pi, k + 3) * 0.6 }); k++
      }
    })
    return out
  }, [R])
  const walls = useRef<THREE.InstancedMesh>(null), roofs = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3()
    houses.forEach((h, k) => {
      e.set(0, h.rot, 0); q.setFromEuler(e)
      p.set(h.x, h.y + 1.6 * h.s, h.z); s.set(6 * h.s, 3.6 * h.s, 5 * h.s)
      walls.current!.setMatrixAt(k, m.compose(p, q, s))
      walls.current!.setColorAt(k, new THREE.Color('#d8c9a8').offsetHSL(0, 0, (hash(k, 1) - 0.5) * 0.12))
      e.set(0, h.rot + Math.PI / 4, 0); q.setFromEuler(e)
      p.set(h.x, h.y + 4.6 * h.s, h.z); s.set(5.4 * h.s, 2.6 * h.s, 5.4 * h.s)
      roofs.current!.setMatrixAt(k, m.compose(p, q, s))
      roofs.current!.setColorAt(k, new THREE.Color(hash(k, 2) > 0.5 ? '#8c4a36' : '#5f4a3c'))
    })
    for (const r of [walls, roofs]) { r.current!.instanceMatrix.needsUpdate = true; if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true }
  }, [houses])
  return (
    <>
      <instancedMesh frustumCulled={false} ref={walls} args={[undefined, undefined, Math.max(1, houses.length)]}><boxGeometry /><meshLambertMaterial flatShading /></instancedMesh>
      <instancedMesh frustumCulled={false} ref={roofs} args={[undefined, undefined, Math.max(1, houses.length)]}><coneGeometry args={[0.75, 1, 4]} /><meshLambertMaterial flatShading /></instancedMesh>
      {R.meta.places.filter(p => p.name).map(p => (
        <mesh key={p.id} position={[p.x, R.heightAt(p.x, p.z) + 45, p.z]}>
          <cylinderGeometry args={[0.6, 1.4, 90, 8, 1, true]} />
          <meshBasicMaterial color="#ffd77a" transparent opacity={0.28} depthWrite={false} fog={false} />
        </mesh>
      ))}
    </>
  )
}

// ── trees: a seeded scatter over grass, off the roads, away from the towns' middles ──
function Trees({ R }: { R: Region }) {
  const pts = useMemo(() => {
    const out: { x: number; y: number; z: number; s: number }[] = []
    const { sizeX, sizeZ } = R.meta
    for (let gz = -sizeZ / 2 + 6; gz < sizeZ / 2 - 6; gz += 14) for (let gx = -sizeX / 2 + 6; gx < sizeX / 2 - 6; gx += 14) {
      const i = Math.round(gx), j = Math.round(gz)
      // clumpy: a slow field decides woods vs open
      const wood = hash(Math.floor(gx / 90), Math.floor(gz / 90))
      if (hash(i, j) > (wood > 0.55 ? 0.6 : 0.08)) continue
      const x = gx + (hash(j, i) - 0.5) * 12, z = gz + (hash(i + 3, j) - 0.5) * 12, y = R.heightAt(x, z)
      if (!Number.isFinite(y) || y < 2 || y > 230) continue
      if (Math.abs(R.heightAt(x + 4, z) - R.heightAt(x - 4, z)) > 5) continue
      if (nearestRoad(R, x, z).d < 9) continue
      if (R.meta.places.some(p => Math.hypot(p.x - x, p.z - z) < 40)) continue
      out.push({ x, y, z, s: 0.8 + hash(i, j + 9) * 0.7 })
      if (out.length >= 7000) return out
    }
    return out
  }, [R])
  const trunk = useRef<THREE.InstancedMesh>(null), crown = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3()
    pts.forEach((t, k) => {
      p.set(t.x, t.y + 1.4 * t.s, t.z); s.set(t.s, 2.8 * t.s, t.s); trunk.current!.setMatrixAt(k, m.compose(p, q, s))
      p.set(t.x, t.y + 5.2 * t.s, t.z); s.set(t.s * 1.1, 6.5 * t.s, t.s * 1.1); crown.current!.setMatrixAt(k, m.compose(p, q, s))
      crown.current!.setColorAt(k, new THREE.Color('#4a7536').offsetHSL((hash(k, 4) - 0.5) * 0.05, 0, (hash(k, 5) - 0.5) * 0.12))
    })
    for (const r of [trunk, crown]) { r.current!.instanceMatrix.needsUpdate = true; if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true }
  }, [pts])
  return (
    <>
      <instancedMesh frustumCulled={false} ref={trunk} args={[undefined, undefined, Math.max(1, pts.length)]}><cylinderGeometry args={[0.2, 0.3, 1, 5]} /><meshLambertMaterial color="#5e4630" flatShading /></instancedMesh>
      <instancedMesh frustumCulled={false} ref={crown} args={[undefined, undefined, Math.max(1, pts.length)]}><coneGeometry args={[1.9, 1, 6]} /><meshLambertMaterial flatShading /></instancedMesh>
    </>
  )
}

function Water({ R }: { R: Region }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.15}>
      <planeGeometry args={[R.meta.sizeX + 4000, R.meta.sizeZ + 4000]} />
      <meshLambertMaterial color="#3f8aa3" transparent opacity={0.86} />
    </mesh>
  )
}

function FogRig() {
  const { scene } = useThree()
  useEffect(() => { scene.fog = new THREE.Fog('#a9c6d6', FOG_NEAR, FOG_FAR); return () => { scene.fog = null } }, [scene])
  return null
}

export interface RideHud { mph: number; frac: number; drift: boolean; air: number; gearR: boolean; place: string | null; road: string | null }

function Driver({ R, onHud, focus, tuneRef }: { R: Region; onHud: (h: RideHud) => void; focus: React.MutableRefObject<THREE.Vector3>; tuneRef: React.MutableRefObject<CourserTune> }) {
  const { camera, gl } = useThree()
  const spawn = useMemo(() => {
    const road = R.meta.roads.find(r => r.from === 'ashfeld' && r.to === 'millbrook') ?? R.meta.roads[0]
    const [ax, az] = road.pts[1], [bx, bz] = road.pts[3]
    return { x: ax, z: az, yaw: Math.atan2(-(bx - ax), -(bz - az)) }
  }, [R])
  const car = useRef<Courser>(createCourser(spawn.x, spawn.z, spawn.yaw, R.heightAt))
  const model = useRef<THREE.Group | null>(null)
  const steerVis = useRef(0)
  const keys = useRef(new Set<string>())
  const scripted = useRef<Partial<CourserInput> | null>(null)
  const acc = useRef(0), hudT = useRef(0), safeT = useRef(0)
  const safe = useRef({ ...spawn })
  const camMode = useRef<'chase' | 'hood'>('chase')
  const camPos = useMemo(() => new THREE.Vector3(spawn.x, R.heightAt(spawn.x, spawn.z) + 4, spawn.z + 8), [R, spawn])
  const look = useMemo(() => new THREE.Vector3(), [])
  const shake = useRef(0)

  const place = (x: number, z: number, yaw: number, speed = 0) => {
    const c = createCourser(x, z, yaw, R.heightAt); c.vx = -Math.sin(yaw) * speed; c.vz = -Math.cos(yaw) * speed
    car.current = c; camPos.set(x + Math.sin(yaw) * 8, R.heightAt(x, z) + 3, z + Math.cos(yaw) * 8)
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code)
      if (e.code === 'KeyR') place(safe.current.x, safe.current.z, safe.current.yaw)
      if (e.code === 'KeyC') camMode.current = camMode.current === 'chase' ? 'hood' : 'chase'
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
    ;(window as unknown as { __drive: unknown }).__drive = {
      state: () => ({ ...car.current, ...bodySpeeds(car.current), slip: slipAngle(car.current), road: nearestRoad(R, car.current.x, car.current.z).d }),
      tp: (x: number, z: number, yaw = 0, speed = 0) => place(x, z, yaw, speed),
      place: (id: string, speed = 0) => {
        const p = R.meta.places.find(q => q.id === id); if (!p) return
        const r = R.meta.roads.find(q => q.from === id || q.to === id)
        if (!r) return place(p.x, p.z, 0, speed)
        const pts = r.from === id ? r.pts : [...r.pts].reverse()
        const [ax, az] = pts[1], [bx, bz] = pts[3]
        place(ax, az, Math.atan2(-(bx - ax), -(bz - az)), speed)
      },
      input: (i: Partial<CourserInput> | null) => { scripted.current = i },
      cam: (m: 'chase' | 'hood') => { camMode.current = m },
    }
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [R])

  useEffect(() => { (camera as THREE.PerspectiveCamera).far = 2500; camera.updateProjectionMatrix() }, [camera])
  useEffect(() => { gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)) }, [gl])

  useFrame((_, frameDt) => {
    const k = keys.current, sc = scripted.current
    const throttle = sc?.throttle ?? ((k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0))
    const steer = sc?.steer ?? ((k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0))
    const handbrake = sc?.handbrake ?? k.has('Space')

    acc.current = Math.min(acc.current + frameDt, 0.1)
    let c = car.current
    // the surface, read off the map: paved Citadel stone grips best, the frontier's packed dirt less, grass least
    const under = nearestRoad(R, c.x, c.z)
    const surface = under.road && under.d < under.road.width / 2 + 1 ? SURFACE[under.road.kind] : SURFACE.off
    while (acc.current >= STEP) {
      acc.current -= STEP
      tickCourser(c, { throttle, steer, handbrake, dt: STEP, surface }, R.heightAt, tuneRef.current)
      const lx = R.meta.sizeX / 2 - 3, lz = R.meta.sizeZ / 2 - 3
      if (Math.abs(c.x) > lx) { c.x = Math.sign(c.x) * lx; c.vx *= -0.3 }
      if (Math.abs(c.z) > lz) { c.z = Math.sign(c.z) * lz; c.vz *= -0.3 }
    }
    // into the water: no boats yet, so back to the last place you were safely on a road
    if (c.y < -0.6) { place(safe.current.x, safe.current.z, safe.current.yaw); c = car.current }
    safeT.current -= frameDt
    if (safeT.current <= 0) {
      safeT.current = 0.5
      if (!c.airborne && nearestRoad(R, c.x, c.z).d < 3 && Math.hypot(c.vx, c.vz) > 2) safe.current = { x: c.x, z: c.z, yaw: c.yaw }
    }
    focus.current.set(c.x, c.y, c.z)

    const g = model.current
    const { fwd, lat } = bodySpeeds(c)
    if (g) {
      const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw)
      let pitch = 0, roll = 0
      if (!c.airborne) {
        pitch = Math.atan2(R.heightAt(c.x + fx * 1.3, c.z + fz * 1.3) - R.heightAt(c.x - fx * 1.3, c.z - fz * 1.3), 2.6)
        roll = Math.atan2(R.heightAt(c.x + rx * 0.9, c.z + rz * 0.9) - R.heightAt(c.x - rx * 0.9, c.z - rz * 0.9), 1.8)
      } else pitch = Math.atan2(c.vy, Math.max(4, Math.hypot(c.vx, c.vz))) * 0.6
      const lean = Math.max(-0.07, Math.min(0.07, c.yawRate * fwd * 0.006))
      g.position.set(c.x, c.y, c.z)
      g.rotation.set(pitch, c.yaw, 0, 'YXZ')
      const body = g.getObjectByName('body')
      if (body) body.rotation.z = -roll + lean
      g.userData.wheelAngle = c.wheelAngle
    }
    steerVis.current = c.steer

    const cam = camera as THREE.PerspectiveCamera
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw)
    shake.current = Math.max(shake.current * Math.exp(-frameDt * 9), Math.min(1, c.landed / 12))
    const sk = shake.current * 0.18
    if (camMode.current === 'chase') {
      const sp = Math.hypot(c.vx, c.vz)
      const tx = sp > 3 ? c.vx / sp : fx, tz = sp > 3 ? c.vz / sp : fz
      const bx = fx * 0.65 + tx * 0.35, bz = fz * 0.65 + tz * 0.35, bl = Math.hypot(bx, bz) || 1
      const shape = chaseShape(Math.abs(fwd) / tuneRef.current.top)
      const back = shape.back
      const want = new THREE.Vector3(c.x - (bx / bl) * back, c.y + shape.height, c.z - (bz / bl) * back)
      want.y = Math.max(want.y, R.heightAt(want.x, want.z) + 1.4)
      camPos.lerp(want, 1 - Math.exp(-frameDt * 7))
      camPos.y = Math.max(camPos.y, R.heightAt(camPos.x, camPos.z) + 1.0)
      const [rx2, ry2] = speedRumble(Math.abs(fwd) / tuneRef.current.top, performance.now() / 1000)
      cam.position.set(camPos.x + (Math.random() - 0.5) * sk + rx2, camPos.y + (Math.random() - 0.5) * sk + ry2, camPos.z)
      look.set(c.x + fx * 4, c.y + 1.0, c.z + fz * 4)
      cam.lookAt(look)
    } else {
      cam.position.set(c.x + fx * 0.4, c.y + 1.25, c.z + fz * 0.4)
      look.set(c.x + fx * 20, c.y + 1.0, c.z + fz * 20)
      cam.lookAt(look)
    }
    const fov = chaseShape(Math.abs(fwd) / tuneRef.current.top).fov
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, frameDt * 5); cam.updateProjectionMatrix() }

    hudT.current -= frameDt
    if (hudT.current <= 0) {
      hudT.current = 0.12
      let near: string | null = null, nd = 260
      for (const p of R.meta.places) { const d = Math.hypot(p.x - c.x, p.z - c.z); if (p.name && d < nd) { nd = d; near = p.name } }
      const nr = nearestRoad(R, c.x, c.z)
      onHud({ mph: Math.hypot(fwd, lat) * 2.23694, frac: Math.abs(fwd) / tuneRef.current.top, drift: c.drift || (slipAngle(c) > 0.26 && !c.airborne), air: c.airborne ? c.airT : 0, gearR: fwd < -0.5,
        place: near, road: nr.d < (nr.road?.width ?? 7) / 2 + 1 ? nr.road!.kind : null })
    }
  })

  return (
    <>
      <DarterModel car={model} steer={steerVis} />
      <DriftFx car={car} ground={R.heightAt} slip={() => slipAngle(car.current)} />
    </>
  )
}

// grip by surface (1 = paved). Build numbers, Alex tunes them; the tiers themselves are canon (transportation.md).
const SURFACE: Record<RegionRoad['kind'] | 'off', number> = { paved: 1, road: 0.93, pass: 0.88, trail: 0.84, off: 0.75 }

const ROAD_LABEL: Record<string, string> = { paved: 'Paved road', road: 'Road', trail: 'Trail', pass: 'Mountain pass' }

export default function ContinentRide() {
  const { build, setBuild, tune } = useCourserBuild()
  const tuneRef = useRef<CourserTune>(tune)
  tuneRef.current = tune
  const [garage, setGarage] = useState(false)
  useEffect(() => {
    const g = (e: KeyboardEvent) => { if (e.code === 'KeyG') setGarage(v => !v) }
    window.addEventListener('keydown', g)
    return () => window.removeEventListener('keydown', g)
  }, [])
  const [R, setR] = useState<Region | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [hud, setHud] = useState<RideHud>({ mph: 0, frac: 0, drift: false, air: 0, gearR: false, place: null, road: null })
  const [started, setStarted] = useState(false)
  const focus = useRef(new THREE.Vector3())
  useEffect(() => {
    const name = new URLSearchParams(window.location.search).get('region') ?? 'corridor'
    loadRegion(name).then(setR).catch(e => setErr(String(e)))
    const go = () => setStarted(true)
    window.addEventListener('keydown', go, { once: true })
    return () => window.removeEventListener('keydown', go)
  }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#a9c6d6' }}>
      {R && (
        <Canvas camera={{ fov: FOV, near: 0.1, far: 2500 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
          <VoxelDayNight />
          <FogRig />
          <Terrain R={R} focus={focus} />
          <Roads R={R} />
          <Water R={R} />
          <Towns R={R} />
          <Posts R={R} />
          <Trees R={R} />
          <Driver R={R} onHud={setHud} focus={focus} tuneRef={tuneRef} />
        </Canvas>
      )}
      <SpeedStreaks frac={hud.frac} />
      <GaragePanel open={garage} onClose={() => setGarage(false)} build={build} setBuild={setBuild} />
      {!R && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#1d2a33', font: '600 14px system-ui' }}>{err ?? 'Loading the continent…'}</div>}

      {hud.place && (
        <div style={{ position: 'absolute', left: '50%', top: '9%', transform: 'translateX(-50%)', textAlign: 'center', color: '#fff8e6', pointerEvents: 'none', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
          <div style={{ font: '600 11px var(--font-game), system-ui', letterSpacing: '0.4em', opacity: 0.8 }}>APPROACHING</div>
          <div style={{ font: '600 34px var(--font-display), Georgia, serif', letterSpacing: '0.06em' }}>{hud.place}</div>
        </div>
      )}
      <div style={{ position: 'absolute', right: 20, bottom: 18, textAlign: 'right', color: '#f4efe2', pointerEvents: 'none', textShadow: '0 2px 8px rgba(0,0,0,0.55)' }}>
        <div style={{ font: '700 54px var(--font-game), system-ui', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{Math.round(hud.mph)}</div>
        <div style={{ font: '600 11px var(--font-game), system-ui', letterSpacing: '0.25em', opacity: 0.75 }}>MPH {hud.gearR ? '· R' : ''}</div>
        <div style={{ font: '600 10px var(--font-game), system-ui', letterSpacing: '0.25em', opacity: 0.65, marginTop: 4 }}>{hud.road ? ROAD_LABEL[hud.road].toUpperCase() : 'OFF ROAD'}</div>
      </div>
      {(hud.drift || hud.air > 0.25) && (
        <div style={{ position: 'absolute', left: '50%', top: '24%', transform: 'translateX(-50%)', font: '700 15px var(--font-game), system-ui', letterSpacing: '0.35em', color: '#d4a843', textShadow: '0 2px 10px rgba(0,0,0,0.6)', pointerEvents: 'none' }}>
          {hud.air > 0.25 ? `AIR ${hud.air.toFixed(1)}s` : 'DRIFT'}
        </div>
      )}
      <div style={{ position: 'absolute', left: 12, top: 12, padding: '5px 9px', borderRadius: 6, background: 'rgba(12,16,20,0.5)', color: '#e8eef2', font: '600 11px var(--font-game), system-ui', letterSpacing: '0.2em', pointerEvents: 'none' }}>
        ATHERNYX · ASHFELD TO RUNE HOLD
      </div>
      {R && !started && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ padding: '18px 24px', borderRadius: 10, background: 'rgba(12,16,20,0.72)', color: '#eef3f6', font: '14px system-ui, sans-serif', lineHeight: 1.65, textAlign: 'center', maxWidth: 460 }}>
            <div style={{ font: '600 13px system-ui', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>The Darter · Ashfeld</div>
            You start on the road out of Ashfeld. It runs down to Millbrook on the river; the trunk south ends at Rune Hold under the Spine.
            <div style={{ marginTop: 8 }}>W / ↑ throttle · S / ↓ brake · A D steer · Space handbrake · C camera · R back to the road · G garage</div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>Press any key to drive</div>
          </div>
        </div>
      )}
    </div>
  )
}
