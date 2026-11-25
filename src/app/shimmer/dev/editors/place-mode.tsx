'use client'
// ── BETA M153 s1a: PLACE MODE in the World Builder's Fly view (docs/m153-place-mode.md; Alex's controls) ──
// The worktable creative grammar: a click locks the pointer, the crosshair is the hand. RIGHT places what the hotbar slot holds, LEFT
// picks up the piece under the crosshair (it leaves the map and is in hand, with its own turn and size), wheel = size, 1-9 = hotbar,
// E = inventory, G = snap, T = turn step, R = turn, M = move (right puts it down, M again leaves it), X / Delete = delete, B = blocks
// or not. Ctrl+Z is the brushes' own undo: the props sit in the same history (builder-props.ts).
// This file never saves: TerrainEditor owns the list (draft, autosave, Publish), BuilderFly draws.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PROP_SNAPS, PROP_TURNS, PROPS_MAX, addProp, removeProp, changeProp, nextOf, scaleBy, snapXZ, turnBy, type Prop } from '../../world/builder-props'
import { SCENERY, SCENERY_BY, SCENERY_GROUPS, endSnap, isSolid, sceneryPlaced, type PlacedProp } from '../../open/ather/scenery'
import { SceneryView } from '../../open/ather/scenery-view'
import { GladeLots } from '../../open/ather/glade-lots-view'
import { GladeHome } from '../../open/ather/glade-home-view'
import { gladeHome } from '../../open/ather/glade-home'
import { GLADE_FRAME, GLADE_GATE, gladeKeepers, gregInGlade } from '../../open/ather/glade-cluster'
import { GLADE, gladeFolk } from '../../open/ather/moonwell-glade'
import { folkSpots } from '../../open/ather/folk-spots'

/** where a piece in hand, aimed at (x, z), goes: onto a fence's end when one is near, else the grid. Snap free = exactly there. */
const spotFor = (props: readonly Prop[], h: Hand, moving: string | null, snap: number, x: number, z: number) => (snap > 0 ? endSnap(moving ? props.filter(p => p.id !== moving) : props, h, x, z) : null) ?? { x: snapXZ(x, snap), z: snapXZ(z, snap) }
type Ground = (x: number, z: number) => number
export interface Hand { k: string; q: number; s: number; solid?: boolean }
export interface PlaceApi {
  props: readonly Prop[]; hand: Hand | null; moving: string | null; snap: number
  put: (x: number, z: number) => void; pick: (id: string) => void; wheel: (dy: number) => void
  /** BuilderFly reports the piece under the crosshair */
  setTarget: (id: string | null) => void
}
const SLOTS = 9
const FIRST: (string | null)[] = [...['Trees', 'Bushes', 'Crystals', 'Props', 'Furniture'].flatMap(g => SCENERY.filter(s => s.group === g).slice(0, 2).map(s => s.k as string | null))].slice(0, SLOTS)
const SLOTS_KEY = 'builder.placeSlots'
const loadSlots = (): (string | null)[] => {
  try { const a = JSON.parse(localStorage.getItem(SLOTS_KEY) ?? 'null') as unknown; if (Array.isArray(a) && a.length === SLOTS) return a.map(v => (typeof v === 'string' && SCENERY_BY.has(v) ? v : null)) } catch { /* */ }
  return FIRST
}

/** the mode's own state (the list itself lives in the editor's store: `props` in, `setProps` out) */
export function usePlace(on: boolean, props: readonly Prop[], setProps: (ps: Prop[]) => void, say: (s: string) => void) {
  const [slots, setSlotsS] = useState<(string | null)[]>(FIRST)
  useEffect(() => { setSlotsS(loadSlots()) }, [])
  const setSlots = useCallback((f: (s: (string | null)[]) => (string | null)[]) => setSlotsS(s => { const n = f(s); try { localStorage.setItem(SLOTS_KEY, JSON.stringify(n)) } catch { /* */ } return n }), [])
  const [slot, setSlot] = useState(0), [snap, setSnap] = useState<number>(0.5), [turn, setTurn] = useState<number>(45)
  const [inv, setInv] = useState(false), [moving, setMoving] = useState<string | null>(null), [target, setTarget] = useState<string | null>(null)
  const [held, setHeld] = useState<{ q: number; s: number; solid?: boolean }>({ q: 0, s: 1 })
  const mp = moving ? props.find(p => p.id === moving) ?? null : null
  const k = mp ? mp.k : slots[slot]
  const hand = useMemo<Hand | null>(() => (k ? { k, ...held } : null), [k, held])
  const S = useRef({ props, slots, slot, snap, turn, moving, target, held, hand, inv }); S.current = { props, slots, slot, snap, turn, moving, target, held, hand, inv }
  const go = useRef({ setProps, say }); go.current = { setProps, say }
  const put = useCallback((x: number, z: number) => {
    const c = S.current; if (!c.hand) { go.current.say('this slot is empty: E opens the inventory'); return }
    const at = { ...spotFor(c.props, c.hand, c.moving, c.snap, x, z), q: c.hand.q, s: c.hand.s, ...(c.hand.solid === undefined ? {} : { solid: c.hand.solid }) }
    if (c.moving) { go.current.setProps(changeProp(c.props, c.moving, at)); setMoving(null); setHeld({ q: 0, s: 1 }); return }
    const n = addProp(c.props, { k: c.hand.k, ...at })
    if (n) go.current.setProps(n); else go.current.say(`the map holds ${PROPS_MAX} pieces at most`)
  }, [])
  const handOf = (p: Prop) => ({ q: p.q, s: p.s, ...(p.solid === undefined ? {} : { solid: p.solid }) })
  const pick = useCallback((id: string) => {
    const c = S.current, p = c.props.find(q => q.id === id); if (!p || c.moving) return
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
      else if (e.code === 'KeyR') setHeld(h => ({ ...h, q: turnBy(h.q, c.turn) }))
      else if (e.code === 'KeyM') { if (c.moving) { setMoving(null); setHeld({ q: 0, s: 1 }) } else { const p = c.props.find(q => q.id === c.target); if (p) { setMoving(p.id); setHeld(handOf(p)) } } }
      else if (e.code === 'KeyX' || e.code === 'Delete') { const id = c.moving ?? c.target; if (id) { go.current.setProps(removeProp(c.props, id)); setMoving(null) } }
      else if (e.code === 'KeyB') {
        const p = c.moving ? null : c.props.find(q => q.id === c.target)
        if (p) go.current.setProps(changeProp(c.props, p.id, { solid: !isSolid(p) }))
        else if (c.hand) { const kk = c.hand.k; setHeld(h => ({ ...h, solid: !isSolid({ k: kk, solid: h.solid }) })) }
      }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [on])
  const api = useMemo<PlaceApi>(() => ({ props, hand, moving, snap, put, pick, wheel, setTarget }), [props, hand, moving, snap, put, pick, wheel])
  return { api, slots, slot, setSlot, snap, turn, inv, setInv, choose, target, held, hand }
}

// ── in the Canvas ──
const CENTRE = new THREE.Vector2(0, 0)
/** what the crosshair is on: the ground point (through any piece), and the nearest piece in front of that ground */
export function useCentre() {
  const { camera, scene, raycaster } = useThree()
  return useCallback((): { ground: { x: number; z: number } | null; id: string | null } => {
    camera.updateMatrixWorld(); raycaster.setFromCamera(CENTRE, camera)
    const terrain: THREE.Object3D[] = [], sc: THREE.Object3D[] = []
    scene.traverse(o => { if (o.userData?.terrain) terrain.push(o); else if (o.userData?.scenery) sc.push(o) })
    const g = raycaster.intersectObjects(terrain, false)[0], h = raycaster.intersectObjects(sc, false)[0]
    const id = h && (!g || h.distance < g.distance + 0.05) ? (h.object.userData.scenery as string[])[h.instanceId ?? 0] ?? null : null
    return { ground: g ? { x: g.point.x, z: g.point.z } : null, id }
  }, [camera, scene, raycaster])
}
/** the placed pieces of the draft, the piece in hand (a ghost on the crosshair) and the frame round the piece under it */
export function PlaceLayer({ api, active, heightAt, rev }: { api: PlaceApi | null; active: boolean; heightAt: Ground; rev: number }) {
  const centre = useCentre(), ghost = useRef<THREE.Group>(null), frame = useRef<THREE.LineSegments>(null), last = useRef<string | null>(null)
  const items = useMemo(() => (api ? sceneryPlaced(api.props.filter(p => p.id !== api.moving), heightAt) : []), [api, heightAt, rev])   // eslint-disable-line react-hooks/exhaustive-deps
  const gk = active ? api?.hand?.k : undefined
  const ghostItems = useMemo<PlacedProp[]>(() => (gk ? [{ id: 'ghost', k: gk, x: 0, y: 0, z: 0, q: 0, s: 1 }] : []), [gk])
  const { gl } = useThree()
  useFrame(() => {
    const on = active && !!api && document.pointerLockElement === gl.domElement, c = on ? centre() : null
    if (api && (c?.id ?? null) !== last.current) { last.current = c?.id ?? null; api.setTarget(last.current) }
    const g = ghost.current
    if (g) {
      const h = api?.hand, at = c?.ground && h ? spotFor(api!.props, h, api!.moving, api!.snap, c.ground.x, c.ground.z) : null, x = at?.x ?? 0, z = at?.z ?? 0, y = at ? heightAt(x, z) : NaN
      g.visible = Number.isFinite(y)
      if (g.visible && h) { g.position.set(x, y, z); g.rotation.y = -h.q * Math.PI / 2; g.scale.setScalar(h.s) }
    }
    const f = frame.current, t = f && last.current ? items.find(p => p.id === last.current) : null, K = t ? SCENERY_BY.get(t.k) : null
    if (f) { f.visible = !!t && !!K; if (t && K) { f.position.set(t.x, t.y + K.h * t.s / 2, t.z); f.rotation.y = -t.q * Math.PI / 2; f.scale.set(K.w * t.s * 1.08, K.h * t.s * 1.04, K.d * t.s * 1.08) } }
  })
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), [])
  useEffect(() => () => edges.dispose(), [edges])
  return <group name="place-layer">
    <SceneryView items={items} />
    <group ref={ghost} visible={false}><SceneryView items={ghostItems} ghost /></group>
    <lineSegments ref={frame} geometry={edges} visible={false} renderOrder={5}><lineBasicMaterial color="#fbbf24" depthTest={false} transparent /></lineSegments>
  </group>
}

/** What stands in the Glade today and cannot be moved yet (s1c): the lots' houses and stations, Greg's home, the jetty, the gate, the
 *  people, the valley's trees. Drawn see-through, never a target. The pool's water is BuilderFly's own. */
export function GladeFixed({ heightAt, label }: { heightAt: Ground; label: (text: string, color: string) => { tex: THREE.CanvasTexture; aspect: number } }) {
  const ref = useRef<THREE.Group>(null), n = useRef(0)
  const folk = useMemo(() => [...gladeKeepers().map(k => ({ ...k, h: 1.75 })), { ...gregInGlade(), h: 1.75 }, ...folkSpots(GLADE, gladeFolk().map(f => f.id)).map(f => ({ ...f, name: f.id.split(':').pop()!.replace(/^./, c => c.toUpperCase()), h: 1.1 }))], [])
  const tags = useMemo(() => folk.map(f => label(f.name, '#fde68a')), [folk, label])
  useEffect(() => () => tags.forEach(t => t.tex.dispose()), [tags])
  const trees = GLADE_FRAME.meadow?.trees ?? []
  const inst = useMemo(() => {
    const mat = new THREE.MeshLambertMaterial({ color: '#79ad5a', transparent: true, opacity: 0.35, depthWrite: false }), im = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), mat, Math.max(1, trees.length)), m = new THREE.Matrix4(), q = new THREE.Quaternion()
    trees.forEach((t, k) => { const g = heightAt(t.x, t.z), y = Number.isFinite(g) ? g : t.y; im.setMatrixAt(k, m.compose(new THREE.Vector3(t.x, y + 1.2 + t.tall / 2, t.z), q, new THREE.Vector3(t.r, t.tall + 2.4, t.r))) })
    im.count = trees.length; im.raycast = () => {}; im.computeBoundingSphere(); return im
  }, [trees, heightAt])
  useEffect(() => () => { inst.geometry.dispose(); (inst.material as THREE.Material).dispose(); inst.dispose() }, [inst])
  // see-through, and never in a ray's way (the house parts arrive late: their blueprints are fetched)
  useFrame(() => {
    if (n.current++ % 30) return
    ref.current?.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh || m.userData.ghosted || Array.isArray(m.material)) return
      m.userData.ghosted = true; m.raycast = () => {}; if (m === (inst as unknown as THREE.Mesh)) return
      const c = m.material.clone(); c.transparent = true; c.opacity = 0.55; m.material = c })
  })
  const h = gladeHome(), gy = heightAt(GLADE_GATE.x, GLADE_GATE.z)
  return <group name="glade-fixed" ref={ref}>
    <GladeLots />
    <GladeHome y={heightAt(h.x, h.z)} />
    {Number.isFinite(gy) && <group position={[GLADE_GATE.x, gy, GLADE_GATE.z]}><mesh position-y={0.2}><cylinderGeometry args={[1.6, 1.6, 0.4, 24]} /><meshLambertMaterial color="#8fb7d8" /></mesh><mesh position-y={1.9}><torusGeometry args={[1.5, 0.12, 8, 32]} /><meshLambertMaterial color="#8fb7d8" /></mesh></group>}
    {folk.map((f, i) => { const y = heightAt(f.x, f.z); return Number.isFinite(y) ? <group key={f.id} position={[f.x, y, f.z]} rotation-y={f.yaw} userData={{ fixedFolk: f.id }}>
      <mesh position-y={f.h / 2}><capsuleGeometry args={[0.26, f.h - 0.52, 4, 12]} /><meshLambertMaterial color="#9fc4ff" /></mesh>
      <mesh position={[0, f.h * 0.8, 0.24]}><sphereGeometry args={[0.09, 8, 6]} /><meshLambertMaterial color="#ffffff" /></mesh>
      <sprite position-y={f.h + 0.5} scale={[0.35 * tags[i].aspect, 0.35, 1]} raycast={() => {}}><spriteMaterial map={tags[i].tex} /></sprite>
    </group> : null })}
    <primitive object={inst} />
  </group>
}

// ── the screen: hotbar, status line, inventory ──
const COLOR: Record<string, string> = { Trees: '#4f9a5f', Bushes: '#8fb35a', Plants: '#a9c763', 'Rocks and logs': '#8b857b', 'Fences and signs': '#a5834f', Crystals: '#9a8ae0', Props: '#b98a4e', Furniture: '#7fa6c4' }
export function PlaceHud({ place, locked, count, status }: { place: ReturnType<typeof usePlace>; locked: boolean; count: number; status?: string }) {
  const { slots, slot, setSlot, snap, turn, inv, setInv, choose, held, hand, api, target } = place
  const tp = target ? api.props.find(p => p.id === target) : null, name = (k: string | null | undefined) => (k ? SCENERY_BY.get(k)?.label ?? k : 'empty')
  return <>
    {inv && <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center p-3" data-testid="place-inv" onPointerDown={e => { if (e.target === e.currentTarget) setInv(false) }}>
      <div className="max-h-full w-full max-w-[860px] overflow-y-auto rounded border border-white/15 bg-[#14181c]/95 p-3 select-none">
        <div className="text-[11px] font-mono text-white/50 mb-2">slot {slot + 1} takes what you click · E closes · {SCENERY.length} pieces</div>
        {SCENERY_GROUPS.map(g => <div key={g} className="mb-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">{g}</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-1">{SCENERY.filter(s => s.group === g).map(s =>
            <button key={s.k} onClick={() => choose(s.k)} data-testid={`place-item-${s.k}`} className={`text-left rounded border px-2 py-1.5 text-[11px] leading-tight ${slots[slot] === s.k ? 'border-amber-400 bg-amber-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
              <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: COLOR[g] }} />{s.label}
              <span className="block text-[9px] font-mono text-white/40">{s.w.toFixed(1)} x {s.d.toFixed(1)} x {s.h.toFixed(1)} m{s.solid ? ' · blocks' : ''}</span>
            </button>)}</div>
        </div>)}
      </div>
    </div>}
    <div className="absolute left-1/2 bottom-2 -translate-x-1/2 z-[9] flex flex-col items-center gap-1 pointer-events-none w-[96%]" data-testid="place-hud">
      <div className="rounded bg-black/70 px-2 py-1 text-[11px] font-mono text-white/80 tabular-nums text-center">
        {api.moving ? 'moving ' : ''}{name(hand?.k)} · size {held.s.toFixed(2)} (wheel) · turn {Math.round(held.q * 90)}° (R, step {turn}° T) · snap {snap || 'free'} (G){hand ? ` · ${isSolid(hand) ? 'blocks' : 'walk through'} (B)` : ''} · {count}/{PROPS_MAX}
        {tp && <span className="block text-amber-200">{name(tp.k)} · left pick up · M move · X delete · B {isSolid(tp) ? 'blocks' : 'walk through'}</span>}
        {status && <span className="block text-amber-200">{status}</span>}
        {!locked && <span className="block text-white/55">click the view: right places, left picks up · E inventory · Esc frees the mouse</span>}
      </div>
      <div className="flex gap-1 pointer-events-auto w-full max-w-[620px]">{slots.map((k, i) =>
        <button key={i} onClick={() => setSlot(i)} data-testid={`place-slot-${i + 1}`} className={`flex-1 min-w-0 h-11 rounded border text-[9px] leading-tight px-1 text-center overflow-hidden ${i === slot ? 'border-amber-400 bg-amber-500/25 text-white' : 'border-white/20 bg-black/60 text-white/70'}`}>
          <span className="block text-[9px] text-white/40">{i + 1}</span>{k ? name(k) : ''}</button>)}</div>
    </div>
  </>
}
