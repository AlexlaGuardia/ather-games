'use client'
// ── THE CENTRE GREEN, DRESSED (BETA M208, Alex 11-26: "an established place") ───────────────────────────────
// Code-drawn, modest, nothing named: the gate grown as an arch out of two living trunks with a spiral of light in its ring
// (the LOCKED gate art, athernyx assets/concept-1672/glade/gate-LOCKED.png), the pale threshold stone in front of it where a
// keeper lands (plot.ts HOME_LANDING), a low kerb of stones round the gate's ground with gaps where the four paths come in,
// and four low lamp posts between the paths. No beds or houses: nobody settles on the Green (canon). Positions + walker
// boxes live in plot.ts (GATE_TRUNKS, GREEN_LAMPS); this draws them in the gate's own frame (x = side, z = face).
// Probe (checks): window.__green = { landing, trunks, lamps }.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GATE, GATE_FACE, GROUND_Y, HOME_LANDING, LANDING_OFF, GATE_TRUNKS, GATE_TRUNK_SIDE, GATE_TRUNK_BACK, GREEN_LAMPS, GREEN_LAMP_R } from './plot'
import { AXIS } from './green-landing'   // M208 s2: the other three quarters' landing spots

const BARK = '#6f4a2c', BARK_HI = '#8a5e37', LEAF = '#4f8a3a', LEAF_HI = '#67a148'
const STONE = '#cfc3a4', KERB = '#b9ab90', GLOW = '#ffe6a0'
/** The kerb's radius round the gate and the half-width (radians) of each gap a path comes in through. */
export const KERB_R = 11, KERB_GAP = 0.32
const KERB_N = 44

function kerbStones(): { a: number; s: number }[] {
  const out: { a: number; s: number }[] = []
  for (let k = 0; k < KERB_N; k++) {
    const a = (k / KERB_N) * Math.PI * 2
    const off = Math.min(...[0, 1, 2, 3, 4].map(q => Math.abs(a - (q * Math.PI) / 2)))
    if (off < KERB_GAP) continue
    out.push({ a, s: 0.8 + ((k * 37) % 7) / 18 })
  }
  return out
}

function spiralGeo(): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = []
  const turns = 2.6, n = 90
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * Math.PI * 2, r = 0.12 + t * 1.85
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.055, 5, false)
}

function Trunk({ dir }: { dir: 1 | -1 }) {
  // leans in toward the ring; its crown meets the other trunk's over the arch
  return (
    <group position={[dir * GATE_TRUNK_SIDE, 0.4, GATE_TRUNK_BACK]}>
      <mesh position-y={0.25}><coneGeometry args={[0.95, 0.7, 7]} /><meshLambertMaterial color={BARK} flatShading /></mesh>
      <mesh position={[-dir * 0.12, 2.3, 0.25]} rotation={[0.12, 0, dir * 0.1]}><cylinderGeometry args={[0.26, 0.45, 4.6, 7]} /><meshLambertMaterial color={BARK_HI} flatShading /></mesh>
      <mesh position={[-dir * 0.75, 4.6, 0.5]} rotation-z={dir * 0.9}><cylinderGeometry args={[0.14, 0.24, 2.0, 6]} /><meshLambertMaterial color={BARK} flatShading /></mesh>
      <mesh position={[dir * 0.35, 5.9, 0]}><icosahedronGeometry args={[1.7, 0]} /><meshLambertMaterial color={LEAF} flatShading /></mesh>
      <mesh position={[dir * 1.2, 5.2, -0.6]}><icosahedronGeometry args={[1.15, 0]} /><meshLambertMaterial color={LEAF_HI} flatShading /></mesh>
    </group>
  )
}

export function GreenDressing() {
  useEffect(() => {
    const w = window as unknown as { __green?: unknown }
    w.__green = { landing: { x: HOME_LANDING.x, z: HOME_LANDING.z, yaw: HOME_LANDING.yaw }, gate: GATE, trunks: GATE_TRUNKS.length, lamps: GREEN_LAMPS.length }
    return () => { delete w.__green }
  }, [])
  const spiral = useMemo(spiralGeo, [])
  useEffect(() => () => spiral.dispose(), [spiral])
  const stones = useMemo(kerbStones, [])
  const turn = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => { if (turn.current) turn.current.rotation.z -= dt * 0.35 })
  const lamps = [45, 135, 225, 315].map(a => (a * Math.PI) / 180)
  return (
    <group position={[GATE.x, GROUND_Y - 0.4, GATE.z]} rotation-y={GATE_FACE} userData={{ green: true }}>
      <Trunk dir={-1} />
      <Trunk dir={1} />
      {/* the fused crown over the ring */}
      <mesh position={[0, 6.7, GATE_TRUNK_BACK + 0.2]}><icosahedronGeometry args={[1.5, 0]} /><meshLambertMaterial color={LEAF_HI} flatShading /></mesh>
      {/* the spiral of light in the ring (the ring + its pale face are FoldGate's, plot-scene.tsx) */}
      <mesh ref={turn} geometry={spiral} position={[0, 3.4, 0.04]}><meshBasicMaterial color="#fff3c2" transparent opacity={0.85} /></mesh>
      {/* the threshold stone a keeper lands on */}
      <mesh position={[0, 0.43, LANDING_OFF]}><cylinderGeometry args={[1.9, 2.0, 0.1, 20]} /><meshLambertMaterial color={STONE} flatShading /></mesh>
      {/* M208 s2: a smaller pale stone where each of the other three quarters' keepers lands (a guest from that side) */}
      {(['nw', 'sw', 'se'] as const).map(q => <mesh key={q} position={[AXIS[q][0], 0.43, AXIS[q][1]]}><cylinderGeometry args={[1.1, 1.2, 0.1, 16]} /><meshLambertMaterial color={STONE} flatShading /></mesh>)}
      {/* the kerb round the gate's ground, open where the paths come in */}
      {stones.map(({ a, s }, k) => (
        <mesh key={k} position={[Math.cos(a) * KERB_R, 0.45, Math.sin(a) * KERB_R]} rotation-y={a * 3.1} scale={[s, 0.45, s]}>
          <dodecahedronGeometry args={[0.38, 0]} /><meshLambertMaterial color={KERB} flatShading />
        </mesh>
      ))}
      {/* four low lamp posts between the paths */}
      {lamps.map((r, k) => (
        <group key={k} position={[Math.cos(r) * GREEN_LAMP_R, 0.4, Math.sin(r) * GREEN_LAMP_R]}>
          <mesh position-y={0.1}><cylinderGeometry args={[0.28, 0.34, 0.2, 7]} /><meshLambertMaterial color={KERB} flatShading /></mesh>
          <mesh position-y={0.75}><cylinderGeometry args={[0.08, 0.11, 1.2, 6]} /><meshLambertMaterial color={BARK} flatShading /></mesh>
          <mesh position-y={1.45}><icosahedronGeometry args={[0.2, 0]} /><meshBasicMaterial color={GLOW} /></mesh>
        </group>
      ))}
    </group>
  )
}
