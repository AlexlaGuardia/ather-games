// Legal base keys for the open-world cloud save doc (docs/M12-cloud-save.md §2). A key outside these is REJECTED (400).
// Server-side only: never parses a game value, only checks names.
import { KEEPER_KEY_SPECS } from '@/lib/keeper-local'

// ── TEMPORARY garden stub ── TODO(M12 step 1): replace with `GARDEN_KEY_SPECS.map(s => s.base)` once Jin adds it to keeper-local.ts.
const GARDEN_KEYS_STUB: readonly string[] = [
  'ather.garden.v1', 'ather.fog.v2', 'open.journal.v1', 'ather.waymarks.v1', 'open.pruned.v1', 'open.mined.v1',
  'ather.nodes.skew', 'open.tycoon.v1', 'open.errand.v1', 'open.blueprints.v1', 'open.pitstops.v1',
]
export const GARDEN_BASE_KEYS: readonly string[] = GARDEN_KEYS_STUB
export const KEEPER_BASE_KEYS: readonly string[] = KEEPER_KEY_SPECS.map(s => s.base)

// Bases ending ':' are prefix families (e.g. `ather:shimmer:seen:<zoneId>`).
function legal(list: readonly string[], key: string): boolean {
  return list.some(b => (b.endsWith(':') ? key.startsWith(b) && key.length > b.length : key === b))
}
export const isGardenKey = (k: string) => legal(GARDEN_BASE_KEYS, k)
export const isKeeperKey = (k: string) => legal(KEEPER_BASE_KEYS, k)
