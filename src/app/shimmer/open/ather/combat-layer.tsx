'use client'

// The Wilds' combat, drawn and driven: reads the camera (the keeper's eye), fires on mouse-down under pointer lock,
// steps combat.ts, and draws Hollows, rounds and grey matter. The rules are in combat.ts; this is the glue.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { newCombat, stepCombat, fire, reload, populate, revive, spawnHollow, HEAD_Y, type Combat, type Terrain, type CombatEvent } from './combat'
import { touch } from '../shared/touch'
import { wakeChampion, tellOf, CHAMP } from './champion'
import { WAKE_R, STRAY_R, type WildsNode } from './nodes'

export interface CombatHud {
  hp: number; maxHp: number; ammo: number; clip: number; reloading: boolean; hurtAt: number; hitAt: number; gun: string
  /** The node champion's bars, when one is up: bar 0..2 is the one being worn down. */
  champ: { bar: number; hp: number; barHp: number; bars: number; open: boolean } | null
}

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

/** The floater: the one Hollow that floats. A sagging blob trailing drips, no legs. It swells when it charges a spit. */
function FloaterBody({ c, id }: { c: React.MutableRefObject<Combat>; id: number }) {
  const g = useRef<THREE.Group>(null), blob = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#26272a', emissive: '#6d6f73', specular: '#eef3f6', shininess: 80, flatShading: true }), [])
  useFrame(({ clock }) => {
    const h = c.current.hollows.find(k => k.id === id); if (!h || !g.current) return
    const t = clock.elapsedTime + id
    g.current.position.set(h.x, h.y, h.z); g.current.rotation.y = h.yaw
    const swell = h.state === 'charge' ? 1 + (1 - h.t / 0.75) * 0.35 : 1
    if (blob.current) blob.current.scale.set(swell * (1 + Math.sin(t * 2.3) * 0.06), swell * (0.85 - Math.sin(t * 2.3) * 0.05), swell)
    const glow = h.state === 'charge' ? 0.25 + (1 - h.t / 0.75) * 0.5 : 0
    mat.emissive.setRGB(0.43 + h.hitFlash * 5 + glow, 0.435 + h.hitFlash * 5 + glow, 0.45 + h.hitFlash * 5 + glow)
  })
  return (
    <group ref={g}>
      <mesh ref={blob} material={mat}><icosahedronGeometry args={[0.48, 1]} /></mesh>
      {[[-0.22, 0.1], [0.18, -0.12], [0.02, 0.22], [0.25, 0.15]].map(([x, z], k) => (
        <mesh key={k} position={[x, -0.5 - k * 0.06, z]} rotation-x={Math.PI} material={mat}><coneGeometry args={[0.08, 0.5 + k * 0.12, 5]} /></mesh>
      ))}
    </group>
  )
}

/** An infected node: a sump of grey goop on the ground, a slumped mound with drips, and a faint grey plume you can
 *  find from across the tile. No colour of its own, like the Hollows that come out of it. */
function NodeMound({ n, y }: { n: WildsNode; y: number }) {
  const mound = useRef<THREE.Mesh>(null), plume = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#26272a', emissive: '#5f6165', specular: '#eef3f6', shininess: 80, flatShading: true }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (mound.current) { const k = 1 + Math.sin(t * 0.9) * 0.05; mound.current.scale.set(k, 0.55 + Math.sin(t * 0.9 + 1) * 0.04, k) }
    if (plume.current) (plume.current.material as THREE.MeshBasicMaterial).opacity = 0.13 + Math.sin(t * 0.6) * 0.04
  })
  return (
    <group position={[n.x, y, n.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.06}><circleGeometry args={[7.5, 18]} /><meshBasicMaterial color="#4a4c50" transparent opacity={0.7} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.08}><ringGeometry args={[7.2, 8.6, 18]} /><meshBasicMaterial color="#6a6d72" transparent opacity={0.35} /></mesh>
      <mesh ref={mound} position-y={0.2} material={mat}><icosahedronGeometry args={[2.4, 1]} /></mesh>
      {[[2.6, 0.4], [-2.2, 1.9], [0.6, -2.9], [-3.4, -1.2], [3.6, -2.4]].map(([x, z], k) => (
        <mesh key={k} position={[x, 0.5 + (k % 3) * 0.2, z]} material={mat}><coneGeometry args={[0.32, 1.4 + (k % 2) * 0.8, 5]} /></mesh>
      ))}
      <mesh ref={plume} position-y={18}><cylinderGeometry args={[1.4, 3.2, 36, 9, 1, true]} /><meshBasicMaterial color="#8a8d92" transparent opacity={0.14} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

/** The node's champion: a shambler grown huge and heavy, a crown of drips, arms like dragged sacks. It sinks into the
 *  ooze between bars. Rears for a slam, leans in for a lunge, swells and brightens for a volley. */
function ChampionBody({ c }: { c: React.MutableRefObject<Combat> }) {
  const g = useRef<THREE.Group>(null), body = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#26272a', emissive: '#6d6f73', specular: '#eef3f6', shininess: 80, flatShading: true }), [])
  useFrame(({ clock }) => {
    const h = c.current.champ; if (!g.current) return
    g.current.visible = !!h; if (!h) return
    const t = clock.elapsedTime, S = CHAMP.height / 1.75
    g.current.position.set(h.x, h.y - h.sink * CHAMP.height * 1.05, h.z)
    g.current.rotation.y = h.yaw
    const p = h.state === 'windup' ? Math.min(1, 1 - h.t / 0.9) : 0
    const lean = h.state === 'windup' ? (h.attack === 'slam' ? -0.4 * p : h.attack === 'lunge' ? -0.25 : -0.1) : h.state === 'act' ? (h.attack === 'slam' ? 0.5 : h.attack === 'lunge' ? 0.6 : 0.1) : h.state === 'recover' ? 0.3 : 0.08
    g.current.rotation.x = THREE.MathUtils.lerp(g.current.rotation.x, lean, 0.2)
    g.current.rotation.z = Math.sin(t * 1.2) * 0.07
    const swell = h.state === 'windup' && h.attack === 'volley' ? 1 + p * 0.22 : 1
    g.current.scale.setScalar(S)
    if (body.current) body.current.scale.set(swell * (1 + Math.sin(t * 1.6) * 0.04), 1 - Math.sin(t * 1.6) * 0.03, swell)
    const glow = h.state === 'windup' ? p * 0.45 : 0, f = h.hitFlash * 4
    mat.emissive.setRGB(0.43 + f + glow, 0.435 + f + glow, 0.45 + f + glow)
  })
  return (
    <group ref={g} visible={false}>
      <mesh ref={body} position-y={0.85} material={mat}><capsuleGeometry args={[0.42, 0.75, 3, 8]} /></mesh>
      <mesh position-y={HEAD_Y} position-z={0.1} material={mat}><icosahedronGeometry args={[0.26, 1]} /></mesh>
      {[[-0.14, 0], [0.12, 0.06], [0, -0.13], [0.15, -0.1], [-0.1, 0.12]].map(([x, z], k) => (
        <mesh key={k} position={[x, HEAD_Y + 0.24, z + 0.08]} material={mat}><coneGeometry args={[0.05, 0.22 + (k % 2) * 0.1, 4]} /></mesh>
      ))}
      <mesh position={[0.46, 0.9, 0.22]} rotation-x={-0.7} material={mat}><capsuleGeometry args={[0.15, 0.85, 2, 6]} /></mesh>
      <mesh position={[-0.46, 0.9, 0.22]} rotation-x={-0.85} material={mat}><capsuleGeometry args={[0.15, 0.85, 2, 6]} /></mesh>
      <mesh position-y={0.03} rotation-x={-Math.PI / 2}><circleGeometry args={[0.8, 12]} /><meshBasicMaterial color="#55585b" transparent opacity={0.55} /></mesh>
    </group>
  )
}

/** The tells, drawn on the ground in a warm warning tone (UI, not the Hollows' colour): a ring that fills for a slam,
 *  a strip along the locked line for a lunge, a fan for a volley. Fill = how far through the windup. */
function Tells({ c, heightAt }: { c: React.MutableRefObject<Combat>; heightAt: (x: number, z: number) => number }) {
  const ring = useRef<THREE.Mesh>(null), fill = useRef<THREE.Mesh>(null), strip = useRef<THREE.Group>(null), fan = useRef<THREE.Group>(null)
  const stripMat = useRef<THREE.MeshBasicMaterial>(null), fanMat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    const tl = tellOf(c.current.champ)
    for (const m of [ring, fill, strip, fan]) if (m.current) m.current.visible = false
    if (!tl) return
    const y = heightAt(tl.x, tl.z) + 0.12, yaw = Math.atan2(tl.ax, tl.az)
    if (tl.kind === 'slam' && ring.current && fill.current) {
      ring.current.visible = fill.current.visible = true
      ring.current.position.set(tl.x, y, tl.z); fill.current.position.set(tl.x, y + 0.01, tl.z)
      fill.current.scale.setScalar(Math.max(0.01, tl.p))
    } else if (tl.kind === 'lunge' && strip.current) {
      strip.current.visible = true
      strip.current.position.set(tl.x, y, tl.z); strip.current.rotation.set(0, yaw, 0)
      if (stripMat.current) stripMat.current.opacity = 0.25 + tl.p * 0.4
    } else if (tl.kind === 'volley' && fan.current) {
      fan.current.visible = true
      fan.current.position.set(tl.x, y, tl.z); fan.current.rotation.set(0, yaw, 0)
      if (fanMat.current) fanMat.current.opacity = 0.18 + tl.p * 0.35
    }
  })
  const warm = { color: '#ffb36b', transparent: true, depthWrite: false, side: THREE.DoubleSide }
  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}><ringGeometry args={[CHAMP.slam.r - 0.25, CHAMP.slam.r, 40]} /><meshBasicMaterial {...warm} opacity={0.85} /></mesh>
      <mesh ref={fill} rotation-x={-Math.PI / 2} visible={false}><circleGeometry args={[CHAMP.slam.r, 40]} /><meshBasicMaterial {...warm} opacity={0.32} /></mesh>
      {/* in a yaw group, local +z is the locked aim; a plane rotated flat runs its length along z */}
      <group ref={strip} visible={false}>
        <mesh rotation-x={-Math.PI / 2} position-z={(CHAMP.lunge.len + 1.5) / 2}><planeGeometry args={[CHAMP.lunge.width, CHAMP.lunge.len + 1.5]} /><meshBasicMaterial ref={stripMat} {...warm} opacity={0.4} /></mesh>
      </group>
      <group ref={fan} visible={false}>
        {/* after the flat turn, sector angle θ points at (cos θ, 0, −sin θ): θ = −π/2 is +z */}
        <mesh rotation-x={-Math.PI / 2}><circleGeometry args={[14, 16, -Math.PI / 2 - CHAMP.volley.fan, CHAMP.volley.fan * 2]} /><meshBasicMaterial ref={fanMat} {...warm} opacity={0.3} /></mesh>
      </group>
    </>
  )
}

export function CombatLayer({ T, locked, frozen, active, safe, onEvents, onHud, reviveKey, nodes = [], ownerOf, armed = true }: {
  T: Terrain
  locked: React.MutableRefObject<boolean>
  frozen: React.MutableRefObject<boolean>
  active: boolean
  safe?: { x: number; z: number; r: number }
  onEvents: (e: CombatEvent[]) => void
  onHud: (h: CombatHud) => void
  reviveKey: number
  /** Infected nodes on this tile: each wakes a champion when the keeper comes close. */
  nodes?: WildsNode[]
  /** Which node's ground a spot is (id), or undefined on a tile with no nodes: strays only well up where it is infected. */
  ownerOf?: (x: number, z: number) => string | undefined
  /** The Repeater is the held slot (the hotbar): only then does a click fire. */
  armed?: boolean
}) {
  const { camera } = useThree()
  const c = useRef<Combat>(newCombat(Date.now() >>> 0))
  const [ids, setIds] = useState<{ id: number; kind: string }[]>([])
  const trigger = useRef(false), popT = useRef(0), hudT = useRef(0)
  const hud = useRef<CombatHud>({ hp: 100, maxHp: 100, ammo: 12, clip: 12, reloading: false, hurtAt: -9, hitAt: -9, gun: c.current.gun.name, champ: null })
  const roundsMesh = useRef<THREE.InstancedMesh>(null), dropsMesh = useRef<THREE.InstancedMesh>(null), spitsMesh = useRef<THREE.InstancedMesh>(null)
  const aim = useMemo(() => new THREE.Vector3(), [])
  const m4 = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), s = useMemo(() => new THREE.Vector3(), [])
  const p = useMemo(() => new THREE.Vector3(), []), fwd = useMemo(() => new THREE.Vector3(0, 0, 1), [])

  const nodesRef = useRef(nodes); nodesRef.current = nodes
  const armedRef = useRef(armed); armedRef.current = armed
  const ownerRef = useRef(ownerOf); ownerRef.current = ownerOf
  const spent = useRef(new Set<string>())   // cleared this visit: never re-woken before the page drops it
  useEffect(() => { revive(c.current); setIds([]) }, [reviveKey])
  useEffect(() => {
    const down = (e: MouseEvent) => { if (e.button === 0 && locked.current && !frozen.current) trigger.current = true }
    const up = (e: MouseEvent) => { if (e.button === 0) trigger.current = false }
    const key = (e: KeyboardEvent) => { if (e.code === 'KeyR' && !frozen.current) reload(c.current) }
    window.addEventListener('mousedown', down); window.addEventListener('mouseup', up); window.addEventListener('keydown', key)
    // probes for tests and scripted shots
    const g = window as unknown as { __ather?: Record<string, unknown> }
    g.__ather = { ...(g.__ather ?? {}), combat: () => c.current, spawn: (dx = 0, dz = -10, kind: 'shambler' | 'floater' = 'shambler') => {
      const f = camera.getWorldDirection(new THREE.Vector3()); const x = camera.position.x + f.x * -dz + dx, z = camera.position.z + f.z * -dz
      spawnHollow(c.current, T, x, z, kind)
    }, nodes: () => nodesRef.current, wake: (i = 0) => { const n = nodesRef.current[i]; if (n && !c.current.champ) wakeChampion(c.current, T, n) } }
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); window.removeEventListener('keydown', key) }
  }, [locked, frozen, camera, T])

  useFrame((_, rawDt) => {
    if (!active) return
    const dt = Math.min(rawDt, 1 / 20), C = c.current
    const feet = { x: camera.position.x, y: camera.position.y - EYE, z: camera.position.z }
    popT.current -= dt
    // a champion rises out of an infected node when the keeper comes close
    if (!C.champ && C.keeper.hp > 0) for (const n of nodesRef.current) {
      if (!spent.current.has(n.id) && Math.hypot(n.x - feet.x, n.z - feet.z) < WAKE_R) { wakeChampion(C, T, n); break }
    }
    if (popT.current <= 0) {
      popT.current = 1.5
      // strays thicken round an infected node; during a champion fight the waves are the only adds
      const near = nodesRef.current.some(n => !spent.current.has(n.id) && Math.hypot(n.x - feet.x, n.z - feet.z) < STRAY_R)
      const own = ownerRef.current
      const infested = own ? (x: number, z: number) => { const id = own(x, z); return !id || (!spent.current.has(id) && nodesRef.current.some(n => n.id === id)) } : undefined
      populate(C, T, feet.x, feet.z, C.champ ? 0 : near ? 11 : 7, safe, infested)
    }
    if ((trigger.current || touch.fire) && !frozen.current && armedRef.current) {
      camera.getWorldDirection(aim)
      fire(C, camera.position, aim)
      if (!C.gun.auto) { trigger.current = false; touch.fire = false }
    }
    stepCombat(C, T, feet, dt)
    if (C.events.length) {
      const now = performance.now() / 1000
      for (const e of C.events) {
        if (e.kind === 'hurt') hud.current.hurtAt = now; if (e.kind === 'hit') hud.current.hitAt = now
        if (e.kind === 'champ-down') {
          spent.current.add(e.nodeId)
          // its ground goes quiet at once: the Hollows standing on it melt back into nothing (no drops; the chunk is the pay)
          const own = ownerRef.current
          if (own) C.hollows = C.hollows.filter(h => own(h.x, h.z) !== e.nodeId)
        }
      }
      onEvents(C.events)
    }
    // keep the list of drawn bodies in step with the sim
    if (C.hollows.length !== ids.length || C.hollows.some((h, i) => h.id !== ids[i].id)) setIds(C.hollows.map(h => ({ id: h.id, kind: h.kind })))
    const sm = spitsMesh.current
    if (sm) {
      const n = Math.min(C.spits.length, 32)
      for (let i = 0; i < n; i++) { const sp = C.spits[i]; p.set(sp.x, sp.y, sp.z); m4.compose(p, q.identity(), s.set(1, 1, 1)); sm.setMatrixAt(i, m4) }
      sm.count = n; sm.instanceMatrix.needsUpdate = true
    }
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
      const ch = C.champ
      onHud({ ...hud.current, hp: k.hp, maxHp: k.maxHp, ammo: k.ammo, clip: C.gun.clip, reloading: k.reloading > 0,
        champ: ch ? { bar: ch.bar, hp: ch.hp, barHp: CHAMP.barHp, bars: CHAMP.bars, open: ch.state !== 'rise' && ch.state !== 'submerge' && ch.state !== 'home' } : null })
    }
  })

  if (!active) return null
  return (
    <>
      {nodes.filter(n => !spent.current.has(n.id)).map(n => <NodeMound key={n.id} n={n} y={T.heightAt(n.x, n.z)} />)}
      <ChampionBody c={c} />
      <Tells c={c} heightAt={T.heightAt} />
      {ids.map(h => h.kind === 'floater' ? <FloaterBody key={h.id} c={c} id={h.id} /> : <HollowBody key={h.id} c={c} id={h.id} />)}
      <instancedMesh ref={spitsMesh} args={[undefined, undefined, 32]} frustumCulled={false}>
        <icosahedronGeometry args={[0.3, 0]} /><meshPhongMaterial color="#3a3c40" emissive="#8a8d92" specular="#ffffff" shininess={90} flatShading />
      </instancedMesh>
      <instancedMesh ref={roundsMesh} args={[undefined, undefined, 64]} frustumCulled={false}>
        <boxGeometry args={[0.05, 0.05, 0.9]} /><meshBasicMaterial color="#fff2c4" />
      </instancedMesh>
      <instancedMesh ref={dropsMesh} args={[undefined, undefined, 64]} frustumCulled={false}>
        <octahedronGeometry args={[0.22, 0]} /><meshPhongMaterial color="#9a9ca0" specular="#ffffff" shininess={90} flatShading emissive="#3a3c40" />
      </instancedMesh>
    </>
  )
}
