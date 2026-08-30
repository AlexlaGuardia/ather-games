'use client'

// THE STRUCTURE WORKTABLE — build a building on a bare pad, save it, load it back.
//
// ★★★ WHY THIS EXISTS, IN ALEX'S WORDS (2026-08-29): *"a demo space where you can view independant
// structures .. if we wanted to build houses here we can not only view but build them in an isolated
// enviroment that you can see and edit at .. a kind of structure worktable."*
//
// The court taught the lesson that produced this page. `dev/court` fixed the LOOKING half for one
// code-generated building, and every judgement on the gate station before it was made from ASCII and
// arithmetic. This is the other half and it is general: a human places blocks, the result is DATA,
// and the world can stamp that data. Structures stop being something only code can author.
//
// ── ★★ WHAT MAKES IT HONEST: IT DRAWS WITH THE SHIPPED PAINTER ────────────────────────────────
// Every texture is `buildTileArray` / `sliceLayer` — the same array the game samples — and every
// material comes off `ALL_BLOCKS`, filtered by the registry's own `placeable` flag rather than a
// hand-kept palette. A new block joins this page by BEING placeable, not by anyone remembering.
// `dev/court`'s history counts the cost of the alternative: one guessed material id rendered a whole
// tower in dirt brown while every assert stayed green.
//
// ⚠ WHAT IT CANNOT ANSWER, so do not ask it here. Cells are FULL CUBES: no greedy merge, no face
// culling between neighbours, no ambient occlusion. Judge MASS, SILHOUETTE, PROPORTION, MATERIAL MIX
// and READ-AT-DISTANCE. Judge shading, AO and seams in the world. Same split `dev/court` draws.
//
// ⚠ THE VIEW IS DRAGGABLE HERE, AND THAT IS A DELIBERATE DEPARTURE FROM `dev/court`. That page
// refuses an orbit control on purpose — it answers "does it read from the draw ring", a question
// about a SPECIFIC distance, and a dragged camera cannot be written down. An editor has the opposite
// need: you must get behind the thing you are building. So the camera drags AND the current view is
// printed as a URL you can copy, which keeps a reading reproducible without crippling the tool.
//
// ★ FOG AND TIME ARE THE WORLD'S, and default ON for the same reason the court's do — a studio rig
// flatters a model and answers a question the world never asks. Both are toggles, because "what does
// this look like unfogged at noon" is also a real question, just a different one.
//
// Run: tools/devwin.sh hub → http://localhost:3200/shimmer/dev/worktable
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ALL_BLOCKS, blockDef, type BlockSkill } from '../../voxel/registry'
import { MAT, isHalfMat } from '../../voxel/depth'
import { buildTileArray, sliceLayer, layerOf, TOP, SIDE, BOTTOM } from '../../voxel3d/tex/tiles'
import { VoxelDayNight, DAY } from '../../voxel3d/day-night'
import { setTimePin } from '../../engine/day-cycle'
import { BODY_H, BODY_R, EYE_STAND } from '../../voxel3d/locomotion'
import {
  makeBlueprint, blueprintCells, boundsOf, normalizeCells, pieceFootprint, BLUEPRINT_MAX_SPAN,
  type BlueprintCell, type BlueprintDef, type BlueprintPiece,
} from '../../voxel/blueprints'
import { PIECES, type Rotation } from '../../voxel/pieces'
import { createPieceRenderer } from '../../voxel3d/piece-mesh'

const TILE = 16
/** The build pad, in blocks. Big enough for a cottage and a yard; not a world. */
const PAD = 24
/**
 * The face a keeper stands on. The pad mesh is a 1-deep box centred at `-0.5`, so its top is 0 —
 * which is also why a block at `c.y` sits directly on it. ⚠ Named rather than typed at the two use
 * sites: `dev/hold` had 91 figures a block under the ground for exactly the want of one of these.
 */
const PAD_TOP = 0

/**
 * The palette, DERIVED. `placeable` is the registry's own answer to "can a player put this down",
 * which is exactly the question a worktable asks. ⚠ A hand-kept list here would be a third dialect
 * of the building vocabulary — `dev/building` keeps one for its 2D board and `pieces.ts` keeps the
 * piece families — and it would go stale silently the day a block is added.
 */
const PALETTE = ALL_BLOCKS.filter(b => b.placeable).map(b => b.material)

/**
 * The palette, in FAMILIES — and the families are derived too.
 *
 * ⚠⚠ THE FLAT LIST WAS A REAL DEFECT AND ONLY LOOKING FOUND IT (2026-08-29). 65 blocks in two
 * columns is 33 rows, which pushed *saved structures* — the LOAD half of "view and edit" — clean off
 * the bottom of the viewport. Every assert was about correctness and passed; the panel was correct
 * and unusable. A screenshot answered in two seconds what the oracle could not ask.
 *
 * ★ `skill ?? fastSkill` IS THE GROUPING, NOT A HAND-KEPT TABLE. `skill` gates a block (a spike will
 * not cut a tree) and `fastSkill` names the right tool on an ungated one — between them they already
 * partition the placeable set exactly the way a builder reaches: prospecting is stone, forestry is
 * wood, farming is ground and growing things, and what neither claims is a fixture. Measured, not
 * assumed: 65 blocks fall into 4 groups with none left stranded. A new block joins its family by
 * having a tool, the same way it joined the palette by being placeable.
 */
const FAMILY: { key: BlockSkill | null; label: string; open: boolean }[] = [
  { key: 'prospecting', label: 'stone',            open: true },
  { key: 'forestry',    label: 'wood',             open: true },
  { key: null,          label: 'fixtures',         open: false },
  { key: 'farming',     label: 'ground & growing', open: false },
]

/** Which family a material belongs to. One question, asked once. */
const familyOf = (m: number): BlockSkill | null => {
  const d = blockDef(m)
  return d ? (d.skill ?? d.fastSkill ?? null) : null
}

type Cells = Map<string, number>
const key = (x: number, y: number, z: number) => `${x},${y},${z}`
const unkey = (k: string): BlueprintCell => {
  const [x, y, z] = k.split(',').map(Number)
  return { x, y, z, m: 0 }
}

/** One `DataTexture` per (material, face), sliced out of the shipped tile array. */
function useTiles(materials: number[]): Map<string, THREE.DataTexture> {
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

/** Box face order is +x, -x, +y, -y, +z, -z — so index 2 is the top face and 3 the bottom. */
const FACE_ORDER = [SIDE, SIDE, TOP, BOTTOM, SIDE, SIDE]

function MaterialMesh({ mat, cells, tex, onHit }: {
  mat: number; cells: BlueprintCell[]; tex: Map<string, THREE.DataTexture>
  onHit: (e: { point: THREE.Vector3; normal: THREE.Vector3; shift: boolean; alt: boolean }) => void
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const materials = useMemo(
    () => FACE_ORDER.map(f => new THREE.MeshLambertMaterial({ map: tex.get(`${mat}:${f}`) ?? null })),
    [mat, tex])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const d = new THREE.Object3D()
    cells.forEach((c, i) => {
      // +0.5 puts the cube on the cell CENTRE, the convention the whole voxel tree fills against.
      d.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5)
      d.updateMatrix()
      mesh.setMatrixAt(i, d.matrix)
    })
    mesh.count = cells.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [cells])

  return (
    <instancedMesh
      ref={ref}
      args={[geo, materials as unknown as THREE.Material, Math.max(1, cells.length)]}
      frustumCulled={false}
      onPointerDown={e => {
        e.stopPropagation()
        const n = e.face?.normal ? e.face.normal.clone() : new THREE.Vector3(0, 1, 0)
        onHit({ point: e.point, normal: n, shift: e.shiftKey, alt: e.altKey || e.button === 2 })
      }}
    />
  )
}

/**
 * The pad. A real box rather than a plane, so the placement maths below is ONE rule for both the pad
 * and the blocks: step half a cell along the hit normal to place, against it to remove.
 */
function Pad({ onHit }: { onHit: (e: { point: THREE.Vector3; normal: THREE.Vector3; shift: boolean; alt: boolean }) => void }) {
  return (
    <mesh
      position={[PAD / 2, -0.5, PAD / 2]}
      onPointerDown={e => {
        e.stopPropagation()
        const n = e.face?.normal ? e.face.normal.clone() : new THREE.Vector3(0, 1, 0)
        onHit({ point: e.point, normal: n, shift: e.shiftKey, alt: e.altKey || e.button === 2 })
      }}
    >
      <boxGeometry args={[PAD, 1, PAD]} />
      <meshLambertMaterial color="#5d6b52" />
    </mesh>
  )
}

/**
 * The pieces, drawn by the SHIPPED renderer.
 *
 * ★★ `createPieceRenderer` IS WHAT THE WORLD USES, and mounting its group here is the whole reason
 * a door in the worktable looks like a door in the game. Drawing piece footprints as boxes would
 * have been quicker and would have made this page a liar about the one thing it exists to show —
 * seven previews that re-derived were perfectly correct while the game was wrong.
 *
 * ⚠ `setWorldSolid` IS FED FROM THE BLUEPRINT'S OWN BLOCKS. Fence arms reach for adjacent solids;
 * without it a fence built against a wall renders unconnected here and connected in the world, which
 * is exactly the kind of small lie that sends someone rebuilding a fence that was already right.
 */
function Pieces({ placements, solid }: { placements: BlueprintPiece[]; solid: (x: number, y: number, z: number) => boolean }) {
  const renderer = useMemo(() => createPieceRenderer(), [])
  useEffect(() => () => renderer.dispose(), [renderer])
  useEffect(() => { renderer.setWorldSolid(solid) }, [renderer, solid])
  useEffect(() => { renderer.sync(placements) }, [renderer, placements])
  return <primitive object={renderer.group} />
}

/** A keeper-sized capsule, so proportion is FELT rather than read off a number. */
function Keeper({ at }: { at: [number, number, number] }) {
  return (
    <mesh position={[at[0], at[1] + BODY_H / 2, at[2]]}>
      <capsuleGeometry args={[BODY_R, Math.max(0.01, BODY_H - BODY_R * 2), 4, 8]} />
      <meshLambertMaterial color="#d98f3c" />
    </mesh>
  )
}

/** Drag to orbit, wheel to zoom. The current view is published back so it can be written down. */
function Rig({ yaw, pitch, dist, eye, target, onView }: {
  yaw: number; pitch: number; dist: number; eye: boolean; target: THREE.Vector3
  onView: (v: { yaw: number; pitch: number; dist: number }) => void
}) {
  const { camera, gl } = useThree()
  const state = useRef({ yaw, pitch, dist, eye, dragging: false, lx: 0, ly: 0 })
  useEffect(() => {
    state.current.yaw = yaw; state.current.pitch = pitch; state.current.dist = dist; state.current.eye = eye
  }, [yaw, pitch, dist, eye])

  useEffect(() => {
    const el = gl.domElement
    const apply = () => {
      const s = state.current
      if (s.eye) {
        // ── ★★ STANDING ON THE PAD, NOT ORBITING CLOSE TO IT ────────────────────────────────
        // The orbit's height is `target.y + sin(pitch) * dist` — it is a function of the DISTANCE,
        // so backing off to see a whole house also lifts you off the ground. This is the other
        // question, and it is the one Alex asked the worktable for: *what does the thing I just
        // built look like to somebody standing in front of it.* Height comes from the pad and
        // `EYE_STAND`; `dist` only says how far back the keeper is standing; the look is LEVEL.
        //
        // ⚠ CLAMPED TO THE PAD. `dist` runs to 300 and the pad is 24 across, so an unclamped
        // stance walks off the edge and hangs in the void — which still RENDERS, and reads as a
        // low orbit rather than as a keeper. Stand at the edge instead and stay honest.
        const back = Math.min(s.dist, PAD / 2 - 1)
        camera.position.set(
          target.x + Math.cos(s.yaw) * back,
          PAD_TOP + EYE_STAND,
          target.z + Math.sin(s.yaw) * back)
        camera.lookAt(target.x, PAD_TOP + EYE_STAND, target.z)
        return
      }
      const cp = Math.cos(s.pitch), sp = Math.sin(s.pitch)
      camera.position.set(
        target.x + Math.cos(s.yaw) * cp * s.dist,
        target.y + sp * s.dist,
        target.z + Math.sin(s.yaw) * cp * s.dist)
      camera.lookAt(target)
    }
    apply()
    // ⚠ Only a drag with the middle button or with space/right held orbits; a plain left drag must
    // stay available for placing blocks, or building becomes impossible the moment you want to aim.
    const down = (e: PointerEvent) => {
      if (e.button !== 1 && e.button !== 2) return
      state.current.dragging = true; state.current.lx = e.clientX; state.current.ly = e.clientY
    }
    const move = (e: PointerEvent) => {
      const s = state.current
      if (!s.dragging) return
      s.yaw += (e.clientX - s.lx) * 0.006
      // Clamped short of the poles: straight down gives `lookAt` an ambiguous up vector and the view rolls.
      s.pitch = Math.max(-1.45, Math.min(1.45, s.pitch + (e.clientY - s.ly) * 0.006))
      s.lx = e.clientX; s.ly = e.clientY
      apply(); onView({ yaw: s.yaw, pitch: s.pitch, dist: s.dist })
    }
    const up = () => { state.current.dragging = false }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = state.current
      s.dist = Math.max(4, Math.min(300, s.dist * (e.deltaY > 0 ? 1.1 : 0.9)))
      apply(); onView({ yaw: s.yaw, pitch: s.pitch, dist: s.dist })
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [camera, gl, target.x, target.y, target.z, eye, onView])
  return null
}

export default function WorktablePage() {
  const [cells, setCells] = useState<Cells>(new Map())
  const [material, setMaterial] = useState<number>(MAT.CUT_STONE)
  /** What a click places. Blocks build the mass; pieces are the vocabulary that makes it a building. */
  const [mode, setMode] = useState<'block' | 'piece'>('block')
  const [pieceId, setPieceId] = useState<string>('doorway')
  const [rot, setRot] = useState<Rotation>(0)
  const [placements, setPlacements] = useState<BlueprintPiece[]>([])
  const [id, setId] = useState('untitled')
  const [name, setName] = useState('Untitled')
  const [list, setList] = useState<{ id: string; name: string; w: number; h: number; d: number; blocks: number; error?: string }[]>([])
  const [status, setStatus] = useState('')
  const [fog, setFog] = useState(true)
  const [hour, setHour] = useState(12)
  const [showKeeper, setShowKeeper] = useState(true)
  const [eye, setEye] = useState(false)
  const [view, setView] = useState({ yaw: -0.9, pitch: 0.5, dist: 34 })
  /** Which palette families are expanded. Seeded from `FAMILY`, then the keeper's own choice. */
  const [open, setOpen] = useState<Record<string, boolean>>({})
  /**
   * Undo stack of whole EDITS — blocks and pieces together. Authoring at this scale is thousands of
   * cells, not millions, so a full snapshot is cheaper than a command log and cannot drift from it.
   * ⚠ Both collections, because undoing a door and leaving the wall it punched is not an undo.
   */
  const undo = useRef<{ cells: Cells; placements: BlueprintPiece[] }[]>([])

  useEffect(() => { setTimePin(hour) }, [hour])

  const refresh = useCallback(async () => {
    const r = await fetch('/shimmer/save-blueprint').then(x => x.json()).catch(() => null)
    // ⚠⚠ THE KEY IS `blueprints` AND READING THE WRONG ONE FAILS IN COMPLETE SILENCE. This said
    // `r?.structures` for an hour after the rename: the route answered correctly, the file was on
    // disk, the save status line said "saved", and the list rendered "none yet" forever. `fetch`
    // returns `any`, so the type system cannot see it; both halves were internally consistent about
    // different things. Found by CLICKING — no assert and no screenshot of a first frame could ask
    // the question. `blueprints.test.ts` now compares the route's response key against this read.
    if (r?.blueprints) setList(r.blueprints)
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  const push = (next: Cells, nextPieces: BlueprintPiece[] = placements) => {
    undo.current.push({ cells: new Map(cells), placements })
    if (undo.current.length > 100) undo.current.shift()
    setCells(next)
    setPlacements(nextPieces)
  }

  const onHit = useCallback((e: { point: THREE.Vector3; normal: THREE.Vector3; shift: boolean; alt: boolean }) => {
    // ★ ONE RULE FOR THE PAD AND FOR EVERY BLOCK: step half a cell along the hit normal to place,
    // against it to remove. The pad is a real box for exactly this reason — a ground PLANE would
    // have needed its own branch, and a second placement rule is a second set of off-by-ones.
    const removing = e.shift || e.alt
    const p = e.point.clone().add(e.normal.clone().multiplyScalar(removing ? -0.5 : 0.5))
    const c = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) }
    if (c.y < 0) return                                   // the pad itself is not editable
    if (c.x < 0 || c.z < 0 || c.x >= PAD || c.z >= PAD) return
    if (mode === 'piece') {
      // ⚠ REMOVING A PIECE ASKS ITS FOOTPRINT, NOT ITS ORIGIN. A doorway is three cells tall and you
      // will click the middle of it — matching only the origin means the lintel deletes and the hole
      // does not, which reads as a broken editor rather than a missed click.
      if (removing) {
        const hit = placements.filter(p => !pieceFootprint(p).some(fc => fc.x === c.x && fc.y === c.y && fc.z === c.z))
        push(new Map(cells), hit)
      } else {
        push(new Map(cells), [...placements, { pieceId, x: c.x, y: c.y, z: c.z, rot }])
      }
      return
    }
    const next = new Map(cells)
    if (removing) next.delete(key(c.x, c.y, c.z))
    else next.set(key(c.x, c.y, c.z), material)
    push(next)
  }, [cells, material, mode, pieceId, rot, placements])

  const asCells = useMemo((): BlueprintCell[] =>
    [...cells.entries()].map(([k, m]) => ({ ...unkey(k), m })), [cells])

  const byMaterial = useMemo(() => {
    const g = new Map<number, BlueprintCell[]>()
    for (const c of asCells) {
      const a = g.get(c.m); if (a) a.push(c); else g.set(c.m, [c])
    }
    return [...g.entries()].sort((a, b) => a[0] - b[0])
  }, [asCells])

  const tex = useTiles(useMemo(() => [...new Set(asCells.map(c => c.m))].sort((a, b) => a - b), [asCells]))
  // ★ Bounds of the NORMALIZED cells — the same function `makeBlueprint` will use when it saves,
  // so the size on the panel is the size in the file rather than a second measurement of it.
  const bounds = useMemo(() => boundsOf(normalizeCells(asCells), placements), [asCells, placements])

  const save = async () => {
    const s = makeBlueprint(id.trim(), name.trim() || id.trim(), asCells, placements)
    const r = await fetch('/shimmer/save-blueprint', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
    }).then(x => x.json()).catch(e => ({ error: String(e) }))
    // ⚠ THE REASONS ARE PRINTED VERBATIM. `blueprintProblems` returns sentences naming what is wrong;
    // collapsing them into "save failed" is what makes an author guess.
    setStatus(r?.ok ? `saved ${r.id} — ${r.blocks} blocks` : `SAVE REFUSED: ${(r?.problems ?? [r?.error]).join(' · ')}`)
    if (r?.ok) void refresh()
  }

  const load = async (which: string) => {
    const s: BlueprintDef | { error: string } = await fetch(`/shimmer/save-blueprint?id=${which}`).then(x => x.json())
    if ('error' in s) { setStatus(`LOAD FAILED: ${s.error}`); return }
    const m: Cells = new Map()
    for (const c of blueprintCells(s)) m.set(key(c.x, c.y, c.z), c.m)
    push(m, s.pieces ?? []); setId(s.id); setName(s.name)
    setStatus(`loaded ${s.id} — ${m.size} blocks, ${(s.pieces ?? []).length} pieces`)
  }

  /** ★ The blueprint's own blocks, as the "is this solid?" the fence arms ask. */
  const solid = useCallback((x: number, y: number, z: number) => cells.has(key(x, y, z)), [cells])

  const target = useMemo(
    () => new THREE.Vector3(PAD / 2, Math.min(8, Math.max(2, bounds.h / 2)), PAD / 2),
    [bounds.h])

  const label = (m: number) => blockDef(m)?.name ?? `#${m}`

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0f14', color: '#dfe7ee',
                  font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace' }}>
      <Canvas camera={{ fov: 55, near: 0.1, far: 800 }} onContextMenu={e => e.preventDefault()}>
        <VoxelDayNight />
        {/* ★ FOG OFF IS FOG PUSHED AWAY, not fog unmounted — the same move `dev/court:398` makes.
            `VoxelDayNight` owns the world's fog and a second way to disable it would be a second
            dialect of the same switch. */}
        {!fog && <fog attach="fog" args={[DAY.bg, 5000, 6000]} />}
        <Rig yaw={view.yaw} pitch={view.pitch} dist={view.dist} eye={eye} target={target} onView={setView} />
        <Pad onHit={onHit} />
        {byMaterial.map(([mat, list]) => (
          <MaterialMesh key={mat} mat={mat} cells={list} tex={tex} onHit={onHit} />
        ))}
        <Pieces placements={placements} solid={solid} />
        {showKeeper && <Keeper at={[PAD / 2 - 3, PAD_TOP, PAD / 2 + 4]} />}
      </Canvas>

      {/* ── the panel ─────────────────────────────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 8, left: 8, width: 300, maxHeight: 'calc(100vh - 16px)',
                    overflowY: 'auto', background: 'rgba(8,12,16,0.86)', border: '1px solid rgba(150,180,210,0.22)',
                    borderRadius: 6, padding: '9px 11px' }}>
        <div style={{ textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.6, fontSize: 10 }}>
          structure worktable
        </div>
        <div style={{ margin: '4px 0 8px', opacity: 0.8 }}>
          {cells.size} blocks · {placements.length} pieces · {bounds.w}x{bounds.h}x{bounds.d}
          {(bounds.w > BLUEPRINT_MAX_SPAN || bounds.h > BLUEPRINT_MAX_SPAN || bounds.d > BLUEPRINT_MAX_SPAN) &&
            <span style={{ color: '#ff9b8a' }}> · OVER THE SPAN CEILING</span>}
        </div>

        <div style={{ opacity: 0.65, fontSize: 11, marginBottom: 6 }}>
          click to place · shift-click or right-click to remove · middle/right-drag to orbit · wheel to zoom
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input value={id} onChange={e => setId(e.target.value)} placeholder="id"
                 style={inputStyle} />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="name"
                 style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <button style={btn} onClick={save}>save</button>
          <button style={btn} onClick={() => { const p = undo.current.pop(); if (p) { setCells(p.cells); setPlacements(p.placements) } }}>undo</button>
          <button style={btn} onClick={() => push(new Map(), [])}>clear</button>
          <button style={btn} onClick={() => setFog(f => !f)}>fog {fog ? 'on' : 'off'}</button>
          <button style={btn} onClick={() => setShowKeeper(k => !k)}>keeper</button>
          <button style={btn} onClick={() => setEye(e => !e)}>{eye ? 'keeper eye' : 'from above'}</button>
        </div>
        <label style={{ display: 'block', opacity: 0.7, marginBottom: 8 }}>
          hour {hour}
          <input type="range" min={0} max={23} value={hour} onChange={e => setHour(Number(e.target.value))}
                 style={{ width: '100%' }} />
        </label>

        {status && <div style={{ marginBottom: 8, color: /REFUSED|FAILED/.test(status) ? '#ff9b8a' : '#9bd88a' }}>{status}</div>}

        {/* ★★ SAVED STRUCTURES COME FIRST, AND THE ORDER IS THE FIX. The palette is 65 blocks; below
            it, the load half of "view and edit" sat off the bottom of the viewport. `blueprints.test.ts`
            asserts this section appears BEFORE the palette in the source, so the burial cannot return. */}
        <div style={{ textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.6, fontSize: 10, margin: '8px 0 4px' }}>
          saved structures
        </div>
        {list.length === 0 && <div style={{ opacity: 0.5, marginBottom: 6 }}>none yet — build something and save it</div>}
        <div style={{ maxHeight: 132, overflowY: 'auto', marginBottom: 4 }}>
          {list.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
              <button style={{ ...btn, flex: 1, textAlign: 'left' }} onClick={() => void load(s.id)}>
                {s.name} <span style={{ opacity: 0.5 }}>{s.w}x{s.h}x{s.d}</span>
              </button>
              {s.error && <span style={{ color: '#ff9b8a' }} title={s.error}>broken</span>}
            </div>
          ))}
        </div>

        {/* ★★ WHAT A CLICK PLACES. Blocks are the mass; the 14 pieces are the building vocabulary —
            without them a blueprint is a box with a hole where a door goes. */}
        <div style={{ display: 'flex', gap: 4, margin: '10px 0 6px' }}>
          {(['block', 'piece'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ ...btn, flex: 1, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10,
                       borderColor: mode === m ? '#ffcf8a' : 'rgba(150,180,210,0.25)',
                       color: mode === m ? '#ffcf8a' : '#cfd8e0' }}>
              {m}s
            </button>
          ))}
        </div>

        {mode === 'piece' && (
          <>
            <div style={{ textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.6, fontSize: 10, margin: '4px 0' }}>
              piece — <span style={{ color: '#ffcf8a' }}>{pieceId}</span>
              {/* ⚠ Rotation is a FACING, not a cosmetic: a doorway rotated wrong opens into a wall. */}
              <button onClick={() => setRot(((rot + 1) % 4) as Rotation)}
                style={{ ...btn, float: 'right', fontSize: 10, padding: '1px 6px' }}>rot {rot} ↻</button>
            </div>
            <div style={{ maxHeight: '32vh', overflowY: 'auto', display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)', gap: 3, marginBottom: 6 }}>
              {/* ★ Straight off `PIECES` — the base vocabulary, derived, never a list retyped here.
                  Material variants (`ALL_PIECES`) are deliberately not offered yet: they multiply the
                  palette by the wood/stone families and nobody has asked to build in a second timber. */}
              {PIECES.map(p => (
                <button key={p.id} onClick={() => setPieceId(p.id)} title={`${p.id} ${p.w}x${p.h}x${p.d}`}
                  style={{ ...btn, textAlign: 'left', fontSize: 10, overflow: 'hidden',
                           textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                           borderColor: p.id === pieceId ? '#ffcf8a' : 'rgba(150,180,210,0.25)',
                           color: p.id === pieceId ? '#ffcf8a' : '#cfd8e0' }}>
                  {p.id}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.6, fontSize: 10, margin: '10px 0 4px' }}>
          material — <span style={{ color: '#ffcf8a' }}>{label(material)}</span>
        </div>
        {/* ⚠ ITS OWN SCROLL BOX WITH A BOUNDED HEIGHT. The palette grows every time a block is added,
            and an unbounded list pushes whatever follows it out of reach — which is exactly what it
            did. Bounding it here means a new block costs scrolling inside this box and nothing else. */}
        <div style={{ maxHeight: '38vh', overflowY: 'auto', paddingRight: 2 }}>
          {FAMILY.map(fam => {
            const mine = PALETTE.filter(m => familyOf(m) === fam.key)
            if (!mine.length) return null
            // ★ Full cubes before slabs, and a slab is identified by the SHIPPED predicate rather
            // than by its name ending in " Slab" — a textual reader of someone else's naming rule
            // is a standing claim about a file it does not own.
            const sorted = [...mine].sort((a, b) => Number(isHalfMat(a)) - Number(isHalfMat(b)) || a - b)
            const isOpen = open[fam.label] ?? fam.open
            return (
              <div key={fam.label} style={{ marginBottom: 5 }}>
                <button
                  onClick={() => setOpen(o => ({ ...o, [fam.label]: !isOpen }))}
                  style={{ ...btn, width: '100%', textAlign: 'left', fontSize: 10, opacity: 0.85 }}>
                  {isOpen ? '▾' : '▸'} {fam.label} <span style={{ opacity: 0.5 }}>{sorted.length}</span>
                </button>
                {isOpen && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3, marginTop: 3 }}>
                    {sorted.map(m => (
                      <button key={m} onClick={() => setMaterial(m)} title={`${label(m)} (${m})`}
                        style={{ ...btn, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis',
                                 whiteSpace: 'nowrap', fontSize: 10,
                                 borderColor: m === material ? '#ffcf8a' : 'rgba(150,180,210,0.25)',
                                 color: m === material ? '#ffcf8a' : '#cfd8e0' }}>
                        {label(m)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 10, opacity: 0.45, fontSize: 10 }}>
          view: yaw {view.yaw.toFixed(2)} · pitch {view.pitch.toFixed(2)} · dist {view.dist.toFixed(0)}
        </div>
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  background: 'rgba(30,40,52,0.9)', color: '#cfd8e0', border: '1px solid rgba(150,180,210,0.25)',
  borderRadius: 4, padding: '3px 7px', font: 'inherit', cursor: 'pointer',
}
const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, background: 'rgba(20,28,38,0.9)', color: '#dfe7ee',
  border: '1px solid rgba(150,180,210,0.25)', borderRadius: 4, padding: '3px 6px', font: 'inherit',
}
