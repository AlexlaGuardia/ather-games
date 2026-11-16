'use client'
// THE SHOP DOOR KIT (Alex 11-16: doors you E into and get a shop panel). A real door over the one the facade shader
// paints (towns/Towns.tsx): a timber frame (jambs + lintel), a panelled slab set into it, a step stone down to the street,
// and a lantern on a bracket that is LIT when there is something inside (the tell, `lit`).
//
// Mount: <ShopDoor b={building} lit /> where b is a towns/plan.ts Building. The E-to-panel wiring and the mounting are
// play's (business/ + the continent page); `shopDoorPoint(b)` gives the world point at the step for that.
//
// Frame: the same local frame as business/business-dress.tsx: group at [b.x, b.y1 + 0.25, b.z], rotation.y = π/2 − yaw,
// street face = local +z at z = b.d/2, floor at local y 0 (the street at the door is one 0.15 step below it).
// Placement MATCHES THE SHADER'S DOOR CELL exactly: cols = max(1, floor(w / 2.7)), cw = w / cols, door centre
// u = (floor(cols/2) + 0.5)·cw − w/2 (off-centre when cols is even), painted 1.3 m wide × 2.3 m tall. This kit's opening
// is that size, so the frame sits round the painted door instead of beside it.
// No pointLight: 20–60 doors × a real light would recompile every lit material in the scene. The lantern's glow is
// emissive meshes + an additive halo that swells after dusk.
// Code-drawn filler; Alex judges the look.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Building } from './plan'
import { dayProgress, daylight } from '../../engine/day-cycle'

const TIMBER = '#9a6e44', TIMBER_DARK = '#6a4a2e', SLAB = '#5a3a24', PANEL = '#734c30', STONE = '#9a9284', IRON = '#2f2b28'
const FLAME = '#ffc277', GLASS_DARK = '#2a2622'

/** one soft radial falloff, shared by every door's glow and wall wash (made once, on first use) */
let SOFT: THREE.CanvasTexture | null = null
function soft() {
  if (SOFT) return SOFT
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r; g.fillRect(0, 0, 64, 64)
  return (SOFT = new THREE.CanvasTexture(c))
}

/** the facade shader's door: its centre along the front (local x) and its opening */
export const DOOR_W = 1.3, DOOR_H = 2.3, STEP = 0.15
export function doorU(w: number) {
  const cols = Math.max(1, Math.floor(w / 2.7)), cw = w / cols
  return (Math.floor(cols / 2) + 0.5) * cw - w / 2
}

/** the world point on the step stone in front of the door (y = the street) */
export function shopDoorPoint(b: Pick<Building, 'x' | 'z' | 'yaw' | 'w' | 'd' | 'y1'>): { x: number; y: number; z: number } {
  // local (u, d/2 + 0.45) → world, with rotation.y = π/2 − yaw: local +x → (sin(ry), −cos(ry))… expanded below
  const ry = Math.PI / 2 - b.yaw, lx = doorU(b.w), lz = b.d / 2 + 0.45
  const c = Math.cos(ry), s = Math.sin(ry)
  return { x: b.x + lx * c + lz * s, y: b.y1 + 0.25 - STEP, z: b.z - lx * s + lz * c }
}

function Lantern({ lit }: { lit: boolean }) {
  const halo = useRef<THREE.SpriteMaterial>(null)
  const wash = useRef<THREE.MeshBasicMaterial>(null)
  const core = useRef<THREE.MeshBasicMaterial>(null)
  const next = useRef(0)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!lit || !halo.current || !core.current) return
    // a flame's small breath every frame; the day/night swell only needs a look once a second
    if (t > next.current) { next.current = t + 1; halo.current.userData.night = 1 - daylight(dayProgress()) }
    const night = (halo.current.userData.night as number) ?? 0
    const k = 0.9 + 0.1 * Math.sin(t * 7.3) * Math.sin(t * 2.1)
    halo.current.opacity = (0.15 + 0.6 * night) * k
    if (wash.current) wash.current.opacity = 0.55 * night * k
    core.current.color.set(FLAME).multiplyScalar(0.85 + 0.15 * k)
  })
  return (
    <group>
      {/* the bracket: out from the wall, then down */}
      <mesh position={[0, 0.32, 0.22]}><boxGeometry args={[0.05, 0.05, 0.44]} /><meshLambertMaterial color={IRON} /></mesh>
      <mesh position={[0, 0.22, 0.42]}><boxGeometry args={[0.03, 0.2, 0.03]} /><meshLambertMaterial color={IRON} /></mesh>
      {/* the lantern: cap, glass, base */}
      <group position={[0, 0, 0.42]}>
        <mesh position={[0, 0.1, 0]}><coneGeometry args={[0.15, 0.12, 4]} /><meshLambertMaterial color={IRON} flatShading /></mesh>
        <mesh position={[0, -0.08, 0]}><boxGeometry args={[0.18, 0.24, 0.18]} />
          {lit ? <meshBasicMaterial ref={core} color={FLAME} toneMapped={false} /> : <meshLambertMaterial color={GLASS_DARK} />}
        </mesh>
        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x * 0.095, -0.08, z * 0.095]}><boxGeometry args={[0.025, 0.26, 0.025]} /><meshLambertMaterial color={IRON} /></mesh>
        ))}
        <mesh position={[0, -0.22, 0]}><boxGeometry args={[0.2, 0.04, 0.2]} /><meshLambertMaterial color={IRON} /></mesh>
        {lit && (
          <sprite position={[0, -0.08, 0.05]} scale={[1.3, 1.3, 1]}>
            <spriteMaterial ref={halo} map={soft()} color={FLAME} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        )}
      </group>
      {/* the lantern's light on the wall and the door beside it, after dusk (a painted wash, not a light) */}
      {lit && (
        <mesh position={[-0.55, -0.55, 0.16]}><planeGeometry args={[3.2, 3.2]} />
          <meshBasicMaterial ref={wash} map={soft()} color={FLAME} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

export function ShopDoor({ b, lit = false }: { b: Pick<Building, 'x' | 'z' | 'yaw' | 'w' | 'd' | 'y1'>; lit?: boolean }) {
  const ry = Math.PI / 2 - b.yaw, u = doorU(b.w), z0 = b.d / 2
  const JAMB = 0.18, OUT = 0.14   // jamb width, how far the frame stands proud of the wall
  return (
    <group position={[b.x, b.y1 + 0.25, b.z]} rotation={[0, ry, 0]}>
      <group position={[u, 0, z0]}>
        {/* the frame: two jambs and a lintel round the painted opening, standing proud of the wall */}
        {[-1, 1].map(s => (
          <mesh key={s} position={[s * (DOOR_W / 2 + JAMB / 2), DOOR_H / 2, OUT / 2]}><boxGeometry args={[JAMB, DOOR_H, OUT]} /><meshLambertMaterial color={TIMBER} /></mesh>
        ))}
        <mesh position={[0, DOOR_H + 0.12, OUT / 2 + 0.02]}><boxGeometry args={[DOOR_W + JAMB * 2 + 0.24, 0.24, OUT + 0.04]} /><meshLambertMaterial color={TIMBER} /></mesh>
        <mesh position={[0, DOOR_H + 0.27, OUT / 2 + 0.06]}><boxGeometry args={[DOOR_W + JAMB * 2 + 0.4, 0.06, OUT + 0.12]} /><meshLambertMaterial color={TIMBER_DARK} /></mesh>
        {/* the slab, set INTO the frame (its face behind the jambs'), with two raised panels and a ring pull */}
        <mesh position={[0, DOOR_H / 2, 0.03]}><boxGeometry args={[DOOR_W, DOOR_H, 0.06]} /><meshLambertMaterial color={SLAB} /></mesh>
        {[0.62, 1.62].map(y => (
          <mesh key={y} position={[0, y, 0.065]}><boxGeometry args={[DOOR_W - 0.34, y < 1 ? 0.9 : 0.95, 0.025]} /><meshLambertMaterial color={PANEL} /></mesh>
        ))}
        <mesh position={[DOOR_W / 2 - 0.2, 1.05, 0.09]} rotation={[0, 0, 0]}><torusGeometry args={[0.06, 0.014, 6, 12]} /><meshLambertMaterial color={IRON} /></mesh>
        {/* the step stone: from the floor's edge down to the street (one 0.15 step), wider than the frame */}
        <mesh position={[0, -STEP / 2 - 0.04, 0.32]}><boxGeometry args={[DOOR_W + JAMB * 2 + 0.3, STEP + 0.1, 0.64]} /><meshLambertMaterial color={STONE} flatShading /></mesh>
        {/* the lantern on its bracket, on the door's right, at head height */}
        <group position={[DOOR_W / 2 + JAMB + 0.28, 2.15, 0]}><Lantern lit={lit} /></group>
      </group>
    </group>
  )
}
