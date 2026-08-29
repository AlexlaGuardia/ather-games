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
import { ALL_BLOCKS, blockDef } from '../../voxel/registry'
import { MAT } from '../../voxel/depth'
import { buildTileArray, sliceLayer, layerOf, TOP, SIDE, BOTTOM } from '../../voxel3d/tex/tiles'
import { VoxelDayNight, DAY } from '../../voxel3d/day-night'
import { setTimePin } from '../../engine/day-cycle'
import { BODY_H, BODY_R } from '../../voxel3d/locomotion'
import {
  makeBlueprint, blueprintCells, boundsOf, normalizeCells, BLUEPRINT_MAX_SPAN,
  type BlueprintCell, type BlueprintDef,
} from '../../voxel/blueprints'

const TILE = 16
/** The build pad, in blocks. Big enough for a cottage and a yard; not a world. */
const PAD = 24

/**
 * The palette, DERIVED. `placeable` is the registry's own answer to "can a player put this down",
 * which is exactly the question a worktable asks. ⚠ A hand-kept list here would be a third dialect
 * of the building vocabulary — `dev/building` keeps one for its 2D board and `pieces.ts` keeps the
 * piece families — and it would go stale silently the day a block is added.
 */
const PALETTE = ALL_BLOCKS.filter(b => b.placeable).map(b => b.material)

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
function Rig({ yaw, pitch, dist, target, onView }: {
  yaw: number; pitch: number; dist: number; target: THREE.Vector3
  onView: (v: { yaw: number; pitch: number; dist: number }) => void
}) {
  const { camera, gl } = useThree()
  const state = useRef({ yaw, pitch, dist, dragging: false, lx: 0, ly: 0 })
  useEffect(() => { state.current.yaw = yaw; state.current.pitch = pitch; state.current.dist = dist }, [yaw, pitch, dist])

  useEffect(() => {
    const el = gl.domElement
    const apply = () => {
      const s = state.current
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
  }, [camera, gl, target.x, target.y, target.z, onView])
  return null
}

export default function WorktablePage() {
  const [cells, setCells] = useState<Cells>(new Map())
  const [material, setMaterial] = useState<number>(MAT.CUT_STONE)
  const [id, setId] = useState('untitled')
  const [name, setName] = useState('Untitled')
  const [list, setList] = useState<{ id: string; name: string; w: number; h: number; d: number; blocks: number; error?: string }[]>([])
  const [status, setStatus] = useState('')
  const [fog, setFog] = useState(true)
  const [hour, setHour] = useState(12)
  const [showKeeper, setShowKeeper] = useState(true)
  const [view, setView] = useState({ yaw: -0.9, pitch: 0.5, dist: 34 })
  /** Undo stack of whole cell maps. Authoring at this scale is thousands of cells, not millions. */
  const undo = useRef<Cells[]>([])

  useEffect(() => { setTimePin(hour) }, [hour])

  const refresh = useCallback(async () => {
    const r = await fetch('/shimmer/save-blueprint').then(x => x.json()).catch(() => null)
    if (r?.structures) setList(r.structures)
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  const push = (next: Cells) => {
    undo.current.push(new Map(cells))
    if (undo.current.length > 100) undo.current.shift()
    setCells(next)
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
    const next = new Map(cells)
    if (removing) next.delete(key(c.x, c.y, c.z))
    else next.set(key(c.x, c.y, c.z), material)
    push(next)
  }, [cells, material])

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
  const bounds = useMemo(() => boundsOf(normalizeCells(asCells)), [asCells])

  const save = async () => {
    const s = makeBlueprint(id.trim(), name.trim() || id.trim(), asCells)
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
    push(m); setId(s.id); setName(s.name)
    setStatus(`loaded ${s.id} — ${m.size} blocks`)
  }

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
        <Rig yaw={view.yaw} pitch={view.pitch} dist={view.dist} target={target} onView={setView} />
        <Pad onHit={onHit} />
        {byMaterial.map(([mat, list]) => (
          <MaterialMesh key={mat} mat={mat} cells={list} tex={tex} onHit={onHit} />
        ))}
        {showKeeper && <Keeper at={[PAD / 2 - 3, 0, PAD / 2 + 4]} />}
      </Canvas>

      {/* ── the panel ─────────────────────────────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 8, left: 8, width: 300, maxHeight: 'calc(100vh - 16px)',
                    overflowY: 'auto', background: 'rgba(8,12,16,0.86)', border: '1px solid rgba(150,180,210,0.22)',
                    borderRadius: 6, padding: '9px 11px' }}>
        <div style={{ textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.6, fontSize: 10 }}>
          structure worktable
        </div>
        <div style={{ margin: '4px 0 8px', opacity: 0.8 }}>
          {cells.size} blocks · {bounds.w}x{bounds.h}x{bounds.d}
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
          <button style={btn} onClick={() => { const p = undo.current.pop(); if (p) setCells(p) }}>undo</button>
          <button style={btn} onClick={() => push(new Map())}>clear</button>
          <button style={btn} onClick={() => setFog(f => !f)}>fog {fog ? 'on' : 'off'}</button>
          <button style={btn} onClick={() => setShowKeeper(k => !k)}>keeper</button>
        </div>
        <label style={{ display: 'block', opacity: 0.7, marginBottom: 8 }}>
          hour {hour}
          <input type="range" min={0} max={23} value={hour} onChange={e => setHour(Number(e.target.value))}
                 style={{ width: '100%' }} />
        </label>

        {status && <div style={{ marginBottom: 8, color: /REFUSED|FAILED/.test(status) ? '#ff9b8a' : '#9bd88a' }}>{status}</div>}

        <div style={{ textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.6, fontSize: 10, margin: '8px 0 4px' }}>
          material — {label(material)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3 }}>
          {PALETTE.map(m => (
            <button key={m} onClick={() => setMaterial(m)} title={`${label(m)} (${m})`}
              style={{ ...btn, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis',
                       whiteSpace: 'nowrap', fontSize: 10,
                       borderColor: m === material ? '#ffcf8a' : 'rgba(150,180,210,0.25)',
                       color: m === material ? '#ffcf8a' : '#cfd8e0' }}>
              {label(m)}
            </button>
          ))}
        </div>

        <div style={{ textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.6, fontSize: 10, margin: '10px 0 4px' }}>
          saved structures
        </div>
        {list.length === 0 && <div style={{ opacity: 0.5 }}>none yet — build something and save it</div>}
        {list.map(s => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
            <button style={{ ...btn, flex: 1, textAlign: 'left' }} onClick={() => void load(s.id)}>
              {s.name} <span style={{ opacity: 0.5 }}>{s.w}x{s.h}x{s.d}</span>
            </button>
            {s.error && <span style={{ color: '#ff9b8a' }} title={s.error}>broken</span>}
          </div>
        ))}

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
