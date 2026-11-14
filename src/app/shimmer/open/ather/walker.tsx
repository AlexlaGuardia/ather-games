'use client'

// The walker for the Ather side: the same voxel3d/locomotion body Alex tuned (via open/terrain-world), first person,
// handed whichever zone's world it stands in. The page owns WHERE (spawn, fall, zone); this owns HOW you move.
// Same controls as /shimmer/open: WASD · Space jump/climb · Shift slide · mouse look under pointer lock.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createLoco, tickLocomotion, eyeY, WALK_SPEED, SPEED_CAP, type LocoWorld } from '../shared/locomotion'

const SENS = 0.0022
const FOV = 75, FOV_KICK = 8

export type Loco = ReturnType<typeof createLoco>
export interface WalkerProps {
  world: LocoWorld
  ground: (x: number, z: number) => number
  spawn: { x: number; z: number; yaw: number }
  locked: React.MutableRefObject<boolean>
  /** Below this the zone decides what a fall means (the plot: home to the threshold). */
  fallY: number
  onFall: () => void
  /** Every frame, after the step: the page reads position for prompts, the HUD and the map. */
  onTick: (lc: Loco, yaw: number, dt: number) => void
  /** While true (a map is open) the body takes no move keys. */
  frozen: React.MutableRefObject<boolean>
}

export function Walker({ world, ground, spawn, locked, fallY, onFall, onTick, frozen }: WalkerProps) {
  const { camera, gl } = useThree()
  const born = () => createLoco(spawn.x, Math.max(ground(spawn.x, spawn.z), -1e3), spawn.z)
  const loco = useRef(born())
  const keys = useRef(new Set<string>())
  const look = useRef({ yaw: spawn.yaw, pitch: -0.05 })

  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current.add(e.code); if (e.code === 'Space') e.preventDefault() }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const move = (e: MouseEvent) => {
      if (!locked.current || frozen.current) return
      look.current.yaw -= e.movementX * SENS
      look.current.pitch = Math.max(-1.5, Math.min(1.5, look.current.pitch - e.movementY * SENS))
    }
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    window.addEventListener('mousemove', move); window.addEventListener('blur', blur)
    // Probe + teleport for scripted shots and tests on prod.
    ;(window as unknown as { __ather?: Record<string, unknown> }).__ather = {
      ...((window as unknown as { __ather?: Record<string, unknown> }).__ather ?? {}),
      state: () => ({ ...loco.current, yaw: look.current.yaw }),
      tp: (x: number, z: number, yaw = look.current.yaw) => { loco.current = createLoco(x, ground(x, z), z); look.current.yaw = yaw },
      look: (yaw: number, pitch: number) => { look.current.yaw = yaw; look.current.pitch = pitch },
    }
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up)
      window.removeEventListener('mousemove', move); window.removeEventListener('blur', blur)
    }
  }, [locked, frozen, ground])

  useEffect(() => { (camera as THREE.PerspectiveCamera).far = 900; camera.updateProjectionMatrix() }, [camera])
  useEffect(() => { gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)) }, [gl])

  const fwd = useMemo(() => new THREE.Vector3(), []), right = useMemo(() => new THREE.Vector3(), [])
  const wish = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const k = frozen.current ? new Set<string>() : keys.current, lc = loco.current, { yaw, pitch } = look.current
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(Math.cos(yaw), 0, -Math.sin(yaw))
    const f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0), r = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0)
    wish.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, r)
    if (wish.lengthSq() > 1) wish.normalize()
    tickLocomotion(lc, {
      mvX: wish.x, mvZ: wish.z, fwdX: fwd.x, fwdZ: fwd.z, rightX: right.x, rightZ: right.z,
      jumpKey: k.has('Space'), crouchKey: k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyC'), dt,
    }, world)
    if (lc.py < fallY) { onFall(); return }

    camera.position.set(lc.px, eyeY(lc), lc.pz)
    camera.rotation.set(pitch, yaw, 0, 'YXZ')
    const speed = Math.hypot(lc.hvx, lc.hvz), cam = camera as THREE.PerspectiveCamera
    const fov = FOV + FOV_KICK * Math.min(1, Math.max(0, (speed - WALK_SPEED) / (SPEED_CAP - WALK_SPEED)))
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 8); cam.updateProjectionMatrix() }
    onTick(lc, yaw, dt)
  })
  return null
}

export function verbOf(lc: Loco): string {
  const speed = Math.hypot(lc.hvx, lc.hvz)
  return lc.swimming ? 'swim' : lc.hanging ? 'hang' : lc.mantleT > 0 ? (lc.vaulting ? 'vault' : 'mantle')
    : lc.climbing ? 'climb' : lc.sliding ? 'slide' : lc.airborne ? 'air' : speed < 0.2 ? 'idle'
    : lc.crouching ? 'crouch' : speed > WALK_SPEED + 0.3 ? 'sprint' : 'walk'
}
