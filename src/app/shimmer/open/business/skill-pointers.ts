// ── SKILL POINTERS (BETA M6a/M6b, 11-17) ──────────────────────────────────────────────────────────────────────────
// A stranger had NO pointer to rinning or prospecting: the bag held the rinstick and bait, and a node's HUD prompt only
// showed once you stood at one. One journal line each (lark's, Alex approved 11-17), struck once the skill has been used.
// Canon nouns: rinstick/bait (shimmer-skilling.md), raw mana crystal (Skill 3), "passage" not "gate" (glossary).
import type { JournalEntry } from '../shared/journal'

export const RINNING_LINE = {
  title: 'Rin at the water',
  note: 'Cast your rinstick at a shore or pond in the Ather or the Wilds. Low on bait? Make more from a small catch, or from food shaken off a pruned tree.',
}
export const PROSPECTING_LINE = {
  title: 'Prospect a mana crystal',
  note: 'Raw mana crystals stand in the Wilds, through the passage on your plot. Hands free, press E on one.',
}

/** `used` = the skill has earned any xp (level above 1 or xp above 0). Struck lines stay as a record, like the errand. */
/** M22: a keeper without a rinstick yet is pointed at the Rinnshop instead (placeholder copy until @lark). */
export const RINNSHOP_LINE = {
  title: 'Build a Rinnshop',
  note: 'Your first rinstick is earned at a Rinnshop. Raise one on your plot from the planning table.',
}
export function skillPointerEntries(used: { rinning: boolean; prospecting: boolean }, stick = true): JournalEntry[] {
  return [
    stick ? { id: 'skill-rinning', hand: 'keeper', ...RINNING_LINE, where: null, struck: used.rinning } : { id: 'skill-rinning', hand: 'keeper', ...RINNSHOP_LINE, where: null },
    { id: 'skill-prospecting', hand: 'keeper', ...PROSPECTING_LINE, where: null, struck: used.prospecting },
  ]
}
