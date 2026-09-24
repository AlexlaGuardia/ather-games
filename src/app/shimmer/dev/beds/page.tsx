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
// `dev/stations` carries. The bed BLOCKS and the turf under them are ONE small section run through
// the shipped greedy mesher and drawn by the shipped textured block program — tiles, material
// colour, AO, variants — so the soil reads exactly the colour it reads in-world.
//
// `?crop=<id>` picks the crop · `?wood=goldwood|shimmeroak|dawnwood` the frame · `?wet=1` waters
// the row · `?gap=1` puts the six beds SHOULDER TO SHOULDER so the merged rim is judged here too ·
// `?yaw=&pitch=&dist=&eye=1` pins a view. The buttons do the same and rewrite the URL, so a
// screenshot's address names what it shows.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEffect, useMemo, useState } from 'react'
import { makeTileArray, createTexturedVoxelMaterial } from '../../voxel3d/tex/atlas'
import { Section } from '../../voxel/section'
import { greedyMesh } from '../../voxel/greedy'
import { buildAttrsSplit } from '../../voxel3d/attrs'
import { toGeometry } from '../../voxel3d/mesh-bridge'
import { isLeafMat } from '../../voxel/trees'
import { isGlassMat } from '../../voxel/depth'
import { createLightUniforms } from '../../voxel3d/light-glsl'
import { createBedRims } from '../../voxel3d/bed-rim'
import { createBedSigns } from '../../voxel3d/bed-sign'
import { createWetPatches } from '../../voxel3d/wet-patch'
import { createFloraRenderer, shroomShapeOf, SHROOM_SHAPES } from '../../voxel3d/flora-mesh'
import { FLORA } from '../../voxel/flora'
import { BED_CROP_IDS, bedVariant, type PlantedSpot, type PlantedStage } from '../../voxel3d/planted-feed'
import { BED_WOODS } from '../../voxel3d/garden'
import { MAT } from '../../voxel/depth'
import { CROP_DEFS } from '../../voxel/crops'
import { BODY_H, BODY_R } from '../../voxel3d/locomotion'
import { Rig, type ShelfView } from '../shelf-rig'

const TILE = 32
const STAGES: PlantedStage[] = [0, 1, 2, 3, 4]
const STAGE_NAME = ['mound', 'sprout', 'growing', 'grown', 'ripe']
/** Cells along +x: the empty bed first, then the five stages. */
const CELLS = 1 + STAGES.length

/** The section the shelf lives in: turf at y=0 everywhere, the beds at y=1. */
const SEC = 16
const BED_Y = 1

/**
 * The ground and the beds as the world draws them: a section, the shipped mesher, the shipped
 * textured block material. One mesh, rebuilt when the wood or the row changes.
 */
function Ground({ tiles, light, cells, wood }: { tiles: ReturnType<typeof makeTileArray>; light: ReturnType<typeof createLightUniforms>; cells: { x: number; y: number; z: number }[]; wood: number }) {
  const textured = useMemo(() => createTexturedVoxelMaterial(tiles, light), [tiles, light])
  useEffect(() => () => textured.material.dispose(), [textured])
  const geo = useMemo(() => {
    const sec = new Section(SEC)
    for (let x = 0; x < SEC; x++) for (let z = 0; z < SEC; z++) sec.set(x, 0, z, MAT.LUSH_TURF)
    for (const c of cells) sec.set(c.x, c.y, c.z, wood)
    const mesh = greedyMesh(sec)
    const { solid } = buildAttrsSplit(mesh, m => m === MAT.WATER, isLeafMat, isGlassMat)
    return solid ? toGeometry(solid) : new THREE.BufferGeometry()
  }, [cells, wood])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={textured.material} />
}

function Shelf({ crop, wood, wet, gap, shroom }: { crop: string; wood: number; wet: boolean; gap: number; shroom: boolean }) {
  const { gl } = useThree()
  const tiles = useMemo(() => makeTileArray(TILE, gl), [gl])
  const light = useMemo(() => createLightUniforms(), [])
  const rims = useMemo(() => createBedRims(tiles, light), [tiles, light])
  const signs = useMemo(() => createBedSigns(), [])
  const wetPatches = useMemo(() => createWetPatches(), [])
  const flora = useMemo(() => createFloraRenderer(light), [light])
  useEffect(() => () => { rims.dispose(); signs.dispose(); wetPatches.dispose(); flora.dispose() }, [rims, signs, wetPatches, flora])
  useFrame(s => flora.tick(s.clock.elapsedTime))

  // Along +x from x=2 (a margin of turf before the first bed), on the turf at y=1, mid-section in z.
  const cells = useMemo(() => Array.from({ length: CELLS }, (_, i) => ({ x: 2 + i * gap, y: BED_Y, z: SEC >> 1 })), [gap])
  useEffect(() => {
    const at = new Map<string, number>(cells.map(c => [`${c.x},${c.y},${c.z}`, wood]))
    const read = (x: number, y: number, z: number) => at.get(`${x},${y},${z}`) ?? 0
    rims.invalidateAll()
    rims.sync([{ key: 'shelf', x0: 0, z0: 0, ySpan: BED_Y + 1 }], read)
    // cell 0 is the empty bed; cells 1..5 carry the crop at stages 0..4
    const spots: PlantedSpot[] = STAGES.map((stage, i) => {
      const c = cells[i + 1]
      return { x: c.x, y: c.y, z: c.z, cropId: crop, stage, variant: bedVariant(c.x, c.y, c.z) }
    })
    // ★ `?shroom=1` (2026-09-24, sculpt queue ③): the mushroom family instead of the crop — every
    // shape twice along the row, off the SHIPPED wild feed (`sync` + a probe), so the pools, tints,
    // placement and scale are the world's own. The variant is searched per shape, never retyped.
    if (shroom) {
      signs.set([]); flora.setPlanted([])
      const want = (shape: number, k: number) => { let n = 0
        for (let i = 1; i < 4000; i++) { const v = i / 4001; if (shroomShapeOf(v) === shape && n++ === k * 7) return v } return 0 }
      const at = new Map<string, number>()
      cells.forEach((c, i) => { if (i < SHROOM_SHAPES.length * 2) at.set(`${c.x},${c.z + 3}`, want(i % SHROOM_SHAPES.length, i < SHROOM_SHAPES.length ? 0 : 60)) })
      flora.invalidateAll()
      flora.sync([{ key: 'shelf', x0: 0, z0: 0 }], 1337, (x, z) => {
        const v = at.get(`${x},${z}`)
        return v === undefined ? null : { y: BED_Y - 1, kind: FLORA.MUSHROOM, variant: v, mat: MAT.MUSHROOM, ground: MAT.TOPSOIL }
      })
      return
    }
    signs.set(spots)
    flora.setPlanted(spots)
    wetPatches.set(wet ? cells.map(c => ({ x: c.x, y: c.y, z: c.z, fraction: 0.8 })) : [])
  }, [rims, signs, flora, wetPatches, cells, crop, wood, wet, shroom])

  return (
    <>
      <Ground tiles={tiles} light={light} cells={cells} wood={wood} />
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
  const shroom = q?.get('shroom') === '1'
  const [view, setView] = useState<ShelfView>({ yaw: Number(q?.get('yaw') ?? -0.9), pitch: Number(q?.get('pitch') ?? 0.42), dist: Number(q?.get('dist') ?? 12) })
  const wood = BED_WOODS.find(w => w.wood === woodId)!.material
  const target = useMemo(() => new THREE.Vector3(2 + ((CELLS - 1) * gap) / 2 + 0.5, BED_Y + 0.8, (SEC >> 1) + 0.5), [gap])
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
        <Rig target={target} view={view} eye={eye} onView={setView} floor={BED_Y} />
        <Shelf crop={crop} wood={wood} wet={wet} gap={gap} shroom={shroom} />
        {/* a keeper for scale, standing on the turf before the first bed */}
        <mesh position={[0.5, BED_Y + BODY_H / 2, (SEC >> 1) + 0.5]}><capsuleGeometry args={[BODY_R, Math.max(0.01, BODY_H - BODY_R * 2), 4, 8]} /><meshLambertMaterial color="#d98f3c" /></mesh>
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
          {['empty', ...STAGE_NAME].map((n, i) => <span key={n} className="mr-3"><span className="text-white/85">x{2 + i * gap}</span> · {n}</span>)}
        </div>
      </div>
    </div>
  )
}
