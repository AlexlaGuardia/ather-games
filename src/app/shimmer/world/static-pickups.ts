// Static Pickups — one-time overworld item finds (like Pokemon's pokeball items)
// Placed via Map Editor or hardcoded per zone. Once collected, never respawns.
// Rendered as a small bag sprite sitting flat on the ground. Click to collect.

import { px, SpriteAnim } from '../sprites/sprite-data'

const S = 32

export interface StaticPickup {
  id: string         // unique: "pickup_<zone>_<tileX>_<tileY>"
  itemId: string     // what item the player gets
  count: number      // stack count (default 1)
  tileX: number      // tile position
  tileY: number
  zoneId: string
}

/** Generate deterministic pickup ID from placement */
export function pickupId(zoneId: string, tileX: number, tileY: number): string {
  return `pickup_${zoneId}_${tileX}_${tileY}`
}

// ---- Bag Sprite (16x16 in 32x32 container) ----
// Small drawstring pouch sitting on the ground
// Palette: 1=gold, 2=dark brown, 3=cream, 4=outline
// Single frame — no animation. Replace this sprite with hand-drawn art later.

const BAG = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000110000000
  0000001111000000
  0000042222400000
  0000423332400000
  0000422332400000
  0000422222400000
  0000042222400000
  0000004444000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

export const PICKUP_BAG_ICON: SpriteAnim = {
  frames: [BAG],
  rate: 1,
}

// ---- Zone Pickup Data ----
// Empty by default — place items via the Map Editor
// Format matches node-placements.ts pattern

const GARDEN_PICKUPS: StaticPickup[] = []
const MYCELIAL_PATH_PICKUPS: StaticPickup[] = []
const MOONWELL_GLADE_PICKUPS: StaticPickup[] = []
const SPORE_HOLLOW_PICKUPS: StaticPickup[] = []
const TWILIGHT_THICKET_PICKUPS: StaticPickup[] = []
const MANA_SPRINGS_PICKUPS: StaticPickup[] = []
const SPIRIT_MEADOW_PICKUPS: StaticPickup[] = []
const THE_THRESHOLD_PICKUPS: StaticPickup[] = []


const TEST_SANDBOX_PICKUPS: StaticPickup[] = []

export const ZONE_PICKUPS: Record<string, StaticPickup[]> = {
  garden: GARDEN_PICKUPS,
  'mycelial-path': MYCELIAL_PATH_PICKUPS,
  'moonwell-glade': MOONWELL_GLADE_PICKUPS,
  'spore-hollow': SPORE_HOLLOW_PICKUPS,
  'twilight-thicket': TWILIGHT_THICKET_PICKUPS,
  'mana-springs': MANA_SPRINGS_PICKUPS,
  'spirit-meadow': SPIRIT_MEADOW_PICKUPS,
  'the-threshold': THE_THRESHOLD_PICKUPS,
  'moonwell-glade-gregory-s-home': [],
  'test-sandbox': TEST_SANDBOX_PICKUPS,
}
