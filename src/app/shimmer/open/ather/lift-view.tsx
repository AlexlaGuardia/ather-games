// The lift in the world (BETA M48 slice 1): a plain shaft frame (wood posts, a platform car, a stone counterweight box) and one
// pull-cord per floor hung on the car's panel, IN THE WORLD (no overlay, no menu). Aim the crosshair at a cord and click (tap on a
// phone) to ride there. Look = plain default (wood posts, pale stone weight, a stone bead on each cord); Alex's call.
'use client'
import React, { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Piece } from './rooms'
import { GROUND_Y } from './plot'
import { STOREY } from './plot-floors'
import { liveLift, carBase, carLevel, liftLevels, cordsOf, cordAimed, rideNow, CORD_LOW, CORD_HIGH, PANEL_Z } from './lift'
import { useWorks } from './workshop'

const WOOD = '#d9a957', DARK = '#6b4a2a', STONE = '#bdb6a6', CORD = '#c9b27a', BEAD = '#8a8478', BEAD_HERE = '#efe6c8'
const Bx = ({ p, s, c }: { p: [number, number, number]; s: [number, number, number]; c: string }) => <mesh position={p}><boxGeometry args={s} /><meshLambertMaterial color={c} /></mesh>

/** posts up the whole shaft (the top of the highest level), the car on its cords, and the stone weight beside it */
export function LiftMesh({ p }: { p: Piece }) {
  const w = useWorks(), n = liftLevels(w, p), car = useRef<THREE.Group>(null), weight = useRef<THREE.Mesh>(null)   // the floors its shaft reaches
  const top = GROUND_Y + (n - 1) * STOREY + 3.2
  useFrame(() => {
    const y = liveLift.ys.get(p.id) ?? carBase(GROUND_Y, carLevel(w, p)), span = (n - 1) * STOREY
    car.current?.position.set(0, y - GROUND_Y, 0)
    // the weight runs the other way: down as the car goes up
    weight.current?.position.set(0.36, GROUND_Y + 0.5 + (span - (y - GROUND_Y)), 0.36)
  })
  const h = top - GROUND_Y
  return (
    <group position={[p.x, GROUND_Y, p.z]} rotation-y={-p.q * Math.PI / 2}>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], k) => <Bx key={k} p={[a * 0.47, h / 2, b * 0.47]} s={[0.07, h, 0.07]} c={WOOD} />)}
      <Bx p={[0, h - 0.03, 0.47]} s={[1, 0.06, 0.07]} c={DARK} /><Bx p={[0, h - 0.03, -0.47]} s={[1, 0.06, 0.07]} c={DARK} />
      {/* the plank cap: the shaft ends here, under the top floor's ceiling (the roof stays closed over it) */}
      <Bx p={[0, h - 0.1, 0]} s={[1.0, 0.06, 1.0]} c={WOOD} />
      <group ref={car}>
        <Bx p={[0, -0.1, 0]} s={[0.94, 0.2, 0.94]} c={WOOD} />
        <Bx p={[0, 1.3, 0.47]} s={[0.94, 0.05, 0.05]} c={DARK} />
        <Bx p={[0, 1.7, PANEL_Z]} s={[0.84, 1.1, 0.04]} c={DARK} />
        {[0, 1].map(s => <Bx key={s} p={[s ? 0.43 : -0.43, 1.0, 0]} s={[0.03, 2.0, 0.03]} c={CORD} />)}
        <CordsOnCar p={p} />
      </group>
      <mesh ref={weight} position={[0.36, 0.5, 0.36]}><boxGeometry args={[0.22, 0.32, 0.22]} /><meshLambertMaterial color={STONE} /></mesh>
    </group>
  )
}
/** one pull-cord per floor on the car's panel: a cord and a stone bead; the floor the car is at has the pale bead */
function CordsOnCar({ p }: { p: Piece }) {
  const w = useWorks(), n = liftLevels(w, p), here = carLevel(w, p)
  return <>{Array.from({ length: n }, (_, k) => {
    const x = (k - (n - 1) / 2) * 0.26, len = CORD_HIGH - CORD_LOW + 0.3
    return <group key={k} position={[x, 0, PANEL_Z - 0.04]}>
      <Bx p={[0, CORD_HIGH - len / 2 + 0.05, 0]} s={[0.025, len, 0.025]} c={CORD} />
      <mesh position={[0, CORD_LOW - 0.06, 0]}><sphereGeometry args={[0.07, 8, 6]} /><meshLambertMaterial color={k === here ? BEAD_HERE : BEAD} /></mesh>
    </group>
  })}</>
}

/** Click (tap) on a cord: the ray through the crosshair (pointer-locked) or the tapped point rides the car there. */
export function LiftInput() {
  const { camera, gl } = useThree()
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || !(e.target instanceof HTMLCanvasElement) || document.querySelector('[data-panel]')) return
      const w = liveLift.get?.(); if (!w) return
      const r = gl.domElement.getBoundingClientRect(), locked = !!document.pointerLockElement
      const ndc = new THREE.Vector2(locked ? 0 : ((e.clientX - r.left) / r.width) * 2 - 1, locked ? 0 : -(((e.clientY - r.top) / r.height) * 2 - 1))
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera)
      const o = ray.ray.origin, d = ray.ray.direction
      for (const p of w.pieces) {
        if (p.item !== 'lift') continue
        const k = cordAimed(p, liveLift.ys.get(p.id) ?? carBase(GROUND_Y, carLevel(w, p)), liftLevels(w, p), [o.x, o.y, o.z], [d.x, d.y, d.z])
        if (k != null && rideNow(p.id)(k)) return
      }
    }
    window.addEventListener('pointerdown', down)
    return () => window.removeEventListener('pointerdown', down)
  }, [camera, gl])
  return null
}
