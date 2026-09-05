'use client'

/**
 * THE MOGLIN AS A POSABLE CLAY DOLL — rigid parts on a joint hierarchy, no skin, no bones.
 *
 * ★★★ WHAT THIS IS AND IS NOT (2026-09-04, sprites lane). This is the prototype behind the answer
 * to Alex's question about clay-doll character models and rigging: for this look the rigging step
 * does not exist. There is no armature, no vertex weight, no `SkinnedMesh`, no GLB and no Blender
 * anywhere in this file. A part is a mesh, a joint is a `<group>`, and posing is setting rotations
 * on those groups. That is how a physical puppet works and it is why claymation looks the way it
 * does.
 *
 * ⚠ THIS IS NOT THE SHIPPED MOGLIN AND MUST NOT BE MISTAKEN FOR IT. The moglin in
 * `Shimmer3D.tsx:561-565` is a capsule, a head, two ears and a collar, with NO limbs and no joints
 * — it slides and turns and nothing on it articulates. This file adds arms and legs, which is new
 * geometry and a look decision that is Alex's to make. The colours are IMPORTED from Shimmer3D
 * rather than retyped, so what the bench shows cannot drift away from the game's own fur.
 * PATTERNS 2026-08-22: a hand-kept copy reads as corroboration.
 *
 * ── THE HIERARCHY IS THE RIG ──────────────────────────────────────────────────────────────────
 *   root ── hips ── torso ── head ── ears
 *                        └─ shoulder ── elbow          (rotating the shoulder carries the forearm)
 *                └─ hip joint ── knee                  (rotating the hip carries the shin)
 * Every joint group sits AT the pivot with its mesh hung BELOW it. That is the one detail people
 * get wrong when they try this: put the mesh at the group origin and the limb rotates about its
 * own middle, which reads as a part shearing rather than as a joint bending.
 *
 * ── WHY `useFrame` AND REFS, NOT STATE ────────────────────────────────────────────────────────
 * Posing writes straight to `Object3D.rotation` every frame. Driving it through React state would
 * re-render the tree twelve times a second to move eight numbers, which is a real cost on Alex's
 * UHD 630 for no benefit (`reference_alex_desktop_gpu`: upload and shader compile already stall
 * the main thread there).
 *
 * Bench: `tools/devwin.sh sprites` → /shimmer/dev/clay
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MOGLIN_FUR, MOGLIN_FUR_LIGHT, GATE_COLORS } from './moglin-look'
import { walkPose, stepTime, STEP_FPS, type MoglinPose } from './moglin-pose'

/**
 * Proportions, in blocks, all measured off the shipped body so the doll is the same creature.
 * The four the game already draws are named as such; the limbs are new and are the thing Alex is
 * being asked to judge.
 */
const P = {
  bodyR: 0.24, bodyH: 0.3, bodyY: 0.44,   // shipped: the capsule torso
  headR: 0.22, headY: 0.86,               // shipped: the head
  earR: 0.08, earX: 0.13, earY: 0.18,     // shipped: ears (earY is now relative to the head)
  collarR: 0.17, collarT: 0.045, collarY: 0.68,
  // NEW — a doll needs limbs to be posable at all.
  shoulderX: 0.235, shoulderY: 0.60,
  upperArm: 0.20, foreArm: 0.17, armR: 0.062,
  hipX: 0.115, hipY: 0.30,
  thigh: 0.16, shin: 0.15, legR: 0.072,
} as const

export interface MoglinDollProps {
  /** 0 = standing (breathing only). 1 = patrol pace. */
  speed?: number
  /** Pose frames per second. `0` renders smooth — the toggle that shows what stepping buys. */
  fps?: number
  /** false freezes the doll in its rest pose, for a static/posed comparison. */
  posed?: boolean
  /** false hides arms and legs, leaving roughly the silhouette the game ships today. */
  limbs?: boolean
  gate?: keyof typeof GATE_COLORS
  /** Matte clay, or the roughness the game currently uses. */
  clay?: boolean
}

export function MoglinDoll({
  speed = 1, fps = STEP_FPS, posed = true, limbs = true, gate = 'thistle', clay = true,
}: MoglinDollProps) {
  const hips = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const earL = useRef<THREE.Group>(null)
  const earR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const kneeL = useRef<THREE.Group>(null)
  const kneeR = useRef<THREE.Group>(null)

  useFrame((state) => {
    // ⚠ ONE stepped clock feeds every joint. Stepping each output separately would let parts land
    // on different frames and slide against each other — see the module header.
    const t = posed ? stepTime(state.clock.elapsedTime, fps) : 0
    const p: MoglinPose = walkPose(t, posed ? speed : 0)

    if (hips.current) { hips.current.position.y = p.hipY; hips.current.rotation.z = p.hipRoll }
    if (torso.current) torso.current.rotation.x = p.torsoPitch
    if (head.current) { head.current.rotation.x = p.headPitch; head.current.rotation.y = p.headYaw }
    // Ears flop about Z (sideways), which is what a soft hung part does. Mirrored, so they splay.
    if (earL.current) earL.current.rotation.z = p.earL
    if (earR.current) earR.current.rotation.z = -p.earR
    if (armL.current) armL.current.rotation.x = p.armL
    if (armR.current) armR.current.rotation.x = p.armR
    // The elbow trails the shoulder and only ever folds one way, like the knee.
    if (kneeL.current) kneeL.current.rotation.x = p.kneeL
    if (kneeR.current) kneeR.current.rotation.x = p.kneeR
    if (legL.current) legL.current.rotation.x = p.legL
    if (legR.current) legR.current.rotation.x = p.legR
  })

  // Clay is a MATERIAL argument, not a model one: fully rough, zero metalness, no flat shading.
  const fur = (light = false) => (
    <meshStandardMaterial
      color={light ? MOGLIN_FUR_LIGHT : MOGLIN_FUR}
      roughness={clay ? 1 : 0.95}
      metalness={0}
    />
  )
  const col = GATE_COLORS[gate]

  /** One limb: a joint group at the pivot, the segment hung below it, a child joint at its end. */
  const segment = (len: number, r: number, light = false) => (
    <mesh position={[0, -len / 2, 0]} castShadow>
      <capsuleGeometry args={[r, len, 4, 10]} />
      {fur(light)}
    </mesh>
  )

  return (
    <group>
      <group ref={hips}>
        {limbs && (
          <>
            <group ref={legL} position={[-P.hipX, P.hipY, 0]}>
              {segment(P.thigh, P.legR)}
              <group ref={kneeL} position={[0, -P.thigh, 0]}>{segment(P.shin, P.legR * 0.92)}</group>
            </group>
            <group ref={legR} position={[P.hipX, P.hipY, 0]}>
              {segment(P.thigh, P.legR)}
              <group ref={kneeR} position={[0, -P.thigh, 0]}>{segment(P.shin, P.legR * 0.92)}</group>
            </group>
          </>
        )}

        <group ref={torso} position={[0, P.hipY, 0]}>
          {/* shipped body, re-anchored so the torso pivots at the hip rather than at the world floor */}
          <mesh position={[0, P.bodyY - P.hipY, 0]} castShadow>
            <capsuleGeometry args={[P.bodyR, P.bodyH, 6, 12]} />
            {fur()}
          </mesh>
          {/* the COLLAR is the hostile part (canon) — it stays lit and hard against the matte fur */}
          <mesh position={[0, P.collarY - P.hipY, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[P.collarR, P.collarT, 8, 20]} />
            <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.55} roughness={0.4} />
          </mesh>

          {limbs && (
            <>
              <group ref={armL} position={[-P.shoulderX, P.shoulderY - P.hipY, 0]}>
                {segment(P.upperArm, P.armR)}
                <group position={[0, -P.upperArm, 0]}>{segment(P.foreArm, P.armR * 0.9)}</group>
              </group>
              <group ref={armR} position={[P.shoulderX, P.shoulderY - P.hipY, 0]}>
                {segment(P.upperArm, P.armR)}
                <group position={[0, -P.upperArm, 0]}>{segment(P.foreArm, P.armR * 0.9)}</group>
              </group>
            </>
          )}

          <group ref={head} position={[0, P.headY - P.hipY, 0]}>
            <mesh castShadow><sphereGeometry args={[P.headR, 14, 14]} />{fur(true)}</mesh>
            <group ref={earL} position={[-P.earX, P.earY * 0.5, 0]}>
              <mesh position={[0, P.earR, 0]}><sphereGeometry args={[P.earR, 10, 10]} />{fur()}</mesh>
            </group>
            <group ref={earR} position={[P.earX, P.earY * 0.5, 0]}>
              <mesh position={[0, P.earR, 0]}><sphereGeometry args={[P.earR, 10, 10]} />{fur()}</mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
