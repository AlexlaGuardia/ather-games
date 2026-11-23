'use client'
// ── M49 s4: THE SHIPYARD PLOTS on the waking continent (docs/M49-shipyards.md; hub 11-21 #15797). ──────────────────────────
// Every shipyard (Kael's above Rune Hold + one per city) is its own ~100 x 100 m fenced plot, built per its tier
// (business/shipyard-plots.ts): one terraced floor with retaining walls, a gate onto a landing strip with a ramp down along the
// fence, a landing pad, a garage block (a door per bay), a home, and a dock (tie-down mast + posts, or a berth: bollards + a
// slipway into the water, Veradyn). All BLOCKOUT (art later). The rest of the plot is the keeper's DEED ground: they furnish it
// from the HAND, M45 style (hold a piece, a ghost marks the cells, TAP E sets, HOLD E turns, empty hand E picks up), and the
// look board at the gate steps the colour + material combo (fence, home trim, garage doors). Saved per shipyard
// (shipyards.ts › plotStoreBase). A shipyard the keeper does not hold is drawn SHUT (gate + slipway closed) and its board
// says it is not theirs. A plot mounts only while the keeper is near it.
// Retired here: the s1-s3 small yard (12 x 8 beside a town building). Pieces left in one go back to the bag, once.
// Mount (inside the Canvas): <ShipyardPlots R focus track held enabled owned={ledger.shipyards} ownAll={devFlag} onState />
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import dynamic from 'next/dynamic'
import * as THREE from 'three'
import type { Region } from '../region'
import { gardenKey } from '@/lib/keeper-local'
import { getInv, setInv } from '../shared/bag'
import { take, give, itemDef } from '../shared/inventory'
import { FURNITURE, isPiece } from '../ather/furniture'
import { HOLD_MS } from '../shared/stance'
import { hudSay } from '../shared/game-hud'
import { DEED_GRID, DEED_PALETTES, emptyDeed, parseDeed, place, pickUp, itemAt, placeRefusal, setPalette, paletteOf, cellAtLocal, pieceCentre, type DeedState, type Footprint } from '../business/deed-grid'
import { shipyardSites, ownsShipyard, plotStoreBase, oldYardStoreBase, garageStoreBase, type ShipyardSite } from '../business/shipyards'
import { plotToWorld, plotToLocal, plotRotY, plotGround, plotBoxes, plotCarBoxes, placedBoxes, blockedCells, bayAt, bayPose, dockedShip, SHIP, TIE_MAST, SHIP_AT, PLOT, PLOT_GATE_W, LANDING_D, SLIP_W, RAMP_RISE, CAR_RISE, type PlotLayout, type PlotPiece } from '../business/shipyard-plots'
import { sanitizeGarage, garageStep, takeOutRefusal, emptyGarage, applyGarageEvent, type GarageState, type GarageEvent } from '../business/garage-bays'
import { modelById } from '../business/courser-lot'
import { buildCourser } from '../courser-model'
import { getFleet } from '../shared/fleet'
import { ShipHull } from '../../play3d/StationScene'
import { aimPick, PICK_REACH, type Pickable } from '../shared/aim-pick'
import { setFootExtra } from '../foot-extras'
import { bodyHits, type OBox } from '../foot-solids'

const PieceBody = dynamic(() => import('../ather/workshop').then(m => m.PieceBody), { ssr: false })

const KIND = 'plot' as const
const G = DEED_GRID[KIND], H = PLOT / 2
const fpOf = (id: string): Footprint | null => (FURNITURE[id] ? { w: FURNITURE[id].w, d: FURNITURE[id].d } : null)
const AIM = 1.4, BOARD_REACH = 1.8
/** M108: how far out from the hull's footprint E still boards the ship (m) */
const SHIP_REACH = 2.5
/** a plot mounts while the keeper is within this of its middle (m), dropped past MOUNT_R + 60 */
const MOUNT_R = 400

function loadPlot(base: string, blocked: (cx: number, cz: number) => boolean): DeedState {
  try { const raw = localStorage.getItem(gardenKey(base)); return raw ? parseDeed(JSON.parse(raw), KIND, fpOf, blocked) : emptyDeed() } catch { return emptyDeed() }
}
function savePlot(base: string, s: DeedState) { try { localStorage.setItem(gardenKey(base), JSON.stringify(s)) } catch { /* not remembered */ } }
/** the retired small yards: every piece left in one goes back to the bag (what will not fit stays saved for next time) */
function returnOldYards(keys: string[]) {
  let back = 0
  for (const key of keys) {
    try {
      const k = gardenKey(oldYardStoreBase(key)), raw = localStorage.getItem(k); if (!raw) continue
      const old = JSON.parse(raw) as { items?: { id: string }[] }, items = Array.isArray(old.items) ? old.items : []
      const left: { id: string }[] = []
      let inv = getInv()
      for (const p of items) { if (typeof p?.id !== 'string') continue; const g = give(inv, p.id, 1); if (g.left) left.push(p); else { inv = g.inv; back++ } }
      setInv(inv)
      if (left.length) localStorage.setItem(k, JSON.stringify({ ...old, items: left })); else localStorage.removeItem(k)
    } catch { /* leave it for next time */ }
  }
  if (back) hudSay(`Your shipyard moved to its own plot: ${back} yard piece${back > 1 ? 's are' : ' is'} back in your bag.`, 'item', 6)
}

export interface DeedYardState { inYard: boolean; atBoard: boolean; action: 'place' | 'pick up' | 'look' | 'take out' | 'board' | null }
const IDLE: DeedYardState = { inYard: false, atBoard: false, action: null }
type Probe = Record<string, unknown>
type ProbeWin = { __shipyards?: Record<string, Probe> & { sites?: () => unknown } }

interface Props {
  R: Region | null
  focus: React.RefObject<THREE.Vector3>
  track: React.RefObject<{ x: number; z: number; yaw: number }>
  held: string | null
  enabled: boolean
  onState?: (s: DeedYardState) => void
  /** the shipyards the keeper has bought (Ledger.shipyards); Kael's is always theirs */
  owned?: readonly string[]
  /** the owner's dev flag (?own=all) */
  ownAll?: boolean
  /** s5: the courser (the continent's Driver): where it is, which one is driven, and the switch a garage makes */
  car?: CarLink
  /** M108: E at the docked ship opens the destination map (destination-map.ts › shipGateOpen; owner-only ?ship=gate) */
  shipGate?: boolean
  onShip?: () => void
}
export interface CarLink {
  pose: () => { x: number; y: number; z: number; yaw: number; speed: number; foot: boolean } | null
  active: () => string
  /** make courser `id` the driven one and stand it at (x, z, yaw) */
  take: (id: string, x: number, z: number, yaw: number) => void
}
const garageKeyOf = (base: string) => gardenKey(base)
function loadGarage(base: string, cap: number): GarageState {
  try { const raw = localStorage.getItem(garageKeyOf(base)); return sanitizeGarage(raw ? JSON.parse(raw) : null, cap, getFleet().owned) } catch { return emptyGarage(cap) }
}
function saveGarage(base: string, g: GarageState) { try { localStorage.setItem(garageKeyOf(base), JSON.stringify(g)) } catch { /* not remembered */ } }
/** M49 s5: where the courser `active` waits, if a garage holds it (the continent puts the car back in its bay on load,
 *  not on the road): its bay pose + the plot's floor, or null */
export function parkedCourserSpot(R: Region, active: string): { x: number; y: number; z: number; yaw: number } | null {
  for (const s of shipyardSites(R)) {
    const k = loadGarage(garageStoreBase(s.key), s.plot.tier.garage).bays.indexOf(active)
    if (k >= 0) return { ...bayPose(s.plot, k), y: s.plot.floor }
  }
  return null
}
/** a parked courser as a walker + courser wall (its body, a little generous) */
const PARKED_HALF = { w: 1.0, l: 2.2, h: 1.6 }

export function ShipyardPlots({ R, owned, ownAll = false, onState, ...rest }: Props) {
  const sites = useMemo(() => (R ? shipyardSites(R) : []), [R])
  useEffect(() => { if (sites.length) returnOldYards(sites.map(s => s.key)) }, [sites])
  const [near, setNear] = useState<string[]>([])
  const nearRef = useRef(near); nearRef.current = near
  const lastNear = useRef(-1)
  useFrame(({ clock }) => {
    const now = clock.getElapsedTime(); if (lastNear.current >= 0 && now - lastNear.current < 0.5) return
    lastNear.current = now
    const f = rest.focus.current; if (!f) return
    const want = sites.filter(s => { const d = Math.hypot(f.x - s.plot.frame.x, f.z - s.plot.frame.z); return d < MOUNT_R || (d < MOUNT_R + 60 && nearRef.current.includes(s.key)) }).map(s => s.key)
    if (want.join('|') !== nearRef.current.join('|')) setNear(want)
  })
  const states = useRef(new Map<string, DeedYardState>()), lastUp = useRef('')
  const report = (key: string, s: DeedYardState | null) => {
    if (s) states.current.set(key, s); else states.current.delete(key)
    const live = [...states.current.values()].find(q => q.inYard || q.atBoard) ?? IDLE, k = `${live.inYard}|${live.atBoard}|${live.action}`
    if (k !== lastUp.current) { lastUp.current = k; onState?.(live) }
  }
  const reportRef = useRef(report); reportRef.current = report
  useEffect(() => {
    const w = window as unknown as ProbeWin
    w.__shipyards = Object.assign(w.__shipyards ?? {}, {
      sites: () => sites.map(s => ({ key: s.key, town: s.town, price: s.price, inherited: s.inherited, owned: ownsShipyard(owned, s.key, ownAll), x: s.plot.frame.x, z: s.plot.frame.z, ax: s.plot.frame.ax, az: s.plot.frame.az, floor: s.plot.floor, ramp: s.plot.ramp, slip: s.plot.slip, tier: s.plot.tier, mounted: nearRef.current.includes(s.key) })),
    })
  }, [sites, owned, ownAll])
  return <>{sites.filter(s => near.includes(s.key)).map(s => (
    <Plot key={s.key} R={R} site={s} own={ownsShipyard(owned, s.key, ownAll)} onReport={(st: DeedYardState | null) => reportRef.current(s.key, st)} {...rest} />
  ))}</>
}

function Plot({ R, site, own, focus, track, held, enabled, onReport, car, shipGate = false, onShip }: Omit<Props, 'onState' | 'owned' | 'ownAll'> & { site: ShipyardSite; own: boolean; onReport: (s: DeedYardState | null) => void }) {
  const L = site.plot, f = L.frame, floor = L.floor, store = plotStoreBase(site.key)
  const blocked = useMemo(() => blockedCells(L), [L])
  const board = useMemo(() => { const b = L.pieces.find(p => p.kind === 'board')!; return { lx: b.lx, lz: b.lz, ...plotToWorld(f, b.lx, b.lz) } }, [L, f])
  const ownRef = useRef(own); ownRef.current = own
  const [deed, setDeed] = useState<DeedState>(emptyDeed)
  const boxes = useRef<OBox[]>([]), carBoxes = useRef<OBox[]>([])
  // s5: the garage (which courser stands in which bay), saved per shipyard
  const gStore = garageStoreBase(site.key), cap = L.tier.garage
  // loaded SYNCHRONOUSLY (the plot only mounts in the browser): an effect-time load let the first frame see a car already
  // standing in its bay, 'park' it into the EMPTY garage and save that over the real one (it wiped a parked Dray, 11-22)
  const [garage, setGarage] = useState<GarageState>(() => (typeof window === 'undefined' ? emptyGarage(cap) : loadGarage(gStore, cap)))
  const garageRef = useRef(garage); garageRef.current = garage
  const loadedFor = useRef(`${gStore}|${cap}`)
  useEffect(() => { const k = `${gStore}|${cap}`; if (loadedFor.current === k) return; loadedFor.current = k; const g = loadGarage(gStore, cap); garageRef.current = g; setGarage(g) }, [gStore, cap])
  // the event is applied onto the STORED garage (applyGarageEvent), so a stale in-memory copy can never overwrite other bays
  const commitGarage = (ev: NonNullable<GarageEvent>) => {
    let stored: unknown = null; try { const raw = localStorage.getItem(garageKeyOf(gStore)); stored = raw ? JSON.parse(raw) : null } catch { /* none */ }
    const g = applyGarageEvent(stored, cap, ev); saveGarage(gStore, g)
    const shown = sanitizeGarage(g, cap, getFleet().owned); garageRef.current = shown; setGarage(shown)
  }
  const carRef = useRef(car); carRef.current = car
  const [active, setActive] = useState<string>(() => car?.active() ?? '')
  /** the OTHER coursers standing in bays (the driven one is the live car): bay, id, pose */
  const parked = useMemo(() => garage.bays.flatMap((id, k) => (id && id !== active ? [{ k, id, ...bayPose(L, k) }] : [])), [garage, active, L])
  useEffect(() => {
    const solid = parked.map(p => ({ cx: p.x, cz: p.z, ux: L.frame.ax[0], uz: L.frame.ax[1], vx: L.frame.az[0], vz: L.frame.az[1], hu: PARKED_HALF.l, hv: PARKED_HALF.w, y0: floor - 0.1, y1: floor + PARKED_HALF.h }))
    const placed = placedBoxes(L, deed, id => FURNITURE[id] ?? null)
    boxes.current = [...plotBoxes(L, !own), ...placed, ...solid]
    carBoxes.current = [...plotCarBoxes(L, !own), ...placed, ...solid]
  }, [L, deed, own, parked, floor])
  useEffect(() => {
    const fk = `plot:${site.key}`, g = plotGround(L)
    setFootExtra(fk, { ground: g, boxes: () => boxes.current, carGround: g, carBoxes: () => carBoxes.current })
    return () => setFootExtra(fk, null)
  }, [L, site.key])
  useEffect(() => setDeed(loadPlot(store, blocked)), [store, blocked])
  useEffect(() => () => onReport(null), [])   // eslint-disable-line react-hooks/exhaustive-deps
  const deedRef = useRef(deed); deedRef.current = deed
  const commit = (s: DeedState) => { deedRef.current = s; setDeed(s); savePlot(store, s) }
  const rot = useRef(0)
  const heldRef = useRef(held); heldRef.current = held
  const enabledRef = useRef(enabled); enabledRef.current = enabled
  const aim = useRef<{ inYard: boolean; atBoard: boolean; cell: { cx: number; cz: number } | null; bay: number; atShip?: boolean }>({ inYard: false, atBoard: false, cell: null, bay: -1 })
  // M108: the docked ship (Franky at Kael's tie-down) as an E target, when the destination-map gate is open
  const shipPiece = useMemo(() => (dockedShip(site.key) ? L.pieces.find(q => q.kind === 'ship') ?? null : null), [L, site.key])
  const shipGateRef = useRef(shipGate); shipGateRef.current = shipGate
  const onShipRef = useRef(onShip); onShipRef.current = onShip
  const carBay = useRef(-1)
  const { camera } = useThree()

  const act = useRef<{ place: () => void; turn: () => void; pick: () => void; look: () => void; take: () => void }>({ place() {}, turn() {}, pick() {}, look() {}, take() {} })
  act.current.take = () => {
    const k = aim.current.bay, c = carRef.current; if (k < 0 || !c) return
    const g = garageRef.current, act0 = c.active(), why = takeOutRefusal(g, k, act0, carBay.current >= 0 && g.bays[carBay.current] === act0)
    if (why) { hudSay(why === 'loose' ? `Park the ${modelById(act0).name} in a bay here first.` : 'Nothing to take out.', 'info'); return }
    const id = g.bays[k]!, p = bayPose(L, k)
    c.take(id, p.x, p.z, p.yaw); setActive(id)
    hudSay(`The ${modelById(id).name} is yours to drive.`, 'item')
  }
  act.current.place = () => {
    const id = heldRef.current, c = aim.current.cell
    if (!id || !isPiece(id) || !c) return
    const why = placeRefusal(deedRef.current, KIND, fpOf, id, c.cx, c.cz, rot.current, -1, blocked)
    if (why) { hudSay(why === 'full' ? 'The yard holds no more.' : why === 'taken' ? 'Something already stands there.' : why === 'built' ? 'The yard is built there.' : 'That reaches past the fence.', 'info'); return }
    const next = place(deedRef.current, KIND, fpOf, id, c.cx, c.cz, rot.current, blocked), me = focus.current
    if (me && placedBoxes(L, next, q => FURNITURE[q] ?? null).some(b => bodyHits(b, me.x, me.z, floor))) { hudSay('Step back: you are standing there.', 'info'); return }
    const inv = take(getInv(), id, 1); if (!inv) return
    setInv(inv); commit(next)
    hudSay(`${FURNITURE[id].name} set in the yard`, 'item')
  }
  act.current.turn = () => { rot.current = (rot.current + 1) % 4 }
  act.current.pick = () => {
    const c = aim.current.cell; if (!c) return
    const k = itemAt(deedRef.current, fpOf, c.cx, c.cz); if (k < 0) return
    const r = pickUp(deedRef.current, k); if (!r.id) return
    const g = give(getInv(), r.id, 1); if (g.left) { hudSay('Your bag is full.', 'info'); return }
    setInv(g.inv); commit(r.state)
    hudSay(`${itemDef(r.id).name} back in your bag`, 'item')
  }
  act.current.look = () => {
    if (!ownRef.current) { hudSay('Not yours. This shipyard is for sale.', 'info'); return }
    const s = setPalette(deedRef.current, deedRef.current.palette + 1); commit(s)
    hudSay(`Yard: ${paletteOf(s).name}`, 'info')
  }
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null, turned = false, armed = false
    const tick = () => { turned = true; act.current.turn(); t = setTimeout(tick, HOLD_MS) }
    const down = (e: KeyboardEvent) => {
      if (e.code === 'DeedTurn') { if (aim.current.inYard) act.current.turn(); return }
      if (e.code !== 'KeyE' || e.repeat || !enabledRef.current) return
      const a = aim.current
      if (a.bay >= 0) { act.current.take(); return }
      if (a.atBoard) { act.current.look(); return }
      if (a.atShip) { onShipRef.current?.(); return }
      if (!a.inYard || !ownRef.current) return
      const id = heldRef.current
      if (id && isPiece(id)) { armed = true; turned = false; t = setTimeout(tick, HOLD_MS); return }
      act.current.pick()
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE' || !armed) return
      armed = false; if (t) { clearTimeout(t); t = null }
      if (!turned) act.current.place()
    }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); if (t) clearTimeout(t) }
  }, [])

  // probe for scripted checks (scripts/shipyard-plot-check.mts)
  useEffect(() => {
    const probe: Probe = {
      key: () => site.key, own: () => ownRef.current, plot: () => ({ frame: f, floor, ramp: L.ramp, slip: L.slip, tier: L.tier, wet: L.wet }),
      // s6: the ship at this yard's dock (null = an empty dock) and its piece, for shipyard-dock-check
      ship: () => { const sp = L.pieces.find(q => q.kind === 'ship'); return sp ? { ...dockedShip(site.key)!, lx: sp.lx, lz: sp.lz, ...plotToWorld(f, sp.lx, sp.lz) } : null },
      pieces: () => L.pieces.map(p => ({ kind: p.kind, lx: p.lx, lz: p.lz, w: p.w, d: p.d })), board: () => board,
      state: () => deedRef.current, aim: () => ({ ...aim.current, rot: rot.current }),
      stored: () => { try { return localStorage.getItem(gardenKey(store)) } catch { return null } },
      blocked: (cx: number, cz: number) => blocked(cx, cz),
      garage: () => ({ bays: garageRef.current.bays.slice(), carBay: carBay.current, aimBay: aim.current.bay, active: carRef.current?.active() ?? null, stored: (() => { try { return localStorage.getItem(garageKeyOf(gStore)) } catch { return null } })() }),
      bayPose: (k: number) => bayPose(L, k), carRamp: () => L.carRamp,
    }
    const w = window as unknown as ProbeWin
    w.__shipyards = Object.assign(w.__shipyards ?? {}, { [site.key]: probe })
    return () => { if (w.__shipyards?.[site.key] === probe) delete w.__shipyards[site.key] }
  }, [site.key, f, floor, L, board, store, blocked, gStore])

  // per frame: the aim, the ghost, the local grid, the phone pill
  const ghost = useRef<THREE.Group>(null), ghostMat = useRef<THREE.MeshBasicMaterial>(null), grid = useRef<THREE.Group>(null)
  const last = useRef('')
  const lastG = useRef(0)
  useFrame(({ clock }) => {
    const me = focus.current, tr = track.current; if (!me || !tr) return
    // s5: the garage reads the courser four times a second (a park is a stop, not a frame)
    const c = carRef.current, cp = c?.pose()
    if (c && cp && clock.getElapsedTime() - lastG.current > 0.25) {
      lastG.current = clock.getElapsedTime()
      const a = c.active(); if (a !== active) setActive(a)
      carBay.current = bayAt(L, cp.x, cp.z, cp.y)
      if (ownRef.current) {
        const r = garageStep(garageRef.current, a, carBay.current, cp.speed < 0.6)
        if (r.ev) { commitGarage(r.ev); hudSay(r.ev.kind === 'parked' ? `The ${modelById(r.ev.id).name} parked in bay ${r.ev.bay + 1}` : `The ${modelById(r.ev.id).name} out of bay ${r.ev.bay + 1}`, 'info') }
      }
    }
    // on foot: E takes out the courser the crosshair is on (M60's one rule: within 3 m, under the crosshair)
    let bay = -1
    if (cp?.foot && ownRef.current && parked.length) {
      const cands: Pickable<number>[] = parked.map(p => ({ x: p.x, z: p.z, y0: floor, y1: floor + PARKED_HALF.h, r: 1.6, item: p.k }))
      const dir = camera.getWorldDirection(new THREE.Vector3())
      bay = aimPick(cands, camera.position, dir, me, PICK_REACH + 1.2) ?? -1
    }
    aim.current.bay = bay
    const l = plotToLocal(f, me.x, me.z)
    const inYard = Math.abs(l.lx) < H + 0.3 && Math.abs(l.lz) < H + 0.3 && Math.abs(me.y - floor) < 2.5
    const atBoard = Math.hypot(me.x - board.x, me.z - board.z) < BOARD_REACH
    const ax = me.x - Math.sin(tr.yaw) * AIM, az = me.z - Math.cos(tr.yaw) * AIM, al = plotToLocal(f, ax, az)
    const cell = inYard ? cellAtLocal(KIND, al.lx, al.lz) : null
    // M108: beside the hull (its footprint + SHIP_REACH, plot-local; the ship lies along local z), on the yard floor
    const sl = shipPiece && shipGateRef.current && ownRef.current ? plotToLocal(f, me.x, me.z) : null
    const atShip = !!sl && !!shipPiece && Math.abs(sl.lx - shipPiece.lx) < SHIP.w / 2 + SHIP_REACH && Math.abs(sl.lz - shipPiece.lz) < SHIP.d / 2 + SHIP_REACH && Math.abs(me.y - floor) < 2.5
    aim.current = { inYard, atBoard, cell, bay, atShip }
    const id = heldRef.current, holding = !!id && isPiece(id) && ownRef.current
    if (grid.current) {
      grid.current.visible = holding && !!cell
      if (cell) { const o = plotToWorld(f, cell.cx - 6 - H, cell.cz - 6 - H); grid.current.position.set(o.x, floor + 0.03, o.z) }
    }
    if (ghost.current) {
      ghost.current.visible = holding && !!cell && enabledRef.current
      if (ghost.current.visible && cell && id) {
        const fp = fpOf(id)!, c = pieceCentre(KIND, fp, cell.cx, cell.cz, rot.current), w = plotToWorld(f, c.lx, c.lz), odd = rot.current % 2 === 1
        ghost.current.position.set(w.x, floor + 0.02, w.z); ghost.current.rotation.y = plotRotY(f)
        ghost.current.scale.set(Math.max(1, Math.ceil((odd ? fp.d : fp.w) - 1e-6)), 1, Math.max(1, Math.ceil((odd ? fp.w : fp.d) - 1e-6)))
        if (ghostMat.current) ghostMat.current.color.set(placeRefusal(deedRef.current, KIND, fpOf, id, cell.cx, cell.cz, rot.current, -1, blocked) ? '#e0604a' : '#7fe0a0')
      }
    }
    const action: DeedYardState['action'] = !enabledRef.current ? null : bay >= 0 ? 'take out' : atBoard ? (ownRef.current ? 'look' : null) : atShip ? 'board' : !inYard || !ownRef.current ? null
      : holding ? (cell ? 'place' : null) : cell && itemAt(deedRef.current, fpOf, cell.cx, cell.cz) >= 0 ? 'pick up' : null
    const key = `${inYard}|${atBoard}|${action}`
    if (key !== last.current) { last.current = key; onReport({ inYard, atBoard, action }) }
  })

  if (!R) return null
  const pal = paletteOf(deed), ry = plotRotY(f)
  return (
    <group>
      <Terrace L={L} />
      <Fence L={L} color={pal.color} accent={pal.accent} shut={!own} />
      <Landing L={L} />
      {L.slip && <Slip L={L} />}
      {L.pieces.map((p, k) => <Piece key={k} L={L} p={p} color={pal.color} accent={pal.accent} />)}
      <GarageRoof L={L} />
      {parked.map(p => <ParkedCourser key={`${p.k}:${p.id}`} id={p.id} x={p.x} y={floor} z={p.z} yaw={p.yaw} />)}
      <group ref={grid} visible={false} rotation={[0, ry, 0]}><GridLines /></group>
      <group ref={ghost} visible={false}>
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.96, 0.96]} /><meshBasicMaterial ref={ghostMat} color="#7fe0a0" transparent opacity={0.45} depthWrite={false} /></mesh>
      </group>
      {deed.items.map((p, k) => {
        const fp = fpOf(p.id); if (!fp) return null
        const c = pieceCentre(KIND, fp, p.cx, p.cz, p.rot), w = plotToWorld(f, c.lx, c.lz)
        return <group key={`${k}:${p.id}:${p.cx}:${p.cz}`} position={[w.x, floor, w.z]} rotation={[0, ry - p.rot * Math.PI / 2, 0]}><PieceBody item={p.id} /></group>
      })}
    </group>
  )
}

// ── the built parts (blockout) ──
const EARTH = '#8a7350', STONE = '#7b746a', DECK = '#7a5a3a', DECK_DK = '#5a4028', PAD = '#c9bfa8', PAD_RING = '#e8d27a', ROOF = '#5b3b2e', IRON = '#3f3a36', ROPE = '#8a7a5c'

/** the levelled floor: a terrace at the floor, its sides the retaining walls down to the lowest ground (+ 1 m into it) */
function Terrace({ L }: { L: PlotLayout }) {
  const h = L.floor - L.base + 1, mats = useMemo(() => { const side = new THREE.MeshLambertMaterial({ color: STONE }), top = new THREE.MeshLambertMaterial({ color: EARTH }); return [side, side, top, side, side, side] }, [])
  return <mesh position={[L.frame.x, L.floor - h / 2, L.frame.z]} rotation={[0, plotRotY(L.frame), 0]} material={mats}><boxGeometry args={[PLOT, h, PLOT]} /></mesh>
}

/** many boxes of one colour as ONE instanced mesh: [lx, lz, y (bottom), w, h, d, turned quarter?] in plot-local metres */
function Boxes({ L, items, color }: { L: PlotLayout; items: [number, number, number, number, number, number, boolean?][]; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = ref.current; if (!m) return
    const o = new THREE.Object3D(), ry = plotRotY(L.frame)
    items.forEach(([lx, lz, y, w, h, d, q], i) => { const p = plotToWorld(L.frame, lx, lz); o.position.set(p.x, y + h / 2, p.z); o.rotation.set(0, ry + (q ? Math.PI / 2 : 0), 0); o.scale.set(w, h, d); o.updateMatrix(); m.setMatrixAt(i, o.matrix) })
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere()
  }, [L, items])
  return <instancedMesh ref={ref} args={[undefined, undefined, items.length]} frustumCulled={false}><boxGeometry args={[1, 1, 1]} /><meshLambertMaterial color={color} /></instancedMesh>
}

function Fence({ L, color, accent, shut }: { L: PlotLayout; color: string; accent: string; shut: boolean }) {
  const { posts, rails } = useMemo(() => {
    const posts: [number, number, number, number, number, number][] = [], rails: [number, number, number, number, number, number, boolean?][] = []
    const y = L.floor, g = PLOT_GATE_W / 2, sl = L.slip
    const gapAt = (edge: 'f' | 'b', u: number) => !shut && (edge === 'f' ? Math.abs(u) < g : !!sl && Math.abs(u - sl.lx) < SLIP_W / 2)
    for (let u = -H; u < H; u += 5) for (const [edge, v] of [['f', -H], ['b', H]] as const) {
      if (!gapAt(edge, u)) posts.push([u, v, y, 0.16, 1.4, 0.16])
      // a rail panel to the next post unless the panel crosses a gap
      const a = u, b = Math.min(u + 5, H)
      const cut = (edge === 'f' ? [-g, g] : sl ? [sl.lx - SLIP_W / 2, sl.lx + SLIP_W / 2] : null)
      const segs: [number, number][] = !shut && cut && b > cut[0] && a < cut[1] ? [[a, Math.max(a, cut[0])], [Math.min(b, cut[1]), b]] : [[a, b]]
      for (const [s0, s1] of segs) if (s1 - s0 > 0.05) for (const hh of [0.5, 1.1]) rails.push([(s0 + s1) / 2, v, y + hh - 0.04, s1 - s0, 0.08, 0.07])
    }
    for (let v = -H; v < H; v += 5) for (const u of [-H, H]) {
      posts.push([u, v, y, 0.16, 1.4, 0.16])
      for (const hh of [0.5, 1.1]) rails.push([u, v + 2.5, y + hh - 0.04, 5, 0.08, 0.07, true])
    }
    posts.push([H, H, y, 0.16, 1.4, 0.16])
    if (!shut) for (const s of [-g, g]) posts.push([s, -H, y, 0.3, 2.2, 0.3])   // gateposts
    return { posts, rails }
  }, [L, shut])
  return <><Boxes L={L} items={posts} color={color} /><Boxes L={L} items={rails} color={accent} /></>
}

/** the gate's landing strip outside the front fence, and the ramp down along it; a rail on its drop side */
function Landing({ L }: { L: PlotLayout }) {
  const f = L.frame, g = PLOT_GATE_W / 2, zc = -H - LANDING_D / 2, ry = plotRotY(f)
  const flat = plotToWorld(f, 0, zc)
  const slope = useMemo(() => {
    if (L.ramp.L < 0.05) return null
    const dy = L.ramp.L * RAMP_RISE, len = Math.hypot(L.ramp.L, dy), m = plotToWorld(f, g + L.ramp.L / 2, zc)
    return { m, len, e: new THREE.Euler(0, ry, -Math.atan2(dy, L.ramp.L), 'YZX'), dy }
  }, [L, f, g, zc, ry])
  const carSlope = useMemo(() => {
    if (L.carRamp.L < 0.05) return null
    const dy = L.carRamp.L * CAR_RISE, len = Math.hypot(L.carRamp.L, dy), m = plotToWorld(f, -g - L.carRamp.L / 2, zc)
    return { m, len, e: new THREE.Euler(0, ry, Math.atan2(dy, L.carRamp.L), 'YZX'), dy }
  }, [L, f, g, zc, ry])
  const rail = useMemo(() => [[(L.ramp.L - L.carRamp.L) / 2, -H - LANDING_D, L.floor - Math.max(L.ramp.L * RAMP_RISE, L.carRamp.L * CAR_RISE) / 2 - 0.2, PLOT_GATE_W + L.ramp.L + L.carRamp.L, 1.2, 0.1]] as [number, number, number, number, number, number][], [L])
  return (
    <group>
      <mesh position={[flat.x, L.floor - 0.08, flat.z]} rotation={[0, ry, 0]}><boxGeometry args={[PLOT_GATE_W, 0.16, LANDING_D]} /><meshLambertMaterial color={DECK} /></mesh>
      {slope && <mesh position={[slope.m.x, L.floor - slope.dy / 2 - 0.08, slope.m.z]} rotation={slope.e}><boxGeometry args={[slope.len, 0.16, LANDING_D]} /><meshLambertMaterial color={DECK} /></mesh>}
      {carSlope && <mesh position={[carSlope.m.x, L.floor - carSlope.dy / 2 - 0.08, carSlope.m.z]} rotation={carSlope.e}><boxGeometry args={[carSlope.len, 0.16, LANDING_D]} /><meshLambertMaterial color={DECK} /></mesh>}
      <Boxes L={L} items={rail} color={DECK_DK} />
    </group>
  )
}

/** a rope between two points (plot-local metres, y up), a thin box laid along it */
function Rope({ a, b }: { a: [number, number, number]; b: [number, number, number] }) {
  const { pos, q, len } = useMemo(() => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A)
    return { pos: A.clone().add(B).multiplyScalar(0.5), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), len: d.length() }
  }, [a, b])
  return <mesh position={pos} quaternion={q}><boxGeometry args={[0.07, len, 0.07]} /><meshLambertMaterial color={ROPE} /></mesh>
}
/** M49 s6: the keeper's ship at its yard's tie-down, on its struts between the four posts, bow to the mast. Kael's is BROKEN:
 *  the lift-runes cold, a list to port, a line from every post and one from the masthead to the bow. Blockout (play3d's
 *  ShipHull); the real look is a design brief nobody has written yet. */
function DockedShip({ L, p }: { L: PlotLayout; p: PlotPiece }) {
  const f = L.frame, w = plotToWorld(f, p.lx, p.lz), ry = plotRotY(f)
  const g = SHIP.lift + 2.3, half = SHIP.w / 2   // the gunwale's height and half-beam
  // posts sit at ±8 round the square's centre, which is SHIP_AT forward of the ship's centre; the mast TIE_MAST forward of it
  const post = (a: number, b: number): [number, number, number] => [a, 1.15, b - SHIP_AT]
  return (
    <group position={[w.x, L.floor, w.z]} rotation={[0, ry, 0]}>
      <group rotation={[0, 0, -0.05]}><ShipHull cx={0} cz={0} w={SHIP.w} len={SHIP.len} lift={SHIP.lift} struts dark /></group>
      {[[-8, -8], [8, -8], [8, 8], [-8, 8]].map(([a, b], k) => <Rope key={k} a={post(a, b)} b={[Math.sign(a) * half, g, Math.sign(b) * (SHIP.len / 2 - 2)]} />)}
      <Rope a={[0, 13.6, -TIE_MAST - SHIP_AT]} b={[0, SHIP.lift + 2.2, -SHIP.d / 2]} />
    </group>
  )
}

/** the slipway: from the back edge down into the water (berth plots) */
function Slip({ L }: { L: PlotLayout }) {
  const s = L.slip!, f = L.frame, ry = plotRotY(f), dy = s.L * RAMP_RISE, len = Math.hypot(s.L, dy), m = plotToWorld(f, s.lx, H + s.L / 2)
  return <mesh position={[m.x, L.floor - dy / 2 - 0.1, m.z]} rotation={new THREE.Euler(0, ry - Math.PI / 2, -Math.atan2(dy, s.L), 'YZX')}><boxGeometry args={[len, 0.2, SLIP_W]} /><meshLambertMaterial color={STONE} /></mesh>
}

function Piece({ L, p, color, accent }: { L: PlotLayout; p: PlotPiece; color: string; accent: string }) {
  const f = L.frame, w = plotToWorld(f, p.lx, p.lz), ry = plotRotY(f), y = L.floor
  if (p.kind === 'home') return (
    <group position={[w.x, y, w.z]} rotation={[0, ry, 0]}>
      <mesh position={[0, p.h / 2, 0]}><boxGeometry args={[p.w, p.h, p.d]} /><meshLambertMaterial color="#b9a98c" /></mesh>
      <mesh position={[0, p.h + 1.4, 0]} rotation={[0, Math.PI / 4, 0]} scale={[p.w / Math.SQRT2 / 1, 1, p.d / Math.SQRT2]}><coneGeometry args={[1.05, 2.8, 4]} /><meshLambertMaterial color={ROOF} /></mesh>
      {/* the door faces the plot's middle (+x), trimmed in the yard's combo */}
      <mesh position={[p.w / 2 + 0.03, 1.1, 0]}><boxGeometry args={[0.06, 2.2, 1.2]} /><meshLambertMaterial color={accent} /></mesh>
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, c], k) => <mesh key={k} position={[a * (p.w / 2 + 0.05), p.h / 2, c * (p.d / 2 + 0.05)]}><boxGeometry args={[0.24, p.h, 0.24]} /><meshLambertMaterial color={color} /></mesh>)}
    </group>
  )
  if (p.kind === 'garage') return null   // its roof: GarageRoof; its walls: the 'gwall' pieces
  if (p.kind === 'gwall') return <mesh position={[w.x, y + p.h / 2, w.z]} rotation={[0, ry, 0]}><boxGeometry args={[p.w, p.h, p.d]} /><meshLambertMaterial color="#8f877a" /></mesh>
  // the bay's lintel over its opening (the yard's trim colour) + its painted floor line
  if (p.kind === 'bay') return (
    <group position={[w.x, y, w.z]} rotation={[0, ry, 0]}>
      <mesh position={[0, GARAGE_LINTEL_Y + p.h / 2, 0]}><boxGeometry args={[0.3, p.h, p.d]} /><meshLambertMaterial color={accent} /></mesh>
      <mesh position={[0.3, 0.02, 0]}><boxGeometry args={[0.4, 0.02, p.d - 0.4]} /><meshBasicMaterial color={PAD_RING} /></mesh>
    </group>
  )
  if (p.kind === 'pad') return (
    <group position={[w.x, y, w.z]} rotation={[0, ry, 0]}>
      <mesh position={[0, p.h / 2, 0]}><boxGeometry args={[p.w, p.h, p.d]} /><meshLambertMaterial color={PAD} /></mesh>
      <mesh position={[0, p.h + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[p.w * 0.32, p.w * 0.36, 48]} /><meshBasicMaterial color={PAD_RING} /></mesh>
    </group>
  )
  if (p.kind === 'ship') return <DockedShip L={L} p={p} />
  if (p.kind === 'mast') return <mesh position={[w.x, y + p.h / 2, w.z]}><cylinderGeometry args={[0.25, 0.4, p.h, 8]} /><meshLambertMaterial color={IRON} /></mesh>
  if (p.kind === 'post' || p.kind === 'bollard') return <mesh position={[w.x, y + p.h / 2, w.z]}><cylinderGeometry args={[p.w / 2, p.w / 2, p.h, 8]} /><meshLambertMaterial color={IRON} /></mesh>
  if (p.kind === 'board') return (
    <group position={[w.x, y, w.z]} rotation={[0, ry, 0]}>
      <mesh position={[0, 0.7, 0]}><boxGeometry args={[0.12, 1.4, 0.12]} /><meshLambertMaterial color={color} /></mesh>
      <mesh position={[0, 1.35, 0]}><boxGeometry args={[0.9, 0.5, 0.06]} /><meshLambertMaterial color={accent} /></mesh>
      {DEED_PALETTES.map((q, k) => <mesh key={k} position={[-0.3 + k * 0.2, 1.35, q.color === color ? 0.06 : 0.035]}><boxGeometry args={[0.14, 0.2, 0.02]} /><meshLambertMaterial color={q.color} /></mesh>)}
    </group>
  )
  return null
}

const GARAGE_LINTEL_Y = 3.6
/** the garage's roof slab over its footprint (the walls carry it; the bays stay open under it) */
function GarageRoof({ L }: { L: PlotLayout }) {
  const g = L.pieces.find(p => p.kind === 'garage'); if (!g) return null
  const w = plotToWorld(L.frame, g.lx, g.lz)
  return <mesh position={[w.x, L.floor + g.h + 0.15, w.z]} rotation={[0, plotRotY(L.frame), 0]}><boxGeometry args={[g.w + 0.6, 0.3, g.d + 0.6]} /><meshLambertMaterial color={ROOF} /></mesh>
}
/** another of the keeper's coursers, standing in its bay */
function ParkedCourser({ id, x, y, z, yaw }: { id: string; x: number; y: number; z: number; yaw: number }) {
  const root = useMemo(() => buildCourser(modelById(id).look).root, [id])
  return <primitive object={root} position={[x, y, z]} rotation={[0, yaw, 0]} />
}

/** a 12 x 12 cell grid (unit cells from the group's origin), shown around the aimed cell while a piece is in hand */
function GridLines() {
  const geo = useMemo(() => {
    const pts: number[] = []
    for (let i = 0; i <= 12; i++) { pts.push(i, 0, 0, i, 0, 12); pts.push(0, 0, i, 12, 0, i) }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return g
  }, [])
  return <lineSegments geometry={geo}><lineBasicMaterial color="#f3e6c4" transparent opacity={0.5} depthWrite={false} /></lineSegments>
}
