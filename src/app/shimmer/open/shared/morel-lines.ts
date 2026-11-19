// ── MOREL'S LINES (BETA M33) ─────────────────────────────────────────────────────────────────────────────────────────────
// ⚠ PLACEHOLDERS, UNSIGNED. Every line Morel says is lark's to write (CANON world/network.md › The gem and Morel: "Lark's:
// Morel's lines") and Alex's to sign. These hold the slots so the timing can be built and tested; the set was asked of
// @lark via Magii 11-19. Swap the strings, keep the keys. `SIGNED` flips to true only when Alex signs the set.
export const SIGNED = false

export const MOREL_AMMO = {
  low: 'Seven left in the clip.',
  empty: 'Dry. Reload.',
} as const

/** S2 stuck hints: two per errand stage (the first on the first stall, the other on the next). */
export const MOREL_HINTS = {
  greg: ['Gregory is on the bench by the pool. Walk up and say hello.', 'Gregory by the Moonwell has your first letter.'],
  smith: ['Your letter is cut at your birth school. Through the gate, then the runesmith.', 'The runesmith cuts the letter. The journal shows the way.'],
  temple: ['The cut letter goes to the Enchant Temple in the Citadel.', 'Idony at the Temple sets your letter in the bracelet.'],
} as const
