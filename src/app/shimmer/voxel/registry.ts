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
  /** What lands in the inventory. Empty = breaks into nothing. */
  drops: { itemId: string; count: number }[]
  /** Can a player place this back down? */
  placeable: boolean
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
  { material: MAT.SUBSOIL, name: 'Subsoil', hardness: 0.5, skill: null, minTier: 0, drops: [{ itemId: 'block_subsoil', count: 1 }], placeable: true },
  { material: MAT.TOPSOIL, name: 'Topsoil', hardness: 0.55, skill: null, minTier: 0, drops: [{ itemId: 'block_topsoil', count: 1 }], placeable: true },
  { material: MAT.SAND, name: 'Sand', hardness: 0.45, skill: null, minTier: 0, drops: [{ itemId: 'block_sand', count: 1 }], placeable: true },
  { material: MAT.WATER, name: 'Water', hardness: Infinity, skill: null, minTier: 0, drops: [], placeable: false },

  // ── the Prospecting ladder — hardness AND tier both climb, so depth gates twice over ────────
  { material: ORE.RAW_MANA, name: 'Raw Mana Seam', hardness: 2.2, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'raw_mana_shard', count: 1 }], placeable: false },
  { material: ORE.ELEMENT_VIOLET, name: 'Violet Crystal Seam', hardness: 3.0, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'violet_crystal', count: 1 }], placeable: false },
  { material: ORE.ELEMENT_STORM, name: 'Storm Crystal Seam', hardness: 3.0, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'storm_crystal', count: 1 }], placeable: false },
  { material: ORE.ELEMENT_EARTH, name: 'Earth Crystal Seam', hardness: 3.0, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'earth_crystal', count: 1 }], placeable: false },
  { material: ORE.ELEMENT_WATER, name: 'Water Crystal Seam', hardness: 3.0, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'water_crystal', count: 1 }], placeable: false },
  { material: ORE.PURE_CORE, name: 'Pure Core Seam', hardness: 4.5, skill: 'prospecting', minTier: 2, drops: [{ itemId: 'pure_mana_core', count: 1 }], placeable: false },
  { material: ORE.ATHER_CRYSTAL, name: 'Ather Crystal Seam', hardness: 6.5, skill: 'prospecting', minTier: 3, drops: [{ itemId: 'ather_crystal', count: 1 }], placeable: false },
]

const BY_MATERIAL = new Map<number, BlockDef>(BLOCKS.map(b => [b.material, b]))
/** Reverse map so a placed block-item becomes the right voxel. */
const BY_ITEM = new Map<string, number>(
  BLOCKS.filter(b => b.placeable).flatMap(b => b.drops.map(d => [d.itemId, b.material] as [string, number])),
)

export const blockDef = (material: number): BlockDef | undefined => BY_MATERIAL.get(material)
export const materialForItem = (itemId: string): number | undefined => BY_ITEM.get(itemId)
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
  if (def.skill === null) return def.hardness * (toolSkill === null ? 1 : 0.85)
  if (toolSkill !== def.skill) return Infinity   // wrong tool family entirely
  if (toolTier < def.minTier) return Infinity    // too weak — refused, not slowed
  // Each tier above the minimum is a real speed step, so upgrading a spike is felt immediately.
  const tierGain = 1 - Math.min(0.55, (toolTier - def.minTier) * 0.22)
  return def.hardness * tierGain * toolSpeed
}

export const canBreak = (material: number, toolTier: number, toolSkill: BlockSkill): boolean =>
  breakSeconds(material, toolTier, toolSkill) !== Infinity
