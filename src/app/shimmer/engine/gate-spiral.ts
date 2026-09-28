// gate-spiral.ts — GATE IN A FIGHT: a bare spiral binding two points inside one fight.
//
// ★ PURE. No react, no three, no DOM. The host strikes the ends and moves the body; this decides WHEN.
//
// ── ★★ RULED 2026-09-28 (/magii + Alex, `game/moves.md` › GATE IN A FIGHT) ──────────────────────────────
// *"Both ends in the caster's sight and on the fight's ground; it closes when the caster stops spending; it
// never leaves the zone, never outlasts the fight, never becomes travel."* `world/gates.md`'s own bare spiral:
// *struck, spending, going.* So the shape here is the ruling, clause by clause:
//   · two ends, NEAR (where the caster stood) and FAR (struck down the reticle, in sight — the host checks);
//   · a DOOR, walkable both ways while it stands (gates.md: a gate binds two points into one);
//   · it BILLS by the second, and the moment the pool cannot pay it closes ('spent'), which is "closes when the
//     caster stops spending" as arithmetic; a re-press lets it go early (the host's `closeSpiral`);
//   · it has a hard ceiling (`maxMs`) so it can never outlast a fight, and nothing here persists across zones.
//
// ⚠ AN END YOU ARRIVE IN IS DISARMED until you step out of it. Without that, arriving inside the far end
// would send you straight back, and a keeper standing still would ping-pong between the two every frame.
//
// Numbers (range, radius, drain, ceiling) are Jin's and live on the CastSpec, never here.

export interface GateEnd { x: number; y: number; z: number }

export interface GateSpiral {
  moveId: string
  near: GateEnd
  far: GateEnd
  /** how close (flat) the body must come to an end to step through it */
  radius: number
  openedAt: number
  /** ms the spiral may stand at most, whatever the pool says */
  maxMs: number
  /** mana per second while it stands */
  drainPerSec: number
  /** per end [near, far]: will stepping into it carry you through? */
  armed: [boolean, boolean]
}

/** how far above or below an end's ground a body still counts as standing in it */
export const SPIRAL_REACH_Y = 2

export function openSpiral(
  moveId: string, near: GateEnd, far: GateEnd,
  spec: { areaSize: number; areaSecs: number; sustainDrain: number }, now: number,
): GateSpiral {
  // the caster stands in the near end as it is struck: it starts disarmed, or the cast would carry them at once
  return { moveId, near, far, radius: spec.areaSize, openedAt: now, maxMs: spec.areaSecs * 1000, drainPerSec: spec.sustainDrain, armed: [false, true] }
}

export type SpiralClose = 'spent' | 'timeout'
export interface SpiralStep {
  spiral: GateSpiral | null
  /** mana this frame costs (0 when it closed this frame) */
  drain: number
  /** the body steps through: move it here */
  warpTo: GateEnd | null
  closed: SpiralClose | null
}

const inside = (e: GateEnd, r: number, x: number, y: number, z: number): boolean =>
  (x - e.x) ** 2 + (z - e.z) ** 2 <= r * r && Math.abs(y - e.y) <= SPIRAL_REACH_Y

/** advance one frame with the body at (x, y, z) (feet) and `mana` in the pool */
export function stepSpiral(g: GateSpiral, x: number, y: number, z: number, dt: number, mana: number, now: number): SpiralStep {
  if (now - g.openedAt >= g.maxMs) return { spiral: null, drain: 0, warpTo: null, closed: 'timeout' }
  const drain = g.drainPerSec * Math.max(0, dt)
  if (mana < drain) return { spiral: null, drain: 0, warpTo: null, closed: 'spent' }
  const ends = [g.near, g.far] as const
  const armed: [boolean, boolean] = [g.armed[0], g.armed[1]]
  let warpTo: GateEnd | null = null
  for (let i = 0; i < 2 && !warpTo; i++) {
    const inIt = inside(ends[i], g.radius, x, y, z)
    if (inIt && armed[i]) {
      warpTo = ends[1 - i]
      armed[0] = false; armed[1] = false   // you arrive standing IN the other end: both wait for you to step out
    } else if (!inIt) armed[i] = true
  }
  return { spiral: { ...g, armed }, drain, warpTo, closed: null }
}

/** 0 (just struck) → 1 (about to close on its ceiling) — what the host's spiral turns at */
export const spiralAge = (g: GateSpiral, now: number): number => Math.min(1, Math.max(0, (now - g.openedAt) / g.maxMs))
