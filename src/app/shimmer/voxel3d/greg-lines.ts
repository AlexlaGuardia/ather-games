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
  done: [
    "Night's coming down now. Feel that? Past the Glade the wilds go dark, and dark's not empty out there anymore.",
    "The watch's gone quiet. Drained ground grows things that only wear a shape after sundown. A tended light holds them off.",
    "Off you go, then. Keep your light close and your wits closer, and be home before the dark gets long. I'll leave the lamp on.",
  ],
} as const
