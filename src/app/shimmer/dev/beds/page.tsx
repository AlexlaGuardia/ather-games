'use client'
// THE BED SHELF — one garden bed at every growth stage, drawn by the SHIPPED renderers, from any angle.
//
// ★ WHY (2026-09-18, Alex: "is there some way you can view a garden bed in an isolated setting to
// preview each stage.. and be able to view all angles.. the current one looks like only one angle
// as judged"). Every bed call this week — the rim, the sown patch, the sign, the stage nubs — was
// judged from ONE prod screenshot at one angle, and two of them were wrong from the next angle
// (the sign read as a stem from the side). The world is the wrong place to iterate: a look needs a
// build and a `/put` per cell, and a stage needs `/grow`. This page mounts the exact objects the
// world mounts — `createBedRims`, `createBedSigns`, `createWetPatches`, `createFloraRenderer` —
// over a fake column, lays the five stages in a row beside an empty bed, and lets the camera orbit.
// What you see is what the world draws, minus the light field (flat noon here), the same caveat
// `dev/stations` carries. The bed BLOCKS themselves are cubes wearing the shipped tiles × the
// material colour, the block program's own multiply, so the soil reads the colour it reads in-world.
//
// `?crop=<id>` picks the crop · `?wood=goldwood|shimmeroak|dawnwood` the frame · `?wet=1` waters
// the row · `?gap=1` puts the six beds SHOULDER TO SHOULDER so the merged rim is judged here too ·
// `?yaw=&pitch=&dist=&eye=1` pins a view. The buttons do the same and rewrite the URL, so a
// screenshot's address names what it shows.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEffect, useMemo, useState } from 'react'
import { makeTileArray } from '../../voxel3d/tex/atlas'
import { buildTileArray, sliceLayer, layerOf, TOP, SIDE, BOTTOM } from '../../voxel3d/tex/tiles'
import { createLightUniforms } from '../../voxel3d/light-glsl'
import { createBedRims } from '../../voxel3d/bed-rim'
import { createBedSigns } from '../../voxel3d/bed-sign'
import { createWetPatches } from '../../voxel3d/wet-patch'
import { createFloraRenderer } from '../../voxel3d/flora-mesh'
import { BED_CROP_IDS, bedVariant, type PlantedSpot, type PlantedStage } from '../../voxel3d/planted-feed'
import { BED_WOODS } from '../../voxel3d/garden'
import { MATERIAL_COLOR } from '../../voxel3d/attrs'
import { MAT } from '../../voxel/depth'
import { CROP_DEFS } from '../../voxel/crops'
import { BODY_H, BODY_R } from '../../voxel3d/locomotion'
import { Rig, type ShelfView } from '../shelf-rig'

const TILE = 32
const STAGES: PlantedStage[] = [0, 1, 2, 3, 4]
const STAGE_NAME = ['mound', 'sprout', 'growing', 'grown', 'ripe']
/** Cells along +x: the empty bed first, then the five stages. */
const CELLS = 1 + STAGES.length

/** Box face order is +x, −x, +y, −y, +z, −z. */
const FACE_ORDER = [SIDE, SIDE, TOP, BOTTOM, SIDE, SIDE]

/** A cube wearing a block's own three tiles × its material colour — the block program's multiply. */
function BlockCubes({ mat, cells }: { mat: number; cells: { x: number; y: number; z: number }[] }) {
  const all = useMemo(() => buildTileArray(TILE), [])
  const materials = useMemo(() => {
    const tint = new THREE.Color(MATERIAL_COLOR[mat] ?? 0xffffff)
    return FACE_ORDER.map(face => {
      const t = new THREE.DataTexture(sliceLayer(all, TILE, layerOf(mat, face)), TILE, TILE, THREE.RGBAFormat)
      t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.needsUpdate = true
      return new THREE.MeshLambertMaterial({ map: t, color: tint })
    })
  }, [all, mat])
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const mesh = useMemo(() => new THREE.InstancedMesh(geo, materials, Math.max(1, cells.length)), [geo, materials, cells.length])
  useEffect(() => {
    const d = new THREE.Object3D()
    cells.forEach((c, i) => { d.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix) })
    mesh.count = cells.length; mesh.instanceMatrix.needsUpdate = true
  }, [mesh, cells])
  return <primitive object={mesh} />
}

function Shelf({ crop, wood, wet, gap }: { crop: string; wood: number; wet: boolean; gap: number }) {
  const { gl } = useThree()
  const tiles = useMemo(() => makeTileArray(TILE, gl), [gl])
  const light = useMemo(() => createLightUniforms(), [])
  const rims = useMemo(() => createBedRims(tiles, light), [tiles, light])
  const signs = useMemo(() => createBedSigns(), [])
  const wetPatches = useMemo(() => createWetPatches(), [])
  const flora = useMemo(() => createFloraRenderer(light), [light])
  useEffect(() => () => { rims.dispose(); signs.dispose(); wetPatches.dispose(); flora.dispose() }, [rims, signs, wetPatches, flora])
  useFrame(s => flora.tick(s.clock.elapsedTime))

  const cells = useMemo(() => Array.from({ length: CELLS }, (_, i) => ({ x: i * gap, y: 0, z: 0 })), [gap])
  useEffect(() => {
    const at = new Map<string, number>(cells.map(c => [`${c.x},${c.y},${c.z}`, wood]))
    const read = (x: number, y: number, z: number) => at.get(`${x},${y},${z}`) ?? 0
    rims.invalidateAll()
    rims.sync([{ key: 'shelf', x0: 0, z0: 0, ySpan: 1 }], read)
    // cell 0 is the empty bed; cells 1..5 carry the crop at stages 0..4
    const spots: PlantedSpot[] = STAGES.map((stage, i) => {
      const c = cells[i + 1]
      return { x: c.x, y: c.y, z: c.z, cropId: crop, stage, variant: bedVariant(c.x, c.y, c.z) }
    })
    signs.set(spots)
    flora.setPlanted(spots)
    wetPatches.set(wet ? cells.map(c => ({ x: c.x, y: c.y, z: c.z, fraction: 0.8 })) : [])
  }, [rims, signs, flora, wetPatches, cells, crop, wood, wet])

  return (
    <>
      <BlockCubes mat={wood} cells={cells} />
      <primitive object={rims.group} />
      <primitive object={signs.group} />
      <primitive object={wetPatches.group} />
      <primitive object={flora.group} />
    </>
  )
}

export default function BedsPage() {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const [crop, setCrop] = useState(q?.get('crop') && BED_CROP_IDS.includes(q.get('crop')!) ? q.get('crop')! : 'goldleaf')
  const [woodId, setWoodId] = useState(BED_WOODS.some(w => w.wood === q?.get('wood')) ? q!.get('wood')! : 'goldwood')
  const [wet, setWet] = useState(q?.get('wet') === '1')
  const [gap, setGap] = useState(q?.get('gap') === '1' ? 1 : 2)
  const [eye, setEye] = useState(q?.get('eye') === '1')
  const [view, setView] = useState<ShelfView>({ yaw: Number(q?.get('yaw') ?? -0.9), pitch: Number(q?.get('pitch') ?? 0.42), dist: Number(q?.get('dist') ?? 12) })
  const wood = BED_WOODS.find(w => w.wood === woodId)!.material
  const target = useMemo(() => new THREE.Vector3(((CELLS - 1) * gap) / 2 + 0.5, 0.8, 0.5), [gap])
  // The address names the view, so a screenshot can be re-shot.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const u = new URLSearchParams({ crop, wood: woodId, yaw: view.yaw.toFixed(2), pitch: view.pitch.toFixed(2), dist: view.dist.toFixed(1) })
    if (wet) u.set('wet', '1'); if (gap === 1) u.set('gap', '1'); if (eye) u.set('eye', '1')
    window.history.replaceState(null, '', `?${u}`)
  }, [crop, woodId, wet, gap, eye, view])
  const btn = (on: boolean) => `pointer-events-auto border rounded px-2 py-0.5 ${on ? 'border-amber-300 text-amber-200 bg-black/50' : 'border-white/25 text-white/70 hover:border-white/60'}`
  return (
    <div className="fixed inset-0 bg-[#1a1d24] text-white/80 font-mono text-[11px]">
      <Canvas camera={{ fov: 45, near: 0.1, far: 200 }} onContextMenu={e => e.preventDefault()}>
        <color attach="background" args={['#1a1d24']} />
        <hemisphereLight args={[0xffffff, 0x445566, 1.1]} />
        <directionalLight position={[5, 10, 3]} intensity={0.8} />
        <Rig target={target} view={view} eye={eye} onView={setView} />
        <Shelf crop={crop} wood={wood} wet={wet} gap={gap} />
        {/* the floor at the beds' feet, and a keeper for scale */}
        <mesh position={[target.x, -0.01, target.z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[CELLS * gap + 8, 10]} /><meshLambertMaterial color={'#' + (MATERIAL_COLOR[MAT.LUSH_TURF] ?? 0x3a4a34).toString(16).padStart(6, '0')} /></mesh>
        <mesh position={[-gap, BODY_H / 2, 0.5]}><capsuleGeometry args={[BODY_R, Math.max(0.01, BODY_H - BODY_R * 2), 4, 8]} /><meshLambertMaterial color="#d98f3c" /></mesh>
      </Canvas>
      <div className="absolute top-3 left-3 space-y-1.5 pointer-events-none">
        <div className="text-white/95 tracking-[.18em] uppercase">the bed shelf</div>
        <div className="text-white/40">drag to orbit · wheel to zoom · view: yaw {view.yaw.toFixed(2)} pitch {view.pitch.toFixed(2)} dist {view.dist.toFixed(1)}</div>
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-white/35 mr-1">crop</span>
          {BED_CROP_IDS.map(id => <button key={id} onClick={() => setCrop(id)} className={btn(id === crop)}>{CROP_DEFS[id].name.toLowerCase()}</button>)}
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-white/35 mr-1">frame</span>
          {BED_WOODS.map(w => <button key={w.wood} onClick={() => setWoodId(w.wood)} className={btn(w.wood === woodId)}>{w.wood}</button>)}
          <span className="text-white/35 ml-3 mr-1">row</span>
          <button onClick={() => setGap(g => g === 1 ? 2 : 1)} className={btn(gap === 1)}>{gap === 1 ? 'merged (touching)' : 'isolated'}</button>
          <button onClick={() => setWet(w => !w)} className={btn(wet)}>{wet ? 'watered' : 'dry'}</button>
          <button onClick={() => setEye(e => !e)} className={btn(eye)}>{eye ? 'keeper eye' : 'from above'}</button>
        </div>
        <div className="text-white/60">
          {['empty', ...STAGE_NAME].map((n, i) => <span key={n} className="mr-3"><span className="text-white/85">{i * gap}</span> · {n}</span>)}
        </div>
      </div>
    </div>
  )
}
