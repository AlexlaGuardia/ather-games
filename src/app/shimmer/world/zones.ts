// Zone system — connected map sections with warp transitions
// Each zone is its own tilemap grid with named warps linking zones together

export interface Warp {
  fromX: number       // tile position in this zone
  fromY: number
  toZone: string      // target zone id
  toX: number         // tile to place player in target zone
  toY: number
  direction?: 'up' | 'down' | 'left' | 'right' // player faces this direction on arrival
  requiredFlag?: string // warp only works when this flag is set (e.g., 'tutorialComplete')
}

// Elemental theme of a zone — drives spirit-condensation affinity (see SPIRIT_CONDENSE.md).
// Leveling a spirit in a zone feeds that zone's element into its affinity vector.
export type ZoneElement = 'mana' | 'water' | 'earth' | 'storm'

export interface Zone {
  id: string
  name: string
  grid: number[][]
  warps: Warp[]
  playerStart?: { tileX: number; tileY: number } // default spawn point for this zone
  element?: ZoneElement // cultivation element (undefined = dev/throwaway zone, no affinity)
}

// Check if player is standing on a warp tile (respects flag requirements)
export function checkWarp(zones: Zone[], currentZoneId: string, tileX: number, tileY: number, flags?: Record<string, boolean>): Warp | null {
  const zone = zones.find(z => z.id === currentZoneId)
  if (!zone) return null
  return zone.warps.find(w => {
    if (w.fromX !== tileX || w.fromY !== tileY) return false
    if (w.requiredFlag && !flags?.[w.requiredFlag]) return false
    return true
  }) ?? null
}

// Get zone by id
export function getZone(zones: Zone[], id: string): Zone | null {
  return zones.find(z => z.id === id) ?? null
}

// ---- Shimmer zones ----
// Garden (home) → west → Tutorial (Mycelial Path) → south → Moonwell Glade (Gregory's home)
// Garden → east → Moonwell Glade (shortcut, blocked until tutorialComplete)
// Moonwell Glade → east → Spore Hollow (post-tutorial)

import { GARDEN, MYCELIAL_PATH, MOONWELL_GLADE, SPORE_HOLLOW, TWILIGHT_THICKET, THE_THRESHOLD, MANA_SPRINGS, SPIRIT_MEADOW, MOONWELL_GLADE_GREGORY_S_HOME , TEST_SANDBOX,
  FLAT_TERRAIN_DEMO,
  FP_GARDEN, FP_LARGE_1, FP_LARGE_2, FP_LARGE_3, FP_MED_1, FP_MED_2, FP_MED_3, FP_MED_4, FP_HUGE,
  ROUTE_GARDEN_MYCELIAL, ROUTE_MYCELIAL_SPIRIT, ROUTE_SPIRIT_MOONWELL, ROUTE_MOONWELL_GARDEN } from './tilemap'
export const ZONES: Zone[] = [
  {
    id: 'garden',            // keep id stable (referenced widely); display = the player's own plot
    name: 'Home Plot',
    element: 'mana',
    grid: GARDEN,
    playerStart: { tileX: 2, tileY: 9 },
    warps: [
      { fromX: 25, fromY: 8, toZone: 'route-garden-mycelial', toX: 1, toY: 5, direction: 'right' },
      { fromX: 25, fromY: 9, toZone: 'route-garden-mycelial', toX: 1, toY: 5, direction: 'right' },
      { fromX: 0, fromY: 8, toZone: 'route-moonwell-garden', toX: 28, toY: 5, direction: 'left' },
      { fromX: 0, fromY: 9, toZone: 'route-moonwell-garden', toX: 28, toY: 5, direction: 'left' },
    ],
  },
  {
    id: 'mycelial-path',
    name: 'Mycelial Path',
    element: 'earth',
    grid: MYCELIAL_PATH,
    playerStart: { tileX: 2, tileY: 8 },
    warps: [
      { fromX: 0, fromY: 7, toZone: 'route-garden-mycelial', toX: 28, toY: 5, direction: 'left' },
      { fromX: 0, fromY: 8, toZone: 'route-garden-mycelial', toX: 28, toY: 5, direction: 'left' },
      { fromX: 21, fromY: 7, toZone: 'route-mycelial-spirit', toX: 1, toY: 5, direction: 'right' },
      { fromX: 21, fromY: 8, toZone: 'route-mycelial-spirit', toX: 1, toY: 5, direction: 'right' },
    ],
  },
  {
    id: 'moonwell-glade',
    name: 'Moonwell Glade',
    element: 'water',
    grid: MOONWELL_GLADE,
    playerStart: { tileX: 2, tileY: 8 },
    warps: [
      { fromX: 0, fromY: 7, toZone: 'route-spirit-moonwell', toX: 28, toY: 5, direction: 'left' },
      { fromX: 0, fromY: 8, toZone: 'route-spirit-moonwell', toX: 28, toY: 5, direction: 'left' },
      { fromX: 21, fromY: 7, toZone: 'route-moonwell-garden', toX: 1, toY: 5, direction: 'right' },
      { fromX: 21, fromY: 8, toZone: 'route-moonwell-garden', toX: 1, toY: 5, direction: 'right' },
    ],
  },
  {
    id: 'spore-hollow',      // retheme → Voranyx Caverns (east passage that "opens to the Silt", sealed in v1)
    name: 'Voranyx Caverns',
    element: 'earth',
    grid: SPORE_HOLLOW,
    playerStart: { tileX: 1, tileY: 12 },
    warps: [
      { fromX: 0, fromY: 12, toZone: 'moonwell-glade', toX: 28, toY: 15, direction: 'left' },
      { fromX: 0, fromY: 13, toZone: 'moonwell-glade', toX: 28, toY: 15, direction: 'left' },
      // East exit to Twilight Thicket
      { fromX: 54, fromY: 9, toZone: 'twilight-thicket', toX: 1, toY: 9, direction: 'right' },
      { fromX: 54, fromY: 10, toZone: 'twilight-thicket', toX: 1, toY: 10, direction: 'right' },
    ],
  },
  // --- New zones (song-inspired, placeholder grids) ---
  {
    id: 'twilight-thicket',
    name: 'Twilight Thicket',
    element: 'earth', // future Shimmeroak Thicket (wood/forestry)
    grid: TWILIGHT_THICKET,
    playerStart: { tileX: 1, tileY: 9 },
    warps: [
      // West entry back to Spore Hollow
      { fromX: 0, fromY: 9, toZone: 'spore-hollow', toX: 53, toY: 9, direction: 'left' },
      { fromX: 0, fromY: 10, toZone: 'spore-hollow', toX: 53, toY: 10, direction: 'left' },
    ],
  },
  {
    id: 'the-threshold',     // retheme → Ather Winds (the sealed gate to the Wilds; seeds ride in from here)
    name: 'Ather Winds',
    element: 'storm', // frontier edge — the sealed door to the Wilds expansion
    grid: THE_THRESHOLD,
    playerStart: { tileX: 9, tileY: 1 },
    warps: [
      // North entry back to Spirit Meadow
      { fromX: 9, fromY: 0, toZone: 'spirit-meadow', toX: 14, toY: 18, direction: 'up' },
      { fromX: 10, fromY: 0, toZone: 'spirit-meadow', toX: 15, toY: 18, direction: 'up' },
    ],
  },
  {
    id: 'mana-springs',
    name: 'Mana Springs',
    element: 'earth', // mining / ore
    grid: MANA_SPRINGS,
    playerStart: { tileX: 12, tileY: 1 },
    warps: [
      // North entry back to Moonwell Glade
      { fromX: 12, fromY: 0, toZone: 'moonwell-glade', toX: 14, toY: 28, direction: 'up' },
      { fromX: 13, fromY: 0, toZone: 'moonwell-glade', toX: 15, toY: 28, direction: 'up' },
      // South exit to Spirit Meadow
      { fromX: 12, fromY: 19, toZone: 'spirit-meadow', toX: 14, toY: 1, direction: 'down' },
      { fromX: 13, fromY: 19, toZone: 'spirit-meadow', toX: 15, toY: 1, direction: 'down' },
    ],
  },
  {
    id: 'spirit-meadow',
    name: 'Spirit Meadow',
    element: 'mana',
    grid: SPIRIT_MEADOW,
    playerStart: { tileX: 2, tileY: 8 },
    warps: [
      { fromX: 0, fromY: 7, toZone: 'route-mycelial-spirit', toX: 28, toY: 5, direction: 'left' },
      { fromX: 0, fromY: 8, toZone: 'route-mycelial-spirit', toX: 28, toY: 5, direction: 'left' },
      { fromX: 21, fromY: 7, toZone: 'route-spirit-moonwell', toX: 1, toY: 5, direction: 'right' },
      { fromX: 21, fromY: 8, toZone: 'route-spirit-moonwell', toX: 1, toY: 5, direction: 'right' },
    ],
  },  {
    id: 'moonwell-glade-gregory-s-home',
    name: "Moonwell Glade (Gregory's Home)",
    element: 'water',
    grid: MOONWELL_GLADE_GREGORY_S_HOME,
    playerStart: { tileX: 5, tileY: 5 },
    warps: [
      { fromX: 14, fromY: 14, toZone: 'moonwell-glade', toX: 15, toY: 13, direction: 'up' },
    ],
  },
  {
    id: 'test-sandbox',
    name: 'test_sandbox',
    grid: TEST_SANDBOX,
    playerStart: { tileX: 5, tileY: 5 },
    warps: [],
  },
  // --- Flat-terrain demo (throwaway) — reach via ?zone=flat-terrain-demo ---
  {
    id: 'flat-terrain-demo',
    name: 'Flat Terrain Demo',
    grid: FLAT_TERRAIN_DEMO,
    playerStart: { tileX: 10, tileY: 7 },
    warps: [],
  },

  // --- F2P scale-test world (hub + 3 large + 4 medium) — reach via ?zone=fp-garden ---
  {
    id: 'fp-garden',
    name: 'Garden (hub)',
    grid: FP_GARDEN,
    playerStart: { tileX: 24, tileY: 20 },
    warps: [
      { fromX: 12, fromY: 0,  toZone: 'fp-large-1', toX: 60, toY: 118, direction: 'up' },
      { fromX: 35, fromY: 0,  toZone: 'fp-med-1',   toX: 40, toY: 78,  direction: 'up' },
      { fromX: 47, fromY: 13, toZone: 'fp-large-2', toX: 1,  toY: 60,  direction: 'right' },
      { fromX: 47, fromY: 26, toZone: 'fp-med-2',   toX: 1,  toY: 40,  direction: 'right' },
      { fromX: 12, fromY: 39, toZone: 'fp-large-3', toX: 60, toY: 1,   direction: 'down' },
      { fromX: 35, fromY: 39, toZone: 'fp-med-3',   toX: 40, toY: 1,   direction: 'down' },
      { fromX: 0,  fromY: 20, toZone: 'fp-med-4',   toX: 78, toY: 40,  direction: 'left' },
    ],
  },
  {
    id: 'fp-large-1', name: 'Large I', grid: FP_LARGE_1,
    playerStart: { tileX: 60, tileY: 60 },
    warps: [{ fromX: 60, fromY: 119, toZone: 'fp-garden', toX: 12, toY: 1, direction: 'down' }],
  },
  {
    id: 'fp-large-2', name: 'Large II', grid: FP_LARGE_2,
    playerStart: { tileX: 60, tileY: 60 },
    warps: [{ fromX: 0, fromY: 60, toZone: 'fp-garden', toX: 46, toY: 13, direction: 'left' }],
  },
  {
    id: 'fp-large-3', name: 'Large III', grid: FP_LARGE_3,
    playerStart: { tileX: 60, tileY: 60 },
    warps: [{ fromX: 60, fromY: 0, toZone: 'fp-garden', toX: 12, toY: 38, direction: 'up' }],
  },
  {
    id: 'fp-med-1', name: 'Medium I', grid: FP_MED_1,
    playerStart: { tileX: 40, tileY: 40 },
    warps: [{ fromX: 40, fromY: 79, toZone: 'fp-garden', toX: 35, toY: 1, direction: 'down' }],
  },
  {
    id: 'fp-med-2', name: 'Medium II', grid: FP_MED_2,
    playerStart: { tileX: 40, tileY: 40 },
    warps: [{ fromX: 0, fromY: 40, toZone: 'fp-garden', toX: 46, toY: 26, direction: 'left' }],
  },
  {
    id: 'fp-med-3', name: 'Medium III', grid: FP_MED_3,
    playerStart: { tileX: 40, tileY: 40 },
    warps: [{ fromX: 40, fromY: 0, toZone: 'fp-garden', toX: 35, toY: 38, direction: 'up' }],
  },
  {
    id: 'fp-med-4', name: 'Medium IV', grid: FP_MED_4,
    playerStart: { tileX: 40, tileY: 40 },
    warps: [{ fromX: 79, fromY: 40, toZone: 'fp-garden', toX: 1, toY: 20, direction: 'right' }],
  },
  {
    id: 'fp-huge', name: 'Huge (256² chunk-bake proof)', grid: FP_HUGE,
    playerStart: { tileX: 128, tileY: 128 },
    warps: [{ fromX: 128, fromY: 255, toZone: 'fp-garden', toX: 24, toY: 20, direction: 'down' }],
  },

  // --- Garden-chain route zones (baked from garden-chain.ts, 2026-06-24) ---
  // Grids + warps + spawns are now static; edit here or via Map Editor (saves stick).
  {
    id: 'route-garden-mycelial',
    name: 'Garden–Mycelial Path',
    grid: ROUTE_GARDEN_MYCELIAL,
    playerStart: { tileX: 2, tileY: 5 },
    warps: [
      { fromX: 0, fromY: 4, toZone: 'garden', toX: 24, toY: 9, direction: 'left' },
      { fromX: 0, fromY: 5, toZone: 'garden', toX: 24, toY: 9, direction: 'left' },
      { fromX: 29, fromY: 4, toZone: 'mycelial-path', toX: 1, toY: 8, direction: 'right' },
      { fromX: 29, fromY: 5, toZone: 'mycelial-path', toX: 1, toY: 8, direction: 'right' },
    ],
  },
  {
    id: 'route-mycelial-spirit',
    name: 'Mycelial Path–Spirit Meadow',
    grid: ROUTE_MYCELIAL_SPIRIT,
    playerStart: { tileX: 2, tileY: 5 },
    warps: [
      { fromX: 0, fromY: 4, toZone: 'mycelial-path', toX: 20, toY: 8, direction: 'left' },
      { fromX: 0, fromY: 5, toZone: 'mycelial-path', toX: 20, toY: 8, direction: 'left' },
      { fromX: 29, fromY: 4, toZone: 'spirit-meadow', toX: 1, toY: 8, direction: 'right' },
      { fromX: 29, fromY: 5, toZone: 'spirit-meadow', toX: 1, toY: 8, direction: 'right' },
    ],
  },
  {
    id: 'route-spirit-moonwell',
    name: 'Spirit Meadow–Moonwell Glade',
    grid: ROUTE_SPIRIT_MOONWELL,
    playerStart: { tileX: 2, tileY: 5 },
    warps: [
      { fromX: 0, fromY: 4, toZone: 'spirit-meadow', toX: 20, toY: 8, direction: 'left' },
      { fromX: 0, fromY: 5, toZone: 'spirit-meadow', toX: 20, toY: 8, direction: 'left' },
      { fromX: 29, fromY: 4, toZone: 'moonwell-glade', toX: 1, toY: 8, direction: 'right' },
      { fromX: 29, fromY: 5, toZone: 'moonwell-glade', toX: 1, toY: 8, direction: 'right' },
    ],
  },
  {
    id: 'route-moonwell-garden',
    name: 'Moonwell Glade–Garden',
    grid: ROUTE_MOONWELL_GARDEN,
    playerStart: { tileX: 2, tileY: 5 },
    warps: [
      { fromX: 0, fromY: 4, toZone: 'moonwell-glade', toX: 20, toY: 8, direction: 'left' },
      { fromX: 0, fromY: 5, toZone: 'moonwell-glade', toX: 20, toY: 8, direction: 'left' },
      { fromX: 29, fromY: 4, toZone: 'garden', toX: 1, toY: 9, direction: 'right' },
      { fromX: 29, fromY: 5, toZone: 'garden', toX: 1, toY: 9, direction: 'right' },
    ],
  },
]

export const START_ZONE = 'garden'
