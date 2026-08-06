'use client'

// The voxel world you can walk. A test bed, on its own route, on purpose.
//
// ⚠ NOT WIRED INTO Shimmer3D, DELIBERATELY. That file is ~5,900 lines of the live game (mortal
// side, holds, Crucible, and the warp/mount path that produced four bugs on 08-06) while this walks
// a DIFFERENT WORLD MODEL — no zones, no tiles, no warps. Grafting one into the other means
// threading two incompatible worlds through one mount path. Integration is a later decision.
//
// ★ GENERATION AND MESHING RUN IN A WORKER (`gen.worker.ts`). Measured on the main thread they were
// ~109ms + ~47ms per 64-wide chunk — nine frames of hitch every time you walk into new country.
// The worker owns the Columns (meshing needs a column's four neighbours, so whoever meshes must
// hold them); this file only ever sees finished vertex buffers plus a voxel copy for collision.

import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { SECTION, DEFAULT_COLUMN, makeColumn, meshColumn, type Column } from '../voxel/column'
import { createMeshScratch } from '../voxel/greedy'
import { buildAttrs } from './attrs'
import { columnHeight } from '../voxel/height'
import { AIR } from '../voxel/section'
import { MAT } from '../voxel/depth'
import { toGeometry, createVoxelMaterial } from './mesh-bridge'
import type { SectionPayload } from './gen.worker'

const SEED = 1337
const H = DEFAULT_COLUMN.worldHeight
/** Columns are 16 wide; radius 7 gives a 15x15 window ≈ 240 units of view. */
const RADIUS = 7
/** Requests in flight. The worker is fast but not free — flooding it just builds a queue that
 *  ignores the player walking somewhere else, so the window is small and refilled nearest-first. */
const MAX_INFLIGHT = 3

const key = (cx: number, cz: number) => `${cx},${cz}`

export default function VoxelWorld() {
  const [stats, setStats] = useState('booting worker…')
  const [fatal, setFatal] = useState(false)
  const [pos, setPos] = useState('')
  const voxels = useRef(new Map<string, Uint16Array>())
  const pending = useRef(new Map<string, SectionPayload[]>())
  const requested = useRef(new Set<string>())
  const inflight = useRef(0)
  const worker = useRef<Worker | null>(null)
  const alive = useRef(false)
  const [fallback, setFallback] = useState(false)

  // ★ A WORKER THAT FAILS TO CONSTRUCT MUST NOT FAIL SILENTLY. Bundlers disagree about
  // `new Worker(new URL(...))`, and the failure mode is a page that renders nothing, logs nothing,
  // and looks exactly like a throttled tab. Every path here reports to the HUD, and the constructor
  // is wrapped so a bundling failure cannot take the React tree down with it.
  useEffect(() => {
    let w: Worker
    try {
      // ⚠ `type: 'module'` IS REQUIRED, and omitting it fails in the worst possible way. The worker
      // is bundled as an ES module (it imports the voxel core), and a CLASSIC worker cannot parse
      // `import`. The Worker object still constructs, still accepts postMessage, and never fires
      // onerror — it simply never replies. Symptom: "0 columns · 0 meshes · N in flight", forever,
      // with an empty console. Diagnosed exactly that way.
      w = new Worker(new URL('./gen.worker.ts', import.meta.url), { type: 'module' })
    } catch (err) {
      setStats(`WORKER FAILED TO START: ${String(err)}`)
      setFatal(true)
      return
    }
    worker.current = w
    w.onerror = (ev) => {
      setStats(`WORKER ERROR: ${ev.message || 'unknown'} @ ${ev.filename ?? '?'}:${ev.lineno ?? '?'}`)
      setFatal(true)
      worker.current = null
    }
    w.onmessageerror = () => setStats('WORKER: message could not be deserialised')
    w.postMessage({ type: 'init', seed: SEED })
    w.onmessage = (e: MessageEvent) => {
      alive.current = true
      const m = e.data
      if (m.type === 'column') voxels.current.set(key(m.cx, m.cz), m.voxels as Uint16Array)
      else if (m.type === 'mesh') pending.current.set(key(m.cx, m.cz), m.sections as SectionPayload[])
      else if (m.type === 'done') inflight.current = Math.max(0, inflight.current - 1)
    }

    // ★ THE WORKER IS AN OPTIMISATION, SO IT MUST NEVER BE A SINGLE POINT OF FAILURE.
    // A worker can construct, accept postMessage, and never reply — no error, no console output,
    // just an empty world (that is exactly what a CLASSIC worker does when handed ES module code).
    // An optimisation that can silently blank the page is worse than no optimisation, so if nothing
    // has come back by the time this fires, tear it down and generate on the main thread. Slower,
    // hitchier, and definitely working.
    const probe = setTimeout(() => {
      if (alive.current) return
      w.terminate()
      worker.current = null
      setFallback(true)
      setStats('worker never replied — generating on the main thread (slower)')
    }, 4000)

    return () => { clearTimeout(probe); w.terminate(); worker.current = null }
  }, [])

  /** Voxel lookup in world space for collision. AIR outside loaded columns. */
  const voxel = useCallback((wx: number, wy: number, wz: number): number => {
    if (wy < 0 || wy >= H) return AIR
    const cx = Math.floor(wx / SECTION), cz = Math.floor(wz / SECTION)
    const v = voxels.current.get(key(cx, cz))
    if (!v) return AIR
    const lx = wx - cx * SECTION, lz = wz - cz * SECTION
    const s = (wy / SECTION) | 0
    const ly = wy - s * SECTION
    return v[s * SECTION * SECTION * SECTION + (ly * SECTION + lz) * SECTION + lx]
  }, [])

  return (
    <div className="fixed inset-0 bg-[#0b0d14]">
      <Canvas camera={{ fov: 75, near: 0.1, far: 600 }} shadows={false}>
        <color attach="background" args={['#8fb7d9']} />
        <fog attach="fog" args={['#8fb7d9', 90, 240]} />
        <hemisphereLight args={['#cfe6ff', '#3b3a4a', 1.5]} />
        <directionalLight position={[80, 200, 40]} intensity={1.5} />
        <ambientLight intensity={0.35} />
        <Terrain
          worker={worker} pending={pending} requested={requested} inflight={inflight}
          voxels={voxels} onStats={setStats} fallback={fallback}
        />
        <Player voxel={voxel} onPos={p => setPos(`x ${p.x.toFixed(0)}  y ${p.y.toFixed(0)}  z ${p.z.toFixed(0)}`)} />
        <PointerLockControls />
      </Canvas>

      <div className="absolute top-3 left-3 text-[11px] font-mono text-white/80 bg-black/45 rounded px-2.5 py-1.5 leading-relaxed pointer-events-none">
        <div className="text-white/95 font-semibold tracking-wide">SHIMMER · VOXEL TEST BED</div>
        <div>{pos}</div>
        <div className="text-white/55">{stats}</div>
        <div className="mt-1 text-white/45">click to look · WASD · space jump · shift run · F fly</div>
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/70 pointer-events-none" />
      {fatal && (
        <div className="absolute inset-x-0 bottom-0 bg-red-950/90 text-red-200 text-[11px] font-mono px-3 py-2 leading-relaxed">
          The generation worker is not running, so no terrain will ever appear. The message above is
          the reason. This is reported rather than left blank because a dead worker and a throttled
          tab look identical — both are a black screen with an empty console.
        </div>
      )}
    </div>
  )
}

function Terrain({ worker, pending, requested, inflight, voxels, onStats, fallback }: {
  worker: React.RefObject<Worker | null>
  pending: React.RefObject<Map<string, SectionPayload[]>>
  requested: React.RefObject<Set<string>>
  inflight: React.RefObject<number>
  voxels: React.RefObject<Map<string, Uint16Array>>
  onStats: (s: string) => void
  fallback: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const material = useMemo(() => createVoxelMaterial(), [])
  const drawn = useRef(new Map<string, THREE.Mesh>())
  const frame = useRef(0)
  // Main-thread fallback state. Only touched when the worker failed to answer.
  const localCols = useRef(new Map<string, Column>())
  const scratch = useMemo(() => createMeshScratch(SECTION), [])

  /** Fallback generator: same pipeline, wrong thread. Budgeted so the tab stays responsive. */
  const localStep = useCallback((cx: number, cz: number, g: THREE.Group) => {
    const k = key(cx, cz)
    if (localCols.current.has(k)) return
    const col = makeColumn(cx * SECTION, cz * SECTION, SEED)
    localCols.current.set(k, col)
    const packed = new Uint16Array(SECTION * SECTION * H)
    for (let i = 0; i < col.sections.length; i++) packed.set(col.sections[i].data, i * SECTION * SECTION * SECTION)
    voxels.current!.set(k, packed)
    for (const [dx, dz] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nk = key(cx + dx, cz + dz)
      const nc = localCols.current.get(nk)
      if (!nc) continue
      for (const [mk, m] of drawn.current) {
        if (!mk.startsWith(nk + ':')) continue
        g.remove(m); m.geometry.dispose(); drawn.current.delete(mk)
      }
      for (const sm of meshColumn(nc, {
        negX: localCols.current.get(key(cx + dx - 1, cz + dz)) ?? null,
        posX: localCols.current.get(key(cx + dx + 1, cz + dz)) ?? null,
        negZ: localCols.current.get(key(cx + dx, cz + dz - 1)) ?? null,
        posZ: localCols.current.get(key(cx + dx, cz + dz + 1)) ?? null,
      }, scratch)) {
        const mesh = new THREE.Mesh(toGeometry(buildAttrs(sm.mesh)), material)
        mesh.position.set(sm.wx, sm.wy, sm.wz)
        g.add(mesh)
        drawn.current.set(`${nk}:${sm.index}`, mesh)
      }
    }
  }, [material, scratch, voxels])

  useFrame(({ camera }) => {
    const w = worker.current
    const g = group.current
    if (!g) return

    if (fallback) {
      const cx = Math.floor(camera.position.x / SECTION)
      const cz = Math.floor(camera.position.z / SECTION)
      const want: [number, number, number][] = []
      for (let dz = -RADIUS; dz <= RADIUS; dz++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const d = dx * dx + dz * dz
        if (d > RADIUS * RADIUS) continue
        if (!localCols.current.has(key(cx + dx, cz + dz))) want.push([d, cx + dx, cz + dz])
      }
      want.sort((a, b) => a[0] - b[0])
      const t0 = performance.now()
      for (const [, gx, gz] of want) {
        if (performance.now() - t0 > 8) break
        localStep(gx, gz, g)
      }
      onStats(`${localCols.current.size} columns · ${drawn.current.size} meshes · MAIN THREAD`)
      return
    }

    if (!w) return
    const cx = Math.floor(camera.position.x / SECTION)
    const cz = Math.floor(camera.position.z / SECTION)

    // ── ask for what is missing, nearest first ───────────────────────────────────────────────
    if (inflight.current < MAX_INFLIGHT) {
      const want: [number, number, number][] = []
      for (let dz = -RADIUS; dz <= RADIUS; dz++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const d = dx * dx + dz * dz
        if (d > RADIUS * RADIUS) continue
        const k = key(cx + dx, cz + dz)
        if (!requested.current.has(k)) want.push([d, cx + dx, cz + dz])
      }
      want.sort((a, b) => a[0] - b[0])
      for (const [, gx, gz] of want) {
        if (inflight.current >= MAX_INFLIGHT) break
        requested.current.add(key(gx, gz))
        inflight.current++
        w.postMessage({ type: 'request', cx: gx, cz: gz })
      }
    }

    // ── upload finished meshes — the ONLY per-chunk work left on this thread ─────────────────
    // Bounded per frame: a burst of worker replies must not turn into one long GPU upload stall.
    let uploads = 0
    for (const [k, sections] of pending.current) {
      if (uploads >= 2) break
      pending.current.delete(k)
      uploads++
      // Replace, don't append: a re-mesh (a neighbour appeared) supersedes what was drawn before.
      for (const [mk, m] of drawn.current) {
        if (!mk.startsWith(k + ':')) continue
        g.remove(m); m.geometry.dispose(); drawn.current.delete(mk)
      }
      for (const sm of sections) {
        const mesh = new THREE.Mesh(toGeometry(sm.attrs), material)
        mesh.position.set(sm.wx, sm.wy, sm.wz)
        g.add(mesh)
        drawn.current.set(`${k}:${sm.index}`, mesh)
      }
    }

    // ── evict what left the window ───────────────────────────────────────────────────────────
    // Every 60 frames, not every frame: this walks every loaded column and the answer changes only
    // when the player crosses a column border.
    if (++frame.current % 60 === 0) {
      const keep = new Set<string>()
      for (let dz = -RADIUS; dz <= RADIUS; dz++) for (let dx = -RADIUS; dx <= RADIUS; dx++)
        keep.add(key(cx + dx, cz + dz))
      for (const [mk, m] of drawn.current) {
        if (keep.has(mk.slice(0, mk.lastIndexOf(':')))) continue
        g.remove(m); m.geometry.dispose(); drawn.current.delete(mk)
      }
      for (const k of [...voxels.current.keys()]) if (!keep.has(k)) voxels.current.delete(k)
      for (const k of [...requested.current]) if (!keep.has(k)) requested.current.delete(k)
      w.postMessage({ type: 'evict', keep: [...keep] })
    }

    onStats(`${voxels.current.size} columns · ${drawn.current.size} meshes · ${inflight.current} in flight`)
  })

  return <group ref={group} />
}

const SOLID_EXCEPT = new Set<number>([AIR, MAT.WATER])
const isSolid = (m: number) => !SOLID_EXCEPT.has(m)

function Player({ voxel, onPos }: { voxel: (x: number, y: number, z: number) => number; onPos: (p: THREE.Vector3) => void }) {
  const { camera } = useThree()
  const vel = useRef(new THREE.Vector3())
  const keys = useRef<Record<string, boolean>>({})
  const fly = useRef(false)
  const onGround = useRef(false)
  const settled = useRef(false)

  useEffect(() => {
    const d = (e: KeyboardEvent) => { keys.current[e.code] = true; if (e.code === 'KeyF') fly.current = !fly.current }
    const u = (e: KeyboardEvent) => { keys.current[e.code] = false }
    window.addEventListener('keydown', d); window.addEventListener('keyup', u)
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u) }
  }, [])

  // Spawn on the surface. columnHeight is pure, so the spawn point is known before a single voxel
  // exists — which is also why the camera never starts inside rock while the worker is still busy.
  useEffect(() => { camera.position.set(0.5, columnHeight(0, 0, SEED) + 2.6, 0.5) }, [camera])

  const EYE = 1.62, HALF = 0.3

  const blocked = useCallback((x: number, y: number, z: number) => {
    const y0 = Math.floor(y - EYE), y1 = Math.floor(y - EYE + 1.75)
    for (let vy = y0; vy <= y1; vy++)
      for (const dx of [-HALF, HALF]) for (const dz of [-HALF, HALF])
        if (isSolid(voxel(Math.floor(x + dx), vy, Math.floor(z + dz)))) return true
    return false
  }, [voxel])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)   // a stalled frame must not teleport the player through rock
    const p = camera.position
    const k = keys.current

    // ⚠ Until the spawn column arrives from the worker, EVERY lookup returns AIR — so gravity would
    // drop the player through a world that has not loaded yet. Hold position until there is ground.
    if (!settled.current) {
      if (isSolid(voxel(0, Math.floor(p.y) - 3, 0))) settled.current = true
      else { onPos(p); return }
    }

    const speed = (k.ShiftLeft ? 22 : 9) * (fly.current ? 2.2 : 1)
    const fwd = new THREE.Vector3()
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize()
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0))

    const wish = new THREE.Vector3()
    if (k.KeyW) wish.add(fwd)
    if (k.KeyS) wish.sub(fwd)
    if (k.KeyD) wish.add(right)
    if (k.KeyA) wish.sub(right)
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed)

    if (fly.current) {
      if (k.Space) wish.y += speed
      if (k.ControlLeft) wish.y -= speed
      p.addScaledVector(wish, dt)
      onPos(p)
      return
    }

    vel.current.x = wish.x; vel.current.z = wish.z
    vel.current.y -= 28 * dt
    if (onGround.current && k.Space) vel.current.y = 9.2

    // Axis-separated so sliding along a wall works instead of stopping dead in a corner.
    const nx = p.x + vel.current.x * dt
    if (!blocked(nx, p.y, p.z)) p.x = nx
    const nz = p.z + vel.current.z * dt
    if (!blocked(p.x, p.y, nz)) p.z = nz
    const ny = p.y + vel.current.y * dt
    if (!blocked(p.x, ny, p.z)) { p.y = ny; onGround.current = false }
    else { if (vel.current.y < 0) onGround.current = true; vel.current.y = 0 }

    if (p.y < -20) { p.set(0.5, columnHeight(0, 0, SEED) + 2.6, 0.5); settled.current = false }
    onPos(p)
  })

  return null
}
