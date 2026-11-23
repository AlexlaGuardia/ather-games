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
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getPrefs, setPrefs, subscribePrefs, nextSnap, nextStep, snapLabel, turnQ, DEFAULT_PREFS, anchorSnap, getAnchor, setAnchor, subscribeAnchor } from './build-prefs'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { HearthFrame, HearthButton, Well, H, hearthDisplay } from '../../ui/hearth'
import { getInv, setInv, useInv } from '../shared/bag'
import { countOf, itemDef, give, makeBait, BAIT_FROM, baitYield, HOTBAR, SLOTS, type Stack, type Inv } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import { GROUND_Y, squareAt, sqId, loadGarden, plotHeightAt, GREG } from './plot'
import { forestryLevel } from './forestry'
import { connectedPieces, extractBlueprint, fitsPad } from './plot-blueprint'
import { LOT_W, LOT_D, GLADE_LOTS } from './moonwell-glade'
import { snapCorner, runKeys, canLay, planRun, raze, wallBoxes, edgeRect, findRooms, roofMesh, pieceAt, roomAt, toggleDoor, toggleWindow, paintWall, paintConnected, connectedRooms, setFloor, floorOf, wallColour, paintable, isWood, isColour, WALL_MATS, WALL_MAT_ORDER, FLOOR_PATS, FLOOR_PAT_ORDER, SWATCHES, ROOF_STYLES, LOW_WALL, DOOR_H, SILL, WIN_TOP, WALL_T, RAIL_H, type Corner, type WallMat, type Walls, type RoofStyle, type PlotRoom, type Floors, type FloorPat } from './plot-walls'
import { MoglinModel, furOf, type MoglinGarb } from '../shared/moglin-model'
import {
  ROOMS, ROOM_ORDER, TABLE, canPlace, place, raised, progress, wallsOf, benchOf, footprint, loadWorks, saveWorks,
  WALL_H, benchBox, keepClear, tableAt, TABLE_ITEM, type Works, type Room, type RoomKind, type WorkNear,
  stationOf, setStation, stockItemFromBag, stockItemFromBank, craftAt, jobRuns, toWorld, pieceRect, pieceBoxes, pieceFloor, canPlacePiece, placePiece, turnPiece, retireRooms, type Piece,
  ROOM_STORE_SLOTS, ROOM_KEEPS, roomAccepts, roomStore, stockRoom, stockRoomFromBag, takeFromRoom, makeBaitAt, benchCount, type StoreMove,
  CHEST_W, CHEST_D, CHEST_H, KEEPSTONE, KEEPSTONE_RECIPE, makeKeepstone, makeKeepstoneFrom, shortOf, haveFor, payCost, pickUpChest, allChests, chestBox, chestsStanding, canPlaceChest, placeChest, type Chest,
} from './rooms'
import {
  MAX_CHESTS, CHEST_SLOTS, bankCap, bankUsed, bankView, BANK_TABS, deposit, depositBag, withdraw, loadBank, saveBank, freshBank,
  bankCount, type Bank, type BankTab,
} from './garden-bank'
import { reconcile, paneFor, billOfAll, buildAll, PER_COL, STONE_BRICK } from './plot-bom'
import { getPlanLevel, setPlanLevel, usePlanLevel } from './plot-level'
import { shaftKeys, shaftHoles, liveLift, cellMid, shaftBlockers, SHAFT_WHY, isLiftPiece, liftsOf, shaftTop } from './lift'
import { LiftMesh, LiftInput } from './lift-view'
import { levelOf, withLevel, levelCount, levelBase, canStack, floating, upperBoxes, stairRails, MAX_LEVELS, SLAB_T, type LiftLookup } from './plot-floors'
import { floorAt, liftOf, setHouseFound, houseFoundDelta, plinthBoxes, doorSteps, roomLift, FOUND_OPTS, FOUND_NAME, type FoundH, type Lift } from './plot-found'
import { stairBoxes, landingRails, stairCellSet, toggleStair, dirOfYaw, type Stairs, type Turn } from './plot-stairs'
import { deckRect, planDecks, eraseDecks, deckBoxes, supported as deckSupported, builtDeckCells, DECK_T, type Decks } from './plot-decks'
import { colBoxes, toggleCol, colAt, paintColumn, colColour, colStandsOn, parseCol, COL_T, type Cols, trimmedRect, COL_CAP } from './plot-cols'
import { FURNITURE, REFINE, STONE_REFINE, PIECE_JOBS, KEEPSTONES, isPiece, ALC_LIVE, type Job } from './furniture'
import { AlchemyPanel } from './alchemy-panel'
import { PlanterPanel, GrimoirePanel, getPots, setPots, settlePlanter, useBook, type BankStore } from './spirit-panels'
import { liftPiece } from './piece-lift'
import { getBoxes, setBoxes, settleSaplingBox, PottedSapling, SaplingBoxSection } from './planter-box-view'   // M113 s1
import { BLOOM_MS, speciesOf } from './spirit-seeds'
import { SpiritOnPlanter, useSpirits3d } from './spirit-model'
import { spiritModelFor } from './spirit-models'
import type { SpiritNav } from './spirit-trot'
import { BrewingPanel } from './brewing-panel'
import { useBrewing, openPartyBrew } from './party-brew-net'
import { ALC_POTIONS as BREW_POTIONS, ALC_POTION_ORDER as BREW_ORDER } from './alchemy-set'
import { openNet } from '../shared/open-mp'
import { boonAt, assignSet, standAt, setRoom, boonLine } from './alchemist-boon'
import { loadRuns, saveRuns, returnRun } from './alchemy-runs'
import { ROAST } from './cooking'
import { FarmPanel, FarmInterior, FarmCrate, currentFarm, setFarm, currentWater, settleWater, farmNow } from './farm-room'
import { plumbingOf, spillIfRemoved } from './water'
import { grantStarter } from './farmroom'
import { loadTut, farmStarterOn } from './glade-tutorial'   // M68 s3b: no starter packet for live tutorial keepers
import { STATION_VOICE, stationSounds, type BenchSnap } from './station-sound'   // M99: bench working sounds
import { play as sfx, statusOf as sfxStatus } from '../shared/sfx'
import { BREW } from './alchemy'
import { RINSTICKS, makeRinstick, loadTools, saveTools, rinstickName, easeOf } from './rinsticks'
import { FOCUSES, BENCH, makeFocus, reachOf, focusName, type FocusSkill } from './focuses'
import { TOOL_DEFS } from '../../engine/tools'
import { isBuilding, useBuildMode, enterBuild, exitBuild, buildPoint, onBuildTap, setBuildTool, useBuildTool, onBuildDraw, buildYaw, buildFocus, setPlanLift, setPlanInsets } from './build-mode'
import { useQuest, questEvent } from './use-rinquest'
import { currentStep } from './rinquest'
import { advance, setFocus, cancelFocus, runProgress, touch, maxAffordable, runsFor, statusOf, takeOut, putOut, jobById, itemMs, runMs, moglinSpeed, stockJobs, stockLine, OUT_CAP, RESERVE } from './station-queue'
import { SKILL_OF_ROOM, SKILL_LABEL } from './moglin-skills'
import { scoreIn, luckChance, skillScore, statsOf, STAT_LABEL } from './moglin-stats'
import { recordCard } from './moglin-card'
import { benchTabs, TAB_LABEL, tabOfFocus, type BenchTab } from './bench-tabs'
import { TabGlyph } from './bench-glyphs'
import { MoglinCard } from './moglin-card-view'
import { reportAway, addMade, type Made } from './away-report'
import { MeleeAim, useHitWobble } from './melee-view'
import { TABLE_HIT } from './melee'
import { loadVillage, saveVillage, assign, dutyLine, WORKS_IN, type Village, type MoglinRecord } from './moglins'
import { shownWorks, worksWritable, subscribeVisit, isVisiting, rideAsGuest, shownMoglins } from './plot-visit'

// ── the store ─────────────────────────────────────────────────────────────────────────────────────────────────
let works: Works | null = null
const SERVER: Works = { v: 1, rooms: [], chests: [], pieces: [] }
const subs = new Set<() => void>()
const ownW = (): Works => { if (!works) { works = typeof window === 'undefined' ? SERVER : loadWorks(); if (ALC_LIVE && works !== SERVER) retireAlchemy() } return works }
/** M61: what the plot shows: the host's works while visiting their plot (plot-visit.ts), else your own */
const getW = (): Works => shownWorks(ownW())
/** M57: once the alchemy set is live, an Alchemy room raised before it comes down and is paid back into the garden bank
 *  (rooms.ts › retireRooms). A full bank leaves it standing until a later load. Plain store writes, no notify: this runs
 *  inside the first read, before anything has subscribed. */
function retireAlchemy() {
  const r = retireRooms(works!, getB(), bankCap(chestsStanding(works!)), 'alchemy')
  if (!r || !r.refunded.length) return
  works = r.works; saveWorks(r.works); bank = r.bank; saveBank(r.bank)
  setTimeout(() => hudSay('Alchemy is a set of furniture now. Your Alchemy room came down: its logs and everything in it are in the bank.', 'info', 7), 1500)
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
/** M61: a guest never writes: not the host's plot (which is a snapshot) and not their own save from the host's state */
export function setWorks(w: Works) { if (!worksWritable()) return; works = w; saveWorks(w); subs.forEach(f => f()); settleWater(w.pieces) }
subscribeVisit(() => subs.forEach(f => f()))   // M61: going visiting / a new snapshot / home again redraws every reader
liveLift.get = getW; liveLift.set = w => { if (isVisiting()) rideAsGuest(w); else setWorks(w) }   // M48: the lift's runtime reads and writes the live works; M61 s3: a guest rides a mate's lift locally
export const useWorks = () => useSyncExternalStore(subscribe, getW, () => SERVER)
/** The live works (the page's village tick reads and writes through this store, so an open panel sees the product land). */
export const currentWorks = () => getW()
/** Every room's walls and every Keepstone, for the walker's plotShape. */
export const workWalls = (w: Works) => [...w.rooms.flatMap(r => wallsOf(r, roomLift(w, r))), ...allChests(w).map(c => chestBox(c, floorAt(w, GROUND_Y, c.x, c.z))), ...pieceBoxes(w), ...houseBoxes(w)]

/** the keeper's own house pieces: every wall, column, upper floor, stair and patio stands on ITS house's foundation (M55 slice 2:
 *  plot-found liftOf, per house), the plinth and the door steps under them */
function houseBoxes(w: Works) {
  const L = liftOf(w)
  return [...wallBoxes(w.walls ?? {}, GROUND_Y, L.edge), ...colBoxes(w.cols, GROUND_Y, L.corner), ...upperBoxes(w, GROUND_Y, shaftHoles(w), L), ...plinthBoxes(w, GROUND_Y), ...doorSteps(w, GROUND_Y), ...deckBoxes(w.decks, GROUND_Y, true, L.floor)]
}
// ── M37 slice 1: YOUR OWN WALLS (plot-walls.ts; Alex 11-19 "like the sims ... walls a little thicker, like the rooms") ──
// In plan mode, the Walls tool: drag along the metre grid, a ghost run shows (blue = it can stand, red = it cannot), let go
// and it stands (a plank a metre). Erase drags it back down (every plank back). The walker meets them like a room's walls.
type WallDrag = { a: Corner; b: Corner; keys: string[]; ok: boolean; erase: boolean }
let wallDrag: WallDrag | null = null, wallMat: WallMat = 'goldwood'
const wdSubs = new Set<() => void>(), wdEmit = () => wdSubs.forEach(f => f())
const useWallDrag = () => useSyncExternalStore(f => { wdSubs.add(f); return () => { wdSubs.delete(f) } }, () => wallDrag, () => null)
// the paint picker (slice 5): a colour (swatch row or custom) and a floor pattern; stucco walls take the colour, floors take both
let paintCol = '#dcd3c2', paintPat: FloorPat = 'planks'
const usePaint = () => useSyncExternalStore(f => { wdSubs.add(f); return () => { wdSubs.delete(f) } }, () => `${paintPat}|${paintCol}`, () => 'planks|#dcd3c2')
const useWallMat = () => useSyncExternalStore(f => { wdSubs.add(f); return () => { wdSubs.delete(f) } }, () => wallMat, () => 'goldwood' as WallMat)
/** M56 (c): the Walls tool draws a full wall or a RAILING (half wall, plot-walls RAIL_H) */
let wallRail = false
const setWallRail = (v: boolean) => { if (v !== wallRail) { wallRail = v; wdEmit() } }
const useWallRail = () => useSyncExternalStore(f => { wdSubs.add(f); return () => { wdSubs.delete(f) } }, () => wallRail, () => false)
/** M56 landing turn: the Stairs tool's shape (straight, or a quarter turn left / right at a landing half way up) */
let stairTurn: Turn | undefined
const setStairTurn = (v: Turn | undefined) => { if (v !== stairTurn) { stairTurn = v; wdEmit() } }
const useStairTurn = () => useSyncExternalStore(f => { wdSubs.add(f); return () => { wdSubs.delete(f) } }, () => stairTurn, () => undefined)
const STAIR_SHAPES: readonly [Turn | undefined, string][] = [[undefined, 'Straight'], ['l', 'Turn left'], ['r', 'Turn right']]
function StairShape({ btn }: { btn: (on: boolean) => React.CSSProperties }) {
  const turn = useStairTurn()
  return <span data-stair-shape style={{ display: 'inline-flex', gap: 4, flex: '0 0 auto' }}>{STAIR_SHAPES.map(([t, name]) => <button key={name} type="button" data-stair-turn={t ?? 'none'} aria-pressed={turn === t} style={{ ...btn(turn === t), height: 30, fontSize: 11 }} onClick={() => setStairTurn(t)}>{name}</button>)}</span>
}
/** a corner is on held ground when any of the four squares around it is yours (a wall may run along your edge) */
const heldCorner = (owned: ReadonlySet<string>) => (x: number, z: number) =>
  [[0.01, 0.01], [-0.01, 0.01], [0.01, -0.01], [-0.01, -0.01]].some(([dx, dz]) => { const s = squareAt(x + dx, z + dz); return !!s && owned.has(sqId(s.i, s.j)) })
/** what a new wall must keep clear of: rooms (whole footprint + a hand), Keepstones, furniture */
function wallBlockers(w: Works) {
  const rects: { r: { x0: number; x1: number; z0: number; z1: number }; why: string }[] = []
  for (const r of w.rooms) {
    if (r.shell) { rects.push({ r: benchBox(r), why: `In your ${ROOMS[r.kind].name}'s bench.` }); continue }   // M97: a shell is built AROUND: walls keep off only its bench
    const f = footprint(r.kind, r.x, r.z, r.q); rects.push({ r: { x0: f.x0 - 0.3, x1: f.x1 + 0.3, z0: f.z0 - 0.3, z1: f.z1 + 0.3 }, why: `In your ${ROOMS[r.kind].name}.` })
  }
  for (const c of allChests(w)) rects.push({ r: chestBox(c), why: 'A Keepstone is in the way.' })
  for (const p of w.pieces) rects.push({ r: pieceRect(p.item, p.x, p.z, p.q), why: isLiftPiece(p) ? SHAFT_WHY : 'Something already stands there.' })
  return { rects, circles: keepClear(w) }   // M96: the table's circle follows the table
}
/** rooms the plan closes whose floor + roof are not built yet (they appear at Build) */
const unbuiltRooms = (walls: Walls, paid: Works['paid']) => new Set(findRooms(walls).map(r => r.key).filter(k => !(paid ?? {})[k]))
/** M47: lay a run on level `lv`: the ground floor keeps every ground rule; an upper floor has no ground to hold or keep clear,
 *  only the support rule (a wall must stand on a wall or a room of the floor below) */
function layOn(w: Works, lv: number, keys: string[], owned: ReadonlySet<string>) {
  if (lv === 0) return canLay(w.walls ?? {}, keys, wallMat, heldCorner(owned), wallBlockers(w))
  const v = canLay(levelOf(w, lv).walls, keys, wallMat, () => true, { rects: shaftBlockers(w), circles: [] })   // M48: the shaft runs through every level
  if (!v.ok) return v
  const s = canStack(levelOf(w, lv - 1).walls, v.add, new Set(builtDeckCells(levelOf(w, lv).decks).map(([i, j]) => `${i},${j}`))); return s.ok ? v : { ok: false as const, why: s.why }   // M56 (a): a railing on a balcony's edge stands on the balcony
}
function wallVerdict(owned: ReadonlySet<string>, a: Corner, b: Corner, erase: boolean) {
  const w = currentWorks(), keys = runKeys(a, b), lv = getPlanLevel(), cur = levelOf(w, lv).walls
  if (erase) return { keys, ok: keys.some(k => !!cur[k]), why: 'No wall there to take down.' }
  const v = layOn(w, lv, keys, owned)   // a plan is drawn free: the list is paid at Build
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
  const bp = useMemo(() => (k && w.walls ? extractBlueprint(w.walls, w.floors, w.roof ?? 'gable', k, `glade-${lot}`, `${lot[0].toUpperCase()}${lot.slice(1)}'s workshop`, Date.now(), w.upper, w.cols, liftsOf(w).map(p => ({ x: p.x, z: p.z, top: shaftTop(w, p) }))) : null), [k, w, lot])
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
      const w = currentWorks(), lv = getPlanLevel(), L = levelOf(w, lv), walls = L.walls, k = pieceAt(walls, x, z)
      if (kind === 'blueprint') { if (!k) hudSay('Tap a wall of the building.', 'info'); setBpPick(k); return }
      if (kind === 'paint') {
        const ck = colAt(L.cols, x, z)   // M54: a column under the tap paints first
        if (ck) { const r = paintColumn(L.cols, ck, paintCol); if ('why' in r) { hudSay(r.why, 'info'); return } setWorks(withLevel(w, lv, { ...L, cols: r.cols })); return }
        if (k) { const r = paintWall(walls, k, paintCol); if ('why' in r) { hudSay(r.why, 'info'); return } setWorks(withLevel(w, lv, { ...L, walls: r.walls })); return }
        const room = roomAt(findRooms(walls), x, z); if (!room) { hudSay('Tap a wall, or the floor of one of your rooms.', 'info'); return }
        const fr = setFloor(L.floors, room, paintPat, paintCol, !!(L.paid ?? {})[room.key], getInv()); if ('why' in fr) { hudSay(fr.why, 'info'); return }
        setWorks(withLevel(w, lv, { ...L, floors: fr.floors })); setInv(fr.inv); return
      }
      if (!k) { hudSay(kind === 'door' ? 'Tap a wall to put a door in it.' : 'Tap a wall to put a window in it.', 'info'); return }
      const c = kind === 'door' ? toggleDoor(walls, k) : toggleWindow(walls, k)
      if (!c.ok) { hudSay(c.why, 'info'); return }
      if (kind === 'window') {   // a pane for a window cut into a BUILT wall (a plan's pane is on the list instead)
        const pn = paneFor(walls, c.walls, k, getInv(), getB()); if ('why' in pn) { hudSay(pn.why, 'info'); return }
        setInv(pn.inv); if (pn.bank) setBank(pn.bank)
      }
      setWorks(withLevel(w, lv, { ...L, walls: c.walls, paid: L.paid ?? {} }))
    },
    cancel() { at = null },
    // M53 (Alex 11-20): right-click (phone: long-press) with Paint = every connected stucco piece, or every joined room's floor
    ...(kind === 'paint' ? { alt(x: number, z: number) {
      at = null
      const w = currentWorks(), lv = getPlanLevel(), L = levelOf(w, lv), walls = L.walls, k = pieceAt(walls, x, z)
      if (k) { const r = paintConnected(walls, k, paintCol); if ('why' in r) { hudSay(r.why, 'info'); return } setWorks(withLevel(w, lv, { ...L, walls: r.walls })); hudSay(`Painted ${r.n} connected wall${r.n === 1 ? '' : 's'}.`, 'info'); return }
      const rooms = findRooms(walls), room = roomAt(rooms, x, z); if (!room) { hudSay('Right-click a wall, or the floor of one of your rooms.', 'info'); return }
      let floors = L.floors, inv = getInv(), n = 0
      for (const rm of connectedRooms(rooms, room)) {
        const fr = setFloor(floors, rm, paintPat, paintCol, !!(L.paid ?? {})[rm.key], inv); if ('why' in fr) { hudSay(fr.why, 'info'); break }
        floors = fr.floors; inv = fr.inv; n++
      }
      if (!n) return
      setWorks(withLevel(w, lv, { ...L, floors })); setInv(inv); hudSay(`Painted ${n} connected floor${n === 1 ? '' : 's'}.`, 'info')
    } } : {}),
  }
}
/** M54: the Column tool. A tap on (near) a grid corner: an empty corner gets a draft column of the chosen wall material, a draft
 *  comes off the plan, a built one comes down with its cost back. Ground floor: ground you hold; upper floors: the support rule. */
function columnHandler(owned: () => ReadonlySet<string>) {
  let at: { x: number; z: number } | null = null
  return {
    start(x: number, z: number) { at = { x, z } },
    move() { /* a tap tool ignores drags */ },
    end(x: number, z: number) {
      if (!at || Math.hypot(x - at.x, z - at.z) > 1.2) { at = null; return }
      at = null
      const i = Math.round(x), j = Math.round(z), w = currentWorks(), lv = getPlanLevel(), L = levelOf(w, lv), key = `${i},${j}`
      const isNew = !L.cols?.[key]
      if (isNew && lv > 0 && !colStandsOn(levelOf(w, lv - 1), key)) { hudSay('A column up here must stand on a column, a wall end or a room of the floor below.', 'info'); return }
      const r = toggleCol(L.cols, i, j, wallMat, lv > 0 || heldCorner(owned())(i, j), PER_COL)
      if (!r.ok) { hudSay(r.why, 'info'); return }
      const next = withLevel(w, lv, { ...L, cols: r.cols })
      if (!isNew && floating(next).length) { hudSay('Take down what stands on it first.', 'info'); return }
      if (r.refund) { const g = give(getInv(), r.refund.id, r.refund.n); if (g.left) { hudSay('Your bag is full: no room for what the column gives back.', 'info'); return } setInv(g.inv) }
      setWorks(next); hudSay(r.said, 'info')
    },
    cancel() { at = null },
  }
}
/** M56 (a): the Floor tool. Drag a rectangle of cells: open floor (a patio on the ground, a balcony upstairs) in the paint
 *  picker's pattern + colour, as a PLAN. A drag that STARTS on floor already down takes that rectangle up instead (a built cell
 *  gives its material back). Upstairs every cell must be held by the floor below (plot-decks supported: a room, a wall under an
 *  edge or a column at a corner, or 1 cell of cantilever past one). */
type DeckDrag = { cells: [number, number][]; ok: boolean; erase: boolean }
let deckDrag: DeckDrag | null = null
const useDeckDrag = () => useSyncExternalStore(f => { wdSubs.add(f); return () => { wdSubs.delete(f) } }, () => deckDrag, () => null)
function deckWhy(w: Works, lv: number, owned: ReadonlySet<string>): (i: number, j: number) => string | null {
  const L = levelOf(w, lv), rooms = new Set(findRooms(L.walls).flatMap(r => r.cells.map(([a, b]) => `${a},${b}`)))
  const holes = lv > 0 ? stairCellSet(levelOf(w, lv - 1).stairs) : stairCellSet(L.stairs)
  const block = lv > 0 ? { rects: shaftBlockers(w), circles: [] as readonly { x: number; z: number; r: number }[] } : wallBlockers(w)
  const held = heldCorner(owned), sup = lv > 0 ? deckSupported(levelOf(w, lv - 1)) : null
  return (i, j) => {
    if (rooms.has(`${i},${j}`)) return 'A room already has its own floor.'
    if (holes.has(`${i},${j}`)) return lv > 0 ? 'The stairs come up there.' : 'The stairs stand there.'
    if (lv === 0 && !held(i + 0.5, j + 0.5)) return 'Build on ground you hold.'
    for (const c of block.circles) if (Math.hypot(Math.max(i, Math.min(c.x, i + 1)) - c.x, Math.max(j, Math.min(c.z, j + 1)) - c.z) < c.r) return 'Leave room around the gate, Gregory and the table.'
    for (const b of block.rects) if (i < b.r.x1 && i + 1 > b.r.x0 && j < b.r.z1 && j + 1 > b.r.z0) return b.why
    if (sup && !sup(i, j)) return 'Nothing holds that up: a balcony needs a wall, a column or a room under it (it may reach 1 m past one).'
    return null
  }
}
function deckHandler(owned: () => ReadonlySet<string>) {
  let a: [number, number] | null = null
  const cell = (x: number, z: number): [number, number] => [Math.floor(x), Math.floor(z)]
  const show = (b: [number, number]) => {
    if (!a) return
    const w = currentWorks(), lv = getPlanLevel(), d = levelOf(w, lv).decks, cells = deckRect(a, b), erase = !!d?.[`${a[0]},${a[1]}`]
    const ok = erase ? cells.some(([i, j]) => !!d?.[`${i},${j}`]) : planDecks(d, cells, paintPat, paintCol, deckWhy(w, lv, owned())).ok
    deckDrag = { cells, ok, erase }; wdEmit()
  }
  return {
    start(x: number, z: number) { a = cell(x, z); show(a) },
    move(x: number, z: number) { show(cell(x, z)) },
    end(x: number, z: number) {
      if (!a) return
      const cells = deckRect(a, cell(x, z)), w = currentWorks(), lv = getPlanLevel(), L = levelOf(w, lv), erase = !!L.decks?.[`${a[0]},${a[1]}`]
      a = null; deckDrag = null; wdEmit()
      if (erase) {
        const r = eraseDecks(L.decks, cells, getInv()); if (!r.up) return
        const next = withLevel(w, lv, { ...L, decks: r.decks })
        if (floating(next).length) { hudSay('Take down what stands on that floor first.', 'info'); return }
        setWorks(next); setInv(r.inv); hudSay(`${r.up} m² of floor up.${r.full ? ' Your bag is full: the rest stays down.' : ''}`, 'item'); return
      }
      if (lv + 1 > MAX_LEVELS) return
      const r = planDecks(L.decks, cells, paintPat, paintCol, deckWhy(w, lv, owned()))
      if (!r.ok) { hudSay(r.why, 'info'); return }
      setWorks(withLevel(w, lv, { ...L, decks: r.decks })); hudSay(r.said, 'info')
    },
    cancel() { if (deckDrag || a) { a = null; deckDrag = null; wdEmit() } },
  }
}
function DeckGhost() {
  const d = useDeckDrag(), lv = usePlanLevel()
  const keys = useMemo(() => (d ? d.cells.map(([i, j]) => `${i},${j}`) : []), [d])
  if (!d || !keys.length) return null
  return <group position-y={levelBase(lv) + 0.02}><DeckCellsMesh cells={d.cells} color={d.erase ? '#ff5a4a' : d.ok ? '#5aa0ff' : '#ff9a3a'} ghost /></group>
}
/** M56 (a): a level's open floor: the pattern on top; a patio stands DECK_T on the ground, a balcony has a slab under it (draft = blue) */
function DrawnDecks({ decks, ground, lift }: { decks: Decks; ground: boolean; lift?: Lift }) {
  // each cell's surface: a ground patio DECK_T up, or flush with the raised house it touches (M55 slice 2); upstairs, its house's lift
  const upOf = useCallback((i: number, j: number) => (ground ? (lift?.floor(i, j) || DECK_T) : (lift?.cell(i, j) ?? 0)), [ground, lift])
  const groups = useMemo(() => { const g = new Map<string, { pat: FloorPat; col: string; draft: boolean; up: number; cells: [number, number][] }>(); for (const [k, d] of Object.entries(decks)) { const [i, j] = k.split(',').map(Number), up = d.draft ? (ground ? DECK_T : 0) : upOf(i, j); const id = `${d.pat}|${d.col}|${d.draft ? 1 : 0}|${up}`; const e = g.get(id) ?? { pat: d.pat, col: d.col, draft: !!d.draft, up, cells: [] }; e.cells.push([i, j]); g.set(id, e) } return [...g] }, [decks, ground, upOf])
  const built = useMemo(() => { const m = new Map<number, [number, number][]>(); for (const [k, d] of Object.entries(decks)) { if (d.draft) continue; const [i, j] = k.split(',').map(Number), up = upOf(i, j), l = m.get(up) ?? []; l.push([i, j]); m.set(up, l) } return [...m] }, [decks, upOf])
  return (
    <>
      {groups.map(([id, e]) => e.draft
        ? <group key={id + e.cells.length} position-y={(ground ? e.up - 0.06 : 0.01)}><DeckCellsMesh cells={e.cells} color={DRAFT_LOOK} ghost /></group>
        : <group key={id + e.cells.length} position-y={ground ? e.up - 0.06 : e.up}><FloorCells pat={e.pat} col={e.col} cells={e.cells} /></group>)}
      {built.map(([up, cells]) => ground ? <DeckBase key={'b' + up + cells.length} cells={cells} top={up} /> : <group key={'s' + up + cells.length} position-y={up}><Slab cells={cells} /></group>)}
    </>
  )
}
/** the patio's body under its pattern: the ground up to `top` - 0.06 (a riding patio stands its house's foundation tall) */
function DeckBase({ cells, top }: { cells: [number, number][]; top: number }) {
  const ref = useRef<THREE.InstancedMesh>(null), h = top - 0.06
  useEffect(() => {
    const m = ref.current; if (!m) return
    const o = new THREE.Object3D()
    cells.forEach(([i, j], n) => { o.position.set(i + 0.5, GROUND_Y + h / 2 - 0.02, j + 0.5); o.scale.set(1, h + 0.04, 1); o.updateMatrix(); m.setMatrixAt(n, o.matrix) })
    m.count = cells.length; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere()
  }, [cells, h])
  return <instancedMesh ref={ref} args={[WALL_GEO, undefined, Math.max(1, cells.length)]} frustumCulled={false} receiveShadow><meshLambertMaterial color="#8f7a5c" /></instancedMesh>
}
function DeckCellsMesh({ cells, color, ghost }: { cells: [number, number][]; color: string; ghost?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = ref.current; if (!m) return
    const o = new THREE.Object3D()
    cells.forEach(([i, j], n) => { o.position.set(i + 0.5, GROUND_Y + 0.03, j + 0.5); o.updateMatrix(); m.setMatrixAt(n, o.matrix) })
    m.count = cells.length; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere()
  }, [cells])
  return <instancedMesh ref={ref} args={[FLOOR_GEO, undefined, Math.max(1, cells.length)]} frustumCulled={false}><meshBasicMaterial color={color} transparent={ghost} opacity={ghost ? 0.5 : 1} depthWrite={!ghost} /></instancedMesh>
}
/** M56: the Stairs tool. A tap on a cell starts a straight stair there that climbs AWAY from the camera (turn the view with Q / Z to
 *  turn it); a tap on a stair takes it away (a built one with its cost back). Ground floor: every cell on ground you hold; upper
 *  floors: every cell on a room of that floor. */
function stairsHandler(owned: () => ReadonlySet<string>) {
  let at: { x: number; z: number } | null = null
  return {
    start(x: number, z: number) { at = { x, z } },
    move() { /* a tap tool ignores drags */ },
    end(x: number, z: number) {
      if (!at || Math.hypot(x - at.x, z - at.z) > 1.2) { at = null; return }
      at = null
      const i = Math.floor(x), j = Math.floor(z), w = currentWorks(), lv = getPlanLevel(), L = levelOf(w, lv)
      const roomCells = lv > 0 ? new Set(findRooms(L.walls).flatMap(r => r.cells.map(([a, b]) => `${a},${b}`))) : null
      const held = heldCorner(owned())
      const cellOk = (a: number, b: number) => roomCells ? roomCells.has(`${a},${b}`) : held(a + 0.5, b + 0.5)
      if (lv + 1 >= MAX_LEVELS && !Object.values(L.stairs ?? {}).length) { hudSay('This is the top floor: nowhere for stairs to go.', 'info'); return }
      const r = toggleStair(L.stairs, L.walls, i, j, dirOfYaw(buildYaw()), wallMat, cellOk, stairTurn)
      if (!r.ok) { hudSay(r.why, 'info'); return }
      if (r.refund) { const g = give(getInv(), r.refund.id, r.refund.n); if (g.left) { hudSay('Your bag is full: no room for what the stairs give back.', 'info'); return } setInv(g.inv) }
      setWorks(withLevel(w, lv, { ...L, stairs: r.stairs })); hudSay(r.said, 'info')
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
      const lv = getPlanLevel(), L = levelOf(w, lv)
      if (erase) {
        const r = raze(L.walls, getInv(), keys, w.wallCarry); if (!r.down) return
        if (floating(withLevel(w, lv, { ...L, walls: r.walls })).length) { hudSay('Take the floor above down first: it stands on that wall.', 'info'); return }   // M47: nothing floats
        const rc = reconcile(r.walls, L.paid, r.inv, L.floors, lv === 0)   // a built room that no longer closes gives its floor (and roof) back too
        setWorks({ ...withLevel(w, lv, { ...L, walls: r.walls, paid: rc.paid }), wallCarry: r.carry }); setInv(rc.inv)   // 11-22: the leftover fraction rides to the next take-down
        hudSay(`${r.down} m of wall down, what was built comes back to your bag.${r.full ? ' Your bag is full: the rest stays up.' : ''}`, 'item')
        return
      }
      const v = layOn(w, lv, keys, owned())
      if (!v.ok) { hudSay(v.why, 'info'); return }
      setWorks(withLevel(w, lv, { ...L, walls: planRun(L.walls, v.add, wallMat, wallRail ? 'rail' : undefined), paid: L.paid ?? {} }))   // a PLAN: the list is paid at Build
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
export function DrawnWalls({ walls, roof, floors, probe = true, down: downOverride, unbuilt, roofed = true, slab = false, holes, lift, cols }: { walls: Walls; roof: RoofStyle; floors?: Floors; unbuilt?: ReadonlySet<string>; /** M54 (2): the level's columns (walls meet their faces) */ cols?: Cols; /** M55 slice 2: each piece / room on its house's foundation */ lift?: LiftLookup; /** M56: cells left open in this level's floor + slab (stairs climb through) */ holes?: ReadonlySet<string>; /** M47: no roof here (a floor is above) */ roofed?: boolean; /** M47: an upper level: a slab under its built rooms, seen from below as the ceiling */ slab?: boolean; probe?: boolean; /** set by a page outside plan mode (dev/blueprints) */ down?: boolean }) {
  const b = useBuildMode(), wd = useWallsDown(), down = downOverride ?? (wd && b)   // hooks always run; the override only picks
  useEffect(() => { if (!b && wallsDown) setWallsDown(false) }, [b])
  // runs by wood AND kind: a plain piece is floor to top, a door only its lintel, a window a sill + a head + a pane
  const byMat = useMemo(() => { const m = new Map<string, string[]>(); for (const [k, w] of Object.entries(walls)) { const id = `${w.mat}|${w.kind ?? 'wall'}|${w.draft ? 'draft' : ''}|${w.tint ?? ''}|${lift?.edge(k) ?? 0}`; const l = m.get(id) ?? []; l.push(k); m.set(id, l) } return [...m].map(([id, keys]) => { const [mat, kind, dr, tint, up] = id.split('|'); return { mat: mat as WallMat, kind, keys, draft: !!dr, tint: tint || undefined, up: +up } }) }, [walls, lift])
  const panes = useMemo(() => { const m = new Map<number, string[]>(); for (const [k, w] of Object.entries(walls)) if (w.kind === 'window' && !w.draft) { const u = lift?.edge(k) ?? 0, l = m.get(u) ?? []; l.push(k); m.set(u, l) } return [...m] }, [walls, lift])
  const upOf = (r: PlotRoom) => lift?.cell(r.cells[0][0], r.cells[0][1]) ?? 0
  const rooms = useMemo(() => findRooms(walls), [walls])
  useEffect(() => { if (probe) (window as unknown as { __walls?: object }).__walls = { rooms: () => rooms.map(r => ({ cells: r.cells.length, rect: !!r.rect, built: !unbuilt?.has(r.key) })), down: () => down, roof: () => roof } }, [rooms, down, roof, probe, unbuilt])
  return (
    <>
      {byMat.map(({ mat, kind, keys, draft, tint, up }) => {
        const top = down ? LOW_WALL : WALL_H, id = mat + tint + kind + draft + keys.length + (down ? 'd' : '') + up, g = draft ? DRAFT_LOOK : undefined   // a plan is a blue blueprint until it is built
        const run = kind === 'rail' ? <WallRun mat={mat} tint={tint} keys={keys} h={Math.min(RAIL_H, top)} ghost={g} cols={cols} />   // M56 (c): a half wall
          : kind === 'door' ? (top > DOOR_H ? <WallRun mat={mat} tint={tint} keys={keys} y0={DOOR_H} h={top - DOOR_H} ghost={g} cols={cols} /> : null)
          : kind === 'window' ? <><WallRun mat={mat} tint={tint} keys={keys} h={Math.min(SILL, top)} ghost={g} cols={cols} />{top > WIN_TOP && <WallRun mat={mat} tint={tint} keys={keys} y0={WIN_TOP} h={top - WIN_TOP} ghost={g} cols={cols} />}</>
          : <WallRun mat={mat} tint={tint} keys={keys} h={top} ghost={g} cols={cols} />
        return <group key={id} position-y={up}>{run}</group>
      })}
      {!down && panes.map(([up, keys]) => <group key={'pane' + up + keys.length} position-y={up}><WallRun mat="goldwood" keys={keys} y0={SILL} h={WIN_TOP - SILL} pane cols={cols} /></group>)}
      {rooms.filter(r => !unbuilt?.has(r.key)).map(r => <group key={r.key + (holes?.size ?? 0) + upOf(r)} position-y={upOf(r)}><RoomFloor room={r} floors={floors} holes={holes} /></group>)}
      {slab && rooms.filter(r => !unbuilt?.has(r.key)).map(r => <group key={'s' + r.key + upOf(r)} position-y={upOf(r)}><Slab cells={r.cells.filter(([i, j]) => !holes?.has(`${i},${j}`))} /></group>)}
      {!down && roofed && rooms.filter(r => !unbuilt?.has(r.key)).map(r => <group key={r.key + roof + upOf(r)} position-y={upOf(r)}><RoomRoof room={r} style={roof} walls={walls} /></group>)}
    </>
  )
}
/** M47: an upper level's slab: SLAB_T thick under each built room cell, its top at the level's floor */
function Slab({ cells }: { cells: [number, number][] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = ref.current; if (!m) return
    const o = new THREE.Object3D()
    cells.forEach(([i, j], n) => { o.position.set(i + 0.5, GROUND_Y - SLAB_T / 2, j + 0.5); o.scale.set(1, SLAB_T, 1); o.updateMatrix(); m.setMatrixAt(n, o.matrix) })
    m.count = cells.length; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere()
  }, [cells])
  if (!cells.length) return null
  return <instancedMesh ref={ref} args={[WALL_GEO, undefined, cells.length]} frustumCulled={false}><meshLambertMaterial color="#a98558" /></instancedMesh>
}
const DRAFT_LOOK = '#6fb4ff'
const FLOOR_GEO = new THREE.BoxGeometry(1, 0.06, 1)
/** a drawn room's floor: a pattern and a colour per cell (slice 5), a shade under the walls; unset = plain goldwood planks */
function RoomFloor({ room, floors, holes }: { room: PlotRoom; floors?: Floors; holes?: ReadonlySet<string> }) {
  const groups = useMemo(() => { const g = new Map<string, { pat: FloorPat; col: string; cells: [number, number][] }>(); for (const c of room.cells) { if (holes?.has(`${c[0]},${c[1]}`)) continue; const f = floorOf(floors, c[0], c[1]); const id = `${f.pat}|${f.col}`; const e = g.get(id) ?? { pat: f.pat, col: f.col, cells: [] }; e.cells.push(c); g.set(id, e) } return [...g] }, [room, floors, holes])
  return <>{groups.map(([id, e]) => <FloorCells key={id + e.cells.length} pat={e.pat} col={e.col} cells={e.cells} />)}</>
}
/** procedural pattern textures (no art files): grey lines on white, multiplied by the floor's colour. One canvas per pattern. */
const patTex = new Map<string, THREE.CanvasTexture>()
function proceduralTex(key: string, draw: (g: CanvasRenderingContext2D, n: number) => void, rx = 1, ry = 1): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const hit = patTex.get(key); if (hit) return hit
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n
  const g = c.getContext('2d'); if (!g) return null
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, n, n); draw(g, n)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4
  patTex.set(key, t); return t
}
function floorTex(pat: FloorPat): THREE.CanvasTexture | null {
  const line = (g: CanvasRenderingContext2D, w: number) => { g.strokeStyle = '#8a8a8a'; g.lineWidth = w }
  if (pat === 'planks') return proceduralTex('planks', (g, n) => { line(g, 3); for (let r = 0; r < 4; r++) { const y = r * n / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(n, y); g.stroke(); const x = (r % 2 ? 0.25 : 0.7) * n; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + n / 4); g.stroke() } })
  if (pat === 'herringbone') return proceduralTex('herring', (g, n) => { line(g, 3); const s = n / 4; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { const x = a * s, y = b * s; g.beginPath(); if ((a + b) % 2) { g.moveTo(x, y + s * 0.5); g.lineTo(x + s, y + s * 0.5); g.moveTo(x + s * 0.5, y); g.lineTo(x + s * 0.5, y + s * 0.5) } else { g.moveTo(x + s * 0.5, y); g.lineTo(x + s * 0.5, y + s); g.moveTo(x, y + s * 0.5); g.lineTo(x + s * 0.5, y + s * 0.5) } g.stroke() } g.strokeRect(0, 0, n, n) })
  if (pat === 'tile') return proceduralTex('tile', (g, n) => { line(g, 4); g.strokeRect(0, 0, n, n); g.beginPath(); g.moveTo(n / 2, 0); g.lineTo(n / 2, n); g.moveTo(0, n / 2); g.lineTo(n, n / 2); g.stroke() })
  return proceduralTex('flag', (g, n) => { line(g, 4); g.strokeRect(0, 0, n, n)
    const P = [[0.0, 0.0, 0.42, 0.34], [0.42, 0.0, 0.58, 0.28], [0.0, 0.34, 0.3, 0.33], [0.3, 0.34, 0.4, 0.33], [0.7, 0.28, 0.3, 0.45], [0.0, 0.67, 0.55, 0.33], [0.55, 0.73, 0.45, 0.27]]
    for (const [x, y, w, h] of P) g.strokeRect(x * n, y * n, w * n, h * n) })
}
function FloorCells({ pat, col, cells }: { pat: FloorPat; col: string; cells: [number, number][] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const color = useMemo(() => new THREE.Color(col).multiplyScalar(0.9), [col])
  const map = useMemo(() => floorTex(pat), [pat])
  useEffect(() => {
    const m = ref.current; if (!m) return
    const o = new THREE.Object3D()
    cells.forEach(([i, j], n) => { o.position.set(i + 0.5, GROUND_Y + 0.03, j + 0.5); o.updateMatrix(); m.setMatrixAt(n, o.matrix) })
    m.count = cells.length; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere()
  }, [cells])
  return <instancedMesh ref={ref} args={[FLOOR_GEO, undefined, cells.length]} frustumCulled={false} receiveShadow><meshLambertMaterial key={map ? 't' : 'n'} color={color} map={map} /></instancedMesh>
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
    const n: Record<string, number> = {}
    for (const [i, j] of room.cells) for (const k of [`h,${i},${j}`, `h,${i},${j + 1}`, `v,${i},${j}`, `v,${i + 1},${j}`]) { const w = walls[k]; if (w && w.kind !== 'rail') { const c = wallColour(w); n[c] = (n[c] ?? 0) + 1 } }
    const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0]
    return best?.[0] ?? WALL_MATS.goldwood.color
  }, [room, walls])
  return (
    <>
      {geo && <mesh geometry={geo} castShadow><meshLambertMaterial color={ROOF} side={THREE.DoubleSide} /></mesh>}
      {ends && <mesh geometry={ends}><meshLambertMaterial color={endColor} side={THREE.DoubleSide} /></mesh>}
      {m.slabs.map((r, n) => <mesh key={n} position={[(r.x0 + r.x1) / 2, y + 0.11, (r.z0 + r.z1) / 2]} castShadow><boxGeometry args={[r.x1 - r.x0, 0.22, r.z1 - r.z0]} /><meshLambertMaterial color={ROOF} /></mesh>)}
    </>
  )
}
/** brick: courses of bricks with mortar lines, drawn once on a canvas (no art file); a 1 m x 3.2 m face */
function brickTex(): THREE.CanvasTexture | null {
  return proceduralTex('brick', (g, n) => {
    g.fillStyle = '#d8d0c4'; g.fillRect(0, 0, n, n)   // mortar
    const rows = 4, bw = n / 2, bh = n / rows, pad = 3
    for (let r = 0; r < rows; r++) for (let c = -1; c < 3; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0), shade = 215 + ((r * 7 + c * 13) % 5) * 8
      g.fillStyle = `rgb(${shade},${shade - 90},${shade - 110})`; g.fillRect(x + pad / 2, r * bh + pad / 2, bw - pad, bh - pad)
    }
  }, 1, 4)   // 4 repeats up a 3.2 m wall = 16 courses of 0.2 m
}
export function WallRun({ mat, tint, keys, ghost, h = WALL_H, y0 = 0, pane, cols }: { mat: WallMat; tint?: string; keys: string[]; ghost?: string; h?: number; y0?: number; pane?: boolean; /** M54 (2): ends at a column are cut back to its face */ cols?: Cols }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = ref.current; if (!m) return
    const o = new THREE.Object3D()
    keys.forEach((k, n) => {
      const r = cols ? trimmedRect(k, cols) : edgeRect(k), thin = pane ? (WALL_T - 0.06) : 0, alongX = r.x1 - r.x0 > r.z1 - r.z0
      o.position.set((r.x0 + r.x1) / 2, GROUND_Y + y0 + h / 2 + (ghost ? 0.01 : 0), (r.z0 + r.z1) / 2)
      o.scale.set(r.x1 - r.x0 + (ghost ? 0.04 : 0) - (alongX ? 0 : thin), h + (ghost ? 0.02 : 0), r.z1 - r.z0 + (ghost ? 0.04 : 0) - (alongX ? thin : 0)); o.updateMatrix(); m.setMatrixAt(n, o.matrix)
    })
    m.count = keys.length; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere()
  }, [keys, ghost, h, y0, pane, cols])
  return (
    <instancedMesh ref={ref} args={[WALL_GEO, undefined, Math.max(1, keys.length)]} frustumCulled={false}>
      {ghost ? <meshBasicMaterial color={ghost} transparent opacity={0.45} depthWrite={false} /> : pane ? <meshLambertMaterial color="#a9dcea" transparent opacity={0.45} depthWrite={false} /> : <WallMaterial mat={mat} tint={tint} />}
    </instancedMesh>
  )
}
function WallMaterial({ mat, tint }: { mat: WallMat; tint?: string }) {
  const map = useMemo(() => (mat === 'brick' ? brickTex() : null), [mat])
  const col = mat === 'brick' ? (map ? '#ffffff' : WALL_MATS.brick.color) : (mat === 'stucco' && tint ? tint : WALL_MATS[mat].color)
  return <meshLambertMaterial key={map ? 'm' : 'c'} color={col} map={map} />
}
/** M47: every level of the house, each lifted by its storeys. In plan mode the Sims cutaway: levels ABOVE the one being edited are
 *  hidden, the level(s) below show as a faint low guide, and only the top shown level wears the roof. Out of plan mode: all of them. */
/** the cells ('i,j') a lift shaft opens in level k's slab (lift.ts shaftHoles carries 'i,j,k') */
const shaftCellsAt = (w: Works, k: number) => [...shaftHoles(w)].filter(h => h.endsWith(`,${k}`)).map(h => h.split(',').slice(0, 2).join(','))
function HouseLevels({ w }: { w: Works }) {
  const b = useBuildMode(), edit = usePlanLevel(), n = levelCount(w), wd = useWallsDown(), fl = useMemo(() => liftOf(w), [w])   // M55 slice 2: each house on its own foundation
  const last = b ? Math.min(edit, n - 1) : n - 1
  const shown = Array.from({ length: last + 1 }, (_, k) => k)
  useEffect(() => { (window as unknown as { __floors?: object }).__floors = { shown: () => shown, editing: () => (b ? edit : -1), count: () => n } }, [shown.join(','), b, edit, n])   // checks' probe
  return (
    <>
      {shown.map(k => {
        const L = levelOf(w, k), hasCols = Object.keys(L.cols ?? {}).length > 0, hasStairs = Object.keys(L.stairs ?? {}).length > 0, hasDecks = Object.keys(L.decks ?? {}).length > 0; if (!Object.keys(L.walls).length && !hasCols && !hasStairs && !hasDecks) return null
        const holes = k > 0 ? new Set([...stairCellSet(levelOf(w, k - 1).stairs), ...shaftCellsAt(w, k)]) : undefined   // M47 close-out: the shaft is drawn open too (its solids always were)
        const guide = b && k < edit, rails = stairRails(w, k)
        return (
          <group key={k} position-y={levelBase(k)}>
            {Object.keys(L.walls).length > 0 && <DrawnWalls walls={L.walls} roof={w.roof ?? 'gable'} floors={L.floors} unbuilt={unbuiltRooms(L.walls, L.paid)} probe={k === 0} roofed={k === last} slab={k > 0} down={guide ? true : undefined} holes={holes} lift={fl} cols={L.cols} />}
            {hasCols && <DrawnCols cols={L.cols!} down={guide ? true : undefined} lift={fl} />}
            {hasStairs && <DrawnStairs stairs={L.stairs!} lift={fl} />}
            {hasDecks && <DrawnDecks decks={L.decks!} ground={k === 0} lift={fl} />}
            {rails.length > 0 && <StairRails rails={rails} down={guide || (b && wd)} lift={fl} />}
          </group>
        )
      })}
    </>
  )
}
/** M55: set ONE house's foundation (slice 2: the house the plan view is aimed at). Raising it pays Stone Brick for that house's
 *  built footprint (the Keepstone first, the bag tops up); lowering gives the difference back to the bag. Nothing changes unless
 *  all of it is there. */
function setFoundation(h: FoundH) {
  const w = currentWorks(), a = buildFocus(), house = liftOf(w).houseAt(a.x, a.z)
  if (!house) { hudSay('Aim the view at a house to set its foundation.', 'info'); return }
  const from = house.h; if (from === h && house.cells.every(c => (w.foundCells ?? {})[c] === h)) return
  const d = houseFoundDelta(house, from, h)
  if (d > 0) { const pay = payCost([{ id: STONE_BRICK, n: d }], getInv(), getB()); if (!pay) { hudSay(`${d} Stone Brick needed to raise the house, ${haveFor(getInv(), getB(), STONE_BRICK)} on hand.`, 'info'); return } setInv(pay.inv); if (pay.bank) setBank(pay.bank) }
  else if (d < 0) { const g = give(getInv(), STONE_BRICK, -d); if (g.left) { hudSay('Your bag is full: no room for the stone that comes back.', 'info'); return } setInv(g.inv) }
  const pre = house.room ? w.rooms.find(r => r.id === house.room) : undefined, what = pre ? `Your ${ROOMS[pre.kind].name}` : 'This house'   // M55: a prefab room is a house of its own
  setWorks(setHouseFound(w, house, h)); hudSay(h ? `${what} stands on a ${FOUND_NAME[h].toLowerCase()} foundation.` : `${what} is back on the ground.`, 'info')
}
/** M55: the plinth under the built house and the steps at its doors (stone, the solids' own boxes) */
function Plinth({ w }: { w: Works }) {
  const boxes = useMemo(() => [...plinthBoxes(w, GROUND_Y), ...doorSteps(w, GROUND_Y)], [w])
  if (!boxes.length) return null
  return (
    <>
      {boxes.map((b, n) => { const y0 = Math.max(b.y0, GROUND_Y - 0.15), h = b.y1 - y0; return (
        <mesh key={n} data-plinth position={[(b.x0 + b.x1) / 2, y0 + h / 2, (b.z0 + b.z1) / 2]} receiveShadow castShadow>
          <boxGeometry args={[b.x1 - b.x0, h, b.z1 - b.z0]} /><meshLambertMaterial color="#a8a196" />
        </mesh>
      ) })}
    </>
  )
}
/** M56 (c): the railing round a stair hole upstairs (plot-floors stairRails): half-wall pieces in the stairs' material, part of the stairs */
function StairRails({ rails, down, lift }: { rails: { key: string; mat: WallMat }[]; down: boolean; lift?: LiftLookup }) {
  const byMat = useMemo(() => { const m = new Map<string, string[]>(); for (const r of rails) { const id = `${r.mat}|${lift?.edge(r.key) ?? 0}`, l = m.get(id) ?? []; l.push(r.key); m.set(id, l) } return [...m].map(([id, keys]) => { const [mat, up] = id.split('|'); return { mat: mat as WallMat, up: +up, keys } }) }, [rails, lift])
  return <>{byMat.map(({ mat, up, keys }) => <group key={mat + up + keys.length + (down ? 'd' : '')} position-y={up}><WallRun mat={mat} keys={keys} h={down ? Math.min(RAIL_H, LOW_WALL) : RAIL_H} /></group>)}</>
}
/** phone layout for the plan bar (11-21): under 600 px the bar collapses to one row of tool tabs + the active tool's options, and
 *  the materials list becomes a slim strip above the bottom HUD. 600 px and up is the desktop layout, unchanged. */
const PHONE_BAR_W = 600
let phoneBar = typeof window !== 'undefined' && window.innerWidth < PHONE_BAR_W
const pbSubs = new Set<() => void>()
if (typeof window !== 'undefined') window.addEventListener('resize', () => { const v = window.innerWidth < PHONE_BAR_W; if (v !== phoneBar) { phoneBar = v; pbSubs.forEach(f => f()) } })
const usePhoneBar = () => useSyncExternalStore(f => { pbSubs.add(f); return () => { pbSubs.delete(f) } }, () => phoneBar, () => false)
/** M55 slice 2: the house the plan view is aimed at (re-read a few times a second: the lens glides without a React render) */
function useAimHouse(w: Works) {
  const [hs, setHs] = useState<Lift['houses'][number] | null>(null)
  useEffect(() => {
    const read = () => { const a = buildFocus(), h = liftOf(currentWorks()).houseAt(a.x, a.z); setHs(p => (p?.h === h?.h && p?.room === h?.room && p?.cells.join() === h?.cells.join() ? p : h)) }
    read(); const t = setInterval(read, 400); return () => clearInterval(t)
  }, [w])
  return hs
}
/** M56: a level's stairs: one box per step from the floor up (drawn from the solids' own boxes, plot-stairs.ts); a draft is a blue ghost */
function DrawnStairs({ stairs, lift }: { stairs: Stairs; lift?: LiftLookup }) {
  return (
    <>
      {Object.entries(stairs).map(([k, st]) => { const [si, sj] = k.split(',').map(Number), up = lift?.cell(si, sj) ?? 0; return [...stairBoxes(k, st, GROUND_Y + up), ...landingRails(k, st, GROUND_Y + up)].map((b, n) => {   // M56: a turned stair's guard rails draw as the same blocks
        const y0 = GROUND_Y + up, h = b.y1 - y0   // each step a block from the floor to its tread (a solid stair, no gaps under it)
        return (
          <mesh key={k + n} data-stair={k} position={[(b.x0 + b.x1) / 2, y0 + h / 2 + (st.draft ? 0.01 : 0), (b.z0 + b.z1) / 2]} castShadow receiveShadow>
            <boxGeometry args={[b.x1 - b.x0, h, b.z1 - b.z0]} />
            {st.draft ? <meshBasicMaterial color="#5aa0ff" transparent opacity={0.45} depthWrite={false} /> : <WallMaterial mat={st.mat} />}
          </mesh>
        )
      }) })}
    </>
  )
}
/** M54: the columns of one level: a 0.6 m square post per corner, a storey tall (low with the walls down); a draft is a blue ghost */
export function DrawnCols({ cols, down: downOverride, lift }: { cols: Cols; down?: boolean; lift?: LiftLookup }) {
  const wd = useWallsDown(), down = downOverride ?? wd, h = (down ? LOW_WALL : WALL_H) + COL_CAP   // M54 (2): a cap proud of the wall top
  return (
    <>
      {Object.entries(cols).map(([k, c]) => {
        const p = parseCol(k)!
        return (
          <mesh key={k} data-col={k} position={[p.i, GROUND_Y + (lift?.corner(p.i, p.j) ?? 0) + h / 2 + (c.draft ? 0.01 : 0), p.j]} castShadow>
            <boxGeometry args={[COL_T + (c.draft ? 0.04 : 0), h + (c.draft ? 0.02 : 0), COL_T + (c.draft ? 0.04 : 0)]} />
            {c.draft ? <meshBasicMaterial color="#5aa0ff" transparent opacity={0.45} depthWrite={false} /> : <WallMaterial mat={c.mat} tint={c.tint} />}
          </mesh>
        )
      })}
    </>
  )
}
function WallGhost() {
  const d = useWallDrag(), down = useWallsDown(), lv = usePlanLevel(), rail = useWallRail()
  if (!d || !d.keys.length) return null
  const h = down ? LOW_WALL : WALL_H
  return <group position-y={levelBase(lv)}><WallRun mat={wallMat} keys={d.keys} ghost={d.erase ? '#ff5a4a' : d.ok ? '#5aa0ff' : '#ff9a3a'} h={rail && !d.erase ? Math.min(RAIL_H, h) : h} /></group>
}
// ── THE CATALOG (Alex 11-18 brief + 11-19 playtest: 'it should be next to back to keeper'). v1 = the house pieces you
// can build today, by wood: Walls and Floors in Goldwood / Shimmeroak / Dawnwood, plus Door and Window (cut into a wall,
// they keep its wood). A wood you can't work yet shows greyed with WHERE it comes from (plain facts: the Forestry level its
// trees need and the bench that saws its planks), never hidden: the catalog is also the world's shopping list. Have / need on
// every card. Tapping a lit card picks that tool and wood (the catalog IS the paint picker). Same rule as the 09-27 law:
// a material is a LOOK, never power.
const WOOD_GATE: Record<WallMat, number> = { goldwood: 1, shimmeroak: 4, dawnwood: 10, brick: 0, stucco: 0 }   // forestry.ts TREE_TIER gates
function Catalog({ onPick }: { onPick: () => void }) {
  const inv = useInv(), lvl = forestryLevel()
  const pick = (t: 'walls' | 'paint' | 'door' | 'window', m?: WallMat, fp?: FloorPat, rail = false) => { setPlacing(null); if (m) { wallMat = m } if (t === 'walls') wallRail = rail; if (fp) { paintPat = fp; paintCol = FLOOR_PATS[fp].color } wdEmit(); setBuildTool(t); onPick() }
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
          <div style={{ font: '700 11px system-ui', letterSpacing: '.12em', textTransform: 'uppercase', color: H.ink, opacity: 0.7 }}>{t === 'walls' ? 'Walls · drawn as a plan, built from the list' : 'Floors · a pattern, painted a whole room'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {t === 'walls' ? WALL_MAT_ORDER.map(m => {
              const have = countOf(inv, WALL_MATS[m].item), open = lvl >= WOOD_GATE[m] || have > 0
              const sub = !isWood(m) ? `${have} ${itemDef(WALL_MATS[m].item).name}${paintable(m) ? ' · any colour' : ' · set colour'}` : open ? `${have} planks · set colour` : `Forestry ${WOOD_GATE[m]} · saw at your Carpentry`
              return card(`walls:${m}`, WALL_MATS[m].name, sub, true, () => pick('walls', m), WALL_MATS[m].color)   // a plan needs no materials to draw: the list is paid at Build
            }) : FLOOR_PAT_ORDER.map(f => card(`paint:${f}`, FLOOR_PATS[f].name, `${countOf(inv, FLOOR_PATS[f].item)} ${itemDef(FLOOR_PATS[f].item).name} · any colour`, true, () => pick('paint', undefined, f), FLOOR_PATS[f].color))}
          </div>
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
        {card('door', 'Door', 'Tap a wall · 2 m · keeps its wood', true, () => pick('door'))}
        {card('window', 'Window', 'Tap a wall · a crystal pane (on the list)', true, () => pick('window'))}
        {card('railing', 'Railing', 'Drag like a wall · 1 m high · a third the cost', true, () => pick('walls', undefined, undefined, true))}
      </div>
    </div>
  )
}
/** the Walls / Erase tools and the wood picker, in the build bar */
function WallTools({ owned, cat, onCat }: { owned: React.MutableRefObject<ReadonlySet<string>>; cat: boolean; onCat: () => void }) {
  const t = useBuildTool(), mat = useWallMat(), rail = useWallRail(), pk = usePaint(), [pPat, pCol] = pk.split('|') as [FloorPat, string], inv = useInv(), down = useWallsDown(), w = useWorks(), roof = w.roof ?? 'gable', owner = useOwner()
  const aimHouse = useAimHouse(w), phone = usePhoneBar(), [houseOpen, setHouseOpen] = useState(false)
  useEffect(() => { setPlanLift(aimHouse?.h ?? 0) }, [aimHouse])   // M55: drawing tools aim at the raised floor of the house in view
  useEffect(() => {
    if (t === 'look') return
    onBuildDraw(t === 'floor' ? deckHandler(() => owned.current) : t === 'stairs' ? stairsHandler(() => owned.current) : t === 'column' ? columnHandler(() => owned.current) : t === 'door' || t === 'window' || t === 'paint' || t === 'blueprint' ? tapToolHandler(t) : wallDrawHandler(() => owned.current, t === 'erase'))
    return () => onBuildDraw(null)
  }, [t, owned])
  const btn = (on: boolean): React.CSSProperties => ({ border: 0, borderRadius: 10, height: 34, padding: '0 10px', cursor: 'pointer', font: '700 12px system-ui', letterSpacing: '.06em', textTransform: 'uppercase', background: on ? H.ink : 'rgba(255,250,235,.7)', color: on ? '#fff' : H.ink, boxShadow: `inset 0 0 0 1px ${H.rule}` })
  if (phone) {
    // PHONE: one scrolling row of tool tabs, then only what the active tool needs; the house settings (walls down, roof,
    // foundation) live behind their own 'house' tab so nothing piles up over the drawing
    const row: React.CSSProperties = { display: 'flex', gap: 5, alignItems: 'center', overflowX: 'auto', flexWrap: 'nowrap', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', minWidth: 0 }
    return (
      <div data-wall-tools data-phone style={{ display: 'grid', gap: 5, padding: '5px 6px', borderRadius: 12, background: 'rgba(255,250,235,.86)', boxShadow: '0 2px 8px rgba(0,0,0,.2)', minWidth: 0 }}>
        <div data-tool-tabs style={row} onClickCapture={e => { const el = (e.target as HTMLElement).closest('[data-tool],[data-act="wall-catalog"]'); if (el) setHouseOpen(false) }}>
          <button type="button" data-act="wall-catalog" aria-pressed={cat} style={{ ...btn(cat), flex: '0 0 auto' }} onClick={onCat}>Catalog</button>
          <button type="button" data-tool="walls" style={{ ...btn(t === 'walls'), flex: '0 0 auto' }} onClick={() => { setPlacing(null); setBuildTool(t === 'walls' ? 'look' : 'walls') }}>Walls</button>
          <button type="button" data-tool="erase" style={{ ...btn(t === 'erase'), flex: '0 0 auto' }} onClick={() => { setPlacing(null); setBuildTool(t === 'erase' ? 'look' : 'erase') }}>Erase</button>
          {(['floor', 'column', 'stairs', 'door', 'window', 'paint'] as const).map(k => <button key={k} type="button" data-tool={k} style={{ ...btn(t === k), flex: '0 0 auto' }} onClick={() => { setPlacing(null); if (k === 'floor' && paintCol === '#dcd3c2') { paintCol = FLOOR_PATS[paintPat].color; wdEmit() } setBuildTool(t === k ? 'look' : k) }}>{k}</button>)}
          {owner && <button type="button" data-tool="blueprint" style={{ ...btn(t === 'blueprint'), flex: '0 0 auto' }} onClick={() => { setPlacing(null); setBpPick(null); setBuildTool(t === 'blueprint' ? 'look' : 'blueprint') }}>blueprint</button>}
          <button type="button" data-act="house-settings" aria-pressed={houseOpen} style={{ ...btn(houseOpen), flex: '0 0 auto' }} onClick={() => setHouseOpen(o => !o)}>house</button>
        </div>
        {houseOpen ? (
          <div data-tool-options data-house-options style={row}>
            <button type="button" data-act="walls-down" aria-pressed={down} style={{ ...btn(down), flex: '0 0 auto' }} onClick={() => setWallsDown(!down)}>{down ? 'Walls up' : 'Walls down'}</button>
            {ROOF_STYLES.map(r => (
        <button key={r} type="button" data-roof={r} aria-pressed={roof === r} style={{ ...btn(roof === r), height: 30, fontSize: 11, flex: '0 0 auto' }} onClick={() => setWorks({ ...currentWorks(), roof: r })}>{r}</button>
      ))}
            {<span data-found-picker style={{ flex: '0 0 auto', display: 'inline-flex', gap: 4, alignItems: 'center' }}><span style={{ font: '700 10px system-ui', letterSpacing: '.1em', textTransform: 'uppercase', color: H.ink, opacity: 0.6 }}>Foundation</span>{FOUND_OPTS.map(h => (
        <button key={h} type="button" data-found={h} aria-pressed={aimHouse?.h === h} disabled={!aimHouse} style={{ ...btn(aimHouse?.h === h), height: 30, fontSize: 11, opacity: aimHouse ? 1 : 0.4 }} onClick={() => setFoundation(h)}>{FOUND_NAME[h]}</button>
      ))}</span>}
          </div>
        ) : (t === 'walls' || t === 'column' || t === 'stairs') ? (
          <div data-tool-options style={row}>
            {t === 'walls' && <span data-wall-kind style={{ display: 'inline-flex', gap: 4, flex: '0 0 auto' }}>{([false, true] as const).map(r => <button key={String(r)} type="button" data-wall-kind={r ? 'rail' : 'wall'} aria-pressed={rail === r} style={{ ...btn(rail === r), height: 30, fontSize: 11 }} onClick={() => setWallRail(r)}>{r ? 'Railing' : 'Full wall'}</button>)}</span>}
            {t === 'stairs' && <StairShape btn={btn} />}
            {(t === 'walls' || t === 'column' || t === 'stairs') && WALL_MAT_ORDER.map(m => (
        <button key={m} type="button" data-wall-mat={m} title={`${WALL_MATS[m].name} · ${countOf(inv, WALL_MATS[m].item)} ${itemDef(WALL_MATS[m].item).name}`} onClick={() => { wallMat = m; wdEmit() }}
          style={{ ...btn(false), flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 5, textTransform: 'none', letterSpacing: 0, boxShadow: mat === m ? `inset 0 0 0 2px ${H.ink}` : `inset 0 0 0 1px ${H.rule}` }}>
          <i style={{ width: 14, height: 14, borderRadius: 3, background: WALL_MATS[m].color, display: 'inline-block' }} />{countOf(inv, WALL_MATS[m].item)}
        </button>
      ))}
          </div>
        ) : (t === 'paint' || t === 'floor') ? (
          <div data-tool-options style={{ display: 'grid', gap: 5, minWidth: 0 }}>
            {<div data-paint-picker style={{ display: 'grid', gap: 5, justifyItems: 'center', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>{FLOOR_PAT_ORDER.map(f => <button key={f} type="button" data-floor-pat={f} aria-pressed={pPat === f} title={`${FLOOR_PATS[f].name} floor · ${itemDef(FLOOR_PATS[f].item).name} per m²`} style={{ ...btn(pPat === f), height: 30, fontSize: 11 }} onClick={() => { paintPat = f; paintCol = FLOOR_PATS[f].color; wdEmit() }}>{FLOOR_PATS[f].name}</button>)}</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', alignItems: 'center', overflowX: 'auto', maxWidth: '100%', scrollbarWidth: 'none' }}>{SWATCHES.map(c => <button key={c} type="button" data-swatch={c} title={c} aria-label={`paint ${c}`} onClick={() => { paintCol = c; wdEmit() }} style={{ width: 20, height: 20, borderRadius: 5, border: 0, cursor: 'pointer', flex: 'none', background: c, boxShadow: pCol === c ? `inset 0 0 0 2px ${H.ink}, 0 0 0 1px #fff` : `inset 0 0 0 1px ${H.rule}` }} />)}
        <input type="color" data-paint-custom aria-label="custom colour" value={isColour(pCol) ? pCol : '#dcd3c2'} onChange={e => { if (isColour(e.target.value)) { paintCol = e.target.value; wdEmit() } }} style={{ width: 28, height: 24, padding: 0, border: 0, background: 'none', cursor: 'pointer', flex: 'none' }} /></div>
      </div>}
          </div>
        ) : null}
      </div>
    )
  }
  return (
    <div data-wall-tools style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', padding: '5px 8px', borderRadius: 12, background: 'rgba(255,250,235,.82)', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
      <button type="button" data-act="wall-catalog" aria-pressed={cat} style={btn(cat)} onClick={onCat}>Catalog</button>
      <button type="button" data-tool="walls" style={btn(t === 'walls')} onClick={() => { setPlacing(null); setBuildTool(t === 'walls' ? 'look' : 'walls') }}>Walls</button>
      <button type="button" data-tool="erase" style={btn(t === 'erase')} onClick={() => { setPlacing(null); setBuildTool(t === 'erase' ? 'look' : 'erase') }}>Erase</button>
      {t === 'walls' && <span data-wall-kind style={{ display: 'inline-flex', gap: 4 }}>{([false, true] as const).map(r => <button key={String(r)} type="button" data-wall-kind={r ? 'rail' : 'wall'} aria-pressed={rail === r} style={{ ...btn(rail === r), height: 30, fontSize: 11 }} onClick={() => setWallRail(r)}>{r ? 'Railing' : 'Full wall'}</button>)}</span>}
      {t === 'stairs' && <StairShape btn={btn} />}
      {(['floor', 'column', 'stairs', 'door', 'window', 'paint'] as const).map(k => <button key={k} type="button" data-tool={k} style={btn(t === k)} onClick={() => { setPlacing(null); if (k === 'floor' && paintCol === '#dcd3c2') { paintCol = FLOOR_PATS[paintPat].color; wdEmit() } setBuildTool(t === k ? 'look' : k) }}>{k}</button>)}   {/* M56 (a): the picker's untouched default is stucco cream; open floor starts in its pattern's own colour */}
      {owner && <button type="button" data-tool="blueprint" style={btn(t === 'blueprint')} onClick={() => { setPlacing(null); setBpPick(null); setBuildTool(t === 'blueprint' ? 'look' : 'blueprint') }}>blueprint</button>}
      {(t === 'paint' || t === 'floor') && <div data-paint-picker style={{ display: 'grid', gap: 5, flexBasis: '100%', justifyItems: 'center' }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>{FLOOR_PAT_ORDER.map(f => <button key={f} type="button" data-floor-pat={f} aria-pressed={pPat === f} title={`${FLOOR_PATS[f].name} floor · ${itemDef(FLOOR_PATS[f].item).name} per m²`} style={{ ...btn(pPat === f), height: 30, fontSize: 11 }} onClick={() => { paintPat = f; paintCol = FLOOR_PATS[f].color; wdEmit() }}>{FLOOR_PATS[f].name}</button>)}</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', alignItems: 'center' }}>{SWATCHES.map(c => <button key={c} type="button" data-swatch={c} title={c} aria-label={`paint ${c}`} onClick={() => { paintCol = c; wdEmit() }} style={{ width: 20, height: 20, borderRadius: 5, border: 0, cursor: 'pointer', flex: 'none', background: c, boxShadow: pCol === c ? `inset 0 0 0 2px ${H.ink}, 0 0 0 1px #fff` : `inset 0 0 0 1px ${H.rule}` }} />)}
        <input type="color" data-paint-custom aria-label="custom colour" value={isColour(pCol) ? pCol : '#dcd3c2'} onChange={e => { if (isColour(e.target.value)) { paintCol = e.target.value; wdEmit() } }} style={{ width: 28, height: 24, padding: 0, border: 0, background: 'none', cursor: 'pointer', flex: 'none' }} /></div>
      </div>}
      {(t === 'walls' || t === 'column' || t === 'stairs') && WALL_MAT_ORDER.map(m => (
        <button key={m} type="button" data-wall-mat={m} title={`${WALL_MATS[m].name} · ${countOf(inv, WALL_MATS[m].item)} ${itemDef(WALL_MATS[m].item).name}`} onClick={() => { wallMat = m; wdEmit() }}
          style={{ ...btn(false), display: 'flex', alignItems: 'center', gap: 5, textTransform: 'none', letterSpacing: 0, boxShadow: mat === m ? `inset 0 0 0 2px ${H.ink}` : `inset 0 0 0 1px ${H.rule}` }}>
          <i style={{ width: 14, height: 14, borderRadius: 3, background: WALL_MATS[m].color, display: 'inline-block' }} />{countOf(inv, WALL_MATS[m].item)}
        </button>
      ))}
      <button type="button" data-act="walls-down" aria-pressed={down} style={btn(down)} onClick={() => setWallsDown(!down)}>{down ? 'Walls up' : 'Walls down'}</button>
      {t !== 'look' && ROOF_STYLES.map(r => (
        <button key={r} type="button" data-roof={r} aria-pressed={roof === r} style={{ ...btn(roof === r), height: 30, fontSize: 11 }} onClick={() => setWorks({ ...currentWorks(), roof: r })}>{r}</button>
      ))}
      {t !== 'look' && <span data-found-picker style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><span style={{ font: '700 10px system-ui', letterSpacing: '.1em', textTransform: 'uppercase', color: H.ink, opacity: 0.6 }}>Foundation</span>{FOUND_OPTS.map(h => (
        <button key={h} type="button" data-found={h} aria-pressed={aimHouse?.h === h} disabled={!aimHouse} style={{ ...btn(aimHouse?.h === h), height: 30, fontSize: 11, opacity: aimHouse ? 1 : 0.4 }} onClick={() => setFoundation(h)}>{FOUND_NAME[h]}</button>
      ))}</span>}
    </div>
  )
}

// the garden bank's store (garden-bank.ts): one pool, every chest a door into it
let bank: Bank | null = null
const SERVER_BANK: Bank = freshBank()
const bsubs = new Set<() => void>()
const getB = (): Bank => { if (!bank) bank = typeof window === 'undefined' ? SERVER_BANK : loadBank(); return bank }
export function setBank(b: Bank) { bank = b; saveBank(b); bsubs.forEach(f => f()) }
/** M68 s2: the garden bank now (the one-pedestal guard reads it outside React) */
export const currentBank = () => getB()
export const useBank = () => useSyncExternalStore(f => { bsubs.add(f); return () => { bsubs.delete(f) } }, getB, () => SERVER_BANK)
/** M106: the planter takes a seed from the bank through this same store (spirit-panels.tsx cannot import it: a cycle). */
const PLANTER_BANK: BankStore = { use: useBank, get: getB, set: setBank }

// placing: which room, its turn, and where the ghost stands now (set by the scene each frame)
// `hand` (M45): the thing came from the HOTBAR (held in hand), not from a menu. It follows the stance: stow or swap and the
// ghost goes; E taps set it, an E hold turns it; R stays the stance's key (draw / stow), Esc is not a cancel.
type Placing = { kind: RoomKind; q: number } | { kind: 'chest'; item: string; q: number; hand?: true } | { kind: 'piece'; item: string; q: number; hand?: true } | null
let placing: Placing = null
const ghost = { x: 0, z: 0 }
const psubs = new Set<() => void>()
const setPlacing = (p: Placing) => { if (p && isVisiting()) return; placing = p; psubs.forEach(f => f()) }   // M61: nothing is placed on a mate's plot
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
function ghostAt(p: Pose, ahead: number, snap: number) {   // snap: steps per metre; 0 = freehand (M98)
  const b = buildPoint(), x = b ? b.x : p.x - Math.sin(p.yaw) * ahead, z = b ? b.z : p.z - Math.cos(p.yaw) * ahead
  ghost.x = snap ? Math.round(x * snap) / snap : x; ghost.z = snap ? Math.round(z * snap) / snap : z
}
/** M98: furniture + Keepstones snap to the keeper's chosen grid (build-prefs.ts), rooms stay on the metre. s2: while an ANCHOR
 *  stands (the last thing set freehand) the grid runs in its frame and the ghost lands flush on it. `plain` = ignore it (lifts). */
function ghostFine(p: Pose, ahead: number, w: number, d: number, q: number, plain = false, onto = false) {
  ghostAt(p, ahead, 0)
  const [x, z] = anchorSnap(ghost.x, ghost.z, getPrefs().snap, plain ? null : getAnchor(), w, d, q, onto)
  ghost.x = x; ghost.z = z
}
/** s2: a piece or Keepstone set FREEHAND becomes the anchor the next ghosts snap to; true when it did */
function anchorIfFree(q: number, w: number, d: number, floor = false): boolean {
  if (getPrefs().snap !== 0) return false
  setAnchor({ x: ghost.x, z: ghost.z, q, w, d, floor }); return true
}
function clearAnchor() { setAnchor(null); hudSay('Anchor cleared · the grid is the world\'s again', 'info', 2) }
const useAnchor = () => useSyncExternalStore(subscribeAnchor, getAnchor, () => null)
/** one turn of what is being placed: rooms a quarter, furniture + Keepstones by the chosen step */
const turnOnce = (p: NonNullable<Placing>): NonNullable<Placing> => ({ ...p, q: p.kind === 'piece' || p.kind === 'chest' ? turnQ(p.q, getPrefs().step) : (p.q + 1) % 4 }) as NonNullable<Placing>
/** M98: cycle the snap (G) or the turn step (T); said on the HUD */
function cycleSnap() { const p = getPrefs(), n = { ...p, snap: nextSnap(p.snap) }; setPrefs(n); hudSay(`Snap · ${snapLabel(n.snap)}`, 'info', 2) }
function cycleStep() { const p = getPrefs(), n = { ...p, step: nextStep(p.step) }; setPrefs(n); hudSay(`Turn · ${n.step}°`, 'info', 2) }
const useBuildPrefs = () => useSyncExternalStore(subscribePrefs, getPrefs, () => DEFAULT_PREFS)
/** The keeper's pose as the scene last saw it (the table's Plan lifts off from here). */
let lastPose: React.MutableRefObject<Pose> | null = null
/** Lift into build mode, optionally with something on the pointer already. */
function startBuild(p: Placing) {
  const tb = tableAt(getW()) ?? TABLE, at = lastPose?.current ?? { x: tb.x, z: tb.z + 4, yaw: 0 }
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
    const f = FURNITURE[item], an0 = !f.shaft && anchorIfFree(placing.q, f.w, f.d, !!f.slab) ? ' · anchor set, pick a snap to line up on it' : ''
    const an = (f.spirit === 'planter' && settlePlanter(c.piece.id) ? ' · its seed is back in the soil, still growing' : '')
      + (item === 'planter_box' && settleSaplingBox(c.piece.id) ? ' · its sapling is back in, still growing' : '') + an0   // M106 fix: a carried pot; M113: a carried sapling
    // keep placing while more of the same are in the bag (a row of stools is one job, not five trips to the table)
    if (countOf(c.inv, item) > 0) hudSay(`${FURNITURE[item].name} set · ${countOf(c.inv, item)} more in the bag · ${placing.hand ? 'hold R to put it away' : 'Esc stops'}${an}`, 'item', 4)
    else { setPlacing(null); hudSay(`${FURNITURE[item].name} set.${an}`, 'item', 3) }
    return
  }
  if (placing.kind === 'chest') {
    const c = placeChest(getW(), owned, getInv(), ghost.x, ghost.z, placing.q, Date.now(), placing.item)
    if (!c) { const v = canPlaceChest(getW(), owned, ghost.x, ghost.z, placing.q, getInv(), placing.item); hudSay(v.ok ? 'Cannot set a Keepstone there.' : v.why, 'info'); return }
    const an = anchorIfFree(placing.q, CHEST_W, CHEST_D) ? ' · anchor set' : ''
    setInv(c.inv); setWorks(c.works); setPlacing(null)
    hudSay(`Keepstone set · the bank holds ${bankCap(chestsStanding(c.works))} stacks now.${an}`, 'item', 5)
    return
  }
  const r = place(getW(), owned, getInv(), placing.kind, ghost.x, ghost.z, placing.q, Date.now(), getB())
  if (!r) { const v = canPlace(getW(), owned, placing.kind, ghost.x, ghost.z, placing.q, getInv(), getB()); hudSay(v.ok ? 'Cannot build there.' : v.why, 'info'); return }
  setInv(r.inv); if (r.bank) setBank(r.bank); setPlacing(null)
  // the first Farm of a garden comes with one starter packet of tier-1 seeds in its store (farmroom.ts), once
  const st = r.room.kind === 'farm' && farmStarterOn(loadTut()) ? grantStarter(currentFarm(), r.works, r.room.id) : null
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
      const fine = placing.kind === 'piece' || placing.kind === 'chest'   // M98: snap + step are furniture / Keepstone settings
      if (fromHand(placing)) {
        if (e.code === 'KeyE') {
          if (!e.repeat && !eDown) { const h = { turned: false, t: setInterval(() => { if (placing) { h.turned = true; setPlacing(turnOnce(placing)) } }, HAND_TURN_MS) }; eDown = h }
        } else if (e.code === 'Enter') confirmPlace(ownedRef.current)
        else if (e.code === 'KeyG' && !e.repeat) cycleSnap()
        else if (e.code === 'KeyT' && !e.repeat) cycleStep()
        else return
        e.preventDefault(); e.stopImmediatePropagation(); return
      }
      if (e.code === 'KeyR') setPlacing(turnOnce(placing))
      else if (fine && e.code === 'KeyG' && !e.repeat) cycleSnap()
      else if (fine && e.code === 'KeyT' && !e.repeat) cycleStep()
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

export function WorkshopScene({ pose, owned, stowed }: { pose: React.MutableRefObject<Pose>; owned: ReadonlySet<string>; /** M42: hands empty (melee swings) */ stowed?: () => boolean }) {
  lastPose = pose
  const w = useWorks(), p = usePlacing()
  // a raising room re-renders once a second until it stands
  const [, tick] = useState(0)
  const anyRaising = w.rooms.some(r => !raised(r))
  useEffect(() => { if (!anyRaising) return; const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t) }, [anyRaising])
  useEffect(() => { stationTick(); const t = setInterval(() => stationTick(), 1000); return () => clearInterval(t) }, [])
  return (
    <>
      {!w.tableMoved && <PlanningTable />}
      {w.rooms.map(r => { const up = roomLift(w, r); return raised(r) ? <RoomMesh key={r.id} r={r} lift={up} /> : r.shell ? <ShellRising key={r.id} r={r} lift={up} /> : <Scaffold key={r.id} r={r} lift={up} /> })}   {/* M55: a prefab room rides its own foundation */}
      {allChests(w).map(c => <Wobbly key={c.id} id={c.id} at={[c.x, floorAt(w, GROUND_Y, c.x, c.z), c.z]}><Keepstone c={c} pose={pose} y={floorAt(w, GROUND_Y, c.x, c.z)} /></Wobbly>)}
      {w.pieces.map(pc => { const y = pieceFloor(w, pc); return <Wobbly key={pc.id} id={pc.id} at={[pc.x, y, pc.z]}><PieceMesh p={pc} y={y} /></Wobbly> })}
      <Plinth w={w} />
      {stowed && <MeleeAim stowed={stowed} />}
      {w.pieces.some(x => x.item === 'lift') && <LiftInput />}
      <MoglinsAtWork w={w} />
      <BlueprintPicked />
      <HouseLevels w={w} />
      <WallGhost />
      <DeckGhost />
      {p && (p.kind === 'piece' ? <PieceGhost pose={pose} owned={owned} item={p.item} q={p.q} /> : p.kind === 'chest' ? <ChestGhost pose={pose} owned={owned} q={p.q} item={p.item} /> : <Ghost pose={pose} owned={owned} kind={p.kind} q={p.q} />)}
    </>
  )
}

// ── MOGLINS, SEEN (moglin-model.tsx; Alex 11-18 "add one to my garden so i can check em out") ───────────────────
const GARB_OF: Partial<Record<string, MoglinGarb>> = { cook: 'apron', carpenter: 'toolbelt', alchemist: 'scarf', smith: 'toolbelt', stonemason: 'toolbelt', jeweler: 'scarf' }
/** Every Moglin keeping a room stands at its bench, working (the village re-reads every few seconds: a panel assigns). */
let moglinsDrawn: string[] = []
if (typeof window !== 'undefined') (window as unknown as { __moglinsDrawn?: () => string[] }).__moglinsDrawn = () => [...moglinsDrawn]
function MoglinsAtWork({ w }: { w: Works }) {
  const [v, setV] = useState(() => (typeof window === 'undefined' ? null : loadVillage()))
  useEffect(() => { const t = setInterval(() => setV(loadVillage()), 3000); return () => clearInterval(t) }, [])
  const host = useSyncExternalStore(subscribeVisit, shownMoglins, () => null)   // M61: on a mate's plot, THEIR Moglins at work
  const ms: readonly { id: string; profession: string; room?: string }[] | undefined = host ?? v?.moglins
  if (!ms) return null
  const drawn: string[] = []; moglinsDrawn = drawn   // probe: the ids the last render drew (plot-visit-leftovers-check)
  return (
    <>
      {ms.map(m => {
        const s = m.profession === 'alchemist' ? standAt(w, m as MoglinRecord) : null   // M57 s2: an alchemist stands at its Desk, facing it
        if (s) { drawn.push(m.id); return (
          <group key={m.id} position={[s.x, floorAt(w, GROUND_Y, s.x, s.z), s.z]} rotation-y={s.yaw}>
            <MoglinModel action="work" garb={GARB_OF[m.profession] ?? 'none'} tone={furOf(m.id)} seed={m.id.length} />
          </group>
        ) }
        const r = m.room ? w.rooms.find(x => x.id === m.room) : undefined
        if (!r || !raised(r)) return null
        drawn.push(m.id)
        const at = toWorld(r, 0, ROOMS[r.kind].d / 2 - 2.35)   // in front of the bench, facing it (local +z = the back wall)
        return (
          <group key={m.id} position={[at.x, floorAt(w, GROUND_Y, at.x, at.z), at.z]} rotation-y={-r.q * Math.PI / 2}>
            <MoglinModel action="work" garb={GARB_OF[m.profession] ?? 'none'} tone={furOf(m.id)} seed={m.id.length} />
          </group>
        )
      })}
    </>
  )
}
/** M96: the table at its first spot (never moved); once moved it is a piece and PieceBody draws the same body. Wobbles on a hit. */
function PlanningTable() {
  return <Wobbly id={TABLE_HIT} at={[TABLE.x, GROUND_Y, TABLE.z]}><group position={[TABLE.x, GROUND_Y, TABLE.z]}><PlanningTableBody /></group></Wobbly>
}
function PlanningTableBody() {
  return (
    <group>
      <mesh position-y={0.95}><boxGeometry args={[2.2, 0.12, 1.3]} /><meshLambertMaterial color={WOOD} /></mesh>
      {[[-1, -0.55], [1, -0.55], [-1, 0.55], [1, 0.55]].map(([x, z], k) => <mesh key={k} position={[x, 0.45, z]}><boxGeometry args={[0.12, 0.9, 0.12]} /><meshLambertMaterial color={WOOD} /></mesh>)}
      {/* the plan sheet: the ghost-blue of a room not built yet */}
      <mesh position-y={1.02} rotation-x={-Math.PI / 2}><planeGeometry args={[1.7, 1]} /><meshBasicMaterial color={SHEET} /></mesh>
      <mesh position={[0.2, 1.03, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.18, 0.24, 4]} /><meshBasicMaterial color="#e8f3ff" /></mesh>
    </group>
  )
}

/** The room as it stands: its walls (the same boxes the walker hits), a floor, a roof, the bench. */
function RoomMesh({ r, lift = 0 }: { r: Room; lift?: number }) {
  const walls = useMemo(() => wallsOf(r), [r])
  const f = footprint(r.kind, r.x, r.z, r.q), b = benchOf(r)
  const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2, sx = f.x1 - f.x0, sz = f.z1 - f.z0, hWall = WALL_H
  return (
    <group position-y={lift}>
      <mesh position={[cx, GROUND_Y + 0.04, cz]}><boxGeometry args={[sx, 0.08, sz]} /><meshLambertMaterial color="#b98d5a" /></mesh>
      {walls.map((k, i) => (
        <mesh key={i} position={[(k.x0 + k.x1) / 2, GROUND_Y + hWall / 2, (k.z0 + k.z1) / 2]}>
          <boxGeometry args={[k.x1 - k.x0, hWall, k.z1 - k.z0]} /><meshLambertMaterial color={WALL} />
        </mesh>
      ))}
      {!r.shell && <>   {/* M97: a shell has no roof */}
        <mesh position={[cx, GROUND_Y + WALL_H + 0.12, cz]}><boxGeometry args={[sx + 0.8, 0.24, sz + 0.8]} /><meshLambertMaterial color={ROOF} /></mesh>
        <mesh position={[cx, GROUND_Y + WALL_H + 0.7, cz]}><boxGeometry args={[sx * 0.6, 0.9, sz * 0.6]} /><meshLambertMaterial color={ROOF} /></mesh>
      </>}
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

/** M97: a shell going up has no scaffolding (Alex: "the walls and building around the rooms can go"): its floor and bench grow
 *  up out of the ground as the job runs. */
function ShellRising({ r, lift = 0 }: { r: Room; lift?: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => { if (g.current) g.current.scale.y = Math.max(0.02, progress(r)) })
  return <group position-y={GROUND_Y + lift}><group ref={g}><group position-y={-GROUND_Y}><RoomMesh r={r} /></group></group></group>
}
/** Scaffolding: four poles, rails at each storey, and the walls rising inside them as the job goes on. */
function Scaffold({ r, lift = 0 }: { r: Room; lift?: number }) {
  const f = footprint(r.kind, r.x, r.z, r.q), walls = useMemo(() => wallsOf(r), [r])
  const rise = useRef<THREE.Group>(null)
  useFrame(() => { if (rise.current) rise.current.scale.y = Math.max(0.02, progress(r)) })
  const poles = [[f.x0, f.z0], [f.x1, f.z0], [f.x0, f.z1], [f.x1, f.z1]]
  const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2, sx = f.x1 - f.x0, sz = f.z1 - f.z0
  return (
    <group position-y={lift}>
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
function Keepstone({ c, pose, y = GROUND_Y }: { c: Chest; pose: React.MutableRefObject<Pose>; y?: number }) {
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
    <group position={[c.x, y, c.z]} rotation-y={-c.q * Math.PI / 2}>
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
    ghostFine(pose.current, 1.8, CHEST_W, CHEST_D, q)
    g.current?.position.set(ghost.x, floorAt(getW(), GROUND_Y, ghost.x, ghost.z) + CHEST_H / 2, ghost.z)
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
/** M107 (owner + ?spirits=3d): where the planter's spirit may go. Home = the planter, its ring 0.9..1.5 m (the planter's
 *  corners sit at 0.64 m) = the home beat. s2 (Magii RULED 11-23, athernyx 8b45c92: a bloomed spirit walks the whole garden):
 *  straight darting legs anywhere on YOUR plot at her planter's own level. Blocked = any wall/chest/piece/house box (bar the
 *  planter's own) and every room's footprint, padded by her half-width; Greg; ground that is not yours, not island, or not
 *  the planter's floor (a deck, a raised house, the shore). Boxes are re-read when the works change. */
const SPIRIT_PAD = 0.22
let navBoxes: { w: Works; b: { x0: number; x1: number; z0: number; z1: number }[] } | null = null
function planterNav(id: string): SpiritNav | null {
  const pc = getW().pieces.find(x => x.id === id); if (!pc) return null
  const home = { x: pc.x, z: pc.z }, owned = new Set(loadGarden().owned), floor0 = pieceFloor(getW(), pc)
  const boxes = () => {
    const w = getW()
    if (navBoxes?.w !== w) navBoxes = { w, b: [...workWalls(w).filter(b => !(home.x > b.x0 && home.x < b.x1 && home.z > b.z0 && home.z < b.z1)), ...w.rooms.map(r => footprint(r.kind, r.x, r.z, r.q)), { x0: GREG.x - 0.5, x1: GREG.x + 0.5, z0: GREG.z - 0.5, z1: GREG.z + 0.5 }] }
    return navBoxes.b
  }
  // M110 s1: the training pieces on her floor; she plays ACROSS a piece's depth (its local z, turned with the piece)
  const toys = () => getW().pieces.filter(t => FURNITURE[t.item]?.train && Math.abs(pieceFloor(getW(), t) - floor0) < 0.02)
    .map(t => { const a = -t.q * Math.PI / 2, f = FURNITURE[t.item], kind = f.play ?? 'leap'   // M110 s2: how she plays at it, and its measure
      return { id: t.id, x: t.x, z: t.z, ax: Math.sin(a), az: Math.cos(a), stat: f.train!, kind, size: kind === 'shove' ? f.d / 2 : kind === 'guard' ? f.w / 2 - 0.3 : kind === 'laps' ? f.w / 2 - 0.15 : undefined } })
  return { home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, roam: { maxLeg: 4.5, away: 3 }, toys, blocked: (x, z) => {
    const sq = squareAt(x, z); if (!sq || !owned.has(sqId(sq.i, sq.j))) return true
    if (!(Math.abs(plotHeightAt(x, z) - GROUND_Y) < 0.05) || Math.abs(pieceFloor(getW(), { item: pc.item, x, z }) - floor0) > 0.02) return true
    return boxes().some(b => x > b.x0 - SPIRIT_PAD && x < b.x1 + SPIRIT_PAD && z > b.z0 - SPIRIT_PAD && z < b.z1 + SPIRIT_PAD)
  } }
}
/** M76: the spirit planter: woven starwillow round soft soil; a sprout that grows with the seed; a gold glow once it bloomed. */
function SpiritPlanterBody({ id }: { id?: string }) {
  const f = FURNITURE.spirit_planter, c = WOODS.starwillow, b = useBook(), pot = id ? b.pots[id] : undefined
  const orb = useRef<THREE.Mesh>(null), sprout = useRef<THREE.Group>(null), spirits3d = useSpirits3d()   // M102: owner + ?spirits=3d = the spirit model
  // M102 Manalotl wire-in: the bloomed pot's OWN species' model (spirit-models.ts), or the gold orb when it has none yet
  const sp = pot?.bloomed ? speciesOf(pot.seed) : null, look = spirits3d ? spiritModelFor(sp) : null
  const nav = useMemo(() => (look && id ? planterNav(id) : null), [look, id])   // M107 s1: she trots round it
  useFrame(({ clock }) => {
    if (orb.current) orb.current.position.y = 1.0 + Math.sin(clock.elapsedTime * 1.6) * 0.06
    if (sprout.current && pot && !pot.bloomed) { const g = Math.max(0.15, Math.min(1, (Date.now() - pot.at) / BLOOM_MS)); sprout.current.scale.setScalar(g) }
  })
  const orbMesh = <mesh ref={orb} position-y={1.0}><sphereGeometry args={[0.16, 14, 10]} /><meshBasicMaterial color={f.glow} transparent opacity={0.85} /></mesh>
  return <>
    {[0, 1, 2, 3].map(k => <Bx key={k} p={[0, 0.1 + k * 0.13, 0]} s={[f.w - (k % 2) * 0.04, 0.09, f.d - (k % 2) * 0.04]} c={k % 2 ? '#aab6d0' : c} />)}
    <Bx p={[0, 0.5, 0]} s={[f.w - 0.12, 0.05, f.d - 0.12]} c="#4a3524" />
    {[-1, 1].flatMap(a => [-1, 1].map(z => <mesh key={`${a}${z}`} position={[a * (f.w / 2 - 0.04), 0.62, z * (f.d / 2 - 0.04)]}><sphereGeometry args={[0.035, 6, 5]} /><meshBasicMaterial color="#eaf2ff" /></mesh>))}
    {pot && !pot.bloomed && <group ref={sprout} position={[0, 0.52, 0]}><mesh position-y={0.12}><cylinderGeometry args={[0.015, 0.02, 0.24, 5]} /><meshLambertMaterial color="#9ad06a" /></mesh><mesh position={[0.05, 0.22, 0]} rotation-z={-0.8}><sphereGeometry args={[0.05, 6, 4]} /><meshLambertMaterial color="#b6e27e" /></mesh><mesh position={[-0.05, 0.18, 0]} rotation-z={0.8}><sphereGeometry args={[0.045, 6, 4]} /><meshLambertMaterial color="#b6e27e" /></mesh></group>}
    {pot?.bloomed && <>{look && sp ? <SpiritOnPlanter sp={sp} look={look} y={0.53} fallback={orbMesh} nav={nav ?? undefined} id={id} /> : orbMesh}<pointLight position-y={1.0} color={f.glow} intensity={0.6} distance={3} /></>}
  </>
}
/** One piece, built from boxes in its wood's colour. Blockout look like the rooms. */
export function PieceBody({ item, id }: { item: string; id?: string }) {
  const f = FURNITURE[item], c = WOODS[f.wood], dk = '#6b4a2a'
  const legs = (w: number, d: number, h: number, t = 0.07) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], k) => <Bx key={k} p={[a * (w / 2 - t), h / 2, b * (d / 2 - t)]} s={[t, h, t]} c={c} />)
  switch (item) {
    case TABLE_ITEM: return <PlanningTableBody />   // M96: the moved planning table
    case 'goldwood_stool': return <><Bx p={[0, 0.45, 0]} s={[0.46, 0.07, 0.46]} c={c} />{legs(0.4, 0.4, 0.42)}</>
    case 'goldwood_bench': return <><Bx p={[0, 0.45, 0]} s={[f.w, 0.08, f.d]} c={c} />{legs(f.w - 0.1, f.d, 0.42, 0.09)}</>
    case 'goldwood_hurdle': return <><Bx p={[-f.w / 2 + 0.04, f.h / 2, 0]} s={[0.07, f.h, 0.07]} c={c} /><Bx p={[f.w / 2 - 0.04, f.h / 2, 0]} s={[0.07, f.h, 0.07]} c={c} /><Bx p={[0, f.h - 0.05, 0]} s={[f.w, 0.06, 0.06]} c={c} /><Bx p={[0, f.h * 0.45, 0]} s={[f.w - 0.08, 0.04, 0.04]} c={dk} />{[-1, 1].map(a => <Bx key={a} p={[a * (f.w / 2 - 0.04), 0.02, 0]} s={[0.1, 0.04, f.d]} c={dk} />)}</>   // M110 s1
    // M110 s2 the PWR / GRD / VIG pieces (code-drawn blockouts)
    case 'push_stone': return <><Bx p={[0, f.h / 2, 0]} s={[f.w, f.h, f.d]} c={c} /><Bx p={[0, f.h + 0.004, 0]} s={[f.w - 0.08, 0.008, f.d - 0.08]} c="#d4cdbd" /><Bx p={[0, 0.03, 0]} s={[f.w + 0.04, 0.06, f.d + 0.04]} c="#8a8274" /></>
    case 'guard_posts': return <>{[-1, 1].map(a => <group key={a}><Bx p={[a * (f.w / 2 - 0.1), 0.06, 0]} s={[0.22, 0.12, f.d]} c="#a4573f" /><Bx p={[a * (f.w / 2 - 0.1), f.h / 2 + 0.06, 0]} s={[0.12, f.h - 0.1, 0.12]} c={c} /><Bx p={[a * (f.w / 2 - 0.1), f.h + 0.02, 0]} s={[0.16, 0.05, 0.16]} c={dk} /></group>)}</>
    case 'running_ring': return <>{Array.from({ length: 16 }, (_, k) => { const a = k / 16 * Math.PI * 2, r = f.w / 2 - 0.05; return <Bx key={k} p={[Math.cos(a) * r, f.h / 2, Math.sin(a) * r]} s={[0.07, f.h, 0.07]} c={k % 2 ? dk : c} /> })}</>
    case 'goldwood_table': return <><Bx p={[0, 0.76, 0]} s={[f.w, 0.08, f.d]} c={c} />{legs(f.w - 0.1, f.d - 0.1, 0.72, 0.09)}</>
    case 'spirit_planter': return <SpiritPlanterBody id={id} />
    case 'grimoire_pedestal': return <><Bx p={[0, 0.05, 0]} s={[f.w, 0.1, f.d]} c={c} /><Bx p={[0, 0.5, 0]} s={[0.3, 0.8, 0.3]} c={c} /><mesh position={[0, 0.95, 0]} rotation-x={-0.5}><boxGeometry args={[0.6, 0.06, 0.45]} /><meshLambertMaterial color={c} /></mesh><mesh position={[0, 0.99, 0.02]} rotation-x={-0.5}><boxGeometry args={[0.44, 0.02, 0.32]} /><meshBasicMaterial color="#2a2533" /></mesh><mesh position={[0, 1.0, 0.025]} rotation-x={-Math.PI / 2 - 0.5}><planeGeometry args={[0.36, 0.24]} /><meshBasicMaterial color={f.glow} transparent opacity={0.55} /></mesh></>
    case 'planter_box': return <><Bx p={[0, 0.25, 0]} s={[f.w, 0.5, f.d]} c={c} /><Bx p={[0, 0.48, 0]} s={[f.w - 0.12, 0.06, f.d - 0.12]} c="#5a3d25" /><Bx p={[0, 0.27, 0]} s={[f.w + 0.02, 0.12, f.d + 0.02]} c="#8a6a3a" /><PottedSapling id={id} top={0.51} /></>
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
    // M57 the alchemy set: blockout manatech (wood frame, stone/iron/glass parts, a lit mana band on each)
    case 'alc_mortar': return <><Bx p={[0, 0.72, 0]} s={[f.w, 0.08, f.d]} c={c} />{legs(f.w - 0.1, f.d - 0.1, 0.68, 0.08)}<mesh position-y={0.86}><cylinderGeometry args={[0.24, 0.16, 0.2, 12]} /><meshLambertMaterial color="#bdb6a6" /></mesh><mesh position-y={0.965} rotation-x={-Math.PI / 2}><circleGeometry args={[0.2, 12]} /><meshLambertMaterial color="#8a8274" /></mesh><mesh position={[0.06, 1.08, 0]} rotation-z={0.35}><cylinderGeometry args={[0.04, 0.06, 0.42, 8]} /><meshLambertMaterial color="#77716b" /></mesh><mesh position={[0.11, 1.2, 0]} rotation-z={0.35}><cylinderGeometry args={[0.065, 0.065, 0.05, 10]} /><meshBasicMaterial color={f.glow} /></mesh></>
    case 'alc_still': return <><Bx p={[0, 0.3, 0]} s={[f.w, 0.6, f.d]} c={c} /><mesh position={[0, 0.5, f.d / 2 + 0.005]}><boxGeometry args={[0.36, 0.12, 0.01]} /><meshBasicMaterial color={f.glow} /></mesh><mesh position={[-0.15, 0.86, 0]}><sphereGeometry args={[0.22, 12, 10]} /><meshLambertMaterial color="#cfe8f5" transparent opacity={0.6} /></mesh><mesh position={[-0.15, 1.12, 0]}><cylinderGeometry args={[0.04, 0.06, 0.16, 8]} /><meshLambertMaterial color="#cfe8f5" transparent opacity={0.6} /></mesh><mesh position={[0.18, 1.3, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.14, 0.025, 6, 16]} /><meshLambertMaterial color="#c08a4a" /></mesh><mesh position={[0.18, 1.4, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.14, 0.025, 6, 16]} /><meshLambertMaterial color="#c08a4a" /></mesh><Bx p={[0.02, 1.22, 0]} s={[0.3, 0.03, 0.03]} c="#c08a4a" /><mesh position={[0.3, 0.7, 0.12]}><cylinderGeometry args={[0.06, 0.06, 0.2, 8]} /><meshBasicMaterial color={f.glow} transparent opacity={0.85} /></mesh></>
    case 'alc_mixer': return <><Bx p={[0, 0.76, 0]} s={[f.w, 0.08, f.d]} c={c} />{legs(f.w - 0.1, f.d - 0.1, 0.72, 0.09)}<mesh position={[0.4, 0.88, 0]}><cylinderGeometry args={[0.3, 0.24, 0.36, 14]} /><meshLambertMaterial color="#4e4a47" /></mesh><mesh position={[0.4, 1.065, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.27, 14]} /><meshBasicMaterial color={f.glow} /></mesh><mesh position={[0.4, 0.5, 0]}><cylinderGeometry args={[0.12, 0.12, 0.1, 10]} /><meshBasicMaterial color="#8fe3ff" /></mesh>{[-0.55, -0.35, -0.15].map(x => <Bx key={x} p={[x, 0.85, 0.1]} s={[0.12, 0.1, 0.22]} c="#6f9a4a" />)}</>
    case 'alc_desk': return <><Bx p={[0, 0.72, 0]} s={[f.w, 0.07, f.d]} c={c} />{legs(f.w - 0.1, f.d - 0.1, 0.68, 0.08)}<Bx p={[0, 0.96, -f.d / 2 + 0.04]} s={[f.w, 0.48, 0.05]} c={c} /><Bx p={[0, 1.0, -f.d / 2 + 0.14]} s={[f.w - 0.1, 0.03, 0.18]} c={c} />{[-0.5, -0.3, -0.1, 0.1].map((x, k) => <mesh key={x} position={[x, 1.08, -f.d / 2 + 0.14]}><cylinderGeometry args={[0.04, 0.04, 0.13, 8]} /><meshBasicMaterial color={['#c9a8ff', '#8fe3ff', '#ff9a4a', '#9ae06a'][k]} /></mesh>)}<Bx p={[0.42, 0.88, 0.1]} s={[0.03, 0.26, 0.03]} c="#a4793e" /><mesh position={[0.42, 1.04, 0.1]}><torusGeometry args={[0.09, 0.015, 6, 16]} /><meshLambertMaterial color="#a4793e" /></mesh><mesh position={[0.42, 1.04, 0.1]}><circleGeometry args={[0.08, 14]} /><meshBasicMaterial color={f.glow} transparent opacity={0.45} side={THREE.DoubleSide} /></mesh></>
    default:
      // M98b b2 wall panels: the wall itself in its material, a darker sill and a cap (three meshes: a run of panels stays cheap)
      if (f.panel) { const pc = f.tint ?? c, tr = f.tint ? '#7a3f2e' : dk; return <><Bx p={[0, f.h / 2, 0]} s={[f.w, f.h, f.d]} c={pc} /><Bx p={[0, 0.09, 0]} s={[f.w + 0.02, 0.18, f.d + 0.04]} c={tr} /><Bx p={[0, f.h - 0.05, 0]} s={[f.w + 0.02, 0.1, f.d + 0.04]} c={tr} /></> }
      // M98b floor slabs: a slab with a seam every metre (wood: planks run along w; stone: a flag grid)
      if (f.slab) return <><Bx p={[0, f.h / 2, 0]} s={[f.w, f.h, f.d]} c={c} />
        {Array.from({ length: Math.round(f.w * (f.wood === 'stone' ? 1 : 3)) - 1 }, (_, k) => { const n = Math.round(f.w * (f.wood === 'stone' ? 1 : 3)); return <Bx key={`x${k}`} p={[-f.w / 2 + (k + 1) * f.w / n, f.h + 0.003, 0]} s={[0.025, 0.006, f.d - 0.02]} c={f.wood === 'stone' ? '#8a8274' : dk} /> })}
        {f.wood === 'stone' && Array.from({ length: Math.round(f.d) - 1 }, (_, k) => <Bx key={`z${k}`} p={[0, f.h + 0.003, -f.d / 2 + (k + 1)]} s={[f.w - 0.02, 0.006, 0.025]} c={f.wood === 'stone' ? '#8a8274' : dk} />)}</>
      return <Bx p={[0, f.h / 2, 0]} s={[f.w, f.h, f.d]} c={c} />
  }
}
/** M42: a hit wobbles the thing about its own foot (melee-view.tsx) */
function Wobbly({ id, at, children }: { id: string; at?: [number, number, number]; children: React.ReactNode }) {
  const g = useHitWobble(id), [x, y, z] = at ?? [0, 0, 0]
  return <group position={[x, y, z]}><group ref={g}><group position={[-x, -y, -z]}>{children}</group></group></group>
}
/** `y` = the floor under it (M55: on the plinth inside a raised house). Wobbly only pivots, it does not lift. */
function PieceMesh({ p, y = GROUND_Y }: { p: Piece; y?: number }) {
  if (p.item === 'lift') return <LiftMesh p={p} />
  return <group position={[p.x, y, p.z]} rotation-y={-p.q * Math.PI / 2}><PieceBody item={p.item} id={p.id} /></group>
}
/** The piece's ghost: the real piece, tinted, snapped to the quarter metre in front of the keeper. */
function PieceGhost({ pose, owned, item, q }: { pose: React.MutableRefObject<Pose>; owned: ReadonlySet<string>; item: string; q: number }) {
  const f = FURNITURE[item], g = useRef<THREE.Group>(null), mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    ghostFine(pose.current, Math.max(f.w, f.d) / 2 + 1.2, f.w, f.d, q, !!f.shaft, !f.slab)
    g.current?.position.set(f.shaft ? cellMid(ghost.x) : ghost.x, pieceFloor(getW(), { item, x: ghost.x, z: ghost.z }), f.shaft ? cellMid(ghost.z) : ghost.z)
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
const TABLE_PICKS: readonly TablePick[] = ['keepstone', ...ROOM_ORDER.filter(k => !(k === 'alchemy' && ALC_LIVE))]   // the alchemy ROOM is retired once its furniture set is live (M57)
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

/** M47: the floor switcher in the plan bar: 1 / 2 / 3. Drawing goes onto the selected floor; floors above it hide. */
function FloorSwitch() {
  const lv = usePlanLevel(), w = useWorks(), ref = useRef<HTMLDivElement>(null)
  // centred on the left edge, unless a plan bar reaches over it (phone: the Paint bar runs past the middle): then just below that bar
  const [below, setBelow] = useState<number | null>(null)
  useEffect(() => {
    const f = () => {
      const el = ref.current; if (!el) return
      const me = el.getBoundingClientRect(); let b = 0
      document.querySelectorAll('[data-build-bar],[data-plan-bom]').forEach(e => { const r = e.getBoundingClientRect(); if (r.left < me.right + 8 && r.height > 0 && r.top < innerHeight / 2) b = Math.max(b, r.bottom) })
      const mid = innerHeight / 2 - el.offsetHeight / 2
      setBelow(b + 10 > mid ? Math.round(b + 10) : null)
    }
    f(); const t = setInterval(f, 300); addEventListener('resize', f)
    return () => { clearInterval(t); removeEventListener('resize', f) }
  }, [])
  return (
    <div ref={ref} data-floor-switch style={{ position: 'fixed', left: 'calc(10px + env(safe-area-inset-left, 0px))', top: below ?? '50%', transform: below == null ? 'translateY(-50%)' : 'none', zIndex: 41, pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', padding: '6px 6px', borderRadius: 12, background: 'rgba(255,250,235,.88)', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
      <span style={{ font: '700 10px system-ui', letterSpacing: '.12em', textTransform: 'uppercase', color: H.ink, opacity: 0.7 }}>Floor</span>
      {Array.from({ length: MAX_LEVELS }, (_, k) => (
        <button key={k} type="button" data-floor={k} aria-pressed={lv === k} title={k < levelCount(w) ? `Floor ${k + 1}` : `Plan floor ${k + 1}`} onClick={() => setPlanLevel(k)}
          style={{ width: 34, height: 30, borderRadius: 8, border: 0, cursor: 'pointer', font: '700 14px system-ui', background: lv === k ? H.ink : 'rgba(0,0,0,.08)', color: lv === k ? '#fff' : H.ink }}>{k + 1}</button>
      ))}
    </div>
  )
}
/** M37 slice 4: the plan's BILL OF MATERIALS, in the plan-mode bar. Shows once something is planned: each part with
 *  have / need (the Keepstone and the bag count together), red when short, and Build (enabled only when it is all there). */
/** desktop: how far up from the bottom the Health card reaches (the materials card sits clear above it); 92 px when none is found */
const healthClear = () => {
  if (typeof document === 'undefined') return 92
  const plate = [...document.querySelectorAll('span')].find(s => s.textContent === 'Health')?.closest('.w-52')
  const r = plate?.getBoundingClientRect()
  return r && r.height ? Math.round(innerHeight - r.top + 10) : 92
}
function PlanBom({ slim = false }: { slim?: boolean }) {
  const w = useWorks(), inv = useInv(), bank = useBank()
  const [lift, setLift] = useState(92)
  useEffect(() => { if (slim) return; const f = () => setLift(healthClear()); f(); const t = setInterval(f, 500); return () => clearInterval(t) }, [slim])
  const bom = useMemo(() => billOfAll(w, inv, bank), [w, inv, bank])
  if (bom.empty) return null
  const build = () => {
    const c = currentWorks(), r = buildAll(c, getInv(), getB())   // M47: every level's draft
    if (!r.ok) { hudSay(r.why, 'info'); return }
    setInv(r.inv); if (r.bank) setBank(r.bank); setWorks(r.works)
    hudSay('Built. The house stands.', 'item')
  }
  if (slim) {
    // PHONE (11-21): one slim line above the bottom HUD (rendered OUTSIDE the transformed build bar, so 'fixed' means the screen):
    // what the plan is, the first thing short (or "all here"), and Build. The lines stay in the DOM for the checks.
    const short = bom.lines.find(l => l.short)
    return (
      <div data-plan-bom data-ready={bom.ok} data-slim style={{ position: 'fixed', bottom: 'calc(108px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', width: 'calc(100vw - 24px)', zIndex: 41, pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 10px', borderRadius: 12, background: 'rgba(255,250,235,.94)', boxShadow: '0 2px 8px rgba(0,0,0,.25)', color: H.ink }}>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 1 }}>
          <span style={{ font: '700 10px system-ui', letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Plan · {bom.pieces} m{bom.rooms ? ` · ${bom.rooms} room${bom.rooms > 1 ? 's' : ''}` : ''}</span>
          <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: short ? '#b5452c' : H.ink }}>{short ? `${Math.min(short.have, short.n)} / ${short.n} ${short.name}` : `Everything is here (${bom.lines.map(l => `${l.n} ${l.name}`).join(', ')})`}</span>
          {bom.lines.map(l => <span key={l.id} data-bom-line={l.id} data-need={l.n} data-have={l.have} data-short={l.short} hidden />)}
        </div>
        <span data-act="build-plan" style={{ flex: '0 0 auto' }}><HearthButton primary disabled={!bom.ok} onClick={build}>Build</HearthButton></span>
      </div>
    )
  }
  return (
    // DESKTOP (11-21): bottom-left above the Health card. It used to sit INSIDE the build bar, whose transform made 'fixed' mean the
    // bar: the card landed across the bar's third row (walls down / roof / foundation) and over the middle of the drawing.
    <div data-plan-bom data-ready={bom.ok} style={{ position: 'fixed', bottom: lift, left: 'calc(16px + env(safe-area-inset-left, 0px))', width: 'min(340px, calc(100vw - 32px))', zIndex: 41, pointerEvents: 'auto', display: 'grid', gap: 4, padding: '8px 10px', borderRadius: 12, background: 'rgba(255,250,235,.92)', boxShadow: '0 2px 8px rgba(0,0,0,.2)', color: H.ink }}>
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
  const b = useBuildMode(), p = usePlacing(), tool = useBuildTool(), rail = useWallRail(), phone = usePhoneBar()
  const [sel, setSel] = useState<TablePick | null>(null), [cat, setCat] = useState(false)
  const ownedRef = useRef(owned); ownedRef.current = owned
  const touchy = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  // a mouse click on the ground places what is on the pointer
  useEffect(() => { if (!b) return; onBuildTap(() => { if (placing) confirmPlace(ownedRef.current) }); return () => onBuildTap(null) }, [b])
  useEffect(() => { if (!b) { setSel(null); setCat(false) } }, [b])
  // 11-21: tell the plan lens how much the bar covers (top) and the HUD / materials strip (bottom), so the work is framed in the free band
  useEffect(() => {
    if (!b) return
    const f = () => {
      const bar = document.querySelector('[data-build-bar]')?.getBoundingClientRect(), bom = document.querySelector('[data-plan-bom][data-slim]')?.getBoundingClientRect()
      setPlanInsets(bar ? Math.round(bar.bottom) : 0, bom ? Math.round(innerHeight - bom.top) : (phone ? 108 : 0))
    }
    f(); const t = setInterval(f, 300); return () => { clearInterval(t); setPlanInsets(0, 0) }
  }, [b, phone])
  if (!b) return null
  return (
    <>
    <FloorSwitch />
    <PlanBom slim={phone} />
    <div data-build-bar style={{ position: 'fixed', top: typeof window !== 'undefined' && window.innerWidth < 600 ? 112 : 96, left: '50%', transform: 'translateX(-50%)', width: 'min(560px, calc(100vw - 24px))', zIndex: 41, pointerEvents: 'none', display: 'grid', gap: 6 }}>
      <style>{'[data-build-bar] > *:not([data-build-hint]) { pointer-events: auto }'}</style>   {/* the bar's gaps let a tap through to the drawing; its panels take it */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 14, background: 'rgba(255,250,235,.88)', boxShadow: '0 2px 10px rgba(0,0,0,.25)', minWidth: 0 }}>
        <button type="button" data-act="land" onClick={() => { setPlacing(null); exitBuild() }}
          style={{ flex: '0 0 auto', border: 0, borderRadius: 10, padding: '0 10px', height: 52, cursor: 'pointer', background: H.ink, color: '#fff', font: '700 12px system-ui', lineHeight: 1.15 }}>Back to<br />keeper</button>
        <BuildStrip sel={sel} onSel={k => { setBuildTool('look'); setSel(s => (s === k ? null : k)) }} size={44} />
      </div>
      {cat && <Catalog onPick={() => setCat(false)} />}
      <WallTools owned={ownedRef} cat={cat} onCat={() => { setSel(null); setCat(c => !c) }} />
      {tool === 'blueprint' && <BlueprintBar />}
      {sel && <BuildCard k={sel} onBuilt={() => setSel(null)} />}
      {!p && !sel && <div data-build-hint style={{ justifySelf: 'center', fontSize: 11.5, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.6)', pointerEvents: 'none' }}>{tool === 'walls' ? `Drag along the grid to draw ${rail ? 'a railing (1 m, a third the cost)' : 'a plan'} · it costs nothing until you Build · ${touchy ? 'two fingers move the view' : 'right-drag or WASD moves the view'}` : tool === 'erase' ? 'Drag along a wall to take it down · what was built comes back to the bag' : tool === 'floor' ? `Drag a rectangle of open floor in the picked pattern: a patio on the ground, a balcony upstairs (held by a wall, column or room under it, 1 m past at most) · drag from floor already down to take it up` : tool === 'column' ? 'Tap a grid corner for a column (pick its material) · tap a column to take it away' : tool === 'stairs' ? `Tap a cell: stairs climb one floor, away from you (${touchy ? 'turn the view' : 'Q / Z turns the view'} to turn them) · tap stairs to take them away` : tool === 'door' ? 'Tap a wall for a 2 m doorway · tap a door to fill it in' : tool === 'window' ? 'Tap a wall for a window · tap it again to fill it in' : tool === 'paint' ? `Pick a pattern and a colour, then tap a floor (the whole room) or a stucco wall · ${touchy ? 'long-press' : 'right-click'} paints everything connected. Wood and brick keep their own colour` : <>Pick something to build{touchy ? '' : ' · drag to move · wheel to zoom · WASD · Q Z turn'}</>}</div>}
    </div>
    </>
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
/** Who works a room and how fast: its Moglin (its CRAFT score, M65), else the keeper while the panel is open (a focus only), else nobody (0). */
function workerOf(r: Room, v: Village): { moglin?: Village['moglins'][number]; speed: number } {
  const m = v.moglins.find(x => x.room === r.id && WORKS_IN[x.profession].includes(r.kind))
  return m ? { moglin: m, speed: moglinSpeed(scoreIn(m, r.kind, 'craft')) } : { speed: openBench === r.id ? 1 : 0 }
}
/** Run every station to now. Offline catch-up is the same call: `last` is a timestamp, the Moglin's hours since are worked
 *  out of the store into the output (station-queue.ts: stockpile above the 30 reserve, capped at 30 a product). */
const benchDue = new Map<string, number>()   // M99: when each bench's next working phrase is due
const benchHist = new Map<string, string[]>()   // M99: each bench's recent phrases (the pool never plays one 3 times running)
let firstTick = true   // the first run per page load is the offline catch-up: what the Moglins made joins the 'while you were away' line
export function stationTick(now = Date.now()) {
  if (!worksWritable()) return   // M61: visiting a mate's plot: your stations wait (their clocks catch up at home)
  const first = firstTick; firstTick = false
  const w = getW(); if (!w.rooms.some(r => raised(r, now))) return
  const v = loadVillage(); let nw = w, changed = false
  const away: Made = {}
  const benches: BenchSnap[] = []
  for (const r of w.rooms) {
    if (!raised(r, now)) continue
    const { moglin, speed } = workerOf(r, v)
    if (!moglin && (speed <= 0 || !(r.work?.focus || r.work?.run))) continue   // the keeper only ever works a focus
    const a = advance(stationOf(r), now, speed, moglin ? stockJobs(r.kind) : [], moglin ? { chance: luckChance(moglin), rnd: Math.random } : undefined)
    if (a.active || !r.work) { nw = setStation(nw, r.id, a.station); changed = true }   // an idle Moglin saves nothing (the panel re-starts its clock when the stock changes)
    if (first && moglin) addMade(away, a.made)
    if (STATION_VOICE[r.kind]) benches.push({ id: r.id, kind: r.kind, working: speed > 0 && !!a.station.work?.run, made: !first && a.made.length > 0, at: { x: r.x, y: GROUND_Y + 1.2, z: r.z } })
  }
  // M99: the bench's working phrase while it crafts + a sting when a run lands (proposed ids stay silent until Alex's yay)
  const ear = lastPose?.current
  for (const s of stationSounds(benchDue, benches, now, ear ? { x: ear.x, z: ear.z } : null, id => sfxStatus(id) === 'yay', benchHist)) sfx(s.id, { at: s.at })
  if (changed) setWorks(nw)
  if (first && Object.keys(away).length) reportAway(away)
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

/** The tab each room's bench last showed (this page load): reopening a bench lands where you left it. */
const lastTab = new Map<string, BenchTab>()

/** The icon tab rail (Alex 11-20: tabs with icons, not one long list). Pinned above the scrolling body. */
function TabRail({ tabs, on, go }: { tabs: BenchTab[]; on: BenchTab; go: (t: BenchTab) => void }) {
  return (
    <div role="tablist" data-bench-tabs style={{ display: 'flex', gap: 6, paddingBottom: 10, borderBottom: `1px solid ${H.rule}` }}>
      {tabs.map(t => {
        const sel = t === on
        return (
          <button key={t} type="button" role="tab" aria-selected={sel} data-bench-tab={t} title={TAB_LABEL[t]} onClick={() => go(t)}
            style={{ all: 'unset', cursor: 'pointer', flex: '1 1 0', minWidth: 0, maxWidth: 92, display: 'grid', justifyItems: 'center', gap: 3, padding: '7px 4px 6px', borderRadius: 10,
              color: sel ? '#fff' : H.ink, background: sel ? H.ink : 'rgba(58,39,22,.07)', opacity: sel ? 1 : 0.72, transition: 'background .12s, opacity .12s' }}>
            <TabGlyph tab={t} />
            <span style={{ font: '700 9.5px system-ui', letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{TAB_LABEL[t]}</span>
          </button>
        )
      })}
    </div>
  )
}

function BenchPanel({ room, onClose }: { room: Room; onClose: () => void }) {
  const inv = useInv(), w = useWorks(), def = ROOMS[room.kind], bankNow = useBank(), narrow = useNarrow()
  const spirits3d = useSpirits3d()   // M110 s1: training pieces are owner + ?spirits=3d only for now
  const r = w.rooms.find(x => x.id === room.id) ?? room   // the live room (its store moves under the panel)
  const [pick, setPick] = useState<Pick>({ job: null, qty: 10 })
  const tabs = benchTabs(r.kind)
  const [tab, setTab] = useState<BenchTab>(() => { const t = lastTab.get(r.id); return t && tabs.includes(t) ? t : tabs[0] })
  const go = (t: BenchTab) => { lastTab.set(r.id, t); setTab(t); setPick(p => ({ ...p, job: null })) }
  useEffect(() => { stationTick(); openBench = room.id; touchWork(room.id); return () => { if (openBench === room.id) openBench = null } }, [room.id])
  const foods = Object.keys(BAIT_FROM).filter(id => benchCount(r, inv, id) > 0)
  const inBank = (id: string) => bankCount(bankNow, id)
  const reach = (id: string) => benchCount(r, inv, id) + inBank(id)
  const crafts = (jobs: readonly Job[]) => jobs.filter(j => j.in.some(c => reach(c.id) > 0))
  const cl = (jobs: readonly Job[], note: string, empty?: string) => <CraftList note={note} jobs={jobs} r={r} pick={pick} setPick={setPick} empty={empty} />
  const dim = narrow ? '!max-h-none' : ''
  const focusSkill = (Object.keys(BENCH) as FocusSkill[]).find(s => BENCH[s] === r.kind && tabOfFocus(s) === tab)
  const body = (() => {
    switch (tab) {
      case 'refine': return r.kind === 'stonemason'
        ? cl(crafts(STONE_REFINE), 'Parts for a house plan, cut from every stone in the store. A Moglin also keeps stacks going by itself.', 'No blankstone or mana shards to cut. Prospect them in the Wilds.')
        : cl(crafts(REFINE), 'Each log works two ways. Focus one: the station works every log in its store, one at a time. A Moglin also keeps stacks going by itself.', 'No logs to work. Prune trees in the Wilds. Better woods come as your Forestry grows.')
      case 'furniture': return cl(spirits3d ? PIECE_JOBS : PIECE_JOBS.filter(j => !FURNITURE[j.id]?.train), 'Finished pieces wait in the output. Hold one from the hotbar on your plot and E sets it.')
      case 'hearth': return cl(ROAST, 'Hold a roast in the Wilds and click to eat it mid-fight. Meat comes from the Smokehouse in the continent\'s towns.')
      case 'cauldron': return cl(BREW, 'Hold a potion and click to drink.')
      case 'blades': case 'spikes': return focusSkill ? <FocusList r={r} inv={inv} skill={focusSkill} /> : null
      case 'rinsticks': return <RinstickList r={r} inv={inv} />
      case 'keeper': return <MoglinDuty r={r} />
      case 'bait': return (
        <div>
          <div style={lab}>Bait · {countOf(inv, 'bait')} in the bag</div>
          <div style={{ fontSize: 12.5, color: H.inkSoft, margin: '4px 0 8px' }}>An offering the rinn come to, one per cast. Cut from the room's store first, then your bag.</div>
          {foods.length ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {foods.map(id => (
                <div key={id} data-bait-from={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 13.5, color: H.ink }}>{itemDef(id).name} <span style={{ color: H.inkSoft }}>× {benchCount(r, inv, id)}</span></span>
                  <HearthButton small onClick={() => { const m = makeBaitAt(getW(), r.id, getInv(), id); if (m) { setWorks(m.works); setInv(m.inv) } else hudSay('No room for the bait. Clear a slot in your bag.', 'info') }}>Make bait +{baitYield(inv, id)}</HearthButton>
                </div>
              ))}
            </div>
          ) : <div style={{ fontSize: 13, color: H.inkSoft }}>Nothing to cut. A small catch, or mast off a pruned tree, makes bait.</div>}
        </div>
      )
    }
  })()
  const work = (
    <HearthFrame title={def.name} maxWidth={520} onClose={onClose} fixed dataPanel="bench" backdrop={false} bodyClass={dim}
      head={<TabRail tabs={tabs} on={tab} go={go} />}>
      <div data-bench-body={tab} style={{ padding: '12px 16px 14px', display: 'grid', gap: 12 }}>{body}</div>
    </HearthFrame>
  )
  // what is crafting NOW gets its own panel (Alex 11-20: "its own panel ... a buffer bar so the player can actively see the thing crafting")
  const now = (
    <HearthFrame title="Crafting" maxWidth={narrow ? 520 : 400} onClose={onClose} fixed dataPanel="crafting" backdrop={false} closable={false} bodyClass={dim}>
      <div style={{ padding: '24px 16px 14px' }}><WorkView r={r} /></div>
    </HearthFrame>
  )
  const store = <StorePanel r={r} pick={pick} narrow={narrow} onClose={onClose} />
  return (
    <div data-station={r.kind} className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[3px] pointer-events-auto overflow-y-auto" onClick={onClose} onContextMenu={e => e.preventDefault()}
      style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: narrow ? 'center' : 'flex-start', justifyContent: 'center', gap: narrow ? 22 : 18, padding: narrow ? '34px 0 24px' : '6vh 16px 24px' }}>
      {narrow ? <>{now}{work}{store}</> : (
        <>
          {work}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>{now}{store}</div>
        </>
      )}
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
/** A filling bar (the crafting panel). */
function Bar({ frac, tone = '#c8902f', h = 10, ...rest }: { frac: number; tone?: string; h?: number } & Record<`data-${string}`, string | number>) {
  return (
    <div {...rest} style={{ height: h, borderRadius: h, background: 'rgba(58,39,22,.12)', boxShadow: 'inset 0 1px 2px rgba(58,39,22,.25)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%`, height: '100%', borderRadius: h, background: `linear-gradient(180deg, ${tone}, #a06a1c)`, transition: 'width .25s linear' }} />
    </div>
  )
}

/** THE CRAFTING PANEL (Alex 11-20): the run in progress with a live bar, the Focus with its overall bar, who works it, the
 *  Moglin's stockpile, and the finished output to collect. Redraws 4x a second; when the bar fills it runs the station tick
 *  so the item lands now, not at the next minute tick. */
function WorkView({ r }: { r: Room }) {
  const [, force] = useState(0)
  useEffect(() => { const t = setInterval(() => force(n => n + 1), 250); return () => clearInterval(t) }, [])
  const st = stationOf(r), w = st.work, v = loadVillage(), who = workerOf(r, v), stock = stockJobs(r.kind)
  const status = statusOf(st, who.moglin ? stock : []), outs = st.out ?? []
  const fj = w?.focus && jobById(w.focus.job)
  const prog = runProgress(st, Date.now(), who.speed)
  const landed = useRef(0)
  useEffect(() => { if (prog && prog.frac >= 1 && Date.now() - landed.current > 400) { landed.current = Date.now(); stationTick() } })
  const collect = (id: string, n?: number) => {
    touchWork(r.id)
    const cur = stationOf(getW().rooms.find(x => x.id === r.id)!), t = takeOut(cur, id, n), g = give(getInv(), id, t.took)
    setWorks(setStation(getW(), r.id, putOut(t.station, id, g.left))); setInv(g.inv)
    if (g.left > 0) hudSay('Your bag is full. The rest waits in the station.', 'info')
  }
  const liveStock = stock.filter(j => st.store?.some(x => x.id === j.in[0].id) || (st.out ?? []).some(x => x.id === j.out.id))
  const pd = prog && itemDef(prog.job.out.id)
  // the focus's overall share: runs done of the runs asked (an older save has no total: the bar is left out)
  const of = w?.focus?.of, done = of && w?.focus ? of - w.focus.left + (prog && w.run?.f ? prog.frac : 0) : 0
  return (
    <div data-work style={{ display: 'grid', gap: 10 }}>
      {prog && pd ? (
        <div data-run={prog.job.id} data-run-frac={prog.frac.toFixed(3)} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Well size={52}>{pd.icon ? <img src={pd.icon} alt="" width={36} height={36} draggable={false} /> : <span style={{ fontSize: 12, fontWeight: 700, color: H.inkSoft }}>{pd.name.slice(0, 3)}</span>}</Well>
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 5 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <b style={{ fontSize: 14, color: H.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prog.job.out.n > 1 ? `${prog.job.out.n} ` : ''}{pd.name}</b>
              <span className="tabular-nums" style={{ marginLeft: 'auto', fontSize: 12, color: H.inkSoft, whiteSpace: 'nowrap' }}>{prog.msLeft === Infinity ? 'paused' : prog.frac >= 1 ? 'done' : `${fmtSecs(prog.msLeft)} left`}</span>
            </div>
            <Bar frac={prog.frac} data-run-bar={prog.job.id} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: H.inkSoft }}>{stock.length && who.moglin ? 'Nothing on the bench right now.' : 'Nothing crafting. Pick something in the panel and Focus it.'}</div>
      )}
      {fj && w?.focus && (
        <div data-focus-line={fj.id} data-left={w.focus.left} style={{ display: 'grid', gap: 5 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: H.ink }}>
            <span style={{ flex: 1, minWidth: 0 }}><b>Focus:</b> {itemDef(fj.out.id).name} <span className="tabular-nums" style={{ color: H.inkSoft }}>· {w.focus.left * fj.out.n} to go</span></span>
            <span data-act="cancel-focus"><HearthButton small onClick={() => { touchWork(r.id); setWorks(setStation(getW(), r.id, cancelFocus(stationOf(getW().rooms.find(x => x.id === r.id)!)))) }}>Stop</HearthButton></span>
          </div>
          {of ? <Bar frac={done / of} h={6} tone="#7fa35a" data-focus-bar={fj.id} /> : null}
        </div>
      )}
      {!fj && stock.length > 0 && (
        <div style={{ fontSize: 12, color: H.inkSoft }}>{who.moglin ? `${who.moglin.name} keeps ${RESERVE} of each raw material for you and refines the rest into a stack of ${OUT_CAP} of each product.` : `A Moglin keeping this room refines whatever is above ${RESERVE} of each raw material into a stack of ${OUT_CAP} of each product.`}</div>
      )}
      {who.moglin && liveStock.length > 0 && (
        <div data-stockpile style={{ display: 'grid', gap: 4 }}>
          {liveStock.map(j => { const l = stockLine(st, j); return (
            <div key={j.id} data-stock={j.out.id} data-made={l.made} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 8px', fontSize: 12, color: H.ink }}>
              <span>{itemDef(j.out.id).name}</span><span className="tabular-nums" style={{ color: l.made >= l.cap ? '#3d7a30' : H.inkSoft }}>{l.made} / {l.cap}</span>
              <div style={{ gridColumn: '1 / -1' }}><Bar frac={l.made / l.cap} h={4} tone="#8aa0b8" /></div>
              {l.made < l.cap && !l.waiting && <span style={{ gridColumn: '1 / -1', fontSize: 11, color: H.inkFaint }}>waiting for more than {RESERVE} {itemDef(j.in[0].id).name.toLowerCase()}</span>}
            </div>) })}
        </div>
      )}
      <div data-work-status={status} style={{ fontSize: 12, color: status === 'idle' ? '#9a5f10' : H.inkSoft, fontWeight: status === 'idle' ? 700 : 400 }}>
        {status === 'idle' ? (who.moglin ? 'Idle: every product has its stack, or nothing is left above the reserve.' : fj ? 'Paused: the store has no inputs for it.' : 'Idle.') : who.speed > 0 ? (who.moglin ? `${who.moglin.name} is working` : 'You are working it (while this panel is open)') : 'No one is working it. Keep this panel open, or put a Moglin on the room.'}
      </div>
      <div>
        <div style={lab}>Done · up to {OUT_CAP} of an item</div>
        {outs.length ? (
          <div style={{ ...grid, marginTop: 6 }}>
            {outs.map(s => <Cell key={s.id} s={s} data-out-item={s.id} title=" · tap to collect" onClick={() => collect(s.id)} />)}
          </div>
        ) : <div style={{ fontSize: 12.5, color: H.inkFaint, marginTop: 4 }}>Nothing finished yet.</div>}
        {outs.length > 0 && <div style={{ marginTop: 6 }}><span data-act="collect-all"><HearthButton small onClick={() => outs.forEach(s => collect(s.id))}>Collect all</HearthButton></span></div>}
      </div>
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
  const fam = skill === 'forestry' ? 'Pruners' : 'Spikes', node = skill === 'forestry' ? 'tree' : 'crystal'
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
  // M46: Inspect a garden Moglin = its card (full: it came because it trusts you), opened under its row, one at a time
  const [card, setCard] = useState<string | null>(null)
  const phone = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
  const inspect = (m: Village['moglins'][number]) => (
    <span data-act="inspect"><HearthButton small onClick={() => setCard(c => (c === m.id ? null : m.id))}>{card === m.id ? 'Close' : 'Inspect'}</HearthButton></span>
  )
  const cardFor = (m: Village['moglins'][number]) => card === m.id
    ? <div data-moglin-card-for={m.id} style={{ marginTop: 6, maxWidth: 340 }}><MoglinCard card={recordCard(m)} id={m.id} phone={phone} /></div> : null
  const put = (id: string, room: string | null) => {
    const nv = assign(loadVillage(), getW(), id, room); if (!nv) { hudSay('Their trade does not suit this room.', 'info'); return }
    saveVillage(nv); setV(nv); touchWork(r.id)
  }
  // M65 s2: the SCORES (0-10) of the skills THIS room reads (its craft + idle-yield skill, once when they are the same)
  const grades = (m: Village['moglins'][number]) => { const st = statsOf(m), u = SKILL_OF_ROOM[r.kind]
    return [...new Set([u.craft, u.yield])].map(k => `${SKILL_LABEL[k]} ${skillScore(st, k)}/10`).join(' · ') }
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
          {inspect(here)}
          <span data-act="off-duty"><HearthButton small onClick={() => put(here.id, null)}>Rest</HearthButton></span>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: H.inkSoft, marginTop: 4 }}>{fits.length ? 'No one yet. Someone in your village could take it on.' : 'No one in your village has this trade yet. Folk in the Wilds settlements might come, if asked.'}</div>
      )}
      {here && cardFor(here)}
      {fits.map(m => (<div key={m.id}>
        <div data-moglin={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: H.ink }}>{m.name} <span style={{ color: H.inkSoft, fontSize: 12 }}>· the {m.profession} · {grades(m)}{m.room ? ' · busy in another room' : ''}</span></span>
          {inspect(m)}
          <span data-act="ask"><HearthButton small onClick={() => put(m.id, r.id)}>{here ? 'Ask instead' : 'Ask to work here'}</HearthButton></span>
        </div>
        {cardFor(m)}
      </div>))}
    </div>
  )
}

/** A bench's craft list (M43): each job shows its time per item; tap one to set how many (1 / 10 / 99 / max) and Focus it. */
function CraftList({ note, jobs, r, pick, setPick, empty }: { note: string; jobs: readonly Job[]; r: Room; pick: Pick; setPick: (p: Pick) => void; empty?: string }) {
  const inv = useInv(), bank = useBank()
  const reachOf = (j: Job) => Math.min(...j.in.map(c => Math.floor((benchCount(r, inv, c.id) + bankCount(bank, c.id)) / c.n)))
  const j = pick.job && jobs.some(x => x.id === pick.job!.id) ? pick.job : null
  if (!jobs.length) return <div style={{ fontSize: 13, color: H.inkSoft }}>{empty}</div>
  const afford = j ? maxAffordable(j, r.store) : 0, qty = pick.qty === 'max' ? afford : pick.qty, reach = j ? reachOf(j) : 0
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* the tiles: what this tab makes, as icons (tap one to pick it). Dim = nothing on hand for it. */}
      <div data-craft-tiles style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6 }}>
        {jobs.map(x => {
          const on = j?.id === x.id, d = itemDef(x.out.id), has = reachOf(x) > 0
          return (
            <button key={x.id} type="button" data-job={x.id} data-job-pick={x.id} data-sel={on} title={d.name} onClick={() => setPick({ ...pick, job: on ? null : x })}
              style={{ all: 'unset', cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 3, padding: '6px 3px 5px', borderRadius: 10, opacity: has || on ? 1 : 0.5,
                background: on ? 'rgba(58,39,22,.1)' : 'transparent', boxShadow: on ? `inset 0 0 0 2px ${H.ink}` : `inset 0 0 0 1px ${H.rule}` }}>
              <span style={{ position: 'relative' }}>
                <Well size={44}>{d.icon ? <img src={d.icon} alt="" width={30} height={30} draggable={false} /> : <span style={{ fontSize: 11, fontWeight: 700, color: H.inkSoft }}>{d.name.slice(0, 3)}</span>}</Well>
                {x.out.n > 1 && <span className="absolute bottom-0.5 right-1 text-[11px] font-extrabold tabular-nums" style={{ color: H.ink, textShadow: '0 1px 0 rgba(255,250,235,.8)' }}>{x.out.n}</span>}
              </span>
              <span style={{ fontSize: 10.5, lineHeight: 1.15, color: H.ink, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{d.name}</span>
            </button>
          )
        })}
      </div>
      {/* the picked one: what it takes, how long, how many, Focus */}
      {j ? (
        <div data-craft-detail={j.id} style={{ display: 'grid', gap: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(58,39,22,.06)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 14, color: H.ink }}>{j.out.n > 1 ? `${j.out.n} ` : ''}{itemDef(j.out.id).name}</b>
            <span style={{ fontSize: 12, color: H.inkSoft }}>{j.in.map(c => `${c.n} ${itemDef(c.id).name}`).join(' + ')} · {itemMs(j) / 1000} s each</span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: H.inkSoft }}>{reach > 0 ? `${reach} run${reach === 1 ? '' : 's'} on hand` : 'none on hand'}</span>
          </div>
          <div data-craft-controls style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            {QTYS.map(q => (
              <button key={q} type="button" data-qty={q} aria-pressed={pick.qty === q} onClick={() => setPick({ ...pick, qty: q })}
                style={{ border: 0, borderRadius: 8, height: 30, minWidth: 38, padding: '0 9px', cursor: 'pointer', font: '700 12px system-ui', background: pick.qty === q ? H.ink : 'rgba(58,39,22,.1)', color: pick.qty === q ? '#fff' : H.ink }}>{q === 'max' ? `Max${afford ? ` ${afford}` : ''}` : q}</button>
            ))}
            <span data-act="focus"><HearthButton small primary disabled={qty < 1} onClick={() => { touchWork(r.id); const w = getW(); setWorks(setStation(w, r.id, setFocus(stationOf(w.rooms.find(x => x.id === r.id)!), j.id, qty, Date.now()))) }}>Focus {qty || ''}</HearthButton></span>
          </div>
          <span style={{ fontSize: 11.5, color: H.inkSoft }}>{qty ? `${fmtSecs(runsFor(j, qty) * runMs(j))} at base pace · ignores the reserve and the cap` : 'Put material in the store first.'}</span>
        </div>
      ) : <div style={{ fontSize: 12, color: H.inkFaint }}>{note}</div>}
    </div>
  )
}

/** M57 s2: WHO STANDS AT THIS DESK (alchemist-boon.ts). An alchemist from the garden stands here and gives a chance of an extra
 *  bottle when a brew finishes near it; it never runs a station. Shown only when the garden has an alchemist. */
function AlchemistAtSet({ deskId }: { deskId: string }) {
  const [v, setV] = useState<Village>(() => loadVillage())
  const alcs = v.moglins.filter(m => m.profession === 'alchemist')
  if (!alcs.length) return null
  const here = alcs.find(m => m.room === setRoom(deskId))
  const put = (mid: string, desk: string | null) => {
    const nv = assignSet(loadVillage(), getW(), mid, desk); if (!nv) { hudSay('Another alchemist already stands at this desk.', 'info'); return }
    saveVillage(nv); setV(nv)
  }
  const row = (m: Village['moglins'][number], act: React.ReactNode) => (
    <div key={m.id} data-alc-moglin={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: H.ink, fontWeight: 600 }}>{m.name} <span style={{ fontWeight: 400, color: H.inkSoft, fontSize: 12.5 }}>· {STAT_LABEL.luck} {statsOf(m).luck}</span></div>
        <div data-boon-line style={{ fontSize: 12.5, color: H.inkSoft }}>{boonLine(m)}</div>
      </div>
      {act}
    </div>
  )
  return (
    <div data-alc-set={deskId} style={{ marginBottom: 10 }}>
      <div style={lab}>Alchemist at the set</div>
      {here
        ? row(here, <span data-act="alc-rest"><HearthButton small onClick={() => put(here.id, null)}>Rest</HearthButton></span>)
        : alcs.map(m => row(m, <span data-act="alc-stand"><HearthButton small onClick={() => put(m.id, deskId)}>Stand here</HearthButton></span>))}
    </div>
  )
}

/** E at a piece of furniture: turn it, or pick it back up into the bag. */
function PiecePanel({ id, owned, onClose }: { id: string; owned: ReadonlySet<string>; onClose: () => void }) {
  const w = useWorks(), p = w.pieces.find(x => x.id === id)
  // M57 s2: read at the moment a brew finishes here (the garden and the plot as they are then)
  const boonHere = useCallback(() => { const b = boonAt(loadVillage(), getW(), id); return { chance: b.chance, name: b.who?.name ?? '' } }, [id])
  const brewing = useBrewing()   // M57 s3b
  if (!p) return null
  const f = FURNITURE[p.item], spill = spillIfRemoved(currentWater(), plumbingOf(w.pieces), p.item, farmNow())
  const turn = () => { const t = turnPiece(getW(), owned, id); if (t) setWorks(t); else hudSay('No room to turn it here.', 'info') }
  const pickUp = () => {
    // M106 fix: piece-lift.ts, the same path as the third melee hit. A spirit lives here = stays; a growing seed rides along.
    const r = liftPiece(getW(), id, getInv(), getPots(), getBoxes())   // M113: a Planter Box's sapling rides along too
    if (r === 'spirit') { hudSay('A spirit bloomed here.', 'info'); return }
    if (r === 'gone') return
    if (r === 'full') { hudSay('No room in the bag for it.', 'info'); return }
    const rr = returnRun(loadRuns(), id, r.inv)   // M57: a busy alchemy piece gives its inputs back, all or nothing
    if (!rr) { hudSay('No room in the bag for it and what it was working on.', 'info'); return }
    const carried = r.pots !== getPots(), sap = r.boxes !== getBoxes()
    setWorks(r.works); setInv(rr.inv); saveRuns(rr.runs); setPots(r.pots); setBoxes(r.boxes); onClose()
    hudSay(carried ? `${f.name} · back in your bag. Its seed goes with it.` : sap ? `${f.name} · back in your bag. Its sapling goes with it.` : `${f.name} · back in your bag.`, 'item', 3)
  }
  const spiritFooter = (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <span data-act="turn-piece"><HearthButton small onClick={turn}>Turn</HearthButton></span>
      <span data-act="pickup-piece"><HearthButton small onClick={pickUp}>Pick up</HearthButton></span>
    </div>
  )
  // M106 (Alex 11-23): the planter's Turn became TEND (inside PlanterPanel); turning it stays a placing act (R / E hold / the bar's Turn)
  if (f.spirit === 'planter') return <PlanterPanel pieceId={id} onClose={onClose} bank={PLANTER_BANK} footer={<span data-act="pickup-piece"><HearthButton small onClick={pickUp}>Pick up</HearthButton></span>} />   // M76
  if (f.spirit === 'pedestal') return <GrimoirePanel onClose={onClose} footer={spiritFooter} />            // M76
  if (f.alc && brewing && !brewing.poured) return <BrewingPanel station={f.alc} onClose={onClose} />   // M57 s3b: a brewing is open here
  if (f.alc) return (
    <AlchemyPanel pid={id} station={f.alc} onClose={onClose} boon={boonHere} footer={<>
      {f.alc === 'desk' && <AlchemistAtSet deskId={id} />}
      {f.alc === 'desk' && openNet()?.party && (
        <div data-brew-open style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12 }}>
          <span style={{ fontWeight: 700 }}>Brew with your party:</span>
          {BREW_ORDER.map(p => <span key={p} data-act="brew-open" data-potion={p}><HearthButton small onClick={() => { if (openPartyBrew(p)) onClose() }}>{BREW_POTIONS[p].name}</HearthButton></span>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <span data-act="turn-piece"><HearthButton small onClick={turn}>Turn</HearthButton></span>
        <span data-act="pickup-piece"><HearthButton small onClick={pickUp}>Pick up</HearthButton></span>
      </div>
    </>} />
  )
  return (
    <HearthFrame title={f.name} maxWidth={420} onClose={onClose} fixed dataPanel="piece">
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 13, color: H.inkSoft }}>{f.blurb}</div>
        {/* M106 fix (Alex 11-23, phone): he built two Planter Boxes (decor) and E gave only Turn / Pick up, no way to plant.
            The box points at the piece a Mana Seed grows in, its recipe read from the data. TODO @lark: placeholder line. */}
        {p.item === 'planter_box' && <SaplingBoxSection pieceId={id} bank={PLANTER_BANK} />}{/* M113 s1: a sapling grows in the box (decor) */}
        {p.item === 'planter_box' && <div data-planter-hint style={{ fontSize: 12.5, color: H.ink, fontWeight: 600 }}>
          Mana Seeds grow in a {FURNITURE.spirit_planter.name}, not here: {FURNITURE.spirit_planter.recipe.map(c => `${c.n} ${itemDef(c.id).name}`).join(' + ')}, made at your Carpentry.
        </div>}
        {spill > 0 && <div data-spill={spill} style={{ fontSize: 12.5, color: '#9a4a2a', fontWeight: 600 }}>Picking this up pours away {spill} water.</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <span data-act="turn-piece"><HearthButton onClick={turn}>Turn</HearthButton></span>
          <span data-act="pickup-piece"><HearthButton primary onClick={pickUp}>Pick up</HearthButton></span>
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
  const [reading, setReading] = useState(false)   // M68 s2: the grimoire is readable from the hand until its pedestal is placed
  const prefs = useBuildPrefs(), anchor = useAnchor()
  if (!p) return null
  const fine = p.kind === 'piece' || p.kind === 'chest'   // M98: snap + turn step chips
  const book = p.kind === 'piece' && p.item === 'grimoire_pedestal'
  if (reading && book) return <GrimoirePanel onClose={() => setReading(false)} footer={null} />
  const btn: React.CSSProperties = { border: 0, borderRadius: 999, padding: '10px 16px', font: '700 13px system-ui', cursor: 'pointer', background: 'rgba(255,250,235,.95)', color: H.ink, boxShadow: '0 2px 8px rgba(0,0,0,.25)' }
  return (
    <div data-placing={p.kind} style={{ position: 'fixed', left: '50%', bottom: 'max(230px, 27vh)', transform: 'translateX(-50%)', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', width: 'max-content', maxWidth: 'calc(100vw - 32px)', gap: 8, zIndex: 40, pointerEvents: 'auto' }}>
      <button type="button" data-act="turn" style={btn} onClick={() => setPlacing(turnOnce(p))}>{fromHand(p) ? 'Turn (hold E)' : 'Turn (R)'}</button>
      {fine && <button type="button" data-act="snap" data-snap={prefs.snap} style={btn} onClick={cycleSnap}>Snap {snapLabel(prefs.snap)} (G)</button>}
      {fine && <button type="button" data-act="step" data-step={prefs.step} style={btn} onClick={cycleStep}>{prefs.step}° (T)</button>}
      {fine && anchor && <button type="button" data-act="anchor-clear" style={btn} onClick={clearAnchor}>Clear anchor</button>}
      <button type="button" data-act="place" style={{ ...btn, background: '#e0823f', color: '#fff' }} onClick={() => confirmPlace(owned)}>Place (E)</button>
      {book && <button type="button" data-act="read" style={btn} onClick={() => setReading(true)}>Read</button>}
      {!fromHand(p) && <button type="button" style={btn} onClick={() => setPlacing(null)}>Cancel (Esc)</button>}
    </div>
  )
}
