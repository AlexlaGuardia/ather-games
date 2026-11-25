'use client'
// BETA M153 s1a: placed scenery, drawn (scenery.ts says what and where). The game's Glade and the World Builder's Fly both use this.
// INSTANCED: each kind is baked once into one geometry per material, so a kind costs 1 to 4 draw calls however many stand. A furniture
// piece is the game's own PieceBody, baked (a static body: no potted sapling, no flicker); a model is its glb, fitted by height.
// Nothing here is a node or a keeper's piece: no E, no pickup.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FLORA_LOOKS } from '../../world/flora-placements'
import { PieceBody, RoomMesh } from './workshop'
import { GROUND_Y } from './plot'
import { roomPad } from './glade-pads'
import { isRoom, type GladeRoom } from '../../world/builder-props'
import { clusterGeometry, CRYSTAL_LOOK } from './crystal-nodes'
import { LOOK as TREE_LOOK } from './wilds-scene'
import { crownOf } from './forestry'
import { NODE_CRYSTAL_S, isTreeKind, nodeTree } from './glade-nodes'
import { SCENERY_BY, type PlacedProp, type SceneryKind } from './scenery'
import { fillerGeometry, fillerMaterial } from './scenery-filler'
import type { CrystalKind } from './prospecting'

interface Part { geometry: THREE.BufferGeometry; material: THREE.Material }
const baked = new Map<string, Part[]>(), waiting = new Map<string, Promise<Part[]>>()

/** every mesh under `root` (root-local) into one geometry per distinct material; plain colours share one by vertex colour */
function bake(root: THREE.Object3D, place = new THREE.Matrix4()): Part[] {
  root.updateWorldMatrix(true, true)
  const inv = root.matrixWorld.clone().invert(), sets = new Map<string, { gs: THREE.BufferGeometry[]; mat: THREE.Material }>()
  root.traverse(o => {
    const m = o as THREE.Mesh
    if (!m.isMesh || Array.isArray(m.material)) return
    const src = m.material as THREE.MeshLambertMaterial, map = src.map ?? null
    const g0 = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(), g = new THREE.BufferGeometry()
    if (!g0.getAttribute('normal')) g0.computeVertexNormals()
    g.setAttribute('position', g0.getAttribute('position').clone()); g.setAttribute('normal', g0.getAttribute('normal').clone())
    if (map && g0.getAttribute('uv')) g.setAttribute('uv', g0.getAttribute('uv').clone())
    g.applyMatrix4(place.clone().multiply(inv).multiply(m.matrixWorld))
    const n = g.getAttribute('position').count, c = src.color ?? new THREE.Color('#fff'), col = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) { col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const basic = src.type === 'MeshBasicMaterial', em = !basic && src.emissive ? src.emissive.getHexString() : '000000', ei = src.emissiveIntensity ?? 0
    const key = [basic, map?.uuid ?? '', src.transparent ? src.opacity : 1, em === '000000' ? '' : `${em}/${ei}`, src.side, src.flatShading].join('|')
    let s = sets.get(key)
    if (!s) {
      const o2 = { vertexColors: true, map, transparent: src.transparent, opacity: src.opacity, side: src.side }
      s = { gs: [], mat: basic ? new THREE.MeshBasicMaterial(o2) : new THREE.MeshLambertMaterial({ ...o2, flatShading: src.flatShading, emissive: new THREE.Color(`#${em}`), emissiveIntensity: ei, emissiveMap: src.emissiveMap ?? null }) }
      sets.set(key, s)
    }
    s.gs.push(g); g0.dispose()
  })
  return [...sets.values()].flatMap(s => { const g = mergeGeometries(s.gs); s.gs.forEach(x => x.dispose()); return g ? [{ geometry: g, material: s.mat }] : [] })
}

let loader: GLTFLoader | null = null
function glbLoader() {
  if (!loader) { loader = new GLTFLoader(); const d = new DRACOLoader(); d.setDecoderPath('/draco/'); loader.setDRACOLoader(d) }
  return loader
}
async function bakeGlb(K: SceneryKind): Promise<Part[]> {
  if (!('glb' in K.model)) return []
  const M = K.model, root = (await glbLoader().loadAsync(M.glb)).scene, look = M.look ? FLORA_LOOKS[M.look as keyof typeof FLORA_LOOKS] as { trunk: string; canopy: string; glow?: number } : null
  root.traverse(o => {
    const m = o as THREE.Mesh; if (!m.isMesh) return
    const mt = (m.material as THREE.MeshStandardMaterial).clone()
    if (look) { const leaf = /canopy|leaf/i.test(mt.name); mt.color.set(leaf ? look.canopy : look.trunk); mt.flatShading = leaf; if (leaf && look.glow) { mt.emissive.set(look.canopy); mt.emissiveIntensity = look.glow } }
    if (M.glow && mt.map) { mt.emissive.set('#ffffff'); mt.emissiveMap = mt.map; mt.emissiveIntensity = M.glow }
    m.material = mt
  })
  const box = new THREE.Box3().setFromObject(root), s = M.fit / (box.max.y - box.min.y || 1)
  return bake(root, new THREE.Matrix4().makeRotationY(M.yaw ?? 0).premultiply(new THREE.Matrix4().makeScale(s, s, s)).premultiply(new THREE.Matrix4().makeTranslation(0, -box.min.y * s, 0)))
}
function bakeCrystal(kind: CrystalKind): Part[] {
  const L = CRYSTAL_LOOK[kind], foot = new THREE.DodecahedronGeometry(1, 0); foot.scale(0.62, 0.32, 0.55)
  return [
    { geometry: clusterGeometry(), material: new THREE.MeshLambertMaterial({ color: L.color, emissive: L.glow, emissiveIntensity: L.k, flatShading: true, transparent: !!L.clear, opacity: L.clear ? 0.88 : 1 }) },
    { geometry: foot, material: new THREE.MeshLambertMaterial({ color: '#7a7068', flatShading: true }) },
  ]
}
/** s1b: a node's body in Fly, standing still: wilds-scene's trunk and crown, crystal-nodes' cluster and foot */
function bakeNode(kind: string): Part[] {
  if (!isTreeKind(kind)) { const ps = bakeCrystal(kind as CrystalKind); ps.forEach((p, i) => { p.geometry.translate(0, i ? -0.05 : -0.08, 0); p.geometry.scale(NODE_CRYSTAL_S, NODE_CRYSTAL_S * (!i && (kind === 'ather' || kind === 'pure') ? 1.15 : 1), NODE_CRYSTAL_S) }); return ps }
  const L = TREE_LOOK[kind], c = crownOf({ ...nodeTree(kind), y: 0, kind }), trunk = new THREE.CylinderGeometry(0.24, 0.32, 1, 6)
  trunk.scale(L.trunkW, c.trunkH, L.trunkW); trunk.translate(0, c.trunkH / 2, 0)
  const crown = L.shape === 'weep' ? new THREE.ConeGeometry(1, 1, 9, 1, true) : L.shape === 'dome' ? new THREE.DodecahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 0)
  crown.scale(c.r, L.shape === 'weep' ? c.hh * 2 : c.hh, c.r); crown.translate(0, c.cy, 0)
  return [
    { geometry: trunk, material: new THREE.MeshLambertMaterial({ color: L.trunk, flatShading: true }) },
    { geometry: crown, material: new THREE.MeshLambertMaterial({ color: L.crown, flatShading: true, side: L.shape === 'weep' ? THREE.DoubleSide : THREE.FrontSide, emissive: L.emissive ?? '#000000', emissiveIntensity: L.emissive ? 0.22 : 0 }) },
  ]
}
/** a plain block of the kind's size, for a model file that does not load (never a hole in the world) */
const block = (K: SceneryKind): Part[] => { const g = new THREE.BoxGeometry(K.box?.w ?? K.w, K.h, K.box?.d ?? K.d); g.translate(0, K.h / 2, 0); return [{ geometry: g, material: new THREE.MeshLambertMaterial({ color: '#8a7a5c' }) }] }

/** the kind's baked parts; a furniture piece needs its template mounted once (`need`), the rest bake here */
function useBaked(K: SceneryKind): { parts: Part[] | null; need: { item: string } | { room: GladeRoom } | null; onBaked: (p: Part[]) => void } {
  const [, bump] = useState(0), parts = baked.get(K.k) ?? null
  useEffect(() => {
    if (baked.has(K.k) || 'piece' in K.model || 'room' in K.model) return
    let live = true
    if ('crystal' in K.model) { baked.set(K.k, bakeCrystal(K.model.crystal as CrystalKind)); bump(n => n + 1); return }
    if ('node' in K.model) { baked.set(K.k, bakeNode(K.model.node)); bump(n => n + 1); return }
    if ('filler' in K.model) { baked.set(K.k, [{ geometry: fillerGeometry(K.model.filler), material: fillerMaterial() }]); bump(n => n + 1); return }
    let w = waiting.get(K.k)
    if (!w) { w = bakeGlb(K).catch(e => { console.error('[scenery] model did not load, drawing a block:', K.k, e); return block(K) }); waiting.set(K.k, w) }
    w.then(p => { baked.set(K.k, p); if (live) bump(n => n + 1) })
    return () => { live = false }
  }, [K])
  return { parts, need: parts ? null : 'piece' in K.model ? { item: K.model.piece } : 'room' in K.model ? { room: K.model.room } : null, onBaked: p => { baked.set(K.k, p); bump(n => n + 1) } }
}
/** a garden room is the keeper plot's own room with nothing behind it: floor + furniture (a shell, rooms.ts M97) */
function RoomBody({ room }: { room: GladeRoom }) {
  const r = useMemo(() => ({ id: 'show', kind: room, x: 0, z: 0, q: 0, placedAt: 0, doneAt: 0, shell: true as const }), [room])
  return <group position-y={-GROUND_Y}><RoomMesh r={r} /></group>
}
function Template({ need, onBaked }: { need: { item: string } | { room: GladeRoom }; onBaked: (p: Part[]) => void }) {
  const ref = useRef<THREE.Group>(null)
  useLayoutEffect(() => { if (ref.current) onBaked(bake(ref.current)) }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  return <group ref={ref} visible={false}>{'room' in need ? <RoomBody room={need.room} /> : <PieceBody item={need.item} />}</group>
}

const UP = new THREE.Vector3(0, 1, 0)
function KindInstances({ K, items, ghost }: { K: SceneryKind; items: readonly PlacedProp[]; ghost?: boolean }) {
  const { parts, need, onBaked } = useBaked(K)
  const meshes = useMemo(() => {
    if (!parts || !items.length) return []
    const m = new THREE.Matrix4(), q = new THREE.Quaternion()
    return parts.map(p => {
      const mat = ghost ? p.material.clone() : p.material
      if (ghost) { mat.transparent = true; mat.opacity = 0.55; mat.depthWrite = false }
      const im = new THREE.InstancedMesh(p.geometry, mat, items.length)
      items.forEach((it, k) => im.setMatrixAt(k, m.compose(new THREE.Vector3(it.x, it.y, it.z), q.setFromAxisAngle(UP, -it.q * Math.PI / 2), new THREE.Vector3(it.s, it.s, it.s))))
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere()
      im.userData = ghost ? { ghost: true } : { scenery: items.map(i => i.id) }
      if (ghost) im.raycast = () => {}
      return im
    })
  }, [parts, items, ghost])
  useEffect(() => () => { for (const im of meshes) { im.dispose(); if (im.userData.ghost) (im.material as THREE.Material).dispose() } }, [meshes])
  if (need) return <Template need={need} onBaked={onBaked} />
  return <>{meshes.map(im => <primitive key={im.uuid} object={im} />)}</>
}

/** a room on uneven ground: its floor goes down to the lowest of it */
function RoomPlinth({ p }: { p: PlacedProp }) {
  const r = isRoom(p) && p.low !== undefined && p.y - p.low > 0.02 ? roomPad(p) : null
  return r ? <mesh position={[p.x, (p.y + 0.02 + p.low!) / 2, p.z]} rotation-y={r.yaw} raycast={() => {}} userData={{ roomPlinth: p.id }}><boxGeometry args={[r.w - 0.02, p.y + 0.02 - p.low!, r.d - 0.02]} /><meshLambertMaterial color="#b98d5a" /></mesh> : null
}

export function SceneryView({ items, ghost }: { items: readonly PlacedProp[]; ghost?: boolean }) {
  const byKind = useMemo(() => {
    const m = new Map<string, PlacedProp[]>()
    for (const i of items) { const a = m.get(i.k); if (a) a.push(i); else m.set(i.k, [i]) }
    return [...m.entries()].flatMap(([k, list]) => { const K = SCENERY_BY.get(k); return K ? [{ K, list }] : [] })
  }, [items])
  // test hook: what the page drew (scripts/place-mode-check.mts)
  const root = useRef<THREE.Group>(null)
  useEffect(() => {
    if (ghost) return
    const w = window as unknown as { __scenery?: () => unknown }
    const f = () => { let meshes = 0, drawn = 0; root.current?.traverse(o => { if (o.userData?.scenery) { meshes++; drawn += (o as THREE.InstancedMesh).count } }); return { items, meshes, drawn } }
    w.__scenery = f
    return () => { if (w.__scenery === f) delete w.__scenery }
  }, [items, ghost])
  if (!items.length) return null
  return <group name={ghost ? 'scenery-ghost' : 'scenery'} ref={root}>{byKind.map(({ K, list }) => <KindInstances key={K.k} K={K} items={list} ghost={ghost} />)}{items.map(p => <RoomPlinth key={p.id} p={p} />)}</group>
}
