// Skill system — XP tracking, level progression, 6 skills
// Canon: shimmer-skilling.md — Levels 1-10 unlock all content, 11-99 is prestige

export type SkillId = 'farming' | 'forestry' | 'prospecting' | 'rinning' | 'alchemy' | 'mana'

export interface Skill {
  id: SkillId
  level: number       // 1-99
  xp: number          // current XP toward next level
}

export interface SkillSet {
  farming: Skill
  forestry: Skill
  prospecting: Skill
  rinning: Skill
  alchemy: Skill
  mana: Skill
}

// Skill metadata (display names, mana costs per action)
export const SKILL_META: Record<SkillId, { name: string; manaCost: number; locked?: string }> = {
  farming:     { name: 'Farming',     manaCost: 3 },
  forestry:    { name: 'Forestry',    manaCost: 5 },
  prospecting: { name: 'Prospecting', manaCost: 7 },
  rinning:     { name: 'Rinning',     manaCost: 4 },
  alchemy:     { name: 'Alchemy',     manaCost: 3 },
  mana:        { name: 'Mana',        manaCost: 0 },  // passive — no direct cost
}

export const SKILL_IDS: SkillId[] = ['farming', 'forestry', 'prospecting', 'rinning', 'alchemy', 'mana']
export const MAX_LEVEL = 99

// Canon XP formula: floor((L + 300 * 2^(L/7)) / 4)
// Level 92 is roughly the halfway point in total XP to 99
// Total XP for 99: ~13,000,000
export function xpForSkillLevel(level: number): number {
  return Math.floor((level + 300 * Math.pow(2, level / 7)) / 4)
}

/** Create a fresh skill at level 1 */
function createSkill(id: SkillId): Skill {
  return { id, level: 1, xp: 0 }
}

/** Create a full fresh skill set — all skills start at level 1 */
export function createSkillSet(): SkillSet {
  return {
    farming: createSkill('farming'),
    forestry: createSkill('forestry'),
    prospecting: createSkill('prospecting'),
    rinning: createSkill('rinning'),
    alchemy: createSkill('alchemy'),
    mana: createSkill('mana'),
  }
}

export interface SkillXPResult {
  leveled: boolean
  newLevel: number
}

/** Add XP to a skill and handle level-ups. Returns whether a level-up occurred. */
export function addSkillXP(skill: Skill, amount: number): SkillXPResult {
  let leveled = false
  skill.xp += amount

  while (skill.level < MAX_LEVEL) {
    const needed = xpForSkillLevel(skill.level)
    if (skill.xp >= needed) {
      skill.xp -= needed
      skill.level++
      leveled = true
    } else {
      break
    }
  }

  if (skill.level >= MAX_LEVEL) {
    skill.xp = 0  // cap at 99
  }

  return { leveled, newLevel: skill.level }
}

// Milestone titles — earned at specific levels (cosmetic only)
export const SKILL_MILESTONES: { level: number; label: string }[] = [
  { level: 25, label: 'Apprentice' },
  { level: 50, label: 'Journeyman' },
  { level: 75, label: 'Master' },
  { level: 99, label: 'Grandmaster' },
]

/** Get the highest milestone title earned for a skill level */
export function getMilestone(level: number): string | null {
  for (let i = SKILL_MILESTONES.length - 1; i >= 0; i--) {
    if (level >= SKILL_MILESTONES[i].level) return SKILL_MILESTONES[i].label
  }
  return null
}

// Save/load — minimal serializable format
export interface SkillSave {
  id: SkillId
  level: number
  xp: number
}

export function skillSetToSave(skills: SkillSet): SkillSave[] {
  return SKILL_IDS.map(id => ({ id, level: skills[id].level, xp: skills[id].xp }))
}

export function skillSetFromSave(saves: SkillSave[]): SkillSet {
  const skills = createSkillSet()
  for (const s of saves) {
    if (skills[s.id]) {
      skills[s.id].level = s.level ?? 1
      skills[s.id].xp = s.xp ?? 0
    }
  }
  return skills
}
