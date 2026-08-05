// Region maps — the 2026-07-31 world pivot (Alex): the stitched continent retires; each
// region is ONE standalone map on a cloud canvas, authored by subtraction, owning its own
// resource list + spawn dials. See region-codec.ts for the file format and
// scripts/build-region-canvases.mts for the transplant that seeded them.
//
// WIP PREFIX: while Alex sculpts, regions are registered under `r-<id>` so they live
// ALONGSIDE the legacy zones without colliding with the ids the live world still uses
// (spirit-meadow etc.). At cutover the prefix drops, saves migrate via each file's
// `sources` table, and the legacy zones + stitcher machinery get deleted.

import { expandGate, type Zone, type Warp, type Gate } from './zones'
import type { NodePlacement } from './node-placements'
import type { NodeType } from './resources'
import type { SpawnerPlacement } from './spawn-placements'
import { decodeRows, type RegionFile } from './region-codec'
import { ZONE_PICKUPS } from './static-pickups'
import { ZONE_CHESTS } from './zone-chests'
import { STRUCTURE_PLACEMENTS } from './structure-placements'

import homePlot from './region-maps/home-plot.json'
import moonwellGlade from './region-maps/moonwell-glade.json'
import spiritMeadow from './region-maps/spirit-meadow.json'
import twilightThicket from './region-maps/twilight-thicket.json'
import manaSprings from './region-maps/mana-springs.json'
import voranyxCaverns from './region-maps/voranyx-caverns.json'
import theOutfields from './region-maps/the-outfields.json'
import wilds00 from './region-maps/wilds-0-0.json'

export const REGION_WIP_PREFIX = 'r-'

const FILES = [homePlot, moonwellGlade, spiritMeadow, twilightThicket, manaSprings, voranyxCaverns, theOutfields, wilds00] as unknown as RegionFile[]

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
  // Gates expand into warps here, exactly as `zones.ts` does for hand-authored zones — so a
  // region door is the same thing a town door is, and everything downstream still sees warps.
  gates: (f.gates ?? []).map(g => ({ ...g, direction: g.direction as Gate['direction'] })),
  warps: [
    ...f.warps.map(w => ({ ...w, direction: (w.direction ?? 'down') as Warp['direction'] })),
    ...(f.gates ?? []).flatMap(g => expandGate({ ...g, direction: g.direction as Gate['direction'] })),
  ],
  playerStart: f.playerStart,
  element: f.element as Zone['element'],
  realm: f.realm,
}))

// ── Story-layer transplant (2026-08-01, the walkability pass) ───────────────────────────
// Pickups, chests, and structure placements ride into the regions by DERIVATION: for every
// record keyed to a legacy zone a region absorbed, a region copy is written under the WIP
// id with the source offset applied. Pure remap at module load — the legacy entries stay
// untouched, both worlds work, and at cutover the derived copies just become the copies.
// (NPCs get the same treatment in play3d/npcs3d — their registry lives game-side.)
function transplantTable<T extends { tileX: number; tileY: number }>(table: Record<string, T[]>): void {
  for (const f of FILES) {
    const out: T[] = []
    for (const [zone, s] of Object.entries(f.sources)) {
      for (const rec of table[zone] ?? []) out.push({ ...rec, tileX: rec.tileX + s.ox, tileY: rec.tileY + s.oy })
    }
    if (out.length) table[REGION_WIP_PREFIX + f.id] = out
  }
}
transplantTable(ZONE_PICKUPS)
transplantTable(ZONE_CHESTS)
transplantTable(STRUCTURE_PLACEMENTS)

/**
 * Migrate a legacy save position into the new world: a save standing in an absorbed zone
 * lands at the same spot of its region canvas (the `sources` table is the map). Routes
 * died unmapped — those saves (and anything else unplaced) return null and the caller
 * falls back to the Home Plot's start. One-way by design; the legacy world stays
 * reachable via ?zone= until final cutover.
 */
export function migrateLegacyPosition(zoneId: string, x: number, y: number): { zoneId: string; x: number; y: number } | null {
  for (const f of FILES) {
    const s = f.sources[zoneId]
    if (s) return { zoneId: REGION_WIP_PREFIX + f.id, x: x + s.ox, y: y + s.oy }
  }
  return null
}

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
