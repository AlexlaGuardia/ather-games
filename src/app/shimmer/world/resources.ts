// Resource nodes — trees, crystals, fishing spots
// Canon: shimmer-skilling.md — nodes deplete on harvest, respawn after timer

import type { SkillId } from '../engine/skills'

export type NodeType =
  // Forestry
  | 'goldwood' | 'shimmeroak' | 'starwillow' | 'dawnwood'
  // Prospecting
  | 'raw_mana_node' | 'element_crystal_node' | 'pure_core_node' | 'ather_crystal_node'
  // Rinning
  | 'small_pond' | 'stream' | 'lake'
  // Farming
  | 'ather_soil'

export type NodeState = 'harvestable' | 'depleted'

// What skill does this node require?
const NODE_SKILL: Record<NodeType, SkillId> = {
  goldwood: 'forestry', shimmeroak: 'forestry', starwillow: 'forestry', dawnwood: 'forestry',
  raw_mana_node: 'prospecting', element_crystal_node: 'prospecting', pure_core_node: 'prospecting', ather_crystal_node: 'prospecting',
  small_pond: 'rinning', stream: 'rinning', lake: 'rinning',
  ather_soil: 'farming',
}

// Node definitions — canon respawn timers (in ms), XP, required level, resource drops
export interface NodeDef {
  type: NodeType
  skill: SkillId
  minLevel: number           // minimum skill level to harvest
  respawnMs: number          // ms until respawn after depletion
  xp: number                 // skill XP per harvest
  manaCost: number           // mana per harvest action
  drops: { itemId: string; chance: number }[]  // weighted drops (chance 0-1)
  maxHarvests?: number       // for fishing spots — deplete after N catches
}

export const NODE_DEFS: Record<NodeType, NodeDef> = {
  // Forestry — trees (respawn tuned for casual 20-30 min sessions)
  goldwood:    { type: 'goldwood',    skill: 'forestry', minLevel: 1, respawnMs: 2 * 60_000,   xp: 20,  manaCost: 5, drops: [{ itemId: 'goldwood_plank', chance: 1.0 }, { itemId: 'goldwood_bark', chance: 0.3 }] },
  shimmeroak:  { type: 'shimmeroak',  skill: 'forestry', minLevel: 4, respawnMs: 5 * 60_000,   xp: 50,  manaCost: 5, drops: [{ itemId: 'shimmeroak_plank', chance: 1.0 }, { itemId: 'amber_sap', chance: 0.4 }] },
  starwillow:  { type: 'starwillow',  skill: 'forestry', minLevel: 7, respawnMs: 9 * 60_000,   xp: 120, manaCost: 5, drops: [{ itemId: 'starwillow_branch', chance: 1.0 }, { itemId: 'starwillow_sap', chance: 0.35 }] },
  dawnwood:    { type: 'dawnwood',    skill: 'forestry', minLevel: 10, respawnMs: 15 * 60_000,  xp: 300, manaCost: 5, drops: [{ itemId: 'dawnwood_plank', chance: 1.0 }, { itemId: 'crystallized_sap', chance: 0.25 }] },

  // Prospecting — crystals
  raw_mana_node:       { type: 'raw_mana_node',       skill: 'prospecting', minLevel: 1, respawnMs: 90_000,       xp: 20,  manaCost: 7, drops: [{ itemId: 'raw_mana_shard', chance: 1.0 }] },
  element_crystal_node:{ type: 'element_crystal_node', skill: 'prospecting', minLevel: 4, respawnMs: 6 * 60_000,  xp: 60,  manaCost: 7, drops: [{ itemId: 'violet_crystal', chance: 0.25 }, { itemId: 'storm_crystal', chance: 0.25 }, { itemId: 'earth_crystal', chance: 0.25 }, { itemId: 'water_crystal', chance: 0.25 }] },
  pure_core_node:      { type: 'pure_core_node',      skill: 'prospecting', minLevel: 7, respawnMs: 12 * 60_000, xp: 150, manaCost: 7, drops: [{ itemId: 'pure_mana_core', chance: 1.0 }] },
  ather_crystal_node:  { type: 'ather_crystal_node',  skill: 'prospecting', minLevel: 10, respawnMs: 20 * 60_000, xp: 400, manaCost: 7, drops: [{ itemId: 'ather_crystal', chance: 1.0 }] },

  // Rinning — fishing spots (maxHarvests = catches before depletion)
  small_pond: { type: 'small_pond', skill: 'rinning', minLevel: 1, respawnMs: 3 * 60_000,  xp: 20,  manaCost: 4, maxHarvests: 3, drops: [{ itemId: 'shimmerscale', chance: 0.6 }, { itemId: 'clickclaw', chance: 0.4 }] },
  stream:     { type: 'stream',     skill: 'rinning', minLevel: 4, respawnMs: 5 * 60_000,  xp: 45,  manaCost: 4, maxHarvests: 5, drops: [{ itemId: 'glowfin', chance: 0.5 }, { itemId: 'ribboneel', chance: 0.5 }] },
  lake:       { type: 'lake',       skill: 'rinning', minLevel: 7, respawnMs: 8 * 60_000,  xp: 120, manaCost: 4, maxHarvests: 8, drops: [{ itemId: 'moonkoi', chance: 0.4 }, { itemId: 'pearlshell', chance: 0.4 }, { itemId: 'crystal_rinn', chance: 0.2 }] },

  // Farming — planting targets (not harvestable, used for mana seed bloom)
  ather_soil:  { type: 'ather_soil', skill: 'farming', minLevel: 1, respawnMs: 0, xp: 0, manaCost: 0, drops: [] },
}

// ============================================
// Resource Node Instance (lives in world)
// ============================================

export interface ResourceNode {
  id: string
  type: NodeType
  tileX: number
  tileY: number
  zoneId: string
  state: NodeState
  respawnAt: number         // timestamp (ms) when node becomes harvestable again, 0 = ready
  harvestsRemaining: number // for fishing spots, decremented per catch
  animFrame: number         // current animation frame index (runtime only)
  animOffset: number        // stagger offset derived from position (runtime only)
}

/** Create a new resource node at a given tile position */
export function createResourceNode(type: NodeType, tileX: number, tileY: number, zoneId: string): ResourceNode {
  const def = NODE_DEFS[type]
  return {
    id: `node-${type}-${tileX}-${tileY}-${zoneId}`,
    type,
    tileX,
    tileY,
    zoneId,
    state: 'harvestable',
    respawnAt: 0,
    harvestsRemaining: def.maxHarvests ?? 1,
    animFrame: 0,
    animOffset: (tileX * 7 + tileY * 13) % 60,  // stagger by position
  }
}

/** Deplete a node after harvesting. Sets individual respawn timer. */
export function depleteNode(node: ResourceNode): void {
  const def = NODE_DEFS[node.type]

  // Fishing spots deplete after N catches
  if (def.maxHarvests && def.maxHarvests > 1) {
    node.harvestsRemaining--
    if (node.harvestsRemaining > 0) return  // still has catches left
  }

  node.state = 'depleted'
  node.respawnAt = Date.now() + def.respawnMs
}

/** Check and respawn a single depleted node by its timer. */
export function tickNodeRespawn(node: ResourceNode): boolean {
  if (node.state !== 'depleted') return false
  if (node.respawnAt > 0 && Date.now() >= node.respawnAt) {
    const def = NODE_DEFS[node.type]
    node.state = 'harvestable'
    node.respawnAt = 0
    node.harvestsRemaining = def.maxHarvests ?? 1
    return true
  }
  return false
}

/** Tick all nodes for timer-based respawn. Returns count of nodes that respawned. */
export function tickAllNodeRespawns(nodes: ResourceNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (tickNodeRespawn(node)) count++
  }
  return count
}

/**
 * Batch-respawn all depleted nodes of a given skill type.
 * Called by day/night cycle at phase transitions (dawn=forestry, dusk=prospecting, midnight=rinning).
 * Returns count of respawned nodes.
 */
export function respawnNodesBySkill(nodes: ResourceNode[], skillId: string): number {
  let count = 0
  for (const node of nodes) {
    if (node.state !== 'depleted') continue
    const nodeSkill = NODE_SKILL[node.type]
    if (nodeSkill === skillId) {
      const def = NODE_DEFS[node.type]
      node.state = 'harvestable'
      node.respawnAt = 0
      node.harvestsRemaining = def.maxHarvests ?? 1
      count++
    }
  }
  return count
}

/**
 * Roll drops from a node. Returns array of item IDs to add to bag.
 * bonusFindChance: companion @15 perk (Grovekin/Gemsense/Truesight) — a chance to turn up
 * one extra of the node's primary drop. 0 = no active companion perk for this skill.
 */
export function rollDrops(type: NodeType, bonusFindChance = 0): string[] {
  const def = NODE_DEFS[type]
  const items: string[] = []
  for (const drop of def.drops) {
    if (Math.random() < drop.chance) {
      items.push(drop.itemId)
    }
  }
  // Guarantee at least one drop
  if (items.length === 0 && def.drops.length > 0) {
    items.push(def.drops[0].itemId)
  }
  // Companion perk bonus find — a chance for one extra primary drop.
  if (bonusFindChance > 0 && def.drops.length > 0 && Math.random() < bonusFindChance) {
    items.push(def.drops[0].itemId)
  }
  return items
}

/** Get the skill required for a node type */
export function getNodeSkill(type: NodeType): SkillId {
  return NODE_SKILL[type]
}

/** Node tier 1-4, derived from its minLevel band (T1 lvl1-3, T2 4-6, T3 7-9, T4 10).
 *  Used against the equipped tool's tier for the under-tooled mana penalty. */
export function nodeTier(type: NodeType): number {
  const ml = NODE_DEFS[type].minLevel
  return ml >= 10 ? 4 : ml >= 7 ? 3 : ml >= 4 ? 2 : 1
}

// Save/load
export interface ResourceNodeSave {
  type: NodeType
  tileX: number
  tileY: number
  zoneId: string
  state: NodeState
  respawnAt: number
  harvestsRemaining: number
}

export function nodesToSave(nodes: ResourceNode[]): ResourceNodeSave[] {
  return nodes.map(n => ({
    type: n.type, tileX: n.tileX, tileY: n.tileY, zoneId: n.zoneId,
    state: n.state, respawnAt: n.respawnAt, harvestsRemaining: n.harvestsRemaining,
  }))
}

// Merge current ZONE_NODES placements with the player's saved harvest state.
// Source of truth is `defaults` (built from ZONE_NODES) so map-editor changes
// propagate to existing saves. Saved state overlays only when (zone, tile, type)
// matches — moves/removes/type-changes get fresh defaults.
export function mergeNodesFromSave(
  defaults: ResourceNode[],
  saves: ResourceNodeSave[],
): ResourceNode[] {
  const saveMap = new Map<string, ResourceNodeSave>()
  for (const s of saves) saveMap.set(`${s.zoneId}|${s.tileX}|${s.tileY}|${s.type}`, s)
  return defaults.map(d => {
    const saved = saveMap.get(`${d.zoneId}|${d.tileX}|${d.tileY}|${d.type}`)
    if (!saved) return d
    return {
      ...d,
      state: saved.state ?? d.state,
      respawnAt: saved.respawnAt ?? 0,
      harvestsRemaining: saved.harvestsRemaining ?? d.harvestsRemaining,
    }
  })
}
