// A tree is ONE object — felling it is a single act that pays out, not a hundred block breaks.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// ── ★ THE RULING (Alex, 2026-08-13) ─────────────────────────────────────────────────────────────
// *"lets make the trees one object that drops rng loot when felled logs included, but since the
// logs are not a placeable object there only use is to refine them for building materials."*
//
// Three things fall out of that and they are the whole design:
//   1. felling is ONE act with ONE payout, so the tree needs an identity and a felled flag, not a
//      canopy of per-voxel save overrides;
//   2. the payout is LOGS in bulk plus rng on top;
//   3. a log's only job is to be refined, which decides what the rng may and may not be (below).
//
// ── ★ WHY THE VOXEL TREE WAS BUYING NOTHING ─────────────────────────────────────────────────────
// Checked before agreeing rather than after: in `registry.ts` every log and every leaf is
// `placeable: false`, and leaves have an EMPTY drop table. So chopping a tree cell by cell earned a
// log you can get in one act anyway, plus a leaf you cannot place, cannot keep and cannot use —
// against the cost of leaf decay, per-voxel overrides in every save, the mesher's leaf pass, and a
// canopy that collides. The voxel tree was paying rent on a room nobody lived in.
//
// ── ★ AND THE PART THAT IS EASY TO GET WRONG: THE RNG MUST NOT COMPETE WITH THE REFINE STEP ─────
// Canon's node table (`world/resources.ts`, from shimmer-skilling.md) pays bark and sap as chance
// drops. That table was written for the 2D game, where a node dropped FINISHED goods and there was
// no refining. There is now: `recipes.ts` turns one log into 4 planks OR 2 bark/sap, and Alex just
// ruled that refining is the log's entire purpose. If felling also rained bark, the refine recipe
// for bark would be the slow way to get a thing the tree hands you — that is a designed step made
// pointless by a drop table nobody re-read.
//
// So the split is: **felling pays the RAW material and the things refining cannot make; refining
// pays the WORKED material.** Saplings are the headline rng because a sapling has no recipe and no
// other source — it is the only way the forestry loop closes back on itself. The canon secondaries
// are KEPT at their canon chances, but as a bonus that is strictly worse than refining for the same
// item (0.3 of one bark, against 2 bark guaranteed per log), so the ruled numbers survive and the
// refine step stays the reliable route.

import {
  SPECIES, trunkVoxels, trunkCells, treeStartsAt, treeScanRadius, DEFAULT_TREES,
  type TreeConfig, type TreeSpecies, type TreeStart,
} from './trees'
import { blockDef } from './registry'

/**
 * Forestry XP for felling one tree.
 *
 * ★★ THE SAME CONTINUITY TRAP THE LOG COUNT HAD, and it very nearly shipped. Canon's node table
 * pays a flat 20 / 50 / 120 / 300 per harvest — numbers written for the 2D game, where one harvest
 * WAS one node. Our voxel forestry has been paying per block broken, so a goldwood was worth
 * ~8 x 17 = 136 XP and a dawnwood ~15 x 41 = 615. Adopting canon's flat numbers would have cut
 * forestry progression by roughly 85% in a commit about drop tables, and the only symptom would
 * have been that levelling "feels slow now".
 *
 * So felling pays what chopping paid: the per-block award, once per trunk voxel. The formula is the
 * host's own (`max(4, hardness * 12)`), read off the SAME registry row the block used, so the two
 * cannot drift. Canon's per-node ladder is left alone in `world/resources.ts` — it describes the 2D
 * node game and is right about that game.
 */
export function fellXP(start: TreeStart): number {
  const hardness = blockDef(start.species.log)?.hardness ?? 1
  return trunkVoxels(start) * Math.max(4, Math.round(hardness * 12))
}

/** A stack of one item. Matches what the inventory already takes. */
export interface Drop { itemId: string; count: number }

export interface TreeNodeDef {
  /** The one secondary this species carries, at its canon chance. Bonus, never the refine route. */
  secondary: { itemId: string; chance: number }
  /** Chance of a sapling of this species. The only source of one — see the header. */
  saplingChance: number
}

/**
 * Per species. Item ids verified against `recipes.ts` rather than assumed — `crystallized_sap` is
 * the one that only appears in canon and the sprite sheet, never in a recipe, so dawnwood's
 * secondary is the only drop here with no refine route competing with it at all.
 */
export const TREE_NODES: Record<string, TreeNodeDef> = {
  goldwood:   { secondary: { itemId: 'goldwood_bark',    chance: 0.30 }, saplingChance: 0.35 },
  shimmeroak: { secondary: { itemId: 'amber_sap',        chance: 0.40 }, saplingChance: 0.28 },
  starwillow: { secondary: { itemId: 'starwillow_sap',   chance: 0.35 }, saplingChance: 0.20 },
  dawnwood:   { secondary: { itemId: 'crystallized_sap', chance: 0.25 }, saplingChance: 0.12 },
}

/** The sapling item for a species. One per species, so cultivating a dawnwood is its own reward. */
export const saplingItem = (speciesId: string): string => `${speciesId}_sapling`

/** The raw log item for a species — the bulk payout, and the only input the refine chain takes. */
export const logItem = (speciesId: string): string => `${speciesId}_log`

/**
 * A tree's identity, stable across sessions and independent of anything stored.
 *
 * ★ THE ORIGIN IS THE ID, and that works for exactly the reason `in_square` works: a trunk's origin
 * is confined to the column that rolled it, so no two trees in the world can share one. It needs no
 * counter, no registry and no allocation — a felled set is just a set of these strings, which is
 * what replaces a canopy's worth of per-voxel overrides in every save.
 *
 * ⚠ POSITION ONLY, NOT THE SEED. A tree's seed is derived from its column and index, so it changes
 * if the species tuning ever changes — and an id that moves would resurrect every felled tree in
 * the world on the next tuning pass. Position is the thing about a tree that cannot change.
 */
export const treeId = (start: TreeStart): string => `${start.x},${start.z}`

/** Felled trees, by id. Persisted beside the player save, exactly like the sapling clock. */
export type FelledSet = Record<string, true>

export const isStanding = (felled: FelledSet, start: TreeStart): boolean => !felled[treeId(start)]

/** Can this keeper cut it at all? The tier gate is the registry's, restated nowhere. */
export interface FellGate { tier: number; skill: string | null }

/**
 * What felling this tree pays out.
 *
 * `roll` is injected so the oracle can pin the outcome; the host passes Math.random.
 *
 * ⚠ ROLLS HAPPEN IN A FIXED ORDER AND UNCONDITIONALLY, the same discipline the generator's seam
 * rule imposes. A payout whose second roll depends on whether the first one hit is a payout that
 * cannot be reproduced from a log line when someone reports a bad drop.
 */
export function fellTree(start: TreeStart, roll: () => number): { drops: Drop[]; xp: number } {
  const sp = start.species
  const def = TREE_NODES[sp.id]
  const r1 = roll(), r2 = roll()
  const drops: Drop[] = [{ itemId: logItem(sp.id), count: trunkVoxels(start) }]
  if (def) {
    // Rolled first, kept second — order is fixed regardless of which hits.
    if (r1 < def.secondary.chance) drops.push({ itemId: def.secondary.itemId, count: 1 })
    if (r2 < def.saplingChance) drops.push({ itemId: saplingItem(sp.id), count: 1 })
  }
  return { drops, xp: fellXP(start) }
}

/** Every species has a node definition, or felling it silently pays nothing but wood. */
export const speciesMissingNode = (): TreeSpecies[] => SPECIES.filter(s => !TREE_NODES[s.id])

/** A tree found in the world: the roll that made it, the ground it stands on, and its log cells. */
export interface FoundTree { start: TreeStart; groundY: number; cells: { x: number; y: number; z: number }[] }

/**
 * Which tree owns the log cell at (x, y, z)?
 *
 * ★ THE HOST MUST NOT ANSWER THIS BY HAND. Chopping happens on a voxel, but the fell verb acts on a
 * TREE, and the step between the two is the whole node model. Doing it in the renderer would mean a
 * second walk of the trunk living next to the generator's — the exact shape of drift this file spent
 * the morning deleting. So it lives here, pure, and reads the same `trunkCells` the generator wrote.
 *
 * ⚠ SEARCHED BY THE PLANTER'S OWN SCAN RADIUS, not by a guess. A trunk's origin is confined to its
 * own column (`in_square`), but a forking limb leans OUT of it — so the cell under the player's
 * reticle can belong to a tree rolled by a neighbouring column. Anything narrower silently fails to
 * find starwillow's limbs, and only starwillow's, which is the kind of bug that reads as "sometimes
 * chopping does nothing".
 *
 * `groundAt` returns null for unloaded columns; those simply cannot own the cell, since a tree the
 * player is standing next to is loaded by definition.
 */
export function treeOwning(
  seed: number, size: number, x: number, y: number, z: number,
  groundAt: (x: number, z: number) => number | null,
  cfg: TreeConfig = DEFAULT_TREES,
): FoundTree | null {
  const rad = treeScanRadius(size, cfg)
  const c0x = Math.floor(x / size), c0z = Math.floor(z / size)
  for (let cz = c0z - rad; cz <= c0z + rad; cz++) {
    for (let cx = c0x - rad; cx <= c0x + rad; cx++) {
      for (const st of treeStartsAt(seed, cx, cz, size, cfg)) {
        const g = groundAt(st.x, st.z)
        if (g === null) continue
        const cells = trunkCells(st, g)
        if (cells.some(c => c.x === x && c.y === y && c.z === z)) return { start: st, groundY: g, cells }
      }
    }
  }
  return null
}
