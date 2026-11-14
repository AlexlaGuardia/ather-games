'use client'

// /shimmer/open/ather — THE ATHER SIDE of the open world, first slice (Alex 11-14, Jin/world).
//
// Two zones and the travel between them:
//   · THE HOME PLOT — your fold, a floating island; the edge is a fall that returns you to the threshold. The GATE
//     STATION's half-circle faces the threshold: centre = the one gate (to Athernyx: the continent page), left arc =
//     passages to the Wilds off your waymarks, right arc = the Chord / Lingston / kept settlements (dark, not yet).
//   · THE WILDS — the continent's land in the Ather's state (world/ather.md 09-07), one 1 km tile cut from the same
//     height map the coursers drive: river country, meadow, the Deep Woods' edge. No roads, no towns, no names.
// Waymarks: F plants one where you stand (rules in waymarks.ts); each lights a socket at home. M opens the fold map,
// Tab flips it between the Ather and Athernyx (same ground, two states). H walks home from the Wilds.
//
// Desktop only for this slice (pointer lock + keys), like the other open-world pages.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelDayNight } from '../../voxel3d/day-night'
import { terrainWorld } from '../terrain-world'
import { Walker, verbOf, type Loco } from './walker'
import {
  PLOT_SHAPE, PLOT_N, PLOT_CELL, PLOT_HALF, PLOT_R, THRESHOLD, FALL_Y, SOCKET_REACH,
  plotHeightAt, plotVertexHeight, plotCellIsLand, stationSockets, type SocketSlot,
} from './plot'
import { loadWilds, BIOME, BIOME_NAME, type Wilds, type BiomeId } from './wilds'
import {
  canPlant, plant, lift, reachedBiomes, waymarkForSocket, loadWaymarks, saveWaymarks,
  GREG_WAYMARK, MAX_WAYMARKS, type Waymark,
} from './waymarks'

const TILE = 'first-wilds'
const PLOT_WORLD = terrainWorld(PLOT_SHAPE)
const SOCKETS = stationSockets()

type Zone = { kind: 'plot' } | { kind: 'wilds'; tile: string }
type Spawn = { x: number; z: number; yaw: number }

// ── palette: the Ather's visual language (world/ather.md): soft light, warm golds, soft greens, peaceful blues ──
const P = {
  grass: new THREE.Color('#9cc46a'), grassHi: new THREE.Color('#c4d985'), gold: new THREE.Color('#e3cf8a'),
  woods: new THREE.Color('#5f9a5c'), woodsHi: new THREE.Color('#7bb06a'), shore: new THREE.Color('#e6d6a0'),
  bed: new THREE.Color('#7fa7a0'), rock: new THREE.Color('#a59a8a'), under: '#8d8275', water: '#7cc2d6',
}

// ── the plot ────────────────────────────────────────────────────────────────────────────────────────────────────
function plotGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = []
  const v = (i: number, j: number) => [i * PLOT_CELL - PLOT_HALF, plotVertexHeight(i, j), j * PLOT_CELL - PLOT_HALF] as const
  const c = new THREE.Color()
  for (let j = 0; j < PLOT_N; j++) for (let i = 0; i < PLOT_N; i++) {
    if (!plotCellIsLand(i, j)) continue
    const p00 = v(i, j), p10 = v(i + 1, j), p01 = v(i, j + 1), p11 = v(i + 1, j + 1)
    for (const tri of [[p00, p11, p10], [p00, p01, p11]] as const) {
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3
      const r = Math.hypot(cx, cz) / PLOT_R
      c.copy(P.grass).lerp(P.grassHi, Math.max(0, 0.6 - r) * 0.8).lerp(P.gold, (((cx * 0.37 + cz * 0.23) % 1) + 1) % 1 * 0.18)
      for (const p of tri) { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b) }
    }
    // the cut face where the land stops: a skirt down each exposed edge, so the edge reads as made ground
    const drop = -2.2
    const edges: [number, number, readonly [number, number, number], readonly [number, number, number]][] = [
      [0, -1, p00, p10], [1, 0, p10, p11], [0, 1, p11, p01], [-1, 0, p01, p00],
    ]
    for (const [di, dj, a, b] of edges) {
      if (plotCellIsLand(i + di, j + dj)) continue
      const sc = new THREE.Color(P.under)
      const quad = [a, b, [b[0], drop, b[2]], a, [b[0], drop, b[2]], [a[0], drop, a[2]]] as const
      for (const p of quad) { pos.push(p[0], p[1], p[2]); col.push(sc.r, sc.g, sc.b) }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function Socket({ s, lit }: { s: SocketSlot; lit: boolean }) {
  const y = plotHeightAt(s.x, s.z) - 0.4
  if (s.cls === 'gate') {
    // The one gate, unlike its neighbours (canon: render the centre socket visibly singular).
    return (
      <group position={[s.x, y, s.z]}>
        <mesh position-y={0.375}><cylinderGeometry args={[1.0, 1.1, 0.75, 10]} /><meshLambertMaterial color="#b9ab90" flatShading /></mesh>
        <mesh position-y={2.5}><torusGeometry args={[1.5, 0.16, 6, 20]} /><meshLambertMaterial color="#e7c766" emissive="#c79a2e" emissiveIntensity={0.55} flatShading /></mesh>
        <mesh position-y={2.5}><circleGeometry args={[1.38, 20]} /><meshBasicMaterial color="#f4e3b0" transparent opacity={0.32} side={THREE.DoubleSide} /></mesh>
      </group>
    )
  }
  const glow = s.cls === 'wilds' ? '#6fd3c4' : '#c9a6e8'
  return (
    <group position={[s.x, y, s.z]}>
      <mesh position-y={0.375}><cylinderGeometry args={[0.75, 0.85, 0.75, 8]} /><meshLambertMaterial color={lit ? '#c8bea8' : '#8f8a80'} flatShading /></mesh>
      <mesh position-y={0.76} rotation-x={-Math.PI / 2}><circleGeometry args={[0.6, 12]} /><meshBasicMaterial color={lit ? glow : '#55534f'} /></mesh>
      {lit && <mesh position-y={1.7}><octahedronGeometry args={[0.28]} /><meshLambertMaterial color={glow} emissive={glow} emissiveIntensity={0.8} flatShading /></mesh>}
    </group>
  )
}

function PlotScene({ waymarks }: { waymarks: Waymark[] }) {
  const geo = useMemo(plotGeometry, [])
  const puffs = useMemo(() => Array.from({ length: 26 }, (_, k) => {
    const a = k * 2.399, r = 60 + (k * 37 % 90)
    return { x: Math.cos(a) * r, y: -36 + (k * 13 % 14), z: Math.sin(a) * r, s: 6 + (k * 7 % 9) }
  }), [])
  return (
    <>
      <mesh geometry={geo}><meshLambertMaterial vertexColors flatShading /></mesh>
      {/* the island's underside: a fold's root of stone, hanging over the cloud sea */}
      <mesh position-y={-12} rotation-x={Math.PI}><coneGeometry args={[PLOT_R * 0.92, 20, 11, 2]} /><meshLambertMaterial color={P.under} flatShading /></mesh>
      <mesh position-y={-46} rotation-x={-Math.PI / 2}><planeGeometry args={[2000, 2000]} /><meshLambertMaterial color="#f3efe6" /></mesh>
      {puffs.map((p, k) => <mesh key={k} position={[p.x, p.y, p.z]} scale={p.s}><icosahedronGeometry args={[1, 0]} /><meshLambertMaterial color="#fbf8f1" flatShading /></mesh>)}
      {/* the threshold: where the fold sets you down */}
      <mesh position={[THRESHOLD.x, plotHeightAt(THRESHOLD.x, THRESHOLD.z) + 0.03, THRESHOLD.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.1, 1.45, 18]} /><meshBasicMaterial color="#efe0a8" />
      </mesh>
      {SOCKETS.map(s => <Socket key={s.id} s={s} lit={s.cls === 'gate' || (s.cls === 'wilds' && !!waymarkForSocket(waymarks, Number(s.id.split('-')[1])))} />)}
    </>
  )
}

// ── the Wilds ───────────────────────────────────────────────────────────────────────────────────────────────────
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
  // frustumCulled off: an InstancedMesh is culled by its base geometry's bounds at the origin (see open/page.tsx)
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
function WaymarkStone({ w, greg }: { w: Waymark; greg?: boolean }) {
  const glow = greg ? '#e7c766' : '#6fd3c4'
  return (
    <group position={[w.x, w.y, w.z]}>
      <mesh position-y={0.8}><boxGeometry args={[0.55, 1.6, 0.45]} /><meshLambertMaterial color="#b8ae9c" flatShading /></mesh>
      <mesh position-y={2.15} rotation-x={Math.PI / 2}><torusGeometry args={[0.55, 0.06, 5, 16]} /><meshLambertMaterial color={glow} emissive={glow} emissiveIntensity={0.9} /></mesh>
      <mesh position-y={0.02} rotation-x={-Math.PI / 2}><ringGeometry args={[1.2, 1.5, 16]} /><meshBasicMaterial color={glow} transparent opacity={0.55} /></mesh>
    </group>
  )
}

function WildsScene({ W, waymarks }: { W: Wilds; waymarks: Waymark[] }) {
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

// ── the fold map ────────────────────────────────────────────────────────────────────────────────────────────────
function FoldMap({ view, W, waymarks, here, zone }: { view: 'ather' | 'athernyx'; W: Wilds | null; waymarks: Waymark[]; here: { x: number; z: number }; zone: Zone }) {
  const sx = W?.meta.sizeX ?? 1000, sz = W?.meta.sizeZ ?? 1000
  const pct = (x: number, z: number) => ({ left: `${((x + sx / 2) / sx) * 100}%`, top: `${((z + sz / 2) / sz) * 100}%` })
  const src = W?.meta.source ?? { x0: 770, y0: 420, x1: 870, y1: 520 }
  const dot = (bg: string, size = 10): React.CSSProperties => ({ position: 'absolute', width: size, height: size, margin: -size / 2, borderRadius: size, background: bg, boxShadow: '0 0 0 2px rgba(20,24,28,0.7)' })
  const reached = reachedBiomes(waymarks)
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(12,16,20,0.55)' }}>
      <div style={{ width: 'min(92vw, 720px)', padding: 16, borderRadius: 12, background: 'rgba(24,28,32,0.92)', color: '#eef3f6', font: '13px system-ui, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ font: '600 12px system-ui', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            {view === 'ather' ? 'The fold map · the Ather' : 'The fold map · Athernyx'}
          </div>
          <div style={{ opacity: 0.6, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Tab flips · M closes</div>
        </div>
        {view === 'ather' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 14 }}>
            <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#334' }}>
              <img src={`/open/wilds/${TILE}-map.png`} alt="" style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }} />
              <div title="Gregory's waymark" style={{ ...dot('#e7c766', 12), ...pct(GREG_WAYMARK.x, GREG_WAYMARK.z) }} />
              {waymarks.filter(w => w.tile === TILE).map(w => <div key={w.id} style={{ ...dot('#6fd3c4', 12), ...pct(w.x, w.z) }} />)}
              {zone.kind === 'wilds' && <div style={{ ...dot('#ffffff', 8), ...pct(here.x, here.z) }} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, lineHeight: 1.5 }}>
              <div><div style={{ opacity: 0.55, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Your plot</div>A fold of its own, tied to no ground. {zone.kind === 'plot' ? 'You are here.' : ''}</div>
              <div><div style={{ opacity: 0.55, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Waymarks</div><span style={{ fontVariantNumeric: 'tabular-nums' }}>{waymarks.length} / {MAX_WAYMARKS}</span> planted, plus Gregory&apos;s</div>
              <div><div style={{ opacity: 0.55, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Country reached</div>{reached.length ? reached.map(b => BIOME_NAME[b]).join(' · ') : 'none of your own yet'}</div>
              <div style={{ opacity: 0.6, fontSize: 11 }}><span style={{ color: '#e7c766' }}>●</span> Gregory&apos;s &nbsp;<span style={{ color: '#6fd3c4' }}>●</span> yours &nbsp;○ you</div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
              <img src="/open/wilds/continent-relief.jpg" alt="" style={{ width: '100%', display: 'block' }} />
              <div style={{ position: 'absolute', left: `${(src.x0 / 1168) * 100}%`, top: `${(src.y0 / 784) * 100}%`, width: `${((src.x1 - src.x0) / 1168) * 100}%`, height: `${((src.y1 - src.y0) / 784) * 100}%`, border: '2px solid #6fd3c4', boxShadow: '0 0 0 2px rgba(0,0,0,0.5)' }} />
            </div>
            <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>The same ground in its other state. Your Wilds stand on the marked country.</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── the page ────────────────────────────────────────────────────────────────────────────────────────────────────
export default function AtherSlice() {
  const locked = useRef(false), frozen = useRef(false)
  const [isLocked, setLocked] = useState(false)
  const [zone, setZone] = useState<Zone>({ kind: 'plot' })
  const [spawn, setSpawn] = useState<Spawn>(THRESHOLD)
  const [epoch, setEpoch] = useState(0)                 // remounts the walker on every arrival
  const [W, setW] = useState<Wilds | null>(null)
  const [waymarks, setWaymarks] = useState<Waymark[]>([])
  const [map, setMap] = useState<null | 'ather' | 'athernyx'>(null)
  const [prompt, setPrompt] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [fade, setFade] = useState(0)
  const [hud, setHud] = useState({ verb: 'idle', biome: '' })
  const pos = useRef({ x: THRESHOLD.x, z: THRESHOLD.z, grounded: true, swimming: false })
  const near = useRef<{ kind: 'socket'; s: SocketSlot } | { kind: 'own'; w: Waymark } | null>(null)
  const hudT = useRef(0)

  useEffect(() => { setWaymarks(loadWaymarks()) }, [])
  useEffect(() => { loadWilds(TILE).then(setW).catch(e => setToast(`The Wilds would not load: ${e.message}`)) }, [])
  useEffect(() => {
    const ch = () => { locked.current = !!document.pointerLockElement; setLocked(locked.current) }
    document.addEventListener('pointerlockchange', ch)
    return () => document.removeEventListener('pointerlockchange', ch)
  }, [])
  useEffect(() => { frozen.current = map !== null }, [map])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t) }, [toast])

  const fading = useRef(false)   // a fall reports every frame until the fade lands: arrive once
  const arrive = useCallback((z: Zone, s: Spawn) => {
    if (fading.current) return
    fading.current = true; setFade(1)
    setTimeout(() => { setZone(z); setSpawn(s); setEpoch(e => e + 1); setFade(0); fading.current = false }, 380)
  }, [])
  const goHome = useCallback(() => arrive({ kind: 'plot' }, THRESHOLD), [arrive])

  const world = useMemo(() => zone.kind === 'plot' ? PLOT_WORLD : W ? terrainWorld(W.shape) : null, [zone, W])
  const ground = useMemo(() => zone.kind === 'plot' ? plotHeightAt : W ? W.heightAt : () => 0, [zone, W])

  const onTick = useCallback((lc: Loco) => {
    pos.current = { x: lc.px, z: lc.pz, grounded: !lc.airborne, swimming: lc.swimming }
    // what is in reach
    let n: typeof near.current = null
    if (zone.kind === 'plot') {
      let best = SOCKET_REACH
      for (const s of SOCKETS) { const d = Math.hypot(s.x - lc.px, s.z - lc.pz); if (d < best) { best = d; n = { kind: 'socket', s } } }
    } else {
      for (const w of waymarks) if (w.tile === zone.tile && Math.hypot(w.x - lc.px, w.z - lc.pz) < 2.5) n = { kind: 'own', w }
    }
    near.current = n
    hudT.current -= 1 / 60
    if (hudT.current <= 0) {
      hudT.current = 0.12
      let p: string | null = null
      if (n?.kind === 'socket') {
        const s = n.s
        if (s.cls === 'gate') p = 'E · step through the gate (Athernyx)'
        else if (s.cls === 'wilds') {
          const w = waymarkForSocket(waymarks, Number(s.id.split('-')[1]))
          p = w ? `E · passage to ${w.id === 'greg' ? "Gregory's waymark" : `your waymark (${BIOME_NAME[w.biome]})`}` : 'A dark socket · plant a waymark in the Wilds to light it'
        } else p = s.label
      } else if (n?.kind === 'own') p = 'L · lift this waymark'
      setPrompt(p)
      setHud({ verb: verbOf(lc), biome: zone.kind === 'wilds' && W ? BIOME_NAME[W.biomeAt(lc.px, lc.pz)] : 'your plot' })
    }
  }, [zone, waymarks, W])

  const enterSocket = useCallback((s: SocketSlot) => {
    if (s.cls === 'gate') { setFade(1); setTimeout(() => { window.location.href = '/shimmer/open/continent' }, 380); return }
    if (s.cls === 'wilds') {
      const w = waymarkForSocket(waymarks, Number(s.id.split('-')[1]))
      if (!w) { setToast('This socket is dark. Plant a waymark out in the Wilds and it will light.'); return }
      if (!W) { setToast('The Wilds are still loading.'); return }
      arrive({ kind: 'wilds', tile: w.tile }, { x: w.x + 2.2, z: w.z + 2.2, yaw: Math.PI * 0.75 })
      return
    }
    setToast('Not yet.')
  }, [waymarks, W, arrive])
  // Scripted shots and flows: use a socket by id without standing at it (headless tabs throttle frames, so the
  // per-frame reach check may never run).
  useEffect(() => {
    const g = window as unknown as { __ather?: Record<string, unknown> }
    g.__ather = { ...(g.__ather ?? {}), socket: (id: string) => { const s = SOCKETS.find(k => k.id === id); if (s) enterSocket(s); return !!s }, zone: () => zone.kind }
  }, [enterSocket, zone])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') { setMap(m => m ? null : 'ather'); return }
      if (e.code === 'Tab' && map) { e.preventDefault(); setMap(m => m === 'ather' ? 'athernyx' : 'ather'); return }
      if (map || fade) return
      const n = near.current
      if (e.code === 'KeyE' && n?.kind === 'socket') enterSocket(n.s)
      if (e.code === 'KeyF' && zone.kind === 'wilds' && W) {
        const p = pos.current, biome = W.biomeAt(p.x, p.z)
        const v = canPlant(waymarks, { tile: zone.tile, x: p.x, z: p.z, biome, grounded: p.grounded, swimming: p.swimming })
        if (!v.ok) { setToast(v.why); return }
        const next = plant(waymarks, { tile: zone.tile, x: p.x, y: W.heightAt(p.x, p.z), z: p.z, biome })
        setWaymarks(next); saveWaymarks(next)
        setToast(`Waymark bound in the ${BIOME_NAME[biome]}. A socket lights at home.`)
      }
      if (e.code === 'KeyL' && n?.kind === 'own') {
        const next = lift(waymarks, n.w.id); setWaymarks(next); saveWaymarks(next); setToast('Waymark lifted. Its socket goes dark.')
      }
      if (e.code === 'KeyH' && zone.kind === 'wilds') goHome()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [map, fade, zone, waymarks, W, goHome, enterSocket])

  const zoneName = zone.kind === 'plot' ? 'Your plot' : 'The Wilds'
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#bcd6e6' }}>
      <Canvas
        camera={{ fov: 75, near: 0.05, far: 900, position: [THRESHOLD.x, 2, THRESHOLD.z] }}
        onClick={(e) => (e.target as HTMLCanvasElement).requestPointerLock?.()}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <VoxelDayNight gloomAt={zone.kind === 'wilds' && W ? (x, z) => W.canopyAt(x, z) * 0.7 : undefined} />
        {zone.kind === 'plot' && <PlotScene waymarks={waymarks} />}
        {zone.kind === 'wilds' && W && <WildsScene W={W} waymarks={waymarks} />}
        {world && (
          <Walker
            key={epoch} world={world} ground={ground} spawn={spawn} locked={locked} frozen={frozen}
            fallY={zone.kind === 'plot' ? FALL_Y : -60}
            onFall={goHome}
            onTick={onTick}
          />
        )}
      </Canvas>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, margin: -2, borderRadius: 2, background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 12, top: 12, padding: '6px 10px', borderRadius: 6, background: 'rgba(12,16,20,0.55)', color: '#eef3f6', pointerEvents: 'none' }}>
        <div style={{ font: '600 11px system-ui', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{zoneName}</div>
        <div style={{ font: '11px ui-monospace, monospace', opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{hud.biome} · {hud.verb}</div>
      </div>
      <div style={{ position: 'absolute', right: 12, top: 12, padding: '6px 10px', borderRadius: 6, background: 'rgba(12,16,20,0.55)', color: '#eef3f6', font: '11px system-ui', letterSpacing: '0.08em', pointerEvents: 'none', textAlign: 'right' }}>
        WAYMARKS <span style={{ fontVariantNumeric: 'tabular-nums' }}>{waymarks.length}/{MAX_WAYMARKS}</span><br />
        <span style={{ opacity: 0.65 }}>M map{zone.kind === 'wilds' ? ' · F plant · H home' : ''}</span>
      </div>
      {prompt && (
        <div style={{ position: 'absolute', left: '50%', top: '58%', transform: 'translateX(-50%)', padding: '6px 12px', borderRadius: 6, background: 'rgba(12,16,20,0.65)', color: '#f4efe2', font: '13px system-ui', pointerEvents: 'none' }}>{prompt}</div>
      )}
      {toast && (
        <div style={{ position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)', padding: '8px 14px', borderRadius: 8, background: 'rgba(24,28,32,0.85)', color: '#f4efe2', font: '13px system-ui', pointerEvents: 'none', maxWidth: '80vw', textAlign: 'center' }}>{toast}</div>
      )}
      {map && <FoldMap view={map} W={W} waymarks={waymarks} here={pos.current} zone={zone} />}
      <div style={{ position: 'absolute', inset: 0, background: '#f6f1e4', opacity: fade, transition: 'opacity 0.35s', pointerEvents: 'none' }} />
      {!isLocked && !map && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ padding: '18px 24px', borderRadius: 10, background: 'rgba(12,16,20,0.72)', color: '#eef3f6', font: '14px system-ui, sans-serif', lineHeight: 1.6, textAlign: 'center', maxWidth: 520 }}>
            <div style={{ font: '600 13px system-ui', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>Ather · your plot and the Wilds</div>
            Click to play<br />
            WASD move · Space jump / climb · Shift slide · E use · M fold map · Esc release
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
              The station faces you. The left arc goes to the Wilds; Gregory&apos;s waymark is lit. In the Wilds, F plants a waymark of your own and H walks home. Walk off the edge of your plot and the fold brings you back.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
