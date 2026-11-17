'use client'
// The keeper's body: rigid parts on a joint hierarchy, posed every frame by keeper-pose.ts. No skinned mesh.
// `limbs={false}` is the RAYMAN look under test: the same hierarchy, the upper/lower arm and leg parts not drawn, so the
// gloves and boots float exactly where the chain carries them (Alex 11-17: "side by side ... we'll get a better idea").
//
// PLACEHOLDER CRAFT, judged by Alex. Canon it already respects (design-briefs/keepers.md + shimmer-casting-vessels.md):
// keepers are Alkin, working people coded by craft; the RIGHT hand is the glove with one dim crystal seat; the LEFT wrist
// wears the bracelet; no metal anywhere; no skin shown (skin + species are hero art), so the face sits in a hood's shadow.
import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { poseKeeper, stepTime, BODY, type KeeperAction, type KeeperPose, type Limb } from './keeper-pose'

const C = {
  tunic: '#5d6b47', trousers: '#4a3f33', hood: '#6b5a3e', shadow: '#17130f', cuff: '#b9a582', cord: '#7a5a35',
  glove: '#6e4a2c', boot: '#3b2c20', seat: '#7fb6d9', bracelet: '#8a6a3c', blade: '#9c7a4c', horn: '#d8ccb0', gun: '#4b3a2a',
}
const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra })

interface Refs {
  hips: THREE.Group; torso: THREE.Group; head: THREE.Group
  sL: THREE.Group; eL: THREE.Group; sR: THREE.Group; eR: THREE.Group
  hL: THREE.Group; kL: THREE.Group; hR: THREE.Group; kR: THREE.Group
  seat: THREE.MeshStandardMaterial; blade: THREE.Group; gun: THREE.Group
}

function setLimb(top: THREE.Group, mid: THREE.Group, l: Limb) { top.rotation.set(l.pitch, 0, l.roll); mid.rotation.set(l.bend, 0, 0) }
function apply(r: Refs, p: KeeperPose) {
  r.hips.position.y = BODY.hipY + p.hipY
  r.hips.rotation.set(0, 0, p.hipRoll)
  r.torso.rotation.set(p.torsoPitch, p.torsoYaw, 0)
  r.head.rotation.set(p.headPitch, -p.torsoYaw * 0.5, 0)
  setLimb(r.sL, r.eL, p.armL); setLimb(r.sR, r.eR, p.armR)
  setLimb(r.hL, r.kL, p.legL); setLimb(r.hR, r.kR, p.legR)
  r.seat.emissiveIntensity = 0.2 + 1.6 * p.seat
  r.blade.visible = p.held === 'blade'; r.gun.visible = p.held === 'gun'
}

/** One keeper. `fps` steps the clock (0 = smooth); `phase` offsets it so two dolls never move in lockstep by accident. */
/** What the game feeds a doll every frame (no React state: a ref the walker writes in its tick). Feet at y. */
export interface DollDrive { action: KeeperAction; rate: number; x: number; y: number; z: number; yaw: number; visible: boolean }

export function KeeperDoll({ action, limbs = true, fps = 0, speed = 1, phase = 0, drive }: { action: KeeperAction; limbs?: boolean; fps?: number; speed?: number; phase?: number; drive?: React.MutableRefObject<DollDrive> }) {
  const r = useRef<Partial<Refs>>({})
  const root = useRef<THREE.Group>(null)
  const t = useRef(phase)
  const seatMat = useRef(mat(C.seat, { emissive: new THREE.Color(C.seat), emissiveIntensity: 0.4, roughness: 0.3 }))
  r.current.seat = seatMat.current
  useFrame((_, dt) => {
    const d = drive?.current
    t.current += Math.min(dt, 0.1) * (d ? d.rate : speed)
    if (d && root.current) { root.current.visible = d.visible; root.current.position.set(d.x, d.y, d.z); root.current.rotation.set(0, d.yaw, 0) }
    if (d && !d.visible) return
    const R = r.current as Refs
    if (R.hips && R.kR) apply(R, poseKeeper(d ? d.action : action, stepTime(t.current, fps)))
  })
  const g = (k: keyof Refs) => (o: THREE.Group | null) => { if (o) (r.current as Record<string, unknown>)[k] = o }
  const limb = (len: number, rad: number, color: string) => limbs
    ? <mesh position={[0, -len / 2, 0]} castShadow><capsuleGeometry args={[rad, Math.max(0.01, len - rad * 2), 4, 10]} /><primitive object={mat(color)} attach="material" /></mesh>
    : null

  const arm = (side: 1 | -1) => {
    const right = side === -1
    return (
      <group ref={g(right ? 'sR' : 'sL')} position={[side * BODY.shoulderHalf, BODY.torso - 0.06, 0]}>
        {limb(BODY.upperArm, 0.055, C.tunic)}
        <group ref={g(right ? 'eR' : 'eL')} position={[0, -BODY.upperArm, 0]}>
          {limb(BODY.forearm, 0.048, C.tunic)}
          <group position={[0, -BODY.forearm, 0]}>
            {/* the cuff: cord-whipped cloth, never a buckle */}
            <mesh position={[0, 0.03, 0]} castShadow><cylinderGeometry args={[0.058, 0.055, 0.07, 10]} /><primitive object={mat(C.cuff)} attach="material" /></mesh>
            <mesh position={[0, 0.045, 0]}><torusGeometry args={[0.059, 0.008, 6, 14]} /><primitive object={mat(C.cord)} attach="material" /></mesh>
            {/* the hand: a mitt and a thumb */}
            <mesh position={[0, -0.06, 0.005]} castShadow><boxGeometry args={[0.09, 0.11, 0.05]} /><primitive object={mat(C.glove)} attach="material" /></mesh>
            <mesh position={[side * -0.05, -0.04, 0.02]} rotation={[0, 0, side * 0.5]} castShadow><capsuleGeometry args={[0.016, 0.04, 3, 6]} /><primitive object={mat(C.glove)} attach="material" /></mesh>
            {right && <mesh position={[0, -0.05, -0.03]}><icosahedronGeometry args={[0.018, 0]} /><primitive object={seatMat.current} attach="material" /></mesh>}
            {!right && <mesh position={[0, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.06, 0.012, 6, 16]} /><primitive object={mat(C.bracelet)} attach="material" /></mesh>}
            {right && (
              <>
                <group ref={g('blade')} position={[0, -0.08, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
                  <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.015, 0.018, 0.16, 6]} /><primitive object={mat(C.horn)} attach="material" /></mesh>
                  <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.035, 0.22, 0.012]} /><primitive object={mat(C.blade)} attach="material" /></mesh>
                </group>
                <group ref={g('gun')} position={[0, -0.06, 0]}>
                  {/* barrel along the arm (local -y = where the hand points); grip toward local -z (world down when aimed) */}
                  <mesh position={[0, -0.09, -0.04]}><boxGeometry args={[0.04, 0.22, 0.05]} /><primitive object={mat(C.gun)} attach="material" /></mesh>
                  <mesh position={[0, 0.0, -0.1]}><boxGeometry args={[0.035, 0.05, 0.09]} /><primitive object={mat(C.gun)} attach="material" /></mesh>
                </group>
              </>
            )}
          </group>
        </group>
      </group>
    )
  }
  const leg = (side: 1 | -1) => (
    <group ref={g(side === 1 ? 'hL' : 'hR')} position={[side * BODY.hipHalf, 0, 0]}>
      {limb(BODY.thigh, 0.075, C.trousers)}
      <group ref={g(side === 1 ? 'kL' : 'kR')} position={[0, -BODY.thigh, 0]}>
        {limb(BODY.shin, 0.062, C.trousers)}
        <group position={[0, -BODY.shin, 0]}>
          <mesh position={[0, -0.03, 0.045]} castShadow><boxGeometry args={[0.11, 0.09, 0.22]} /><primitive object={mat(C.boot)} attach="material" /></mesh>
          <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.068, 0.06, 0.08, 10]} /><primitive object={mat(C.boot)} attach="material" /></mesh>
        </group>
      </group>
    </group>
  )
  return (
    <group ref={root}>
    <group ref={g('hips')} position={[0, BODY.hipY, 0]}>
      {limbs && <mesh position={[0, 0.02, 0]} castShadow><boxGeometry args={[0.3, 0.14, 0.18]} /><primitive object={mat(C.trousers)} attach="material" /></mesh>}
      {leg(1)}{leg(-1)}
      <group ref={g('torso')}>
        {/* the tunic: shoulders a touch wider than the waist; a belt of cord */}
        <mesh position={[0, BODY.torso / 2 + 0.02, 0]} castShadow><cylinderGeometry args={[0.2, 0.16, BODY.torso - 0.02, 12]} /><primitive object={mat(C.tunic)} attach="material" /></mesh>
        <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.165, 0.014, 6, 18]} /><primitive object={mat(C.cord)} attach="material" /></mesh>
        <group ref={g('head')} position={[0, BODY.torso + BODY.headY - 0.04, 0]}>
          {/* hood + the shadow where a face would be: no skin, no species (hero art is Alex's) */}
          <mesh castShadow><sphereGeometry args={[0.135, 16, 12]} /><primitive object={mat(C.hood)} attach="material" /></mesh>
          <mesh position={[0, -0.015, 0.1]} scale={[1, 1.2, 0.5]}><sphereGeometry args={[0.088, 14, 10]} /><primitive object={mat(C.shadow, { roughness: 1 })} attach="material" /></mesh>
          <mesh position={[0, -0.13, 0]}><cylinderGeometry args={[0.13, 0.17, 0.08, 12]} /><primitive object={mat(C.hood)} attach="material" /></mesh>
        </group>
        {arm(1)}{arm(-1)}
      </group>
    </group>
    </group>
  )
}
