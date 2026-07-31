// World adapter — bridges the composed garden-world continent to the play3d content systems
// that key by zoneId (NPCs, resource nodes, encounters, atmosphere, placed structures).
// Everything stays AUTHORED in logical per-zone space (the layout can be re-tweaked without
// breaking content or saves); this module translates at the boundary.

import { WORLD_ZONE_ID, isStitched, getGardenWorld, fromWorld } from '../world/garden-world'
import { NPCS_3D, type NPC3D } from './npcs3d'
import { ZONE_NODES, type NodePlacement } from '../world/node-placements'
import { dealZone, type DealtNode } from '../engine/spawn-board'
import { ZONE_SPAWNERS, type SpawnerPlacement } from '../world/spawn-placements'
import { regionNodesFor, regionSpawnersFor } from '../world/region-maps'
import type { PlacedStruct } from './StationMenus'

const toWorld = (zoneId: string, x: number, y: number) => getGardenWorld().toWorld(zoneId, x, y)

/** Drop the memoized world-space remaps (call after applyLiveWorldData re-composes). */
export function invalidateWorldCaches() { worldNpcs = null; worldNodes = null; worldSpawners = null }

// NPCs remapped into the continent, appended to the per-zone originals — the zone filter in
// the Scene picks whichever set matches the mounted zone, so old per-zone mode still works.
let worldNpcs: NPC3D[] | null = null
export function allNpcs(): NPC3D[] {
  if (!worldNpcs) {
    worldNpcs = NPCS_3D.filter(n => isStitched(n.zone)).map(n => {
      const p = toWorld(n.zone, n.tileX, n.tileY)!
      return { ...n, zone: WORLD_ZONE_ID, tileX: p.x, tileY: p.y }
    })
  }
  return [...NPCS_3D, ...worldNpcs]
}

// Resource nodes aggregated across every stitched zone, in world coords.
let worldNodes: NodePlacement[] | null = null
export function nodePlacementsFor(zoneId: string): NodePlacement[] {
  if (zoneId !== WORLD_ZONE_ID) return regionNodesFor(zoneId) ?? (ZONE_NODES[zoneId] ?? []).map(n => ({ ...n }))
  if (!worldNodes) {
    worldNodes = []
    for (const [zid, nodes] of Object.entries(ZONE_NODES)) {
      if (!isStitched(zid)) continue
      for (const n of nodes) {
        const p = toWorld(zid, n.tileX, n.tileY)
        if (p) worldNodes.push({ ...n, tileX: p.x, tileY: p.y })
      }
    }
  }
  return worldNodes.map(n => ({ ...n }))
}

/**
 * The resource board actually standing in the world this window — the dealt subset of the authored
 * placements, remapped for the mounted zone.
 *
 * ★ The deal runs per LOGICAL zone, BEFORE the world remap, and that ordering is the whole point.
 * The board is keyed on zone-local coordinates, so nudging a district by a tile in the editor moves
 * the nodes without re-rolling which ones exist. Dealing after the remap would have re-shuffled the
 * entire continent every time the layout was touched — the same reasoning that keeps the moglin
 * spawner cooldowns on logical keys.
 *
 * Reads `ZONE_NODES` rather than the caller's live editor state on purpose: the deal needs the
 * authored set as its universe of possibilities. The cost is that an unsaved editor placement does
 * not join the board until Save writes it back (which `applyLiveWorldData` then folds in) — fine,
 * because edit mode renders the full authored layer and never looks at the board at all.
 */
export function dealtNodesFor(zoneId: string, windowIndex: number, stripped?: ReadonlySet<string>): DealtNode[] {
  if (zoneId !== WORLD_ZONE_ID) return dealZone(zoneId, regionNodesFor(zoneId) ?? ZONE_NODES[zoneId] ?? [], windowIndex, undefined, stripped)
  const out: DealtNode[] = []
  for (const [zid, nodes] of Object.entries(ZONE_NODES)) {
    if (!isStitched(zid)) continue
    // `key` survives this remap untouched — it was computed in logical space, which is the whole
    // point of dealing before the translation rather than after it.
    for (const n of dealZone(zid, nodes, windowIndex, undefined, stripped)) {
      const p = toWorld(zid, n.tileX, n.tileY)
      if (p) out.push({ ...n, tileX: p.x, tileY: p.y })
    }
  }
  return out
}

// Moglin-patrol spawners aggregated across every stitched zone, in world coords (mirror of nodes).
let worldSpawners: SpawnerPlacement[] | null = null
export function spawnerPlacementsFor(zoneId: string): SpawnerPlacement[] {
  if (zoneId !== WORLD_ZONE_ID) return regionSpawnersFor(zoneId) ?? (ZONE_SPAWNERS[zoneId] ?? []).map(n => ({ ...n }))
  if (!worldSpawners) {
    worldSpawners = []
    for (const [zid, sps] of Object.entries(ZONE_SPAWNERS)) {
      if (!isStitched(zid)) continue
      for (const sp of sps) {
        const p = toWorld(zid, sp.tileX, sp.tileY)
        if (p) worldSpawners.push({ ...sp, tileX: p.x, tileY: p.y })
      }
    }
  }
  return worldSpawners.map(n => ({ ...n }))
}

// The district the player is actually standing in — drives encounters, battle backdrops, and
// the atmosphere mood. In the cloud mortar between districts there is no zone; callers get
// the world id back (atmosphere default mood, no encounters — clouds have no mist anyway).
export function logicalZoneAt(zoneId: string, x: number, y: number): string {
  if (zoneId !== WORLD_ZONE_ID) return zoneId
  return getGardenWorld().zoneAt(Math.round(x), Math.round(y)) ?? WORLD_ZONE_ID
}

// Placed structures: SAVED in logical space (layout-proof), VIEWED in the mounted zone's
// space. View clones carry src* back-references so persistent identity (chest contents,
// crops — keyed via stationInstanceId) survives the coordinate translation.
export function structuresView(structures: PlacedStruct[], zoneId: string): PlacedStruct[] {
  if (zoneId !== WORLD_ZONE_ID) return structures.filter(s => s.zoneId === zoneId)
  const out: PlacedStruct[] = []
  for (const s of structures) {
    if (s.zoneId === WORLD_ZONE_ID) { out.push(s); continue } // corridor placements (rare)
    if (!isStitched(s.zoneId)) continue
    const p = toWorld(s.zoneId, s.tileX, s.tileY)
    if (p) out.push({ ...s, zoneId: WORLD_ZONE_ID, tileX: p.x, tileY: p.y, srcZoneId: s.zoneId, srcTileX: s.tileX, srcTileY: s.tileY })
  }
  return out
}

// A new placement made while in the world → store it in logical space when it lands inside
// a district; corridor/cloud placements keep world coords (fromWorld is null there).
export function logicalStruct(s: PlacedStruct): PlacedStruct {
  if (s.zoneId !== WORLD_ZONE_ID) return s
  const l = fromWorld(s.tileX, s.tileY)
  return l ? { ...s, zoneId: l.zoneId, tileX: l.x, tileY: l.y } : s
}
