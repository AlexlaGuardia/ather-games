'use client'

// The voxel world you can walk. A test bed, on its own route, on purpose.
//
// ⚠ THIS IS NOT WIRED INTO Shimmer3D AND THAT IS DELIBERATE. That file is ~5,900 lines, it is the
// live game (mortal side, holds, Crucible, the warp/mount path that produced four bugs on 08-06),
// and the voxel world is a DIFFERENT WORLD MODEL — no zones, no tiles, no warps. Grafting it in
// would mean threading two incompatible worlds through one mount path. This route proves the
// generator by letting Alex stand in it; integration is a later, separate decision.

import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { Column, SECTION, makeColumn, meshColumn, DEFAULT_COLUMN, type SectionMesh } from '../voxel/column'
import { createMeshScratch } from '../voxel/greedy'
import { columnHeight } from '../voxel/height'
import { AIR } from '../voxel/section'
import { MAT } from '../voxel/depth'
import { toGeometry, createVoxelMaterial } from './mesh-bridge'

const SEED = 1337
const H = DEFAULT_COLUMN.worldHeight
/** Columns are 16 wide; radius 7 gives a 15x15 window = 240 units of view. */
const RADIUS = 7
/** Milliseconds of column generation allowed per frame. The rest waits for the next one.
 *  ★ Generation measured ~10ms per column, so a naive load-everything is 169 columns x 10ms = 1.7s
 *  of frozen tab. Budgeting nearest-first means you can walk while the horizon fills in. */
const BUDGET_MS = 8

const key = (cx: number, cz: number) => `${cx},${cz}`

interface Loaded { col: Column; meshes: SectionMesh[]; dirty: boolean }

function useWorld() {
  const cols = useRef(new Map<string, Loaded>())
  const scratch = useMemo(() => createMeshScratch(SECTION), [])
  const material = useMemo(() => createVoxelMaterial(), [])

  const get = useCallback((cx: number, cz: number): Loaded | undefined => cols.current.get(key(cx, cz)), [])

  /** Generate one column. Meshing is deferred — a new column makes its NEIGHBOURS' meshes stale too. */
  const load = useCallback((cx: number, cz: number) => {
    const k = key(cx, cz)
    if (cols.current.has(k)) return
    const col = makeColumn(cx * SECTION, cz * SECTION, SEED)
    cols.current.set(k, { col, meshes: [], dirty: true })
    // A neighbour's edge faces depend on this column existing, so they must re-mesh.
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const n = cols.current.get(key(cx + dx, cz + dz))
      if (n) n.dirty = true
    }
  }, [])

  const mesh = useCallback((cx: number, cz: number) => {
    const e = cols.current.get(key(cx, cz))
    if (!e || !e.dirty) return
    e.meshes = meshColumn(e.col, {
      negX: get(cx - 1, cz)?.col ?? null,
      posX: get(cx + 1, cz)?.col ?? null,
      negZ: get(cx, cz - 1)?.col ?? null,
      posZ: get(cx, cz + 1)?.col ?? null,
    }, scratch)
    e.dirty = false
  }, [get, scratch])

  /** Voxel lookup in world space — used by collision. Returns AIR outside loaded columns. */
  const voxel = useCallback((wx: number, wy: number, wz: number): number => {
    if (wy < 0 || wy >= H) return AIR
    const cx = Math.floor(wx / SECTION), cz = Math.floor(wz / SECTION)
    const e = cols.current.get(key(cx, cz))
    if (!e) return AIR
    return e.col.get(wx - cx * SECTION, wy, wz - cz * SECTION)
  }, [])

  return { cols, get, load, mesh, voxel, material }
}

const SOLID_EXCEPT = new Set<number>([AIR, MAT.WATER])
const isSolid = (m: number) => !SOLID_EXCEPT.has(m)

function Player({ voxel, onPos }: { voxel: (x: number, y: number, z: number) => number; onPos: (p: THREE.Vector3) => void }) {
  const { camera } = useThree()
  const vel = useRef(new THREE.Vector3())
  const keys = useRef<Record<string, boolean>>({})
  const fly = useRef(false)
  const onGround = useRef(false)

  useEffect(() => {
    const d = (e: KeyboardEvent) => {
      keys.current[e.code] = true
      if (e.code === 'KeyF') fly.current = !fly.current
    }
    const u = (e: KeyboardEvent) => { keys.current[e.code] = false }
    window.addEventListener('keydown', d); window.addEventListener('keyup', u)
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u) }
  }, [])

  // Spawn on the surface. columnHeight is pure, so this needs no loaded chunk — the spawn point is
  // known before a single voxel exists, which is also why the camera never starts inside rock.
  useEffect(() => {
    camera.position.set(0.5, columnHeight(0, 0, SEED) + 2.6, 0.5)
  }, [camera])

  const EYE = 1.62, HALF = 0.3, FEET = 1.62

  /** Would a capsule at (x,y,z) intersect rock? y is the EYE position. */
  const blocked = useCallback((x: number, y: number, z: number) => {
    const y0 = Math.floor(y - FEET), y1 = Math.floor(y - FEET + 1.75)
    for (let vy = y0; vy <= y1; vy++)
      for (const dx of [-HALF, HALF])
        for (const dz of [-HALF, HALF])
          if (isSolid(voxel(Math.floor(x + dx), vy, Math.floor(z + dz)))) return true
    return false
  }, [voxel])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)   // a stalled frame must not teleport the player through rock
    const k = keys.current
    const speed = (k.ShiftLeft ? 22 : 9) * (fly.current ? 2.2 : 1)

    const fwd = new THREE.Vector3()
    camera.getWorldDirection(fwd)
    fwd.y = 0; fwd.normalize()
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
      camera.position.addScaledVector(wish, dt)
      onPos(camera.position)
      return
    }

    vel.current.x = wish.x
    vel.current.z = wish.z
    vel.current.y -= 28 * dt
    if (onGround.current && k.Space) vel.current.y = 9.2

    const p = camera.position
    // Axis-separated so sliding along a wall works instead of stopping dead in a corner.
    const nx = p.x + vel.current.x * dt
    if (!blocked(nx, p.y, p.z)) p.x = nx
    const nz = p.z + vel.current.z * dt
    if (!blocked(p.x, p.y, nz)) p.z = nz
    const ny = p.y + vel.current.y * dt
    if (!blocked(p.x, ny, p.z)) { p.y = ny; onGround.current = false }
    else { if (vel.current.y < 0) onGround.current = true; vel.current.y = 0 }

    if (p.y < -20) p.set(0.5, columnHeight(0, 0, SEED) + 2.6, 0.5)   // fell out of loaded world
    onPos(p)
  })

  return null
}

function Terrain({ world, onStats }: { world: ReturnType<typeof useWorld>; onStats: (s: string) => void }) {
  const group = useRef<THREE.Group>(null)
  const drawn = useRef(new Map<string, THREE.Mesh>())
  const center = useRef({ cx: 0, cz: 0 })

  useFrame(({ camera }) => {
    const cx = Math.floor(camera.position.x / SECTION)
    const cz = Math.floor(camera.position.z / SECTION)
    center.current = { cx, cz }

    // ── budgeted generation, nearest first ────────────────────────────────────────────────
    const t0 = performance.now()
    const want: [number, number, number][] = []
    for (let dz = -RADIUS; dz <= RADIUS; dz++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const d = dx * dx + dz * dz
      if (d > RADIUS * RADIUS) continue
      if (!world.cols.current.has(key(cx + dx, cz + dz))) want.push([d, cx + dx, cz + dz])
    }
    want.sort((a, b) => a[0] - b[0])
    for (const [, gx, gz] of want) {
      if (performance.now() - t0 > BUDGET_MS) break
      world.load(gx, gz)
    }

    // ── mesh whatever is dirty, same budget ───────────────────────────────────────────────
    for (let dz = -RADIUS; dz <= RADIUS; dz++) {
      if (performance.now() - t0 > BUDGET_MS * 2) break
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const e = world.cols.current.get(key(cx + dx, cz + dz))
        if (e?.dirty) world.mesh(cx + dx, cz + dz)
      }
    }

    // ── sync scene graph ──────────────────────────────────────────────────────────────────
    const g = group.current
    if (!g) return
    const live = new Set<string>()
    for (const [k, e] of world.cols.current) {
      const [gx, gz] = k.split(',').map(Number)
      if (Math.abs(gx - cx) > RADIUS || Math.abs(gz - cz) > RADIUS) continue
      for (const sm of e.meshes) {
        const mk = `${k}:${sm.index}`
        live.add(mk)
        if (drawn.current.has(mk)) continue
        const m = new THREE.Mesh(toGeometry(sm.mesh), world.material)
        m.position.set(sm.wx, sm.wy, sm.wz)
        g.add(m)
        drawn.current.set(mk, m)
      }
    }
    // Drop meshes that left the window — geometry must be disposed or the GPU leaks as you walk.
    for (const [mk, m] of drawn.current) {
      if (live.has(mk)) continue
      g.remove(m)
      m.geometry.dispose()
      drawn.current.delete(mk)
    }

    onStats(`${world.cols.current.size} columns · ${drawn.current.size} meshes · ${want.length} pending`)
  })

  return <group ref={group} />
}

export default function VoxelWorld() {
  const world = useWorld()
  const [stats, setStats] = useState('')
  const [pos, setPos] = useState('')
  const onPos = useCallback((p: THREE.Vector3) =>
    setPos(`x ${p.x.toFixed(0)}  y ${p.y.toFixed(0)}  z ${p.z.toFixed(0)}`), [])

  return (
    <div className="fixed inset-0 bg-[#0b0d14]">
      <Canvas camera={{ fov: 75, near: 0.1, far: 600 }} shadows={false}>
        <color attach="background" args={['#8fb7d9']} />
        <fog attach="fog" args={['#8fb7d9', 90, 240]} />
        <hemisphereLight args={['#cfe6ff', '#3b3a4a', 1.5]} />
        <directionalLight position={[80, 200, 40]} intensity={1.5} />
        <ambientLight intensity={0.35} />
        <Terrain world={world} onStats={setStats} />
        <Player voxel={world.voxel} onPos={onPos} />
        <PointerLockControls />
      </Canvas>

      <div className="absolute top-3 left-3 text-[11px] font-mono text-white/80 bg-black/45 rounded px-2.5 py-1.5 leading-relaxed pointer-events-none">
        <div className="text-white/95 font-semibold tracking-wide">SHIMMER · VOXEL TEST BED</div>
        <div>{pos}</div>
        <div className="text-white/55">{stats}</div>
        <div className="mt-1 text-white/45">click to look · WASD · space jump · shift run · F fly</div>
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/70 pointer-events-none" />
    </div>
  )
}
