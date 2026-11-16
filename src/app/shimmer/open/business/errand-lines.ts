// THE FIRST ERRAND'S LINES, verbatim from @lark, SIGNED by Alex 2026-11-16 ("approved").
// Source of truth: /root/athernyx/CANON/game/first-errand-citadel-script.md (athernyx cf24417, signed c7265ea).
// ★ Do not edit a line here; change it in the script and copy it across. Slots: {school} {seat} {word}.
//   {seat} carries its own article where it needs one (lark's note 5): letters.ts SEATS.where / SEATS.short.
// ★ Registers (lark): Greg in the Ather = cozy, no em dashes, no semicolons. Idony in the Citadel = the waking world,
//   em dashes as heartbeat (2, on purpose).

/** Greg's send-off at his ground panel (trigger greg:errand, once) */
export const gregSendOff = (school: string, seat: string, citadel: boolean): string[] => citadel
  ? ['Now then. A Blankstone, and the gems to go on it.', 'Cutting it is a runesmith\'s trade, not mine. Yours keeps shop in the Citadel.', 'The Enchant Temple finishes the bracelet there. Do not rush anyone.', 'Blue and I will keep.']
  : ['Now then. A Blankstone, and the gems to go on it.', `Cutting it is a runesmith's trade, not mine. Yours is the ${school} runesmith, at ${seat}.`, 'Then the Enchant Temple, in the Citadel. They finish the bracelet there.', 'Do not rush anyone. Blue and I will keep.']
/** if spoken to again before going (trigger greg:bark:errand) */
export const gregRepeat = (seat: string) => `${seat[0].toUpperCase()}${seat.slice(1)} first, Keeper, then the Citadel. Blue and I will keep.`
/** the runesmith, on the cut (trigger runesmith:cut; unnamed, no lore) */
export const RUNESMITH_CUT = 'Set it down. I\'ll cut it.'

/** Idony's imbue beat (Citadel). `first` = the keeper's first letter in Greg's bracelet (the bench line is about that). */
export interface Beat { scene?: string; idony?: string; keeper?: string }
export const idonyBeat = (word: string, first: boolean): Beat[] => [
  { scene: 'She does not look up. She finishes the stitch first.', idony: 'On the bench. Say nothing yet.' },
  ...(first ? [{ scene: 'Her hand stops above the bracelet before it touches it.', idony: 'That first letter is yours — it could be nobody else\'s.' }] : []),
  { scene: 'One seat left. Her hands stop with the cord half over it.', idony: 'Now you speak. Say it after me, to the bracelet.' },
  { idony: `${word}.`, keeper: `${word}.` },
  { scene: 'The cord closes over the last stone. Light runs out of the seats and around the braid, end to end.', idony: 'There — written. It was only ever waiting on you.' },
]
export const IDONY_HUSH = 'Not while I work.'
export const IDONY_AFTER = 'You wait well. Most who come in here do not.'

/** the keeper's journal, one line per stage (lark's table) */
export const journalSmith = (seatShort: string, school: string, seat: string) => ({ title: `Go to the ${seatShort} runesmith`, note: `Greg gave you a Blankstone and gems; the ${school} runesmith at ${seat} cuts the letter.` })
export const JOURNAL_TEMPLE = { title: 'Go to the Enchant Temple in the Citadel', note: 'Take the bracelet and the cut letter to the imbuer.' }
export const journalDone = (word: string) => ({ title: 'A Lit Bracelet', note: `The bracelet is lit, and its word is ${word}.` })
