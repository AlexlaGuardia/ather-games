// FURNITURE + DECOR, and the carpentry room's refining (2026-11-17, play / Jin 2 95f19652).
//
// Alex 11-17 (via hub): furniture and decor are ITEMS: crafted in the CARPENTRY room from Ather woods, kept in the bag or
// the bank, set on the plot and picked back up; unique pieces sell for Marks at the carpenter and Nyx-side shops (later).
// Canon: the carpentry room is one of the ruled workshop rooms (ather-rework WORKSHOP ROOMS); every wood and what a log
// refines into is canon's (game/shimmer-skilling.md › Forestry resources: "Refine it into planks or bark", etc.).
// Jin's: which pieces, recipes, rates, sizes. The pieces are plain things (stool, bench, table): no proper names, so no
// canon ask; their one-line blurbs are placeholders for @lark.
//
// ★ PURE DATA, NO IMPORTS: inventory.ts reads FURNITURE to make the bag rows, so this file must not import inventory.

export type Cost = { id: string; n: number }
/** A carpentry job: what goes in, what comes out. */
export interface Job { id: string; label: string; in: readonly Cost[]; out: Cost }

/** Refining: each log two ways, as its own bag row says (forestry's blurbs). Planks and branches are the furniture wood. */
export const REFINE: readonly Job[] = [
  { id: 'goldwood-plank', label: 'Saw into planks', in: [{ id: 'goldwood_log', n: 1 }], out: { id: 'goldwood_plank', n: 2 } },
  { id: 'goldwood-bark', label: 'Strip the bark', in: [{ id: 'goldwood_log', n: 1 }], out: { id: 'goldwood_bark', n: 2 } },
  { id: 'shimmeroak-plank', label: 'Saw into planks', in: [{ id: 'shimmeroak_log', n: 1 }], out: { id: 'shimmeroak_plank', n: 2 } },
  { id: 'shimmeroak-sap', label: 'Tap the amber', in: [{ id: 'shimmeroak_log', n: 1 }], out: { id: 'amber_sap', n: 1 } },
  { id: 'starwillow-branch', label: 'Split into branches', in: [{ id: 'starwillow_log', n: 1 }], out: { id: 'starwillow_branch', n: 2 } },
  { id: 'starwillow-sap', label: 'Tap the sap', in: [{ id: 'starwillow_log', n: 1 }], out: { id: 'starwillow_sap', n: 1 } },
  { id: 'dawnwood-plank', label: 'Saw into planks', in: [{ id: 'dawnwood_log', n: 1 }], out: { id: 'dawnwood_plank', n: 2 } },
  { id: 'dawnwood-sap', label: 'Take the old sap', in: [{ id: 'dawnwood_log', n: 1 }], out: { id: 'crystallized_sap', n: 1 } },
]

/** The Stonery's refining (M37 slice 4): the building parts a house plan spends. Blankstone is the plain stone prospecting
 *  leaves; a raw mana shard is the common crystal. Same shape as REFINE, so the bench lists them the same way. */
export const STONE_REFINE: readonly Job[] = [
  { id: 'stone-brick', label: 'Cut into bricks', in: [{ id: 'blankstone', n: 1 }], out: { id: 'stone_brick', n: 3 } },
  { id: 'stucco', label: 'Mix stucco', in: [{ id: 'blankstone', n: 1 }], out: { id: 'stucco', n: 3 } },
  { id: 'crystal-pane', label: 'Cut a pane', in: [{ id: 'raw_mana_shard', n: 1 }], out: { id: 'crystal_pane', n: 2 } },
]

/** A piece of furniture or decor: its bag row, its recipe, and how it stands on the plot. */
export interface PieceDef {
  name: string
  blurb: string
  /** what the carpentry bench takes; EMPTY = not craftable (a shop piece) */
  recipe: readonly Cost[]
  /** a UNIQUE piece: bought for Marks at a Nyx-side storefront (business/doors.ts › FRONT_SHOPS id), never made */
  sold?: { at: string; price: number }
  /** footprint before turning (m): w across, d front to back; h for the walker's box */
  w: number; d: number; h: number
  /** false = you can walk through it (a stool, an arch) */
  solid: boolean
  /** the wood it is made of, for the look */
  wood: 'goldwood' | 'shimmeroak' | 'starwillow' | 'dawnwood' | 'iron' | 'stone'
  /** it gives off light (drawn lit) */
  glow?: string
}
// Goldwood pieces first: goldwood is what a new keeper can prune (Forestry 1), so a first piece is never a locked door.
export const FURNITURE: Readonly<Record<string, PieceDef>> = {
  goldwood_stool: { name: 'Goldwood Stool', blurb: 'Three legs and a round seat. Sits level on any ground.', recipe: [{ id: 'goldwood_plank', n: 2 }], w: 0.5, d: 0.5, h: 0.5, solid: false, wood: 'goldwood' },
  goldwood_bench: { name: 'Goldwood Bench', blurb: 'A long seat for two, or one and a nap.', recipe: [{ id: 'goldwood_plank', n: 4 }], w: 1.6, d: 0.5, h: 0.5, solid: true, wood: 'goldwood' },
  goldwood_table: { name: 'Goldwood Table', blurb: 'Warm wood, four sturdy legs. Room for a meal and a map.', recipe: [{ id: 'goldwood_plank', n: 6 }], w: 1.4, d: 0.9, h: 0.8, solid: true, wood: 'goldwood' },
  planter_box: { name: 'Planter Box', blurb: 'Goldwood boards lined with bark. Something will want to grow in it.', recipe: [{ id: 'goldwood_plank', n: 3 }, { id: 'goldwood_bark', n: 2 }], w: 1.2, d: 0.6, h: 0.5, solid: true, wood: 'goldwood' },
  shimmeroak_shelf: { name: 'Shimmeroak Shelf', blurb: 'Rippled grain that catches the light on every board.', recipe: [{ id: 'shimmeroak_plank', n: 4 }], w: 1.2, d: 0.4, h: 1.6, solid: true, wood: 'shimmeroak' },
  starwillow_arch: { name: 'Starwillow Arch', blurb: 'Bent branches, tips faintly lit. Walk under it on the way home.', recipe: [{ id: 'starwillow_branch', n: 6 }], w: 2.2, d: 0.5, h: 2.6, solid: false, wood: 'starwillow' },
  dawnwood_chair: { name: 'Dawnwood Chair', blurb: 'Ancient wood that holds warmth. Sit in it once and you will keep it.', recipe: [{ id: 'dawnwood_plank', n: 4 }], w: 0.6, d: 0.6, h: 1.0, solid: false, wood: 'dawnwood' },
  // ── UNIQUE pieces, Nyx-side (Alex 11-17: "unique pieces are SOLD FOR MARKS by the carpenter + other Nyx-side shops";
  //    Magii c52ba1c: which shops stock decor is ours, no new names). Made of the continent's canon goods (game/economy.md:
  //    Spine ore + stone, ruin salvage, station mana cells), so each says where it came from. Rune Hold's Smithy is the
  //    first shop a keeper reaches; the Citadel's Grand Exchange is the capital's dearer stock. Prices on the ladder's
  //    scale (economy/prices.ts: a contract run pays ~2-8k): a lantern is a run, a mana-cell lamp is a week.
  iron_lantern: { name: 'Iron Lantern', blurb: 'Smith-wrought iron on its own post. It throws a warm light across the plot.', recipe: [], sold: { at: 'smithy', price: 1_200 }, w: 0.4, d: 0.4, h: 1.9, solid: false, wood: 'iron', glow: '#ffcf7a' },
  iron_brazier: { name: 'Brazier', blurb: 'A bowl of hammered iron on three legs, warm to stand by.', recipe: [], sold: { at: 'smithy', price: 2_500 }, w: 0.8, d: 0.8, h: 1.0, solid: true, wood: 'iron', glow: '#ff9a4a' },
  weathervane: { name: 'Weathervane', blurb: 'An iron arrow on a tall pole. It points at the wind, wherever that is.', recipe: [], sold: { at: 'smithy', price: 4_000 }, w: 0.4, d: 0.4, h: 3.2, solid: false, wood: 'iron' },
  spinestone_birdbath: { name: 'Spinestone Bowl', blurb: 'Pale Spine stone, cut into a shallow bowl and set on a short pillar.', recipe: [], sold: { at: 'grand-exchange', price: 6_000 }, w: 0.8, d: 0.8, h: 0.9, solid: true, wood: 'stone' },
  ruin_column: { name: 'Salvaged Column', blurb: 'A carved column out of an old ruin. Nobody remembers what it held up.', recipe: [], sold: { at: 'grand-exchange', price: 9_000 }, w: 0.7, d: 0.7, h: 2.6, solid: true, wood: 'stone' },
  mana_cell_lamp: { name: 'Mana-cell Lamp', blurb: 'A charged mana cell in a brass cage. It hums, very quietly.', recipe: [], sold: { at: 'grand-exchange', price: 15_000 }, w: 0.5, d: 0.5, h: 1.6, solid: false, wood: 'iron', glow: '#8fe3ff' },
  // ── THE WATER TAP + its tanks (canon RULED 11-15, world/mana-tech.md › The water tap; ather/water.ts holds the rules).
  //    Mortal mana-tech bought Nyx-side, set in the fold: the only water a garden has. Plain nouns (Magii 11-18, athernyx
  //    2bfa6b2). Sold at Rune Hold's Smithy, the first shop a keeper reaches. Blurbs = @lark's 11-18 drafts, awaiting Alex sign-off.
  water_tap: { name: 'Water Tap', blurb: 'Sigils in an iron housing. It sips a little of the garden\'s mana and turns it into water. Holds one tank\'s worth.', recipe: [], sold: { at: 'smithy', price: 3_000 }, w: 0.7, d: 0.7, h: 1.5, solid: true, wood: 'iron', glow: '#8fe3ff' },
  water_tank: { name: 'Water Tank', blurb: 'A riveted iron tank. With a water tap on your plot, it holds six more water.', recipe: [], sold: { at: 'smithy', price: 1_200 }, w: 1.0, d: 1.0, h: 1.4, solid: true, wood: 'iron' },
}
export const FURNITURE_ORDER = Object.keys(FURNITURE)
export const isPiece = (id: string) => id in FURNITURE
/** What a storefront stocks (its FRONT_SHOPS id). */
export const stockOf = (front: string) => FURNITURE_ORDER.filter(id => FURNITURE[id].sold?.at === front)
/** Each piece as a carpentry job: its recipe in, one piece out. */
export const PIECE_JOBS: readonly Job[] = FURNITURE_ORDER.filter(id => FURNITURE[id].recipe.length > 0).map(id => ({ id, label: FURNITURE[id].name, in: FURNITURE[id].recipe, out: { id, n: 1 } }))
/** How many pieces a plot holds (a keeper furnishes, not fills). */
export const MAX_PIECES = 60

// ── THE KEEPSTONE FAMILY (canon 5a20b8f, ather-rework WORKSHOP ROOMS (6)): the basic one sets a raw mana shard and is made
//    at the planning table; UNIQUE Keepstones are FOUND in the world with a higher crystal set in them: LOOK ONLY, never
//    more space (grade is worth and look, never power). Where they are found is Jin's: dug out of a crystal node while
//    prospecting (ather/prospecting.ts › mine), the rarer the crystal the rarer the find. Blurbs await @lark.
export interface KeepstoneDef { name: string; blurb: string; crystal: string }
const found = (crystal: string, name: string, what: string): KeepstoneDef => ({ name, crystal, blurb: `Dug out of the rock with ${what} still set inside. Its light is its own. The bank is the same.` })
export const KEEPSTONES: Readonly<Record<string, KeepstoneDef>> = {
  keepstone: { name: 'Keepstone', crystal: 'raw_mana_shard', blurb: 'A Blankstone pedestal with a mana shard inside. Lift the top and the garden bank is there.' },
  keepstone_violet: found('violet_crystal', 'Violet Keepstone', 'a violet crystal'),
  keepstone_storm: found('storm_crystal', 'Storm Keepstone', 'a storm crystal'),
  keepstone_earth: found('earth_crystal', 'Earth Keepstone', 'an earth crystal'),
  keepstone_water: found('water_crystal', 'Water Keepstone', 'a water crystal'),
  keepstone_pure: found('pure_mana_core', 'Pure Keepstone', 'a pure mana core'),
  keepstone_ather: found('ather_crystal', 'Ather Keepstone', 'an Ather crystal'),
}
export const isKeepstone = (id: string) => id in KEEPSTONES
/** The Keepstone item that carries this crystal (a placed one picked up comes back as itself). */
export const keepstoneFor = (crystal: string | undefined) => Object.keys(KEEPSTONES).find(k => KEEPSTONES[k].crystal === crystal) ?? 'keepstone'
/** The chance a crystal node gives up a unique Keepstone when it breaks: a find, not a farm. Raw nodes never do. */
export const KEEPSTONE_FIND: Readonly<Record<string, number>> = {
  violet_crystal: 0.02, storm_crystal: 0.02, earth_crystal: 0.02, water_crystal: 0.02, pure_mana_core: 0.04, ather_crystal: 0.08,
}
