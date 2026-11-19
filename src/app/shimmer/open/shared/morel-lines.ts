// ── MOREL'S LINES (BETA M33) ─────────────────────────────────────────────────────────────────────────────────────────────
// ⚠ UNSIGNED: lark's draft, athernyx 19f9a46 (CANON/game/morel-lines-script.md), keyed MOREL_AMMO / MOREL_HINT / MOREL_PING
// there; awaiting Alex's sign-off. Register (Magii): plain, brief, warm, earthy, never says its own name, never commands.
// Every line Morel says is lark's to write (CANON world/network.md › The gem and Morel) and Alex's to sign. `SIGNED` flips
// to true only when Alex signs the set.
export const SIGNED = false

export const MOREL_AMMO = {
  low: 'Seven left in the clip.',
  empty: 'Empty. Reload when you can.',
} as const

/** S2 stuck hints: two per errand stage (MOREL_HINT.<stage>1 on the first stall, <stage>2 on the next). */
export const MOREL_HINTS = {
  greg: ['Most keepers start by talking to Gregory. He is right by the Glade.', 'Gregory has something for you. Go and stand near him.'],
  smith: ['Others took their letter to the runesmith at their birth school.', 'The runesmith cuts your letter. Take it there and wait.'],
  temple: ['Keepers say Idony finishes the bracelet at the Enchant Temple.', 'Leave the bracelet on her bench and wait. She does not like being rushed.'],
} as const

/** S3 folk pings: Morel REPORTS a call, never quotes it (lark: Fennel's own voice waits for the meeting). */
export const MOREL_PING = {
  fennel_rinstick: 'Fennel says come by when you have a minute.',
} as const
