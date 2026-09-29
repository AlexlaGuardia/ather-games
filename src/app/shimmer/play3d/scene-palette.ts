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
  /** THE EXPEDITION (09-29): worked stone underfoot, weathered stone walls. Not the town's brick: a maze is not a
   *  street, and grass underfoot read as a garden hedge-maze. What these places ARE is open canon; this is only stone. */
  expFloor: map.stone,
  expWall: '#6e665c',
  expWallTop: '#7f776b',
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
  gregory: '#caa46a', trader: '#c9a05a', imbuer: '#8fb8c9', clerk: '#7f9fb8',
  thistle: '#9a6aaa', vetch: '#7a5a3a', brack: '#5a4632',
} as const
// ── the Passage (2026-09-25) ─────────────────────────────────────────────────────────────────
/** Under Rune Hold: warm umber rock, lantern glass, stall cloth, the arcade room's cabinets and plate.
 *  Canon's words for the place are *"lantern-lit, surprisingly warm"*, so every value leans amber. */
export const passage = {
  rock: ['#4d3a2c', '#57412f', '#5f4834', '#463428', '#6a503a'],
  ceiling: ['#2e231b', '#35291f', '#3b2d22'],
  /** packed earth underfoot, worn paler where the traffic runs */
  floor: ['#5b4633', '#54412f', '#614b36', '#4e3c2c'],
  wood: '#6b4a2e', iron: '#2a221c', glass: '#f0a040', lamp: '#ffb85c',
  dustSheet: '#8a8070', skin: '#e8c9a0',
  wares: ['#c9a46a', '#8fb3c9', '#b98fc9'],
  cloth: { rack: '#7a4a2a', teacher: '#4a5a7a', gems: '#6a3a6a', vessels: '#3a6a4a', bay: '#5a5044' },
  arcadeLight: '#a7b8ff',
  /** the caravans: weathered wagon wood, canvas tops (one per slot), iron tyres */
  wagon: { body: '#5a3e26', wheel: '#3a2a1c', tyre: '#2a221c', canvas: { daily: '#d8c8a0', weekly: '#b88a5a', monthly: '#8a9a8a' } },
  cabinet: { body: '#1c1612', deck: '#2b211a', dark: '#0b0b0b', off: '#000000', marquee: '#ffe0a0', marqueeGlow: '#ffcf70', marqueeDark: '#222222' },
  /** the sky that is not there: a faint cold spill, and the ambient floor of a lamplit room */
  noSun: '#8a7a6a', ambient: '#6a4a30',
  /** the cabinet overlay's plate */
  plate: { bg: '#120c08', glow: 'rgba(212,168,67,0.25)', ink: '#fde68a', faint: 'rgba(251,191,36,0.6)', edge: 'rgba(180,83,9,0.5)', scrim: 'rgba(0,0,0,0.8)' },
} as const

/** Rune Hold — the Passage's materials under an open sky (`RuneHoldScene`): cut stone, slate, timber,
 *  cobbles, the same lantern glass. Lighter than the Passage's rock because the sun is on it. */
export const runeHold = {
  stone: ['#8a7a68', '#7e6f5e', '#958470', '#74665a', '#9a8a74', '#83735f'],
  /** the hillside the town is carved into: the Passage's dug rock, a shade paler in daylight */
  hill: ['#86705a', '#927a62', '#7a6550', '#9a8268', '#735f4c'],
  hillTop: ['#6b7d4a', '#5f7143', '#748550'],
  roof: ['#4a3d36', '#553f33', '#3f3a38', '#5a4436'],
  timber: '#5b3d25', sill: '#4a3220',
  window: '#f0b050',
  cobble: ['#9a8c7a', '#8c7f6e', '#a39480', '#857868', '#94866f'],
  mortar: '#5e5446',
  meadow: ['#71905a', '#74925b', '#6e8c57', '#76935c'],
  /** THE LANDING's plaza: a dressed-stone dais, a paler inlay ring, the stone ring the disc stands in */
  landing: { dais: '#a3927c', inlay: '#b8a88f', kerb: '#7e6f5e', ring: '#8f7f6a' },
  /** the storefronts: timber frames, plank doors, painted signs, the café's awning, the Notice Board */
  front: {
    jamb: '#4a3220', door: '#6b4a2e', doorBand: '#2e2218', sign: '#2e2218', signInk: '#f3e2b8', signGild: '#d8b86a',
    awning: ['#b8483a', '#efe2c8'], board: '#5b3d25', notes: ['#efe2c8', '#e8d6a8', '#f3ead6', '#d9c7a0'], pin: '#b8483a',
    smoke: '#d8d4cc', forge: '#ff8a3a',
  },
  /** the mountains round the town: meadow at the foot, rock above, snow on the Valkara */
  peaks: { meadow: '#6f8c55', scrub: '#6b7348', rock: '#7d6c5a', crag: '#665a4d', snow: '#eef0f2' },
  /** the ground worn bare where the streets meet the grass */
  worn: ['#7d7458', '#857a5c'],
} as const

/** The Travelers Station — the spaceport (`StationScene`): the town's stone for the terminal, a pale laid apron,
 *  berth pads, and a blockout ship in the skyship's lineage (a manalic hull, lift-runes fed by mana cells). */
export const spaceport = {
  apron: ['#a89c88', '#a09481', '#aea290', '#9c907c'],
  apronSeam: '#6e6454',
  hallFloor: ['#8e7f6a', '#968671', '#877865'],
  pad: '#5a5550', padRing: '#d8b86a', padLight: '#ffd88a', padNumber: '#f3e2b8',
  roof: '#4a3d36', beam: '#5b3d25',
  hull: '#7c7468', hullDark: '#5a544b', plate: '#948a7a', trim: '#b8904a', rune: '#6fe0d0', canopy: '#2a3a40',
  board: { bg: '#15110d', frame: '#5b3d25', ink: '#f3e2b8', dim: '#8a7a60', lit: '#ffcf70' },
} as const

/** Rune Hold's townsfolk (`Townsfolk.tsx`): Alkin coded by TRADE, never by a colour of their own
 *  (`design-briefs/keepers.md` › Townsfolk) — soot, leather aprons, travelers by their kit. */
export const folk = {
  skin: ['#e8c9a0', '#d6ae84', '#b98a62', '#8e6446', '#f0d4b4', '#a5774f'],
  hair: ['#3a2a1e', '#5a4030', '#2a2420', '#7a5a3a', '#9a8a78'],
  shirt: ['#8a7e6a', '#7a6e5c', '#6e6a60', '#948670'],
  trousers: ['#4a4238', '#3e3a34', '#524a3e'],
  leather: '#6b4a2e', soot: '#34302b', apronLinen: '#d8ccb0', pack: '#7a5e3e', packStrap: '#4a3624',
  cloak: ['#6b6f5a', '#7a6a58', '#5a6470', '#6e5a50'], coat: '#3e4550', cap: '#2e323a', waistcoat: '#4a4238',
  tag: { bg: 'rgba(24,18,12,0.78)', ink: '#f3e2b8', edge: 'rgba(216,184,106,0.55)' },
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
 * THE SLACK + THE STILLWIND (the season-1 raid, `stillwind.ts`, canon f77d125). Lenna's light is dim deep red and
 * its plants run near-black; the Glare side of the strip warms toward ember, the Rime side cools toward frost, and
 * the line between stays the band's own dusk. The Stillwind is the flood's INKY BLACK ooze (⛔ never the Ather's
 * matte grey) with deep red-gold core-light where the ooze thins; toward the Glare it boils thin and the light
 * shows, toward the Rime it stiffens and frosts.
 */
export const slack = {
  ground: '#2a1d1f', line: '#15100f', glare: '#ff5a2a', rime: '#bfe0ff',
  ooze: '#050507', oozeSheen: '#2b1a12', core: '#ffb347', coreDeep: '#c2410c', frost: '#dfefff',
  wind: '#f3d9c4',
}

/**
 * THE HOLD (round survival, `hold.ts`). The flooded read as wet dark mass with a cold sheen — the
 * host's raised body, shown; never a colour that names a cause. Seals are rough plank, gates are
 * the mortal side's dead grey, and the three fixtures are told apart by a small lit accent.
 */
export const hold = {
  body: '#1d2a33', bodySheen: '#3f6f86', swift: '#24404d', bulk: '#141d24',
  plank: '#8a6a44', gate: '#5d636c', gateRim: '#9aa3ad',
  rack: '#3a3f46', font: '#4fb3d9', cache: '#b98cf2',
  // the lab (09-27, canon › THE LAB, WRACK): wrack is scattered core-light — the core's cold glow, broken small; the bench
  // is the world's own dead office desk with its people's notes on it
  wrack: '#bfe6ff', bench: '#4a4640', benchNotes: '#e8e2d0',
  glimmer: '#ffeaa3',  // Last Light (was the Glimmer of Hope; renamed 09-26 off the Cave Glimmer spirit's word) — warm light, the one kind thing the flooded leave
  // chests (09-26): the body is a darkened wood/metal, the lid seam glows the rarity — the HUD prompt names it in the same colour
  chestBody: { common: '#6e5236', rare: '#2f4a66', legendary: '#6a5222' },
  chest: { common: '#d9c7a0', rare: '#6fb4ff', legendary: '#ffc94a' },
  // ground zero (09-26, TBD-CANON look): the core a cold white-hot, the device dead grey metal with a
  // pale-cyan wake light — neither names a cause, per the flooded's own rule above
  core: '#dfe9f0', coreGlow: '#9fd8ff', device: '#4a5058', deviceGlow: '#bff3ff',
  // vents (09-26): a dark iron grate; the shaft under it lights the flooded's cold sheen while a body climbs it — the tell
  vent: '#2a2e33', ventGlow: '#3f6f86',
  // the building (`HoldBuilding`): floor and wall never share a colour, and no two floors share a pair,
  // so where you are reads at a glance. Bottom → top. Ramps are the one warm accent: they are the way.
  levels: [
    { floor: '#5a5e57', wall: '#8c5a44' },   // bottom: slate floor, brick walls
    { floor: '#4f5a66', wall: '#6f9aa6' },   // middle: blue-grey floor, teal walls
    { floor: '#6b6456', wall: '#c8b58a' },   // top: warm stone floor, sand walls
  ],
  garden: '#4d6b3c', rail: '#9aa3ad', ramp: '#c79a4a', lintel: '#3a3d42',
  pad: '#2f3338', padPaint: '#b9bec4', unit: '#7d858e',   // the rooftop: the dark pad they landed on (its touchdown circle + H in padPaint, 09-26), the grey plant units
  hedge: '#35592b', tree: '#2a4424',  // the gardens: a hedge or shrub, and a tree (a trunk's-height block, blockout)
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
