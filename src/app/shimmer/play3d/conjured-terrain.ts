// conjured-terrain.ts — SYSTEM 2 of 3: runtime terrain.
//
// ── WHY ────────────────────────────────────────────────────────────────────────
// "Stonewall — tear rock from the ground into a wall. Terrain you impose. Close the gap, do not
// chase." That is the clearest statement of what a keeper does that a gun cannot: it does not
// remove a threat, it changes the SHAPE of the fight. Cordon seals an area; Living Architecture
// grows structure. All three need one thing the build never had — a wall that exists at runtime.
//
// ── THE DESIGN CALL: cells, not meshes ─────────────────────────────────────────
// Shimmer's collision is grid-tile based (`grid[z][x] & 0xFF === WALL_ID`), and everything already
// consults it: the walker's body buffer, the hunter's step, the guards' step, every projectile.
// So conjured terrain is a set of TILE CELLS with an expiry, and one predicate — `blockedAt` —
// gets consulted next to the grid check at each of those sites. That means a conjured wall blocks
// the player, the AI and bullets identically, for free, and it can never corrupt the zone's real
// tilemap (which is authored data and persists).
//
// ── BOUNDARY ───────────────────────────────────────────────────────────────────
// The SHAPES here (a line, a ring, a block) are build calls. Which move conjures which shape, and
// its size/duration, live on the move's CastSpec — no move names in this module.

export interface Conjured {
  id: number
  moveId: string
  /** occupied tile cells, integer grid coords */
  cells: { x: number; z: number }[]
  until: number
  /** tiers of height the slab stands — render only; collision is binary */
  height: number
}

export const MAX_CONJURED = 6

let nextId = 1
export function resetConjuredIds(): void { nextId = 1 }

/** Round a world position to the tile cell that contains it — the same rounding the sim uses. */
export const cellOf = (x: number, z: number) => ({ x: Math.round(x), z: Math.round(z) })

/** de-dupe cells so a shape can be built by overlapping pieces without double-counting */
function uniq(cells: { x: number; z: number }[]): { x: number; z: number }[] {
  const seen = new Set<string>()
  return cells.filter((c) => {
    const k = `${c.x},${c.z}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * A WALL: `length` cells laid PERPENDICULAR to the cast direction, centred on (cx,cz).
 *
 * Perpendicular is the whole point — a wall along your aim would be a corridor you shot down. The
 * axis is chosen by which component of the aim dominates, so the wall always presents its face to
 * whatever you were looking at, and it snaps to the grid the collision actually uses.
 */
export function wallCells(cx: number, cz: number, dirX: number, dirZ: number, length: number): { x: number; z: number }[] {
  const c = cellOf(cx, cz)
  const half = Math.floor(length / 2)
  const alongX = Math.abs(dirX) < Math.abs(dirZ)  // facing mostly along Z ⇒ the wall runs along X
  const out: { x: number; z: number }[] = []
  for (let i = -half; i <= half; i++) out.push(alongX ? { x: c.x + i, z: c.z } : { x: c.x, z: c.z + i })
  return uniq(out)
}

/**
 * A RING: a closed loop of cells at `radius` around (cx,cz) — Cordon's "stone rises on every side".
 * Sealed on purpose: containment is the move's whole identity, so it traps YOU too if you stand in
 * it. That is the honest reading of "seal an area entirely" and it makes the cast a real decision.
 */
export function ringCells(cx: number, cz: number, radius: number): { x: number; z: number }[] {
  const c = cellOf(cx, cz)
  const r = Math.max(1, Math.round(radius))
  const out: { x: number; z: number }[] = []
  // walk the circle by angle at a step fine enough that no cell gap opens at this radius
  const steps = Math.max(16, Math.ceil(2 * Math.PI * r * 2))
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    out.push({ x: c.x + Math.round(Math.cos(a) * r), z: c.z + Math.round(Math.sin(a) * r) })
  }
  return uniq(out)
}

/** A BLOCK: a square of side `side` — Living Architecture's grown structure (cover you can hide behind). */
export function blockCells(cx: number, cz: number, side: number): { x: number; z: number }[] {
  const c = cellOf(cx, cz)
  const half = Math.floor(side / 2)
  const out: { x: number; z: number }[] = []
  for (let dx = -half; dx <= half; dx++) for (let dz = -half; dz <= half; dz++) out.push({ x: c.x + dx, z: c.z + dz })
  return uniq(out)
}

export type ConjureShape = 'wall' | 'ring' | 'block'

export function shapeCells(shape: ConjureShape, cx: number, cz: number, dirX: number, dirZ: number, size: number): { x: number; z: number }[] {
  if (shape === 'ring') return ringCells(cx, cz, size)
  if (shape === 'block') return blockCells(cx, cz, size)
  return wallCells(cx, cz, dirX, dirZ, size)
}

/** Raise terrain. Oldest is dropped at the cap so a paid cast always appears. */
export function conjure(list: Conjured[], moveId: string, cells: { x: number; z: number }[], secs: number, height: number, now: number): Conjured[] {
  const c: Conjured = { id: nextId++, moveId, cells, until: now + secs * 1000, height }
  const kept = list.length >= MAX_CONJURED ? list.slice(1) : list
  return [...kept, c]
}

export function expireConjured(list: Conjured[], now: number): Conjured[] {
  return list.some((c) => c.until <= now) ? list.filter((c) => c.until > now) : list
}

/**
 * THE PREDICATE. Consulted right next to every `grid[z][x] === WALL_ID` check in the sim, so a
 * conjured slab blocks the walker, the hunter, the guards and every projectile by one rule.
 *
 * Takes WORLD coords and rounds them itself, so callers can't disagree about the rounding.
 */
export function blockedAt(list: Conjured[], x: number, z: number, now: number): boolean {
  const cx = Math.round(x), cz = Math.round(z)
  for (const c of list) {
    if (c.until <= now) continue
    for (const cell of c.cells) if (cell.x === cx && cell.z === cz) return true
  }
  return false
}

/** Every live cell, flattened — the render pool reads this. */
export function liveCells(list: Conjured[], now: number): { x: number; z: number; height: number }[] {
  return list.filter((c) => c.until > now).flatMap((c) => c.cells.map((cell) => ({ ...cell, height: c.height })))
}
