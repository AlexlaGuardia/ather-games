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
import { MOONWELL, SCALE_AT, SCALE_REACH, GLADE_GREEN, atWater, shoreToward } from './moonwell'
import { POOL_Y, poolRim, poolSheet } from './moonwell-water'
// M40: the Moonwell is Greg's POND (an ellipse, relief.ts carves its bowl); the rinn rises just off the bank on the green's side
const RISE = shoreToward(GLADE_GREEN.x, GLADE_GREEN.z, -2.5)
import { waitingAt, scaleOnBank, waitTick, RINQUEST_LINES, SHED_SCALE } from './rinquest'
import { useQuest, questEvent, currentQuest } from './use-rinquest'
import { groundMat, groundOrder } from '../shared/ground-layers'

const POOL = '#bfe4ff', RIM = '#8d9aa6'

export function MoonwellPool({ ground, stowed }: { ground: (x: number, z: number) => number; stowed: () => boolean }) {
  const quest = useQuest()
  const camera = useThree(s => s.camera)
  const y = POOL_Y   // the water's surface (the ground there is the carved bowl, under it, unless the owner sculpted it up)
  const scene = useThree(s => s.scene)
  // M157: the sheet and its rim read the ground the keeper stands on (moonwell-water.ts)
  const { sheet, rim } = useMemo(() => {
    const make = ({ pos, idx }: { pos: Float32Array; idx: number[] }) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g }
    return { sheet: make(poolSheet(ground)), rim: make(poolRim(ground)) }
  }, [ground])
  useEffect(() => () => { sheet.dispose(); rim.dispose() }, [sheet, rim])
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
        rinn.current.position.set(RISE.x - 0.8 + k * 1.6, y - 0.2 + Math.sin(k * Math.PI) * 0.9, RISE.z)
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
    const at = atWater(p.x, p.z)   // M40: by the shore of the pond, wherever round it
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
  // cleared on unmount (M9 11-22): the pool is Wilds-only, and a probe left on window kept the unmounted pool's whole closure
  // scope alive at home (0.9 MB in the heap diff)
  useEffect(() => { const g = window as unknown as { __moonwell?: unknown }; g.__moonwell = { wait: () => w.current.t, rising: () => w.current.rise >= 0,
    // M157 (moonwell-pond-check): the walker's ground, the DRAWN ground (a ray down on the meshes as the GPU has them) and the sheet
    walkAt: ground, poolY: y, sheet: () => Array.from(sheet.getAttribute('position').array),
    drawnAt: (x: number, z: number) => {
      const ms: THREE.Object3D[] = []; scene.traverse(o => { if (o.userData?.gladeGround) ms.push(o) })
      const h = new THREE.Raycaster(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0)).intersectObjects(ms, false)[0]
      return h ? h.point.y : null
    } }; return () => { delete g.__moonwell } }, [ground, sheet, scene, y])
  return (
    <group>
      {/* the pond (M40): a soft glowing ellipse at the water line, in Sax's rim of pale stone on the bank */}
      <mesh geometry={sheet}>
        <meshBasicMaterial ref={glow} color={POOL} transparent opacity={0.8} />
      </mesh>
      <mesh geometry={rim} renderOrder={groundOrder('mark')}>
        <meshLambertMaterial color={RIM} {...groundMat('mark')} />
      </mesh>
      <pointLight position={[RISE.x, y + 1.5, RISE.z]} color={POOL} intensity={1.2} distance={30} />
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
