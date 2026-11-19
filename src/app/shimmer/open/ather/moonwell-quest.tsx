'use client'
// THE MOONWELL in the Wilds and the first rinstick's middle (BETA M22; canon + rules in rinquest.ts, the place in moonwell.ts).
//   <MoonwellPool />  the glowing pool (the Glade's first piece), the dusk WAIT (still, hands empty, at the water, at dusk),
//                     the rinn that rises when it completes, and the SHED SCALE on the bank you walk over to take.
// Mount: <MoonwellPool ground={heightAt} stowed={() => stance is stowed} /> in the Wilds. Reports through questEvent().

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { dayProgress, getPhase } from '../../engine/day-cycle'
import { hudSay } from '../shared/hud-say'
import { getInv, setInv } from '../shared/bag'
import { give } from '../shared/inventory'
import { MOONWELL, AT_WATER, SCALE_AT, SCALE_REACH } from './moonwell'
import { waitingAt, scaleOnBank, waitTick, RINQUEST_LINES, SHED_SCALE } from './rinquest'
import { useQuest, questEvent, currentQuest } from './use-rinquest'

const POOL = '#bfe4ff', RIM = '#8d9aa6'

export function MoonwellPool({ ground, stowed }: { ground: (x: number, z: number) => number; stowed: () => boolean }) {
  const quest = useQuest()
  const camera = useThree(s => s.camera)
  const y = useMemo(() => { const h = ground(MOONWELL.x, MOONWELL.z); return Number.isFinite(h) ? h : 0 }, [ground])
  const sy = useMemo(() => { const h = ground(SCALE_AT.x, SCALE_AT.z); return Number.isFinite(h) ? h : y }, [ground, y])
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  const rinn = useRef<THREE.Group>(null)
  const scale = useRef<THREE.Mesh>(null)
  const w = useRef({ t: 0, last: { x: 0, z: 0 }, said: '' as string, rise: -1 })
  const [, bump] = useState(0)
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime
    if (glow.current) glow.current.opacity = 0.78 + Math.sin(t * 0.8) * 0.06
    if (scale.current) { scale.current.rotation.y = t * 0.9; scale.current.position.y = sy + 0.12 + Math.sin(t * 2) * 0.02 }
    // the rinn that came up: an arc out of the water and back, ~2 s, then gone
    const W = w.current
    if (rinn.current) {
      if (W.rise >= 0) {
        W.rise += dt
        const k = Math.min(1, W.rise / 2)
        rinn.current.visible = k < 1
        rinn.current.position.set(MOONWELL.x - 0.8 + k * 1.6, y - 0.2 + Math.sin(k * Math.PI) * 0.9, MOONWELL.z)
        rinn.current.rotation.z = (0.5 - k) * 2.2
        if (k >= 1) W.rise = -1
      } else rinn.current.visible = false
    }
    const q = currentQuest()
    const p = camera.position
    // the scale on the bank: walk over it
    if (scaleOnBank(q) && Math.hypot(p.x - SCALE_AT.x, p.z - SCALE_AT.z) < SCALE_REACH) {
      const r = give(getInv(), SHED_SCALE, 1)
      if (r.left) { if (W.said !== 'full') { W.said = 'full'; hudSay('Your bag is full. Make room for the scale.', 'info') } }
      else if (questEvent({ kind: 'picked', item: SHED_SCALE })) { setInv(r.inv); W.said = '' }
      return
    }
    const wait = waitingAt(q)
    if (!wait) { W.t = 0; return }
    const at = Math.hypot(p.x - MOONWELL.x, p.z - MOONWELL.z) < AT_WATER
    const still = Math.hypot(p.x - W.last.x, p.z - W.last.z) < Math.max(0.02, dt * 0.15)
    W.last = { x: p.x, z: p.z }
    const empty = stowed(), phase = getPhase(dayProgress()) === wait.phase
    // say why it is not counting, once per reason, only at the water
    const why = !at ? '' : !empty ? 'held' : !phase ? 'time' : 'ok'
    if (why && why !== W.said) {
      W.said = why
      hudSay(why === 'held' ? RINQUEST_LINES.waitHeld : why === 'time' ? RINQUEST_LINES.waitTime : RINQUEST_LINES.waitStart, 'info')
    }
    if (!at) W.said = ''
    const r = waitTick(W.t, dt, { at, still, empty, phase }, wait.stillS)
    W.t = r.t
    if (r.done && questEvent({ kind: 'waited', at: 'moonwell' })) { W.t = 0; W.rise = 0; W.said = ''; bump(n => n + 1) }
  })
  // probe for rinquest-check (reading only)
  useEffect(() => { (window as unknown as { __moonwell?: unknown }).__moonwell = { wait: () => w.current.t, rising: () => w.current.rise >= 0 } }, [])
  return (
    <group>
      {/* the pool: a soft glowing disc in a ring of pale stones */}
      <mesh position={[MOONWELL.x, y + 0.05, MOONWELL.z]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[MOONWELL.r, 40]} />
        <meshBasicMaterial ref={glow} color={POOL} transparent opacity={0.8} />
      </mesh>
      <mesh position={[MOONWELL.x, y + 0.02, MOONWELL.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[MOONWELL.r, MOONWELL.r + 0.45, 40]} />
        <meshLambertMaterial color={RIM} />
      </mesh>
      <pointLight position={[MOONWELL.x, y + 1.2, MOONWELL.z]} color={POOL} intensity={0.8} distance={9} />
      {/* the rinn that rises (placeholder shape: a small silver body + tail) */}
      <group ref={rinn} visible={false}>
        <mesh scale={[0.32, 0.12, 0.12]}><sphereGeometry args={[1, 10, 8]} /><meshLambertMaterial color="#e7f2ff" emissive="#9fd2ff" emissiveIntensity={0.5} /></mesh>
        <mesh position={[-0.36, 0, 0]} rotation-z={Math.PI / 2} scale={[0.14, 0.12, 0.02]}><coneGeometry args={[1, 1, 3]} /><meshLambertMaterial color="#cfe6ff" /></mesh>
      </group>
      {/* the shed scale on the bank */}
      {scaleOnBank(quest) && (
        <mesh ref={scale} position={[SCALE_AT.x, sy + 0.12, SCALE_AT.z]} rotation-x={-0.4} scale={[0.16, 0.22, 0.03]}>
          <sphereGeometry args={[1, 10, 6]} />
          <meshStandardMaterial color="#dff3ff" emissive="#8fd0ff" emissiveIntensity={0.6} metalness={0.4} roughness={0.25} />
        </mesh>
      )}
    </group>
  )
}
