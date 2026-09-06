'use client'

/**
 * THE MODELLED HOLLOW, ON A BENCH — an R3F host for `hollow-mesh.ts`, in the same commit as it.
 *
 * ★ WRITTEN WITH ITS MODULE, NOT AFTER IT. `hollow-body.ts` shipped 240 lines of skeleton that
 * nothing imported but its own test, and the board asserted the opposite for a day: a guard on a
 * PRODUCER says nothing about whether a CONSUMER exists (PATTERNS 2026-09-05). Every Hollow surface
 * gets its host in the commit that creates it, and `hollow-mesh.test.ts` asserts this file imports it.
 *
 * ⚠ THE GEOMETRY IS PER BODY AND MUST BE DISPOSED PER BODY. Unlike the blob rig, whose sphere is
 * shared by every Hollow alive, this surface writes its own vertices every frame — so the geometry
 * cannot be shared and the unmount has to release it. The MATERIALS are still shared and are
 * released only when the last host unmounts.
 */

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  createHollowMeshBody, updateHollowMeshBody, disposeHollowMeshBody, disposeHollowMeshes, meshStats,
} from './hollow-mesh'
import type { HollowForm } from './hollow-look'

export function HollowMesh({ form, speed, onStats }: {
  form: HollowForm; speed: number; onStats?: (s: { verts: number; tris: number; bones: number }) => void
}) {
  const host = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group | null>(null)

  useEffect(() => {
    const h = host.current
    if (!h) return
    const b = createHollowMeshBody(form)
    b.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    h.add(b)
    body.current = b
    onStats?.(meshStats(b))
    return () => { h.remove(b); disposeHollowMeshBody(b); body.current = null }
  }, [form, onStats])

  // Shared materials only — lazily rebuilt, so releasing them on a FORM change would be waste.
  useEffect(() => () => disposeHollowMeshes(), [])

  useFrame(state => {
    if (body.current) updateHollowMeshBody(body.current, state.clock.elapsedTime, form, speed)
  })

  return <group ref={host} />
}
