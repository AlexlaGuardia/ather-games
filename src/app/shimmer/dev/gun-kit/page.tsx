'use client'

/**
 * THE GUN KIT — M81 blockout (Alex 11-22): the Backbone and the Charred Rifle rebuilt with a RAIL, and the sights as their own
 * pieces seated on it (open/shared/gun-kit.ts). Look only: the live game does not read these models until Alex OKs the look.
 *
 * Views: Sheet (every gun x every sight it takes, side on), Turn (one combo on a turntable), Hip / Aim (in hand, through the game's
 * own rig and lens, with the gun's shipped hand tune, so you see whether the gloves still grip). URL: ?view=&gun=&sight=&yaw= (shots).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FpGun, ScopeRing, loadGunTune, previewGunModel, type FpGunApi } from '../../open/shared/fp-gun'
import { RANGE_GUNS } from '../../open/shared/gunplay'
import { EYE_STAND } from '../../open/shared/locomotion'
import { KIT_GUNS, KIT_SIGHTS, kitModel, sightsFor, type KitGunId, type KitSightId, type Model, type PartColor } from '../../open/shared/gun-kit'

type View = 'sheet' | 'turn' | 'hip' | 'aim'
const VIEWS: { id: View; label: string }[] = [{ id: 'sheet', label: 'Sheet' }, { id: 'turn', label: 'Turn' }, { id: 'hip', label: 'Hip' }, { id: 'aim', label: 'Aim' }]
const GUN_IDS = Object.keys(KIT_GUNS) as KitGunId[]
const chip: React.CSSProperties = { background: '#211f2b', border: '1px solid #38344a', color: '#ddd6ea', padding: '5px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }
const colorOf = (id: KitGunId) => RANGE_GUNS.find(g => g.id === id)?.color ?? '#888'

/** The bench look of a kit model: the same part colours as the rig (fp-gun.tsx), opaque, a dot that shows. */
function GunMesh({ m, color }: { m: Model; color: string }) {
  const g = useMemo(() => {
    const mat = (c: PartColor): THREE.Material => {
      if (c === 'glass') return new THREE.MeshBasicMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })
      if (c === 'dot') return new THREE.MeshBasicMaterial({ color: '#ff5a3c', side: THREE.DoubleSide })
      if (c === 'ember') return new THREE.MeshStandardMaterial({ color: '#ff7a2e', emissive: new THREE.Color('#ff7a2e'), emissiveIntensity: 1.2 })
      return new THREE.MeshStandardMaterial({ color: c === 'body' ? color : c === 'dark' ? '#2a2622' : '#55524c', roughness: c === 'metal' ? 0.45 : 0.75, metalness: c === 'metal' ? 0.4 : 0, side: THREE.DoubleSide })
    }
    const grp = new THREE.Group()
    for (const p of m.parts) {
      const geo = p.shape === 'cyl' || p.shape === 'tube' ? new THREE.CylinderGeometry(p.s[0] / 2, p.s[0] / 2, p.s[2], 14, 1, p.shape === 'tube')
        : p.shape === 'disc' ? new THREE.CircleGeometry(p.s[0] / 2, 16) : new THREE.BoxGeometry(...p.s)
      const mesh = new THREE.Mesh(geo, mat(p.c)); mesh.position.set(...p.o)
      if (p.shape === 'cyl' || p.shape === 'tube') mesh.rotation.x = Math.PI / 2
      grp.add(mesh)
    }
    return grp
  }, [m, color])
  useEffect(() => () => { g.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose() } }) }, [g])
  return <primitive object={g} />
}

/** side on, muzzle to the right, a touch from above and in front so the rail and the sight read */
const SIDE = (yaw: number): [number, number, number] => [0.22, -Math.PI / 2 + yaw, 0]

function Turntable({ m, color, yaw }: { m: Model; color: string; yaw: number | null }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y = yaw ?? ref.current.rotation.y + dt * 0.5 })
  return <group rotation={[0.25, 0, 0]}><group ref={ref} rotation={[0, yaw ?? -Math.PI / 2, 0]}><group position={[0, 0, 0.1]}><GunMesh m={m} color={color} /></group></group></group>
}

function Bench({ children, zoom }: { children: React.ReactNode; zoom: number }) {
  return (
    <Canvas orthographic camera={{ position: [0, 0, 5], zoom, near: 0.1, far: 50 }}>
      <color attach="background" args={['#e6e1d6']} />
      <hemisphereLight args={['#ffffff', '#8a7f6a', 1.1]} />
      <directionalLight position={[2, 4, 5]} intensity={1.4} />
      <directionalLight position={[-3, 1, -2]} intensity={0.4} />
      {children}
    </Canvas>
  )
}

function Driver({ api, gunId, aiming }: { api: React.RefObject<FpGunApi | null>; gunId: KitGunId; aiming: boolean }) {
  const gun = RANGE_GUNS.find(g => g.id === gunId)!
  useFrame((_, dt) => { api.current?.step({ gun, aiming, speed: 0, firedAt: -Infinity, reloading: false, now: performance.now() }, dt) })
  return null
}

export default function GunKit() {
  const q = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
  const [view, setView] = useState<View>((q.get('view') as View) || 'sheet')
  const [gunId, setGunId] = useState<KitGunId>((q.get('gun') as KitGunId) in KIT_GUNS ? (q.get('gun') as KitGunId) : 'backbone')
  const [sightId, setSightId] = useState<KitSightId>((q.get('sight') as KitSightId) in KIT_SIGHTS ? (q.get('sight') as KitSightId) : KIT_GUNS[gunId].own)
  const yaw = q.get('yaw') != null ? Number(q.get('yaw')) : null
  const api = useRef<FpGunApi>(null)
  const sights = sightsFor(KIT_GUNS[gunId])
  const sight = sights.includes(sightId) ? sightId : KIT_GUNS[gunId].own
  const model = useMemo(() => kitModel(gunId, sight), [gunId, sight])
  // in hand: the real rig draws this gun id with the kit model (dev only), and lets go when the page goes
  useEffect(() => { loadGunTune() }, [])
  useEffect(() => { previewGunModel(gunId, model); return () => previewGunModel(gunId, null) }, [gunId, model])
  useEffect(() => { (window as unknown as { __gunKit?: unknown }).__gunKit = { view, gun: gunId, sight } }, [view, gunId, sight])

  return (
    <div style={{ height: '100dvh', display: 'flex', flexWrap: 'wrap', background: '#14131a' }}>
      <aside style={{ width: 'min(300px, 100%)', overflowY: 'auto', padding: '10px 12px', borderRight: '1px solid #2c2a38', color: '#ddd6ea' }}>
        <h1 className="gx-title" style={{ margin: 0, fontSize: 14, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e8e3d8' }}>The Gun Kit</h1>
        <p style={{ margin: '4px 0 10px', fontSize: 11, color: '#9a94a8', lineHeight: 1.5 }}>
          Blockout (M81): each gun on a rail, each sight its own piece. Hip and Aim use the game&apos;s rig and the gun&apos;s hand tune.
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {VIEWS.map(v => <button key={v.id} data-view={v.id} onClick={() => setView(v.id)} style={{ ...chip, opacity: view === v.id ? 1 : 0.45 }}>{v.label}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {GUN_IDS.map(id => <button key={id} data-gun={id} onClick={() => setGunId(id)} style={{ ...chip, opacity: gunId === id ? 1 : 0.45 }}>{KIT_GUNS[id].name}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {sights.map(id => <button key={id} data-sight={id} onClick={() => setSightId(id)} style={{ ...chip, opacity: sight === id ? 1 : 0.45 }}>{KIT_SIGHTS[id].name}</button>)}
        </div>
        {view === 'sheet' && <p style={{ fontSize: 11, color: '#9a94a8', lineHeight: 1.6 }}>Rows: {GUN_IDS.map(id => KIT_GUNS[id].name).join(', then ')}. Columns: the gun&apos;s own sight, the open lens, the 2x scope.</p>}
      </aside>
      <div style={{ flex: 1, minWidth: 300, position: 'relative' }}>
        {view === 'sheet' && (
          <Bench zoom={250}>
            {GUN_IDS.map((id, r) => sightsFor(KIT_GUNS[id]).map((s, c) => (
              <group key={`${id}-${s}`} position={[(c - 1) * 1.15, (0.5 - r) * 0.55, 0]} rotation={SIDE(0.3)}><GunMesh m={kitModel(id, s)} color={colorOf(id)} /></group>
            )))}
          </Bench>
        )}
        {view === 'turn' && <Bench zoom={620}><Turntable m={model} color={colorOf(gunId)} yaw={yaw} /></Bench>}
        {(view === 'hip' || view === 'aim') && (
          <>
            <Canvas camera={{ position: [0, EYE_STAND, 0], fov: 75, near: 0.05, far: 500 }} onCreated={({ camera }) => camera.lookAt(0, EYE_STAND, -10)}>
              <color attach="background" args={['#cfe3ef']} />
              <hemisphereLight args={['#cfe3ef', '#7d9455', 0.9]} />
              <directionalLight position={[3, 6, 4]} intensity={1.1} />
              <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[400, 400]} /><meshStandardMaterial color="#86a35a" roughness={1} /></mesh>
              <mesh position={[0, EYE_STAND, -20]}><boxGeometry args={[0.6, 0.6, 0.1]} /><meshStandardMaterial color="#c0503a" /></mesh>
              <FpGun ref={api} />
              <Driver api={api} gunId={gunId} aiming={view === 'aim'} />
            </Canvas>
            <ScopeRing />
          </>
        )}
      </div>
    </div>
  )
}
