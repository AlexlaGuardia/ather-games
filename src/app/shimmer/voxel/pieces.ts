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
import type { BlockSkill } from './registry'

export const STRUCTURE = 48
/**
 * "The LOWER HALF of a piece is here" (2026-08-08, the half-slab pass). Collision reads this as
 * a cell whose top is +0.5 — the locomotion probe maps it to CELL_HALF, which is what lets you
 * STAND on a slab at half height and walk up half-rises without a vault. Same invisibility rule
 * as STRUCTURE in the mesher; the piece renderer draws the slab.
 */
export const STRUCTURE_HALF = 49

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
  /**
   * Occupies only the LOWER HALF of its cells (writes STRUCTURE_HALF, collides at +0.5). The
   * half-slab's whole mechanic; a flag rather than a per-cell table because no piece so far
   * wants a MIX of full and half cells — the day one does, this becomes per-cell like passable.
   */
  halfHeight?: boolean
  /**
   * ── ★ A CHOPPABLE PIECE (2026-08-12, Alex: "what if we didn't do blocky trees?") ──────────────
   * Structure pieces are deliberately unmineable — §4 of STRUCTURE-LAYER gives them infinite
   * hardness so a pick cannot chew a door, and deconstruct is its own verb. A TREE cannot work that
   * way. Felling is a real gathering verb with a tool family, a skill, XP and drops, and the whole
   * point of trees-as-pieces is that you chop one and the tree comes apart a piece at a time.
   *
   * So a piece may declare itself choppable, and that is what separates a tree from a door: the
   * door has no `chop` and refuses the swing exactly as before. Same shape as `BlockDef` on purpose
   * — skill gates the family, `minTier` refuses rather than slows, hardness sets the time — so a
   * blade cuts a trunk under the identical rules that make a blade cut a log today.
   */
  /**
   * ── ★ WHICH MATERIALS THIS PIECE MAY BE RE-MADE IN (2026-08-27, the vocabulary pass) ─────────
   * Every hand-written piece below pins ONE material in its cost — a doorway is goldwood, a stair
   * is cut stone, a fence is goldwood. That is the hand-kept-mirror shape from PATTERNS wearing a
   * different hat: it is not that the values disagree, it is that **the catalogue cannot express a
   * stone doorway at all**, so a stone hold dresses itself in wooden parapets and the palette
   * clashes at every gate. Minecraft's whole detailing vocabulary is one shape in many materials.
   *
   * ★ THE COUNT IS NOT DECLARED HERE, IT IS READ OFF `cost[0].count`. A second `units` field would
   * be a value that must agree with the base cost and has nothing checking it — the exact defect
   * this field exists to remove. Derive, never mirror.
   *
   * Absent = no variants. Some shapes genuinely only make sense in one material, and a derivation
   * with no stopping rule manufactures nonsense (see `BlockDef.noSlab` and the Grass Tuft Slab).
   */
  variants?: PieceFamily[]
  chop?: {
    skill: BlockSkill
    minTier: 0 | 1 | 2 | 3
    /** Seconds with a tier-1 tool, same scale as `BlockDef.hardness`. */
    hardness: number
    drops: { itemId: string; count: number }[]
  }
}

/**
 * ── ★ THE BUILDING MATERIALS A PIECE CAN WEAR ────────────────────────────────────────────────
 * Two families, because they behave differently in a build: wood frames and roofs, stone walls
 * and foundations. A piece names the families it accepts; the concrete variants derive from here.
 *
 * ⚠ EVERY `itemId` BELOW IS ALREADY DROPPED OR MILLED BY THE EXISTING ECONOMY — verified against
 * the registry's drop table, not assumed. The `stair` piece's own comment records what happens
 * otherwise: it shipped costing `block_stone`, which nothing yields, i.e. an uncraftable piece
 * that looked perfectly fine in the catalogue. `pieces.test.ts` asserts this over ALL_PIECES so a
 * variant cannot dodge the guard the base pieces pass.
 *
 * ⚠ THERE ARE THREE BUILDING WOODS, NOT FOUR, AND THAT IS CANON NOT AN OMISSION. Starwillow is a
 * ruled TOOL wood — `world/resources.ts` drops `starwillow_branch` + `starwillow_sap` and there
 * has never been a `starwillow_plank`. Adding one to "complete the set" would contradict canon.
 */
export type PieceFamily = 'wood' | 'stone'

export interface PieceMaterial {
  /** Suffix on the derived id — `stair` + `stonebrick` -> `stair_stonebrick`. */
  key: string
  /** Display prefix — 'Stone Brick' -> 'Stone Brick Stair'. */
  name: string
  /** What one unit of this piece is paid in. Must be obtainable; the test enforces it. */
  itemId: string
  family: PieceFamily
}

export const PIECE_MATERIALS: PieceMaterial[] = [
  { key: 'goldwood',   name: 'Goldwood',    itemId: 'goldwood_plank',   family: 'wood' },
  { key: 'shimmeroak', name: 'Shimmeroak',  itemId: 'shimmeroak_plank', family: 'wood' },
  { key: 'dawnwood',   name: 'Dawnwood',    itemId: 'dawnwood_plank',   family: 'wood' },
  { key: 'cutstone',   name: 'Cut Stone',   itemId: 'cut_stone',        family: 'stone' },
  { key: 'stonebrick', name: 'Stone Brick', itemId: 'stone_brick',      family: 'stone' },
  { key: 'palebrick',  name: 'Pale Brick',  itemId: 'pale_brick',       family: 'stone' },
  { key: 'sandstone',  name: 'Sandstone',   itemId: 'sandstone',        family: 'stone' },
]

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
    passable: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }],
    variants: ['wood', 'stone'] },

  { id: 'window', name: 'Window', w: 1, h: 2, d: 1,
    cost: [{ itemId: 'goldwood_plank', count: 4 }], variants: ['wood', 'stone'] },

  { id: 'roof_slope', name: 'Roof Slope', w: 1, h: 1, d: 1,
    cost: [{ itemId: 'shimmeroak_plank', count: 3 }], variants: ['wood', 'stone'] },

  { id: 'roof_cap', name: 'Roof Cap', w: 1, h: 1, d: 1,
    cost: [{ itemId: 'shimmeroak_plank', count: 4 }], variants: ['wood', 'stone'] },

  // Stairs are walkable by design — you stand ON them, so the occupied cell must not block you.
  // ⚠ RE-PRICED 2026-08-13 with the building ruling: `block_stone` is no longer obtainable — raw
  // stone stopped being placeable and now drops rubble — so this cost was pointing at an item
  // nothing yields, i.e. an uncraftable piece. Cut stone is the same idea one refine further along.
  { id: 'stair', name: 'Stair', w: 1, h: 1, d: 1,
    cost: [{ itemId: 'cut_stone', count: 3 }],
    passable: [{ x: 0, y: 0, z: 0 }], variants: ['wood', 'stone'] },

  { id: 'beam', name: 'Beam', w: 1, h: 1, d: 1,
    cost: [{ itemId: 'goldwood_plank', count: 2 }], variants: ['wood', 'stone'] },

  // Seventh, added 2026-08-08 with the pieces pass (v1's "six, deliberately" earned its keep —
  // the loop is proven, the catalogue may grow). A fence occupies its full cell ON PURPOSE: its
  // job is to stop things; the thin look is the model's business. Cheap because a yard takes
  // dozens. Also the holds' parapet — the first GENERATED piece.
  { id: 'fence', name: 'Fence', w: 1, h: 1, d: 1,
    cost: [{ itemId: 'goldwood_plank', count: 1 }], variants: ['wood', 'stone'] },

  // Eighth, 2026-08-08 (same pass as the probe's CELL_HALF — the piece and its physics shipped
  // together). Stand at half height, walk up half-rises without a vault: floors that step, low
  // tables, roof edges. The first fractional-collision piece.
  { id: 'half_slab', name: 'Half Slab', w: 1, h: 1, d: 1,
    cost: [{ itemId: 'goldwood_plank', count: 1 }], halfHeight: true, variants: ['wood', 'stone'] },

  // ── ★ NINE THROUGH TWELVE: THE SUB-CUBE DETAIL (2026-08-27) ─────────────────────────────────
  // The catalogue could build a shape and could not DETAIL one. Every building source says the
  // same thing about what separates a block shed from a building, and it is not more block types:
  // it is geometry thinner than a cube. Builders name trapdoors specifically, and specifically say
  // they beat slabs for detail *because they are thinner* — which is a statement about the SHAPE
  // vocabulary, not the material one, and no amount of new stone would have supplied it.
  //
  // Four, not forty. §9 of STRUCTURE-LAYER reserved this call for Alex and its recommendation was
  // six-and-stop-there until the loop proved out; he reopened it on 08-27 with the loop proven.
  // Each of these earns a place by answering a technique the research names, and nothing here is
  // a shape we merely thought would be nice.

  // ★ THE SHUTTER IS THE TRAPDOOR — the single most-cited detail element. Thin, and it reads as
  // depth against a flat wall precisely because it does not fill its cell. Full-cell occupancy
  // would make a decorative panel an invisible wall, so it is PASSABLE: you can stand where a
  // shutter is, exactly as you can walk under a roof overhang.
  { id: 'shutter', name: 'Shutter', w: 1, h: 1, d: 1,
    cost: [{ itemId: 'goldwood_plank', count: 2 }],
    passable: [{ x: 0, y: 0, z: 0 }], variants: ['wood', 'stone'] },

  // ★ THE ARCH — the burrow's whole reason for existing in this list. Canon has Moglin burrows
  // UNDERGROUND, dug into a bank (`dens.ts` already calls a den "the mouth dug into a bank"), and
  // every hobbit-hole build guide says the same thing: the entrance is ROUNDED, and rounding is
  // what blends a dug hole into a hillside. A square hole in a bank reads as a mineshaft.
  // Three wide so it has springings to stand on; the opening is the middle column.
  { id: 'arch', name: 'Arch', w: 3, h: 3, d: 1,
    cost: [{ itemId: 'cut_stone', count: 5 }],
    passable: [{ x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }], variants: ['wood', 'stone'] },

  // ★ THE BRACKET IS THE OUTCROPPED CORNER, which is the other half of "break the wall plane".
  // Recessing is free (leave a cell out); PROTRUDING was impossible, because a block that sticks
  // out of a wall is a block, and a wall of blocks with blocks stuck on it reads as lumpy rather
  // than as a pilaster. A bracket is smaller than its cell and sits proud of the face.
  { id: 'bracket', name: 'Bracket', w: 1, h: 1, d: 1,
    cost: [{ itemId: 'cut_stone', count: 1 }],
    passable: [{ x: 0, y: 0, z: 0 }], variants: ['wood', 'stone'] },

  // ★ THE HOOK carries the lantern OFF the wall, which is the lighting half of the same argument —
  // "text never sits raw on a scene" has a physical cousin, and it is that a light source flat
  // against masonry throws no shadow and reads as a glowing tile.
  //
  // ⚠ IT IS A HOOK AND NOT A CHAIN, AND THAT IS A MATERIALS FACT RATHER THAN A PREFERENCE. A chain
  // is metal and this world has no metal item — the economy drops stone, wood, crystal and plant.
  // Naming a piece for a material the player cannot obtain is the uncraftable-piece bug with extra
  // steps, and inventing an ore to justify a decoration is the tail wagging the dog.
  { id: 'hook', name: 'Hook', w: 1, h: 1, d: 1,
    cost: [{ itemId: 'goldwood_plank', count: 1 }],
    passable: [{ x: 0, y: 0, z: 0 }], variants: ['wood', 'stone'] },
]

/**
 * ── ★ THE DERIVED VARIANTS — one shape, every material it accepts ────────────────────────────
 *
 * ★ THE BASE PIECE IS ITSELF ONE OF THE VARIANTS AND IS NOT DUPLICATED. `stair` already costs
 * `cut_stone`, so the cut-stone stair IS `stair` and no `stair_cutstone` is minted beside it.
 * Filtering on the cost item rather than on a hand-kept "skip this one" list means the day a base
 * piece is re-priced into a different material, the derivation follows it instead of shipping two
 * ids for the same object.
 *
 * ★ AND THE COUNT COMES OFF THE BASE COST, so a variant can never disagree with its own base
 * about price. There is no second number to keep in sync because there is no second number.
 *
 * ⚠ `PIECES` DELIBERATELY STILL MEANS THE EIGHT HAND-WRITTEN SHAPES. `voxel3d/VoxelWorld.tsx`
 * (the build menu) and `voxel3d/piece-mesh.ts` (the renderer) both read it, and both live in
 * another window's lane. Adding a name rather than widening an existing one means nothing over
 * there changes meaning until its owner opts in — and `pieces.test.ts`'s `PIECES.length === 8`
 * stays a true, load-bearing assert instead of becoming a number someone bumps on every addition.
 */
/**
 * ★ ONE DERIVATION, READ TWICE. An earlier draft built the variant LIST and the variant LOOKUP in
 * two separate loops that each re-stated the "the base already wears this material, do not
 * duplicate it" rule. They agreed — and that is exactly the hand-kept-mirror shape PATTERNS warns
 * about: two copies of one rule with nothing checking they still match. Mutation-testing found it:
 * removing the rule from one copy produced ids the other could not resolve, and it surfaced as
 * "8 orphaned pieces", a symptom three steps from the cause. With one derivation the same mutation
 * names the eight duplicate ids directly.
 *
 * So the rule lives once, here, and both the array and the map are projections of this list.
 */
const VARIANTS: { def: PieceDef; base: PieceDef; material: PieceMaterial }[] = PIECES.flatMap(base =>
  !base.variants ? [] : PIECE_MATERIALS
    .filter(m => base.variants!.includes(m.family))
    .map(m => {
      // The base already wears this material — `stair` IS the cut-stone stair. Same object, base id.
      const isBase = m.itemId === base.cost[0]?.itemId
      const def: PieceDef = isBase ? base : {
        ...base,
        id: `${base.id}_${m.key}`,
        name: `${m.name} ${base.name}`,
        cost: [{ itemId: m.itemId, count: base.cost[0].count }],
      }
      return { def, base, material: m }
    }))

/** Every piece that exists at runtime — the eight hand-written shapes plus their material variants. */
export const ALL_PIECES: PieceDef[] = [...PIECES, ...VARIANTS.filter(v => v.def !== v.base).map(v => v.def)]

/**
 * A variant's base shape and the material it wears.
 *
 * ⚠ BUILT FROM THE TABLE, NEVER BY SPLITTING THE ID ON `_`. `half_slab` and `roof_slope` already
 * contain underscores, so string surgery would read `half_slab` as the `half` piece in a `slab`
 * material and confidently return nonsense. PATTERNS calls this out by name: a hand-written
 * textual reader is a standing claim about a file it does not own, and it fails silently.
 */
const VARIANT_OF = new Map(VARIANTS.map(v => [v.def.id, { base: v.base, material: v.material }]))

/** The hand-written shape a piece renders as — `stair_stonebrick` -> `stair`. Identity for a base. */
export const basePieceId = (id: string): string => VARIANT_OF.get(id)?.base.id ?? id
/** Which material a piece is built from, if it is part of the variant system. */
export const pieceMaterial = (id: string): PieceMaterial | undefined => VARIANT_OF.get(id)?.material

const BY_ID = new Map(ALL_PIECES.map(p => [p.id, p]))
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
