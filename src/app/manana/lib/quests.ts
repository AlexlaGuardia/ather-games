// MANA'NANA quests — the objective ladder that gives the score-attack a spine.
// A linear run of element-themed levels; each has a goal + a move budget. Clear it,
// advance. Pure + deterministic: goal progress is derived from resolve() steps, so
// the whole engine is testable without the DOM. UI lives in page.tsx.

import type { ResolveStep } from './match3'

// colour id -> canon element name. MUST match the PIECES order in page.tsx
// (0 Storm · 1 Water · 2 Mana · 3 Earth · 4 Love · 5 Ather).
export const ELEMENT = ['Storm', 'Water', 'Mana', 'Earth', 'Love', 'Ather'] as const

export type GoalKind =
  | 'score' // reach a score
  | 'collect' // clear N gems of one element (goal.color)
  | 'puffs' // clear N cloud-puffs
  | 'bloom' // bloom N specials (surge/prism/star)
  | 'free' // snap N collars (free N collared orbs)

export interface Goal {
  kind: GoalKind
  target: number
  color?: number // for 'collect'
}

export interface Level {
  id: number
  name: string
  blurb: string
  goal: Goal
  moves: number
  puffs: number // cloud-puffs seeded at board start
  collars?: number // collared orbs seeded at board start
}

// the ladder — element-themed, escalating. collect colours cycle the elements,
// puff + bloom + score levels break the rhythm.
export const LEVELS: Level[] = [
  { id: 1, name: 'Still Waters', blurb: 'the pool wakes', goal: { kind: 'collect', target: 22, color: 1 }, moves: 14, puffs: 2 },
  { id: 2, name: 'Gathering Storm', blurb: 'the sky stirs', goal: { kind: 'collect', target: 24, color: 0 }, moves: 14, puffs: 2 },
  { id: 3, name: 'Deep Roots', blurb: 'the ground answers', goal: { kind: 'collect', target: 26, color: 3 }, moves: 13, puffs: 3 },
  { id: 4, name: 'Clear Skies', blurb: 'scatter the clouds', goal: { kind: 'puffs', target: 6 }, moves: 12, puffs: 6 },
  { id: 5, name: 'Wild Mana', blurb: 'the raw current', goal: { kind: 'collect', target: 28, color: 2 }, moves: 13, puffs: 3 },
  { id: 6, name: 'First Bloom', blurb: 'forge the specials', goal: { kind: 'bloom', target: 3 }, moves: 15, puffs: 2 },
  { id: 7, name: 'Snap the Collar', blurb: 'free the caught', goal: { kind: 'free', target: 5 }, moves: 14, puffs: 1, collars: 5 },
  { id: 8, name: "Heart's Match", blurb: 'the warm colour', goal: { kind: 'collect', target: 30, color: 4 }, moves: 14, puffs: 3 },
  { id: 9, name: 'Ather Rising', blurb: 'the raw substance', goal: { kind: 'score', target: 2000 }, moves: 16, puffs: 3 },
  { id: 10, name: 'Stormfront', blurb: 'the sky breaks', goal: { kind: 'collect', target: 34, color: 0 }, moves: 13, puffs: 4 },
  { id: 11, name: 'The Warren', blurb: 'free the whole hold', goal: { kind: 'free', target: 8 }, moves: 15, puffs: 2, collars: 8 },
  { id: 12, name: 'Cloudbreak', blurb: 'the great overcast', goal: { kind: 'puffs', target: 9 }, moves: 12, puffs: 9 },
  { id: 13, name: 'Twin Blooms', blurb: 'forge and combine', goal: { kind: 'bloom', target: 5 }, moves: 16, puffs: 3 },
  { id: 14, name: 'The Deep', blurb: 'as far as it goes', goal: { kind: 'score', target: 6000 }, moves: 18, puffs: 4 },
]

export const levelAt = (i: number): Level => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i))]
export const isLastLevel = (i: number) => i >= LEVELS.length - 1

// advance goal progress by one resolve step. Score goals track externally
// (the running score is the progress), so they return `got` unchanged here.
export function trackStep(got: number, goal: Goal, step: ResolveStep): number {
  switch (goal.kind) {
    case 'collect':
      return got + (goal.color != null ? step.colorCounts[goal.color] ?? 0 : 0)
    case 'bloom':
      return got + step.spawned.length
    case 'puffs':
      return got + step.puffs
    case 'free':
      return got + step.freed
    case 'score':
      return got
  }
}

// how far along the goal is (for the HUD). score reads the running score.
export const goalProgress = (got: number, goal: Goal, score: number): number =>
  goal.kind === 'score' ? Math.min(score, goal.target) : Math.min(got, goal.target)

export const goalMet = (got: number, goal: Goal, score: number): boolean =>
  goalProgress(got, goal, score) >= goal.target

// short HUD label, e.g. "Clear 22 Water" / "Reach 3500" / "Bloom 3 specials"
export function goalLabel(goal: Goal): string {
  switch (goal.kind) {
    case 'score':
      return `Reach ${goal.target}`
    case 'collect':
      return `Clear ${goal.target} ${ELEMENT[goal.color ?? 5]}`
    case 'puffs':
      return `Scatter ${goal.target} clouds`
    case 'bloom':
      return `Bloom ${goal.target} specials`
    case 'free':
      return `Free ${goal.target} collared orbs`
  }
}
