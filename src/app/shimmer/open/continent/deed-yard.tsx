'use client'
// ── M49 slice 1: THE SHIPYARD'S YARD, the keeper's deed grid on the waking continent (hub call 11-21: the grid = the yard). ──
// Canon athernyx 3af1436: a deed is a grid the keeper PLACES things in; the structure comes built. So the yard comes built
// (a fence with a gate gap, a look board at the gate) and the keeper furnishes it from the HAND, M45 style: hold a piece from
// the hotbar, a ghost marks the cells in front of you, TAP E sets it, HOLD E turns it a quarter every HOLD_MS. E with no piece
// in hand, facing a placed one, picks it back up into the bag. E at the look board steps to the next colour + material combo
// (business/deed-grid.ts › DEED_PALETTES), which recolours the fence and a trim on Kael's shipyard house.
// Saved per GARDEN (the tycoon is garden-level too): localStorage gardenKey(DEED_YARD_KEY). Pieces are not solid to the
// walker in slice 1 (no foot-solids hook yet): they stand level at the ground under their centre (the yard is not levelled).
// Mount (inside the Canvas): <DeedYard R={R} focus={focus} track={track} held={heldId} enabled={onFootAndNoMenu} onState={...} />
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import dynamic from 'next/dynamic'
import * as THREE from 'three'
import type { Region } from '../region'
import { gardenKey } from '@/lib/keeper-local'
import { getInv, setInv } from '../shared/bag'
import { take, give, itemDef } from '../shared/inventory'
import { FURNITURE, isPiece } from '../ather/furniture'
import { HOLD_MS } from '../shared/stance'
import { hudSay } from '../shared/game-hud'
import { FLOOR_H } from '../towns/plan'
import { doorByKey } from '../business/doors'
import { DEED_GRID, DEED_PALETTES, emptyDeed, parseDeed, place, pickUp, itemAt, placeRefusal, setPalette, paletteOf, cellAtLocal, pieceCentre, type DeedState, type Footprint } from '../business/deed-grid'
import { shipyardYard, yardToWorld, yardToLocal, yardRotY, buildingAxes, GATE_MID, type Yard } from '../business/deed-yard-site'

// the furniture's own box bodies (ather/workshop.tsx), loaded only when a yard has something in it
const PieceBody = dynamic(() => import('../ather/workshop').then(m => m.PieceBody), { ssr: false })

export const DEED_YARD_KEY = 'open.deed.shipyard.v1'
const KIND = 'shipyard' as const
const G = DEED_GRID[KIND]
const fpOf = (id: string): Footprint | null => (FURNITURE[id] ? { w: FURNITURE[id].w, d: FURNITURE[id].d } : null)
/** how far in front of the keeper the aimed cell is (m) */
const AIM = 1.4
/** the look board's reach (m) */
const BOARD_REACH = 1.8
/** gate gap width (m) */
const GATE_W = 2

export function loadDeedYard(): DeedState {
  try { const raw = localStorage.getItem(gardenKey(DEED_YARD_KEY)); return raw ? parseDeed(JSON.parse(raw), KIND, fpOf) : emptyDeed() } catch { return emptyDeed() }
}
function saveDeedYard(s: DeedState) { try { localStorage.setItem(gardenKey(DEED_YARD_KEY), JSON.stringify(s)) } catch { /* not remembered */ } }

export interface DeedYardState { inYard: boolean; atBoard: boolean; action: 'place' | 'pick up' | 'look' | null }

interface Props {
  R: Region | null
  focus: React.RefObject<THREE.Vector3>
  track: React.RefObject<{ x: number; z: number; yaw: number }>
  /** what the keeper holds (shared/stance.ts › heldOf), or null */
  held: string | null
  /** on foot and no menu open */
  enabled: boolean
  onState?: (s: DeedYardState) => void
}

export function DeedYard({ R, focus, track, held, enabled, onState }: Props) {
  const yard = useMemo(() => (R ? shipyardYard(R) : null), [R])
  const house = useMemo(() => (R ? doorByKey(R, 'front:shipyard')?.b ?? null : null), [R])
  const [deed, setDeed] = useState<DeedState>(emptyDeed)
  useEffect(() => setDeed(loadDeedYard()), [])
  const deedRef = useRef(deed); deedRef.current = deed
  const commit = (s: DeedState) => { deedRef.current = s; setDeed(s); saveDeedYard(s) }
  const rot = useRef(0)
  const heldRef = useRef(held); heldRef.current = held
  const enabledRef = useRef(enabled); enabledRef.current = enabled
  // the aim, re-read every frame: the cell in front of the keeper, and whether they stand in the yard / at the board
  const aim = useRef<{ inYard: boolean; atBoard: boolean; cell: { cx: number; cz: number } | null }>({ inYard: false, atBoard: false, cell: null })
  const board = useMemo(() => {
    if (!yard) return null
    const [u, v] = GATE_MID(G, yard.gate), inward = yard.gate === 1 ? [0, -1] : yard.gate === 2 ? [1, 0] : [-1, 0]
    // stands just inside the fence, beside the gap
    const lu = u + inward[0] * 0.5 + (yard.gate === 1 ? GATE_W / 2 + 0.6 : 0), lv = v + inward[1] * 0.5 + (yard.gate === 1 ? 0 : GATE_W / 2 + 0.6)
    return { lu, lv, ...yardToWorld(yard, lu, lv) }
  }, [yard])

  const act = useRef<{ place: () => void; turn: () => void; pick: () => void; look: () => void }>({ place() {}, turn() {}, pick() {}, look() {} })
  act.current.place = () => {
    const id = heldRef.current, c = aim.current.cell
    if (!id || !isPiece(id) || !c) return
    const why = placeRefusal(deedRef.current, KIND, fpOf, id, c.cx, c.cz, rot.current)
    if (why) { hudSay(why === 'full' ? 'The yard holds no more.' : why === 'taken' ? 'Something already stands there.' : 'That reaches past the fence.', 'info'); return }
    const inv = take(getInv(), id, 1); if (!inv) return
    setInv(inv)
    commit(place(deedRef.current, KIND, fpOf, id, c.cx, c.cz, rot.current))
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
    const s = setPalette(deedRef.current, deedRef.current.palette + 1); commit(s)
    hudSay(`Yard: ${paletteOf(s).name}`, 'info')
  }

  // E: board → next look; a piece in hand → tap sets, hold turns; empty hand facing a placed piece → pick up
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null, turned = false, armed = false
    const tick = () => { turned = true; act.current.turn(); t = setTimeout(tick, HOLD_MS) }
    const down = (e: KeyboardEvent) => {
      if (e.code === 'DeedTurn') { act.current.turn(); return }   // the phone's turn button
      if (e.code !== 'KeyE' || e.repeat || !enabledRef.current) return
      const a = aim.current
      if (a.atBoard) { act.current.look(); return }
      if (!a.inYard) return
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

  // probe for scripted checks (scripts/deed-yard-check.mts)
  useEffect(() => {
    (window as unknown as { __deedYard?: unknown }).__deedYard = {
      yard: () => yard, board: () => board, state: () => deedRef.current, aim: () => ({ ...aim.current, rot: rot.current }),
      stored: () => { try { return localStorage.getItem(gardenKey(DEED_YARD_KEY)) } catch { return null } },
    }
  }, [yard, board])

  // per frame: where the keeper aims; the ghost; the page's touch pill
  const ghost = useRef<THREE.Group>(null), ghostMat = useRef<THREE.MeshBasicMaterial>(null), grid = useRef<THREE.LineSegments>(null)
  const last = useRef<string>('')
  useFrame(() => {
    if (!yard || !R) return
    const f = focus.current, tr = track.current; if (!f || !tr) return
    const me = yardToLocal(yard, f.x, f.z)
    const inYard = Math.abs(me.lx) < G.w / 2 + 0.3 && Math.abs(me.lz) < G.d / 2 + 0.3
    const atBoard = !!board && Math.hypot(f.x - board.x, f.z - board.z) < BOARD_REACH
    const ax = f.x - Math.sin(tr.yaw) * AIM, az = f.z - Math.cos(tr.yaw) * AIM, al = yardToLocal(yard, ax, az)
    const cell = inYard ? cellAtLocal(KIND, al.lx, al.lz) : null
    aim.current = { inYard, atBoard, cell }
    const id = heldRef.current, holding = !!id && isPiece(id)
    // the grid shows while a piece is in hand near the yard
    if (grid.current) grid.current.visible = holding && Math.abs(me.lx) < G.w / 2 + 6 && Math.abs(me.lz) < G.d / 2 + 6
    if (ghost.current) {
      ghost.current.visible = holding && inYard && !!cell && enabledRef.current
      if (ghost.current.visible && cell && id) {
        const fp = fpOf(id)!, c = pieceCentre(KIND, fp, cell.cx, cell.cz, rot.current), w = yardToWorld(yard, c.lx, c.lz)
        const odd = rot.current % 2 === 1
        const cw = odd ? Math.ceil(fp.d - 1e-6) : Math.ceil(fp.w - 1e-6), cd = odd ? Math.ceil(fp.w - 1e-6) : Math.ceil(fp.d - 1e-6)
        ghost.current.position.set(w.x, R.groundAt(w.x, w.z) + 0.02, w.z)
        ghost.current.rotation.y = yardRotY(yard)
        ghost.current.scale.set(Math.max(1, cw), 1, Math.max(1, cd))
        if (ghostMat.current) ghostMat.current.color.set(placeRefusal(deedRef.current, KIND, fpOf, id, cell.cx, cell.cz, rot.current) ? '#e0604a' : '#7fe0a0')
      }
    }
    const action: DeedYardState['action'] = !enabledRef.current ? null : atBoard ? 'look' : !inYard ? null
      : holding ? (cell ? 'place' : null) : cell && itemAt(deedRef.current, fpOf, cell.cx, cell.cz) >= 0 ? 'pick up' : null
    const key = `${inYard}|${atBoard}|${action}`
    if (key !== last.current) { last.current = key; onState?.({ inYard, atBoard, action }) }
  })

  if (!yard || !R) return null
  const pal = paletteOf(deed)
  return (
    <group>
      <Fence R={R} yard={yard} color={pal.color} accent={pal.accent} />
      {board && <LookBoard R={R} yard={yard} at={board} color={pal.color} accent={pal.accent} />}
      {house && <HouseTrim b={house} color={pal.color} accent={pal.accent} />}
      <GridLines R={R} yard={yard} gref={grid} />
      <group ref={ghost} visible={false}>
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.96, 0.96]} /><meshBasicMaterial ref={ghostMat} color="#7fe0a0" transparent opacity={0.45} depthWrite={false} /></mesh>
      </group>
      {deed.items.map((p, k) => {
        const fp = fpOf(p.id); if (!fp) return null
        const c = pieceCentre(KIND, fp, p.cx, p.cz, p.rot), w = yardToWorld(yard, c.lx, c.lz)
        return <group key={`${k}:${p.id}:${p.cx}:${p.cz}`} position={[w.x, R.groundAt(w.x, w.z), w.z]} rotation={[0, yardRotY(yard) - p.rot * Math.PI / 2, 0]}><PieceBody item={p.id} /></group>
      })}
    </group>
  )
}

// ── the built parts: fence (posts + two rails, a gap at the gate), the look board, the grid, the house trim ──
function rail(a: THREE.Vector3, b: THREE.Vector3) {
  const m = a.clone().add(b).multiplyScalar(0.5), L = a.distanceTo(b)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize())
  return { m, L, q }
}
function Fence({ R, yard, color, accent }: { R: Region; yard: Yard; color: string; accent: string }) {
  const parts = useMemo(() => {
    const posts: THREE.Vector3[] = [], rails: { m: THREE.Vector3; L: number; q: THREE.Quaternion }[] = []
    const corners: [number, number][] = [[-G.w / 2, -G.d / 2], [G.w / 2, -G.d / 2], [G.w / 2, G.d / 2], [-G.w / 2, G.d / 2]]
    // edges in order: near (0), +x end (3), far (1), -x end (2)
    const edgeId = [0, 3, 1, 2]
    for (let e = 0; e < 4; e++) {
      const [u0, v0] = corners[e], [u1, v1] = corners[(e + 1) % 4], L = Math.hypot(u1 - u0, v1 - v0), n = Math.round(L / 2)
      const gap = edgeId[e] === yard.gate
      // post stations along the edge (s from -L/2 to L/2); at the gate the middle ones give way to two gateposts
      let ss = Array.from({ length: n + 1 }, (_, k) => -L / 2 + (k * L) / n)
      if (gap) ss = [...ss.filter(s => Math.abs(s) >= GATE_W / 2 + 0.3), -GATE_W / 2, GATE_W / 2].sort((a, b) => a - b)
      const at = (s: number) => { const t = s / L + 0.5, w = yardToWorld(yard, u0 + (u1 - u0) * t, v0 + (v1 - v0) * t); return new THREE.Vector3(w.x, R.groundAt(w.x, w.z), w.z) }
      ss.forEach((s, k) => {
        const p = at(s)
        if (k < ss.length - 1) posts.push(p)   // the edge's last post is the next edge's first
        if (k > 0 && !(gap && ss[k - 1] === -GATE_W / 2 && s === GATE_W / 2)) rails.push(rail(at(ss[k - 1]), p))
      })
    }
    return { posts, rails }
  }, [R, yard])
  return (
    <group>
      {parts.posts.map((p, k) => <mesh key={`p${k}`} position={[p.x, p.y + 0.6, p.z]}><boxGeometry args={[0.14, 1.2, 0.14]} /><meshLambertMaterial color={color} /></mesh>)}
      {parts.rails.map((r, k) => [0.45, 0.95].map(h => (
        <mesh key={`r${k}${h}`} position={[r.m.x, r.m.y + h, r.m.z]} quaternion={r.q}><boxGeometry args={[r.L, 0.08, 0.06]} /><meshLambertMaterial color={h > 0.5 ? accent : color} /></mesh>
      )))}
    </group>
  )
}

function LookBoard({ R, yard, at, color, accent }: { R: Region; yard: Yard; at: { x: number; z: number }; color: string; accent: string }) {
  const y = R.groundAt(at.x, at.z)
  return (
    <group position={[at.x, y, at.z]} rotation={[0, yardRotY(yard), 0]}>
      <mesh position={[0, 0.7, 0]}><boxGeometry args={[0.12, 1.4, 0.12]} /><meshLambertMaterial color={color} /></mesh>
      <mesh position={[0, 1.35, 0]}><boxGeometry args={[0.9, 0.5, 0.06]} /><meshLambertMaterial color={accent} /></mesh>
      {/* four swatches: the combos on offer, the chosen one stands proud */}
      <Swatches color={color} />
    </group>
  )
}
function Swatches({ color }: { color: string }) {
  return <>{DEED_PALETTES.map((p, k) => <mesh key={k} position={[-0.3 + k * 0.2, 1.35, p.color === color ? 0.06 : 0.035]}><boxGeometry args={[0.14, 0.2, 0.02]} /><meshLambertMaterial color={p.color} /></mesh>)}</>
}

function GridLines({ R, yard, gref }: { R: Region; yard: Yard; gref: React.RefObject<THREE.LineSegments | null> }) {
  const geo = useMemo(() => {
    const pts: number[] = [], push = (u: number, v: number) => { const w = yardToWorld(yard, u, v); pts.push(w.x, R.groundAt(w.x, w.z) + 0.04, w.z) }
    // each line in 1 m steps so it rides the slope
    for (let i = 0; i <= G.w; i++) for (let j = 0; j < G.d; j++) { push(i - G.w / 2, j - G.d / 2); push(i - G.w / 2, j + 1 - G.d / 2) }
    for (let j = 0; j <= G.d; j++) for (let i = 0; i < G.w; i++) { push(i - G.w / 2, j - G.d / 2); push(i + 1 - G.w / 2, j - G.d / 2) }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return g
  }, [R, yard])
  return <lineSegments ref={gref} geometry={geo} visible={false}><lineBasicMaterial color="#f3e6c4" transparent opacity={0.5} depthWrite={false} /></lineSegments>
}

/** the colour + material shows on the house too: corner posts and a band under the eaves (over the kit's walls, not instead) */
function HouseTrim({ b, color, accent }: { b: { x: number; z: number; yaw: number; w: number; d: number; floors: number; y1: number }; color: string; accent: string }) {
  const { bx, bz } = buildingAxes(b), H = b.floors * FLOOR_H, y0 = b.y1 + 0.25
  const ry = Math.atan2(-bx[1], bx[0])
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  return (
    <group position={[b.x, y0, b.z]} rotation={[0, ry, 0]}>
      {corners.map(([a, c], k) => <mesh key={k} position={[a * (b.w / 2 + 0.04), H / 2, c * (b.d / 2 + 0.04)]}><boxGeometry args={[0.22, H, 0.22]} /><meshLambertMaterial color={color} /></mesh>)}
      <mesh position={[0, H - 0.15, b.d / 2 + 0.05]}><boxGeometry args={[b.w + 0.1, 0.22, 0.06]} /><meshLambertMaterial color={accent} /></mesh>
      <mesh position={[0, H - 0.15, -b.d / 2 - 0.05]}><boxGeometry args={[b.w + 0.1, 0.22, 0.06]} /><meshLambertMaterial color={accent} /></mesh>
      <mesh position={[b.w / 2 + 0.05, H - 0.15, 0]}><boxGeometry args={[0.06, 0.22, b.d + 0.1]} /><meshLambertMaterial color={accent} /></mesh>
      <mesh position={[-b.w / 2 - 0.05, H - 0.15, 0]}><boxGeometry args={[0.06, 0.22, b.d + 0.1]} /><meshLambertMaterial color={accent} /></mesh>
    </group>
  )
}
