// ── Segs collision — multi-surface ground for the 3D walker ────────────────────
// The ONE physics change that turns Shimmer's single-height terrain (exactly one walkable Y per
// (x,z) cell, held in `heights[z][x]`) into TRUE high/low branching: authored platforms ("segs")
// stacked OVER the same plan cell, so a high road and a low road can share footprint and both be
// walkable. Which one you're on is chosen by your CURRENT elevation, not by the tile.
//
// LANE CONTRACT (Shimmer swarm, 2026-07-21):
//   • hub    — owns THIS file: the resolution math + the Seg / SegLayer / CollisionCtx types.
//   • world  — authors Seg[] (elevated platforms, from the map editor / save-structure) and loads
//              them into a SegLayer via buildSegLayer().
//   • play3d — consumes: calls resolveStand() / canStandAt() from its movement loop in Shimmer3D.tsx,
//              passing the walker's current elevation (p.y / STEP) as `fromY`.
// EMPTY_SEGS reproduces today's flat-grid behavior EXACTLY (proven in segs-collision.test.ts), so
// play3d can wire the API with zero behavior change before a single seg is authored.
//
// Units: heights + seg tops are TIER units (same scale as heights[z][x]); the walker multiplies by STEP.

import { SOLID } from '../world/tiles'

const VOID_ID = -1 // empty cell — renders nothing, never walkable (matches Shimmer3D's VOID)

export type SegId = string

/** An authored elevated walkable surface: a rectangular footprint at one top height.
 *  Rect keeps authoring cheap (drop a platform in the editor); the layer expands it to cells.
 *  v1 is flat rectangular platforms — per-cell masks or slopes can extend Seg later without
 *  touching a single caller, because callers only ever see resolved `Surface`s. */
export interface Seg {
  id: SegId
  x: number; z: number   // top-left plan cell of the footprint
  w: number; d: number   // width (along x) / depth (along z) in cells, both >= 1
  y: number              // surface top, in tier units
}

/** Cell-indexed view of the segs for O(1) lookup during movement. Build once per map load. */
export interface SegLayer {
  at: Map<string, Seg[]>  // "x,z" -> segs covering that cell, sorted by top ascending
  count: number
}

/** Everything the resolver needs, passed in so this module stays pure (no React / Three). */
export interface CollisionCtx {
  grid: number[][]     // tile ids; gates SOLID / void / bounds for the base ground
  heights: number[][]  // base-ground top per cell, tier units
  segs: SegLayer       // authored elevated surfaces (EMPTY_SEGS => flat world)
}

/** A resolved walkable surface at a cell: the ground, or one authored seg. */
export interface Surface {
  y: number                    // surface top, tier units
  kind: 'ground' | 'seg'
  segId?: SegId
}

export interface StandOpts {
  /** How high the walker can step UP in one move. Default 1 mirrors the old `<= 1` tier rule.
   *  Dropping DOWN is unbounded (you can walk off any ledge). */
  stepUp?: number
}

const key = (x: number, z: number) => `${x},${z}`

export const EMPTY_SEGS: SegLayer = { at: new Map(), count: 0 }

/** Expand rectangular segs into a cell-indexed, top-sorted layer. */
export function buildSegLayer(segs: Seg[]): SegLayer {
  const at = new Map<string, Seg[]>()
  for (const s of segs) {
    for (let dz = 0; dz < s.d; dz++) {
      for (let dx = 0; dx < s.w; dx++) {
        const k = key(s.x + dx, s.z + dz)
        const arr = at.get(k)
        if (arr) arr.push(s)
        else at.set(k, [s])
      }
    }
  }
  for (const arr of at.values()) arr.sort((a, b) => a.y - b.y)
  return { at, count: segs.length }
}

/** The base ground surface at a cell, or null if that cell is out of bounds / void / solid.
 *  Mirrors Shimmer3D's old canStand gate (bounds + VOID + walkable) minus the height-step check,
 *  which resolveStand now owns for all surface kinds. */
function groundSurface(ctx: CollisionCtx, cx: number, cz: number): Surface | null {
  const { grid, heights } = ctx
  if (cz < 0 || cz >= grid.length) return null
  const row = grid[cz]
  if (!row || cx < 0 || cx >= row.length) return null
  const tile = row[cx]
  if (tile === VOID_ID) return null
  if (SOLID[tile & 0xFF]) return null
  return { y: heights[cz]?.[cx] ?? 0, kind: 'ground' }
}

/** Every walkable surface at a plan cell — ground (if any) plus each covering seg — top-sorted. */
export function surfacesAt(ctx: CollisionCtx, cx: number, cz: number): Surface[] {
  const out: Surface[] = []
  const g = groundSurface(ctx, cx, cz)
  if (g) out.push(g)
  const segs = ctx.segs.at.get(key(cx, cz))
  if (segs) for (const s of segs) out.push({ y: s.y, kind: 'seg', segId: s.id })
  if (out.length > 1) out.sort((a, b) => a.y - b.y)
  return out
}

/** The surface the walker at `fromY` (tier units) occupies when standing at (cx,cz).
 *
 *  Rule — among surfaces REACHABLE from fromY (top <= fromY + stepUp: step UP at most stepUp,
 *  drop DOWN any distance), pick the HIGHEST. That one rule is the whole branching behavior:
 *    • low road (fromY≈0) beneath a high seg at y=3 → 3 > 0+1, unreachable → stay on ground,
 *      walking UNDER the high road.
 *    • climbed up (fromY≈3) → the high seg (top 3) is reachable AND highest → you're on it.
 *    • high road ends → only ground (y=0) ahead: 0 <= 3+1 reachable → you drop onto it.
 *  Returns null when nothing is reachable (a wall, void, or a ledge too tall to step onto). */
export function resolveStand(ctx: CollisionCtx, cx: number, cz: number, fromY: number, opts: StandOpts = {}): Surface | null {
  const stepUp = opts.stepUp ?? 1
  const ceil = fromY + stepUp
  let best: Surface | null = null
  for (const s of surfacesAt(ctx, cx, cz)) {
    if (s.y <= ceil && (!best || s.y > best.y)) best = s
  }
  return best
}

/** Can the walker at `fromY` step onto (cx,cz)? (resolveStand !== null). Drop-in for the old canStand. */
export function canStandAt(ctx: CollisionCtx, cx: number, cz: number, fromY: number, opts: StandOpts = {}): boolean {
  return resolveStand(ctx, cx, cz, fromY, opts) !== null
}
