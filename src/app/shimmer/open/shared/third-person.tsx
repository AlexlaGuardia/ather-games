'use client'
// ── THIRD PERSON, A TEST VIEW (Alex 11-17: the body is the segmented doll; 11-18: the game is played in FIRST person) ─────
// NOT part of the game: V works only under ?tune=1, to look at the doll other keepers will see. The game's own camera is
// first person; any later pull-back (driving, emotes) is its own feature.
// There are no other keepers in the world yet, so the doll is checked behind your own camera: V (tune only) pulls the lens
// back over your shoulder and the doll (keeper-doll.tsx) walks, runs, jumps, swings, casts and aims off the
// walker's real state. The same body is what other keepers will see once the Wilds are shared.
//
// The page drives it from the walker's onTick (after the walker has placed the first-person camera): `dollAction` picks the
// pose, `pullBack` moves the lens. Both pure; the component only mounts the doll and lends the page its camera.
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { KeeperDoll, type DollDrive } from './keeper-doll'
import type { KeeperAction } from './keeper-pose'

export const THIRD = { BACK: 3.4, UP: 0.55, CLEAR: 0.35, WALK: 4.2, RUN: 6.5, RUN_AT: 5.2, CAST_MS: 640 } as const

export interface BodyNow { speed: number; airborne: boolean; working: boolean; castAgoMs: number; gun: boolean }
/** Which pose the doll holds right now. Air outranks everything; a tool in the work outranks the feet. */
export function dollAction(b: BodyNow): { action: KeeperAction; rate: number } {
  if (b.airborne) return { action: 'jump', rate: 1 }
  if (b.working) return { action: 'swing', rate: 1 }
  if (b.castAgoMs >= 0 && b.castAgoMs < THIRD.CAST_MS) return { action: 'cast', rate: 1 }
  if (b.gun && b.speed < 0.3) return { action: 'aim', rate: 1 }
  if (b.speed >= THIRD.RUN_AT) return { action: 'run', rate: b.speed / THIRD.RUN }
  if (b.speed >= 0.3) return { action: 'walk', rate: b.speed / THIRD.WALK }
  return { action: 'idle', rate: 1 }
}

const fwd = new THREE.Vector3()
/** Move the first-person camera back over the keeper's head, never under the ground at the new spot. */
export function pullBack(cam: THREE.Camera, groundAt: (x: number, z: number) => number, feetY: number): void {
  fwd.set(0, 0, -1).applyQuaternion(cam.quaternion)
  cam.position.addScaledVector(fwd, -THIRD.BACK)
  cam.position.y += THIRD.UP
  const g = groundAt(cam.position.x, cam.position.z)
  cam.position.y = Math.max(cam.position.y, (Number.isFinite(g) ? g : feetY) + THIRD.CLEAR, feetY + 0.6)
}

export const newDrive = (): DollDrive => ({ action: 'idle', rate: 1, x: 0, y: 0, z: 0, yaw: 0, visible: false })

/** Mounts the doll, and hands the page the R3F camera (the walker's onTick has no other way to reach it). */
export function ThirdPersonBody({ drive, camRef }: { drive: React.MutableRefObject<DollDrive>; camRef: React.MutableRefObject<THREE.Camera | null> }) {
  const { camera } = useThree()
  camRef.current = camera
  return <KeeperDoll action="idle" drive={drive} />
}
