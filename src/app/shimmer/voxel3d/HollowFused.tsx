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

export function HollowFused({ form, speed }: { form: HollowForm; speed: number }) {
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

  useFrame(state => {
    if (body.current) updateHollowMeta(body.current, state.clock.elapsedTime, form, speed)
  })

  return <group ref={host} />
}
