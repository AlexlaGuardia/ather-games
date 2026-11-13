'use client'

// The DARTER's look, shared by every page that drives one (the test track, the continent). PLACEHOLDER geometry:
// a canon design brief for the Darter is Magii's, not yet asked. It borrows only what canon gives every manalic
// vehicle (world/transportation.md): a mana core and rune-lit channel trim. The group's userData.wheelAngle and
// the `steer` ref drive the wheels; the page places the group.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WHEEL_R } from './courser'

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

// ── the Darter (placeholder geometry): a low coupe, channel trim and a mana core that glow ──
export function DarterModel({ car, steer }: { car: React.MutableRefObject<THREE.Group | null>; steer: React.MutableRefObject<number> }) {
  const wheels = useRef<(THREE.Group | null)[]>([])
  const spinners = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const g = car.current; if (!g) return
    const ang = (g.userData.wheelAngle as number) ?? 0
    spinners.current.forEach(w => { if (w) w.rotation.x = -ang })
    ;[0, 1].forEach(i => { const w = wheels.current[i]; if (w) w.rotation.y = -steer.current })
  })
  const wheelPos: [number, number, number][] = [[-0.86, WHEEL_R, -1.3], [0.86, WHEEL_R, -1.3], [-0.86, WHEEL_R, 1.25], [0.86, WHEEL_R, 1.25]]
  return (
    <group ref={car}>
      <group name="body">
        <mesh position={[0, 0.62, 0]}><boxGeometry args={[1.82, 0.5, 4.3]} /><meshStandardMaterial color="#2c5a86" metalness={0.45} roughness={0.32} /></mesh>
        <mesh position={[0, 0.98, 0.35]}><boxGeometry args={[1.45, 0.42, 1.9]} /><meshStandardMaterial color="#1b2c44" metalness={0.4} roughness={0.25} /></mesh>
        <mesh position={[0, 1.0, -0.62]} rotation-x={0.55}><boxGeometry args={[1.42, 0.05, 0.62]} /><meshStandardMaterial color="#7fd4ff" emissive="#2a6f99" emissiveIntensity={0.5} transparent opacity={0.75} /></mesh>
        {/* channel trim: the rune-lit line canon gives every manalic vehicle */}
        {[-0.92, 0.92].map(x => (
          <mesh key={x} position={[x, 0.6, 0]}><boxGeometry args={[0.04, 0.06, 3.9]} /><meshStandardMaterial color="#d4a843" emissive="#d4a843" emissiveIntensity={1.4} /></mesh>
        ))}
        {/* mana core, behind the cabin */}
        <mesh position={[0, 0.92, 1.75]}><boxGeometry args={[0.7, 0.18, 0.5]} /><meshStandardMaterial color="#6be4ff" emissive="#3ccfff" emissiveIntensity={2} /></mesh>
        {/* lamps */}
        {[-0.62, 0.62].map(x => (
          <mesh key={'h' + x} position={[x, 0.66, -2.16]}><boxGeometry args={[0.38, 0.1, 0.04]} /><meshStandardMaterial color="#fff6dc" emissive="#fff1c4" emissiveIntensity={2} /></mesh>
        ))}
        {[-0.66, 0.66].map(x => (
          <mesh key={'t' + x} position={[x, 0.7, 2.16]}><boxGeometry args={[0.4, 0.08, 0.04]} /><meshStandardMaterial color="#ff4a3a" emissive="#ff2a1a" emissiveIntensity={1.6} /></mesh>
        ))}
        {/* headlights that actually light the road: the track at night is the canon night */}
        <Headlights />
        {/* underglow */}
        <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[1.7, 4]} /><meshBasicMaterial color="#3ccfff" transparent opacity={0.22} /></mesh>
      </group>
      {wheelPos.map((wp, i) => (
        <group key={i} position={wp} ref={el => { wheels.current[i] = el }}>
          <mesh ref={el => { spinners.current[i] = el }} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.3, 12]} />
            <meshLambertMaterial color="#1a1a1e" flatShading />
          </mesh>
          <mesh rotation-z={Math.PI / 2} position={[wp[0] < 0 ? -0.16 : 0.16, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.02, 8]} />
            <meshStandardMaterial color="#d4a843" emissive="#d4a843" emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}
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
