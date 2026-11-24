'use client'

// THE COMPANION, IN THE WORLD (shared/companion.ts picks who; this draws them walking with you).
// It trails the keeper a pace behind and to the right, catches up when you run, and jumps to your side if you
// travel. Each companion gets a code-built BLOCKOUT body (canon look from world/manamals.md; the final look is Alex's
// to judge, per the 09-04 art rule: generated filler never blocks, Alex calls the feel):
//   · Glowmite (firefly): flies, and its light pulses in short/long runs, "patterns seem almost like language".
//     A living thing, so it stays live glow (the art-medium law).
//   · Gemdigger (prairie dog): scurries on the ground in hops; when you stand still it sits up on its haunches, the
//     sentinel pose, and its belly pouch glints with stones.
//   · everyone else: a soft wisp in the companion's colour, a placeholder until their body is built.
//
// Props: the page's pose ref (where the keeper stands each frame) and its ground(x, z).

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FOLLOW } from './idle-mode'
import { skitSlot, reportLying } from './idle-skits'   // M126 s2
import { activeCompanion, subscribeCompanion, companionRev, type CompanionId } from './companion'
import { FORM, joinFormation, leaveFormation, tickFormation, formationSlot, reportFormationPos, sharedBlocked, slotStep, homeStep, BACK } from './follow-formation'   // M126 s1

/** M126 s1: the Mana'mal's body in the formation (Gemdigger ~0.5 m nose to tail; the Glowmite / wisps a little less) */
export const MANAMAL_R = 0.3
const FORM_ID = 'manamal'

export interface FollowPose { x: number; z: number; yaw: number }

const WISP_TINT: Partial<Record<CompanionId, string>> = {
  dustwhisker: '#d9cbe8', tuskroot: '#e0a24a', drifthorn: '#bfe8d0', rootback: '#9bbd6a',
  embermole: '#ff9a5c', prismstrike: '#a6e6ff', sporeling: '#d6b2ff', sporehound: '#c7a86e',
}

export function CompanionFollower({ pose, ground }: { pose: React.MutableRefObject<FollowPose>; ground: (x: number, z: number) => number }) {
  useSyncExternalStore(subscribeCompanion, companionRev, () => 0)
  const c = activeCompanion()
  if (!c) return null
  return <Follower key={c.id} id={c.id} pose={pose} ground={ground} />
}

export function Follower({ id, pose, ground }: { id: CompanionId; pose: React.MutableRefObject<FollowPose>; ground: (x: number, z: number) => number }) {
  const g = useRef<THREE.Group>(null)
  const s = useRef<{ x: number; z: number; yaw: number; speed: number; moving: boolean; still: number; t: number; nap: number; kx: number; kz: number; kv: number; at: number; back: number }>({ x: NaN, z: NaN, yaw: 0, speed: 0, moving: false, still: 0, t: 0, nap: 0, kx: NaN, kz: NaN, kv: 0, at: 0, back: 0 })
  // M126 s1/s3: it walks in the one formation (shared/follow-formation.ts): 3.5 m out, behind and off to one side. Its slot,
  // this far out, is held to the same ground as its steps (a refused one = the other side, or single file)
  useEffect(() => { joinFormation({ id: FORM_ID, kind: 'manamal', r: MANAMAL_R, blocked: (x, z) => !!sharedBlocked(pose.current)?.(x, z) }); return () => leaveFormation(FORM_ID) }, [pose])
  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw), p = pose.current, m = s.current, grp = g.current
    if (!grp) return
    m.t += dt
    // M126 s1: its place is the formation's slot (s3: 3.5 m out, M91's 3-6 m gap); it arrives there (and jumps
    // there after a teleport), and walks to it with every step on free ground (the garden's blocked, where there is one)
    tickFormation(p)
    const slot = formationSlot(FORM_ID) ?? { x: p.x, z: p.z, face: p.yaw - Math.PI }
    if (Number.isFinite(m.kx)) { const kv = Math.hypot(p.x - m.kx, p.z - m.kz) / Math.max(dt, 1e-3); if (kv < 30) m.kv += (kv - m.kv) * Math.min(1, dt * 5) }
    m.kx = p.x; m.kz = p.z
    if (!Number.isFinite(m.x) || Math.hypot(p.x - m.x, p.z - m.z) > FOLLOW.TELEPORT) { m.x = slot.x; m.z = slot.z; m.yaw = p.yaw; m.speed = 0; m.moving = false }
    const px0 = m.x, pz0 = m.z
    // M91 + M126 s2 IDLE (shared/idle-skits.ts): the keeper idles = it wanders a 3-6 m ring round them, sits, naps (lying down);
    // any input = the skit is gone and it walks back to its place
    const sk = skitSlot(FORM_ID, p), to = sk ?? slot
    if (sk?.roam) { m.x = sk.x; m.z = sk.z; m.speed += (sk.roam.speed - m.speed) * Math.min(1, dt * 6); m.moving = false; m.at = 0; m.back = BACK.hold }
    else {
      // off a skit (up to 6 m out) it HURRIES home, in real seconds (homeStep), then its usual gait
      const w = { x: m.x, z: m.z, speed: m.speed, moving: m.moving, at: m.at, back: m.back }, kb = { x: p.x, z: p.z, r: FORM.keeperR + MANAMAL_R }
      const n = m.back > 0 ? homeStep(w, to, m.kv, dtRaw, sharedBlocked(p), kb) : { ...slotStep(w, to, m.kv, dt, sharedBlocked(p), FORM.heelOff, kb), back: 0 }
      m.back = n.back
      m.x = n.x; m.z = n.z; m.speed = n.speed; m.moving = n.moving; m.at = n.at ?? 0
    }
    reportFormationPos(FORM_ID, m.x, m.z)
    const dx = m.x - px0, dz = m.z - pz0
    // face where it goes; at rest, face the way the keeper looks
    const faceTo = m.speed > 0.3 && (dx || dz) ? Math.atan2(-dx, -dz) : to.face + Math.PI   // M126: at rest, its slot's way (out, when the keeper stops); the nose is -z
    let dy = faceTo - m.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); m.yaw += dy * Math.min(1, dt * 5)
    m.still = m.speed < 0.15 ? m.still + dt : 0
    m.nap += ((sk?.act === 'lie' ? 1 : 0) - m.nap) * Math.min(1, dt * 1.5)
    reportLying(FORM_ID, m.nap)
    const gy = ground(m.x, m.z)
    const y = Number.isFinite(gy) ? gy : 0
    grp.position.set(m.x, y, m.z)
    grp.rotation.y = m.yaw
    grp.userData.speed = m.speed; grp.userData.still = m.still; grp.userData.nap = m.nap; grp.userData.t = m.t
  })
  return (
    <group ref={g}>
      {id === 'glowmite' ? <Glowmite /> : id === 'gemdigger' ? <Gemdigger /> : <Wisp tint={WISP_TINT[id] ?? '#ffffff'} />}
    </group>
  )
}

// ── Glowmite: a firefly at shoulder height, its light speaking in runs ─────────────────────────────────────────
// the pulse pattern: on/off durations (s), short and long like a sentence; it loops with a pause
const SPEECH = [0.18, 0.12, 0.18, 0.12, 0.55, 0.25, 0.18, 0.5, 0.55, 0.12, 0.18, 1.4]
const SPEECH_LEN = SPEECH.reduce((a, b) => a + b, 0)
function speechAt(t: number): number {
  let u = t % SPEECH_LEN
  for (let i = 0; i < SPEECH.length; i++) { if (u < SPEECH[i]) { if (i % 2) return 0; const e = Math.min(u, SPEECH[i] - u); return Math.min(1, e / 0.05) } u -= SPEECH[i] }
  return 0
}
/** a soft round falloff, drawn once: the glow round the lantern (a hard-edged sphere read as a grey disc) */
let dot: THREE.Texture | null = null
function softDot(): THREE.Texture {
  if (dot) return dot
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r; g.fillRect(0, 0, 64, 64)
  dot = new THREE.CanvasTexture(c); return dot
}
function Glowmite() {
  const root = useRef<THREE.Group>(null), wl = useRef<THREE.Mesh>(null), wr = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.MeshStandardMaterial>(null), light = useRef<THREE.PointLight>(null), halo = useRef<THREE.Sprite>(null)
  useFrame(() => {
    const r = root.current; if (!r?.parent) return
    const t = (r.parent.userData.t as number) ?? 0, sp = (r.parent.userData.speed as number) ?? 0, nap = (r.parent.userData.nap as number) ?? 0
    // drifts in a slow loose figure-eight round its spot; leans into flight
    r.position.set(Math.sin(t * 0.9) * 0.28 * (1 - nap), 1.55 - nap * 1.2 + Math.sin(t * 1.7) * 0.12 * (1 - nap), Math.sin(t * 1.8) * 0.16 * (1 - nap))   // napping: settles low, nearly still
    r.rotation.x = -Math.min(0.5, sp * 0.08)
    const flap = Math.sin(t * 60) * 0.7 * (1 - nap)
    if (wl.current) wl.current.rotation.z = 0.35 + flap
    if (wr.current) wr.current.rotation.z = -0.35 - flap
    const k = (0.18 + 0.82 * speechAt(t)) * (1 - nap * 0.85)
    if (glow.current) glow.current.emissiveIntensity = 0.6 + 3.4 * k
    if (light.current) light.current.intensity = 0.15 + 1.3 * k
    if (halo.current) { halo.current.scale.setScalar(0.25 + 0.4 * k); halo.current.material.opacity = 0.15 + 0.75 * k }
  })
  return (
    <group ref={root} scale={1.6}>
      {/* head + thorax: dark */}
      <mesh position={[0, 0, -0.05]}><sphereGeometry args={[0.035, 10, 8]} /><meshStandardMaterial color="#2a2230" roughness={0.6} /></mesh>
      <mesh position={[0, 0.005, 0.0]} scale={[1, 0.85, 1.3]}><sphereGeometry args={[0.04, 10, 8]} /><meshStandardMaterial color="#3a2a26" roughness={0.6} /></mesh>
      {/* the lantern: abdomen */}
      <mesh position={[0, -0.01, 0.075]} scale={[0.9, 0.85, 1.35]}>
        <sphereGeometry args={[0.045, 12, 10]} />
        <meshStandardMaterial ref={glow} color="#e8ff9a" emissive="#c8ff5a" emissiveIntensity={2} roughness={0.4} toneMapped={false} />
      </mesh>
      <sprite ref={halo} position={[0, -0.01, 0.075]} scale={0.5}>
        <spriteMaterial map={softDot()} color="#d6ff7a" transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {/* wings: two thin panes, a blur of flapping */}
      <mesh ref={wl} position={[-0.03, 0.035, 0]}><planeGeometry args={[0.1, 0.05]} /><meshBasicMaterial color="#dfe9ff" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <mesh ref={wr} position={[0.03, 0.035, 0]}><planeGeometry args={[0.1, 0.05]} /><meshBasicMaterial color="#dfe9ff" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <pointLight ref={light} color="#d6ff7a" distance={6} decay={2} intensity={1} />
    </group>
  )
}

// ── Gemdigger: a prairie dog. Hops after you; stands sentinel when you stop; the pouch glints ─────────────────
const FUR = '#b98c58', BELLY = '#e4c999', DARK = '#3b2a1c'
const GEMS: { p: [number, number, number]; c: string }[] = [
  { p: [-0.035, 0.0, 0.0], c: '#8fe3ff' }, { p: [0.03, 0.012, 0.01], c: '#c49bff' }, { p: [0.0, -0.025, 0.015], c: '#9dffb8' },
]
function Gemdigger() {
  const body = useRef<THREE.Group>(null), tail = useRef<THREE.Mesh>(null), head = useRef<THREE.Group>(null)
  const gems = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const sit = useRef(0)
  useFrame((_, dt) => {
    const b = body.current; if (!b?.parent) return
    const ud = b.parent.userData, nap = (ud.nap as number) ?? 0, t = (ud.t as number) ?? 0, sp = (ud.speed as number) ?? 0, still = (ud.still as number) ?? 0
    // sit up after a moment of stillness (the sentinel), drop to all fours to move
    const wantSit = still > 0.8 || nap > 0.05 ? 1 : 0
    sit.current += (wantSit - sit.current) * Math.min(1, Math.min(0.05, dt) * (wantSit ? 3 : 10))
    const hop = sp > 0.3 ? Math.abs(Math.sin(t * (8 + sp * 1.6))) * Math.min(0.12, 0.03 + sp * 0.02) : 0
    b.position.y = hop - nap * 0.04   // napping: slumps onto its haunches
    b.rotation.x = sit.current * 1.15 - nap * 0.55 + (sp > 0.3 ? Math.sin(t * (8 + sp * 1.6) * 2) * 0.08 : 0)
    if (head.current) { head.current.rotation.x = -sit.current * 1.0 + nap * 0.9; head.current.rotation.y = sit.current * Math.sin(t * 0.7) * 0.6 * (1 - nap) }
    if (tail.current) tail.current.rotation.x = 0.6 + Math.sin(t * 9) * (sp > 0.3 ? 0.3 : 0.08)
    gems.current.forEach((m, i) => { if (m) m.emissiveIntensity = 0.3 + Math.max(0, Math.sin(t * 2.3 + i * 2.1)) ** 8 * 3.5 })
  })
  return (
    // pivot at the haunches so sitting up rotates about the hips
    <group ref={body} scale={1.15}>
      <group position={[0, 0.11, 0]}>
        {/* torso, nose toward -z */}
        <mesh position={[0, 0.02, -0.1]} rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.095, 0.17, 6, 12]} /><meshStandardMaterial color={FUR} roughness={0.85} /></mesh>
        {/* belly + the pouch */}
        <mesh position={[0, -0.025, -0.1]} rotation={[Math.PI / 2, 0, 0]} scale={[0.85, 1, 0.7]}><capsuleGeometry args={[0.09, 0.14, 6, 12]} /><meshStandardMaterial color={BELLY} roughness={0.9} /></mesh>
        <group position={[0, -0.075, -0.12]}>
          <mesh scale={[1.1, 0.7, 1]}><sphereGeometry args={[0.055, 12, 8]} /><meshStandardMaterial color="#cfae7a" roughness={0.9} /></mesh>
          {GEMS.map((gm, i) => (
            <mesh key={i} position={[gm.p[0], gm.p[1] - 0.02, gm.p[2] - 0.035]} rotation={[i, i * 0.7, 0]}>
              <octahedronGeometry args={[0.017, 0]} />
              <meshStandardMaterial ref={el => { gems.current[i] = el }} color={gm.c} emissive={gm.c} emissiveIntensity={0.5} roughness={0.2} metalness={0.1} toneMapped={false} />
            </mesh>
          ))}
        </group>
        {/* head */}
        <group ref={head} position={[0, 0.06, -0.29]}>
          <mesh scale={[1, 0.9, 1.1]}><sphereGeometry args={[0.075, 14, 10]} /><meshStandardMaterial color={FUR} roughness={0.85} /></mesh>
          <mesh position={[0, -0.018, -0.07]} scale={[1, 0.75, 1]}><sphereGeometry args={[0.035, 10, 8]} /><meshStandardMaterial color={BELLY} roughness={0.9} /></mesh>
          <mesh position={[0, -0.005, -0.1]}><sphereGeometry args={[0.012, 8, 6]} /><meshStandardMaterial color={DARK} /></mesh>
          {[-1, 1].map(sx => (
            <group key={sx}>
              <mesh position={[sx * 0.04, 0.018, -0.055]}><sphereGeometry args={[0.012, 8, 6]} /><meshStandardMaterial color="#120c08" roughness={0.2} /></mesh>
              <mesh position={[sx * 0.05, 0.06, -0.005]} scale={[1, 0.8, 0.5]}><sphereGeometry args={[0.018, 8, 6]} /><meshStandardMaterial color="#a27646" roughness={0.9} /></mesh>
            </group>
          ))}
        </group>
        {/* legs: four stubs */}
        {[[-0.06, -0.2], [0.06, -0.2], [-0.065, 0.0], [0.065, 0.0]].map(([x, z], i) => (
          <mesh key={i} position={[x, -0.085, z]}><capsuleGeometry args={[0.022, 0.05, 4, 8]} /><meshStandardMaterial color="#a27646" roughness={0.9} /></mesh>
        ))}
        {/* tail: short, dark-tipped */}
        <mesh ref={tail} position={[0, 0.0, 0.07]}><capsuleGeometry args={[0.018, 0.07, 4, 8]} /><meshStandardMaterial color={DARK} roughness={0.9} /></mesh>
      </group>
    </group>
  )
}

// ── everyone else, until their body is built: a soft wisp in their colour ─────────────────────────────────────
function Wisp({ tint }: { tint: string }) {
  const r = useRef<THREE.Group>(null)
  const col = useMemo(() => new THREE.Color(tint), [tint])
  useFrame(() => {
    const g = r.current; if (!g?.parent) return
    const t = (g.parent.userData.t as number) ?? 0, nap = (g.parent.userData.nap as number) ?? 0
    g.position.set(0, 1.2 - nap * 0.9 + Math.sin(t * 1.4) * 0.1 * (1 - nap), 0)
    g.scale.setScalar(1 - nap * 0.35)
  })
  return (
    <group ref={r}>
      <mesh><sphereGeometry args={[0.12, 14, 10]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={1.4} toneMapped={false} /></mesh>
      <mesh><sphereGeometry args={[0.28, 14, 10]} /><meshBasicMaterial color={col} transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
      <pointLight color={col} distance={4} decay={2} intensity={0.6} />
    </group>
  )
}
