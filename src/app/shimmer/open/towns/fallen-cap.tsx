'use client'
// THE FALLEN CAP, Ashfeld's tavern, where the story starts. Canon (world/locations.md, Alex 11-14): "Built under a living
// mushroom that is still growing; its gills run across the ceiling, black with soot." Frontier standard (cuisine.md):
// worn wood, warm light, mana-lamps that still work, barely (transportation.md), a small stable, cooking over fire.
//
// So the mushroom IS the roof: a timber-and-stone hall stands round its stem, the cap spreads over it, and the cook
// fire's chimney ends UNDER the cap, which is why the gills are black. Ashfeld's palette (Towns.tsx › STYLE.ashfeld).
// The cap's colour and size are NOT ruled; earthy and plain here, Alex's look call.
//
// Mount: <FallenCap x z y yaw w d />. (x, z) is the building's centre, y its floor, yaw the plan's yaw (facade faces
// (cos yaw, sin yaw)); w × d is the footprint it replaces, and the walls stay inside it (foot-solids.ts collides on the
// building's own footprint, so keep the building in the plan and this lines up).

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { dayProgress, daylight } from '../../engine/day-cycle'

const WALL = '#d3b98d', WALL_DARK = '#b99d72', TIMBER = '#5a3d26', TIMBER_OLD = '#6b5038', STONE = '#8d7f69'
const STEM = '#ddd1b8', STEM_DARK = '#c4b394', CAP = '#93704e', CAP_RIM = '#a8865f', GILL = '#5a4c40', SOOT = '#262019'
const WALL_H = 3.6, SIDES = 10

function signTexture(text: string) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#4a3322'; g.fillRect(0, 0, 512, 128)
  g.strokeStyle = '#2e1f14'; g.lineWidth = 10; g.strokeRect(5, 5, 502, 118)
  g.fillStyle = '#e8c98a'; g.font = 'bold 58px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, 256, 68)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

/** one gill: a thin fin hanging under the cap from the stem to the rim */
function gillGeometry(r0: number, r1: number, depth: number) {
  const g = new THREE.BufferGeometry()
  // a quad in the x/y plane, x from r0 to r1, top at y=0, hanging to -depth at the stem and to ~0 at the rim
  const v = [r0, 0, 0, r1, 0, 0, r1, -depth * 0.15, 0, r0, -depth, 0]
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.computeVertexNormals()
  return g
}

export function FallenCap({ x, z, y, yaw, w = 14, d = 12 }: { x: number; z: number; y: number; yaw: number; w?: number; d?: number }) {
  const ry = Math.PI / 2 - yaw
  // the hall: a ten-sided round of wall inside the footprint, the stem at its heart (a little toward the back)
  const r = Math.min(w, d) / 2 - 0.3
  // the mushroom stands well clear of the hall: a stretch of bare stem shows above the boards, so it reads as a
  // mushroom with a tavern at its foot, not a hat on a hut
  const stemR = Math.max(1.1, r * 0.24), stemZ = -r * 0.12
  const capY = WALL_H + 4.6, capR = Math.min(r * 1.5, Math.max(w, d) * 0.7), capH = capR * 0.55
  const sign = useMemo(() => signTexture('THE FALLEN CAP'), [])
  useEffect(() => () => sign.dispose(), [sign])
  const gill = useMemo(() => gillGeometry(stemR * 1.7, capR * 0.97, 0.7), [stemR, capR])
  useEffect(() => () => gill.dispose(), [gill])
  // one glass for every window, so the night glow is one colour change
  const glass = useMemo(() => new THREE.MeshBasicMaterial({ color: '#6b4a2a', toneMapped: false }), [])
  useEffect(() => () => glass.dispose(), [glass])
  const lamp = useRef<THREE.MeshBasicMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const DAY = useMemo(() => new THREE.Color('#6b4a2a'), []), NIGHT = useMemo(() => new THREE.Color('#ffb25a'), [])

  useFrame(({ clock }) => {
    const n = 1 - daylight(dayProgress())
    glass.color.copy(DAY).lerp(NIGHT, n)
    // the mana-lamp by the door still works, barely: it gutters
    const t = clock.elapsedTime, k = 0.55 + 0.45 * Math.max(0, Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1) + (Math.sin(t * 0.9) > 0.85 ? -0.8 : 0.3))
    lamp.current?.color.setRGB(0.55 + 0.45 * k, 0.75 + 0.2 * k, 1)
    if (light.current) light.current.intensity = n * (6 + 4 * k)
  })

  const seg = (2 * Math.PI) / SIDES, side = 2 * r * Math.sin(seg / 2), apo = r * Math.cos(seg / 2)
  // the door's side faces the street (+z): rotate the round so a FACE, not a corner, looks out
  const faces = Array.from({ length: SIDES }, (_, i) => i * seg)
  return (
    <group position={[x, y, z]} rotation={[0, ry, 0]}>
      {/* old stone footing, a step proud of the walls */}
      <mesh position={[0, -0.3, 0]}><cylinderGeometry args={[r + 0.35, r + 0.5, 0.9, SIDES, 1, false, seg / 2]} /><meshLambertMaterial color={STONE} flatShading /></mesh>

      {/* the walls: plaster panels between timber posts, a timber band at the top */}
      {faces.map((a, i) => (
        <group key={i} rotation={[0, a, 0]}>
          <mesh position={[0, WALL_H / 2, apo]}><boxGeometry args={[side + 0.02, WALL_H, 0.35]} /><meshLambertMaterial color={i % 3 ? WALL : WALL_DARK} flatShading /></mesh>
          <mesh position={[0, WALL_H - 0.15, apo + 0.12]}><boxGeometry args={[side + 0.1, 0.3, 0.2]} /><meshLambertMaterial color={TIMBER} /></mesh>
          <mesh position={[0, 0.9, apo + 0.12]}><boxGeometry args={[side + 0.1, 0.22, 0.18]} /><meshLambertMaterial color={TIMBER_OLD} /></mesh>
          {/* a window on every other face but the door's */}
          {i !== 0 && i % 2 === 0 && (
            <group position={[0, 2.0, apo + 0.19]}>
              <mesh material={glass}><planeGeometry args={[1.0, 1.1]} /></mesh>
              <mesh position={[0, 0, 0.02]}><boxGeometry args={[1.2, 0.12, 0.06]} /><meshLambertMaterial color={TIMBER} /></mesh>
              <mesh position={[0, 0, 0.02]}><boxGeometry args={[0.1, 1.25, 0.06]} /><meshLambertMaterial color={TIMBER} /></mesh>
            </group>
          )}
        </group>
      ))}
      {faces.map((a, i) => (
        <mesh key={`p${i}`} position={[Math.sin(a + seg / 2) * r, WALL_H / 2, Math.cos(a + seg / 2) * r]}><boxGeometry args={[0.38, WALL_H + 0.1, 0.38]} /><meshLambertMaterial color={TIMBER} /></mesh>
      ))}

      {/* the door, its step and lintel, the sign above, and the guttering mana-lamp */}
      <group position={[0, 0, apo + 0.2]}>
        <mesh position={[0, 1.1, 0]}><planeGeometry args={[1.5, 2.2]} /><meshLambertMaterial color="#3d2a1b" /></mesh>
        <mesh position={[0, 2.3, 0.05]}><boxGeometry args={[2.0, 0.25, 0.25]} /><meshLambertMaterial color={TIMBER} /></mesh>
        <mesh position={[0, -0.1, 0.5]}><boxGeometry args={[2.2, 0.25, 1.0]} /><meshLambertMaterial color={STONE} flatShading /></mesh>
        <mesh position={[0, 3.0, 0.12]}><planeGeometry args={[3.0, 0.75]} /><meshBasicMaterial map={sign} toneMapped={false} /></mesh>
        <mesh position={[1.25, 2.0, 0.25]}><boxGeometry args={[0.24, 0.36, 0.24]} /><meshBasicMaterial ref={lamp} color="#bfe0ff" toneMapped={false} /></mesh>
        <pointLight ref={light} position={[1.25, 2.0, 0.9]} color="#ffc890" intensity={0} distance={12} decay={1.6} />
      </group>

      {/* the stem: up through the hall, flaring where it meets the cap */}
      <mesh position={[0, (capY - 0.4) / 2, stemZ]}><cylinderGeometry args={[stemR, stemR * 1.12, capY - 0.4, 14]} /><meshLambertMaterial color={STEM} /></mesh>
      <mesh position={[0, capY - 0.6, stemZ]}><cylinderGeometry args={[stemR * 1.7, stemR, 1.2, 14]} /><meshLambertMaterial color={STEM_DARK} /></mesh>
      {/* the roof between the wall top and the stem, under the cap: the hall's own low cone of boards */}
      <mesh position={[0, WALL_H + 0.55, 0]}><coneGeometry args={[r + 0.25, 1.3, SIDES, 1, true, seg / 2]} /><meshLambertMaterial color={TIMBER_OLD} side={THREE.DoubleSide} flatShading /></mesh>

      {/* the cap: a broad low dome, tipped a little where it has grown on one side, its gills black underneath */}
      <group position={[0, capY, stemZ]} rotation={[0.05, 0, -0.035]}>
        <mesh scale={[1, capH / capR, 1]}><sphereGeometry args={[capR, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshLambertMaterial color={CAP} /></mesh>
        <mesh position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[capR * 0.985, 0.32, 6, 40]} /><meshLambertMaterial color={CAP_RIM} /></mesh>
        <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[stemR, capR, 40]} /><meshLambertMaterial color={SOOT} side={THREE.DoubleSide} /></mesh>
        {Array.from({ length: 72 }, (_, i) => (
          <mesh key={i} geometry={gill} rotation={[0, (i / 72) * Math.PI * 2, 0]}><meshLambertMaterial color={i % 4 === 0 || Math.abs(i - 54) < 7 ? SOOT : GILL} side={THREE.DoubleSide} /></mesh>
        ))}
      </group>

      {/* the cook fire's chimney: stone, up the back wall, ending UNDER the cap (hence the soot) */}
      <mesh position={[0, (capY - 0.5 - 0.3) / 2 - 0.15, -apo - 0.45]}><boxGeometry args={[1.1, capY - 0.5 + 0.3, 1.1]} /><meshLambertMaterial color="#6f655a" flatShading /></mesh>
      <mesh position={[0, capY - 0.44, -apo - 0.45]}><boxGeometry args={[0.7, 0.12, 0.7]} /><meshBasicMaterial color={SOOT} /></mesh>

      {/* the small stable: a lean-to off the side wall, two stalls */}
      <group position={[-apo - 1.2, 0, -0.4]}>
        {[-1.9, 0, 1.9].map(zz => (
          <mesh key={zz} position={[-1.1, 1.2, zz]}><boxGeometry args={[0.22, 2.4, 0.22]} /><meshLambertMaterial color={TIMBER_OLD} /></mesh>
        ))}
        <mesh position={[0, 2.55, 0]} rotation={[0, 0, 0.32]}><boxGeometry args={[2.9, 0.12, 4.4]} /><meshLambertMaterial color={TIMBER} flatShading /></mesh>
        <mesh position={[-0.2, 0.55, 0]}><boxGeometry args={[0.12, 1.1, 3.8]} /><meshLambertMaterial color={TIMBER_OLD} /></mesh>
        <mesh position={[0.2, 0.05, 0]}><boxGeometry args={[1.8, 0.1, 3.9]} /><meshLambertMaterial color="#b89c5a" /></mesh>
      </group>
    </group>
  )
}
