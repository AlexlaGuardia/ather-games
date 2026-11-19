'use client'

// The DARTER's look, shared by every page that drives one (the test track, the continent). PLACEHOLDER geometry:
// a canon design brief for the Darter is Magii's, not yet asked. It borrows only what canon gives every manalic
// vehicle (world/transportation.md): a mana core and rune-lit channel trim. The group's userData.wheelAngle and
// the `steer` ref drive the wheels; the page places the group.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WHEEL_R } from './courser'
import { buildCourser, animateCourser } from './courser-model'

function Headlights() {
  const target = useMemo(() => { const o = new THREE.Object3D(); o.position.set(0, 0, -22); return o }, [])
  return (
    <>
      <primitive object={target} />
      <spotLight position={[0, 0.8, -2.2]} target={target} angle={0.55} penumbra={0.5} intensity={60} distance={70} decay={1.2} color="#fff2d0" />
      <pointLight position={[0, 0.3, 0]} color="#3ccfff" intensity={3} distance={5} decay={2} />
    </>
  )
}

// ── THE COURSER BODIES (BETA M35, Alex's pick 11-19): courser-model.ts builds them (Darter carriage-born, every other kind
// chunky). This wrapper keeps the old props: `car` is the group the page places, its userData.wheelAngle (the physics' roll at
// WHEEL_R) and `steer` drive the wheels; speed for the trim and core comes from how fast that angle turns. Visual only.
/** `look` (M14 courser lots, business/courser-lot.ts): the kind + paint + proportions. Absent: the stock Darter. */
export function DarterModel({ car, steer, look }: { car: React.MutableRefObject<THREE.Group | null>; steer: React.MutableRefObject<number>
  look?: { kind: 'darter' | 'hauler' | 'scrambler' | 'skitter'; body: string; cabin: string; len: number; wide: number; tall: number } }) {
  const key = look ? `${look.kind}|${look.body}|${look.cabin}|${look.len}|${look.wide}|${look.tall}` : 'stock'
  const rig = useMemo(() => buildCourser(look ?? { kind: 'darter', body: '#2c5a86', cabin: '#1b2c44', len: 1, wide: 1, tall: 1 }), [key])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { rig.root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose() } }) }, [rig])
  const last = useRef<{ a: number; mph: number } | null>(null)
  useFrame(({ clock }, dt) => {
    const g = car.current; if (!g) return
    const ang = (g.userData.wheelAngle as number) ?? 0
    const L = last.current ?? { a: ang, mph: 0 }
    const mph = dt > 0 ? Math.abs(ang - L.a) * WHEEL_R / dt * 2.237 : L.mph
    last.current = { a: ang, mph: L.mph + (mph - L.mph) * Math.min(1, dt * 6) }   // eased: the angle steps unevenly frame to frame
    animateCourser(rig, ang * WHEEL_R / rig.R, steer.current, last.current.mph, clock.elapsedTime, dt)
  })
  return (
    <group ref={car}>
      <primitive object={rig.root} />
      {/* headlights that actually light the road: the track at night is the canon night */}
      <Headlights />
      {/* underglow: the mana core's spill on the road */}
      <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[1.7, 4]} /><meshBasicMaterial color="#3ccfff" transparent opacity={0.22} /></mesh>
    </group>
  )
}


// ── DRIFT FX: skid marks laid on the ground + tyre smoke, from the rear wheels while the tyres are sliding ──
// Both are ring buffers of instances (no allocation per frame). Every instanced batch sets frustumCulled={false}:
// three.js culls an InstancedMesh by its base geometry at the origin, not by where the marks are (the 11-13 bug).
const SKIDS = 900, PUFFS = 140
const REAR: [number, number][] = [[-0.86, 1.25], [0.86, 1.25]]
type CarLike = { x: number; y: number; z: number; yaw: number; vx: number; vz: number; airborne: boolean; drift: boolean }

export function DriftFx({ car, ground, slip }: { car: React.MutableRefObject<CarLike>; ground: (x: number, z: number) => number; slip: () => number }) {
  const skid = useRef<THREE.InstancedMesh>(null), puff = useRef<THREE.InstancedMesh>(null)
  const st = useMemo(() => ({
    last: [null, null] as (THREE.Vector3 | null)[], si: 0, pi: 0, spawn: 0,
    puffs: Array.from({ length: PUFFS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 9, life: 1 })),
  }), [])
  const m = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), e = useMemo(() => new THREE.Euler(), [])
  const sc = useMemo(() => new THREE.Vector3(), []), pos = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    // park every instance out of sight until it is used
    const hide = new THREE.Matrix4().makeScale(0, 0, 0)
    for (let k = 0; k < SKIDS; k++) skid.current!.setMatrixAt(k, hide)
    for (let k = 0; k < PUFFS; k++) puff.current!.setMatrixAt(k, hide)
    skid.current!.instanceMatrix.needsUpdate = true; puff.current!.instanceMatrix.needsUpdate = true
  }, [])
  useFrame((_, dt) => {
    const c = car.current, sk = skid.current, pf = puff.current
    if (!sk || !pf) return
    const sp = Math.hypot(c.vx, c.vz)
    const sliding = !c.airborne && sp > 5 && (c.drift || slip() > 0.22)
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw)
    REAR.forEach(([lx, lz], w) => {
      const x = c.x + rx * lx - fx * lz, z = c.z + rz * lx - fz * lz
      const y = ground(x, z)
      if (!sliding || !Number.isFinite(y)) { st.last[w] = null; return }
      const here = new THREE.Vector3(x, y + 0.035, z)
      const prev = st.last[w]
      if (prev && prev.distanceTo(here) > 0.35) {
        const len = prev.distanceTo(here)
        if (len < 6) {
          pos.copy(prev).add(here).multiplyScalar(0.5)
          e.set(0, Math.atan2(here.x - prev.x, here.z - prev.z), 0); q.setFromEuler(e)
          sc.set(0.26, 1, len)
          sk.setMatrixAt(st.si, m.compose(pos, q, sc)); st.si = (st.si + 1) % SKIDS
          sk.instanceMatrix.needsUpdate = true
        }
        st.last[w] = here
      } else if (!prev) st.last[w] = here
    })
    // smoke: spawn while sliding, puffs drift up and outward, grow, then shrink away
    if (sliding) {
      st.spawn += dt * (c.drift ? 20 : 10)
      while (st.spawn >= 1) {
        st.spawn -= 1
        const [lx, lz] = REAR[st.pi % 2]
        const p = st.puffs[st.pi]
        p.p.set(c.x + rx * lx - fx * lz, ground(c.x, c.z) + 0.3, c.z + rz * lx - fz * lz)
        // left BEHIND where the tyre was (the first pass rode along with the car and walled it off from the camera)
        p.v.set(c.vx * 0.04 + (Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.6, c.vz * 0.04 + (Math.random() - 0.5) * 1.2)
        p.age = 0; p.life = 0.9 + Math.random() * 0.6
        st.pi = (st.pi + 1) % PUFFS
      }
    }
    q.identity()
    st.puffs.forEach((p, k) => {
      if (p.age >= p.life) { sc.set(0, 0, 0) }
      else {
        p.age += dt
        p.p.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-dt * 2.2))
        const t = p.age / p.life, s = 0.25 + 0.9 * Math.sin(Math.min(1, t) * Math.PI) * (0.5 + t)
        sc.setScalar(Math.max(0, s))
      }
      pf.setMatrixAt(k, m.compose(p.p, q, sc))
    })
    pf.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh frustumCulled={false} ref={skid} args={[undefined, undefined, SKIDS]} renderOrder={1}>
        <boxGeometry args={[1, 0.01, 1]} />
        <meshBasicMaterial color="#1c1a18" transparent opacity={0.55} depthWrite={false} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={puff} args={[undefined, undefined, PUFFS]}>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshLambertMaterial color="#ecebe6" transparent opacity={0.22} depthWrite={false} flatShading />
      </instancedMesh>
    </>
  )
}

// ── SPEED FEEL (Alex 11-13: "next is the speed feel"). Shared by both drive pages so they cannot drift apart. ──
// `frac` is speed as a fraction of the car's own top speed, so an upgraded car FEELS faster at its top end too.

/** The chase camera's shape at a given speed: the view widens, the camera pulls back and drops a little. */
export function chaseShape(frac: number): { fov: number; back: number; height: number } {
  const f = Math.max(0, Math.min(1, frac))
  const e = f * f * (3 - 2 * f)
  return { fov: 64 + 24 * e, back: 6.6 + 2.2 * e, height: 2.4 - 0.5 * e }
}

/** A low road-rumble for the camera at speed: smooth (layered sines), not per-frame random jitter. */
export function speedRumble(frac: number, time: number): [number, number] {
  const a = 0.045 * Math.max(0, frac - 0.35) ** 2 * 2.4
  return [a * (Math.sin(time * 37) + 0.5 * Math.sin(time * 61 + 1.3)), a * (Math.sin(time * 43 + 0.7) + 0.5 * Math.sin(time * 71))]
}

/** Streaks at the screen's edge near top speed: DOM over the canvas, clear in the middle where you look. */
export function SpeedStreaks({ frac }: { frac: number }) {
  const o = Math.max(0, Math.min(1, (frac - 0.66) / 0.3)) * 0.32   // felt more than seen (0.5 crowded the sky)
  if (o <= 0.01) return null
  return (
    <div aria-hidden style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', opacity: o,
      background: 'repeating-conic-gradient(from 0deg at 50% 46%, rgba(255,255,255,0.0) 0deg 2.2deg, rgba(255,255,255,0.55) 2.4deg 2.6deg, rgba(255,255,255,0) 2.8deg 7deg)',
      WebkitMaskImage: 'radial-gradient(ellipse 62% 58% at 50% 46%, transparent 55%, black 100%)',
      maskImage: 'radial-gradient(ellipse 62% 58% at 50% 46%, transparent 55%, black 100%)',
      animation: 'atherStreak 0.18s steps(3) infinite',
    }}>
      <style>{'@keyframes atherStreak { 0% { transform: rotate(0deg) scale(1) } 50% { transform: rotate(1.3deg) scale(1.02) } 100% { transform: rotate(-0.8deg) scale(1.01) } }'}</style>
    </div>
  )
}

/** Roadside posts: what whips past is the strongest speed cue there is, and open grass gives the eye nothing.
 *  `posts` are [x, z] pairs; one instanced batch (never culled, see DriftFx). */
export function RoadPosts({ posts, ground }: { posts: [number, number][]; ground: (x: number, z: number) => number }) {
  const pole = useRef<THREE.InstancedMesh>(null), cap = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3()
    posts.forEach(([x, z], k) => {
      const y = ground(x, z)
      p.set(x, y + 0.5, z); s.set(0.14, 1, 0.14); pole.current!.setMatrixAt(k, m.compose(p, q, s))
      p.set(x, y + 0.86, z); s.set(0.16, 0.16, 0.16); cap.current!.setMatrixAt(k, m.compose(p, q, s))
    })
    pole.current!.instanceMatrix.needsUpdate = true; cap.current!.instanceMatrix.needsUpdate = true
  }, [posts, ground])
  const n = Math.max(1, posts.length)
  return (
    <>
      <instancedMesh frustumCulled={false} ref={pole} args={[undefined, undefined, n]}><boxGeometry /><meshLambertMaterial color="#efeae0" /></instancedMesh>
      <instancedMesh frustumCulled={false} ref={cap} args={[undefined, undefined, n]}><boxGeometry /><meshStandardMaterial color="#d4a843" emissive="#d4a843" emissiveIntensity={0.9} /></instancedMesh>
    </>
  )
}
