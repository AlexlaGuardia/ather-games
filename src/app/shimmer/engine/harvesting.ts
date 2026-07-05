// Harvesting engine — orchestrates skills + mana + resources for gathering
// Canon: shimmer-skilling.md — "Walk up, channel mana, resources appear"
// Pure functions — no React state. Game loop in page.tsx drives the flow.

import type { SkillSet, SkillId } from './skills'
import type { Inventory } from './inventory'
import { addItems } from './inventory'
import { addSkillXP, SKILL_META } from './skills'
import type { ManaPool } from './mana'
import { drainMana, getExtractionSpeed } from './mana'
import type { ResourceNode, NodeType } from '../world/resources'
import { NODE_DEFS, depleteNode, rollDrops, getNodeSkill } from '../world/resources'

const TPS = 15

// --- Channel timing (base ticks at 15 TPS) ---
// Forestry ~2s, Prospecting/Rinning ~3s — cozy but not tedious
export const BASE_CHANNEL_TICKS: Record<SkillId, number> = {
  forestry: 30,     // 2.0s
  prospecting: 45,  // 3.0s
  rinning: 45,      // 3.0s (was 4s — too slow for casual play, multi-catch compensates)
  farming: 30,      // 2.0s (crops handled by PlantedSeed, but defined for completeness)
  alchemy: 45,      // 3.0s (brewing handled separately)
  mana: 0,          // meta skill, no direct channeling
}

// --- Channel state (managed by game loop) ---

export interface ChannelState {
  nodeId: string
  nodeType: NodeType
  skillId: SkillId
  ticksElapsed: number
  durationTicks: number
}

// --- Harvest result (returned to game loop for UI feedback) ---

export interface HarvestResult {
  items: string[]                                      // item IDs added to bag
  xp: { skillId: SkillId; amount: number }[]           // XP granted
  manaSpent: number                                    // mana consumed
  levelUps: { skillId: SkillId; newLevel: number }[]   // any level-ups
  nodeDepleted: boolean                                // did the node deplete?
}

// --- Harvest check result ---

export type HarvestCheck =
  | { ok: true }
  | { ok: false; reason: 'no_node' | 'depleted' | 'level_too_low' | 'no_mana'; detail?: string }

// ============================================
// Core functions
// ============================================

/**
 * Find a harvestable node within range of the player (Chebyshev distance).
 * Default range 3 tiles. Returns the closest harvestable node, or null if none found.
 */
export function findAdjacentNode(
  playerTileX: number,
  playerTileY: number,
  zoneId: string,
  nodes: ResourceNode[],
  range: number = 3,
): ResourceNode | null {
  let best: ResourceNode | null = null
  let bestDist = Infinity

  for (const n of nodes) {
    if (n.zoneId !== zoneId || n.state !== 'harvestable') continue
    const dx = Math.abs(n.tileX - playerTileX)
    const dy = Math.abs(n.tileY - playerTileY)
    const dist = Math.max(dx, dy)
    if (dist <= range && dist < bestDist) {
      bestDist = dist
      best = n
    }
  }

  return best
}

/**
 * Check whether the player can harvest a specific node.
 * Validates: node state, skill level, mana availability.
 */
export function canHarvest(
  node: ResourceNode,
  skills: SkillSet,
  mana: ManaPool,
): HarvestCheck {
  if (node.state !== 'harvestable') {
    return { ok: false, reason: 'depleted' }
  }

  const def = NODE_DEFS[node.type]
  const skillId = getNodeSkill(node.type)
  const skill = skills[skillId]

  if (skill.level < def.minLevel) {
    return { ok: false, reason: 'level_too_low', detail: `Need ${SKILL_META[skillId].name} level ${def.minLevel}` }
  }

  if (mana.current < def.manaCost) {
    return { ok: false, reason: 'no_mana' }
  }

  return { ok: true }
}

/**
 * Get the channel duration in game ticks for a node type.
 * Factors in Mana skill extraction speed perk, tool speed bonus, and beast perk bonus.
 * beastSpeedBonus: fractional bonus from Drifthorn perk (e.g. 0.20 = 20% faster).
 */
export function getChannelDuration(nodeType: NodeType, manaLevel: number, toolSpeedBonus?: number, beastSpeedBonus?: number): number {
  const skillId = getNodeSkill(nodeType)
  const baseTicks = BASE_CHANNEL_TICKS[skillId] ?? 30
  const speedMult = getExtractionSpeed(manaLevel)
  const toolMult = toolSpeedBonus ?? 1
  const beastMult = 1 / (1 + (beastSpeedBonus ?? 0)) // 0.20 bonus → 0.833x duration
  return Math.max(1, Math.round(baseTicks / speedMult * toolMult * beastMult))
}

/**
 * Start a new channel. Returns the initial ChannelState.
 * Optional toolSpeedBonus reduces channel duration (e.g. 0.9 = 10% faster).
 * Optional beastSpeedBonus from Drifthorn perk (e.g. 0.20 = 20% faster).
 */
export function startChannel(node: ResourceNode, manaLevel: number, toolSpeedBonus?: number, beastSpeedBonus?: number): ChannelState {
  return {
    nodeId: node.id,
    nodeType: node.type,
    skillId: getNodeSkill(node.type),
    ticksElapsed: 0,
    durationTicks: getChannelDuration(node.type, manaLevel, toolSpeedBonus, beastSpeedBonus),
  }
}

/**
 * Tick the channel forward. Returns true when the channel completes.
 * Call once per game tick (15 TPS).
 */
export function tickChannel(channel: ChannelState): boolean {
  channel.ticksElapsed++
  return channel.ticksElapsed >= channel.durationTicks
}

/** Channel progress as 0-1 float (for progress bar UI). */
export function channelProgress(channel: ChannelState): number {
  return Math.min(1, channel.ticksElapsed / channel.durationTicks)
}

/**
 * Complete a harvest — drain mana, roll drops, grant XP, deplete node.
 * Call when tickChannel returns true.
 * Optional xpBonus multiplier from equipped tool (e.g. 1.1 = +10% XP).
 * Optional bonusFindChance from the active companion's @15 perk (matched to this node's skill).
 * Mutates: node state, skill XP, mana pool.
 * Does NOT mutate bag — returns items for caller to add.
 */
export function completeHarvest(
  node: ResourceNode,
  skills: SkillSet,
  mana: ManaPool,
  xpBonus?: number,
  bonusFindChance?: number,
): HarvestResult {
  const def = NODE_DEFS[node.type]
  const skillId = getNodeSkill(node.type)

  // Drain mana
  const drained = drainMana(mana, def.manaCost)
  const manaSpent = drained ? def.manaCost : 0

  // Roll drops (with optional companion bonus-find)
  const items = rollDrops(node.type, bonusFindChance)

  // Grant skill XP (with optional tool bonus)
  const xpAmount = Math.floor(def.xp * (xpBonus ?? 1))
  const xpResult = addSkillXP(skills[skillId], xpAmount)
  const xp: HarvestResult['xp'] = [{ skillId, amount: xpAmount }]
  const levelUps: HarvestResult['levelUps'] = []
  if (xpResult.leveled) {
    levelUps.push({ skillId, newLevel: xpResult.newLevel })
  }

  // Deplete node (handles fishing spot multi-catch internally)
  depleteNode(node)
  const nodeDepleted = node.state === 'depleted'

  return { items, xp, manaSpent, levelUps, nodeDepleted }
}

/**
 * Add harvested items to the player's inventory, respecting stack limits.
 * Returns the items that were actually added (for UI feedback).
 */
export function addHarvestItems(
  inv: Inventory,
  items: string[],
): string[] {
  const added: string[] = []
  for (const itemId of items) {
    const leftover = addItems(inv, itemId, 1)
    if (leftover === 0) {
      added.push(itemId)
    }
    // Silently drop if no space — canon: items overflow to ground (future)
  }
  return added
}
