// Gregory's tutorial dialogue for the Shimmer voxel world (Moonwell Glade onboarding).
// Voice: Spirit Tales register: warm, plain, a little wry, no em dashes, no semicolons.
// Canon: spirit-tales-bible.md (Gregory, Moonwell Glade), world/lucernyx.md (the watch missing,
// the aegis lapsed, tended light holds grey off), voxel/recipes.ts + registry.ts (raw_mana_shard,
// goldwood_log/plank, mana_lantern: build-side item names, used as-is, nothing renamed).

export const GREG_LINES = {
  greet: [
    "Well, here you are. Welcome to Moonwell Glade. Creaky old place, but it's home, and it's yours too now.",
    "Hold out your hand a moment. There. A shard of raw mana, warm as a held coin. Keep that close.",
    "Those trees yonder won't mind a visit. You'll want wood before you want anything else.",
  ],
  cut: [
    "Hold your blade toward the trunk and let it work. You don't swing it, love, you channel it.",
    "Easy does it. A tree gives back what it can spare, and no more than that.",
    "Good. Keep at it. A log or two will see you through for today.",
  ],
  planks: [
    "Split that log down and it comes apart into planks, neat as you like.",
    "There. Wood in hand, ready for building. Simple work, honest work.",
  ],
  lantern: [
    "Now. Set that shard beside two planks and see what comes of it.",
    "A lantern. Small thing to carry, but out here it matters more than you'd think.",
    "Light isn't only for seeing by. Past the tended ground, it's what keeps the grey from taking hold.",
  ],
  light: [
    "Set it down. Go on, right there in the dirt.",
    "Watch the ground around it. See how it settles? That's the light doing its work.",
    "Tended ground remembers a lantern. It'll keep that patch safe long after you've walked on.",
  ],
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
  done: [
    "Night's coming down now. Feel that? Past the Glade the wilds go dark, and dark's not empty out there anymore.",
    "The watch's gone quiet. Drained ground grows things that only wear a shape after sundown. A tended light holds them off.",
    "Off you go, then. Keep your light close and your wits closer, and be home before the dark gets long. I'll leave the lamp on.",
  ],
} as const
