'use client'
// RUNE HOLD LOOK BENCH — the town in the Passage's materials, before/after, at keeper's eye.
//
// ★ WHY (2026-09-26, world lane). Alex: *"rework runehold to look like the passage, its still rocking
// that stale look."* Canon keeps the town open-sky (`world/rune-hold.md`: one underground, one hearth),
// so the Passage lends its MATERIALS, not its shape. This page draws the SHIPPED `RuneHoldScene` over
// the town's own grid (`RUNE_HOLD`), next to what ships today, so the call is a comparison and not a
// memory. The layout is untouched and stays Alex's (TODO(rune-hold-layout)).
//
// `?view=<name>` picks a preset · `?before=1` draws today's look (brown blocks on lawn) · `?night=1`
// turns the sun to the moon · `?at=x,z&yaw=<deg>&pitch=<deg>` pins any view · `?top=1` plan view.
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEffect, useMemo, useState } from 'react'
import { RuneHoldScene } from '../../play3d/RuneHoldScene'
import { RUNE_HOLD } from '../../world/tilemap'
import { getHeightGrid } from '../../world/heightmaps'
import { GardenAtmosphere } from '../../world/atmosphere'
import { EYE_STAND } from '../../voxel3d/locomotion'
import * as S from '../../play3d/scene-palette'

/** yaw 0 looks toward +x (east), 90 toward +z (south), -90 north */
const VIEWS: Record<string, { x: number; z: number; yaw: number; pitch: number }> = {
  square:    { x: 50, z: 60, yaw: -90, pitch: 4 },
  landing:   { x: 49, z: 55, yaw: -90, pitch: 10 },
  gate:      { x: 50, z: 18, yaw: 90, pitch: 0 },
  'west-row': { x: 44, z: 45, yaw: -140, pitch: 6 },
  shopfront: { x: 28, z: 50, yaw: 180, pitch: 4 },
  hillside:  { x: 72, z: 52, yaw: 0, pitch: 10 },
  mug:       { x: 67, z: 46, yaw: -90, pitch: 8 },
  books:     { x: 31, z: 55, yaw: 90, pitch: 8 },
  corner:    { x: 30, z: 49, yaw: 180, pitch: 6 },
  passage:   { x: 74, z: 48.5, yaw: 0, pitch: 6 },
  board:     { x: 50, z: 59, yaw: 180, pitch: 2 },
  'station-door': { x: 48.5, z: 78, yaw: 90, pitch: 8 },
  terminal:  { x: 50, z: 66, yaw: 90, pitch: 14 },
  inn:       { x: 32, z: 46, yaw: -90, pitch: 8 },
  'look-east': { x: 62, z: 60, yaw: -20, pitch: 10 },
  'look-north': { x: 50, z: 30, yaw: -90, pitch: 10 },
  'look-west': { x: 36, z: 50, yaw: 180, pitch: 8 },
  smithy:    { x: 68, z: 55, yaw: 90, pitch: 8 },
  'port-far': { x: 49, z: 54, yaw: 90, pitch: 12 },
  'south-road': { x: 50, z: 92, yaw: -90, pitch: 2 },
}

const GRID = RUNE_HOLD
const HEIGHTS = getHeightGrid('rune-hold', GRID.length, GRID[0].length)

function Rig({ x, z, yaw, pitch, top }: { x: number; z: number; yaw: number; pitch: number; top: boolean }) {
  const { camera } = useThree()
  useEffect(() => {
    if (top) {
      camera.position.set(50, 120, 60)
      camera.lookAt(50, 0, 50)
      return
    }
    const h = HEIGHTS[Math.round(z)]?.[Math.round(x)] ?? 0
    camera.position.set(x, h + EYE_STAND, z)
    camera.rotation.order = 'YXZ'
    camera.rotation.y = -THREE.MathUtils.degToRad(yaw) - Math.PI / 2
    camera.rotation.x = THREE.MathUtils.degToRad(pitch)
  }, [camera, x, z, yaw, pitch, top])
  return null
}

/** `SkyLight` at noon (or midnight): the sun the mortal side keeps on purpose. */
function Sun({ night }: { night: boolean }) {
  return (
    <>
      <ambientLight color={night ? '#3a4668' : '#fff4e0'} intensity={night ? 0.5 : 0.7} />
      <directionalLight color={night ? '#9fb4ff' : '#fff1d6'} intensity={night ? 0.62 : 1.35} position={[80, 60, 70]} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70}
        shadow-camera-far={220} shadow-bias={-0.0005} target-position={[50, 0, 50]} />
    </>
  )
}

/** The ground the zone draws under everything (`FloorTerrain`) and, for `before`, today's brown blocks. */
function Base({ before }: { before: boolean }) {
  const cells = useMemo(() => {
    const blocks: [number, number][] = []
    for (let z = 0; z < GRID.length; z++) for (let x = 0; x < GRID[z].length; x++) if ((GRID[z][x] & 0xff) === 103) blocks.push([x, z])
    return blocks
  }, [])
  const ref = useMemo(() => ({ current: null as THREE.InstancedMesh | null }), [])
  useEffect(() => {
    const r = ref.current
    if (!r) return
    const m = new THREE.Matrix4()
    cells.forEach(([x, z], i) => { m.makeTranslation(x, 1.5, z); r.setMatrixAt(i, m) })
    r.instanceMatrix.needsUpdate = true
  }, [cells, ref, before])
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[49.5, 0, 49.5]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={S.terrain.grass} roughness={1} />
      </mesh>
      {before && (
        <instancedMesh ref={(m) => { ref.current = m }} args={[undefined, undefined, cells.length]} castShadow receiveShadow>
          <boxGeometry args={[1, 3.2, 1]} />
          <meshStandardMaterial color={S.terrain.building} />
        </instancedMesh>
      )}
    </>
  )
}

export default function RuneHoldLookBench() {
  const [q, setQ] = useState<URLSearchParams | null>(null)
  useEffect(() => { setQ(new URLSearchParams(window.location.search)) }, [])
  const view = useMemo(() => {
    if (!q) return VIEWS.square
    const at = q.get('at')?.split(',').map(Number)
    const base = VIEWS[q.get('view') ?? 'square'] ?? VIEWS.square
    return {
      x: at?.[0] ?? base.x, z: at?.[1] ?? base.z,
      yaw: q.has('yaw') ? Number(q.get('yaw')) : base.yaw,
      pitch: q.has('pitch') ? Number(q.get('pitch')) : base.pitch,
    }
  }, [q])
  const top = q?.get('top') === '1', before = q?.get('before') === '1', night = q?.get('night') === '1'
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(window.location.search)
    if (v === null) p.delete(k); else p.set(k, v)
    if (k === 'view') p.delete('top')
    window.location.search = `?${p}`
  }
  const btn = { padding: '3px 8px', fontSize: 12, background: '#2a1d12', color: '#ffcf8a', border: '1px solid #6b4a2e', borderRadius: 4 }
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas shadows camera={{ fov: 70, near: 0.05, far: 400 }}>
        <GardenAtmosphere zoneId="rune-hold" />
        <Sun night={night} />
        <Base before={before} />
        {!before && <RuneHoldScene grid={GRID} heights={HEIGHTS} />}
        <Rig {...view} top={top} />
      </Canvas>
      <div style={{ position: 'fixed', top: 8, left: 8, display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 620 }}>
        {Object.keys(VIEWS).map(n => <button key={n} type="button" style={btn} onClick={() => set('view', n)}>{n}</button>)}
        <button type="button" style={btn} onClick={() => set('top', top ? null : '1')}>top</button>
        <button type="button" style={{ ...btn, background: before ? '#6b4a2e' : '#2a1d12' }} onClick={() => set('before', before ? null : '1')}>{before ? 'showing BEFORE' : 'before'}</button>
        <button type="button" style={{ ...btn, background: night ? '#6b4a2e' : '#2a1d12' }} onClick={() => set('night', night ? null : '1')}>{night ? 'night' : 'day'}</button>
      </div>
    </div>
  )
}
