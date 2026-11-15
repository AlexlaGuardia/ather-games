'use client'
// GARDEN CLUSTERS, DRAWN (Alex 11-15, his sketch). What cluster.ts says is ground, made visible: each mate's island at
// their place, turned so its gate faces the square (their squares held, the rest under their mist; read-only), the
// shared square in the middle, the # of streets round it, and a ramp from every gate corner to its crossroads. Nothing here is a canon look (CANON_GAPS: clusters [OPEN]); placeholder forms,
// neutral, in the plot's own palette.

import { useMemo } from 'react'
import * as THREE from 'three'
import { PlotIsland } from './plot-scene'
import { MIDDLE_Y, ROAD_Y, type Frame, type Seg } from './cluster'

function SegMesh({ s, color, thick = 0.5 }: { s: Seg; color: string; thick?: number }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(s.ax, s.ay, s.az), b = new THREE.Vector3(s.bx, s.by, s.bz)
    const d = b.clone().sub(a), len = d.length()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().normalize())
    return { pos: a.add(b).multiplyScalar(0.5), quat, len }
  }, [s])
  return (
    <group position={pos} quaternion={quat}>
      <mesh position-y={-thick / 2}><boxGeometry args={[s.w, thick, len]} /><meshLambertMaterial color={color} flatShading /></mesh>
      {[-1, 1].map(k => <mesh key={k} position={[k * (s.w / 2 - 0.15), 0.45, 0]}><boxGeometry args={[0.18, 0.9, len]} /><meshLambertMaterial color="#d9cfb8" /></mesh>)}
    </group>
  )
}

export function ClusterScene({ frame }: { frame: Frame }) {
  if (!frame.linked || !frame.middle) return null
  const m = frame.middle, S = m.half * 2
  return (
    <>
      {/* the shared ground: a square at the gate pads' height, its underside a cone like every plot's */}
      <group position={[m.x, 0, m.z]}>
        <mesh position-y={MIDDLE_Y - 0.6}><boxGeometry args={[S, 1.2, S]} /><meshLambertMaterial color="#a9cf86" flatShading /></mesh>
        <mesh position-y={MIDDLE_Y - 14} rotation={[Math.PI, Math.PI / 4, 0]}><coneGeometry args={[m.half * 1.3, 26, 4, 2]} /><meshLambertMaterial color="#b9a58c" flatShading /></mesh>
        <mesh position-y={MIDDLE_Y + 0.03} rotation-x={-Math.PI / 2}><ringGeometry args={[5, 6, 24]} /><meshBasicMaterial color="#efe0a8" /></mesh>
      </group>
      {/* the # of streets round it */}
      {frame.streets.map((r, k) => (
        <mesh key={`s${k}`} position={[(r.x0 + r.x1) / 2, ROAD_Y - 0.3, (r.z0 + r.z1) / 2]}>
          <boxGeometry args={[r.x1 - r.x0, 0.6, r.z1 - r.z0]} /><meshLambertMaterial color="#d6c9a8" flatShading />
        </mesh>
      ))}
      {frame.ramps.map((b, k) => <SegMesh key={`r${k}`} s={b} color="#cdbf9f" />)}
      {frame.mates.map(mt => (
        <group key={mt.quarter} position={[mt.x, 0, mt.z]} rotation-y={mt.rot}>
          <PlotIsland owned={new Set(mt.owned)} pages={0} />
        </group>
      ))}
    </>
  )
}
