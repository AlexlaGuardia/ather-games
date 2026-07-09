// Mana'mal companion system — rare followers earned through gameplay
// Canon: descendants of Spirits who mutated long ago, live in symbiosis with the Network
// 5 mana'mals, single form each, 8-directional followers (spirits are battle-only)
// Care system: happiness, hunger, bond → species perks that buff gameplay

import type { SkillId, SkillSet } from '../engine/skills'
import type { Direction } from '../spirits/spirit'
import type { FollowerAnimState, FollowerMovementStyle } from '../spirits/ai'
import { DEFAULT_FOLLOWER_MOVEMENT } from '../spirits/ai'
import type { MovementPhase } from '../engine/player'

export type BeastSpecies = 'drifthorn' | 'dustwhisker' | 'sporeling' | 'glowmite' | 'embermole'

export const BEAST_SPECIES: BeastSpecies[] = ['drifthorn', 'dustwhisker', 'sporeling', 'glowmite', 'embermole']

export interface BeastDef {
  id: BeastSpecies
  name: string
  description: string
  unlockType: 'skill' | 'admin' | 'endgame'
  unlockSkill?: SkillId
  unlockLevel?: number
}

export const BEAST_DEFS: Record<BeastSpecies, BeastDef> = {
  drifthorn: {
    id: 'drifthorn',
    name: 'Drifthorn',
    description: 'Antler tips glow with faint mana mist. Walks the Eastern Forests, where Rootback sleeps.',
    unlockType: 'skill',
    unlockSkill: 'forestry',
    unlockLevel: 15,
  },
  dustwhisker: {
    id: 'dustwhisker',
    name: 'Dustwhisker',
    description: 'Iridescent fur that shimmers in the light. Responsive to mood.',
    unlockType: 'skill',
    unlockSkill: 'farming',
    unlockLevel: 15,
  },
  sporeling: {
    id: 'sporeling',
    name: 'Sporeling',
    description: 'A mobile fungi that follows people out of shroom groves. Unclear if pet or parasite.',
    unlockType: 'skill',
    unlockSkill: 'alchemy',
    unlockLevel: 15,
  },
  glowmite: {
    id: 'glowmite',
    name: 'Glowmite',
    description: 'Bioluminescent swarm whose patterns seem like language.',
    unlockType: 'skill',
    unlockSkill: 'prospecting',
    unlockLevel: 15,
  },
  embermole: {
    id: 'embermole',
    name: 'Embermole',
    description: 'Fur radiates warmth. Too small, too warm, too loved to eat.',
    unlockType: 'skill',
    unlockSkill: 'rinning',
    unlockLevel: 15,
  },
}

// ManaBeast (Mana'mal) matches the Followable shape from ai.ts
export interface ManaBeast {
  id: string
  species: BeastSpecies
  name: string
  x: number
  y: number
  targetX: number | null
  targetY: number | null
  direction: Direction
  animFrame: number
  animTimer: number
  animState: FollowerAnimState     // velocity-driven animation state
  speed: number                    // current speed in px/tick
  movementStyle: FollowerMovementStyle
  blinkTimer: number
  state: 'idle' | 'wander' | 'pet' | 'happy' | 'eat' | 'sleep'
  stateTimer: number
  followQueue: { x: number; y: number }[]
  followGoal: { x: number; y: number } | null
  // Staged movement phases (mirrors player system)
  movementPhase: MovementPhase
  phaseAnimDone: boolean
  pathLength: number
  tilesWalked: number
  specialUsed: boolean

  // Care stats
  happiness: number    // 0-100, decays 1/5min (doubles when hungry)
  hunger: number       // 0-100, decays 1/3min
  bond: number         // 0-100, grows from feeding/petting/adventuring, never decays
}

let beastIdCounter = 0

/** Per-species movement styles — each mana'mal moves differently */
const BEAST_MOVEMENT_STYLES: Partial<Record<BeastSpecies, FollowerMovementStyle>> = {
  drifthorn:   { walkSpeed: 2.5, catchupSpeed: 4,   catchupDistance: 4, longPathThreshold: 5, specialThreshold: 7, endRunTiles: 2 },  // graceful, fast when needed
  dustwhisker: { walkSpeed: 2,   catchupSpeed: 3.5, catchupDistance: 3, longPathThreshold: 6, specialThreshold: 9, endRunTiles: 2 },  // cautious, stays close
  sporeling:   { walkSpeed: 1.5, catchupSpeed: 3,   catchupDistance: 5, longPathThreshold: 7, specialThreshold: 10, endRunTiles: 3 }, // slow waddle, patient
  glowmite:    { walkSpeed: 2,   catchupSpeed: 4,   catchupDistance: 4, longPathThreshold: 5, specialThreshold: 7, endRunTiles: 2 },  // hovering, smooth
  embermole:   { walkSpeed: 1.8, catchupSpeed: 3.5, catchupDistance: 3, longPathThreshold: 6, specialThreshold: 8, endRunTiles: 2 },  // waddly, eager to catch up
}

export function createBeast(species: BeastSpecies, x: number, y: number, style?: FollowerMovementStyle): ManaBeast {
  return {
    id: `beast-${species}-${++beastIdCounter}`,
    species,
    name: BEAST_DEFS[species].name,
    x, y,
    targetX: null, targetY: null,
    direction: 'down',
    animFrame: 0, animTimer: 0,
    animState: 'idle',
    speed: 0,
    movementStyle: style ?? BEAST_MOVEMENT_STYLES[species] ?? DEFAULT_FOLLOWER_MOVEMENT,
    blinkTimer: 60,
    state: 'idle',
    stateTimer: 0,
    followQueue: [],
    followGoal: null,
    movementPhase: 'idle' as MovementPhase,
    phaseAnimDone: false,
    pathLength: 0,
    tilesWalked: 0,
    specialUsed: false,
    happiness: 70,
    hunger: 80,
    bond: 0,
  }
}

/** Check if a beast should unlock based on skills and flags */
export function checkBeastUnlock(species: BeastSpecies, skills: SkillSet, flags: Record<string, boolean>): boolean {
  const def = BEAST_DEFS[species]
  if (def.unlockType === 'admin') return !!flags['admin_beast']
  if (def.unlockType === 'endgame') return !!flags['game_complete']
  if (def.unlockType === 'skill' && def.unlockSkill && def.unlockLevel) {
    return skills[def.unlockSkill].level >= def.unlockLevel
  }
  return false
}

// ============================================
// Care System
// ============================================

const TPS = 15

// Decay rates (per tick)
// Hunger: 1 point per 3 min = 1 / (3 * 60 * 15) per tick
const HUNGER_DECAY_PER_TICK = 1 / (3 * 60 * TPS)
// Happiness: 1 point per 5 min = 1 / (5 * 60 * 15) per tick (doubled when hungry)
const HAPPINESS_DECAY_PER_TICK = 1 / (5 * 60 * TPS)

export type BeastMood = 'happy' | 'content' | 'sad' | 'hungry'

/** Get the mood of a beast based on happiness and hunger */
export function getBeastMood(beast: ManaBeast): BeastMood {
  if (beast.hunger < 20) return 'hungry'
  if (beast.happiness > 70) return 'happy'
  if (beast.happiness >= 40) return 'content'
  return 'sad'
}

/**
 * Tick beast care stats. Call every game tick (15 TPS).
 * Hunger decays steadily. Happiness decays slowly (faster when hungry).
 * Accumulators handle sub-tick decay for smooth behavior.
 */

// Internal accumulators (not saved — fractional decay between ticks)
const hungerAccum = new Map<string, number>()
const happyAccum = new Map<string, number>()

export function tickBeastCare(beast: ManaBeast): void {
  // Hunger decay
  const hAcc = (hungerAccum.get(beast.id) ?? 0) + HUNGER_DECAY_PER_TICK
  if (hAcc >= 1) {
    const drain = Math.floor(hAcc)
    beast.hunger = Math.max(0, beast.hunger - drain)
    hungerAccum.set(beast.id, hAcc - drain)
  } else {
    hungerAccum.set(beast.id, hAcc)
  }

  // Happiness decay (doubled when hungry)
  const happyRate = beast.hunger <= 0 ? HAPPINESS_DECAY_PER_TICK * 2 : HAPPINESS_DECAY_PER_TICK
  const sAcc = (happyAccum.get(beast.id) ?? 0) + happyRate
  if (sAcc >= 1) {
    const drain = Math.floor(sAcc)
    beast.happiness = Math.max(0, beast.happiness - drain)
    happyAccum.set(beast.id, sAcc - drain)
  } else {
    happyAccum.set(beast.id, sAcc)
  }
}

// ============================================
// Feeding
// ============================================

/** Beast food definitions — item ID → stat gains */
export const BEAST_FOODS: Record<string, { hunger: number; happiness: number; bond: number }> = {
  mana_berry:    { hunger: 30, happiness: 10, bond: 0 },
  glow_moss:     { hunger: 20, happiness: 0,  bond: 5 },
  ember_fruit:   { hunger: 40, happiness: 0,  bond: 0 },
  spirit_morsel: { hunger: 15, happiness: 15, bond: 15 },
}

/** Check if an item is beast food */
export function isBeastFood(itemId: string): boolean {
  return itemId in BEAST_FOODS
}

/** Feed a beast. Returns stat changes for UI feedback. */
export function feedBeast(beast: ManaBeast, foodId: string): { hunger: number; happiness: number; bond: number } | null {
  const food = BEAST_FOODS[foodId]
  if (!food) return null

  const prev = { hunger: beast.hunger, happiness: beast.happiness, bond: beast.bond }
  beast.hunger = Math.min(100, beast.hunger + food.hunger)
  beast.happiness = Math.min(100, beast.happiness + food.happiness)
  beast.bond = Math.min(100, beast.bond + food.bond)

  return {
    hunger: beast.hunger - prev.hunger,
    happiness: beast.happiness - prev.happiness,
    bond: beast.bond - prev.bond,
  }
}

/** Petting bonus — called from petSpirit(). Small happiness + bond boost. */
export function petBeastBonus(beast: ManaBeast): void {
  beast.happiness = Math.min(100, beast.happiness + 2)
  beast.bond = Math.min(100, beast.bond + 1)
}

/** Adventuring bond — called periodically when beast is following in the world. */
export function adventureBondTick(beast: ManaBeast): void {
  // +1 bond per 5 minutes of adventuring
  // Called at 1/tick rate, so accumulate very slowly
  // We'll check externally and call this every 5min
  beast.bond = Math.min(100, beast.bond + 1)
}

// ============================================
// Species Perks — @15 "lesser" tier
// Canon: shimmer-skilling.md §Two-Tier Companions. Each skill-tied beast grants a WEAKER
// version of that skill's @100 Mana'mal perk. All are "bonus find" yield boosts on the beast's
// OWN skill; Drifthorn (admin/rare) is skill-agnostic and keeps a channel-speed identity.
// The true @100 Mana'mals (Tuskroot/Rootback/Gemdigger/Prismstrike) give the strong versions —
// blocked on Alex's follower art before they can be built.
// ============================================

export type BeastPerk = 'gathering_speed' | 'tuberfind' | 'grovekin' | 'gemsense' | 'truesight' | 'sporebloom'

// Canon: game/shimmer-skilling.md §Two-Tier Companions. Each skill's perk is granted at two bond
// depths — the Companion-tier beast below (weak) and the @100 true Mana'mal (strong, unbuilt).
export const BEAST_PERKS: Record<BeastSpecies, BeastPerk> = {
  drifthorn:   'grovekin',        // Forestry    (lesser Rootback → Grovekin)
  dustwhisker: 'tuberfind',       // Farming     (lesser Tuskroot → Tuberfind)
  sporeling:   'sporebloom',      // Alchemy     (lesser Sporehound → Sporebloom)
  glowmite:    'gemsense',        // Prospecting (lesser Gemdigger → Gemsense)
  embermole:   'truesight',       // Rinning     (lesser Prismstrike → Truesight)
}

// Which skill each perk boosts (null = skill-agnostic, applies to every skill).
// `gathering_speed` is granted by no species today — it's the reserved slot for a future
// admin/endgame companion. getSpeedBonus() stays live so that beast can be dropped in.
export const PERK_SKILL: Record<BeastPerk, SkillId | null> = {
  gathering_speed: null,
  tuberfind:   'farming',
  grovekin:    'forestry',
  gemsense:    'prospecting',
  truesight:   'rinning',
  sporebloom:  'alchemy',
}

// Player-facing copy for the companion UI.
export const PERK_INFO: Record<BeastPerk, { label: string; blurb: string }> = {
  gathering_speed: { label: 'Gathering Speed', blurb: 'Channels a little faster on every skill.' },
  tuberfind:       { label: 'Tuberfind',       blurb: 'Sometimes turns up a bonus crop when you harvest.' },
  grovekin:        { label: 'Grovekin',        blurb: 'Sometimes yields extra wood when you gather.' },
  gemsense:        { label: 'Gemsense',        blurb: 'Sometimes finds an extra shard when you mine.' },
  truesight:       { label: 'Truesight',       blurb: 'Sometimes lands an extra catch when you fish.' },
  sporebloom:      { label: 'Sporebloom',      blurb: 'Sometimes a brew yields an extra draught.' },
}

// Max bonus at full happiness (100). @15 = the WEAK tier — the @100 Mana'mal gives the strong version.
export const PERK_MAX_BONUS: Record<BeastPerk, number> = {
  gathering_speed: 0.20,  // +20% channel speed
  tuberfind:       0.20,  // +20% bonus-find chance on farming harvest
  grovekin:        0.20,  // +20% bonus-find chance on forestry
  gemsense:        0.20,  // +20% bonus-find chance on prospecting
  truesight:       0.20,  // +20% bonus-find chance on rinning
  sporebloom:      0.20,  // +20% chance a brew yields one extra draught
}

/**
 * Get perk strength for the active beast (0.0 to 1.0).
 * Returns 0 if happiness < 50. Scales linearly from 50 to 100 — happy companion, stronger perk.
 */
export function getPerkStrength(beast: ManaBeast): number {
  if (beast.happiness < 50) return 0
  return (beast.happiness - 50) / 50 // 0 at 50, 1 at 100
}

/**
 * Get the active perk bonus multiplier for a beast.
 * Returns 0 if perk inactive, up to PERK_MAX_BONUS[perk] at full happiness.
 */
export function getActivePerkBonus(beast: ManaBeast | null): { perk: BeastPerk; bonus: number } | null {
  if (!beast) return null
  const strength = getPerkStrength(beast)
  if (strength <= 0) return null
  const perk = BEAST_PERKS[beast.species]
  return { perk, bonus: PERK_MAX_BONUS[perk] * strength }
}

/**
 * Bonus-find chance for the active beast on a specific skill.
 * Returns 0 unless the beast's perk is tied to that skill (Drifthorn's speed perk yields 0 here).
 */
export function getBonusFindChance(beast: ManaBeast | null, skill: SkillId): number {
  const active = getActivePerkBonus(beast)
  if (!active) return 0
  return PERK_SKILL[active.perk] === skill ? active.bonus : 0
}

/** Channel-speed bonus for the active beast (0 unless it has the gathering_speed perk). */
export function getSpeedBonus(beast: ManaBeast | null): number {
  const active = getActivePerkBonus(beast)
  if (!active || active.perk !== 'gathering_speed') return 0
  return active.bonus
}

// ============================================
// Save/Load
// ============================================

export type BeastSave = { species: BeastSpecies; name: string; happiness: number; hunger: number; bond: number }[]

export function beastsToSave(beasts: ManaBeast[]): BeastSave {
  return beasts.map(b => ({
    species: b.species,
    name: b.name,
    happiness: Math.round(b.happiness),
    hunger: Math.round(b.hunger),
    bond: Math.round(b.bond),
  }))
}

export function beastsFromSave(saved: BeastSave | undefined, x: number, y: number, beastStyles?: Record<string, FollowerMovementStyle>): ManaBeast[] {
  if (!saved) return []
  return saved.map(s => {
    const beast = createBeast(s.species, x, y, beastStyles?.[s.species])
    beast.name = s.name
    beast.happiness = s.happiness ?? 70
    beast.hunger = s.hunger ?? 80
    beast.bond = s.bond ?? 0
    return beast
  })
}
