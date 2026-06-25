'use client'
// Phase 1 → third-person. Moonwell Glade extruded from its blockout grid, a follow-behind
// perspective camera (drag to look, scroll to zoom), and CAMERA-RELATIVE movement: W goes where
// the camera faces, the character turns to face its heading. Collision reuses the 2D engine.
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { MOONWELL_GLADE } from '../world/tilemap'
import { walkable } from '../engine/player' // <- the actual 2D-engine collision, untouched

const GRID = MOONWELL_GLADE
const ROWS = GRID.length
const COLS = GRID[0].length
const WATER_ID = 8
const UP = new THREE.Vector3(0, 1, 0)

type Cell = [number, number] // [col, row] == [x, z]

function buckets() {
  const floors: Cell[] = [], walls: Cell[] = [], waters: Cell[] = []
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const id = GRID[r][c] & 0xFF
    if (id === WATER_ID) waters.push([c, r])
    else if (walkable(GRID, c, r)) floors.push([c, r])
    else walls.push([c, r])
  }
  return { floors, walls, waters }
}

// shortest-path angle lerp
function lerpAngle(a: number, b: number, t: number) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a))
  return a + d * t
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
    <instancedMesh ref={ref} args={[undefined, undefined, cells.length]} receiveShadow castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </instancedMesh>
  )
}

function Player({ posRef }: { posRef: React.RefObject<THREE.Vector3> }) {
  const group = useRef<THREE.Group>(null)
  const keys = useRef<Record<string, boolean>>({})
  const yaw = useRef(0)
  // scratch vectors (avoid per-frame allocation)
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
    // camera-relative frame, flattened to the ground plane
    state.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize()
    right.crossVectors(fwd, UP).normalize() // screen-right
    move.set(0, 0, 0)
    if (k['w'] || k['arrowup']) move.add(fwd)
    if (k['s'] || k['arrowdown']) move.sub(fwd)
    if (k['d'] || k['arrowright']) move.add(right)
    if (k['a'] || k['arrowleft']) move.sub(right)

    if (move.lengthSq() > 0) {
      move.normalize()
      const step = Math.min(dt, 0.05) * 5
      const p = posRef.current
      // axis-separated so you slide along walls; collision = the 2D engine's walkable()
      const nx = p.x + move.x * step
      if (walkable(GRID, Math.round(nx), Math.round(p.z))) p.x = nx
      const nz = p.z + move.z * step
      if (walkable(GRID, Math.round(p.x), Math.round(nz))) p.z = nz
      yaw.current = Math.atan2(move.x, move.z) // face the heading
    }
    const g = group.current!
    g.position.set(posRef.current.x, 0.7, posRef.current.z)
    g.rotation.y = lerpAngle(g.rotation.y, yaw.current, 0.3)
  })

  return (
    <group ref={group}>
      <mesh castShadow>
        <capsuleGeometry args={[0.3, 0.55, 4, 10]} />
        <meshStandardMaterial color="#5ad1e6" />
      </mesh>
      {/* facing "nose" so the turn is visible */}
      <mesh position={[0, 0.1, 0.38]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.13, 0.3, 8]} />
        <meshStandardMaterial color="#f6e9da" />
      </mesh>
    </group>
  )
}

// Explicit follow-behind rig: the camera is positioned at player + spherical(dist, yaw, pitch)
// EVERY frame, so it's rigidly locked behind — zero lag. Drag to orbit (yaw/pitch), scroll to
// zoom (dist). Pitch clamped to a third-person band. (OrbitControls is a CAD inspection control
// and fights position changes when used as a game follow-cam, so we drive the camera directly.)
function CameraRig({ posRef }: { posRef: React.RefObject<THREE.Vector3> }) {
  const yaw = useRef(0)
  const pitch = useRef(0.6) // smaller = more top-down; ~0.6 is a comfy third-person down-angle
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
      window.removeEventListener('pointerdown', dn)
      window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('wheel', wh)
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

function Scene() {
  const { floors, walls, waters } = useMemo(buckets, [])
  const posRef = useRef(new THREE.Vector3(1, 0.7, 8))
  return (
    <>
      <color attach="background" args={['#bfe3ef']} />
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[18, 26, 12]} intensity={1.25} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30} shadow-camera-bottom={-30}
        shadow-camera-near={0.5} shadow-camera-far={120}
      />
      <Tiles cells={floors} size={[1, 0.2, 1]} y={0} color="#7cc46a" />
      <Tiles cells={walls} size={[1, 1.3, 1]} y={0.55} color="#8a8d96" />
      <Tiles cells={waters} size={[1, 0.3, 1]} y={-0.15} color="#3aa0d6" opacity={0.85} />
      <Player posRef={posRef} />
      <CameraRig posRef={posRef} />
    </>
  )
}

export default function Shimmer3D() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#bfe3ef' }}>
      <Canvas
        shadows
        camera={{ fov: 45, position: [1, 6, 14], near: 0.1, far: 500 }}
        gl={{ antialias: true }}
      >
        <Scene />
      </Canvas>
      <div style={{
        position: 'fixed', top: 12, left: 12, padding: '8px 12px', borderRadius: 8,
        background: 'rgba(10,8,20,0.66)', color: '#e9dfc8', font: '600 14px ui-monospace, monospace',
        pointerEvents: 'none', lineHeight: 1.5,
      }}>
        Shimmer 3D — Phase 1 · Moonwell Glade (third-person)<br />
        <span style={{ opacity: 0.8 }}>WASD relative to camera · drag to look · scroll to zoom</span>
      </div>
    </div>
  )
}
