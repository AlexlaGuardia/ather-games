'use client'
// THE TETHER (BETA M136; Alex 11-24: "the tether should be to the tool not the node", "persists for a half a sec after the node
// is done"). Mana runs from the keeper's RIGHT HAND to the focus hanging at the node (channel-fx.tsx focusAt), never past it.
// The page steps it from onTick, after the walker placed the camera and the hands, so both ends are this frame's. It shows only
// while a node is being worked: stopChannel calls off(), so it is gone with the yield / let-go / dry / drawn weapon itself.
import { useImperativeHandle, useRef, forwardRef } from 'react'
import * as THREE from 'three'

const MOTES = 16, RUN_MS = 500
export interface TetherApi {
  /** both ends in the world; `node` picks the light's colour */
  step(from: THREE.Vector3, to: THREE.Vector3, node: 'tree' | 'crystal', now: number): void
  off(): void
  /** reading only (m136-tether-check) */
  now(): { from: number[]; to: number[]; motes: number[][] } | null
}
/** Mote `i`'s place along the light at `now`, 0 at the hand .. 1 at the tool. */
export const moteAt = (i: number, now: number) => ((i / MOTES) + now / RUN_MS) % 1
const COLOR = { tree: '#f6e7a6', crystal: '#d8ecff' } as const

export const GatherTether = forwardRef<TetherApi>(function GatherTether(_, ref) {
  const mesh = useRef<THREE.InstancedMesh>(null), mat = useRef<THREE.MeshBasicMaterial>(null)
  const ends = useRef({ a: new THREE.Vector3(), b: new THREE.Vector3() })
  useImperativeHandle(ref, () => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler()
    return {
      step(from, to, node, now) {
        const mm = mesh.current; if (!mm) return
        ends.current.a.copy(from); ends.current.b.copy(to)
        mat.current?.color.set(COLOR[node])
        for (let i = 0; i < MOTES; i++) {
          const f = moteAt(i, now), mid = Math.sin(f * Math.PI)
          p.lerpVectors(from, to, f)   // the sway dies at both ends: the light leaves the hand and lands on the tool
          p.x += Math.sin(i * 2.1 + now / 90) * 0.08 * mid; p.y += (0.25 + Math.cos(i * 1.7 + now / 110) * 0.08) * mid; p.z += Math.cos(i * 1.9 + now / 95) * 0.08 * mid
          const sc = (0.02 + 0.05 * Math.min(1, f * 2)) * (1 + 0.5 * mid)   // small at the hand: it is half a metre from the eye
          mm.setMatrixAt(i, m.compose(p, q.setFromEuler(e.set(now / 200 + i, now / 300, 0)), s.set(sc, sc, sc)))
        }
        mm.count = MOTES; mm.instanceMatrix.needsUpdate = true
      },
      off() { if (mesh.current) mesh.current.count = 0 },
      now: () => {
        const mm = mesh.current; if (!mm || !mm.count) return null
        return { from: ends.current.a.toArray(), to: ends.current.b.toArray(), motes: Array.from({ length: mm.count }, (_, i) => { mm.getMatrixAt(i, m); return p.setFromMatrixPosition(m).toArray() }) }
      },
    }
  }, [])
  return (
    <instancedMesh ref={mm => { if (mm && mm !== mesh.current) mm.count = 0; mesh.current = mm }} args={[undefined, undefined, MOTES]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} /><meshBasicMaterial ref={mat} color={COLOR.tree} />
    </instancedMesh>
  )
})
