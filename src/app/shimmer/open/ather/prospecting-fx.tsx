'use client'
// PROSPECTING, SEEN. Canon: "Channel mana into the node and it fractures, releasing shards" (shimmer-skilling.md ›
// Prospecting). Same shape as forestry-fx.tsx so the two verbs feel like one hand:
//   AIM      — a ray from the eye through the crosshair against every crystal near the keeper (a sphere round the
//              cluster); the hit one wears a ring in its own light.
//   CHANNEL  — mana runs from the spike in your hand into the stone as a stream of motes, the cluster brightens.
//   FRACTURE — when the light lands it bursts: shards in the colour of what it gave (the Trails' hidden crystal shows its
//              element only now), and what you took flies home to you.
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
  /** Channel into `c`; `cut()` runs when the light lands and returns what it gave (and which kind showed). */
  start(c: Crystal, cut: () => { found: Exclude<CrystalKind, 'egg'>; n: number } | null, arrived: () => void): boolean
  busy(): boolean
}
export const CHANNEL_MS = 1000
const MOTES = 16, SHARDS = 22, HOME = 6

/** ray (o, unit d) against a sphere: near distance or Infinity */
function raySphere(o: THREE.Vector3, d: THREE.Vector3, cx: number, cy: number, cz: number, r: number): number {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz
  const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - c
  if (disc < 0) return Infinity
  const t = -b - Math.sqrt(disc)
  return t >= 0 ? t : Infinity
}
export const crystalCentre = (c: Crystal) => c.y + 0.55 * c.s

interface Bit { p: THREE.Vector3; v: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; t: number; home: boolean; from?: THREE.Vector3 }

export function ProspectingFX({ ww, aim, fx, ground, mineable }: {
  ww: WildsWorld
  aim: MutableRefObject<CrystalAim>
  fx: MutableRefObject<ProspectFx | null>
  ground: (x: number, z: number) => number
  /** false for a node that is growing back: it is still aimable (the prompt says why), but the ring dims */
  mineable: (c: Crystal) => boolean
}) {
  const { camera } = useThree()
  const ring = useRef<THREE.Mesh>(null), ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const motes = useRef<THREE.InstancedMesh>(null), shards = useRef<THREE.InstancedMesh>(null), homeM = useRef<THREE.InstancedMesh>(null)
  const shardMat = useRef<THREE.MeshBasicMaterial>(null), homeMat = useRef<THREE.MeshLambertMaterial>(null)
  const ch = useRef<{ c: Crystal; t0: number; cut: () => { found: Exclude<CrystalKind, 'egg'>; n: number } | null; arrived: () => void; done: boolean } | null>(null)
  const bits = useRef<Bit[]>([]), homing = useRef<Bit[]>([]), arrivedCb = useRef<(() => void) | null>(null)
  const tmp = useRef({ o: new THREE.Vector3(), d: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), e: new THREE.Euler() })

  fx.current = {
    busy: () => !!ch.current && !ch.current.done,
    start(c, cut, arrived) {
      if (ch.current && !ch.current.done) return false
      ch.current = { c, t0: performance.now(), cut, arrived, done: false }
      return true
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

    // ── the channel: motes from the spike (low right of the eye) into the stone
    const c = ch.current, mm = motes.current
    if (mm) {
      mm.count = 0
      if (c && !c.done) {
        const u = (now - c.t0) / CHANNEL_MS
        const right = new THREE.Vector3().crossVectors(T.d, camera.up).normalize()
        const from = T.o.clone().addScaledVector(T.d, 0.7).addScaledVector(right, 0.28).add(new THREE.Vector3(0, -0.32, 0))
        const to = new THREE.Vector3(c.c.x, crystalCentre(c.c), c.c.z)
        for (let i = 0; i < MOTES; i++) {
          const f = ((i / MOTES) + u * 1.8) % 1, lift = Math.sin(f * Math.PI) * 0.45
          T.p.lerpVectors(from, to, f).add(new THREE.Vector3(Math.sin(i * 2.3 + now / 80) * 0.07, lift, Math.cos(i * 1.9 + now / 95) * 0.07))
          const sc = 0.06 + 0.05 * Math.sin(f * Math.PI)
          mm.setMatrixAt(i, T.m.compose(T.p, T.q.setFromEuler(T.e.set(now / 180 + i, now / 260, 0)), T.s.set(sc, sc, sc)))
        }
        mm.count = MOTES; mm.instanceMatrix.needsUpdate = true
        if (u >= 1) {
          c.done = true
          const got = c.cut()
          arrivedCb.current = c.arrived
          if (!got) { c.arrived(); arrivedCb.current = null }
          else {
            const look = CRYSTAL_LOOK[got.found], at = new THREE.Vector3(c.c.x, crystalCentre(c.c), c.c.z)
            shardMat.current?.color.set(look.glow).lerp(new THREE.Color('#ffffff'), 0.35)
            homeMat.current?.color.set(look.color); homeMat.current?.emissive.set(look.glow)
            bits.current = Array.from({ length: SHARDS }, () => {
              const a = Math.random() * Math.PI * 2, out = 1.5 + Math.random() * 3
              return { p: at.clone(), v: new THREE.Vector3(Math.cos(a) * out, 2 + Math.random() * 3, Math.sin(a) * out), rot: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0), spin: new THREE.Vector3(Math.random() * 9 - 4.5, Math.random() * 9 - 4.5, 0), t: 0, home: false }
            })
            homing.current = Array.from({ length: Math.min(HOME, got.n + 1) }, (_, i) => ({ p: at.clone(), v: new THREE.Vector3(Math.cos(i * 1.4) * 1.4, 2.6, Math.sin(i * 1.4) * 1.4), rot: new THREE.Euler(), spin: new THREE.Vector3(3, 4, 0), t: 0, home: false }))
          }
        }
      }
    }

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
    // ── what you took: pops out, lands, flies home
    const hm = homeM.current
    if (hm) {
      const keeper = T.o.clone().add(new THREE.Vector3(0, -0.7, 0))
      for (const b of homing.current) {
        b.t += dt
        if (!b.home) {
          b.v.y -= 9.8 * dt; b.p.addScaledVector(b.v, dt); b.rot.x += b.spin.x * dt; b.rot.y += b.spin.y * dt
          const g = ground(b.p.x, b.p.z)
          if (Number.isFinite(g) && b.p.y <= g + 0.12 && b.v.y < 0) { b.p.y = g + 0.12; b.v.set(0, 0, 0) }
          if (b.t > 0.95) { b.home = true; b.t = 0; b.from = b.p.clone() }
        } else if (b.from) {
          const u = Math.min(1, b.t / 0.45), e = u * u * (3 - 2 * u)
          b.p.lerpVectors(b.from, keeper, e).y += Math.sin(u * Math.PI) * 0.8
        }
      }
      const before = homing.current.length
      homing.current = homing.current.filter(b => !(b.home && b.t >= 0.45))
      if (before && !homing.current.length && arrivedCb.current) { arrivedCb.current(); arrivedCb.current = null }
      homing.current.forEach((b, i) => hm.setMatrixAt(i, T.m.compose(b.p, T.q.setFromEuler(b.rot), T.s.set(0.16, 0.26, 0.16))))
      hm.count = homing.current.length; hm.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.82, 1, 32]} /><meshBasicMaterial ref={ringMat} color="#f3dc8a" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <instancedMesh ref={motes} args={[undefined, undefined, MOTES]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#d8ecff" />
      </instancedMesh>
      <instancedMesh ref={shards} args={[undefined, undefined, SHARDS]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} /><meshBasicMaterial ref={shardMat} color="#ffffff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={homeM} args={[undefined, undefined, HOME]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} /><meshLambertMaterial ref={homeMat} emissiveIntensity={0.6} flatShading />
      </instancedMesh>
    </>
  )
}
