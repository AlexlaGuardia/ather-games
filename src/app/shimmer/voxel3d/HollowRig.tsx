'use client'

/**
 * THE BONE RIG, ON A BENCH — an R3F host for `hollow-body.ts` so the thing can be LOOKED AT.
 *
 * ★★★ WHY THIS FILE EXISTS AND WHY IT IS FIVE LINES OF LOGIC (2026-09-05, sprites lane).
 * `hollow-body.ts` shipped the walk into the scene graph on `e850580` and **nothing imported it but
 * its own test.** Alex asked to watch the Hollow walk; the deploy would have carried 240 lines of
 * skeleton and drawn the blob doll, because the bench renders `HollowDoll` and `VoxelWorld` still
 * draws an icosahedron. That is the 2026-09-05 PATTERNS entry one level out: a guard on a PRODUCER
 * says nothing about whether a CONSUMER exists, and `hollow-body.test.ts` was green at 40-odd
 * asserts about a module no page reached.
 *
 * ⚠ THE HOST OWNS RENDER FLAGS, THE MODULE OWNS THE BODY. `createHollowBody` sets no `castShadow`
 * on purpose — whether a Hollow casts is the scene's call, and the world may well answer it
 * differently from a bench. So it is set here, once, on construction.
 *
 * ⚠⚠ AND THIS RIG WEARS THE SHIPPED MATERIAL, ALWAYS. `hollow-body` clones `createHollowMat` and
 * varies nothing but per-blob alpha — deliberately, because whether a Hollow may carry `emissive`
 * at all is an OPEN canon conflict and a SHAPE change that also moved the look would decide it by
 * shipping. So the bench's borrowed/shipped toggle is a question about the BLOB DOLL, and the page
 * says so. Reading this rig's sheen as a verdict on the material question would be a reading taken
 * one layer away from where that question lives.
 */

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createHollowBody, updateHollowBody, disposeHollowBodies } from './hollow-body'
import type { HollowForm } from './hollow-look'

export function HollowRig({ form, speed }: { form: HollowForm; speed: number }) {
  const host = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group | null>(null)

  // One body, rebuilt when the form changes. The outer group belongs to the host (that is the whole
  // reason `hollow-body` nests a pivot inside it), so parenting it under ours is safe.
  useEffect(() => {
    const h = host.current
    if (!h) return
    const b = createHollowBody(form)
    b.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    h.add(b)
    body.current = b
    return () => { h.remove(b); body.current = null }
  }, [form])

  // Shared geometry + materials are module-level and lazily rebuilt, so releasing them on unmount is
  // safe and releasing them on a FORM change would be waste. Hence the empty dep list.
  useEffect(() => () => disposeHollowBodies(), [])

  useFrame(state => {
    if (body.current) updateHollowBody(body.current, state.clock.elapsedTime, form, speed)
  })

  return <group ref={host} />
}
