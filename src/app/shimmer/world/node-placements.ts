// Initial resource node placements per zone
// Alex can move these later via the Map Editor's item layer
// Coords are tile positions (0-29 on a 30x30 grid)

import type { NodeType } from './resources'

export interface NodePlacement {
  type: NodeType
  tileX: number
  tileY: number
}

// Garden — starter zone, level 1 nodes only
// Canon (shimmer-skilling.md, START home circle): "1-2 crystal nodes" — seed a starter
// raw-mana pair so Prospecting is discoverable at home, not only after leaving the plot.
const GARDEN_NODES: NodePlacement[] = [
  { type: 'goldwood' as NodeType, tileX: 22, tileY: 4 },
  { type: 'goldwood' as NodeType, tileX: 19, tileY: 3 },
  // (14,2) removed — it sat on the Spirit Corner gate's return-warp landing tile and trapped the
  // player against the gate on the way back. 5 other goldwoods remain in the plot.
  { type: 'goldwood' as NodeType, tileX: 2, tileY: 25 },
  { type: 'goldwood' as NodeType, tileX: 3, tileY: 27 },
  { type: 'goldwood' as NodeType, tileX: 5, tileY: 26 },
  { type: 'raw_mana_node' as NodeType, tileX: 15, tileY: 5 },
  { type: 'raw_mana_node' as NodeType, tileX: 16, tileY: 10 },
  { type: 'small_pond' as NodeType, tileX: 11, tileY: 7 },  // canon START: "small pond (3 fish)"
]

// Mycelial Path — mid zone, level 1-4 nodes
const MYCELIAL_PATH_NODES: NodePlacement[] = [
  { type: 'goldwood' as NodeType, tileX: 12, tileY: 2 },
  { type: 'goldwood' as NodeType, tileX: 9, tileY: 3 },
  { type: 'goldwood' as NodeType, tileX: 1, tileY: 1 },
  { type: 'shimmeroak' as NodeType, tileX: 4, tileY: 20 },
  { type: 'shimmeroak' as NodeType, tileX: 4, tileY: 22 },
  { type: 'shimmeroak' as NodeType, tileX: 4, tileY: 24 },
  { type: 'shimmeroak' as NodeType, tileX: 4, tileY: 26 },
  { type: 'shimmeroak' as NodeType, tileX: 7, tileY: 19 },
  { type: 'shimmeroak' as NodeType, tileX: 7, tileY: 21 },
  { type: 'shimmeroak' as NodeType, tileX: 7, tileY: 23 },
  { type: 'raw_mana_node' as NodeType, tileX: 15, tileY: 13 },
  { type: 'raw_mana_node' as NodeType, tileX: 14, tileY: 14 },
  { type: 'raw_mana_node' as NodeType, tileX: 13, tileY: 16 },
  { type: 'element_crystal_node' as NodeType, tileX: 17, tileY: 26 },
  // Round-out (cozy cluster): + fishing so all 3 gathering skills live here. Placed next to the
  // shimmeroak grove (harvest-stand tiles, walkable). NOTE: not eyeballed in-zone — Alex verify.
  { type: 'small_pond' as NodeType, tileX: 5, tileY: 22 },
  { type: 'small_pond' as NodeType, tileX: 6, tileY: 19 },
]

// Moonwell Glade — deeper zone, level 4-7 nodes
const MOONWELL_GLADE_NODES: NodePlacement[] = [
  // Deep water (Rinning lv7) — the moonkoi swim the moonwell. Before these, the `lake` node
  // type existed but was placed NOWHERE: moonkoi/pearlshell/crystal_rinn were Exchange-buy
  // only, walling the T3 rinstick + deep_essence/dawn_cordial off from honest gathering.
  { type: 'lake' as NodeType, tileX: 19, tileY: 14 },
  { type: 'lake' as NodeType, tileX: 16, tileY: 13 },
  { type: 'shimmeroak' as NodeType, tileX: 5, tileY: 10 },
  { type: 'starwillow' as NodeType, tileX: 12, tileY: 18 },
  { type: 'shimmeroak' as NodeType, tileX: 5, tileY: 12 },
  { type: 'small_pond' as NodeType, tileX: 17, tileY: 8 },
  { type: 'small_pond' as NodeType, tileX: 20, tileY: 12 },
  { type: 'small_pond' as NodeType, tileX: 21, tileY: 15 },
  { type: 'small_pond' as NodeType, tileX: 17, tileY: 20 },
  { type: 'small_pond' as NodeType, tileX: 15, tileY: 19 },
  { type: 'small_pond' as NodeType, tileX: 24, tileY: 5 },
  { type: 'small_pond' as NodeType, tileX: 10, tileY: 6 },
  { type: 'small_pond' as NodeType, tileX: 24, tileY: 25 },
  { type: 'raw_mana_node' as NodeType, tileX: 16, tileY: 11 },
  { type: 'raw_mana_node' as NodeType, tileX: 17, tileY: 10 },
  { type: 'raw_mana_node' as NodeType, tileX: 18, tileY: 12 },
]

// Spore Hollow — end zone, level 7-10 nodes
const SPORE_HOLLOW_NODES: NodePlacement[] = [

]

// Predefined empty positions in the garden for nodes purchased from Gregory
// 8 slots — player starts with 4 nodes, can buy up to 8 more (12 max)
// Avoids existing nodes (25,3)(22,4)(19,3)(20,7) and Wisp NPC (13,7)
export const GARDEN_SHOP_SLOTS: { tileX: number; tileY: number }[] = [
  { tileX: 16, tileY: 4 },
  { tileX: 17, tileY: 7 },
  { tileX: 23, tileY: 8 },
  { tileX: 26, tileY: 6 },
  { tileX: 15, tileY: 10 },
  { tileX: 21, tileY: 11 },
  { tileX: 18, tileY: 13 },
  { tileX: 24, tileY: 14 },
]

// Twilight Thicket — dark forest, SE clearing resources
const TWILIGHT_THICKET_NODES: NodePlacement[] = [
  { type: 'starwillow' as NodeType, tileX: 20, tileY: 12 },
  { type: 'starwillow' as NodeType, tileX: 22, tileY: 15 },
  { type: 'dawnwood' as NodeType, tileX: 17, tileY: 13 },
  { type: 'dawnwood' as NodeType, tileX: 19, tileY: 16 },
  { type: 'element_crystal_node' as NodeType, tileX: 21, tileY: 14 },
  { type: 'element_crystal_node' as NodeType, tileX: 18, tileY: 11 },
  { type: 'lake' as NodeType, tileX: 11, tileY: 9 },  // dark still water in the thicket's heart (lv7 zone pairing)
]

// Mana Springs — sacred pools, heavy fishing + prospecting
const MANA_SPRINGS_NODES: NodePlacement[] = [
  { type: 'lake' as NodeType, tileX: 10, tileY: 4 },  // the deep spring among the pools (lv7, matches its pure_core_node)
  { type: 'small_pond' as NodeType, tileX: 3, tileY: 1 },
  { type: 'small_pond' as NodeType, tileX: 5, tileY: 5 },
  { type: 'small_pond' as NodeType, tileX: 15, tileY: 5 },
  { type: 'small_pond' as NodeType, tileX: 2, tileY: 10 },
  { type: 'small_pond' as NodeType, tileX: 21, tileY: 10 },
  { type: 'stream' as NodeType, tileX: 15, tileY: 14 },
  { type: 'stream' as NodeType, tileX: 4, tileY: 14 },
  { type: 'raw_mana_node' as NodeType, tileX: 1, tileY: 8 },
  { type: 'raw_mana_node' as NodeType, tileX: 23, tileY: 8 },
  { type: 'pure_core_node' as NodeType, tileX: 23, tileY: 18 },
  // Round-out (cozy cluster): + forestry so all 3 gathering skills live here. Placed next to the
  // spring pools (harvest-stand tiles, walkable). NOTE: not eyeballed in-zone — Alex verify.
  { type: 'shimmeroak' as NodeType, tileX: 4, tileY: 5 },
  { type: 'goldwood' as NodeType, tileX: 16, tileY: 5 },
]

// Spirit Meadow — open grassland, forestry + fishing
const SPIRIT_MEADOW_NODES: NodePlacement[] = [
  { type: 'goldwood' as NodeType, tileX: 8, tileY: 2 },
  { type: 'goldwood' as NodeType, tileX: 5, tileY: 10 },
  { type: 'goldwood' as NodeType, tileX: 24, tileY: 14 },
  { type: 'goldwood' as NodeType, tileX: 24, tileY: 16 },
  { type: 'shimmeroak' as NodeType, tileX: 9, tileY: 3 },
  { type: 'shimmeroak' as NodeType, tileX: 8, tileY: 9 },
  { type: 'small_pond' as NodeType, tileX: 27, tileY: 7 },
  { type: 'small_pond' as NodeType, tileX: 27, tileY: 9 },
  { type: 'small_pond' as NodeType, tileX: 22, tileY: 10 },
  // Round-out (cozy cluster): + prospecting so all 3 gathering skills live here. Placed beside the
  // trees (harvest-stand tiles, walkable). NOTE: not eyeballed in-zone — Alex verify.
  { type: 'raw_mana_node' as NodeType, tileX: 9, tileY: 9 },
  { type: 'raw_mana_node' as NodeType, tileX: 6, tileY: 10 },
]

// The Threshold — end-zone, rare prospecting
const THE_THRESHOLD_NODES: NodePlacement[] = [
  { type: 'element_crystal_node' as NodeType, tileX: 7, tileY: 2 },
  { type: 'pure_core_node' as NodeType, tileX: 4, tileY: 8 },
  { type: 'pure_core_node' as NodeType, tileX: 15, tileY: 8 },
  { type: 'ather_crystal_node' as NodeType, tileX: 8, tileY: 21 },
  { type: 'ather_crystal_node' as NodeType, tileX: 11, tileY: 21 },
]

// Moonwell Pass — the route out of the glade; a starter Shimmeroak grove (Alex can move these in-editor)
const ROUTE_MOONWELL_GARDEN_NODES: NodePlacement[] = [
  { type: 'shimmeroak' as NodeType, tileX: 7, tileY: 5 },
  { type: 'shimmeroak' as NodeType, tileX: 11, tileY: 5 },
  { type: 'shimmeroak' as NodeType, tileX: 15, tileY: 5 },
  { type: 'shimmeroak' as NodeType, tileX: 19, tileY: 5 },
]

const CRUCIBLE_NODES: NodePlacement[] = [

]

export const ZONE_NODES: Record<string, NodePlacement[]> = {
  'crucible': CRUCIBLE_NODES,
  garden: GARDEN_NODES,
  'mycelial-path': MYCELIAL_PATH_NODES,
  'moonwell-glade': MOONWELL_GLADE_NODES,
  'route-moonwell-garden': ROUTE_MOONWELL_GARDEN_NODES,
  'spore-hollow': SPORE_HOLLOW_NODES,
  'twilight-thicket': TWILIGHT_THICKET_NODES,
  'the-threshold': THE_THRESHOLD_NODES,
  'mana-springs': MANA_SPRINGS_NODES,
  'spirit-meadow': SPIRIT_MEADOW_NODES,
  'moonwell-glade-gregory-s-home': [],
  'test-sandbox': [],
}
