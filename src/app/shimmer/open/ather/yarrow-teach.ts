// ── YARROW'S BAIT TEACH BEAT + EXTRA BARKS (open world, the Glade) ────────────────────────────────────────────────────────
// @lark, SIGNED by Alex 2026-11-21 (athernyx b2facfe, CANON/game/yarrow-baitmaker-lines-script.md › B + C), VERBATIM.
// Build calls (hub 9bf57e68 #15615, design approved): <WRONG> = Mast, <RIGHT> = Bait (a true look-alike: a jar of each sits on
// the Rinnshop counter, glade-lots.ts, so "Point at the other jar." reads). Trigger = the first talk to Yarrow after the keeper
// has held a rinstick (Fennel's quest, rinquest.ts `stick`). Both answers reach the page (canon: noticing is seen, never
// required). The keeper keeps the Mast and gets a few Bait + the Bait Page (shared/inventory.ts › yarrowTeach).
// B line 2 = Yarrow's hello while the keeper carries a catch; B line 1 = a third repeat hello (after main, alt).
// Checks import these, never retype them.

export const WRONG = 'Mast', RIGHT = 'Bait'
const fill = (t: string) => t.replace(/<WRONG>/g, WRONG).replace(/<RIGHT>/g, RIGHT)

export const YARROW_TEACH = {
  open: { scene: "Yarrow looks at the keeper's rinstick, then turns to the jars without waiting to be asked.", line: 'A stick of your own now. Then it is today.' },
  hand: { scene: fill("Yarrow puts <WRONG> into the keeper's hand, steps back, and waits without saying anything.") },
  options: { pointed: 'Point at the other jar.', silent: 'Say nothing.' },
  pointed: 'You looked at the bait and not the jar. Good.',
  silent: 'Wrong one. Same look. A rinn would know.',
  page: {
    scene: fill("Yarrow sets <RIGHT> in the keeper's other hand, lays a folded page on top of it, and does not ask for the first one back."),
    lines: [fill('<RIGHT>. That is the one they come for. Make it just so.'), 'The page is yours. I said I would show you once, and that was once.'],
  },
} as const

export const YARROW_BARKS = {
  /** B line 1: a third repeat hello (idle near the jars) */
  jars: 'Look at the water, not at me. I stay dry.',
  /** B line 2: the hello while the keeper carries a catch */
  catch: 'Leave that with me. It will be ready before it is sorry.',
} as const

/** The (listen) answer that turns the beat's page. Build copy, Fennel's '(leave)' shape. */
export const LISTEN = '(listen)'
