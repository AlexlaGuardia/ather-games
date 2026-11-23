'use client'

// The walker for the Ather side: the same voxel3d/locomotion body Alex tuned (via open/terrain-world), first person,
// handed whichever zone's world it stands in. The page owns WHERE (spawn, fall, zone); this owns HOW you move.
// Same controls as /shimmer/open: WASD · Space jump/climb · Shift slide · mouse look under pointer lock.
// A phone feeds the same step through shared/touch.ts (stick, drag-look, held jump/slide), merged below.

import { useEffect, useMemo, useRef } from 'react'
import { fpGunAds } from '../shared/fp-gun'
import { adsFov, adsLookScale } from '../shared/optics'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createLoco, tickLocomotion, eyeY, WALK_SPEED, SPEED_CAP, type LocoWorld } from '../shared/locomotion'
import { tickFeet, setListener } from '../shared/sfx'
import { liftCarry } from './lift'
import { GROUND_Y } from './plot'
import { touch, TOUCH_LOOK_SENS, isTouchOnly } from '../shared/touch'
import { tickIdleCam, installIdleInput } from '../shared/idle-mode'
import { getSettings, useSettings, pixelRatioCap } from '../shared/settings'

const SENS = 0.0022
// ★ THE SIGHTS (Alex 11-18): while a held gun is in its sights (shared/fp-gun.tsx owns the eased adsT), the field of view is the optic's
// true zoom (optics.adsFov) and the look slows by exactly 1/zoom (adsLookScale), for the mouse and the thumb alike. Nothing aims, nothing changes.
const sightLook = () => { const a = fpGunAds(); return a.optic && a.t > 0.001 ? adsLookScale(getSettings().fov, a.optic, a.t) : 1 }
const FOV_KICK = 8   // the walk FOV itself is a setting now (shared/settings.ts › fov, default 75)

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
  /** While set (talking to an NPC, BETA M13), the look eases to face this point; the keeper's own look takes over again after. */
  focus?: React.MutableRefObject<{ x: number; y: number; z: number } | null>
  /** Void v2: while set, the page owns the body (a fall into a void, void-fall.ts): it moves lc in place of the walker's step,
   *  the zone's fallY is not read, and the camera and onTick follow as usual. */
  sink?: React.MutableRefObject<((lc: Loco, dt: number) => void) | null>
}

export function Walker({ world, ground, spawn, locked, fallY, onFall, onTick, frozen, focus, sink }: WalkerProps) {
  const { camera, gl } = useThree()
  const born = () => createLoco(spawn.x, Math.max(ground(spawn.x, spawn.z), -1e3), spawn.z)
  const loco = useRef(born())
  const keys = useRef(new Set<string>())
  const look = useRef({ yaw: spawn.yaw, pitch: -0.05 })
  const pinned = useRef(false)   // __ather.pin (check-only)

  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current.add(e.code); if (e.code === 'Space') e.preventDefault() }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const move = (e: MouseEvent) => {
      if (!locked.current || frozen.current) return
      // sensitivity and invert are Options (shared/settings.ts), read live so a slider takes effect mid-walk
      const st = getSettings(), k = SENS * st.mouseSens * sightLook()
      look.current.yaw -= e.movementX * k
      look.current.pitch = Math.max(-1.5, Math.min(1.5, look.current.pitch - e.movementY * k * (st.invertY ? -1 : 1)))
    }
    const blur = () => keys.current.clear()
    const offIdle = installIdleInput()
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    window.addEventListener('mousemove', move); window.addEventListener('blur', blur)
    // Probe + teleport for scripted shots and tests on prod.
    ;(window as unknown as { __ather?: Record<string, unknown> }).__ather = {
      ...((window as unknown as { __ather?: Record<string, unknown> }).__ather ?? {}),
      state: () => ({ ...loco.current, yaw: look.current.yaw }),
      tp: (x: number, z: number, yaw = look.current.yaw, y?: number) => { loco.current = createLoco(x, y ?? ground(x, z), z); look.current.yaw = yaw },
      ground: (x: number, z: number) => ground(x, z),   // read-only: the ground the walker stands on (wilds-cover-check)
      look: (yaw: number, pitch: number) => { look.current.yaw = yaw; look.current.pitch = pitch },
      // check-only (M58 flicker shots): hold the keeper exactly where they are, no gravity / settle, so two frames 1 s apart
      // share one camera. Nothing in the game calls it.
      pin: (on: boolean) => { pinned.current = on },
    }
    return () => {
      offIdle()
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up)
      window.removeEventListener('mousemove', move); window.removeEventListener('blur', blur)
    }
  }, [locked, frozen, ground])

  useEffect(() => { (camera as THREE.PerspectiveCamera).far = 900; camera.updateProjectionMatrix() }, [camera])
  const { renderScale } = useSettings()
  useEffect(() => { gl.setPixelRatio(pixelRatioCap()) }, [gl, renderScale])   // Options › Video › sharpness

  const fwd = useMemo(() => new THREE.Vector3(), []), right = useMemo(() => new THREE.Vector3(), [])
  const wish = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const k = frozen.current ? new Set<string>() : new Set([...keys.current, ...touch.held]), lc = loco.current
    // touch look: consume the dragged pixels every frame (dropped, not banked, while a panel has the screen)
    if (!frozen.current && (touch.look.dx || touch.look.dy)) {
      const st = getSettings(), k = TOUCH_LOOK_SENS * st.touchSens * sightLook()
      look.current.yaw -= touch.look.dx * k
      look.current.pitch = Math.max(-1.5, Math.min(1.5, look.current.pitch - touch.look.dy * k * (st.invertY ? -1 : 1)))
    }
    touch.look.dx = 0; touch.look.dy = 0
    // M91: after ~25 s of nothing the view drifts about; any input hands it back exactly (shared/idle-mode.ts). Not while talking, in a menu, or unlocked.
    tickIdleCam(dt, look.current, frozen.current || (!locked.current && !isTouchOnly()) || !!focus?.current)
    const fc = focus?.current
    if (fc) {   // turn to the NPC: yaw 0 looks down -z, so the yaw to (dx, dz) is atan2(-dx, -dz); ease, shortest way round
      const dx = fc.x - lc.px, dz = fc.z - lc.pz, dy = fc.y - eyeY(lc)
      const ty = Math.atan2(-dx, -dz), tp = Math.max(-0.6, Math.min(0.6, Math.atan2(dy, Math.hypot(dx, dz))))
      const a = Math.min(1, dt * 6), dYaw = Math.atan2(Math.sin(ty - look.current.yaw), Math.cos(ty - look.current.yaw))
      look.current.yaw += dYaw * a; look.current.pitch += (tp - look.current.pitch) * a
    }
    const { yaw, pitch } = look.current
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(Math.cos(yaw), 0, -Math.sin(yaw))
    const tm = frozen.current ? { x: 0, y: 0 } : touch.move
    const f = Math.max(-1, Math.min(1, (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) + tm.y))
    const r = Math.max(-1, Math.min(1, (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + tm.x))
    wish.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, r)
    if (wish.lengthSq() > 1) wish.normalize()
    if (pinned.current) { camera.position.set(lc.px, eyeY(lc), lc.pz); camera.rotation.set(pitch, yaw, 0, 'YXZ'); return }
    const sk = sink?.current
    if (sk) { sk(lc, dt); camera.position.set(lc.px, eyeY(lc), lc.pz); camera.rotation.set(pitch, yaw, 0, 'YXZ'); onTick(lc, yaw, dt); return }
    tickLocomotion(lc, {
      mvX: wish.x, mvZ: wish.z, fwdX: fwd.x, fwdZ: fwd.z, rightX: right.x, rightZ: right.z,
      jumpKey: k.has('Space'), crouchKey: k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyC'), dt,
    }, world)
    liftCarry(lc, dt, GROUND_Y)   // M48: the lift's cars move, the keeper on one rides
    if (lc.py < fallY) { onFall(); return }
    tickFeet(lc, dt)   // footsteps / jump / land: silent until the sound is voted yay

    camera.position.set(lc.px, eyeY(lc), lc.pz)
    camera.rotation.set(pitch, yaw, 0, 'YXZ')
    setListener({ x: lc.px, y: eyeY(lc), z: lc.pz }, { x: fwd.x, y: 0, z: fwd.z })   // M99: positional sounds hear from the keeper (nothing set it before: every `at` panned from the world origin)
    const speed = Math.hypot(lc.hvx, lc.hvz), cam = camera as THREE.PerspectiveCamera
    const st = getSettings()
    const fov = st.fov + (st.speedFov ? FOV_KICK : 0) * Math.min(1, Math.max(0, (speed - WALK_SPEED) / (SPEED_CAP - WALK_SPEED)))
    const ads = fpGunAds()
    if (ads.optic && ads.t > 0.001) { const f = adsFov(st.fov, ads.optic, ads.t); if (Math.abs(cam.fov - f) > 0.01) { cam.fov = f; cam.updateProjectionMatrix() } }   // the gun already eases t: follow it exactly
    else if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 8); cam.updateProjectionMatrix() }
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
