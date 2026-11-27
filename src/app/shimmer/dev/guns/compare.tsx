'use client'
// M150 s4: TODAY vs NEW, side on, one scale: the model the game draws now above the new family's model with this browser's build
// dials on it, plus the points the dials move (grip, fore, muzzle, sight line, socket). The tuner only; the game reads none of it.
import { useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { modelGeometry, KIT_MATS } from '../../open/shared/gun-kit-geo'
import type { Model, PartColor } from '../../open/shared/gun-kit'
import type { BuiltModel } from '../../open/shared/gun-build'

const mats = new Map<string, THREE.Material>()
function matOf(c: PartColor | string, body: string): THREE.Material {
  const key = c === 'body' ? `body:${body}` : c
  let m = mats.get(key); if (m) return m
  if (c in KIT_MATS) m = new THREE.MeshStandardMaterial(KIT_MATS[c as keyof typeof KIT_MATS])
  else if (c === 'body') m = new THREE.MeshStandardMaterial({ color: body, roughness: 0.75 })
  else if (c === 'dark') m = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.75 })
  else if (c === 'metal') m = new THREE.MeshStandardMaterial({ color: '#55524c', roughness: 0.45, metalness: 0.4 })
  else if (c === 'ember') m = new THREE.MeshStandardMaterial({ color: '#ff7a2e', emissive: new THREE.Color('#ff7a2e'), emissiveIntensity: 1.2 })
  else if (c === 'glass') m = new THREE.MeshBasicMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })
  else if (c === 'dot') m = new THREE.MeshBasicMaterial({ color: '#ff5a3c', side: THREE.DoubleSide })
  else if (c === 'lens') m = new THREE.MeshStandardMaterial({ color: '#aebcc4', roughness: 0.15 })
  else if (c === 'etch') m = new THREE.MeshBasicMaterial({ color: '#3a3f44' })
  else m = new THREE.MeshBasicMaterial({ visible: false })
  mats.set(key, m); return m
}
function GunMesh({ m, body }: { m: Model; body: string }) {
  const g = useMemo(() => {
    const grp = new THREE.Group()
    for (const [c, geo] of modelGeometry(m)) grp.add(new THREE.Mesh(geo, matOf(c, body)))
    return grp
  }, [m, body])
  useEffect(() => () => { g.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose() }) }, [g])
  return <primitive object={g} />
}
/** a dial's point on the model: a small ball, coloured by what it is */
const Pin = ({ y, z, c }: { y: number; z: number; c: string }) => (
  <mesh position={[-0.05, y, z]}><sphereGeometry args={[0.009, 10, 8]} /><meshBasicMaterial color={c} depthTest={false} /></mesh>
)
export const PIN_COLORS = { grip: '#2f9e44', fore: '#1c7ed6', muzzle: '#e03131', sight: '#f59f00', socket: '#ae3ec9' } as const

export function CompareStrip({ today, fresh, body }: { today: Model; fresh: BuiltModel; body: string }) {
  return (
    <div data-compare style={{ position: 'absolute', left: 12, top: 12, width: 380, height: 250, background: 'rgba(230,225,214,0.94)', borderRadius: 6, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }}>
      <Canvas orthographic camera={{ position: [-3, 0, 0], zoom: 300, near: 0.1, far: 20 }} onCreated={({ camera }) => camera.lookAt(0, 0, 0)}>
        <color attach="background" args={['#e6e1d6']} />
        <hemisphereLight args={['#ffffff', '#8a7f6a', 1.1]} />
        <directionalLight position={[-4, 4, 2]} intensity={1.4} />
        {/* muzzle to the left (-z), as on the sheets; today above, new below */}
        <group position={[0, 0.17, 0.08]}><GunMesh m={today} body={body} /></group>
        <group position={[0, -0.14, 0.08]}>
          <GunMesh m={fresh} body={body} />
          <Pin y={fresh.grip[1]} z={fresh.grip[2]} c={PIN_COLORS.grip} />
          <Pin y={fresh.fore[1]} z={fresh.fore[2]} c={PIN_COLORS.fore} />
          <Pin y={fresh.muzzle[0]} z={fresh.muzzle[1]} c={PIN_COLORS.muzzle} />
          <Pin y={fresh.eye ?? fresh.top} z={fresh.sightZ} c={PIN_COLORS.sight} />
          {fresh.socket && <Pin y={fresh.socket[0]} z={fresh.socket[1]} c={PIN_COLORS.socket} />}
        </group>
      </Canvas>
      <span style={{ position: 'absolute', left: 8, top: 6, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5a5448' }}>Today</span>
      <span style={{ position: 'absolute', left: 8, top: 128, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5a5448' }}>New</span>
      <span style={{ position: 'absolute', right: 8, bottom: 6, fontSize: 9, color: '#5a5448' }}>
        {Object.entries(PIN_COLORS).map(([k, c]) => <span key={k} style={{ marginLeft: 6 }}><span style={{ color: c }}>●</span> {k}</span>)}
      </span>
    </div>
  )
}
