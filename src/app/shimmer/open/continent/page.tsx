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
import { useMenuLock } from '../shared/menu-lock'
import { GameHud, useGameHudSize, openMapBox, hudSay, type CompassPose, type Mana } from '../shared/game-hud'
import type { Vitals } from '../../engine/vitals'
import { ContinentMap, ContinentMiniMap, makeMapState, reveal, persist, type Track } from './map'
import { pitstopsUnlocked, visitNear } from './pitstops'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelDayNight } from '../shared/day-night'
import { createCourser, tickCourser, bodySpeeds, slipAngle, type Courser, type CourserInput, type CourserTune } from '../courser'
import { GaragePanel, useCourserBuild } from '../garage'
import { BoardPanel, TradeHud, useLedger } from '../trade-ui'
import { postBoard, accept, arrive, abandon, buy, GOODS, CAPACITY, type Contract, type Supply } from '../trade'
import { DARTER_STOCK, tuneFromSpec } from '../courser'
import { buildSpec, type Slot, type Tier } from '../courser-build'
import { buildCavern, caveRoomAt, type Cavern } from '../cavern'
import { CavernView } from '../cavern-view'
import { GunRange, useGunHud, rangeHolds } from '../gun-range'
import { footWorld, tickFoot, exitSpot, canEnter, stepOut, EXIT_MAX_SPEED } from '../on-foot'
import { eyeY, WALK_SPEED, SPEED_CAP, type LocoState } from '../shared/locomotion'
import { DarterModel, DriftFx, RoadPosts, SpeedStreaks, chaseShape, speedRumble } from '../darter-view'
import { TUNNEL_H, TUNNEL_WALK, boreAt, tunnelWall, bridgeRail, drivable, ferryLanding, guardrails, loadRegion, roadRail, nearPad, nearestRoad, roadside, routeBetween, type Region, type RegionJunction, type RegionRoad } from '../region'
import { touch, TOUCH_LOOK_SENS, isTouchOnly } from '../shared/touch'
import { TouchControls, type TouchAction } from '../shared/touch-controls'

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

/** A terrain quad (grid corners ia..ib, ja..jb) left out at a bore's mouth: its centre is in the bore's footprint and
 *  its corners straddle floor..crown, i.e. the hill's face crosses the portal opening. The Tunnels' portal faces are
 *  sized from exactly these quads (5 m ones), so the stone always covers the hole. */
function boreHole(R: Region, ia: number, ja: number, ib: number, jb: number) {
  const { cell, sizeX, sizeZ } = R.meta
  const t = R.tunnelAt((ia + ib) / 2 * cell - sizeX / 2, (ja + jb) / 2 * cell - sizeZ / 2)
  if (!t) return null
  const ys = [R.vertex(ia, ja), R.vertex(ib, ja), R.vertex(ia, jb), R.vertex(ib, jb)]
  const hi = Math.max(...ys)
  return hi > t.y + 0.4 && Math.min(...ys) < t.y + TUNNEL_H + 1.5 ? { s: t.s, len: t.len, top: hi - t.y, tunnel: t.tunnel } : null
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
  // a bore's mouth: the quads where the hill's face crosses the portal opening are left out, at FULL detail only. A
  // coarse quad is 10-20 m: holing one opened a gap far bigger than the portal (Alex 11-14: "huge gaps above the
  // entrance"); from that far off the face simply stays shut and the portal stands in front of it.
  const bored = step === 1 && (R.meta.network?.tunnels?.length ?? 0) > 0
  const hole = (a: number, b: number) => !!boreHole(R, is[a], js[b], is[a + 1], js[b + 1])
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
    // only the bore's own road takes its floor; the pass crossing over the bore's roof rides the hill
    const surf = (x: number, z: number, id: string) => { const t = R.tunnelAt(x, z); return t && t.cover > 0.3 && t.tunnel.edge === id ? t.y : R.groundAt(x, z) }
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
        const Lp = [lx, surf(lx, lz, r.id) + 0.07, lz], Rp = [rx, surf(rx, rz, r.id) + 0.07, rz]
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
function Tunnels({ R, cave }: { R: Region; cave: Cavern | null }) {
  const built = useMemo(() => {
    const lining: number[] = [], lamps: number[] = []
    const portals: { x: number; y: number; z: number; yaw: number; hw: number; top: number }[] = []
    const quad = (out: number[], a: number[], b: number[], c: number[], d: number[]) => out.push(...a, ...b, ...c, ...a, ...c, ...d)
    for (const t of R.meta.network?.tunnels ?? []) {
      const hw = t.width / 2 + TUNNEL_WALK, prof = boreProfile(hw)
      // densify to 2.5 m and read the cover at each station: the lining runs only where the hill is a roof
      const st: { x: number; z: number; y: number; ux: number; uz: number; cover: number; s: number }[] = []
      let sAcc = 0
      for (let k = 0; k < t.pts.length - 1; k++) {
        const [ax, az, ay] = t.pts[k], [bx, bz, by] = t.pts[k + 1]
        const L = Math.hypot(bx - ax, bz - az) || 1, n = Math.max(1, Math.round(L / 2.5))
        for (let i = 0; i < n; i++) {
          const f = i / n, x = ax + (bx - ax) * f, z = az + (bz - az) * f, y = ay + (by - ay) * f
          st.push({ x, z, y, ux: (bx - ax) / L, uz: (bz - az) / L, cover: R.heightAt(x, z) - y, s: sAcc + L * f })
        }
        sAcc += L
      }
      // the holes the terrain leaves at each mouth (boreHole, 5 m quads): the portal stands at the OUTERMOST one and
      // rises past the tallest, so the stone covers every gap (v1 sized the face from the cover at one station and
      // the hill's quads stood open above and beside it)
      const { cell, sizeX, sizeZ, nx, nz } = R.meta
      let xa = Infinity, xb = -Infinity, za = Infinity, zb = -Infinity
      for (const p of t.pts) { xa = Math.min(xa, p[0]); xb = Math.max(xb, p[0]); za = Math.min(za, p[1]); zb = Math.max(zb, p[1]) }
      const m = hw + 6
      const ia0 = Math.max(0, Math.floor((xa - m + sizeX / 2) / cell)), ia1 = Math.min(nx - 2, Math.ceil((xb + m + sizeX / 2) / cell))
      const ja0 = Math.max(0, Math.floor((za - m + sizeZ / 2) / cell)), ja1 = Math.min(nz - 2, Math.ceil((zb + m + sizeZ / 2) / cell))
      const mouth = [{ s: Infinity, top: 0 }, { s: -Infinity, top: 0 }]
      for (let j = ja0; j <= ja1; j++) for (let i = ia0; i <= ia1; i++) {
        const hq = boreHole(R, i, j, i + 1, j + 1)
        if (!hq || hq.tunnel !== t) continue
        const w = hq.s < hq.len / 2 ? 0 : 1, half = cell * 0.75          // the quad reaches ~half a cell past its centre
        if (w === 0) mouth[0].s = Math.min(mouth[0].s, hq.s - half); else mouth[1].s = Math.max(mouth[1].s, hq.s + half)
        mouth[w].top = Math.max(mouth[w].top, hq.top)
      }
      const roofA = st.findIndex(q => q.cover >= TUNNEL_H)
      let roofB = st.length - 1
      while (roofB > 0 && st[roofB].cover < TUNNEL_H) roofB--
      if (roofA < 0 || roofB <= roofA) continue
      const station = (sAlong: number) => Math.max(0, Math.min(st.length - 1, Math.round(sAlong / 2.5)))
      const i0 = Number.isFinite(mouth[0].s) ? Math.min(roofA, station(mouth[0].s)) : Math.max(0, roofA - 1)
      const i1 = Number.isFinite(mouth[1].s) ? Math.max(roofB, station(mouth[1].s)) : Math.min(st.length - 1, roofB + 1)
      // offset o is measured to the LEFT of travel (−x of the direction's right hand): (uz, −ux) is the right normal
      const at = (q: typeof st[0], o: number, hgt: number) => [q.x + q.uz * o, q.y + hgt, q.z - q.ux * o]
      let lampAcc = 0, side = 1
      for (let k = i0; k < i1; k++) {
        const A = st[k], B = st[k + 1]
        // the Passage market's side door: the wall on that side is cut away exactly across doorS (the arch above
        // the springline stays), so the lining never stands in front of the walk-only passage
        const door = cave && cave.tunnel === t ? cave.doorS : null
        const doorM = cave ? (cave.side > 0 ? prof.length - 2 : 0) : -1
        const lerpSt = (f: number) => ({ ...A, x: A.x + (B.x - A.x) * f, z: A.z + (B.z - A.z) * f, y: A.y + (B.y - A.y) * f })
        for (let m = 0; m < prof.length - 1; m++) {
          const [o0, h0] = prof[m], [o1, h1] = prof[m + 1]
          if (door && m === doorM && B.s > door[0] && A.s < door[1]) {
            const fa = (door[0] - A.s) / (B.s - A.s), fb = (door[1] - A.s) / (B.s - A.s)
            if (fa > 0) { const P = lerpSt(fa); quad(lining, at(A, o0, h0), at(P, o0, h0), at(P, o1, h1), at(A, o1, h1)) }
            if (fb < 1) { const P = lerpSt(fb); quad(lining, at(P, o0, h0), at(B, o0, h0), at(B, o1, h1), at(P, o1, h1)) }
            continue
          }
          quad(lining, at(A, o0, h0), at(B, o0, h0), at(B, o1, h1), at(A, o1, h1))
        }
        // the floor, wall to wall: the road ribbon is only the carriageway, and the walkways either side had nothing
        // under them (Alex 11-14: "where the road meets the wall i can see right through")
        quad(lining, at(A, -hw, 0.03), at(B, -hw, 0.03), at(B, hw, 0.03), at(A, hw, 0.03))
        lampAcc += 2.5
        if (lampAcc >= 16) {
          lampAcc = 0; side = -side
          const o = side * (hw - 0.05), y0 = 3.4, y1 = 3.9
          const p = (dl: number, hh: number) => [A.x + A.ux * dl + A.uz * o, A.y + hh, A.z + A.uz * dl - A.ux * o]
          quad(lamps, p(-0.6, y0), p(0.6, y0), p(0.6, y1), p(-0.6, y1))
        }
      }
      for (const [q, dir, mo] of [[st[i0], 1, mouth[0]], [st[i1], -1, mouth[1]]] as const) {
        const top = Math.min(48, Math.max(TUNNEL_H + 2.5, mo.top + 1))
        portals.push({ x: q.x, y: q.y, z: q.z, yaw: Math.atan2(-q.ux * dir, -q.uz * dir), hw, top })
      }
    }
    const mk = (pos: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g }
    // a portal: a stone slab with the bore's profile cut out of it, extruded 1.6 m back into the hill (local −z)
    const portalGeo = (hw: number, top: number) => {
      const wide = hw + 6.5, prof = boreProfile(hw)
      const sh = new THREE.Shape([new THREE.Vector2(-wide, -1.5), new THREE.Vector2(wide, -1.5), new THREE.Vector2(wide, top), new THREE.Vector2(-wide, top)])
      sh.holes.push(new THREE.Path(prof.map(([o, hh]) => new THREE.Vector2(o, hh))))
      const g = new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: false })
      g.translate(0, 0, -1.6)
      return g
    }
    return { lining: mk(lining), lamps: mk(lamps), portals: portals.map(p => ({ ...p, geo: portalGeo(p.hw, p.top) })) }
  }, [R, cave])
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

export interface RideHud { x: number; z: number; yaw: number; mph: number; frac: number; drift: boolean; air: number; gearR: boolean; place: string | null; road: string | null; sign: string | null
  /** On foot (the courser parked); prompt = the F verb on offer right now, if any. */
  foot?: boolean; prompt?: string | null }
// on foot: the walker's own feel numbers (open/hillside/page.tsx), and the get-in/get-out glide
/** Where the Hallway lets you out when the asked-for door is not yours yet: the 08-12 public landing (gates.md). */
const LANDING = 'rune-hold'
const FOOT_FOV = 75, FOOT_FOV_KICK = 8, SENS = 0.0022, SEAT_GLIDE = 0.38

function Driver({ R, cave, onHud, focus, tuneRef, ctl, track }: { track: React.MutableRefObject<Track>; R: Region; cave: Cavern | null; onHud: (h: RideHud) => void; focus: React.MutableRefObject<THREE.Vector3>; tuneRef: React.MutableRefObject<CourserTune>; ctl: React.MutableRefObject<{ tp?: (x: number, z: number, yaw: number) => void }> }) {
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
  // ── ON FOOT (Alex 11-14): F steps out of the courser and back in, the camera GLIDING between the chase pose and the
  // eye in SEAT_GLIDE seconds (never a cut), the courser parked on its handbrake where you left it ──
  const fw = useMemo(() => footWorld(R, cave), [R, cave])
  const mode = useRef<'drive' | 'foot'>('drive')
  const loco = useRef<LocoState | null>(null)
  const view = useRef({ yaw: 0, pitch: -0.08 })
  const glide = useRef<{ t: number; pos: THREE.Vector3; quat: THREE.Quaternion } | null>(null)
  const tmpQ = useMemo(() => new THREE.Quaternion(), [])
  const lock = () => { try { const r = gl.domElement.requestPointerLock?.() as unknown as Promise<void> | undefined; r?.catch?.(() => {}) } catch { /* needs a gesture: a click relocks */ } }
  const startGlide = () => { glide.current = { t: 0, pos: camera.position.clone(), quat: camera.quaternion.clone() } }
  const seat = () => {
    const c = car.current
    if (mode.current === 'drive') {
      if (Math.hypot(c.vx, c.vz) > EXIT_MAX_SPEED || c.airborne) return
      const spot = exitSpot(fw, R, c)
      if (!spot) return
      startGlide()
      loco.current = stepOut(spot, c)
      view.current = { yaw: c.yaw, pitch: -0.08 }
      mode.current = 'foot'
      lock()
    } else {
      const s = loco.current
      if (!s || !canEnter(s, c)) return
      startGlide()
      // the chase camera picks up from right behind the car, not from wherever it was left
      const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw)
      camPos.set(c.x - fx * 6, c.y + 2.6, c.z - fz * 6)
      mode.current = 'drive'
      loco.current = null
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock()
    }
  }

  ctl.current.tp = (x: number, z: number, yaw: number) => place(x, z, yaw)
  const place = (x: number, z: number, yaw: number, speed = 0) => {
    // a spot inside a bore is ON ITS FLOOR (a teleport or an R-respawn there put the car on the summit above it)
    const bore = R.tunnelAt(x, z), hint = bore && bore.cover > 2 ? bore.y : undefined
    const gnd = (gx: number, gz: number) => R.groundAt(gx, gz, hint)
    const c = createCourser(x, z, yaw, gnd); c.vx = -Math.sin(yaw) * speed; c.vz = -Math.cos(yaw) * speed
    car.current = c; camPos.set(x + Math.sin(yaw) * 8, gnd(x, z) + 3, z + Math.cos(yaw) * 8)
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code)
      if (e.code === 'KeyF' && !e.repeat) seat()
      if (e.code === 'KeyR' && !rangeHolds()) { mode.current = 'drive'; loco.current = null; place(safe.current.x, safe.current.z, safe.current.yaw) }
      if (e.code === 'KeyC' && mode.current === 'drive') camMode.current = camMode.current === 'chase' ? 'hood' : 'chase'
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const blur = () => keys.current.clear()
    const move = (e: MouseEvent) => {
      if (mode.current !== 'foot' || document.pointerLockElement !== gl.domElement) return
      view.current.yaw -= e.movementX * SENS
      view.current.pitch = Math.max(-1.5, Math.min(1.5, view.current.pitch - e.movementY * SENS))
    }
    const click = () => { if (mode.current === 'foot' && document.pointerLockElement !== gl.domElement) lock() }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
    window.addEventListener('mousemove', move); gl.domElement.addEventListener('click', click)
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
      seat: () => seat(),
      foot: () => (loco.current ? { mode: mode.current, ...loco.current } : { mode: mode.current }),
      look: (yaw: number, pitch = -0.08) => { view.current = { yaw, pitch } },
      // scripted shots: stand a walker anywhere (on the Passage market's floor when the spot is in it)
      footTp: (x: number, z: number, yaw = 0, pitch = -0.08) => {
        const y = cave && cave.inside(x, z) ? cave.y : R.groundAt(x, z)
        loco.current = stepOut({ x, y: y + 0.05, z }, { vx: 0, vz: 0 }); view.current = { yaw, pitch }; mode.current = 'foot'
      },
    }
    // ?at= : arriving through the Hallway (gates.md › THE HALLWAY, 11-14). You come out of a PITSTOP door: any city
    // you have visited, or Rune Hold's square (the 08-12 landing, always open). An id that is not an unlocked
    // pitstop lands at Rune Hold: a door onto an unbound place stays refused. The courser waits parked at the edge of
    // town; you stand in the square on foot, facing it.
    const at = new URLSearchParams(window.location.search).get('at')
    if (at !== null) {
      const dest = pitstopsUnlocked(R.meta.places).find(q => q.id === at)?.id ?? LANDING
      const p = R.meta.places.find(q => q.id === dest)
      if (p) {
        const r = R.meta.roads.find(q => q.from === dest || q.to === dest)
        const pts = r ? (r.from === dest ? r.pts : [...r.pts].reverse()) : null
        const [cx, cz] = pts ? pts[1] : [p.x + 8, p.z]
        const [nx, nz] = pts ? pts[3] : [p.x + 20, p.z]
        place(cx, cz, Math.atan2(-(nx - cx), -(nz - cz)))
        safe.current = { x: cx, z: cz, yaw: Math.atan2(-(nx - cx), -(nz - cz)) }
        const y = cave && cave.inside(p.x, p.z) ? cave.y : R.groundAt(p.x, p.z)
        loco.current = stepOut({ x: p.x, y: y + 0.05, z: p.z }, { vx: 0, vz: 0 })
        view.current = { yaw: Math.atan2(-(cx - p.x), -(cz - p.z)), pitch: -0.08 }; mode.current = 'foot'
      }
      const u = new URL(window.location.href); u.searchParams.delete('at'); window.history.replaceState(null, '', u)
    }
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur)
      window.removeEventListener('mousemove', move); gl.domElement.removeEventListener('click', click)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [R])

  useEffect(() => { (camera as THREE.PerspectiveCamera).far = 2500; camera.updateProjectionMatrix() }, [camera])
  useEffect(() => { gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)) }, [gl])

  useFrame((_, frameDt) => {
    const k = keys.current, sc = scripted.current, onFoot = mode.current === 'foot'
    // on foot the keys are the walker's: the parked courser gets no throttle and its handbrake on
    // a phone's left stick (shared/touch.ts) adds in: up = throttle, down = brake/reverse, sideways = steer, analog
    const clamp1 = (v: number) => Math.max(-1, Math.min(1, v))
    const throttle = onFoot ? 0 : sc?.throttle ?? clamp1((k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + touch.move.y)
    const steer = onFoot ? 0 : sc?.steer ?? clamp1((k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + touch.move.x)
    const handbrake = onFoot ? true : sc?.handbrake ?? (k.has('Space') || touch.held.has('Space'))

    acc.current = Math.min(acc.current + frameDt, 0.1)
    let c = car.current
    // the surface, read off the map: paved Citadel stone grips best, the frontier's packed dirt less, grass least
    const under = nearestRoad(R, c.x, c.z, c.y)
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
    if (c.y < -0.6 && !onFoot) { place(safe.current.x, safe.current.z, safe.current.yaw); c = car.current }
    // the walker: same tick as /shimmer/open, on the region's ground at the walker's own height
    const lc = loco.current
    if (onFoot && lc) {
      if (touch.look.dx || touch.look.dy) {
        view.current.yaw -= touch.look.dx * TOUCH_LOOK_SENS
        view.current.pitch = Math.max(-1.5, Math.min(1.5, view.current.pitch - touch.look.dy * TOUCH_LOOK_SENS))
      }
      const { yaw } = view.current
      const fwx = -Math.sin(yaw), fwz = -Math.cos(yaw), rtx = Math.cos(yaw), rtz = -Math.sin(yaw)
      const f = clamp1((k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + touch.move.y)
      const r = clamp1((k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + touch.move.x)
      let mx = fwx * f + rtx * r, mz = fwz * f + rtz * r
      const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml }
      tickFoot(fw, R, lc, { mvX: mx, mvZ: mz, fwdX: fwx, fwdZ: fwz, rightX: rtx, rightZ: rtz,
        jumpKey: k.has('Space') || touch.held.has('Space'), crouchKey: k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyC') || touch.held.has('ShiftLeft'), dt: Math.min(frameDt, 0.05) })
      // fell off the world (or into it): back beside the courser
      if (lc.py < -40) { const sp = exitSpot(fw, R, c); if (sp) loco.current = stepOut(sp, { vx: 0, vz: 0 }) }
    }
    touch.look.dx = 0; touch.look.dy = 0          // consumed (on foot) or dropped (driving: the chase camera steers itself)
    safeT.current -= frameDt
    if (safeT.current <= 0) {
      safeT.current = 0.5
      if (!c.airborne && nearestRoad(R, c.x, c.z).d < 3 && Math.hypot(c.vx, c.vz) > 2) safe.current = { x: c.x, z: c.z, yaw: c.yaw }
    }
    if (onFoot && loco.current) focus.current.set(loco.current.px, loco.current.py, loco.current.pz)
    else focus.current.set(c.x, c.y, c.z)

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
    if (onFoot && loco.current) {
      const s = loco.current, { yaw, pitch } = view.current
      cam.position.set(s.px, eyeY(s), s.pz)
      cam.rotation.set(pitch, yaw, 0, 'YXZ')
    } else if (camMode.current === 'chase') {
      const sp = Math.hypot(c.vx, c.vz)
      const tx = sp > 3 ? c.vx / sp : fx, tz = sp > 3 ? c.vz / sp : fz
      const bx = fx * 0.65 + tx * 0.35, bz = fz * 0.65 + tz * 0.35, bl = Math.hypot(bx, bz) || 1
      const shape = chaseShape(Math.abs(fwd) / tuneRef.current.top)
      const back = shape.back
      const want = new THREE.Vector3(c.x - (bx / bl) * back, c.y + shape.height, c.z - (bz / bl) * back)
      // ★ TIGHT SPACES LOCK THE CAMERA (Alex 11-14: "the camera glitched into the wall"). In a bore, or its mouth
      // cutting, the free chase is replaced by a rail: on the bore's centre line, a fixed distance behind the car along
      // the bore (not along the car's heading, which swings it into a wall), under the crown, and only a little of the
      // car's lane offset. Nothing the car does can put it inside the stone.
      const tb = R.tunnelAt(c.x, c.z), bored = !!tb && c.y < tb.y + TUNNEL_H
      if (bored) {
        const t = tb!.tunnel, here = boreAt(t, tb!.s), sg = fx * here.ux + fz * here.uz >= 0 ? 1 : -1
        const rail = boreAt(t, tb!.s - sg * 6.5), wall = t.width / 2 + TUNNEL_WALK - 1.4
        const lat = Math.max(-wall, Math.min(wall, tb!.off * 0.5))
        want.set(rail.x + rail.uz * lat, rail.y + 2.9, rail.z - rail.ux * lat)
        camPos.lerp(want, 1 - Math.exp(-frameDt * 14))
      } else {
        want.y = Math.max(want.y, R.groundAt(want.x, want.z, c.y) + 1.4)
        camPos.lerp(want, 1 - Math.exp(-frameDt * 7))
        camPos.y = Math.max(camPos.y, R.groundAt(camPos.x, camPos.z, c.y) + 1.0)
      }
      const [rx2, ry2] = speedRumble(Math.abs(fwd) / tuneRef.current.top, performance.now() / 1000)
      cam.position.set(camPos.x + (Math.random() - 0.5) * sk + rx2, camPos.y + (Math.random() - 0.5) * sk + ry2, camPos.z)
      look.set(c.x + fx * 4, c.y + 1.0, c.z + fz * 4)
      cam.lookAt(look)
    } else {
      cam.position.set(c.x + fx * 0.4, c.y + 1.25, c.z + fz * 0.4)
      look.set(c.x + fx * 20, c.y + 1.0, c.z + fz * 20)
      cam.lookAt(look)
    }
    // ★ THE GLIDE: whichever pose the camera just computed is where it is GOING; for SEAT_GLIDE seconds it travels
    // there from where it was when you pressed F (eased both ends). A step out swoops from behind the car down to the
    // eye at the door; a step in rises back to the chase. No cut, no fade.
    const gd = glide.current
    if (gd) {
      gd.t += frameDt
      const u = Math.min(1, gd.t / SEAT_GLIDE), e = u * u * (3 - 2 * u)
      tmpQ.copy(cam.quaternion)
      cam.position.lerpVectors(gd.pos, cam.position, e)
      cam.quaternion.slerpQuaternions(gd.quat, tmpQ, e)
      if (u >= 1) glide.current = null
    }
    const footSpeed = onFoot && loco.current ? Math.hypot(loco.current.hvx, loco.current.hvz) : 0
    const fov = onFoot ? FOOT_FOV + FOOT_FOV_KICK * Math.min(1, Math.max(0, (footSpeed - WALK_SPEED) / (SPEED_CAP - WALK_SPEED)))
      : chaseShape(Math.abs(fwd) / tuneRef.current.top).fov
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, frameDt * 5); cam.updateProjectionMatrix() }

    // the map's "you": every frame, so the minimap turns with you rather than at the HUD's 8 Hz
    if (onFoot && loco.current) { track.current.x = loco.current.px; track.current.z = loco.current.pz; track.current.yaw = view.current.yaw }
    else { track.current.x = c.x; track.current.z = c.z; track.current.yaw = c.yaw }
    hudT.current -= frameDt
    if (hudT.current <= 0) {
      hudT.current = 0.12
      let near: string | null = null, nd = 260
      // the HUD reads where YOU are: the walker on foot, the courser when driving (v1 kept reading the parked car)
      const me = onFoot && loco.current ? { x: loco.current.px, y: loco.current.py, z: loco.current.pz } : { x: c.x, y: c.y, z: c.z }
      for (const p of R.meta.places) { const d = Math.hypot(p.x - me.x, p.z - me.z); if (p.name && d < nd) { nd = d; near = p.name } }
      const nr = nearestRoad(R, me.x, me.z, me.y)
      // a carving in reach reads out: the waystone's two faces, or the fingerpost's arms
      let sign: string | null = null
      for (const w of signs.waystones) if (Math.hypot(w.x - me.x, w.z - me.z) < 18) sign = 'Waystone · ' + w.faces.map(f => `${f.name} ${f.km} km`).join(' · ')
      for (const f of signs.fingerposts) if (Math.hypot(f.x - me.x, f.z - me.z) < 26) sign = f.arms.map(a => `${a.name} ${a.km} km`).join(' · ')
      // on foot in the Passage market: the room you are standing in reads out (a shelf, the teachers, Lowen's bay)
      if (onFoot && loco.current && cave && Math.abs(loco.current.py - cave.y) < 4) {
        const room = caveRoomAt(cave, loco.current.px, loco.current.pz)
        sign = room ? `${room.label} · ${room.detail}` : sign
      }
      const reach = loco.current && canEnter(loco.current, c)
      const prompt = onFoot ? (reach ? 'F · Get in' : null) : Math.hypot(c.vx, c.vz) < 1.5 && !c.airborne ? 'F · Get out' : null
      onHud({ foot: onFoot, prompt, x: c.x, z: c.z, yaw: c.yaw, mph: Math.hypot(fwd, lat) * 2.23694, frac: Math.abs(fwd) / tuneRef.current.top, drift: c.drift || (slipAngle(c) > 0.26 && !c.airborne), air: c.airborne ? c.airT : 0, gearR: fwd < -0.5,
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
  // toasts speak on the template's message line (game-hud.tsx), under the hotbar
  const flash = (t: string) => hudSay(t, 'info')
  // the town you are stopped at (within 45 m), if any
  const atTown = useMemo(() => {
    if (!R || hud.mph > 4 || hud.foot) return null
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
      if (ev.code !== 'KeyE' || footRef.current) return
      if (ferryRef.current) { takeFerry(); return }
      setBoard(b => (b ? null : atTownRef.current && SUPPLY.some(s => s.place === atTownRef.current) ? atTownRef.current : null))
      setBoardMsg(null)
    }
    window.addEventListener('keydown', e); return () => window.removeEventListener('keydown', e)
  }, [takeFerry])
  const atTownRef = useRef<string | null>(null)
  const footRef = useRef(false)
  footRef.current = !!hud.foot
  // Phone (11-15): the same keys this page handles, as taps. In reach (big pill): E at a ferry or a Co. board, F to get
  // out / in. Standing: map, back to the road, and while driving the camera and the garage.
  const canBoard = !!atTown && !board && SUPPLY.some(s => s.place === atTown)
  const touchActions: TouchAction[] = [
    ...(!hud.foot && ferryAt && !ferrying ? [{ code: 'KeyE', key: 'E', label: 'ferry', near: true }]
      : !hud.foot && canBoard ? [{ code: 'KeyE', key: 'E', label: 'board', near: true }] : []),
    ...(hud.prompt ? [{ code: 'KeyF', key: 'F', label: hud.foot ? 'get in' : 'get out', near: true }] : []),
    { code: 'KeyM', key: 'M', label: 'map' },
    ...(!hud.foot ? [{ code: 'KeyC', key: 'C', label: 'camera' }, { code: 'KeyG', key: 'G', label: 'garage' }] : []),
    { code: 'KeyR', key: 'R', label: 'road' },
  ]
  atTownRef.current = atTown
  // the board stays open until you actually drive away (> 60 m), not on the first nudge of the throttle
  useEffect(() => {
    if (!board || !R) return
    const p = R.meta.places.find(q => q.id === board)
    if (!p || Math.hypot(p.x - hud.x, p.z - hud.z) > 60) setBoard(null)
  }, [board, R, hud.x, hud.z])
  const [garage, setGarage] = useState(false)
  useEffect(() => {
    const g = (e: KeyboardEvent) => { if (e.code === 'KeyG' && !footRef.current) setGarage(v => !v) }
    window.addEventListener('keydown', g)
    return () => window.removeEventListener('keydown', g)
  }, [])
  const [started, setStarted] = useState(false)
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => setIsTouch(isTouchOnly()), [])
  // ── THE HUD (shared/game-hud.tsx): the same hearth HUD as the Ather. Nothing on the continent can hurt you yet and
  // nothing casts, so health and mana stand full; the bar is dimmed at the wheel (hands are busy) ──
  const hudSize = useGameHudSize(isTouch)
  const gunHud = useGunHud()    // the gun shop's held gun → the template's hotbar + an ammo chip
  const [slot, setSlot] = useState(0)
  // approaching a place speaks on the message line (was a banner)
  const lastPlace = useRef<string | null>(null)
  useEffect(() => { if (hud.place && hud.place !== lastPlace.current) hudSay(`Approaching ${hud.place}`, 'zone'); lastPlace.current = hud.place ?? null }, [hud.place])
  const vitalsRef = useRef<Vitals>({ hp: 100, hpMax: 100, shield: 0, shieldMax: 0 })
  const manaRef = useRef<Mana>({ cur: 100, max: 100, regen: 0 })
  const cave = useMemo(() => (R ? buildCavern(R) : null), [R])
  // ── THE MAP (./map.tsx): ink in what you drive, minimap top-right, M opens it whole ──
  const track = useRef<Track>({ x: 0, z: 0, yaw: 0 })
  const mapState = useMemo(() => (R ? makeMapState(R) : null), [R])
  const [showMap, setShowMap] = useState(false)
  useEffect(() => {
    if (!mapState) return
    let dirty = false
    const ink = setInterval(() => {
      if (!started) return
      if (reveal(mapState, track.current.x, track.current.z)) dirty = true
      const door = visitNear(mapState.R.meta.places, track.current.x, track.current.z)
      if (door) flash(`Pitstop unlocked · ${door.name} (a door off your Hallway)`)
    }, 250)
    const save = setInterval(() => { if (dirty) { persist(mapState); dirty = false } }, 3000)
    const out = () => persist(mapState)
    window.addEventListener('pagehide', out)
    return () => { clearInterval(ink); clearInterval(save); window.removeEventListener('pagehide', out); out() }
  }, [mapState, started])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'KeyM' && !showMap) setShowMap(true) }   // useMenuLock frees the mouse
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [showMap])
  const focus = useRef(new THREE.Vector3())
  // menus free the mouse (on foot it is locked); closing one takes the camera back (shared/menu-lock.ts)
  const canvasEl = useRef<HTMLCanvasElement | null>(null)
  const getCanvas = useCallback(() => canvasEl.current, [])
  useMenuLock(showMap || garage || !!board, getCanvas)
  const [ptrLocked, setPtrLocked] = useState(false)
  useEffect(() => {
    const ch = () => setPtrLocked(!!document.pointerLockElement)
    document.addEventListener('pointerlockchange', ch); return () => document.removeEventListener('pointerlockchange', ch)
  }, [])
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
        <Canvas camera={{ fov: FOV, near: 0.1, far: 2500 }} gl={{ antialias: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => { canvasEl.current = gl.domElement }}>
          <VoxelDayNight />
          <FogRig />
          <Terrain R={R} focus={focus} />
          <Roads R={R} />
          <Junctions R={R} />
          <Bridges R={R} />
          <Tunnels R={R} cave={cave} />
          {cave && <CavernView cave={cave} R={R} />}
          {cave && <GunRange cave={cave} />}
          <Guardrails R={R} />
          <Water R={R} />
          <Towns R={R} />
          <Posts R={R} />
          <Roadside R={R} />
          <Trees R={R} focus={focus} />
          <Driver R={R} cave={cave} onHud={setHud} focus={focus} tuneRef={tuneRef} ctl={ctl} track={track} />
        </Canvas>
      )}
      <SpeedStreaks frac={hud.frac} />
      {isTouch && started && !showMap && !garage && !board && !ferrying && (
        <TouchControls showFire={false} actions={touchActions}
          holds={hud.foot ? undefined : [{ code: 'Space', label: 'drift' }]}
          stickHint={hud.foot ? 'thumb here to move' : 'thumb here to drive'} row={{ side: 'left', top: hud.foot ? 48 : 148 }} />
      )}
      {started && <GameHud size={hudSize} pose={track as React.RefObject<CompassPose>} vitals={vitalsRef} mana={manaRef} entries={gunHud.entries} sel={slot} onSelect={setSlot}
        dimmed={!hud.foot} input={!!hud.foot && !showMap && !garage && !board}
        minimap={mapState && <ContinentMiniMap map={mapState} track={track} onExpand={() => setShowMap(true)} box={openMapBox(hudSize)} />}
        status={[
          { label: R?.meta.name === 'continent' ? 'Athernyx · 1672' : 'Ashfeld to Rune Hold' },
          { label: 'Marks', value: ledger.marks, accent: true },
          { label: ledger.deeds === 1 ? 'Deed' : 'Deeds', value: ledger.deeds },
          ...gunHud.status,
        ]} />}
      {mapState && showMap && <ContinentMap map={mapState} track={track} onClose={() => setShowMap(false)} />}
      <GaragePanel open={garage} onClose={() => setGarage(false)} build={eff} setBuild={setBuild}
        shop={{ ledger, buy: (slot: Slot, t: Tier) => { const r = buy(ledger, slot, t); if (r.ok) setLedger(r.ledger); else flash(r.why ?? 'Not yet') } }} />
      <TradeHud ledger={ledger} objective={objective} toast={null} purse={false} />
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

      {hud.foot && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, margin: -2, borderRadius: 2, background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
      )}
      {hud.foot && !ptrLocked && !isTouch && !showMap && !garage && !board && (
        <div style={{ position: 'absolute', left: '50%', top: '42%', transform: 'translateX(-50%)', padding: '7px 16px', borderRadius: 999, background: 'rgba(12,16,20,0.66)', color: '#f4efe2', font: '600 12px system-ui', letterSpacing: '0.16em', textTransform: 'uppercase', pointerEvents: 'none' }}>Click to resume</div>
      )}
      {hud.prompt && (
        <div style={{ position: 'absolute', left: '50%', top: '62%', transform: 'translateX(-50%)', padding: '6px 14px', borderRadius: 8, background: 'rgba(10,12,18,0.7)', color: '#f4efe2', font: '600 12px var(--font-game), system-ui', letterSpacing: '0.18em', textTransform: 'uppercase', pointerEvents: 'none' }}>
          {hud.prompt}
        </div>
      )}
      <div hidden={!!hud.foot} style={{ position: 'absolute', ...(isTouch ? { left: 14, top: 64, textAlign: 'left' as const } : { left: '50%', transform: 'translateX(-50%)', bottom: 16, /* bottom-centre is free in the template */ textAlign: 'center' as const }), color: '#f4efe2', pointerEvents: 'none', textShadow: '0 2px 8px rgba(0,0,0,0.55)' }}>
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
      {R && !started && (
        <div onPointerDown={isTouch ? () => setStarted(true) : undefined} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: isTouch ? 'auto' : 'none', zIndex: 30 }}>
          <div style={{ padding: '18px 24px', borderRadius: 10, background: 'rgba(12,16,20,0.72)', color: '#eef3f6', font: '14px system-ui, sans-serif', lineHeight: 1.65, textAlign: 'center', maxWidth: 460 }}>
            <div style={{ font: '600 13px system-ui', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>The Darter · Ashfeld</div>
            You start on the road out of Ashfeld. It runs down to Millbrook on the river; the trunk south ends at Rune Hold under the Spine.
            {isTouch ? <div style={{ marginTop: 8 }}>Left thumb drives: push up for throttle, down to brake, sideways to steer. Hold drift for the handbrake. On foot, drag on the right to look.</div> : <div style={{ marginTop: 8 }}>W / ↑ throttle · S / ↓ brake · A D steer · Space handbrake · C camera · R back to the road · G garage · E board (stopped at a town) · F get out / in (on foot: mouse look, Space jump, Shift slide) · M map</div>}
            <div style={{ marginTop: 8, fontWeight: 600 }}>{isTouch ? 'Tap to drive' : 'Press any key to drive'}</div>
          </div>
        </div>
      )}
    </div>
  )
}
