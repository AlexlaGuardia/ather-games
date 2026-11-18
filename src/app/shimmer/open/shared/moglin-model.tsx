'use client'
// THE MOGLIN, MODELLED (2026-11-18, play / Jin 30bbef32; Alex: "lets test some moglin models"). Code-drawn, rigid parts on
// a joint hierarchy posed by a function of time (the Clay Bench's way: no armature, no skinned mesh, no GLB).
//
// Canon (design-briefs/moglins.md, 🔒 BASE LOCKED 06-24; ref assets/folk-refs/moglin-canon.png, jimbo-canon.png):
// child-sized soft folk ABOUT 3 FEET TALL, teddy-bear-soft; fur, whiskers, paws, rounded ears, burrowers; BIG ROUND DARK
// EYES, short whiskered muzzle, small paws held close, SHY-CONTENT (never sad); drab-but-warm earth tones, NEVER grey;
// NO METAL on a free Moglin (metal means a hold). The ref adds: a big round head (near half the height), large ears with
// pink insides, a cream face mask and belly, a pink button nose, blush, stubby legs, paws together at the chest.
// Sub-types differ by bearing / garb / scale, never species: so garb is a prop toggle here, the body is one creature.
//
// ⚠ PLACEHOLDER CRAFT, FOR A LOOK DECISION (Alex's): two builds on one rig (plush = the ref's proportions; chibi = a
// bigger head that reads at Wilds distance). The fur tones are the brief's own list. Nothing here is wired to the game.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export type MoglinBuild = 'plush' | 'chibi'
export type MoglinAction = 'idle' | 'waddle' | 'work' | 'wave' | 'shy'
export const MOGLIN_ACTIONS: readonly MoglinAction[] = ['idle', 'waddle', 'work', 'wave', 'shy']
export type MoglinGarb = 'none' | 'apron' | 'satchel' | 'toolbelt' | 'scarf'
export const MOGLIN_GARBS: readonly { id: MoglinGarb; label: string; note: string }[] = [
  { id: 'none', label: 'Bare', note: 'the creature itself' },
  { id: 'apron', label: 'Cook', note: 'a linen apron' },
  { id: 'satchel', label: 'Traveller', note: "Jimbo's satchel + staff" },
  { id: 'toolbelt', label: 'Carpenter', note: 'a leather tool belt, wood tools, no metal' },
  { id: 'scarf', label: 'Alchemist', note: 'a moss scarf + a stoppered vial' },
]
/** The brief's palette: "moss-brown, dun, clay-tan, dust-fawn" + the ref's honey-tan. Never grey. */
export const FUR_TONES: readonly { id: string; label: string; fur: string; light: string }[] = [
  { id: 'honey', label: 'Honey-tan (ref)', fur: '#d9a35c', light: '#f3e2bf' },
  { id: 'fawn', label: 'Dust-fawn', fur: '#c9a77e', light: '#efe1c8' },
  { id: 'clay', label: 'Clay-tan', fur: '#b97f55', light: '#ecd2b4' },
  { id: 'dun', label: 'Dun', fur: '#a08a68', light: '#e4d8c0' },
  { id: 'moss', label: 'Moss-brown', fur: '#7d6a45', light: '#ddd1b0' },
]

/** Proportions per build (metres; a Moglin is ~0.91 m, the keeper ~1.8). */
const BUILD = {
  plush: { hip: 0.17, torsoY: 0.33, torsoR: 0.2, headPivot: 0.52, headR: 0.2, earS: 1, legL: 0.12, armL: 0.13, s: 1 },
  chibi: { hip: 0.13, torsoY: 0.26, torsoR: 0.16, headPivot: 0.41, headR: 0.26, earS: 1.15, legL: 0.08, armL: 0.1, s: 1 },
} as const

const PINK = '#f0a3a0', EAR_IN = '#ee9a92', EYE = '#1d1410', NOSE = '#e98282', WHISKER = '#3a2a20'
const TAU = Math.PI * 2

export function MoglinModel({ build = 'plush', action = 'idle', garb = 'none', tone = FUR_TONES[0], speed = 1, seed = 0 }: {
  build?: MoglinBuild; action?: MoglinAction; garb?: MoglinGarb; tone?: (typeof FUR_TONES)[number]; speed?: number; seed?: number
}) {
  const B = BUILD[build]
  const body = useRef<THREE.Group>(null), head = useRef<THREE.Group>(null)
  const earL = useRef<THREE.Group>(null), earR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null), armR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null), legR = useRef<THREE.Group>(null)
  const eyes = useRef<THREE.Group>(null)
  const t0 = useRef(seed * 1.7)
  useFrame((_, dt) => {
    const t = (t0.current += Math.min(0.05, dt) * speed)
    const breathe = Math.sin(t * 2.1) * 0.012
    let roll = 0, bob = breathe, headPitch = 0, headRoll = 0, earDroop = 0
    // arms: [pitch (forward +), roll (out +)] ; default = paws together at the chest (the ref's pose)
    let aL: [number, number] = [-1.15, -0.55], aR: [number, number] = [-1.15, 0.55], lL = 0, lR = 0
    if (action === 'idle') {
      headRoll = Math.sin(t * 0.7) * 0.05
      earDroop = Math.max(0, Math.sin(t * 0.9 + 2) - 0.92) * 3   // a flick now and then
    } else if (action === 'waddle') {
      const ph = t * 5.2
      roll = Math.sin(ph) * 0.12; bob = Math.abs(Math.sin(ph)) * 0.035
      lL = Math.sin(ph) * 0.45; lR = -Math.sin(ph) * 0.45
      aL = [-0.25 - Math.sin(ph) * 0.35, -0.25]; aR = [-0.25 + Math.sin(ph) * 0.35, 0.25]
      headRoll = -roll * 0.6
    } else if (action === 'work') {   // at a bench: both paws forward, working in turn (kneading / stirring / planing)
      const ph = t * 3.2
      aL = [-1.35 + Math.sin(ph) * 0.3, -0.2]; aR = [-1.35 - Math.sin(ph) * 0.3, 0.2]
      headPitch = 0.28 + Math.sin(ph * 0.5) * 0.04; roll = Math.sin(ph) * 0.03
    } else if (action === 'wave') {
      const ph = t * 6
      aR = [-0.3, 2.4 + Math.sin(ph) * 0.35]; aL = [-1.1, -0.45]
      headRoll = 0.12; headPitch = -0.05
    } else if (action === 'shy') {
      aL = [-1.45, -0.75]; aR = [-1.45, 0.75]
      headPitch = 0.32; headRoll = Math.sin(t * 0.8) * 0.06 + 0.1; earDroop = 0.75; bob = breathe * 0.5
    }
    if (body.current) { body.current.rotation.z = roll; body.current.position.y = bob }
    if (head.current) { head.current.rotation.x = headPitch; head.current.rotation.z = headRoll }
    if (earL.current) earL.current.rotation.z = 0.78 + earDroop * 0.6
    if (earR.current) earR.current.rotation.z = -0.78 - earDroop * 0.6
    if (armL.current) armL.current.rotation.set(aL[0], 0, -aL[1])
    if (armR.current) armR.current.rotation.set(aR[0], 0, -aR[1])
    if (legL.current) legL.current.rotation.x = lL
    if (legR.current) legR.current.rotation.x = lR
    // blink: a quick close every few seconds
    const blink = ((t + seed) % 3.7) < 0.12 ? 0.12 : 1
    if (eyes.current) eyes.current.scale.y = blink
  })
  const fur = <meshStandardMaterial color={tone.fur} roughness={0.95} />
  const light = <meshStandardMaterial color={tone.light} roughness={0.95} />
  const H = B.headR
  return (
    <group>
      <group ref={body}>
        {/* legs: pivots at the hips, stubby, with paw-feet */}
        {([-1, 1] as const).map(sd => (
          <group key={sd} ref={sd < 0 ? legL : legR} position={[sd * B.torsoR * 0.5, B.hip, 0]}>
            <mesh position={[0, -B.legL / 2, 0]} castShadow><capsuleGeometry args={[B.torsoR * 0.36, B.legL, 4, 10]} />{fur}</mesh>
            <mesh position={[0, -B.hip + 0.025, 0.03]} scale={[1, 0.5, 1.3]} castShadow><sphereGeometry args={[B.torsoR * 0.38, 12, 8]} />{light}</mesh>
          </group>
        ))}
        {/* the body: a soft pear, a cream belly */}
        <mesh position={[0, B.torsoY, 0]} scale={[1, 1.12, 0.92]} castShadow><sphereGeometry args={[B.torsoR, 18, 14]} />{fur}</mesh>
        <mesh position={[0, B.torsoY - 0.02, B.torsoR * 0.42]} scale={[0.78, 0.92, 0.6]}><sphereGeometry args={[B.torsoR, 16, 12]} />{light}</mesh>
        {/* arms: pivots at the shoulders, short, paws at the ends */}
        {([-1, 1] as const).map(sd => (
          <group key={sd} ref={sd < 0 ? armL : armR} position={[sd * B.torsoR * 0.82, B.torsoY + B.torsoR * 0.55, 0.02]}>
            <mesh position={[0, -B.armL / 2, 0]} castShadow><capsuleGeometry args={[B.torsoR * 0.27, B.armL, 4, 10]} />{fur}</mesh>
            <mesh position={[0, -B.armL - 0.02, 0]}><sphereGeometry args={[B.torsoR * 0.3, 10, 8]} />{fur}</mesh>
            {garb === 'satchel' && sd > 0 && <mesh position={[0, -B.armL - 0.02, 0.02]} rotation={[0.25, 0, 0]}><cylinderGeometry args={[0.018, 0.022, 0.95, 6]} /><meshStandardMaterial color="#6b4a2e" roughness={0.9} /></mesh>}
            {garb === 'scarf' && sd > 0 && <mesh position={[0, -B.armL - 0.06, 0.03]}><cylinderGeometry args={[0.022, 0.026, 0.07, 8]} /><meshStandardMaterial color="#8fd0ea" emissive="#3a8fb0" emissiveIntensity={0.6} roughness={0.3} /></mesh>}
          </group>
        ))}
        {/* garb: cloth, leather, wood. No metal (canon: metal on a Moglin means a hold) */}
        {garb === 'apron' && (
          <group position={[0, B.torsoY - 0.02, B.torsoR * 0.86]}>
            <mesh scale={[1, 1, 0.25]}><boxGeometry args={[B.torsoR * 1.25, B.torsoR * 1.5, 0.06]} /><meshStandardMaterial color="#e6dcc4" roughness={1} /></mesh>
            <mesh position={[0, B.torsoR * 0.1, -B.torsoR * 0.85]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[B.torsoR * 0.98, 0.012, 6, 24]} /><meshStandardMaterial color="#c9b88f" /></mesh>
          </group>
        )}
        {garb === 'satchel' && (
          <>
            <mesh position={[-B.torsoR * 1.0, B.torsoY - 0.02, 0.02]} rotation={[0, 0, 0.1]} castShadow><boxGeometry args={[0.08, 0.15, 0.17]} /><meshStandardMaterial color="#5e3f28" roughness={0.85} /></mesh>
            <mesh position={[0, B.torsoY + 0.04, 0]} rotation={[0, 0, -0.75]} scale={[1, 1, 0.85]}><torusGeometry args={[B.torsoR * 1.03, 0.012, 6, 24]} /><meshStandardMaterial color="#5e3f28" /></mesh>
          </>
        )}
        {garb === 'toolbelt' && (
          <>
            <mesh position={[0, B.torsoY - B.torsoR * 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.92, 1]}><torusGeometry args={[B.torsoR * 0.97, 0.022, 6, 24]} /><meshStandardMaterial color="#6b4a2e" roughness={0.85} /></mesh>
            <mesh position={[B.torsoR * 0.75, B.torsoY - B.torsoR * 0.7, B.torsoR * 0.55]} rotation={[0, -0.6, 0]}><boxGeometry args={[0.06, 0.07, 0.04]} /><meshStandardMaterial color="#7a5636" /></mesh>
            <mesh position={[-B.torsoR * 0.8, B.torsoY - B.torsoR * 0.55, B.torsoR * 0.5]} rotation={[0.2, 0.5, 0.15]}><boxGeometry args={[0.022, 0.16, 0.03]} /><meshStandardMaterial color="#c8964a" /></mesh>
          </>
        )}
        {/* the head: a pivot at the neck */}
        <group ref={head} position={[0, B.headPivot, 0]}>
          <group position={[0, H * 0.92, 0]}>
            <mesh castShadow scale={[1.08, 1, 0.95]}><sphereGeometry args={[H, 22, 18]} />{fur}</mesh>
            {/* the cream face mask + muzzle */}
            <mesh position={[0, -H * 0.22, H * 0.5]} scale={[1.05, 0.72, 0.62]}><sphereGeometry args={[H * 0.78, 18, 14]} />{light}</mesh>
            <mesh position={[-H * 0.36, H * 0.12, H * 0.66]} scale={[1, 0.85, 0.5]}><sphereGeometry args={[H * 0.27, 12, 10]} />{light}</mesh>
            <mesh position={[H * 0.36, H * 0.12, H * 0.66]} scale={[1, 0.85, 0.5]}><sphereGeometry args={[H * 0.27, 12, 10]} />{light}</mesh>
            {/* eyes: big, round, dark, a glint (blink scales the group) */}
            <group ref={eyes} position={[0, H * 0.1, 0]}>
              {([-1, 1] as const).map(sd => (
                <group key={sd} position={[sd * H * 0.37, 0, H * 0.83]}>
                  <mesh scale={[1, 1.05, 0.6]}><sphereGeometry args={[H * 0.2, 14, 12]} /><meshStandardMaterial color={EYE} roughness={0.2} /></mesh>
                  <mesh position={[H * 0.06, H * 0.08, H * 0.1]}><sphereGeometry args={[H * 0.055, 8, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
                </group>
              ))}
            </group>
            {/* nose, smile, blush */}
            <mesh position={[0, -H * 0.12, H * 0.98]} scale={[1.35, 0.95, 0.9]}><sphereGeometry args={[H * 0.1, 10, 8]} /><meshStandardMaterial color={NOSE} roughness={0.5} /></mesh>
            <mesh position={[0, -H * 0.3, H * 0.9]} rotation={[0.25, 0, Math.PI]}><torusGeometry args={[H * 0.13, H * 0.018, 6, 12, Math.PI]} /><meshBasicMaterial color="#7a2e2a" /></mesh>
            {([-1, 1] as const).map(sd => <mesh key={sd} position={[sd * H * 0.6, -H * 0.15, H * 0.72]} rotation={[0, sd * 0.7, 0]} scale={[1, 0.75, 0.25]}><sphereGeometry args={[H * 0.16, 10, 8]} /><meshBasicMaterial color={PINK} transparent opacity={0.55} /></mesh>)}
            {/* whiskers: three a side, fine */}
            {([-1, 1] as const).flatMap(sd => [0, 1, 2].map(k => (
              <mesh key={`${sd}${k}`} position={[sd * H * 0.62, -H * (0.18 + k * 0.07), H * 0.82]} rotation={[0, sd * 0.35, sd * (Math.PI / 2 - 0.12 + k * 0.12)]}>
                <cylinderGeometry args={[0.0018, 0.0018, H * 0.75, 3]} /><meshBasicMaterial color={WHISKER} />
              </mesh>
            )))}
            {/* ears: large, rounded-pointed, out and up, pink inside; they droop when shy */}
            {([-1, 1] as const).map(sd => (
              <group key={sd} ref={sd < 0 ? earL : earR} position={[sd * H * 0.62, H * 0.55, -H * 0.05]} rotation={[0, 0, -sd * 0.78]}>
                {/* canon: ROUNDED ears; the ref's are broad leaves with soft tips, so an ellipsoid, wide at the base, not a cone */}
                <mesh position={[0, H * 0.52 * B.earS, 0]} scale={[0.62, 1.05, 0.26]} castShadow><sphereGeometry args={[H * 0.62 * B.earS, 18, 14]} />{fur}</mesh>
                <mesh position={[0, H * 0.52 * B.earS, H * 0.1]} scale={[0.46, 0.86, 0.18]}><sphereGeometry args={[H * 0.62 * B.earS, 16, 12]} /><meshStandardMaterial color={EAR_IN} roughness={0.9} /></mesh>
              </group>
            ))}
            {/* the crown tuft */}
            {[-1, 0, 1].map(k => <mesh key={k} position={[k * H * 0.12, H * 0.98, H * 0.05]} rotation={[0, 0, -k * 0.35]}><coneGeometry args={[H * 0.06, H * 0.28, 6]} />{fur}</mesh>)}
            {garb === 'scarf' && <mesh position={[0, -H * 0.88, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[H * 0.62, H * 0.13, 8, 22]} /><meshStandardMaterial color="#6f8a4a" roughness={1} /></mesh>}
          </group>
        </group>
      </group>
    </group>
  )
}
export const MOGLIN_HEIGHT = { plush: BUILD.plush.headPivot + BUILD.plush.headR * 1.92, chibi: BUILD.chibi.headPivot + BUILD.chibi.headR * 1.92 }
export const _TAU = TAU
