// Quest system — structured objectives with rewards
// Layers on top of the flag-based progression model.
// Objectives check live game state; quests auto-complete when all objectives are met.

import type { Inventory } from './inventory'
import type { SkillSet } from './skills'
import type { SpiritIndex } from './spirit-index'
import { countItem, addItems } from './inventory'
import { addSkillXP } from './skills'
import type { Species } from '../spirits/spirit'
import { speciesDisplayName } from '../spirits/spirit'

// ============================================
// Types
// ============================================

export type QuestObjective =
  | { type: 'gather'; itemId: string; count: number; label?: string }
  | { type: 'study'; species: string }
  | { type: 'talk'; npcId: string }
  | { type: 'visit'; zoneId: string }
  | { type: 'brew'; potionId: string; count: number }
  | { type: 'battle'; npcId: string }
  | { type: 'flag'; flag: string }
  | { type: 'skill'; skillId: string; level: number }

export type QuestReward =
  | { type: 'item'; itemId: string; count: number }
  | { type: 'marks'; amount: number }
  | { type: 'xp'; skillId: string; amount: number }
  | { type: 'flag'; flag: string }

export interface QuestDef {
  id: string
  name: string
  description: string
  category: 'main' | 'side'
  prerequisites: string[]       // quest IDs or flag names
  objectives: QuestObjective[]
  rewards: QuestReward[]
  autoStart?: boolean
}

export interface QuestProgress {
  status: 'active' | 'complete'
  progress: number[]
}

export type QuestState = Record<string, QuestProgress>

// ============================================
// Quest definitions
// ============================================

export const QUEST_DEFS: Record<string, QuestDef> = {
  // Main quests
  first_steps: {
    id: 'first_steps', name: 'First Steps', category: 'main',
    description: 'Speak with Gregory to learn the basics of the Shimmer.',
    prerequisites: [],
    objectives: [{ type: 'flag', flag: 'tutorialComplete' }],
    rewards: [{ type: 'marks', amount: 50 }],
    autoStart: true,
  },
  gathering_101: {
    id: 'gathering_101', name: 'Gathering 101', category: 'main',
    description: 'Collect raw mana shards from crystal nodes to begin your journey.',
    prerequisites: ['first_steps'],
    objectives: [{ type: 'gather', itemId: 'raw_mana_shard', count: 10 }],
    rewards: [{ type: 'item', itemId: 'berry', count: 5 }, { type: 'marks', amount: 30 }],
  },
  spirit_seeker: {
    id: 'spirit_seeker', name: 'Spirit Seeker', category: 'main',
    description: 'Study a wild spirit in the Ather mist to record your first research entry.',
    prerequisites: ['first_steps'],
    objectives: [{ type: 'study', species: 'any' }],
    rewards: [{ type: 'marks', amount: 100 }, { type: 'item', itemId: 'seed_fox', count: 1 }],
  },
  beyond_garden: {
    id: 'beyond_garden', name: 'Beyond the Garden', category: 'main',
    description: 'Leave the safety of the garden and explore the Mycelial Path.',
    prerequisites: ['first_steps'],
    objectives: [{ type: 'visit', zoneId: 'mycelial-path' }],
    rewards: [{ type: 'marks', amount: 75 }],
  },

  // Side quests
  first_brew: {
    id: 'first_brew', name: 'First Brew', category: 'side',
    description: 'Use the alchemy table to brew your first Mana Draught.',
    prerequisites: ['gathering_101'],
    objectives: [{ type: 'brew', potionId: 'mana_draught', count: 1 }],
    rewards: [{ type: 'marks', amount: 50 }, { type: 'xp', skillId: 'alchemy', amount: 20 }],
  },
  market_trader: {
    id: 'market_trader', name: 'Market Trader', category: 'side',
    description: 'Visit the Ather Exchange booth and make your first trade.',
    prerequisites: ['first_steps'],
    objectives: [{ type: 'flag', flag: 'ge_first_trade' }],
    rewards: [{ type: 'marks', amount: 40 }],
  },
}

export const QUEST_IDS = Object.keys(QUEST_DEFS)

// ============================================
// Objective checking
// ============================================

type SkillId = keyof SkillSet

function checkObjective(
  obj: QuestObjective,
  inv: Inventory,
  flags: Record<string, boolean>,
  skills: SkillSet,
  spiritIndex: SpiritIndex,
  zoneId: string,
): number {
  switch (obj.type) {
    case 'gather':
      return countItem(inv, obj.itemId)
    case 'study':
      if (obj.species === 'any') return spiritIndex.totalStudied
      return spiritIndex.entries[obj.species as keyof typeof spiritIndex.entries]?.timesStudied > 0 ? 1 : 0
    case 'flag':
      return flags[obj.flag] ? 1 : 0
    case 'visit':
      return flags[`visited_${obj.zoneId}`] ? 1 : 0
    case 'talk':
      return flags[`talked_${obj.npcId}`] ? 1 : 0
    case 'battle':
      return flags[`defeated_${obj.npcId}`] ? 1 : 0
    case 'brew':
      return flags[`brewed_${obj.potionId}`] ? 1 : 0
    case 'skill': {
      const skill = skills[obj.skillId as SkillId]
      return skill ? skill.level : 0
    }
  }
}

export function objectiveTarget(obj: QuestObjective): number {
  switch (obj.type) {
    case 'gather': return obj.count
    case 'brew': return obj.count
    case 'skill': return obj.level
    case 'study': return 1
    case 'flag': return 1
    case 'visit': return 1
    case 'talk': return 1
    case 'battle': return 1
  }
}

// ============================================
// State management
// ============================================

/** Check if a prerequisite is met (quest completed or flag set) */
function prereqMet(prereq: string, state: QuestState, flags: Record<string, boolean>): boolean {
  if (state[prereq]?.status === 'complete') return true
  if (flags[prereq]) return true
  return false
}

/** Get quests available to start (prerequisites met, not yet started) */
export function getAvailableQuests(state: QuestState, flags: Record<string, boolean>): QuestDef[] {
  return QUEST_IDS
    .filter(id => !state[id])
    .map(id => QUEST_DEFS[id])
    .filter(q => q.prerequisites.every(p => prereqMet(p, state, flags)))
}

/** Get active (in-progress) quests */
export function getActiveQuests(state: QuestState): QuestDef[] {
  return QUEST_IDS
    .filter(id => state[id]?.status === 'active')
    .map(id => QUEST_DEFS[id])
}

/** Get completed quests */
export function getCompletedQuests(state: QuestState): QuestDef[] {
  return QUEST_IDS
    .filter(id => state[id]?.status === 'complete')
    .map(id => QUEST_DEFS[id])
}

/** Start a quest */
export function startQuest(state: QuestState, questId: string): void {
  const def = QUEST_DEFS[questId]
  if (!def || state[questId]) return
  state[questId] = {
    status: 'active',
    progress: def.objectives.map(() => 0),
  }
}

/** Update progress for all active quests. Returns IDs of newly completed quests. */
export function tickQuestProgress(
  state: QuestState,
  inv: Inventory,
  flags: Record<string, boolean>,
  skills: SkillSet,
  spiritIndex: SpiritIndex,
  zoneId: string,
): string[] {
  const completed: string[] = []

  // Auto-start quests with autoStart flag
  for (const def of getAvailableQuests(state, flags)) {
    if (def.autoStart) startQuest(state, def.id)
  }

  // Update progress for active quests
  for (const id of QUEST_IDS) {
    const prog = state[id]
    if (!prog || prog.status !== 'active') continue
    const def = QUEST_DEFS[id]
    if (!def) continue

    let allDone = true
    for (let i = 0; i < def.objectives.length; i++) {
      const current = checkObjective(def.objectives[i], inv, flags, skills, spiritIndex, zoneId)
      const target = objectiveTarget(def.objectives[i])
      prog.progress[i] = Math.min(current, target)
      if (current < target) allDone = false
    }

    if (allDone) {
      prog.status = 'complete'
      completed.push(id)
    }
  }

  return completed
}

/** Grant rewards for a completed quest */
export function grantQuestRewards(
  questId: string,
  inv: Inventory,
  skills: SkillSet,
  flags: Record<string, boolean>,
): number {
  const def = QUEST_DEFS[questId]
  if (!def) return 0
  let marksEarned = 0

  for (const reward of def.rewards) {
    switch (reward.type) {
      case 'item':
        addItems(inv, reward.itemId, reward.count)
        break
      case 'marks':
        marksEarned += reward.amount
        break
      case 'xp': {
        const skill = skills[reward.skillId as SkillId]
        if (skill) addSkillXP(skill, reward.amount)
        break
      }
      case 'flag':
        flags[reward.flag] = true
        break
    }
  }

  return marksEarned
}

/** Get objective progress as fraction text (e.g., "3/10") */
export function objectiveProgressText(obj: QuestObjective, current: number): string {
  const target = objectiveTarget(obj)
  switch (obj.type) {
    case 'gather': return `${Math.min(current, target)}/${target}`
    case 'brew': return `${Math.min(current, target)}/${target}`
    case 'skill': return `${Math.min(current, target)}/${target}`
    default: return current >= target ? 'Done' : 'Incomplete'
  }
}

/** Get human-readable objective label */
export function objectiveLabel(obj: QuestObjective): string {
  switch (obj.type) {
    case 'gather': return obj.label ?? `Gather ${obj.count} ${obj.itemId.replace(/_/g, ' ')}`
    case 'study': return obj.species === 'any' ? 'Study a wild spirit' : `Study a ${speciesDisplayName(obj.species as Species)}`
    case 'talk': return `Talk to ${obj.npcId.replace(/_/g, ' ')}`
    case 'visit': return `Visit ${obj.zoneId.replace(/-/g, ' ')}`
    case 'brew': return `Brew ${obj.count} ${obj.potionId.replace(/_/g, ' ')}`
    case 'battle': return `Defeat ${obj.npcId.replace(/_/g, ' ')}`
    case 'flag': return obj.flag.replace(/_/g, ' ')
    case 'skill': return `Reach ${obj.skillId} level ${obj.level}`
  }
}

// ============================================
// Save/load
// ============================================

export interface QuestStateSave {
  quests: Record<string, { status: string; progress: number[] }>
}

export function questToSave(state: QuestState): QuestStateSave {
  return { quests: { ...state } }
}

export function questFromSave(saved: QuestStateSave): QuestState {
  const state: QuestState = {}
  for (const [id, data] of Object.entries(saved.quests)) {
    if (QUEST_DEFS[id]) {
      state[id] = { status: data.status as 'active' | 'complete', progress: [...data.progress] }
    }
  }
  return state
}
