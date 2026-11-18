// GATE IN THE OPEN WORLD (BETA M15c): a bare spiral binding two points. Keeper-side: the host's walker steps it each frame
// and moves the keeper when it says so. The rules are engine/gate-spiral.ts (RULED 2026-09-28, never travel, never outlasts
// the fight); this only places the two ends and pays the bill. Never a lasting doorway (that stays Eyuun's).
//   near = where the keeper stands · far = castRange out along where the keeper faces, on the ground there.
//   Hollows do not use it: gate-spiral.ts gives them no part (the keeper's door only).
// ★ PURE. No React, no three.
import { openSpiral, stepSpiral, type GateSpiral, type GateEnd, type SpiralClose } from '../../engine/gate-spiral'
import type { CastSpec } from '../../play3d/cast'

export type { GateSpiral, GateEnd, SpiralClose }

/** Strike the spiral: the near end at the feet, the far end castRange out along the facing (yaw: forward = -sin, -cos). */
export function openGate(spec: CastSpec, feet: { x: number; y: number; z: number }, yaw: number, groundAt: (x: number, z: number) => number, now: number): GateSpiral {
  const fx = feet.x - Math.sin(yaw) * spec.castRange, fz = feet.z - Math.cos(yaw) * spec.castRange
  return openSpiral(spec.moveId, { x: feet.x, y: feet.y, z: feet.z }, { x: fx, y: groundAt(fx, fz), z: fz }, spec, now)
}

export interface GateTick { gate: GateSpiral | null; mana: number; warpTo: GateEnd | null; closed: SpiralClose | null }
/** One frame: pays the per-second bill from `mana`, carries the keeper through an end they step into, closes at areaSecs or when the pool cannot pay. */
export function gateTick(g: GateSpiral, feet: { x: number; y: number; z: number }, dt: number, mana: number, now: number): GateTick {
  const s = stepSpiral(g, feet.x, feet.y, feet.z, dt, mana, now)
  return { gate: s.spiral, mana: mana - s.drain, warpTo: s.warpTo, closed: s.closed }
}
