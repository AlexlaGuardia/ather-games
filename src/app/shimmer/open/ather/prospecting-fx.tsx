'use client'
// PROSPECTING, SEEN. Canon: "Channel mana into the node and it fractures, releasing shards" (shimmer-skilling.md ›
// Prospecting). Same shape as forestry-fx.tsx so the two verbs feel like one hand:
//   AIM      — a ray from the eye through the crosshair against every crystal near the keeper (a sphere round the
//              cluster); the hit one wears a ring in its own light.
//   CHANNEL  — a pulse of the work (the stream of motes, hand to focus, is gather-tether.tsx).
//   FRACTURE — when the light lands it bursts: shards in the colour of what it gave (the Trails' hidden crystal shows its
//              element only now). What it gave lies on the ground (ground-loot-view.tsx, M141).
// Everything here is look. The rules are prospecting.ts; the page wires the click.

import { useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Crystal } from './wilds'
import type { WildsWorld } from './wilds-world'
import { PROSPECT_RANGE, type CrystalKind } from './prospecting'
import { CRYSTAL_LOOK } from './crystal-nodes'

export interface CrystalAim { crystal: Crystal | null; dist: number }
export interface ProspectFx {
  /** One pulse of the work at `c`; `ended()` when it has run its length (a stop never calls it). */
  start(c: Crystal, ended: () => void): boolean
  /** The work is over, this frame: no pulse outlives it. */
  stop(): void
  /** It bursts now: which kind showed. */
  burst(c: Crystal, got: { found: Exclude<CrystalKind, 'egg'> }): void
  busy(): boolean
}
export const CHANNEL_MS = 1000
const SHARDS = 22

/** ray (o, unit d) against a sphere: near distance or Infinity */
function raySphere(o: THREE.Vector3, d: THREE.Vector3, cx: number, cy: number, cz: number, r: number): number {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz
  const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - c
  if (disc < 0) return Infinity
  const t = -b - Math.sqrt(disc)
  return t >= 0 ? t : Infinity
}
export const crystalCentre = (c: Crystal) => c.y + 0.55 * c.s

interface Bit { p: THREE.Vector3; v: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; t: number }

export function ProspectingFX({ ww, aim, fx, ground, mineable }: {
  ww: Pick<WildsWorld, 'crystalsNear'>
  aim: MutableRefObject<CrystalAim>
  fx: MutableRefObject<ProspectFx | null>
  ground: (x: number, z: number) => number
  /** false for a node that is growing back: it is still aimable (the prompt says why), but the ring dims */
  mineable: (c: Crystal) => boolean
}) {
  const { camera } = useThree()
  const ring = useRef<THREE.Mesh>(null), ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const shards = useRef<THREE.InstancedMesh>(null)
  const shardMat = useRef<THREE.MeshBasicMaterial>(null)
  const ch = useRef<{ c: Crystal; t0: number; ended: () => void; done: boolean } | null>(null)
  const bits = useRef<Bit[]>([])
  const tmp = useRef({ o: new THREE.Vector3(), d: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), e: new THREE.Euler() })

  fx.current = {
    busy: () => !!ch.current && !ch.current.done,
    start(c, ended) {
      if (ch.current && !ch.current.done) return false
      ch.current = { c, t0: performance.now(), ended, done: false }
      return true
    },
    stop() { if (ch.current) ch.current.done = true },
    burst(c, got) {
      const look = CRYSTAL_LOOK[got.found], at = new THREE.Vector3(c.x, crystalCentre(c), c.z)
      shardMat.current?.color.set(look.glow).lerp(new THREE.Color('#ffffff'), 0.35)
      bits.current = Array.from({ length: SHARDS }, () => {
        const a = Math.random() * Math.PI * 2, out = 1.5 + Math.random() * 3
        return { p: at.clone(), v: new THREE.Vector3(Math.cos(a) * out, 2 + Math.random() * 3, Math.sin(a) * out), rot: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0), spin: new THREE.Vector3(Math.random() * 9 - 4.5, Math.random() * 9 - 4.5, 0), t: 0 }
      })
    },
  }

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw), T = tmp.current, now = performance.now()
    camera.getWorldPosition(T.o); camera.getWorldDirection(T.d)
    // ── aim
    let best: Crystal | null = null, bd = Infinity
    for (const c of ww.crystalsNear(T.o.x, T.o.z, PROSPECT_RANGE + 3)) {
      if (Math.hypot(c.x - T.o.x, c.z - T.o.z) > PROSPECT_RANGE + 0.6) continue
      const hit = raySphere(T.o, T.d, c.x, crystalCentre(c), c.z, 0.85 * c.s)
      if (hit < bd && hit <= PROSPECT_RANGE + 4) { bd = hit; best = c }
    }
    aim.current = { crystal: best, dist: bd }
    const shown = ch.current && !ch.current.done ? ch.current.c : best
    if (ring.current && ringMat.current) {
      ring.current.visible = !!shown
      if (shown) {
        const k = (1 + Math.sin(now / 180) * 0.06) * 1.05 * shown.s
        ring.current.position.set(shown.x, shown.y + 0.06, shown.z); ring.current.scale.set(k, k, 1)
        ringMat.current.color.set(CRYSTAL_LOOK[shown.kind].glow); ringMat.current.opacity = mineable(shown) ? 0.85 : 0.3
      }
    }

    // ── the pulse
    const c = ch.current
    if (c && !c.done && now - c.t0 >= CHANNEL_MS) { c.done = true; c.ended() }

    // ── the burst: shards fly, fall, fade
    const sm = shards.current
    if (sm) {
      bits.current = bits.current.filter(b => (b.t += dt) < 1.1)
      bits.current.forEach((b, i) => {
        b.v.y -= 9.8 * dt; b.p.addScaledVector(b.v, dt); b.rot.x += b.spin.x * dt; b.rot.y += b.spin.y * dt
        const g = ground(b.p.x, b.p.z); if (Number.isFinite(g) && b.p.y < g + 0.05) { b.p.y = g + 0.05; b.v.multiplyScalar(0.3) }
        const sc = 0.09 * (1 - b.t / 1.1)
        sm.setMatrixAt(i, T.m.compose(b.p, T.q.setFromEuler(b.rot), T.s.set(sc, sc * 1.8, sc)))
      })
      sm.count = bits.current.length; sm.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.82, 1, 32]} /><meshBasicMaterial ref={ringMat} color="#f3dc8a" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <instancedMesh ref={shards} args={[undefined, undefined, SHARDS]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} /><meshBasicMaterial ref={shardMat} color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </>
  )
}
