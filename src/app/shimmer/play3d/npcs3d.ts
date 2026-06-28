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
  requiredFlag?: string // save-flag that must be set before this NPC appears (gates the hold order)
}

export const NPCS_3D: NPC3D[] = [
  // Gregory — mentor keeper, stands by his house in Moonwell Glade (matches 2D npcs.ts placement).
  { id: 'gregory', name: 'Gregory', zone: 'moonwell-glade', tileX: 24, tileY: 18, color: '#caa46a', kind: 'keeper' },
  // Thistle — Hold 1. A borrowed-swagger Moglin in Spirit Meadows with a collared spirit. You free it
  // (a Reach battle), he deflates and retreats east. Removed from the world once freed.
  { id: 'thistle', name: 'Thistle', zone: 'spirit-meadow', tileX: 55, tileY: 30, color: '#9a6aaa', kind: 'moglin', defeatedFlag: 'freedThistle' },
  // Sorrel — Hold 2, the stronghold. Appears only after Thistle is freed (he fled here). Keeps TWO
  // collared spirits on the leash (canon), so freeing the hold means breaking the stronghold then
  // reaching BOTH captives. Deep in Mana Springs, up the misty climb. Removed once the hold clears.
  { id: 'sorrel', name: 'Sorrel', zone: 'mana-springs', tileX: 30, tileY: 25, color: '#7a5a3a', kind: 'moglin', requiredFlag: 'freedThistle', defeatedFlag: 'freedSorrel' },
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

// ── Sorrel (Hold 2 — the stronghold) — verbatim from CANON/game/shimmer-quests-mainmap.md, Beat 6. ──
// He keeps two on the leash and shelters the fled Thistle; tougher than Hold 1, name-drops Brack.
export const SORREL_PREFIGHT: string[] = [
  'So you are the one. The little keeper who put my brother Thistle to flight. He came scampering up here with his tail in a knot, going on about a sprout with muddy boots.',
  'I am not Thistle. Thistle is soft. I keep two friends on the leash, not one, and they mind me twice as well. You will not find me so easy to chase off.',
  'And even if you did? Even if? You would only be doing me a favor. Brack is up the road, keeper. Brack is the biggest of us, with more friends on more leashes than you can count. You think you are climbing toward something. You are climbing toward him.',
  'Go home. Go home while it is still your idea.',
]
// On defeat — the meanness drains out; he falls back up the road to Brack.
export const SORREL_DEFEAT: string[] = [
  'How. How are you still standing. That is not. You should not be able to do that.',
  'Fine. Fine! Sorrel knows when to fall back. Up the road I go, up to Brack, where it is safe, where you cannot follow without going through everything he has got.',
  'You will not climb that hill, keeper. Nobody climbs that hill. Brack will see to it.',
]
// Both collars snap at once when the stronghold falls.
export const FREED_PAIR_BEAT = 'Both collars drop at once. The two freed spirits drift apart from the leash, blinking, and go light again into the springs.'
