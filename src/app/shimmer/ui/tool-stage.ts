// THE TOOL DIAL'S STAGE (BETA M184 s1, Alex 11-25). What one dial by the mana orb draws for a family: EMPTY until the
// friend hands the worn tool (M68: Otto the spike, Bonn the pruner, Fennel the rinstick: rinsticks.ts › loadTools already
// leaves an ungiven socket out of the map), then a STAGE: 0 = the worn tool (plain steel, M134 ruling 4d65536), 1..3 = the
// crafted tiers (engine/tools.ts › TOOL_DEFS: Goldwood / Shimmeroak / Starwillow Pruner, Mana / Crystal / Pure Spike,
// Basic / Glowfin / Moonkoi Rinstick). Names come from TOOL_DEFS only; nothing here names a tool.
//
// ★ THE RING: every upgrade (stage 1+) wears a BORDER RING in its own colour that doubles as the durability bar: the arc
//   is usesRemaining / durability. The worn tool has no ring (nothing to upgrade, never wears).
// ⚠ TODAY NOTHING IN THE OPEN WORLD WEARS (M133, Alex 11-24: tools are permanent; loadTools resets usesRemaining), so the
//   ring reads full for every keeper. It drains by itself the day a wear source lands (M134's edges / tips) and counts it
//   down in `usesRemaining`; no change here.
// Colours are a look call (Jin, 11-26), placeholders until Alex sees them: one per stage, shared across the three families.
import { TOOL_DEFS, type EquippedTools } from '../engine/tools'

export const OPEN_TOOL_FAMILIES = ['forestry', 'prospecting', 'rinning'] as const
export type OpenToolFamily = typeof OPEN_TOOL_FAMILIES[number]

/** ring colour per stage; stage 0 (worn) has none */
export const STAGE_RING = ['', '#d4a63c', '#9a7fe0', '#dfe9f7'] as const
/** the glyph's tint per stage: worn = plain steel */
export const STAGE_TINT = ['#8d949c', '#d4a63c', '#9a7fe0', '#dfe9f7'] as const

export type ToolDial = {
  held: boolean
  toolId: string | null
  name: string | null
  /** 0 = worn, 1..3 = crafted tier; -1 = empty */
  stage: number
  /** 0..1 durability left; null = no ring (empty or worn) */
  ringPct: number | null
  ringColor: string | null
  tint: string | null
}

export function toolDial(tools: EquippedTools, family: string): ToolDial {
  const t = (tools as Record<string, { toolId: string; usesRemaining: number } | undefined>)[family]
  const def = t ? TOOL_DEFS[t.toolId] : undefined
  if (!t || !def) return { held: false, toolId: null, name: null, stage: -1, ringPct: null, ringColor: null, tint: null }
  const stage = def.basic ? 0 : Math.max(1, Math.min(3, def.tier))
  const ringPct = stage === 0 ? null : Math.max(0, Math.min(1, t.usesRemaining / Math.max(1, def.durability)))
  return { held: true, toolId: t.toolId, name: def.name, stage, ringPct, ringColor: stage ? STAGE_RING[stage] : null, tint: STAGE_TINT[stage] }
}
