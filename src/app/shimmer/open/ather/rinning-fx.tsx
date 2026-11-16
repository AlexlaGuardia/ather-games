'use client'
// RINNING, SEEN AND RUN (rinning.ts has the rules; engine/rin-cast.ts the watched wait). The rinstick comes out when bait
// is held: the crosshair finds open water within CAST_RANGE (a ray onto the water plane, real water only), a click casts
// the float out on an arc, the wait is WATCHED (a luminous rise closes on the float), the float dips for the take, a click
// answers, and the reel runs while the page reports whether the keeper is holding the button. Landed: the rinn flies home.

import { useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { WildsWorld } from './wilds-world'
import { BIOME } from './wilds'
import { CAST_RANGE, newReel, stepReel, landed, rollRinn, type Reel, type Rinn } from './rinning'
import { newCast, phaseAt, passed, answer as answerCast, riseProgress, type RinCast } from '../../engine/rin-cast'
import type { Zone } from './forestry'

export type RinPhase = 'idle' | 'casting' | 'waiting' | 'rising' | 'taking' | 'reeling' | 'landed'
export interface RinView { phase: RinPhase; reel: Reel | null; rinn: Rinn | null; aim: { x: number; y: number; z: number } | null }
export interface RinningApi {
  /** Cast at the aimed water. False when there is none in reach or a cast is already out. */
  cast(): boolean
  /** Answer the take. True when it was the take (the reel begins). */
  answer(): boolean
  cancel(): void
  view(): RinView
}
const WATER_Y = 0.02, CAST_S = 0.7

export function RinningFX({ ww, api, holding, out, level, zoneAt, onCatch }: {
  ww: WildsWorld
  api: MutableRefObject<RinningApi | null>
  /** the keeper is holding the button (the page owns the mouse) */
  holding: MutableRefObject<boolean>
  /** bait is in hand: the rod is out and the crosshair looks for water */
  out: boolean
  level: () => number
  zoneAt: (x: number, z: number) => Zone
  onCatch: (r: Rinn) => void
}) {
  const { camera } = useThree()
  const rod = useRef<THREE.Mesh>(null), float = useRef<THREE.Mesh>(null), rise = useRef<THREE.Mesh>(null), splash = useRef<THREE.Mesh>(null), aimRing = useRef<THREE.Mesh>(null)
  const lineGeo = useRef(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]))
  const lineObj = useRef<THREE.Line | null>(null)
  if (!lineObj.current) lineObj.current = new THREE.Line(lineGeo.current, new THREE.LineBasicMaterial({ color: '#f4efe0' }))
  const s = useRef<{ phase: RinPhase; t0: number; target: THREE.Vector3; cast: RinCast | null; reel: Reel | null; rinn: Rinn | null; aim: THREE.Vector3 | null; wasTaking: boolean; splashT: number }>(
    { phase: 'idle', t0: 0, target: new THREE.Vector3(), cast: null, reel: null, rinn: null, aim: null, wasTaking: false, splashT: -9 })
  const lastReel = useRef(0)
  const tmp = useRef({ o: new THREE.Vector3(), d: new THREE.Vector3(), tip: new THREE.Vector3(), hand: new THREE.Vector3() })

  api.current = {
    cast() {
      const st = s.current
      if (!out || !st.aim || (st.phase !== 'idle' && st.phase !== 'landed')) return false
      st.phase = 'casting'; st.t0 = performance.now(); st.target.copy(st.aim); st.reel = null; st.rinn = null
      return true
    },
    answer() {
      const st = s.current
      if (!st.cast || !answerCast(st.cast, Date.now())) return false
      st.rinn = rollRinn(level(), zoneAt(st.target.x, st.target.z), Math.random)
      st.reel = newReel(st.rinn.tier, Math.random); st.phase = 'reeling'; st.splashT = performance.now(); lastReel.current = performance.now()
      return true
    },
    cancel() { const st = s.current; st.phase = 'idle'; st.cast = null; st.reel = null },
    view() { const st = s.current; return { phase: st.phase, reel: st.reel, rinn: st.rinn, aim: st.aim ? { x: st.aim.x, y: st.aim.y, z: st.aim.z } : null } },
  }

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw), T = tmp.current, st = s.current, now = performance.now()
    camera.getWorldPosition(T.o); camera.getWorldDirection(T.d)
    // ── aim: where the crosshair meets open water (a downward ray onto the water plane, real water under it)
    st.aim = null
    if (out && T.d.y < -0.02) {
      const t = (WATER_Y - T.o.y) / T.d.y
      if (t > 0) {
        const p = T.o.clone().addScaledVector(T.d, t)
        if (Math.hypot(p.x - T.o.x, p.z - T.o.z) <= CAST_RANGE && ww.biomeAt(p.x, p.z) === BIOME.water && ww.heightAt(p.x, p.z) < WATER_Y - 0.1) st.aim = p
      }
    }
    // the rod: from the hand (low right of the eye) out and up, the line from its tip to the float
    const right = new THREE.Vector3().crossVectors(T.d, camera.up).normalize()
    // a held rinstick, low in the lower right of the view (the first cut reached 1.5 m ahead and stood up the middle
    // of the screen like a fence post)
    T.hand.copy(T.o).addScaledVector(T.d, 0.32).addScaledVector(right, 0.26).add(new THREE.Vector3(0, -0.3, 0))
    T.tip.copy(T.o).addScaledVector(T.d, 0.95).addScaledVector(right, 0.42).add(new THREE.Vector3(0, -0.02, 0))
    if (rod.current) {
      rod.current.visible = out
      if (out) { const mid = T.hand.clone().lerp(T.tip, 0.5), len = T.hand.distanceTo(T.tip); rod.current.position.copy(mid); rod.current.scale.set(1, len, 1); rod.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), T.tip.clone().sub(T.hand).normalize()) }
    }
    if (aimRing.current) { aimRing.current.visible = !!st.aim && (st.phase === 'idle' || st.phase === 'landed'); if (st.aim) aimRing.current.position.set(st.aim.x, WATER_Y + 0.03, st.aim.z) }
    if (!out && st.phase !== 'idle') { st.phase = 'idle'; st.cast = null; st.reel = null }   // stowed: the line comes in

    // ── the cast arc, the watched wait, the take, the reel
    let fp: THREE.Vector3 | null = null
    if (st.phase === 'casting') {
      const u = Math.min(1, (now - st.t0) / 1000 / CAST_S)
      fp = T.tip.clone().lerp(st.target, u); fp.y += Math.sin(u * Math.PI) * 2.2
      if (u >= 1) { st.phase = 'waiting'; st.cast = newCast(Date.now(), Math.random, zoneAt(st.target.x, st.target.z) === 'springs'); st.splashT = now; st.wasTaking = false }
    } else if (st.phase === 'waiting' || st.phase === 'rising' || st.phase === 'taking') {
      const c = st.cast!, ph = phaseAt(c, Date.now())
      if (st.wasTaking && ph === 'waiting') st.cast = passed(c, Date.now(), Math.random)   // unanswered: it circles and comes again
      st.wasTaking = ph === 'taking'; st.phase = ph === 'held' ? 'taking' : ph
      fp = st.target.clone(); fp.y = WATER_Y + Math.sin(now / 420) * 0.03 - (ph === 'taking' ? 0.16 + Math.sin(now / 60) * 0.04 : 0)
    } else if (st.phase === 'reeling' && st.reel) {
      // the reel runs on REAL time in small steps, so a slow frame rate (a heavy scene on a laptop GPU, or a headless
      // check that draws a frame only when asked) reels at the same pace, not slower
      const el = Math.min(1, (now - (lastReel.current || now)) / 1000); lastReel.current = now
      for (let k = 0, n = Math.ceil(el / 0.05); k < n && !landed(st.reel); k++) st.reel = stepReel(st.reel, el / n, holding.current, Math.random)
      const shore = new THREE.Vector3(T.o.x, WATER_Y, T.o.z).lerp(st.target, 0.12)
      fp = st.target.clone().lerp(shore, st.reel.progress)
      fp.y = WATER_Y - (st.reel.mood === 'pull' ? 0.12 + Math.abs(Math.sin(now / 70)) * 0.08 : 0)
      if (st.reel.mood === 'pull') { fp.x += Math.sin(now / 90) * 0.15; fp.z += Math.cos(now / 110) * 0.15 }
      if (landed(st.reel)) { st.phase = 'landed'; st.t0 = now; if (st.rinn) onCatch(st.rinn) }
    } else if (st.phase === 'landed') {
      const u = Math.min(1, (now - st.t0) / 450)
      if (u < 1) { fp = st.target.clone().lerp(T.o, u); fp.y += Math.sin(u * Math.PI) * 1.2 }
    }
    if (float.current) { float.current.visible = !!fp; if (fp) float.current.position.copy(fp) }
    if (lineObj.current) {
      lineObj.current.visible = !!fp && out
      if (fp) {
        const mid = T.tip.clone().lerp(fp, 0.5); mid.y -= st.phase === 'reeling' && st.reel && st.reel.mood === 'pull' ? 0.05 : 0.5
        const pos = lineGeo.current.attributes.position as THREE.BufferAttribute
        pos.setXYZ(0, T.tip.x, T.tip.y, T.tip.z); pos.setXYZ(1, mid.x, mid.y, mid.z); pos.setXYZ(2, fp.x, fp.y, fp.z); pos.needsUpdate = true
      }
    }
    // the rise: a glow coming in through the water from out beyond the float
    if (rise.current) {
      const rp = st.cast && st.phase === 'rising' ? riseProgress(st.cast, Date.now()) : 0
      rise.current.visible = rp > 0
      if (rp > 0) {
        const out2 = st.target.clone().sub(new THREE.Vector3(T.o.x, WATER_Y, T.o.z)).setY(0).normalize().multiplyScalar(4.5 * (1 - rp))
        rise.current.position.set(st.target.x + out2.x, WATER_Y - 0.05, st.target.z + out2.z)
        const k = 0.5 + rp * 0.6; rise.current.scale.set(k, k, k)
      }
    }
    if (splash.current) {
      const u = (now - st.splashT) / 600
      splash.current.visible = u >= 0 && u < 1 && !!fp
      if (splash.current.visible) { splash.current.position.set(st.target.x, WATER_Y + 0.04, st.target.z); const k = 0.3 + u * 1.4; splash.current.scale.set(k, k, 1); (splash.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - u) }
    }
  })

  return (
    <>
      <mesh ref={rod} visible={false}><cylinderGeometry args={[0.005, 0.011, 1, 5]} /><meshLambertMaterial color="#9a8160" /></mesh>
      <primitive object={lineObj.current} />
      <mesh ref={float} visible={false}><sphereGeometry args={[0.07, 10, 8]} /><meshLambertMaterial color="#e8f0ff" emissive="#9fd4ff" emissiveIntensity={0.35} /></mesh>
      <mesh ref={rise} visible={false} rotation-x={-Math.PI / 2}><circleGeometry args={[0.45, 18]} /><meshBasicMaterial color="#bfeeff" transparent opacity={0.55} depthWrite={false} /></mesh>
      <mesh ref={splash} visible={false} rotation-x={-Math.PI / 2}><ringGeometry args={[0.8, 1, 24]} /><meshBasicMaterial color="#e6f7ff" transparent opacity={0.7} depthWrite={false} /></mesh>
      <mesh ref={aimRing} visible={false} rotation-x={-Math.PI / 2}><ringGeometry args={[0.32, 0.4, 24]} /><meshBasicMaterial color="#cfefff" transparent opacity={0.8} depthWrite={false} /></mesh>
    </>
  )
}
