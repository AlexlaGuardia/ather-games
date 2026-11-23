// ── KAEL'S INVITE (BETA M73) ───────────────────────────────────────────────────────────────────────────────────────────
// ★ SIGNED (Alex 11-22, "lets go with your call"): CANON/game/kael-invite-script.md › MAIN, word for word. The item name and the
// description are the script's "For Jin" lines. Render as handwriting, one block, no choices. "Keeper —" stays (never gendered).
// The chain it starts: opening-chain.ts. Test: business/signed-lines-m73.test.ts reads the canon file.

export const KAEL_INVITE_NAME = 'a note from Kael'
export const KAEL_INVITE_BLURB = "Folded small. Kael's hand."

/** The note, one paragraph per entry (the script's blank-line breaks). */
export const KAEL_INVITE_TEXT: readonly string[] = [
  'Keeper —',
  'Come see me sometime. No hurry.',
  "Take the road up out of Rune Hold, the one over the mountain. My yard's up top, right by the road. You'll know it by the ship I'm forever tinkering with.",
  "Kettle's always on.",
  '— Kael',
]
