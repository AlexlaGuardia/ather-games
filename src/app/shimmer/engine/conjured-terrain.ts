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
// ── ★ MOVED play3d/ → engine/ 2026-08-14 — AND IN THE VOXEL WORLD IT IS REAL BLOCKS ─────────────
// Step 3 of the cast port. This module stays exactly what it was — a pure set of cells with an
// expiry — but the two hosts now realise it very differently, and the voxel one is the better
// version of the feature:
//
//   play3d   cells + `blockedAt`, consulted beside the tilemap. A wall can only ever BLOCK.
//   voxel3d  the cells are WRITTEN, as `MAT.CONJURED` voxels stacked to `shapeHeight`.
//
// ★ WHY THAT MATTERS BEYOND TIDINESS: a written block is a block. It collides, it meshes, it
// occludes, it lights, and **you can stand on it** — so Glacial Path's canon *"bridges, ramps,
// slides"* stops being impossible. play3d's collision is binary (in a cell or not), which is why
// the 08-13 note had to write that half off; a voxel has a top face.
//
// ⚠ THE HOST WRITES STRAIGHT INTO SECTIONS, NEVER THROUGH `setVoxel`. Same rule and same reason as
// `applyGenPieces`: regenerable content must not enter the save. A conjured wall is a RUNTIME
// OCCUPANCY, not an edit to the world — close the tab mid-Cordon and it is simply gone, which is the
// only behaviour that cannot litter a save with permanent free stone.
//
// ⚠ AND IT ONLY EVER WRITES INTO AIR, recording exactly which cells it wrote, so expiry reverts its
// own work and nothing else. A wall that overwrote a chest and then "restored" AIR over it would
// destroy player property on a ten-second timer.
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
  /** ★ WALKABLE (09-29, Living Architecture): parallel to `cells`, each cell's stone from `base` to `top` (ABSOLUTE
   *  tier heights, read off the ground when it was cast). Present = the walker can STAND on it and a round is only
   *  stopped below its top; absent = the old binary slab. AI still treats every conjured cell as a wall. */
  stand?: Stand[]
}
export interface Stand { base: number; top: number }

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

/**
 * ── ★ WHICH VOXELS A CONJURED SHAPE ACTUALLY WRITES (2026-08-14) ────────────────────────────────
 * Pure on purpose: this is the invariant the whole voxel port rests on, and it does not belong
 * buried in a 5,000-line component where nothing can assert it.
 *
 * Two rules, both load-bearing:
 *  1. **A column grows from its OWN ground.** `groundTop` is asked per cell, so a wall follows a
 *     slope instead of burying its low end and floating its high one — and it grows off a roof the
 *     player built, because the host's probe reads the live world.
 *  2. **Never overwrite anything.** Only cells that are currently air are returned, so the caller's
 *     revert (write air back to exactly these) can never destroy what the wall grew against. A wall
 *     that "restored" air over a chest would be a ten-second timer on player property.
 *
 * ⚠ It also SKIPS rather than stops when a cell is occupied. A wall crossing a boulder should carry
 * on past it with a notch missing, not give up at the boulder and leave half a wall.
 */
export function conjuredWriteCells(
  cells: readonly { x: number; z: number; rise?: number }[],
  height: number,
  groundTop: (x: number, z: number) => number,
  isAir: (x: number, y: number, z: number) => boolean,
  worldHeight: number,
): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = []
  for (const c of cells) {
    const top = groundTop(c.x, c.z)
    // a cell that carries its own `rise` (a ledge's stair) stands that tall; every other cell stands `height`
    for (let h = 1; h <= (c.rise ?? height); h++) {
      const y = top + h
      if (y < 0 || y >= worldHeight) break
      if (!isAir(c.x, y, c.z)) continue
      out.push({ x: c.x, y, z: c.z })
    }
  }
  return out
}

/**
 * A LEDGE WITH A RAMP (Living Architecture, Alex ✓ 09-28: "grow a ledge with a ramp: instant high ground and cover
 * you can climb"). A `side`-square ledge `height` tiers up, centred on (cx,cz), and a full-width stair of
 * `height - 1` steps running back toward the caster (opposite the aim), each one tier lower than the last, so the
 * walker's one-tier step-up climbs it and every other face is a wall `height` tall. `rise` is each cell's height.
 */
export function ledgeCells(cx: number, cz: number, dirX: number, dirZ: number, side: number, height: number): { x: number; z: number; rise: number }[] {
  const c = cellOf(cx, cz)
  const half = Math.floor(side / 2)
  const out: { x: number; z: number; rise: number }[] = []
  for (let dx = -half; dx <= half; dx++) for (let dz = -half; dz <= half; dz++) out.push({ x: c.x + dx, z: c.z + dz, rise: height })
  const alongZ = Math.abs(dirZ) >= Math.abs(dirX)   // aiming mostly along z ⇒ the stair runs back along z
  const back = alongZ ? -Math.sign(dirZ || 1) : -Math.sign(dirX || 1)
  for (let k = 1; k < height; k++) for (let w = -half; w <= half; w++) {
    const d = half + k
    out.push(alongZ ? { x: c.x + w, z: c.z + back * d, rise: height - k } : { x: c.x + back * d, z: c.z + w, rise: height - k })
  }
  return out
}

export type ConjureShape = 'wall' | 'ring' | 'block' | 'ledge'

/** The cells a shape covers. A `ledge`'s cells also carry their `rise` (pass the move's `shapeHeight`). */
export function shapeCells(shape: ConjureShape, cx: number, cz: number, dirX: number, dirZ: number, size: number, height = 1): { x: number; z: number }[] {
  if (shape === 'ring') return ringCells(cx, cz, size)
  if (shape === 'block') return blockCells(cx, cz, size)
  if (shape === 'ledge') return ledgeCells(cx, cz, dirX, dirZ, size, height)   // carries `rise`: conjuredWriteCells honours it
  return wallCells(cx, cz, dirX, dirZ, size)
}

/** Raise terrain. Oldest is dropped at the cap so a paid cast always appears. */
export function conjure(list: Conjured[], moveId: string, cells: { x: number; z: number }[], secs: number, height: number, now: number, stand?: Stand[]): Conjured[] {
  const c: Conjured = { id: nextId++, moveId, cells, until: now + secs * 1000, height, ...(stand ? { stand } : {}) }
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
export function blockedAt(list: Conjured[], x: number, z: number, now: number, y?: number): boolean {
  const cx = Math.round(x), cz = Math.round(z)
  for (const c of list) {
    if (c.until <= now) continue
    for (let i = 0; i < c.cells.length; i++) {
      const cell = c.cells[i]
      if (cell.x !== cx || cell.z !== cz) continue
      // a WALKABLE cell stops only what is below its top, when the caller says how high it is (a round). Without a
      // height (the hunter's and the guards' step), every conjured cell is a wall: they don't climb.
      const st = c.stand?.[i]
      if (st && y !== undefined && y >= st.top) continue
      return true
    }
  }
  return false
}

/** The binary walls only (the WALKER's blocker): a walkable cell is a surface, answered by `standAt`. */
export function wallAt(list: Conjured[], x: number, z: number, now: number): boolean {
  const cx = Math.round(x), cz = Math.round(z)
  for (const c of list) {
    if (c.until <= now || c.stand) continue
    for (const cell of c.cells) if (cell.x === cx && cell.z === cz) return true
  }
  return false
}

/** The highest walkable conjured stone at a cell (its absolute top), or null. */
export function standAt(list: Conjured[], x: number, z: number, now: number): Stand | null {
  const cx = Math.round(x), cz = Math.round(z)
  let best: Stand | null = null
  for (const c of list) {
    if (c.until <= now || !c.stand) continue
    c.cells.forEach((cell, i) => { if (cell.x === cx && cell.z === cz && (!best || c.stand![i].top > best.top)) best = c.stand![i] })
  }
  return best
}

/** Every live cell, flattened — the render pool reads this. */
export function liveCells(list: Conjured[], now: number): { x: number; z: number; height: number; stand?: Stand }[] {
  return list.filter((c) => c.until > now).flatMap((c) => c.cells.map((cell, i) => (c.stand ? { ...cell, height: c.height, stand: c.stand[i] } : { ...cell, height: c.height })))
}
