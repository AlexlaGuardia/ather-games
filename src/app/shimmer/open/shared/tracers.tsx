'use client'

// TRACER ROUNDS, drawn. Any host that keeps a list of rounds (x/y/z + velocity + age) hands it here and gets the look
// Alex asked for 11-15: "tracer rounds and epic gunfights". Three layers, all additive so they BLOOM over the scene
// instead of sitting on it like paint:
//   · the streak: a white-hot core inside a coloured glow, stretched along the velocity, growing out of the muzzle
//     over its first frames (a tracer that pops in at full length reads as a laser, not a round)
//   · the muzzle flash: a crossed star at the barrel for ~60 ms
//   · the impact: a spray of sparks that kick off the surface, fall, and fade; a plate hit sprays hotter and wider
// CANON (manalic-weapons.md): "the shot trails the wielder's colour; the gun itself has none". So the COLOUR is the
// shooter's, passed in; the guns' class colours live on their models and racks, never on the round.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export interface TracerRound { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number }
export interface TracerImpact { x: number; y: number; z: number; nx: number; ny: number; nz: number; target: boolean }
export interface TracerFlash { x: number; y: number; z: number; dx: number; dy: number; dz: number }

/** A queue the host pushes into from its sim; the renderer drains it each frame. */
export class TracerFx {
  impacts: TracerImpact[] = []
  flashes: TracerFlash[] = []
}

const MAX_ROUNDS = 96, MAX_SPARKS = 320, MAX_FLASH = 8
const STREAK_LEN = 3.2          // metres of trail at full growth
const STREAK_GROW = 0.05        // seconds to grow from the muzzle to full length
const SPARK_LIFE = 0.38, FLASH_LIFE = 0.06

interface Spark { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; hot: boolean }
interface Flash { x: number; y: number; z: number; q: THREE.Quaternion; life: number }

export function Tracers({ rounds, fx, color = '#ffb84a' }: { rounds: () => readonly TracerRound[]; fx: TracerFx; color?: string }) {
  const core = useRef<THREE.InstancedMesh>(null), glow = useRef<THREE.InstancedMesh>(null)
  const sparksM = useRef<THREE.InstancedMesh>(null), flashM = useRef<THREE.InstancedMesh>(null)
  const sparks = useRef<Spark[]>([]), flashes = useRef<Flash[]>([])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), d: new THREE.Vector3(), z: new THREE.Vector3(0, 0, 1) }), [])
  const mats = useMemo(() => {
    const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }
    const c = new THREE.Color(color)
    return {
      core: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff8e6'), ...add }),
      glow: new THREE.MeshBasicMaterial({ color: c, opacity: 0.55, ...add }),
      spark: new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.45), ...add }),
      flash: new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.6), opacity: 0.9, side: THREE.DoubleSide, ...add }),
    }
  }, [color])
  // a streak is a unit box along +z with its TAIL at the origin (so scaling z grows it backward from the head)
  const streakGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0, -0.5), [])
  const flashGeo = useMemo(() => {
    // three crossed quads along the barrel axis = a star from any angle
    const g = new THREE.BufferGeometry(), pos: number[] = []
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI, cx = Math.cos(a), cy = Math.sin(a)
      const L = 0.55, W = 0.22
      const P = (u: number, v: number) => [cx * u, cy * u, v]
      pos.push(...P(-W, 0), ...P(W, 0), ...P(W * 0.3, L), ...P(-W, 0), ...P(W * 0.3, L), ...P(-W * 0.3, L))
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20), { m, q, p, s, d, z } = tmp
    // drain the host's queue
    for (const im of fx.impacts.splice(0)) {
      const n = im.target ? 14 : 9
      for (let k = 0; k < n && sparks.current.length < MAX_SPARKS; k++) {
        // a cone off the surface normal, biased up a touch so sparks arc
        const rx = Math.random() * 2 - 1, ry = Math.random() * 2 - 1, rz = Math.random() * 2 - 1
        const sp = (im.target ? 5 : 3.5) + Math.random() * 4
        const vx = im.nx * 0.7 + rx * 0.6, vy = im.ny * 0.7 + ry * 0.6 + 0.5, vz = im.nz * 0.7 + rz * 0.6
        const l = Math.hypot(vx, vy, vz) || 1
        const life = SPARK_LIFE * (0.5 + Math.random() * 0.7)
        sparks.current.push({ x: im.x, y: im.y, z: im.z, vx: (vx / l) * sp, vy: (vy / l) * sp, vz: (vz / l) * sp, life, max: life, hot: im.target })
      }
    }
    for (const f of fx.flashes.splice(0)) {
      if (flashes.current.length >= MAX_FLASH) flashes.current.shift()
      const fq = new THREE.Quaternion().setFromUnitVectors(z, d.set(f.dx, f.dy, f.dz).normalize())
      fq.multiply(new THREE.Quaternion().setFromAxisAngle(z, Math.random() * Math.PI))
      flashes.current.push({ x: f.x, y: f.y, z: f.z, q: fq, life: FLASH_LIFE })
    }
    // streaks
    const rs = rounds(), n = Math.min(rs.length, MAX_ROUNDS)
    for (let i = 0; i < n; i++) {
      const r = rs[i], speed = Math.hypot(r.vx, r.vy, r.vz) || 1
      const len = Math.min(STREAK_LEN, speed * Math.max(r.age, 0.004), STREAK_LEN * Math.min(1, (r.age + 0.008) / STREAK_GROW))
      p.set(r.x, r.y, r.z); q.setFromUnitVectors(z, d.set(r.vx / speed, r.vy / speed, r.vz / speed))
      // thin: a tracer is a LINE of light. v1 (0.035 core / 0.13 glow) read as glowing cards up close, where a
      // breacher's pellets live. The glow widens a touch with distance travelled so a far round still reads.
      // ...and the glow fades IN over the first metres: right at the barrel it sits ~0.5 m from the eye, where a
      // 5 cm glow fills a fist of screen (it read as a yellow slab off the muzzle)
      const flown = speed * r.age
      const gw = (0.045 + Math.min(0.04, r.age * 0.08)) * Math.max(0.12, Math.min(1, (flown - 0.6) / 5))
      m.compose(p, q, s.set(0.016, 0.016, len)); core.current?.setMatrixAt(i, m)
      m.compose(p, q, s.set(gw, gw, len * 1.06)); glow.current?.setMatrixAt(i, m)
    }
    for (const mesh of [core.current, glow.current]) if (mesh) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true }
    // sparks: fly, fall, fade (by shrinking — additive has no cheaper fade per instance)
    const ss = sparks.current
    for (let i = ss.length - 1; i >= 0; i--) {
      const k = ss[i]; k.life -= dt
      if (k.life <= 0) { ss.splice(i, 1); continue }
      k.vy -= 14 * dt; k.vx *= 1 - 2 * dt; k.vz *= 1 - 2 * dt
      k.x += k.vx * dt; k.y += k.vy * dt; k.z += k.vz * dt
    }
    const sm = sparksM.current
    if (sm) {
      for (let i = 0; i < ss.length; i++) {
        const k = ss[i], v = Math.hypot(k.vx, k.vy, k.vz) || 1, f = k.life / k.max
        p.set(k.x, k.y, k.z); q.setFromUnitVectors(z, d.set(k.vx / v, k.vy / v, k.vz / v))
        const w = (k.hot ? 0.035 : 0.025) * f
        m.compose(p, q, s.set(w, w, Math.min(0.5, v * 0.03) * (0.4 + f * 0.6))); sm.setMatrixAt(i, m)
      }
      sm.count = ss.length; sm.instanceMatrix.needsUpdate = true
    }
    const fl = flashes.current, fm = flashM.current
    for (let i = fl.length - 1; i >= 0; i--) { fl[i].life -= dt; if (fl[i].life <= 0) fl.splice(i, 1) }
    if (fm) {
      for (let i = 0; i < fl.length; i++) {
        const f = fl[i], g = 0.22 + (f.life / FLASH_LIFE) * 0.2
        m.compose(p.set(f.x, f.y, f.z), f.q, s.set(g, g, g)); fm.setMatrixAt(i, m)
      }
      fm.count = fl.length; fm.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh ref={glow} args={[streakGeo, mats.glow, MAX_ROUNDS]} frustumCulled={false} renderOrder={10} />
      <instancedMesh ref={core} args={[streakGeo, mats.core, MAX_ROUNDS]} frustumCulled={false} renderOrder={11} />
      <instancedMesh ref={sparksM} args={[streakGeo, mats.spark, MAX_SPARKS]} frustumCulled={false} renderOrder={11} />
      <instancedMesh ref={flashM} args={[flashGeo, mats.flash, MAX_FLASH]} frustumCulled={false} renderOrder={12} />
    </>
  )
}
