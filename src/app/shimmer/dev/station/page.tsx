'use client'
// TRAVELERS STATION BENCH — the spaceport (terminal, field, berths, the Hold's ship) at keeper's eye.
//
// ★ WHY (2026-09-26, world lane). Alex: *"the travelers station is a spaceport it should be a lot bigger."*
// Canon ruled it the same day (`world/rune-hold.md` › *The Station in 1672*). This page draws the SHIPPED
// `StationScene` over the generated map (`station-field.ts`) so the look is judged here, not in a walker
// that has to birth, cross the town and find the door first.
//
// `?view=<name>` picks a preset · `?night=1` turns the sun to the moon · `?at=x,z&yaw=<deg>&pitch=<deg>`
// pins any view · `?top=1` plan view.
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEffect, useMemo, useState } from 'react'
import { StationScene } from '../../play3d/StationScene'
import { STATION } from '../../play3d/station-field'
import { GardenAtmosphere } from '../../world/atmosphere'
import { EYE_STAND } from '../../voxel3d/locomotion'
import * as S from '../../play3d/scene-palette'

/** yaw 0 looks toward +x (east), 90 toward +z (south), -90 north */
const VIEWS: Record<string, { x: number; z: number; yaw: number; pitch: number }> = {
  arrival:   { x: STATION.arrivals.town.x, z: STATION.arrivals.town.z, yaw: 0, pitch: 2 },
  hall:      { x: 5, z: 30, yaw: -40, pitch: 6 },
  board:     { x: 8, z: 29, yaw: 180, pitch: 4 },
  field:     { x: 27, z: 23, yaw: 10, pitch: 4 },
  ship:      { x: 28, z: 16, yaw: -30, pitch: 10 },
  gangway:   { x: 29, z: 11.5, yaw: 0, pitch: 12 },
  berths:    { x: 76, z: 25, yaw: 180, pitch: 6 },
}

const GRID = STATION.grid
const HEIGHTS = STATION.heights

function Rig({ x, z, yaw, pitch, top }: { x: number; z: number; yaw: number; pitch: number; top: boolean }) {
  const { camera } = useThree()
  useEffect(() => {
    if (top) {
      camera.position.set(40, 95, 34)
      camera.lookAt(40, 0, 25)
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
        shadow-camera-far={220} shadow-bias={-0.0005} target-position={[40, 0, 25]} />
    </>
  )
}

/** The zone's own floor under everything (`FloorTerrain`), which the scene lays its ground over. */
function Base() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(GRID[0].length - 1) / 2, 0, (GRID.length - 1) / 2]} receiveShadow>
      <planeGeometry args={[GRID[0].length, GRID.length]} />
      <meshStandardMaterial color={S.terrain.grass} roughness={1} />
    </mesh>
  )
}

export default function StationBench() {
  const [q, setQ] = useState<URLSearchParams | null>(null)
  useEffect(() => { setQ(new URLSearchParams(window.location.search)) }, [])
  const view = useMemo(() => {
    if (!q) return VIEWS.arrival
    const at = q.get('at')?.split(',').map(Number)
    const base = VIEWS[q.get('view') ?? 'arrival'] ?? VIEWS.arrival
    return {
      x: at?.[0] ?? base.x, z: at?.[1] ?? base.z,
      yaw: q.has('yaw') ? Number(q.get('yaw')) : base.yaw,
      pitch: q.has('pitch') ? Number(q.get('pitch')) : base.pitch,
    }
  }, [q])
  const top = q?.get('top') === '1', night = q?.get('night') === '1'
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
        <GardenAtmosphere zoneId="travelers-station" />
        <Sun night={night} />
        <Base />
        <StationScene />
        <Rig {...view} top={top} />
      </Canvas>
      <div style={{ position: 'fixed', top: 8, left: 8, display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 620 }}>
        {Object.keys(VIEWS).map(n => <button key={n} type="button" style={btn} onClick={() => set('view', n)}>{n}</button>)}
        <button type="button" style={btn} onClick={() => set('top', top ? null : '1')}>top</button>
        <button type="button" style={{ ...btn, background: night ? '#6b4a2e' : '#2a1d12' }} onClick={() => set('night', night ? null : '1')}>{night ? 'night' : 'day'}</button>
      </div>
    </div>
  )
}
