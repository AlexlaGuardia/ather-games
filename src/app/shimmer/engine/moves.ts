// Battle move system — element matchups, move definitions, state access
// Canon: shimmer-battles.md — 4 elements, 7 states, soft matchups (no immunities)

import type { Species, Element } from '../spirits/spirit'

// ============================================
// Types
// ============================================

export type BattleElement = 'mana' | 'storm' | 'earth' | 'water' | 'neutral'
export type MoveState = 'solid' | 'compact' | 'expanding' | 'ignite' | 'flow' | 'scatter' | 'bind'
export type CombatStat = 'pwr' | 'grd' | 'agi' | 'vig'
export type StatusId = 'ignition' | 'regen' | 'crystallize' | 'fortify' | 'surge' | 'erosion' | 'anchor'

export interface Move {
  id: string
  name: string
  element: BattleElement
  state: MoveState
  power: number           // 0 = status move, 20-100 for damage
  accuracy: number        // 1-100
  pp: number              // uses per battle
  priority: number        // -1, 0, or +1
  effect?: StatusId           // inflicted on FOE
  effectChance?: number       // 0-100
  selfEffect?: StatusId       // inflicted on SELF (e.g. regen from flow moves)
  selfEffectChance?: number   // 0-100
  statChanges?: { target: 'self' | 'foe'; stat: CombatStat; stages: number }[]
  reaches?: number            // Reach granted to a COLLARED foe when used (the Reach-encounter mechanic).
                              // Honest/calming moves reach the spirit under the collar; damage never does.
  description: string
}

// ============================================
// Element Matchup Chart
// ============================================

// Cycle: Mana→Water→Storm→Earth→Mana (strong = 1.5x)
// Reverse = 0.75x, same/neutral = 1.0x
const MATCHUP: Record<BattleElement, Record<BattleElement, number>> = {
  mana:    { mana: 1.0, storm: 0.75, earth: 1.0, water: 1.5, neutral: 1.0 },
  storm:   { mana: 1.5, storm: 1.0, earth: 0.75, water: 1.0, neutral: 1.0 },
  earth:   { mana: 1.0, storm: 1.5, earth: 1.0, water: 0.75, neutral: 1.0 },
  water:   { mana: 0.75, storm: 1.0, earth: 1.5, water: 1.0, neutral: 1.0 },
  neutral: { mana: 1.0, storm: 1.0, earth: 1.0, water: 1.0, neutral: 1.0 },
}

/** Get effectiveness multiplier: attacker's move element vs defender's element */
export function getEffectiveness(moveElement: BattleElement, defenderElement: BattleElement): number {
  return MATCHUP[moveElement]?.[defenderElement] ?? 1.0
}

/** Get effectiveness label for events */
export function effectivenessLabel(mult: number): 'super' | 'weak' | 'neutral' {
  if (mult > 1.0) return 'super'
  if (mult < 1.0) return 'weak'
  return 'neutral'
}

/** Check STAB (Same Type Attack Bonus): spirit element matches move element */
export function hasSTAB(spiritElement: BattleElement, moveElement: BattleElement): boolean {
  return moveElement !== 'neutral' && spiritElement === moveElement
}

// ============================================
// Element → Accessible States
// ============================================

// Each element can access 5 of 7 states, locked out of 2
export const ELEMENT_STATES: Record<BattleElement, MoveState[]> = {
  mana:    ['solid', 'compact', 'ignite', 'flow', 'bind'],
  storm:   ['expanding', 'ignite', 'flow', 'scatter', 'bind'],
  earth:   ['solid', 'compact', 'ignite', 'scatter', 'bind'],
  water:   ['solid', 'compact', 'expanding', 'flow', 'scatter'],
  neutral: ['solid', 'compact', 'expanding', 'ignite', 'flow', 'scatter', 'bind'],
}

/** Check if a spirit element can learn a move of a given state */
export function canLearnState(spiritElement: BattleElement, moveState: MoveState): boolean {
  return ELEMENT_STATES[spiritElement].includes(moveState)
}

// ============================================
// Move Definitions
// ============================================

// Helper for concise move definitions
function m(id: string, name: string, element: BattleElement, state: MoveState, power: number, accuracy: number, pp: number, priority: number, description: string, extras?: Partial<Move>): Move {
  return { id, name, element, state, power, accuracy, pp, priority, description, ...extras }
}

// ──────────────────────────────────────────────
// UNIVERSAL — every spirit gets these
// ──────────────────────────────────────────────

export const MOVE_MANA_PULSE = m('mana_pulse', 'Mana Pulse', 'neutral', 'solid', 40, 100, 30, 0, 'A basic pulse of mana energy.')
export const MOVE_SPIRIT_WARD = m('spirit_ward', 'Spirit Ward', 'neutral', 'compact', 0, 100, 20, 0, 'Channel mana into a protective ward. Raises Guard.', { statChanges: [{ target: 'self', stat: 'grd', stages: 1 }], reaches: 13 })
// Reach-encounter moves — calm, honest, no harm. The way to free a collared spirit: reach the one underneath.
export const MOVE_STILL_BREATH = m('still_breath', 'Still-Breath', 'neutral', 'compact', 0, 100, 15, 0, 'Go quiet and steady. Offers the collared spirit a moment of calm — and a way out.', { reaches: 18 })

// ──────────────────────────────────────────────
// SOLID — Direct damage strikes (Mana, Earth, Water)
// ──────────────────────────────────────────────

export const MOVES_SOLID = {
  // Starter tier (55 power)
  mana_shard:    m('mana_shard', 'Mana Shard', 'mana', 'solid', 55, 95, 20, 0, 'A sharp fragment of crystallized mana.'),
  stone_throw:   m('stone_throw', 'Stone Throw', 'earth', 'solid', 55, 95, 20, 0, 'Hurl a dense chunk of earth crystal.'),
  ice_spike:     m('ice_spike', 'Ice Spike', 'water', 'solid', 55, 95, 20, 0, 'A frozen shard of compressed water mana.'),
  // High tier (70 power)
  manalic_lance: m('manalic_lance', 'Manalic Lance', 'mana', 'solid', 70, 90, 12, 0, 'Crystallized mana shaped into a piercing lance.'),
  iron_crush:    m('iron_crush', 'Iron Crush', 'earth', 'solid', 70, 90, 12, 0, 'A dense mass of earth mana slams into the target.'),
  freeze_lance:  m('freeze_lance', 'Freeze Lance', 'water', 'solid', 70, 90, 12, 0, 'A javelin of frozen mana. May crystallize.', { effect: 'crystallize', effectChance: 15 }),
} as const

// ──────────────────────────────────────────────
// COMPACT — Defense / shields (Mana, Earth, Water)
// ──────────────────────────────────────────────

export const MOVES_COMPACT = {
  barrier_wall: m('barrier_wall', 'Barrier Wall', 'mana', 'compact', 0, 100, 15, 0, 'Raise a mana barrier. Fortifies defenses.', {
    statChanges: [{ target: 'self', stat: 'grd', stages: 1 }],
    selfEffect: 'fortify', selfEffectChance: 40,
  }),
  gem_shell: m('gem_shell', 'Gem Shell', 'earth', 'compact', 0, 100, 10, 0, 'Encase in crystal armor. Sharply raises Guard.', {
    statChanges: [{ target: 'self', stat: 'grd', stages: 2 }],
  }),
  hydro_armor: m('hydro_armor', 'Hydro Armor', 'water', 'compact', 0, 100, 15, 0, 'Flowing water shield. Raises Guard and may regenerate.', {
    statChanges: [{ target: 'self', stat: 'grd', stages: 1 }],
    selfEffect: 'regen', selfEffectChance: 50,
  }),
} as const

// ──────────────────────────────────────────────
// EXPANDING — Area / spread (Storm, Water)
// ──────────────────────────────────────────────

export const MOVES_EXPANDING = {
  // Starter
  bolt_rush: m('bolt_rush', 'Bolt Rush', 'storm', 'expanding', 50, 100, 20, 1, 'A lightning-fast charge. Always strikes first.'),
  mist_cloud: m('mist_cloud', 'Mist Cloud', 'water', 'expanding', 60, 100, 15, 0, 'Enveloping mist. Lowers foe Agility.', {
    statChanges: [{ target: 'foe', stat: 'agi', stages: -1 }],
  }),
  // High tier
  chain_lightning: m('chain_lightning', 'Chain Lightning', 'storm', 'expanding', 65, 90, 12, 0, 'Arcing bolts that surge through the target.', { effect: 'surge', effectChance: 25 }),
  tide_pulse: m('tide_pulse', 'Tide Pulse', 'water', 'expanding', 55, 95, 15, 0, 'A wave of pressure that radiates outward.', { effect: 'surge', effectChance: 20 }),
} as const

// ──────────────────────────────────────────────
// IGNITE — Burst damage (Mana, Storm, Earth)
// ──────────────────────────────────────────────

export const MOVES_IGNITE = {
  star_flare:   m('star_flare', 'Star Flare', 'mana', 'ignite', 75, 90, 10, 0, 'A burst of stellar mana. May ignite the target.', { effect: 'ignition', effectChance: 20 }),
  tempest_bolt: m('tempest_bolt', 'Tempest Bolt', 'storm', 'ignite', 75, 90, 10, 0, 'A thunderous strike. May crystallize the target.', { effect: 'crystallize', effectChance: 15 }),
  magma_blast:  m('magma_blast', 'Magma Blast', 'earth', 'ignite', 75, 90, 10, 0, 'Eruption of superheated earth. May ignite.', { effect: 'ignition', effectChance: 20 }),
} as const

// ──────────────────────────────────────────────
// FLOW — Sustain / healing / buffs (Mana, Storm, Water)
// ──────────────────────────────────────────────

export const MOVES_FLOW = {
  // Starter (water)
  aqua_stream: m('aqua_stream', 'Aqua Stream', 'water', 'flow', 50, 100, 20, 0, 'A flowing current that may restore vitality.', { selfEffect: 'regen', selfEffectChance: 20 }),
  // Utility
  life_mend: m('life_mend', 'Life Mend', 'mana', 'flow', 0, 100, 10, 0, 'Channel pure mana to mend wounds. Grants regen.', {
    selfEffect: 'regen', selfEffectChance: 100,
    statChanges: [{ target: 'self', stat: 'grd', stages: 1 }],
  }),
  breeze_lift: m('breeze_lift', 'Breeze Lift', 'storm', 'flow', 0, 100, 15, 0, 'Ride the updraft. Raises Agility and Power.', {
    statChanges: [{ target: 'self', stat: 'agi', stages: 1 }, { target: 'self', stat: 'pwr', stages: 1 }],
  }),
  fluid_restore: m('fluid_restore', 'Fluid Restore', 'water', 'flow', 0, 100, 10, 0, 'Deep water meditation. Grants regen and raises Guard.', {
    selfEffect: 'regen', selfEffectChance: 100,
    statChanges: [{ target: 'self', stat: 'grd', stages: 1 }],
  }),
} as const

// ──────────────────────────────────────────────
// SCATTER — Disruption / debuffs (Storm, Earth, Water)
// ──────────────────────────────────────────────

export const MOVES_SCATTER = {
  static_shock: m('static_shock', 'Static Shock', 'storm', 'scatter', 45, 100, 20, 0, 'Crackling discharge that erodes defenses.', { effect: 'erosion', effectChance: 25 }),
  dust_blind:   m('dust_blind', 'Dust Blind', 'earth', 'scatter', 40, 95, 20, 0, 'Fling earth dust to blind. Lowers foe Agility.', { statChanges: [{ target: 'foe', stat: 'agi', stages: -1 }] }),
  vapor_drain:  m('vapor_drain', 'Vapor Drain', 'water', 'scatter', 45, 100, 20, 0, 'Sapping mist that corrodes the spirit.', { effect: 'erosion', effectChance: 20 }),
  // Higher tier
  storm_scatter: m('storm_scatter', 'Storm Scatter', 'storm', 'scatter', 60, 90, 12, 0, 'Chaotic storm fragments. May erode and lower Guard.', {
    effect: 'erosion', effectChance: 30,
    statChanges: [{ target: 'foe', stat: 'grd', stages: -1 }],
  }),
  quake_dust: m('quake_dust', 'Quake Dust', 'earth', 'scatter', 55, 90, 12, 0, 'Shatter the ground. Lowers Power and Agility.', {
    statChanges: [{ target: 'foe', stat: 'pwr', stages: -1 }, { target: 'foe', stat: 'agi', stages: -1 }],
  }),
  fog_sap: m('fog_sap', 'Fog Sap', 'water', 'scatter', 50, 95, 15, 0, 'Dense fog that saps strength. Lowers foe Power.', {
    effect: 'erosion', effectChance: 25,
    statChanges: [{ target: 'foe', stat: 'pwr', stages: -1 }],
  }),
} as const

// ──────────────────────────────────────────────
// BIND — Control / traps (Mana, Storm, Earth)
// ──────────────────────────────────────────────

export const MOVES_BIND = {
  enchant_lock: m('enchant_lock', 'Enchant Lock', 'mana', 'bind', 50, 90, 15, 0, 'Mana threads bind the target. May anchor.', { effect: 'anchor', effectChance: 30 }),
  illuminate:   m('illuminate', 'Illuminate', 'storm', 'bind', 45, 95, 15, 0, 'Blinding light reveals and pins. May anchor.', { effect: 'anchor', effectChance: 25 }),
  metal_snare:  m('metal_snare', 'Metal Snare', 'earth', 'bind', 55, 85, 15, 0, 'Earth-forged shackles grip the target. May anchor.', { effect: 'anchor', effectChance: 35 }),
  // Utility bind
  mana_seal: m('mana_seal', 'Mana Seal', 'mana', 'bind', 0, 100, 10, 0, 'Seal the target in mana. Anchors and lowers Power.', {
    effect: 'anchor', effectChance: 100,
    statChanges: [{ target: 'foe', stat: 'pwr', stages: -1 }],
  }),
  static_cage: m('static_cage', 'Static Cage', 'storm', 'bind', 0, 100, 10, 0, 'Electrified cage. Anchors and lowers Agility.', {
    effect: 'anchor', effectChance: 100,
    statChanges: [{ target: 'foe', stat: 'agi', stages: -1 }],
  }),
  root_grip: m('root_grip', 'Root Grip', 'earth', 'bind', 0, 100, 10, 0, 'Earthen roots anchor the target. Lowers Guard.', {
    effect: 'anchor', effectChance: 100,
    statChanges: [{ target: 'foe', stat: 'grd', stages: -1 }],
  }),
} as const

// ──────────────────────────────────────────────
// Element starter index (first element move, learned on evolution)
// ──────────────────────────────────────────────

export const ELEMENT_STARTERS: Record<Exclude<BattleElement, 'neutral'>, Move> = {
  mana:  MOVES_SOLID.mana_shard,
  storm: MOVES_EXPANDING.bolt_rush,
  earth: MOVES_SOLID.stone_throw,
  water: MOVES_FLOW.aqua_stream,
}

// ──────────────────────────────────────────────
// Element mid-tier index (second element move, ~level 15+)
// ──────────────────────────────────────────────

export const ELEMENT_MID: Record<Exclude<BattleElement, 'neutral'>, Move> = {
  mana:  MOVES_COMPACT.barrier_wall,
  storm: MOVES_SCATTER.static_shock,
  earth: MOVES_SCATTER.dust_blind,
  water: MOVES_EXPANDING.mist_cloud,
}

// ──────────────────────────────────────────────
// Element high-tier index (third element move, ~level 25+)
// ──────────────────────────────────────────────

export const ELEMENT_HIGH: Record<Exclude<BattleElement, 'neutral'>, Move> = {
  mana:  MOVES_IGNITE.star_flare,
  storm: MOVES_IGNITE.tempest_bolt,
  earth: MOVES_IGNITE.magma_blast,
  water: MOVES_SOLID.freeze_lance,
}

// ──────────────────────────────────────────────
// SPECIES SIGNATURES (Bond 50 unlock, 4 per species)
// Canon: shimmer-master.md runeword → signature move
// ──────────────────────────────────────────────

type ElementSigs = Record<Exclude<BattleElement, 'neutral'>, Move>

export const SPECIES_SIGNATURES: Record<Species, ElementSigs> = {
  // Fox: fast, evasive — Veil / Bolt / Burrow / Current
  fox: {
    mana:  m('veil_strike', 'Veil Strike', 'mana', 'bind', 60, 100, 15, 0, 'Strike from the veil. Raises own Agility.', { statChanges: [{ target: 'self', stat: 'agi', stages: 1 }] }),
    storm: m('thunder_kit_rush', 'Thunder Kit Rush', 'storm', 'expanding', 65, 100, 15, 1, 'Lightning-fast lunge. Always strikes first.'),
    earth: m('burrow_guard', 'Burrow Guard', 'earth', 'compact', 0, 100, 10, 0, 'Dig in deep. Sharply raises Guard.', { statChanges: [{ target: 'self', stat: 'grd', stages: 2 }] }),
    water: m('current_dash', 'Current Dash', 'water', 'flow', 55, 100, 15, 0, 'Ride the current. Raises own Agility.', { statChanges: [{ target: 'self', stat: 'agi', stages: 1 }] }),
  },

  // Axolotl: healer, tanky — Restore / Pulse / Silt / Flow
  axolotl: {
    mana:  m('restore_pulse', 'Restore Pulse', 'mana', 'flow', 0, 100, 8, 0, 'Deep mana restoration. Regen and raises Guard.', { selfEffect: 'regen', selfEffectChance: 100, statChanges: [{ target: 'self', stat: 'grd', stages: 1 }] }),
    storm: m('shock_gill', 'Shock Gill', 'storm', 'scatter', 60, 95, 12, 0, 'Bioelectric shock from charged gills. May erode.', { effect: 'erosion', effectChance: 30 }),
    earth: m('silt_veil', 'Silt Veil', 'earth', 'scatter', 50, 100, 15, 0, 'Muddy camouflage. Lowers foe accuracy via AGI drop.', { statChanges: [{ target: 'foe', stat: 'agi', stages: -1 }, { target: 'self', stat: 'grd', stages: 1 }] }),
    water: m('deep_dive', 'Deep Dive', 'water', 'flow', 60, 100, 12, 0, 'Dive deep and strike. May grant regen.', { selfEffect: 'regen', selfEffectChance: 30 }),
  },

  // Owl: wise, powerful attacker — Oracle / Gale / Root / Dive
  owl: {
    mana:  m('oracle_sight', 'Oracle Sight', 'mana', 'bind', 0, 100, 10, 0, 'Foresee the foe\'s weakness. Sharply raises Power.', { statChanges: [{ target: 'self', stat: 'pwr', stages: 2 }] }),
    storm: m('gale_wing', 'Gale Wing', 'storm', 'expanding', 65, 90, 12, 0, 'Howling wind assault. May lower foe Guard.', { statChanges: [{ target: 'foe', stat: 'grd', stages: -1 }] }),
    earth: m('ancient_root', 'Ancient Root', 'earth', 'bind', 55, 90, 12, 0, 'Ancient roots pin the foe. May anchor.', { effect: 'anchor', effectChance: 35 }),
    water: m('fisher_dive', 'Fisher Dive', 'water', 'solid', 70, 90, 12, 0, 'Precision diving strike. High damage.'),
  },

  // Frog: fast, disruptive — Toxin / Crackle / Clay / Swim
  frog: {
    mana:  m('hex_toxin', 'Hex Toxin', 'mana', 'bind', 45, 100, 15, 0, 'Magical venom that anchors and erodes.', { effect: 'anchor', effectChance: 30, statChanges: [{ target: 'foe', stat: 'pwr', stages: -1 }] }),
    storm: m('spark_crackle', 'Spark Crackle', 'storm', 'scatter', 55, 100, 15, 0, 'Crackling static discharge. Fast and disruptive.', { effect: 'erosion', effectChance: 25 }),
    earth: m('mud_clay', 'Mud Clay', 'earth', 'compact', 0, 100, 15, 0, 'Mud camouflage. Raises Guard and Agility.', { statChanges: [{ target: 'self', stat: 'grd', stages: 1 }, { target: 'self', stat: 'agi', stages: 1 }] }),
    water: m('stream_swim', 'Stream Swim', 'water', 'flow', 55, 100, 15, 1, 'Swift current strike. Priority move.'),
  },

  // Firefly: glass cannon, high PWR — Lumina / Spark / Ember / Gleam
  firefly: {
    mana:  m('beacon_lumina', 'Beacon Lumina', 'mana', 'ignite', 80, 85, 8, 0, 'Brilliant burst of pure light. Devastating power.', { effect: 'ignition', effectChance: 25 }),
    storm: m('lightning_spark', 'Lightning Spark', 'storm', 'expanding', 60, 100, 15, 1, 'Electric flash. Always strikes first.'),
    earth: m('cave_ember', 'Cave Ember', 'earth', 'ignite', 65, 95, 12, 0, 'Warm cave glow that erupts. May ignite.', { effect: 'ignition', effectChance: 20 }),
    water: m('abyss_gleam', 'Abyss Gleam', 'water', 'expanding', 65, 90, 12, 0, 'Cold deep-sea light. May surge through defenses.', { effect: 'surge', effectChance: 25 }),
  },

  // Rabbit: fast, lucky — Fortune / Dash / Warren / Paddle
  rabbit: {
    mana:  m('lucky_fortune', 'Lucky Fortune', 'mana', 'flow', 0, 100, 10, 0, 'Lucky charm. Raises Power and Agility.', { statChanges: [{ target: 'self', stat: 'pwr', stages: 1 }, { target: 'self', stat: 'agi', stages: 1 }] }),
    storm: m('thunder_dash', 'Thunder Dash', 'storm', 'expanding', 60, 100, 15, 1, 'Lightning hop. Priority strike.'),
    earth: m('warren_dig', 'Warren Dig', 'earth', 'compact', 0, 100, 10, 0, 'Burrow into a warren. Sharply raises Guard.', { statChanges: [{ target: 'self', stat: 'grd', stages: 2 }], selfEffect: 'fortify', selfEffectChance: 40 }),
    water: m('marsh_paddle', 'Marsh Paddle', 'water', 'flow', 55, 100, 15, 0, 'Paddle through marsh water. May grant regen.', { selfEffect: 'regen', selfEffectChance: 25 }),
  },

  // Water Bear: ultimate tank — Endure / Resist / Micro / Suspend
  'water-bear': {
    mana:  m('eternal_endure', 'Eternal Endure', 'mana', 'compact', 0, 100, 5, 0, 'Absolute survival. Massively raises Guard.', { statChanges: [{ target: 'self', stat: 'grd', stages: 3 }] }),
    storm: m('shock_resist', 'Shock Resist', 'storm', 'scatter', 50, 100, 15, 0, 'Absorb and reflect. Lowers foe Power and Guard.', { statChanges: [{ target: 'foe', stat: 'pwr', stages: -1 }, { target: 'foe', stat: 'grd', stages: -1 }] }),
    earth: m('moss_crush', 'Moss Crush', 'earth', 'solid', 65, 90, 12, 0, 'Tiny but dense impact. Ignores Guard scaling.'),
    water: m('cryo_suspend', 'Cryo Suspend', 'water', 'compact', 0, 100, 5, 0, 'Enter cryptobiosis. Regen and massive Guard boost.', { selfEffect: 'regen', selfEffectChance: 100, statChanges: [{ target: 'self', stat: 'grd', stages: 2 }] }),
  },

  // Hummingbird: fast, siphon — Siphon / Flutter / Gem / Mist
  hummingbird: {
    mana:  m('nectar_siphon', 'Nectar Siphon', 'mana', 'flow', 50, 100, 15, 0, 'Drain energy from the foe. Heals and debuffs.', { selfEffect: 'regen', selfEffectChance: 30, statChanges: [{ target: 'foe', stat: 'pwr', stages: -1 }] }),
    storm: m('gale_flutter', 'Gale Flutter', 'storm', 'expanding', 55, 100, 15, 1, 'Rapid wingbeats create a gale. Priority strike.'),
    earth: m('jewel_dart', 'Jewel Dart', 'earth', 'solid', 65, 95, 12, 0, 'Crystalline projectile. May crystallize.', { effect: 'crystallize', effectChance: 20 }),
    water: m('vapor_mist', 'Vapor Mist', 'water', 'scatter', 50, 100, 15, 0, 'Ethereal mist. Lowers foe Agility and Power.', { statChanges: [{ target: 'foe', stat: 'agi', stages: -1 }, { target: 'foe', stat: 'pwr', stages: -1 }] }),
  },

  // Turtle: slowest, tankiest — Barrier / Static / Metalergy / Hydro
  turtle: {
    mana:  m('shell_barrier', 'Shell Barrier', 'mana', 'compact', 0, 100, 8, 0, 'Impenetrable shell. Massive Guard and fortify.', { statChanges: [{ target: 'self', stat: 'grd', stages: 2 }], selfEffect: 'fortify', selfEffectChance: 60 }),
    storm: m('thunderback', 'Thunderback', 'storm', 'scatter', 55, 95, 12, 0, 'Electrified shell rebounds. Lowers foe Power and may erode.', { effect: 'erosion', effectChance: 25, statChanges: [{ target: 'foe', stat: 'pwr', stages: -1 }] }),
    earth: m('iron_metalergy', 'Iron Metalergy', 'earth', 'bind', 60, 90, 12, 0, 'Metal-infused slam. May anchor the foe.', { effect: 'anchor', effectChance: 30 }),
    water: m('hydro_press', 'Hydro Press', 'water', 'solid', 70, 90, 10, 0, 'Crushing water pressure. Raw power.'),
  },

  // Bat: fast, stealth — Shroud / Sonar / Cavern / Skim
  bat: {
    mana:  m('shadow_shroud', 'Shadow Shroud', 'mana', 'bind', 55, 95, 15, 0, 'Darkness engulfs. Raises own Agility and may anchor.', { effect: 'anchor', effectChance: 20, statChanges: [{ target: 'self', stat: 'agi', stages: 1 }] }),
    storm: m('echo_sonar', 'Echo Sonar', 'storm', 'scatter', 55, 100, 15, 0, 'Sonic blast. Lowers foe Guard.', { statChanges: [{ target: 'foe', stat: 'grd', stages: -1 }] }),
    earth: m('stone_cavern', 'Stone Cavern', 'earth', 'compact', 0, 100, 10, 0, 'Retreat into stone. Raises Guard and lowers foe Agility.', { statChanges: [{ target: 'self', stat: 'grd', stages: 2 }, { target: 'foe', stat: 'agi', stages: -1 }] }),
    water: m('skim_strike', 'Skim Strike', 'water', 'solid', 60, 100, 15, 1, 'Skim the surface and strike. Priority move.'),
  },
}

// Backwards compat exports for existing references
export const FOX_SIGNATURES = SPECIES_SIGNATURES.fox
export const MOVE_STAR_FLARE = MOVES_IGNITE.star_flare
export const MOVE_TEMPEST_BOLT = MOVES_IGNITE.tempest_bolt
export const MOVE_MAGMA_BLAST = MOVES_IGNITE.magma_blast
export const MOVE_MIST_CLOUD = MOVES_EXPANDING.mist_cloud

// ============================================
// Move Selection for Spirits
// ============================================

/** Convert Spirit element to BattleElement */
export function toBattleElement(element: Element): BattleElement {
  if (element === 'base') return 'neutral'
  return element
}

/** Get the move pool for a spirit based on species, element, level, and bond.
 *  Progression: base form → starter moves, mid-level → element moves, high-level → power moves, bond → signature.
 *  Always returns exactly 4 moves (best available, capped). */
export function getMovesForSpirit(
  species: Species,
  element: Element,
  level: number,
  bond: number,
): Move[] {
  const pool: Move[] = []
  const bElement = toBattleElement(element)
  const elKey = bElement as Exclude<BattleElement, 'neutral'>

  // === Always available ===
  pool.push(MOVE_MANA_PULSE)

  // === Level 1+: Spirit Ward (universal defense) ===
  pool.push(MOVE_SPIRIT_WARD)

  // === Element starter (on evolution / non-base element) ===
  if (element !== 'base' && ELEMENT_STARTERS[elKey]) {
    pool.push(ELEMENT_STARTERS[elKey])
  }

  // === Level 15+: mid-tier element move ===
  if (element !== 'base' && level >= 15 && ELEMENT_MID[elKey]) {
    pool.push(ELEMENT_MID[elKey])
  }

  // === Level 25+: high-tier element move ===
  if (element !== 'base' && level >= 25 && ELEMENT_HIGH[elKey]) {
    pool.push(ELEMENT_HIGH[elKey])
  }

  // === Bond 50+: species signature move ===
  if (bond >= 50 && element !== 'base') {
    const sig = SPECIES_SIGNATURES[species]?.[elKey]
    if (sig) pool.push(sig)
  }

  // Take the 4 strongest (most recently learned) — last 4
  return pool.slice(-4)
}

// ============================================
// All Moves Registry (flat lookup by id)
// ============================================

function collectMoves(...groups: Record<string, Move>[]): Record<string, Move> {
  const all: Record<string, Move> = {}
  for (const group of groups) {
    for (const move of Object.values(group)) {
      all[move.id] = move
    }
  }
  return all
}

export const ALL_MOVES: Record<string, Move> = {
  [MOVE_MANA_PULSE.id]: MOVE_MANA_PULSE,
  [MOVE_SPIRIT_WARD.id]: MOVE_SPIRIT_WARD,
  ...collectMoves(
    MOVES_SOLID, MOVES_COMPACT, MOVES_EXPANDING,
    MOVES_IGNITE, MOVES_FLOW, MOVES_SCATTER, MOVES_BIND,
  ),
  // Signatures (flattened from all species)
  ...Object.values(SPECIES_SIGNATURES).reduce<Record<string, Move>>((acc, sigs) => {
    for (const move of Object.values(sigs)) acc[move.id] = move
    return acc
  }, {}),
}
