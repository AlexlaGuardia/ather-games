// Placed structure system — multi-tile structures placed as overlays on maps
// Unlike furniture (single-tile, interactive), structures are decorative overlays
// Each cell of a placed structure renders on top of the base tile grid
// Tiles marked ABOVE render after entities (walk-under effect for arches, etc.)

import type { TileGroup } from '../world/structures'

export interface PlacedStructure {
  id: string
  structureId: string   // references TileGroup.id
  tileX: number         // top-left tile position
  tileY: number         // top-left tile position
  zoneId: string
}

let structIdCounter = 0

export function createPlacedStructure(structureId: string, tileX: number, tileY: number, zoneId: string): PlacedStructure {
  return {
    id: `struct-${structureId}-${tileX}-${tileY}-${++structIdCounter}`,
    structureId,
    tileX,
    tileY,
    zoneId,
  }
}

/** Check if any structure cell occupies a specific tile */
export function structureAtTile(
  tileX: number,
  tileY: number,
  zoneId: string,
  structures: PlacedStructure[],
  structureDefs: Record<string, TileGroup>,
): PlacedStructure | null {
  for (const s of structures) {
    if (s.zoneId !== zoneId) continue
    const def = structureDefs[s.structureId]
    if (!def) continue
    if (tileX >= s.tileX && tileX < s.tileX + def.cols &&
        tileY >= s.tileY && tileY < s.tileY + def.rows) {
      const cell = def.cells[tileY - s.tileY]?.[tileX - s.tileX]
      if (cell) return s
    }
  }
  return null
}

// Save/Load
export type PlacedStructureSave = { structureId: string; tileX: number; tileY: number; zoneId: string }[]

export function placedStructuresToSave(structures: PlacedStructure[]): PlacedStructureSave {
  return structures.map(s => ({
    structureId: s.structureId,
    tileX: s.tileX,
    tileY: s.tileY,
    zoneId: s.zoneId,
  }))
}

export function placedStructuresFromSave(saved: PlacedStructureSave | undefined): PlacedStructure[] {
  if (!saved) return []
  return saved.map(s => createPlacedStructure(s.structureId, s.tileX, s.tileY, s.zoneId))
}
