// BETA M86 (World Builder p4): NODE ZONES. The owner paints where gatherable nodes (trees, crystals, stones) may stand and how
// thick, instead of hand-placing them. The layer is a sparse grid of NZ_CELL squares in WORLD coords (tile-local + the tile's
// centre, the same frame as the void brush), in the map's builder layer as `nodes` beside tiles/water/falls/voids, so it rides the
// same draft -> publish -> version -> rollback flow. A cell's code:
//   NZ_NONE (1)          NO NODES: every generated tree / crystal / stone standing in the cell is gone (paths, clearings)
//   NZ_FOREST + d (11-14) DENSE FOREST, thickness d: NEW trees on top of today's, the tile's own zone mix (forestry.ts treeFor
//                         on woods: Thicket shimmeroak, Springs willows ...; the Scald and the caverns grow none, as today)
//   NZ_CRYSTAL + d (21-24) CRYSTAL BED, thickness d: NEW crystal nodes, the zone's own mix (prospecting.ts crystalFor on rock;
//                         the Thicket stays stoneless, as today)
//   (no entry)           DEFAULT: today's rule, untouched
// ★ IDS: nothing generated is ever renumbered. A removed node's id simply stops existing; a dense node gets an id in its own
//   namespace, `<tile>:zt<i>_<j>_<k>` (tree) / `<tile>:zc<i>_<j>_<k>` (crystal), from its world cell and its slot k, so a
//   thicker repaint keeps the thinner one's nodes and a forest repainted as a crystal bed never hands a tree's saved work to a
//   crystal. A removed node's saved work (forestry pruned[id] / prospecting mined[id], ground loot) is keyed by id only: nothing
//   iterates it, so it lies unused (no node = no work = no pay) and comes back as it was if the zone is erased.
// ★ NO ZONES = TODAY'S WORLD EXACTLY: wilds.ts skips the whole step when the map is empty (node-zones.test.ts holds the digest).
// PURE. No imports (the save route reads cleanNodeZones), no three, no React, no DOM.

export type NodeZones = Record<string, number>   // "i_j" (cell of NZ_CELL m, world) -> code
export const NZ_CELL = 8
export const NZ_NONE = 1, NZ_FOREST = 10, NZ_CRYSTAL = 20
export const NZ_STEPS = [1, 2, 3, 4] as const
/** new nodes per cell (64 m^2) at thickness d (index d - 1). Today's woods hold ~1.7 trees per cell; the rock cells ~0.4 crystals. */
export const FOREST_PER_CELL = [0.5, 1, 2, 3] as const
export const CRYSTAL_PER_CELL = [0.25, 0.5, 1, 2] as const
export const NODE_ZONES_MAX = 200_000
export type NodeZoneType = 'none' | 'forest' | 'crystal'
export const NODE_ZONE_TYPES: NodeZoneType[] = ['none', 'forest', 'crystal']
const KEY = /^-?\d{1,5}_-?\d{1,5}$/

export const nzKey = (i: number, j: number) => `${i}_${j}`
export const nzCell = (v: number) => Math.floor(v / NZ_CELL)
export const isZoneCode = (v: unknown): v is number => v === NZ_NONE || (typeof v === 'number' && Number.isInteger(v) && ((v > NZ_FOREST && v <= NZ_FOREST + 4) || (v > NZ_CRYSTAL && v <= NZ_CRYSTAL + 4)))
export const zoneCode = (t: NodeZoneType, d = 2): number => (t === 'none' ? NZ_NONE : (t === 'forest' ? NZ_FOREST : NZ_CRYSTAL) + Math.min(4, Math.max(1, Math.round(d))))
/** what a code means: the type and the new nodes per cell (0 for none) */
export function zoneOf(v: number | undefined): { type: NodeZoneType; d: number; perCell: number } | null {
  if (!isZoneCode(v)) return null
  if (v === NZ_NONE) return { type: 'none', d: 0, perCell: 0 }
  const forest = v < NZ_CRYSTAL, d = v - (forest ? NZ_FOREST : NZ_CRYSTAL)
  return { type: forest ? 'forest' : 'crystal', d, perCell: (forest ? FOREST_PER_CELL : CRYSTAL_PER_CELL)[d - 1] }
}

/** junk-proof: the `nodes` map of a layer file; anything that is not "i_j": a zone code is dropped */
export function cleanNodeZones(j: unknown): NodeZones {
  const raw = (j as { nodes?: unknown } | null)?.nodes, out: NodeZones = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  let n = 0
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= NODE_ZONES_MAX) break
    if (KEY.test(k) && isZoneCode(v)) { out[k] = v; n++ }
  }
  return out
}
/** order-independent canonical form (builder.ts sameLayer) */
export const nodeZonesCanon = (m: NodeZones | undefined) => Object.keys(m ?? {}).sort().map(k => [k, m![k]])

/** the cells a dab at (x, z) of radius r sets (world coords): `code` paints that zone, null erases back to DEFAULT (the value 0,
 *  which mergeEdits / the editor's store treat as "remove the key"). The editor merges this into its store as one undo step. */
export function paintNodeZones(x: number, z: number, r: number, code: number | null): NodeZones {
  const d: NodeZones = {}, R = Math.max(r, NZ_CELL / 2)
  for (let j = nzCell(z - R); j <= nzCell(z + R); j++) for (let i = nzCell(x - R); i <= nzCell(x + R); i++) {
    const cx = (i + 0.5) * NZ_CELL, cz = (j + 0.5) * NZ_CELL
    if (Math.hypot(cx - x, cz - z) > R) continue
    d[nzKey(i, j)] = code ?? 0
  }
  return d
}
/** fold a dab into a map (0 = erase); returns the new map */
export function foldNodeZones(cur: NodeZones | undefined, d: NodeZones): NodeZones {
  const out: NodeZones = { ...(cur ?? {}) }
  for (const [k, v] of Object.entries(d)) { if (v && isZoneCode(v)) out[k] = v; else delete out[k] }
  return out
}
/** slot k of a dense cell exists at `perCell` new nodes per cell (slots below the whole part always; the next one by its roll),
 *  so a thicker paint keeps every node of a thinner one */
export const slotLive = (k: number, perCell: number, roll: number) => k < Math.floor(perCell) || (k === Math.floor(perCell) && roll < perCell - Math.floor(perCell))
export const SLOTS_MAX = Math.ceil(Math.max(...FOREST_PER_CELL, ...CRYSTAL_PER_CELL))
