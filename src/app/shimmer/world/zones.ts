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

import { GARDEN, MYCELIAL_PATH, MOONWELL_GLADE, SPORE_HOLLOW, VORANYX_DEEP, TWILIGHT_THICKET, WOODED_TRAIL, THE_THRESHOLD, MANA_SPRINGS, ROUTE_2, ROUTE_3, THE_OUTFIELDS, GLOVIEW_VILLAGE, SPIRIT_MEADOW, MOONWELL_GLADE_GREGORY_S_HOME, SORREL_HOLD, BRACK_HOLD, TEST_SANDBOX,
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
      // WEST edge → Route One (leads to Mycelial Path)
      { fromX: 0, fromY: 8, toZone: 'route-garden-mycelial', toX: 1, toY: 5, direction: 'left' },
      { fromX: 0, fromY: 9, toZone: 'route-garden-mycelial', toX: 1, toY: 5, direction: 'left' },
      // EAST edge → Moonwell Pass (enter its WEST opening)
      { fromX: 25, fromY: 8, toZone: 'route-moonwell-garden', toX: 1, toY: 28, direction: 'right' },
      { fromX: 25, fromY: 9, toZone: 'route-moonwell-garden', toX: 1, toY: 29, direction: 'right' },
    ],
  },
  {
    id: 'mycelial-path',
    name: 'Mycelial Path',
    element: 'earth',
    grid: MYCELIAL_PATH,
    playerStart: { tileX: 2, tileY: 8 },
    warps: [
      // NORTH → Spirit Meadows (via connector)
      { fromX: 10, fromY: 0, toZone: 'route-mycelial-spirit', toX: 1, toY: 5, direction: 'up' },
      { fromX: 11, fromY: 0, toZone: 'route-mycelial-spirit', toX: 1, toY: 5, direction: 'up' },
      // EAST → Route One → Home Plot
      { fromX: 21, fromY: 7, toZone: 'route-garden-mycelial', toX: 28, toY: 5, direction: 'right' },
      { fromX: 21, fromY: 8, toZone: 'route-garden-mycelial', toX: 28, toY: 5, direction: 'right' },
      // WEST → Wooded Trail (arrive at its east opening, rows 7-8)
      { fromX: 0, fromY: 7, toZone: 'wooded-trail', toX: 25, toY: 8, direction: 'left' },
      { fromX: 0, fromY: 8, toZone: 'wooded-trail', toX: 25, toY: 8, direction: 'left' },
      // SOUTH → Voranyx Caverns (the east arm; provisional until that branch is whiteboarded)
      { fromX: 5, fromY: 15, toZone: 'spore-hollow', toX: 12, toY: 1, direction: 'down' },
      { fromX: 6, fromY: 15, toZone: 'spore-hollow', toX: 13, toY: 1, direction: 'down' },
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
      // Greg's house door (cols 22-23, row 17 — placed in the editor) → his home interior
      { fromX: 22, fromY: 17, toZone: 'moonwell-glade-gregory-s-home', toX: 4, toY: 8, direction: 'up' },
      { fromX: 23, fromY: 17, toZone: 'moonwell-glade-gregory-s-home', toX: 5, toY: 8, direction: 'up' },
    ],
  },
  {
    id: 'spore-hollow',      // Voranyx Caverns — 1st Floor (id kept as spore-hollow)
    name: 'Voranyx Caverns',
    element: 'earth',
    grid: SPORE_HOLLOW,
    playerStart: { tileX: 12, tileY: 1 },
    warps: [
      // TOP (cols 12-13) → up to Mycelial Path (its south opening)
      { fromX: 12, fromY: 0, toZone: 'mycelial-path', toX: 5, toY: 14, direction: 'up' },
      { fromX: 13, fromY: 0, toZone: 'mycelial-path', toX: 5, toY: 14, direction: 'up' },
      // BOTTOM (cols 11-12) → down to Mana Springs (its top opening, cols 8-9)
      { fromX: 11, fromY: 21, toZone: 'mana-springs', toX: 8, toY: 1, direction: 'down' },
      { fromX: 12, fromY: 21, toZone: 'mana-springs', toX: 9, toY: 1, direction: 'down' },
      // RIGHT-edge portal (a) → 2nd Floor (arrive at its left edge)
      { fromX: 25, fromY: 15, toZone: 'voranyx-deep', toX: 1, toY: 11, direction: 'right' },
      { fromX: 25, fromY: 16, toZone: 'voranyx-deep', toX: 1, toY: 12, direction: 'right' },
      // LEFT-edge portal (b) → 2nd Floor (arrive at its top-right)
      { fromX: 0, fromY: 8, toZone: 'voranyx-deep', toX: 22, toY: 1, direction: 'down' },
      { fromX: 0, fromY: 9, toZone: 'voranyx-deep', toX: 23, toY: 1, direction: 'down' },
    ],
  },
  {
    id: 'voranyx-deep',
    name: 'Voranyx Caverns — 2nd Floor',
    element: 'earth',
    grid: VORANYX_DEEP,
    playerStart: { tileX: 1, tileY: 11 },
    warps: [
      // LEFT-edge portal (a) → back to 1st Floor (its right edge)
      { fromX: 0, fromY: 11, toZone: 'spore-hollow', toX: 24, toY: 15, direction: 'left' },
      { fromX: 0, fromY: 12, toZone: 'spore-hollow', toX: 24, toY: 16, direction: 'left' },
      // TOP-right portal (b) → back to 1st Floor (its left edge)
      { fromX: 22, fromY: 0, toZone: 'spore-hollow', toX: 1, toY: 8, direction: 'up' },
      { fromX: 23, fromY: 0, toZone: 'spore-hollow', toX: 1, toY: 9, direction: 'up' },
      // BOTTOM (cols 19-20) = passage to The Silt — LOCKED/sealed in v1 (no warp yet)
    ],
  },
  // --- New zones (song-inspired, placeholder grids) ---
  {
    id: 'twilight-thicket',
    name: 'Twilight Thicket',
    element: 'earth', // future Shimmeroak Thicket (wood/forestry)
    grid: TWILIGHT_THICKET,
    playerStart: { tileX: 12, tileY: 18 },
    warps: [
      // BOTTOM exit (cols 12-13) → back down to Wooded Trail (arrive by its north exit).
      { fromX: 12, fromY: 19, toZone: 'wooded-trail', toX: 4, toY: 2, direction: 'down' },
      { fromX: 13, fromY: 19, toZone: 'wooded-trail', toX: 4, toY: 2, direction: 'down' },
    ],
  },
  {
    id: 'wooded-trail',
    name: 'Wooded Trail',
    element: 'earth', // wooded/forestry pocket between Mycelial Path and Twilight Thicket
    grid: WOODED_TRAIL,
    playerStart: { tileX: 25, tileY: 8 },
    warps: [
      // EAST → back to Mycelial Path (its west opening, rows 7-8)
      { fromX: 27, fromY: 7, toZone: 'mycelial-path', toX: 1, toY: 7, direction: 'right' },
      { fromX: 27, fromY: 8, toZone: 'mycelial-path', toX: 1, toY: 7, direction: 'right' },
      // NORTH (top-left, cols 4-5) → up into Twilight Thicket (arrive at its bottom exit)
      { fromX: 4, fromY: 0, toZone: 'twilight-thicket', toX: 12, toY: 18, direction: 'up' },
      { fromX: 5, fromY: 0, toZone: 'twilight-thicket', toX: 12, toY: 18, direction: 'up' },
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
    grid: MANA_SPRINGS,
    playerStart: { tileX: 8, tileY: 1 },
    warps: [
      // TOP (cols 8-9) → up to Voranyx Caverns 1st Floor (its bottom opening)
      { fromX: 8, fromY: 0, toZone: 'spore-hollow', toX: 11, toY: 20, direction: 'up' },
      { fromX: 9, fromY: 0, toZone: 'spore-hollow', toX: 12, toY: 20, direction: 'up' },
      // LEFT (rows 7-8) → Route 2 (arrive at its right opening, rows 13-14)
      { fromX: 0, fromY: 7, toZone: 'route-2', toX: 28, toY: 13, direction: 'left' },
      { fromX: 0, fromY: 8, toZone: 'route-2', toX: 28, toY: 14, direction: 'left' },
      // (old south→Spirit Meadow + gated east→Sorrel Hold retired — east arm re-laid per
      //  whiteboards; Sorrel/Brack reconnect through the new topology when built.)
    ],
  },
  {
    id: 'route-2',
    name: 'Route 2',
    grid: ROUTE_2,
    playerStart: { tileX: 28, tileY: 13 },
    warps: [
      // RIGHT (rows 13-14) → back to Mana Springs (its left opening, rows 7-8)
      { fromX: 29, fromY: 13, toZone: 'mana-springs', toX: 1, toY: 7, direction: 'right' },
      { fromX: 29, fromY: 14, toZone: 'mana-springs', toX: 1, toY: 8, direction: 'right' },
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
    name: 'Route 3',
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
    name: 'Spirit Meadow',
    element: 'mana',
    grid: SPIRIT_MEADOW,
    playerStart: { tileX: 2, tileY: 8 },
    warps: [
      // BOTTOM-LEFT → Mycelial Path (per Alex's Spirit Meadows whiteboard)
      { fromX: 5, fromY: 15, toZone: 'route-mycelial-spirit', toX: 28, toY: 5, direction: 'down' },
      { fromX: 6, fromY: 15, toZone: 'route-mycelial-spirit', toX: 28, toY: 5, direction: 'down' },
      // BOTTOM-RIGHT → Moonwell Pass
      { fromX: 15, fromY: 15, toZone: 'route-moonwell-garden', toX: 14, toY: 1, direction: 'down' },
      { fromX: 16, fromY: 15, toZone: 'route-moonwell-garden', toX: 15, toY: 1, direction: 'down' },
      // NOTE: the Mana Springs ascent / defeated_thistle gate is re-wired when we whiteboard the east arm.
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
    id: 'moonwell-glade-gregory-s-home',
    name: "Moonwell Glade (Gregory's Home)",
    element: 'water',
    grid: MOONWELL_GLADE_GREGORY_S_HOME,
    playerStart: { tileX: 4, tileY: 8 },
    warps: [
      // Door at the bottom → back out to the Glade, just south of Greg's house door (22-23,17).
      { fromX: 4, fromY: 9, toZone: 'moonwell-glade', toX: 22, toY: 18, direction: 'down' },
      { fromX: 5, fromY: 9, toZone: 'moonwell-glade', toX: 23, toY: 18, direction: 'down' },
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
    name: 'Route One',     // Home Plot WEST ↔ Mycelial Path (per Alex's Home Plot whiteboard)
    grid: ROUTE_GARDEN_MYCELIAL,
    playerStart: { tileX: 2, tileY: 5 },
    warps: [
      { fromX: 0, fromY: 4, toZone: 'garden', toX: 1, toY: 9, direction: 'left' }, // back to Home Plot WEST edge
      { fromX: 0, fromY: 5, toZone: 'garden', toX: 1, toY: 9, direction: 'left' },
      { fromX: 29, fromY: 4, toZone: 'mycelial-path', toX: 20, toY: 7, direction: 'left' }, // arrive at Mycelial EAST
      { fromX: 29, fromY: 5, toZone: 'mycelial-path', toX: 20, toY: 7, direction: 'left' },
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
      { fromX: 29, fromY: 4, toZone: 'spirit-meadow', toX: 5, toY: 14, direction: 'up' }, // arrive at Spirit Meadow bottom-left
      { fromX: 29, fromY: 5, toZone: 'spirit-meadow', toX: 5, toY: 14, direction: 'up' },
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
      { fromX: 0, fromY: 28, toZone: 'garden', toX: 24, toY: 9, direction: 'left' },
      { fromX: 0, fromY: 29, toZone: 'garden', toX: 24, toY: 9, direction: 'left' },
      // EAST door (37,17-18) → Moonwell Glade (its west opening)
      { fromX: 37, fromY: 17, toZone: 'moonwell-glade', toX: 1, toY: 8, direction: 'right' },
      { fromX: 37, fromY: 18, toZone: 'moonwell-glade', toX: 1, toY: 9, direction: 'right' },
      // NORTH door (14-15,0) → Spirit Meadows
      { fromX: 14, fromY: 0, toZone: 'spirit-meadow', toX: 15, toY: 14, direction: 'up' },
      { fromX: 15, fromY: 0, toZone: 'spirit-meadow', toX: 15, toY: 14, direction: 'up' },
    ],
  },
]

export const START_ZONE = 'garden'
