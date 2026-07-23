// Wild encounter system — zone-based random battles
// Garden is always safe. Outer zones have encounter tables.
// Canon: spirits aren't wild animals — they're Ather beings drawn by curiosity.
// Encounters feel like spirits approaching you, not you attacking them.

import type { Species, Element } from '../spirits/spirit'
import { createSpirit, speciesDisplayName } from '../spirits/spirit'
import type { AITier } from './battle-ai'
import { LAUNCHED_SPECIES } from './spirit-index'

// ============================================
// Encounter Table
// ============================================

// ── AREAS HAVE A FIXED LEVEL, THE WORLD DOES NOT FOLLOW YOU (Alex, 2026-07-23) ──
// Levels used to be OFFSETS FROM THE PLAYER (`levelRange: [-2, 1]`), so every area
// re-levelled itself to whoever walked in. Two things fell out of that, both bad:
//   1. Out-levelling never paid. Grinding the starter route and coming back a monster
//      met a monster-sized welcome — the reward for progress was silently deleted. This
//      is the same complaint as "my L6 Dewbear feels the same", one layer up.
//   2. The map had no shape. Nowhere was dangerous, nowhere was safe, and "go north
//      when you're ready" could not mean anything.
// Bands are ABSOLUTE now: Moonwell Pass is Lv 3-5 whether you show up at 3 or at 30.
// That is what makes a region readable, lets a boss sit at a known level, and makes
// the levelEdge damage term in arena.ts feel like a reward instead of a treadmill.
export interface EncounterEntry {
  species: Species
  weight: number      // relative spawn weight (higher = more common)
  levels?: [number, number]  // ABSOLUTE override for this species (a rare tough spawn); defaults to the zone band
  element?: Element   // override element (default: 'base')
}

export interface ZoneEncounters {
  rate: number               // 0-1 chance per step (0 = no encounters)
  levels: [number, number]   // ABSOLUTE level band for the whole area — the zone's difficulty, not the player's
  entries: EncounterEntry[]
  aiTier: AITier
}

// ── WHO LIVES WHERE ────────────────────────────────────────────────────────────
// Species are placed by their CANON element affinity (CANON/world/spirits-species.md,
// the "Element Affinity" column) against what a region actually is. Canon rules the
// affinity; it does NOT rule habitat, so the distribution is a build call (Jin) derived
// from canon rather than invented against it — the one habitat line canon does give,
// "Cavern | Earth | Noctyx | Cave dwelling", is honoured in the Voranyx tables.
//   Water — Manalotl (axolotl), Croakling (frog)
//   Earth — Dewbear (water-bear), Shellmere (turtle), Lepara (rabbit)
//   Mana  — Vulnyx (fox), Athowl (owl), Luminara (firefly)
//   Storm — Hovari (hummingbird), Noctyx (bat)
// So Mana Springs is Manalotl + Croakling country, the caverns belong to Noctyx and the
// Earth walls, and the high wind of Ather Winds is Storm's. A species appearing in an
// area it has no business in is a bug, and encounters.test.ts asserts it.

/** Canon element affinity per species — transcribed from CANON/world/spirits-species.md's
 *  "The 10 Base Forms" table. THIS IS CANON, not a tuning knob: change it only when the
 *  canon file changes. Used to keep encounter tables ecologically honest. */
export const SPECIES_AFFINITY: Record<Species, 'water' | 'earth' | 'mana' | 'storm'> = {
  fox: 'mana',            // Vulnyx
  axolotl: 'water',       // Manalotl
  'water-bear': 'earth',  // Dewbear
  turtle: 'earth',        // Shellmere
  owl: 'mana',            // Athowl
  frog: 'water',          // Croakling
  firefly: 'mana',        // Luminara
  rabbit: 'earth',        // Lepara
  hummingbird: 'storm',   // Hovari
  bat: 'storm',           // Noctyx
}

/** What each region's landscape supports — the ecology contract. An encounter table may
 *  only draw species whose canon affinity appears here, so "a Manalotl in a dry cavern"
 *  fails the test instead of quietly shipping. Ordered by progression; encounters.test.ts
 *  also asserts the level bands rise along this list. */
export const ZONE_ECOLOGY: { zone: string; supports: ('water' | 'earth' | 'mana' | 'storm')[] }[] = [
  { zone: 'moonwell-glade',        supports: ['earth', 'water', 'mana'] },          // moonlit well + grass
  { zone: 'route-garden-mycelial', supports: ['earth', 'mana', 'water'] },          // hedged lane
  { zone: 'route-moonwell-garden', supports: ['earth', 'water', 'mana', 'storm'] }, // open windy hub
  { zone: 'mycelial-path',         supports: ['mana', 'storm', 'water', 'earth'] }, // damp fungal gloom
  { zone: 'spirit-meadow',         supports: ['earth', 'storm', 'mana'] },          // open grass, no standing water
  { zone: 'sorrel-hold',           supports: ['mana', 'earth', 'storm'] },          // occupied ground
  { zone: 'wooded-trail',          supports: ['mana', 'earth'] },                   // canopy
  { zone: 'twilight-thicket',      supports: ['storm', 'mana'] },                   // night forest
  { zone: 'mana-springs',          supports: ['water', 'storm'] },                  // open water + spray
  { zone: 'spore-hollow',          supports: ['storm', 'earth', 'mana'] },          // Voranyx 1F — canon: Noctyx cavern
  { zone: 'voranyx-deep',          supports: ['storm', 'earth', 'mana'] },          // Voranyx 2F
  { zone: 'brack-hold',            supports: ['mana', 'earth', 'storm'] },          // the last stronghold
  { zone: 'the-threshold',         supports: ['storm', 'mana'] },                   // Ather Winds — high wind
]

export const ENCOUNTER_TABLES: Record<string, ZoneEncounters> = {
  // Garden — your safe haven, no encounters
  'garden': { rate: 0, levels: [1, 1], entries: [], aiTier: 'wild' },

  // ── EARLY RING (Lv 2-6) — the Bubble. Gentle, cozy, forgiving. ──

  // Moonwell Glade — Gregory's zone and where a new Keeper wakes up. Softest in the game.
  // Moonlit water: Lepara grazing, Croakling at the well, Luminara over it.
  'moonwell-glade': {
    rate: 0.08,
    levels: [2, 4],
    entries: [
      { species: 'rabbit',  weight: 4 },   // Lepara — Earth
      { species: 'frog',    weight: 3 },   // Croakling — Water (the well)
      { species: 'firefly', weight: 2 },   // Luminara — Mana
      { species: 'owl',     weight: 1 },   // Athowl — Mana, rare
    ],
    aiTier: 'wild',
  },

  // Route One (Home Plot ↔ Mycelial Path) — the first steps out the gate.
  'route-garden-mycelial': {
    rate: 0.08,
    levels: [3, 5],
    entries: [
      { species: 'rabbit',  weight: 4 },
      { species: 'firefly', weight: 3 },
      { species: 'frog',    weight: 2 },
    ],
    aiTier: 'wild',
  },

  // Moonwell Pass — the 3-way hub (W→Home Plot, N→Spirit Meadows, E→Moonwell Glade).
  // First mist a new Keeper crosses. BAND SET BY ALEX (2026-07-23).
  'route-moonwell-garden': {
    rate: 0.08,
    levels: [3, 5],
    entries: [
      { species: 'rabbit',      weight: 4 },
      { species: 'frog',        weight: 3 },
      { species: 'hummingbird', weight: 2 },   // Hovari — Storm, riding the pass wind
      { species: 'firefly',     weight: 2 },
    ],
    aiTier: 'wild',
  },

  // Mycelial Path — fungal, dim, spore-lit. Luminara and Noctyx thrive in the gloom.
  'mycelial-path': {
    rate: 0.08,
    levels: [4, 6],
    entries: [
      { species: 'firefly',    weight: 4 },
      { species: 'bat',        weight: 3 },   // Noctyx — Storm, low light
      { species: 'frog',       weight: 2 },
      { species: 'water-bear', weight: 2 },   // Dewbear — Earth, under the caps
    ],
    aiTier: 'wild',
  },

  // ── THE HOLD ARC (Lv 7-9) — the Moglins. Where the game turns. ──

  // Spirit Meadows — open grass under a wide sky. Hold 1 (Thistle) sits here.
  // BAND SET BY ALEX (2026-07-23); Thistle himself is pinned at Lv 7 in Shimmer3D.
  'spirit-meadow': {
    rate: 0.07,
    levels: [7, 8],
    entries: [
      { species: 'rabbit',      weight: 4 },
      { species: 'hummingbird', weight: 3 },
      { species: 'fox',         weight: 2 },   // Vulnyx — Mana
      { species: 'firefly',     weight: 2 },
    ],
    aiTier: 'wild',
  },

  // Wooded Trail — cozy forest pocket west of the spine. Canopy = Athowl country.
  'wooded-trail': {
    rate: 0.08,
    levels: [8, 10],
    entries: [
      { species: 'owl',     weight: 4 },
      { species: 'fox',     weight: 3 },
      { species: 'rabbit',  weight: 2 },
      { species: 'firefly', weight: 2 },
    ],
    aiTier: 'wild',
  },

  // Sorrel Hold — Hold 2's stronghold grounds. Sorrel's own team is pinned 7/6/6 (Alex).
  'sorrel-hold': {
    rate: 0.10,
    levels: [7, 9],
    entries: [
      { species: 'fox',         weight: 3 },
      { species: 'turtle',      weight: 3 },   // Shellmere — Earth, the wall
      { species: 'water-bear',  weight: 2 },
      { species: 'hummingbird', weight: 2 },
    ],
    aiTier: 'trained',
  },

  // ── DEEP RING (Lv 9-18) — past the Bubble. ──

  // Twilight Thicket — dark forest after dusk. Storm and night-Mana own it.
  'twilight-thicket': {
    rate: 0.08,
    levels: [9, 11],
    entries: [
      { species: 'bat',     weight: 4 },
      { species: 'owl',     weight: 3 },
      { species: 'firefly', weight: 3 },
      { species: 'fox',     weight: 1 },
    ],
    aiTier: 'wild',
  },

  // Mana Springs — open water. Manalotl and Croakling country, exactly where you would
  // expect to find them (Alex, 2026-07-23). Hovari hangs in the spray.
  'mana-springs': {
    rate: 0.09,
    levels: [11, 13],
    entries: [
      { species: 'axolotl',     weight: 5 },   // Manalotl — Water, the signature of the place
      { species: 'frog',        weight: 4 },   // Croakling — Water
      { species: 'hummingbird', weight: 2 },   // Hovari — Storm, "Mist" runeword
    ],
    aiTier: 'wild',
  },

  // Voranyx Caverns 1F — canon gives Noctyx the cavern ("Cavern | Earth | Noctyx |
  // Cave dwelling"), so the caves are its house, shared with the Earth walls.
  'spore-hollow': {
    rate: 0.12,
    levels: [13, 15],
    entries: [
      { species: 'bat',        weight: 4 },
      { species: 'water-bear', weight: 3 },
      { species: 'turtle',     weight: 3 },
      { species: 'fox',        weight: 1 },
    ],
    aiTier: 'trained',
  },

  // Voranyx Caverns 2F — deeper, meaner, same tenants.
  'voranyx-deep': {
    rate: 0.12,
    levels: [15, 18],
    entries: [
      { species: 'bat',        weight: 4 },
      { species: 'turtle',     weight: 3 },
      { species: 'water-bear', weight: 3 },
      { species: 'fox',        weight: 2 },
      { species: 'owl',        weight: 1, levels: [18, 20] },   // a rare deep Athowl, above the band
    ],
    aiTier: 'trained',
  },

  // Brack Hold — Hold 3, the climax, and the door to Ather Winds.
  'brack-hold': {
    rate: 0.12,
    levels: [17, 19],
    entries: [
      { species: 'owl',        weight: 3 },
      { species: 'water-bear', weight: 3 },
      { species: 'turtle',     weight: 3 },
      { species: 'fox',        weight: 2 },
      { species: 'bat',        weight: 1 },
    ],
    aiTier: 'trained',
  },

  // Ather Winds — the sealed gate to the Wilds; seeds ride in on the high wind. Storm's own.
  'the-threshold': {
    rate: 0.12,
    levels: [19, 22],
    entries: [
      { species: 'hummingbird', weight: 4 },
      { species: 'bat',         weight: 3 },
      { species: 'owl',         weight: 3 },
      { species: 'fox',         weight: 1 },
    ],
    aiTier: 'trained',
  },
}

// ── THE HOLDS — fixed boss levels, same law as the bands ───────────────────────
// The Moglin holds used to level off the PLAYER (`Math.max(6, partyLevel) + 2`), which
// made the whole arc un-outrunnable: Brack was always exactly as far above you as the
// day you first walked in. Pinned now, and pinned HERE rather than in the component, so
// a boss and the wilds it stands among can be read against each other in one place.
//
// Alex's shape (2026-07-23): a boss sits at or just under its area's wild band — it is
// the gatekeeper of the region, not a difficulty spike. Thistle Lv 7 under Spirit
// Meadows' 7-8; Sorrel 7/6/6 under Sorrel Hold's 7-9.
export const HOLD_LEVELS = {
  thistle: 7,                                     // Hold 1 — one collared captive (canon: you free it)
  sorrel:  { guard: 7, captive: 6 },              // Hold 2 — guard + 2 captives  → 6/7/6
  brack:   { muscle: 19, enforcer: 18, captive: 17 },  // Hold 3 — 2 guards + 3 captives, under Brack Hold's 17-19
} as const

// ============================================
// Encounter Roll
// ============================================

export interface WildEncounter {
  species: Species
  name: string
  level: number
  element: Element
  aiTier: AITier
}

/** Roll for a wild encounter when player steps on a veil tile.
 *  Only call this on VEIL tiles — non-veil tiles should never roll.
 *  isDense: true for dense veil (1.5x encounter rate, capped at 0.20)
 *  force: skip the rate roll and always draw (if the zone can spawn anything) — used to
 *         guarantee a new Keeper's FIRST wild encounter so the arena reliably debuts. */
export function rollEncounter(zoneId: string, isDense?: boolean, force?: boolean): WildEncounter | null {
  const table = ENCOUNTER_TABLES[zoneId]
  if (!table || table.entries.length === 0) return null

  // Filter to launched species only
  const entries = table.entries.filter(e => LAUNCHED_SPECIES.includes(e.species))
  if (entries.length === 0) return null

  // Rate check — dense veil gets boosted rate; a forced draw skips it entirely
  const rate = isDense ? Math.min(table.rate * 1.5, 0.20) : table.rate
  if (!force && Math.random() >= rate) return null

  // Weighted pick
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0)
  let roll = Math.random() * totalWeight
  let picked: EncounterEntry = entries[0]
  for (const entry of entries) {
    roll -= entry.weight
    if (roll <= 0) { picked = entry; break }
  }

  // Level — ABSOLUTE, off the zone's band (or this species' own override). The player's
  // level is deliberately NOT an input: an area's difficulty is a property of the area.
  const [lo, hi] = picked.levels ?? table.levels
  const level = Math.max(1, Math.min(100, lo + Math.floor(Math.random() * (hi - lo + 1))))

  // Name
  const name = `Wild ${speciesDisplayName(picked.species)}`

  return {
    species: picked.species,
    name,
    level,
    element: picked.element ?? 'base',
    aiTier: table.aiTier,
  }
}

// ============================================
// Trainer Config
// ============================================

export interface TrainerConfig {
  species: Species
  name: string         // spirit name, not trainer name
  levelOffset: number  // relative to player level
  element: Element
  aiTier: AITier
}

/** Create a trainer's spirit for battle */
export function createTrainerSpirit(trainer: TrainerConfig, playerLevel: number) {
  const level = Math.max(1, Math.min(100, playerLevel + trainer.levelOffset))
  const spirit = createSpirit(trainer.species, trainer.name, 0, 0)
  spirit.level = level
  spirit.element = trainer.element
  spirit.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 24) + 8) // decent IVs
  spirit.bond = 80 // trainers have bonded spirits
  spirit.happiness = 200
  return spirit
}
