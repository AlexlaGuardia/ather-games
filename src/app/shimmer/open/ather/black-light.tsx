'use client'
// ── THE BLACK LIGHT (BETA M235 s2, Alex 11-27: "from the garden a player could see a black light erupt in the far distance") ──────
// Canon (Magii 15b0e8a, ather-story §2.1): a lost zone's grey matter venting as it falls into the cloud. A pillar of black light
// stands over the lost zone; when that is farther than the camera can draw (or the keeper is home in the garden, which has no
// Wilds coordinates), it stands on the horizon in the zone's direction instead. It erupts (rises fast, then holds) and fades out
// after PILLAR_MS. Jin's first look (Alex judges): a black core with a violet bruise round it, unfogged, so it reads against sky.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, type Group, type Mesh, type MeshBasicMaterial } from 'three'
import { GAME_DAY_MS } from './nodes'

/** how long the pillar stands after the fall (one game day) */
export const PILLAR_MS = GAME_DAY_MS
/** the farthest it is drawn (the camera's far is 900) */
export const PILLAR_HORIZON = 820
const RISE_S = 6, H = 1400

/** where the pillar stands this frame: over the zone if near enough, else on the horizon along the bearing */
export function pillarSpot(keeper: { x: number; z: number }, bearing: { x: number; z: number }, dist: number): { x: number; z: number; far: boolean } {
  const L = Math.hypot(bearing.x, bearing.z) || 1, d = Math.min(dist, PILLAR_HORIZON)
  return { x: keeper.x + (bearing.x / L) * d, z: keeper.z + (bearing.z / L) * d, far: dist > PILLAR_HORIZON }
}

export function BlackLight({ at, home, since, keeper, now }: {
  /** the lost zone's centre (Wilds world coords) */
  at: { x: number; z: number }
  /** set in the garden: the bearing is taken from this Wilds point (the Glade's waymark) and the pillar always stands on the horizon */
  home: { x: number; z: number } | null
  since: number
  keeper: { readonly current: { x: number; z: number } }
  now: () => number
}) {
  const g = useRef<Group>(null), core = useRef<Mesh>(null), halo = useRef<Mesh>(null)
  const born = useRef<number | null>(null)
  const haloCol = useMemo(() => new Color('#3a1452'), [])
  useEffect(() => () => { if (typeof window !== 'undefined') delete (window as unknown as { __blackLight?: unknown }).__blackLight }, [])
  useFrame((_, dt) => {
    const G = g.current; if (!G) return
    const k = keeper.current
    const from = home ?? k, b = { x: at.x - from.x, z: at.z - from.z }
    const s = pillarSpot(k, b, home ? Infinity : Math.hypot(b.x, b.z))
    G.position.set(s.x, -200, s.z)
    born.current = (born.current ?? 0) + dt
    const rise = Math.min(1, born.current / RISE_S), age = now() - since
    const fade = age > PILLAR_MS * 0.85 ? Math.max(0, (PILLAR_MS - age) / (PILLAR_MS * 0.15)) : 1
    G.scale.set(1, Math.max(0.02, rise * rise * (3 - 2 * rise)), 1)
    const w = s.far ? 1.6 : 1   // on the horizon it reads a touch wider
    core.current?.scale.set(w, 1, w); halo.current?.scale.set(w * (1 + 0.08 * Math.sin(born.current * 2.1)), 1, w)
    ;(core.current?.material as MeshBasicMaterial | undefined)?.setValues({ opacity: 0.95 * fade })
    ;(halo.current?.material as MeshBasicMaterial | undefined)?.setValues({ opacity: 0.42 * fade })
    G.visible = fade > 0.01
    if (typeof window !== 'undefined') (window as unknown as { __blackLight?: unknown }).__blackLight = { on: G.visible, x: s.x, z: s.z, far: s.far, rise, fade, home: !!home }
  })
  return (
    <group ref={g} renderOrder={5}>
      <mesh ref={halo} position={[0, H / 2, 0]} frustumCulled={false}>
        <cylinderGeometry args={[26, 40, H, 24, 1, true]} />
        <meshBasicMaterial color={haloCol} transparent opacity={0.42} fog={false} depthWrite={false} side={DoubleSide} blending={AdditiveBlending} />
      </mesh>
      <mesh ref={core} position={[0, H / 2, 0]} frustumCulled={false}>
        <cylinderGeometry args={[11, 18, H, 20, 1, true]} />
        <meshBasicMaterial color="#020005" transparent opacity={0.95} fog={false} depthWrite={false} side={DoubleSide} />
      </mesh>
    </group>
  )
}
