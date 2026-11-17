'use client'
// THE WORKSHOP on the home plot: the planning table, the rooms you build from it, and the benches inside them
// (2026-11-17, play / Jin 2 95f19652). Rules in rooms.ts (pure, tested); this is the store, the look and the panels.
//
// How it plays: E at the PLANNING TABLE (beside Gregory) → pick a room → its ghost-blue footprint stands a few metres in
// front of you and follows you; R turns it, E (or Place) sets it, Esc cancels. The logs leave the bag, scaffolding goes
// up, and when it comes down the room stands: walk in, E at the bench.
//
// The page mounts five things (kept small on purpose, page.tsx is the hub's integration surface):
//   useWorks() · workWalls(works) into plotShape · <WorkshopScene pose owned /> in the plot · nearWork() for E ·
//   <WorkshopPanel near owned onClose /> + <PlacingBar /> (and usePlacingKeys()).
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { HearthFrame, HearthButton, H, hearthDisplay } from '../../ui/hearth'
import { getInv, setInv, useInv } from '../shared/bag'
import { countOf, itemDef, makeBait, BAIT_FROM } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import { GROUND_Y } from './plot'
import {
  ROOMS, ROOM_ORDER, TABLE, canPlace, place, raised, progress, wallsOf, benchOf, footprint, loadWorks, saveWorks,
  WALL_H, type Works, type Room, type RoomKind, type WorkNear,
} from './rooms'

// ── the store ─────────────────────────────────────────────────────────────────────────────────────────────────
let works: Works | null = null
const SERVER: Works = { v: 1, rooms: [] }
const subs = new Set<() => void>()
const getW = (): Works => { if (!works) works = typeof window === 'undefined' ? SERVER : loadWorks(); return works }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export function setWorks(w: Works) { works = w; saveWorks(w); subs.forEach(f => f()) }
export const useWorks = () => useSyncExternalStore(subscribe, getW, () => SERVER)
/** Every room's walls, for the walker's plotShape. */
export const workWalls = (w: Works) => w.rooms.flatMap(wallsOf)

// placing: which room, its turn, and where the ghost stands now (set by the scene each frame)
type Placing = { kind: RoomKind; q: number } | null
let placing: Placing = null
const ghost = { x: 0, z: 0 }
const psubs = new Set<() => void>()
const setPlacing = (p: Placing) => { placing = p; psubs.forEach(f => f()) }
export const usePlacing = () => useSyncExternalStore(f => { psubs.add(f); return () => { psubs.delete(f) } }, () => placing, () => null)
export const isPlacing = () => placing !== null

/** Confirm the ghost where it stands. */
function confirmPlace(owned: ReadonlySet<string>) {
  if (!placing) return
  const r = place(getW(), owned, getInv(), placing.kind, ghost.x, ghost.z, placing.q)
  if (!r) { const v = canPlace(getW(), owned, placing.kind, ghost.x, ghost.z, placing.q, getInv()); hudSay(v.ok ? 'Cannot build there.' : v.why, 'info'); return }
  setInv(r.inv); setWorks(r.works); setPlacing(null)
  hudSay(`${ROOMS[r.room.kind].name} · the scaffolding is up. It stands in ${Math.round(ROOMS[r.room.kind].raiseMs / 1000)} s.`, 'item', 5)
}

/** While placing: R turns, E / Enter sets, Esc cancels. Capture phase, so the page's own E never sees these keys. */
export function usePlacingKeys(owned: ReadonlySet<string>) {
  const p = usePlacing()
  const ownedRef = useRef(owned); ownedRef.current = owned
  useEffect(() => {
    if (!p) return
    const down = (e: KeyboardEvent) => {
      if (!placing) return
      if (e.code === 'KeyR') setPlacing({ ...placing, q: (placing.q + 1) % 4 })
      else if (e.code === 'KeyE' || e.code === 'Enter') confirmPlace(ownedRef.current)
      else if (e.code === 'Escape') setPlacing(null)
      else return
      e.preventDefault(); e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', down, true)
    return () => window.removeEventListener('keydown', down, true)
  }, [p])
}

// ── the scene ─────────────────────────────────────────────────────────────────────────────────────────────────
const WOOD = '#8f6038', WALL = '#d8b46e', ROOF = '#7a4a2a', SHEET = '#5aa9ff'
const GHOST_OK = '#5aa9ff', GHOST_BAD = '#ff6a5a'
type Pose = { x: number; z: number; yaw: number }

export function WorkshopScene({ pose, owned }: { pose: React.MutableRefObject<Pose>; owned: ReadonlySet<string> }) {
  const w = useWorks(), p = usePlacing()
  // a raising room re-renders once a second until it stands
  const [, tick] = useState(0)
  const anyRaising = w.rooms.some(r => !raised(r))
  useEffect(() => { if (!anyRaising) return; const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t) }, [anyRaising])
  return (
    <>
      <PlanningTable />
      {w.rooms.map(r => (raised(r) ? <RoomMesh key={r.id} r={r} /> : <Scaffold key={r.id} r={r} />))}
      {p && <Ghost pose={pose} owned={owned} kind={p.kind} q={p.q} />}
    </>
  )
}

function PlanningTable() {
  const y = GROUND_Y
  return (
    <group position={[TABLE.x, y, TABLE.z]}>
      <mesh position-y={0.95}><boxGeometry args={[2.2, 0.12, 1.3]} /><meshLambertMaterial color={WOOD} /></mesh>
      {[[-1, -0.55], [1, -0.55], [-1, 0.55], [1, 0.55]].map(([x, z], k) => <mesh key={k} position={[x, 0.45, z]}><boxGeometry args={[0.12, 0.9, 0.12]} /><meshLambertMaterial color={WOOD} /></mesh>)}
      {/* the plan sheet: the ghost-blue of a room not built yet */}
      <mesh position-y={1.02} rotation-x={-Math.PI / 2}><planeGeometry args={[1.7, 1]} /><meshBasicMaterial color={SHEET} /></mesh>
      <mesh position={[0.2, 1.03, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.18, 0.24, 4]} /><meshBasicMaterial color="#e8f3ff" /></mesh>
    </group>
  )
}

/** The room as it stands: its walls (the same boxes the walker hits), a floor, a roof, the bench. */
function RoomMesh({ r }: { r: Room }) {
  const walls = useMemo(() => wallsOf(r), [r])
  const f = footprint(r.kind, r.x, r.z, r.q), b = benchOf(r)
  const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2, sx = f.x1 - f.x0, sz = f.z1 - f.z0
  return (
    <group>
      <mesh position={[cx, GROUND_Y + 0.04, cz]}><boxGeometry args={[sx, 0.08, sz]} /><meshLambertMaterial color="#b98d5a" /></mesh>
      {walls.map((k, i) => (
        <mesh key={i} position={[(k.x0 + k.x1) / 2, GROUND_Y + WALL_H / 2, (k.z0 + k.z1) / 2]}>
          <boxGeometry args={[k.x1 - k.x0, WALL_H, k.z1 - k.z0]} /><meshLambertMaterial color={WALL} />
        </mesh>
      ))}
      <mesh position={[cx, GROUND_Y + WALL_H + 0.12, cz]}><boxGeometry args={[sx + 0.8, 0.24, sz + 0.8]} /><meshLambertMaterial color={ROOF} /></mesh>
      <mesh position={[cx, GROUND_Y + WALL_H + 0.7, cz]}><boxGeometry args={[sx * 0.6, 0.9, sz * 0.6]} /><meshLambertMaterial color={ROOF} /></mesh>
      <Bench r={r} x={b.x} z={b.z} />
    </group>
  )
}
function Bench({ r, x, z }: { r: Room; x: number; z: number }) {
  return (
    <group position={[x, GROUND_Y, z]} rotation-y={-r.q * Math.PI / 2}>
      <mesh position-y={0.5}><boxGeometry args={[2.4, 1, 0.8]} /><meshLambertMaterial color={WOOD} /></mesh>
      {r.kind === 'rinnshop' && (
        <>
          {/* a rinstick on its rack and a crate of the day's catch */}
          <mesh position={[-0.7, 1.35, 0.25]} rotation-z={0.5}><cylinderGeometry args={[0.03, 0.04, 1.6, 6]} /><meshLambertMaterial color="#6b4a2a" /></mesh>
          <mesh position={[0.6, 1.15, 0]}><boxGeometry args={[0.7, 0.3, 0.5]} /><meshLambertMaterial color="#6fbfb5" /></mesh>
        </>
      )}
    </group>
  )
}

/** Scaffolding: four poles, rails at each storey, and the walls rising inside them as the job goes on. */
function Scaffold({ r }: { r: Room }) {
  const f = footprint(r.kind, r.x, r.z, r.q), walls = useMemo(() => wallsOf(r), [r])
  const rise = useRef<THREE.Group>(null)
  useFrame(() => { if (rise.current) rise.current.scale.y = Math.max(0.02, progress(r)) })
  const poles = [[f.x0, f.z0], [f.x1, f.z0], [f.x0, f.z1], [f.x1, f.z1]]
  const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2, sx = f.x1 - f.x0, sz = f.z1 - f.z0
  return (
    <group>
      {poles.map(([x, z], k) => <mesh key={k} position={[x, GROUND_Y + 2, z]}><cylinderGeometry args={[0.08, 0.08, 4, 6]} /><meshLambertMaterial color="#a77b4a" /></mesh>)}
      {[1.2, 2.6, 3.9].map(h => (
        <group key={h}>
          <mesh position={[cx, GROUND_Y + h, f.z0]}><boxGeometry args={[sx, 0.08, 0.08]} /><meshLambertMaterial color="#a77b4a" /></mesh>
          <mesh position={[cx, GROUND_Y + h, f.z1]}><boxGeometry args={[sx, 0.08, 0.08]} /><meshLambertMaterial color="#a77b4a" /></mesh>
          <mesh position={[f.x0, GROUND_Y + h, cz]}><boxGeometry args={[0.08, 0.08, sz]} /><meshLambertMaterial color="#a77b4a" /></mesh>
          <mesh position={[f.x1, GROUND_Y + h, cz]}><boxGeometry args={[0.08, 0.08, sz]} /><meshLambertMaterial color="#a77b4a" /></mesh>
        </group>
      ))}
      <group ref={rise} position-y={GROUND_Y}>
        {walls.map((k, i) => (
          <mesh key={i} position={[(k.x0 + k.x1) / 2, WALL_H / 2, (k.z0 + k.z1) / 2]}>
            <boxGeometry args={[k.x1 - k.x0, WALL_H, k.z1 - k.z0]} /><meshLambertMaterial color={WALL} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** The ghost: the footprint a few metres ahead of the keeper, snapped to the metre; blue where it can stand, red not. */
function Ghost({ pose, owned, kind, q }: { pose: React.MutableRefObject<Pose>; owned: ReadonlySet<string>; kind: RoomKind; q: number }) {
  const g = useRef<THREE.Group>(null), mat = useRef<THREE.MeshBasicMaterial>(null), edge = useRef<THREE.LineBasicMaterial>(null)
  const def = ROOMS[kind], [w, d] = q % 2 ? [def.d, def.w] : [def.w, def.d]
  const box = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, WALL_H, d)), [w, d])
  useFrame(() => {
    const p = pose.current, ahead = Math.max(w, d) / 2 + 2.5
    ghost.x = Math.round(p.x - Math.sin(p.yaw) * ahead); ghost.z = Math.round(p.z - Math.cos(p.yaw) * ahead)
    g.current?.position.set(ghost.x, GROUND_Y + WALL_H / 2, ghost.z)
    const ok = canPlace(getW(), owned, kind, ghost.x, ghost.z, q, getInv()).ok
    mat.current?.color.set(ok ? GHOST_OK : GHOST_BAD); edge.current?.color.set(ok ? GHOST_OK : GHOST_BAD)
  })
  return (
    <group ref={g}>
      <mesh><boxGeometry args={[w, WALL_H, d]} /><meshBasicMaterial ref={mat} color={GHOST_OK} transparent opacity={0.28} depthWrite={false} /></mesh>
      <lineSegments geometry={box}><lineBasicMaterial ref={edge} color={GHOST_OK} /></lineSegments>
      {/* the door side: a bright bar on the front so you can see which way it faces */}
      <mesh position={q === 0 ? [0, -WALL_H / 2 + 0.1, -d / 2] : q === 1 ? [w / 2, -WALL_H / 2 + 0.1, 0] : q === 2 ? [0, -WALL_H / 2 + 0.1, d / 2] : [-w / 2, -WALL_H / 2 + 0.1, 0]}>
        <boxGeometry args={[q % 2 ? 0.3 : 2.2, 0.2, q % 2 ? 2.2 : 0.3]} /><meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

// ── prompts + panels ──────────────────────────────────────────────────────────────────────────────────────────
export function workPrompt(n: WorkNear): string {
  if (n.kind === 'table') return 'E · the planning table'
  if (n.kind === 'raising') return `${ROOMS[n.room.kind].name} · going up (${Math.round(progress(n.room) * 100)}%)`
  return `E · the ${ROOMS[n.room.kind].name}`
}

const lab: React.CSSProperties = { color: H.inkSoft, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }

export function WorkshopPanel({ near, owned, onClose }: { near: WorkNear; owned: ReadonlySet<string>; onClose: () => void }) {
  if (near.kind === 'table') return <TablePanel owned={owned} onClose={onClose} />
  if (near.kind === 'bench') return <BenchPanel room={near.room} onClose={onClose} />
  return null
}

function TablePanel({ owned, onClose }: { owned: ReadonlySet<string>; onClose: () => void }) {
  const inv = useInv(), w = useWorks()
  return (
    <HearthFrame title="The planning table" maxWidth={560} onClose={onClose} fixed dataPanel="planning-table">
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, color: H.inkSoft }}>Plan a room, then set it on your ground. The logs go when you place it.</div>
        {ROOM_ORDER.map(k => {
          const def = ROOMS[k], built = w.rooms.find(r => r.kind === k)
          const short = def.cost.find(c => countOf(inv, c.id) < c.n)
          return (
            <div key={k} data-room={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}`, opacity: def.open ? 1 : 0.6 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...hearthDisplay, fontSize: 16, fontWeight: 600, color: H.ink }}>{def.name}</div>
                <div style={{ fontSize: 12.5, color: H.inkSoft, lineHeight: 1.35 }}>{def.blurb}</div>
                <div style={{ ...lab, marginTop: 4 }}>
                  {def.cost.map(c => `${countOf(inv, c.id)} / ${c.n} ${itemDef(c.id).name}`).join(' · ')} · {def.w}×{def.d} m
                </div>
              </div>
              {built ? <span style={lab}>{raised(built) ? 'Built' : 'Going up'}</span>
                : !def.open ? <span style={lab}>Soon</span>
                : <HearthButton primary disabled={!!short} onClick={() => { setPlacing({ kind: k, q: 0 }); onClose(); hudSay(`Planning the ${def.name} · R turns it · E sets it · Esc cancels`, 'info', 8) }}>Plan</HearthButton>}
            </div>
          )
        })}
        {(() => { const short = ROOMS.rinnshop.cost.find(c => countOf(inv, c.id) < c.n); return short && !w.rooms.some(r => r.kind === 'rinnshop') ? <div style={{ fontSize: 12.5, color: H.inkSoft }}>Prune goldwood in the Wilds for logs.</div> : null })()}
      </div>
    </HearthFrame>
  )
}

function BenchPanel({ room, onClose }: { room: Room; onClose: () => void }) {
  const inv = useInv(), def = ROOMS[room.kind]
  const foods = Object.keys(BAIT_FROM).filter(id => countOf(inv, id) > 0)
  return (
    <HearthFrame title={def.name} maxWidth={520} onClose={onClose} fixed dataPanel="bench">
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 12 }}>
        {room.kind === 'rinnshop' && (
          <>
            <div>
              <div style={lab}>Bait · {countOf(inv, 'bait')} in the bag</div>
              <div style={{ fontSize: 12.5, color: H.inkSoft, margin: '4px 0 8px' }}>An offering the rinn come to. One a cast.</div>
              {foods.length ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  {foods.map(id => (
                    <div key={id} data-bait-from={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 13.5, color: H.ink }}>{itemDef(id).name} <span style={{ color: H.inkSoft }}>× {countOf(inv, id)}</span></span>
                      <HearthButton small onClick={() => { const r = makeBait(getInv(), id); if (r) setInv(r.inv) }}>Make bait +{BAIT_FROM[id]}</HearthButton>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 13, color: H.inkSoft }}>Nothing to cut. A small catch, or mast off a pruned tree, makes bait.</div>}
            </div>
            <div style={{ opacity: 0.6 }}>
              <div style={lab}>Rinsticks · soon</div>
              <div style={{ fontSize: 12.5, color: H.inkSoft, marginTop: 4 }}>Built from rinn: kin calls to kin. The rack is up; the work is not ready yet.</div>
            </div>
          </>
        )}
      </div>
    </HearthFrame>
  )
}

/** On a phone there is no R or Esc: Turn / Place / Cancel while placing. Shown on desktop too (it does no harm). */
export function PlacingBar({ owned }: { owned: ReadonlySet<string> }) {
  const p = usePlacing()
  if (!p) return null
  const btn: React.CSSProperties = { border: 0, borderRadius: 999, padding: '10px 16px', font: '700 13px system-ui', cursor: 'pointer', background: 'rgba(255,250,235,.95)', color: H.ink, boxShadow: '0 2px 8px rgba(0,0,0,.25)' }
  return (
    <div data-placing={p.kind} style={{ position: 'fixed', left: '50%', bottom: 120, transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 40, pointerEvents: 'auto' }}>
      <button type="button" style={btn} onClick={() => setPlacing({ ...p, q: (p.q + 1) % 4 })}>Turn (R)</button>
      <button type="button" data-act="place" style={{ ...btn, background: '#e0823f', color: '#fff' }} onClick={() => confirmPlace(owned)}>Place (E)</button>
      <button type="button" style={btn} onClick={() => setPlacing(null)}>Cancel (Esc)</button>
    </div>
  )
}
