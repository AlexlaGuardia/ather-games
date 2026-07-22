// Per-zone terrain height — integer tiers (Minecraft-style BLOCKY terrain, terrain only).
// SAVED heights (sculpted in the 3D view → /shimmer/save-heights) live in heightmaps.json.
// A small DEMO fallback shows until a zone is sculpted + saved. Default = flat (all 0).
import SAVED from './heightmaps.json'

const SAVED_HEIGHTS = SAVED as Record<string, number[][]>

// Live on-disk heights fetched at boot (see /shimmer/world-data) — newer than the compiled
// import whenever a sculpt was saved since the last build. Checked first when set.
let LIVE_HEIGHTS: Record<string, number[][]> | null = null
export function setLiveHeights(h: Record<string, number[][]>) { LIVE_HEIGHTS = h }

// Demo fallback (Moonwell Glade pyramid) — only shown until real heights are sculpted + saved.
const DEMO: Record<string, number[][]> = {}
DEMO['moonwell-glade'] = (() => {
  const g = Array.from({ length: 18 }, () => new Array<number>(24).fill(0))
  const cx = 5, cy = 9
  for (let r = 0; r < 18; r++) for (let c = 0; c < 24; c++) {
    const d = Math.max(Math.abs(c - cx), Math.abs(r - cy))
    if (d <= 1) g[r][c] = 3
    else if (d === 2) g[r][c] = 2
    else if (d === 3) g[r][c] = 1
  }
  return g
})()

// Returns a fresh COPY (the 3D sculpt brush mutates it in place; never touch the import).
export function getHeightGrid(zoneId: string, rows: number, cols: number): number[][] {
  const h = LIVE_HEIGHTS?.[zoneId] ?? SAVED_HEIGHTS[zoneId] ?? DEMO[zoneId]
  if (h && h.length === rows && h[0]?.length === cols) return h.map((row) => [...row])
  return Array.from({ length: rows }, () => new Array(cols).fill(0))
}
