'use client'
// Phase 1 foundation: the blockout map walkable in 3D, blocky tiered terrain, and an in-3D
// BLOCKOUT TOOL — press B for edit mode, pick a tool (Raise/Lower/Wall/Water/Floor) + brush size
// from the on-screen palette, click/drag the terrain, then Save. Height tools edit the per-zone
// height grid; cell tools edit the tile grid (so you can remove water/walls). Save persists both
// (heights→/shimmer/save-heights, grid→/shimmer/save-map). Warps/collision reuse the 2D engine.
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, useEffect, useLayoutEffect, useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'
import { walkable } from '../engine/player'
import { ZONES, getZone, checkWarp, type Zone, type Warp } from '../world/zones'
import { getHeightGrid } from '../world/heightmaps'

const START_ZONE = 'moonwell-glade'
const WATER_ID = 8, FLOOR_ID = 97, WALL_ID = 34, WARP_ID = 14
const VOID = -1 // empty cell — renders nothing, not walkable (draw land onto an empty grid)
const STEP = 1.0
const MAX_TIER = 8
const UP = new THREE.Vector3(0, 1, 0)
const DIR_YAW: Record<string, number> = { up: 0, down: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }

type Cell = [number, number]
type Tool = 'raise' | 'lower' | 'floor' | 'wall' | 'water' | 'warp' | 'void'

function buckets(grid: number[][]) {
  const floors: Cell[] = [], walls: Cell[] = [], waters: Cell[] = [], voids: Cell[] = [], warps: Cell[] = []
  const rows = grid.length, cols = grid[0].length
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = grid[r][c]
    if (v === VOID) { voids.push([c, r]); continue }
    const id = v & 0xFF
    if (id === WARP_ID) warps.push([c, r])
    else if (id === WATER_ID) waters.push([c, r])
    else if (walkable(grid, c, r)) floors.push([c, r])
    else walls.push([c, r])
  }
  return { floors, walls, waters, voids, warps }
}

function lerpAngle(a: number, b: number, t: number) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t
}

// Shared pointer painting for any instanced cell layer. Tracks the last cell (not instanceId) so
// it survives the re-bucket when a cell changes type mid-drag.
function usePaint(cells: Cell[], paint: (c: number, r: number, shift: boolean) => void, enabled: boolean) {
  const painting = useRef(false)
  const lastKey = useRef('')
  useEffect(() => {
    const up = () => { painting.current = false; lastKey.current = '' }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [])
  const apply = (e: ThreeEvent<PointerEvent>, isDown: boolean) => {
    if (!enabled || e.instanceId == null) return
    if (isDown && e.nativeEvent.button !== 0) return // left button only (right-drag = camera)
    if (!isDown && !painting.current) return
    const [c, r] = cells[e.instanceId]
    const key = `${c},${r}`
    if (!isDown && key === lastKey.current) return
    if (isDown) { e.stopPropagation(); painting.current = true }
    lastKey.current = key
    paint(c, r, e.nativeEvent.shiftKey)
  }
  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => apply(e, true),
    onPointerMove: (e: ThreeEvent<PointerEvent>) => apply(e, false),
  }
}

function FloorTerrain({ floors, heights, version, paint, editing, color = '#7cc46a', emissive = '#000000' }: {
  floors: Cell[]; heights: number[][]; version: number
  paint: (c: number, r: number, shift: boolean) => void; editing: boolean; color?: string; emissive?: string
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new THREE.Matrix4(), q = new THREE.Quaternion()
    const pos = new THREE.Vector3(), scl = new THREE.Vector3()
    floors.forEach(([c, r], i) => {
      const top = (heights[r]?.[c] ?? 0) * STEP
      pos.set(c, (top - 1) / 2, r)
      scl.set(1, top + 1, 1)
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [floors, heights, version])
  const h = usePaint(floors, paint, editing)
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(floors.length, 1)]} receiveShadow castShadow {...h}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.6} />
    </instancedMesh>
  )
}

// A tall glowing beacon over each warp marker so doors/exits read from any angle.
function WarpBeacons({ warps, heights }: { warps: Cell[]; heights: number[][] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1)
    warps.forEach(([c, r], i) => { pos.set(c, (heights[r]?.[c] ?? 0) * STEP + 1.5, r); m.compose(pos, q, scl); mesh.setMatrixAt(i, m) })
    mesh.instanceMatrix.needsUpdate = true
  }, [warps, heights])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(warps.length, 1)]}>
      <boxGeometry args={[0.18, 3, 0.18]} />
      <meshStandardMaterial color="#ffe08a" emissive="#ffcf4d" emissiveIntensity={0.9} />
    </instancedMesh>
  )
}

function Tiles({ cells, size, y, color, opacity = 1, paint, editing }: {
  cells: Cell[]; size: [number, number, number]; y: number; color: string; opacity?: number
  paint: (c: number, r: number, shift: boolean) => void; editing: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new THREE.Matrix4()
    cells.forEach(([c, r], i) => { m.setPosition(c, y, r); mesh.setMatrixAt(i, m) })
    mesh.instanceMatrix.needsUpdate = true
  }, [cells, y])
  const h = usePaint(cells, paint, editing)
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(cells.length, 1)]} receiveShadow castShadow {...h}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </instancedMesh>
  )
}

function ZoneGeometry({ gridRef, heights, version, paint, editing }: {
  gridRef: React.RefObject<number[][]>; heights: number[][]; version: number
  paint: (c: number, r: number, shift: boolean) => void; editing: boolean
}) {
  const { floors, walls, waters, voids, warps } = useMemo(() => buckets(gridRef.current), [version, gridRef])
  return (
    <>
      <FloorTerrain floors={floors} heights={heights} version={version} paint={paint} editing={editing} />
      <Tiles cells={walls} size={[1, 1.3, 1]} y={0.55} color="#8a8d96" paint={paint} editing={editing} />
      <Tiles cells={waters} size={[1, 0.3, 1]} y={-0.15} color="#3aa0d6" opacity={0.85} paint={paint} editing={editing} />
      {/* warp markers — glowing gold columns + beacons (you place; Jin wires the destinations) */}
      <FloorTerrain floors={warps} heights={heights} version={version} paint={paint} editing={editing} color="#caa233" emissive="#ffcf4d" />
      <WarpBeacons warps={warps} heights={heights} />
      {/* empty cells: invisible in play; a faint clickable grid-canvas to draw land onto while editing */}
      {editing && <Tiles cells={voids} size={[0.92, 0.05, 0.92]} y={-0.02} color="#39406b" opacity={0.5} paint={paint} editing={editing} />}
    </>
  )
}

function Player({ posRef, gridRef, heightsRef, zoneIdRef, editRef, onWarp }: {
  posRef: React.RefObject<THREE.Vector3>; gridRef: React.RefObject<number[][]>
  heightsRef: React.RefObject<number[][]>; zoneIdRef: React.RefObject<string>
  editRef: React.RefObject<boolean>; onWarp: (w: Warp) => void
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
    const grid = gridRef.current
    const heights = heightsRef.current
    const p = posRef.current
    const curH = heights[Math.round(p.z)]?.[Math.round(p.x)] ?? 0
    const canStand = (cx: number, cz: number) => {
      if (cz < 0 || cz >= grid.length || cx < 0 || cx >= grid[0].length) return false
      if (editRef.current) return true // roam freely while editing (so you can paint anywhere)
      if (grid[cz][cx] === VOID) return false
      return walkable(grid, cx, cz) && (heights[cz]?.[cx] ?? 0) - curH <= 1
    }

    // In edit mode WASD drives the spectator camera, not the player — skip player movement/warps.
    if (!editRef.current) {
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

      const standTop = (heights[Math.round(p.z)]?.[Math.round(p.x)] ?? 0) * STEP
      p.y += (standTop - p.y) * 0.25

      const tx = Math.round(p.x), tz = Math.round(p.z)
      const tileKey = `${tx},${tz}`
      const tileChanged = tileKey !== lastTile.current
      lastTile.current = tileKey
      if (warpCd.current > 0) warpCd.current -= dt
      else if (tileChanged) {
        const w = checkWarp(ZONES, zoneIdRef.current, tx, tz)
        if (w) { onWarp(w); warpCd.current = 0.4 }
      }
    }

    const g = group.current!
    g.position.set(p.x, p.y + 0.7, p.z)
    g.rotation.y = lerpAngle(g.rotation.y, yaw.current, 0.3)
  })

  return (
    <group ref={group}>
      <mesh castShadow><capsuleGeometry args={[0.3, 0.55, 4, 10]} /><meshStandardMaterial color="#5ad1e6" /></mesh>
      <mesh position={[0, 0.1, 0.38]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.13, 0.3, 8]} /><meshStandardMaterial color="#f6e9da" />
      </mesh>
    </group>
  )
}

function CameraRig({ posRef, editFocusRef, yawRef, editRef }: {
  posRef: React.RefObject<THREE.Vector3>; editFocusRef: React.RefObject<THREE.Vector3>
  yawRef: React.RefObject<number>; editRef: React.RefObject<boolean>
}) {
  const yaw = yawRef
  const pitch = useRef(0.6)
  const dist = useRef(11)
  const keys = useRef<Record<string, boolean>>({})
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    let dragging = false, lx = 0, ly = 0
    // non-edit: left-drag orbits (follow-cam). edit (spectator): right-drag looks (left = brush).
    const dn = (e: PointerEvent) => {
      const ok = editRef.current ? e.button === 2 : e.button === 0
      if (!ok) return
      dragging = true; lx = e.clientX; ly = e.clientY
    }
    const mv = (e: PointerEvent) => {
      if (!dragging) return
      yaw.current -= (e.clientX - lx) * 0.005
      pitch.current = Math.max(0.2, Math.min(1.45, pitch.current - (e.clientY - ly) * 0.004))
      lx = e.clientX; ly = e.clientY
    }
    const up = () => { dragging = false }
    const wh = (e: WheelEvent) => { dist.current = Math.max(4, Math.min(40, dist.current + e.deltaY * 0.012)) }
    const ctx = (e: Event) => { if (editRef.current) e.preventDefault() } // no menu during right-drag
    const kd = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true }
    const ku = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false }
    window.addEventListener('pointerdown', dn); window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up); window.addEventListener('wheel', wh, { passive: true })
    window.addEventListener('contextmenu', ctx); window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    return () => {
      window.removeEventListener('pointerdown', dn); window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', up); window.removeEventListener('wheel', wh)
      window.removeEventListener('contextmenu', ctx); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku)
    }
  }, [editRef, yaw])
  useFrame((state, dt) => {
    const editing = editRef.current
    const target = editing ? editFocusRef.current : posRef.current
    if (editing) {
      // spectator fly: WASD pans (camera-relative, ground plane), Q/E lower/raise
      const k = keys.current
      state.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize()
      right.crossVectors(fwd, UP).normalize()
      const sp = dist.current * Math.min(dt, 0.05) * 1.4
      if (k['w'] || k['arrowup']) target.addScaledVector(fwd, sp)
      if (k['s'] || k['arrowdown']) target.addScaledVector(fwd, -sp)
      if (k['d'] || k['arrowright']) target.addScaledVector(right, sp)
      if (k['a'] || k['arrowleft']) target.addScaledVector(right, -sp)
      if (k['e']) target.y += sp
      if (k['q']) target.y -= sp
    }
    const s = Math.sin(pitch.current), c = Math.cos(pitch.current)
    state.camera.position.set(
      target.x + dist.current * s * Math.sin(yaw.current),
      target.y + dist.current * c,
      target.z + dist.current * s * Math.cos(yaw.current),
    )
    state.camera.lookAt(target.x, target.y + 0.4, target.z)
  })
  return null
}

function Scene(props: {
  zone: Zone; gridRef: React.RefObject<number[][]>; heights: number[][]; version: number; dims: string
  posRef: React.RefObject<THREE.Vector3>; heightsRef: React.RefObject<number[][]>; zoneIdRef: React.RefObject<string>
  editFocusRef: React.RefObject<THREE.Vector3>
  onWarp: (w: Warp) => void; yawRef: React.RefObject<number>; editRef: React.RefObject<boolean>
  paint: (c: number, r: number, shift: boolean) => void; editing: boolean
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
      <ZoneGeometry key={`${props.zone.id}-${props.dims}`} gridRef={props.gridRef} heights={props.heights} version={props.version} paint={props.paint} editing={props.editing} />
      <Player posRef={props.posRef} gridRef={props.gridRef} heightsRef={props.heightsRef} zoneIdRef={props.zoneIdRef} editRef={props.editRef} onWarp={props.onWarp} />
      <CameraRig posRef={props.posRef} editFocusRef={props.editFocusRef} yawRef={props.yawRef} editRef={props.editRef} />
    </>
  )
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'floor', label: 'Land' }, { id: 'raise', label: 'Raise' }, { id: 'lower', label: 'Lower' },
  { id: 'wall', label: 'Wall' }, { id: 'water', label: 'Water' }, { id: 'warp', label: 'Warp' }, { id: 'void', label: 'Erase' },
]

export default function Shimmer3D() {
  const [zoneId, setZoneId] = useState(START_ZONE)
  const zone = getZone(ZONES, zoneId) ?? getZone(ZONES, START_ZONE)!

  // Working copies — init ONCE per zone (not every render) so paint/resize edits persist.
  const gridRef = useRef<number[][]>([])
  const heightsRef = useRef<number[][]>([])
  const initedZone = useRef('')
  if (initedZone.current !== zone.id) {
    initedZone.current = zone.id
    gridRef.current = zone.grid.map((row) => [...row])
    heightsRef.current = getHeightGrid(zone.id, zone.grid.length, zone.grid[0].length)
  }
  const zoneIdRef = useRef(zone.id); zoneIdRef.current = zone.id
  const posRef = useRef<THREE.Vector3 | null>(null)
  if (!posRef.current) {
    const ps = zone.playerStart ?? { tileX: 1, tileY: 1 }
    posRef.current = new THREE.Vector3(ps.tileX, 0, ps.tileY)
  }
  const camYaw = useRef(0)
  const editFocusRef = useRef(new THREE.Vector3())

  const [version, setVersion] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const editRef = useRef(false); editRef.current = editMode
  // entering edit mode: start the spectator camera where the player is standing
  useEffect(() => { if (editMode) editFocusRef.current.copy(posRef.current!) }, [editMode])
  const [tool, setTool] = useState<Tool>('raise')
  const toolRef = useRef<Tool>('raise'); toolRef.current = tool
  const [brush, setBrush] = useState(1)
  const brushRef = useRef(1); brushRef.current = brush
  const [saveMsg, setSaveMsg] = useState('')
  // recomputed each render; resize bumps version → re-render → fresh dims (drives the geometry key)
  const dims = `${gridRef.current[0]?.length ?? 0}x${gridRef.current.length}`

  const paint = useCallback((c: number, r: number, shift: boolean) => {
    const t = toolRef.current, b = brushRef.current
    const H = heightsRef.current, G = gridRef.current
    const rows = G.length, cols = G[0].length
    for (let dr = -b; dr <= b; dr++) for (let dc = -b; dc <= b; dc++) {
      const rr = r + dr, cc = c + dc
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue
      if (t === 'raise') H[rr][cc] = Math.min(MAX_TIER, H[rr][cc] + (shift ? -1 : 1))
      else if (t === 'lower') H[rr][cc] = Math.max(0, H[rr][cc] - 1)
      else if (t === 'wall') G[rr][cc] = WALL_ID
      else if (t === 'water') G[rr][cc] = WATER_ID
      else if (t === 'floor') G[rr][cc] = FLOOR_ID
      else if (t === 'warp') G[rr][cc] = WARP_ID
      else if (t === 'void') { G[rr][cc] = VOID; H[rr][cc] = 0 }
      if (t === 'raise') H[rr][cc] = Math.max(0, H[rr][cc])
    }
    setVersion((v) => v + 1)
  }, [])

  // Empty the whole zone to a blank grid — then draw the land's shape onto it.
  const clearZone = useCallback(() => {
    const G = gridRef.current, H = heightsRef.current
    for (let r = 0; r < G.length; r++) for (let c = 0; c < G[0].length; c++) { G[r][c] = VOID; H[r][c] = 0 }
    setVersion((v) => v + 1)
  }, [])

  // Grow/shrink the zone. New cells = floor at height 0; existing content keeps its NW origin.
  // (Resizing shifts the zone's edges → its warps need re-aligning afterward; Jin re-wires.)
  const resize = useCallback((dCols: number, dRows: number) => {
    const G = gridRef.current, H = heightsRef.current
    const oldRows = G.length, oldCols = G[0].length
    const rows = Math.max(8, Math.min(160, oldRows + dRows))
    const cols = Math.max(8, Math.min(160, oldCols + dCols))
    const ng: number[][] = [], nh: number[][] = []
    for (let r = 0; r < rows; r++) {
      const gr: number[] = [], hr: number[] = []
      for (let c = 0; c < cols; c++) {
        if (r < oldRows && c < oldCols) { gr.push(G[r][c]); hr.push(H[r]?.[c] ?? 0) }
        else { gr.push(VOID); hr.push(0) } // new space is empty — draw land into it
      }
      ng.push(gr); nh.push(hr)
    }
    gridRef.current = ng; heightsRef.current = nh
    const p = posRef.current!
    p.x = Math.max(1, Math.min(p.x, cols - 2))
    p.z = Math.max(1, Math.min(p.z, rows - 2))
    setVersion((v) => v + 1)
  }, [])

  const onWarp = useCallback((w: Warp) => {
    posRef.current!.set(w.toX, posRef.current!.y, w.toY)
    if (w.direction && DIR_YAW[w.direction] !== undefined) camYaw.current = DIR_YAW[w.direction]
    setZoneId(w.toZone)
  }, [])

  const save = useCallback(async () => {
    setSaveMsg('saving…')
    try {
      const id = zone.id
      const [h, g] = await Promise.all([
        fetch('/shimmer/save-heights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoneId: id, heights: heightsRef.current }) }),
        fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grid: gridRef.current, mapId: id }) }),
      ])
      setSaveMsg(h.ok && g.ok ? 'saved ✓ (ping Jin to build it live)' : 'save failed')
    } catch { setSaveMsg('save failed') }
    setTimeout(() => setSaveMsg(''), 3500)
  }, [zone.id])

  const Btn = ({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} style={{
      padding: '6px 10px', borderRadius: 6, border: active ? '2px solid #d4a843' : '1px solid #ffffff33',
      background: active ? '#d4a84333' : '#16142a', color: '#e9dfc8', font: '700 13px ui-monospace, monospace',
      cursor: 'pointer', pointerEvents: 'auto',
    }}>{children}</button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#bfe3ef', cursor: editMode ? 'crosshair' : 'default' }}>
      <Canvas shadows camera={{ fov: 45, position: [1, 6, 14], near: 0.1, far: 500 }} gl={{ antialias: true }}>
        <Scene
          zone={zone} gridRef={gridRef} heights={heightsRef.current} version={version} dims={dims}
          posRef={posRef as React.RefObject<THREE.Vector3>} heightsRef={heightsRef} zoneIdRef={zoneIdRef}
          editFocusRef={editFocusRef}
          onWarp={onWarp} yawRef={camYaw} editRef={editRef} paint={paint} editing={editMode}
        />
      </Canvas>

      <div style={{
        position: 'fixed', top: 12, left: 12, padding: '8px 12px', borderRadius: 8,
        background: 'rgba(10,8,20,0.66)', color: '#e9dfc8', font: '600 13px ui-monospace, monospace', lineHeight: 1.5,
      }}>
        Shimmer 3D — {zone.name}{editMode ? '  ·  EDIT' : ''}<br />
        <span style={{ opacity: 0.8 }}>
          {editMode ? 'left-drag paint · WASD fly · Q/E down·up · right-drag look · scroll zoom' : 'WASD · drag look · scroll zoom · edges warp · B to edit terrain'}
        </span>
      </div>

      {editMode && (
        <div style={{ position: 'fixed', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {TOOLS.map((t) => <Btn key={t.id} active={tool === t.id} onClick={() => setTool(t.id)}>{t.label}</Btn>)}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: '#e9dfc8', font: '700 13px ui-monospace, monospace' }}>brush {brush * 2 + 1}×{brush * 2 + 1}</span>
            <Btn onClick={() => setBrush((b) => Math.max(0, b - 1))}>−</Btn>
            <Btn onClick={() => setBrush((b) => Math.min(5, b + 1))}>+</Btn>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: '#e9dfc8', font: '700 13px ui-monospace, monospace' }}>size {dims}</span>
            <Btn onClick={() => resize(-2, 0)}>W−</Btn>
            <Btn onClick={() => resize(2, 0)}>W+</Btn>
            <Btn onClick={() => resize(0, -2)}>H−</Btn>
            <Btn onClick={() => resize(0, 2)}>H+</Btn>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn onClick={clearZone}>Clear to empty</Btn>
            <button onClick={save} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#d4a843', color: '#1a1a2e', font: '800 13px ui-monospace, monospace', cursor: 'pointer' }}>Save zone</button>
          </div>
          {saveMsg && <span style={{ color: '#e9dfc8', font: '600 12px ui-monospace, monospace' }}>{saveMsg}</span>}
        </div>
      )}

      <button onClick={() => setEditMode((e) => !e)} style={{
        position: 'fixed', bottom: 12, right: 12, padding: '8px 16px', borderRadius: 8, border: 'none',
        background: editMode ? '#b9483f' : '#d4a843', color: '#1a1a2e', font: '800 14px ui-monospace, monospace', cursor: 'pointer',
      }}>{editMode ? 'Done editing' : 'Edit terrain (B)'}</button>

      {/* keep the B hotkey too */}
      <KeyToggle onB={() => setEditMode((e) => !e)} />
    </div>
  )
}

function KeyToggle({ onB }: { onB: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'b') onB() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onB])
  return null
}
