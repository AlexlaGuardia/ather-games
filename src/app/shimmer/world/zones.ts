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

import { GARDEN, MYCELIAL_PATH, MOONWELL_GLADE, SPORE_HOLLOW, VORANYX_DEEP, TWILIGHT_THICKET, WOODED_TRAIL, THE_THRESHOLD, MANA_SPRINGS, ROUTE_2, ROUTE_3, THE_OUTFIELDS, GLOVIEW_VILLAGE, SPIRIT_MEADOW, MOONWELL_GLADE_GREGORY_S_HOME, SPIRIT_CORNER, SORREL_HOLD, BRACK_HOLD, TEST_SANDBOX,
  FLAT_TERRAIN_DEMO,
  FP_GARDEN, FP_LARGE_1, FP_LARGE_2, FP_LARGE_3, FP_MED_1, FP_MED_2, FP_MED_3, FP_MED_4, FP_HUGE,
  ROUTE_GARDEN_MYCELIAL, ROUTE_MYCELIAL_SPIRIT, ROUTE_SPIRIT_MOONWELL, ROUTE_MOONWELL_GARDEN } from './tilemap'
export const ZONES: Zone[] = [
  {
    id: 'garden',            // keep id stable (referenced widely); display = the player's own plot
    name: 'Home Plot',
    grid: GARDEN, // 32x32, redesigned in the editor by Alex
    playerStart: { tileX: 30, tileY: 9 },
    warps: [
      // NORTH GATE (14-15,1) → The Spirit Corner (Gregory's shop, Rune Hold) — the canon
      // permanent gate, walked from our side. TODO(gate-placement): provisional spot, Alex's eye.
      { fromX: 14, fromY: 1, toZone: 'spirit-corner', toX: 7, toY: 10, direction: 'up' },
      { fromX: 15, fromY: 1, toZone: 'spirit-corner', toX: 8, toY: 10, direction: 'up' },
      // LEFT door (0,11-12, placed in the editor) → Route 1 (leads to Mycelial Path)
      { fromX: 0, fromY: 11, toZone: 'route-garden-mycelial', toX: 58, toY: 7, direction: 'left' }, // arrive at Route 1's E door
      { fromX: 0, fromY: 12, toZone: 'route-garden-mycelial', toX: 58, toY: 8, direction: 'left' },
      // RIGHT door (31,9-10) → Moonwell Pass (its west door interior)
      { fromX: 31, fromY: 9, toZone: 'route-moonwell-garden', toX: 1, toY: 28, direction: 'right' },
      { fromX: 31, fromY: 10, toZone: 'route-moonwell-garden', toX: 1, toY: 29, direction: 'right' },
    ],
  },
  {
    id: 'mycelial-path',
    name: 'Mycelial Path',
    element: 'earth',
    grid: MYCELIAL_PATH, // 50x30, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 1, tileY: 7 },
    warps: [
      // R door (29,14-15, placed in the editor) → Route 1 (Home Plot)
      { fromX: 29, fromY: 14, toZone: 'route-garden-mycelial', toX: 1, toY: 13, direction: 'right' }, // arrive at Route 1's W door
      { fromX: 29, fromY: 15, toZone: 'route-garden-mycelial', toX: 1, toY: 14, direction: 'right' },
      // L door (0,7-8) → Wooded Trail (its E door)
      { fromX: 0, fromY: 7, toZone: 'wooded-trail', toX: 48, toY: 11, direction: 'left' },
      { fromX: 0, fromY: 8, toZone: 'wooded-trail', toX: 48, toY: 12, direction: 'left' },
      // N door (15-16,0) → Spirit Meadows (its south-left door)
      { fromX: 15, fromY: 0, toZone: 'spirit-meadow', toX: 10, toY: 38, direction: 'up' },
      { fromX: 16, fromY: 0, toZone: 'spirit-meadow', toX: 11, toY: 38, direction: 'up' },
      // S door (8-9,49) → Voranyx Caverns 1st Floor (its N door) — closes the loop Alex flagged
      { fromX: 8, fromY: 49, toZone: 'spore-hollow', toX: 15, toY: 1, direction: 'down' },
      { fromX: 9, fromY: 49, toZone: 'spore-hollow', toX: 16, toY: 1, direction: 'down' },
    ],
  },
  {
    id: 'moonwell-glade',
    name: 'Moonwell Glade',
    element: 'water',
    grid: MOONWELL_GLADE,
    playerStart: { tileX: 1, tileY: 8 },
    warps: [
      // LEFT (rows 8-9) → Moonwell Pass (enter its east opening)
      { fromX: 0, fromY: 8, toZone: 'route-moonwell-garden', toX: 36, toY: 17, direction: 'left' },
      { fromX: 0, fromY: 9, toZone: 'route-moonwell-garden', toX: 36, toY: 18, direction: 'left' },
      // Greg's house door (cols 22-23, row 17 — placed in the editor) → his home interior.
      // Redesigned interior (30x28): door is the bottom vestibule (warp tiles 14-15,22); arrive on
      // the entry floor just above it (14-15,21), facing up into the house.
      { fromX: 22, fromY: 17, toZone: 'moonwell-glade-gregory-s-home', toX: 14, toY: 21, direction: 'up' },
      { fromX: 23, fromY: 17, toZone: 'moonwell-glade-gregory-s-home', toX: 15, toY: 21, direction: 'up' },
    ],
  },
  {
    id: 'spore-hollow',      // Voranyx Caverns — 1st Floor (id kept as spore-hollow)
    name: 'Voranyx Caverns',
    element: 'earth',
    grid: SPORE_HOLLOW, // 60x32, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 15, tileY: 1 },
    warps: [
      // N door (15-16,0) → Mycelial Path (its S door) — two-way now (Alex added the return door)
      { fromX: 15, fromY: 0, toZone: 'mycelial-path', toX: 8, toY: 48, direction: 'up' },
      { fromX: 16, fromY: 0, toZone: 'mycelial-path', toX: 9, toY: 48, direction: 'up' },
      // S door (23-24,59) → Mana Springs (its N door)
      { fromX: 23, fromY: 59, toZone: 'mana-springs', toX: 30, toY: 1, direction: 'down' },
      { fromX: 24, fromY: 59, toZone: 'mana-springs', toX: 31, toY: 1, direction: 'down' },
      // E door (31,17-18) → 2nd Floor's E door (east wall)
      { fromX: 31, fromY: 17, toZone: 'voranyx-deep', toX: 30, toY: 15, direction: 'left' },
      { fromX: 31, fromY: 18, toZone: 'voranyx-deep', toX: 30, toY: 16, direction: 'left' },
      // W door (0,49-50) → 2nd Floor's W door (west wall)
      { fromX: 0, fromY: 49, toZone: 'voranyx-deep', toX: 1, toY: 34, direction: 'right' },
      { fromX: 0, fromY: 50, toZone: 'voranyx-deep', toX: 1, toY: 35, direction: 'right' },
    ],
  },
  {
    id: 'voranyx-deep',
    name: 'Voranyx Caverns — 2nd Floor',
    element: 'earth',
    grid: VORANYX_DEEP, // 60x32, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 30, tileY: 15 },
    warps: [
      // E door (31,15-16) → 1st Floor's E door (east wall)
      { fromX: 31, fromY: 15, toZone: 'spore-hollow', toX: 30, toY: 17, direction: 'left' },
      { fromX: 31, fromY: 16, toZone: 'spore-hollow', toX: 30, toY: 18, direction: 'left' },
      // W door (0,34-35) → 1st Floor's W door (west wall)
      { fromX: 0, fromY: 34, toZone: 'spore-hollow', toX: 1, toY: 49, direction: 'right' },
      { fromX: 0, fromY: 35, toZone: 'spore-hollow', toX: 1, toY: 50, direction: 'right' },
      // S door (28-29,59) = passage to The Silt — LOCKED + unreachable by design in v1 (no warp).
    ],
  },
  // --- New zones (song-inspired, placeholder grids) ---
  {
    id: 'twilight-thicket',
    name: 'Twilight Thicket',
    element: 'earth', // future Shimmeroak Thicket (wood/forestry)
    grid: TWILIGHT_THICKET, // 100x80, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 78, tileY: 51 },
    warps: [
      // E door (79,51-52, placed in the editor) — the only door → Wooded Trail (its W door)
      { fromX: 79, fromY: 51, toZone: 'wooded-trail', toX: 1, toY: 11, direction: 'right' },
      { fromX: 79, fromY: 52, toZone: 'wooded-trail', toX: 1, toY: 12, direction: 'right' },
    ],
  },
  {
    id: 'wooded-trail',
    name: 'Wooded Trail',
    element: 'earth', // wooded/forestry pocket between Mycelial Path and Twilight Thicket
    grid: WOODED_TRAIL, // 30x50, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 48, tileY: 11 },
    warps: [
      // E door (49,11-12, placed in the editor) → Mycelial Path (its L door)
      { fromX: 49, fromY: 11, toZone: 'mycelial-path', toX: 1, toY: 7, direction: 'right' },
      { fromX: 49, fromY: 12, toZone: 'mycelial-path', toX: 1, toY: 8, direction: 'right' },
      // W door (0,11-12) → Twilight Thicket (its E door)
      { fromX: 0, fromY: 11, toZone: 'twilight-thicket', toX: 78, toY: 51, direction: 'left' },
      { fromX: 0, fromY: 12, toZone: 'twilight-thicket', toX: 78, toY: 52, direction: 'left' },
    ],
  },
  {
    id: 'the-threshold',     // retheme → Ather Winds (the sealed gate to the Wilds; seeds ride in from here)
    name: 'Ather Winds',
    element: 'storm', // frontier edge — the sealed door to the Wilds expansion
    grid: THE_THRESHOLD,
    playerStart: { tileX: 9, tileY: 1 },
    warps: [
      // North entry back to Brack Hold
      { fromX: 9, fromY: 0, toZone: 'brack-hold', toX: 19, toY: 28, direction: 'up' },
      { fromX: 10, fromY: 0, toZone: 'brack-hold', toX: 20, toY: 28, direction: 'up' },
    ],
  },
  {
    id: 'mana-springs',
    name: 'Mana Springs',
    element: 'earth', // mining / ore
    grid: MANA_SPRINGS, // 100x100, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 30, tileY: 1 },
    warps: [
      // N door (30-31,0) → Voranyx Caverns 1st Floor (its S door)
      { fromX: 30, fromY: 0, toZone: 'spore-hollow', toX: 23, toY: 58, direction: 'up' },
      { fromX: 31, fromY: 0, toZone: 'spore-hollow', toX: 24, toY: 58, direction: 'up' },
      // W door (0,76-77) → Route Two (its right opening)
      { fromX: 0, fromY: 76, toZone: 'route-2', toX: 28, toY: 13, direction: 'left' },
      { fromX: 0, fromY: 77, toZone: 'route-2', toX: 28, toY: 14, direction: 'left' },
    ],
  },
  {
    id: 'route-2',
    name: 'Route Two',
    grid: ROUTE_2,
    playerStart: { tileX: 28, tileY: 13 },
    warps: [
      // RIGHT (rows 13-14) → back to Mana Springs (its W door)
      { fromX: 29, fromY: 13, toZone: 'mana-springs', toX: 1, toY: 76, direction: 'right' },
      { fromX: 29, fromY: 14, toZone: 'mana-springs', toX: 1, toY: 77, direction: 'right' },
      // LEFT (rows 2-3) → Gloview Village (arrive at its right opening, rows 11-12)
      { fromX: 0, fromY: 2, toZone: 'gloview-village', toX: 32, toY: 11, direction: 'left' },
      { fromX: 0, fromY: 3, toZone: 'gloview-village', toX: 32, toY: 12, direction: 'left' },
    ],
  },
  {
    id: 'gloview-village',
    name: 'Gloview Village',
    grid: GLOVIEW_VILLAGE,
    playerStart: { tileX: 32, tileY: 11 },
    warps: [
      // RIGHT (rows 11-12) → back to Route 2 (its left opening, rows 2-3)
      { fromX: 33, fromY: 11, toZone: 'route-2', toX: 1, toY: 2, direction: 'right' },
      { fromX: 33, fromY: 12, toZone: 'route-2', toX: 1, toY: 3, direction: 'right' },
      // BOTTOM-LEFT (cols 2-3) → Route 3 (arrive at its north opening)
      { fromX: 2, fromY: 21, toZone: 'route-3', toX: 10, toY: 1, direction: 'down' },
      { fromX: 3, fromY: 21, toZone: 'route-3', toX: 11, toY: 1, direction: 'down' },
      // SORREL compound door (gap in the pen's left wall) → the sorrel-hold arena.
      // Ungated for now; the Thistle progression-gate gets added in the F2P gating pass.
      { fromX: 20, fromY: 6, toZone: 'sorrel-hold', toX: 1, toY: 14, direction: 'right' },
      { fromX: 20, fromY: 7, toZone: 'sorrel-hold', toX: 1, toY: 15, direction: 'right' },
    ],
  },
  {
    id: 'route-3',
    name: 'Route Three',
    grid: ROUTE_3,
    playerStart: { tileX: 10, tileY: 1 },
    warps: [
      // TOP → back up to Gloview Village (its bottom-left opening, cols 2-3)
      { fromX: 10, fromY: 0, toZone: 'gloview-village', toX: 2, toY: 20, direction: 'up' },
      { fromX: 11, fromY: 0, toZone: 'gloview-village', toX: 3, toY: 20, direction: 'up' },
      // BOTTOM-RIGHT (cols 18-19) → The Outfields (arrive at its north opening, cols 6-7)
      { fromX: 18, fromY: 27, toZone: 'the-outfields', toX: 6, toY: 1, direction: 'down' },
      { fromX: 19, fromY: 27, toZone: 'the-outfields', toX: 7, toY: 1, direction: 'down' },
    ],
  },
  {
    id: 'the-outfields',
    name: 'The Outfields',
    element: 'earth',
    grid: THE_OUTFIELDS,
    playerStart: { tileX: 6, tileY: 1 },
    warps: [
      // NORTH (cols 6-7) → back up to Route 3 (its bottom opening, cols 18-19)
      { fromX: 6, fromY: 0, toZone: 'route-3', toX: 18, toY: 26, direction: 'up' },
      { fromX: 7, fromY: 0, toZone: 'route-3', toX: 19, toY: 26, direction: 'up' },
    ],
  },
  {
    id: 'spirit-meadow',
    name: 'Spirit Meadows',
    element: 'mana',
    grid: SPIRIT_MEADOW, // 40x80, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 10, tileY: 38 },
    warps: [
      // SOUTH-LEFT door (10-11,39, placed in the editor) → Mycelial Path (its N door)
      { fromX: 10, fromY: 39, toZone: 'mycelial-path', toX: 15, toY: 1, direction: 'down' },
      { fromX: 11, fromY: 39, toZone: 'mycelial-path', toX: 16, toY: 1, direction: 'down' },
      // SOUTH-RIGHT door (69-70,39) → Moonwell Pass (its north door interior)
      { fromX: 69, fromY: 39, toZone: 'route-moonwell-garden', toX: 14, toY: 1, direction: 'down' },
      { fromX: 70, fromY: 39, toZone: 'route-moonwell-garden', toX: 15, toY: 1, direction: 'down' },
    ],
  },
  {
    id: 'sorrel-hold',
    name: 'Sorrel Hold',
    element: 'earth',
    grid: SORREL_HOLD,
    playerStart: { tileX: 2, tileY: 14 },
    warps: [
      // Return west to Gloview Village (back to the Sorrel compound door)
      { fromX: 0, fromY: 14, toZone: 'gloview-village', toX: 19, toY: 6, direction: 'left' },
      { fromX: 0, fromY: 15, toZone: 'gloview-village', toX: 19, toY: 7, direction: 'left' },
      // Forward east to Brack Hold (gated: need defeated_sorrel)
      { fromX: 39, fromY: 14, toZone: 'brack-hold', toX: 1, toY: 14, direction: 'right', requiredFlag: 'defeated_sorrel' },
      { fromX: 39, fromY: 15, toZone: 'brack-hold', toX: 1, toY: 15, direction: 'right', requiredFlag: 'defeated_sorrel' },
    ],
  },
  {
    id: 'brack-hold',
    name: 'Brack Hold',
    element: 'storm',
    grid: BRACK_HOLD,
    playerStart: { tileX: 2, tileY: 14 },
    warps: [
      // Return west to Sorrel Hold (open)
      { fromX: 0, fromY: 14, toZone: 'sorrel-hold', toX: 38, toY: 14, direction: 'left' },
      { fromX: 0, fromY: 15, toZone: 'sorrel-hold', toX: 38, toY: 15, direction: 'left' },
      // Forward south to Ather Winds (gated: need defeated_brack)
      { fromX: 19, fromY: 29, toZone: 'the-threshold', toX: 9, toY: 1, direction: 'down', requiredFlag: 'defeated_brack' },
      { fromX: 20, fromY: 29, toZone: 'the-threshold', toX: 10, toY: 1, direction: 'down', requiredFlag: 'defeated_brack' },
    ],
  },
  {
    id: 'spirit-corner',
    name: 'The Spirit Corner',
    grid: SPIRIT_CORNER,
    playerStart: { tileX: 7, tileY: 9 },
    warps: [
      // the permanent gate home — south opening back to the Home Plot
      { fromX: 7, fromY: 11, toZone: 'garden', toX: 14, toY: 2, direction: 'down' },
      { fromX: 8, fromY: 11, toZone: 'garden', toX: 15, toY: 2, direction: 'down' },
    ],
  },
  {
    id: 'moonwell-glade-gregory-s-home',
    name: "Moonwell Glade (Gregory's Home)",
    element: 'water',
    grid: MOONWELL_GLADE_GREGORY_S_HOME,
    playerStart: { tileX: 14, tileY: 21 },
    warps: [
      // Exit = the bottom vestibule door tiles (14-15,22) → back out to the Glade, just south of
      // Greg's house door (22-23,17).
      { fromX: 14, fromY: 22, toZone: 'moonwell-glade', toX: 22, toY: 18, direction: 'down' },
      { fromX: 15, fromY: 22, toZone: 'moonwell-glade', toX: 23, toY: 18, direction: 'down' },
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
    name: 'Route One',     // Home Plot ↔ Mycelial Path
    grid: ROUTE_GARDEN_MYCELIAL, // 50x60, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 58, tileY: 7 },
    warps: [
      // E door (59,7-8, placed in the editor) → Home Plot (its left door)
      { fromX: 59, fromY: 7, toZone: 'garden', toX: 1, toY: 11, direction: 'right' },
      { fromX: 59, fromY: 8, toZone: 'garden', toX: 1, toY: 12, direction: 'right' },
      // W door (0,13-14) → Mycelial Path (its R door)
      { fromX: 0, fromY: 13, toZone: 'mycelial-path', toX: 28, toY: 14, direction: 'left' },
      { fromX: 0, fromY: 14, toZone: 'mycelial-path', toX: 28, toY: 15, direction: 'left' },
    ],
  },
  {
    id: 'route-mycelial-spirit',
    name: 'Mycelial Path–Spirit Meadow',
    grid: ROUTE_MYCELIAL_SPIRIT,
    playerStart: { tileX: 2, tileY: 5 },
    warps: [
      { fromX: 0, fromY: 4, toZone: 'mycelial-path', toX: 10, toY: 1, direction: 'down' }, // arrive at Mycelial NORTH
      { fromX: 0, fromY: 5, toZone: 'mycelial-path', toX: 10, toY: 1, direction: 'down' },
      { fromX: 29, fromY: 4, toZone: 'spirit-meadow', toX: 10, toY: 38, direction: 'up' }, // arrive at Spirit Meadow's south-left door
      { fromX: 29, fromY: 5, toZone: 'spirit-meadow', toX: 11, toY: 38, direction: 'up' },
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
    name: 'Moonwell Pass',     // 3-way hub (W→Home Plot, N→Spirit Meadows, E→Moonwell Glade)
    grid: ROUTE_MOONWELL_GARDEN, // 52x38, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 14, tileY: 1 },
    warps: [
      // WEST door (0,28-29 — placed in the editor) → Home Plot
      { fromX: 0, fromY: 28, toZone: 'garden', toX: 30, toY: 9, direction: 'left' }, // arrive at Home Plot's right door
      { fromX: 0, fromY: 29, toZone: 'garden', toX: 30, toY: 10, direction: 'left' },
      // EAST door (37,17-18) → Moonwell Glade (its west opening)
      { fromX: 37, fromY: 17, toZone: 'moonwell-glade', toX: 1, toY: 8, direction: 'right' },
      { fromX: 37, fromY: 18, toZone: 'moonwell-glade', toX: 1, toY: 9, direction: 'right' },
      // NORTH door (14-15,0) → Spirit Meadows
      { fromX: 14, fromY: 0, toZone: 'spirit-meadow', toX: 69, toY: 38, direction: 'up' }, // arrive at Spirit Meadow's south-right door
      { fromX: 15, fromY: 0, toZone: 'spirit-meadow', toX: 70, toY: 38, direction: 'up' },
    ],
  },
]

export const START_ZONE = 'garden'
