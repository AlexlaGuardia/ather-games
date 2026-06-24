// Default auto-layer rules for the flat-design tileset
// IntGrid semantic values: 1=grass  2=path  3=water  (clouds = existing tiles, hand-placed)
//
// Pattern layout:
//   [0][1][2]
//   [3][4][5]   <-- center is [4]
//   [6][7][8]
// -1 = any, 0 = empty/other, N = specific intValue
//
// Rotation: 0=top-edge, 1=right-edge, 2=bottom-edge, 3=left-edge
// Priority: corner > edge > base (higher = checked first)

import type { AutoLayerRule } from '../dev/editors/autolayer-engine'

// FLAT_TILES export was removed when the tileset went pixel-art (Alex's call, 2026-06-24).
// Hardcode the indices that still exist. Water edge/corner tiles (103-105) were dropped,
// so those transitional rules are gone — water is base-fill only now.
const FT_GRASS_BASE = 97
const FT_PATH_BASE = 98, FT_PATH_EDGE = 99, FT_PATH_CORNER_OUT = 100, FT_PATH_CORNER_IN = 101
const FT_WATER_BASE = 102

let _id = 0
function rid(prefix: string) { return `${prefix}_${++_id}` }

// Helper: build all 4 rotation variants for an edge rule
function edgeRules(
  intValue: number,
  tileIdx: number,
  basePattern: (number | -1)[],
): AutoLayerRule[] {
  const rotatePattern = (p: (number | -1)[], times: number): (number | -1)[] => {
    // Rotate 3x3 pattern 90° clockwise once
    // [0,1,2,3,4,5,6,7,8] → [6,3,0,7,4,1,8,5,2]
    const once = [p[6], p[3], p[0], p[7], p[4], p[1], p[8], p[5], p[2]]
    if (times === 1) return once
    return rotatePattern(once, times - 1)
  }
  return [0, 1, 2, 3].map(rot => ({
    id: rid(`e${intValue}_${tileIdx}`),
    name: `Auto${intValue}_tile${tileIdx}_rot${rot}`,
    intValue,
    pattern: rot === 0 ? basePattern : rotatePattern(basePattern, rot),
    outputTileIdx: tileIdx,
    outputRotation: rot,
    priority: 20,
    enabled: true,
  }))
}

// Helper: build all 4 rotation variants for a corner rule
function cornerRules(
  intValue: number,
  tileIdx: number,
  basePattern: (number | -1)[],
): AutoLayerRule[] {
  const rotatePattern = (p: (number | -1)[], times: number): (number | -1)[] => {
    const once = [p[6], p[3], p[0], p[7], p[4], p[1], p[8], p[5], p[2]]
    if (times === 1) return once
    return rotatePattern(once, times - 1)
  }
  return [0, 1, 2, 3].map(rot => ({
    id: rid(`c${intValue}_${tileIdx}`),
    name: `Auto${intValue}_tile${tileIdx}_rot${rot}`,
    intValue,
    pattern: rot === 0 ? basePattern : rotatePattern(basePattern, rot),
    outputTileIdx: tileIdx,
    outputRotation: rot,
    priority: 30,
    enabled: true,
  }))
}

// ── Grass (intValue 1) ─────────────────────────────────────────────────────
// Grass has no transitional pieces — base fill only.
const GRASS_RULES: AutoLayerRule[] = [
  {
    id: rid('grass_base'),
    name: 'Grass Base',
    intValue: 1,
    pattern: [-1, -1, -1, -1, 1, -1, -1, -1, -1],
    outputTileIdx: FT_GRASS_BASE,
    outputRotation: 0,
    priority: 1,
    enabled: true,
  },
]

// ── Path (intValue 2) ──────────────────────────────────────────────────────
// Outer corner top-left: this cell = path, top = non-path, left = non-path
// Pattern: [0=non-path, 0=non-path, -1, 0=non-path, 2, -1, -1, -1, -1]
const PATH_CORNER_OUT_BASE: (number | -1)[] = [0, 0, -1, 0, 2, -1, -1, -1, -1]
// Inner corner top-left: this cell = path, top-left neighbor = non-path but top and left = path
// Pattern: [0=non-path, 2, -1, 2, 2, -1, -1, -1, -1]
const PATH_CORNER_IN_BASE: (number | -1)[] = [0, 2, -1, 2, 2, -1, -1, -1, -1]
// Edge top: top = non-path, left and right = path, bottom = path
const PATH_EDGE_BASE: (number | -1)[] = [-1, 0, -1, -1, 2, -1, -1, 2, -1]

const PATH_RULES: AutoLayerRule[] = [
  // Base fill — lowest priority
  {
    id: rid('path_base'),
    name: 'Path Base',
    intValue: 2,
    pattern: [-1, -1, -1, -1, 2, -1, -1, -1, -1],
    outputTileIdx: FT_PATH_BASE,
    outputRotation: 0,
    priority: 1,
    enabled: true,
  },
  // Edges (priority 20)
  ...edgeRules(2, FT_PATH_EDGE, PATH_EDGE_BASE),
  // Outer corners (priority 30, beat edges)
  ...cornerRules(2, FT_PATH_CORNER_OUT, PATH_CORNER_OUT_BASE),
  // Inner corners (priority 25, between edge and outer corner)
  ...cornerRules(2, FT_PATH_CORNER_IN, PATH_CORNER_IN_BASE).map(r => ({ ...r, priority: 25 })),
]

// ── Water (intValue 3) ─────────────────────────────────────────────────────
// Base fill only — the edge/corner tiles (103-105) were dropped in the pixel-art switch.
const WATER_RULES: AutoLayerRule[] = [
  {
    id: rid('water_base'),
    name: 'Water Base',
    intValue: 3,
    pattern: [-1, -1, -1, -1, 3, -1, -1, -1, -1],
    outputTileIdx: FT_WATER_BASE,
    outputRotation: 0,
    priority: 1,
    enabled: true,
  },
]

// Stone family dropped — Shimmer's borders are CLOUDS (existing old-palette cloud
// tiles, hand-placed) and the void beyond is the Ather page background, not tiles.
// Flat tiles T106-T109 remain defined but unused.

// ── Combined export ────────────────────────────────────────────────────────
export const DEFAULT_AUTOLAYER_RULES: AutoLayerRule[] = [
  ...GRASS_RULES,
  ...PATH_RULES,
  ...WATER_RULES,
]
