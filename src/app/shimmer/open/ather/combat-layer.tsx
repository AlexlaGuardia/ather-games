'use client'

// The Wilds' combat, drawn and driven: reads the camera (the keeper's eye), fires on mouse-down under pointer lock,
// steps combat.ts, and draws Hollows, rounds and grey matter. The rules are in combat.ts; this is the glue.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { newCombat, stepCombat, fire, reload, populate, revive, spawnHollow, HEAD_Y, type Combat, type Terrain, type CombatEvent } from './combat'

export interface CombatHud { hp: number; maxHp: number; ammo: number; clip: number; reloading: boolean; hurtAt: number; hitAt: number; gun: string }

const EYE = 1.62   // locomotion eye height over the feet (approx; damage only needs the feet)

/** One Hollow: goop with no colour of its own (design-briefs/hollows.md): diffuse dead flat grey, specular high so
 *  it borrows the world's light. A sag and sway carries the shamble; the lunge leans in. */
function HollowBody({ c, id }: { c: React.MutableRefObject<Combat>; id: number }) {
  const g = useRef<THREE.Group>(null), body = useRef<THREE.Mesh>(null), head = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#26272a', emissive: '#6d6f73', specular: '#eef3f6', shininess: 80, flatShading: true }), [])
  useFrame(({ clock }) => {
    const h = c.current.hollows.find(k => k.id === id); if (!h || !g.current) return
    const t = clock.elapsedTime + id * 1.3
    g.current.position.set(h.x, h.y, h.z)
    g.current.rotation.y = h.yaw
    const lean = h.state === 'windup' ? -0.35 : h.state === 'lunge' ? 0.55 : h.state === 'stagger' ? -0.25 : 0.12
    g.current.rotation.x = THREE.MathUtils.lerp(g.current.rotation.x, lean, 0.25)
    g.current.rotation.z = Math.sin(t * (h.state === 'chase' ? 3.4 : 1.6)) * 0.12
    if (body.current) body.current.scale.set(1 + Math.sin(t * 2.1) * 0.05, 1 - Math.sin(t * 2.1) * 0.04, 1)
    mat.emissive.setRGB(0.43 + h.hitFlash * 5, 0.435 + h.hitFlash * 5, 0.45 + h.hitFlash * 5)
    if (head.current) head.current.position.y = HEAD_Y + Math.sin(t * 1.7) * 0.04
  })
  return (
    <group ref={g}>
      <mesh ref={body} position-y={0.85} material={mat}><capsuleGeometry args={[0.36, 0.8, 3, 7]} /></mesh>
      <mesh ref={head} position-y={HEAD_Y} position-z={0.08} material={mat}><icosahedronGeometry args={[0.24, 0]} /></mesh>
      {/* arms that hang forward: the drowned reach */}
      <mesh position={[0.36, 1.05, 0.28]} rotation-x={-1.1} material={mat}><capsuleGeometry args={[0.09, 0.55, 2, 5]} /></mesh>
      <mesh position={[-0.36, 1.05, 0.28]} rotation-x={-1.25} material={mat}><capsuleGeometry args={[0.09, 0.55, 2, 5]} /></mesh>
      {/* the drip: a puddle that follows */}
      <mesh position-y={0.03} rotation-x={-Math.PI / 2}><circleGeometry args={[0.55, 9]} /><meshBasicMaterial color="#55585b" transparent opacity={0.55} /></mesh>
    </group>
  )
}

export function CombatLayer({ T, locked, frozen, active, safe, onEvents, onHud, reviveKey }: {
  T: Terrain
  locked: React.MutableRefObject<boolean>
  frozen: React.MutableRefObject<boolean>
  active: boolean
  safe?: { x: number; z: number; r: number }
  onEvents: (e: CombatEvent[]) => void
  onHud: (h: CombatHud) => void
  reviveKey: number
}) {
  const { camera } = useThree()
  const c = useRef<Combat>(newCombat(Date.now() >>> 0))
  const [ids, setIds] = useState<number[]>([])
  const trigger = useRef(false), popT = useRef(0), hudT = useRef(0)
  const hud = useRef<CombatHud>({ hp: 100, maxHp: 100, ammo: 12, clip: 12, reloading: false, hurtAt: -9, hitAt: -9, gun: c.current.gun.name })
  const roundsMesh = useRef<THREE.InstancedMesh>(null), dropsMesh = useRef<THREE.InstancedMesh>(null)
  const aim = useMemo(() => new THREE.Vector3(), [])
  const m4 = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), s = useMemo(() => new THREE.Vector3(), [])
  const p = useMemo(() => new THREE.Vector3(), []), fwd = useMemo(() => new THREE.Vector3(0, 0, 1), [])

  useEffect(() => { revive(c.current); setIds([]) }, [reviveKey])
  useEffect(() => {
    const down = (e: MouseEvent) => { if (e.button === 0 && locked.current && !frozen.current) trigger.current = true }
    const up = (e: MouseEvent) => { if (e.button === 0) trigger.current = false }
    const key = (e: KeyboardEvent) => { if (e.code === 'KeyR' && !frozen.current) reload(c.current) }
    window.addEventListener('mousedown', down); window.addEventListener('mouseup', up); window.addEventListener('keydown', key)
    // probes for tests and scripted shots
    const g = window as unknown as { __ather?: Record<string, unknown> }
    g.__ather = { ...(g.__ather ?? {}), combat: () => c.current, spawn: (dx = 0, dz = -10) => {
      const f = camera.getWorldDirection(new THREE.Vector3()); const x = camera.position.x + f.x * -dz + dx, z = camera.position.z + f.z * -dz
      spawnHollow(c.current, T, x, z)
    } }
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); window.removeEventListener('keydown', key) }
  }, [locked, frozen, camera, T])

  useFrame((_, rawDt) => {
    if (!active) return
    const dt = Math.min(rawDt, 1 / 20), C = c.current
    const feet = { x: camera.position.x, y: camera.position.y - EYE, z: camera.position.z }
    popT.current -= dt
    if (popT.current <= 0) { popT.current = 1.5; populate(C, T, feet.x, feet.z, 7, safe) }
    if (trigger.current && !frozen.current) {
      camera.getWorldDirection(aim)
      fire(C, camera.position, aim)
      if (!C.gun.auto) trigger.current = false
    }
    stepCombat(C, T, feet, dt)
    if (C.events.length) {
      const now = performance.now() / 1000
      for (const e of C.events) { if (e.kind === 'hurt') hud.current.hurtAt = now; if (e.kind === 'hit') hud.current.hitAt = now }
      onEvents(C.events)
    }
    // keep the list of drawn bodies in step with the sim
    const live = C.hollows.map(h => h.id)
    if (live.length !== ids.length || live.some((v, i) => v !== ids[i])) setIds(live)
    // rounds as streaks
    const rm = roundsMesh.current
    if (rm) {
      const n = Math.min(C.rounds.length, 64)
      for (let i = 0; i < n; i++) {
        const r = C.rounds[i]
        p.set(r.x, r.y, r.z); s.set(r.vx, r.vy, r.vz).normalize(); q.setFromUnitVectors(fwd, s)
        m4.compose(p, q, s.set(1, 1, 1)); rm.setMatrixAt(i, m4)
      }
      rm.count = n; rm.instanceMatrix.needsUpdate = true
    }
    const dm = dropsMesh.current
    if (dm) {
      const n = Math.min(C.drops.length, 64), t = performance.now() / 1000
      for (let i = 0; i < n; i++) {
        const d = C.drops[i]
        p.set(d.x, d.y + 0.45 + Math.sin(t * 2.4 + d.id) * 0.12, d.z); q.setFromAxisAngle(s.set(0, 1, 0), t * 1.5 + d.id)
        m4.compose(p, q, s.set(1, 1, 1).multiplyScalar(0.8 + d.amount * 0.15)); dm.setMatrixAt(i, m4)
      }
      dm.count = n; dm.instanceMatrix.needsUpdate = true
    }
    hudT.current -= dt
    if (hudT.current <= 0) {
      hudT.current = 0.08
      const k = C.keeper
      onHud({ ...hud.current, hp: k.hp, maxHp: k.maxHp, ammo: k.ammo, clip: C.gun.clip, reloading: k.reloading > 0 })
    }
  })

  if (!active) return null
  return (
    <>
      {ids.map(id => <HollowBody key={id} c={c} id={id} />)}
      <instancedMesh ref={roundsMesh} args={[undefined, undefined, 64]} frustumCulled={false}>
        <boxGeometry args={[0.05, 0.05, 0.9]} /><meshBasicMaterial color="#fff2c4" />
      </instancedMesh>
      <instancedMesh ref={dropsMesh} args={[undefined, undefined, 64]} frustumCulled={false}>
        <octahedronGeometry args={[0.22, 0]} /><meshPhongMaterial color="#9a9ca0" specular="#ffffff" shininess={90} flatShading emissive="#3a3c40" />
      </instancedMesh>
    </>
  )
}
