// Mining — what you are looking at, and how long it takes to break.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder. Mining is a rule, not a
// rendering concern, so it lives here and is testable without a browser.

import { AIR } from './section'
import { blockDef, breakSeconds, type BlockSkill } from './registry'

export interface RayHit {
  /** The voxel that was hit. */
  x: number; y: number; z: number
  /** The empty voxel just before it — where a placed block would go. */
  px: number; py: number; pz: number
  material: number
  distance: number
}

/**
 * Voxel raycast — Amanatides & Woo grid traversal.
 *
 * ★ WHY NOT SMALL FIXED STEPS: sampling along the ray every 0.1 units is the obvious version and it
 * is wrong in a way you only notice later — it can step straight THROUGH the corner of a block, so
 * a wall you are clearly looking at occasionally refuses to be mined. This visits every voxel the
 * ray actually enters, in order, and cannot skip one.
 *
 * Returns the first non-air voxel within `maxDist`, plus the empty voxel before it, which is what
 * placement needs and what makes "place against the face you're looking at" fall out for free.
 */
export function raycast(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  maxDist: number,
  voxel: (x: number, y: number, z: number) => number,
): RayHit | null {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz)
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0

  // Distance along the ray to the next voxel boundary on each axis, and the distance between
  // successive boundaries. Infinity where the ray does not move on that axis at all.
  const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dx)
  const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dy)
  const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(1 / dz)
  let tMaxX = stepX === 0 ? Infinity : ((stepX > 0 ? x + 1 - ox : ox - x) / Math.abs(dx))
  let tMaxY = stepY === 0 ? Infinity : ((stepY > 0 ? y + 1 - oy : oy - y) / Math.abs(dy))
  let tMaxZ = stepZ === 0 ? Infinity : ((stepZ > 0 ? z + 1 - oz : oz - z) / Math.abs(dz))

  let px = x, py = y, pz = z
  let t = 0

  // The origin itself may already be inside a block (head in a ceiling); check before stepping.
  const first = voxel(x, y, z)
  if (first !== AIR) return { x, y, z, px, py, pz, material: first, distance: 0 }

  while (t <= maxDist) {
    px = x; py = y; pz = z
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX }
    else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY }
    else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ }
    if (t > maxDist) break
    const m = voxel(x, y, z)
    if (m !== AIR) return { x, y, z, px, py, pz, material: m, distance: t }
  }
  return null
}

export interface BreakState {
  /** The voxel being worked on, or null when nothing is. */
  x: number; y: number; z: number
  material: number
  /** Seconds of effort accumulated. */
  progress: number
  /** Seconds required in total, for this block with this tool. */
  required: number
}

/**
 * Advance a break in progress.
 *
 * ★ ACCUMULATED DAMAGE AGAINST A THRESHOLD, NOT A TIMER (research steal #16). The difference only
 * shows up in the cases that matter: releasing the button and pressing it again, swapping tools
 * mid-swing, or looking away and back. A timer restarts and feels broken; accumulated progress
 * behaves correctly in all three without a single extra branch. It is also why `required` is
 * recomputed every tick — swap to a better spike and the block you are already halfway through
 * finishes faster, which is what a player expects and what a timer cannot express.
 *
 * Returns the new state, or `'broken'` when the block should be removed.
 */
/**
 * ── ★ A LIVE DIAL FOR HOW LONG BLOCKS TAKE (2026-08-12, Alex: mining is "way too fast") ─────────
 * Two real bugs were making mining faster than the registry intended, and both are fixed. What is
 * left is a TASTE question — whether the intended numbers are themselves right — and that is Alex's
 * to answer, not mine to guess. Guessing a multiplier on top of a fresh bug fix is how you overshoot
 * and then retune twice.
 *
 * So he gets the number rather than my opinion of it: `/mine 1.5` in the console makes every block
 * take half again as long, live, with no deploy. Same reasoning as the play lane's guard sliders —
 * a feel question that costs a build per guess does not get answered, it gets abandoned.
 *
 * ⚠ SCALED AT THE TICK, NOT THROUGH `toolSpeed`, and the difference matters: `breakSeconds` applies
 * `toolSpeed` on its two TOOL branches but deliberately drops it on the bare-hand branch, so a dial
 * riding on it would silently not touch hands — which is most of what a new keeper digs, and the
 * exact case Alex is judging. Slowing the accumulation instead is uniform across every branch.
 *
 * Session-only and never persisted: this is a measuring instrument. A dial that survives a refresh
 * is a game-balance change nobody remembers making.
 */
let breakRate = 1

/** Multiplier on how long every block takes. 1 = the registry's own numbers, 2 = twice as slow. */
export const setBreakRate = (r: number): void => { breakRate = Math.max(0.05, Math.min(20, r)) }
export const getBreakRate = (): number => breakRate

export function tickBreak(
  state: BreakState | null,
  target: { x: number; y: number; z: number; material: number } | null,
  dt: number,
  toolTier: number,
  toolSkill: BlockSkill,
  toolSpeed = 1,
): { state: BreakState | null; broken: boolean } {
  if (!target) return { state: null, broken: false }

  const required = breakSeconds(target.material, toolTier, toolSkill, toolSpeed)
  if (required === Infinity) return { state: null, broken: false }   // refused, not slowed

  // Looking at a different block — or the same block having become something else — discards
  // progress. Anything else lets a player nibble a hard block by flicking between two of them.
  const same = state
    && state.x === target.x && state.y === target.y && state.z === target.z
    && state.material === target.material

  // The dial slows the ACCUMULATION rather than inflating `required`, so `state.required` stays the
  // registry's honest number and the break-progress HUD keeps meaning what it says.
  const progress = (same ? state!.progress : 0) + dt / breakRate
  if (progress >= required) {
    return { state: null, broken: true }
  }
  return {
    state: { x: target.x, y: target.y, z: target.z, material: target.material, progress, required },
    broken: false,
  }
}

/** What a broken block yields. Empty for bedrock, water, and anything with no drop table. */
/**
 * What breaking this block yields, rolling any chance-gated entries.
 *
 * ⚠ `rng` is injectable so the oracle can prove a one-in-a-million drop actually fires without
 * waiting for a one-in-a-million event. A rare drop nobody can test is a rare drop nobody knows is
 * WIRED — and the failure mode (a typo'd item id that simply never appears) is invisible in play.
 */
export function dropsFor(
  material: number, rng: () => number = Math.random,
): { itemId: string; count: number }[] {
  const all = blockDef(material)?.drops ?? []
  const out: { itemId: string; count: number }[] = []
  for (const d of all) {
    if (d.chance !== undefined && rng() >= d.chance) continue
    out.push({ itemId: d.itemId, count: d.count })
  }
  return out
}
