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

/** A piece of furniture or decor: its bag row, its recipe, and how it stands on the plot. */
export interface PieceDef {
  name: string
  blurb: string
  recipe: readonly Cost[]
  /** footprint before turning (m): w across, d front to back; h for the walker's box */
  w: number; d: number; h: number
  /** false = you can walk through it (a stool, an arch) */
  solid: boolean
  /** the wood it is made of, for the look */
  wood: 'goldwood' | 'shimmeroak' | 'starwillow' | 'dawnwood'
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
}
export const FURNITURE_ORDER = Object.keys(FURNITURE)
export const isPiece = (id: string) => id in FURNITURE
/** Each piece as a carpentry job: its recipe in, one piece out. */
export const PIECE_JOBS: readonly Job[] = FURNITURE_ORDER.map(id => ({ id, label: FURNITURE[id].name, in: FURNITURE[id].recipe, out: { id, n: 1 } }))
/** How many pieces a plot holds (a keeper furnishes, not fills). */
export const MAX_PIECES = 60
