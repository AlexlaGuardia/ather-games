// ── HOLLIS, THE MANATECH SHOP IN RUNE HOLD + KAEL'S LEDGER, STAGE 1 (BETA M108 repair stage 1) ─────────────────────────────
// ★ SIGNED (Alex 11-15, athernyx CANON/game/ather-opening-chain-script.md › Unit 2 page one + Unit 3, "Ships as written";
// the SHOPKEEPER label may read HOLLIS, filled 11-18, glossary.md › Hollis). Word for word; the test diffs these against the
// canon file: business/signed-lines-m108.test.ts. Anything NOT here that the player reads (the price chip, the Pay answer,
// the "fitted" toast) is a FUNCTIONAL label in ship-repair.ts, listed for @lark, never lore.

export const HOLLIS_NAME = 'Hollis'

/** Kael's ledger, page one: the one OPEN line (stage 1) and its margin */
export const LEDGER_CELL_LINE = "Cell housing. Old one's cracked. New one from the manatech shop, Rune Hold. Take the page."
export const LEDGER_CELL_MARGIN = "It'll cost. Everything worth having does."
/** the keeper's entries beneath Kael's: the first, then (once the quote fires) the second replaces it */
export const ENTRY_TAKE_PAGE = 'Take Kael\'s page to the manatech shop in Rune Hold.'
export const ENTRY_EARN_MARKS = 'Earn the Marks for the cell housing. Veyra might know how.'

/** Unit 3, shop:first + shop:quote, in order. `scene` = the script's [SCENE:] box shown above the line. */
export const HOLLIS_FIRST: readonly { line: string; scene?: string }[] = [
  { scene: 'A counter crowded with half-built things. Someone bent over a casing, a lens screwed into one eye.', line: 'Parts, machines, whatever you can draw. If you can pay for it, I can build it.' },
  { scene: "The keeper sets Kael's page on the counter. The shopkeeper reads it, then reads it again.", line: 'Cell housing, to these measures. Whoever wrote this knew exactly what they wanted.' },
  { line: "I can make it. It won't be cheap." },
]
export const HOLLIS_QUOTE: readonly { line: string }[] = [
  { line: "That's the price. No credit." },
  { line: "The page keeps. Come back when you've got the Marks." },
]
export const HOLLIS_BARK = {
  short: "Got the Marks? No? Then I've got work to do.",
  materials: 'Some jobs need materials I can\'t get. Bring them, and we talk.',
  ambient: "Don't touch that. It's still hot.",
} as const
