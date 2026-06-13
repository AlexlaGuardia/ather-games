// Spirit state machine and core types
import { EVOLUTION_THRESHOLDS, INFUSION_CAPS, STAT_CAPS } from './evolution-config'

export type SpiritState = 'idle' | 'wander' | 'eat' | 'sleep' | 'pet' | 'happy'
export type Species = 'fox' | 'axolotl' | 'water-bear' | 'turtle' | 'owl' | 'frog' | 'firefly' | 'rabbit' | 'hummingbird' | 'bat'
export type Direction = 'up' | 'down' | 'left' | 'right' | 'upleft' | 'upright' | 'downleft' | 'downright'
export type Temperament = 'bold' | 'calm' | 'swift' | 'sturdy' | 'bright' | 'neutral'
export type Element = 'base' | 'mana' | 'storm' | 'earth' | 'water'
export type Variant = 'base'  // visual palette variant — expand as Alex paints shinies etc.

// Infusion HVs — alchemy-driven, determines evolution path
export interface Infusions {
  mana: number    // 0-9 per element
  storm: number
  earth: number
  water: number
}

export const MAX_INFUSIONS_TOTAL = INFUSION_CAPS.totalCap
export const MAX_INFUSIONS_PER_ELEMENT = INFUSION_CAPS.perElementCap

export function createInfusions(): Infusions {
  return { mana: 0, storm: 0, earth: 0, water: 0 }
}

export function infusionTotal(inf: Infusions): number {
  return inf.mana + inf.storm + inf.earth + inf.water
}

/** Apply one infusion point. Returns false if at cap. */
export function addInfusion(inf: Infusions, element: Exclude<Element, 'base'>): boolean {
  if (infusionTotal(inf) >= MAX_INFUSIONS_TOTAL) return false
  if (inf[element] >= MAX_INFUSIONS_PER_ELEMENT) return false
  inf[element]++
  return true
}

/** Get the dominant infusion element, or null if no infusions / tied. */
export function dominantInfusion(inf: Infusions): Exclude<Element, 'base'> | null {
  const entries: [Exclude<Element, 'base'>, number][] = [
    ['mana', inf.mana], ['storm', inf.storm], ['earth', inf.earth], ['water', inf.water],
  ]
  const sorted = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return null
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return null  // tied
  return sorted[0][0]
}

// Temperament stat modifiers (multiplier for relevant stats)
// Bold: +combat -show, Calm: +show -combat, Swift: +racing -guard
// Sturdy: +guard -racing, Bright: +curiosity growth, Neutral: no modifier
export const TEMPERAMENTS: Temperament[] = ['bold', 'calm', 'swift', 'sturdy', 'bright', 'neutral']

// Species display names — Athernyx canon names (internal codes stay as identifiers)
export const SPECIES_NAMES: Record<Species, string> = {
  fox: 'Vulnyx',
  axolotl: 'Manalotl',
  'water-bear': 'Dewbear',
  turtle: 'Shellmere',
  owl: 'Athowl',
  frog: 'Croakling',
  firefly: 'Luminara',
  rabbit: 'Lepara',
  hummingbird: 'Hovari',
  bat: 'Noctyx',
}

/** Get the Athernyx display name for a species code */
export function speciesDisplayName(species: Species): string {
  return SPECIES_NAMES[species] ?? species
}

// Species favorite fruits
export const FAVORITE_FRUIT: Record<Species, string> = {
  fox: 'sunfruit',
  axolotl: 'moonberry',
  'water-bear': 'stonemelon',
  turtle: 'stonemelon',
  owl: 'moonberry',
  frog: 'dewdrop',
  firefly: 'sunfruit',
  rabbit: 'moonberry',
  hummingbird: 'sunfruit',
  bat: 'dewdrop',
}

// XP required per level (quadratic curve, ~100 XP for level 2, scaling up)
export function xpForLevel(level: number): number {
  return Math.floor(80 * level + 20 * level * level)
}

// Form stage derived from level
export type FormStage = 'base' | 'second' | 'awakened'
export function formStage(level: number): FormStage {
  if (level >= EVOLUTION_THRESHOLDS.awakenedFormLevel) return 'awakened'
  if (level >= EVOLUTION_THRESHOLDS.secondFormLevel) return 'second'
  return 'base'
}

/** Stat ceiling for a given form stage */
export function statCap(stage: FormStage): number {
  return STAT_CAPS[stage]
}

// Element UI colors (canon: style guide section 2.3)
export const ELEMENT_COLORS: Record<Element, string> = {
  base: '#d4a843',
  mana: '#9a6aaa',
  storm: '#4a6aaa',
  earth: '#8a6a3a',
  water: '#3a7a7a',
}

// Non-base elements for iteration
export const ELEMENTS: Exclude<Element, 'base'>[] = ['mana', 'storm', 'earth', 'water']

// Second form names — canon-locked (shimmer-master.md), Athernyx names
export const SECOND_FORM_NAMES: Record<Species, Record<Exclude<Element, 'base'>, string>> = {
  fox:         { mana: 'Phantom Vulnyx',  storm: 'Thunder Kit',  earth: 'Den Mother',    water: 'Stream Runner' },
  axolotl:     { mana: 'Healer Manalotl', storm: 'Shock Gill',   earth: 'Mud Lurker',    water: 'Deep Diver' },
  owl:         { mana: 'Seer Athowl',     storm: 'Storm Wing',   earth: 'Ancient Perch', water: 'Fisher Athowl' },
  frog:        { mana: 'Hex Croakling',   storm: 'Spark Toad',   earth: 'Mud Hopper',    water: 'Stream Racer' },
  firefly:     { mana: 'Beacon Fly',      storm: 'Lightning Luminara', earth: 'Cave Glimmer', water: 'Abyss Light' },
  rabbit:      { mana: 'Lucky Lepara',    storm: 'Thunder Hop',  earth: 'Burrow King',   water: 'Marsh Runner' },
  'water-bear': { mana: 'Eternal Grade',  storm: 'Shock Proof',  earth: 'Moss Titan',    water: 'Cryo Dewbear' },
  hummingbird: { mana: 'Nectar Mage',     storm: 'Gale Wing',    earth: 'Jewel Hovari',  water: 'Vapor Hover' },
  turtle:      { mana: 'Shell Sage',      storm: 'Thunderback',  earth: 'Iron Shellmere', water: 'Tide Walker' },
  bat:         { mana: 'Shadow Wing',     storm: 'Echo Hunter',  earth: 'Stone Noctyx',  water: 'Fisher Noctyx' },
}

/** Get second form name, or null if base element */
export function getSecondFormName(species: Species, element: Element): string | null {
  if (element === 'base') return null
  return SECOND_FORM_NAMES[species]?.[element] ?? null
}

// Generate random seed values (IVs equivalent, 0-31 per stat)
function randomSeeds(): number[] {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
}

export interface Spirit {
  id: string
  species: Species
  name: string
  state: SpiritState
  stateTimer: number        // ticks remaining in current state
  x: number                 // pixel position
  y: number
  targetX: number | null    // pixel target for movement
  targetY: number | null
  direction: Direction
  animFrame: number
  animTimer: number
  blinkTimer: number        // ticks until next blink (0-2 = blinking)

  // Stats
  level: number             // 1-100
  xp: number                // current XP toward next level
  seeds: number[]           // 6 IVs (0-31), permanent individuality
  temperament: Temperament  // personality modifier
  variant: Variant          // visual palette (from bloom RNG — 'base', 'shiny', etc.)
  element: Element          // evolution form (set at level 34 by dominant infusion)
  infusions: Infusions      // HVs — alchemy-driven, 11 total cap, 9 per element
  happiness: number         // 0-255 hidden stat
  bond: number              // 0-255 hidden stat

  // Fruit boost
  fruitBoostUntil: number   // timestamp (ms) when boost expires, 0 = no boost

  // Equipment
  heldItem?: string         // held item ID (from held-items.ts), one per spirit

  // Party/bank
  inParty: boolean          // true = in active party (max 5), false = stored in bank

}

export function createSpirit(species: Species, name: string, tileX: number, tileY: number): Spirit {
  return {
    id: `${species}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    species,
    name,
    state: 'idle',
    stateTimer: 30 + Math.floor(Math.random() * 30),
    x: tileX * 16,
    y: tileY * 16,
    targetX: null,
    targetY: null,
    direction: 'down',
    animFrame: 0,
    animTimer: 0,
    blinkTimer: 45 + Math.floor(Math.random() * 30),

    level: 1,
    xp: 0,
    seeds: randomSeeds(),
    temperament: TEMPERAMENTS[Math.floor(Math.random() * TEMPERAMENTS.length)],
    variant: 'base',
    element: 'base',
    infusions: createInfusions(),
    happiness: 128,
    bond: 0,
    fruitBoostUntil: 0,
    inParty: true,
  }
}

export interface XPResult {
  leveled: boolean
  evolved: FormStage | null  // set when crossing a form threshold
}

/** Add XP to a spirit and handle level-ups. Returns level-up and evolution info. */
export function addXP(spirit: Spirit, amount: number): XPResult {
  let leveled = false
  let evolved: FormStage | null = null
  const prevStage = formStage(spirit.level)
  spirit.xp += amount

  while (spirit.level < EVOLUTION_THRESHOLDS.maxLevel) {
    const needed = xpForLevel(spirit.level)
    if (spirit.xp >= needed) {
      spirit.xp -= needed
      spirit.level++
      leveled = true
      // Happiness boost on level up
      spirit.happiness = Math.min(255, spirit.happiness + 5)
    } else {
      break
    }
  }

  if (spirit.level >= EVOLUTION_THRESHOLDS.maxLevel) {
    spirit.xp = 0
  }

  // Detect form stage transition
  const newStage = formStage(spirit.level)
  if (newStage !== prevStage) {
    // Second form requires base element (player picks element during evolution)
    // Awakened form requires non-base element (already evolved once)
    if (newStage === 'second' && spirit.element === 'base') evolved = 'second'
    else if (newStage === 'awakened' && spirit.element !== 'base') evolved = 'awakened'
  }

  return { leveled, evolved }
}

/** Check if fruit boost is currently active */
export function hasFruitBoost(spirit: Spirit): boolean {
  return spirit.fruitBoostUntil > Date.now()
}

/** Apply fruit boost (5 minutes) */
export function applyFruitBoost(spirit: Spirit): void {
  spirit.fruitBoostUntil = Date.now() + 5 * 60 * 1000
}

// =============================================================
// Planted Seeds — growth timer entities on the world map
// =============================================================

export const GROWTH_DURATION = 10 * 60 * 1000  // 10 minutes in ms

export interface PlantedSeed {
  id: string
  species: Species
  tileX: number
  tileY: number
  zoneId: string
  plantedAt: number       // Date.now() timestamp
  growthDuration: number  // ms (default GROWTH_DURATION)
}

export type GrowthPhase = 0 | 1 | 2 | 3  // seed | sprout | bud | bloom

/** Get current growth phase (0-3) based on elapsed time */
export function getGrowthPhase(planted: PlantedSeed): GrowthPhase {
  const progress = Math.min(1, (Date.now() - planted.plantedAt) / planted.growthDuration)
  if (progress < 0.25) return 0
  if (progress < 0.5) return 1
  if (progress < 0.75) return 2
  return 3
}

/** Check if growth timer has completed */
export function isReadyToHatch(planted: PlantedSeed): boolean {
  return Date.now() - planted.plantedAt >= planted.growthDuration
}

/** Create a new planted seed entity */
export function createPlantedSeed(species: Species, tileX: number, tileY: number, zoneId: string): PlantedSeed {
  return {
    id: `planted-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    species,
    tileX,
    tileY,
    zoneId,
    plantedAt: Date.now(),
    growthDuration: GROWTH_DURATION,
  }
}
