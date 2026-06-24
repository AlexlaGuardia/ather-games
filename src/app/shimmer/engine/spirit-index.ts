// Spirit Index — research log for wild spirit encounters
// Tracks which species the player has seen and studied in the wild.
// Spirits join your Shimmer through Mana Seeds, not capture.

import type { Species, Element } from '../spirits/spirit'

export type IndexStatus = 'unseen' | 'seen' | 'studied'

export interface IndexEntry {
  species: Species
  status: IndexStatus
  elementsStudied: Exclude<Element, 'base'>[] // which element forms have been researched
  timesSeen: number
  timesStudied: number
  firstSeen?: number // timestamp
}

export interface SpiritIndex {
  entries: Record<Species, IndexEntry>
  totalStudied: number
}

export const ALL_SPECIES: Species[] = [
  'fox', 'axolotl', 'water-bear', 'turtle', 'owl',
  'frog', 'firefly', 'rabbit', 'hummingbird', 'bat',
]

// Species available in-game — drives wild encounters + the RNG starter pool.
// All 10 launched on PLACEHOLDER sprites (the 7 beyond fox/axolotl/water-bear are basic
// frames + battle-fallback; deriveSprites fills animations). Polish upgrades in place.
// NOTE: Shimmer goes 3D eventually — the 2D pixel art is intentionally placeholder, don't over-invest.
export const LAUNCHED_SPECIES: Species[] = ['fox', 'axolotl', 'water-bear', 'turtle', 'owl', 'frog', 'firefly', 'rabbit', 'hummingbird', 'bat']

export function createSpiritIndex(): SpiritIndex {
  const entries = {} as Record<Species, IndexEntry>
  for (const species of LAUNCHED_SPECIES) {
    entries[species] = {
      species,
      status: 'unseen',
      elementsStudied: [],
      timesSeen: 0,
      timesStudied: 0,
    }
  }
  return { entries, totalStudied: 0 }
}

/** Mark a species as seen (minimum — doesn't downgrade higher status) */
export function markSeen(index: SpiritIndex, species: Species): void {
  const entry = index.entries[species]
  if (!entry) return
  if (entry.status === 'unseen') entry.status = 'seen'
  entry.timesSeen++
  if (!entry.firstSeen) entry.firstSeen = Date.now()
}

/** Mark a species as studied (highest status — upgrades from seen/unseen) */
export function markStudied(index: SpiritIndex, species: Species, element?: Exclude<Element, 'base'>): void {
  const entry = index.entries[species]
  if (!entry) return
  if (entry.status === 'unseen' || entry.status === 'seen') entry.status = 'studied'
  entry.timesStudied++
  if (!entry.firstSeen) entry.firstSeen = Date.now()
  if (element && !entry.elementsStudied.includes(element)) {
    entry.elementsStudied.push(element)
  }
  index.totalStudied = Object.values(index.entries).filter(e => e.timesStudied > 0).length
}

/** Get completion stats for UI display */
export function indexStats(index: SpiritIndex): { seen: number; studied: number; total: number } {
  const entries = Object.values(index.entries)
  return {
    seen: entries.filter(e => e.status !== 'unseen').length,
    studied: entries.filter(e => e.timesStudied > 0).length,
    total: entries.length,
  }
}

// ── Save / Load ────────────────────────────

export interface IndexSave {
  entries: Record<string, {
    status: string
    elementsStudied: string[]
    timesSeen: number
    timesStudied: number
    timesCaught?: number // legacy field, ignored on load
    firstSeen?: number
  }>
}

export function indexToSave(index: SpiritIndex): IndexSave {
  const entries: IndexSave['entries'] = {}
  for (const [species, entry] of Object.entries(index.entries)) {
    if (entry.status === 'unseen' && entry.timesSeen === 0) continue // skip empty
    entries[species] = {
      status: entry.status,
      elementsStudied: entry.elementsStudied,
      timesSeen: entry.timesSeen,
      timesStudied: entry.timesStudied,
      firstSeen: entry.firstSeen,
    }
  }
  return { entries }
}

export function indexFromSave(save: IndexSave): SpiritIndex {
  const index = createSpiritIndex()
  for (const [species, data] of Object.entries(save.entries)) {
    const entry = index.entries[species as Species]
    if (!entry) continue
    // Migrate legacy 'caught' status → 'studied'
    entry.status = (data.status === 'caught' ? 'studied' : data.status) as IndexStatus
    entry.elementsStudied = data.elementsStudied as Exclude<Element, 'base'>[]
    entry.timesSeen = data.timesSeen
    entry.timesStudied = data.timesStudied + (data.timesCaught ?? 0) // merge legacy caught into studied
    entry.firstSeen = data.firstSeen
  }
  index.totalStudied = Object.values(index.entries).filter(e => e.timesStudied > 0).length
  return index
}
