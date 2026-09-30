'use client'
// StillwindScene.tsx — THE SLACK and THE STILLWIND, drawn. The sim is `stillwind.ts`; this only reads it.
//
// Canon (athernyx f77d125, season-01-lenna.md › The colossus): every colossus is its world embodied under the
// flood's inky black ooze. The Stillwind is Lenna's wind given a body — long streaming limbs and sail-like reaches,
// balanced to walk a line — with deep red-gold core-light where the ooze thins. Never Lenn-shaped. Toward the Glare
// the ooze boils thin and the light shows (open); toward the Rime it stiffens and frosts (brittle). The Slack is
// the Lenn's word for where the wind dies. Jin's: the model, the ooze look, how heat and frost show, the terrain.
//
// Built from primitives on purpose (a first model, placeholder-grade geometry against a ruled look): a tall keel
// of a body, four streaming limbs, and two sail reaches that swing wide to keep its balance on the line.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STILLWIND_TUNING as T, simToEdge, LEE_STONES, LEE_HALF, type StillwindState } from './stillwind'
import { slack as SL } from './scene-palette'

export interface EdgeRun { sim: StillwindState | null; slow: number; since: number; flash: string | null }

const WIND_MAX = 90
const H = 7.5   // its height, world units

export function StillwindScene({ edgeRef }: { edgeRef: React.RefObject<EdgeRun> }) {
  const body = useRef<THREE.Group>(null)
  const limbs = useRef<THREE.Group[]>([])
  const sails = useRef<THREE.Group[]>([])
  const wind = useRef<THREE.InstancedMesh>(null)
  const ooze = useMemo(() => new THREE.MeshStandardMaterial({ color: SL.ooze, roughness: 0.18, metalness: 0.2, emissive: new THREE.Color(SL.coreDeep), emissiveIntensity: 0.15 }), [])
  const sailMat = useMemo(() => new THREE.MeshStandardMaterial({ color: SL.ooze, roughness: 0.3, metalness: 0.1, side: THREE.DoubleSide, emissive: new THREE.Color(SL.coreDeep), emissiveIntensity: 0.1, transparent: true, opacity: 0.92 }), [])
  const core = useMemo(() => new THREE.MeshBasicMaterial({ color: SL.core, toneMapped: false }), [])
  // the wind: streaks pouring off the Rime toward the Glare (canon: the wind always comes off the ice)
  const streaks = useMemo(() => Array.from({ length: WIND_MAX }, (_, i) => ({
    x: (((i * 37) % 97) / 97) * T.halfWidth * 2 - T.halfWidth, z: (((i * 61) % 89) / 89) * T.length, y: 0.4 + ((i * 13) % 7) * 0.35, v: 7 + ((i * 17) % 5),
  })), [])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), frost: new THREE.Color(SL.frost), black: new THREE.Color(SL.ooze), c: new THREE.Color() }), [])
  const cx = T.halfWidth + 1
  const sweep = useRef<THREE.Mesh>(null)
  const sweepMat = useMemo(() => new THREE.MeshBasicMaterial({ color: SL.glare, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false }), [])

  useFrame((state, dt) => {
    const e = edgeRef.current, sim = e?.sim
    const t = state.clock.elapsedTime
    if (body.current && sim) {
      const at = simToEdge(sim.x, sim.z)
      body.current.visible = !sim.felled
      body.current.position.set(at.x, 0, at.z)
      // it faces the way it walks along the band; a lean toward whichever side is drawing it off its line
      body.current.rotation.set(0, sim.wind === 'running' ? (sim.runDir > 0 ? 0 : Math.PI) : 0, -sim.x * 0.02)
      // heat: the ooze boils thin and the core shows; open = the light pours through. cold: it stiffens and frosts
      const open = sim.mood === 'open', brittle = sim.mood === 'brittle'
      const heat = open ? 1 : sim.heat, cold = brittle ? 1 : sim.cold
      ooze.emissiveIntensity = 0.15 + heat * (open ? 2.4 + Math.sin(t * 9) * 0.4 : 1.1)
      tmp.c.copy(tmp.black).lerp(tmp.frost, cold * 0.55)
      ooze.color.copy(tmp.c); sailMat.color.copy(tmp.c)
      ooze.roughness = 0.18 + cold * 0.6
      sailMat.emissiveIntensity = 0.1 + heat * 1.2
      core.color.set(open ? SL.core : SL.coreDeep)
      // ★ THE SWING'S TELL (09-29): as it draws back the core flares and the body leans back, so a keeper sees it coming
      const swing = sim.swingT ?? 0
      if (swing > 0) { ooze.emissiveIntensity += 1.6 * (1 - swing / T.windup); body.current.rotation.x = -0.25 * (1 - swing / T.windup) }
      else body.current.rotation.x = 0
      // limbs stream with the walk; brittle = stiff, open = slack; running = swept back
      const sway = brittle ? 0.05 : open ? 0.02 : 0.35
      limbs.current.forEach((g, i) => { if (g) g.rotation.set(Math.sin(t * 1.7 + i * 1.3) * sway + (sim.wind === 'running' ? 0.6 : 0), 0, (i % 2 ? 1 : -1) * (0.25 + Math.sin(t * 1.1 + i) * sway * 0.4)) })
      // the sails swing wide to keep its balance on the line, and wider the further it is drawn off
      sails.current.forEach((g, i) => { if (g) g.rotation.set(0, 0, (i ? -1 : 1) * (1.1 + Math.min(0.5, Math.abs(sim.x) * 0.08) + Math.sin(t * 0.8 + i) * (brittle ? 0.02 : 0.12))) })
    }
    // ★ THE SWEEP'S MARK (phase 2+, 09-29): the stretch of the band it will strike, filling as it comes
    if (sweep.current) {
      const on = !!sim && (sim.sweepT ?? 0) > 0
      sweep.current.visible = on
      if (on && sim) {
        const at = simToEdge(0, sim.sweepZ ?? 0), f = 1 - (sim.sweepT ?? 0) / T.sweepTell
        sweep.current.position.set(cx, 0.06, at.z)
        sweepMat.opacity = 0.18 + 0.5 * f + Math.sin(t * 14) * 0.06
      }
    }
    // the wind stops when it walks: streaks freeze and fade while the wind is stalled or it is running the line
    if (wind.current) {
      const still = !sim || sim.wind !== 'blowing'
      for (let i = 0; i < WIND_MAX; i++) {
        const w = streaks[i]
        if (!still) { w.x += w.v * dt; if (w.x > T.halfWidth) w.x -= T.halfWidth * 2 }
        tmp.p.set(w.x + cx, w.y, w.z + 1)
        tmp.s.set(still ? 0 : 1, 1, 1)
        tmp.m.compose(tmp.p, tmp.q, tmp.s)
        wind.current.setMatrixAt(i, tmp.m)
      }
      wind.current.instanceMatrix.needsUpdate = true
    }
  })

  const len = T.length + 1
  return (
    <>
      {/* Lenna's ground under it all (the zone's floor tiles draw the Ather's grass): dim, red, near-black */}
      <mesh position={[cx, 0.02, len / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[T.halfWidth * 2 + 1, len]} /><meshStandardMaterial color={SL.ground} roughness={0.95} />
      </mesh>
      {/* the Slack: the band's dusk down the middle, warming to ember toward the Glare, cooling to frost toward the Rime */}
      {[...Array(6)].map((_, i) => {
        const w = T.halfWidth / 6, o = 0.08 + i * 0.09
        return (
          <group key={i}>
            <mesh position={[cx + T.safeHalf + (i + 0.5) * w * 0.95, 0.03, len / 2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w, len]} /><meshBasicMaterial color={SL.glare} transparent opacity={o} depthWrite={false} />
            </mesh>
            <mesh position={[cx - T.safeHalf - (i + 0.5) * w * 0.95, 0.03, len / 2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w, len]} /><meshBasicMaterial color={SL.rime} transparent opacity={o} depthWrite={false} />
            </mesh>
          </group>
        )
      })}
      <mesh position={[cx, 0.04, len / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[T.safeHalf * 2, len]} /><meshBasicMaterial color={SL.line} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh ref={sweep} material={sweepMat} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[T.safeHalf * 2 + 0.4, T.sweepHalfZ * 2]} />
      </mesh>
      {/* ★ the lee stones (09-29): wind-cut rock shelves standing one tier up out of the edge */}
      {LEE_STONES.map((st, i) => {
        const at = simToEdge(st.x, st.z)
        return (
          <group key={`lee-${i}`} position={[at.x, 0, at.z]}>
            <mesh position={[0, 0.55, 0]} castShadow receiveShadow><boxGeometry args={[LEE_HALF * 2 + 0.1, 1.1, LEE_HALF * 2 + 0.1]} /><meshStandardMaterial color={SL.stone} roughness={0.9} /></mesh>
            <mesh position={[0, 1.11, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[LEE_HALF * 2, LEE_HALF * 2]} /><meshStandardMaterial color={SL.stoneTop} roughness={0.85} /></mesh>
          </group>
        )
      })}
      <instancedMesh ref={wind} args={[undefined, undefined, WIND_MAX]} frustumCulled={false}>
        <boxGeometry args={[1.6, 0.03, 0.03]} />
        <meshBasicMaterial color={SL.wind} transparent opacity={0.35} depthWrite={false} />
      </instancedMesh>
      {/* the Stillwind */}
      <group ref={body}>
        {/* the keel of a body, tall and narrow, balanced over the line */}
        <mesh material={ooze} position={[0, H * 0.55, 0]} scale={[0.9, 1, 0.7]}><capsuleGeometry args={[0.9, H * 0.55, 6, 12]} /></mesh>
        <mesh material={ooze} position={[0, H * 0.95, 0.2]}><sphereGeometry args={[0.75, 14, 12]} /></mesh>
        {/* core-light where the ooze is thinnest */}
        <mesh material={core} position={[0, H * 0.62, 0.62]}><sphereGeometry args={[0.28, 10, 8]} /></mesh>
        <mesh material={core} position={[0.18, H * 0.9, 0.62]}><sphereGeometry args={[0.1, 8, 6]} /></mesh>
        {/* four long streaming limbs */}
        {[0, 1, 2, 3].map(i => (
          <group key={i} ref={g => { if (g) limbs.current[i] = g }} position={[(i % 2 ? 0.55 : -0.55), H * (i < 2 ? 0.78 : 0.38), 0]}>
            <mesh material={ooze} position={[0, -H * 0.3, 0]}><cylinderGeometry args={[0.12, 0.3, H * 0.6, 8]} /></mesh>
          </group>
        ))}
        {/* two sail-like reaches */}
        {[0, 1].map(i => (
          <group key={i} ref={g => { if (g) sails.current[i] = g }} position={[(i ? 0.5 : -0.5), H * 0.82, -0.1]}>
            <mesh material={sailMat} position={[0, H * 0.28, 0]}><coneGeometry args={[1.3, H * 0.62, 3, 1, true]} /></mesh>
          </group>
        ))}
      </group>
    </>
  )
}
