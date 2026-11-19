'use client'
/**
 * THE SETTLEMENT WORKTABLE (BETA M39 slice 2; Alex 11-19: "what im not seeing is the settlement editor"). Draw a Moglin's
 * workshop for a Moonwell Glade lot with the SAME house parts a keeper uses on the plot (walls, doors, windows, paint, roof),
 * on a bare level ground with the lot drawn out (13 x 8 m: the 13.5 x 8.5 pad floored to whole metres; the FRONT edge faces
 * the green). Materials are free and nothing here reads or writes the keeper's save: the canvas IS the blueprint. Save sends
 * it to the same owner route the plan-mode tool uses (/shimmer/save-house-blueprint -> world/house-blueprints/glade-<lot>.json)
 * and the Glade stands it on that lot at the next visit, no deploy. Load pulls a lot's blueprint back to edit. Owner-only
 * (dev/* is proxy-gated). Pure rules: open/ather/plot-walls.ts + plot-blueprint.ts; the drawing: workshop.tsx's renderer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Rig } from '../shelf-rig'
import { DrawnWalls, WallRun } from '../../open/ather/workshop'
import {
  runKeys, snapCorner, pieceAt, roomAt, findRooms, toggleDoor, toggleWindow, paintFloor, edgeEnds,
  WALL_MATS, WALL_MAT_ORDER, ROOF_STYLES, WALL_H, LOW_WALL, type Walls, type Floors, type WallMat, type RoofStyle, type Corner,
} from '../../open/ather/plot-walls'
import { houseProblems, parseHouse, type HouseBlueprint } from '../../open/ather/plot-blueprint'
import { GLADE_LOTS } from '../../open/ather/moonwell-glade'
import { GROUND_Y } from '../../open/ather/plot'   // the renderer draws at the plot's floor; the worktable's floor is y = 0

const LW = 13, LD = 8   // the lot, whole metres (the pad is 13.5 x 8.5)
type Tool = 'walls' | 'erase' | 'door' | 'window' | 'paint'
const chip = (on: boolean): React.CSSProperties => ({ background: on ? '#e8c27a' : '#211f2b', color: on ? '#1b1712' : '#ddd6ea', border: '1px solid #38344a', padding: '5px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' })
const inLot = (k: string) => edgeEnds(k).every(([x, z]) => x >= 0 && z >= 0 && x <= LW && z <= LD)

/** the ground under the pointer (y = 0), page-local: build-mode's pointer is welded to plan mode's lens */
function Pointer({ onStart, onMove, onEnd, enabled }: { onStart: (x: number, z: number) => void; onMove: (x: number, z: number) => void; onEnd: (x: number, z: number) => void; enabled: boolean }) {
  const { gl, camera } = useThree()
  useEffect(() => {
    if (!enabled) return
    const el = gl.domElement, ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3()
    let down = false
    const at = (e: PointerEvent) => { const r = el.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera); return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null }
    // left button draws; the Rig orbits on any drag too, so the worktable stops the Rig only while a draw is live (capture)
    const pd = (e: PointerEvent) => { if (e.button !== 0 || e.shiftKey) return; const g = at(e); if (!g) return; down = true; e.stopImmediatePropagation(); el.setPointerCapture(e.pointerId); onStart(g.x, g.z) }
    const pm = (e: PointerEvent) => { if (!down) return; e.stopImmediatePropagation(); const g = at(e); if (g) onMove(g.x, g.z) }
    const pu = (e: PointerEvent) => { if (!down) return; down = false; e.stopImmediatePropagation(); const g = at(e); if (g) onEnd(g.x, g.z) }
    el.addEventListener('pointerdown', pd, true); el.addEventListener('pointermove', pm, true); el.addEventListener('pointerup', pu, true)
    return () => { el.removeEventListener('pointerdown', pd, true); el.removeEventListener('pointermove', pm, true); el.removeEventListener('pointerup', pu, true) }
  }, [gl, camera, onStart, onMove, onEnd, enabled])
  return null
}

export default function SettlementWorktable() {
  const [walls, setWalls] = useState<Walls>({}), [floors, setFloors] = useState<Floors>({}), [roof, setRoof] = useState<RoofStyle>('gable')
  const [tool, setTool] = useState<Tool>('walls'), [mat, setMat] = useState<WallMat>('goldwood'), [down, setDown] = useState(false)
  const [lot, setLot] = useState('hazel'), [status, setStatus] = useState<Record<string, string>>({}), [msg, setMsg] = useState(''), [confirm, setConfirm] = useState(false)
  const [eye, setEye] = useState(false), [view, setView] = useState({ yaw: Math.PI / 2, pitch: 0.75, dist: 18 })
  const [ghost, setGhost] = useState<{ keys: string[]; erase: boolean } | null>(null)
  const drag = useRef<Corner | null>(null), tapAt = useRef<{ x: number; z: number } | null>(null)
  const target = useMemo(() => new THREE.Vector3(LW / 2, 0.5, LD / 2), [])

  const refreshStatus = useCallback(() => {
    for (const l of GLADE_LOTS) fetch(`/shimmer/open/house-blueprints?id=glade-${l.id}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => {
      const b = j ? parseHouse(j) : null
      setStatus(s => ({ ...s, [l.id]: b ? `blueprint ${b.w} x ${b.d}` : 'blockout' }))
    }).catch(() => {})
  }, [])
  useEffect(() => { refreshStatus() }, [refreshStatus])

  const onStart = useCallback((x: number, z: number) => {
    if (tool === 'walls' || tool === 'erase') { const c = snapCorner(x, z); drag.current = c; setGhost({ keys: [], erase: tool === 'erase' }) } else tapAt.current = { x, z }
  }, [tool])
  const onMove = useCallback((x: number, z: number) => { const a = drag.current; if (!a) return; setGhost({ keys: runKeys(a, snapCorner(x, z)).filter(inLot), erase: tool === 'erase' }) }, [tool])
  const onEnd = useCallback((x: number, z: number) => {
    const a = drag.current; drag.current = null; setGhost(null)
    if (a) {
      const keys = runKeys(a, snapCorner(x, z)).filter(inLot); if (!keys.length) return
      setWalls(w => { const n: Record<string, Walls[string]> = { ...w }; for (const k of keys) { if (tool === 'erase') delete n[k]; else if (!n[k]) n[k] = { mat } } return n })
      return
    }
    const t = tapAt.current; tapAt.current = null; if (!t || Math.hypot(x - t.x, z - t.z) > 1.2) return
    const k = pieceAt(walls, x, z)
    if (tool === 'paint') {
      if (k) { setWalls(w => ({ ...w, [k]: { ...w[k], mat } })); return }
      const room = roomAt(findRooms(walls), x, z); if (room) setFloors(f => paintFloor(f, room, mat)); else setMsg('Tap a wall, or the floor of a closed room.')
      return
    }
    if (!k) { setMsg('Tap a wall.'); return }
    const c = tool === 'door' ? toggleDoor(walls, k) : toggleWindow(walls, k)
    if (c.ok) setWalls(c.walls); else setMsg(c.why)
  }, [tool, mat, walls])

  const blueprint = (): HouseBlueprint => ({ v: 1, id: `glade-${lot}`, name: `${lot[0].toUpperCase()}${lot.slice(1)}'s workshop`, w: LW, d: LD, walls, floors, roof, saved: Date.now() })
  const save = async (force = false) => {
    const bp = blueprint(), why = houseProblems(bp)
    if (why.length) { setMsg(`Not saved: ${why.join('; ')}`); return }
    if (!force && status[lot]?.startsWith('blueprint')) { setConfirm(true); return }
    setConfirm(false)
    const r = await fetch('/shimmer/save-house-blueprint', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ blueprint: bp }) })
    const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? `Saved for ${lot}'s lot. The Glade stands it on your next visit.` : `Not saved: ${j.error ?? r.status}`)
    refreshStatus()
  }
  const load = async () => {
    const r = await fetch(`/shimmer/open/house-blueprints?id=glade-${lot}`, { cache: 'no-store' })
    const b = r.ok ? parseHouse(await r.json()) : null
    if (!b) { setMsg(`${lot}'s lot has no blueprint yet (blockout).`); return }
    setWalls(b.walls); setFloors(b.floors); setRoof(b.roof); setMsg(`Loaded ${b.name} (${b.w} x ${b.d}).`)
  }
  useEffect(() => { (window as unknown as { __worktable?: object }).__worktable = { walls: () => Object.keys(walls).length, rooms: () => findRooms(walls).length, status: () => status } }, [walls, status])

  const pieces = Object.keys(walls).length
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#14131a', color: '#ddd6ea' }}>
      <header style={{ padding: '10px 14px', borderBottom: '1px solid #2c2a38', display: 'grid', gap: 8 }}>
        <h1 className="gx-title" style={{ margin: 0, fontSize: 15, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e8e3d8' }}>The Settlement Worktable</h1>
        <p style={{ margin: 0, fontSize: 12, color: '#9a94a8', maxWidth: 820, lineHeight: 1.5 }}>Draw a Moglin's workshop for a Moonwell Glade lot with the keeper's own house parts. Free wood, nothing touches your save. The front edge faces the green. Save and it stands on that lot at your next Glade visit.</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} data-wt-tools>
          {(['walls', 'erase', 'door', 'window', 'paint'] as Tool[]).map(t => <button key={t} data-tool={t} style={chip(tool === t)} onClick={() => setTool(t)}>{t}</button>)}
          <span style={{ width: 8 }} />
          {WALL_MAT_ORDER.map(m => <button key={m} data-wood={m} style={{ ...chip(mat === m), display: 'flex', gap: 5, alignItems: 'center' }} onClick={() => setMat(m)}><i style={{ width: 12, height: 12, background: WALL_MATS[m].color, display: 'inline-block' }} />{WALL_MATS[m].name}</button>)}
          <span style={{ width: 8 }} />
          {ROOF_STYLES.map(r => <button key={r} data-roof={r} style={chip(roof === r)} onClick={() => setRoof(r)}>{r}</button>)}
          <button data-act="walls-down" style={chip(down)} onClick={() => setDown(d => !d)}>{down ? 'walls up' : 'walls down'}</button>
          <button data-eye style={chip(eye)} onClick={() => setEye(e => !e)}>{eye ? 'keeper eye' : 'orbit'}</button>
          <button data-act="new" style={chip(false)} onClick={() => { setWalls({}); setFloors({}); setMsg('A clean lot.') }}>new</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
          <label>For <select id="wt-lot" data-wt-lot value={lot} onChange={e => { setLot(e.target.value); setConfirm(false) }} style={{ font: 'inherit' }}>{GLADE_LOTS.map(l => <option key={l.id} value={l.id}>{l.id}</option>)}</select></label>
          <button data-act="load" style={chip(false)} onClick={load}>load</button>
          <button data-act="save" style={chip(true)} onClick={() => save(false)} disabled={!pieces}>save blueprint</button>
          {confirm && <span data-wt-confirm style={{ color: '#f0b36a' }}>{lot}'s lot already has your blueprint. <button data-act="save-over" style={chip(true)} onClick={() => save(true)}>replace it</button> <button style={chip(false)} onClick={() => setConfirm(false)}>keep it</button></span>}
          <span data-wt-msg style={{ color: '#9a94a8' }}>{msg || `${pieces} pieces · ${findRooms(walls).length} rooms`}</span>
        </div>
        <div data-wt-status style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: '#9a94a8' }}>
          {GLADE_LOTS.map(l => <span key={l.id} data-lot={l.id}>{l.id}: <b style={{ color: status[l.id]?.startsWith('blueprint') ? '#9fd28b' : '#9a94a8' }}>{status[l.id] ?? '...'}</b></span>)}
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0 }} data-bench="worktable">
        <Canvas shadows camera={{ position: [LW / 2, 14, LD + 12], fov: 45 }}>
          <color attach="background" args={['#cfe3ef']} />
          <hemisphereLight args={['#cfe3ef', '#7d9455', 0.9]} />
          <directionalLight position={[-8, 18, 10]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
          <mesh rotation-x={-Math.PI / 2} position={[LW / 2, -0.01, LD / 2]} receiveShadow><planeGeometry args={[60, 60]} /><meshLambertMaterial color="#86b25e" /></mesh>
          <mesh rotation-x={-Math.PI / 2} position={[LW / 2, 0.005, LD / 2]}><planeGeometry args={[LW, LD]} /><meshLambertMaterial color="#cdb88e" /></mesh>
          <gridHelper args={[LW, LW, '#8c7a58', '#a8946e']} position={[LW / 2, 0.012, LD / 2]} scale={[1, 1, LD / LW]} />
          {/* the front edge: faces the green */}
          <mesh position={[LW / 2, 0.03, -0.25]}><boxGeometry args={[LW, 0.06, 0.5]} /><meshLambertMaterial color="#e8c27a" /></mesh>
          <group position={[0, -GROUND_Y, 0]}><DrawnWalls walls={walls} roof={roof} floors={floors} probe={false} down={down} /></group>
          {ghost && ghost.keys.length > 0 && <group position={[0, -GROUND_Y, 0]}><WallRun mat={mat} keys={ghost.keys} ghost={ghost.erase ? '#ff5a4a' : '#5aa0ff'} h={down ? LOW_WALL : WALL_H} /></group>}
          <Rig target={target} view={view} eye={eye} onView={setView} />
          <Pointer onStart={onStart} onMove={onMove} onEnd={onEnd} enabled />
        </Canvas>
      </div>
      <footer style={{ padding: '6px 14px', fontSize: 11, color: '#7f7a8c', borderTop: '1px solid #2c2a38' }}>Left-drag draws (Walls / Erase) or taps (Door / Window / Paint). Shift-drag or right-drag turns the view, wheel zooms. The gold strip is the front: it faces the green.</footer>
    </div>
  )
}
