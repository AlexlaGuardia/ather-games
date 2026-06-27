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
import { rollEncounter, type WildEncounter } from '../engine/encounters'
import { createSpirit, addXP, type Spirit, type Species } from '../spirits/spirit'
import { spiritsToSave, spiritsFromSave } from '../spirits/spirit-save'
import type { AITier } from '../engine/battle-ai'
import PartyBattleScene from '../components/PartyBattleScene'
import { useCloudSave } from '@/lib/use-cloud-save'
import { useWallet } from '@/lib/use-wallet'

const START_ZONE = 'moonwell-glade'
const WATER_ID = 8, FLOOR_ID = 97, WALL_ID = 34, WARP_ID = 14, MIST_ID = 31
// Encounters: stepping onto a fresh MIST tile can draw a wild spirit. Per-zone odds live in
// ENCOUNTER_TABLES (engine/encounters.ts → `rate`); these dials shape it for the 3D walker so a
// 888-mist zone isn't wall-to-wall battles.
const ENCOUNTER_GRACE = 1.3 // seconds after a battle / zone-entry before mist can roll again
const MAX_PARTY = 4         // active party size (matches the 2D game)
const VOID = -1 // empty cell — renders nothing, not walkable (draw land onto an empty grid)
const STEP = 1.0
const MAX_TIER = 8
const UP = new THREE.Vector3(0, 1, 0)
const DIR_YAW: Record<string, number> = { up: 0, down: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }

type Cell = [number, number]
type Tool = 'raise' | 'lower' | 'floor' | 'wall' | 'water' | 'mist' | 'warp' | 'void'

function buckets(grid: number[][]) {
  const floors: Cell[] = [], walls: Cell[] = [], waters: Cell[] = [], voids: Cell[] = [], warps: Cell[] = [], mists: Cell[] = []
  const rows = grid.length, cols = grid[0].length
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = grid[r][c]
    if (v === VOID) { voids.push([c, r]); continue }
    const id = v & 0xFF
    if (id === WARP_ID) warps.push([c, r])
    else if (id === MIST_ID) mists.push([c, r])
    else if (id === WATER_ID) waters.push([c, r])
    else if (walkable(grid, c, r)) floors.push([c, r])
    else walls.push([c, r])
  }
  return { floors, walls, waters, voids, warps, mists }
}

function lerpAngle(a: number, b: number, t: number) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t
}

// The 3D walker is still a standalone sandbox (no save yet) — field a small starter party so wild
// encounters actually play. When play3d gets save integration, swap this for the bonded party.
function makeStarterParty(): Spirit[] {
  const roster: { sp: Species; name: string; lvl: number }[] = [
    { sp: 'fox',     name: 'Ember', lvl: 7 },
    { sp: 'axolotl', name: 'Pip',   lvl: 6 },
    { sp: 'owl',     name: 'Sage',  lvl: 6 },
  ]
  return roster.map(({ sp, name, lvl }) => {
    const s = createSpirit(sp, name, 0, 0)
    s.level = lvl
    s.seeds = Array.from({ length: 6 }, () => 16 + Math.floor(Math.random() * 16)) // decent IVs
    s.bond = 120; s.happiness = 200
    return s
  })
}

const FILLER_SPECIES: Species[] = ['fox', 'axolotl', 'owl', 'frog', 'bat', 'rabbit', 'turtle', 'firefly', 'hummingbird', 'water-bear']

// Build the wild side from a rolled encounter. A wild draw is light: the lead + a ~45% weaker tag-along.
function buildWildParty(enc: WildEncounter): Spirit[] {
  const lead = createSpirit(enc.species, enc.name, 0, 0)
  lead.level = enc.level
  lead.element = enc.element
  lead.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
  const party = [lead]
  if (Math.random() < 0.45) {
    const sp = FILLER_SPECIES[Math.floor(Math.random() * FILLER_SPECIES.length)]
    const m = createSpirit(sp, `Wild ${sp.charAt(0).toUpperCase() + sp.slice(1)}`, 0, 0)
    m.level = Math.max(1, enc.level - 1 - Math.floor(Math.random() * 2))
    m.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
    party.push(m)
  }
  return party
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

// Wispy translucent cloud over mist cells — encounter areas you walk through.
function MistOverlay({ mists, heights }: { mists: Cell[]; heights: number[][] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(0.98, 0.8, 0.98)
    mists.forEach(([c, r], i) => { pos.set(c, (heights[r]?.[c] ?? 0) * STEP + 0.55, r); m.compose(pos, q, scl); mesh.setMatrixAt(i, m) })
    mesh.instanceMatrix.needsUpdate = true
  }, [mists, heights])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(mists.length, 1)]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#eef4ff" transparent opacity={0.42} emissive="#ffffff" emissiveIntensity={0.12} depthWrite={false} />
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
  const { floors, walls, waters, voids, warps, mists } = useMemo(() => buckets(gridRef.current), [version, gridRef])
  return (
    <>
      <FloorTerrain floors={floors} heights={heights} version={version} paint={paint} editing={editing} />
      {/* solid clouds = the walls */}
      <Tiles cells={walls} size={[1, 1.3, 1]} y={0.55} color="#e3e9f4" paint={paint} editing={editing} />
      <Tiles cells={waters} size={[1, 0.3, 1]} y={-0.15} color="#3aa0d6" opacity={0.85} paint={paint} editing={editing} />
      {/* cloud mist = walkable encounter areas: land + a wispy translucent overlay */}
      <FloorTerrain floors={mists} heights={heights} version={version} paint={paint} editing={editing} />
      <MistOverlay mists={mists} heights={heights} />
      {/* warp markers — glowing gold columns + beacons (you place; Jin wires the destinations) */}
      <FloorTerrain floors={warps} heights={heights} version={version} paint={paint} editing={editing} color="#caa233" emissive="#ffcf4d" />
      <WarpBeacons warps={warps} heights={heights} />
      {/* empty cells: invisible in play; a faint clickable grid-canvas to draw land onto while editing */}
      {editing && <Tiles cells={voids} size={[0.92, 0.05, 0.92]} y={-0.02} color="#39406b" opacity={0.5} paint={paint} editing={editing} />}
    </>
  )
}

function Player({ posRef, gridRef, heightsRef, zoneIdRef, editRef, onWarp, battleRef, partyLevelRef, onEncounter, joyRef }: {
  posRef: React.RefObject<THREE.Vector3>; gridRef: React.RefObject<number[][]>
  heightsRef: React.RefObject<number[][]>; zoneIdRef: React.RefObject<string>
  editRef: React.RefObject<boolean>; onWarp: (w: Warp) => void
  battleRef: React.RefObject<boolean>; partyLevelRef: React.RefObject<number>
  onEncounter: (enc: WildEncounter) => void
  joyRef: React.RefObject<{ x: number; y: number }>
}) {
  const group = useRef<THREE.Group>(null)
  const keys = useRef<Record<string, boolean>>({})
  const yaw = useRef(0)
  const lastTile = useRef('')
  const warpCd = useRef(0)
  const encGrace = useRef(ENCOUNTER_GRACE)
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

    // Edit mode → WASD drives the spectator camera. Battle → walker is frozen behind the overlay.
    // Either way, skip player movement / warps / encounters.
    if (!editRef.current && !battleRef.current) {
      state.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize()
      right.crossVectors(fwd, UP).normalize()
      move.set(0, 0, 0)
      if (k['w'] || k['arrowup']) move.add(fwd)
      if (k['s'] || k['arrowdown']) move.sub(fwd)
      if (k['d'] || k['arrowright']) move.add(right)
      if (k['a'] || k['arrowleft']) move.sub(right)
      // touch joystick (camera-relative, same as WASD): y = forward/back, x = strafe
      const j = joyRef.current
      if (j.x || j.y) { move.addScaledVector(fwd, j.y); move.addScaledVector(right, j.x) }

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
      if (encGrace.current > 0) encGrace.current -= dt
      if (warpCd.current > 0) warpCd.current -= dt
      else if (tileChanged) {
        const w = checkWarp(ZONES, zoneIdRef.current, tx, tz)
        if (w) { onWarp(w); warpCd.current = 0.4; encGrace.current = ENCOUNTER_GRACE }
        // No door here — a fresh mist tile can draw a wild spirit (warps win, so you're safe on a door).
        else if (encGrace.current <= 0) {
          const cell = grid[tz]?.[tx]
          if (cell !== undefined && (cell & 0xFF) === MIST_ID) {
            const enc = rollEncounter(zoneIdRef.current, partyLevelRef.current)
            if (enc) { encGrace.current = ENCOUNTER_GRACE; onEncounter(enc) }
          }
        }
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
      // only orbit from drags that START on the 3D canvas — touches on the joystick / buttons / HUD
      // are theirs, not the camera's.
      if (!(e.target instanceof HTMLCanvasElement)) return
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
  battleRef: React.RefObject<boolean>; partyLevelRef: React.RefObject<number>
  onEncounter: (enc: WildEncounter) => void
  joyRef: React.RefObject<{ x: number; y: number }>
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
      <Player posRef={props.posRef} gridRef={props.gridRef} heightsRef={props.heightsRef} zoneIdRef={props.zoneIdRef} editRef={props.editRef} onWarp={props.onWarp} battleRef={props.battleRef} partyLevelRef={props.partyLevelRef} onEncounter={props.onEncounter} joyRef={props.joyRef} />
      <CameraRig posRef={props.posRef} editFocusRef={props.editFocusRef} yawRef={props.yawRef} editRef={props.editRef} />
    </>
  )
}

// Compass — a needle that points to grid-north on screen. Driven by the live camera yaw via rAF
// (no React re-render). North = world -z; the rose rotates with the camera so N tracks the map.
function Compass({ yawRef }: { yawRef: React.RefObject<number> }) {
  const rose = useRef<HTMLDivElement>(null)
  const nlabel = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let id = 0
    const tick = () => {
      const y = yawRef.current
      if (rose.current) rose.current.style.transform = `rotate(${y}rad)`
      if (nlabel.current) nlabel.current.style.transform = `translate(-50%, -50%) rotate(${-y}rad)`
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [yawRef])
  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', marginLeft: -30, width: 60, height: 60, borderRadius: '50%',
      background: 'rgba(10,8,20,0.7)', border: '1px solid #ffffff44', pointerEvents: 'none',
    }}>
      <div ref={rose} style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0,
          borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '12px solid #e8584a',
        }} />
        <div style={{
          position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0,
          borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '12px solid #cdd4e3',
        }} />
        <span ref={nlabel} style={{ position: 'absolute', top: '24%', left: '50%', color: '#ffd9d2', font: '800 11px ui-monospace, monospace' }}>N</span>
      </div>
    </div>
  )
}

// Floating touch joystick (bottom-left). Writes an analog {x,y} (camera-relative: y up = forward) into
// joyRef, which Player reads alongside WASD. Captures its own pointer so the camera never sees the drag.
function TouchJoystick({ joyRef }: { joyRef: React.RefObject<{ x: number; y: number }> }) {
  const baseRef = useRef<HTMLDivElement>(null)
  const active = useRef(false)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const R = 44 // max knob travel (px)
  const update = (cx: number, cy: number) => {
    const r = baseRef.current!.getBoundingClientRect()
    const ox = r.left + r.width / 2, oy = r.top + r.height / 2
    let dx = cx - ox, dy = cy - oy
    const len = Math.hypot(dx, dy)
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R }
    setKnob({ x: dx, y: dy })
    joyRef.current.x = dx / R
    joyRef.current.y = -dy / R // screen-down is forward-negative
  }
  const end = () => { active.current = false; setKnob({ x: 0, y: 0 }); joyRef.current.x = 0; joyRef.current.y = 0 }
  return (
    <div
      ref={baseRef}
      onPointerDown={(e) => { e.stopPropagation(); active.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); update(e.clientX, e.clientY) }}
      onPointerMove={(e) => { if (active.current) { e.stopPropagation(); update(e.clientX, e.clientY) } }}
      onPointerUp={end}
      onPointerCancel={end}
      style={{
        position: 'fixed', bottom: 30, left: 30, width: 116, height: 116, borderRadius: '50%', zIndex: 30,
        background: 'rgba(18,14,36,0.4)', border: '2px solid #ffffff2e', touchAction: 'none',
      }}
    >
      <div style={{
        position: 'absolute', left: '50%', top: '50%', width: 54, height: 54, marginLeft: -27, marginTop: -27,
        borderRadius: '50%', transform: `translate(${knob.x}px, ${knob.y}px)`,
        background: 'rgba(212,168,67,0.85)', border: '2px solid #ffffff80', boxShadow: '0 2px 10px #0009', pointerEvents: 'none',
      }} />
    </div>
  )
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'floor', label: 'Land' }, { id: 'raise', label: 'Raise' }, { id: 'lower', label: 'Lower' },
  { id: 'wall', label: 'Cloud' }, { id: 'water', label: 'Water' }, { id: 'mist', label: 'Mist' },
  { id: 'warp', label: 'Warp' }, { id: 'void', label: 'Erase' },
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
  const joyRef = useRef({ x: 0, y: 0 }) // touch-joystick analog input → Player movement

  // ── Party + save. ather.games saves are per-browser localStorage (no login); the 3D walker shares
  // Shimmer's slot (`ather:save:shimmer`) and MERGES on write so it never clobbers 2D-only fields. ──
  const { load, save: saveGame } = useCloudSave('shimmer')
  const wallet = useWallet()
  const partyRef = useRef<Spirit[] | null>(null)
  if (!partyRef.current) partyRef.current = makeStarterParty() // synchronous default; load() may replace it
  const partyLevelRef = useRef(0)
  partyLevelRef.current = Math.round(partyRef.current.reduce((s, x) => s + x.level, 0) / partyRef.current.length)
  const battleRef = useRef(false)
  const [battle, setBattle] = useState<{ allies: Spirit[]; enemies: Spirit[]; aiTier: AITier; zoneId: string } | null>(null)
  const curBattleRef = useRef(battle); curBattleRef.current = battle
  const [banner, setBanner] = useState<string | null>(null)
  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), 2600); return () => clearTimeout(t) }, [banner])

  // Merge-save: preserve any 2D-only fields (furniture/crops/quests…) the 2D game may have written.
  const persist = useCallback(async () => {
    const prev = (await load()) ?? {}
    await saveGame({
      ...prev,
      spirits: spiritsToSave(partyRef.current ?? []),
      zoneId: zoneIdRef.current,
      playerTileX: Math.round(posRef.current!.x),
      playerTileY: Math.round(posRef.current!.z),
    })
  }, [load, saveGame])

  // Load once on mount: restore party + zone + position, or bank the starter party on first visit.
  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    let alive = true
    load().then((data) => {
      if (!alive) return
      if (data?.spirits?.length) {
        partyRef.current = spiritsFromSave(data.spirits)
        if (typeof data.playerTileX === 'number' && typeof data.playerTileY === 'number') {
          posRef.current!.set(data.playerTileX, posRef.current!.y, data.playerTileY)
        }
        if (data.zoneId && getZone(ZONES, data.zoneId)) setZoneId(data.zoneId)
      } else {
        persist() // first visit — seed the save so the starter party persists + grows
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [load, persist])

  // Auto-save every 30s + on page close (the walker can be left mid-stride).
  useEffect(() => {
    const id = setInterval(() => { persist() }, 30_000)
    const onLeave = () => { persist() }
    window.addEventListener('beforeunload', onLeave)
    return () => { clearInterval(id); window.removeEventListener('beforeunload', onLeave); persist() }
  }, [persist])

  const onEncounter = useCallback((enc: WildEncounter) => {
    battleRef.current = true
    setBattle({ allies: partyRef.current!, enemies: buildWildParty(enc), aiTier: enc.aiTier, zoneId: zoneIdRef.current })
  }, [])

  // Battle end: on a win, split rewards across the party (XP / bond / happiness / gold), then save.
  const endBattle = useCallback((outcome: 'win' | 'lose') => {
    battleRef.current = false
    const bd = curBattleRef.current
    if (outcome === 'win' && bd) {
      const totalXp = bd.enemies.reduce((s, e) => s + Math.max(8, e.level * 12), 0)
      const gold = bd.enemies.reduce((s, e) => s + e.level * 3, 0)
      const allies = (partyRef.current ?? []).slice(0, MAX_PARTY)
      const perXp = Math.max(1, Math.round(totalXp / Math.max(1, allies.length)))
      if (gold > 0) wallet.earn(gold)
      for (const spirit of allies) {
        const xpResult = addXP(spirit, perXp)
        spirit.bond = Math.min(255, spirit.bond + 4)
        spirit.happiness = Math.min(255, spirit.happiness + 3)
        // Full evolution (form/element change) is the 2D EvolutionScene's job — not ported yet. We just
        // celebrate the threshold here; the spirit keeps leveling until it can evolve in the full flow.
        if (xpResult.evolved) setBanner(`✦ ${spirit.name} is ready to evolve!`)
      }
    }
    setBattle(null)
    persist()
  }, [wallet, persist])

  // New Game: fresh starter party back at the start zone (merge-save keeps any 2D fields intact).
  const newGame = useCallback(() => {
    partyRef.current = makeStarterParty()
    const z = getZone(ZONES, START_ZONE)!
    const ps = z.playerStart ?? { tileX: 1, tileY: 1 }
    posRef.current!.set(ps.tileX, posRef.current!.y, ps.tileY)
    setZoneId(START_ZONE)
    setBanner('new game — fresh party')
    persist()
  }, [persist])

  const [version, setVersion] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const editRef = useRef(false); editRef.current = editMode

  // The walker is public; the terrain editor is owner-only. ather.games has no cloud auth, so owner
  // status comes from the httpOnly `ather_owner` cookie via /api/owner (set it at /owner?key=OWNER_KEY).
  const [isOwner, setIsOwner] = useState(false)
  useEffect(() => {
    let alive = true
    fetch('/api/owner', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { owner: false }))
      .then((d) => { if (alive && d.owner) setIsOwner(true) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  // Show on-screen touch controls (joystick + A/B) on touch devices; desktop keeps WASD + drag-look.
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => { setIsTouch((window.matchMedia?.('(pointer: coarse)').matches ?? false) || 'ontouchstart' in window) }, [])
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
      else if (t === 'mist') G[rr][cc] = MIST_ID
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

  // Jump straight to a zone to edit it (no walking/warping). Resets the player + camera focus
  // to its spawn. NOTE: unsaved edits in the current zone are dropped — save before switching.
  const selectZone = useCallback((id: string) => {
    const z = getZone(ZONES, id)
    if (!z) return
    const ps = z.playerStart ?? { tileX: 1, tileY: 1 }
    posRef.current!.set(ps.tileX, 0, ps.tileY)
    editFocusRef.current.set(ps.tileX, 0, ps.tileY)
    setZoneId(id)
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
    <div style={{ position: 'fixed', inset: 0, background: '#bfe3ef', cursor: editMode ? 'crosshair' : 'default', touchAction: 'none', overscrollBehavior: 'none' }}>
      <Canvas shadows camera={{ fov: 45, position: [1, 6, 14], near: 0.1, far: 500 }} gl={{ antialias: true }}>
        <Scene
          zone={zone} gridRef={gridRef} heights={heightsRef.current} version={version} dims={dims}
          posRef={posRef as React.RefObject<THREE.Vector3>} heightsRef={heightsRef} zoneIdRef={zoneIdRef}
          editFocusRef={editFocusRef}
          onWarp={onWarp} yawRef={camYaw} editRef={editRef} paint={paint} editing={editMode}
          battleRef={battleRef} partyLevelRef={partyLevelRef} onEncounter={onEncounter} joyRef={joyRef}
        />
      </Canvas>

      <div style={{
        position: 'fixed', top: 12, left: 12, padding: '8px 12px', borderRadius: 8,
        background: 'rgba(10,8,20,0.66)', color: '#e9dfc8', font: '600 13px ui-monospace, monospace', lineHeight: 1.5,
      }}>
        Shimmer 3D — {zone.name}{editMode ? '  ·  EDIT' : ''}<br />
        <span style={{ opacity: 0.8 }}>
          {editMode ? 'left-drag paint · WASD fly · Q/E down·up · right-drag look · scroll zoom' : `WASD · drag look · scroll zoom · edges warp · mist = wild spirits${isOwner ? ' · B to edit' : ''}`}
        </span>
        {!editMode && <><br /><span style={{ color: '#ffe08a' }}>✦ {wallet.marks} marks</span></>}
      </div>

      <Compass yawRef={camYaw} />

      {/* milestone toast (evolution-ready, new game) */}
      {banner && (
        <div style={{
          position: 'fixed', top: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 40,
          padding: '8px 16px', borderRadius: 999, background: 'rgba(20,16,40,0.92)', border: '1px solid #d4a84366',
          color: '#ffe9b0', font: '700 13px ui-monospace, monospace', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>{banner}</div>
      )}

      {/* top-right (walking): owner Edit-enter + New Game (two-tap confirm). Bottom corners are the controls. */}
      {!battle && !editMode && (
        <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          {isOwner && (
            <button onClick={() => setEditMode(true)} style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #ffffff33', background: '#16142a', color: '#e9dfc8',
              font: '700 12px ui-monospace, monospace', cursor: 'pointer',
            }}>Edit terrain</button>
          )}
          {confirmNew ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: '#e9dfc8', font: '700 12px ui-monospace, monospace' }}>reset party?</span>
              <button onClick={() => { setConfirmNew(false); newGame() }} style={{
                padding: '6px 12px', borderRadius: 6, border: 'none', background: '#b9483f', color: '#fff',
                font: '800 12px ui-monospace, monospace', cursor: 'pointer',
              }}>Yes</button>
              <button onClick={() => setConfirmNew(false)} style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid #ffffff33', background: '#16142a', color: '#e9dfc8',
                font: '700 12px ui-monospace, monospace', cursor: 'pointer',
              }}>No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmNew(true)} style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #ffffff33', background: '#16142a', color: '#e9dfc8',
              font: '700 12px ui-monospace, monospace', cursor: 'pointer',
            }}>New Game</button>
          )}
        </div>
      )}

      {editMode && (
        <div style={{ position: 'fixed', top: 70, left: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <select
            value={zoneId}
            onChange={(e) => selectZone(e.target.value)}
            style={{
              padding: '6px 8px', borderRadius: 6, border: '1px solid #ffffff33', background: '#16142a',
              color: '#e9dfc8', font: '700 13px ui-monospace, monospace', cursor: 'pointer', pointerEvents: 'auto', maxWidth: 260,
            }}
          >
            {ZONES.map((z) => <option key={z.id} value={z.id}>{z.name}{z.id !== z.name ? ` (${z.id})` : ''}</option>)}
          </select>
          <span style={{ color: '#e9dfc8', opacity: 0.55, font: '600 11px ui-monospace, monospace' }}>jump to a map · save before switching</span>
        </div>
      )}

      {editMode && (
        <div style={{ position: 'fixed', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 480 }}>
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

      {/* edit-mode Done button (enter is top-right; touch controls are hidden while editing) */}
      {editMode && isOwner && (
        <button onClick={() => setEditMode(false)} style={{
          position: 'fixed', bottom: 12, right: 12, padding: '8px 16px', borderRadius: 8, border: 'none',
          background: '#b9483f', color: '#1a1a2e', font: '800 14px ui-monospace, monospace', cursor: 'pointer',
        }}>Done editing</button>
      )}

      {/* ── Mobile controls: joystick (move) bottom-left · A interact / B cancel bottom-right ── */}
      {isTouch && !battle && !editMode && (
        <>
          <TouchJoystick joyRef={joyRef} />
          <div style={{ position: 'fixed', bottom: 30, right: 30, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            {/* B — cancel/back (upper, smaller). Backs out of the New Game prompt / dismisses a toast. */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); if (confirmNew) setConfirmNew(false); else if (banner) setBanner(null) }}
              aria-label="cancel"
              style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid #ffffff33', background: 'rgba(70,44,52,0.72)', color: '#f3dada', font: '800 19px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' }}
            >✕</button>
            {/* A — interact/confirm (lower, bigger, where the thumb rests). Confirms New Game; reserved for NPCs. */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); if (confirmNew) { setConfirmNew(false); newGame() } /* else: interact — wired for NPCs/objects as they land in 3D */ }}
              aria-label="interact"
              style={{ width: 76, height: 76, borderRadius: '50%', border: '2px solid #ffffff4d', background: 'rgba(36,84,72,0.8)', color: '#dffaf0', font: '800 23px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' }}
            >✦</button>
          </div>
        </>
      )}

      {/* B hotkey (keyboard) — owner only, and not while a battle overlay is up */}
      <KeyToggle onB={() => { if (isOwner && !battleRef.current) setEditMode((e) => !e) }} />

      {/* Wild encounter — the real party battle, mounted over the 3D world. */}
      {battle && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#0a0a12' }}>
          <PartyBattleScene
            allySpirits={battle.allies}
            enemySpirits={battle.enemies}
            zoneId={battle.zoneId}
            ai={{ focusFire: battle.aiTier !== 'wild', spendMana: battle.aiTier !== 'wild' }}
            onEnd={endBattle}
          />
        </div>
      )}
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
