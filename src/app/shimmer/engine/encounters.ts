// Wild encounter system — zone-based random battles
// Garden is always safe. Outer zones have encounter tables.
// Canon: spirits aren't wild animals — they're Ather beings drawn by curiosity.
// Encounters feel like spirits approaching you, not you attacking them.

import type { Species, Element } from '../spirits/spirit'
import { createSpirit, speciesDisplayName } from '../spirits/spirit'
import type { AITier } from './battle-ai'
import { LAUNCHED_SPECIES } from './spirit-index'

// ============================================
// Encounter Table
// ============================================

export interface EncounterEntry {
  species: Species
  weight: number      // relative spawn weight (higher = more common)
  levelRange: [number, number]  // [min, max] offset from player level
  element?: Element   // override element (default: 'base')
}

export interface ZoneEncounters {
  rate: number               // 0-1 chance per step (0 = no encounters)
  entries: EncounterEntry[]
  aiTier: AITier
}

export const ENCOUNTER_TABLES: Record<string, ZoneEncounters> = {
  // Garden — your safe haven, no encounters
  'garden': {
    rate: 0,
    entries: [],
    aiTier: 'wild',
  },

  // Mycelial Path — early area, gentle wilds
  'mycelial-path': {
    rate: 0.08,
    entries: [
      { species: 'frog',    weight: 4, levelRange: [-2, 1] },
      { species: 'firefly', weight: 3, levelRange: [-1, 2] },
      { species: 'bat',     weight: 3, levelRange: [-1, 2] },
      { species: 'axolotl', weight: 2, levelRange: [-1, 1] },
    ],
    aiTier: 'wild',
  },

  // Moonwell Glade — Gregory's zone, moderate wilds
  'moonwell-glade': {
    rate: 0.08,
    entries: [
      { species: 'owl',         weight: 3, levelRange: [-1, 3] },
      { species: 'rabbit',      weight: 3, levelRange: [-1, 2] },
      { species: 'hummingbird', weight: 2, levelRange: [0, 3] },
      { species: 'frog',        weight: 2, levelRange: [0, 2] },
    ],
    aiTier: 'wild',
  },

  // Spore Hollow — deeper, tougher encounters
  'spore-hollow': {
    rate: 0.12,
    entries: [
      { species: 'water-bear',  weight: 3, levelRange: [0, 4] },
      { species: 'turtle',      weight: 3, levelRange: [0, 3] },
      { species: 'fox',         weight: 2, levelRange: [1, 4] },
      { species: 'bat',         weight: 2, levelRange: [1, 3] },
      { species: 'owl',         weight: 1, levelRange: [2, 5] },
    ],
    aiTier: 'trained',
  },

  // New zones — placeholder encounters (tune after map design)
  'twilight-thicket': {
    rate: 0.08,
    entries: [
      { species: 'owl',     weight: 4, levelRange: [-1, 2] },
      { species: 'bat',     weight: 3, levelRange: [0, 3] },
      { species: 'firefly', weight: 3, levelRange: [-1, 2] },
    ],
    aiTier: 'wild',
  },
  'the-threshold': {
    rate: 0.12,
    entries: [
      { species: 'water-bear', weight: 3, levelRange: [1, 4] },
      { species: 'turtle',     weight: 3, levelRange: [0, 3] },
      { species: 'fox',        weight: 2, levelRange: [2, 5] },
    ],
    aiTier: 'trained',
  },
  'mana-springs': {
    rate: 0.09,
    entries: [
      { species: 'axolotl',     weight: 4, levelRange: [0, 3] },
      { species: 'frog',        weight: 3, levelRange: [1, 3] },
      { species: 'hummingbird', weight: 2, levelRange: [1, 4] },
    ],
    aiTier: 'wild',
  },
  'spirit-meadow': {
    rate: 0.07,
    entries: [
      { species: 'rabbit',      weight: 4, levelRange: [-1, 2] },
      { species: 'hummingbird', weight: 3, levelRange: [0, 2] },
      { species: 'frog',        weight: 2, levelRange: [0, 3] },
    ],
    aiTier: 'wild',
  },
  'sorrel-hold': {
    rate: 0.10,
    entries: [
      { species: 'fox',         weight: 3, levelRange: [2, 5] },
      { species: 'turtle',      weight: 3, levelRange: [2, 5] },
      { species: 'water-bear',  weight: 2, levelRange: [3, 6] },
      { species: 'hummingbird', weight: 2, levelRange: [2, 4] },
    ],
    aiTier: 'trained',
  },
  'brack-hold': {
    rate: 0.12,
    entries: [
      { species: 'owl',         weight: 3, levelRange: [4, 7] },
      { species: 'water-bear',  weight: 3, levelRange: [4, 7] },
      { species: 'turtle',      weight: 3, levelRange: [4, 7] },
      { species: 'fox',         weight: 2, levelRange: [4, 8] },
      { species: 'bat',         weight: 1, levelRange: [5, 8] },
    ],
    aiTier: 'trained',
  },
}

// ============================================
// Encounter Roll
// ============================================

export interface WildEncounter {
  species: Species
  name: string
  level: number
  element: Element
  aiTier: AITier
}

/** Roll for a wild encounter when player steps on a veil tile.
 *  Only call this on VEIL tiles — non-veil tiles should never roll.
 *  isDense: true for dense veil (1.5x encounter rate, capped at 0.20) */
export function rollEncounter(zoneId: string, playerLevel: number, isDense?: boolean): WildEncounter | null {
  const table = ENCOUNTER_TABLES[zoneId]
  if (!table || table.entries.length === 0) return null

  // Filter to launched species only
  const entries = table.entries.filter(e => LAUNCHED_SPECIES.includes(e.species))
  if (entries.length === 0) return null

  // Rate check — dense veil gets boosted rate
  const rate = isDense ? Math.min(table.rate * 1.5, 0.20) : table.rate
  if (Math.random() >= rate) return null

  // Weighted pick
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0)
  let roll = Math.random() * totalWeight
  let picked: EncounterEntry = entries[0]
  for (const entry of entries) {
    roll -= entry.weight
    if (roll <= 0) { picked = entry; break }
  }

  // Level (clamped to 1-100)
  const levelOffset = picked.levelRange[0] + Math.floor(Math.random() * (picked.levelRange[1] - picked.levelRange[0] + 1))
  const level = Math.max(1, Math.min(100, playerLevel + levelOffset))

  // Name
  const name = `Wild ${speciesDisplayName(picked.species)}`

  return {
    species: picked.species,
    name,
    level,
    element: picked.element ?? 'base',
    aiTier: table.aiTier,
  }
}

// ============================================
// Trainer Config
// ============================================

export interface TrainerConfig {
  species: Species
  name: string         // spirit name, not trainer name
  levelOffset: number  // relative to player level
  element: Element
  aiTier: AITier
}

/** Create a trainer's spirit for battle */
export function createTrainerSpirit(trainer: TrainerConfig, playerLevel: number) {
  const level = Math.max(1, Math.min(100, playerLevel + trainer.levelOffset))
  const spirit = createSpirit(trainer.species, trainer.name, 0, 0)
  spirit.level = level
  spirit.element = trainer.element
  spirit.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 24) + 8) // decent IVs
  spirit.bond = 80 // trainers have bonded spirits
  spirit.happiness = 200
  return spirit
}
