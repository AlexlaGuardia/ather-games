'use client'
// THE STATION SHELF — every modelled station, side by side, drawn by the SHIPPED renderer.
//
// ★ WHY (2026-09-15, Alex: "have our agents/shadows revamp the stations.. they don't have to make
// it a block.. take a look at how minecraft does theirs"). A model is judged by looking at it, and
// the world is the wrong place to iterate: a look needs a prod build or a lane server, and a
// `/put` for each. This page mounts `createStationRenderer` — the exact object the world mounts —
// over the exact tile array, feeds it a fake column holding one of each station, and lets the
// camera orbit. What you see here is what the world draws, minus the light field (no ring here:
// the hour is noon and the field is flat), which is the same caveat `dev/worktable` carries.
//
// Read it with `?mat=<id>` to isolate one station, `?yaw=&pitch=&dist=` to pin a view. The page
// prints the model note under each station so an agent's screenshot names what it shows.
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEffect, useMemo, useState } from 'react'
import { makeTileArray } from '../../voxel3d/tex/atlas'
import { createStationRenderer } from '../../voxel3d/station-mesh'
import { createLightUniforms } from '../../voxel3d/light-glsl'
import { modelOf, STATION_MODELS } from '../../voxel3d/station-models'
import { MODELLED_MATS } from '../../voxel/depth'
import { blockDef } from '../../voxel/registry'
import { BODY_H, BODY_R } from '../../voxel3d/locomotion'
import { Rig } from '../shelf-rig'

const TILE = 32
const GAP = 2
const ORDER = [...MODELLED_MATS]

function Shelf({ only }: { only: number | null }) {
  const { gl } = useThree()
  const tiles = useMemo(() => makeTileArray(TILE, gl), [gl])
  const light = useMemo(() => createLightUniforms(), [])
  const renderer = useMemo(() => createStationRenderer(tiles, light), [tiles, light])
  useEffect(() => () => renderer.dispose(), [renderer])
  useEffect(() => {
    // One fake column, the stations in a row along +x at y=0, gap cells between.
    const mats = only !== null ? [only] : ORDER
    const at = new Map<string, number>()
    mats.forEach((m, i) => at.set(`${i * GAP},0,0`, m))
    const read = (x: number, y: number, z: number) => at.get(`${x},${y},${z}`) ?? 0
    // As many 16-wide columns as the row needs — a scan is per column, and eleven stations at a two-cell gap run past one.
    const cols = Math.ceil((mats.length * GAP + 1) / 16)
    renderer.sync(Array.from({ length: cols }, (_, i) => ({ key: `shelf-${i}`, x0: i * 16, z0: 0, ySpan: 1 })), read)
  }, [renderer, only])
  return <primitive object={renderer.group} />
}

export default function StationsPage() {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const only = q?.get('mat') ? Number(q.get('mat')) : null
  const [view, setView] = useState({ yaw: Number(q?.get('yaw') ?? -0.9), pitch: Number(q?.get('pitch') ?? 0.42), dist: Number(q?.get('dist') ?? (only !== null ? 3 : 14)) })
  /** `?eye=1` opens at a keeper's eye; the button flips it. */
  const [eye, setEye] = useState(q?.get('eye') === '1')
  const n = only !== null ? 1 : ORDER.length
  const target = useMemo(() => new THREE.Vector3(((n - 1) * GAP) / 2 + 0.5, 0.5, 0.5), [n])
  const mats = only !== null ? [only] : ORDER
  return (
    <div className="fixed inset-0 bg-[#1a1d24] text-white/80 font-mono text-[11px]">
      <Canvas camera={{ fov: 45, near: 0.1, far: 200 }} onContextMenu={e => e.preventDefault()}>
        <color attach="background" args={['#1a1d24']} />
        <hemisphereLight args={[0xffffff, 0x445566, 1.1]} />
        <directionalLight position={[5, 10, 3]} intensity={0.8} />
        <Rig target={target} view={view} eye={eye} onView={setView} />
        <Shelf only={only} />
        {/* the floor, and a keeper for scale */}
        <mesh position={[target.x, -0.01, target.z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[n * GAP + 6, 8]} /><meshLambertMaterial color="#3a4a34" /></mesh>
        <mesh position={[-GAP, BODY_H / 2, 0.5]}><capsuleGeometry args={[BODY_R, Math.max(0.01, BODY_H - BODY_R * 2), 4, 8]} /><meshLambertMaterial color="#d98f3c" /></mesh>
      </Canvas>
      <div className="absolute top-3 left-3 space-y-1 pointer-events-none">
        <div className="text-white/95 tracking-[.18em] uppercase">the station shelf</div>
        <div className="text-white/40">drag to orbit · wheel to zoom · ?mat=&lt;id&gt; isolates one · ?eye=1 stands a keeper · view: yaw {view.yaw.toFixed(2)} pitch {view.pitch.toFixed(2)} dist {view.dist.toFixed(1)}</div>
        <button onClick={() => setEye(e => !e)} className="pointer-events-auto border border-white/25 rounded px-2 py-0.5 text-white/80 hover:border-amber-300">{eye ? 'keeper eye' : 'from above'}</button>
        {mats.map((m, i) => (
          <div key={m} className="text-white/60">
            <span className="text-white/85">{i * GAP}</span> · {blockDef(m)?.name} <span className="text-white/35">(mat {m})</span> — {modelOf(m).note}{m in STATION_MODELS ? '' : ' ⚠ no model yet'}
          </div>
        ))}
      </div>
    </div>
  )
}
