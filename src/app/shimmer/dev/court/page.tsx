'use client'

// THE COURT, ALONE — the crossing station on a bare plane, at any tier, from any distance.
//
// ★★★ WHY THIS PAGE EXISTS, IN ALEX'S WORDS (2026-08-29): "the landmark is partially built .. i can
// tell we still dont have a way to isolate the build because there's not much change on the way it
// looks .. pretty obvious you flying blind". He is right, and `dev/grey`'s header carries the SAME
// complaint from three days earlier — *"is there a way to isolate this chunk"*. A repeated complaint
// after a fix is evidence the fix missed, not evidence it was handled: grey got a page, the court
// never did, and the gate tower shipped on 08-29 having been judged only from ASCII and arithmetic.
//
// ── ⚠⚠ THE INSTRUMENT WE HAD COULD NOT BE POINTED AT HIS WORLD, AND NOTHING SAID SO ────────────
// `world-shot.mts` drives the real page, which is the right idea, and it is blind here for two
// reasons that both fail toward a confident wrong picture:
//   1. `console.ts` HAS NO TIER COMMAND. A headless run carries no save, so it is always
//      DEFAULT_PLOT = tier 0. `courtAnchor` solves against the PlotConfig, so the court moves with
//      the tier — t0 (248,26) · t1 (337,24) · t2 (~434,18). Alex plays t1. On 08-29 the hub lane
//      photographed t0, ninety blocks from the building it was judging, and filed it afterwards as
//      "check the tier before computing a placement" — which reads as an operator slip. It is not.
//      The instrument cannot be aimed at tier 1 at all.
//   2. The court is in the PLOT space and the keeper spawns in the WILDS. `tp` without `space plot`
//      answers politely and moves you nowhere near it. Twice this morning that returned EXIT 0, a
//      real 850KB PNG, and a photograph of a meadow 700 blocks away. Same family as WORLD_GOTO
//      photographing the glade for months under the requested zone's filename.
// So this page takes its whole view FROM THE URL — `?tier=1&dist=96&yaw=0&hour=12` — and a shot of
// it is reproducible, aimable and cannot silently be of somewhere else.
//
// ★ IT LAYS WHAT THE WORLD LAYS. Every cell here comes from `socketCells` / `gateTowerCells` /
// `courtHubCells` / `courtPlatformCells` and every material from `socketMaterial` / `PLATFORM_MAT` —
// the same functions `VoxelWorld` calls at line 7215. Nothing on this page knows the court's shape.
// `dev/ring` states the rule and its history counts seven times a preview that re-derived was
// perfectly correct while the game was wrong.
//
// ── ★★ FOG IS ON BY DEFAULT AND THAT IS THE WHOLE POINT, NOT A DETAIL ──────────────────────────
// The tower is sized to subtend `LANDMARK_ANGLE_DEG` at the draw ring, and `DAY.fogNear` is 80 with
// `fogFar` 200 — so at the 96-block ring it is already sixteen blocks INTO the fog that is eating
// it. A preview with fog off would show a clean, tall, convincing landmark and would be answering a
// question the world never asks. `VoxelDayNight` is mounted for exactly this reason: it is the
// lighting AND the fog the world runs, not a studio rig chosen to flatter the model.
//
// ⚠ WHAT THIS PAGE CANNOT ANSWER, so it is not asked here: each cell is drawn as a FULL CUBE. There
// is no greedy merge, no face culling between neighbours and no ambient occlusion, so the surface
// reads flatter than the world's. Judge MASS, SILHOUETTE, PROPORTION and READ-AT-DISTANCE here.
// Judge shading, AO and seams in the world. Same split `dev/ring` draws between placement and
// footing.
//
// Run: tools/devwin.sh play  →  http://localhost:3203/shimmer/dev/court
// Shot: WORLD_OWNER=1 WORLD_URL='http://localhost:3200/shimmer/dev/court?tier=1&dist=96' \
//         npx tsx scripts/world-shot.mts out.png 6

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { plotForTier, PLOT_TIERS } from '../../voxel/plot'
import { WORLD_SEED } from '../../voxel3d/world-seed'
import {
  sockets, socketCells, socketMaterial, gateTowerCells, courtHubCells, courtPlatformCells,
  courtLevel, PLATFORM_MAT, TOWER_HEIGHT, TOWER_BACK, LANDMARK_ANGLE_DEG, LANDMARK_DIST,
  COURT_RADIUS, COURT_ARC,
} from '../../voxel3d/crossings'
import { BODY_H, BODY_R, EYE_STAND } from '../../voxel3d/locomotion'
import { MAT } from '../../voxel/depth'
import { buildTileArray, sliceLayer, layerOf, TOP, SIDE, BOTTOM } from '../../voxel3d/tex/tiles'
import { VoxelDayNight, DAY } from '../../voxel3d/day-night'
import { setTimePin } from '../../engine/day-cycle'

const SEED = WORLD_SEED
/** Tile resolution for the preview textures. The world's own atlas size; nothing here re-picks it. */
const TILE = 16

type Cell = { x: number; y: number; z: number; m: number }

/**
 * Every cell the court lays at this tier, tagged with the material the HOST would give it.
 *
 * ⚠ THE LAMP IS DRAWN LIT. `socketMaterial(c, lit)` takes the marks the keeper holds, and an unlit
 * court is the state a new keeper sees — but the lamp is four cells out of 850 and judging the
 * building is the job here. The toggle is `lit` below rather than a hardcoded true, because "what
 * does it look like before you have earned it" is a real question and hiding it would be a choice
 * made silently.
 */
function courtCells(tier: number, lit: boolean): { cells: Cell[]; level: number | null; gate: ReturnType<typeof sockets>[number] | null } {
  const cfg = plotForTier(tier)
  const level = courtLevel(SEED, cfg)
  if (level === null) return { cells: [], level: null, gate: null }
  const socks = sockets(SEED, cfg)
  const out: Cell[] = []
  for (const c of courtPlatformCells(SEED, cfg)) out.push({ ...c, m: PLATFORM_MAT })
  // ⚠ CUT_STONE, BECAUSE THE HOST SAYS SO — VoxelWorld:7211 lays the hub "CUT_STONE like the frames
  // rather than the dais brick: the reading is stone -> floor -> stone". My first version of this
  // line guessed `4` and the preview rendered the hub and the whole tower in DIRT BROWN, which is
  // the re-derivation failure this page's own header warns about, committed by the page itself
  // inside an hour. The guard now refuses a numeric material literal here.
  for (const c of courtHubCells(SEED, cfg)) out.push({ ...c, m: MAT.CUT_STONE })
  for (const s of socks) for (const c of socketCells(s, level)) {
    const m = socketMaterial(c, lit)
    if (m !== 0) out.push({ x: c.x, y: c.y, z: c.z, m })
  }
  // Likewise the tower: VoxelWorld:7219 — "Same material as the frames: the tower is the gate
  // continuing upward, not an object beside it."
  for (const c of gateTowerCells(SEED, cfg)) out.push({ ...c, m: MAT.CUT_STONE })
  return { cells: out, level, gate: socks[0] ?? null }
}

/** One `DataTexture` for a (material, face), sliced straight out of the shipped tile array. */
function useTileTextures(materials: number[]): Map<string, THREE.DataTexture> {
  return useMemo(() => {
    const all = buildTileArray(TILE)
    const m = new Map<string, THREE.DataTexture>()
    for (const mat of materials) for (const face of [TOP, SIDE, BOTTOM]) {
      const px = sliceLayer(all, TILE, layerOf(mat, face))
      const t = new THREE.DataTexture(px, TILE, TILE, THREE.RGBAFormat)
      t.colorSpace = THREE.SRGBColorSpace
      t.magFilter = THREE.NearestFilter
      t.minFilter = THREE.NearestFilter
      t.needsUpdate = true
      m.set(`${mat}:${face}`, t)
    }
    return m
  }, [materials.join(',')])
}

/** The court, as one `InstancedMesh` per material. */
function Court({ cells, origin }: { cells: Cell[]; origin: THREE.Vector3 }) {
  const mats = useMemo(() => [...new Set(cells.map(c => c.m))].sort((a, b) => a - b), [cells])
  const tex = useTileTextures(mats)
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  return (
    <group position={[-origin.x, -origin.y, -origin.z]}>
      {mats.map(mat => {
        const mine = cells.filter(c => c.m === mat)
        // Box group order is +x, -x, +y, -y, +z, -z — so index 2 is the top face, 3 the bottom.
        const faces = [SIDE, SIDE, TOP, BOTTOM, SIDE, SIDE].map(f =>
          new THREE.MeshLambertMaterial({ map: tex.get(`${mat}:${f}`) ?? null }))
        return <Instances key={mat} geo={geo} materials={faces} cells={mine} />
      })}
    </group>
  )
}

function Instances({ geo, materials, cells }: {
  geo: THREE.BoxGeometry; materials: THREE.Material[]; cells: Cell[]
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const d = new THREE.Object3D()
    cells.forEach((c, i) => {
      // +0.5 puts the cube on the cell CENTRE, which is the convention `gateTowerCells` fills against.
      d.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5)
      d.updateMatrix()
      mesh.setMatrixAt(i, d.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [cells])
  return <instancedMesh ref={ref} args={[geo, materials as unknown as THREE.Material, cells.length]} frustumCulled={false} />
}

/**
 * The keeper, at the gate's mouth, so proportion is felt rather than read.
 * `BODY_H` / `BODY_R` are the walker's own, imported — `dev/runehold` records what it costs to have
 * the town and the walker disagree about how tall a person is.
 */
function Keeper({ at }: { at: THREE.Vector3 }) {
  return (
    <mesh position={[at.x, at.y + BODY_H / 2, at.z]}>
      <capsuleGeometry args={[BODY_R, Math.max(0.01, BODY_H - BODY_R * 2), 4, 8]} />
      <meshLambertMaterial color="#d98f3c" />
    </mesh>
  )
}

/** A flat plane at the court's own ground, so the building is the only thing in frame. */
function Ground({ y }: { y: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[1200, 1200]} />
      <meshLambertMaterial color="#6f8f5a" />
    </mesh>
  )
}

/**
 * Camera on a rail: distance and yaw about the gate, looking at the middle of what stands there.
 *
 * ★ IT IS NOT AN ORBIT CONTROL, DELIBERATELY. A dragged camera cannot be written down, and the
 * question this page exists for — "does it read from the draw ring" — is a question about a
 * SPECIFIC distance. A rail that reads its numbers from the URL is reproducible by a headless shot
 * and comparable between two days.
 */
function Rail({ dist, yaw, eye, height, facing, stand, doorMid }: {
  dist: number; yaw: number; eye: boolean; height: number; facing: number
  /** Scene y of the surface a keeper stands on inside the court — DERIVED, see `courtCells`. */
  stand: number
  /** Scene y of the middle of the gate's opening — what an eye-level view must be aimed through. */
  doorMid: number
}) {
  const { camera } = useThree()
  useFrame(() => {
    // ── ⚠⚠ YAW IS RELATIVE TO THE GATE'S OWN FACE, NOT TO WORLD NORTH ────────────────────────
    // The first version orbited in world space, and `yaw=0` put the camera on +Z — which is a
    // different, oblique view of the gate AT EVERY TIER, because each socket turns to face the
    // court's focus (t1's gate bears 311 degrees; t0's 310; t2 differs again). So the page's
    // DEFAULT view was not the front of the thing it exists to judge, and finding head-on meant
    // knowing a number that moves with the tier. That is the same defect this whole page was built
    // against — an instrument you cannot aim — reproduced inside the instrument, at a smaller scale.
    // Anchoring to `facing` makes yaw=0 mean "square on to the gate" for every tier and every seed,
    // which is the only bearing that is the same question twice.
    //
    // ★ +NORMAL IS THE KEEPER'S SIDE. `socketCells` records it: "the normal points at the keeper, so
    // depth is laid back from it". So facing+0 stands you in the court, looking at the gate's face.
    const r = facing + (yaw * Math.PI) / 180
    // Look at the middle of the standing mass, or level at the keeper's eye from the ground.
    // ── ⚠ EYE HEIGHT IS MEASURED FROM THE FLOOR THE KEEPER STANDS ON, NOT FROM THE DAIS TOP ────
    // Measured at t1: courtLevel 98, the dais tops out AT 98 (scene 0), and the hub floor is 99 —
    // so a keeper stands at scene 1 and their eye rides at 1 + EYE_STAND. My first version put the
    // camera at EYE_STAND above scene 0, a full course low, and aimed it at the doorway's SILL
    // rather than through the opening (the door spans scene 1..4). The view filled with stone and
    // read as "you cannot see the gate from here", which is a claim about the building. It was a
    // claim about the camera. `stand` and `doorMid` are both derived off the host's own cells.
    const aimY = eye ? doorMid : height / 2
    camera.position.set(Math.cos(r) * dist, eye ? stand + EYE_STAND : height * 0.55, Math.sin(r) * dist)
    camera.lookAt(0, aimY, 0)
  })
  return null
}

const num = (v: string | null, d: number) => (v === null || v === '' || isNaN(Number(v)) ? d : Number(v))

export default function CourtPage() {
  const [tier, setTier] = useState(1)
  const [dist, setDist] = useState(96)
  const [yaw, setYaw] = useState(0)
  const [hour, setHour] = useState(12)
  const [fog, setFog] = useState(true)
  const [lit, setLit] = useState(true)
  const [eye, setEye] = useState(false)

  // ⚠ URL FIRST, ONCE. The controls below are for a human; the URL is for a headless shot, and a
  // shot that had to click something could not be taken at all.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setTier(Math.max(0, Math.min(PLOT_TIERS.length - 1, num(q.get('tier'), 1))))
    setDist(num(q.get('dist'), 96))
    setYaw(num(q.get('yaw'), 0))
    setHour(num(q.get('hour'), 12))
    if (q.get('fog') === '0') setFog(false)
    if (q.get('lit') === '0') setLit(false)
    if (q.get('eye') === '1') setEye(true)
  }, [])

  // ★ THE CLOCK IS PINNED THROUGH THE SHIPPED MECHANISM, and released on unmount — `setTimePin` is
  // module state, so a page that pins noon and navigates away pins the whole app. `dev/grey` pays
  // for this comment.
  useEffect(() => {
    setTimePin((hour / 24) * 24)
    return () => setTimePin(null)
  }, [hour])

  const { cells, level, gate } = useMemo(() => courtCells(tier, lit), [tier, lit])

  // Everything below is a READING off the cells, not a restatement of a constant. The numbers that
  // matter here are relationships (how tall against the ground, how wide the sky shows through) and
  // a literal equal to today's value is indistinguishable from the derivation that produced it.
  const stats = useMemo(() => {
    if (!cells.length || level === null || !gate) return null
    const ys = cells.map(c => c.y)
    const top = Math.max(...ys), bot = Math.min(...ys)
    const relief = top - level
    const subtend = (2 * Math.atan(relief / 2 / dist) * 180) / Math.PI
    // The gate's face, as the keeper meets it: how much of the frontal rectangle is sky.
    const tx = -Math.sin(gate.facing), tz = Math.cos(gate.facing)
    const nx = Math.cos(gate.facing), nz = Math.sin(gate.facing)
    const face = new Set<string>()
    let hMin = 99, hMax = -99
    for (const c of cells) {
      const dx = c.x - gate.x, dz = c.z - gate.z
      const d = dx * nx + dz * nz
      if (d < -(TOWER_BACK + 1) || d > 1.5) continue
      const h = Math.round(dx * tx + dz * tz)
      if (Math.abs(h) > 6) continue
      hMin = Math.min(hMin, h); hMax = Math.max(hMax, h)
      face.add(`${h},${c.y}`)
    }
    const cols = hMax - hMin + 1, rows = top - level + 1
    const solid = face.size, area = cols * rows
    // The floor a keeper stands on and the middle of the opening — read off the cells the host
    // lays, never restated. `courtHubCells` is the court's floor course; the doorway is the
    // `doorway` cells of the gate's own frame.
    const hubYs = courtHubCells(SEED, plotForTier(tier)).map(c => c.y - level)
    const stand = hubYs.length ? Math.max(...hubYs) : 1
    const doorYs = socketCells(gate, level).filter(c => c.doorway).map(c => c.y - level)
    const doorMid = doorYs.length ? (Math.min(...doorYs) + Math.max(...doorYs)) / 2 : stand + EYE_STAND

    return {
      cells: cells.length, top, bot, relief, subtend, stand, doorMid,
      void: area > 0 ? 1 - solid / area : 0, cols, rows,
      fogBite: Math.max(0, dist - DAY.fogNear) / Math.max(1, DAY.fogFar - DAY.fogNear),
      byMat: [...cells.reduce((m, c) => m.set(c.m, (m.get(c.m) ?? 0) + 1), new Map<number, number>())]
        .sort((a, b) => b[1] - a[1]),
    }
  }, [cells, level, gate, dist, tier])

  // The world origin for the scene: the gate's own column at the court's ground, so `dist` is
  // measured from the building rather than from a plot coordinate that moves with the tier.
  const origin = useMemo(() =>
    new THREE.Vector3(gate ? gate.x : 0, level ?? 0, gate ? gate.z : 0), [gate, level])
  const groundY = 0
  const keeperAt = useMemo(() => {
    if (!gate) return new THREE.Vector3(0, 0, 0)
    // One step out from the gate's face, on the keeper's side (+normal points at the court focus).
    const nx = Math.cos(gate.facing), nz = Math.sin(gate.facing)
    return new THREE.Vector3(nx * 3, (level ?? 0) - (level ?? 0) + 1, nz * 3)
  }, [gate, level])

  const link = `?tier=${tier}&dist=${Math.round(dist)}&yaw=${Math.round(yaw)}&hour=${hour}${fog ? '' : '&fog=0'}${lit ? '' : '&lit=0'}${eye ? '&eye=1' : ''}`

  return (
    <div className="flex h-screen w-screen flex-col bg-black text-white/80">
      <div className="shrink-0 border-b border-white/10 p-3 text-[11px]">
        <div className="gx-label mb-2 text-[9px] text-white/40">
          The court, alone — tier {tier}, {Math.round(dist)} blocks out
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex items-center gap-2">
            <span className="text-white/40">tier</span>
            {PLOT_TIERS.map((_, t) => (
              <button key={t} onClick={() => setTier(t)}
                className={`px-2 py-0.5 ${t === tier ? 'bg-white/20 text-white' : 'bg-white/5'}`}>t{t}</button>
            ))}
          </label>
          <label className="flex items-center gap-2">
            <span className="text-white/40">dist</span>
            <input type="range" min={6} max={200} step={1} value={dist}
              onChange={e => setDist(Number(e.target.value))} className="w-40" />
            <span className="w-10 tabular-nums text-right">{Math.round(dist)}</span>
            <button onClick={() => setDist(LANDMARK_DIST)} className="bg-white/5 px-2 py-0.5">ring {LANDMARK_DIST}</button>
            <button onClick={() => setDist(20)} className="bg-white/5 px-2 py-0.5">20</button>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-white/40">yaw<span className="text-white/25"> (0 = facing the gate)</span></span>
            <input type="range" min={-180} max={180} step={1} value={yaw}
              onChange={e => setYaw(Number(e.target.value))} className="w-32" />
            <span className="w-10 tabular-nums text-right">{Math.round(yaw)}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-white/40">hour</span>
            <input type="range" min={0} max={24} step={0.5} value={hour}
              onChange={e => setHour(Number(e.target.value))} className="w-28" />
            <span className="w-8 tabular-nums text-right">{hour}</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={fog} onChange={e => setFog(e.target.checked)} />
            <span className="text-white/40">fog</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={lit} onChange={e => setLit(e.target.checked)} />
            <span className="text-white/40">lamps lit</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={eye} onChange={e => setEye(e.target.checked)} />
            <span className="text-white/40">keeper eye</span>
          </label>
        </div>
        {stats && (
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 tabular-nums text-white/50">
            <span>{stats.cells} cells</span>
            <span>relief <b className="text-white/80">{stats.relief}</b> courses (tower {TOWER_HEIGHT})</span>
            <span>subtends <b className="text-white/80">{stats.subtend.toFixed(1)}°</b> at {Math.round(dist)}
              {' '}(target {LANDMARK_ANGLE_DEG}° at {LANDMARK_DIST})</span>
            <span>gate face {stats.cols}×{stats.rows}, void <b className="text-white/80">{(stats.void * 100).toFixed(0)}%</b></span>
            <span>fog eats <b className="text-white/80">{(stats.fogBite * 100).toFixed(0)}%</b> at this range</span>
            <span>radius {COURT_RADIUS} · arc {COURT_ARC}</span>
            {/* ⚠ dist is measured from the GATE and the focus is COURT_RADIUS away, so past that
                you have walked THROUGH the court and are looking back at it from outside. Easy to
                do by accident and it looks like a broken view rather than a chosen one. */}
            {dist > COURT_RADIUS && (
              <span className="text-amber-300/70">⚠ {(dist - COURT_RADIUS).toFixed(0)} past the focus</span>
            )}
          </div>
        )}
        <div className="mt-1 text-[10px] text-white/25">shot: <code>{link}</code></div>
      </div>

      <div className="min-h-0 flex-1">
        {level === null ? (
          <div className="flex h-full items-center justify-center text-white/40">
            no court at tier {tier} — <code className="ml-1">courtLevel</code> is null
          </div>
        ) : (
          <Canvas camera={{ fov: 60, near: 0.1, far: 900 }} gl={{ preserveDrawingBuffer: true }}>
            <color attach="background" args={[DAY.bg]} />
            {/* The shipped rig. Fog is part of it, which is why turning fog off is a deliberate act. */}
            <VoxelDayNight />
            {!fog && <fog attach="fog" args={[DAY.bg, 5000, 6000]} />}
            <Rail dist={dist} yaw={yaw} eye={eye} height={stats?.relief ?? 20} facing={gate?.facing ?? 0}
              stand={stats?.stand ?? 1} doorMid={stats?.doorMid ?? 2.5} />
            <Ground y={groundY} />
            <Court cells={cells} origin={origin} />
            <Keeper at={keeperAt} />
          </Canvas>
        )}
      </div>
    </div>
  )
}
