// NPCs for the 3D walker — minimal placement + dialogue data. The 2D game has a full NPC/dialogue
// engine (world/npcs.ts, dialogue-data.ts); the 3D walker only needs what the first quest uses, so this
// is a lean stand-in. Dialogue text is canon/voice (raven's lane) — kept here so it's easy to revise.

export interface NPC3D {
  id: string
  name: string
  zone: string
  tileX: number
  tileY: number
  color: string
}

// Gregory stands by his house in Moonwell Glade (same spot as the 2D npcs.ts placement).
export const NPCS_3D: NPC3D[] = [
  { id: 'gregory', name: 'Gregory', zone: 'moonwell-glade', tileX: 24, tileY: 18, color: '#caa46a' },
]

// Gregory's first-quest dialogue — the onboarding handoff (drafted by the raven agent in Greg's
// deep/warm/measured keeper voice). INTRO plays before the starter is granted; NUDGE right after.
export const GREG_INTRO_LINES: string[] = [
  'You found the glade. Good. Most folk walk right past it.',
  'But you have come empty-handed. No spirit at your side. That is no way for a Keeper to start.',
  'Hold still a moment. The Ather comes easier to a quiet hand.',
]
export const GREG_NUDGE = 'There. Young, curious, and yours now. Take it out to the mist past the well, where the wild ones drift, and let it learn what it is.'

// Once you already have a spirit, Greg just sends you off.
export const GREG_RETURN = 'Your spirit trusts you. That is what matters. The mist is waiting, Keeper.'
