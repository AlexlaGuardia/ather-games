// Furniture system — placeable world objects with interactions
// Definitions + sprites live in sprites/furniture.ts
// This file handles placement, interaction, and save/load

export { FURNITURE_DEFS } from '../sprites/furniture'
export type { FurnitureDef } from '../sprites/furniture'

export interface PlacedFurniture {
  id: string
  furnitureId: string
  tileX: number
  tileY: number
  zoneId: string
}

let furnIdCounter = 0

/** Create a new placed furniture instance */
export function createFurniture(furnitureId: string, tileX: number, tileY: number, zoneId: string): PlacedFurniture {
  return {
    id: `furn-${furnitureId}-${tileX}-${tileY}-${++furnIdCounter}`,
    furnitureId,
    tileX,
    tileY,
    zoneId,
  }
}

/**
 * Find a furniture piece adjacent to the player (4-directional + standing on).
 * Returns the closest one, or null.
 */
export function findAdjacentFurniture(
  playerTileX: number,
  playerTileY: number,
  zoneId: string,
  furniture: PlacedFurniture[],
): PlacedFurniture | null {
  const checks = [
    [playerTileX, playerTileY],
    [playerTileX, playerTileY - 1],
    [playerTileX, playerTileY + 1],
    [playerTileX - 1, playerTileY],
    [playerTileX + 1, playerTileY],
  ]
  for (const [x, y] of checks) {
    const found = furniture.find(f => f.tileX === x && f.tileY === y && f.zoneId === zoneId)
    if (found) return found
  }
  return null
}

/** Check if a tile has furniture on it */
export function furnitureAtTile(tileX: number, tileY: number, zoneId: string, furniture: PlacedFurniture[]): boolean {
  return furniture.some(f => f.tileX === tileX && f.tileY === tileY && f.zoneId === zoneId)
}

// ============================================
// Save/Load
// ============================================

export type FurnitureSave = { furnitureId: string; tileX: number; tileY: number; zoneId: string }[]

export function furnitureToSave(furniture: PlacedFurniture[]): FurnitureSave {
  return furniture.map(f => ({
    furnitureId: f.furnitureId,
    tileX: f.tileX,
    tileY: f.tileY,
    zoneId: f.zoneId,
  }))
}

export function furnitureFromSave(saved: FurnitureSave | undefined): PlacedFurniture[] {
  if (!saved) return []
  return saved.map(s => createFurniture(s.furnitureId, s.tileX, s.tileY, s.zoneId))
}
