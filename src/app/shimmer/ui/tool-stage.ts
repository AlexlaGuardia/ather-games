// THE TOOL DIAL'S STAGE (BETA M184 s1, Alex 11-25). What one dial by the mana orb draws for a family: EMPTY until the
// friend hands the worn tool (M68: Otto the spike, Bonn the pruner, Fennel the rinstick: rinsticks.ts › loadTools already
// leaves an ungiven socket out of the map), then a STAGE: 0 = the worn tool (plain steel, M134 ruling 4d65536), 1..3 = the
// crafted tiers (engine/tools.ts › TOOL_DEFS: Goldwood / Shimmeroak / Starwillow Pruner,
// Basic / Glowfin / Moonkoi Rinstick); spikes since M185 s1: Goldwood / Shimmeroak / Starwillow Spike). Names come from TOOL_DEFS only; nothing here names a tool.
//
// ★ NO RING ON STEPS 1-3 (Alex 11-26, BETA 51fe8cda, supersedes M184 s1's per-stage ring): a crafted tier is TINT ONLY. The
//   ring belongs to a fitted metal TIP / EDGE (M134, not built yet), in that metal's colour (METAL_RING), its arc the tip's
//   wear. Until a tip exists nothing has a ring; `ringPct` / `ringColor` stay in the shape for the day M134 fills them.
import { TOOL_DEFS, type EquippedTools } from '../engine/tools'

export const OPEN_TOOL_FAMILIES = ['forestry', 'prospecting', 'rinning'] as const
export type OpenToolFamily = typeof OPEN_TOOL_FAMILIES[number]

/** M184 + Alex 11-26 (canon athernyx 18bd165, game/economy.md): a fitted tip's ring takes its METAL's colour. Nothing draws
 *  these yet (M134 builds the tip). ⚠ Eurleen (gold) is not Valkara gold (the Gilded Trim): same colour family, keep the two
 *  apart in name and icon. */
export const METAL_RING = { venium: '#9a5ae0', eurleen: '#d4a63c', havensteel: '#c9d1da' } as const
export type TipMetal = keyof typeof METAL_RING
/** the glyph's tint per stage: worn = plain steel */
export const STAGE_TINT = ['#8d949c', '#d4a63c', '#9a7fe0', '#dfe9f7'] as const

export type ToolDial = {
  held: boolean
  toolId: string | null
  name: string | null
  /** 0 = worn, 1..3 = crafted tier; -1 = empty */
  stage: number
  /** 0..1 of the fitted tip's wear left; null = no ring (no tip fitted: today, every tool) */
  ringPct: number | null
  ringColor: string | null
  tint: string | null
}

export function toolDial(tools: EquippedTools, family: string): ToolDial {
  const t = (tools as Record<string, { toolId: string; usesRemaining: number } | undefined>)[family]
  const def = t ? TOOL_DEFS[t.toolId] : undefined
  if (!t || !def) return { held: false, toolId: null, name: null, stage: -1, ringPct: null, ringColor: null, tint: null }
  const stage = def.basic ? 0 : Math.max(1, Math.min(3, def.tier))
  // no tip is fitted anywhere yet (M134), so no ring at any stage: steps 1-3 are tint only (Alex 11-26)
  return { held: true, toolId: t.toolId, name: def.name, stage, ringPct: null, ringColor: null, tint: STAGE_TINT[stage] }
}
