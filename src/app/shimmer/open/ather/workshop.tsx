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
import { HearthFrame, HearthButton, Well, H, hearthDisplay } from '../../ui/hearth'
import { getInv, setInv, useInv } from '../shared/bag'
import { countOf, itemDef, makeBait, BAIT_FROM, HOTBAR, SLOTS, type Stack } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import { GROUND_Y } from './plot'
import {
  ROOMS, ROOM_ORDER, TABLE, canPlace, place, raised, progress, wallsOf, benchOf, footprint, loadWorks, saveWorks,
  WALL_H, type Works, type Room, type RoomKind, type WorkNear,
  craftAt, jobRuns, pieceRect, pieceBoxes, canPlacePiece, placePiece, pickUpPiece, turnPiece, type Piece,
  ROOM_STORE_SLOTS, ROOM_KEEPS, roomAccepts, roomStore, stockRoom, stockRoomFromBag, takeFromRoom, makeBaitAt, benchCount, type StoreMove,
  CHEST_W, CHEST_D, CHEST_H, KEEPSTONE, KEEPSTONE_RECIPE, makeKeepstone, pickUpChest, allChests, chestBox, chestsStanding, canPlaceChest, placeChest, type Chest,
} from './rooms'
import {
  MAX_CHESTS, CHEST_SLOTS, bankCap, bankUsed, bankView, BANK_TABS, deposit, depositBag, withdraw, loadBank, saveBank, freshBank,
  type Bank, type BankTab,
} from './garden-bank'
import { FURNITURE, FURNITURE_ORDER, REFINE, PIECE_JOBS, MAX_PIECES, type Job } from './furniture'

// ── the store ─────────────────────────────────────────────────────────────────────────────────────────────────
let works: Works | null = null
const SERVER: Works = { v: 1, rooms: [], chests: [], pieces: [] }
const subs = new Set<() => void>()
const getW = (): Works => { if (!works) works = typeof window === 'undefined' ? SERVER : loadWorks(); return works }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export function setWorks(w: Works) { works = w; saveWorks(w); subs.forEach(f => f()) }
export const useWorks = () => useSyncExternalStore(subscribe, getW, () => SERVER)
/** Every room's walls and every Keepstone, for the walker's plotShape. */
export const workWalls = (w: Works) => [...w.rooms.flatMap(wallsOf), ...allChests(w).map(chestBox), ...pieceBoxes(w)]

// the garden bank's store (garden-bank.ts): one pool, every chest a door into it
let bank: Bank | null = null
const SERVER_BANK: Bank = freshBank()
const bsubs = new Set<() => void>()
const getB = (): Bank => { if (!bank) bank = typeof window === 'undefined' ? SERVER_BANK : loadBank(); return bank }
export function setBank(b: Bank) { bank = b; saveBank(b); bsubs.forEach(f => f()) }
export const useBank = () => useSyncExternalStore(f => { bsubs.add(f); return () => { bsubs.delete(f) } }, getB, () => SERVER_BANK)

// placing: which room, its turn, and where the ghost stands now (set by the scene each frame)
type Placing = { kind: RoomKind | 'chest'; q: number } | { kind: 'piece'; item: string; q: number } | null
let placing: Placing = null
const ghost = { x: 0, z: 0 }
const psubs = new Set<() => void>()
const setPlacing = (p: Placing) => { placing = p; psubs.forEach(f => f()) }
export const usePlacing = () => useSyncExternalStore(f => { psubs.add(f); return () => { psubs.delete(f) } }, () => placing, () => null)
export const isPlacing = () => placing !== null

/** Confirm the ghost where it stands. */
function confirmPlace(owned: ReadonlySet<string>) {
  if (!placing) return
  if (placing.kind === 'piece') {
    const item = placing.item, c = placePiece(getW(), owned, getInv(), item, ghost.x, ghost.z, placing.q)
    if (!c) { const v = canPlacePiece(getW(), owned, item, ghost.x, ghost.z, placing.q, getInv()); hudSay(v.ok ? 'Cannot set it there.' : v.why, 'info'); return }
    setInv(c.inv); setWorks(c.works)
    // keep placing while more of the same are in the bag (a row of stools is one job, not five trips to the table)
    if (countOf(c.inv, item) > 0) hudSay(`${FURNITURE[item].name} set · ${countOf(c.inv, item)} more in the bag · Esc stops`, 'item', 4)
    else { setPlacing(null); hudSay(`${FURNITURE[item].name} set.`, 'item', 3) }
    return
  }
  if (placing.kind === 'chest') {
    const c = placeChest(getW(), owned, getInv(), ghost.x, ghost.z, placing.q)
    if (!c) { const v = canPlaceChest(getW(), owned, ghost.x, ghost.z, placing.q, getInv()); hudSay(v.ok ? 'Cannot set a Keepstone there.' : v.why, 'info'); return }
    setInv(c.inv); setWorks(c.works); setPlacing(null)
    hudSay(`The Keepstone opens on the bank · it holds ${bankCap(chestsStanding(c.works))} stacks now.`, 'item', 5)
    return
  }
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
      {allChests(w).map(c => <Keepstone key={c.id} c={c} pose={pose} />)}
      {w.pieces.map(pc => <PieceMesh key={pc.id} p={pc} />)}
      {p && (p.kind === 'piece' ? <PieceGhost pose={pose} owned={owned} item={p.item} q={p.q} /> : p.kind === 'chest' ? <ChestGhost pose={pose} owned={owned} q={p.q} /> : <Ghost pose={pose} owned={owned} kind={p.kind} q={p.q} />)}
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
      {r.kind === 'carpentry' && (
        <>
          {/* a log on the bench, a saw on the wall-side, a stack of planks */}
          <mesh position={[-0.55, 1.15, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.15, 0.15, 0.9, 8]} /><meshLambertMaterial color="#b58a4e" /></mesh>
          <mesh position={[0.15, 1.3, 0.3]} rotation-z={0.3}><boxGeometry args={[0.55, 0.16, 0.02]} /><meshLambertMaterial color="#c9ccd1" /></mesh>
          {[0, 1, 2].map(k => <mesh key={k} position={[0.75, 1.04 + k * 0.06, 0]}><boxGeometry args={[0.7, 0.05, 0.22]} /><meshLambertMaterial color={k % 2 ? '#e2b56a' : '#d8a85c'} /></mesh>)}
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

/** The crystal set in a Keepstone: its light's colour (the crystal ladder, game/shimmer-skilling.md › Skill 3). */
const CRYSTAL_LIGHT: Record<string, string> = {
  raw_mana_shard: '#9ad8ff', violet_crystal: '#b48cff', storm_crystal: '#ffe27a', earth_crystal: '#f0b070',
  water_crystal: '#6fe0ff', pure_mana_core: '#f2f7ff', ather_crystal: '#ffc8ee',
}
const STONE = '#d3cab8', STONE_DK = '#aba291'
/** THE KEEPSTONE (canon 5a20b8f): a Blankstone pedestal whose top opens and the set crystal's light rises from inside.
 *  The lid swings back as a keeper comes near and the light climbs out of the bowl; it settles shut when they leave. */
function Keepstone({ c, pose }: { c: Chest; pose: React.MutableRefObject<Pose> }) {
  const lid = useRef<THREE.Group>(null), gem = useRef<THREE.Mesh>(null), shaft = useRef<THREE.Mesh>(null), shaftMat = useRef<THREE.MeshBasicMaterial>(null)
  const open = useRef(0), col = CRYSTAL_LIGHT[c.crystal ?? 'raw_mana_shard'] ?? CRYSTAL_LIGHT.raw_mana_shard
  useFrame((st, dt) => {
    const near = Math.hypot(pose.current.x - c.x, pose.current.z - c.z) < 3.2
    open.current += ((near ? 1 : 0) - open.current) * Math.min(1, dt * 4)
    const o = open.current, t = st.clock.elapsedTime
    if (lid.current) lid.current.rotation.x = -o * 1.9
    if (gem.current) { gem.current.position.y = 1.0 + o * 0.28 + Math.sin(t * 1.6) * 0.03 * o; gem.current.rotation.y = t * 0.6 }
    if (shaft.current) { shaft.current.scale.y = 0.05 + o; shaft.current.position.y = 1.02 + 0.65 * (0.05 + o) }
    if (shaftMat.current) shaftMat.current.opacity = 0.2 * o
  })
  return (
    <group position={[c.x, GROUND_Y, c.z]} rotation-y={-c.q * Math.PI / 2}>
      <mesh position-y={0.08}><boxGeometry args={[CHEST_W, 0.16, CHEST_D]} /><meshLambertMaterial color={STONE_DK} /></mesh>
      <mesh position-y={0.5}><cylinderGeometry args={[0.3, 0.34, 0.7, 8]} /><meshLambertMaterial color={STONE} /></mesh>
      {/* the bowl the crystal sits in, and its glow */}
      <mesh position-y={0.92}><cylinderGeometry args={[0.42, 0.32, 0.18, 8]} /><meshLambertMaterial color={STONE} /></mesh>
      <mesh position-y={1.015} rotation-x={-Math.PI / 2}><circleGeometry args={[0.34, 8]} /><meshBasicMaterial color={col} /></mesh>
      <mesh ref={gem} position-y={1.0}><octahedronGeometry args={[0.13]} /><meshBasicMaterial color={col} /></mesh>
      {/* the lid, hinged at the back edge */}
      <group ref={lid} position={[0, 1.01, -0.42]}>
        <mesh position={[0, 0.05, 0.42]}><cylinderGeometry args={[0.44, 0.44, 0.1, 8]} /><meshLambertMaterial color={STONE_DK} /></mesh>
        <mesh position={[0, 0.14, 0.42]}><cylinderGeometry args={[0.1, 0.18, 0.1, 8]} /><meshLambertMaterial color={STONE} /></mesh>
      </group>
      {/* the light rising out of it */}
      <mesh ref={shaft} position-y={1.67} scale-y={0.05}>
        <cylinderGeometry args={[0.1, 0.24, 1.3, 10, 1, true]} />
        <meshBasicMaterial ref={shaftMat} color={col} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
/** The Keepstone's ghost: snapped to the half metre, close in front of the keeper. */
function ChestGhost({ pose, owned, q }: { pose: React.MutableRefObject<Pose>; owned: ReadonlySet<string>; q: number }) {
  const g = useRef<THREE.Group>(null), mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    const p = pose.current
    ghost.x = Math.round((p.x - Math.sin(p.yaw) * 1.8) * 2) / 2; ghost.z = Math.round((p.z - Math.cos(p.yaw) * 1.8) * 2) / 2
    g.current?.position.set(ghost.x, GROUND_Y + CHEST_H / 2, ghost.z)
    mat.current?.color.set(canPlaceChest(getW(), owned, ghost.x, ghost.z, q, getInv()).ok ? GHOST_OK : GHOST_BAD)
  })
  return (
    <group ref={g} rotation-y={-q * Math.PI / 2}>
      <mesh><cylinderGeometry args={[CHEST_W / 2, CHEST_W / 2, CHEST_H, 8]} /><meshBasicMaterial ref={mat} color={GHOST_OK} transparent opacity={0.4} depthWrite={false} /></mesh>
    </group>
  )
}

const WOODS: Record<string, string> = { goldwood: '#d9a957', shimmeroak: '#a77a52', starwillow: '#c8d2e8', dawnwood: '#c9774a', iron: '#4e4a47', stone: '#bdb6a6' }
const Bx = ({ p, s, c }: { p: [number, number, number]; s: [number, number, number]; c: string }) => <mesh position={p}><boxGeometry args={s} /><meshLambertMaterial color={c} /></mesh>
/** One piece, built from boxes in its wood's colour. Blockout look like the rooms. */
function PieceBody({ item }: { item: string }) {
  const f = FURNITURE[item], c = WOODS[f.wood], dk = '#6b4a2a'
  const legs = (w: number, d: number, h: number, t = 0.07) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], k) => <Bx key={k} p={[a * (w / 2 - t), h / 2, b * (d / 2 - t)]} s={[t, h, t]} c={c} />)
  switch (item) {
    case 'goldwood_stool': return <><Bx p={[0, 0.45, 0]} s={[0.46, 0.07, 0.46]} c={c} />{legs(0.4, 0.4, 0.42)}</>
    case 'goldwood_bench': return <><Bx p={[0, 0.45, 0]} s={[f.w, 0.08, f.d]} c={c} />{legs(f.w - 0.1, f.d, 0.42, 0.09)}</>
    case 'goldwood_table': return <><Bx p={[0, 0.76, 0]} s={[f.w, 0.08, f.d]} c={c} />{legs(f.w - 0.1, f.d - 0.1, 0.72, 0.09)}</>
    case 'planter_box': return <><Bx p={[0, 0.25, 0]} s={[f.w, 0.5, f.d]} c={c} /><Bx p={[0, 0.48, 0]} s={[f.w - 0.12, 0.06, f.d - 0.12]} c="#5a3d25" /><Bx p={[0, 0.27, 0]} s={[f.w + 0.02, 0.12, f.d + 0.02]} c="#8a6a3a" /></>
    case 'shimmeroak_shelf': return <><Bx p={[-f.w / 2 + 0.04, f.h / 2, 0]} s={[0.07, f.h, f.d]} c={c} /><Bx p={[f.w / 2 - 0.04, f.h / 2, 0]} s={[0.07, f.h, f.d]} c={c} />{[0.1, 0.6, 1.1, 1.56].map(y => <Bx key={y} p={[0, y, 0]} s={[f.w, 0.05, f.d]} c={c} />)}<Bx p={[0, f.h / 2, -f.d / 2 + 0.02]} s={[f.w, f.h, 0.03]} c={dk} /></>
    case 'starwillow_arch': return <><Bx p={[-f.w / 2 + 0.08, f.h / 2, 0]} s={[0.12, f.h, 0.12]} c={c} /><Bx p={[f.w / 2 - 0.08, f.h / 2, 0]} s={[0.12, f.h, 0.12]} c={c} /><Bx p={[0, f.h - 0.06, 0]} s={[f.w, 0.12, 0.14]} c={c} />{[-0.7, 0, 0.7].map(x => <mesh key={x} position={[x, f.h + 0.04, 0]}><sphereGeometry args={[0.07, 8, 6]} /><meshBasicMaterial color="#eaf2ff" /></mesh>)}</>
    case 'dawnwood_chair': return <><Bx p={[0, 0.45, 0]} s={[0.52, 0.07, 0.52]} c={c} />{legs(0.48, 0.48, 0.42)}<Bx p={[0, 0.75, -0.23]} s={[0.52, 0.6, 0.06]} c={c} /></>
    case 'iron_lantern': return <><Bx p={[0, 0.85, 0]} s={[0.07, 1.7, 0.07]} c={c} /><Bx p={[0, 1.72, 0]} s={[0.26, 0.04, 0.26]} c={c} /><mesh position-y={1.56}><boxGeometry args={[0.2, 0.26, 0.2]} /><meshBasicMaterial color={f.glow} /></mesh><Bx p={[0, 1.42, 0]} s={[0.24, 0.04, 0.24]} c={c} /><Bx p={[0, 0.03, 0]} s={[0.3, 0.06, 0.3]} c={c} /></>
    case 'iron_brazier': return <>{[0, 1, 2].map(k => <Bx key={k} p={[Math.sin(k * 2.094) * 0.25, 0.3, Math.cos(k * 2.094) * 0.25]} s={[0.06, 0.6, 0.06]} c={c} />)}<mesh position-y={0.7}><cylinderGeometry args={[0.4, 0.22, 0.24, 10]} /><meshLambertMaterial color={c} /></mesh><mesh position-y={0.84}><coneGeometry args={[0.24, 0.32, 8]} /><meshBasicMaterial color={f.glow} /></mesh></>
    case 'weathervane': return <><Bx p={[0, 1.5, 0]} s={[0.06, 3, 0.06]} c={c} /><Bx p={[0, 3.05, 0]} s={[0.9, 0.05, 0.05]} c={c} /><mesh position={[0.48, 3.05, 0]} rotation-z={-Math.PI / 2}><coneGeometry args={[0.08, 0.18, 4]} /><meshLambertMaterial color={c} /></mesh><Bx p={[-0.42, 3.05, 0]} s={[0.12, 0.16, 0.02]} c={c} /><Bx p={[0, 0.04, 0]} s={[0.36, 0.08, 0.36]} c={c} /></>
    case 'spinestone_birdbath': return <><Bx p={[0, 0.06, 0]} s={[0.6, 0.12, 0.6]} c={c} /><mesh position-y={0.45}><cylinderGeometry args={[0.12, 0.16, 0.7, 8]} /><meshLambertMaterial color={c} /></mesh><mesh position-y={0.82}><cylinderGeometry args={[0.4, 0.26, 0.14, 10]} /><meshLambertMaterial color={c} /></mesh><mesh position-y={0.895} rotation-x={-Math.PI / 2}><circleGeometry args={[0.33, 10]} /><meshBasicMaterial color="#9fd0e8" /></mesh></>
    case 'ruin_column': return <><Bx p={[0, 0.1, 0]} s={[0.7, 0.2, 0.7]} c={c} /><mesh position-y={1.3}><cylinderGeometry args={[0.24, 0.27, 2.2, 10]} /><meshLambertMaterial color={c} /></mesh><Bx p={[0, 2.5, 0]} s={[0.66, 0.18, 0.66]} c={c} /><Bx p={[0.18, 2.62, 0.1]} s={[0.3, 0.1, 0.36]} c="#a39c8c" /></>
    case 'mana_cell_lamp': return <><Bx p={[0, 0.04, 0]} s={[0.4, 0.08, 0.4]} c="#a4793e" /><Bx p={[0, 0.6, 0]} s={[0.05, 1.1, 0.05]} c="#a4793e" /><mesh position-y={1.32}><cylinderGeometry args={[0.1, 0.1, 0.34, 8]} /><meshBasicMaterial color={f.glow} /></mesh>{[0, 1, 2, 3].map(k => <Bx key={k} p={[Math.sin(k * 1.571) * 0.13, 1.32, Math.cos(k * 1.571) * 0.13]} s={[0.025, 0.42, 0.025]} c="#a4793e" />)}<Bx p={[0, 1.54, 0]} s={[0.3, 0.04, 0.3]} c="#a4793e" /></>
    default: return <Bx p={[0, f.h / 2, 0]} s={[f.w, f.h, f.d]} c={c} />
  }
}
function PieceMesh({ p }: { p: Piece }) {
  return <group position={[p.x, GROUND_Y, p.z]} rotation-y={-p.q * Math.PI / 2}><PieceBody item={p.item} /></group>
}
/** The piece's ghost: the real piece, tinted, snapped to the quarter metre in front of the keeper. */
function PieceGhost({ pose, owned, item, q }: { pose: React.MutableRefObject<Pose>; owned: ReadonlySet<string>; item: string; q: number }) {
  const f = FURNITURE[item], g = useRef<THREE.Group>(null), mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    const p = pose.current, ahead = Math.max(f.w, f.d) / 2 + 1.2
    ghost.x = Math.round((p.x - Math.sin(p.yaw) * ahead) * 4) / 4; ghost.z = Math.round((p.z - Math.cos(p.yaw) * ahead) * 4) / 4
    g.current?.position.set(ghost.x, GROUND_Y, ghost.z)
    mat.current?.color.set(canPlacePiece(getW(), owned, item, ghost.x, ghost.z, q, getInv()).ok ? GHOST_OK : GHOST_BAD)
  })
  return (
    <group ref={g} rotation-y={-q * Math.PI / 2}>
      <PieceBody item={item} />
      <mesh position-y={f.h / 2}><boxGeometry args={[f.w + 0.06, f.h + 0.06, f.d + 0.06]} /><meshBasicMaterial ref={mat} color={GHOST_OK} transparent opacity={0.3} depthWrite={false} /></mesh>
    </group>
  )
}

// ── prompts + panels ──────────────────────────────────────────────────────────────────────────────────────────
export function workPrompt(n: WorkNear): string {
  if (n.kind === 'table') return 'E · the planning table'
  if (n.kind === 'chest') return 'E · the Keepstone'
  if (n.kind === 'piece') { const pc = getW().pieces.find(x => x.id === n.id); return `E · ${pc ? FURNITURE[pc.item].name : 'furniture'}` }
  if (n.kind === 'raising') return `${ROOMS[n.room.kind].name} · going up (${Math.round(progress(n.room) * 100)}%)`
  return `E · the ${ROOMS[n.room.kind].name}`
}

const lab: React.CSSProperties = { color: H.inkSoft, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }

export function WorkshopPanel({ near, owned, onClose }: { near: WorkNear; owned: ReadonlySet<string>; onClose: () => void }) {
  if (near.kind === 'table') return <TablePanel owned={owned} onClose={onClose} />
  if (near.kind === 'bench') return <BenchPanel room={near.room} onClose={onClose} />
  if (near.kind === 'chest') return <BankPanel id={near.id} onClose={onClose} />
  if (near.kind === 'piece') return <PiecePanel id={near.id} owned={owned} onClose={onClose} />
  return null
}

function TablePanel({ owned, onClose }: { owned: ReadonlySet<string>; onClose: () => void }) {
  const inv = useInv(), w = useWorks()
  return (
    <HearthFrame title="The planning table" maxWidth={560} onClose={onClose} fixed dataPanel="planning-table">
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, color: H.inkSoft }}>Plan a room, then set it on your ground. The logs go when you place it.</div>
        {(() => {
          const n = chestsStanding(w), have = countOf(inv, KEEPSTONE), short = KEEPSTONE_RECIPE.find(c => countOf(inv, c.id) < c.n)
          return (
            <div data-room="chest" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...hearthDisplay, fontSize: 16, fontWeight: 600, color: H.ink }}>Keepstone{have ? <span style={{ color: H.inkSoft }}> · {have} in the bag</span> : null}</div>
                <div style={{ fontSize: 12.5, color: H.inkSoft, lineHeight: 1.35 }}>Every Keepstone opens the one bank, shared by all your keepers. Each adds {CHEST_SLOTS} slots.</div>
                <div style={{ ...lab, marginTop: 4 }}>{KEEPSTONE_RECIPE.map(c => `${countOf(inv, c.id)} / ${c.n} ${itemDef(c.id).name}`).join(' · ')} · {n} of {MAX_CHESTS} standing</div>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <span data-act="make-keepstone"><HearthButton small disabled={!!short} onClick={() => { const r = makeKeepstone(getInv()); if (r) { setInv(r); hudSay('A Keepstone · in your bag.', 'item', 3) } else hudSay(short ? 'Prospect blankstone and a mana shard in the Wilds.' : 'No room in the bag.', 'info') }}>Make</HearthButton></span>
                {n >= MAX_CHESTS ? <span style={lab}>Full</span>
                  : <span data-act="set-keepstone"><HearthButton primary disabled={!have} onClick={() => { setPlacing({ kind: 'chest', q: 0 }); onClose(); hudSay('Setting a Keepstone · R turns it · E sets it · Esc cancels', 'info', 8) }}>Set one</HearthButton></span>}
              </div>
            </div>
          )
        })()}
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
        {(() => {
          const have = FURNITURE_ORDER.filter(id => countOf(inv, id) > 0)
          if (!have.length) return null
          return (
            <div data-furnish style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
              <div style={lab}>Furnish · {w.pieces.length} of {MAX_PIECES} set</div>
              <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                {have.map(id => (
                  <div key={id} data-piece={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ flex: 1, fontSize: 13.5, color: H.ink }}>{FURNITURE[id].name} <span style={{ color: H.inkSoft }}>× {countOf(inv, id)}</span></span>
                    <HearthButton small onClick={() => { setPlacing({ kind: 'piece', item: id, q: 0 }); onClose(); hudSay(`Setting the ${FURNITURE[id].name} · R turns it · E sets it · Esc stops`, 'info', 8) }}>Set</HearthButton>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
        {(() => { const short = ROOMS.rinnshop.cost.find(c => countOf(inv, c.id) < c.n); return short && !w.rooms.some(r => r.kind === 'rinnshop') ? <div style={{ fontSize: 12.5, color: H.inkSoft }}>Prune goldwood in the Wilds for logs.</div> : null })()}
      </div>
    </HearthFrame>
  )
}

function BenchPanel({ room, onClose }: { room: Room; onClose: () => void }) {
  const inv = useInv(), w = useWorks(), def = ROOMS[room.kind]
  const r = w.rooms.find(x => x.id === room.id) ?? room   // the live room (its store moves under the panel)
  const store = roomStore(r)
  const apply = (m: StoreMove) => { if (m.moved) { setWorks(m.works); setInv(m.inv) } else if ('why' in m && m.why) hudSay(m.why, 'info') }
  const foods = Object.keys(BAIT_FROM).filter(id => benchCount(r, inv, id) > 0)
  const kept = [...Array(SLOTS).keys()].filter(at => { const s = inv.slots[at]; return !!s && roomAccepts(r.kind, s.id) })
  return (
    <HearthFrame title={def.name} maxWidth={560} onClose={onClose} fixed dataPanel="bench">
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 12 }}>
        {r.kind === 'rinnshop' && (
          <>
            <div>
              <div style={lab}>Bait · {countOf(inv, 'bait')} in the bag</div>
              <div style={{ fontSize: 12.5, color: H.inkSoft, margin: '4px 0 8px' }}>An offering the rinn come to. One a cast. Cut from the room's store first, then your bag.</div>
              {foods.length ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  {foods.map(id => (
                    <div key={id} data-bait-from={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 13.5, color: H.ink }}>{itemDef(id).name} <span style={{ color: H.inkSoft }}>× {benchCount(r, inv, id)}</span></span>
                      <HearthButton small onClick={() => { const m = makeBaitAt(getW(), r.id, getInv(), id); if (m) { setWorks(m.works); setInv(m.inv) } else hudSay('No room for the bait.', 'info') }}>Make bait +{BAIT_FROM[id]}</HearthButton>
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
        {r.kind === 'carpentry' && (
          <>
            <JobList title="Refine" note="A log two ways. From the room's store first, then your bag." jobs={REFINE.filter(j => benchCount(r, inv, j.in[0].id) > 0)} r={r} inv={inv}
              empty="No logs to work. Prune trees in the Wilds; better woods come with Forestry." refine />
            <JobList title="Furniture" note="Made pieces go to your bag. Set them from the planning table." jobs={PIECE_JOBS} r={r} inv={inv} />
          </>
        )}
        <div data-room-store={r.kind}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ ...lab, flex: 1 }}>The store · {store.stacks.length} / {ROOM_STORE_SLOTS} · keeps {ROOM_KEEPS[r.kind]}</div>
            <span data-act="stock-room"><HearthButton small disabled={!kept.some(at => at >= HOTBAR)} onClick={() => apply(stockRoomFromBag(getW(), r.id, getInv()))}>Stock from the bag</HearthButton></span>
          </div>
          {store.stacks.length ? (
            <div style={{ ...grid, marginTop: 6 }}>
              {store.stacks.map((st, k) => <Cell key={k} s={st} data-room-slot={k} onClick={() => apply(takeFromRoom(getW(), r.id, k, getInv()))} />)}
            </div>
          ) : <div style={{ fontSize: 12.5, color: H.inkFaint, marginTop: 6 }}>Empty. The room works from what you keep here.</div>}
          {kept.length > 0 && (
            <>
              <div style={{ ...lab, marginTop: 10 }}>From your bag · click to stock</div>
              <div style={{ ...grid, marginTop: 6 }}>
                {kept.map(at => <Cell key={at} s={inv.slots[at]} data-bag-slot={at} onClick={() => apply(stockRoom(getW(), r.id, getInv(), at))} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </HearthFrame>
  )
}

/** A bench's job list: each row shows what goes in (with how many you can reach) and a Make button. */
function JobList({ title, note, jobs, r, inv, empty, refine }: { title: string; note: string; jobs: readonly Job[]; r: Room; inv: ReturnType<typeof useInv>; empty?: string; refine?: boolean }) {
  return (
    <div>
      <div style={lab}>{title}</div>
      <div style={{ fontSize: 12.5, color: H.inkSoft, margin: '4px 0 8px' }}>{note}</div>
      {jobs.length ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {jobs.map(j => {
            const can = jobRuns(r, inv, j) > 0
            return (
              <div key={j.id} data-job={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: H.ink }}>
                  {j.out.n > 1 ? `${j.out.n} ` : ''}{itemDef(j.out.id).name} <span style={{ color: H.inkSoft, fontSize: 12 }}>· {j.in.map(c => `${c.n} ${itemDef(c.id).name} (${benchCount(r, inv, c.id)})`).join(' + ')}</span>
                </span>
                <HearthButton small disabled={!can} onClick={() => { const m = craftAt(getW(), r.id, getInv(), j); if (m) { setWorks(m.works); setInv(m.inv) } else hudSay('No room in the bag.', 'info') }}>{refine ? j.label : 'Make'}</HearthButton>
              </div>
            )
          })}
        </div>
      ) : <div style={{ fontSize: 13, color: H.inkSoft }}>{empty}</div>}
    </div>
  )
}

/** E at a piece of furniture: turn it, or pick it back up into the bag. */
function PiecePanel({ id, owned, onClose }: { id: string; owned: ReadonlySet<string>; onClose: () => void }) {
  const w = useWorks(), p = w.pieces.find(x => x.id === id)
  if (!p) return null
  const f = FURNITURE[p.item]
  return (
    <HearthFrame title={f.name} maxWidth={420} onClose={onClose} fixed dataPanel="piece">
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 13, color: H.inkSoft }}>{f.blurb}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <span data-act="turn-piece"><HearthButton onClick={() => { const t = turnPiece(getW(), owned, id); if (t) setWorks(t); else hudSay('No room to turn it here.', 'info') }}>Turn</HearthButton></span>
          <span data-act="pickup-piece"><HearthButton primary onClick={() => { const r = pickUpPiece(getW(), id, getInv()); if (r) { setWorks(r.works); setInv(r.inv); onClose(); hudSay(`${f.name} · back in your bag.`, 'item', 3) } else hudSay('No room in the bag for it.', 'info') }}>Pick up</HearthButton></span>
        </div>
      </div>
    </HearthFrame>
  )
}

// ── the bank ──────────────────────────────────────────────────────────────────────────────────────────────────
function Cell({ s, title, ...rest }: { s: Stack | null; title?: string } & React.HTMLAttributes<HTMLButtonElement> & Record<`data-${string}`, string | number>) {
  const d = s ? itemDef(s.id) : null
  return (
    <button type="button" title={d ? `${d.name}${s!.n > 1 ? ` × ${s!.n}` : ''}${title ?? ''}` : 'empty'} disabled={!s}
      className="relative rounded-[10px] transition-transform active:scale-95" style={{ cursor: s ? 'pointer' : 'default' }} {...rest}>
      <Well size={46}>{s && d?.icon ? <img src={d.icon} alt="" width={32} height={32} draggable={false} /> : s ? <span style={{ fontSize: 11, fontWeight: 700, color: H.inkSoft }}>{d!.name.slice(0, 3)}</span> : null}</Well>
      {s && s.n > 1 && <span className="absolute bottom-0.5 right-1 text-[11.5px] font-extrabold tabular-nums" style={{ color: H.ink, textShadow: '0 1px 0 rgba(255,250,235,.8)' }}>{s.n}</span>}
    </button>
  )
}
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 5, justifyItems: 'center' }

/** E at any Keepstone: the garden bank above, the bag below. Click a stack to move it across. */
function BankPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const inv = useInv(), b = useBank(), w = useWorks()
  const [tab, setTab] = useState<BankTab>('all'), [query, setQuery] = useState('')
  const cap = bankCap(chestsStanding(w)), used = bankUsed(b), view = bankView(b, tab, query)
  const put = (at: number) => { const r = deposit(getInv(), at, getB(), cap); if (r.moved) { setInv(r.inv); setBank(r.bank) } else hudSay('The bank is full. Make another Keepstone at the planning table.', 'info') }
  const takeOut = (k: number) => { const r = withdraw(getB(), k, getInv()); if (r.moved) { setInv(r.inv); setBank(r.bank) } else hudSay('No room in the bag.', 'info') }
  const putAll = () => { const r = depositBag(getInv(), getB(), cap); if (r.moved) { setInv(r.inv); setBank(r.bank) } else hudSay(used >= cap ? 'The bank is full. Make another Keepstone at the planning table.' : 'The bag is already empty.', 'info') }
  return (
    <HearthFrame title="The bank" maxWidth={560} onClose={onClose} fixed dataPanel="bank"
      footer={<span className="text-[12px]">Click a stack to move it across · shared by every keeper in your garden</span>}>
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ ...lab, flex: 1 }} data-bank-used={used} data-bank-cap={cap}>
            <span style={{ color: used > cap ? '#b5452c' : undefined }}>{used}</span> / {cap} slots · {chestsStanding(w)} of {MAX_CHESTS} Keepstones
          </div>
          {id !== 'starter' && <span data-act="pickup-keepstone"><HearthButton small onClick={() => { const r = pickUpChest(getW(), id, getInv()); if (r) { setInv(r.inv); setWorks(r.works); onClose(); hudSay('The Keepstone is back in your bag. The bank keeps everything in it.', 'item', 4) } else hudSay('No room in the bag for it.', 'info') }}>Pick up</HearthButton></span>}
          <span data-act="deposit-bag"><HearthButton small onClick={putAll}>Put the bag away</HearthButton></span>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {BANK_TABS.map(t => {
            const on = t.id === tab && !query.trim()
            return <button key={t.id} type="button" data-bank-tab={t.id} onClick={() => { setTab(t.id); setQuery('') }}
              style={{ border: 0, borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: on ? H.ember : 'rgba(255,250,235,.6)', color: on ? '#fff7ea' : H.inkSoft, boxShadow: on ? 'none' : `inset 0 0 0 1px ${H.rule}` }}>{t.label}</button>
          })}
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="find…" data-bank-search
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape' && query) { e.preventDefault(); setQuery('') } }}
            style={{ marginLeft: 'auto', width: 110, borderRadius: 999, border: 0, padding: '5px 10px', fontSize: 12.5, background: 'rgba(255,250,235,.85)', boxShadow: `inset 0 0 0 1px ${H.rule}`, color: H.ink }} />
        </div>
        {view.length ? (
          <div style={{ ...grid, maxHeight: 220, overflowY: 'auto', padding: 2 }}>
            {view.map(k => <Cell key={k} s={b.stacks[k]} data-bank-slot={k} onClick={() => takeOut(k)} />)}
          </div>
        ) : <div style={{ fontSize: 12.5, color: H.inkFaint, minHeight: 46, display: 'flex', alignItems: 'center', padding: '0 4px' }}>{query.trim() ? `Nothing in the bank matches “${query.trim()}”.` : used ? 'Nothing under this tab.' : 'Empty. Click anything in your bag to put it here.'}</div>}
        <div style={{ ...lab, marginTop: 4 }}>Your bag</div>
        <div style={grid}>
          {[...Array(SLOTS - HOTBAR).keys()].map(k => <Cell key={k} s={inv.slots[k + HOTBAR]} data-bag-slot={k + HOTBAR} onClick={() => put(k + HOTBAR)} />)}
        </div>
        <div style={{ ...lab, marginTop: 2 }}>Hotbar</div>
        <div style={grid}>
          {[...Array(HOTBAR).keys()].map(k => <Cell key={k} s={inv.slots[k]} data-bag-slot={k} onClick={() => put(k)} />)}
        </div>
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
