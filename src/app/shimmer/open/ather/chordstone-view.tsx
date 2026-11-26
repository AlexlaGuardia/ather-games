'use client'
// ── THE CHORDSTONE, DRAWN (BETA M188 s2) ───────────────────────────────────────────────────────────────────────────────
// Code-drawn Blankstone: a faceted pedestal beside the Green's gate, joined to the gate's plinth by a low grown root (one
// piece with it, canon). On its top, one light per keeper rung into this keeper's chord, in their chord colour
// (chordstone.ts chordLights); nobody in a chord = a dark, pale top. Looks only: E + the walker's box are page.tsx / plot.ts.
// Probe (checks): window.__chordstone = { lights: [colour], names: [name] }.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GATE, GATE_FACE, GROUND_Y } from './plot'
import { CHORDSTONE_OFF, CHORDSTONE_H, chordLights, lightSpot } from './chordstone'
import { useChordBox } from '../shared/chord'

const STONE = '#b9ab90'      // the gate's plinth: the same stone, one piece
const STONE_HI = '#cdc1a6'
const TOP_DARK = '#8f866f'

export function Chordstone() {
  const { members, me, code } = useChordBox()
  const lights = chordLights(members, me, !!code)
  const key = lights.map(l => l.colour + l.id).join('|')
  useEffect(() => {
    const w = window as unknown as { __chordstone?: unknown }
    w.__chordstone = { lights: lights.map(l => l.colour), names: lights.map(l => l.name), ids: lights.map(l => l.id) }
    return () => { delete w.__chordstone }
  }, [key])   // eslint-disable-line react-hooks/exhaustive-deps
  const glow = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = glow.current; if (!g) return
    const t = clock.elapsedTime
    g.children.forEach((c, i) => { c.position.y = 0.1 + Math.sin(t * 1.6 + i * 1.1) * 0.025 })
  })
  const top = CHORDSTONE_H
  return (
    <group position={[GATE.x, GROUND_Y - 0.4, GATE.z]} rotation-y={GATE_FACE} userData={{ chordstone: true }}>
      {/* the grown root: out of the gate's plinth, along its side, into the stone's foot */}
      <mesh position={[CHORDSTONE_OFF / 2 + 0.4, 0.3, 0]}><boxGeometry args={[CHORDSTONE_OFF - 0.6, 0.5, 0.9]} /><meshLambertMaterial color={STONE} flatShading /></mesh>
      <group position={[CHORDSTONE_OFF, 0.4, 0]}>
        <mesh position-y={0.15}><cylinderGeometry args={[0.62, 0.78, 0.3, 7]} /><meshLambertMaterial color={STONE} flatShading /></mesh>
        <mesh position-y={0.68}><cylinderGeometry args={[0.36, 0.48, 0.8, 7]} /><meshLambertMaterial color={STONE_HI} flatShading /></mesh>
        <mesh position-y={top - 0.1}><cylinderGeometry args={[0.6, 0.42, 0.2, 7]} /><meshLambertMaterial color={STONE} flatShading /></mesh>
        <mesh position-y={top + 0.005} rotation-x={-Math.PI / 2}><circleGeometry args={[0.5, 7]} /><meshLambertMaterial color={TOP_DARK} /></mesh>
        <group ref={glow} position-y={top}>
          {lights.map((l, k) => {
            const s = lightSpot(k, lights.length)
            return (
              <group key={l.id} position={[s.x, 0.1, s.z]}>
                <mesh><sphereGeometry args={[0.085, 10, 8]} /><meshBasicMaterial color={l.colour} /></mesh>
                <mesh><sphereGeometry args={[0.16, 10, 8]} /><meshBasicMaterial color={l.colour} transparent opacity={0.3} depthWrite={false} /></mesh>
              </group>
            )
          })}
        </group>
        {lights.length > 0 && <pointLight position-y={top + 0.4} color={lights[0].colour} intensity={2.5} distance={7} />}
      </group>
    </group>
  )
}
