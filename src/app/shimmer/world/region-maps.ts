// Region maps — the 2026-07-31 world pivot (Alex): the stitched continent retires; each
// region is ONE standalone map on a cloud canvas, authored by subtraction, owning its own
// resource list + spawn dials. See region-codec.ts for the file format and
// scripts/build-region-canvases.mts for the transplant that seeded them.
//
// WIP PREFIX: while Alex sculpts, regions are registered under `r-<id>` so they live
// ALONGSIDE the legacy zones without colliding with the ids the live world still uses
// (spirit-meadow etc.). At cutover the prefix drops, saves migrate via each file's
// `sources` table, and the legacy zones + stitcher machinery get deleted.

import type { Zone, Warp } from './zones'
import type { NodePlacement } from './node-placements'
import type { NodeType } from './resources'
import type { SpawnerPlacement } from './spawn-placements'
import { decodeRows, type RegionFile } from './region-codec'

import homePlot from './region-maps/home-plot.json'
import moonwellGlade from './region-maps/moonwell-glade.json'
import spiritMeadow from './region-maps/spirit-meadow.json'
import twilightThicket from './region-maps/twilight-thicket.json'
import manaSprings from './region-maps/mana-springs.json'
import voranyxCaverns from './region-maps/voranyx-caverns.json'
import theOutfields from './region-maps/the-outfields.json'

export const REGION_WIP_PREFIX = 'r-'

const FILES = [homePlot, moonwellGlade, spiritMeadow, twilightThicket, manaSprings, voranyxCaverns, theOutfields] as unknown as RegionFile[]

/** Region files by CANONICAL id (no prefix). */
export const REGION_FILES: Record<string, RegionFile> = Object.fromEntries(FILES.map(f => [f.id, f]))

/** The canonical region id behind a WIP zone id, or null if this isn't a region zone. */
export function regionIdOf(zoneId: string): string | null {
  if (!zoneId.startsWith(REGION_WIP_PREFIX)) return null
  const id = zoneId.slice(REGION_WIP_PREFIX.length)
  return REGION_FILES[id] ? id : null
}

/** Zone entries for the registry — decoded lazily once (a 400x400 decode is cheap, ~ms). */
export const REGION_ZONES: Zone[] = FILES.map(f => ({
  id: REGION_WIP_PREFIX + f.id,
  name: `⛅ ${f.display}`,
  grid: decodeRows(f.rle, f.cols),
  warps: f.warps.map(w => ({ ...w, direction: (w.direction ?? 'down') as Warp['direction'] })),
  playerStart: f.playerStart,
  element: f.element as Zone['element'],
  realm: f.realm,
}))

/**
 * Patch the compiled region data with the LIVE on-disk copies (/shimmer/region-data) —
 * the region half of applyLiveWorldData, called by the play3d boot gate before mount.
 * Mutates the REGION_FILES entries and the REGION_ZONES Zone objects IN PLACE: ALL_ZONES
 * holds references to these same objects, so everything downstream (getZone, the editors,
 * the adapters) sees sculpt-fresh data with no further wiring. Partial payloads are safe —
 * a region absent from the payload keeps its compiled state.
 */
export function applyLiveRegionData(regions: Record<string, RegionFile> | undefined | null): void {
  if (!regions) return
  for (const [id, live] of Object.entries(regions)) {
    const compiled = REGION_FILES[id]
    if (!compiled || !Array.isArray(live.rle) || !live.cols || !live.rows) continue
    let grid: number[][]
    try { grid = decodeRows(live.rle, live.cols) } catch { continue }  // a bad row must not take the boot down
    Object.assign(compiled, live)
    const zone = REGION_ZONES.find(z => z.id === REGION_WIP_PREFIX + id)
    if (zone) {
      zone.grid = grid
      zone.warps = live.warps.map(w => ({ ...w, direction: (w.direction ?? 'down') as Warp['direction'] }))
      zone.playerStart = live.playerStart
    }
  }
}

/** A region zone's authored nodes (its own resource list), or null for non-region zones. */
export function regionNodesFor(zoneId: string): NodePlacement[] | null {
  const id = regionIdOf(zoneId)
  if (!id) return null
  return REGION_FILES[id].nodes.map(n => ({ type: n.type as NodeType, tileX: n.tileX, tileY: n.tileY }))
}

/** A region zone's spawn dials (abundance/richness/resets), or undefined when absent /
 *  not a region — undefined means "engine defaults", i.e. exactly the legacy behavior. */
export function regionSpawnConfig(zoneId: string): { abundance?: number; richness?: number; resets?: number } | undefined {
  const id = regionIdOf(zoneId)
  if (!id) return undefined
  const s = REGION_FILES[id].spawn
  return s && Object.keys(s).length ? s : undefined
}

/** A region zone's burrows, or null for non-region zones. */
export function regionSpawnersFor(zoneId: string): SpawnerPlacement[] | null {
  const id = regionIdOf(zoneId)
  if (!id) return null
  return REGION_FILES[id].spawners.map(s => ({ kind: 'moglin' as const, gate: s.gate as SpawnerPlacement['gate'], tileX: s.tileX, tileY: s.tileY }))
}
