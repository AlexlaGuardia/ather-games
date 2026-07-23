// Evolution configuration — single source of truth for all evolution MECHANICS
// (thresholds, stat mods, runewords). Editable via Sprite Editor > Element Palettes.
//
// Canon source for NAMES: /root/athernyx/CANON/world/spirits-species.md (authoritative,
//   ruled 2026-06-22). The shimmer-master.md / shimmer-awakened-master.md files are
//   DERIVED quick-lookups, not truth. Verify alignment with `npm run canon`.

import type { Species, Element } from './spirit'

// ── Global thresholds ──────────────────────────────────

export const EVOLUTION_THRESHOLDS = {
  bloomLevel: 3,             // level a spirit blooms at — where its learnset starts (not 1)
  secondFormLevel: 34,       // level at which base → second form triggers
  awakenedFormLevel: 67,     // level at which second → awakened triggers
  maxLevel: 100,
} as const

export const INFUSION_CAPS = {
  totalCap: 11,              // max infusion points across all elements
  perElementCap: 9,          // max infusion points in any single element
} as const

// Stat ceilings per form stage (stats cannot exceed these)
export const STAT_CAPS = {
  base: 50,
  second: 75,
  awakened: 100,
} as const

// ── Element stat modifiers ─────────────────────────────
// Applied when spirit evolves to second form with that element

export type StatMod = { stat: string; mod: number }

export const ELEMENT_STAT_MODS: Record<Exclude<Element, 'base'>, StatMod[]> = {
  mana:  [{ stat: 'vig', mod: 1.1 }, { stat: 'prs', mod: 1.1 }],  // +VIG, +PRS, bond growth
  storm: [{ stat: 'agi', mod: 1.1 }, { stat: 'pwr', mod: 1.1 }],  // +AGI, +PWR
  earth: [{ stat: 'grd', mod: 1.1 }, { stat: 'vig', mod: 1.05 }], // +GRD, +VIG
  water: [{ stat: 'agi', mod: 1.05 }, { stat: 'vig', mod: 1.05 }], // +AGI, +VIG — adaptive sustain
}

// ── Runewords per element ──────────────────────────────
// Each second form has an associated runeword (used in alchemy + lore)

export const RUNEWORDS: Record<Species, Record<Exclude<Element, 'base'>, string>> = {
  fox:         { mana: 'Veil',    storm: 'Bolt',    earth: 'Burrow',    water: 'Current' },
  axolotl:     { mana: 'Restore', storm: 'Pulse',   earth: 'Silt',      water: 'Flow' },
  owl:         { mana: 'Oracle',  storm: 'Gale',    earth: 'Root',      water: 'Dive' },
  frog:        { mana: 'Toxin',   storm: 'Crackle', earth: 'Clay',      water: 'Swim' },
  firefly:     { mana: 'Lumina',  storm: 'Spark',   earth: 'Ember',     water: 'Gleam' },
  rabbit:      { mana: 'Fortune', storm: 'Dash',    earth: 'Warren',    water: 'Paddle' },
  'water-bear': { mana: 'Endure', storm: 'Resist',  earth: 'Micro',     water: 'Suspend' },
  hummingbird: { mana: 'Siphon',  storm: 'Flutter', earth: 'Gem',       water: 'Mist' },
  turtle:      { mana: 'Barrier', storm: 'Static',  earth: 'Metalergy', water: 'Hydro' },
  bat:         { mana: 'Shroud',  storm: 'Sonar',   earth: 'Cavern',    water: 'Skim' },
}

// ── Awakened branches ──────────────────────────────────
// 4 branches per second form, each requiring different mastery

export type AwakenedBranch = 'alpha' | 'beta' | 'gamma' | 'delta'

export interface BranchDef {
  name: string            // branch display name
  focus: string           // what mastery it represents
  prereqSummary: string   // short description of requirements
}

export const AWAKENED_BRANCHES: Record<AwakenedBranch, BranchDef> = {
  alpha: { name: 'Champion', focus: 'Combat',      prereqSummary: '50 wins + Champion defeat + 80 combat stat' },
  beta:  { name: 'Virtuoso', focus: 'Performance', prereqSummary: '10 show wins + Perfect rating + 80 show stat' },
  gamma: { name: 'Ace',      focus: 'Racing',      prereqSummary: '25 race wins + track record + 80 racing stat' },
  delta: { name: 'Enigma',   focus: 'Hidden',      prereqSummary: 'Unique per creature — discovered, not published' },
}

// ── Awakened form names ────────────────────────────────
// 160 total: 10 species × 4 elements × 4 branches
// Fill in as Alex designs them; null = not yet named

export type AwakenedNames = Record<AwakenedBranch, string | null>

export const AWAKENED_FORM_NAMES: Record<Species, Record<Exclude<Element, 'base'>, AwakenedNames>> = {
  fox: {
    mana:  { alpha: 'Phantom Striker',  beta: 'Phantom Charmer',  gamma: 'Phantom Dash',     delta: 'Nine-Tail Specter' },
    storm: { alpha: 'Storm Fang',       beta: 'Spark Performer',  gamma: 'Lightning Runner',  delta: 'Raijin Kit' },
    earth: { alpha: 'Earth Fang',       beta: 'Forest Spirit',    gamma: 'Tunnel Runner',     delta: 'Kitsune Elder' },
    water: { alpha: 'River Fang',       beta: 'Mist Dancer',      gamma: 'Rapids Racer',      delta: 'River Spirit' },
  },
  axolotl: {
    mana:  { alpha: 'Battle Medic',     beta: 'Grace Healer',     gamma: 'Swift Healer',      delta: 'Life Font' },
    storm: { alpha: 'Volt Striker',     beta: 'Neon Dancer',      gamma: 'Pulse Racer',       delta: 'Storm Caller' },
    earth: { alpha: 'Ambush Lurker',    beta: 'Earth Artist',     gamma: 'Swamp Slider',      delta: 'Ancient Lurker' },
    water: { alpha: 'Abyssal Hunter',   beta: 'Biolume Star',     gamma: 'Trench Racer',      delta: 'Primordial Lotl' },
  },
  owl: {
    mana:  { alpha: 'Oracle Striker',   beta: 'Mystic Sage',      gamma: 'Vision Glider',     delta: 'Third Eye' },
    storm: { alpha: 'Gale Striker',     beta: 'Sky Dancer',       gamma: 'Jet Stream',        delta: 'Hurricane' },
    earth: { alpha: 'Grove Guardian',   beta: 'Forest Sage',      gamma: 'Branch Runner',     delta: 'World Tree Owl' },
    water: { alpha: 'Dive Bomber',      beta: 'River Monarch',    gamma: 'Skim Racer',        delta: 'Kingfisher Prime' },
  },
  frog: {
    mana:  { alpha: 'Venom Mage',       beta: 'Psychedelic Star', gamma: 'Blink Hopper',      delta: 'Witch Toad' },
    storm: { alpha: 'Thunder Toad',     beta: 'Crackle Star',     gamma: 'Volt Hopper',       delta: 'Lightning Lord' },
    earth: { alpha: 'Earth Toad',       beta: 'Clay Artist',      gamma: 'Burrow Hopper',     delta: 'Primordial Toad' },
    water: { alpha: 'Torrent Striker',  beta: 'Lily Dancer',      gamma: 'Current Champion',  delta: 'Rain Bringer' },
  },
  firefly: {
    mana:  { alpha: 'Holy Light',       beta: 'Star Fly',         gamma: 'Guide Light',       delta: 'Sun Spark' },
    storm: { alpha: 'Shock Fly',        beta: 'Neon Dancer',      gamma: 'Bolt Bug',          delta: 'Storm Lantern' },
    earth: { alpha: 'Crystal Fly',      beta: 'Amber Light',      gamma: 'Tunnel Guide',      delta: 'Core Light' },
    water: { alpha: 'Angler Fly',       beta: 'Deep Star',        gamma: 'Current Spark',     delta: 'Void Light' },
  },
  rabbit: {
    mana:  { alpha: 'Fortune Fighter',  beta: 'Blessing Hare',    gamma: 'Lucky Dash',        delta: 'Moon Rabbit' },
    storm: { alpha: 'Storm Hare',       beta: 'Flash Dancer',     gamma: 'Lightning Dash',    delta: 'Raijin Hare' },
    earth: { alpha: 'Warren Lord',      beta: 'Earth Dancer',     gamma: 'Dig Racer',         delta: 'World Warren' },
    water: { alpha: 'Swamp Fighter',    beta: 'Reed Dancer',      gamma: 'Paddle Champion',   delta: 'Spirit Hare' },
  },
  'water-bear': {
    mana:  { alpha: 'Immortal Tank',    beta: 'Endurance Star',   gamma: 'Marathon Bear',     delta: 'Cosmic Bear' },
    storm: { alpha: 'Absorb Tank',      beta: 'Static Star',      gamma: 'Rubber Racer',      delta: 'Lightning Rod' },
    earth: { alpha: 'Mountain Bear',    beta: 'Garden Bear',      gamma: 'Boulder Roll',      delta: 'World Seed' },
    water: { alpha: 'Frost Tank',       beta: 'Crystal Bear',     gamma: 'Glacier Glide',     delta: 'Ancient Cryo' },
  },
  hummingbird: {
    mana:  { alpha: 'Drain Strike',     beta: 'Flower Dancer',    gamma: 'Energy Dash',       delta: 'Life Drinker' },
    storm: { alpha: 'Wind Blade',       beta: 'Tempest Dancer',   gamma: 'Mach Bird',         delta: 'Storm Weaver' },
    earth: { alpha: 'Gem Striker',      beta: 'Diamond Star',     gamma: 'Prism Racer',       delta: "Philosopher's Bird" },
    water: { alpha: 'Mist Striker',     beta: 'Cloud Dancer',     gamma: 'Steam Jet',         delta: 'Rain Spirit' },
  },
  turtle: {
    mana:  { alpha: 'Sage Guardian',    beta: 'Sage Enchanter',   gamma: 'Sage Glider',       delta: 'Sage Primordial' },
    storm: { alpha: 'Thunder Warden',   beta: 'Storm Dancer',     gamma: 'Bolt Racer',        delta: 'Tempest Ancient' },
    earth: { alpha: 'Iron Bastion',     beta: 'Chrome Beauty',    gamma: 'Steel Roller',      delta: 'Living Fortress' },
    water: { alpha: 'Abyssal Guardian', beta: 'Pearl Sovereign',  gamma: 'Current Rider',     delta: 'Leviathan' },
  },
  bat: {
    mana:  { alpha: 'Night Striker',    beta: 'Dark Star',        gamma: 'Shade Racer',       delta: 'Void Bat' },
    storm: { alpha: 'Sonic Striker',    beta: 'Sound Weaver',     gamma: 'Sonar Speed',       delta: 'Frequency Master' },
    earth: { alpha: 'Gargoyle',         beta: 'Cathedral Bat',    gamma: 'Cave Champion',     delta: 'Ancient Guardian' },
    water: { alpha: 'Dive Striker',     beta: 'Moon Fisher',      gamma: 'Skim Champion',     delta: 'Lake Guardian' },
  },
}
