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

export interface Zone {
  id: string
  name: string
  grid: number[][]
  warps: Warp[]
  playerStart?: { tileX: number; tileY: number } // default spawn point for this zone
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

import { GARDEN, MYCELIAL_PATH, MOONWELL_GLADE, SPORE_HOLLOW, TWILIGHT_THICKET, THE_THRESHOLD, MANA_SPRINGS, SPIRIT_MEADOW, MOONWELL_GLADE_GREGORY_S_HOME , TEST_SANDBOX } from './tilemap'

export const ZONES: Zone[] = [
  {
    id: 'garden',
    name: 'Shimmer Garden',
    grid: GARDEN,
    playerStart: { tileX: 14, tileY: 8 },
    warps: [
      { fromX: 2, fromY: 4, toZone: 'mycelial-path', toX: 16, toY: 5, direction: 'right' },
    ],
  },
  {
    id: 'mycelial-path',
    name: 'Mycelial Path',
    grid: MYCELIAL_PATH,
    playerStart: { tileX: 18, tileY: 4 },
    warps: [
      { fromX: 9, fromY: 29, toZone: 'moonwell-glade', toX: 14, toY: 1, direction: 'down' },
      { fromX: 10, fromY: 29, toZone: 'moonwell-glade', toX: 15, toY: 1, direction: 'down' },
      { fromX: 17, fromY: 5, toZone: 'garden', toX: 3, toY: 4, direction: 'right' },
    ],
  },
  {
    id: 'moonwell-glade',
    name: 'Moonwell Glade',
    grid: MOONWELL_GLADE,
    playerStart: { tileX: 14, tileY: 1 },
    warps: [
      { fromX: 0, fromY: 15, toZone: 'garden', toX: 24, toY: 22, direction: 'left' },
      // South exit to Mana Springs
      { fromX: 14, fromY: 29, toZone: 'mana-springs', toX: 12, toY: 1, direction: 'down' },
      { fromX: 15, fromY: 29, toZone: 'mana-springs', toX: 13, toY: 1, direction: 'down' },
    ],
  },
  {
    id: 'spore-hollow',
    name: 'Spore Hollow',
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
    grid: TWILIGHT_THICKET,
    playerStart: { tileX: 1, tileY: 9 },
    warps: [
      // West entry back to Spore Hollow
      { fromX: 0, fromY: 9, toZone: 'spore-hollow', toX: 53, toY: 9, direction: 'left' },
      { fromX: 0, fromY: 10, toZone: 'spore-hollow', toX: 53, toY: 10, direction: 'left' },
    ],
  },
  {
    id: 'the-threshold',
    name: 'The Threshold',
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
    grid: SPIRIT_MEADOW,
    playerStart: { tileX: 14, tileY: 1 },
    warps: [
      // North entry back to Mana Springs
      { fromX: 14, fromY: 0, toZone: 'mana-springs', toX: 12, toY: 18, direction: 'up' },
      { fromX: 15, fromY: 0, toZone: 'mana-springs', toX: 13, toY: 18, direction: 'up' },
      // South exit to The Threshold
      { fromX: 14, fromY: 19, toZone: 'the-threshold', toX: 9, toY: 1, direction: 'down' },
      { fromX: 15, fromY: 19, toZone: 'the-threshold', toX: 10, toY: 1, direction: 'down' },
    ],
  },  {
    id: 'moonwell-glade-gregory-s-home',
    name: "Moonwell Glade (Gregory's Home)",
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
]

export const START_ZONE = 'garden'
