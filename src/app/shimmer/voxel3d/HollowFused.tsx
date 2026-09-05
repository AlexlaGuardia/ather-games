'use client'

/**
 * THE FUSED HOLLOW, ON A BENCH — an R3F host for `hollow-meta.ts`, so a field body can be looked at.
 *
 * ★ Written the same day and for the same reason as `HollowRig`: a module with no consumer is 240
 * lines of green asserts nobody can see. `hollow-body` shipped unmounted for a day; this one gets
 * its host in the same commit.
 *
 * ⚠ THE SURFACE IS REBUILT EVERY FRAME AND THAT IS THE COST. Marching cubes re-evaluates the whole
 * grid — 32^3 is 32,768 cells — so this is the expensive Hollow, deliberately: the sphere body in
 * `hollow-body` stays as the cheap one, and which body a distance gets is a decision for the world,
 * not for a bench.
 */

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createHollowMeta, updateHollowMeta, disposeHollowMetas } from './hollow-meta'
import type { HollowForm } from './hollow-look'

/**
 * ⚠ `onStats` EXISTS BECAUSE THE BODY WAS INVISIBLE AND EVERY INSTRUMENT SAID IT WAS FINE. The
 * headless guard surfaced 1,044 vertices, the console was clean, and the page drew nothing — and
 * R3F keeps its scene in its OWN reconciler, so the THREE objects are not reachable from the DOM
 * fiber tree that a page-side probe can walk. The only honest way to see what the mounted body is
 * doing is for the mounted body to say so. It doubles as the cost readout this needs anyway: the
 * vertex count IS the per-frame price of a fused Hollow.
 */
/**
 * ⚠ HOISTED OUT OF THE FRAME LOOP, and `render-audit.test.ts` is what said so — a `new Vector3()`
 * inside `useFrame` is per-frame garbage even when the loop around it is sampled. One scratch vector
 * for the readout, reused; the readout runs on one body at a time, so sharing it is safe and stating
 * that here is the price of sharing it.
 */
const SCRATCH = new THREE.Vector3()

export function HollowFused({ form, speed, onStats }: {
  form: HollowForm; speed: number; onStats?: (s: { verts: number; y: [number, number] }) => void
}) {
  const host = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group | null>(null)

  useEffect(() => {
    const h = host.current
    if (!h) return
    const b = createHollowMeta(form)
    b.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    h.add(b)
    body.current = b
    return () => { h.remove(b); body.current = null }
  }, [form])

  // Shared materials are module-level and lazily rebuilt, so release them on unmount only.
  useEffect(() => () => disposeHollowMetas(), [])

  const tick = useRef(0)
  useFrame(state => {
    if (!body.current) return
    updateHollowMeta(body.current, state.clock.elapsedTime, form, speed)
    // Sampled, not every frame: this is a readout, and a setState per frame is its own bug.
    if (onStats && ++tick.current % 30 === 0) {
      const surf = body.current.children.find(c => c.name === 'hollowField') as THREE.Mesh | undefined
      if (!surf) return
      const pos = surf.geometry.getAttribute('position')
      const n = Math.min(surf.geometry.drawRange.count, pos ? pos.count : 0)
      let lo = Infinity, hi = -Infinity
      surf.updateMatrixWorld(true)
      for (let i = 0; i < n; i += 7) { SCRATCH.fromBufferAttribute(pos, i).applyMatrix4(surf.matrixWorld); if (SCRATCH.y < lo) lo = SCRATCH.y; if (SCRATCH.y > hi) hi = SCRATCH.y }
      onStats({ verts: n, y: [n ? lo : 0, n ? hi : 0] })
    }
  })

  return <group ref={host} />
}
