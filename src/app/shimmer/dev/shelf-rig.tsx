'use client'
// The shelf rig — drag to orbit, wheel to zoom, one button to a keeper's eye. Shared by the dev
// shelves (`dev/stations`, `dev/beds`) so every shelf answers the same two questions the same way:
// what does this look like from anywhere, and what does it look like to somebody standing at it.
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEffect, useRef } from 'react'
import { EYE_STAND } from '../voxel3d/locomotion'

export interface ShelfView { yaw: number; pitch: number; dist: number }

/**
 * Drag to orbit (any button), wheel to zoom. The current view is published so it can be written down.
 * ★ `eye` is a KEEPER'S stance (2026-09-16, `dev-eye.test`): the height is `EYE_STAND`, the look is
 * level, `dist` only says how far back the keeper stands — the question this shelf exists to answer
 * is how a station reads to somebody standing at it, and an orbit lifts you off the ground the
 * moment you back away. Same split `dev/worktable` draws.
 */
export function Rig({ target, view, eye, onView }: { target: THREE.Vector3; view: { yaw: number; pitch: number; dist: number }; eye: boolean; onView: (v: { yaw: number; pitch: number; dist: number }) => void }) {
  const { camera, gl } = useThree()
  const s = useRef({ ...view, eye, dragging: false, lx: 0, ly: 0 })
  useEffect(() => { s.current.yaw = view.yaw; s.current.pitch = view.pitch; s.current.dist = view.dist; s.current.eye = eye }, [view, eye])
  useEffect(() => {
    const el = gl.domElement
    const apply = () => {
      const c = s.current
      if (c.eye) {
        camera.position.set(target.x + Math.cos(c.yaw) * c.dist, EYE_STAND, target.z + Math.sin(c.yaw) * c.dist)
        camera.lookAt(target.x, EYE_STAND, target.z)
        return
      }
      const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch)
      camera.position.set(target.x + Math.cos(c.yaw) * cp * c.dist, target.y + sp * c.dist, target.z + Math.sin(c.yaw) * cp * c.dist)
      camera.lookAt(target)
    }
    apply()
    const down = (e: PointerEvent) => { s.current.dragging = true; s.current.lx = e.clientX; s.current.ly = e.clientY }
    const up = () => { s.current.dragging = false; onView({ yaw: s.current.yaw, pitch: s.current.pitch, dist: s.current.dist }) }
    const move = (e: PointerEvent) => {
      const c = s.current
      if (!c.dragging) return
      c.yaw += (e.clientX - c.lx) * 0.008; c.pitch = Math.max(-1.4, Math.min(1.4, c.pitch + (e.clientY - c.ly) * 0.008))
      c.lx = e.clientX; c.ly = e.clientY; apply()
    }
    const wheel = (e: WheelEvent) => { s.current.dist = Math.max(1.5, Math.min(40, s.current.dist * (e.deltaY > 0 ? 1.1 : 0.9))); apply(); e.preventDefault() }
    el.addEventListener('pointerdown', down); window.addEventListener('pointerup', up); window.addEventListener('pointermove', move)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); window.removeEventListener('pointermove', move); el.removeEventListener('wheel', wheel) }
  }, [camera, gl, target, eye, onView])
  return null
}

