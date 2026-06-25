'use client'
// Phase 1 renderer-seam proof. Builds the Moonwell Glade blockout grid as 3D geometry
// (instanced floor / wall / water boxes), an iso orthographic camera that follows a capsule,
// and grid collision REUSED from the 2D engine (`walkable`) — the systems-swap thesis in one screen.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { MOONWELL_GLADE } from '../world/tilemap'
import { walkable } from '../engine/player' // <- the actual 2D-engine collision, untouched

const GRID = MOONWELL_GLADE
const ROWS = GRID.length
const COLS = GRID[0].length
const WATER_ID = 8

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

function Player() {
  const group = useRef<THREE.Group>(null)
  const keys = useRef<Record<string, boolean>>({})
  // Moonwell Glade playerStart = tile (1,8)
  const pos = useRef(new THREE.Vector3(1, 0.7, 8))
  const camOffset = useMemo(() => new THREE.Vector3(13, 17, 13), [])
  const cam = useThree((s) => s.camera)

  useEffect(() => {
    const dn = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true }
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false }
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [])

  useFrame((_, dt) => {
    const k = keys.current
    let dx = 0, dz = 0
    if (k['w'] || k['arrowup']) dz -= 1
    if (k['s'] || k['arrowdown']) dz += 1
    if (k['a'] || k['arrowleft']) dx -= 1
    if (k['d'] || k['arrowright']) dx += 1
    if (dx || dz) {
      const len = Math.hypot(dx, dz); dx /= len; dz /= len
      const step = Math.min(dt, 0.05) * 5
      const p = pos.current
      // axis-separated so you slide along walls; collision = the 2D engine's walkable()
      const nx = p.x + dx * step
      if (walkable(GRID, Math.round(nx), Math.round(p.z))) p.x = nx
      const nz = p.z + dz * step
      if (walkable(GRID, Math.round(p.x), Math.round(nz))) p.z = nz
    }
    group.current!.position.set(pos.current.x, 0.7, pos.current.z)
    cam.position.copy(pos.current).add(camOffset)
    cam.lookAt(pos.current.x, 0, pos.current.z)
  })

  return (
    <group ref={group}>
      <mesh castShadow>
        <capsuleGeometry args={[0.3, 0.55, 4, 10]} />
        <meshStandardMaterial color="#5ad1e6" />
      </mesh>
    </group>
  )
}

function Scene() {
  const { floors, walls, waters } = useMemo(buckets, [])
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
      <Player />
    </>
  )
}

export default function Shimmer3D() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#bfe3ef' }}>
      <Canvas
        shadows
        orthographic
        camera={{ zoom: 30, position: [14, 18, 14], near: -50, far: 200 }}
        gl={{ antialias: true }}
      >
        <Scene />
      </Canvas>
      <div style={{
        position: 'fixed', top: 12, left: 12, padding: '8px 12px', borderRadius: 8,
        background: 'rgba(10,8,20,0.66)', color: '#e9dfc8', font: '600 14px ui-monospace, monospace',
        pointerEvents: 'none', lineHeight: 1.5,
      }}>
        Shimmer 3D — Phase 1 proof · Moonwell Glade<br />
        <span style={{ opacity: 0.8 }}>WASD / arrows to move · collision reused from the 2D engine</span>
      </div>
    </div>
  )
}
