// ── KAEL'S JOURNAL PAGE (BETA M73 s3) ─────────────────────────────────────────────────────────────────────────────────────
// ★ SIGNED (Alex 11-22, "yea go with the main"): CANON/game/kael-journal-page-script.md › MAIN, word for word (athernyx b317812).
// Item name + description = the script's "For Jin" lines. Render as handwriting, one block, no choices; not addressed to the
// keeper. FOUND AT THE YARD (the ruling; the script's "in the keeper's pack from the start" line is stale, Magii told).
// The chain: opening-chain.ts (KAEL_PAGE). Test: business/signed-lines-m73.test.ts reads the canon file.

export const KAEL_PAGE_NAME = 'a journal page'
export const KAEL_PAGE_BLURB = "A page torn loose from a journal. Kael's hand."

/** The page, one paragraph per entry (the script's blank-line breaks). */
export const KAEL_PAGE_TEXT: readonly string[] = [
  "Heard something at the Fallen Cap tonight. Something out there. The man telling it wasn't selling anything, which is how I know to listen.",
  "More honey capale than I'll admit to. I can't help it. Nothing else on that board I'd order, but they pour it right.",
  "The dig can wait a few days. I'll ask Veyra to come. She'll say no. Ask anyway. Maybe, for once, she won't.",
]
