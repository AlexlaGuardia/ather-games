// Legal base keys for the open-world cloud save doc (docs/M12-cloud-save.md §2). A key outside these is REJECTED (400).
// Server-side only: never parses a game value, only checks names.
import { KEEPER_KEY_SPECS, GARDEN_KEY_SPECS } from '@/lib/keeper-key-specs'   // NOT keeper-local: that one is 'use client'

export const GARDEN_BASE_KEYS: readonly string[] = GARDEN_KEY_SPECS.map(s => s.base)
export const KEEPER_BASE_KEYS: readonly string[] = KEEPER_KEY_SPECS.map(s => s.base)

// Bases ending ':' are prefix families (e.g. `ather:shimmer:seen:<zoneId>`).
function legal(list: readonly string[], key: string): boolean {
  return list.some(b => (b.endsWith(':') ? key.startsWith(b) && key.length > b.length : key === b))
}
export const isGardenKey = (k: string) => legal(GARDEN_BASE_KEYS, k)
export const isKeeperKey = (k: string) => legal(KEEPER_BASE_KEYS, k)
