// Garden-chain first-pass maps — code-generated (Serberus, 2026-06-24).
// Alex art-directs the RESULT (shapes, sizes, ponds, exits); he does not hand-paint tiles.
// Each zone = a grass island ringed by a cloud border (gaps = exits); the Ather page
// background shows beyond the cloud. Tweak the RING specs below and rebuild to iterate.

const GRASS = 97   // FT_GRASS_BASE
const PATH = 98    // FT_PATH_BASE
const WATER = 102  // FT_WATER_BASE
const CLOUD = 34   // Cloud 1 (solid border)

export interface ChainWarp {
  fromX: number; fromY: number
  toZone: string; toX: number; toY: number
  direction: 'left' | 'right' | 'up' | 'down'
  requiredFlag?: string
}

interface ChainSpec {
  id: string
  cols: number
  rows: number
  pond?: { x: number; y: number; w: number; h: number }
  pathRow?: boolean // lay a path tile along the mid row (connects W↔E exits)
}

// Ring order. Each zone's EAST exit connects to the next zone's WEST exit; the last
// wraps back to the first. So every zone has a W and an E gap in its cloud border.
const RING: ChainSpec[] = [
  { id: 'garden',                 cols: 26, rows: 18, pond: { x: 3, y: 3, w: 6, h: 4 }, pathRow: true },
  { id: 'route-garden-mycelial',  cols: 30, rows: 10, pathRow: true },
  { id: 'mycelial-path',          cols: 22, rows: 16, pathRow: true },
  { id: 'route-mycelial-spirit',  cols: 30, rows: 10, pathRow: true },
  { id: 'spirit-meadow',          cols: 22, rows: 16, pond: { x: 14, y: 10, w: 4, h: 4 }, pathRow: true },
  { id: 'route-spirit-moonwell',  cols: 30, rows: 10, pathRow: true },
  { id: 'moonwell-glade',         cols: 22, rows: 16, pond: { x: 8, y: 4, w: 6, h: 5 }, pathRow: true },
  { id: 'route-moonwell-garden',  cols: 30, rows: 10, pathRow: true },
]

const midY = (s: ChainSpec) => Math.floor(s.rows / 2)
// 2-tile-tall exit gap centered on the mid row
const gapRows = (s: ChainSpec) => [midY(s) - 1, midY(s)]

function genGrid(s: ChainSpec): number[][] {
  const grid: number[][] = []
  for (let y = 0; y < s.rows; y++) {
    const row: number[] = []
    for (let x = 0; x < s.cols; x++) {
      const edge = x === 0 || y === 0 || x === s.cols - 1 || y === s.rows - 1
      row.push(edge ? CLOUD : GRASS)
    }
    grid.push(row)
  }
  // Pond (water) — placed on the interior; kept off the mid path row by spec.
  if (s.pond) {
    for (let y = s.pond.y; y < s.pond.y + s.pond.h && y < s.rows - 1; y++)
      for (let x = s.pond.x; x < s.pond.x + s.pond.w && x < s.cols - 1; x++)
        if (x > 0 && y > 0) grid[y][x] = WATER
  }
  // Mid path connecting the two exits
  if (s.pathRow) {
    const py = midY(s)
    for (let x = 1; x < s.cols - 1; x++) grid[py][x] = PATH
  }
  // Open the W and E exit gaps in the cloud border (every zone has both)
  for (const gy of gapRows(s)) {
    grid[gy][0] = GRASS
    grid[gy][s.cols - 1] = GRASS
  }
  return grid
}

export const CHAIN_GRIDS: Record<string, number[][]> = {}
for (const s of RING) CHAIN_GRIDS[s.id] = genGrid(s)

// Wire the ring: zone[i] EAST ↔ zone[i+1] WEST (wrapping).
export const CHAIN_WARPS: Record<string, ChainWarp[]> = {}
for (const s of RING) CHAIN_WARPS[s.id] = []
for (let i = 0; i < RING.length; i++) {
  const a = RING[i]
  const b = RING[(i + 1) % RING.length]
  const aMid = midY(a), bMid = midY(b)
  // A's east edge → B's west entry
  for (const gy of gapRows(a)) {
    CHAIN_WARPS[a.id].push({ fromX: a.cols - 1, fromY: gy, toZone: b.id, toX: 1, toY: bMid, direction: 'right' })
  }
  // B's west edge → A's east entry
  for (const gy of gapRows(b)) {
    CHAIN_WARPS[b.id].push({ fromX: 0, fromY: gy, toZone: a.id, toX: a.cols - 2, toY: aMid, direction: 'left' })
  }
}

// Sensible spawn: just inside the west gap.
export const CHAIN_SPAWNS: Record<string, { tileX: number; tileY: number }> = {}
for (const s of RING) CHAIN_SPAWNS[s.id] = { tileX: 2, tileY: midY(s) }
