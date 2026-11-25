'use client'
// M147 (Alex 11-24: "when you place it its not showing the guide"): a Waymark Stone in hand stands its ghost where it would go,
// PLANT_AHEAD m in front of you (waymarks.ts › plantSpot): green where the plant is taken, red where it is refused, with the
// refusal under the crosshair. The verdict is the plant's own (page.tsx › plantVerdict), read at the ghost's spot.
import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WaymarkStone } from './wilds-scene'
import { GREG_WAYMARK, plantSpot, type PlantVerdict } from './waymarks'

const AT0 = { ...GREG_WAYMARK, x: 0, y: 0, z: 0 }
const OK = '#5aff8a', BAD = '#ff5a4a'
export function WaymarkGhost({ pose, height, verdict, onWhy }: { pose: () => { x: number; z: number; yaw: number }; height: (x: number, z: number) => number
  verdict: (x: number, z: number) => PlantVerdict; onWhy: (why: string | null) => void }) {
  const g = useRef<THREE.Group>(null), next = useRef(0)
  const [ok, setOk] = useState(false)
  const cb = useRef({ verdict, onWhy }); cb.current = { verdict, onWhy }
  useEffect(() => () => { cb.current.onWhy(null); delete (window as unknown as { __wmGhost?: unknown }).__wmGhost }, [])
  useFrame(({ clock }) => {
    const s = plantSpot(pose()), y = height(s.x, s.z), o = g.current
    if (o) { o.visible = Number.isFinite(y); if (o.visible) o.position.set(s.x, y, s.z) }
    if (clock.elapsedTime < next.current) return
    next.current = clock.elapsedTime + 0.12
    const v = cb.current.verdict(s.x, s.z)
    setOk(v.ok); cb.current.onWhy(v.ok ? null : v.why)
    ;(window as unknown as { __wmGhost?: unknown }).__wmGhost = { ...s, ok: v.ok, why: v.ok ? null : v.why, shown: !!o?.visible }   // READ-only probe (m147-waymark-check)
  })
  return (   // the held-piece look (workshop PieceGhost): the thing itself under a tint
    <group ref={g}>
      <WaymarkStone w={AT0} />
      <mesh position-y={1.35}><boxGeometry args={[1.3, 2.75, 0.6]} /><meshBasicMaterial color={ok ? OK : BAD} transparent opacity={0.35} depthWrite={false} /></mesh>
      <mesh position-y={0.05} rotation-x={-Math.PI / 2}><circleGeometry args={[1.5, 24]} /><meshBasicMaterial color={ok ? OK : BAD} transparent opacity={0.35} depthWrite={false} /></mesh>
    </group>
  )
}
