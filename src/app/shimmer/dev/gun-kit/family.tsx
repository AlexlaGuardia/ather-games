'use client'
// M149: THE LOCKED FAMILY on the bench (gun-kit-v2.ts), beside today's models: side on, close on one gun, close on the sights,
// and in the keeper's hands in third person. Look only; the game reads none of it.
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { modelGeometry, KIT_MATS, trisOf } from '../../open/shared/gun-kit-geo'
import { V2_GUNS, V2_SIGHTS, v2Model, type V2GunId, type V2SightId } from '../../open/shared/gun-kit-v2'
import { type Model, type PartColor } from '../../open/shared/gun-kit'
import { buildKeeper, poseKeeper } from '../../open/shared/keeper-figure'
import { gunProp } from '../../open/shared/held-gun-prop'
import { DEFAULT_LOOK } from '../../open/shared/keeper-look'

const mats = new Map<PartColor, THREE.Material>()
function matOf(c: PartColor): THREE.Material {
  let m = mats.get(c); if (m) return m
  if (c in KIT_MATS) m = new THREE.MeshStandardMaterial(KIT_MATS[c as keyof typeof KIT_MATS])
  else if (c === 'glass') m = new THREE.MeshBasicMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })
  else if (c === 'lens') m = new THREE.MeshStandardMaterial({ color: '#aebcc4', roughness: 0.15 })
  else if (c === 'etch') m = new THREE.MeshBasicMaterial({ color: '#3a3f44' })
  else m = new THREE.MeshBasicMaterial({ visible: false })   // the mark (unlit on the bench) and the picture
  mats.set(c, m); return m
}
export function V2Mesh({ m }: { m: Model }) {
  const g = useMemo(() => {
    const grp = new THREE.Group()
    for (const [c, geo] of modelGeometry(m)) { const x = new THREE.Mesh(geo, matOf(c)); x.renderOrder = c === 'etch' ? 2 : c === 'glass' ? 1 : 0; grp.add(x) }
    return grp
  }, [m])
  useEffect(() => () => { g.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose() }) }, [g])
  return <primitive object={g} />
}
function Keeper({ m, today }: { m?: Model; today?: string }) {
  const body = useMemo(() => buildKeeper(DEFAULT_LOOK), [])
  const prop = useMemo(() => {
    if (today) { const g = gunProp(today); g.rotation.y = Math.PI; return g }
    const g = new THREE.Group(), geo = modelGeometry(m!)
    for (const [c, x] of geo) { const k = new THREE.Mesh(x, matOf(c)); k.position.set(-m!.grip[0], -m!.grip[1], -m!.grip[2]); g.add(k) }
    g.rotation.y = Math.PI; return g
  }, [m, today])
  useEffect(() => { body.group.add(prop); return () => { body.group.remove(prop) } }, [body, prop])
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.1); poseKeeper(body, t.current, 0)
    const r = body.group.getObjectByName('hand-r'), l = body.group.getObjectByName('hand-l')
    if (r) { if (m) { r.position.x *= 0.45; r.position.z += 0.16; r.position.y += 0.1 } prop.position.set(r.position.x, r.position.y + 0.02, r.position.z + 0.06) }
    if (m && l) l.position.set(prop.position.x + (m.fore[0] - m.grip[0]), prop.position.y - 0.02, prop.position.z - (m.fore[2] - m.grip[2]))   // two-handed: the left under the shroud
  })
  return <primitive object={body.group} />
}
const IDS = Object.keys(V2_GUNS) as V2GunId[]
const Lights = () => <><hemisphereLight args={['#ffffff', '#8a7f6a', 1.1]} /><directionalLight position={[2, 4, 5]} intensity={1.6} /><directionalLight position={[-3, 1, -2]} intensity={0.4} /></>
export function Family({ view, gun, sight, yaw }: { view: string; gun: V2GunId; sight: V2SightId; yaw: number }) {
  useEffect(() => { (window as unknown as { __family?: unknown }).__family = { view, tris: Object.fromEntries(IDS.flatMap(g => V2_GUNS[g].sights.map(s => [`${g}+${s}`, trisOf(v2Model(g, s))]))), calls: Object.fromEntries(IDS.map(g => [g, modelGeometry(v2Model(g, V2_GUNS[g].own)).size])) } }, [view])
  if (view === 'third') return (
    <Canvas camera={{ position: [-1.6, 1.5, 2.4], fov: 36 }} onCreated={({ camera }) => camera.lookAt(0, 0.85, 0.2)}>
      <color attach="background" args={['#cfe3ef']} /><Lights />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#86a35a" /></mesh>
      <group rotation-y={yaw}>{sight === 'holo' && gun === 'backbone' && window.location.search.includes('today=1') ? <Keeper today={gun} /> : <Keeper m={v2Model(gun, sight)} />}</group>
    </Canvas>
  )
  const rows: [V2GunId, V2SightId][] = view === 'one' ? [[gun, sight]] : IDS.map(g => [g, V2_GUNS[g].own])
  return (
    <Canvas orthographic camera={{ position: [0, 0, 5], zoom: view === 'one' ? 760 : view === 'sights' ? 2100 : 600, near: 0.1, far: 50 }}>
      <color attach="background" args={['#dadad4']} /><Lights />
      {view === 'sights' ? (Object.keys(V2_SIGHTS) as V2SightId[]).flatMap((s, i) => [0, 1].map(k => (
        <group key={s + k} position={[(i - 1) * 0.15 + (k ? 0.036 : -0.036), -0.04, 0]} rotation={[k ? 0.1 : 0, k ? -1.1 : 0, 0]}><V2Mesh m={{ ...v2Model('backbone', 'holo'), parts: V2_SIGHTS[s].parts }} /></group>)))
        : rows.map(([g, s], r) => <group key={g} position={[view === 'one' ? -0.04 : 0.06, view === 'one' ? 0 : 0.03 + (1 - r) * 0.33, 0]} rotation={[view === 'one' ? 0.18 : 0, yaw, 0]}><group position={[0, 0, view === 'one' ? 0.06 : 0.06]}><V2Mesh m={v2Model(g, s)} /></group></group>)}
    </Canvas>
  )
}
