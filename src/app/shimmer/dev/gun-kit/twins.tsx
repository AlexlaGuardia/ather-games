'use client'
// M152 s1: THE DB2 TWINS on the bench (gun-kit-twins.ts): both guns side / top / three-quarter, the split core with its two rune
// faces, the pair held in first person at the hip and in the PROPOSED aim pose, beside the Roar for scale. Look only; the game reads
// none of it. URL: /shimmer/dev/gun-kit?twins=side|top|34|core|hip|ads
import { useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { V2Mesh } from './family'
import { TWINS, twinsModel, type TwinSide, type RuneSlot } from '../../open/shared/gun-kit-twins'
import { modelGeometry } from '../../open/shared/gun-kit-geo'
import { modelOf } from '../../open/shared/fp-gun'
import { trisOf } from '../../open/shared/gun-kit-geo'
import type { PartColor } from '../../open/shared/gun-kit'

/** the two example letters drawn on the faces (letter-glyphs.md: element frame + state mark, circuitry, dark = unlit at rest).
 *  Rune 1 = Stone (Earth square + Solid centre node), rune 2 = Lightning (Storm broken zigzag arc + Expanding traces out). An example
 *  pair only: the keeper's own word goes here. */
function glyph(kind: 'stone' | 'lightning'): THREE.Texture {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128
  const g = cv.getContext('2d')!; g.strokeStyle = '#2b2f33'; g.fillStyle = '#2b2f33'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'
  const node = (x: number, y: number, r = 9) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill() }
  if (kind === 'stone') { g.strokeRect(24, 24, 80, 80); node(64, 64, 13) }
  else {
    g.beginPath(); g.moveTo(22, 78); g.lineTo(34, 46); g.lineTo(48, 58); g.lineTo(64, 24); g.lineTo(80, 58); g.lineTo(94, 46); g.lineTo(106, 78); g.stroke()   // the broken arc
    for (const [x, y] of [[64, 112], [34, 104], [94, 104]]) { g.beginPath(); g.moveTo(64, 80); g.lineTo(x, y); g.stroke(); node(x, y, 6) }   // traces running out
    node(64, 80, 8)
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t
}
function RuneFace({ s, kind }: { s: RuneSlot; kind: 'stone' | 'lightning' }) {
  const tex = useMemo(() => glyph(kind), [kind])
  return <mesh position={[s.o[0] + s.normal[0] * 0.0006, s.o[1], s.o[2]]} rotation={[0, s.normal[0] > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
    <planeGeometry args={[s.size[0] * 0.92, s.size[1] * 0.92]} /><meshBasicMaterial map={tex} transparent depthWrite={false} />
  </mesh>
}
/** one gun of the pair with its letter, its grip at the group's origin when `atGrip` */
function Twin({ side, atGrip }: { side: TwinSide; atGrip?: boolean }) {
  const g = TWINS[side], m = twinsModel(side)
  return <group position={atGrip ? [-g.grip[0], -g.grip[1], -g.grip[2]] : [0, 0, 0]}><V2Mesh m={m} /><RuneFace s={g.runeSlot} kind={side === 'left' ? 'stone' : 'lightning'} /></group>
}
/** the Roar as the game draws it today (fp-gun's breacher model), for scale */
function Roar() {
  const grp = useMemo(() => {
    const out = new THREE.Group(), mat = (c: PartColor) => new THREE.MeshStandardMaterial({ color: c === 'body' ? '#d0503c' : c === 'metal' ? '#9a9da2' : c === 'ember' ? '#ff9a3c' : '#2a2a2e', roughness: 0.6, visible: c !== 'glass' && c !== 'dot' })
    for (const [c, geo] of modelGeometry(modelOf({ id: 'roar', slot: 'BREACHER' }))) out.add(new THREE.Mesh(geo, mat(c)))
    return out
  }, [])
  return <primitive object={grp} />
}
const Lights = () => <><hemisphereLight args={['#ffffff', '#8a7f6a', 1.1]} /><directionalLight position={[2, 4, 5]} intensity={1.6} /><directionalLight position={[-3, 1, -2]} intensity={0.4} /></>
const BG = '#dadad4'

export function Twins({ view }: { view: string }) {
  useEffect(() => { (window as unknown as { __twins?: unknown }).__twins = { view, tris: { left: trisOf(twinsModel('left')), right: trisOf(twinsModel('right')) }, calls: modelGeometry(twinsModel('left')).size, parts: TWINS.left.parts.length } }, [view])
  const G = TWINS.gap / 2
  if (view === 'side') return (   // the left gun muzzle-left (its outer face, rune 1), the right muzzle-right (rune 2), the Roar below
    <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 620, near: 0.1, far: 50 }}>
      <color attach="background" args={[BG]} /><Lights />
      <group position={[-0.25, 0.17, 0]} rotation={[0, Math.PI / 2, 0]}><Twin side="left" /></group>
      <group position={[0.25, 0.17, 0]} rotation={[0, -Math.PI / 2, 0]}><Twin side="right" /></group>
      <group position={[0.12, -0.17, 0]} rotation={[0, Math.PI / 2, 0]}><Roar /></group>
    </Canvas>)
  if (view === 'top') return (   // from above, as held side by side, muzzles up; the Roar beside
    <Canvas orthographic camera={{ position: [0, 5, 0], up: [0, 0, -1], zoom: 560, near: 0.1, far: 50 }} onCreated={({ camera }) => camera.lookAt(0, 0, 0)}>
      <color attach="background" args={[BG]} /><Lights />
      <group position={[-0.12, 0, 0.05]}><group position={[-G, 0, 0]}><Twin side="left" /></group><group position={[G, 0, 0]}><Twin side="right" /></group></group>
      <group position={[0.2, 0, 0.18]}><Roar /></group>
    </Canvas>)
  if (view === '34' || view === 'core') return (   // three-quarter from the front left; 'core' = from below, the split core and its two faces
    <Canvas camera={{ position: view === 'core' ? [-0.34, -0.3, -0.12] : [-0.42, 0.24, -0.46], fov: 30 }} onCreated={({ camera }) => camera.lookAt(0, view === 'core' ? -0.06 : -0.02, -0.04)}>
      <color attach="background" args={[BG]} /><Lights /><directionalLight position={[-2, -3, -1]} intensity={0.9} />
      <group position={[-G, 0, 0]}><Twin side="left" /></group><group position={[G, 0, 0]}><Twin side="right" /></group>
      {view === '34' && <group position={[0.3, 0, 0.25]}><Roar /></group>}
    </Canvas>)
  // first person: the eye at the origin looking down -z (the game's view), the pair at the hip or in the PROPOSED aim pose
  const ads = view === 'ads'
  const pose = (side: TwinSide) => {
    const s = side === 'left' ? -1 : 1
    return ads
      ? { p: [s * 0.068, -0.125, -0.47] as const, r: [0.03, s * 0.01, s * 0.3] as const }     // up, side by side, forward, canted in, barrels under the mark
      : { p: [s * 0.2, -0.18, -0.42] as const, r: [0.05, s * 0.035, s * 0.05] as const }        // at the hip, each hand out to its side, muzzles toeing in
  }
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Canvas camera={{ position: [0, 0, 0], fov: ads ? 62 : 70, near: 0.01, far: 200 }}>
        <color attach="background" args={['#cfe3ef']} /><Lights />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.62, 0]}><planeGeometry args={[80, 80]} /><meshStandardMaterial color="#86a35a" /></mesh>
        <mesh position={[0, -0.72, -6]}><boxGeometry args={[0.7, 1.8, 0.4]} /><meshStandardMaterial color="#5b5550" /></mesh>
        {(['left', 'right'] as const).map(side => { const q = pose(side); return <group key={side} position={q.p as unknown as [number, number, number]} rotation={new THREE.Euler(q.r[0], q.r[1], q.r[2], 'YXZ')}><Twin side={side} atGrip /></group> })}
      </Canvas>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 6, height: 6, margin: -3, borderRadius: 3, background: '#fff', boxShadow: '0 0 0 1px #000' }} />
    </div>)
}
