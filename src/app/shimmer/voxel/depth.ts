// The depth rule — what a column is MADE of, given its surface altitude.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// This is the surviving intent of Minecraft's surface rules with the part we cannot use removed.
// Theirs is a per-column CASCADE that walks downward through blocks, and that shape exists only
// because it is walking a real block column at generation time. We keep the *intent* — an ORDERED
// PREDICATE LIST deciding a voxel's material, first match wins — and drop the walk, because our
// height is already known analytically. `materialAt` is O(1) for any y: it never iterates a column,
// so a chunk builder can fill sections in any order, or fill only the one section it needs.
//
// ⚠ ORE IS NOT HERE, DELIBERATELY. This produces HOST ROCK only. Ores are features placed later
// (post-carve blobs, pre-carve pockets — WORLDGEN-RESEARCH steals #8–#11) and they overwrite what
// this returns. Mixing them would put ore placement on the wrong side of the carver ordering, which
// is the single decision that makes ore appear in cave walls or stay buried.

import { fbm2, value2 } from './noise'
import {
  columnHeight, riverCarve, waterSurfaceAt, RIVER_DEPTH,
  springsPoolAt, poolDepthAt, POOL_DEEP,
  type HeightConfig, DEFAULT_HEIGHT,
} from './height'
import { greySurfaceAt } from './biome'
import { roadAt } from './story-path'
import { holdIndexAt, holdVoxelAt, holdCourtyardAt } from './holds'
import { holdPadLevel } from './height'
import { AIR } from './section'

/**
 * Base materials. Palette indices — the skin (which tile art) is resolved by the registry, not here.
 *
 * ⚠ TBD-CANON: these are generic earth materials named in plain English on purpose. If the Ather's
 * deep rock, its soil, or its stone carry canon names, those belong to Magii and go over as part of
 * the one batched naming question. Do NOT invent Athernyx names for them here — a guess that ships
 * becomes accidental canon.
 */
// ── ★ THE MATERIAL ID MAP — one number space, four files ────────────────────────────────────────
// MAT 0-13 (here) · ORE 16-22 (ore.ts) · WOOD 32-39 (trees.ts) · STRUCTURE 48-49 (pieces.ts).
// PLANTS take 24-26, in the gap between ore and wood. ⚠ The first cut put them at 14-16 because
// MAT stops at 13 — and 16 is ORE.RAW_MANA, so a wildflower WAS a mana seam: it inherited ore
// hardness, dropped shards, and `isPlant` matched ore and logs all through the underground.
// Nothing warned, because these enums are separate `const` objects that never see each other.
// Check this map before adding any material anywhere.
/**
 * ── ★ HALF BLOCKS ARE A MATERIAL, NOT A SHAPE THE TERRAIN REMEMBERS (2026-08-11, Alex's ruling) ──
 * A slab you can mine and place has to BE a block. The first cut made terrain lips full voxels that
 * a per-column mask drew at half height, and the seam showed immediately in play: mining one gave a
 * whole block, and placing ANY block into that cell — stone included — inherited the ground's shape.
 * Half-ness rode the (x, z) column instead of the cell.
 *
 * So it is a bit on the material. Every consequence falls out instead of being arranged:
 *   · the save is a material diff, so a slab persists with no extra machinery;
 *   · `dropsFor` can hand back a slab item and placing it writes a slab back;
 *   · the mesher tests a BIT inline rather than calling a predicate per cell — cheaper than the
 *     strip-a-copy machinery it replaces (see greedy.ts on what a per-cell call costs there);
 *   · any material can be a slab, so this is the general building block, not a terrain special case.
 * Base ids must stay under 256. Uint16 sections leave plenty of room above the flag.
 */
export const HALF_BIT = 0x0100
/**
 * A slab sitting in the UPPER half of its cell. Only meaningful with HALF_BIT.
 *
 * ★ A TOP SLAB COLLIDES AS A FULL BLOCK, and that is a deliberate simplification worth keeping: the
 * open lower half of the cell is 0.5 tall and the player is ~1.8, so nothing can ever stand in it.
 * Its walkable surface is the cell top, exactly like a full block's. That means top slabs cost
 * locomotion.ts NOTHING — no new cell code, no change to the 58-assert feel contract — and the
 * difference lives entirely in what the mesher draws.
 */
export const TOP_BIT = 0x0200
/** The full-block material behind a possibly-half one. Cheap: one mask. */
export const baseOf = (m: number): number => m & 0xFF
/** A slab in the upper half of its cell. */
export const isTopSlab = (m: number): boolean => (m & TOP_BIT) !== 0
/** Is this cell a slab? One bit test — safe in a hot loop. */
export const isHalfMat = (m: number): boolean => (m & HALF_BIT) !== 0

export const PLANT_MIN = 24
export const PLANT_MAX = 26
/** Non-solid, non-opaque ground cover. Range test on purpose — this runs in the mesher's hot loop. */
export const isPlant = (m: number): boolean => m >= PLANT_MIN && m <= PLANT_MAX
/** Any state of the pot. */
export const isPot = (m: number): boolean => m === 27 || m === 28 || m === 29

export const MAT = {
  AIR: AIR,
  BEDROCK: 1,
  DEEP_STONE: 2,
  STONE: 3,
  SUBSOIL: 4,
  TOPSOIL: 5,
  SAND: 6,
  WATER: 7,
  /** Drained ground's surface — TOPSOIL with the mana gone. See biome.ts's richness field. */
  GREY_SOIL: 8,
  /**
   * The first emitter — a shard of raw mana in a plank frame. Exists so `light.ts`'s block
   * channel has a source and "tended light holds grey off" is a thing a keeper can DO, not just
   * a line the spawn code honours. Never generated; only ever placed. ⚠ TBD-CANON on the name,
   * same as everything else in this enum.
   */
  MANA_LANTERN: 9,
  /**
   * The crafting station, placed. The ITEM already existed (`voxel/recipes.ts` hand-crafts it;
   * canon has Greg gift one in the starter bag) — this id is what lets it stand in the world.
   * Never generated; only ever placed. ⚠ TBD-CANON on the name, same as everything else here.
   */
  CRAFT_TABLE: 10,
  /**
   * The story road's surface — packed earth worn by the quest spine (story-path.ts). Generated,
   * never placed; digging it yields plain dirt, because a road is wear, not a thing you pocket.
   */
  PATH: 11,
  /**
   * Milled goldwood as a BLOCK. Generated in the road's bridges, and placeable by players — the
   * `goldwood_plank` item finally has a block form, so a crafter's planks can floor a house as
   * well as pay for pieces. One item per block, both directions.
   */
  PLANKS: 12,
  /**
   * The hot springs' mineral shell (2026-08-08, the Springs rework) — the pale crust a spring
   * deposits around itself. Beds, aprons and the shallow walls of the terrace pools wear it
   * (height.ts's springsPoolAt says where). ⚠ TBD-CANON on the name, like everything else here.
   */
  SPRING_CRUST: 13,

  // ── ★ PLANTS ARE BLOCKS (2026-08-11, Alex: "everything should be collectable") ──────────────
  // Ground cover used to be a pure function the RENDERER drew and nothing else could see — so it
  // could not be targeted, broken, dropped or saved. Making it real voxels is what makes "you can
  // collect it" true by construction rather than by a second system that has to be kept in sync:
  // `raycast` already stops at any non-AIR material, `tickBreak`/`dropsFor` already read the
  // registry, and `recordEdit` already diffs against what the generator would have put here — so
  // a picked flower persists through the same path a mined block does, with no new machinery.
  // ⚠ KEEP THESE THREE CONTIGUOUS. `isPlant` is a range test, not a Set lookup, because it is
  // called from the mesher's inner loop — see greedy.ts on what a per-cell call costs there.
  TUFT: 24,
  TALL_GRASS: 25,
  FLOWER: 26,

  // ── ★ THE POT — where a Mana Seed becomes a spirit (2026-08-11) ─────────────────────────────
  // Three materials rather than one block plus a growth record, because THE MATERIAL IS THE STATE
  // and the save is a material diff: a planted pot survives a reload, an evict and a walk to the
  // Outfields with no new persistence layer. The only thing a material cannot hold is WHEN it was
  // planted, so that — and only that — lives beside the player save.
  POT: 27,
  POT_SEEDED: 28,
  POT_BLOOM: 29,
} as const

export interface DepthConfig {
  /** Basins below this fill with water. Kept BELOW the datum so most of the world is dry land. */
  seaLevel: number
  /** Voxels of soil under the surface block, before stone. Varies by noise. */
  soilDepth: number
  soilVariance: number
  /** Below this altitude, stone becomes deep stone — the tier-3/4 host rock. */
  deepStoneLevel: number
  /** Bedrock floor: solid at y=0, ragged up to this. */
  bedrockTop: number
  /** Surfaces steeper than this (voxels of rise per voxel across) show bare rock, not soil. */
  cliffSlope: number
  /** Sand reaches this far above sea level — the beach band. */
  beachHeight: number
}

export const DEFAULT_DEPTH: DepthConfig = {
  // ★ Sea level sits 20 below the datum, not on it. On it, HALF the world would be underwater by
  // definition (the datum is the median ground height). 140/160 → 100/120 with the vertical
  // rebalance (Alex ruled the split 2026-08-08) — same 20-gap, so the wet share is unchanged.
  seaLevel: 100,
  soilDepth: 4,
  soilVariance: 2,
  deepStoneLevel: 56,   // keeps its 64-under-datum offset through the rebalance
  bedrockTop: 4,
  cliffSlope: 2.2,
  beachHeight: 2,
}

/**
 * Local steepness at a column, in voxels of rise per voxel across.
 *
 * ★ This reads neighbouring COLUMNS, which is safe, and the distinction matters: it evaluates the
 * pure `columnHeight` function at nearby coordinates. It does NOT read a neighbouring chunk's
 * stored state. That is exactly the line research steal #2 draws — a stage may never synchronously
 * generate a missing neighbour, but calling a pure O(1) function at any coordinate is free and
 * order-independent.
 */
export function slopeAt(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT): number {
  const h = columnHeight(x, z, seed, cfg)
  const dx = Math.abs(columnHeight(x + 1, z, seed, cfg) - h)
  const dz = Math.abs(columnHeight(x, z + 1, seed, cfg) - h)
  const bx = Math.abs(h - columnHeight(x - 1, z, seed, cfg))
  const bz = Math.abs(h - columnHeight(x, z - 1, seed, cfg))
  return Math.max(dx, dz, bx, bz)
}

/**
 * The ordered predicate list. First match wins; the order IS the rule, so it is written to be read
 * top to bottom rather than optimised into a lookup.
 *
 * `h` (the column's surface altitude) is passed in rather than recomputed, because a chunk builder
 * already has it for the whole column and recomputing it per voxel would be 256 redundant noise
 * evaluations per column — the difference between a fast generator and a slow one.
 */
export function materialAt(
  x: number, y: number, z: number, seed: number, h: number,
  cfg: DepthConfig = DEFAULT_DEPTH, hcfg: HeightConfig = DEFAULT_HEIGHT,
): number {
  // 1. An unbreakable floor. Ragged rather than flat, so the bottom of the world reads as rock
  //    rather than as a rendering plane — Minecraft's own trick, and it costs one noise sample.
  if (y <= 0) return MAT.BEDROCK
  if (y < cfg.bedrockTop && value2(x * 0.7, z * 0.7, seed ^ 0xbed0) > y / cfg.bedrockTop) return MAT.BEDROCK

  // 2. Above the surface: water if we are in a basin — or in a river channel, filled to the WATER
  //    TABLE (height.ts: the land generates around the water, so the bed hangs ≤RIVER_DEPTH under
  //    the table and the fill is flat and contained by construction). Guarded: only the voxels
  //    just above a surface run the cheap band read; sky stays on the fast path.
  if (y > h) {
    // ── the hold blockouts (2026-08-08) — walls, keep, gate lanterns, above the flattened pad.
    // Gated on a cheap bbox; the pad level is memoised per seed in height.ts. Everything the
    // holds raise is ordinary voxels: mineable, edit-diffed, lit by the same light field.
    {
      const hi = holdIndexAt(x, z)
      if (hi >= 0) {
        const m = holdVoxelAt(x, y, z, hi, holdPadLevel(hi, seed, hcfg), MAT.STONE, MAT.MANA_LANTERN)
        if (m !== 0) return m
      }
    }
    // ── the story road BRIDGES water (2026-08-08, Alex: "the fords are fine… lets do the
    // bridges anyway") ── Wherever the road corridor runs over a submerged bed, a plank deck
    // lies at table+1 — which is EXACTLY where the approach band parks the banks, so deck and
    // bank meet flush by construction, no ramp logic. Stone piers drop to the bed on a sparse
    // lattice; plank rails stand on the deck's sides only (an end cell's along-road neighbour
    // is road, so the edge test can never wall the roadway). Gated behind the same cheap band
    // read as the water fill — sky never pays for bridges.
    if (y - h <= RIVER_DEPTH + 4 && roadAt(x, z, seed)) {
      const carve = riverCarve(x, z, seed, hcfg)
      if (carve >= 1) {
        const table = Math.floor(waterSurfaceAt(x, z, seed, hcfg))
        if (h <= table) {
          if (y === table + 1) return MAT.PLANKS
          if (y <= table && ((x % 4) + 4) % 4 === 0 && ((z % 4) + 4) % 4 === 0) return MAT.STONE
          if (y === table + 2 &&
              (!roadAt(x + 1, z, seed) || !roadAt(x - 1, z, seed) ||
               !roadAt(x, z + 1, seed) || !roadAt(x, z - 1, seed))) return MAT.PLANKS
        }
      }
    }
    if (y <= cfg.seaLevel) return MAT.WATER
    if (y - h <= RIVER_DEPTH + 1) {
      const carve = riverCarve(x, z, seed, hcfg)
      if (carve >= 1 && y <= waterSurfaceAt(x, z, seed, hcfg)) return MAT.WATER
    }
    // Hot-spring pools fill to one below their own rim (height.ts's pools block): h is the carved
    // bed, h + depth the rim, so the fill is y ≤ h + depth − 1. Gated to the two voxels above a
    // surface, exactly like the river fill — sky never pays for pools.
    if (y - h <= POOL_DEEP - 1) {
      const pd = poolDepthAt(x, z, seed, hcfg)
      if (pd >= 1 && y <= h + pd - 1) return MAT.WATER
    }
    return MAT.AIR
  }

  const depth = h - y

  // 3. The surface voxel itself — the only place where slope and water change the answer.
  if (depth === 0) {
    if (h <= cfg.seaLevel) return MAT.SAND                              // lake / sea bed
    if (h <= cfg.seaLevel + cfg.beachHeight) return MAT.SAND            // beach band
    if (riverCarve(x, z, seed, hcfg) >= 1) return MAT.SAND              // river bed and its shoulders
    if (holdCourtyardAt(x, z)) return MAT.PATH                          // hold courtyards are worn bare
    if (roadAt(x, z, seed)) return MAT.PATH                             // the story road wears through
    // Spring crust BEFORE the cliff rule: a pool's rim column sees a 2–3 voxel drop to its own bed,
    // which the slope test would misread as a cliff face — the shell must win over bare stone.
    if (springsPoolAt(x, z, seed, hcfg) >= 1) return MAT.SPRING_CRUST   // pool beds + mineral aprons
    if (slopeAt(x, z, seed, hcfg) >= cfg.cliffSlope) return MAT.STONE   // cliff faces show rock
    if (greySurfaceAt(x, z, seed)) return MAT.GREY_SOIL                 // drained ground wears grey
    return MAT.TOPSOIL
  }

  // 4. Soil under the surface, thinning on slopes so a cliff does not wear a soil stripe.
  //    The variance is noise, not randomness — same coordinate, same depth, forever.
  const soil = cfg.soilDepth + Math.round((fbm2(x * 0.08, z * 0.08, seed ^ 0x501, 2) - 0.5) * 2 * cfg.soilVariance)
  if (depth <= Math.max(1, soil)) {
    if (h <= cfg.seaLevel + cfg.beachHeight) return MAT.SAND
    // The crust has THICKNESS: the shell under a pool bed and apron runs a few voxels deep, so the
    // short interior walls of a basin read as deposit, not as a soil stripe with a stone cliff.
    if (depth <= 3 && springsPoolAt(x, z, seed, hcfg) >= 1) return MAT.SPRING_CRUST
    return slopeAt(x, z, seed, hcfg) >= cfg.cliffSlope ? MAT.STONE : MAT.SUBSOIL
  }

  // 5. Host rock. The deep/shallow split is what steals #11's `targets` rule-test keys on later:
  //    ONE ore feature places its stone-host or deep-host variant depending on what it replaced.
  return y < cfg.deepStoneLevel ? MAT.DEEP_STONE : MAT.STONE
}

/**
 * Fill one column segment. This is the shape a chunk builder actually wants: surface altitude
 * computed once, then a straight run down the column with no per-voxel height recomputation.
 * Writes into a caller-owned array — allocation-free, per port rule 3.
 */
export function fillColumn(
  out: Uint16Array, offset: number, stride: number,
  x: number, z: number, yFrom: number, yTo: number, seed: number,
  cfg: DepthConfig = DEFAULT_DEPTH, hcfg: HeightConfig = DEFAULT_HEIGHT,
): void {
  const h = columnHeight(x, z, seed, hcfg)
  for (let y = yFrom, i = offset; y < yTo; y++, i += stride) {
    out[i] = materialAt(x, y, z, seed, h, cfg, hcfg)
  }
}
