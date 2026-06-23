// Per-player placed structures (parallel to furniture system)
import type { TileGroup } from '../world/structures'

export interface PlacedStructure {
  id: string
  structureId: string
  tileX: number  // top-left origin tile
  tileY: number
  zoneId: string
}

export type StructureSave = { structureId: string; tileX: number; tileY: number; zoneId: string }[]

let structIdCounter = 0

export function createPlacedStructure(structureId: string, tileX: number, tileY: number, zoneId: string): PlacedStructure {
  return { id: `pstruct-${structureId}-${tileX}-${tileY}-${++structIdCounter}`, structureId, tileX, tileY, zoneId }
}

export function structuresToSave(placed: PlacedStructure[]): StructureSave {
  return placed.map(p => ({ structureId: p.structureId, tileX: p.tileX, tileY: p.tileY, zoneId: p.zoneId }))
}

export function structuresFromSave(saved: StructureSave | undefined): PlacedStructure[] {
  if (!saved) return []
  return saved.map(s => createPlacedStructure(s.structureId, s.tileX, s.tileY, s.zoneId))
}

/** Check if any tile of a structure footprint overlaps */
export function structureOccupiesTile(tileX: number, tileY: number, zoneId: string, placed: PlacedStructure[], defs: TileGroup[]): boolean {
  for (const p of placed) {
    if (p.zoneId !== zoneId) continue
    const def = defs.find(d => d.id === p.structureId)
    if (!def) continue
    if (tileX >= p.tileX && tileX < p.tileX + def.cols && tileY >= p.tileY && tileY < p.tileY + def.rows) return true
  }
  return false
}
