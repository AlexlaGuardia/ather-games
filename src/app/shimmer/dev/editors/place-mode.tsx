'use client'
// ── BETA M153 s1a: PLACE MODE in the World Builder's Fly view (docs/m153-place-mode.md; Alex's controls) ──
// The worktable creative grammar: a click locks the pointer, the crosshair is the hand. RIGHT places what the hotbar slot holds, LEFT
// picks up the piece under the crosshair (it leaves the map and is in hand, with its own turn and size), wheel = size, 1-9 = hotbar,
// E = inventory, G = snap, T = turn step, R = turn, M = move (right puts it down, M again leaves it), X / Delete = delete, B = blocks
// or not. s1b: a NODE (Nodes group) is gathered in the game: true size, no toggle, a tag over it, N = its wait. Ctrl+Z is the brushes' own undo: the props sit in the same history (builder-props.ts).
// s1c-1: PEOPLE and the newborn spot are pieces that are always there: left or M selects one, R turns, right puts it down, X = back to
// the code's own spot; never in the palette, never removed, no size, no toggle.
// s1c-2: Greg's home, the five lots and Yarrow's crate are pieces the same way (`spot:`): aim at a wall or the pad. Still fixed: the pool, the gate.
// s1c-3: the four garden rooms (Rooms group) are palette pieces: true size, no toggle, level on a pad; display only.
// M168 s2: a floating piece (a lily) goes on water only, at its level: the crosshair takes the water's surface, dry ground is refused.
// Water erased under it: not drawn (here or in the game), kept in the list, back with the water.
// This file never saves: TerrainEditor owns the list (draft, autosave, Publish), BuilderFly draws.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PLACE_PREFIX, isRoom, isStanding, placeOf, putPlace, WHO_PREFIX, isWho, whoId, pieceCount, putWho, qOfYaw, whoOf, yawOfQ, NODE_WAITS, PROP_SNAPS, PROP_TURNS, PROPS_MAX, addProp, isNode, nodeWaitH, removeProp, changeProp, nextOf, scaleBy, snapXZ, turnBy, type Prop } from '../../world/builder-props'
import { BUILD_SUBS } from '../../open/ather/furniture'
import { BuildIcon } from '../../open/ather/build-icon'   // M169
import { SCENERY, SCENERY_BY, SCENERY_GROUPS, endSnap, floats, floatSpot, type Water, fenceTilt, isSolid, sceneryBoxes, sceneryPlaced, type PlacedProp } from '../../open/ather/scenery'
import { SceneryView } from '../../open/ather/scenery-view'
import { tiltMatrix } from '../../open/ather/scenery-filler'
import { GladeLots, useGladeStanding } from '../../open/ather/glade-lots-view'
import { GladeHome } from '../../open/ather/glade-home-view'
import { gladeHomeY } from '../../open/ather/glade-home'
import { gladePlaces, placeSolids, placeY, type GladePlace } from '../../open/ather/glade-places'
import { padGround, padLevel, roomPad } from '../../open/ather/glade-pads'
import { GLADE as GROUND } from '../../open/ather/relief'
import type { Tree } from '../../open/ather/meadow'
import { GLADE_FRAME, GLADE_GATE, gladePeople } from '../../open/ather/glade-cluster'
import { gladeShapeOver } from '../../open/ather/glade-people-check'
import { bodyBlocked } from '../../open/ather/obstacles'
import { momoSpot } from '../../open/ather/glade-momo'
import { MomoModel } from '../../open/shared/momo-model'
import type { Box } from '../../open/terrain-world'

/** where a piece in hand, aimed at (x, z), goes: onto a fence's end when one is near, else the grid. Snap free = exactly there. */
const spotFor = (props: readonly Prop[], h: Hand, moving: string | null, snap: number, x: number, z: number) => (snap > 0 ? endSnap(moving ? props.filter(p => p.id !== moving) : props, h, x, z) : null) ?? { x: snapXZ(x, snap), z: snapXZ(z, snap) }
type Ground = (x: number, z: number) => number
export interface Hand { k: string; q: number; s: number; solid?: boolean; /** s1b: a picked-up node keeps its id + wait */ id?: string; w?: number; /** s1c-1: the newborn spot was turned */ turned?: boolean }
/** the next wait up (round to the first), or down */
const stepWait = (w: number, back: boolean) => { const a = NODE_WAITS as readonly number[]; return back ? [...a].reverse().find(v => v < w) ?? a[a.length - 1] : a.find(v => v > w) ?? a[0] }
export interface PlaceApi {
  props: readonly Prop[]; hand: Hand | null; moving: string | null; snap: number
  put: (x: number, z: number) => void; pick: (id: string) => void; wheel: (dy: number) => void
  /** BuilderFly reports the piece under the crosshair */
  setTarget: (id: string | null) => void
  /** M168 s2: the draft's water, as drawn */
  water: Water
}
const SLOTS = 9
const FIRST: (string | null)[] = [...['Trees', 'Bushes', 'Crystals', 'Props', 'Furniture'].flatMap(g => SCENERY.filter(s => s.group === g).slice(0, 2).map(s => s.k as string | null))].slice(0, SLOTS)
const SLOTS_KEY = 'builder.placeSlots'
const loadSlots = (): (string | null)[] => {
  try { const a = JSON.parse(localStorage.getItem(SLOTS_KEY) ?? 'null') as unknown; if (Array.isArray(a) && a.length === SLOTS) return a.map(v => (typeof v === 'string' && SCENERY_BY.has(v) ? v : null)) } catch { /* */ }
  return FIRST
}

const personName = (k: string) => gladePeople().find(p => p.who === whoOf(k))?.name ?? gladePlaces().find(p => p.place === placeOf(k))?.name ?? k
/** s1c-1: a person as a piece (`w<id>`; s1c-2: a house, `h<place>`), where they stand now: the draft's spot, or the code's */
const personPiece = (id: string, props: readonly Prop[] = []): Prop | null => {
  const h = id[0] === 'h' ? gladePlaces().find(q => q.id === id) : null
  if (h) return props.find(q => q.id === id) ?? { id, k: PLACE_PREFIX + h.place, x: h.x, z: h.z, q: qOfYaw(h.yaw), s: 1 }
  const p = id[0] === 'w' ? gladePeople().find(q => q.id === id) : null
  return p ? props.find(q => q.id === id) ?? { id, k: WHO_PREFIX + p.who, x: p.x, z: p.z, q: qOfYaw(p.yaw), s: 1 } : null
}
/** the mode's own state (the list itself lives in the editor's store: `props` in, `setProps` out) */
export function usePlace(on: boolean, props: readonly Prop[], setProps: (ps: Prop[]) => void, say: (s: string) => void, water: Water) {
  const [slots, setSlotsS] = useState<(string | null)[]>(FIRST)
  useEffect(() => { setSlotsS(loadSlots()) }, [])
  const setSlots = useCallback((f: (s: (string | null)[]) => (string | null)[]) => setSlotsS(s => { const n = f(s); try { localStorage.setItem(SLOTS_KEY, JSON.stringify(n)) } catch { /* */ } return n }), [])
  const [slot, setSlot] = useState(0), [snap, setSnap] = useState<number>(0.5), [turn, setTurn] = useState<number>(45)
  const [inv, setInv] = useState(false), [moving, setMoving] = useState<string | null>(null), [target, setTarget] = useState<string | null>(null)
  const [held, setHeld] = useState<Omit<Hand, 'k'>>({ q: 0, s: 1 })
  const mp = moving ? props.find(p => p.id === moving) ?? personPiece(moving) : null
  const k = mp ? mp.k : slots[slot]
  const hand = useMemo<Hand | null>(() => (k ? { k, ...held, ...(isNode({ k }) || isRoom({ k }) || isStanding({ k }) ? { s: 1, solid: undefined } : {}) } : null), [k, held])
  const S = useRef({ props, slots, slot, snap, turn, moving, target, held, hand, inv }); S.current = { props, slots, slot, snap, turn, moving, target, held, hand, inv }
  const go = useRef({ setProps, say, water }); go.current = { setProps, say, water }
  const put = useCallback((x: number, z: number) => {
    const c = S.current; if (!c.hand) { go.current.say('this slot is empty: E opens the inventory'); return }
    const w = c.moving ? whoOf(c.hand.k) : null
    if (w) { go.current.setProps(putWho(c.props, w, { ...spotFor(c.props, c.hand, c.moving, c.snap, x, z), q: c.hand.q, ...(c.hand.turned ? { turned: true } : {}) })); setMoving(null); setHeld({ q: 0, s: 1 }); return }
    const pl = c.moving ? placeOf(c.hand.k) : null
    if (pl) { go.current.setProps(putPlace(c.props, pl, { ...spotFor(c.props, c.hand, c.moving, c.snap, x, z), q: c.hand.q })); setMoving(null); setHeld({ q: 0, s: 1 }); return }
    const at = { ...spotFor(c.props, c.hand, c.moving, c.snap, x, z), q: c.hand.q, s: c.hand.s, ...(c.hand.solid === undefined ? {} : { solid: c.hand.solid }), ...(isNode(c.hand) ? { w: c.hand.w } : {}) }
    if (floats(c.hand) && floatSpot({ k: c.hand.k, ...at }, go.current.water) === null) { go.current.say(`${SCENERY_BY.get(c.hand.k)!.label}: only on water`); return }
    if (c.moving) { go.current.setProps(changeProp(c.props, c.moving, at)); setMoving(null); setHeld({ q: 0, s: 1 }); return }
    const n = addProp(c.props, { k: c.hand.k, ...at, ...(c.hand.id ? { id: c.hand.id } : {}) })
    if (n) { go.current.setProps(n); if (c.hand.id) setHeld(({ id: _id, ...h }) => h) } else go.current.say(`the map holds ${PROPS_MAX} pieces at most`)
  }, [])
  const handOf = (p: Prop) => ({ q: p.q, s: p.s, ...(isNode(p) ? { id: p.id, w: p.w } : {}), ...(p.turned ? { turned: true } : {}), ...(p.solid === undefined ? {} : { solid: p.solid }) })
  const pick = useCallback((id: string) => {
    const c = S.current, who = personPiece(id, c.props); if (who) { if (!c.moving) { setMoving(id); setHeld(handOf(who)) } return }
    const p = c.props.find(q => q.id === id); if (!p || c.moving) return
    go.current.setProps(removeProp(c.props, id)); setSlots(s => s.map((v, i) => (i === c.slot ? p.k : v))); setHeld(handOf(p))
  }, [setSlots])
  const wheel = useCallback((dy: number) => setHeld(h => ({ ...h, s: scaleBy(h.s, dy) })), [])
  const choose = useCallback((kk: string) => { setSlots(s => s.map((v, i) => (i === S.current.slot ? kk : v))); setHeld(h => ({ q: h.q, s: 1 })); setMoving(null) }, [setSlots])
  // a piece undone / rolled back away while it is being moved: let go of it
  useEffect(() => { if (moving && !mp) { setMoving(null); setHeld({ q: 0, s: 1 }) } }, [moving, mp])
  useEffect(() => { if (!on) { setInv(false); setMoving(null) } }, [on])
  useEffect(() => {
    if (!on) return
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if ((el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) || e.ctrlKey || e.metaKey || e.repeat) return
      const c = S.current
      if (/^Digit[1-9]$/.test(e.code)) { setSlot(+e.code.slice(5) - 1); setMoving(null); setHeld({ q: c.held.q, s: 1 }) }
      else if (e.code === 'KeyE') { setInv(v => { if (!v && document.pointerLockElement) document.exitPointerLock(); return !v }) }
      else if (e.code === 'KeyG') setSnap(v => nextOf(PROP_SNAPS as readonly number[], v))
      else if (e.code === 'KeyT') setTurn(v => nextOf(PROP_TURNS as readonly number[], v))
      else if (e.code === 'KeyR') setHeld(h => ({ ...h, q: turnBy(h.q, c.turn), ...(c.moving && c.hand?.k === 'who:newborn' ? { turned: true } : {}) }))
      else if (e.code === 'KeyM') { if (c.moving) { setMoving(null); setHeld({ q: 0, s: 1 }) } else { const p = c.props.find(q => q.id === c.target) ?? personPiece(c.target ?? ''); if (p) { setMoving(p.id); setHeld(handOf(p)) } } }
      else if (e.code === 'KeyN') {
        const p = c.moving ? null : c.props.find(q => q.id === c.target)
        if (p && isNode(p)) go.current.setProps(changeProp(c.props, p.id, { w: stepWait(nodeWaitH(p), e.shiftKey) }))
        else if (c.hand && isNode(c.hand)) setHeld(h => ({ ...h, w: stepWait(nodeWaitH(h), e.shiftKey) }))
      }
      else if (e.code === 'KeyX' || e.code === 'Delete') { const id = c.moving ?? c.target; if (id && (!personPiece(id) || c.props.some(p => p.id === id))) go.current.setProps(removeProp(c.props, id)); if (id) { setMoving(null); if (c.moving) setHeld({ q: 0, s: 1 }) } }
      else if (e.code === 'KeyB') {
        const p = c.moving ? null : c.props.find(q => q.id === c.target)
        if (floats(p ?? c.hand ?? { k: '' }) || isNode(p ?? c.hand ?? { k: '' }) || isRoom(p ?? c.hand ?? { k: '' }) || isStanding(p ?? c.hand ?? { k: '' }) || personPiece(c.target ?? '')) return
        if (p) go.current.setProps(changeProp(c.props, p.id, { solid: !isSolid(p) }))
        else if (c.hand) { const kk = c.hand.k; setHeld(h => ({ ...h, solid: !isSolid({ k: kk, solid: h.solid }) })) }
      }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [on])
  const api = useMemo<PlaceApi>(() => ({ props, hand, moving, snap, put, pick, wheel, setTarget, water }), [props, hand, moving, snap, put, pick, wheel, water])
  return { api, slots, slot, setSlot, snap, turn, inv, setInv, choose, target, held, hand }
}

// ── in the Canvas ──
const CENTRE = new THREE.Vector2(0, 0)
/** what the crosshair is on: the ground point (through any piece), the water's surface in front of that ground, and the nearest piece in front of that ground */
export function useCentre() {
  const { camera, scene, raycaster } = useThree()
  return useCallback((): { ground: { x: number; z: number } | null; water: { x: number; z: number } | null; id: string | null } => {
    camera.updateMatrixWorld(); raycaster.setFromCamera(CENTRE, camera)
    const terrain: THREE.Object3D[] = [], wet: THREE.Object3D[] = [], sc: THREE.Object3D[] = []
    scene.traverse(o => { if (o.userData?.terrain) terrain.push(o); else if (o.userData?.pool || o.userData?.gladeWater) wet.push(o); else if (o.userData?.scenery) sc.push(o) })
    const g = raycaster.intersectObjects(terrain, false)[0], h = raycaster.intersectObjects(sc, false)[0], f = raycaster.intersectObjects(wet, false)[0]
    const id = h && (!g || h.distance < g.distance + 0.05) ? (h.object.userData.scenery as string[])[h.instanceId ?? 0] ?? null : null
    return { ground: g ? { x: g.point.x, z: g.point.z } : null, water: f && (!g || f.distance < g.distance) ? { x: f.point.x, z: f.point.z } : null, id }
  }, [camera, scene, raycaster])
}
/** where what is in hand is aimed: a floating piece on the water's surface, the rest on the ground under it */
export const aimed = (c: ReturnType<ReturnType<typeof useCentre>> | null, hand: Pick<Hand, 'k'> | null | undefined) => (c ? (hand && floats(hand) && c.water) || c.ground : null)
/** the placed pieces of the draft, the piece in hand (a ghost on the crosshair) and the frame round the piece under it */
export function PlaceLayer({ api, active, heightAt, rev, label, solids }: { solids?: readonly Box[]; api: PlaceApi | null; active: boolean; heightAt: Ground; rev: number; label: (text: string, color: string) => { tex: THREE.CanvasTexture; aspect: number } }) {
  const centre = useCentre(), ghost = useRef<THREE.Group>(null), lean = useRef<THREE.Group>(null), frame = useRef<THREE.LineSegments>(null), last = useRef<string | null>(null)
  const items = useMemo(() => (api ? sceneryPlaced(api.props.filter(p => p.id !== api.moving), padGround(api.props, heightAt), heightAt, api.water) : []), [api, heightAt, rev])   // eslint-disable-line react-hooks/exhaustive-deps
  const gk = active ? api?.hand?.k : undefined
  const ghostItems = useMemo<PlacedProp[]>(() => (gk ? [{ id: 'ghost', k: gk, x: 0, y: 0, z: 0, q: 0, s: 1 }] : []), [gk])
  const { gl } = useThree()
  // a room's ghost at the level it will stand at, asked again only when it moved
  const topAt = useRef({ key: '', y: NaN }), roomTop = (r: NonNullable<ReturnType<typeof roomPad>>) => { const key = `${r.room}/${r.x}/${r.z}/${r.yaw}/${rev}`; if (topAt.current.key !== key) topAt.current = { key, y: padLevel(r, heightAt).top }; return topAt.current.y }
  useFrame(() => {
    const on = active && !!api && document.pointerLockElement === gl.domElement, c = on ? centre() : null
    if (api && (c?.id ?? null) !== last.current) { last.current = c?.id ?? null; api.setTarget(last.current) }
    const g = ghost.current
    if (g) {
      const h = api?.hand, to = aimed(c, h), at = to && h ? spotFor(api!.props, h, api!.moving, api!.snap, to.x, to.z) : null, x = at?.x ?? 0, z = at?.z ?? 0, r = at && h && isRoom(h) ? roomPad({ id: 'ghost', k: h.k, x, z, q: h.q, s: 1 }) : null, tl = at && h ? fenceTilt({ k: h.k, x, z, q: h.q, s: h.s }, heightAt) : null, y = at && h && floats(h) ? floatSpot({ k: h.k, x, z, s: h.s }, api!.water) ?? NaN : r ? roomTop(r) : tl ? tl.y : at ? heightAt(x, z) : NaN
      g.visible = Number.isFinite(y)
      if (g.visible && h) { g.position.set(x, y, z); g.rotation.y = -h.q * Math.PI / 2; g.scale.setScalar(h.s); if (lean.current) { tiltMatrix(tl?.tilt, lean.current.matrix); lean.current.matrixWorldNeedsUpdate = true } }
    }
    const f = frame.current, pp = f && last.current ? personPiece(last.current) : null, pl = pp && placeOf(pp.k) ? placeBox(pp.id, heightAt) : null, py = pp ? (pl ? pl.y : heightAt(pp.x, pp.z)) : 0, t = f && last.current ? (pp ? { ...pp, y: py } : items.find(p => p.id === last.current)) : null, K = t ? (pl ?? (pp ? { w: 0.8, d: 0.8, h: personH(pp.k) } : SCENERY_BY.get(t.k))) : null
    if (f) { f.visible = !!t && !!K; if (t && K) { f.position.set(t.x, t.y + K.h * t.s / 2, t.z); f.rotation.y = -t.q * Math.PI / 2; const tt = (t as PlacedProp).tilt ?? [0, 0]; f.scale.set(K.w * t.s * 1.08, K.h * t.s * 1.04 + (Math.abs(tt[0]) * K.w + Math.abs(tt[1]) * K.d) * t.s, K.d * t.s * 1.08) } }
  })
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), [])
  useEffect(() => () => edges.dispose(), [edges])
  // s1b: a node wears a tag (its name and wait) and a ring, so it never reads as the scenery version beside it
  const nodes = items.filter(isNode), texts = nodes.map(p => `${SCENERY_BY.get(p.k)!.label} · ${nodeWaitH(p)} h`).join('|')
  const tags = useMemo(() => (texts ? texts.split('|').map(t => label(t, '#8ef0c0')) : []), [texts, label])
  useEffect(() => () => tags.forEach(t => t.tex.dispose()), [tags])
  return <group name="place-layer">
    <SceneryView items={items} />
    <group ref={ghost} visible={false}><group ref={lean} matrixAutoUpdate={false}><SceneryView items={ghostItems} ghost /></group>{gk && isWho({ k: gk }) && <PersonBody h={personH(gk)} color={gk === 'who:newborn' ? '#8ef0c0' : '#9fc4ff'} />}{gk && isRoom({ k: gk }) && <RoomFront k={gk} />}{gk && placeOf(gk) && <PlaceGhost place={gladePlaces().find(p => p.place === placeOf(gk))} />}</group>
    {api && <GladePeople heightAt={heightAt} props={api.props} moving={api.moving} label={label} />}
    {api && api.moving !== whoId('bonn') && <FlyMomo heightAt={heightAt} rev={rev} items={items} props={api.props} solids={solids} />}
    {nodes.map((p, i) => { const K = SCENERY_BY.get(p.k)!; return tags[i] && <group key={p.id} position={[p.x, p.y, p.z]} userData={{ nodeTag: p.id }}>
      <sprite position-y={K.h + 0.6} scale={[0.55 * tags[i].aspect, 0.55, 1]} renderOrder={4} raycast={() => {}}><spriteMaterial map={tags[i].tex} depthTest={false} /></sprite>
      <mesh rotation-x={-Math.PI / 2} position-y={0.12} raycast={() => {}}><ringGeometry args={[1.25, 1.5, 32]} /><meshBasicMaterial color="#8ef0c0" transparent opacity={0.85} depthWrite={false} /></mesh>
    </group> })}
    <lineSegments ref={frame} geometry={edges} visible={false} renderOrder={5}><lineBasicMaterial color="#fbbf24" depthTest={false} transparent /></lineSegments>
  </group>
}

/** s1c-1: the people's ghosts. Small Moglins, keeper-sized people; the newborn spot wears the nodes' green. The nose shows the turn. */
const SMALL = ['fennel', 'sax', 'yarrow', 'mallow', 'hazel']
const personH = (k: string) => (SMALL.includes(whoOf(k) ?? '') ? 1.1 : 1.75)
function PersonBody({ h, color, id }: { h: number; color: string; id?: string }) {
  const ud = id ? { scenery: [id] } : {}
  return <>
    <mesh position-y={h / 2} userData={ud}><capsuleGeometry args={[0.26, h - 0.52, 4, 12]} /><meshLambertMaterial color={color} transparent opacity={0.8} /></mesh>
    <mesh position={[0, h * 0.8, 0.24]} raycast={() => {}}><sphereGeometry args={[0.09, 8, 6]} /><meshLambertMaterial color="#ffffff" /></mesh>
  </>
}
function GladePeople({ heightAt, props, moving, label }: { heightAt: Ground; props: readonly Prop[]; moving: string | null; label: (text: string, color: string) => { tex: THREE.CanvasTexture; aspect: number } }) {
  const ver = useGladeStanding()
  const folk = useMemo(() => gladePeople(), [ver, props])   // eslint-disable-line react-hooks/exhaustive-deps
  const stand = useMemo(() => padGround(props, heightAt), [props, heightAt, ver])   // eslint-disable-line react-hooks/exhaustive-deps
  const names = folk.map(f => f.name + (f.moved ? ' (moved)' : '')).join('|')
  const tags = useMemo(() => names.split('|').map(n => label(n, '#fde68a')), [names, label])
  useEffect(() => () => tags.forEach(t => t.tex.dispose()), [tags])
  return <group name="glade-people">{folk.map((f, i) => {
    const y = stand(f.x, f.z), h = personH(WHO_PREFIX + f.who)
    return f.id === moving || !tags[i] ? null : <group key={f.id} position={[f.x, Number.isFinite(y) ? y : 0, f.z]} rotation-y={f.yaw} userData={{ fixedFolk: f.who }}>
      <PersonBody id={f.id} h={h} color={f.who === 'newborn' ? '#8ef0c0' : '#9fc4ff'} />
      <sprite position-y={h + 0.5} scale={[0.35 * tags[i].aspect, 0.35, 1]} raycast={() => {}}><spriteMaterial map={tags[i].tex} /></sprite>
    </group>
  })}</group>
}
/** M168: Momo where the game stands him (glade-momo.ts over the draft's ground and solid pieces), beside Bonn wherever the draft has her.
 *  Looked at only: no piece, no target, in nobody's way. While Bonn is in hand he goes with her. */
const NO_BOXES: readonly Box[] = []
function FlyMomo({ heightAt, rev, items, props, solids = NO_BOXES }: { heightAt: Ground; rev: number; items: readonly PlacedProp[]; props: readonly Prop[]; solids?: readonly Box[] }) {
  const ver = useGladeStanding(), ref = useRef<THREE.Group>(null)
  const at = useMemo(() => {
    const shape = gladeShapeOver(heightAt, [...solids, ...sceneryBoxes(items)]), stand = padGround(props, heightAt)
    return momoSpot(stand, (x, z) => bodyBlocked((x0, z0, x1, z1) => shape.solids(x0, -50, z0, x1, 90, z1), x, shape.ground(x, z), z, 0.2))
  }, [heightAt, rev, items, props, solids, ver])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { ref.current?.traverse(o => { o.raycast = () => {} }) }, [at])
  return at && Number.isFinite(at.y) ? <group ref={ref} name="fly-momo" position={[at.x, at.y, at.z]} rotation-y={at.yaw}><MomoModel /></group> : null
}
/** a house in hand: its footprint as a slab, its size, and a white nose out of its front (a lot's front is -z, Greg's home's and the crate's +z) */
const front = (k: string) => (k === 'home' || k === 'jars' ? 1 : -1)
function PlaceGhost({ place: p }: { place?: GladePlace }) {
  return p ? <>
    <mesh position-y={0.05} raycast={() => {}}><boxGeometry args={[p.w, 0.1, p.d]} /><meshBasicMaterial color="#fbbf24" transparent opacity={0.6} depthWrite={false} /></mesh>
    <mesh position-y={p.h / 2} raycast={() => {}}><boxGeometry args={[p.w, p.h, p.d]} /><meshBasicMaterial color="#9fc4ff" transparent opacity={0.22} depthWrite={false} /></mesh>
    <mesh position={[0, Math.min(1.2, p.h / 2), front(p.place) * (p.d / 2 + 0.4)]} raycast={() => {}}><sphereGeometry args={[Math.min(0.3, p.h / 4), 8, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
  </> : null
}
/** a room in hand: a white nose out of its open front (local -z; the bench is at the back) */
const RoomFront = ({ k }: { k: string }) => <mesh position={[0, 0.6, -((SCENERY_BY.get(k)?.d ?? 6) / 2 + 0.4)]} raycast={() => {}}><sphereGeometry args={[0.25, 8, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
/** the frame round a house: its size and the height it stands at */
const placeBox = (id: string, land: Ground) => { const p = gladePlaces().find(q => q.id === id); return p ? { w: p.w, d: p.d, h: p.h, y: placeY(p.place, land) } : null }
/** s1c-2: what the crosshair hits of each house: its own solid boxes and its pad, never seen. A piece or a person in front of a wall, or on
 *  the pad, is nearer and wins. */
function PlaceTargets({ heightAt, rev, moving }: { heightAt: Ground; rev: number; moving: string | null }) {
  const standing = useGladeStanding()
  const ms = useMemo(() => gladePlaces().map(p => {
    const y = placeY(p.place, heightAt), bs = placeSolids(p.place, heightAt), im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }), bs.length + 1)
    const m = new THREE.Matrix4(), q0 = new THREE.Quaternion(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw)
    bs.forEach((b, i) => im.setMatrixAt(i, m.compose(new THREE.Vector3((b.x0 + b.x1) / 2, (Math.max(b.y0, y) + b.y1) / 2, (b.z0 + b.z1) / 2), q0, new THREE.Vector3(b.x1 - b.x0, Math.max(0.01, b.y1 - Math.max(b.y0, y)), b.z1 - b.z0))))
    im.setMatrixAt(bs.length, m.compose(new THREE.Vector3(p.x, y + 0.05, p.z), q, new THREE.Vector3(p.w, 0.1, p.d)))
    im.computeBoundingSphere(); im.userData.scenery = Array(bs.length + 1).fill(p.id); im.userData.place = p.id
    return im
  }), [standing, heightAt, rev])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => ms.forEach(im => { im.geometry.dispose(); (im.material as THREE.Material).dispose(); im.dispose() }), [ms])
  return <group name="glade-places">{ms.map(im => im.userData.place === moving ? null : <primitive key={im.userData.place} object={im} />)}</group>
}
/** The Glade's houses (s1c-2: pieces, PlaceTargets is their target), and what stays fixed: the jetty, the gate, the valley's trees.
 *  Drawn see-through. The pool's water is BuilderFly's own. */
export function GladeFixed({ heightAt, rev = 0, place, trees = GLADE_FRAME.meadow?.trees ?? [] }: { rev?: number; place?: PlaceApi; trees?: readonly Tree[]; heightAt: Ground }) {
  const ref = useRef<THREE.Group>(null), n = useRef(0)
  const inst = useMemo(() => {
    const mat = new THREE.MeshLambertMaterial({ color: '#79ad5a', transparent: true, opacity: 0.35, depthWrite: false }), im = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), mat, Math.max(1, trees.length)), m = new THREE.Matrix4(), q = new THREE.Quaternion()
    trees.forEach((t, k) => { const g = heightAt(t.x, t.z), y = Number.isFinite(g) ? g : t.y; im.setMatrixAt(k, m.compose(new THREE.Vector3(t.x, y + 1.2 + t.tall / 2, t.z), q, new THREE.Vector3(t.r, t.tall + 2.4, t.r))) })
    im.count = trees.length; im.userData.meadowGhosts = true; im.raycast = () => {}; im.computeBoundingSphere(); return im
  }, [trees, heightAt])
  useEffect(() => () => { inst.geometry.dispose(); (inst.material as THREE.Material).dispose(); inst.dispose() }, [inst])
  // see-through, and never in a ray's way (the house parts arrive late: their blueprints are fetched)
  useFrame(() => {
    if (n.current++ % 30) return
    ref.current?.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh || m.userData.ghosted || Array.isArray(m.material)) return
      m.userData.ghosted = true; m.raycast = () => {}; if (m === (inst as unknown as THREE.Mesh)) return
      const c = m.material.clone(); c.transparent = true; c.opacity = 0.55; m.material = c })
  })
  useGladeStanding()
  const hy = gladeHomeY(heightAt), gy = heightAt(GLADE_GATE.x, GLADE_GATE.z)
  // the draft's ground is one function over a live store: a new one per stroke, so a moved house follows the land
  const land = useMemo<Ground>(() => (x, z) => heightAt(x, z), [heightAt, rev])   // eslint-disable-line react-hooks/exhaustive-deps
  return <><PlaceTargets heightAt={land} rev={rev} moving={place?.moving ?? null} /><group name="glade-fixed" ref={ref}>
    <GladeLots ground={land} />
    <GladeHome y={Number.isFinite(hy) ? hy : GROUND.y} />
    {Number.isFinite(gy) && <group position={[GLADE_GATE.x, gy, GLADE_GATE.z]}><mesh position-y={0.2}><cylinderGeometry args={[1.6, 1.6, 0.4, 24]} /><meshLambertMaterial color="#8fb7d8" /></mesh><mesh position-y={1.9}><torusGeometry args={[1.5, 0.12, 8, 32]} /><meshLambertMaterial color="#8fb7d8" /></mesh></group>}
    <primitive object={inst} />
  </group></>
}

// ── the screen: hotbar, status line, inventory ──
const COLOR: Record<string, string> = { Nodes: '#8ef0c0', Rooms: '#d8a85c', Trees: '#4f9a5f', Bushes: '#8fb35a', Plants: '#a9c763', 'Rocks and logs': '#8b857b', 'Fences and signs': '#a5834f', Crystals: '#9a8ae0', Props: '#b98a4e', Build: '#c9a36a', Furniture: '#7fa6c4' }
export function PlaceHud({ place, locked, count, status }: { place: ReturnType<typeof usePlace>; locked: boolean; count: number; status?: string }) {
  const { slots, slot, setSlot, snap, turn, inv, setInv, choose, held, hand, api, target } = place
  const dry = useMemo(() => api.props.filter(p => floats(p) && api.water(p.x, p.z) === null).length, [api.props, api.water])
  const tp = target ? api.props.find(p => p.id === target) ?? personPiece(target) : null, name = (k: string | null | undefined) => (k && isStanding({ k }) ? personName(k) : k ? SCENERY_BY.get(k)?.label ?? k : 'empty')
  return <>
    {inv && <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center p-3" data-testid="place-inv" onPointerDown={e => { if (e.target === e.currentTarget) setInv(false) }}>
      <div className="max-h-full w-full max-w-[860px] overflow-y-auto rounded border border-white/15 bg-[#14181c]/95 p-3 select-none">
        <div className="text-[11px] font-mono text-white/50 mb-2">slot {slot + 1} takes what you click · E closes · {SCENERY.length} pieces</div>
        {SCENERY_GROUPS.map(g => { const item = (s: typeof SCENERY[number]) =>
            <button key={s.k} onClick={() => choose(s.k)} data-testid={`place-item-${s.k}`} className={`text-left rounded border px-2 py-1.5 text-[11px] leading-tight ${s.sub ? 'flex items-center gap-1.5' : ''} ${slots[slot] === s.k ? 'border-amber-400 bg-amber-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
              {s.sub ? <BuildIcon id={s.k.slice(6)} size={30} /> : <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: COLOR[g] }} />}<span className="min-w-0">{s.label}
              <span className="block text-[9px] font-mono text-white/40">{s.w.toFixed(1)} x {s.d.toFixed(1)} x {s.h.toFixed(1)} m{s.solid ? ' · blocks' : ''}{isNode(s) ? ' · gathered' : s.floats ? ' · on water' : ''}</span></span>
            </button>
          const grid = (list: typeof SCENERY) => <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-1">{list.map(item)}</div>
          return <div key={g} className="mb-3" data-testid={`place-group-${g}`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">{g}</div>
          {g === 'Build' ? BUILD_SUBS.map(sub => { const list = SCENERY.filter(s => s.group === g && s.sub === sub)   // M169: an empty sub-category is not shown
            return list.length > 0 && <div key={sub} className="mb-1.5" data-testid={`place-sub-${sub}`}><div className="text-[10px] text-white/55 mb-0.5">{sub}</div>{grid(list)}</div> }) : grid(SCENERY.filter(s => s.group === g))}
        </div> })}
      </div>
    </div>}
    <div className="absolute left-1/2 bottom-2 -translate-x-1/2 z-[9] flex flex-col items-center gap-1 pointer-events-none w-[96%]" data-testid="place-hud">
      <div className="rounded bg-black/70 px-2 py-1 text-[11px] font-mono text-white/80 tabular-nums text-center">
        {api.moving ? 'moving ' : ''}{name(hand?.k)} · {hand && isStanding(hand) ? 'right puts down' : hand && isNode(hand) ? `true size · grows back in ${nodeWaitH(hand)} h (N)` : hand && isRoom(hand) ? 'true size' : `size ${held.s.toFixed(2)} (wheel)`} · turn {Math.round(held.q * 90)}° (R, step {turn}° T) · snap {snap || 'free'} (G){hand && floats(hand) ? ' · on water' : hand && !isNode(hand) && !isRoom(hand) && !isStanding(hand) ? ` · ${isSolid(hand) ? 'blocks' : 'walk through'} (B)` : ''} · {count}/{PROPS_MAX}{dry ? ` · ${dry} not drawn: no water` : ''}
        {tp && <span className="block text-amber-200">{name(tp.k)} · {isStanding(tp) ? 'left or M moves · X back to the first spot' : 'left pick up · M move · X delete'} {isStanding(tp) ? '' : '· '}{isStanding(tp) ? '' : isNode(tp) ? `N grows back in ${nodeWaitH(tp)} h` : isRoom(tp) ? 'true size' : floats(tp) ? 'on water' : `B ${isSolid(tp) ? 'blocks' : 'walk through'}`}</span>}
        {status && <span className="block text-amber-200">{status}</span>}
        {!locked && <span className="block text-white/55">click the view: right places, left picks up · E inventory · Esc frees the mouse</span>}
      </div>
      <div className="flex gap-1 pointer-events-auto w-full max-w-[620px]">{slots.map((k, i) =>
        <button key={i} onClick={() => setSlot(i)} data-testid={`place-slot-${i + 1}`} className={`flex-1 min-w-0 h-11 rounded border text-[9px] leading-tight px-1 text-center overflow-hidden ${i === slot ? 'border-amber-400 bg-amber-500/25 text-white' : 'border-white/20 bg-black/60 text-white/70'}`}>
          <span className="block text-[9px] text-white/40">{i + 1}</span>{k ? name(k) : ''}</button>)}</div>
    </div>
  </>
}
