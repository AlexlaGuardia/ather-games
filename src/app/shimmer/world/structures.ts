// Structure system — multi-tile compositions from existing tiles
// Structures are templates: once stamped onto a zone, they become regular tiles

export interface TileGroupCell {
  tileIdx: number    // index into TILES array (0-37)
  rotation: number   // 0-3 (90 deg CW increments)
}

export interface TileGroup {
  id: string
  name: string
  cols: number       // 2-8
  rows: number       // 2-8
  cells: (TileGroupCell | null)[][]  // [row][col], null = empty
  category?: string  // 'building' | 'decoration' | 'bridge' | 'custom'
}
