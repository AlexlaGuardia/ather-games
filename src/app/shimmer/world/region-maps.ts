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
import {
  WILDS_ZONE_ID, WILDS_CLOUD, wildsGeometry, parseWildsId, wildsIdOf, regionOrigin, sparseGrid,
} from './wilds-world'
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
import wilds10 from './region-maps/wilds-1-0.json'
import wilds01 from './region-maps/wilds-0-1.json'
import wilds11 from './region-maps/wilds-1-1.json'

export const REGION_WIP_PREFIX = 'r-'

/**
 * ── THE WILDS ARE ONE ZONE (phase 3, 2026-08-06) ─────────────────────────────────────────
 * Every other region file is its own zone. The Wilds regions are not: they are tiles of ONE
 * overland, and a border between two patches of open grass is not a door. So they are held out
 * of `FILES` (the one-file-one-zone list) and composed into a single `r-wilds` zone below, in
 * world coordinates. The files are unchanged and still authored one at a time in the MapEditor
 * — 400x400 stays the authoring unit, it just stops being a runtime unit.
 */
const WILDS_FILES = [wilds00, wilds10, wilds01, wilds11] as unknown as RegionFile[]

const FILES = [homePlot, moonwellGlade, spiritMeadow, twilightThicket, manaSprings, voranyxCaverns, theOutfields] as unknown as RegionFile[]

/** Region files by CANONICAL id (no prefix). Wilds tiles are addressable here too. */
export const REGION_FILES: Record<string, RegionFile> = Object.fromEntries([...FILES, ...WILDS_FILES].map(f => [f.id, f]))

// ── the Wilds composite ────────────────────────────────────────────────────────────────────
export const WILDS_ZONE = REGION_WIP_PREFIX + WILDS_ZONE_ID
export const WILDS_GEO = wildsGeometry(WILDS_FILES.map(f => f.id))

/** A Wilds region's tiles, decoded on demand — the `load` callback `syncWilds` pulls through. */
export function loadWildsRegion(id: string): number[][] | null {
  const f = REGION_FILES[id]
  if (!f) return null
  try { return decodeRows(f.rle, f.cols) } catch { return null }   // a bad row must not take the world down
}

/**
 * The Wilds as one zone.
 *
 * The grid is SPARSE: world-sized to read, holding no tiles until the player's load window
 * reaches a region (`syncWilds`, driven from the play view). Everything else — gates, warps,
 * nodes, burrows — is collected from the region files and offset into world coordinates here,
 * so a region file keeps carrying its own contents in its own local coordinates and nothing
 * downstream learns that regions exist.
 */
/** Every Wilds door, collected from the region files and offset into world space. */
function collectWildsDoors(): { gates: Gate[]; warps: Warp[] } {
  const gates: Gate[] = []
  const warps: Warp[] = []
  for (const f of WILDS_FILES) {
    const rc = parseWildsId(f.id)
    if (!rc) continue
    const o = regionOrigin(WILDS_GEO, rc.rx, rc.ry)
    for (const g of f.gates ?? []) {
      const gate: Gate = { ...g, x: g.x + o.x, y: g.y + o.y, direction: g.direction as Gate['direction'] }
      gates.push(gate)
      warps.push(...expandGate(gate))
    }
    for (const w of f.warps) {
      warps.push({ ...w, fromX: w.fromX + o.x, fromY: w.fromY + o.y, direction: (w.direction ?? 'down') as Warp['direction'] })
    }
  }
  return { gates, warps }
}

function buildWildsZone(): Zone {
  const { gates, warps } = collectWildsDoors()
  // Start at the heart of the north-west region — the one the Outfields seam opens onto.
  const first = WILDS_FILES.find(f => f.id === wildsIdOf(WILDS_GEO.originRx, WILDS_GEO.originRy)) ?? WILDS_FILES[0]
  const fo = parseWildsId(first.id)!
  const start = regionOrigin(WILDS_GEO, fo.rx, fo.ry)
  return {
    id: WILDS_ZONE,
    name: '⛅ The Wilds',
    grid: sparseGrid(WILDS_GEO.rows, WILDS_GEO.cols, first.fill ?? WILDS_CLOUD),
    gates,
    warps,
    playerStart: { tileX: start.x + first.playerStart.tileX, tileY: start.y + first.playerStart.tileY },
    realm: (first.realm ?? 'ather') as Zone['realm'],
  }
}

/** Where a Wilds region's own records (nodes, burrows) land in world space. */
function wildsOffset(id: string): { x: number; y: number } | null {
  const rc = parseWildsId(id)
  return rc ? regionOrigin(WILDS_GEO, rc.rx, rc.ry) : null
}

/** The canonical region id behind a WIP zone id, or null if this isn't a region zone. */
export function regionIdOf(zoneId: string): string | null {
  if (!zoneId.startsWith(REGION_WIP_PREFIX)) return null
  const id = zoneId.slice(REGION_WIP_PREFIX.length)
  return REGION_FILES[id] ? id : null
}

/** Zone entries for the registry — decoded lazily once (a 400x400 decode is cheap, ~ms). */
export const REGION_ZONES: Zone[] = FILES.map((f): Zone => ({
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
})).concat(buildWildsZone())

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
  let touchedWilds = false
  for (const [id, live] of Object.entries(regions)) {
    const compiled = REGION_FILES[id]
    if (!compiled || !Array.isArray(live.rle) || !live.cols || !live.rows) continue
    let grid: number[][]
    try { grid = decodeRows(live.rle, live.cols) } catch { continue }  // a bad row must not take the boot down
    Object.assign(compiled, live)
    const zone = REGION_ZONES.find(z => z.id === REGION_WIP_PREFIX + id)
    if (zone) {
      zone.grid = grid
      // ★ GATES MUST BE RE-EXPANDED HERE, NOT JUST COPIED (fixed 2026-08-06).
      // This used to be `zone.warps = live.warps.map(...)`, which silently DESTROYED every
      // gate-derived warp the moment live data loaded — and live data loads on every boot, so
      // in the browser it always won. A gate then looked perfectly healthy (its nametag renders
      // from `zone.gates`, which nothing here touched) while walking into it did nothing at all.
      // That is the shape the Outfields→Wilds seam failed in: correct in the compiled data,
      // correct in every headless test, dead in the actual game.
      // `REGION_ZONES` builds warps as authored-warps + expanded-gates; this must agree with it
      // exactly, or the live path keeps meaning something different from the compiled one.
      const liveGates = (live.gates ?? []).map(g => ({ ...g, direction: g.direction as Gate['direction'] }))
      zone.gates = liveGates
      zone.warps = [
        ...live.warps.map(w => ({ ...w, direction: (w.direction ?? 'down') as Warp['direction'] })),
        ...liveGates.flatMap(expandGate),
      ]
      zone.playerStart = live.playerStart
    }
    // A Wilds tile has no zone of its own — its doors live on the composite, which is rebuilt
    // below once, after every region's live data has landed.
    if (parseWildsId(id)) touchedWilds = true
  }
  if (touchedWilds) {
    const wilds = REGION_ZONES.find(z => z.id === WILDS_ZONE)
    if (wilds) {
      const { gates, warps } = collectWildsDoors()
      wilds.gates = gates
      wilds.warps = warps
      // The grid stays SPARSE on purpose — `loadWildsRegion` reads the (now live) REGION_FILES
      // entry when the player's load window reaches that region, so sculpt-fresh tiles arrive
      // through the normal mount path rather than by materializing the overland here.
    }
  }
}

/**
 * A region zone's authored nodes (its own resource list), or null for non-region zones.
 * For the Wilds this is every tile-region's list at once, offset into world space — a resource
 * still belongs to the region file that authored it, the player just never sees the join.
 */
export function regionNodesFor(zoneId: string): NodePlacement[] | null {
  if (zoneId === WILDS_ZONE) {
    return WILDS_FILES.flatMap(f => {
      const o = wildsOffset(f.id)
      return o ? f.nodes.map(n => ({ type: n.type as NodeType, tileX: n.tileX + o.x, tileY: n.tileY + o.y })) : []
    })
  }
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

/** A region zone's burrows, or null for non-region zones. Wilds burrows offset into world space. */
export function regionSpawnersFor(zoneId: string): SpawnerPlacement[] | null {
  if (zoneId === WILDS_ZONE) {
    return WILDS_FILES.flatMap(f => {
      const o = wildsOffset(f.id)
      return o ? f.spawners.map(s => ({ kind: 'moglin' as const, gate: s.gate as SpawnerPlacement['gate'], tileX: s.tileX + o.x, tileY: s.tileY + o.y })) : []
    })
  }
  const id = regionIdOf(zoneId)
  if (!id) return null
  return REGION_FILES[id].spawners.map(s => ({ kind: 'moglin' as const, gate: s.gate as SpawnerPlacement['gate'], tileX: s.tileX, tileY: s.tileY }))
}
