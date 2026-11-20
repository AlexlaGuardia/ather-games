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
import { countOf, itemDef, give, makeBait, BAIT_FROM, HOTBAR, SLOTS, type Stack, type Inv } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import { GROUND_Y, squareAt, sqId } from './plot'
import { forestryLevel } from './forestry'
import { connectedPieces, extractBlueprint, fitsPad } from './plot-blueprint'
import { LOT_W, LOT_D, GLADE_LOTS } from './moonwell-glade'
import { snapCorner, runKeys, canLay, planRun, raze, wallBoxes, edgeRect, findRooms, roofMesh, pieceAt, roomAt, toggleDoor, toggleWindow, paintWall, paintFloor, floorOf, WALL_MATS, WALL_MAT_ORDER, ROOF_STYLES, LOW_WALL, DOOR_H, SILL, WIN_TOP, WALL_T, type Corner, type WallMat, type Walls, type RoofStyle, type PlotRoom, type Floors } from './plot-walls'
import { MoglinModel, furOf, type MoglinGarb } from '../shared/moglin-model'
import {
  ROOMS, ROOM_ORDER, TABLE, canPlace, place, raised, progress, wallsOf, benchOf, footprint, loadWorks, saveWorks,
  WALL_H, KEEP_CLEAR, type Works, type Room, type RoomKind, type WorkNear,
  stationOf, setStation, stockItemFromBag, stockItemFromBank, craftAt, jobRuns, toWorld, pieceRect, pieceBoxes, canPlacePiece, placePiece, pickUpPiece, turnPiece, type Piece,
  ROOM_STORE_SLOTS, ROOM_KEEPS, roomAccepts, roomStore, stockRoom, stockRoomFromBag, takeFromRoom, makeBaitAt, benchCount, type StoreMove,
  CHEST_W, CHEST_D, CHEST_H, KEEPSTONE, KEEPSTONE_RECIPE, makeKeepstone, makeKeepstoneFrom, shortOf, haveFor, pickUpChest, allChests, chestBox, chestsStanding, canPlaceChest, placeChest, type Chest,
} from './rooms'
import {
  MAX_CHESTS, CHEST_SLOTS, bankCap, bankUsed, bankView, BANK_TABS, deposit, depositBag, withdraw, loadBank, saveBank, freshBank,
  bankCount, type Bank, type BankTab,
} from './garden-bank'
import { buildPlan, billOf, reconcile, paneFor } from './plot-bom'
import { FURNITURE, REFINE, STONE_REFINE, PIECE_JOBS, KEEPSTONES, isPiece, type Job } from './furniture'
import { ROAST } from './cooking'
import { FarmPanel, FarmInterior, FarmCrate, currentFarm, setFarm, currentWater, settleWater, farmNow } from './farm-room'
import { plumbingOf, spillIfRemoved } from './water'
import { grantStarter } from './farmroom'
import { BREW } from './alchemy'
import { RINSTICKS, makeRinstick, loadTools, saveTools, rinstickName, easeOf } from './rinsticks'
import { FOCUSES, BENCH, makeFocus, reachOf, focusName, type FocusSkill } from './focuses'
import { TOOL_DEFS } from '../../engine/tools'
import { isBuilding, useBuildMode, enterBuild, exitBuild, buildPoint, onBuildTap, setBuildTool, useBuildTool, onBuildDraw } from './build-mode'
import { useQuest, questEvent } from './use-rinquest'
import { currentStep } from './rinquest'
import { advance, setFocus, cancelFocus, touch, maxAffordable, runsFor, statusOf, takeOut, putOut, jobById, itemMs, runMs, moglinSpeed, stockJobs, stockLine, OUT_CAP, RESERVE } from './station-queue'
import { skillIn, luckOf } from './moglin-skills'
import { loadVillage, saveVillage, assign, dutyLine, WORKS_IN, GRADE_NAME, GRADE_CATEGORIES, type Village } from './moglins'

// ── the store ─────────────────────────────────────────────────────────────────────────────────────────────────
let works: Works | null = null
const SERVER: Works = { v: 1, rooms: [], chests: [], pieces: [] }
const subs = new Set<() => void>()
const getW = (): Works => { if (!works) works = typeof window === 'undefined' ? SERVER : loadWorks(); return works }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export function setWorks(w: Works) { works = w; saveWorks(w); subs.forEach(f => f()); settleWater(w.pieces) }
export const useWorks = () => useSyncExternalStore(subscribe, getW, () => SERVER)
/** The live works (the page's village tick reads and writes through this store, so an open panel sees the product land). */
export const currentWorks = () => getW()
/** Every room's walls and every Keepstone, for the walker's plotShape. */
export const workWalls = (w: Works) => [...w.rooms.flatMap(wallsOf), ...allChests(w).map(chestBox), ...pieceBoxes(w), ...wallBoxes(w.walls ?? {}, GROUND_Y)]

// ── M37 slice 1: YOUR OWN WALLS (plot-walls.ts; Alex 11-19 "like the sims ... walls a little thicker, like the rooms") ──
// In plan mode, the Walls tool: drag along the metre grid, a ghost run shows (blue = it can stand, red = it cannot), let go
// and it stands (a plank a metre). Erase drags it back down (every plank back). The walker meets them like a room's walls.
type WallDrag = { a: Corner; b: Corner; keys: string[]; ok: boolean; erase: boolean }
let wallDrag: WallDrag | null = null, wallMat: WallMat = 'goldwood'
const wdSubs = new Set<() => void>(), wdEmit = () => wdSubs.forEach(f => f())
const useWallDrag = () => useSyncExternalStore(f => { wdSubs.add(f); return () => { wdSubs.delete(f) } }, () => wallDrag, () => null)
const useWallMat = () => useSyncExternalStore(f => { wdSubs.add(f); return () => { wdSubs.delete(f) } }, () => wallMat, () => 'goldwood' as WallMat)
/** a corner is on held ground when any of the four squares around it is yours (a wall may run along your edge) */
const heldCorner = (owned: ReadonlySet<string>) => (x: number, z: number) =>
  [[0.01, 0.01], [-0.01, 0.01], [0.01, -0.01], [-0.01, -0.01]].some(([dx, dz]) => { const s = squareAt(x + dx, z + dz); return !!s && owned.has(sqId(s.i, s.j)) })
/** what a new wall must keep clear of: rooms (whole footprint + a hand), Keepstones, furniture */
function wallBlockers(w: Works) {
  const rects: { r: { x0: number; x1: number; z0: number; z1: number }; why: string }[] = []
  for (const r of w.rooms) { const f = footprint(r.kind, r.x, r.z, r.q); rects.push({ r: { x0: f.x0 - 0.3, x1: f.x1 + 0.3, z0: f.z0 - 0.3, z1: f.z1 + 0.3 }, why: `In your ${ROOMS[r.kind].name}.` }) }
  for (const c of allChests(w)) rects.push({ r: chestBox(c), why: 'A Keepstone is in the way.' })
  for (const p of w.pieces) rects.push({ r: pieceRect(p.item, p.x, p.z, p.q), why: 'Something already stands there.' })
  return { rects, circles: KEEP_CLEAR }
}
/** rooms the plan closes whose floor + roof are not built yet (they appear at Build) */
const unbuiltRooms = (walls: Walls, paid: Works['paid']) => new Set(findRooms(walls).map(r => r.key).filter(k => !(paid ?? {})[k]))
function wallVerdict(owned: ReadonlySet<string>, a: Corner, b: Corner, erase: boolean) {
  const w = currentWorks(), keys = runKeys(a, b)
  if (erase) return { keys, ok: keys.some(k => !!w.walls?.[k]), why: 'No wall there to take down.' }
  const v = canLay(w.walls ?? {}, keys, wallMat, heldCorner(owned), wallBlockers(w))   // a plan is drawn free: the list is paid at Build
  return { keys, ok: v.ok, why: v.ok ? '' : v.why }
}
/** M37 slice 3: Door / Window / Paint act on a TAP (a press that barely moves): the piece under it, or the room */
// ── M39 slice 1: BLUEPRINTS (owner). The Blueprint tool: tap a wall, the building it belongs to lights, a bar shows its
// footprint, whether it fits a Glade lot's pad, which Moglin it is for, and Save (POST /shimmer/save-house-blueprint; the
// Glade stands it on that lot at the next visit, no deploy).
let bpPick: string | null = null
const setBpPick = (k: string | null) => { bpPick = k; wdEmit() }
const useBpPick = () => useSyncExternalStore(f => { wdSubs.add(f); return () => { wdSubs.delete(f) } }, () => bpPick, () => null)
let ownerP: Promise<boolean> | null = null
const ownerCheck = () => (ownerP ??= fetch('/api/owner', { cache: 'no-store' }).then(r => (r.ok ? r.json() : { owner: false })).then(d => !!d.owner).catch(() => false))
function useOwner() { const [o, setO] = useState(false); useEffect(() => { let alive = true; ownerCheck().then(v => { if (alive) setO(v) }); return () => { alive = false } }, []); return o }
function BlueprintPicked() {
  const k = useBpPick(), w = useWorks(), down = useWallsDown()
  const keys = useMemo(() => (k && w.walls ? connectedPieces(w.walls, k) : []), [k, w.walls])
  if (!keys.length) return null
  return <WallRun mat="goldwood" keys={keys} ghost="#5aa0ff" h={down ? LOW_WALL : WALL_H} />
}
function BlueprintBar() {
  const k = useBpPick(), w = useWorks()
  const [lot, setLot] = useState('hazel'), [busy, setBusy] = useState(false)
  const bp = useMemo(() => (k && w.walls ? extractBlueprint(w.walls, w.floors, w.roof ?? 'gable', k, `glade-${lot}`, `${lot[0].toUpperCase()}${lot.slice(1)}'s workshop`) : null), [k, w, lot])
  if (!bp) return <div data-bp-bar style={{ justifySelf: 'center', fontSize: 11.5, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>Tap a wall of the building to save as a blueprint</div>
  const fits = fitsPad(bp, LOT_W, LOT_D)
  const save = async () => {
    setBusy(true)
    try {
      const r = await fetch('/shimmer/save-house-blueprint', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ blueprint: bp }) })
      const j = await r.json().catch(() => ({}))
      hudSay(r.ok ? `Saved for ${lot}'s lot (${bp.w} x ${bp.d} m). It stands at the Glade on your next visit.` : `Not saved: ${j.error ?? r.status}`, r.ok ? 'item' : 'info', 6)
    } finally { setBusy(false) }
  }
  return (
    <div data-bp-bar style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', padding: '6px 10px', borderRadius: 12, background: 'rgba(255,250,235,.9)', boxShadow: '0 2px 8px rgba(0,0,0,.2)', font: '700 12px system-ui', color: H.ink }}>
      <span data-bp-size>{bp.w} x {bp.d} m · {Object.keys(bp.walls).length} pieces</span>
      <span data-bp-fits={fits} style={{ color: fits ? '#2f7a3a' : '#b0452a' }}>{fits ? `fits a lot (${LOT_W} x ${LOT_D})` : `too big for a lot (${LOT_W} x ${LOT_D})`}</span>
      <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>For
        <select id="bp-lot" data-bp-lot value={lot} onChange={e => setLot(e.target.value)} style={{ font: 'inherit' }}>
          {GLADE_LOTS.map(l => <option key={l.id} value={l.id}>{l.id[0].toUpperCase() + l.id.slice(1)}</option>)}
        </select>
      </label>
      <button type="button" data-act="bp-save" disabled={busy || !fits} onClick={save} style={{ border: 0, borderRadius: 10, height: 32, padding: '0 12px', cursor: fits ? 'pointer' : 'default', background: fits ? H.ink : 'rgba(0,0,0,.2)', color: '#fff', font: 'inherit' }}>{busy ? 'Saving' : 'Save blueprint'}</button>
    </div>
  )
}
function tapToolHandler(kind: 'door' | 'window' | 'paint' | 'blueprint') {
  let at: { x: number; z: number } | null = null
  return {
    start(x: number, z: number) { at = { x, z } },
    move() { /* a tap tool ignores drags */ },
    end(x: number, z: number) {
      if (!at || Math.hypot(x - at.x, z - at.z) > 1.2) { at = null; return }
      at = null
      const w = currentWorks(), walls = w.walls ?? {}, k = pieceAt(walls, x, z)
      if (kind === 'blueprint') { if (!k) hudSay('Tap a wall of the building.', 'info'); setBpPick(k); return }
      if (kind === 'paint') {
        if (k) { const r = paintWall(walls, getInv(), k, wallMat); if ('why' in r) { hudSay(r.why, 'info'); return } setWorks({ ...w, walls: r.walls }); setInv(r.inv); return }
        const room = roomAt(findRooms(walls), x, z); if (!room) { hudSay('Tap a wall, or the floor of one of your rooms.', 'info'); return }
        setWorks({ ...w, floors: paintFloor(w.floors, room, wallMat) }); return
      }
      if (!k) { hudSay(kind === 'door' ? 'Tap a wall to put a door in it.' : 'Tap a wall to put a window in it.', 'info'); return }
      const c = kind === 'door' ? toggleDoor(walls, k) : toggleWindow(walls, k)
      if (!c.ok) { hudSay(c.why, 'info'); return }
      if (kind === 'window') {   // a pane for a window cut into a BUILT wall (a plan's pane is on the list instead)
        const pn = paneFor(walls, c.walls, k, getInv(), getB()); if ('why' in pn) { hudSay(pn.why, 'info'); return }
        setInv(pn.inv); if (pn.bank) setBank(pn.bank)
      }
      setWorks({ ...w, walls: c.walls, paid: w.paid ?? {} })
    },
    cancel() { at = null },
  }
}
/** BuildBar registers this while the Walls / Erase tool is on */
function wallDrawHandler(owned: () => ReadonlySet<string>, erase: boolean) {
  const at = (x: number, z: number) => snapCorner(x, z)
  const show = (a: Corner, b: Corner) => { const v = wallVerdict(owned(), a, b, erase); wallDrag = { a, b, keys: v.keys, ok: v.ok, erase }; wdEmit() }
  return {
    start(x: number, z: number) { const c = at(x, z); show(c, c) },
    move(x: number, z: number) { if (wallDrag) show(wallDrag.a, at(x, z)) },
    end(x: number, z: number) {
      if (!wallDrag) return
      const a = wallDrag.a, b = at(x, z); wallDrag = null; wdEmit()
      const w = currentWorks(), keys = runKeys(a, b); if (!keys.length) return
      if (erase) {
        const r = raze(w.walls ?? {}, getInv(), keys); if (!r.down) return
        const rc = reconcile(r.walls, w.paid, r.inv)   // a built room that no longer closes gives its floor and roof back too
        setWorks({ ...w, walls: r.walls, paid: rc.paid }); setInv(rc.inv)
        hudSay(`${r.down} m of wall down, what was built comes back to your bag.${r.full ? ' Your bag is full: the rest stays up.' : ''}`, 'item')
        return
      }
      const v = canLay(w.walls ?? {}, keys, wallMat, heldCorner(owned()), wallBlockers(w))
      if (!v.ok) { hudSay(v.why, 'info'); return }
      setWorks({ ...w, walls: planRun(w.walls ?? {}, v.add, wallMat), paid: w.paid ?? {} })   // a PLAN: the list is paid at Build
    },
    cancel() { if (wallDrag) { wallDrag = null; wdEmit() } },
  }
}
const WALL_GEO = new THREE.BoxGeometry(1, 1, 1)
/** M39: a saved blueprint standing somewhere else (a Glade lot): the plot's own renderer, in a group turned + lifted onto the
 *  pad (the renderer draws at GROUND_Y, the plot's floor, so the group lifts by the difference) */
export function BlueprintBuilding({ walls, roof, floors, x, z, y, rotY }: { walls: Walls; roof: RoofStyle; floors?: Floors; x: number; z: number; y: number; rotY: number }) {
  return <group position={[x, y - GROUND_Y, z]} rotation-y={rotY}><DrawnWalls walls={walls} roof={roof} floors={floors} probe={false} /></group>
}
/** every drawn wall, one instanced mesh per wood (Lambert, like the rooms' walls) */
// M37 slice 2: walls DOWN (plan mode only; Sims' trick): drawn walls drop to knee height and the roofs lift off, so you
// see into your rooms while you plan. Leaving plan mode puts them back up.
let wallsDown = false
const setWallsDown = (v: boolean) => { wallsDown = v; wdEmit() }
const useWallsDown = () => useSyncExternalStore(f => { wdSubs.add(f); return () => { wdSubs.delete(f) } }, () => wallsDown, () => false)
export function DrawnWalls({ walls, roof, floors, probe = true, down: downOverride, unbuilt }: { walls: Walls; roof: RoofStyle; floors?: Floors; unbuilt?: ReadonlySet<string>; probe?: boolean; /** set by a page outside plan mode (dev/blueprints) */ down?: boolean }) {
  const b = useBuildMode(), wd = useWallsDown(), down = downOverride ?? (wd && b)   // hooks always run; the override only picks
  useEffect(() => { if (!b && wallsDown) setWallsDown(false) }, [b])
  // runs by wood AND kind: a plain piece is floor to top, a door only its lintel, a window a sill + a head + a pane
  const byMat = useMemo(() => { const m = new Map<string, string[]>(); for (const [k, w] of Object.entries(walls)) { const id = `${w.mat}|${w.kind ?? 'wall'}|${w.draft ? 'draft' : ''}`; const l = m.get(id) ?? []; l.push(k); m.set(id, l) } return [...m].map(([id, keys]) => { const [mat, kind, dr] = id.split('|'); return { mat: mat as WallMat, kind, keys, draft: !!dr } }) }, [walls])
  const panes = useMemo(() => Object.entries(walls).filter(([, w]) => w.kind === 'window' && !w.draft).map(([k]) => k), [walls])
  const rooms = useMemo(() => findRooms(walls), [walls])
  useEffect(() => { if (probe) (window as unknown as { __walls?: object }).__walls = { rooms: () => rooms.map(r => ({ cells: r.cells.length, rect: !!r.rect, built: !unbuilt?.has(r.key) })), down: () => down, roof: () => roof } }, [rooms, down, roof, probe, unbuilt])
  return (
    <>
      {byMat.map(({ mat, kind, keys, draft }) => {
        const top = down ? LOW_WALL : WALL_H, id = mat + kind + draft + keys.length + (down ? 'd' : ''), g = draft ? DRAFT_LOOK : undefined   // a plan is a blue blueprint until it is built
        if (kind === 'door') return top > DOOR_H ? <WallRun key={id} mat={mat} keys={keys} y0={DOOR_H} h={top - DOOR_H} ghost={g} /> : null
        if (kind === 'window') return <React.Fragment key={id}><WallRun mat={mat} keys={keys} h={Math.min(SILL, top)} ghost={g} />{top > WIN_TOP && <WallRun mat={mat} keys={keys} y0={WIN_TOP} h={top - WIN_TOP} ghost={g} />}</React.Fragment>
        return <WallRun key={id} mat={mat} keys={keys} h={top} ghost={g} />
      })}
      {!down && panes.length > 0 && <WallRun key={'pane' + panes.length} mat="goldwood" keys={panes} y0={SILL} h={WIN_TOP - SILL} pane />}
      {rooms.filter(r => !unbuilt?.has(r.key)).map(r => <RoomFloor key={r.key} room={r} floors={floors} />)}
      {!down && rooms.filter(r => !unbuilt?.has(r.key)).map(r => <RoomRoof key={r.key + roof} room={r} style={roof} walls={walls} />)}
    </>
  )
}
const DRAFT_LOOK = '#6fb4ff'
const FLOOR_GEO = new THREE.BoxGeometry(1, 0.06, 1)
/** a drawn room's floor: planks a metre square, in the wood it was painted (Goldwood until then), a shade under the walls */
function RoomFloor({ room, floors }: { room: PlotRoom; floors?: Floors }) {
  const groups = useMemo(() => { const g = new Map<WallMat, [number, number][]>(); for (const c of room.cells) { const m = floorOf(floors, c[0], c[1]); const l = g.get(m) ?? []; l.push(c); g.set(m, l) } return [...g] }, [room, floors])
  return <>{groups.map(([mat, cells]) => <FloorCells key={mat + cells.length} mat={mat} cells={cells} />)}</>
}
function FloorCells({ mat, cells }: { mat: WallMat; cells: [number, number][] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const color = useMemo(() => new THREE.Color(WALL_MATS[mat].color).multiplyScalar(0.82), [mat])
  useEffect(() => {
    const m = ref.current; if (!m) return
    const o = new THREE.Object3D()
    cells.forEach(([i, j], n) => { o.position.set(i + 0.5, GROUND_Y + 0.03, j + 0.5); o.updateMatrix(); m.setMatrixAt(n, o.matrix) })
    m.count = cells.length; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere()
  }, [cells])
  return <instancedMesh ref={ref} args={[FLOOR_GEO, undefined, cells.length]} frustumCulled={false} receiveShadow><meshLambertMaterial color={color} /></instancedMesh>
}
/** the auto roof over a drawn room: the house's style on a rectangle, flat over any other shape; gable ends in the wall's wood */
function RoomRoof({ room, style, walls }: { room: PlotRoom; style: RoofStyle; walls: Walls }) {
  const y = GROUND_Y + WALL_H
  const m = useMemo(() => roofMesh(room, style, y), [room, style, y])
  const geo = useMemo(() => { if (!m.roof.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(m.roof, 3)); g.computeVertexNormals(); return g }, [m])
  const ends = useMemo(() => { if (!m.ends.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(m.ends, 3)); g.computeVertexNormals(); return g }, [m])
  useEffect(() => () => { geo?.dispose(); ends?.dispose() }, [geo, ends])
  // the end walls' wood: the commonest wood on the room's edge
  const endColor = useMemo(() => {
    const n: Partial<Record<WallMat, number>> = {}
    for (const [i, j] of room.cells) for (const k of [`h,${i},${j}`, `h,${i},${j + 1}`, `v,${i},${j}`, `v,${i + 1},${j}`]) { const w = walls[k]; if (w) n[w.mat] = (n[w.mat] ?? 0) + 1 }
    const best = (Object.entries(n) as [WallMat, number][]).sort((a, b) => b[1] - a[1])[0]
    return WALL_MATS[best?.[0] ?? 'goldwood'].color
  }, [room, walls])
  return (
    <>
      {geo && <mesh geometry={geo} castShadow><meshLambertMaterial color={ROOF} side={THREE.DoubleSide} /></mesh>}
      {ends && <mesh geometry={ends}><meshLambertMaterial color={endColor} side={THREE.DoubleSide} /></mesh>}
      {m.slabs.map((r, n) => <mesh key={n} position={[(r.x0 + r.x1) / 2, y + 0.11, (r.z0 + r.z1) / 2]} castShadow><boxGeometry args={[r.x1 - r.x0, 0.22, r.z1 - r.z0]} /><meshLambertMaterial color={ROOF} /></mesh>)}
    </>
  )
}
export function WallRun({ mat, keys, ghost, h = WALL_H, y0 = 0, pane }: { mat: WallMat; keys: string[]; ghost?: string; h?: number; y0?: number; pane?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = ref.current; if (!m) return
    const o = new THREE.Object3D()
    keys.forEach((k, n) => {
      const r = edgeRect(k), thin = pane ? (WALL_T - 0.06) : 0, alongX = r.x1 - r.x0 > r.z1 - r.z0
      o.position.set((r.x0 + r.x1) / 2, GROUND_Y + y0 + h / 2 + (ghost ? 0.01 : 0), (r.z0 + r.z1) / 2)
      o.scale.set(r.x1 - r.x0 + (ghost ? 0.04 : 0) - (alongX ? 0 : thin), h + (ghost ? 0.02 : 0), r.z1 - r.z0 + (ghost ? 0.04 : 0) - (alongX ? thin : 0)); o.updateMatrix(); m.setMatrixAt(n, o.matrix)
    })
    m.count = keys.length; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere()
  }, [keys, ghost, h, y0, pane])
  return (
    <instancedMesh ref={ref} args={[WALL_GEO, undefined, Math.max(1, keys.length)]} frustumCulled={false}>
      {ghost ? <meshBasicMaterial color={ghost} transparent opacity={0.45} depthWrite={false} /> : pane ? <meshLambertMaterial color="#a9dcea" transparent opacity={0.45} depthWrite={false} /> : <meshLambertMaterial color={WALL_MATS[mat].color} />}
    </instancedMesh>
  )
}
function WallGhost() {
  const d = useWallDrag(), down = useWallsDown()
  if (!d || !d.keys.length) return null
  return <WallRun mat={wallMat} keys={d.keys} ghost={d.erase ? '#ff5a4a' : d.ok ? '#5aa0ff' : '#ff9a3a'} h={down ? LOW_WALL : WALL_H} />
}
// ── THE CATALOG (Alex 11-18 brief + 11-19 playtest: 'it should be next to back to keeper'). v1 = the house pieces you
// can build today, by wood: Walls and Floors in Goldwood / Shimmeroak / Dawnwood, plus Door and Window (cut into a wall,
// they keep its wood). A wood you can't work yet shows greyed with WHERE it comes from (plain facts: the Forestry level its
// trees need and the bench that saws its planks), never hidden: the catalog is also the world's shopping list. Have / need on
// every card. Tapping a lit card picks that tool and wood (the catalog IS the paint picker). Same rule as the 09-27 law:
// a material is a LOOK, never power.
const WOOD_GATE: Record<WallMat, number> = { goldwood: 1, shimmeroak: 4, dawnwood: 10 }   // forestry.ts TREE_TIER gates
function Catalog({ onPick }: { onPick: () => void }) {
  const inv = useInv(), lvl = forestryLevel()
  const pick = (t: 'walls' | 'paint' | 'door' | 'window', m?: WallMat) => { setPlacing(null); if (m) { wallMat = m; wdEmit() } setBuildTool(t); onPick() }
  const card = (key: string, label: string, sub: string, lit: boolean, onClick: () => void, swatch?: string) => (
    <button key={key} type="button" data-cat={key} data-lit={lit} disabled={!lit} onClick={onClick}
      style={{ border: 0, borderRadius: 10, padding: '7px 8px', textAlign: 'left', cursor: lit ? 'pointer' : 'default', background: lit ? 'rgba(255,250,235,.96)' : 'rgba(255,250,235,.5)', boxShadow: `inset 0 0 0 1px ${H.rule}`, opacity: lit ? 1 : 0.6, display: 'grid', gridTemplateColumns: swatch ? '18px 1fr' : '1fr', gap: 7, alignItems: 'center', minWidth: 0 }}>
      {swatch && <i style={{ width: 18, height: 18, borderRadius: 4, background: swatch, display: 'inline-block' }} />}
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', font: '700 12px system-ui', color: H.ink }}>{label}</span>
        <span style={{ display: 'block', fontSize: 10.5, color: H.ink, opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
      </span>
    </button>
  )
  return (
    <div data-catalog style={{ display: 'grid', gap: 8, padding: '10px', borderRadius: 14, background: 'rgba(255,250,235,.9)', boxShadow: '0 2px 10px rgba(0,0,0,.25)', maxHeight: '52vh', overflowY: 'auto' }}>
      {(['walls', 'paint'] as const).map(t => (
        <div key={t} style={{ display: 'grid', gap: 5 }}>
          <div style={{ font: '700 11px system-ui', letterSpacing: '.12em', textTransform: 'uppercase', color: H.ink, opacity: 0.7 }}>{t === 'walls' ? 'Walls · drawn as a plan, built from the list' : 'Floors · paint a whole room'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {WALL_MAT_ORDER.map(m => {
              const have = countOf(inv, WALL_MATS[m].item), open = lvl >= WOOD_GATE[m] || have > 0
              const sub = open ? `${have} planks` : `Forestry ${WOOD_GATE[m]} · saw at your Carpentry`
              return card(`${t}:${m}`, WALL_MATS[m].name, sub, true, () => pick(t, m), WALL_MATS[m].color)   // a plan needs no planks to draw: the list is paid at Build
            })}
          </div>
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
        {card('door', 'Door', 'Tap a wall · 2 m · keeps its wood', true, () => pick('door'))}
        {card('window', 'Window', 'Tap a wall · a crystal pane (on the list)', true, () => pick('window'))}
      </div>
    </div>
  )
}
/** the Walls / Erase tools and the wood picker, in the build bar */
function WallTools({ owned, cat, onCat }: { owned: React.MutableRefObject<ReadonlySet<string>>; cat: boolean; onCat: () => void }) {
  const t = useBuildTool(), mat = useWallMat(), inv = useInv(), down = useWallsDown(), w = useWorks(), roof = w.roof ?? 'gable', owner = useOwner()
  useEffect(() => {
    if (t === 'look') return
    onBuildDraw(t === 'door' || t === 'window' || t === 'paint' || t === 'blueprint' ? tapToolHandler(t) : wallDrawHandler(() => owned.current, t === 'erase'))
    return () => onBuildDraw(null)
  }, [t, owned])
  const btn = (on: boolean): React.CSSProperties => ({ border: 0, borderRadius: 10, height: 34, padding: '0 10px', cursor: 'pointer', font: '700 12px system-ui', letterSpacing: '.06em', textTransform: 'uppercase', background: on ? H.ink : 'rgba(255,250,235,.7)', color: on ? '#fff' : H.ink, boxShadow: `inset 0 0 0 1px ${H.rule}` })
  return (
    <div data-wall-tools style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', padding: '5px 8px', borderRadius: 12, background: 'rgba(255,250,235,.82)', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
      <button type="button" data-act="wall-catalog" aria-pressed={cat} style={btn(cat)} onClick={onCat}>Catalog</button>
      <button type="button" data-tool="walls" style={btn(t === 'walls')} onClick={() => { setPlacing(null); setBuildTool(t === 'walls' ? 'look' : 'walls') }}>Walls</button>
      <button type="button" data-tool="erase" style={btn(t === 'erase')} onClick={() => { setPlacing(null); setBuildTool(t === 'erase' ? 'look' : 'erase') }}>Erase</button>
      {(['door', 'window', 'paint'] as const).map(k => <button key={k} type="button" data-tool={k} style={btn(t === k)} onClick={() => { setPlacing(null); setBuildTool(t === k ? 'look' : k) }}>{k}</button>)}
      {owner && <button type="button" data-tool="blueprint" style={btn(t === 'blueprint')} onClick={() => { setPlacing(null); setBpPick(null); setBuildTool(t === 'blueprint' ? 'look' : 'blueprint') }}>blueprint</button>}
      {(t === 'walls' || t === 'paint') && WALL_MAT_ORDER.map(m => (
        <button key={m} type="button" data-wall-mat={m} title={`${WALL_MATS[m].name} · ${countOf(inv, WALL_MATS[m].item)} planks`} onClick={() => { wallMat = m; wdEmit() }}
          style={{ ...btn(false), display: 'flex', alignItems: 'center', gap: 5, textTransform: 'none', letterSpacing: 0, boxShadow: mat === m ? `inset 0 0 0 2px ${H.ink}` : `inset 0 0 0 1px ${H.rule}` }}>
          <i style={{ width: 14, height: 14, borderRadius: 3, background: WALL_MATS[m].color, display: 'inline-block' }} />{countOf(inv, WALL_MATS[m].item)}
        </button>
      ))}
      <button type="button" data-act="walls-down" aria-pressed={down} style={btn(down)} onClick={() => setWallsDown(!down)}>{down ? 'Walls up' : 'Walls down'}</button>
      {t !== 'look' && ROOF_STYLES.map(r => (
        <button key={r} type="button" data-roof={r} aria-pressed={roof === r} style={{ ...btn(roof === r), height: 30, fontSize: 11 }} onClick={() => setWorks({ ...currentWorks(), roof: r })}>{r}</button>
      ))}
    </div>
  )
}

// the garden bank's store (garden-bank.ts): one pool, every chest a door into it
let bank: Bank | null = null
const SERVER_BANK: Bank = freshBank()
const bsubs = new Set<() => void>()
const getB = (): Bank => { if (!bank) bank = typeof window === 'undefined' ? SERVER_BANK : loadBank(); return bank }
export function setBank(b: Bank) { bank = b; saveBank(b); bsubs.forEach(f => f()) }
export const useBank = () => useSyncExternalStore(f => { bsubs.add(f); return () => { bsubs.delete(f) } }, getB, () => SERVER_BANK)

// placing: which room, its turn, and where the ghost stands now (set by the scene each frame)
// `hand` (M45): the thing came from the HOTBAR (held in hand), not from a menu. It follows the stance: stow or swap and the
// ghost goes; E taps set it, an E hold turns it; R stays the stance's key (draw / stow), Esc is not a cancel.
type Placing = { kind: RoomKind; q: number } | { kind: 'chest'; item: string; q: number; hand?: true } | { kind: 'piece'; item: string; q: number; hand?: true } | null
let placing: Placing = null
const ghost = { x: 0, z: 0 }
const psubs = new Set<() => void>()
const setPlacing = (p: Placing) => { placing = p; psubs.forEach(f => f()) }
export const usePlacing = () => useSyncExternalStore(f => { psubs.add(f); return () => { psubs.delete(f) } }, () => placing, () => null)
export const isPlacing = () => placing !== null
/** M45: what the keeper holds drives a placing from the hand. `id` = the held furniture / Keepstone id, or null when the hand
 *  holds nothing that places (or a panel / the planner is up). A menu placing (rooms, the table) is never touched. */
export function holdFromHand(id: string | null) {
  const want: 'piece' | 'chest' | null = id == null ? null : isPiece(id) ? 'piece' : id in KEEPSTONES ? 'chest' : null
  const cur = placing
  if (!want || !id) { if (cur && 'hand' in cur && cur.hand) setPlacing(null); return }
  if (cur && !('hand' in cur && cur.hand)) return   // a menu placing is up: it wins until it ends
  if (cur && cur.kind === want && cur.item === id) return
  setPlacing({ kind: want, item: id, q: cur && 'q' in cur ? cur.q : 0, hand: true })
}
const fromHand = (p: Placing) => !!p && 'hand' in p && !!p.hand
/** Where a ghost stands: under the pointer while flying (build-mode.tsx), else `ahead` metres in front of the keeper. */
function ghostAt(p: Pose, ahead: number, snap: number) {
  const b = buildPoint(), x = b ? b.x : p.x - Math.sin(p.yaw) * ahead, z = b ? b.z : p.z - Math.cos(p.yaw) * ahead
  ghost.x = Math.round(x * snap) / snap; ghost.z = Math.round(z * snap) / snap
}
/** The keeper's pose as the scene last saw it (the table's Plan lifts off from here). */
let lastPose: React.MutableRefObject<Pose> | null = null
/** Lift into build mode, optionally with something on the pointer already. */
function startBuild(p: Placing) {
  const at = lastPose?.current ?? { x: TABLE.x, z: TABLE.z + 4, yaw: 0 }
  if (!isBuilding()) enterBuild(at)
  setPlacing(p)
}

/** Confirm the ghost where it stands. */
function confirmPlace(owned: ReadonlySet<string>) {
  if (!placing) return
  if (placing.kind === 'piece') {
    const item = placing.item, c = placePiece(getW(), owned, getInv(), item, ghost.x, ghost.z, placing.q)
    if (!c) { const v = canPlacePiece(getW(), owned, item, ghost.x, ghost.z, placing.q, getInv()); hudSay(v.ok ? 'Cannot set it there.' : v.why, 'info'); return }
    setInv(c.inv); setWorks(c.works)
    // keep placing while more of the same are in the bag (a row of stools is one job, not five trips to the table)
    if (countOf(c.inv, item) > 0) hudSay(`${FURNITURE[item].name} set · ${countOf(c.inv, item)} more in the bag · ${placing.hand ? 'hold R to put it away' : 'Esc stops'}`, 'item', 4)
    else { setPlacing(null); hudSay(`${FURNITURE[item].name} set.`, 'item', 3) }
    return
  }
  if (placing.kind === 'chest') {
    const c = placeChest(getW(), owned, getInv(), ghost.x, ghost.z, placing.q, Date.now(), placing.item)
    if (!c) { const v = canPlaceChest(getW(), owned, ghost.x, ghost.z, placing.q, getInv(), placing.item); hudSay(v.ok ? 'Cannot set a Keepstone there.' : v.why, 'info'); return }
    setInv(c.inv); setWorks(c.works); setPlacing(null)
    hudSay(`Keepstone set · the bank holds ${bankCap(chestsStanding(c.works))} stacks now.`, 'item', 5)
    return
  }
  const r = place(getW(), owned, getInv(), placing.kind, ghost.x, ghost.z, placing.q, Date.now(), getB())
  if (!r) { const v = canPlace(getW(), owned, placing.kind, ghost.x, ghost.z, placing.q, getInv(), getB()); hudSay(v.ok ? 'Cannot build there.' : v.why, 'info'); return }
  setInv(r.inv); if (r.bank) setBank(r.bank); setPlacing(null)
  // the first Farm of a garden comes with one starter packet of tier-1 seeds in its store (farmroom.ts), once
  const st = r.room.kind === 'farm' ? grantStarter(currentFarm(), r.works, r.room.id) : null
  if (st) setFarm(st.sv)
  setWorks(st ? st.works : r.works)
  hudSay(`${ROOMS[r.room.kind].name} · the scaffolding is up. Ready in ${Math.round(ROOMS[r.room.kind].raiseMs / 1000)} s.${st?.given ? ' A packet of seeds waits in its store.' : ''}`, 'item', 5)
}

/** While placing: R turns, E / Enter sets, Esc cancels. Capture phase, so the page's own E never sees these keys.
 *  From the HAND (M45): a TAP of E sets, a HOLD of E turns (a quarter every HOLD_MS while held); R and Esc pass through. */
export function usePlacingKeys(owned: ReadonlySet<string>) {
  const p = usePlacing()
  const ownedRef = useRef(owned); ownedRef.current = owned
  useEffect(() => {
    if (!p) return
    let eDown: { turned: boolean; t: ReturnType<typeof setInterval> } | null = null
    const stopE = () => { if (eDown) clearInterval(eDown.t); eDown = null }
    const down = (e: KeyboardEvent) => {
      if (!placing) return
      if (fromHand(placing)) {
        if (e.code === 'KeyE') {
          if (!e.repeat && !eDown) { const h = { turned: false, t: setInterval(() => { if (placing) { h.turned = true; setPlacing({ ...placing, q: (placing.q + 1) % 4 }) } }, HAND_TURN_MS) }; eDown = h }
        } else if (e.code === 'Enter') confirmPlace(ownedRef.current)
        else return
        e.preventDefault(); e.stopImmediatePropagation(); return
      }
      if (e.code === 'KeyR') setPlacing({ ...placing, q: (placing.q + 1) % 4 })
      else if (e.code === 'KeyE' || e.code === 'Enter') confirmPlace(ownedRef.current)
      else if (e.code === 'Escape') setPlacing(null)
      else return
      e.preventDefault(); e.stopImmediatePropagation()
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE' || !eDown) return
      const turned = eDown.turned; stopE()
      if (!turned) confirmPlace(ownedRef.current)
      e.preventDefault(); e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true)
    return () => { stopE(); window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true) }
  }, [p])
}
/** An E held this long turns the hand's ghost a quarter (and again each time after, while held). */
export const HAND_TURN_MS = 350


// ── the scene ─────────────────────────────────────────────────────────────────────────────────────────────────
const WOOD = '#8f6038', WALL = '#d8b46e', ROOF = '#7a4a2a', SHEET = '#5aa9ff'
const GHOST_OK = '#5aa9ff', GHOST_BAD = '#ff6a5a'
type Pose = { x: number; z: number; yaw: number }

export function WorkshopScene({ pose, owned }: { pose: React.MutableRefObject<Pose>; owned: ReadonlySet<string> }) {
  lastPose = pose
  const w = useWorks(), p = usePlacing()
  // a raising room re-renders once a second until it stands
  const [, tick] = useState(0)
  const anyRaising = w.rooms.some(r => !raised(r))
  useEffect(() => { if (!anyRaising) return; const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t) }, [anyRaising])
  useEffect(() => { stationTick(); const t = setInterval(() => stationTick(), 1000); return () => clearInterval(t) }, [])
  return (
    <>
      <PlanningTable />
      {w.rooms.map(r => (raised(r) ? <RoomMesh key={r.id} r={r} /> : <Scaffold key={r.id} r={r} />))}
      {allChests(w).map(c => <Keepstone key={c.id} c={c} pose={pose} />)}
      {w.pieces.map(pc => <PieceMesh key={pc.id} p={pc} />)}
      <MoglinsAtWork w={w} />
      <BlueprintPicked />
      {w.walls && <DrawnWalls walls={w.walls} roof={w.roof ?? 'gable'} floors={w.floors} unbuilt={unbuiltRooms(w.walls, w.paid)} />}
      <WallGhost />
      {p && (p.kind === 'piece' ? <PieceGhost pose={pose} owned={owned} item={p.item} q={p.q} /> : p.kind === 'chest' ? <ChestGhost pose={pose} owned={owned} q={p.q} item={p.item} /> : <Ghost pose={pose} owned={owned} kind={p.kind} q={p.q} />)}
    </>
  )
}

// ── MOGLINS, SEEN (moglin-model.tsx; Alex 11-18 "add one to my garden so i can check em out") ───────────────────
const GARB_OF: Partial<Record<string, MoglinGarb>> = { cook: 'apron', carpenter: 'toolbelt', alchemist: 'scarf', smith: 'toolbelt', stonemason: 'toolbelt', jeweler: 'scarf' }
/** Every Moglin keeping a room stands at its bench, working (the village re-reads every few seconds: a panel assigns). */
function MoglinsAtWork({ w }: { w: Works }) {
  const [v, setV] = useState(() => (typeof window === 'undefined' ? null : loadVillage()))
  useEffect(() => { const t = setInterval(() => setV(loadVillage()), 3000); return () => clearInterval(t) }, [])
  if (!v) return null
  return (
    <>
      {v.moglins.map(m => {
        const r = m.room ? w.rooms.find(x => x.id === m.room) : undefined
        if (!r || !raised(r)) return null
        const at = toWorld(r, 0, ROOMS[r.kind].d / 2 - 2.35)   // in front of the bench, facing it (local +z = the back wall)
        return (
          <group key={m.id} position={[at.x, GROUND_Y, at.z]} rotation-y={-r.q * Math.PI / 2}>
            <MoglinModel action="work" garb={GARB_OF[m.profession] ?? 'none'} tone={furOf(m.id)} seed={m.id.length} />
          </group>
        )
      })}
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
      {r.kind === 'farm' && <FarmInterior r={r} />}
    </group>
  )
}
function Bench({ r, x, z }: { r: Room; x: number; z: number }) {
  return (
    <group position={[x, GROUND_Y, z]} rotation-y={-r.q * Math.PI / 2}>
      {r.kind !== 'cooking' && r.kind !== 'farm' && <mesh position-y={0.5}><boxGeometry args={[2.4, 1, 0.8]} /><meshLambertMaterial color={WOOD} /></mesh>}
      {r.kind === 'cooking' && (
        <>
          {/* THE HEARTH (canon: open coals, no vessel, no grate or flue): a low stone ring, a glowing bed, a wooden spit on
              two forked posts with a rinn on it */}
          <mesh position-y={0.22}><boxGeometry args={[2.0, 0.44, 1.1]} /><meshLambertMaterial color="#9a9286" /></mesh>
          <mesh position-y={0.45}><boxGeometry args={[1.6, 0.04, 0.7]} /><meshBasicMaterial color="#ff8a3a" /></mesh>
          {[-0.4, 0.1, 0.45].map((x, k) => <mesh key={k} position={[x, 0.5, (k - 1) * 0.15]}><boxGeometry args={[0.18, 0.08, 0.14]} /><meshBasicMaterial color={k % 2 ? '#ffcf7a' : '#e0551f'} /></mesh>)}
          {[-0.85, 0.85].map(x => <mesh key={x} position={[x, 0.85, 0]}><cylinderGeometry args={[0.04, 0.05, 0.9, 6]} /><meshLambertMaterial color="#6b4a2a" /></mesh>)}
          <mesh position={[0, 1.22, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.025, 0.025, 1.9, 6]} /><meshLambertMaterial color="#8a6a45" /></mesh>
          <mesh position={[0, 1.13, 0]} scale={[1, 0.45, 0.45]}><sphereGeometry args={[0.24, 10, 8]} /><meshLambertMaterial color="#d9a75c" /></mesh>
        </>
      )}
      {r.kind === 'farm' && <FarmCrate />}
      {r.kind === 'alchemy' && (
        <>
          {/* THE CAULDRON (canon: the cauldron boils; homely words, no foundry): a round clay pot on three stones over a
              small bed of coals, the brew lit from within; stoppered bottles at the bench's end */}
          {[-0.32, 0.32, 0].map((x, k) => <mesh key={k} position={[x, 1.1, k === 2 ? 0.28 : -0.14]}><dodecahedronGeometry args={[0.14, 0]} /><meshLambertMaterial color="#9a9286" /></mesh>)}
          <mesh position={[0, 1.08, 0]}><boxGeometry args={[0.6, 0.04, 0.5]} /><meshBasicMaterial color="#ff8a3a" /></mesh>
          <mesh position={[0, 1.42, 0]}><sphereGeometry args={[0.36, 14, 10, 0, Math.PI * 2, Math.PI * 0.18, Math.PI * 0.82]} /><meshLambertMaterial color="#7a5a44" side={2} /></mesh>
          <mesh position={[0, 1.66, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.3, 16]} /><meshBasicMaterial color="#8fe3ff" /></mesh>
          {[0, 1, 2].map(k => <mesh key={k} position={[0.85, 1.12, -0.2 + k * 0.2]}><cylinderGeometry args={[0.06, 0.07, 0.22, 8]} /><meshBasicMaterial color={['#8fe3ff', '#c8b8ff', '#4aa3e6'][k]} /></mesh>)}
        </>
      )}
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
    ghostAt(pose.current, Math.max(w, d) / 2 + 2.5, 1)
    g.current?.position.set(ghost.x, GROUND_Y + WALL_H / 2, ghost.z)
    const ok = canPlace(getW(), owned, kind, ghost.x, ghost.z, q, getInv(), getB()).ok
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
function ChestGhost({ pose, owned, q, item }: { pose: React.MutableRefObject<Pose>; owned: ReadonlySet<string>; q: number; item: string }) {
  const g = useRef<THREE.Group>(null), mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    ghostAt(pose.current, 1.8, 2)
    g.current?.position.set(ghost.x, GROUND_Y + CHEST_H / 2, ghost.z)
    mat.current?.color.set(canPlaceChest(getW(), owned, ghost.x, ghost.z, q, getInv(), item).ok ? GHOST_OK : GHOST_BAD)
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
export function PieceBody({ item }: { item: string }) {
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
    case 'water_tap': return <><Bx p={[0, 0.05, 0]} s={[0.7, 0.1, 0.7]} c={c} /><Bx p={[0, 0.7, 0]} s={[0.5, 1.2, 0.5]} c={c} /><Bx p={[0, 1.36, 0]} s={[0.6, 0.1, 0.6]} c="#77716b" />{[-0.15, 0, 0.15].map(x => <mesh key={x} position={[x, 1.0, 0.255]}><boxGeometry args={[0.08, 0.08, 0.02]} /><meshBasicMaterial color={f.glow} /></mesh>)}<Bx p={[0, 0.55, 0.36]} s={[0.1, 0.1, 0.24]} c="#77716b" /><Bx p={[0, 0.47, 0.46]} s={[0.1, 0.16, 0.08]} c="#77716b" /></>
    case 'water_tank': return <><mesh position-y={0.7}><cylinderGeometry args={[0.48, 0.48, 1.3, 14]} /><meshLambertMaterial color={c} /></mesh>{[0.15, 0.7, 1.25].map(y => <mesh key={y} position-y={y}><cylinderGeometry args={[0.5, 0.5, 0.06, 14]} /><meshLambertMaterial color="#77716b" /></mesh>)}<mesh position-y={1.36}><cylinderGeometry args={[0.42, 0.48, 0.08, 14]} /><meshLambertMaterial color="#77716b" /></mesh></>
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
    ghostAt(pose.current, Math.max(f.w, f.d) / 2 + 1.2, 4)
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
  if (near.kind === 'bench' && near.room.kind === 'farm') return <FarmHost room={near.room} onClose={onClose} />
  if (near.kind === 'bench') return <BenchPanel room={near.room} onClose={onClose} />
  if (near.kind === 'chest') return <BankPanel id={near.id} onClose={onClose} />
  if (near.kind === 'piece') return <PiecePanel id={near.id} owned={owned} onClose={onClose} />
  return null
}

// ── THE PLANNING TABLE (Alex 11-18): a big PLAN button that lifts you into the flying build mode (build-mode.tsx),
// and beside it a strip of icons, one per thing the table builds. Tap an icon: its card drops down (what it is, what it
// costs, a Build button lit once the bank + bag hold enough). Build lifts you too, with that thing on the pointer.
// Costs pay from the Keepstone first (rooms.ts › payCost). Icons are placeholders until Alex draws them.
type TablePick = 'keepstone' | RoomKind
const TABLE_PICKS: readonly TablePick[] = ['keepstone', ...ROOM_ORDER]
const PICK_LOOK: Record<TablePick, { glyph: string; tint: string }> = {
  keepstone: { glyph: '◆', tint: '#8fc6e8' }, rinnshop: { glyph: '≈', tint: '#5aa9c8' }, farm: { glyph: '❀', tint: '#6fae4f' }, cooking: { glyph: '♨', tint: '#d9774a' },
  alchemy: { glyph: '⚗', tint: '#9a7ad8' }, smith: { glyph: '⚒', tint: '#77726c' }, carpentry: { glyph: '⌂', tint: '#b0884f' }, stonemason: { glyph: '▦', tint: '#a9a090' },
}
const pickName = (k: TablePick) => (k === 'keepstone' ? 'Keepstone' : ROOMS[k].name)
const pickCost = (k: TablePick) => (k === 'keepstone' ? KEEPSTONE_RECIPE : ROOMS[k].cost)
/** Can the table build this now? `state` drives the icon's dot and the card's button. */
function pickState(k: TablePick, inv: Inv, bank: Bank, w: Works): { state: 'ready' | 'short' | 'built' | 'soon' | 'full'; note?: string } {
  if (k === 'keepstone') {
    if (chestsStanding(w) >= MAX_CHESTS) return { state: 'full', note: `${MAX_CHESTS} Keepstones stand. That is all a plot holds.` }
    if (countOf(inv, KEEPSTONE) > 0) return { state: 'ready', note: `${countOf(inv, KEEPSTONE)} in the bag, ready to set.` }
    return shortOf(KEEPSTONE_RECIPE, inv, bank) ? { state: 'short', note: 'Prospect blankstone and a mana shard in the Wilds.' } : { state: 'ready' }
  }
  const def = ROOMS[k], built = w.rooms.find(r => r.kind === k)
  if (built) return { state: 'built', note: raised(built) ? 'Built.' : 'Going up.' }
  if (!def.open) return { state: 'soon', note: 'Drawn up, not ready to build yet.' }
  return shortOf(def.cost, inv, bank) ? { state: 'short', note: 'Prune goldwood in the Wilds for logs.' } : { state: 'ready' }
}
/** Build: lift into the flying planner with it on the pointer. A Keepstone is made first (bank-first) unless one is in the bag. */
function buildPick(k: TablePick): boolean {
  if (k !== 'keepstone') { startBuild({ kind: k, q: 0 }); hudSay(`Planning the ${ROOMS[k].name} · click (or Place) sets it · R turns · Esc cancels`, 'info', 8); return true }
  if (chestsStanding(getW()) >= MAX_CHESTS) { hudSay(`${MAX_CHESTS} Keepstones already stand.`, 'info'); return false }
  if (countOf(getInv(), KEEPSTONE) < 1) {
    const m = makeKeepstoneFrom(getInv(), getB())
    if (!m) { hudSay(shortOf(KEEPSTONE_RECIPE, getInv(), getB()) ? 'Prospect blankstone and a mana shard in the Wilds.' : 'No room in the bag.', 'info'); return false }
    setInv(m.inv); if (m.bank) setBank(m.bank)
  }
  startBuild({ kind: 'chest', item: KEEPSTONE, q: 0 })
  hudSay('Setting a Keepstone · click (or Place) sets it · R turns · Esc cancels', 'info', 8)
  return true
}

/** The icon strip: scrolls sideways; the open icon is ringed; a green dot = buildable now. */
function BuildStrip({ sel, onSel, size = 56 }: { sel: TablePick | null; onSel: (k: TablePick) => void; size?: number }) {
  const inv = useInv(), bank = useBank(), w = useWorks()
  return (
    <div data-build-strip style={{ display: 'flex', gap: 8, overflowX: 'auto', overflowY: 'hidden', padding: '4px 2px 6px', scrollbarWidth: 'thin', minWidth: 0, flex: 1, WebkitOverflowScrolling: 'touch' }}>
      {TABLE_PICKS.map(k => {
        const st = pickState(k, inv, bank, w).state, look = PICK_LOOK[k], on = sel === k
        return (
          <button key={k} type="button" data-pick={k} data-state={st} title={pickName(k)} onClick={() => onSel(k)}
            style={{ flex: '0 0 auto', width: size, height: size + 16, border: 0, borderRadius: 12, padding: 0, cursor: 'pointer', position: 'relative',
              background: on ? 'rgba(255,250,235,.95)' : 'rgba(255,250,235,.55)', boxShadow: on ? `inset 0 0 0 2px ${H.ink}` : `inset 0 0 0 1px ${H.rule}`,
              opacity: st === 'soon' || st === 'built' || st === 'full' ? 0.5 : 1, display: 'grid', placeItems: 'center', gridTemplateRows: `${size - 8}px 16px` }}>
            <span style={{ width: size - 18, height: size - 18, borderRadius: 10, background: look.tint, color: '#fff', display: 'grid', placeItems: 'center', fontSize: size * 0.42, lineHeight: 1, textShadow: '0 1px 2px rgba(0,0,0,.35)' }}>{look.glyph}</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: H.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: size - 4 }}>{pickName(k).replace(' room', '')}</span>
            {st === 'ready' && <span style={{ position: 'absolute', top: 5, right: 5, width: 9, height: 9, borderRadius: 5, background: '#5cbf62', boxShadow: '0 0 0 2px rgba(255,250,235,.9)' }} />}
          </button>
        )
      })}
    </div>
  )
}

/** The dropdown under an icon: what it is, what it costs (bank + bag, the Keepstone's share shown), Build. */
function BuildCard({ k, onBuilt }: { k: TablePick; onBuilt: () => void }) {
  const inv = useInv(), bank = useBank(), w = useWorks()
  const st = pickState(k, inv, bank, w), cost = pickCost(k)
  const blurb = k === 'keepstone' ? `Every Keepstone opens the one bank, shared by all your keepers. Each adds ${CHEST_SLOTS} slots.` : ROOMS[k].blurb
  const size = k === 'keepstone' ? `${chestsStanding(w)} of ${MAX_CHESTS} standing` : `${ROOMS[k].w}×${ROOMS[k].d} m · ${Math.round(ROOMS[k].raiseMs / 1000)} s to raise`
  const inBag = k === 'keepstone' && countOf(inv, KEEPSTONE) > 0
  return (
    <div data-build-card={k} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,250,235,.7)', boxShadow: `inset 0 0 0 1px ${H.rule}`, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ ...hearthDisplay, fontSize: 16, fontWeight: 600, color: H.ink, flex: 1 }}>{pickName(k)}</div>
        <span style={lab}>{size}</span>
      </div>
      <div style={{ fontSize: 12.5, color: H.inkSoft, lineHeight: 1.35 }}>{blurb}</div>
      {!inBag && (
        <div style={{ display: 'grid', gap: 2 }}>
          {cost.map(c => {
            const fromBank = bankCount(bank, c.id), have = haveFor(inv, bank, c.id), okc = have >= c.n
            return (
              <div key={c.id} data-cost={c.id} style={{ fontSize: 12.5, display: 'flex', gap: 6, color: okc ? H.ink : '#b5452c' }}>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{Math.min(have, c.n)} / {c.n}</span>
                <span style={{ flex: 1 }}>{itemDef(c.id).name}</span>
                <span style={{ color: H.inkSoft, fontSize: 11 }}>{fromBank ? `${fromBank} in the Keepstone` : ''}{fromBank && countOf(inv, c.id) ? ' · ' : ''}{countOf(inv, c.id) ? `${countOf(inv, c.id)} in the bag` : ''}</span>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: H.inkSoft, flex: 1 }}>{st.note ?? (st.state === 'ready' ? 'The Keepstone pays first, the bag tops up.' : '')}</span>
        {(st.state === 'ready' || st.state === 'short') && (
          <span data-act="build"><HearthButton primary disabled={st.state !== 'ready'} onClick={() => { if (buildPick(k)) onBuilt() }}>{inBag ? 'Set' : 'Build'}</HearthButton></span>
        )}
      </div>
    </div>
  )
}

function TablePanel({ owned, onClose }: { owned: ReadonlySet<string>; onClose: () => void }) {
  const inv = useInv(), w = useWorks()
  const [sel, setSel] = useState<TablePick | null>(null)
  return (
    <HearthFrame title="The planning table" maxWidth={560} onClose={onClose} fixed dataPanel="planning-table">
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', minWidth: 0 }}>
          <button type="button" data-act="plan" onClick={() => { startBuild(null); onClose(); hudSay(window.matchMedia?.('(pointer: coarse)').matches ? 'Planning · drag to move · pinch to zoom' : 'Planning · drag or WASD to move · wheel zooms · Q Z turn · Esc lands', 'info', 8) }}
            style={{ flex: '0 0 auto', width: 92, border: 0, borderRadius: 14, cursor: 'pointer', background: '#e0823f', color: '#fff', ...hearthDisplay, fontSize: 18, fontWeight: 700, letterSpacing: '0.08em', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
            PLAN
          </button>
          <BuildStrip sel={sel} onSel={k => setSel(s => (s === k ? null : k))} />
        </div>
        {sel ? <BuildCard k={sel} onBuilt={onClose} /> : <div style={{ fontSize: 12.5, color: H.inkSoft }}>Tap a room to see what it takes. Plan flies you over your ground. Building takes from your Keepstone first.</div>}
        {/* M45: furniture and found Keepstones are set from the HAND now (hold one from the hotbar, E sets it); the table keeps rooms + plans */}
      </div>
    </HearthFrame>
  )
}

/** M37 slice 4: the plan's BILL OF MATERIALS, in the plan-mode bar. Shows once something is planned: each part with
 *  have / need (the Keepstone and the bag count together), red when short, and Build (enabled only when it is all there). */
function PlanBom() {
  const w = useWorks(), inv = useInv(), bank = useBank()
  const bom = useMemo(() => billOf(w.walls ?? {}, w.paid, inv, bank), [w.walls, w.paid, inv, bank])
  if (bom.empty) return null
  const build = () => {
    const c = currentWorks(), r = buildPlan(c.walls ?? {}, c.paid, getInv(), getB())
    if (!r.ok) { hudSay(r.why, 'info'); return }
    setInv(r.inv); if (r.bank) setBank(r.bank); setWorks({ ...c, walls: r.walls, paid: r.paid })
    hudSay('Built. The house stands.', 'item')
  }
  return (
    <div data-plan-bom data-ready={bom.ok} style={{ position: 'fixed', bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', width: 'min(400px, calc(100vw - 24px))', zIndex: 41, pointerEvents: 'auto', display: 'grid', gap: 4, padding: '8px 10px', borderRadius: 12, background: 'rgba(255,250,235,.92)', boxShadow: '0 2px 8px rgba(0,0,0,.2)', color: H.ink }}>
      <div style={{ font: '700 11px system-ui', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.7 }}>Plan · {bom.pieces} m of wall{bom.rooms ? ` · ${bom.rooms} room${bom.rooms > 1 ? 's' : ''}` : ''} · materials</div>
      {bom.lines.map(l => (
        <div key={l.id} data-bom-line={l.id} data-need={l.n} data-have={l.have} data-short={l.short} style={{ display: 'flex', gap: 6, fontSize: 12.5, color: l.short ? '#b5452c' : H.ink }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, minWidth: 54 }}>{Math.min(l.have, l.n)} / {l.n}</span><span>{l.name}</span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 11.5, color: H.inkSoft }}>{bom.ok ? 'Everything is here.' : 'Planks: Carpentry. Bricks and panes: Stonery.'}</span>
        <span data-act="build-plan"><HearthButton primary disabled={!bom.ok} onClick={build}>Build</HearthButton></span>
      </div>
    </div>
  )
}
/** Flying (build-mode.tsx): the strip rides along at the top so you can pick the next thing without landing. */
export function BuildBar({ owned }: { owned: ReadonlySet<string> }) {
  const b = useBuildMode(), p = usePlacing(), tool = useBuildTool()
  const [sel, setSel] = useState<TablePick | null>(null), [cat, setCat] = useState(false)
  const ownedRef = useRef(owned); ownedRef.current = owned
  const touchy = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  // a mouse click on the ground places what is on the pointer
  useEffect(() => { if (!b) return; onBuildTap(() => { if (placing) confirmPlace(ownedRef.current) }); return () => onBuildTap(null) }, [b])
  useEffect(() => { if (!b) { setSel(null); setCat(false) } }, [b])
  if (!b) return null
  return (
    <div data-build-bar style={{ position: 'fixed', top: typeof window !== 'undefined' && window.innerWidth < 600 ? 112 : 96, left: '50%', transform: 'translateX(-50%)', width: 'min(560px, calc(100vw - 24px))', zIndex: 41, pointerEvents: 'auto', display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 14, background: 'rgba(255,250,235,.88)', boxShadow: '0 2px 10px rgba(0,0,0,.25)', minWidth: 0 }}>
        <button type="button" data-act="land" onClick={() => { setPlacing(null); exitBuild() }}
          style={{ flex: '0 0 auto', border: 0, borderRadius: 10, padding: '0 10px', height: 52, cursor: 'pointer', background: H.ink, color: '#fff', font: '700 12px system-ui', lineHeight: 1.15 }}>Back to<br />keeper</button>
        <BuildStrip sel={sel} onSel={k => { setBuildTool('look'); setSel(s => (s === k ? null : k)) }} size={44} />
      </div>
      {cat && <Catalog onPick={() => setCat(false)} />}
      <WallTools owned={ownedRef} cat={cat} onCat={() => { setSel(null); setCat(c => !c) }} />
      <PlanBom />
      {tool === 'blueprint' && <BlueprintBar />}
      {sel && <BuildCard k={sel} onBuilt={() => setSel(null)} />}
      {!p && !sel && <div data-build-hint style={{ justifySelf: 'center', fontSize: 11.5, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>{tool === 'walls' ? `Drag along the grid to draw a plan · it costs nothing until you Build · ${touchy ? 'two fingers move the view' : 'right-drag or WASD moves the view'}` : tool === 'erase' ? 'Drag along a wall to take it down · what was built comes back to the bag' : tool === 'door' ? 'Tap a wall for a 2 m doorway · tap a door to fill it in' : tool === 'window' ? 'Tap a wall for a window · tap it again to fill it in' : tool === 'paint' ? 'Pick a wood, then tap a wall (a plank swaps) or a floor (the whole room)' : <>Pick something to build{touchy ? '' : ' · drag to move · wheel to zoom · WASD · Q Z turn'}</>}</div>}
    </div>
  )
}

function FarmHost({ room, onClose }: { room: Room; onClose: () => void }) {
  const w = useWorks()
  return <FarmPanel room={room} works={w} setWorks={setWorks} onClose={onClose} />
}

// ── M43: THE STATION = a work panel + its own STORE panel beside it (desktop side by side; phone stacked) ─────────────
let openBench: string | null = null   // the room whose panel is open: with no Moglin, the keeper works a focus only then
/** Re-start a station's clock at now (its worker or its stock changed): idle or unstaffed time is never banked. */
function touchWork(roomId: string) {
  const w = getW(), r = w.rooms.find(x => x.id === roomId); if (!r) return
  setWorks(setStation(w, roomId, touch(stationOf(r), Date.now())))
}
/** Who works a room and how fast: its Moglin (its CRAFT grade), else the keeper while the panel is open (a focus only), else nobody (0). */
function workerOf(r: Room, v: Village): { moglin?: Village['moglins'][number]; speed: number } {
  const m = v.moglins.find(x => x.room === r.id && WORKS_IN[x.profession].includes(r.kind))
  return m ? { moglin: m, speed: moglinSpeed(skillIn(m, r.kind, 'craft')) } : { speed: openBench === r.id ? 1 : 0 }
}
/** Run every station to now. Offline catch-up is the same call: `last` is a timestamp, the Moglin's hours since are worked
 *  out of the store into the output (station-queue.ts: stockpile above the 30 reserve, capped at 30 a product). */
export function stationTick(now = Date.now()) {
  const w = getW(); if (!w.rooms.some(r => raised(r, now))) return
  const v = loadVillage(); let nw = w, changed = false
  for (const r of w.rooms) {
    if (!raised(r, now)) continue
    const { moglin, speed } = workerOf(r, v)
    if (!moglin && (speed <= 0 || !(r.work?.focus || r.work?.run))) continue   // the keeper only ever works a focus
    const a = advance(stationOf(r), now, speed, moglin ? stockJobs(r.kind) : [], moglin ? { grade: luckOf(moglin), rnd: Math.random } : undefined)
    if (a.active || !r.work) { nw = setStation(nw, r.id, a.station); changed = true }   // an idle Moglin saves nothing (the panel re-starts its clock when the stock changes)
  }
  if (changed) setWorks(nw)
}
const fmtSecs = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s` }
function useNarrow() {
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.innerWidth < 760)
  useEffect(() => { const f = () => setN(window.innerWidth < 760); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return n
}
const QTYS = [1, 10, 99, 'max'] as const
type Qty = (typeof QTYS)[number]
interface Pick { job: Job | null; qty: Qty }

function BenchPanel({ room, onClose }: { room: Room; onClose: () => void }) {
  const inv = useInv(), w = useWorks(), def = ROOMS[room.kind], bankNow = useBank(), narrow = useNarrow()
  const r = w.rooms.find(x => x.id === room.id) ?? room   // the live room (its store moves under the panel)
  const [pick, setPick] = useState<Pick>({ job: null, qty: 10 })
  useEffect(() => { stationTick(); openBench = room.id; touchWork(room.id); return () => { if (openBench === room.id) openBench = null } }, [room.id])
  const foods = Object.keys(BAIT_FROM).filter(id => benchCount(r, inv, id) > 0)
  const inBank = (id: string) => bankCount(bankNow, id)
  const reach = (id: string) => benchCount(r, inv, id) + inBank(id)
  const crafts = (jobs: readonly Job[]) => jobs.filter(j => j.in.some(c => reach(c.id) > 0))
  const cl = (jobs: readonly Job[], title: string, note: string, empty?: string) => <CraftList title={title} note={note} jobs={jobs} r={r} pick={pick} setPick={setPick} empty={empty} />
  const dim = narrow ? '!max-h-none' : ''
  const work = (
    <HearthFrame title={def.name} maxWidth={narrow ? 520 : 520} onClose={onClose} fixed dataPanel="bench" backdrop={false} bodyClass={dim}>
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 12 }}>
        {r.kind === 'rinnshop' && (
          <>
            <div>
              <div style={lab}>Bait · {countOf(inv, 'bait')} in the bag</div>
              <div style={{ fontSize: 12.5, color: H.inkSoft, margin: '4px 0 8px' }}>An offering the rinn come to, one per cast. Cut from the room's store first, then your bag.</div>
              {foods.length ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  {foods.map(id => (
                    <div key={id} data-bait-from={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 13.5, color: H.ink }}>{itemDef(id).name} <span style={{ color: H.inkSoft }}>× {benchCount(r, inv, id)}</span></span>
                      <HearthButton small onClick={() => { const m = makeBaitAt(getW(), r.id, getInv(), id); if (m) { setWorks(m.works); setInv(m.inv) } else hudSay('No room for the bait. Clear a slot in your bag.', 'info') }}>Make bait +{BAIT_FROM[id]}</HearthButton>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 13, color: H.inkSoft }}>Nothing to cut. A small catch, or mast off a pruned tree, makes bait.</div>}
            </div>
            <RinstickList r={r} inv={inv} />
          </>
        )}
        {(Object.keys(BENCH) as FocusSkill[]).filter(s => BENCH[s] === r.kind).map(s => <FocusList key={s} r={r} inv={inv} skill={s} />)}
        {r.kind === 'carpentry' && (
          <>
            {cl(crafts(REFINE), 'Refine', 'Each log works two ways. Pick one to Focus: the station uses every log in its store to make it, one at a time. A Moglin also keeps stacks of each going by itself.', 'No logs to work. Prune trees in the Wilds. Better woods come as your Forestry grows.')}
            {cl(PIECE_JOBS, 'Furniture', 'Pick a piece and Focus a number: the station makes them from its store. They wait in the output. Hold one from the hotbar on your plot and E sets it.', undefined)}
          </>
        )}
        {r.kind === 'stonemason' && cl(crafts(STONE_REFINE), 'Refine', 'Parts for a house plan. Pick one to Focus: the station cuts it from every stone in its store, one at a time. A Moglin also keeps stacks of each going by itself.', 'No blankstone or mana shards to cut. Prospect them in the Wilds.')}
        {r.kind === 'cooking' && cl(ROAST, 'The hearth', 'Roasts wait in the output. Hold one in the Wilds and click to eat it mid-fight. Meat comes from the Smokehouse in the continent\'s towns.')}
        {r.kind === 'alchemy' && cl(BREW, 'The cauldron', 'Potions wait in the output. Hold one and click to drink.')}
        <WorkView r={r} />
        <MoglinDuty r={r} />
      </div>
    </HearthFrame>
  )
  return (
    <div data-station={r.kind} className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[3px] pointer-events-auto overflow-y-auto" onClick={onClose} onContextMenu={e => e.preventDefault()}
      style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: narrow ? 'center' : 'flex-start', justifyContent: 'center', gap: narrow ? 22 : 18, padding: narrow ? '34px 0 24px' : '6vh 16px 24px' }}>
      {work}
      <StorePanel r={r} pick={pick} narrow={narrow} onClose={onClose} />
    </div>
  )
}

/** The store panel: the station's own store, and a SOURCE (your pack, or the Keepstone) to move things in from. Whatever the
 *  selected job needs is lit, with have / need. One tap moves 1 / 10 / all of an item. */
function StorePanel({ r, pick, narrow, onClose }: { r: Room; pick: Pick; narrow: boolean; onClose: () => void }) {
  const inv = useInv(), bank = useBank(), store = roomStore(r)
  const [src, setSrc] = useState<'pack' | 'bank'>('pack')
  const need = new Map<string, number>()
  if (pick.job) { const q = pick.qty === 'max' ? maxAffordableAny(pick.job, r, inv, bank) : pick.qty; const runs = Math.max(1, runsFor(pick.job, q)); for (const c of pick.job.in) need.set(c.id, c.n * runs) }
  const inStore = (id: string) => store.stacks.reduce((a, s) => a + (s.id === id ? s.n : 0), 0)
  const rows = (() => {
    const m = new Map<string, number>()
    if (src === 'pack') { for (const s of inv.slots) if (s) m.set(s.id, (m.get(s.id) ?? 0) + s.n) }
    else { for (const s of bank.stacks) m.set(s.id, (m.get(s.id) ?? 0) + s.n) }
    return [...m].filter(([id]) => roomAccepts(r.kind, id) || need.has(id)).sort((a, b) => (need.has(b[0]) ? 1 : 0) - (need.has(a[0]) ? 1 : 0) || itemDef(a[0]).name.localeCompare(itemDef(b[0]).name))
  })()
  const mv = (id: string, n: number) => {
    touchWork(r.id)
    if (src === 'pack') { const m = stockItemFromBag(getW(), r.id, getInv(), id, n); if (m.moved) { setWorks(m.works); setInv(m.inv) } else if ('why' in m && m.why) hudSay(m.why, 'info') }
    else { const m = stockItemFromBank(getW(), r.id, getB(), id, n); if (m.moved) { setWorks(m.works); setBank(m.bank) } else if (m.why) hudSay(m.why, 'info') }
  }
  const back = (k: number) => { touchWork(r.id); const m = takeFromRoom(getW(), r.id, k, getInv()); if (m.moved) { setWorks(m.works); setInv(m.inv) } else if ('why' in m && m.why) hudSay(m.why, 'info') }
  const tab = (on: boolean): React.CSSProperties => ({ border: 0, borderRadius: 10, height: 32, padding: '0 14px', cursor: 'pointer', font: '700 12px system-ui', letterSpacing: '.06em', textTransform: 'uppercase', background: on ? H.ink : 'rgba(58,39,22,.08)', color: on ? '#fff' : H.ink })
  return (
    <HearthFrame title="Store" maxWidth={narrow ? 520 : 400} onClose={onClose} fixed dataPanel="station-store" backdrop={false} bodyClass={narrow ? '!max-h-none' : ''}>
      <div data-room-store={r.kind} style={{ padding: '26px 16px 14px', display: 'grid', gap: 10 }}>
        <div>
          <div style={lab}>In the station · {store.stacks.length} / {ROOM_STORE_SLOTS} · keeps {ROOM_KEEPS[r.kind]}</div>
          {store.stacks.length ? (
            <div style={{ ...grid, marginTop: 6 }}>
              {store.stacks.map((st, k) => <Cell key={k} s={st} data-room-slot={k} title=" · tap to take back to the bag" onClick={() => back(k)} />)}
            </div>
          ) : <div style={{ fontSize: 12.5, color: H.inkFaint, marginTop: 6 }}>Empty. The station works from what you put here.</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ ...lab, flex: 1 }}>Bring from</span>
          <button type="button" data-src="pack" aria-pressed={src === 'pack'} style={tab(src === 'pack')} onClick={() => setSrc('pack')}>Pack</button>
          <button type="button" data-src="bank" aria-pressed={src === 'bank'} style={tab(src === 'bank')} onClick={() => setSrc('bank')}>Keepstone</button>
        </div>
        {pick.job && <div style={{ fontSize: 12, color: H.inkSoft }}>Needed for {pick.job.label.toLowerCase()} ({itemDef(pick.job.out.id).name}): lit below.</div>}
        {rows.length ? (
          <div data-src-list={src} style={{ display: 'grid', gap: 4 }}>
            {rows.map(([id, n]) => {
              const nd = need.get(id), have = inStore(id), lit = nd !== undefined, short = lit && have < nd!
              return (
                <div key={id} data-src-item={id} data-have={have} data-need={nd ?? 0} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 8, background: lit ? (short ? 'rgba(214,150,60,.22)' : 'rgba(110,170,90,.22)') : 'transparent', boxShadow: lit ? `inset 0 0 0 1px ${short ? '#c98a2e' : '#6aa35a'}` : 'none' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: H.ink }}>{itemDef(id).name} <span style={{ color: H.inkSoft }}>× {n}</span>
                    {lit && <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: short ? '#9a5f10' : '#3d7a30' }}>in station {have} / need {nd}</span>}
                  </span>
                  <HearthButton small onClick={() => mv(id, 1)}><span data-move="1">+1</span></HearthButton>
                  <HearthButton small onClick={() => mv(id, 10)}><span data-move="10">+10</span></HearthButton>
                  <HearthButton small onClick={() => mv(id, n)}><span data-move="all">All</span></HearthButton>
                </div>
              )
            })}
          </div>
        ) : <div style={{ fontSize: 12.5, color: H.inkFaint }}>{src === 'pack' ? 'Nothing in your pack that this station keeps.' : 'Nothing in the Keepstone that this station keeps.'}</div>}
      </div>
    </HearthFrame>
  )
}
/** max-affordable in output items, counting what the station holds (a focus takes from the STORE only) */
const maxAffordableAny = (j: Job, r: Room, _inv: Inv, _bank: Bank) => maxAffordable(j, r.store)

/** What the station is doing: the Moglin's stockpile (30 of each product, above a 30 reserve of the raw), a focus, and the output. */
function WorkView({ r }: { r: Room }) {
  const [, force] = useState(0)
  useEffect(() => { const t = setInterval(() => force(n => n + 1), 1000); return () => clearInterval(t) }, [])
  const st = stationOf(r), w = st.work, v = loadVillage(), who = workerOf(r, v), stock = stockJobs(r.kind)
  const status = statusOf(st, who.moglin ? stock : []), outs = st.out ?? []
  const fj = w?.focus && jobById(w.focus.job)
  const collect = (id: string, n?: number) => {
    touchWork(r.id)
    const cur = stationOf(getW().rooms.find(x => x.id === r.id)!), t = takeOut(cur, id, n), g = give(getInv(), id, t.took)
    setWorks(setStation(getW(), r.id, putOut(t.station, id, g.left))); setInv(g.inv)
    if (g.left > 0) hudSay('Your bag is full. The rest waits in the station.', 'info')
  }
  const liveStock = stock.filter(j => st.store?.some(x => x.id === j.in[0].id) || (st.out ?? []).some(x => x.id === j.out.id))
  return (
    <div data-work>
      <div style={lab}>The station's work</div>
      {fj && w?.focus ? (
        <div data-focus-line={fj.id} data-left={w.focus.left} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: H.ink, marginTop: 4 }}>
          <span style={{ flex: 1 }}><b>Focus:</b> {itemDef(fj.out.id).name} <span style={{ color: H.inkSoft }}>· {w.focus.left * fj.out.n} to go · uses every {fj.in.map(c => itemDef(c.id).name).join(' + ')} in the store</span></span>
          <span data-act="cancel-focus"><HearthButton small onClick={() => { touchWork(r.id); setWorks(setStation(getW(), r.id, cancelFocus(stationOf(getW().rooms.find(x => x.id === r.id)!)))) }}>Stop</HearthButton></span>
        </div>
      ) : stock.length ? (
        <div style={{ fontSize: 12.5, color: H.inkSoft, marginTop: 4 }}>{who.moglin ? `${who.moglin.name} keeps ${RESERVE} of each raw material for you and refines the rest into a stack of ${OUT_CAP} of each product.` : `Stockpile: a Moglin keeping this room refines whatever is above ${RESERVE} of each raw material into a stack of ${OUT_CAP} of each product. Until then, pick a product and Focus it.`}</div>
      ) : <div style={{ fontSize: 12.5, color: H.inkSoft, marginTop: 4 }}>Pick something and Focus it: the station makes it from the store.</div>}
      {who.moglin && liveStock.length > 0 && (
        <div data-stockpile style={{ display: 'grid', gap: 2, marginTop: 6 }}>
          {liveStock.map(j => { const l = stockLine(st, j); return (
            <div key={j.id} data-stock={j.out.id} data-made={l.made} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: H.ink }}>
              <span style={{ flex: 1 }}>{itemDef(j.out.id).name}</span><span style={{ color: l.made >= l.cap ? '#3d7a30' : H.inkSoft }}>{l.made} / {l.cap}{l.made < l.cap && !l.waiting ? ' · waiting for more than 30 ' + itemDef(j.in[0].id).name.toLowerCase() : ''}</span>
            </div>) })}
        </div>
      )}
      <div data-work-status={status} style={{ fontSize: 12.5, marginTop: 6, color: status === 'idle' ? '#9a5f10' : H.inkSoft, fontWeight: status === 'idle' ? 700 : 400 }}>
        {status === 'idle' ? (who.moglin ? 'Idle: every product has its stack, or nothing is left above the reserve.' : fj ? 'Paused: the store has no inputs for it.' : 'Idle.') : who.speed > 0 ? `${who.moglin ? `${who.moglin.name} is working` : 'You are working it (while this panel is open)'}${w?.run ? ` · ${itemDef(jobById(w.run.job)!.out.id).name}` : ''}` : 'No one is working it. Keep this panel open, or put a Moglin on the room.'}
      </div>
      <div style={{ ...lab, marginTop: 10 }}>The output · up to {OUT_CAP} of an item in a stockpile</div>
      {outs.length ? (
        <div style={{ ...grid, marginTop: 6 }}>
          {outs.map(s => <Cell key={s.id} s={s} data-out-item={s.id} title=" · tap to collect" onClick={() => collect(s.id)} />)}
        </div>
      ) : <div style={{ fontSize: 12.5, color: H.inkFaint, marginTop: 4 }}>Nothing finished yet.</div>}
      {outs.length > 0 && <span data-act="collect-all"><HearthButton small onClick={() => outs.forEach(s => collect(s.id))}>Collect all</HearthButton></span>}
    </div>
  )
}

/** The Rinnshop's rinsticks (ather/rinsticks.ts): canon's three, built from rinn. Making one equips it (it comes out when you
 *  hold bait); the one in hand and its uses left are shown first. */
function RinstickList({ r, inv }: { r: Room; inv: ReturnType<typeof useInv> }) {
  const [tools, setTools] = useState(() => loadTools())
  const cur = tools.rinning, curDef = cur ? TOOL_DEFS[cur.toolId] : undefined
  const quest = useQuest(), step = currentStep(quest)   // M22: the first rinstick is earned here
  return (
    <div data-rinsticks>
      <div style={lab}>Rinsticks</div>
      {step?.do.kind === 'bench' && (() => {
        const d = step.do, have = countOf(inv, d.takes) > 0
        return (
          <div data-rinquest-step={step.id} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 4px' }}>
            <span style={{ flex: 1, fontSize: 13, color: H.ink }}>{have ? step.note : `${step.note} You have no ${itemDef(d.takes).name.toLowerCase()} with you.`}</span>
            <HearthButton small primary disabled={!have} onClick={() => { if (questEvent({ kind: 'bench', at: 'rinnshop', has: id => countOf(getInv(), id) > 0 })) setTools(loadTools()) }}>{step.button ?? 'Bind'}</HearthButton>
          </div>
        )
      })()}
      <div style={{ fontSize: 12.5, color: H.inkSoft, margin: '4px 0 8px' }} data-rinstick-held={cur?.toolId ?? ''}>
        In hand: {cur ? rinstickName(cur) : 'none yet'}{!cur ? '' : curDef && !curDef.basic ? ` · ${cur!.usesRemaining} catches left` : ' · never wears out'}. Built from rinn, since kin calls to kin. A better one gives the reel more room.
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {RINSTICKS.map(id => {
          const d = TOOL_DEFS[id], have = d.recipe.every(c => benchCount(r, inv, c.itemId) >= c.count)
          return (
            <div key={id} data-rinstick={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: H.ink }}>
                {d.name} <span style={{ color: H.inkSoft, fontSize: 12 }}>· {d.recipe.map(c => `${c.count} ${itemDef(c.itemId).name} (${benchCount(r, inv, c.itemId)})`).join(' + ')} · {d.durability} catches · reel ×{easeOf({ toolId: id, usesRemaining: 1 }).toFixed(2)}</span>
              </span>
              <HearthButton small disabled={!have} onClick={() => {
                const m = makeRinstick(getW(), r.id, getInv(), loadTools(), id)
                if (!m.ok) { if (m.why) hudSay(m.why, 'info'); return }
                setWorks(m.works); setInv(m.inv); saveTools(m.tools, true); setTools(m.tools); hudSay(`${d.name} · in hand when you hold bait.`, 'item')
              }}>Make</HearthButton>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** BLADES (carpentry) / SPIKES (stonemason) at their bench (ather/focuses.ts, BETA M17; which bench = Jin's proposal pending
 *  Magii). The engine's three tiers; making one equips it (it comes out when your hands are stowed at a tree or a crystal). A
 *  focus works its reach at a node's own mana, double above it. */
function FocusList({ r, inv, skill }: { r: Room; inv: ReturnType<typeof useInv>; skill: FocusSkill }) {
  const [tools, setTools] = useState(() => loadTools())
  const cur = tools[skill], curDef = cur ? TOOL_DEFS[cur.toolId] : undefined
  const fam = skill === 'forestry' ? 'Blades' : 'Spikes', node = skill === 'forestry' ? 'tree' : 'crystal'
  return (
    <div data-focuses={skill}>
      <div style={lab}>{fam}</div>
      <div style={{ fontSize: 12.5, color: H.inkSoft, margin: '4px 0 8px' }} data-focus-held={cur?.toolId ?? ''}>
        In hand: {focusName(cur, skill)}{curDef && !curDef.basic ? ` · ${cur!.usesRemaining} uses left` : ' · never wears out'}. Works a tier {reachOf(cur)} {node} or lower at its own mana; anything higher costs double.
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {FOCUSES[skill].map(id => {
          const d = TOOL_DEFS[id], have = d.recipe.every(c => benchCount(r, inv, c.itemId) >= c.count)
          return (
            <div key={id} data-focus={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: H.ink }}>
                {d.name} <span style={{ color: H.inkSoft, fontSize: 12 }}>· {d.recipe.map(c => `${c.count} ${itemDef(c.itemId).name} (${benchCount(r, inv, c.itemId)})`).join(' + ')} · {d.durability} uses · reaches tier {d.tier + 1} · XP ×{d.xpBonus}</span>
              </span>
              <HearthButton small disabled={!have} onClick={() => {
                const m = makeFocus(getW(), r.id, getInv(), loadTools(), id)
                if (!m.ok) { if (m.why) hudSay(m.why, 'info'); return }
                setWorks(m.works); setInv(m.inv); saveTools(m.tools, true); setTools(m.tools); hudSay(`${d.name} · in hand when you work a ${node}.`, 'item')
              }}>Make</HearthButton>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** WHO WORKS THIS ROOM (moglins.ts; the hub recruits in the Wilds' settlements, play puts them to work). One Moglin to a
 *  room, its trade must fit. Its grades never change (canon); its dream is lark's line. */
function MoglinDuty({ r }: { r: Room }) {
  const [v, setV] = useState<Village>(() => loadVillage())
  const here = v.moglins.find(m => m.room === r.id)
  const fits = v.moglins.filter(m => m.id !== here?.id && WORKS_IN[m.profession].includes(r.kind))
  const put = (id: string, room: string | null) => {
    const nv = assign(loadVillage(), getW(), id, room); if (!nv) { hudSay('Their trade does not suit this room.', 'info'); return }
    saveVillage(nv); setV(nv); touchWork(r.id)
  }
  const grades = (m: Village['moglins'][number]) => GRADE_CATEGORIES.map(c => `${c} ${GRADE_NAME[m.grades[c]]}`).join(' · ')
  if (!here && !fits.length && !v.moglins.length) return null
  return (
    <div data-moglin-duty={r.kind}>
      <div style={lab}>Who keeps this room</div>
      {here ? (
        <div data-moglin-here={here.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: H.ink, fontWeight: 600 }}>{here.name} <span style={{ fontWeight: 400, color: H.inkSoft, fontSize: 12.5 }}>· the {here.profession} · {grades(here)}</span></div>
            <div style={{ fontSize: 12.5, color: H.inkSoft }}>{dutyLine(here, r.kind)}{here.dream ? ` "${here.dream}"` : ''}</div>
          </div>
          <span data-act="off-duty"><HearthButton small onClick={() => put(here.id, null)}>Rest</HearthButton></span>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: H.inkSoft, marginTop: 4 }}>{fits.length ? 'No one yet. Someone in your village could take it on.' : 'No one in your village has this trade yet. Folk in the Wilds settlements might come, if asked.'}</div>
      )}
      {fits.map(m => (
        <div key={m.id} data-moglin={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: H.ink }}>{m.name} <span style={{ color: H.inkSoft, fontSize: 12 }}>· the {m.profession} · {grades(m)}{m.room ? ' · busy in another room' : ''}</span></span>
          <HearthButton small onClick={() => put(m.id, r.id)}>{here ? 'Ask instead' : 'Ask to work here'}</HearthButton>
        </div>
      ))}
    </div>
  )
}

/** A bench's craft list (M43): each job shows its time per item; tap one to set how many (1 / 10 / 99 / max) and Focus it. */
function CraftList({ title, note, jobs, r, pick, setPick, empty }: { title: string; note: string; jobs: readonly Job[]; r: Room; pick: Pick; setPick: (p: Pick) => void; empty?: string }) {
  const inv = useInv(), bank = useBank()
  return (
    <div>
      <div style={lab}>{title}</div>
      <div style={{ fontSize: 12.5, color: H.inkSoft, margin: '4px 0 8px' }}>{note}</div>
      {jobs.length ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {jobs.map(j => {
            const on = pick.job?.id === j.id, afford = maxAffordable(j, r.store), reach = Math.min(...j.in.map(c => Math.floor((benchCount(r, inv, c.id) + bankCount(bank, c.id)) / c.n)))
            const qty = pick.qty === 'max' ? afford : pick.qty
            return (
              <div key={j.id} data-job={j.id} data-sel={on} style={{ display: 'grid', gap: 5, padding: '5px 7px', borderRadius: 10, background: on ? 'rgba(58,39,22,.08)' : 'transparent', boxShadow: on ? `inset 0 0 0 1px ${H.rule}` : 'none' }}>
                <button type="button" data-job-pick={j.id} onClick={() => setPick({ ...pick, job: on ? null : j })} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: H.ink }}>
                    {j.out.n > 1 ? `${j.out.n} ` : ''}{itemDef(j.out.id).name} <span style={{ color: H.inkSoft, fontSize: 12 }}>· {j.in.map(c => `${c.n} ${itemDef(c.id).name}`).join(' + ')} · {itemMs(j) / 1000} s each</span>
                  </span>
                  <span style={{ fontSize: 11.5, color: H.inkSoft }}>{reach > 0 ? `${reach} run${reach === 1 ? '' : 's'} on hand` : 'none on hand'}</span>
                </button>
                {on && (
                  <div data-craft-controls style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                    {QTYS.map(q => (
                      <button key={q} type="button" data-qty={q} aria-pressed={pick.qty === q} onClick={() => setPick({ ...pick, qty: q })}
                        style={{ border: 0, borderRadius: 8, height: 30, minWidth: 38, padding: '0 9px', cursor: 'pointer', font: '700 12px system-ui', background: pick.qty === q ? H.ink : 'rgba(58,39,22,.1)', color: pick.qty === q ? '#fff' : H.ink }}>{q === 'max' ? `Max${afford ? ` ${afford}` : ''}` : q}</button>
                    ))}
                    <span data-act="focus"><HearthButton small primary disabled={qty < 1} onClick={() => { touchWork(r.id); const w = getW(); setWorks(setStation(w, r.id, setFocus(stationOf(w.rooms.find(x => x.id === r.id)!), j.id, qty, Date.now()))) }}>Focus {qty || ''}</HearthButton></span>
                    <span style={{ fontSize: 11.5, color: H.inkSoft }}>{qty ? `${fmtSecs(runsFor(j, qty) * runMs(j))} at base pace · ignores the reserve and the cap` : 'put material in the store first'}</span>
                  </div>
                )}
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
  const f = FURNITURE[p.item], spill = spillIfRemoved(currentWater(), plumbingOf(w.pieces), p.item, farmNow())
  return (
    <HearthFrame title={f.name} maxWidth={420} onClose={onClose} fixed dataPanel="piece">
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 13, color: H.inkSoft }}>{f.blurb}</div>
        {spill > 0 && <div data-spill={spill} style={{ fontSize: 12.5, color: '#9a4a2a', fontWeight: 600 }}>Picking this up pours away {spill} water.</div>}
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
    <HearthFrame title="The garden bank" maxWidth={560} onClose={onClose} fixed dataPanel="bank"
      footer={<span className="text-[12px]">Click a stack to move it across · shared by every keeper in your garden</span>}>
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ ...lab, flex: 1 }} data-bank-used={used} data-bank-cap={cap}>
            <span style={{ color: used > cap ? '#b5452c' : undefined }}>{used}</span> / {cap} slots · {chestsStanding(w)} of {MAX_CHESTS} Keepstones
          </div>
          {id !== 'starter' && <span data-act="pickup-keepstone"><HearthButton small onClick={() => { const r = pickUpChest(getW(), id, getInv()); if (r) { setInv(r.inv); setWorks(r.works); onClose(); hudSay('Keepstone back in your bag. Nothing in the bank has moved.', 'item', 4) } else hudSay('No room in the bag for it.', 'info') }}>Pick up</HearthButton></span>}
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
/** ⚠ It sits ABOVE the HUD message line (game-hud Messages, bottom 118, up to five lines stacking upward): at bottom 120 the two
 *  overlapped and the placing hint read through the buttons (phone pass 11-19, 360x780 + 390x844). */
export function PlacingBar({ owned }: { owned: ReadonlySet<string> }) {
  const p = usePlacing()
  if (!p) return null
  const btn: React.CSSProperties = { border: 0, borderRadius: 999, padding: '10px 16px', font: '700 13px system-ui', cursor: 'pointer', background: 'rgba(255,250,235,.95)', color: H.ink, boxShadow: '0 2px 8px rgba(0,0,0,.25)' }
  return (
    <div data-placing={p.kind} style={{ position: 'fixed', left: '50%', bottom: 'max(230px, 27vh)', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 40, pointerEvents: 'auto' }}>
      <button type="button" data-act="turn" style={btn} onClick={() => setPlacing({ ...p, q: (p.q + 1) % 4 })}>{fromHand(p) ? 'Turn (hold E)' : 'Turn (R)'}</button>
      <button type="button" data-act="place" style={{ ...btn, background: '#e0823f', color: '#fff' }} onClick={() => confirmPlace(owned)}>Place (E)</button>
      {!fromHand(p) && <button type="button" style={btn} onClick={() => setPlacing(null)}>Cancel (Esc)</button>}
    </div>
  )
}
