'use client'
// Phase 1 foundation: the whole blockout map, walkable in 3D, with BLOCKY tiered terrain.
// Each zone's grid extrudes to geometry; floor cells rise to their height tier (Minecraft-style,
// terrain only); the player walks up/down tiers (step-up <= 1). Warps reuse the 2D engine's
// checkWarp/ZONES verbatim. Third-person follow camera, camera-relative movement. Pills/blockout.
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useEffect, useLayoutEffect, useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'
import { walkable } from '../engine/player' // 2D-engine collision, untouched
import { ZONES, getZone, checkWarp, type Zone, type Warp } from '../world/zones'
import { getHeightGrid } from '../world/heightmaps'

const START_ZONE = 'moonwell-glade'
const WATER_ID = 8
const STEP = 1.0 // world height of one terrain tier (full-block, Minecraft-style)
const UP = new THREE.Vector3(0, 1, 0)

// Warp.direction (the way you were travelling) → camera azimuth, so you arrive looking INTO the
// new zone instead of back at the return tile.
const DIR_YAW: Record<string, number> = { up: 0, down: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }

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

function lerpAngle(a: number, b: number, t: number) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t
}

// Floor cells extruded to their height tier — a column whose TOP sits at height*STEP, dropping to
// a base below. Per-instance Y scale keeps it one draw call. Differing neighbour heights = cliffs.
function FloorTerrain({ floors, heights }: { floors: Cell[]; heights: number[][] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new THREE.Matrix4(), q = new THREE.Quaternion()
    const pos = new THREE.Vector3(), scl = new THREE.Vector3()
    floors.forEach(([c, r], i) => {
      const top = (heights[r]?.[c] ?? 0) * STEP
      const boxH = top + 1 // base at y = -1
      pos.set(c, (top - 1) / 2, r)
      scl.set(1, boxH, 1)
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [floors, heights])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(floors.length, 1)]} receiveShadow castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#7cc46a" />
    </instancedMesh>
  )
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

function ZoneGeometry({ zone, heights }: { zone: Zone; heights: number[][] }) {
  const { floors, walls, waters } = useMemo(() => buckets(zone.grid), [zone])
  return (
    <>
      <FloorTerrain floors={floors} heights={heights} />
      <Tiles cells={walls} size={[1, 1.3, 1]} y={0.55} color="#8a8d96" />
      <Tiles cells={waters} size={[1, 0.3, 1]} y={-0.15} color="#3aa0d6" opacity={0.85} />
    </>
  )
}

function Player({ posRef, zoneRef, heightsRef, onWarp }: {
  posRef: React.RefObject<THREE.Vector3>
  zoneRef: React.RefObject<Zone>
  heightsRef: React.RefObject<number[][]>
  onWarp: (w: Warp) => void
}) {
  const group = useRef<THREE.Group>(null)
  const keys = useRef<Record<string, boolean>>({})
  const yaw = useRef(0)
  const lastTile = useRef('')
  const warpCd = useRef(0)
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
    const heights = heightsRef.current
    const p = posRef.current
    const curH = heights[Math.round(p.z)]?.[Math.round(p.x)] ?? 0
    const canStand = (cx: number, cz: number) =>
      walkable(grid, cx, cz) && (heights[cz]?.[cx] ?? 0) - curH <= 1 // step up at most one tier

    state.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize()
    right.crossVectors(fwd, UP).normalize()
    move.set(0, 0, 0)
    if (k['w'] || k['arrowup']) move.add(fwd)
    if (k['s'] || k['arrowdown']) move.sub(fwd)
    if (k['d'] || k['arrowright']) move.add(right)
    if (k['a'] || k['arrowleft']) move.sub(right)

    if (move.lengthSq() > 0) {
      move.normalize()
      const dstep = Math.min(dt, 0.05) * 5
      const nx = p.x + move.x * dstep
      if (canStand(Math.round(nx), Math.round(p.z))) p.x = nx
      const nz = p.z + move.z * dstep
      if (canStand(Math.round(p.x), Math.round(nz))) p.z = nz
      yaw.current = Math.atan2(move.x, move.z)
    }

    // terrain-follow height (smoothed so steps glide, not snap)
    const standTop = (heights[Math.round(p.z)]?.[Math.round(p.x)] ?? 0) * STEP
    p.y += (standTop - p.y) * 0.25

    // warp on tile-enter (reuse checkWarp); short cooldown prevents an instant bounce
    const tx = Math.round(p.x), tz = Math.round(p.z)
    const tileKey = `${tx},${tz}`
    const tileChanged = tileKey !== lastTile.current
    lastTile.current = tileKey
    if (warpCd.current > 0) warpCd.current -= dt
    else if (tileChanged) {
      const w = checkWarp(ZONES, zoneRef.current.id, tx, tz)
      if (w) { onWarp(w); warpCd.current = 0.4 }
    }

    const g = group.current!
    g.position.set(p.x, p.y + 0.7, p.z)
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
// Follows posRef.y too, so it rises/falls with the terrain. yawRef shared so warps re-aim it.
function CameraRig({ posRef, yawRef }: { posRef: React.RefObject<THREE.Vector3>; yawRef: React.RefObject<number> }) {
  const yaw = yawRef
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

function Scene({ zone, heights, posRef, zoneRef, heightsRef, onWarp, yawRef }: {
  zone: Zone
  heights: number[][]
  posRef: React.RefObject<THREE.Vector3>
  zoneRef: React.RefObject<Zone>
  heightsRef: React.RefObject<number[][]>
  onWarp: (w: Warp) => void
  yawRef: React.RefObject<number>
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
      <ZoneGeometry key={zone.id} zone={zone} heights={heights} />
      <Player posRef={posRef} zoneRef={zoneRef} heightsRef={heightsRef} onWarp={onWarp} />
      <CameraRig posRef={posRef} yawRef={yawRef} />
    </>
  )
}

export default function Shimmer3D() {
  const [zoneId, setZoneId] = useState(START_ZONE)
  const zone = getZone(ZONES, zoneId) ?? getZone(ZONES, START_ZONE)!
  const heights = useMemo(() => getHeightGrid(zone.id, zone.grid.length, zone.grid[0].length), [zone])
  const zoneRef = useRef(zone); zoneRef.current = zone
  const heightsRef = useRef(heights); heightsRef.current = heights
  const posRef = useRef<THREE.Vector3 | null>(null)
  if (!posRef.current) {
    const ps = zone.playerStart ?? { tileX: 1, tileY: 1 }
    posRef.current = new THREE.Vector3(ps.tileX, 0, ps.tileY)
  }
  const camYaw = useRef(0)
  const onWarp = useCallback((w: Warp) => {
    posRef.current!.set(w.toX, posRef.current!.y, w.toY)
    if (w.direction && DIR_YAW[w.direction] !== undefined) camYaw.current = DIR_YAW[w.direction]
    setZoneId(w.toZone)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#bfe3ef' }}>
      <Canvas shadows camera={{ fov: 45, position: [1, 6, 14], near: 0.1, far: 500 }} gl={{ antialias: true }}>
        <Scene
          zone={zone} heights={heights}
          posRef={posRef as React.RefObject<THREE.Vector3>}
          zoneRef={zoneRef} heightsRef={heightsRef} onWarp={onWarp} yawRef={camYaw}
        />
      </Canvas>
      <div style={{
        position: 'fixed', top: 12, left: 12, padding: '8px 12px', borderRadius: 8,
        background: 'rgba(10,8,20,0.66)', color: '#e9dfc8', font: '600 14px ui-monospace, monospace',
        pointerEvents: 'none', lineHeight: 1.5,
      }}>
        Shimmer 3D — {zone.name}<br />
        <span style={{ opacity: 0.8 }}>WASD · drag to look · scroll to zoom · walk the tiers (demo heights) · edges warp</span>
      </div>
    </div>
  )
}
