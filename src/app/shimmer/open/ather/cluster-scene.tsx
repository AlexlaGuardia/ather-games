'use client'
// GARDEN CLUSTERS, DRAWN (Alex 11-15). What cluster.ts says is ground, made visible: each mate's island at their place
// (their squares held, the rest under their mist; read-only), the shared ground in the middle, a bridge from every
// rim to it, and my LANE: a pale path through my own mist with wisps along its fenced sides, so the fence reads as
// mist and not as an invisible wall. Nothing here is a canon look (CANON_GAPS: clusters [OPEN]); placeholder forms,
// neutral, in the plot's own palette.

import { useMemo } from 'react'
import * as THREE from 'three'
import { PlotIsland } from './plot-scene'
import { plotHeightAt } from './plot'
import { MIDDLE_Y, type Frame, type Seg } from './cluster'

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

/** My lane: a pale path laid on the ground through the mist, wisps along both fenced sides. */
function Lane({ s }: { s: Seg }) {
  const parts = useMemo(() => {
    const out: { x: number; y: number; z: number }[] = [], wisps: { x: number; y: number; z: number; k: number }[] = []
    const dx = s.bx - s.ax, dz = s.bz - s.az, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux
    for (let t = 0; t <= L; t += 1.5) {
      const x = s.ax + ux * t, z = s.az + uz * t, y = plotHeightAt(x, z)
      if (Number.isFinite(y)) out.push({ x, y, z })
      for (const side of [-1, 1]) {
        const wx = x + nx * side * (s.w / 2 + 0.4), wz = z + nz * side * (s.w / 2 + 0.4), wy = plotHeightAt(wx, wz)
        if (Number.isFinite(wy) && Math.round(t / 1.5) % 2 === 0) wisps.push({ x: wx, y: wy + 0.8, z: wz, k: t })
      }
    }
    return { out, wisps, yaw: Math.atan2(ux, uz) }
  }, [s])
  return (
    <>
      {parts.out.map((p, k) => (
        <mesh key={k} position={[p.x, p.y + 0.04, p.z]} rotation={[-Math.PI / 2, 0, -parts.yaw]}><planeGeometry args={[s.w, 1.7]} /><meshLambertMaterial color="#efe6cf" /></mesh>
      ))}
      {parts.wisps.map((w, k) => (
        <mesh key={`w${k}`} position={[w.x, w.y, w.z]} scale={[1.1, 1.4 + (k % 3) * 0.3, 1.1]}><icosahedronGeometry args={[0.7, 0]} /><meshLambertMaterial color="#f4f6f8" transparent opacity={0.8} flatShading /></mesh>
      ))}
    </>
  )
}

export function ClusterScene({ frame }: { frame: Frame }) {
  if (!frame.linked || !frame.middle) return null
  const m = frame.middle
  return (
    <>
      {/* the shared ground: a round island at the plots' pad height, its underside a cone like every plot's */}
      <group position={[m.x, 0, m.z]}>
        <mesh position-y={MIDDLE_Y - 0.6}><cylinderGeometry args={[m.r, m.r * 0.96, 1.2, 28]} /><meshLambertMaterial color="#a9cf86" flatShading /></mesh>
        <mesh position-y={MIDDLE_Y - 14} rotation-x={Math.PI}><coneGeometry args={[m.r * 0.95, 26, 12, 2]} /><meshLambertMaterial color="#b9a58c" flatShading /></mesh>
        <mesh position-y={MIDDLE_Y + 0.03} rotation-x={-Math.PI / 2}><ringGeometry args={[5, 6, 24]} /><meshBasicMaterial color="#efe0a8" /></mesh>
      </group>
      {frame.bridges.map((b, k) => <SegMesh key={k} s={b} color="#cdbf9f" />)}
      {frame.lane && <Lane s={frame.lane} />}
      {frame.mates.map(mt => (
        <group key={mt.quarter} position={[mt.x, 0, mt.z]}>
          <PlotIsland owned={new Set(mt.owned)} pages={0} />
        </group>
      ))}
    </>
  )
}
