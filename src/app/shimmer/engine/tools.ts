// Gathering tools — optional equipment that boosts XP and channel speed
// Canon: blades (forestry), spikes (prospecting), rinsticks (rinning)
// 3 tiers per skill, craftable from gathered resources, durability-based

import type { SkillId } from './skills'
import type { Inventory } from './inventory'
import { countItem, removeItems } from './inventory'

export interface ToolDef {
  id: string
  name: string
  skillId: SkillId
  tier: 0 | 1 | 2 | 3     // tier 0 = the basic Greg-given tool (infinite, no bonus)
  durability: number      // max uses before breaking (basics: effectively infinite)
  xpBonus: number         // multiplier (1.1 = +10% XP)
  speedBonus: number      // multiplier on channel ticks (0.9 = 10% faster)
  recipe: { itemId: string; count: number }[]
  basic?: boolean         // the free starter tool — never breaks, always the fallback
}

export const TOOL_DEFS: Record<string, ToolDef> = {
  // ── Basic tools — Greg hands you one per gathering skill at game start. Infinite durability,
  // no recipe, no bonus. They handle the low tier cleanly and STRUGGLE above it (soft mana penalty,
  // applied at the gather site) so there's incentive to craft the tiered tools below — but the basic
  // is always your backup, so you can never be locked out of gathering. ──
  worn_blade:    { id: 'worn_blade',    name: 'Worn Blade',    skillId: 'forestry',    tier: 1, durability: 999999, xpBonus: 1, speedBonus: 1, recipe: [], basic: true },
  worn_spike:    { id: 'worn_spike',    name: 'Worn Spike',    skillId: 'prospecting', tier: 1, durability: 999999, xpBonus: 1, speedBonus: 1, recipe: [], basic: true },
  worn_rinstick: { id: 'worn_rinstick', name: 'Worn Rinstick', skillId: 'rinning',     tier: 1, durability: 999999, xpBonus: 1, speedBonus: 1, recipe: [], basic: true },

  // Forestry — Blades
  goldwood_blade: {
    id: 'goldwood_blade', name: 'Goldwood Blade', skillId: 'forestry', tier: 1,
    durability: 50, xpBonus: 1.1, speedBonus: 0.9,
    recipe: [{ itemId: 'goldwood_plank', count: 5 }, { itemId: 'goldwood_bark', count: 3 }],
  },
  shimmeroak_blade: {
    id: 'shimmeroak_blade', name: 'Shimmeroak Blade', skillId: 'forestry', tier: 2,
    durability: 100, xpBonus: 1.2, speedBonus: 0.85,
    recipe: [{ itemId: 'shimmeroak_plank', count: 8 }, { itemId: 'amber_sap', count: 4 }],
  },
  starwillow_blade: {
    id: 'starwillow_blade', name: 'Starwillow Blade', skillId: 'forestry', tier: 3,
    durability: 200, xpBonus: 1.35, speedBonus: 0.8,
    recipe: [{ itemId: 'starwillow_branch', count: 10 }, { itemId: 'starwillow_sap', count: 5 }],
  },

  // Prospecting — Spikes
  mana_spike: {
    id: 'mana_spike', name: 'Mana Spike', skillId: 'prospecting', tier: 1,
    durability: 50, xpBonus: 1.1, speedBonus: 0.9,
    recipe: [{ itemId: 'raw_mana_shard', count: 8 }],
  },
  crystal_spike: {
    id: 'crystal_spike', name: 'Crystal Spike', skillId: 'prospecting', tier: 2,
    durability: 100, xpBonus: 1.2, speedBonus: 0.85,
    recipe: [{ itemId: 'violet_crystal', count: 3 }, { itemId: 'storm_crystal', count: 3 }, { itemId: 'raw_mana_shard', count: 5 }],
  },
  pure_spike: {
    id: 'pure_spike', name: 'Pure Spike', skillId: 'prospecting', tier: 3,
    durability: 200, xpBonus: 1.35, speedBonus: 0.8,
    recipe: [{ itemId: 'pure_mana_core', count: 5 }, { itemId: 'earth_crystal', count: 4 }, { itemId: 'water_crystal', count: 4 }],
  },

  // Rinning — Rinsticks
  basic_rinstick: {
    id: 'basic_rinstick', name: 'Basic Rinstick', skillId: 'rinning', tier: 1,
    durability: 50, xpBonus: 1.1, speedBonus: 0.9,
    recipe: [{ itemId: 'shimmerscale', count: 4 }, { itemId: 'clickclaw', count: 4 }],
  },
  glowfin_rinstick: {
    id: 'glowfin_rinstick', name: 'Glowfin Rinstick', skillId: 'rinning', tier: 2,
    durability: 100, xpBonus: 1.2, speedBonus: 0.85,
    recipe: [{ itemId: 'glowfin', count: 5 }, { itemId: 'ribboneel', count: 5 }, { itemId: 'goldwood_plank', count: 3 }],
  },
  moonkoi_rinstick: {
    id: 'moonkoi_rinstick', name: 'Moonkoi Rinstick', skillId: 'rinning', tier: 3,
    durability: 200, xpBonus: 1.35, speedBonus: 0.8,
    recipe: [{ itemId: 'moonkoi', count: 6 }, { itemId: 'pearlshell', count: 4 }, { itemId: 'crystal_rinn', count: 2 }],
  },
}

// ============================================
// Equipment state
// ============================================

export interface EquippedTool {
  toolId: string
  usesRemaining: number
  speedBonus?: number
  xpBonus?: number
}

export type EquippedTools = Partial<Record<SkillId, EquippedTool>>

/** Get the equipped tool for a skill, if any */
export function getEquippedTool(equipped: EquippedTools, skillId: SkillId): EquippedTool | undefined {
  return equipped[skillId]
}

/** Get the ToolDef for an equipped tool */
export function getToolDef(tool: EquippedTool): ToolDef | undefined {
  return TOOL_DEFS[tool.toolId]
}

/** Use a tool (decrement durability). Returns false if the tool broke. Basics never break. */
export function useTool(tool: EquippedTool): boolean {
  if (TOOL_DEFS[tool.toolId]?.basic) return true
  tool.usesRemaining--
  return tool.usesRemaining > 0
}

// The basic (Greg-given) tool per gathering skill. Farming/Alchemy are toolless (hand + mana).
export const BASIC_TOOL_ID: Partial<Record<SkillId, string>> = {
  forestry: 'worn_blade', prospecting: 'worn_spike', rinning: 'worn_rinstick',
}

/** Build an equipped basic tool for a skill (or null if that skill is toolless). */
export function makeBasicTool(skillId: SkillId): EquippedTool | null {
  const id = BASIC_TOOL_ID[skillId]
  if (!id) return null
  const def = TOOL_DEFS[id]
  return { toolId: id, usesRemaining: def.durability, speedBonus: def.speedBonus, xpBonus: def.xpBonus }
}

/** Ensure every tool-using skill has at least its basic tool equipped (the always-available backup).
 *  Mutates + returns the map. Call after load, starter-kit grant, and whenever an improved tool breaks. */
export function ensureBasicTools(equipped: EquippedTools): EquippedTools {
  for (const skillId of Object.keys(BASIC_TOOL_ID) as SkillId[]) {
    if (!equipped[skillId]) {
      const basic = makeBasicTool(skillId)
      if (basic) equipped[skillId] = basic
    }
  }
  return equipped
}

/** Check if player has materials to craft a tool */
export function canCraft(toolId: string, inv: Inventory): boolean {
  const def = TOOL_DEFS[toolId]
  if (!def) return false
  return def.recipe.every(r => countItem(inv, r.itemId) >= r.count)
}

/** Craft a tool — consumes materials from inventory, returns new EquippedTool or null if can't craft */
export function craftTool(toolId: string, inv: Inventory): EquippedTool | null {
  const def = TOOL_DEFS[toolId]
  if (!def || !canCraft(toolId, inv)) return null
  for (const r of def.recipe) {
    removeItems(inv, r.itemId, r.count)
  }
  return { toolId, usesRemaining: def.durability, speedBonus: def.speedBonus, xpBonus: def.xpBonus }
}

// ============================================
// Save/Load
// ============================================

export interface ToolsSave {
  equipped: Record<string, { toolId: string; usesRemaining: number; speedBonus?: number; xpBonus?: number }>
}

export function toolsToSave(equipped: EquippedTools): ToolsSave {
  const out: ToolsSave['equipped'] = {}
  for (const [skillId, tool] of Object.entries(equipped)) {
    if (tool) out[skillId] = { toolId: tool.toolId, usesRemaining: tool.usesRemaining, speedBonus: tool.speedBonus, xpBonus: tool.xpBonus }
  }
  return { equipped: out }
}

export function toolsFromSave(saved: ToolsSave | undefined): EquippedTools {
  if (!saved?.equipped) return {}
  const out: EquippedTools = {}
  for (const [skillId, data] of Object.entries(saved.equipped)) {
    const def = TOOL_DEFS[data.toolId]
    if (def) {
      out[skillId as SkillId] = {
        toolId: data.toolId,
        usesRemaining: data.usesRemaining,
        speedBonus: data.speedBonus ?? def.speedBonus,
        xpBonus: data.xpBonus ?? def.xpBonus,
      }
    }
  }
  return out
}
