'use client'

// TRACER ROUNDS for HIT-SCAN guns (Alex 11-15: "tracer rounds and epic gunfights" ... "it should feel like hit scan").
// The shot has already landed when it is drawn; what you see is the round's light getting there:
//   · the streak: a white-hot core inside a coloured glow, racing from the barrel to the point already hit at
//     TRACER_SPEED, drawn as a fixed line between those two points (so it never slides off the barrel's line)
//   · the wake: a thin, faint line of the whole path that hangs for a beat after the head arrives, so a burst leaves
//     a readable fan, which is most of what "epic" means at a range
//   · the impact: sparks kick off the surface when the head ARRIVES (a plate hit sprays hotter and wider)
// The muzzle flash lives on the held gun itself (gun-range.tsx), so it is welded to the barrel.
// CANON (manalic-weapons.md): "the shot trails the wielder's colour; the gun itself has none", so the COLOUR is the
// shooter's, passed in.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export interface TracerShot {
  sx: number; sy: number; sz: number          // the muzzle when it fired
  tx: number; ty: number; tz: number          // where the shot landed
  nx: number; ny: number; nz: number          // the surface normal there (sparks kick off it)
  target: boolean                             // a plate (hotter sparks) or the world
  age: number
}
export const TRACER_SPEED = 420                // m/s: 25 m in ~60 ms, fast enough to read as instant, slow enough to SEE
const STREAK_LEN = 4.5, WAKE_HOLD = 0.12, WAKE_FADE = 0.18
const MAX_SHOTS = 96, MAX_SPARKS = 360, SPARK_LIFE = 0.38

interface Spark { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; hot: boolean }

export function Tracers({ shots, color = '#ffb84a' }: { shots: TracerShot[]; color?: string }) {
  const core = useRef<THREE.InstancedMesh>(null), glow = useRef<THREE.InstancedMesh>(null), wake = useRef<THREE.InstancedMesh>(null)
  const sparksM = useRef<THREE.InstancedMesh>(null)
  const sparks = useRef<Spark[]>([])
  const arrived = useRef(new WeakSet<TracerShot>())
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), d: new THREE.Vector3(), z: new THREE.Vector3(0, 0, 1) }), [])
  const mats = useMemo(() => {
    const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }
    return {
      core: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff8e6'), ...add }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(color), opacity: 0.6, ...add }),
      wake: new THREE.MeshBasicMaterial({ color: new THREE.Color(color), opacity: 0.22, ...add }),
      spark: new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.45), ...add }),
    }
  }, [color])
  // a unit box along +z with its HEAD at the origin (scaling z grows it backward from the head)
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0, -0.5), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20), { m, q, p, s, d, z } = tmp
    let nc = 0, nw = 0
    for (let i = shots.length - 1; i >= 0; i--) {
      const k = shots[i]
      k.age += dt
      const dx = k.tx - k.sx, dy = k.ty - k.sy, dz = k.tz - k.sz, dist = Math.hypot(dx, dy, dz) || 1e-3
      const head = Math.min(dist, k.age * TRACER_SPEED)
      if (head >= dist && !arrived.current.has(k)) {
        arrived.current.add(k)
        const n = k.target ? 14 : 9
        for (let j = 0; j < n && sparks.current.length < MAX_SPARKS; j++) {
          const rx = Math.random() * 2 - 1, ry = Math.random() * 2 - 1, rz = Math.random() * 2 - 1
          const sp = (k.target ? 5 : 3.5) + Math.random() * 4
          const vx = k.nx * 0.7 + rx * 0.6, vy = k.ny * 0.7 + ry * 0.6 + 0.5, vz = k.nz * 0.7 + rz * 0.6
          const l = Math.hypot(vx, vy, vz) || 1, life = SPARK_LIFE * (0.5 + Math.random() * 0.7)
          sparks.current.push({ x: k.tx, y: k.ty, z: k.tz, vx: (vx / l) * sp, vy: (vy / l) * sp, vz: (vz / l) * sp, life, max: life, hot: k.target })
        }
      }
      const after = k.age - dist / TRACER_SPEED                // seconds since the head arrived (<0 = in flight)
      if (after > WAKE_HOLD + WAKE_FADE) { shots.splice(i, 1); continue }
      q.setFromUnitVectors(z, d.set(dx / dist, dy / dist, dz / dist))
      p.set(k.sx + (dx / dist) * head, k.sy + (dy / dist) * head, k.sz + (dz / dist) * head)
      // the head + its streak (only while in flight)
      if (after < 0 && nc < MAX_SHOTS) {
        const len = Math.min(STREAK_LEN, head)
        // the glow fades in over the first metres: at the barrel it sits ~0.4 m from the eye and would fill the screen
        const gw = 0.05 * Math.max(0.15, Math.min(1, (head - 0.6) / 5))
        m.compose(p, q, s.set(0.016, 0.016, len)); core.current?.setMatrixAt(nc, m)
        m.compose(p, q, s.set(gw, gw, len * 1.05)); glow.current?.setMatrixAt(nc, m)
        nc++
      }
      // the wake: the travelled path, thin, thinning out once the head has landed
      if (nw < MAX_SHOTS && head > 1) {
        const f = after < WAKE_HOLD ? 1 : 1 - (after - WAKE_HOLD) / WAKE_FADE
        const w = 0.012 * Math.max(0, f)
        m.compose(p, q, s.set(w, w, Math.max(0.01, head - 0.8))); wake.current?.setMatrixAt(nw, m)
        nw++
      }
    }
    for (const [mesh, n] of [[core.current, nc], [glow.current, nc], [wake.current, nw]] as const) if (mesh) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true }
    // sparks: fly, fall, shrink out
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
  })

  return (
    <>
      <instancedMesh ref={wake} args={[geo, mats.wake, MAX_SHOTS]} frustumCulled={false} renderOrder={9} />
      <instancedMesh ref={glow} args={[geo, mats.glow, MAX_SHOTS]} frustumCulled={false} renderOrder={10} />
      <instancedMesh ref={core} args={[geo, mats.core, MAX_SHOTS]} frustumCulled={false} renderOrder={11} />
      <instancedMesh ref={sparksM} args={[geo, mats.spark, MAX_SPARKS]} frustumCulled={false} renderOrder={11} />
    </>
  )
}
