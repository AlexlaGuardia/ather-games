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
import type { AlcStation } from './alchemy-set'
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
  /** M48: a SHAFT piece claims its cell on every level of the house (the lift, lift.ts) */
  shaft?: boolean
  /** M57: an ALCHEMY station (alchemy-set.ts): E opens its steps instead of the plain piece card */
  alc?: AlcStation
  /** M76: a SPIRIT piece: E opens the planter (plant a Mana Seed) or the grimoire on its pedestal */
  spirit?: 'planter' | 'pedestal'
  /** BETA M98b: a free-build FLOOR SLAB (h = its thickness): walkable, set like furniture (snap / turn / anchor), and other
   *  furniture may stand ON it (rooms.ts slabLift raises it by the slab's top). Slabs never overlap each other. */
  slab?: true
  /** BETA M98b b2: a free-build WALL PANEL (w long, d = the wall's thickness, h = its height): set like furniture (snap / turn /
   *  anchor, so a run of panels lines up at any angle). Solid to the walker as a chain of small boxes when turned off the axes
   *  (rooms.ts pieceBoxes), never one fat axis box. `tint` = its colour when it is not a wood's (brick). */
  panel?: true
  tint?: string
  /** M110 s1: a TRAINING piece: party spirits may play at it as they please (spirit-trot.ts PLAY), each play nudging this ONE
   *  stat toward the form cap (spirit-stats.ts). Owner + ?spirits=3d only for now: the bench hides it otherwise. */
  train?: 'pwr' | 'grd' | 'agi' | 'vig'
  /** M110 s2: HOW she plays at a training piece (spirit-trot.ts Toy kind): leap across it / shove into it / guard the gap
   *  between its posts / run laps round it. Absent = leap (the s1 hurdle). */
  play?: 'leap' | 'shove' | 'guard' | 'laps'
  /** M68 s2: GIVEN, never made or sold (the Grimoire Pedestal: Greg hands it in the tutorial, glade-greg-talk.ts) */
  gift?: true
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
  // M76 (Alex 11-22; Magii 68808f3): the SPIRIT PLANTER (Starwillow, canon Ather tree) takes one Mana Seed and the spirit that
  //    seed already is blooms in it (spirit-seeds.ts). The GRIMOIRE PEDESTAL is where Greg's tablet rests in the garden. Plain
  //    nouns. Blurbs = placeholders for @lark.
  spirit_planter: { name: 'Spirit Bed', blurb: 'Starwillow branches woven round a bed of soft soil. A Mana Seed planted here blooms into the spirit it already is.', recipe: [{ id: 'starwillow_branch', n: 4 }, { id: 'starwillow_sap', n: 1 }], w: 0.9, d: 0.9, h: 0.6, solid: true, wood: 'starwillow', glow: '#ffe7a0', spirit: 'planter' },
  grimoire_pedestal: { name: 'Grimoire Pedestal', blurb: 'A short stone stand with a slanted top. The grimoire rests here, and its pages are read here.', recipe: [], gift: true, w: 0.7, d: 0.7, h: 1.1, solid: true, wood: 'stone', glow: '#ffd27a', spirit: 'pedestal' },   // M68 s2 (hub call): GREG hands it (Spirits?.3), one per keeper; the carpentry recipe is gone
  // M110 s1 (Magii RULED 3a77c87: training furniture, Jin's pieces/recipes): the AGI piece. Non-solid (she bounds across it,
  //    so does the keeper). Plain functional name, no canon name exists; name + blurb = placeholders for Magii / @lark.
  // M110 s2: the other three, one stat each, from bag goods a keeper already makes (stone bricks from the Stonery, goldwood
  //    planks + bark from the carpentry refine). Plain functional names, no canon name exists: placeholders for Magii / @lark.
  //    PWR: a squared stone she shoves at (solid). GRD: two short posts, she holds the gap between them. VIG: a low ring of
  //    stakes she runs laps round (flat, walk-over).
  push_stone: { name: 'Push Stone', blurb: 'A squared block of cut stone, heavy enough to lean into.', recipe: [{ id: 'stone_brick', n: 4 }], w: 0.6, d: 0.6, h: 0.45, solid: true, wood: 'stone', train: 'pwr', play: 'shove' },
  guard_posts: { name: 'Guard Posts', blurb: 'Two short goldwood posts on brick feet, a gap between them to hold.', recipe: [{ id: 'goldwood_plank', n: 2 }, { id: 'stone_brick', n: 2 }], w: 1.4, d: 0.25, h: 0.55, solid: false, wood: 'goldwood', train: 'grd', play: 'guard' },
  running_ring: { name: 'Running Ring', blurb: 'A wide ring of low goldwood stakes, bark-wrapped. Round and round it goes.', recipe: [{ id: 'goldwood_plank', n: 2 }, { id: 'goldwood_bark', n: 2 }], w: 2.6, d: 2.6, h: 0.14, solid: false, wood: 'goldwood', train: 'vig', play: 'laps' },
  goldwood_hurdle: { name: 'Goldwood Hurdle', blurb: 'A low goldwood rail on two posts, just high enough to jump.', recipe: [{ id: 'goldwood_plank', n: 3 }], w: 1.2, d: 0.2, h: 0.35, solid: false, wood: 'goldwood', train: 'agi' },
  // BETA M96 (Alex 11-23): the PLANNING TABLE as a bag item. Three melee hits lift it off its spot; set it anywhere like any piece.
  //    Never made or sold (recipe empty, gift): one per keeper, rooms.ts tableAt. Size = the fixture workshop.tsx draws. Blurb = @lark placeholder.
  planning_table: { name: 'Planning Table', blurb: 'Where every room on the plot is planned. Set it where you like to think.', recipe: [], gift: true, w: 2.2, d: 1.3, h: 1.05, solid: true, wood: 'goldwood' },
  // M48 (11-20): the lift. Canon RULED-AFK (athernyx 29b26fa): cord + counterweight, wood and stone, no metal, no runes. Planks and
  //    Stone Brick (no cord item exists in the bag). Blurb = placeholder for @lark.
  // M98b (Alex 11-23: "freehand place one slab and then snap on the rest to that one"): free-build floor slabs. A room
  // floor's cost (1 plank or brick per m², plot-bom.ts). Blurbs are placeholders for @lark.
  goldwood_slab: { name: 'Goldwood Floor Slab', blurb: 'A square metre of goldwood floor. Set it anywhere, at any angle.', recipe: [{ id: 'goldwood_plank', n: 1 }], w: 1, d: 1, h: 0.12, solid: true, wood: 'goldwood', slab: true },
  goldwood_slab_wide: { name: 'Wide Goldwood Floor Slab', blurb: 'Four square metres of goldwood floor in one piece.', recipe: [{ id: 'goldwood_plank', n: 4 }], w: 2, d: 2, h: 0.12, solid: true, wood: 'goldwood', slab: true },
  stone_slab: { name: 'Stone Floor Slab', blurb: 'A square metre of cut stone floor.', recipe: [{ id: 'stone_brick', n: 1 }], w: 1, d: 1, h: 0.12, solid: true, wood: 'stone', slab: true },
  stone_slab_wide: { name: 'Wide Stone Floor Slab', blurb: 'Four square metres of cut stone floor in one piece.', recipe: [{ id: 'stone_brick', n: 4 }], w: 2, d: 2, h: 0.12, solid: true, wood: 'stone', slab: true },
  // M98b b2: free-build wall panels. Size = a drawn wall's (plot-walls WALL_T 0.3 x WALL_H 4.8; build-prefs.test asserts it, this
  // file may not import). Cost = a drawn wall's 1.5 per metre, rounded up per panel. Blurbs are placeholders for @lark.
  goldwood_panel: { name: 'Goldwood Wall Panel', blurb: 'A metre of goldwood wall that stands on its own, at any angle.', recipe: [{ id: 'goldwood_plank', n: 2 }], w: 1, d: 0.3, h: 4.8, solid: true, wood: 'goldwood', panel: true },
  goldwood_panel_wide: { name: 'Wide Goldwood Wall Panel', blurb: 'Two metres of goldwood wall in one piece.', recipe: [{ id: 'goldwood_plank', n: 3 }], w: 2, d: 0.3, h: 4.8, solid: true, wood: 'goldwood', panel: true },
  brick_panel: { name: 'Brick Wall Panel', blurb: 'A metre of brick wall that stands on its own, at any angle.', recipe: [{ id: 'stone_brick', n: 2 }], w: 1, d: 0.3, h: 4.8, solid: true, wood: 'stone', panel: true, tint: '#a4573f' },
  brick_panel_wide: { name: 'Wide Brick Wall Panel', blurb: 'Two metres of brick wall in one piece.', recipe: [{ id: 'stone_brick', n: 3 }], w: 2, d: 0.3, h: 4.8, solid: true, wood: 'stone', panel: true, tint: '#a4573f' },
  lift: { name: 'Lift', blurb: 'A goldwood car on cords, a stone weight hung beside it. Pull the cord for a floor and up or down you go.', recipe: [{ id: 'goldwood_plank', n: 8 }, { id: 'stone_brick', n: 4 }], w: 1.0, d: 1.0, h: 2.0, solid: false, wood: 'goldwood', shaft: true },
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
  // ── M57 THE ALCHEMY SET (Alex 11-20: "the alchemy room was a mistake ... the only skill that is a furniture set"; "more
  //    advanced manatech"). Four pieces made at the carpentry bench (planks for the frame, mana shards/cores for the manatech),
  //    so a keeper alone can set up a lab without the continent. Station names RULED 11-21 (athernyx 2cbbaca; the Crusher Table
  //    is a WORKING name). The item ids alc_mortar / alc_mixer are the pre-ruling ids, kept on purpose: ids are never shown,
  //    and no save holds them yet. Blurbs = placeholders for @lark. alchemy-set.ts owns the steps.
  alc_mortar: { name: 'Crusher Table', blurb: 'A stone bowl on a goldwood table, a mana-driven crusher over it. Things go in whole and come out as powder or gel.', recipe: [{ id: 'goldwood_plank', n: 4 }, { id: 'stone_brick', n: 2 }, { id: 'raw_mana_shard', n: 3 }], w: 1.0, d: 0.7, h: 0.9, solid: true, wood: 'goldwood', alc: 'crusher', glow: '#8fe3ff' },
  alc_still: { name: 'Still', blurb: 'Glass coils over a mana-cell burner. A mixture goes in, a clear extract drips out.', recipe: [{ id: 'goldwood_plank', n: 3 }, { id: 'raw_mana_shard', n: 4 }, { id: 'pure_mana_core', n: 1 }], w: 0.9, d: 0.7, h: 1.6, solid: true, wood: 'iron', alc: 'still', glow: '#8fe3ff' },
  alc_mixer: { name: 'Cauldron Nook', blurb: 'A cauldron set into a long table. Herbs and powders fold together over the heat into a mixture.', recipe: [{ id: 'goldwood_plank', n: 6 }, { id: 'stone_brick', n: 2 }, { id: 'raw_mana_shard', n: 2 }], w: 1.6, d: 0.8, h: 0.9, solid: true, wood: 'goldwood', alc: 'nook', glow: '#ff9a4a' },
  alc_desk: { name: 'Alchemy Desk', blurb: 'Racks of vials and a reading lens. Every recipe starts here, and the prepared parts come back here to be combined.', recipe: [{ id: 'shimmeroak_plank', n: 4 }, { id: 'goldwood_plank', n: 2 }, { id: 'pure_mana_core', n: 1 }], w: 1.4, d: 0.7, h: 1.2, solid: true, wood: 'shimmeroak', alc: 'desk', glow: '#c9a8ff' },
}
export const FURNITURE_ORDER = Object.keys(FURNITURE)
export const isPiece = (id: string) => id in FURNITURE
/** What a storefront stocks (its FRONT_SHOPS id). */
export const stockOf = (front: string) => FURNITURE_ORDER.filter(id => FURNITURE[id].sold?.at === front)
/** Each piece as a carpentry job: its recipe in, one piece out. */
/** M57: the alchemy set stays off the carpentry bench until E at a piece opens its station (workshop.tsx); flip when wired. */
export const ALC_LIVE = true   // FLIPPED 2026-11-21 (Alex via Magii: "turn alchemy on"; hub call). One-line revert.
export const PIECE_JOBS: readonly Job[] = FURNITURE_ORDER.filter(id => FURNITURE[id].recipe.length > 0 && (ALC_LIVE || !FURNITURE[id].alc)).map(id => ({ id, label: FURNITURE[id].name, in: FURNITURE[id].recipe, out: { id, n: 1 } }))
/** How many pieces a plot holds (a keeper furnishes, not fills). */
export const MAX_PIECES = 60
/** M124: at most this many spirit beds (the spirit_planter item) stand in one garden. ★ CANON, NOT A DIAL (Alex 11-24,
 *  CANON_GAPS 'Spirit beds' point 5): 8 beds x 28 blooms = room for one of every form. Changing it needs Alex. */
export const BEDS_MAX = 8

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
