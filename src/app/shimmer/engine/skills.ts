// Skill system — XP tracking, level progression, 6 skills
// Canon: shimmer-skilling.md — three bands: Content 1-15 (all content), Climb 15-100
// (grind to the true Mana'mal @100, as hard as old-99), Mastery 100-9999 (flat steady trickle)

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
export const MAX_LEVEL = 9999          // Mastery tail (was 99). Content by 15, true Mana'mal @100, endless to 9999.
export const MASTERY_START = 100       // at 100 the true canon Mana'mal unlocks; past here the curve goes flat

// XP-to-next-level. Two bands (canon: shimmer-skilling.md §The XP curve):
//  - L < 100: the old exponential — 100 ends up as hard to earn as the old level-99 cap (~14M total by 100).
//    (2^(L/7) is finite and well-behaved through the low hundreds; we never call it past 99.)
//  - L >= 100: FLAT per-level cost (steady trickle) — never steepens, never overflows, mastery runs to 9999.
// MASTERY_FLAT = the climb's final per-level cost, so the tail continues at that steady rate. Balance knob (Jin):
// lower it for a faster mastery trickle, raise it for a slower one. XP-per-action rates tune the felt pace.
export const MASTERY_FLAT = Math.floor((99 + 300 * Math.pow(2, 99 / 7)) / 4)   // ~1.36M XP/level

export function xpForSkillLevel(level: number): number {
  if (level >= MASTERY_START) return MASTERY_FLAT
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
