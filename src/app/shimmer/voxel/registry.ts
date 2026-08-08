// The block registry — what a material IS, mechanically.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// ★ SHAPED AS DATA, NOT CODE (VOXEL-WORLD-MODEL § 4). Every field below is a plain value with no
// behaviour attached, so this table lifts into `data/blocks/*.json` unchanged the day the loader
// exists — and Rust reads the identical file. Keeping it as a TS literal for now costs nothing and
// avoids a loader before there is anything to load. What must NOT happen is behaviour creeping in
// here: the moment a block carries a function, the registry stops being portable.
//
// ── ★ THE TOOL MODEL IS ALREADY CANON AND IS REUSED VERBATIM ─────────────────────────────────
// `engine/tools.ts` rules the gathering tools: **blades → forestry, spikes → prospecting,
// rinsticks → rinning**, three tiers each plus a basic Greg-given tool that never breaks. So
// "what do I mine rock with" already has an answer — a spike — and nothing needed inventing.
// This file names SKILLS, not tool ids, so the tool table stays the single source of truth.
//
// ⚠ CANON: every DROP id below already ships in `world/resources.ts`. The block-item ids
// (`block_stone` etc.) are build-side placeholders for "the block itself in your hand" and are
// marked TBD-CANON — if the Ather's stone and soil carry real names, those are Magii's.

import { MAT } from './depth'
import { ORE } from './ore'
import { WOOD } from './trees'
import { AIR } from './section'

/** Which gathering skill a block answers to. `null` = bare hands, no tool, no skill gate. */
export type BlockSkill = 'prospecting' | 'forestry' | 'farming' | null

export interface BlockDef {
  /** Palette index this describes. */
  material: number
  name: string
  /**
   * Time-to-break in seconds with a tier-1 tool. Relative values are what matter, not the units:
   * soil is a flick, deep stone is a commitment.
   */
  hardness: number
  skill: BlockSkill
  /** Minimum tool tier that can break it at all. 0 = hands work. */
  minTier: 0 | 1 | 2 | 3
  /**
   * ★ THE SHOVEL PROBLEM, AND WHY THIS IS NOT JUST `skill` (2026-08-07).
   *
   * `skill` is a GATE: `breakSeconds` refuses outright when the held tool's family does not match,
   * which is what makes "a spike will not cut a tree" true. Soil and sand have always been
   * `skill: null` so that bare hands work — and they must keep working, or a fresh keeper spawns
   * unable to dig dirt.
   *
   * So a shovel cannot be expressed by moving soil to `skill: 'farming'`; that would refuse hands
   * AND refuse every other tool. `fastSkill` is the other half: on an ungated block it names the
   * tool family that does the job *properly*. Hands still work, the right tool is faster and pays
   * XP. That is Minecraft's model exactly, and it is the only shape that adds a tool without
   * taking away a starting capability.
   *
   * Only meaningful when `skill === null`. On a gated block the gate already names the family.
   */
  fastSkill?: BlockSkill
  /** What lands in the inventory. Empty = breaks into nothing. */
  drops: { itemId: string; count: number }[]
  /** Can a player place this back down? */
  placeable: boolean
  /**
   * Block light emitted, 0–15 (`light.ts`'s block channel BFSes from these). Absent = 0. Data,
   * not behaviour — the Rust side reads the same number.
   */
  emit?: number
}

/**
 * ⚠ TBD-CANON on the block-item ids. These are "the block in your hand" and generic English on
 * purpose — no Athernyx name is invented here. Drop ids for ore are the RULED ones from
 * `resources.ts` and must not be renamed.
 */
export const BLOCKS: BlockDef[] = [
  { material: MAT.BEDROCK, name: 'Bedrock', hardness: Infinity, skill: null, minTier: 0, drops: [], placeable: false },
  { material: MAT.DEEP_STONE, name: 'Deep Stone', hardness: 2.4, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'block_deep_stone', count: 1 }], placeable: true },
  { material: MAT.STONE, name: 'Stone', hardness: 1.6, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'block_stone', count: 1 }], placeable: true },
  { material: MAT.SUBSOIL, name: 'Subsoil', hardness: 0.5, skill: null, minTier: 0, drops: [{ itemId: 'block_subsoil', count: 1 }], fastSkill: 'farming', placeable: true },
  { material: MAT.TOPSOIL, name: 'Topsoil', hardness: 0.55, skill: null, minTier: 0, drops: [{ itemId: 'block_topsoil', count: 1 }], fastSkill: 'farming', placeable: true },
  { material: MAT.SAND, name: 'Sand', hardness: 0.45, skill: null, minTier: 0, drops: [{ itemId: 'block_sand', count: 1 }], fastSkill: 'farming', placeable: true },
  // Drained ground digs like soil and drops SUBSOIL: the mana is gone, not the dirt — carrying a
  // "grey block" home to build with would make the greying a decoration, which it must never be.
  { material: MAT.GREY_SOIL, name: 'Greyed Soil', hardness: 0.55, skill: null, minTier: 0, drops: [{ itemId: 'block_subsoil', count: 1 }], fastSkill: 'farming', placeable: false },
  { material: MAT.WATER, name: 'Water', hardness: Infinity, skill: null, minTier: 0, drops: [], placeable: false },

  // ── The lantern — the first emitter ────────────────────────────────────────────────────────
  // emit 14, not 15: a placed light should never quite match full daylight, so noon stays the
  // brightest thing in the world. Breaks by hand into itself — lighting your ground is meant to
  // be cheap to do and free to rearrange. The canon line it serves ("tended light holds grey
  // off") lives in light.ts; this row only makes the tending possible.
  { material: MAT.MANA_LANTERN, name: 'Mana Lantern', hardness: 0.6, skill: null, minTier: 0, drops: [{ itemId: 'mana_lantern', count: 1 }], placeable: true, emit: 14 },

  // ── The crafting table — the first station ─────────────────────────────────────────────────
  // Breaks by hand into itself, same reasoning as the lantern: your bench is furniture, and
  // rearranging your home must be free. Placing it is what flips `Station` in voxel/recipes.ts
  // from a dormant field to a real gate — recipes marked `crafting_table` light up near one.
  { material: MAT.CRAFT_TABLE, name: 'Crafting Table', hardness: 0.8, skill: null, minTier: 0, drops: [{ itemId: 'crafting_table', count: 1 }], placeable: true },

  // The story road. Digs like soil and drops SUBSOIL for the same reason greyed soil does: the
  // road is a CONDITION of the ground, not a block you carry home and lay somewhere else.
  { material: MAT.PATH, name: 'Worn Path', hardness: 0.5, skill: null, minTier: 0, drops: [{ itemId: 'block_subsoil', count: 1 }], fastSkill: 'farming', placeable: false },

  // Planks as a block: bridges generate from it, players place it — the plank ITEM is the block
  // in hand, one per block both ways, so a bridge mined is a bridge's worth of planks pocketed.
  { material: MAT.PLANKS, name: 'Goldwood Planks', hardness: 0.7, skill: null, minTier: 0, drops: [{ itemId: 'goldwood_plank', count: 1 }], placeable: true },

  // ── the Prospecting ladder — hardness AND tier both climb, so depth gates twice over ────────
  { material: ORE.RAW_MANA, name: 'Raw Mana Seam', hardness: 2.2, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'raw_mana_shard', count: 1 }], placeable: false },
  { material: ORE.ELEMENT_VIOLET, name: 'Violet Crystal Seam', hardness: 3.0, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'violet_crystal', count: 1 }], placeable: false },
  { material: ORE.ELEMENT_STORM, name: 'Storm Crystal Seam', hardness: 3.0, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'storm_crystal', count: 1 }], placeable: false },
  { material: ORE.ELEMENT_EARTH, name: 'Earth Crystal Seam', hardness: 3.0, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'earth_crystal', count: 1 }], placeable: false },
  { material: ORE.ELEMENT_WATER, name: 'Water Crystal Seam', hardness: 3.0, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'water_crystal', count: 1 }], placeable: false },
  { material: ORE.PURE_CORE, name: 'Pure Core Seam', hardness: 4.5, skill: 'prospecting', minTier: 2, drops: [{ itemId: 'pure_mana_core', count: 1 }], placeable: false },
  { material: ORE.ATHER_CRYSTAL, name: 'Ather Crystal Seam', hardness: 6.5, skill: 'prospecting', minTier: 3, drops: [{ itemId: 'ather_crystal', count: 1 }], placeable: false },

  // ── Forestry — the four ruled woods ────────────────────────────────────────────────────────
  // ★ skill: 'forestry' means a SPIKE WILL NOT CUT A TREE and a BLADE will not break stone. The
  // tool families are canon (`engine/tools.ts`: blades→forestry, spikes→prospecting) and the
  // registry enforces the split rather than restating it. Hardness climbs with the same 1/4/7/10
  // ladder the old node minLevels used.
  //
  // ── ★ A LOG DROPS A LOG (2026-08-07) ────────────────────────────────────────────────────────
  // These rows used to drop finished `goldwood_plank` / `starwillow_branch`, inherited verbatim
  // from `world/resources.ts` where a *node* handed over milled timber because the tile world had
  // no tree to cut. Carried into a voxel world it meant chopping a trunk yielded lumber, and it
  // silently broke the game: the blades cost bark and sap, those were secondary NODE drops, no
  // block produced them, so all three forestry tiers were uncraftable — which left the basic Worn
  // Blade (tier 1) as the ceiling and made STARWILLOW (minTier 2) and DAWNWOOD (minTier 3) trees
  // permanently unharvestable. The generator was placing wood nobody could ever cut.
  // `recipes.ts` is the missing layer; `recipes.test.ts` asserts nothing is unreachable again.
  { material: WOOD.GOLDWOOD_LOG, name: 'Goldwood', hardness: 1.4, skill: 'forestry', minTier: 1, drops: [{ itemId: 'goldwood_log', count: 1 }], placeable: true },
  { material: WOOD.SHIMMEROAK_LOG, name: 'Shimmeroak', hardness: 1.9, skill: 'forestry', minTier: 1, drops: [{ itemId: 'shimmeroak_log', count: 1 }], placeable: true },
  { material: WOOD.STARWILLOW_LOG, name: 'Starwillow', hardness: 2.6, skill: 'forestry', minTier: 2, drops: [{ itemId: 'starwillow_log', count: 1 }], placeable: true },
  { material: WOOD.DAWNWOOD_LOG, name: 'Dawnwood', hardness: 3.4, skill: 'forestry', minTier: 3, drops: [{ itemId: 'dawnwood_log', count: 1 }], placeable: true },

  // Leaves come away by hand — soft, fast, and they drop nothing in v1. Sapling drops are a
  // regrowth mechanic and regrowth is not built, so promising one here would be a lie.
  { material: WOOD.GOLDWOOD_LEAVES, name: 'Goldwood Leaves', hardness: 0.25, skill: null, minTier: 0, drops: [], placeable: false },
  { material: WOOD.SHIMMEROAK_LEAVES, name: 'Shimmeroak Leaves', hardness: 0.25, skill: null, minTier: 0, drops: [], placeable: false },
  { material: WOOD.STARWILLOW_LEAVES, name: 'Starwillow Leaves', hardness: 0.25, skill: null, minTier: 0, drops: [], placeable: false },
  { material: WOOD.DAWNWOOD_LEAVES, name: 'Dawnwood Leaves', hardness: 0.25, skill: null, minTier: 0, drops: [], placeable: false },
]

const BY_MATERIAL = new Map<number, BlockDef>(BLOCKS.map(b => [b.material, b]))
/** Reverse map so a placed block-item becomes the right voxel. */
const BY_ITEM = new Map<string, number>(
  BLOCKS.filter(b => b.placeable).flatMap(b => b.drops.map(d => [d.itemId, b.material] as [string, number])),
)

export const blockDef = (material: number): BlockDef | undefined => BY_MATERIAL.get(material)
export const materialForItem = (itemId: string): number | undefined => BY_ITEM.get(itemId)
/** Block light emitted by a material — `light.ts`'s `emit` callback in one lookup. */
export const emitOf = (material: number): number => blockDef(material)?.emit ?? 0
export const isBreakable = (material: number): boolean =>
  material !== AIR && (blockDef(material)?.hardness ?? Infinity) !== Infinity

/**
 * Seconds to break, given the tool actually held.
 *
 * ★ THE RETURN OF `Infinity` IS THE GATE, and it is deliberately not a boolean. Too weak a tool
 * means "you cannot", not "this takes a while" — a player grinding for 40 seconds on a block that
 * was never going to break is the worst version of this mechanic. `canBreak` reads the same fact.
 *
 * `toolTier` 0 means bare hands. `toolSpeed` is `engine/tools.ts`'s `speedBonus` (lower = faster),
 * passed in rather than looked up so the core stays free of the engine.
 */
export function breakSeconds(material: number, toolTier: number, toolSkill: BlockSkill, toolSpeed = 1): number {
  const def = blockDef(material)
  if (!def || def.hardness === Infinity) return Infinity
  // Ungated block (soil, sand): hands always work. Holding the RIGHT family (fastSkill — a shovel
  // on dirt) is a real speed step and carries the tool's own speedBonus; any other tool is the old
  // flat 0.85 for "at least you're holding something". Never Infinity here — an ungated block that
  // could refuse you would strand a fresh keeper who has no tools at all.
  if (def.skill === null) {
    if (def.fastSkill && toolSkill === def.fastSkill) return def.hardness * 0.55 * toolSpeed
    return def.hardness * (toolSkill === null ? 1 : 0.85)
  }
  if (toolSkill !== def.skill) return Infinity   // wrong tool family entirely
  if (toolTier < def.minTier) return Infinity    // too weak — refused, not slowed
  // Each tier above the minimum is a real speed step, so upgrading a spike is felt immediately.
  const tierGain = 1 - Math.min(0.55, (toolTier - def.minTier) * 0.22)
  return def.hardness * tierGain * toolSpeed
}

export const canBreak = (material: number, toolTier: number, toolSkill: BlockSkill): boolean =>
  breakSeconds(material, toolTier, toolSkill) !== Infinity
