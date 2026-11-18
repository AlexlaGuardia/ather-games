// THE FIRST RINSTICK IS EARNED (BETA M22, Alex 11-18 playtest: rinning is 'pretty hard (which is a good thing) but there
// should definitely be a side mission to unlock the default fishing rod.. maybe crafting the fishing room starts this side
// quest'). A keeper born after M22 has NO worn rinstick; the Rinnshop standing starts a side quest (a journal line per step);
// its last step puts the worn rinstick in hand. Keepers who played before M22 keep theirs (never take a tool off a live save).
//
// ⚠ CANON PENDING: WHO gives/teaches the first rinstick and the real STEPS are Magii's (skilling.md: 'Greg's worn starters',
// 'rinsticks are built from rinn'); every player line is @lark's. Until then RINQUEST_STEPS is ONE placeholder step done at
// the Rinnshop bench. Swapping the ruling in = edit RINQUEST_STEPS (+ an `at` kind for a talk). Pure; saved per keeper.

import type { JournalEntry } from '../shared/journal'

export type QuestState = 'none' | 'active' | 'done'
export interface RinQuest { v: 1; state: QuestState; step: number }
export const RINQUEST_KEY = 'open.rinquest.v1'

/** where a step is done: 'rinnshop' = a button on the Rinnshop bench panel */
export type StepAt = 'rinnshop'
export interface QuestStep { id: string; title: string; note: string; at: StepAt; button: string }
// ⚠ PLACEHOLDER COPY + STEPS (Magii rules who/what, lark writes the words, Alex signs)
export const RINQUEST_STEPS: readonly QuestStep[] = [
  { id: 'ask', title: 'Ask about a rinstick', note: 'Your Rinnshop stands. Ask at its bench how a first rinstick is made.', at: 'rinnshop', button: 'Ask about a rinstick' },
]
export const RINQUEST_LINES = {
  noShop: 'You have no rinstick. Build a Rinnshop on your plot to earn your first.',
  started: 'Your Rinnshop stands. Ask at its bench about a rinstick.',
  inQuest: 'You have no rinstick yet. See your journal: the Rinnshop.',
  got: 'A worn rinstick, yours. Hold bait at the water to cast.',
}

export const fresh = (): RinQuest => ({ v: 1, state: 'none', step: 0 })
export const hasStick = (q: RinQuest) => q.state === 'done'

/** The saved quest, or (no flag) a keeper BORN BEFORE M22 = done, keeping the worn rinstick. A keeper born after M22 never
 *  has no flag: the birth gate writes `fresh()` the moment the rune is chosen (hub 11-18: the bag saves within seconds of a
 *  birth, so 'has a saved bag' cannot tell old from new; the birth can). */
export function migrate(saved: unknown): RinQuest {
  const q = saved as RinQuest | null
  if (q && q.v === 1 && (q.state === 'none' || q.state === 'active' || q.state === 'done') && Number.isInteger(q.step) && q.step >= 0)
    return { v: 1, state: q.state, step: Math.min(q.step, RINQUEST_STEPS.length) }
  return { v: 1, state: 'done', step: RINQUEST_STEPS.length }
}

/** The Rinnshop standing (raised) starts the quest; nothing else changes the state here. */
export const onShop = (q: RinQuest, shopRaised: boolean): RinQuest => (q.state === 'none' && shopRaised ? { ...q, state: 'active', step: 0 } : q)

export const currentStep = (q: RinQuest): QuestStep | null => (q.state === 'active' ? RINQUEST_STEPS[q.step] ?? null : null)

/** Do a step where it is done. Wrong place / not the current step = unchanged. The last step = done (grant the stick). */
export function doStep(q: RinQuest, at: StepAt): { q: RinQuest; granted: boolean } {
  const s = currentStep(q)
  if (!s || s.at !== at) return { q, granted: false }
  const step = q.step + 1
  return step >= RINQUEST_STEPS.length ? { q: { v: 1, state: 'done', step }, granted: true } : { q: { ...q, step }, granted: false }
}

/** What a keeper with bait at the water but no rinstick is told. */
export const noStickLine = (q: RinQuest) => (q.state === 'active' ? RINQUEST_LINES.inQuest : RINQUEST_LINES.noShop)

/** The journal: the open step (keeper's hand), or the done record struck; nothing before the Rinnshop stands (the rinning
 *  pointer says 'build a Rinnshop' then, skill-pointers.ts). */
export function questEntries(q: RinQuest): JournalEntry[] {
  if (q.state === 'none') return []
  const s = currentStep(q)
  if (s) return [{ id: 'rinquest', hand: 'keeper', title: s.title, note: s.note, where: null }]
  return [{ id: 'rinquest', hand: 'keeper', title: 'A rinstick of your own', note: 'Earned at your Rinnshop.', where: null, struck: true }]
}
