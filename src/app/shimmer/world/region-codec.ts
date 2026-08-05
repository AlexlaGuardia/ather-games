// Region-map file codec — the 2026-07-31 world pivot (Alex): the stitched continent retires;
// each region becomes ONE standalone map on a big cloud canvas (400x400 wild, 150x150 for the
// Home Plot + Moonwell Glade), authored by subtraction and owning its own resource list.
//
// A 400x400 grid as a TS literal is ~600KB of source per region — so regions live as JSON,
// RLE-compressed per row. Cloud-dominated canvases compress enormously (an untouched row is
// one [value, 400] pair). The JSON also carries the region's OWN nodes, burrows, warps and
// spawn dials: one file per region IS "each map has its own available resource list".
//
// `sources` records where each legacy zone was stamped into the canvas — it is both the
// transplant table (the build script re-runs from it) and, at cutover, the save-position
// migration table (old (zone, x, y) -> (region, x+ox, y+oy)) and the minimap label anchors.

export interface RegionSource { ox: number; oy: number; cols: number; rows: number }

export interface RegionFile {
  id: string                     // canonical region id (no WIP prefix — that lives in the loader)
  display: string
  cols: number
  rows: number
  /** Cloud fill tile the canvas starts as (solid, carvable). */
  fill: number
  element?: string
  realm?: 'ather' | 'outside'
  playerStart: { tileX: number; tileY: number }
  /** RLE rows: each row is [value, runLength] pairs summing to cols. */
  rle: [number, number][][]
  nodes: { type: string; tileX: number; tileY: number }[]
  spawners: { kind: 'moglin'; gate: string; tileX: number; tileY: number }[]
  warps: { fromX: number; fromY: number; toZone: string; toX: number; toY: number; direction?: string; requiredFlag?: string }[]
  /**
   * Named multi-tile doors, same concept as `Zone.gates` — one anchor, one footprint, one name.
   * Expanded into warps by REGION_ZONES, so a region file can carry a door a player reads rather
   * than four loose warps that only agree by convention.
   */
  gates?: { x: number; y: number; size?: number; toZone: string; toX: number; toY: number; label: string; direction?: string; requiredFlag?: string; ownerOnly?: boolean }[]
  /** Per-map living-world dials (spawn board overrides land here). Empty = engine defaults. */
  spawn: Record<string, number>
  sources: Record<string, RegionSource>
}

export function encodeRows(grid: number[][]): [number, number][][] {
  return grid.map(row => {
    const out: [number, number][] = []
    let v = row[0], n = 0
    for (const cell of row) {
      if (cell === v) { n++; continue }
      out.push([v, n]); v = cell; n = 1
    }
    out.push([v, n])
    return out
  })
}

export function decodeRows(rle: [number, number][][], cols: number): number[][] {
  return rle.map(row => {
    const out = new Array<number>(cols)
    let i = 0
    for (const [v, n] of row) for (let k = 0; k < n; k++) out[i++] = v
    if (i !== cols) throw new Error(`RLE row decoded to ${i} cells, expected ${cols}`)
    return out
  })
}
