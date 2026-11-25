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
import { PieceBody } from './workshop'
import { clusterGeometry, CRYSTAL_LOOK } from './crystal-nodes'
import { SCENERY_BY, type PlacedProp, type SceneryKind } from './scenery'
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
/** a plain block of the kind's size, for a model file that does not load (never a hole in the world) */
const block = (K: SceneryKind): Part[] => { const g = new THREE.BoxGeometry(K.box?.w ?? K.w, K.h, K.box?.d ?? K.d); g.translate(0, K.h / 2, 0); return [{ geometry: g, material: new THREE.MeshLambertMaterial({ color: '#8a7a5c' }) }] }

/** the kind's baked parts; a furniture piece needs its template mounted once (`need`), the rest bake here */
function useBaked(K: SceneryKind): { parts: Part[] | null; need: string | null; onBaked: (p: Part[]) => void } {
  const [, bump] = useState(0), parts = baked.get(K.k) ?? null
  useEffect(() => {
    if (baked.has(K.k) || 'piece' in K.model) return
    let live = true
    if ('crystal' in K.model) { baked.set(K.k, bakeCrystal(K.model.crystal as CrystalKind)); bump(n => n + 1); return }
    let w = waiting.get(K.k)
    if (!w) { w = bakeGlb(K).catch(e => { console.error('[scenery] model did not load, drawing a block:', K.k, e); return block(K) }); waiting.set(K.k, w) }
    w.then(p => { baked.set(K.k, p); if (live) bump(n => n + 1) })
    return () => { live = false }
  }, [K])
  return { parts, need: !parts && 'piece' in K.model ? K.model.piece : null, onBaked: p => { baked.set(K.k, p); bump(n => n + 1) } }
}
function Template({ item, onBaked }: { item: string; onBaked: (p: Part[]) => void }) {
  const ref = useRef<THREE.Group>(null)
  useLayoutEffect(() => { if (ref.current) onBaked(bake(ref.current)) }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  return <group ref={ref} visible={false}><PieceBody item={item} /></group>
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
  if (need) return <Template item={need} onBaked={onBaked} />
  return <>{meshes.map(im => <primitive key={im.uuid} object={im} />)}</>
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
  return <group name={ghost ? 'scenery-ghost' : 'scenery'} ref={root}>{byKind.map(({ K, list }) => <KindInstances key={K.k} K={K} items={list} ghost={ghost} />)}</group>
}
