'use client'
// Phase 1 foundation: the whole blockout map, walkable in 3D. Each zone's grid is extruded to
// geometry; WARPS reuse the 2D engine's checkWarp/ZONES verbatim — step a warp tile, the zone
// swaps and the player respawns at the target. Third-person follow camera, camera-relative
// movement, grid collision all reused. Pills/blockout throughout — no art.
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useEffect, useLayoutEffect, useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'
import { walkable } from '../engine/player' // 2D-engine collision, untouched
import { ZONES, getZone, checkWarp, type Zone, type Warp } from '../world/zones'

const START_ZONE = 'moonwell-glade'
const WATER_ID = 8
const UP = new THREE.Vector3(0, 1, 0)

type Cell = [number, number] // [col, row] == [x, z]

function buckets(grid: number[][]) {
  const floors: Cell[] = [], walls: Cell[] = [], waters: Cell[] = []
  const rows = grid.length, cols = grid[0].length
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const id = grid[r][c] & 0xFF
    if (id === WATER_ID) waters.push([c, r])
    else if (walkable(grid, c, r)) floors.push([c, r])
    else walls.push([c, r])
  }
  return { floors, walls, waters }
}

// shortest-path angle lerp
function lerpAngle(a: number, b: number, t: number) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t
}

function Tiles({ cells, size, y, color, opacity = 1 }: {
  cells: Cell[]; size: [number, number, number]; y: number; color: string; opacity?: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new THREE.Matrix4()
    cells.forEach(([c, r], i) => { m.setPosition(c, y, r); mesh.setMatrixAt(i, m) })
    mesh.instanceMatrix.needsUpdate = true
  }, [cells, y])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(cells.length, 1)]} receiveShadow castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </instancedMesh>
  )
}

// One zone's geometry. Keyed by zone id by the parent so it fully rebuilds on a warp.
function ZoneGeometry({ zone }: { zone: Zone }) {
  const { floors, walls, waters } = useMemo(() => buckets(zone.grid), [zone])
  return (
    <>
      <Tiles cells={floors} size={[1, 0.2, 1]} y={0} color="#7cc46a" />
      <Tiles cells={walls} size={[1, 1.3, 1]} y={0.55} color="#8a8d96" />
      <Tiles cells={waters} size={[1, 0.3, 1]} y={-0.15} color="#3aa0d6" opacity={0.85} />
    </>
  )
}

function Player({ posRef, zoneRef, onWarp }: {
  posRef: React.RefObject<THREE.Vector3>
  zoneRef: React.RefObject<Zone>
  onWarp: (w: Warp) => void
}) {
  const group = useRef<THREE.Group>(null)
  const keys = useRef<Record<string, boolean>>({})
  const yaw = useRef(0)
  const lastTile = useRef('')
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const move = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const dn = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true }
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false }
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [])

  useFrame((state, dt) => {
    const k = keys.current
    const grid = zoneRef.current.grid
    state.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize()
    right.crossVectors(fwd, UP).normalize()
    move.set(0, 0, 0)
    if (k['w'] || k['arrowup']) move.add(fwd)
    if (k['s'] || k['arrowdown']) move.sub(fwd)
    if (k['d'] || k['arrowright']) move.add(right)
    if (k['a'] || k['arrowleft']) move.sub(right)

    const p = posRef.current
    if (move.lengthSq() > 0) {
      move.normalize()
      const step = Math.min(dt, 0.05) * 5
      const nx = p.x + move.x * step
      if (walkable(grid, Math.round(nx), Math.round(p.z))) p.x = nx
      const nz = p.z + move.z * step
      if (walkable(grid, Math.round(p.x), Math.round(nz))) p.z = nz
      yaw.current = Math.atan2(move.x, move.z)
    }

    // warp on tile-enter — reuse the 2D engine's checkWarp verbatim
    const tx = Math.round(p.x), tz = Math.round(p.z)
    const tileKey = `${tx},${tz}`
    if (tileKey !== lastTile.current) {
      lastTile.current = tileKey
      const w = checkWarp(ZONES, zoneRef.current.id, tx, tz)
      if (w) onWarp(w)
    }

    const g = group.current!
    g.position.set(p.x, 0.7, p.z)
    g.rotation.y = lerpAngle(g.rotation.y, yaw.current, 0.3)
  })

  return (
    <group ref={group}>
      <mesh castShadow>
        <capsuleGeometry args={[0.3, 0.55, 4, 10]} />
        <meshStandardMaterial color="#5ad1e6" />
      </mesh>
      <mesh position={[0, 0.1, 0.38]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.13, 0.3, 8]} />
        <meshStandardMaterial color="#f6e9da" />
      </mesh>
    </group>
  )
}

// Explicit follow-behind rig: camera = player + spherical(dist, yaw, pitch) every frame (zero lag).
function CameraRig({ posRef }: { posRef: React.RefObject<THREE.Vector3> }) {
  const yaw = useRef(0)
  const pitch = useRef(0.6)
  const dist = useRef(11)
  useEffect(() => {
    let dragging = false, lx = 0, ly = 0
    const dn = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY }
    const mv = (e: PointerEvent) => {
      if (!dragging) return
      yaw.current -= (e.clientX - lx) * 0.005
      pitch.current = Math.max(0.35, Math.min(0.95, pitch.current - (e.clientY - ly) * 0.004))
      lx = e.clientX; ly = e.clientY
    }
    const up = () => { dragging = false }
    const wh = (e: WheelEvent) => { dist.current = Math.max(5, Math.min(20, dist.current + e.deltaY * 0.012)) }
    window.addEventListener('pointerdown', dn)
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
    window.addEventListener('wheel', wh, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', dn); window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', up); window.removeEventListener('wheel', wh)
    }
  }, [])
  useFrame((state) => {
    const p = posRef.current
    const sp = Math.sin(pitch.current), cp = Math.cos(pitch.current)
    state.camera.position.set(
      p.x + dist.current * sp * Math.sin(yaw.current),
      p.y + dist.current * cp,
      p.z + dist.current * sp * Math.cos(yaw.current),
    )
    state.camera.lookAt(p.x, p.y + 0.4, p.z)
  })
  return null
}

function Scene({ zone, posRef, zoneRef, onWarp }: {
  zone: Zone
  posRef: React.RefObject<THREE.Vector3>
  zoneRef: React.RefObject<Zone>
  onWarp: (w: Warp) => void
}) {
  return (
    <>
      <color attach="background" args={['#bfe3ef']} />
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[18, 26, 12]} intensity={1.25} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-40} shadow-camera-right={40}
        shadow-camera-top={40} shadow-camera-bottom={-40}
        shadow-camera-near={0.5} shadow-camera-far={160}
      />
      <ZoneGeometry key={zone.id} zone={zone} />
      <Player posRef={posRef} zoneRef={zoneRef} onWarp={onWarp} />
      <CameraRig posRef={posRef} />
    </>
  )
}

export default function Shimmer3D() {
  const [zoneId, setZoneId] = useState(START_ZONE)
  const zone = getZone(ZONES, zoneId) ?? getZone(ZONES, START_ZONE)!
  const zoneRef = useRef(zone)
  zoneRef.current = zone
  const posRef = useRef<THREE.Vector3 | null>(null)
  if (!posRef.current) {
    const ps = zone.playerStart ?? { tileX: 1, tileY: 1 }
    posRef.current = new THREE.Vector3(ps.tileX, 0.7, ps.tileY)
  }
  const onWarp = useCallback((w: Warp) => {
    posRef.current!.set(w.toX, 0.7, w.toY)
    setZoneId(w.toZone)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#bfe3ef' }}>
      <Canvas shadows camera={{ fov: 45, position: [1, 6, 14], near: 0.1, far: 500 }} gl={{ antialias: true }}>
        <Scene zone={zone} posRef={posRef as React.RefObject<THREE.Vector3>} zoneRef={zoneRef} onWarp={onWarp} />
      </Canvas>
      <div style={{
        position: 'fixed', top: 12, left: 12, padding: '8px 12px', borderRadius: 8,
        background: 'rgba(10,8,20,0.66)', color: '#e9dfc8', font: '600 14px ui-monospace, monospace',
        pointerEvents: 'none', lineHeight: 1.5,
      }}>
        Shimmer 3D — {zone.name}<br />
        <span style={{ opacity: 0.8 }}>WASD (camera-relative) · drag to look · scroll to zoom · walk to an edge to warp</span>
      </div>
    </div>
  )
}
