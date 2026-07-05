'use client'
// Phase 1 foundation: the blockout map walkable in 3D, blocky tiered terrain, and an in-3D
// BLOCKOUT TOOL — press B for edit mode, pick a tool (Raise/Lower/Wall/Water/Floor) + brush size
// from the on-screen palette, click/drag the terrain, then Save. Height tools edit the per-zone
// height grid; cell tools edit the tile grid (so you can remove water/walls). Save persists both
// (heights→/shimmer/save-heights, grid→/shimmer/save-map). Warps/collision reuse the 2D engine.
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useRef, useEffect, useLayoutEffect, useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'
import { walkable } from '../engine/player'
import { ZONES, getZone, checkWarp, type Zone, type Warp } from '../world/zones'
import { getHeightGrid } from '../world/heightmaps'
import { rollEncounter, type WildEncounter } from '../engine/encounters'
import { createSpirit, addXP, xpForLevel, speciesDisplayName, ELEMENT_COLORS, type Spirit, type Species, type Element } from '../spirits/spirit'
import { spiritsToSave, spiritsFromSave } from '../spirits/spirit-save'
import { LAUNCHED_SPECIES } from '../engine/spirit-index'
import { ZONE_NODES, type NodePlacement } from '../world/node-placements'
import type { NodeType } from '../world/resources'
import type { AITier } from '../engine/battle-ai'
import PartyBattleScene from '../components/PartyBattleScene'
import ArenaBattle from '../components/ArenaBattle'
import HotBar from './HotBar'
import { NPCS_3D, GREG_INTRO_LINES, GREG_NUDGE, GREG_RETURN, THISTLE_TAUNT_NO_SPIRIT, THISTLE_PREFIGHT, THISTLE_DEFEAT, FREED_SPIRIT_BEAT, SORREL_PREFIGHT, SORREL_DEFEAT, FREED_PAIR_BEAT, BRACK_PREFIGHT, BRACK_FINALE, BRACK_FORCED_BEAT, type NPC3D } from './npcs3d'
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
type Tool = 'raise' | 'lower' | 'floor' | 'wall' | 'water' | 'mist' | 'warp' | 'void' | NodeType
// Node-placing tools exposed in the editor (place = click, erase = shift-click). Terrain tools
// paint the tile grid; node tools drop/remove a resource node in the separate node layer.
const NODE_TOOLS: { id: NodeType; label: string }[] = [
  { id: 'shimmeroak', label: 'Shimmeroak' },
]
const NODE_TOOL_IDS = new Set<string>(NODE_TOOLS.map(t => t.id))

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

// Gregory's gift — ONE young spirit, RNG from the launched roster (the canon starter mechanic). The new
// player gets this from Greg's first-quest handoff, not at spawn, so they have a reason to meet him.
function makeStarterSpirit(): Spirit {
  const sp = LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
  const s = createSpirit(sp, speciesDisplayName(sp), 0, 0)
  s.level = 5
  s.seeds = Array.from({ length: 6 }, () => 16 + Math.floor(Math.random() * 16)) // decent IVs
  s.bond = 40
  s.happiness = 160
  return s
}

const FILLER_SPECIES: Species[] = ['fox', 'axolotl', 'owl', 'frog', 'bat', 'rabbit', 'turtle', 'firefly', 'hummingbird', 'water-bear']

// Build the wild side from a rolled encounter. A wild draw is light: the lead + a ~45% weaker tag-along —
// but never gang up on a lone starter (party of 1 always faces a fair 1v1).
function buildWildParty(enc: WildEncounter, playerPartySize: number): Spirit[] {
  const lead = createSpirit(enc.species, enc.name, 0, 0)
  lead.level = enc.level
  lead.element = enc.element
  lead.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
  const party = [lead]
  if (playerPartySize > 1 && Math.random() < 0.45) {
    const sp = FILLER_SPECIES[Math.floor(Math.random() * FILLER_SPECIES.length)]
    const m = createSpirit(sp, `Wild ${sp.charAt(0).toUpperCase() + sp.slice(1)}`, 0, 0)
    m.level = Math.max(1, enc.level - 1 - Math.floor(Math.random() * 2))
    m.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
    party.push(m)
  }
  return party
}

// NPC markers in the current zone — a body, a head, and a tall findable beacon so you spot them fast.
// Moglins keep a dimmed collared spirit beside them (canon) and glow an ominous violet, not warm gold.
function NPCMarkers({ npcs, heights }: { npcs: NPC3D[]; heights: number[][] }) {
  return (
    <>
      {npcs.map((n) => {
        const y = (heights[n.tileY]?.[n.tileX] ?? 0) * STEP
        const moglin = n.kind === 'moglin'
        return (
          <group key={n.id} position={[n.tileX, y, n.tileY]}>
            <mesh position={[0, 0.85, 0]} castShadow><capsuleGeometry args={[0.32, 0.7, 4, 10]} /><meshStandardMaterial color={n.color} /></mesh>
            <mesh position={[0, 1.55, 0]} castShadow><sphereGeometry args={[0.26, 14, 14]} /><meshStandardMaterial color="#ecdab4" /></mesh>
            {moglin && <mesh position={[0.9, 0.5, 0.25]} castShadow><sphereGeometry args={[0.22, 12, 12]} /><meshStandardMaterial color="#6b6675" emissive="#241f2e" emissiveIntensity={0.4} /></mesh>}
            <mesh position={[0, 3.1, 0]}><boxGeometry args={[0.13, 2.2, 0.13]} /><meshStandardMaterial color={moglin ? '#b58adf' : '#ffe08a'} emissive={moglin ? '#7a4fc0' : '#ffcf4d'} emissiveIntensity={0.92} transparent opacity={0.8} /></mesh>
          </group>
        )
      })}
    </>
  )
}

// Resource-node placeholder looks — a trunk + canopy blockout per type (real models come later,
// per the art rule). Canon reads: goldwood = golden, shimmeroak = larger with a rippled/shimmery
// emerald canopy, starwillow = pale drooping, dawnwood = warm-glow. Crystals = angular gem shapes.
const NODE_LOOK: Record<string, { trunk: string; canopy: string; scale: number; glow?: number; gem?: boolean }> = {
  goldwood:   { trunk: '#8a6a3c', canopy: '#d9b84a', scale: 1 },
  shimmeroak: { trunk: '#6f5330', canopy: '#4fc79a', scale: 1.35, glow: 0.35 },
  starwillow: { trunk: '#9a8f7a', canopy: '#cfe6d0', scale: 1.15 },
  dawnwood:   { trunk: '#7a4a34', canopy: '#f0a86a', scale: 1.2, glow: 0.5 },
  raw_mana_node: { trunk: '#3a4a6a', canopy: '#6fbce6', scale: 0.8, gem: true, glow: 0.4 },
  element_crystal_node: { trunk: '#5a3a6a', canopy: '#c88ae6', scale: 0.9, gem: true, glow: 0.5 },
}
function NodeMarkers({ nodes, heights, editing }: { nodes: NodePlacement[]; heights: number[][]; editing: boolean }) {
  return (
    <>
      {nodes.map((n, i) => {
        const look = NODE_LOOK[n.type] ?? NODE_LOOK.goldwood
        const y = (heights[n.tileY]?.[n.tileX] ?? 0) * STEP
        const s = look.scale
        return (
          <group key={`${n.type}-${n.tileX}-${n.tileY}-${i}`} position={[n.tileX, y, n.tileY]}>
            {/* trunk */}
            <mesh position={[0, 0.5 * s, 0]} castShadow><cylinderGeometry args={[0.13 * s, 0.17 * s, s, 7]} /><meshStandardMaterial color={look.trunk} roughness={0.9} /></mesh>
            {/* canopy — gem nodes get an angular crystal, trees a rounded crown */}
            {look.gem
              ? <mesh position={[0, s + 0.2, 0]} castShadow><octahedronGeometry args={[0.45 * s, 0]} /><meshStandardMaterial color={look.canopy} emissive={look.canopy} emissiveIntensity={look.glow ?? 0.3} roughness={0.3} /></mesh>
              : <mesh position={[0, s + 0.35 * s, 0]} castShadow><icosahedronGeometry args={[0.62 * s, 0]} /><meshStandardMaterial color={look.canopy} emissive={look.canopy} emissiveIntensity={look.glow ?? 0} roughness={0.8} flatShading /></mesh>}
            {/* edit-mode label so you can tell what you placed */}
            {editing && (
              <Html position={[0, s + 1.2, 0]} center distanceFactor={12} pointerEvents="none">
                <div style={{ font: '700 10px ui-monospace, monospace', color: '#0d1a17', background: '#eafff6d0', border: '1px solid #2f5c4f', borderRadius: 5, padding: '1px 5px', whiteSpace: 'nowrap' }}>{n.type}</div>
              </Html>
            )}
          </group>
        )
      })}
    </>
  )
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

// An NPC stands in the world when it hasn't been cleared (defeated) and its gate flag (if any) is set.
// Gating chains the holds: Sorrel only appears once `freedThistle` is true (he fled up here).
function npcInWorld(n: NPC3D, defeated: Record<string, boolean>, flags: Record<string, boolean>): boolean {
  if (defeated[n.id]) return false
  if (n.requiredFlag && !flags[n.requiredFlag]) return false
  return true
}

function Player({ posRef, gridRef, heightsRef, zoneIdRef, editRef, onWarp, battleRef, partyLevelRef, onEncounter, joyRef, talkingRef, hasPartyRef, onNearChange, defeatedRef, flagsRef }: {
  posRef: React.RefObject<THREE.Vector3>; gridRef: React.RefObject<number[][]>
  heightsRef: React.RefObject<number[][]>; zoneIdRef: React.RefObject<string>
  editRef: React.RefObject<boolean>; onWarp: (w: Warp) => void
  battleRef: React.RefObject<boolean>; partyLevelRef: React.RefObject<number>
  onEncounter: (enc: WildEncounter) => void
  joyRef: React.RefObject<{ x: number; y: number }>
  talkingRef: React.RefObject<boolean>; hasPartyRef: React.RefObject<boolean>
  onNearChange: (n: NPC3D | null) => void
  defeatedRef: React.RefObject<Record<string, boolean>>
  flagsRef: React.RefObject<Record<string, boolean>>
}) {
  const group = useRef<THREE.Group>(null)
  const keys = useRef<Record<string, boolean>>({})
  const yaw = useRef(0)
  const lastTile = useRef('')
  const warpCd = useRef(0)
  const encGrace = useRef(ENCOUNTER_GRACE)
  const lastNear = useRef<string | null>(null)
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

    // Edit mode → WASD drives the spectator camera. Battle / dialogue → walker is frozen behind the
    // overlay. Either way, skip player movement / warps / encounters / NPC proximity.
    if (!editRef.current && !battleRef.current && !talkingRef.current) {
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
        // No door — a fresh mist tile can draw a wild spirit, but only once you HAVE a spirit (Greg's
        // starter). Before that the mist is just scenery, so a fresh player is never stuck in a fight.
        else if (encGrace.current <= 0 && hasPartyRef.current) {
          const cell = grid[tz]?.[tx]
          if (cell !== undefined && (cell & 0xFF) === MIST_ID) {
            // The FIRST mist a new Keeper crosses is a guaranteed draw so the arena reliably
            // introduces itself (the start zone has no mist, so this lands on the way to Thistle).
            // Every crossing after is the normal per-step rate.
            const force = !flagsRef.current.metFirstWild
            const enc = rollEncounter(zoneIdRef.current, partyLevelRef.current, false, force)
            if (enc) { encGrace.current = ENCOUNTER_GRACE; flagsRef.current.metFirstWild = true; onEncounter(enc) }
          }
        }
      }

      // Nearest interactable NPC in this zone (within ~1.7 tiles) → drive the "talk" prompt. Fires
      // onNearChange only on enter/leave so we don't churn React state every frame.
      let near: NPC3D | null = null
      let best = 1.7
      for (const n of NPCS_3D) {
        if (n.zone !== zoneIdRef.current || !npcInWorld(n, defeatedRef.current, flagsRef.current)) continue
        const d = Math.hypot(n.tileX - p.x, n.tileY - p.z)
        if (d < best) { best = d; near = n }
      }
      const nid = near?.id ?? null
      if (nid !== lastNear.current) { lastNear.current = nid; onNearChange(near) }
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
  talkingRef: React.RefObject<boolean>; hasPartyRef: React.RefObject<boolean>
  onNearChange: (n: NPC3D | null) => void
  defeatedRef: React.RefObject<Record<string, boolean>>; defeated: Record<string, boolean>
  flagsRef: React.RefObject<Record<string, boolean>>
  nodes: NodePlacement[]
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
      <NPCMarkers npcs={NPCS_3D.filter((n) => n.zone === props.zone.id && npcInWorld(n, props.defeated, props.flagsRef.current))} heights={props.heights} />
      <NodeMarkers nodes={props.nodes} heights={props.heights} editing={props.editing} />
      <Player posRef={props.posRef} gridRef={props.gridRef} heightsRef={props.heightsRef} zoneIdRef={props.zoneIdRef} editRef={props.editRef} onWarp={props.onWarp} battleRef={props.battleRef} partyLevelRef={props.partyLevelRef} onEncounter={props.onEncounter} joyRef={props.joyRef} talkingRef={props.talkingRef} hasPartyRef={props.hasPartyRef} onNearChange={props.onNearChange} defeatedRef={props.defeatedRef} flagsRef={props.flagsRef} />
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
function TouchJoystick({ joyRef, bottom = 30 }: { joyRef: React.RefObject<{ x: number; y: number }>; bottom?: number }) {
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
  // If the stick unmounts mid-drag (an encounter fires, edit mode opens…), onPointerUp never
  // runs, so joyRef keeps its last vector and the player walks off in that direction once the
  // stick remounts. Zero it on unmount so movement always stops cleanly.
  useEffect(() => () => { joyRef.current.x = 0; joyRef.current.y = 0 }, [joyRef])
  return (
    <div
      ref={baseRef}
      onPointerDown={(e) => { e.stopPropagation(); active.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); update(e.clientX, e.clientY) }}
      onPointerMove={(e) => { if (active.current) { e.stopPropagation(); update(e.clientX, e.clientY) } }}
      onPointerUp={end}
      onPointerCancel={end}
      style={{
        position: 'fixed', bottom, left: 30, width: 116, height: 116, borderRadius: '50%', zIndex: 30,
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

  // Resource nodes for this zone — seeded from the authored ZONE_NODES layer; the editor
  // adds/removes them and the Save button writes them back to node-placements.ts.
  const [nodes, setNodes] = useState<NodePlacement[]>(() => (ZONE_NODES[zone.id] ?? []).map(n => ({ ...n })))
  const nodesRef = useRef(nodes); nodesRef.current = nodes
  useEffect(() => { setNodes((ZONE_NODES[zone.id] ?? []).map(n => ({ ...n }))) }, [zone.id])

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
  if (!partyRef.current) partyRef.current = [] // empty until Greg's starter handoff; load() may replace it
  const hasPartyRef = useRef(false); hasPartyRef.current = (partyRef.current?.length ?? 0) > 0
  const partyLevelRef = useRef(0)
  partyLevelRef.current = partyRef.current.length
    ? Math.round(partyRef.current.reduce((s, x) => s + x.level, 0) / partyRef.current.length)
    : 5
  const flagsRef = useRef<Record<string, boolean>>({})
  const battleRef = useRef(false)
  const talkingRef = useRef(false)
  const [hasStarter, setHasStarter] = useState(false) // reactive mirror of "party has ≥1 spirit" for HUD
  const [defeated, setDefeated] = useState<Record<string, boolean>>({}) // NPCs cleared from the world (by id)
  const defeatedRef = useRef(defeated); defeatedRef.current = defeated
  const [battle, setBattle] = useState<{ allies: Spirit[]; enemies: Spirit[]; aiTier: AITier; zoneId: string; reach?: boolean; captiveIdxs?: number[]; kind?: 'wild' | 'thistle' | 'sorrel' | 'brack' } | null>(null)
  const curBattleRef = useRef(battle); curBattleRef.current = battle
  // Wild encounters play a brief "drawn to you" approach beat before the arena mounts (see below).
  const [approach, setApproach] = useState<{ enc: WildEncounter; battle: NonNullable<typeof battle> } | null>(null)
  // Post-win spoils reveal (wild fights): per-spirit XP/level breakdown + gold, shown before returning.
  type RewardRow = { name: string; element: Element; fromLevel: number; toLevel: number; xpGained: number; curXp: number; needXp: number; evolved: boolean }
  const [rewards, setRewards] = useState<{ gold: number; rows: RewardRow[] } | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [nearNpc, setNearNpc] = useState<NPC3D | null>(null)
  const [dialogue, setDialogue] = useState<{ name: string; lines: string[]; speakers?: string[]; idx: number; grantAt?: number; onDone: () => void } | null>(null)
  const dialogueRef = useRef(dialogue); dialogueRef.current = dialogue
  useEffect(() => { talkingRef.current = !!dialogue }, [dialogue])
  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), 2600); return () => clearTimeout(t) }, [banner])

  // Merge-save: preserve any 2D-only fields (furniture/crops/quests…) the 2D game may have written.
  const persist = useCallback(async () => {
    const prev = (await load()) ?? {}
    await saveGame({
      ...prev,
      spirits: spiritsToSave(partyRef.current ?? []),
      flags: { ...(prev.flags ?? {}), ...flagsRef.current },
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
      if (data?.flags) {
        flagsRef.current = data.flags
        // re-hide any NPC whose defeated-flag is already set in the save (e.g. Thistle, once freed)
        const cleared: Record<string, boolean> = {}
        for (const n of NPCS_3D) if (n.defeatedFlag && data.flags[n.defeatedFlag]) cleared[n.id] = true
        if (Object.keys(cleared).length) setDefeated(cleared)
      }
      if (data?.spirits?.length) {
        partyRef.current = spiritsFromSave(data.spirits)
        setHasStarter(true)
        if (typeof data.playerTileX === 'number' && typeof data.playerTileY === 'number') {
          posRef.current!.set(data.playerTileX, posRef.current!.y, data.playerTileY)
        }
        if (data.zoneId && getZone(ZONES, data.zoneId)) setZoneId(data.zoneId)
      } else {
        persist() // first visit — bank an empty save; the player gets their starter from Gregory
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
    battleRef.current = true   // freeze the walker through the approach beat AND the fight
    const size = partyRef.current?.length ?? 1
    // Stage the fight, but show the approach beat first — the arena mounts when it commits.
    setApproach({ enc, battle: { allies: partyRef.current!, enemies: buildWildParty(enc, size), aiTier: enc.aiTier, zoneId: zoneIdRef.current, kind: 'wild' } })
  }, [])

  // Approach beat → arena: hold the "drawn to you" flash ~1.3s, then mount the real fight.
  const commitApproach = useCallback(() => {
    setApproach(a => { if (a) setBattle(a.battle); return null })
  }, [])
  useEffect(() => {
    if (!approach) return
    const t = setTimeout(commitApproach, 1300)
    return () => clearTimeout(t)
  }, [approach, commitApproach])

  // DEV: force a wild Keeper's Arena fight in-world, ignoring the party/zone/RNG gates —
  // so the arena can be feel-tested without owning a starter or being in an encounter zone.
  // Uses the real party if present; otherwise a throwaway test trio (never persisted).
  const forceFight = useCallback(() => {
    const real = partyRef.current ?? []
    const allies = real.length > 0
      ? real
      : (['fox', 'owl', 'water-bear'] as const).map((sp, i) => {
          const s = createSpirit(sp, ['Kit', 'Sage', 'Tor'][i], 0, 0)
          s.level = 12; s.bond = 60; s.happiness = 128
          return s
        })
    const enc = rollEncounter(zoneIdRef.current, partyLevelRef.current || 12)
    const enemies = enc
      ? buildWildParty(enc, allies.length)
      : (['frog', 'bat'] as const).map((sp, i) => {
          const s = createSpirit(sp, ['Blightling', 'Gnash'][i], 0, 0)
          s.level = Math.max(10, partyLevelRef.current || 12)
          return s
        })
    battleRef.current = true
    setBattle({ allies, enemies, aiTier: enc?.aiTier ?? 'wild', zoneId: zoneIdRef.current, kind: 'wild' })
  }, [])

  // Battle end: on a win, split rewards across the party (XP / bond / happiness / gold), then save.
  const endBattle = useCallback((outcome: 'win' | 'lose', reachResult?: 'freed' | 'forced' | 'fainted' | null) => {
    battleRef.current = false
    const bd = curBattleRef.current
    let spoils: { gold: number; rows: RewardRow[] } | null = null
    if (outcome === 'win' && bd) {
      const totalXp = bd.enemies.reduce((s, e) => s + Math.max(8, e.level * 12), 0)
      const gold = bd.enemies.reduce((s, e) => s + e.level * 3, 0)
      const allies = (partyRef.current ?? []).slice(0, MAX_PARTY)
      const perXp = Math.max(1, Math.round(totalXp / Math.max(1, allies.length)))
      if (gold > 0) wallet.earn(gold)
      const rows: RewardRow[] = []
      for (const spirit of allies) {
        const fromLevel = spirit.level
        const xpResult = addXP(spirit, perXp)
        spirit.bond = Math.min(255, spirit.bond + 4)
        spirit.happiness = Math.min(255, spirit.happiness + 3)
        // Full evolution (form/element change) is the 2D EvolutionScene's job — not ported yet. We just
        // celebrate the threshold here; the spirit keeps leveling until it can evolve in the full flow.
        if (xpResult.evolved) setBanner(`✦ ${spirit.name} is ready to evolve!`)
        rows.push({ name: spirit.name, element: spirit.element, fromLevel, toLevel: spirit.level, xpGained: perXp, curXp: spirit.xp, needXp: xpForLevel(spirit.level), evolved: !!xpResult.evolved })
      }
      // Wild fights get the spoils reveal; the scripted holds keep their narrative payoff (dialogue below).
      if (!bd.kind || bd.kind === 'wild') spoils = { gold, rows }
    }
    setBattle(null)
    if (spoils) { battleRef.current = true; setRewards(spoils) }   // stay frozen behind the reveal
    // Liberation beat: freeing Thistle's collared spirit clears Hold 1 — he deflates and retreats east.
    if (outcome === 'win' && bd?.kind === 'thistle') {
      flagsRef.current.freedThistle = true
      setDefeated((d) => ({ ...d, thistle: true }))
      // Canon cares HOW you won: reaching frees the spirit; forcing it KO'd the captive ("not the way").
      const closing = reachResult === 'forced'
        ? 'You overpowered the captive, but you forced it. That was not the way. Still, Thistle has had enough.'
        : FREED_SPIRIT_BEAT
      setDialogue({ name: 'Thistle', lines: [...THISTLE_DEFEAT, closing], idx: 0, onDone: () => setBanner('✦ Hold 1 cleared — Spirit Meadows is open') })
    }
    // Hold 2: Sorrel's stronghold falls — both collars break, he retreats up to Brack, and a Mana Seed
    // is left behind. Canon reward = the Mana Seed blooms into a new companion (party growth = seeds/bloom).
    if (outcome === 'win' && bd?.kind === 'sorrel') {
      flagsRef.current.freedSorrel = true
      setDefeated((d) => ({ ...d, sorrel: true }))
      const sp = LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
      const bloom = createSpirit(sp, speciesDisplayName(sp), 0, 0)
      bloom.level = Math.max(5, partyLevelRef.current)
      partyRef.current = [...(partyRef.current ?? []), bloom]
      const closing = reachResult === 'forced'
        ? 'You overpowered them, but you forced it. That was not the way. Still, Sorrel has had enough.'
        : FREED_PAIR_BEAT
      setDialogue({ name: 'Sorrel', lines: [...SORREL_DEFEAT, closing, `A Mana Seed sits where the leashes were. It blooms — a young ${speciesDisplayName(sp)} joins you.`], idx: 0, onDone: () => setBanner('✦ Hold 2 cleared — the Mana Springs are free') })
    }
    // Hold 3 — the climax. Brack's stronghold falls; all three collars break at once and the three Moglins
    // deflate together (the four-voice finale). Mana Seed reward blooms a companion; the arc closes.
    if (outcome === 'win' && bd?.kind === 'brack') {
      flagsRef.current.freedBrack = true
      setDefeated((d) => ({ ...d, brack: true }))
      const sp = LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
      const bloom = createSpirit(sp, speciesDisplayName(sp), 0, 0)
      bloom.level = Math.max(5, partyLevelRef.current)
      partyRef.current = [...(partyRef.current ?? []), bloom]
      const script = reachResult === 'forced' ? [BRACK_FORCED_BEAT, ...BRACK_FINALE] : BRACK_FINALE
      const finale = [...script, { speaker: '—', text: `A Mana Seed rests in the cracked-open grass. It blooms — a young ${speciesDisplayName(sp)} joins you.` }]
      setDialogue({
        name: 'Brack',
        lines: finale.map(l => l.text),
        speakers: finale.map(l => l.speaker),
        idx: 0,
        onDone: () => setBanner('✦ The holds are free — the three come home'),
      })
    }
    persist()
  }, [wallet, persist])

  // New Game: empty party back at the start zone — the player meets Gregory again for a fresh starter.
  const newGame = useCallback(() => {
    partyRef.current = []
    flagsRef.current = {}
    setHasStarter(false)
    setDefeated({})
    const z = getZone(ZONES, START_ZONE)!
    const ps = z.playerStart ?? { tileX: 1, tileY: 1 }
    posRef.current!.set(ps.tileX, posRef.current!.y, ps.tileY)
    setZoneId(START_ZONE)
    setBanner('new game — find Gregory in the glade')
    persist()
  }, [persist])

  // Gregory's gift — the player's first spirit (the kit). One RNG starter → party, flag set, saved.
  const grantStarter = useCallback(() => {
    const s = makeStarterSpirit()
    partyRef.current = [s]
    flagsRef.current.gotStarter = true
    setHasStarter(true)
    setBanner(`✦ a young ${speciesDisplayName(s.species)} joined you!`)
    persist()
  }, [persist])

  // Advance the active dialogue. Greg's intro grants the starter as the "here it is" line appears.
  const advanceDialogue = useCallback(() => {
    const d = dialogueRef.current
    if (!d) return
    const next = d.idx + 1
    if (next >= d.lines.length) { setDialogue(null); d.onDone(); return }
    if (d.grantAt !== undefined && next === d.grantAt) grantStarter()
    setDialogue({ ...d, idx: next })
  }, [grantStarter])

  // Thistle's collared captive — the spirit you free in the Reach battle (enemy index 0, auto-collared by
  // createPartyBattle's reach mode, which also dims it and hands your party the calming moves).
  const startThistleBattle = useCallback(() => {
    const sp = LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
    const captive = createSpirit(sp, `Collared ${speciesDisplayName(sp)}`, 0, 0)
    captive.level = 5
    captive.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
    battleRef.current = true
    setBattle({ allies: partyRef.current!, enemies: [captive], aiTier: 'wild', zoneId: zoneIdRef.current, reach: true, captiveIdxs: [0], kind: 'thistle' })
  }, [])

  // Sorrel — Hold 2, the stronghold. Enemies = [guard, captive, captive]. The guard (no collar) SHIELDS
  // the two collared captives: you break the brute first, then reach BOTH to free them. KO'ing either
  // captive = "forced" (you broke who you came to save). Tougher than Thistle (champion AI, higher levels).
  const startSorrelBattle = useCallback(() => {
    const lvl = Math.max(6, partyLevelRef.current)
    const pick = () => LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
    const guard = createSpirit(pick(), 'Sorrel’s Brute', 0, 0)
    guard.level = lvl + 2
    guard.seeds = Array.from({ length: 6 }, () => 16 + Math.floor(Math.random() * 16))
    const mkCaptive = () => {
      const sp = pick()
      const c = createSpirit(sp, `Collared ${speciesDisplayName(sp)}`, 0, 0)
      c.level = lvl
      c.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
      return c
    }
    battleRef.current = true
    setBattle({ allies: partyRef.current!, enemies: [guard, mkCaptive(), mkCaptive()], aiTier: 'champion', zoneId: zoneIdRef.current, reach: true, captiveIdxs: [1, 2], kind: 'sorrel' })
  }, [])

  // Brack — Hold 3, the climax. The pooled force: TWO enforcers (guards) shielding THREE collared
  // captives. Break both guards, then reach all three. The wall of the arc — canon wants a real team.
  const startBrackBattle = useCallback(() => {
    const lvl = Math.max(8, partyLevelRef.current)
    const pick = () => LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
    const mkGuard = (name: string, bump: number) => {
      const g = createSpirit(pick(), name, 0, 0)
      g.level = lvl + bump
      g.seeds = Array.from({ length: 6 }, () => 18 + Math.floor(Math.random() * 14))
      return g
    }
    const mkCaptive = () => {
      const sp = pick()
      const c = createSpirit(sp, `Collared ${speciesDisplayName(sp)}`, 0, 0)
      c.level = lvl
      c.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
      return c
    }
    battleRef.current = true
    setBattle({ allies: partyRef.current!, enemies: [mkGuard('Brack’s Muscle', 3), mkGuard('Brack’s Enforcer', 2), mkCaptive(), mkCaptive(), mkCaptive()], aiTier: 'champion', zoneId: zoneIdRef.current, reach: true, captiveIdxs: [2, 3, 4], kind: 'brack' })
  }, [])

  // Talk to an NPC. Gregory: no spirit → intro + starter handoff; else a sendoff. Thistle: no spirit → he
  // sneers you off; with a bonded spirit → pre-fight swagger, then the Reach battle to free his captive.
  const talk = useCallback((npc: NPC3D) => {
    const hasSpirit = (partyRef.current?.length ?? 0) > 0
    if (npc.id === 'gregory') {
      if (!hasSpirit) setDialogue({ name: 'Gregory', lines: [...GREG_INTRO_LINES, GREG_NUDGE], idx: 0, grantAt: GREG_INTRO_LINES.length, onDone: () => {} })
      else setDialogue({ name: 'Gregory', lines: [GREG_RETURN], idx: 0, onDone: () => {} })
    } else if (npc.id === 'thistle') {
      if (!hasSpirit) setDialogue({ name: 'Thistle', lines: THISTLE_TAUNT_NO_SPIRIT, idx: 0, onDone: () => {} })
      else setDialogue({ name: 'Thistle', lines: THISTLE_PREFIGHT, idx: 0, onDone: startThistleBattle })
    } else if (npc.id === 'sorrel') {
      // Sorrel only stands here once Thistle has fled to him (gated by requiredFlag), so the player
      // always has a party by now — straight to the swagger, then the stronghold Reach battle.
      setDialogue({ name: 'Sorrel', lines: SORREL_PREFIGHT, idx: 0, onDone: startSorrelBattle })
    } else if (npc.id === 'brack') {
      setDialogue({ name: 'Brack', lines: BRACK_PREFIGHT, idx: 0, onDone: startBrackBattle })
    }
  }, [startThistleBattle, startSorrelBattle, startBrackBattle])

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

  // Desktop interact key (E / Space / Enter): advance dialogue, or talk to a nearby NPC.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editMode || battle) return
      const k = e.key.toLowerCase()
      if (k !== 'e' && k !== ' ' && k !== 'enter') return
      if (dialogueRef.current) { e.preventDefault(); advanceDialogue() }
      else if (nearNpc) { e.preventDefault(); talk(nearNpc) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editMode, battle, nearNpc, advanceDialogue, talk])
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
    // Node tools drop/remove a single resource node in the node layer (not the tile grid).
    if (NODE_TOOL_IDS.has(t)) {
      setNodes(prev => {
        const without = prev.filter(n => !(n.tileX === c && n.tileY === r))
        if (shift) return without                                  // shift-click erases any node here
        if (without.length !== prev.length) return prev            // already a node here — leave it
        return [...prev, { type: t as NodeType, tileX: c, tileY: r }]
      })
      return
    }
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
      const [h, g, n] = await Promise.all([
        fetch('/shimmer/save-heights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoneId: id, heights: heightsRef.current }) }),
        fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grid: gridRef.current, mapId: id }) }),
        // node layer → node-placements.ts (same endpoint, `nodes` payload; {nodeType,x,y} shape)
        fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodes: nodesRef.current.map(nd => ({ nodeType: nd.type, x: nd.tileX, y: nd.tileY })), mapId: id }) }),
      ])
      setSaveMsg(h.ok && g.ok && n.ok ? 'saved ✓ (ping Jin to build it live)' : 'save failed')
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
          talkingRef={talkingRef} hasPartyRef={hasPartyRef} onNearChange={setNearNpc}
          defeatedRef={defeatedRef} defeated={defeated} flagsRef={flagsRef}
          nodes={nodes}
        />
      </Canvas>

      <div style={{
        position: 'fixed', top: 12, left: 12, padding: '8px 12px', borderRadius: 8,
        background: 'rgba(10,8,20,0.66)', color: '#e9dfc8', font: '600 13px ui-monospace, monospace', lineHeight: 1.5,
      }}>
        Shimmer 3D — {zone.name}{editMode ? '  ·  EDIT' : ''}<br />
        <span style={{ opacity: 0.8 }}>
          {editMode ? 'left-drag paint · WASD fly · Q/E down·up · right-drag look · scroll zoom' : `WASD · drag look · scroll zoom · edges warp · ${hasStarter ? 'mist = wild spirits' : 'meet Gregory first'}${isOwner ? ' · B to edit' : ''}`}
        </span>
        {!editMode && <><br /><span style={{ color: '#ffe08a' }}>✦ {wallet.marks} marks</span></>}
      </div>

      <Compass yawRef={camYaw} />

      {/* quest objective nudge — advances with the full hold chain (Greg → Thistle → Sorrel → Brack).
          Goes quiet once Hold 3 clears — the liberation arc is done. */}
      {!dialogue && !nearNpc && !battle && !editMode && (!hasStarter || !defeated.thistle || !defeated.sorrel || !defeated.brack) && (
        <div style={{
          position: 'fixed', top: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 35,
          padding: '7px 15px', borderRadius: 999, background: 'rgba(16,14,32,0.88)', border: '1px solid #d4a84355',
          color: '#ffe9b0', font: '700 13px ui-monospace, monospace', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>{!hasStarter ? '✦ Find Gregory — follow the glow in the glade' : !defeated.thistle ? '✦ Spirit Meadows — free the spirit Thistle holds' : !defeated.sorrel ? '✦ Mana Springs — climb to the spirits Sorrel holds' : '✦ Mana Springs — climb to the top hold, where Brack waits'}</div>
      )}

      {/* talk prompt when standing by an NPC */}
      {nearNpc && !dialogue && !battle && !editMode && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 156, transform: 'translateX(-50%)', zIndex: 35,
          padding: '7px 14px', borderRadius: 999, background: 'rgba(16,14,32,0.92)', border: '1px solid #d4a84366',
          color: '#ffe9b0', font: '700 13px ui-monospace, monospace', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>✦ Talk to {nearNpc.name} <span style={{ opacity: 0.6 }}>({isTouch ? 'tap ✦' : 'E'})</span></div>
      )}

      {/* dialogue box — tap/click anywhere on it (or A / E) to advance; last line closes */}
      {dialogue && (
        <div
          onPointerDown={(e) => { e.stopPropagation(); advanceDialogue() }}
          style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 45, display: 'flex', justifyContent: 'center', padding: '0 16px 20px' }}
        >
          <div style={{ width: 'min(680px, 94vw)', background: 'rgba(12,10,24,0.95)', border: '1px solid #d4a84366', borderRadius: 12, padding: '14px 18px', cursor: 'pointer' }}>
            <div style={{ color: '#ffd98a', font: '800 13px ui-monospace, monospace', marginBottom: 6, letterSpacing: '0.04em' }}>{dialogue.speakers?.[dialogue.idx] ?? dialogue.name}</div>
            <div style={{ color: '#ece3d0', font: '600 15px/1.55 ui-monospace, monospace' }}>{dialogue.lines[dialogue.idx]}</div>
            <div style={{ color: '#ffffff5e', font: '600 11px ui-monospace, monospace', marginTop: 9, textAlign: 'right' }}>
              {dialogue.idx >= dialogue.lines.length - 1 ? 'tap to close' : 'tap to continue ▸'}
            </div>
          </div>
        </div>
      )}

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
          {/* resource-node blocks — click places, shift-click erases (single node per tile) */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', maxWidth: 480 }}>
            <span style={{ color: '#8fd9c4', font: '700 11px ui-monospace, monospace', letterSpacing: '0.06em' }}>NODES</span>
            {NODE_TOOLS.map((t) => <Btn key={t.id} active={tool === t.id} onClick={() => setTool(t.id)}>{t.label}</Btn>)}
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
          {/* DEV: drop straight into the in-world Keeper's Arena (bypasses party/zone/RNG gates) */}
          <button onClick={() => { setEditMode(false); forceFight() }} style={{ padding: '6px 16px', borderRadius: 6, border: '2px solid #7fe3c8', background: '#12181a', color: '#7fe3c8', font: '800 13px ui-monospace, monospace', cursor: 'pointer' }}>⚔ Force Fight (arena)</button>
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

      {/* Hotbar HUD — bag + 6 quick-slots + tool gauges + mana vial. Only while walking the world. */}
      {!battle && !approach && !rewards && !editMode && !dialogue && <HotBar />}

      {/* ── Mobile controls: joystick (move) bottom-left · A interact / B cancel bottom-right ── */}
      {isTouch && !battle && !editMode && (
        <>
          <TouchJoystick joyRef={joyRef} bottom={96} />
          <div style={{ position: 'fixed', bottom: 96, right: 30, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            {/* B — cancel/back (upper, smaller). Backs out of the New Game prompt / dismisses a toast. */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); if (confirmNew) setConfirmNew(false); else if (banner) setBanner(null) }}
              aria-label="cancel"
              style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid #ffffff33', background: 'rgba(70,44,52,0.72)', color: '#f3dada', font: '800 19px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' }}
            >✕</button>
            {/* A — interact/confirm (lower, bigger, where the thumb rests): advance dialogue / talk to an NPC / confirm New Game. */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); if (dialogue) advanceDialogue(); else if (nearNpc) talk(nearNpc); else if (confirmNew) { setConfirmNew(false); newGame() } }}
              aria-label="interact"
              style={{ width: 76, height: 76, borderRadius: '50%', border: '2px solid #ffffff4d', background: nearNpc || dialogue ? 'rgba(212,168,67,0.85)' : 'rgba(36,84,72,0.8)', color: nearNpc || dialogue ? '#1a1a2e' : '#dffaf0', font: '800 23px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' }}
            >✦</button>
          </div>
        </>
      )}

      {/* B hotkey (keyboard) — owner only, and not while a battle overlay is up */}
      <KeyToggle onB={() => { if (isOwner && !battleRef.current) setEditMode((e) => !e) }} />

      {/* Combat, mounted over the 3D world. Wild fights use the real-time Keeper's Arena;
          the scripted liberation holds (thistle/sorrel/brack) still run the reach/captive
          turn-based scene until the freed-vs-forced beat is ruled back into the arena
          (CANON_GAPS: collar-breaks-on-win). */}
      {/* wild-encounter approach beat — the mist stirs and a spirit is drawn to you, then the ring
          materializes. Tap to skip straight into the fight. */}
      {approach && !battle && (
        <EncounterApproach name={approach.enc.name} element={approach.enc.element} onSkip={commitApproach} />
      )}

      {/* post-win spoils reveal — the payoff: gold + per-spirit XP/level breakdown. Unfreezes on close. */}
      {rewards && !battle && (
        <BattleRewards gold={rewards.gold} rows={rewards.rows} onClose={() => { setRewards(null); battleRef.current = false }} />
      )}

      {battle && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#0a0a12' }}>
          {battle.kind === 'wild' ? (
            <ArenaBattle
              allies={battle.allies}
              enemies={battle.enemies}
              onEnd={(o) => endBattle(o === 'win' ? 'win' : 'lose')}
            />
          ) : (
            <PartyBattleScene
              allySpirits={battle.allies}
              enemySpirits={battle.enemies}
              zoneId={battle.zoneId}
              reach={battle.reach}
              captiveIdxs={battle.captiveIdxs}
              ai={{ focusFire: battle.aiTier !== 'wild', spendMana: battle.aiTier !== 'wild' }}
              onEnd={endBattle}
            />
          )}
        </div>
      )}
    </div>
  )
}

// The wild-encounter approach beat — a short, canon-true "a spirit drifts toward you out of
// curiosity" flourish that eases the jump from overworld to the arena (no hard cut). Element-tinted
// bloom + the spirit's name, ~1.3s, tap anywhere to skip.
function EncounterApproach({ name, element, onSkip }: { name: string; element: Element; onSkip: () => void }) {
  const col = ELEMENT_COLORS[element] ?? '#7fe3c8'
  return (
    <div onPointerDown={onSkip} style={{
      position: 'fixed', inset: 0, zIndex: 50, background: '#05070a', overflow: 'hidden', cursor: 'pointer',
      touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'encFade 0.22s ease-out',
    }}>
      <style>{`
        @keyframes encFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes encBloom { 0% { transform: scale(0.2); opacity: 0 } 45% { opacity: 0.95 } 100% { transform: scale(1.7); opacity: 0.5 } }
        @keyframes encRise { 0% { transform: translateY(16px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
        @keyframes encFlash { 0%, 72% { opacity: 0 } 88% { opacity: 0.8 } 100% { opacity: 0 } }
      `}</style>
      {/* element bloom drawing inward */}
      <div style={{
        position: 'absolute', width: '82vmin', height: '82vmin', borderRadius: '50%', filter: 'blur(2px)',
        background: `radial-gradient(circle, ${col}cc 0%, ${col}44 42%, transparent 70%)`, animation: 'encBloom 1.15s ease-out forwards',
      }} />
      <div style={{ position: 'relative', textAlign: 'center', animation: 'encRise 0.5s ease-out 0.12s both' }}>
        <div style={{ font: '700 12px ui-monospace, monospace', color: '#dfeee9', letterSpacing: '0.28em', opacity: 0.7, marginBottom: 8 }}>✦ THE MIST STIRS</div>
        <div style={{ font: '900 30px ui-monospace, monospace', color: col, letterSpacing: '0.04em', textShadow: `0 0 22px ${col}88, 0 2px 6px #000` }}>{name}</div>
        <div style={{ font: '600 14px ui-monospace, monospace', color: '#c9d6d1', marginTop: 8, opacity: 0.85 }}>is drawn to you…</div>
      </div>
      {/* end flash — snaps into the arena */}
      <div style={{ position: 'absolute', inset: 0, background: '#eafff6', pointerEvents: 'none', animation: 'encFlash 1.3s ease-in forwards' }} />
    </div>
  )
}

// Post-win spoils reveal — the loop's payoff. Gold + a per-spirit row: level (with a Lv↑ jump when
// they leveled), XP gained, and an animated bar filling toward the next level. Tap CONTINUE to return.
function BattleRewards({ gold, rows, onClose }: {
  gold: number
  rows: { name: string; element: Element; fromLevel: number; toLevel: number; xpGained: number; curXp: number; needXp: number; evolved: boolean }[]
  onClose: () => void
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShown(true), 70); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#05070ae8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, touchAction: 'none', animation: 'rwdFade 0.25s ease-out' }}>
      <style>{`@keyframes rwdFade { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <div style={{ width: 'min(430px, 94vw)', maxHeight: '88vh', overflowY: 'auto', background: '#0d1614', border: '2px solid #2f5c4f', borderRadius: 16, padding: '20px 20px 16px', boxShadow: '0 12px 48px #000a' }}>
        <div style={{ textAlign: 'center', font: '900 20px ui-monospace, monospace', color: '#7fe3c8', letterSpacing: '0.14em', textShadow: '0 0 18px #7fe3c855' }}>SPOILS</div>
        {gold > 0 && (
          <div style={{ textAlign: 'center', font: '700 13px ui-monospace, monospace', color: '#ffd98a', marginTop: 6, letterSpacing: '0.06em' }}>+{gold} ✦ marks</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {rows.map((r, i) => {
            const pct = Math.min(100, Math.round((r.curXp / Math.max(1, r.needXp)) * 100))
            const leveled = r.toLevel > r.fromLevel
            const col = ELEMENT_COLORS[r.element] ?? '#7fe3c8'
            return (
              <div key={i} style={{ background: '#12201d', border: `1px solid ${leveled ? col : '#ffffff18'}`, borderRadius: 10, padding: '9px 11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: col, flexShrink: 0, boxShadow: `0 0 8px ${col}99` }} />
                    <span style={{ font: '700 13px ui-monospace, monospace', color: '#eafff6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ font: '700 11px ui-monospace, monospace', color: '#8fd9c4' }}>+{r.xpGained} XP</span>
                    <span style={{ font: '800 12px ui-monospace, monospace', color: leveled ? col : '#c9d6d1', letterSpacing: '0.04em', textShadow: leveled ? `0 0 10px ${col}88` : 'none' }}>
                      {leveled ? `Lv ${r.fromLevel}→${r.toLevel}` : `Lv ${r.toLevel}`}
                    </span>
                  </span>
                </div>
                {/* XP bar toward next level — fills in on reveal */}
                <div style={{ height: 6, background: '#0008', borderRadius: 4, overflow: 'hidden', marginTop: 8, border: '1px solid #0006' }}>
                  <div style={{ height: '100%', width: shown ? `${pct}%` : '0%', background: `linear-gradient(90deg, ${col}, #eafff6)`, borderRadius: 4, transition: 'width 0.7s cubic-bezier(0.2,0.8,0.2,1)' }} />
                </div>
                {(leveled || r.evolved) && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                    {leveled && <span style={{ font: '800 9px ui-monospace, monospace', color: '#05070a', background: col, borderRadius: 999, padding: '2px 8px', letterSpacing: '0.08em' }}>LEVEL UP</span>}
                    {r.evolved && <span style={{ font: '800 9px ui-monospace, monospace', color: '#ffe9b0', background: '#0000', border: '1px solid #d4a843', borderRadius: 999, padding: '2px 8px', letterSpacing: '0.08em' }}>✦ READY TO EVOLVE</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button onClick={onClose} style={{ display: 'block', width: '100%', marginTop: 16, padding: '11px 0', borderRadius: 11, border: '2px solid #7fe3c8', background: '#12181a', color: '#eafff6', font: '800 14px ui-monospace, monospace', letterSpacing: '0.1em', cursor: 'pointer', touchAction: 'none' }}>CONTINUE</button>
      </div>
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
