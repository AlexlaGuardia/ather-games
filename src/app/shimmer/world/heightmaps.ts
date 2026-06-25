// Per-zone terrain height — integer tiers (Minecraft-style BLOCKY terrain, terrain only).
// Default for any zone = flat (all 0). The sculpt brush (BlockoutEditor, next) will author and
// save these per zone; for now ZONE_HEIGHTS holds hand/demo patterns.

export const ZONE_HEIGHTS: Record<string, number[][]> = {}

// DEMO pattern for Moonwell Glade (18 rows x 24 cols) so we can see + walk blocky tiers before
// the sculpt brush exists. A 3-tier stepped pyramid on open ground near spawn — unmistakable.
// REMOVE/replace once the editor writes real heights; this is a render/feel test, not a design.
ZONE_HEIGHTS['moonwell-glade'] = (() => {
  const g = Array.from({ length: 18 }, () => new Array<number>(24).fill(0))
  const cx = 5, cy = 9 // open floor just south of spawn
  for (let r = 0; r < 18; r++) for (let c = 0; c < 24; c++) {
    const d = Math.max(Math.abs(c - cx), Math.abs(r - cy))
    if (d <= 1) g[r][c] = 3
    else if (d === 2) g[r][c] = 2
    else if (d === 3) g[r][c] = 1
  }
  return g
})()

export function getHeightGrid(zoneId: string, rows: number, cols: number): number[][] {
  const h = ZONE_HEIGHTS[zoneId]
  if (h && h.length === rows && h[0]?.length === cols) return h
  return Array.from({ length: rows }, () => new Array(cols).fill(0))
}
