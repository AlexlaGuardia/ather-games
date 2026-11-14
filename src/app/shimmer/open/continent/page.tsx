'use client'

// /shimmer/open/continent — the Darter on REAL ground: a region of the Athernyx continent (OPEN_WORLD_PLAN.md › P4/P5).
// The land is the painted map made terrain (tools/worldmap/derive_height.py); the roads are the Atlas's, edited in
// akatskii /canon World and cut into the ground by export_region.py; the handling is open/courser.ts. First region:
// the Ashfeld → Millbrook → Rune Hold corridor, 2.0 × 2.9 km.
//
// Terrain streams as CHUNKS whose detail follows distance (5 m near, 10 m, 20 m far), with skirts so LOD seams never
// show sky. Houses and trees are placeholder geometry: towns read as towns, nothing more is claimed.
// Desktop only for now (keys). ?region=<name> picks another exported region.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelDayNight } from '../../voxel3d/day-night'
import { createCourser, tickCourser, bodySpeeds, slipAngle, type Courser, type CourserInput, type CourserTune } from '../courser'
import { GaragePanel, useCourserBuild } from '../garage'
import { BoardPanel, TradeHud, useLedger } from '../trade-ui'
import { postBoard, accept, arrive, abandon, buy, GOODS, CAPACITY, type Contract, type Supply } from '../trade'
import { DARTER_STOCK, tuneFromSpec } from '../courser'
import { buildSpec, type Slot, type Tier } from '../courser-build'
import { DarterModel, DriftFx, RoadPosts, SpeedStreaks, chaseShape, speedRumble } from '../darter-view'
import { TUNNEL_H, TUNNEL_WALK, tunnelWall, bridgeRail, drivable, ferryLanding, guardrails, loadRegion, roadRail, nearPad, nearestRoad, roadside, routeBetween, type Region, type RegionJunction, type RegionRoad } from '../region'

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
  // a bore's mouth: the face of the hill crosses the portal opening, so the quads whose corners straddle floor..crown
  // inside the bore's footprint are left out (the portal's stone face covers the ragged edge)
  const bored = (R.meta.network?.tunnels?.length ?? 0) > 0
  const hole = (a: number, b: number) => {
    const x = (is[a] + is[a + 1]) / 2 * cell - sizeX / 2, z = (js[b] + js[b + 1]) / 2 * cell - sizeZ / 2
    const t = R.tunnelAt(x, z)
    if (!t) return false
    const ys = [R.vertex(is[a], js[b]), R.vertex(is[a + 1], js[b]), R.vertex(is[a], js[b + 1]), R.vertex(is[a + 1], js[b + 1])]
    return Math.max(...ys) > t.y + 0.4 && Math.min(...ys) < t.y + TUNNEL_H + 1.5
  }
  for (let b = 0; b < H - 1; b++) for (let a = 0; a < W - 1; a++) {
    const p00 = b * W + a, p10 = p00 + 1, p01 = p00 + W, p11 = p01 + 1
    if (bored && hole(a, b)) continue
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
    // junction pads paint themselves (Junctions): stop each ribbon at the pad's edge, and never across an island
    const pads = (R.meta.network?.junctions ?? []).filter(j => j.r > 0)
    const onPad = (x: number, z: number) => pads.some(j => Math.hypot(x - j.x, z - j.z) < j.r - 1.5)
    const surf = (x: number, z: number) => { const t = R.tunnelAt(x, z); return t && t.cover > 0.3 ? t.y : R.groundAt(x, z) }
    const widest = [...drivable(R)].sort((a, b) => b.width - a.width)
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
        // the highest surface: on a bridge that is the deck, not the river under it
        // ...and in a bore, its floor, not the mountain over it
        const Lp = [lx, surf(lx, lz) + 0.07, lz], Rp = [rx, surf(rx, rz) + 0.07, rz]
        // off the region's edge there is no ground (−∞): never let such a point into a quad, or the whole mesh's
        // bounds go NaN and three.js culls every road of that kind
        if (!Number.isFinite(Lp[1]) || !Number.isFinite(Rp[1])) { prevL = prevR = null; continue }
        if (onPad(x, z)) { prevL = prevR = null; continue }
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

// ── junctions: each pad painted in its top road's colour; a roundabout is a ring around a planted island with a
// kerb; a town square is pale paving. (Signs, paint and right of way are canon, asked of Magii 11-14: none yet.) ──
const SQUARE_COL = '#cfc6b2', ISLAND_COL = '#5d7a43', KERB_COL = '#ddd6c6'
function Junctions({ R }: { R: Region }) {
  const parts = useMemo(() => {
    const out: { key: string; g: THREE.BufferGeometry; col: string }[] = []
    const ring = (j: RegionJunction, r0: number, r1: number, lift: number) => {
      const seg = Math.max(24, Math.ceil(2 * Math.PI * r1 / 2)), rings = Math.max(1, Math.ceil((r1 - r0) / 2))
      const pos: number[] = []
      const P = (r: number, a: number) => { const x = j.x + Math.cos(a) * r, z = j.z + Math.sin(a) * r; return [x, R.heightAt(x, z) + lift, z] }
      for (let i = 0; i < rings; i++) for (let k = 0; k < seg; k++) {
        const ra = r0 + (r1 - r0) * i / rings, rb = r0 + (r1 - r0) * (i + 1) / rings
        const a0 = 2 * Math.PI * k / seg, a1 = 2 * Math.PI * (k + 1) / seg
        const A = P(ra, a0), B = P(rb, a0), C = P(rb, a1), D = P(ra, a1)
        if (![A, B, C, D].every(v => Number.isFinite(v[1]))) continue
        pos.push(...A, ...B, ...C, ...A, ...C, ...D)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.computeVertexNormals()
      return g
    }
    const roads = drivable(R)
    for (const j of R.meta.network?.junctions ?? []) {
      if (j.r <= 0) continue
      const top = j.arms.map(a => roads.find(r => r.id === a.edge)).filter(Boolean).sort((a, b) => b!.width - a!.width)[0]
      const col = j.kind === 'square' ? SQUARE_COL : ROAD_COL[top?.kind ?? 'road']
      if (j.island) {
        out.push({ key: `${j.id}-ring`, g: ring(j, j.island, j.r, 0.09), col })
        out.push({ key: `${j.id}-kerb`, g: ring(j, j.island - 0.6, j.island, 0.12), col: KERB_COL })
        out.push({ key: `${j.id}-island`, g: ring(j, 0, j.island - 0.6, 0.1), col: ISLAND_COL })
      } else out.push({ key: j.id, g: ring(j, 0, j.r, 0.09), col })
    }
    return out
  }, [R])
  return (
    <>
      {parts.map(({ key, g, col }) => (
        <mesh key={key} geometry={g}>
          <meshLambertMaterial color={col} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      ))}
    </>
  )
}

// ── bridges: the deck's stone body (the road ribbon is painted on top by Roads), parapets on both edges, and piers
// down to the riverbed every ~16 m where the deck stands clear of the ground ──
const STONE_COL = '#a39c8d', PARAPET_COL = '#c2baa8'
function Bridges({ R }: { R: Region }) {
  const geos = useMemo(() => {
    const body: number[] = [], para: number[] = []
    const quad = (out: number[], a: number[], b: number[], c: number[], d: number[]) => out.push(...a, ...b, ...c, ...a, ...c, ...d)
    const box = (out: number[], cx: number, cz: number, ux: number, uz: number, hl: number, hw: number, y0: number, y1: number) => {
      const vx = -uz, vz = ux
      const C = (sl: number, sw: number, y: number) => [cx + ux * hl * sl + vx * hw * sw, y, cz + uz * hl * sl + vz * hw * sw]
      const s = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
      for (let i = 0; i < 4; i++) { const [a, b] = [s[i], s[(i + 1) % 4]]; quad(out, C(a[0], a[1], y0), C(b[0], b[1], y0), C(b[0], b[1], y1), C(a[0], a[1], y1)) }
      quad(out, C(-1, -1, y1), C(1, -1, y1), C(1, 1, y1), C(-1, 1, y1))
    }
    for (const b of R.meta.network?.bridges ?? []) {
      const p = b.pts, hw = b.width / 2
      let acc = 0
      for (let k = 0; k < p.length - 1; k++) {
        const [ax, az, ay] = p[k], [bx, bz, by] = p[k + 1]
        const L = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux
        for (const side of [1, -1]) {
          const o = hw * side, o2 = (hw + 0.45) * side
          // the deck's face, 1.1 m deep, from the rail's outer edge down
          quad(body, [ax + nx * o2, ay + 0.05, az + nz * o2], [bx + nx * o2, by + 0.05, bz + nz * o2], [bx + nx * o2, by - 1.1, bz + nz * o2], [ax + nx * o2, ay - 1.1, az + nz * o2])
          // the parapet: inner face, top, outer face
          quad(para, [ax + nx * o, ay, az + nz * o], [bx + nx * o, by, bz + nz * o], [bx + nx * o, by + 0.75, bz + nz * o], [ax + nx * o, ay + 0.75, az + nz * o])
          quad(para, [ax + nx * o, ay + 0.75, az + nz * o], [bx + nx * o, by + 0.75, bz + nz * o], [bx + nx * o2, by + 0.75, bz + nz * o2], [ax + nx * o2, ay + 0.75, az + nz * o2])
          quad(para, [ax + nx * o2, ay + 0.75, az + nz * o2], [bx + nx * o2, by + 0.75, bz + nz * o2], [bx + nx * o2, by, bz + nz * o2], [ax + nx * o2, ay, az + nz * o2])
        }
        // the underside
        quad(body, [ax + nx * (hw + 0.45), ay - 1.1, az + nz * (hw + 0.45)], [bx + nx * (hw + 0.45), by - 1.1, bz + nz * (hw + 0.45)], [bx - nx * (hw + 0.45), by - 1.1, bz - nz * (hw + 0.45)], [ax - nx * (hw + 0.45), ay - 1.1, az - nz * (hw + 0.45)])
        acc += L
        if (acc >= 16 && k > 0 && k < p.length - 2) {
          const g = R.heightAt(ax, az)
          if (ay - g > 2.2) { box(body, ax, az, ux, uz, 1.2, hw * 0.8, Math.min(g, 0) - 2, ay - 1.1); acc = 0 }
        }
      }
    }
    return [body, para].map(pos => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g })
  }, [R])
  return (
    <>
      <mesh geometry={geos[0]}><meshLambertMaterial color={STONE_COL} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geos[1]}><meshLambertMaterial color={PARAPET_COL} side={THREE.DoubleSide} /></mesh>
    </>
  )
}

// ── tunnels: the bore's lining (walls springing into a round crown, dark worked stone), a mana lamp every 16 m
// alternating sides, and a stone PORTAL face at each mouth where the hill first stands a bore's height over the
// floor. The road ribbon is painted on the floor by Roads. ──
const BORE_COL = '#5b554b', PORTAL_COL = '#9a9282', LAMP_COL = '#9fe8d4'
function boreProfile(hw: number): [number, number][] {
  // (offset, height) round the lining, left wall foot → crown → right wall foot
  const spring = 4.2, rise = TUNNEL_H - spring, out: [number, number][] = [[-hw, -0.2], [-hw, spring]]
  for (let k = 1; k < 8; k++) { const a = Math.PI * k / 8; out.push([-Math.cos(a) * hw, spring + Math.sin(a) * rise]) }
  out.push([hw, spring], [hw, -0.2])
  return out
}
function Tunnels({ R }: { R: Region }) {
  const built = useMemo(() => {
    const lining: number[] = [], lamps: number[] = []
    const portals: { x: number; y: number; z: number; yaw: number; hw: number; top: number }[] = []
    const quad = (out: number[], a: number[], b: number[], c: number[], d: number[]) => out.push(...a, ...b, ...c, ...a, ...c, ...d)
    for (const t of R.meta.network?.tunnels ?? []) {
      const hw = t.width / 2 + TUNNEL_WALK, prof = boreProfile(hw)
      // densify to 2.5 m and read the cover at each station: the lining runs only where the hill is a roof
      const st: { x: number; z: number; y: number; ux: number; uz: number; cover: number }[] = []
      for (let k = 0; k < t.pts.length - 1; k++) {
        const [ax, az, ay] = t.pts[k], [bx, bz, by] = t.pts[k + 1]
        const L = Math.hypot(bx - ax, bz - az) || 1, n = Math.max(1, Math.round(L / 2.5))
        for (let i = 0; i < n; i++) {
          const f = i / n, x = ax + (bx - ax) * f, z = az + (bz - az) * f, y = ay + (by - ay) * f
          st.push({ x, z, y, ux: (bx - ax) / L, uz: (bz - az) / L, cover: R.heightAt(x, z) - y })
        }
      }
      let i0 = st.findIndex(q => q.cover >= TUNNEL_H), i1 = st.length - 1
      while (i1 > 0 && st[i1].cover < TUNNEL_H) i1--
      if (i0 < 0 || i1 <= i0) continue
      i0 = Math.max(0, i0 - 1); i1 = Math.min(st.length - 1, i1 + 1)       // tuck the lining a station into each face
      // offset o is measured to the LEFT of travel (−x of the direction's right hand): (uz, −ux) is the right normal
      const at = (q: typeof st[0], o: number, hgt: number) => [q.x + q.uz * o, q.y + hgt, q.z - q.ux * o]
      let lampAcc = 0, side = 1
      for (let k = i0; k < i1; k++) {
        const A = st[k], B = st[k + 1]
        for (let m = 0; m < prof.length - 1; m++) {
          const [o0, h0] = prof[m], [o1, h1] = prof[m + 1]
          quad(lining, at(A, o0, h0), at(B, o0, h0), at(B, o1, h1), at(A, o1, h1))
        }
        lampAcc += 2.5
        if (lampAcc >= 16) {
          lampAcc = 0; side = -side
          const o = side * (hw - 0.05), y0 = 3.4, y1 = 3.9
          const p = (dl: number, hh: number) => [A.x + A.ux * dl + A.uz * o, A.y + hh, A.z + A.uz * dl - A.ux * o]
          quad(lamps, p(-0.6, y0), p(0.6, y0), p(0.6, y1), p(-0.6, y1))
        }
      }
      for (const [q, dir] of [[st[i0], 1], [st[i1], -1]] as const) {
        // the face stands to whatever the hill does around it, capped so it never towers over the slope
        const top = Math.min(TUNNEL_H + 6, Math.max(TUNNEL_H + 2.5, q.cover))
        portals.push({ x: q.x, y: q.y, z: q.z, yaw: Math.atan2(-q.ux * dir, -q.uz * dir), hw, top })
      }
    }
    const mk = (pos: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g }
    // a portal: a stone slab with the bore's profile cut out of it, extruded 1.6 m back into the hill (local −z)
    const portalGeo = (hw: number, top: number) => {
      const wide = hw + 5, prof = boreProfile(hw)
      const sh = new THREE.Shape([new THREE.Vector2(-wide, -1.5), new THREE.Vector2(wide, -1.5), new THREE.Vector2(wide, top), new THREE.Vector2(-wide, top)])
      sh.holes.push(new THREE.Path(prof.map(([o, hh]) => new THREE.Vector2(o, hh))))
      const g = new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: false })
      g.translate(0, 0, -1.6)
      return g
    }
    return { lining: mk(lining), lamps: mk(lamps), portals: portals.map(p => ({ ...p, geo: portalGeo(p.hw, p.top) })) }
  }, [R])
  useEffect(() => () => { built.lining.dispose(); built.lamps.dispose(); for (const p of built.portals) p.geo.dispose() }, [built])
  return (
    <>
      <mesh geometry={built.lining}><meshLambertMaterial color={BORE_COL} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={built.lamps}><meshBasicMaterial color={LAMP_COL} side={THREE.DoubleSide} /></mesh>
      {built.portals.map((p, i) => (
        <mesh key={i} geometry={p.geo} position={[p.x, p.y, p.z]} rotation={[0, p.yaw, 0]}>
          <meshLambertMaterial color={PORTAL_COL} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  )
}

// ── waystones (rune-cut, one per km) and fingerposts (carved arms, runes that glow faintly after dark) ──
const WAYSTONE_COL = '#8f8a80', POST_COL = '#6b4f33', RUNE_COL = '#9fe8d4'
function Roadside({ R }: { R: Region }) {
  const { waystones, fingerposts } = useMemo(() => roadside(R), [R])
  return (
    <>
      {waystones.map((w, i) => (
        <group key={`w${i}`} position={[w.x, w.y, w.z]} rotation={[0, w.yaw, 0]}>
          <mesh position={[0, 0.7, 0]}><boxGeometry args={[0.32, 1.4, 0.55]} /><meshLambertMaterial color={WAYSTONE_COL} /></mesh>
          <mesh position={[0, 1.42, 0]}><boxGeometry args={[0.36, 0.08, 0.6]} /><meshLambertMaterial color={WAYSTONE_COL} /></mesh>
          {[1, -1].map(sd => (
            <mesh key={sd} position={[0.17 * sd, 1.0, 0]}><boxGeometry args={[0.02, 0.32, 0.22]} /><meshBasicMaterial color={RUNE_COL} transparent opacity={0.85} /></mesh>
          ))}
        </group>
      ))}
      {fingerposts.map(f => (
        <group key={f.junction} position={[f.x, f.y, f.z]}>
          <mesh position={[0, 1.4, 0]}><boxGeometry args={[0.16, 2.8, 0.16]} /><meshLambertMaterial color={POST_COL} /></mesh>
          {f.arms.map((a, k) => (
            // an arm points down its road: world angle atan2(z, x) → a y-rotation of −ang
            <group key={k} position={[0, 2.5 - k * 0.24, 0]} rotation={[0, -a.ang, 0]}>
              <mesh position={[0.55, 0, 0]}><boxGeometry args={[1.0, 0.18, 0.05]} /><meshLambertMaterial color={POST_COL} /></mesh>
              <mesh position={[0.95, 0, 0]}><boxGeometry args={[0.1, 0.1, 0.07]} /><meshBasicMaterial color={RUNE_COL} transparent opacity={0.8} /></mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  )
}

// ── guardrails: timber rails on posts every 4 m where the land falls away beside the road ──
const RAIL_COL = '#7a5d40'
function Guardrails({ R }: { R: Region }) {
  const geo = useMemo(() => {
    const pos: number[] = []
    const quad = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d)
    for (const g of guardrails(R)) {
      let acc = 4
      for (let k = 0; k < g.pts.length - 1; k++) {
        const [ax, az, ay] = g.pts[k], [bx, bz, by] = g.pts[k + 1]
        const L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L * 0.06, nz = (bx - ax) / L * 0.06
        // the rail: a plank 0.28 m tall, its top at 0.85 m
        for (const s of [1, -1]) quad([ax + nx * s, ay + 0.57, az + nz * s], [bx + nx * s, by + 0.57, bz + nz * s], [bx + nx * s, by + 0.85, bz + nz * s], [ax + nx * s, ay + 0.85, az + nz * s])
        quad([ax + nx, ay + 0.85, az + nz], [bx + nx, by + 0.85, bz + nz], [bx - nx, by + 0.85, bz - nz], [ax - nx, ay + 0.85, az - nz])
        for (let s = 0; s < L; s += 0.5) {
          acc += 0.5
          if (acc < 4) continue
          acc = 0
          const t = s / L, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = R.groundAt(x, z)
          const ux = (bx - ax) / L * 0.09, uz = (bz - az) / L * 0.09, vx = nx * 1.5, vz = nz * 1.5
          const C = (su: number, sv: number, yy: number) => [x + ux * su + vx * sv, yy, z + uz * su + vz * sv]
          const sq = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
          for (let i = 0; i < 4; i++) { const [p, q] = [sq[i], sq[(i + 1) % 4]]; quad(C(p[0], p[1], y - 0.3), C(q[0], q[1], y - 0.3), C(q[0], q[1], y + 0.95), C(p[0], p[1], y + 0.95)) }
        }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.computeVertexNormals()
    return g
  }, [R])
  return <mesh geometry={geo}><meshLambertMaterial color={RAIL_COL} side={THREE.DoubleSide} /></mesh>
}

// ── roadside posts every 25 m on both edges of every road (one row where trunks share; none in water) ──
function Posts({ R }: { R: Region }) {
  const posts = useMemo(() => {
    const out: [number, number][] = []
    const taken = new Set<string>()
    const key = (x: number, z: number) => `${Math.round(x / 8)},${Math.round(z / 8)}`
    for (const r of [...drivable(R)].sort((a, b) => b.width - a.width)) {
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
            const under = nearestRoad(R, px, pz)
            if (under.d < r.width / 2 + 0.5 || under.junction) continue     // inside another road's surface, or a junction
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
        if (nearestRoad(R, x, z).d < 9 || nearPad(R, x, z, 5)) continue
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

// ── trees: a seeded scatter over grass, off the roads, away from the towns' middles, STREAMED in 256 m blocks
// around the car. (The corridor-era scan ran from the north-west corner and stopped at 7000: on the continent every
// tree would have stood in the top rows.) A block is generated once, cached, and joins the instanced set while it is
// within sight. Same seeded scatter as before, so the corridor's woods did not move. ──
const TREE_BLOCK = 256, TREE_MAX = 14000
function treeBlock(R: Region, bi: number, bj: number) {
  const out: { x: number; y: number; z: number; s: number }[] = []
  const { sizeX, sizeZ } = R.meta
  const x0 = -sizeX / 2 + 6, z0 = -sizeZ / 2 + 6
  // the same 14 m lattice the corridor used, clipped to this block
  const gxa = x0 + Math.ceil((bi * TREE_BLOCK - x0) / 14) * 14, gza = z0 + Math.ceil((bj * TREE_BLOCK - z0) / 14) * 14
  for (let gz = gza; gz < (bj + 1) * TREE_BLOCK && gz < sizeZ / 2 - 6; gz += 14) for (let gx = gxa; gx < (bi + 1) * TREE_BLOCK && gx < sizeX / 2 - 6; gx += 14) {
    const i = Math.round(gx), j = Math.round(gz)
    const wood = hash(Math.floor(gx / 90), Math.floor(gz / 90))
    if (hash(i, j) > (wood > 0.55 ? 0.6 : 0.08)) continue
    const x = gx + (hash(j, i) - 0.5) * 12, z = gz + (hash(i + 3, j) - 0.5) * 12, y = R.heightAt(x, z)
    if (!Number.isFinite(y) || y < 2 || y > 230) continue
    if (Math.abs(R.heightAt(x + 4, z) - R.heightAt(x - 4, z)) > 5) continue
    if ((nearestRoad(R, x, z).d < 9 && !((R.tunnelAt(x, z)?.cover ?? 0) > TUNNEL_H + 4)) || nearPad(R, x, z, 5)) continue
    if (R.meta.places.some(p => Math.hypot(p.x - x, p.z - z) < 40)) continue
    out.push({ x, y, z, s: 0.8 + hash(i, j + 9) * 0.7 })
  }
  return out
}
function Trees({ R, focus }: { R: Region; focus: React.MutableRefObject<THREE.Vector3> }) {
  const trunk = useRef<THREE.InstancedMesh>(null), crown = useRef<THREE.InstancedMesh>(null)
  const cache = useRef(new Map<string, ReturnType<typeof treeBlock>>())
  const shown = useRef('')
  const t = useRef(0)
  // make the colour attribute exist before the first draw, or the shader compiles without instance colours
  useEffect(() => { crown.current?.setColorAt(0, new THREE.Color('#4a7536')) }, [])
  useFrame((_, dt) => {
    t.current -= dt
    if (t.current > 0 || !trunk.current || !crown.current) return
    t.current = 0.5
    const f = focus.current, bi0 = Math.floor(f.x / TREE_BLOCK), bj0 = Math.floor(f.z / TREE_BLOCK)
    const reach = Math.ceil((FOG_FAR + 150) / TREE_BLOCK)
    const want: { key: string; bi: number; bj: number; d: number }[] = []
    for (let bj = bj0 - reach; bj <= bj0 + reach; bj++) for (let bi = bi0 - reach; bi <= bi0 + reach; bi++) {
      const cx = (bi + 0.5) * TREE_BLOCK, cz = (bj + 0.5) * TREE_BLOCK
      if (Math.abs(cx) > R.meta.sizeX / 2 + TREE_BLOCK || Math.abs(cz) > R.meta.sizeZ / 2 + TREE_BLOCK) continue
      const d = Math.hypot(cx - f.x, cz - f.z)
      if (d < FOG_FAR + 150) want.push({ key: `${bi},${bj}`, bi, bj, d })
    }
    want.sort((a, b) => a.d - b.d)
    const sig = want.map(w => w.key).join('|')
    if (sig === shown.current) return
    // generate at most a few new blocks per pass so a fresh load never hitches a whole frame
    let made = 0
    for (const w of want) if (!cache.current.has(w.key)) { if (made++ >= 6) break; cache.current.set(w.key, treeBlock(R, w.bi, w.bj)) }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color()
    let n = 0, complete = true
    for (const w of want) {
      const blk = cache.current.get(w.key)
      if (!blk) { complete = false; continue }
      for (const tr of blk) {
        if (n >= TREE_MAX) break
        p.set(tr.x, tr.y + 1.4 * tr.s, tr.z); sc.set(tr.s, 2.8 * tr.s, tr.s); trunk.current.setMatrixAt(n, m.compose(p, q, sc))
        p.set(tr.x, tr.y + 5.2 * tr.s, tr.z); sc.set(tr.s * 1.1, 6.5 * tr.s, tr.s * 1.1); crown.current.setMatrixAt(n, m.compose(p, q, sc))
        const hk = Math.round(tr.x * 7 + tr.z * 13)
        crown.current.setColorAt(n, col.set('#4a7536').offsetHSL((hash(hk, 4) - 0.5) * 0.05, 0, (hash(hk, 5) - 0.5) * 0.12))
        n++
      }
    }
    trunk.current.count = crown.current.count = n
    for (const r of [trunk, crown]) { r.current!.instanceMatrix.needsUpdate = true; if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true }
    if (complete) shown.current = sig
    else t.current = 0.05          // more blocks to make: come back next frame
    // forget blocks far behind
    if (cache.current.size > 400) for (const k of cache.current.keys()) {
      const [bi, bj] = k.split(',').map(Number)
      if (Math.hypot((bi + 0.5) * TREE_BLOCK - f.x, (bj + 0.5) * TREE_BLOCK - f.z) > FOG_FAR * 2.5) cache.current.delete(k)
    }
  })
  return (
    <>
      <instancedMesh frustumCulled={false} ref={trunk} args={[undefined, undefined, TREE_MAX]} count={0}><cylinderGeometry args={[0.2, 0.3, 1, 5]} /><meshLambertMaterial color="#5e4630" flatShading /></instancedMesh>
      <instancedMesh frustumCulled={false} ref={crown} args={[undefined, undefined, TREE_MAX]} count={0}><coneGeometry args={[1.9, 1, 6]} /><meshLambertMaterial flatShading /></instancedMesh>
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

export interface RideHud { x: number; z: number; yaw: number; mph: number; frac: number; drift: boolean; air: number; gearR: boolean; place: string | null; road: string | null; sign: string | null }

function Driver({ R, onHud, focus, tuneRef, ctl }: { R: Region; onHud: (h: RideHud) => void; focus: React.MutableRefObject<THREE.Vector3>; tuneRef: React.MutableRefObject<CourserTune>; ctl: React.MutableRefObject<{ tp?: (x: number, z: number, yaw: number) => void }> }) {
  const { camera, gl } = useThree()
  const spawn = useMemo(() => {
    const road = R.meta.roads.find(r => r.from === 'ashfeld' && r.to === 'millbrook') ?? R.meta.roads[0]
    const [ax, az] = road.pts[1], [bx, bz] = road.pts[3]
    return { x: ax, z: az, yaw: Math.atan2(-(bx - ax), -(bz - az)) }
  }, [R])
  const car = useRef<Courser>(createCourser(spawn.x, spawn.z, spawn.yaw, R.groundAt))
  const model = useRef<THREE.Group | null>(null)
  const steerVis = useRef(0)
  const keys = useRef(new Set<string>())
  const scripted = useRef<Partial<CourserInput> | null>(null)
  const acc = useRef(0), hudT = useRef(0), safeT = useRef(0)
  const safe = useRef({ ...spawn })
  const camMode = useRef<'chase' | 'hood'>('chase')
  const camPos = useMemo(() => new THREE.Vector3(spawn.x, R.heightAt(spawn.x, spawn.z) + 4, spawn.z + 8), [R, spawn])
  const signs = useMemo(() => roadside(R), [R])
  const look = useMemo(() => new THREE.Vector3(), [])
  const shake = useRef(0)

  ctl.current.tp = (x: number, z: number, yaw: number) => place(x, z, yaw)
  const place = (x: number, z: number, yaw: number, speed = 0) => {
    const c = createCourser(x, z, yaw, R.groundAt); c.vx = -Math.sin(yaw) * speed; c.vz = -Math.cos(yaw) * speed
    car.current = c; camPos.set(x + Math.sin(yaw) * 8, R.groundAt(x, z) + 3, z + Math.cos(yaw) * 8)
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
      // the ground the car is ON: told its own height, so under a hill it drives the bore's floor, not the summit
      const cc = c
      tickCourser(c, { throttle, steer, handbrake, dt: STEP, surface }, (x, z) => R.groundAt(x, z, cc.y), tuneRef.current)
      tunnelWall(R, c) || bridgeRail(R, c) || roadRail(R, c)
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
        const g = (x: number, z: number) => R.groundAt(x, z, c.y)     // the surface the car is ON (a deck, not the river)
        pitch = Math.atan2(g(c.x + fx * 1.3, c.z + fz * 1.3) - g(c.x - fx * 1.3, c.z - fz * 1.3), 2.6)
        roll = Math.atan2(g(c.x + rx * 0.9, c.z + rz * 0.9) - g(c.x - rx * 0.9, c.z - rz * 0.9), 1.8)
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
      // in a bore the camera stays under the crown (above it is the inside of the mountain) and reads the floor
      const tb = R.tunnelAt(c.x, c.z), bored = !!tb && tb.cover > TUNNEL_H * 0.6 && c.y < tb.y + TUNNEL_H
      if (bored) want.y = Math.min(want.y, tb!.y + TUNNEL_H - 2.2)
      want.y = Math.max(want.y, R.groundAt(want.x, want.z, c.y) + 1.4)
      camPos.lerp(want, 1 - Math.exp(-frameDt * (bored ? 12 : 7)))
      const tc = R.tunnelAt(camPos.x, camPos.z)
      if (tc && tc.cover > 2 && Math.abs(c.y - tc.y) < TUNNEL_H) camPos.y = Math.min(camPos.y, tc.y + TUNNEL_H - 1.6)
      camPos.y = Math.max(camPos.y, R.groundAt(camPos.x, camPos.z, c.y) + 1.0)
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
      // a carving in reach reads out: the waystone's two faces, or the fingerpost's arms
      let sign: string | null = null
      for (const w of signs.waystones) if (Math.hypot(w.x - c.x, w.z - c.z) < 18) sign = 'Waystone · ' + w.faces.map(f => `${f.name} ${f.km} km`).join(' · ')
      for (const f of signs.fingerposts) if (Math.hypot(f.x - c.x, f.z - c.z) < 26) sign = f.arms.map(a => `${a.name} ${a.km} km`).join(' · ')
      onHud({ x: c.x, z: c.z, yaw: c.yaw, mph: Math.hypot(fwd, lat) * 2.23694, frac: Math.abs(fwd) / tuneRef.current.top, drift: c.drift || (slipAngle(c) > 0.26 && !c.airborne), air: c.airborne ? c.airT : 0, gearR: fwd < -0.5,
        sign, place: near, road: nr.junction && JUNCTION_LABEL[nr.junction.kind] ? `j:${nr.junction.kind}` : nr.d < (nr.road?.width ?? 7) / 2 + 1 ? nr.road!.kind : null })
    }
  })

  return (
    <>
      <DarterModel car={model} steer={steerVis} />
      <DriftFx car={car} ground={(x, z) => R.groundAt(x, z, car.current.y)} slip={() => slipAngle(car.current)} />
    </>
  )
}

// grip by surface (1 = paved). Build numbers, Alex tunes them; the tiers themselves are canon (transportation.md).
const SURFACE: Record<RegionRoad['kind'] | 'off', number> = { paved: 1, road: 0.93, pass: 0.88, trail: 0.84, off: 0.75 }

// ── trade v1 in the corridor (ECONOMY.md). Placement is build: Rune Hold's square is the gate-landing, so the
// Ather's goods (and the Spine's ore and gold) are had there; Millbrook on the water has timber and sea Rinn;
// Ashfeld's fields have grain. Contract pay is by ROAD distance through the network (routeBetween); straight
// distance × ROAD_FACTOR is only the fallback when two towns are not connected. ──
const SUPPLY: Supply[] = [
  { place: 'rune-hold', goods: ['crystal', 'sap', 'cord', 'ore', 'gold'] },
  { place: 'millbrook', goods: ['timber', 'searinn'] },
  { place: 'ashfeld', goods: ['grain'] },
]
const TOWNS = ['ashfeld', 'millbrook', 'rune-hold', 'passage']
const ROAD_FACTOR = 1.3
const FERRY_FARE = 8

const JUNCTION_LABEL: Record<string, string> = { square: 'Town square', roundabout: 'Roundabout', cross: 'Crossroads', stop4: 'Four-way', tee: 'Junction', merge: 'Junction' }
const ROAD_LABEL: Record<string, string> = { paved: 'Paved road', road: 'Road', trail: 'Trail', pass: 'Mountain pass',
  ...Object.fromEntries(Object.entries(JUNCTION_LABEL).map(([k, v]) => [`j:${k}`, v])) }

export default function ContinentRide() {
  const [R, setR] = useState<Region | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [hud, setHud] = useState<RideHud>({ x: 0, z: 0, yaw: 0, mph: 0, frac: 0, drift: false, air: 0, gearR: false, place: null, road: null, sign: null })
  const { build, setBuild } = useCourserBuild()
  const [ledger, setLedger] = useLedger()
  // the continent's garage is REAL: a part you have not bought does not fit, whatever the test track remembers
  const eff = useMemo(() => ({ ...build, core: Math.min(build.core, ledger.owned.core) as Tier, trim: Math.min(build.trim, ledger.owned.trim) as Tier, rune: Math.min(build.rune, ledger.owned.rune) as Tier }), [build, ledger.owned])
  const tune = useMemo(() => tuneFromSpec(buildSpec(DARTER_STOCK, eff)), [eff])
  const tuneRef = useRef<CourserTune>(tune)
  tuneRef.current = tune
  const [board, setBoard] = useState<string | null>(null)
  const [boardMsg, setBoardMsg] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(v => (v === t ? null : v)), 3200) }
  // the town you are stopped at (within 45 m), if any
  const atTown = useMemo(() => {
    if (!R || hud.mph > 4) return null
    let best: { id: string; d: number } | null = null
    for (const t of TOWNS) { const p = R.meta.places.find(q => q.id === t); if (!p) continue; const d = Math.hypot(p.x - hud.x, p.z - hud.z); if (d < 45 && (!best || d < best.d)) best = { id: t, d } }
    return best?.id ?? null
  }, [R, hud.x, hud.z, hud.mph])
  const placeName = (id: string) => R?.meta.places.find(p => p.id === id)?.name ?? id
  const kmBetween = useMemo(() => {
    const cache = new Map<string, number>()
    return (a: string, b: string) => {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`
      if (!cache.has(key)) {
        const pa = R?.meta.places.find(p => p.id === a), pb = R?.meta.places.find(p => p.id === b)
        const road = R ? routeBetween(R, a, b) : null
        cache.set(key, road ? road.length / 1000 : pa && pb ? Math.hypot(pa.x - pb.x, pa.z - pb.z) * ROAD_FACTOR / 1000 : Infinity)
      }
      return cache.get(key)!
    }
  }, [R])
  const contracts: Contract[] = useMemo(() => (board ? postBoard(board, SUPPLY, TOWNS.filter(t => R?.meta.places.some(p => p.id === t)), kmBetween, ledger.deeds + 1, CAPACITY.darter) : []), [board, R, kmBetween, ledger.deeds])
  // arriving: stopped at the contract's pickup loads it, at its drop pays it
  useEffect(() => {
    if (!atTown || !ledger.active) return
    const r = arrive(ledger, atTown, performance.now() / 1000)
    if (!r.event) return
    setLedger(r.ledger)
    if (r.event.kind === 'loaded') flash(`Loaded ${ledger.active.qty} ${GOODS[ledger.active.good].name}`)
    else flash(`Delivered · +${r.event.marks} Marks · +${r.event.deeds} deed${r.event.spoiled > 0.05 ? ` (${Math.round(r.event.spoiled * 100)}% spoiled)` : ''}`)
  }, [atTown, ledger, setLedger])
  const objective = useMemo(() => {
    const a = ledger.active; if (!a || !R) return null
    const target = R.meta.places.find(p => p.id === (a.loaded ? a.to : a.from)); if (!target) return null
    const bearing = Math.atan2(-(target.x - hud.x), -(target.z - hud.z))
    let d = bearing - hud.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI
    return { text: a.loaded ? `Deliver ${a.qty} ${GOODS[a.good].name} to ${placeName(a.to)}` : `Load ${a.qty} ${GOODS[a.good].name} at ${placeName(a.from)}`,
      km: Math.hypot(target.x - hud.x, target.z - hud.z) / 1000, turn: -d }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger.active, R, hud.x, hud.z, hud.yaw])
  // ── SHELLBACK FERRIES (canon: Shellbacks pull ferries across rivers). Stop at a landing, E, pay the fare, and the
  // ferry carries you to the far landing. The crossing itself is a fade for now: the ferry's look is a brief for later.
  const ctl = useRef<{ tp?: (x: number, z: number, yaw: number) => void }>({})
  const [ferrying, setFerrying] = useState(false)
  const ferryAt = useMemo(() => (R && hud.mph < 4 ? ferryLanding(R, hud.x, hud.z, 14) : null), [R, hud.x, hud.z, hud.mph])
  const ferryRef = useRef(ferryAt); ferryRef.current = ferryAt
  const ledgerRef = useRef(ledger); ledgerRef.current = ledger
  const takeFerry = useCallback(() => {
    const f = ferryRef.current; if (!f || ferrying) return
    if (ledgerRef.current.marks < FERRY_FARE) { flash(`The ferry is ${FERRY_FARE} Marks`); return }
    setLedger({ ...ledgerRef.current, marks: ledgerRef.current.marks - FERRY_FARE })
    setFerrying(true)
    const dx = f.to[0] - f.from[0], dz = f.to[1] - f.from[1], L = Math.hypot(dx, dz) || 1
    setTimeout(() => {
      // roll off on the far side, facing on across (away from the water), a few metres up the quay
      ctl.current.tp?.(f.to[0] + dx / L * 6, f.to[1] + dz / L * 6, Math.atan2(-dx, -dz))
      setTimeout(() => setFerrying(false), 500)
    }, 1300)
    flash(`Shellback ferry · −${FERRY_FARE} Marks`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ferrying])
  useEffect(() => {
    const e = (ev: KeyboardEvent) => {
      if (ev.code !== 'KeyE') return
      if (ferryRef.current) { takeFerry(); return }
      setBoard(b => (b ? null : atTownRef.current && SUPPLY.some(s => s.place === atTownRef.current) ? atTownRef.current : null))
      setBoardMsg(null)
    }
    window.addEventListener('keydown', e); return () => window.removeEventListener('keydown', e)
  }, [takeFerry])
  const atTownRef = useRef<string | null>(null)
  atTownRef.current = atTown
  // the board stays open until you actually drive away (> 60 m), not on the first nudge of the throttle
  useEffect(() => {
    if (!board || !R) return
    const p = R.meta.places.find(q => q.id === board)
    if (!p || Math.hypot(p.x - hud.x, p.z - hud.z) > 60) setBoard(null)
  }, [board, R, hud.x, hud.z])
  const [garage, setGarage] = useState(false)
  useEffect(() => {
    const g = (e: KeyboardEvent) => { if (e.code === 'KeyG') setGarage(v => !v) }
    window.addEventListener('keydown', g)
    return () => window.removeEventListener('keydown', g)
  }, [])
  const [started, setStarted] = useState(false)
  const focus = useRef(new THREE.Vector3())
  useEffect(() => {
    const name = new URLSearchParams(window.location.search).get('region') ?? 'continent'
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
          <Junctions R={R} />
          <Bridges R={R} />
          <Tunnels R={R} />
          <Guardrails R={R} />
          <Water R={R} />
          <Towns R={R} />
          <Posts R={R} />
          <Roadside R={R} />
          <Trees R={R} focus={focus} />
          <Driver R={R} onHud={setHud} focus={focus} tuneRef={tuneRef} ctl={ctl} />
        </Canvas>
      )}
      <SpeedStreaks frac={hud.frac} />
      <GaragePanel open={garage} onClose={() => setGarage(false)} build={eff} setBuild={setBuild}
        shop={{ ledger, buy: (slot: Slot, t: Tier) => { const r = buy(ledger, slot, t); if (r.ok) setLedger(r.ledger); else flash(r.why ?? 'Not yet') } }} />
      <TradeHud ledger={ledger} objective={objective} toast={toast} />
      {atTown && !board && SUPPLY.some(s => s.place === atTown) && (
        <div style={{ position: 'absolute', left: '50%', top: '40%', transform: 'translateX(-50%)', padding: '6px 12px', borderRadius: 8, background: 'rgba(10,12,18,0.7)', color: '#f4efe2', font: '600 12px system-ui', pointerEvents: 'none' }}>
          E · Ather Trading Co. board
        </div>
      )}
      {board && (
        <BoardPanel town={placeName(board)} contracts={contracts} ledger={ledger} capacity={CAPACITY.darter} msg={boardMsg}
          onAccept={c => { const r = accept(ledger, c, CAPACITY.darter); if (r.ok) { setLedger(r.ledger); setBoard(null); flash(`Contract taken · ${GOODS[c.good].name} to ${placeName(c.to)}`) } else setBoardMsg(r.why ?? null) }}
          onAbandon={() => setLedger(abandon(ledger))} onClose={() => setBoard(null)} />
      )}
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
      {ferryAt && !ferrying && (
        <div style={{ position: 'absolute', left: '50%', top: '30%', transform: 'translateX(-50%)', padding: '8px 16px', borderRadius: 6, background: 'rgba(28,24,18,0.66)',
          color: '#f4efe2', font: '600 12px var(--font-game), system-ui', letterSpacing: '0.18em', textTransform: 'uppercase', pointerEvents: 'none' }}>
          E · Shellback ferry across · {FERRY_FARE} Marks
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, background: '#0d0b08', opacity: ferrying ? 1 : 0, transition: 'opacity 0.5s', pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e9e2d0', font: 'italic 500 18px var(--font-display), Georgia, serif' }}>
        {ferrying ? 'The Shellback hauls you across…' : ''}
      </div>
      {hud.sign && (
        <div style={{ position: 'absolute', left: '50%', bottom: 22, transform: 'translateX(-50%)', maxWidth: 'calc(100% - 200px)', padding: '7px 14px', borderRadius: 6,
          background: 'rgba(28,24,18,0.62)', border: '1px solid rgba(160,230,210,0.35)', color: '#e9f6ef', pointerEvents: 'none',
          font: '600 11px var(--font-game), system-ui', letterSpacing: '0.14em', textAlign: 'center', textTransform: 'uppercase', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
          {hud.sign}
        </div>
      )}
      {(hud.drift || hud.air > 0.25) && (
        <div style={{ position: 'absolute', left: '50%', top: '24%', transform: 'translateX(-50%)', font: '700 15px var(--font-game), system-ui', letterSpacing: '0.35em', color: '#d4a843', textShadow: '0 2px 10px rgba(0,0,0,0.6)', pointerEvents: 'none' }}>
          {hud.air > 0.25 ? `AIR ${hud.air.toFixed(1)}s` : 'DRIFT'}
        </div>
      )}
      <div style={{ position: 'absolute', left: 12, top: 12, padding: '5px 9px', borderRadius: 6, background: 'rgba(12,16,20,0.5)', color: '#e8eef2', font: '600 11px var(--font-game), system-ui', letterSpacing: '0.2em', pointerEvents: 'none' }}>
        ATHERNYX · {R?.meta.name === "continent" ? "THE CONTINENT, 1672" : "ASHFELD TO RUNE HOLD"}
      </div>
      {R && !started && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ padding: '18px 24px', borderRadius: 10, background: 'rgba(12,16,20,0.72)', color: '#eef3f6', font: '14px system-ui, sans-serif', lineHeight: 1.65, textAlign: 'center', maxWidth: 460 }}>
            <div style={{ font: '600 13px system-ui', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>The Darter · Ashfeld</div>
            You start on the road out of Ashfeld. It runs down to Millbrook on the river; the trunk south ends at Rune Hold under the Spine.
            <div style={{ marginTop: 8 }}>W / ↑ throttle · S / ↓ brake · A D steer · Space handbrake · C camera · R back to the road · G garage · E board (stopped at a town)</div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>Press any key to drive</div>
          </div>
        </div>
      )}
    </div>
  )
}
