// NPCs for the 3D walker — minimal placement + dialogue data. The 2D game has a full NPC/dialogue
// engine (world/npcs.ts, dialogue-data.ts); the 3D walker only needs what the first quests use, so this
// is a lean stand-in. Dialogue text is canon/voice (raven's lane) — kept here so it's easy to revise.

export interface NPC3D {
  id: string
  name: string
  zone: string
  tileX: number
  tileY: number
  color: string
  kind: 'keeper' | 'moglin'
  defeatedFlag?: string // save-flag that, once set, removes this NPC from the world (e.g. a freed hold)
}

export const NPCS_3D: NPC3D[] = [
  // Gregory — mentor keeper, stands by his house in Moonwell Glade (matches 2D npcs.ts placement).
  { id: 'gregory', name: 'Gregory', zone: 'moonwell-glade', tileX: 24, tileY: 18, color: '#caa46a', kind: 'keeper' },
  // Thistle — Hold 1. A borrowed-swagger Moglin in Spirit Meadows with a collared spirit. You free it
  // (a Reach battle), he deflates and retreats east. Removed from the world once freed.
  { id: 'thistle', name: 'Thistle', zone: 'spirit-meadow', tileX: 55, tileY: 30, color: '#9a6aaa', kind: 'moglin', defeatedFlag: 'freedThistle' },
]

// ── Gregory's first-quest dialogue (raven-voiced, his deep/warm/measured keeper register). ──
export const GREG_INTRO_LINES: string[] = [
  'You found the glade. Good. Most folk walk right past it.',
  'But you have come empty-handed. No spirit at your side. That is no way for a Keeper to start.',
  'Hold still a moment. The Ather comes easier to a quiet hand.',
]
export const GREG_NUDGE = 'There. Young, curious, and yours now. Take it out past the well, to Spirit Meadows, where a Moglin named Thistle has been throwing his weight around.'
export const GREG_RETURN = 'Your spirit trusts you. That is what matters. Thistle is still out in the meadows, Keeper.'

// ── Thistle (Hold 1) — verbatim/near-verbatim from CANON/game/shimmer-quests-mainmap.md. ──
// No spirit yet → he just sneers and shoos you (go get your starter from Greg first).
export const THISTLE_TAUNT_NO_SPIRIT: string[] = [
  'Eyes front, little keeper. You are looking at Thistle, and this meadow is Thistle’s now. Mine. Every blade of it.',
  'See my friend here? See how it minds me? Bet you have not got one of these.',
  'Run along now. Shoo. This is no place for keepers with empty pots.',
]
// You have a bonded spirit → the pre-fight swagger, then the Reach battle.
export const THISTLE_PREFIGHT: string[] = [
  'You came back? You actually came back. With that little sprout at your heel?',
  'You think your sweet chosen friend is any match for mine? Mine does what it is told. Watch.',
  'Thistle does not lose his own meadow to a keeper with mud still on their boots. Come on then.',
]
// On defeat — the deflation beat, then he retreats east toward Sorrel.
export const THISTLE_DEFEAT: string[] = [
  'No. No, no, that is not how it goes. My friend never. You never.',
  'This is not over. Thistle just needs to be somewhere safer, is all. Somewhere with bigger friends.',
  'East. Sorrel will know what to do with the likes of you.',
]
export const FREED_SPIRIT_BEAT = 'The collar drops, useless. The freed spirit looks at you a long moment, then drifts back into the meadow, light again.'
