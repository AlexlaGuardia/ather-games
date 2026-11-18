'use client'
// THE FOCUS AT THE NODE (channel.ts; Alex 11-17). While a node is being worked, the right gathering focus hangs in the air
// beside it, lit along its own material (canon: a focus "lights along its own material's structure while channeling";
// "nothing is ever swung"), and every chip is a PULSE: it draws back, flares, and a ring of light leaves it. The blade is
// a long leaf-shaped sliver of goldwood (wood lit down the grain); the spike is a crystal shard pointing down at the stone
// (crystal lit along its fracture planes). Placeholder geometry (Alex judges the look; game art must not block on Alex).
import { useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export interface FocusState {
  /** null = no channel (the focus is gone) */
  node: 'tree' | 'crystal' | null
  /** where it hangs: the point it works (a trunk's side at chest height, or above a crystal's crown) */
  x: number; y: number; z: number
  /** performance.now() of the last chip (the pulse) */
  pulseAt: number
}
export const freshFocus = (): FocusState => ({ node: null, x: 0, y: 0, z: 0, pulseAt: -1e9 })
const PULSE_MS = 420

export function ChannelFocus({ focus }: { focus: MutableRefObject<FocusState> }) {
  const { camera } = useThree()
  const g = useRef<THREE.Group>(null), blade = useRef<THREE.Group>(null), spike = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null), glowB = useRef<THREE.MeshBasicMaterial>(null), glowS = useRef<THREE.MeshBasicMaterial>(null)
  const appear = useRef(0), tmp = useRef(new THREE.Vector3())
  useFrame((_, dtRaw) => {
    const f = focus.current, dt = Math.min(0.05, dtRaw), now = performance.now()
    appear.current = Math.max(0, Math.min(1, appear.current + (f.node ? dt * 4 : -dt * 5)))
    const grp = g.current; if (!grp) return
    grp.visible = appear.current > 0.01
    if (!grp.visible) return
    const p = Math.max(0, 1 - (now - f.pulseAt) / PULSE_MS)            // 1 at the chip, 0 after PULSE_MS
    const kick = Math.sin(Math.min(1, (now - f.pulseAt) / PULSE_MS) * Math.PI) * (p > 0 ? 1 : 0)
    // hang a touch toward the keeper from the work point, bob gently, face the keeper's side
    camera.getWorldPosition(tmp.current)
    const dx = tmp.current.x - f.x, dz = tmp.current.z - f.z, d = Math.hypot(dx, dz) || 1
    // a tree's focus stands off the trunk toward the keeper and a little to its RIGHT, so it reads against the bark, not on it
    const back = f.node === 'tree' ? 0.85 + kick * 0.3 : 0, side = f.node === 'tree' ? 0.75 : 0
    grp.position.set(f.x + (dx / d) * back + (dz / d) * side, f.y + Math.sin(now / 420) * 0.06 + (f.node === 'crystal' ? kick * 0.18 : 0), f.z + (dz / d) * back - (dx / d) * side)
    grp.rotation.set(0, Math.atan2(dx, dz), 0)
    grp.scale.setScalar(appear.current * 1.5 * (1 + p * 0.18))
    if (blade.current) { blade.current.visible = f.node === 'tree'; blade.current.rotation.z = -0.5 + kick * 0.35 }
    if (spike.current) { spike.current.visible = f.node === 'crystal'; spike.current.rotation.y = now / 700 }
    const lit = 0.55 + 0.45 * p + 0.1 * Math.sin(now / 160)
    if (glowB.current) glowB.current.color.setRGB(1.0 * lit + 0.2, 0.82 * lit + 0.12, 0.42 * lit)
    if (glowS.current) glowS.current.color.setRGB(0.55 * lit + 0.2, 0.85 * lit + 0.1, 1.0 * lit + 0.05)
    if (ring.current) {
      ring.current.visible = p > 0
      const s = 0.3 + (1 - p) * 1.4; ring.current.scale.set(s, s, s)
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = p * 0.8
      ;(ring.current.material as THREE.MeshBasicMaterial).color.set(f.node === 'tree' ? '#ffd98a' : '#9fe6ff')
    }
  })
  return (
    <group ref={g} visible={false}>
      {/* the Forestry focus: a leaf-long sliver of goldwood, its grain lit */}
      <group ref={blade}>
        <mesh scale={[0.09, 0.62, 0.025]}><octahedronGeometry args={[1, 0]} /><meshLambertMaterial color="#c8964a" /></mesh>
        <mesh scale={[0.035, 0.56, 0.03]}><octahedronGeometry args={[1, 0]} /><meshBasicMaterial ref={glowB} color="#ffd98a" /></mesh>
        <mesh position={[0, -0.66, 0]}><cylinderGeometry args={[0.03, 0.035, 0.22, 6]} /><meshLambertMaterial color="#7a6446" /></mesh>
      </group>
      {/* the Prospecting focus: a crystal shard pointing down at the stone, lit along its planes */}
      <group ref={spike} rotation-x={Math.PI}>
        <mesh scale={[0.13, 0.42, 0.13]}><octahedronGeometry args={[1, 0]} /><meshBasicMaterial ref={glowS} color="#9fe6ff" /></mesh>
        <mesh position={[0, -0.36, 0]} scale={[0.07, 0.12, 0.07]}><octahedronGeometry args={[1, 0]} /><meshLambertMaterial color="#7a8a9a" /></mesh>
      </group>
      <mesh ref={ring} rotation-x={-Math.PI / 2}><ringGeometry args={[0.8, 0.95, 28]} /><meshBasicMaterial transparent depthWrite={false} color="#ffd98a" /></mesh>
    </group>
  )
}
