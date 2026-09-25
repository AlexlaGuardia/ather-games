'use client'
// THE PASSAGE BENCH — the tunnel, the cavern market and the arcade room, drawn by the SHIPPED scene.
//
// ★ WHY (2026-09-25, world lane). The Passage lives on the owner-only play3d route, reached by a door
// in Rune Hold, and a headless walker spawns facing a wall in a dark tunnel. The first four screenshots
// of it were black. So this page mounts exactly what the game mounts in that zone — `PassageScene` over
// the map from `passage-hall.ts`, under the zone's own UNDERGROUND mood and the same no-sun light rig —
// and pins a keeper's-eye camera at named places. Judge the look here, walk it in the game.
//
// `?view=<name>` picks a preset (buttons below rewrite the URL, so a screenshot's address names what it
// shows) · `?at=x,z&yaw=<deg>&pitch=<deg>` pins any view · `?top=1` looks straight down at the plan.
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEffect, useMemo, useState } from 'react'
import { PassageScene } from '../../play3d/PassageScene'
import { PASSAGE, passageAscii } from '../../play3d/passage-hall'
import { GardenAtmosphere } from '../../world/atmosphere'
import { EYE_STAND } from '../../voxel3d/locomotion'
import * as S from '../../play3d/scene-palette'

/** yaw 0 looks toward +x (east), 90 toward +z (south) */
const VIEWS: Record<string, { x: number; z: number; yaw: number; pitch: number }> = {
  arrival:   { x: PASSAGE.arrival.x, z: PASSAGE.arrival.z, yaw: 0, pitch: -8 },
  tunnel:    { x: 12, z: 14, yaw: 0, pitch: -4 },
  cavern:    { x: 21, z: 15, yaw: 0, pitch: 4 },
  stalls:    { x: 33, z: 20, yaw: -90, pitch: 2 },
  arch:      { x: 33.5, z: 22, yaw: 90, pitch: -6 },
  arcade:    { x: 34, z: 29, yaw: 90, pitch: -4 },
  cabinets:  { x: 28, z: 34, yaw: 60, pitch: -10 },
  'far-road': { x: 46, z: 15, yaw: 0, pitch: -2 },
}

function Rig({ x, z, yaw, pitch, top }: { x: number; z: number; yaw: number; pitch: number; top: boolean }) {
  const { camera } = useThree()
  useEffect(() => {
    if (top) {
      camera.position.set(PASSAGE.cavern.cx, 70, 20)
      camera.lookAt(PASSAGE.cavern.cx, 0, 20)
      return
    }
    const h = PASSAGE.heights[Math.round(z)]?.[Math.round(x)] ?? 0
    camera.position.set(x, h + EYE_STAND, z)
    camera.rotation.order = 'YXZ'
    // three's camera looks down -z; yaw 0 in this page means east (+x)
    camera.rotation.y = -THREE.MathUtils.degToRad(yaw) - Math.PI / 2
    camera.rotation.x = THREE.MathUtils.degToRad(pitch)
  }, [camera, x, z, yaw, pitch, top])
  return null
}

/** the same rig `SkyLight` becomes under the mountain (`Shimmer3D.tsx` › `under`) */
function UnderLight() {
  return (
    <>
      <ambientLight color={S.passage.ambient} intensity={0.8} />
      <directionalLight color={S.passage.noSun} intensity={0.12} position={[18, 26, 12]} />
    </>
  )
}

export default function PassageBench() {
  const [q, setQ] = useState<URLSearchParams | null>(null)
  useEffect(() => { setQ(new URLSearchParams(window.location.search)) }, [])
  const view = useMemo(() => {
    if (!q) return VIEWS.cavern
    const at = q.get('at')?.split(',').map(Number)
    const base = VIEWS[q.get('view') ?? 'cavern'] ?? VIEWS.cavern
    return {
      x: at?.[0] ?? base.x, z: at?.[1] ?? base.z,
      yaw: q.has('yaw') ? Number(q.get('yaw')) : base.yaw,
      pitch: q.has('pitch') ? Number(q.get('pitch')) : base.pitch,
    }
  }, [q])
  const top = q?.get('top') === '1'
  const go = (name: string) => { window.location.search = `?view=${name}` }
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas shadows camera={{ fov: 70, near: 0.05, far: 300 }}>
        <GardenAtmosphere zoneId="the-passage" />
        <UnderLight />
        <PassageScene isOwner={q?.get('public') !== '1'} />
        <Rig {...view} top={top} />
      </Canvas>
      <div style={{ position: 'fixed', top: 8, left: 8, display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 560 }}>
        {[...Object.keys(VIEWS), 'top'].map(n => (
          <button key={n} type="button" onClick={() => n === 'top' ? (window.location.search = '?top=1') : go(n)}
                  style={{ padding: '3px 8px', fontSize: 12, background: '#2a1d12', color: '#ffcf8a', border: '1px solid #6b4a2e', borderRadius: 4 }}>
            {n}
          </button>
        ))}
      </div>
      {q?.get('plan') === '1' && (
        <pre style={{ position: 'fixed', bottom: 8, left: 8, fontSize: 9, lineHeight: 1, color: '#ffcf8a', background: '#000a', padding: 6 }}>{passageAscii()}</pre>
      )}
    </div>
  )
}
