// ── The walker's SCENE palette — the colours of the picture, not of the chrome ─────────────────
//
// `tokens.ts` is the vocabulary of the MENUS, and since 2026-09-23 every play3d menu speaks it (or the
// Carved Hearth's `H` / `hk-*`). What was left in the files after that pass was not drift in the
// chrome: it was the world. Material colours, the Crucible's gun HUD, labels that float in world
// space, the two cinematic cuts. Those had nowhere to live, so they stayed as literals, and a literal
// with no home is exactly how the walker got to 761 colours in the first place.
//
// So this is that home. ★ EVERY VALUE HERE WAS MOVED, NOT CHOSEN — each one is the literal its call
// site already held, byte for byte, so adopting this file moved no pixel. Where a value was ALREADY a
// token (the water, the mint, the arcane violet), it is imported from `tokens.ts` rather than typed a
// second time; `tokens.test.ts` fails if this file re-spells a token value.
//
// ⚠ THIS FILE MAY HOLD COLOUR AND MAY DRAW NOTHING. It is a PALETTE in the guard's terms: no JSX, no
// style objects. The moment a component lives here it is chrome and belongs on the hearth.
//
// ★ THE GUN HUD STAYS DARK (Alex, 2026-09-23: "keep the gun HUD dark"). The Crucible's reticle, ammo,
// bars and cast bar are an instrument read mid-fight over a moving scene; the hearth is for menus.
// They live under `gun`, named, so the ruling is a place in the code and not a hole in the guard.

import { accent, gold, hair, map, mint, status, tone, white } from './tokens'

export { white }
export const black = '#000000'
/** The near-black the models use for an eye, a nub, a label's ink. */
export const inkDeep = '#0d1a17'

const WARP_GOLD = '#ffe08a'
const WARP_GLOW = '#ffcf4d'
const GOLDWOOD = '#d9b84a'
const EXIT_GREEN = '#5fe0a0'
const EXIT_GLOW = '#7fffc0'
const BERRY = '#e0607a'
const BRIGHT_GOLD = '#ffd98a'
const HOT_GOLD = '#ffd44a'
const SOUL = '#aef2ff'
const MOON = '#a9c8ff'
const SKY = '#bfe3ef'
const RUST_RED = '#ff7a5f'
const CAST_DARK = '#2b3038'

// ── the world ────────────────────────────────────────────────────────────────────────────────
/** The sky the scene clears to, and the fog that fades the far world into it. One value: they must match. */
export const sky = SKY

export const terrain = {
  grass: '#7cc46a',
  wall: '#e3e9f4',
  building: '#8a5a2b',
  buildingTop: '#9c6733',
  water: map.water,
  warpFloor: '#caa233',
  warpGlow: WARP_GLOW,
  warpBeacon: WARP_GOLD,
  mist: '#eef4ff',
  /** Edit mode only: the cells that are nothing. */
  void: '#39406b',
} as const

/** Harvest nodes — the trunk (stem, rock, bed) and the canopy (leaves, crystal, surface). */
export const node = {
  goldwood:             { trunk: '#8a6a3c', canopy: GOLDWOOD },
  shimmeroak:           { trunk: '#6f5330', canopy: '#4fc79a' },
  starwillow:           { trunk: '#9a8f7a', canopy: '#cfe6d0' },
  dawnwood:             { trunk: '#7a4a34', canopy: '#f0a86a' },
  raw_mana_node:        { trunk: '#4a5568', canopy: '#bcd4ea' },
  element_crystal_node: { trunk: '#4a3a5e', canopy: accent.arcane },
  pure_core_node:       { trunk: '#3e5a58', canopy: '#a6efe2' },
  ather_crystal_node:   { trunk: '#6a5a34', canopy: '#f0d986' },
  small_pond:           { trunk: '#31505e', canopy: '#6fbcd9' },
  stream:               { trunk: '#31505e', canopy: '#82cce4' },
  lake:                 { trunk: '#2b4552', canopy: '#5fa8d0' },
} as const
/** The rinning bobber, and the channel bar that drains as a node is worked (berry → dawn). */
export const bobber = BERRY
export const channelBar = { from: BERRY, to: '#f0a86a', text: '#bfe0ff', track: '#0009', trackEdge: '#0007' } as const

/** Placed stations: the prop's `body` + `cap`, and the `cue` the reticle and the touch A take near it. */
export const station = {
  alchemy_station: { body: tone.alchemy.border, cap: accent.arcane, cue: '#a679ff' },
  crafting_table:  { body: '#7a5a34', cap: GOLDWOOD, cue: GOLDWOOD },
  chest:           { body: '#7a521a', cap: gold.dim, cue: gold.dim },
  exchange_booth:  { body: '#2f4a3f', cap: accent.teal, cue: accent.teal },
  farm_planter:    { body: '#4a3a1e', cap: accent.leaf, cue: accent.leaf },
} as const
/** The placement ghost's ring: free to place, and blocked. */
export const placeRing = { ok: mint.base, blocked: '#ff5a4d' } as const

/** Moglin-patrol spawners: the earth mound, its dark mouth, the hold's claim post. */
export const spawner = { mound: '#6d5138', mouth: '#1d1610', post: '#4a3826' } as const

// ── figures ──────────────────────────────────────────────────────────────────────────────────
/** An NPC stand-in: the head, a moglin's collar, and the beacon over whoever you can talk to. */
export const figure = {
  head: '#ecdab4',
  collar: '#6b6675', collarGlow: '#241f2e',
  beacon: WARP_GOLD, beaconGlow: WARP_GLOW,
  moglinBeacon: '#b58adf', moglinBeaconGlow: '#7a4fc0',
} as const
/** NPC roster tints (npcs3d.ts): the colour each stand-in wears until it has a model. */
export const npcTint = {
  gregory: '#caa46a', trader: '#c9a05a',
  thistle: '#9a6aaa', vetch: '#7a5a3a', brack: '#5a4632',
} as const
/** The keeper you walk as (the blockout capsule + its facing cone). */
export const player = { body: '#5ad1e6', cone: '#f6e9da' } as const
/** Other keepers in your world: their capsule, and the plate their name floats on. */
export const remote = { body: inkDeep, name: mint.text, plate: 'rgba(12,16,26,0.78)', plateEdge: hair.weak } as const
/** A resting spirit's core (its element supplies the glow). */
export const spiritCore = '#fdfbef'
/** Bonded Mana'mal followers — blockout tints until they have sprites/models (the art rule). */
export const beast: Record<string, string> = {
  drifthorn: '#c9b6ea', dustwhisker: '#e6cf9a', sporeling: '#8fd97f', glowmite: '#8fd0ea', embermole: '#e69a6a',
}
export const beastFallback = '#9fd9c4'
/** The glow under a harvest pop and a rinning bite. */
export const popGlow = map.label
export const biteGlow = status.info

// ── the way out ──────────────────────────────────────────────────────────────────────────────
/** Exit pillars and gates: open to all, and owner-only. */
export const exit = { pillar: EXIT_GREEN, glow: EXIT_GLOW, labelPlate: 'rgba(8,14,10,0.7)', labelEdge: `${EXIT_GREEN}66` } as const
export const gate = { open: EXIT_GREEN, openGlow: EXIT_GLOW, owner: '#d8a24a', ownerGlow: '#ffcf7a' } as const
/** The hub's two signposted gates. */
export const hubGate = { range: '#ff7a4a', runeHold: '#b07aff' } as const

// ── light ────────────────────────────────────────────────────────────────────────────────────
/** The day's glyph colours on the clock column. */
export const dayGlyph = { dawn: '#ffc48a', day: WARP_GOLD, dusk: '#e0a0d0', night: MOON } as const
/** The sun and moon the SkyLight lerps between. */
export const sunlight = {
  sunLow: '#ffb774', sunHigh: '#fff3d8', moon: MOON,
  ambientDay: '#fff1d5', ambientNight: '#8fadd8',
} as const

// ── the Crucible (dark on purpose — see the header) ────────────────────────────────────────
/** A keeper's soul colour: tracers, bolts, the manabox core, the armory's accent. */
export const soul = SOUL
export const crucible = {
  bench: CAST_DARK,
  challenger: '#b4694a',
  guard: '#8d9199',
  target: { face: '#f2f5f7', ring: '#e6483f', bull: HOT_GOLD },
  returnFire: '#ffb35c',
  fieldDisc: '#ff9a4c',
  conjured: '#6f7580',
  hunter: '#ff4f7d',
} as const
/**
 * THE HOLD (round survival, `hold.ts`). The flooded read as wet dark mass with a cold sheen — the
 * host's raised body, shown; never a colour that names a cause. Seals are rough plank, gates are
 * the mortal side's dead grey, and the three fixtures are told apart by a small lit accent.
 */
export const hold = {
  body: '#1d2a33', bodySheen: '#3f6f86', swift: '#24404d', bulk: '#141d24',
  plank: '#8a6a44', gate: '#5d636c', gateRim: '#9aa3ad',
  rack: '#3a3f46', font: '#4fb3d9', cache: '#b98cf2',
  glimmer: '#ffeaa3',  // the Glimmer of Hope — warm light, the one kind thing the flooded leave
  // the building (`HoldBuilding`): floor and wall never share a colour, and no two floors share a pair,
  // so where you are reads at a glance. Bottom → top. Ramps are the one warm accent: they are the way.
  levels: [
    { floor: '#5a5e57', wall: '#8c5a44' },   // bottom: slate floor, brick walls
    { floor: '#4f5a66', wall: '#6f9aa6' },   // middle: blue-grey floor, teal walls
    { floor: '#6b6456', wall: '#c8b58a' },   // top: warm stone floor, sand walls
  ],
  garden: '#4d6b3c', rail: '#9aa3ad', ramp: '#c79a4a', lintel: '#3a3d42',
  pad: '#2f3338', unit: '#7d858e',   // the rooftop: the dark pad they landed on, the grey plant units
} as const
/** The manabox viewmodel: dead grey cast metal with bronze trim (the art-medium law). */
export const viewmodel = {
  lanceStock: '#22262b', lanceBody: '#2e343b', lanceBarrel: '#3a4048', lanceTrim: '#6d5a3a', bronze: '#7c6a44',
  spitterStock: '#20242a', spitterBody: CAST_DARK, spitterTrim: '#5a5140', spitterBronze: '#6f6650',
} as const
/** The gun HUD. */
export const gun = {
  reticle: '#f2ffff',
  hitmark: white, hitmarkCrit: HOT_GOLD,
  hp: '#86f2a2', hpLow: RUST_RED, hpText: '#bfe9cd', hpTextLow: '#ff9a86',
  shield: '#7fd0ff', shieldText: '#a8ddff',
  barEdge: '#ffffff2e', label: hair.bright,
  ammo: mint.text, ammoReload: '#8fe0ff', ammoEmpty: RUST_RED, ammoLow: BRIGHT_GOLD,
  castHeld: BRIGHT_GOLD, castBuilt: SOUL, castIdle: hair.strong, castEdge: hair.weak,
  castKind: '#ffffff4d', castEmpty: map.edge, castUnbuilt: hair.bright,
} as const
/** What the reticle says it will do: a bite, fishing/gathering, a keeper to talk to, a node, nothing. */
export const cue = {
  bite: '#ff6a5a', water: '#5aa9e6', talk: '#e8c86a', harvest: '#7fd9a0', idle: '#dffaf0',
} as const

// ── the cuts ─────────────────────────────────────────────────────────────────────────────────
/** Crossing into a region: the cloud wash and its three inks. */
export const transit = {
  washIn: '#eef7fb', washMid: '#cfe7f1', washOut: '#9dc4d6',
  kicker: '#5f7f8d', name: '#2c4a58', nameGlow: '#ffffffcc', mark: '#7da4b4',
} as const
/** A wild spirit's approach, and the arena's floor behind it. */
export const approach = {
  ground: '#05070a', kicker: '#dfeee9', line: '#c9d6d1', flash: mint.text, shadow: '#000',
} as const
export const arenaFloor = '#0a0a12'
/** The canvas fallback's ink (shown if WebGL fails) and the first-load screen. */
export const fallbackInk = '#1c2a33'
export const loading = { ground: '#0e0c1c', ink: gold.parchment } as const
