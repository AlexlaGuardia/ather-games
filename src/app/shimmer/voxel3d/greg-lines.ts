// Gregory's post-tutorial dialogue for the Shimmer voxel world — the fold-widening talk.
// Voice: Spirit Tales register: warm, plain, a little wry, no em dashes, no semicolons.
// Canon: spirit-tales-bible.md (Gregory, Moonwell Glade), game/shimmer-geography.md (the grimoire
// is what Greg reads).
//
// ★ THE TUTORIAL LINES THAT LIVED HERE (greet/cut/planks/lantern/light/done) ARE GONE (2026-09-15).
// They were raven placeholders; the Glade's script is now LOCKED canon (Beat 0½, Lark + Alex) and
// is transcribed verbatim in `folk-lines.ts`. Only the fold talk, which canon has not scripted,
// stays written here.

export const GREG_LINES = {
  /**
   * ── ★★ THE FOLD WIDENS — canon's own ceremony, not a shop counter (2026-08-18) ────────────────
   * `game/shimmer-geography.md` › *THE GRIMOIRE IS WHAT GREG READS*: **nothing is bought.** He is
   * *"rewarding his own life's work"*, the grimoire is his life's work, and *"the book is how he
   * sees they are ready."* So no line here may name a price, quote a cost, or thank the keeper for
   * paying. He asks to see the book, he reads it, and he does the thing only he can do.
   *
   * ⚠ AND HE NEVER TAKES THE BOOK'S CREDIT. Canon has him spreading the grimoire keeper-to-keeper
   * precisely so it stops living *"in one book, in one garden"* — the widening is him being proved
   * right, which is why the warm line is about the keeper having been OUT there rather than about
   * his own generosity.
   *
   * Three states, because the counter nobody could read is what the ruling called out as missing:
   * `foldReady` (owed one now), `foldWaiting` (how far off), `foldTop` (nothing left to give, and
   * canon's long arc says what comes after — the keeper eventually folds their own).
   */
  foldReady: [
    "Come here a moment, let me see that book of yours.",
    "Mm. You have been further than you let on, and you have been paying attention. That is the whole of it, you know. Not what you have got, what you have come to know.",
    "Hold still. This part is mine to do, and there is not much of it left in these old hands.",
  ],
  foldWaiting: [
    "Let me see the book, love. Go on.",
    "Not yet. Close, mind you, but not yet.",
    "Go and meet something you have not met, or free something that is not free. Either one writes a line in there, and the ground follows the lines.",
  ],
  foldTop: [
    "That is the book as full as I have ever seen it, and I have seen a few.",
    "There is no more folding in me for you. What you have is what I have got.",
    "When you take up Enchant, and one day you will, there is a thing at the end of it called Gate. Bind two points and step through. Fold your own, love. That is how it is meant to go.",
  ],
} as const
