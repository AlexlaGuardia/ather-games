// The authored world overlay — the terrain OUTSIDE the districts.
//
// ── Why this file exists ──
// The composed continent is built from per-zone grids blitted at solver-chosen offsets, with cloud
// and corridors generated around them. That made the space between districts unowned: 72.5% of the
// grid belonged to no zone, so the editor's per-zone save (which slices each zone's rectangle out
// of the world) had nowhere to put an edit made out there. Painting a tunnel between Spirit Meadows
// and Route One appeared to work and was silently discarded on the next load, because the composer
// simply re-carved its own L-path from scratch.
//
// This is where that terrain lives now. Sparse `"x,y" -> tile` rather than a second full grid,
// because the substrate is already cloud everywhere and an overlay only needs to record what was
// deliberately cut out of it — a maze of paths is a few thousand entries, not 138,624.
//
// ── The fingerprint, and why a mismatch must FAIL CLOSED ──
// These are WORLD coordinates. Everything else in this codebase is keyed logically (zone-local)
// precisely so a layout nudge cannot orphan it, and the overlay genuinely cannot be: it describes
// the space BETWEEN zones, which has no logical space to be keyed in. So it carries a fingerprint
// of the layout it was authored against — grid size plus every district's offset and size. If a
// zone is resized or moved, every coordinate in here points somewhere else, and applying it anyway
// would scatter tiles across the map in a way that looks like corruption and is tedious to undo.
// On mismatch we apply NOTHING and say so loudly. The data is still on disk, and re-anchoring is a
// deliberate act rather than something that silently happened while you were editing.

export interface WorldOverlay {
  /** Layout this was authored against — see the note above. */
  fingerprint: string
  /** `"x,y"` → tile id, world coordinates. */
  tiles: Record<string, number>
  /** `"x,y"` → height step. Sparse and independent: a carved path often keeps the ground height. */
  heights?: Record<string, number>
}

export const EMPTY_OVERLAY: WorldOverlay = { fingerprint: '', tiles: {}, heights: {} }

/** Live overlay from `/shimmer/world-data` (set at boot, before the game mounts). */
let liveOverlay: WorldOverlay | null = null
export function setLiveOverlay(o: WorldOverlay | null) { liveOverlay = o }
export function getOverlay(): WorldOverlay { return liveOverlay ?? EMPTY_OVERLAY }

/** Set when the last apply was refused because the layout moved under the overlay. The editor
 *  surfaces this — a silently-skipped overlay would read as "my edits vanished again". */
let mismatch: string | null = null
export function overlayMismatch(): string | null { return mismatch }

/**
 * Fingerprint of a composed layout. Deliberately includes every district's offset AND size: a zone
 * growing by one row shifts everything the solver places after it, which is exactly the case that
 * would misplace the overlay without changing the grid's outer dimensions.
 */
export function layoutFingerprint(
  cols: number, rows: number,
  placements: Iterable<{ zone: { id: string }; ox: number; oy: number; cols: number; rows: number }>,
): string {
  const parts = [...placements]
    .map(p => `${p.zone.id}@${p.ox},${p.oy}:${p.cols}x${p.rows}`)
    .sort()
  return `${cols}x${rows}|${parts.join('|')}`
}

/**
 * Paint the authored overlay onto a composed grid. Returns how many tiles landed — 0 with a
 * `overlayMismatch()` message means the layout moved and nothing was applied on purpose.
 */
export function paintOverlay(
  grid: number[][], heights: number[][], rows: number, cols: number, fingerprint: string,
): number {
  const o = getOverlay()
  const entries = Object.entries(o.tiles)
  if (!entries.length) { mismatch = null; return 0 }

  if (o.fingerprint && o.fingerprint !== fingerprint) {
    mismatch = `world overlay was authored against a different layout — ${entries.length} tiles NOT applied.`
    console.error(`[shimmer] ${mismatch}\n  authored: ${o.fingerprint.slice(0, 120)}…\n  current:  ${fingerprint.slice(0, 120)}…`)
    return 0
  }
  mismatch = null

  let painted = 0
  for (const [key, tile] of entries) {
    const comma = key.indexOf(',')
    const x = +key.slice(0, comma), y = +key.slice(comma + 1)
    if (!(y >= 0 && y < rows && x >= 0 && x < cols)) continue   // stale edge entry; drop quietly
    grid[y][x] = tile
    painted++
  }
  for (const [key, h] of Object.entries(o.heights ?? {})) {
    const comma = key.indexOf(',')
    const x = +key.slice(0, comma), y = +key.slice(comma + 1)
    if (y >= 0 && y < rows && x >= 0 && x < cols) heights[y][x] = h
  }
  return painted
}
