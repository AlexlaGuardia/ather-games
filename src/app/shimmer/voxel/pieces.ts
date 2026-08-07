// Building pieces — the half of construction that is NOT blocks.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// ── ★ THE MODEL (STRUCTURE-LAYER.md): BLOCKS BUILD THE SHELL, PIECES DRESS IT ────────────────
// Blocks are structure — walls, floors, foundations, the flat surfaces nobody looks at. They meet
// uneven ground the way terrain does, so **no terrain flattening is needed**. That was the whole
// reason the first, Sims-scale version of this design failed: The Sims looks clean because lots are
// FLAT, and our columns step up to 3 voxels, so a room-scale wall floats, sinks, or clips.
//
// Pieces are the LOOK — door, window, roof, stair, beam — exactly the elements that are ugly as
// cubes. Block-thick and grid-aligned, the way Valheim's are, so they sit *with* the terrain.
//
// ── ★ OCCUPANCY IS WHY THIS IS AFFORDABLE ───────────────────────────────────────────────────
// A placed piece writes `STRUCTURE` into the voxel grid even though it renders as a mesh. Collision
// is then UNCHANGED — the existing voxel lookup, capsule check, frontier rule and drop physics all
// work on buildings for free. No mesh colliders, no AABB tree, no second collision system. The
// expensive-sounding half of the idea reduces to a value already in an array.

/** Reserved material for "a piece is here". Past WOOD (…39) with room between. */
export const STRUCTURE = 48

export type Rotation = 0 | 1 | 2 | 3

export interface PieceDef {
  id: string
  name: string
  /** Occupancy in blocks at rotation 0. */
  w: number; h: number; d: number
  cost: { itemId: string; count: number }[]
  /**
   * ⚠ FOOTPRINT IS NOT VISUAL BOUNDS. A roof slope overhangs the blocks it occupies and a doorway's
   * opening is walkable — the model may be larger, smaller or hollower than this box. Occupancy is
   * what you collide with; the model is what you see. Conflating them is how a decorative overhang
   * becomes an invisible wall you cannot walk under.
   */
  /** Cells inside the footprint that stay PASSABLE — a doorway you can walk through. */
  passable?: { x: number; y: number; z: number }[]
}

/**
 * The v1 catalogue. Six, deliberately.
 *
 * ★ FLOORS AND WALLS ARE NOT HERE — they are blocks. These six are exactly the elements that read
 * badly as cubes, which is the entire point of the split. Six is enough to make a block shed read as
 * a building, and that is the only thing v1 has to prove. Do not model forty against an unproven
 * loop.
 *
 * ⚠ Costs use item ids the block registry already drops, and `goldwood_plank` is a RULED canon name
 * from `world/resources.ts`. No new material names. Piece NAMES beyond plain English would be
 * canon-adjacent — those get marked TBD-CANON and batched to Magii, not invented here.
 */
export const PIECES: PieceDef[] = [
  // A doorway is 1x3x1 of occupancy with the middle two cells walkable — the frame is solid, the
  // opening is not. This is the clearest case of footprint ≠ visual bounds in the whole catalogue.
  { id: 'doorway', name: 'Doorway', w: 1, h: 3, d: 1,
    cost: [{ itemId: 'goldwood_plank', count: 6 }],
    passable: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }] },

  { id: 'window', name: 'Window', w: 1, h: 2, d: 1,
    cost: [{ itemId: 'goldwood_plank', count: 4 }] },

  { id: 'roof_slope', name: 'Roof Slope', w: 1, h: 1, d: 1,
    cost: [{ itemId: 'shimmeroak_plank', count: 3 }] },

  { id: 'roof_cap', name: 'Roof Cap', w: 1, h: 1, d: 1,
    cost: [{ itemId: 'shimmeroak_plank', count: 4 }] },

  // Stairs are walkable by design — you stand ON them, so the occupied cell must not block you.
  { id: 'stair', name: 'Stair', w: 1, h: 1, d: 1,
    cost: [{ itemId: 'block_stone', count: 3 }],
    passable: [{ x: 0, y: 0, z: 0 }] },

  { id: 'beam', name: 'Beam', w: 1, h: 1, d: 1,
    cost: [{ itemId: 'goldwood_plank', count: 2 }] },
]

const BY_ID = new Map(PIECES.map(p => [p.id, p]))
export const pieceDef = (id: string): PieceDef | undefined => BY_ID.get(id)

export interface Placement {
  pieceId: string
  /** World position of the piece's origin cell. */
  x: number; y: number; z: number
  rot: Rotation
}

/** Footprint extent after rotation. 90° swaps width and depth; height never rotates. */
export function rotatedSize(def: PieceDef, rot: Rotation): { w: number; h: number; d: number } {
  return rot % 2 === 0 ? { w: def.w, h: def.h, d: def.d } : { w: def.d, h: def.h, d: def.w }
}

/** Rotate a local cell offset about the piece origin, in the XZ plane. */
export function rotateCell(x: number, z: number, def: PieceDef, rot: Rotation): { x: number; z: number } {
  switch (rot) {
    case 0: return { x, z }
    case 1: return { x: def.d - 1 - z, z: x }
    case 2: return { x: def.w - 1 - x, z: def.d - 1 - z }
    default: return { x: z, z: def.w - 1 - x }
  }
}

/** Every world cell a placement occupies, with whether that cell blocks movement. */
export function cellsOf(p: Placement, def: PieceDef): { x: number; y: number; z: number; solid: boolean }[] {
  const out: { x: number; y: number; z: number; solid: boolean }[] = []
  const passable = new Set((def.passable ?? []).map(c => `${c.x},${c.y},${c.z}`))
  for (let ly = 0; ly < def.h; ly++) {
    for (let lz = 0; lz < def.d; lz++) {
      for (let lx = 0; lx < def.w; lx++) {
        const r = rotateCell(lx, lz, def, p.rot)
        out.push({
          x: p.x + r.x, y: p.y + ly, z: p.z + r.z,
          solid: !passable.has(`${lx},${ly},${lz}`),
        })
      }
    }
  }
  return out
}

/**
 * May this placement go here?
 *
 * `at` returns the CURRENT voxel. A piece may only occupy air — it never overwrites terrain, ore or
 * another piece. Refusing rather than overwriting is what stops a misclick eating a wall you built.
 */
export function canPlace(
  p: Placement, def: PieceDef, at: (x: number, y: number, z: number) => number,
): boolean {
  for (const c of cellsOf(p, def)) {
    if (at(c.x, c.y, c.z) !== 0) return false   // 0 = AIR
  }
  return true
}

/** Can the player afford it? `have` is a per-item count lookup. */
export const canAfford = (def: PieceDef, have: (itemId: string) => number): boolean =>
  def.cost.every(c => have(c.itemId) >= c.count)

/**
 * Which placement, if any, occupies this world cell.
 *
 * Deconstruction needs to answer "what did I just look at" from a voxel coordinate, and a piece is
 * not stored per-voxel — only its origin is. A linear scan is fine at v1 scale and honest about it;
 * a spatial index is the optimisation you add when a village has thousands of pieces, not before.
 */
export function placementAt(
  placements: Placement[], x: number, y: number, z: number,
): Placement | undefined {
  for (const p of placements) {
    const def = pieceDef(p.pieceId)
    if (!def) continue
    for (const c of cellsOf(p, def)) if (c.x === x && c.y === y && c.z === z) return p
  }
  return undefined
}
