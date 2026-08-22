// The block registry — what a material IS, mechanically.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// ★ SHAPED AS DATA, NOT CODE (VOXEL-WORLD-MODEL § 4). Every field below is a plain value with no
// behaviour attached, so this table lifts into `data/blocks/*.json` unchanged the day the loader
// exists — and Rust reads the identical file. Keeping it as a TS literal for now costs nothing and
// avoids a loader before there is anything to load. What must NOT happen is behaviour creeping in
// here: the moment a block carries a function, the registry stops being portable.
//
// ── ★ THE TOOL MODEL IS ALREADY CANON AND IS REUSED VERBATIM ─────────────────────────────────
// `engine/tools.ts` rules the gathering tools: **blades → forestry, spikes → prospecting,
// rinsticks → rinning**, three tiers each plus a basic Greg-given tool that never breaks. So
// "what do I mine rock with" already has an answer — a spike — and nothing needed inventing.
// This file names SKILLS, not tool ids, so the tool table stays the single source of truth.
//
// ⚠ CANON: every DROP id below already ships in `world/resources.ts`. The block-item ids
// (`block_stone` etc.) are build-side placeholders for "the block itself in your hand" and are
// marked TBD-CANON — if the Ather's stone and soil carry real names, those are Magii's.

import { MAT, HALF_BIT, TOP_BIT } from './depth'
import { meadowSeedDrops } from './meadow-seed'

import { ORE } from './ore'
import { WOOD } from './trees'
import { AIR } from './section'

/** Which gathering skill a block answers to. `null` = bare hands, no tool, no skill gate. */
export type BlockSkill = 'prospecting' | 'forestry' | 'farming' | null

export interface BlockDef {
  /** Palette index this describes. */
  material: number
  name: string
  /**
   * Time-to-break in seconds with a tier-1 tool. Relative values are what matter, not the units:
   * soil is a flick, deep stone is a commitment.
   */
  hardness: number
  skill: BlockSkill
  /** Minimum tool tier that can break it at all. 0 = hands work. */
  minTier: 0 | 1 | 2 | 3
  /**
   * ★ THE SHOVEL PROBLEM, AND WHY THIS IS NOT JUST `skill` (2026-08-07).
   *
   * `skill` is a GATE: `breakSeconds` refuses outright when the held tool's family does not match,
   * which is what makes "a spike will not cut a tree" true. Soil and sand have always been
   * `skill: null` so that bare hands work — and they must keep working, or a fresh keeper spawns
   * unable to dig dirt.
   *
   * So a shovel cannot be expressed by moving soil to `skill: 'farming'`; that would refuse hands
   * AND refuse every other tool. `fastSkill` is the other half: on an ungated block it names the
   * tool family that does the job *properly*. Hands still work, the right tool is faster and pays
   * XP. That is Minecraft's model exactly, and it is the only shape that adds a tool without
   * taking away a starting capability.
   *
   * Only meaningful when `skill === null`. On a gated block the gate already names the family.
   */
  fastSkill?: BlockSkill
  /** What lands in the inventory. Empty = breaks into nothing. */
  /**
   * What breaking it yields. `chance` (0..1, absent = always) gates an entry.
   *
   * ★ A RARE DROP IS A DROP-TABLE ENTRY, NOT A SPECIAL CASE IN THE MINING CODE. Put the roll here
   * and every consumer — mining, future auto-harvest, explosions — inherits it for free, and the
   * rate becomes data a designer can dial without reading `mine.ts`.
   */
  drops: { itemId: string; count: number; chance?: number }[]
  /** Can a player place this back down? */
  placeable: boolean
  /**
   * Opt OUT of the derived slab (see `HALF_DEFS`). For anything that is not a full cube — ground
   * cover, a lantern, a workbench, a pot. Half a flower is not a thing, and shipping "Grass Tuft
   * Slab" as a real item is the kind of nonsense a derivation quietly manufactures if nobody says
   * where it stops.
   */
  noSlab?: boolean
  /**
   * ── ★ THIS BLOCK IS GENERATED AS A TERRAIN SURFACE, so the world can make a HALF CELL of it ───
   * `slump.ts` wears tended ground's rounding steps down into halves, and it does that to whatever
   * material the surface happens to be — it has no opinion about `placeable`. So "can a half cell
   * of this exist" is a DIFFERENT question from "can the player put this down", and deriving slabs
   * from `placeable` alone answered the wrong one.
   *
   * ⚠ THE FAILURE IS SILENT AND IT WAS ALREADY SHIPPING. A half cell whose base has no slab row
   * has NO BLOCK DEFINITION AT ALL: `blockDef` returns undefined, so it has no hardness, no drops
   * and no name, and a keeper swinging at that lip gets nothing with no error anywhere. Measured
   * 2026-08-19 over a 60-chunk garden sample: 4 grey-soil lips were already in this state before
   * the character layer existed, which nobody had noticed because grey soil is 1.5% of lips. The
   * new grounds took it to 189 of 262. The bug was old; the character layer only made it loud.
   */
  ground?: boolean
  /**
   * Block light emitted, 0–15 (`light.ts`'s block channel BFSes from these). Absent = 0. Data,
   * not behaviour — the Rust side reads the same number.
   */
  emit?: number
}

/**
 * ⚠ TBD-CANON on the block-item ids. These are "the block in your hand" and generic English on
 * purpose — no Athernyx name is invented here. Drop ids for ore are the RULED ones from
 * `resources.ts` and must not be renamed.
 */
export const BLOCKS: BlockDef[] = [
  // ── ★ THE FLOOR IS PRESSED CLOUD, NOT ROCK (2026-08-15, Alex) ───────────────────────────────
  // Mechanically untouched — `hardness: Infinity` was already the unbreakable bottom and still is.
  // What changed is what it IS: the Ather is condensed cloud-stuff (`depth.ts` on MAT.PACKED_CLOUD
  // cites the rulings), so a granite basement was the one block in the column contradicting the
  // world's own physical model. Same id, same generation, same saves.
  { material: MAT.PACKED_CLOUD, name: 'Packed Cloud', hardness: Infinity, skill: null, minTier: 0, drops: [], placeable: false },
  // ── ★ QUARRIED STONE YIELDS RUBBLE, AND DOES NOT GO BACK (2026-08-13, Alex's ruling) ────────
  // Both drop the SAME rubble on purpose: what a pick leaves behind is broken rock either way, and
  // the tier lives in what it costs to BREAK them (hardness + minTier), which is where a player
  // already feels it. Two rubbles would be two economies for one material.
  // `placeable: false` is the whole ruling in one field — and it needs no other code, because
  // `BY_ITEM` below only reverses PLACEABLE blocks, so `block_stone` simply stops resolving to a
  // voxel. ⚠ `block_stone`/`block_deep_stone` are now unobtainable ids: anything that still asks
  // for them is uncraftable, which is what `recipes.test.ts`'s reachability sweep is for.
  { ground: true, material: MAT.DEEP_STONE, name: 'Deep Stone', hardness: 2.4, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'rubble', count: 1 }], placeable: false },
  { ground: true, material: MAT.STONE, name: 'Stone', hardness: 1.6, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'rubble', count: 1 }], placeable: false },

  // ★ RUBBLE IS THE FORGIVENESS VALVE — placeable, but only ever as rubble. A hole can be filled
  // and the patch always shows, which is the honest middle between an irreversible scar and a
  // perfect undo. Loose rock, so it is softer than the stone it came from and a bare hand can move
  // it (`skill: null`); a spike is simply faster.
  { material: MAT.RUBBLE, name: 'Rubble', hardness: 0.6, skill: null, minTier: 0, drops: [{ itemId: 'rubble', count: 1 }], fastSkill: 'prospecting', placeable: true },
  // ★ AND CUT STONE IS THE WALL — the first CRAFTED surface, never generated and never dug. This
  // is the rung the ruling needs that pieces alone cannot supply: doorways, fences and beams do
  // not make a house without something to be the wall between them.
  { material: MAT.CUT_STONE, name: 'Cut Stone', hardness: 1.5, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'cut_stone', count: 1 }], placeable: true },

  // ── ★ THE MASONRY PALETTE (2026-08-15, Alex: "different colors and textures to work with") ──
  // Three more crafted surfaces beside cut stone, same shape as it in every field: crafted rather
  // than dug, drops itself, placeable, slabs allowed (they are walls and floors — `noSlab` is for
  // furniture). ⚠ They must NOT be generated by anything: `recipes.test.ts` asserts that no terrain
  // block drops a crafted surface, because the moment one does the refine step is decoration.
  //
  // ★ THE COLOUR COMES FROM MINERAL ALREADY IN THE WORLD, which is why this needed no worldgen.
  // Pale from the springs' terrace crust, tan from beach sand — both of which had been quarryable
  // and *entirely useless* until now. See `recipes.ts` for why new strata would be a canon question
  // and dressing existing rock is not.
  //
  // Hardness follows the SOURCE, not the shape: brick is dressed stone so it matches cut stone,
  // pale brick is the softer terrace shell (1.2 raw), and sandstone is bound sand — the one masonry
  // block a keeper with no pick can still break, because the sand it came from was hand-diggable.
  { material: MAT.STONE_BRICK, name: 'Stone Bricks', hardness: 1.5, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'stone_brick', count: 1 }], placeable: true },
  { material: MAT.PALE_BRICK, name: 'Pale Bricks', hardness: 1.3, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'pale_brick', count: 1 }], placeable: true },
  { material: MAT.SANDSTONE, name: 'Sandstone', hardness: 0.9, skill: null, minTier: 0, drops: [{ itemId: 'sandstone', count: 1 }], fastSkill: 'prospecting', placeable: true },

  // ── ★ SAPLINGS — placeable, and that is the whole plumbing ──────────────────────────────────
  // `materialForItem` is DERIVED from `placeable && drops[0]` (see BY_ITEM below), so declaring
  // these four rows is what makes a sapling item place a sapling block. No item->block table to
  // write and none to keep in sync.
  //
  // Breakable by hand, dropping itself, so a sapling planted in the wrong spot is a mistake you
  // undo rather than a rare item you destroyed. `skill: null` because planting a tree is not
  // forestry — cutting one is.
  { material: MAT.SAPLING_GOLDWOOD, name: 'Goldwood Sapling', hardness: 0.2, skill: null, minTier: 0, drops: [{ itemId: 'goldwood_sapling', count: 1 }], placeable: true },
  { material: MAT.SAPLING_SHIMMEROAK, name: 'Shimmeroak Sapling', hardness: 0.2, skill: null, minTier: 0, drops: [{ itemId: 'shimmeroak_sapling', count: 1 }], placeable: true },
  { material: MAT.SAPLING_STARWILLOW, name: 'Starwillow Sapling', hardness: 0.2, skill: null, minTier: 0, drops: [{ itemId: 'starwillow_sapling', count: 1 }], placeable: true },
  { material: MAT.SAPLING_DAWNWOOD, name: 'Dawnwood Sapling', hardness: 0.2, skill: null, minTier: 0, drops: [{ itemId: 'dawnwood_sapling', count: 1 }], placeable: true },
  { material: MAT.SUBSOIL, name: 'Subsoil', hardness: 0.5, skill: null, minTier: 0, drops: [{ itemId: 'block_subsoil', count: 1 }], fastSkill: 'farming', placeable: true },
  { material: MAT.TOPSOIL, name: 'Topsoil', hardness: 0.55, skill: null, minTier: 0, drops: [{ itemId: 'block_topsoil', count: 1 }], fastSkill: 'farming', placeable: true },
  { material: MAT.SAND, name: 'Sand', hardness: 0.45, skill: null, minTier: 0, drops: [{ itemId: 'block_sand', count: 1 }], fastSkill: 'farming', placeable: true },
  // Drained ground digs like soil and drops SUBSOIL: the mana is gone, not the dirt — carrying a
  // "grey block" home to build with would make the greying a decoration, which it must never be.
  // ── ★ THE GROUNDS (2026-08-19, the character layer) ────────────────────────────────────────
  // Nine biomes' worth of ground, and every one of them digs like the soil it is and drops plain
  // soil. See the MAT block in depth.ts for why none of them is placeable: a ground is what the
  // world grows, not a swatch for the build palette. Scree is the exception that proves it —
  // broken rock is not soil, so it takes stone's skill gate and drops rubble like stone does.
  { ground: true, material: MAT.FOREST_LOAM, name: 'Forest Loam', hardness: 0.55, skill: null, minTier: 0, drops: [{ itemId: 'block_topsoil', count: 1 }], fastSkill: 'farming', placeable: false },
  { ground: true, material: MAT.LUSH_TURF, name: 'Lush Turf', hardness: 0.55, skill: null, minTier: 0, drops: [{ itemId: 'block_topsoil', count: 1 }], fastSkill: 'farming', placeable: false },
  { ground: true, material: MAT.MARSH_MUD, name: 'Marsh Mud', hardness: 0.45, skill: null, minTier: 0, drops: [{ itemId: 'block_subsoil', count: 1 }], fastSkill: 'farming', placeable: false },
  { ground: true, material: MAT.DRY_GRASS, name: 'Dry Grass', hardness: 0.5, skill: null, minTier: 0, drops: [{ itemId: 'block_topsoil', count: 1 }], fastSkill: 'farming', placeable: false },
  { ground: true, material: MAT.HIGHLAND_TURF, name: 'Highland Turf', hardness: 0.55, skill: null, minTier: 0, drops: [{ itemId: 'block_topsoil', count: 1 }], fastSkill: 'farming', placeable: false },
  { ground: true, material: MAT.SCREE, name: 'Scree', hardness: 1.1, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'rubble', count: 1 }], placeable: false },
  { ground: true, material: MAT.GREY_SOIL, name: 'Greyed Soil', hardness: 0.55, skill: null, minTier: 0, drops: [{ itemId: 'block_subsoil', count: 1 }], fastSkill: 'farming', placeable: false },
  { material: MAT.WATER, name: 'Water', hardness: Infinity, skill: null, minTier: 0, drops: [], placeable: false },

  // ── The lantern — the first emitter ────────────────────────────────────────────────────────
  // emit 14, not 15: a placed light should never quite match full daylight, so noon stays the
  // brightest thing in the world. Breaks by hand into itself — lighting your ground is meant to
  // be cheap to do and free to rearrange. The canon line it serves ("tended light holds grey
  // off") lives in light.ts; this row only makes the tending possible.
  { noSlab: true, material: MAT.MANA_LANTERN, name: 'Mana Lantern', hardness: 0.6, skill: null, minTier: 0, drops: [{ itemId: 'mana_lantern', count: 1 }], placeable: true, emit: 14 },

  // ── The crafting table — the first station ─────────────────────────────────────────────────
  // Breaks by hand into itself, same reasoning as the lantern: your bench is furniture, and
  // rearranging your home must be free. Placing it is what flips `Station` in voxel/recipes.ts
  // from a dormant field to a real gate — recipes marked `crafting_table` light up near one.
  { noSlab: true, material: MAT.CRAFT_TABLE, name: 'Crafting Table', hardness: 0.8, skill: null, minTier: 0, drops: [{ itemId: 'crafting_table', count: 1 }], placeable: true },
  // ── The sawmill — the second station, and the first SPECIALIST one ─────────────────────────
  // Same shape as the bench above (no slab, soft, drops itself, placeable, never generated). What
  // differs is entirely in `voxel/workshop.ts`: it runs logs 2.4x faster and refuses everything
  // else, so it does not obsolete the bench it costs five logs to stand beside.
  { noSlab: true, material: MAT.SAWMILL, name: 'Sawmill', hardness: 0.9, skill: null, minTier: 0, drops: [{ itemId: 'sawmill', count: 1 }], placeable: true },
  // ── The stonecutter — the third station, and the one that sells YIELD instead of speed ───────
  // Heavier than the two timber benches (a stone bed on a timber frame), which is all `hardness`
  // is saying. Still `skill: null` and still drops itself: the furniture rule holds across the
  // whole family — rearranging your own plot must be free, whatever the station is made of.
  // ── ★ THE WAYMARK (2026-08-15) — the keeper's planted passage ───────────────────────────────
  // Furniture rules, same as every station: breaks by hand into itself, so moving a passage costs a
  // walk and nothing else. ⚠ Breaking it MUST drop the network record in the same breath — the
  // `setVoxel` hook does that, exactly as it does for a station's job.
  //
  // `emit: 7` — it is mana bound to a place and should be findable at night. Dimmer than a lantern
  // (14) on purpose: a waymark is a landmark, not a light source, and a keeper should still want
  // lanterns for a camp. ⚠ It DOES suppress Hollows in its own small radius, which is a real
  // consequence and a fair one — a bound place is a tended place. It changes nothing at the plot,
  // where `hollowEligible`'s greyness gate already refuses tended ground.
  { noSlab: true, material: MAT.WAYMARK, name: 'Waymark', hardness: 0.9, skill: null, minTier: 0, drops: [{ itemId: 'waymark', count: 1 }], placeable: true, emit: 7 },

  // ── ★ THE CLOUD-WALL (2026-08-15) — the plot's boundary ─────────────────────────────────────
  // `hardness: Infinity` ⇒ `breakSeconds` is Infinity ⇒ `canBreak` is false, the same one-value
  // guard the conjured wall and the world floor use. A keeper cannot mine their way out of their
  // own fold, and nothing in the mining path had to learn what a boundary is.
  //
  // `placeable: false` + `drops: []` — it is the ocean held back, not a block anybody carries. And
  // it GLOWS (canon: *"soft, pale, faintly glowing"*), which is the one place emit is unambiguously
  // right: the walls are the lit rim of a tended pocket seen from inside.
  { material: MAT.CLOUD_WALL, name: 'Cloud-Wall', hardness: Infinity, skill: null, minTier: 0, drops: [], placeable: false, emit: 5 },

  { noSlab: true, material: MAT.STONECUTTER, name: 'Stonecutter', hardness: 1.2, skill: null, minTier: 0, drops: [{ itemId: 'stonecutter', count: 1 }], placeable: true },

  // ── ★ THE CAULDRON (2026-08-18) — the alchemy station, and the fourth of the family ──────────
  // Furniture rules, unbroken: breaks by hand into itself, `skill: null`, so a keeper who put their
  // brewer in the wrong corner pays a walk and nothing else. Hardness between the timber benches
  // and the stone bed — a fired clay basin is heavier than a plank and lighter than a dressed slab.
  //
  // ⚠ NO `emit`, deliberately, and it is a design claim rather than an omission. A lit cauldron
  // would be the prettiest block on the plot and it would lie every minute the keeper is not
  // brewing: `voxel3d/brew.ts` holds no state, so there is no "is a brew running" for a light to be
  // honest about. The vessels brief makes the *liquid* the light source, which is a property of a
  // full bottle, not of the pot it came out of. If brewing ever grows a clock (the workshop's job
  // model), the glow arrives WITH it and means something.
  { noSlab: true, material: MAT.CAULDRON, name: 'Cauldron', hardness: 1.0, skill: null, minTier: 0, drops: [{ itemId: 'cauldron', count: 1 }], placeable: true },
  // ★ SOFT AND BARE-HANDED (hardness 0.4, `skill: null`) — a bed is tilled earth, not masonry, and a
  // keeper must be able to pick one up and move it without a tool. It drops ITSELF, so relocating a
  // bed costs nothing and the cap in `garden.ts` counts the same object wherever it ends up.
  // ⚠ `fastSkill: 'farming'` and NOT `skill: 'farming'` — gating it behind the skill would strand a
  // fresh keeper who crafted one, which is the same trap `recipes.test.ts` guards for soil.
  // ★ ONE ROW PER PLANK WOOD (2026-08-22) — see `garden.ts` › BED_WOODS for why the wood is a
  // material rather than a property. Each drops ITSELF, so a bed you pull up comes back as the wood
  // you framed it in and the cap is honest about what you are holding.
  { noSlab: true, material: MAT.GARDEN_BED_GOLDWOOD, name: 'Goldwood Garden Bed', hardness: 0.4, skill: null, minTier: 0, drops: [{ itemId: 'garden_bed_goldwood', count: 1 }], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.GARDEN_BED_SHIMMEROAK, name: 'Shimmeroak Garden Bed', hardness: 0.4, skill: null, minTier: 0, drops: [{ itemId: 'garden_bed_shimmeroak', count: 1 }], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.GARDEN_BED_DAWNWOOD, name: 'Dawnwood Garden Bed', hardness: 0.4, skill: null, minTier: 0, drops: [{ itemId: 'garden_bed_dawnwood', count: 1 }], fastSkill: 'farming', placeable: true },
  // ── ★ CAST MATTER CANNOT BE QUARRIED (2026-08-14) ────────────────────────────────────────────
  // `hardness: Infinity` ⇒ `breakSeconds` returns Infinity ⇒ `canBreak` is false. That single value
  // is the whole anti-exploit: without it a keeper casts a 16-mana Stonewall, mines five rubble, and
  // repeats. Using the registry's existing gate means the mining path never learns what a cast is.
  // `drops: []` is belt-and-braces — if some future path forces a break, it still pays nothing.
  { material: MAT.CONJURED, name: 'Conjured Matter', hardness: Infinity, skill: null, minTier: 0, drops: [], placeable: false },

  // The story road. Digs like soil and drops SUBSOIL for the same reason greyed soil does: the
  // road is a CONDITION of the ground, not a block you carry home and lay somewhere else.
  { ground: true, material: MAT.PATH, name: 'Worn Path', hardness: 0.5, skill: null, minTier: 0, drops: [{ itemId: 'block_subsoil', count: 1 }], fastSkill: 'farming', placeable: false },

  // ── ★ THE WOODEN WALL, ONE PER PLANK SPECIES (2026-08-13 ruling, REVERSED 2026-08-22) ────────
  // These rows used to be a single "Planking" block that dropped a `planking` item, because Alex
  // ruled on 08-13: *"actual planks not the block, not placeable, but can be used to craft
  // materials to build with."*
  //
  // ⚠ HE OVERTURNED THAT ON 08-22, ASKED TWICE AND CONFIRMED TWICE. Playing it, he called planking
  // *"a bit out of place when each tree gives logs that can already be turned into planks"* — and
  // `pieces.ts` had been agreeing in silence the whole time: doorway, window, roof, beam, fence and
  // half slab all spend RAW planks, in two species. The grammar was already "spend planks"; the
  // planking tier was an orphan with two consumers that hardcoded goldwood, so shimmeroak could
  // roof a house and not wall one.
  //
  // ★ SO A PLANK PLACES AGAIN. The drop IS the mechanism, exactly as the old note said in reverse:
  // `BY_ITEM` maps a placeable block's identity drop back to its material, so dropping
  // `goldwood_plank` here is what makes the plank resolve to a voxel once more.
  //
  // ⚠ ONE ROW PER PLANK SPECIES, AND STARWILLOW IS ABSENT because it yields branches, not planks.
  { material: MAT.PLANKS_GOLDWOOD, name: 'Goldwood Planks', hardness: 0.7, skill: null, minTier: 0, drops: [{ itemId: 'goldwood_plank', count: 1 }], fastSkill: 'forestry', placeable: true },
  { material: MAT.PLANKS_SHIMMEROAK, name: 'Shimmeroak Planks', hardness: 0.7, skill: null, minTier: 0, drops: [{ itemId: 'shimmeroak_plank', count: 1 }], fastSkill: 'forestry', placeable: true },
  { material: MAT.PLANKS_DAWNWOOD, name: 'Dawnwood Planks', hardness: 0.7, skill: null, minTier: 0, drops: [{ itemId: 'dawnwood_plank', count: 1 }], fastSkill: 'forestry', placeable: true },

  // ── ★ BRIDGE DECK — the road's timber, and it pays NOTHING (2026-08-15) ─────────────────────
  // Split off `MAT.PLANKS` because the bridges were generating the crafted wall: 1902 free
  // planking on the spine of the default seed, ~127 goldwoods' worth, by hand. See the DECK note
  // in `depth.ts` for the measurement and for why `MAT.PATH` is the precedent rather than an
  // exception to it.
  //
  // ★ `drops: []` IS THE RULING, and it is a deliberate choice over the two alternatives:
  //   · A worthless drop (PATH's subsoil) has no wood analogue — every wood item in the tree is
  //     already a craft input, `goldwood_bark` included (the sawmill eats 4 of it).
  //   · `hardness: Infinity` would close the hole harder, and it is what `MAT.CONJURED` does —
  //     but a conjured wall LOOKS temporary and a bridge looks solid. An identical-looking plank
  //     that breaks when you placed it and refuses when the world did reads as a bug, and this
  //     file's own `breakSeconds` note says a block that was never going to break is the worst
  //     version of the mechanic. So the deck breaks. It just does not pay.
  // Net read: prying up the crossing is pure vandalism — you wreck the road that holds the grey
  // off at night and you carry away nothing. That is the honest shape of "you build with what you
  // made", not a locked block.
  //
  // `placeable: false` needs no other code: `BY_ITEM` only reverses placeable blocks with a drop,
  // and this row has neither, so no item can ever resolve back to a deck voxel.
  { material: MAT.DECK, name: 'Bridge Deck', hardness: 0.7, skill: null, minTier: 0, drops: [], fastSkill: 'forestry', placeable: false },

  // The hot springs' mineral shell — stone-family, so a spike quarries it, and it drops ITSELF:
  // pale terrace stone is exactly the block a builder would want to carry home. ⚠ TBD-CANON name.
  // ── ground cover: instant to break, always drops, and replantable (2026-08-11) ──────────────
  // hardness 0.05 = one tap with anything, including a bare hand: a flower is not a mining
  // problem. `placeable` is true on purpose — "everything should be collectable" reads poorly if
  // what you collected can never go back down, and replanting a drift is a thing a keeper does.
  // ⚠ EACH DROPS ITS OWN ITEM, and that is a constraint, not a naming choice: `BY_ITEM` reverses
  // EVERY drop of a placeable block, so two placeable plants sharing a `plant_fiber` drop makes
  // one of them unplaceable-as-itself and silently steals the other's id. mine.test asserts the
  // round-trip. A shared fiber item belongs behind a RECIPE, not in two drop tables.
  // ── ★ WIND-BORNE SEEDS (2026-08-11, Alex) ────────────────────────────────────────────────────
  // Grass can yield a Mana Seed, and canon backs it rather than merely allowing it: CANON/core.md
  // rules that in the cozy line "Mana Seeds come from the world itself — the Anemonyx (the
  // Seed-Tender Ancient), wind-borne." A seed caught in tended grass IS what wind-borne means, so
  // this needed no ruling. A seed pays out a SPIRIT, which is why the rate has to stay mythic:
  // the moment grass is a reliable source, Greg's gift stops being the start of the game.
  //
  // ⚠ THE RATE IS THE WHOLE BALANCE OF THIS DROP. 1/2500 (Alex, 2026-08-11) is roughly one find
  // every several sessions at a few hundred tufts a session — rare enough to be a story, common
  // enough to exist. It was briefly 1/1,000,000, which measured out at ~11.6 DAYS of continuous
  // breaking for an even chance: a drop no player would ever meet. `mana-seed.test.ts` proves the
  // roll is wired at ANY rate, so this stays a dial rather than a leap of faith.
  { noSlab: true, material: MAT.TUFT, name: 'Grass Tuft', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'grass_tuft', count: 1 }, ...meadowSeedDrops()], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.TALL_GRASS, name: 'Tall Grass', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'tall_grass', count: 1 }, ...meadowSeedDrops()], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.FLOWER, name: 'Wildflower', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'wild_flower', count: 1 }], fastSkill: 'farming', placeable: true },

  // ── ★ SCATTER (2026-08-19, slice ③) — what a land SHEDS, as gatherable ground cover ──────────
  // `noSlab`, like every other plant row: these sit at h+1, so they are never the surface voxel a
  // slump makes a half cell of. (The `ground: true` rule is for materials that can BE the surface —
  // a lip with no slab row has no block definition at all, which is how 189 of 262 lips ended up
  // nameless. Scatter is on top of the surface, never the surface itself.)
  //
  // ★ A LOOSE ROCK DROPS RUBBLE — it feeds the stone economy that already exists rather than
  // opening a second one, which is the same call the two quarried-stone rows make one screen up.
  // Softer than scree because it is already loose: a bare hand lifts it, a spike is just faster.
  // ⚠ `placeable: false`, AND THE SUITE HAD TO TEACH ME THAT. `BY_ITEM` reverses placeable blocks by
  // their drop id, so a placeable Loose Rock dropping `rubble` HIJACKS the rubble item: placing
  // rubble would have put down a loose rock instead, silently breaking the forgiveness valve that
  // row exists for. Two blocks cannot both claim one item. Rubble is the thing you place; a loose
  // rock is a thing you pick up. (Caught by `plants.test.ts`'s identity-drop clash and
  // `recipes.test.ts`'s "rubble places as rubble" — neither is about scatter, and both fired.)
  { noSlab: true, material: MAT.LOOSE_ROCK, name: 'Loose Rock', hardness: 0.15, skill: null, minTier: 0, drops: [{ itemId: 'rubble', count: 1 }], fastSkill: 'prospecting', placeable: false },
  // ★ DEADFALL YIELDS `deadwood`, NOT A SPECIES LOG, and that is deliberate. Every log id in this
  // file is species-bound (goldwood/shimmeroak/starwillow/dawnwood) and carries that species' tier
  // and hardness. Scatter has no species — it is weathered wood on the ground — so dropping any one
  // of them would hand out tier-3 Dawnwood from a barrens twig. A generic id is the honest answer.
  // ⚠ `deadwood` HAS NO RECIPE YET. That is the same rhythm the four element herbs shipped on:
  // gatherable in one slice, useful in the next. It is a known gap, not an oversight — GBOARD row.
  { noSlab: true, material: MAT.DEADFALL, name: 'Deadfall', hardness: 0.20, skill: null, minTier: 0, drops: [{ itemId: 'deadwood', count: 1 }], fastSkill: 'forestry', placeable: true },
  // ⚠ `mushroom_cap` likewise has no recipe yet — same slice rhythm, same GBOARD row.
  { noSlab: true, material: MAT.MUSHROOM, name: 'Mushroom', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'mushroom_cap', count: 1 }], fastSkill: 'farming', placeable: true },

  // ── ★★ THE FOUR ELEMENT HERBS (2026-08-18) — canon's ground, picked by hand ──────────────────
  // `game/alchemy.md` + `game/shimmer-geography.md`, ruled by /magii on the hub lane's gap. These
  // four are the last link between this world and an evolved spirit: the cauldron brews, the
  // crystals drop, the sap is tapped, and until today nothing here grew a herb.
  //
  // ★ SAME NUMBERS AS GRASS ON PURPOSE — `hardness: 0.05`, `skill: null`, `fastSkill: 'farming'`.
  // A herb is picked, not harvested with a tool: canon's tiers grade an ingredient by WHERE it was
  // got, never by what you got it with, so gating a wild plant behind a spade would invent an axis
  // the ruling explicitly says not to build. The tier lives in the country you walked to.
  //
  // ⚠ `count: 1`, and it is the dial to reach for first. One Infusion costs 2 petals; a patch is
  // meant to be worth the walk, so the generosity is supposed to live in patch DENSITY (`flora.ts`)
  // rather than in a plant paying double. Unplayted either way — canon left rarity and yield to me
  // by name.
  //
  // ⚠ `placeable: true` matches every other plant, so a keeper can carry a Rootvine home and set it
  // in their own garden. It does NOT make the plot grow them (nothing generates in a fold) and it
  // does not make a herb farmable — a placed plant is decoration that happens to be pickable again.
  // Canon is safe here: tending *"persuades the Network to fruit"*, so a keeper planting one is the
  // world's own story, not a contradiction of it.
  { noSlab: true, material: MAT.VIOLETBLOOM, name: 'Violetbloom', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'violetbloom_petal', count: 1 }], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.STORMGRASS, name: 'Stormgrass', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'stormgrass_blade', count: 1 }], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.ROOTVINE, name: 'Rootvine', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'rootvine_coil', count: 1 }], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.TIDEPETAL, name: 'Tidepetal', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'tidepetal_bloom', count: 1 }], fastSkill: 'farming', placeable: true },

  // ── ★★ THE SEVEN WILD CROPS (2026-08-22) — a ground grows a PLANT ────────────────────────────
  // RULED (/magii): the grass-tuft ruling and these were never in tension. Canon had already drawn
  // the line the herbs have used since 08-18 — *a tuft yields a SEED, a ground grows a PLANT* — so
  // a meadow handing over `seed_shimmerwheat` and a crag growing a Crystalcap you pick are two
  // different transactions, not two answers to one question.
  //
  // ★★ EVERY ROW DROPS PRODUCE **AND** A SEED, and the seed is the whole loop rather than a bonus.
  // Canon left *"whether a met plant hands over seed or produce or both"* to the build, and both is
  // the only answer that makes its own sentence work: *wild is the reason to travel, the plot is
  // reliable supply* only means something if the wild plant is what BOOTSTRAPS the plot. You cross
  // a crag once, find a Crystalcap, carry a seed home, and farm it forever after. One lucky find
  // opening a crop line is not a leak — it is the loop the ruling describes, and the farming level
  // gates still pace it.
  // ⚠ 25% IS UNPLAYTESTED (play lane's number, flagged as such on GBOARD). It is a dial, not a
  // measurement, and nobody has walked a keeper through it end to end.
  //
  // ⚠ NO ATLAS SLOT ON PURPOSE — these are flora, drawn by the instanced renderer with their own
  // textures, and `render-audit.test.ts` exempts them via `FLORA_MATERIALS`. That exemption is
  // imported and counted against the kind enums, so it cannot quietly widen to cover a mistake.
  { noSlab: true, material: MAT.MOONVINE, name: 'Moonvine', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'moonvine_leaf', count: 1 }, { itemId: 'seed_moonvine', count: 1, chance: 0.25 }], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.STARBEAN, name: 'Starbean', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'starbean_pod', count: 1 }, { itemId: 'seed_starbean', count: 1, chance: 0.25 }], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.CRYSTALCAP, name: 'Crystalcap', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'crystalcap_spore', count: 1 }, { itemId: 'seed_crystalcap', count: 1, chance: 0.25 }], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.DREAMROOT, name: 'Dreamroot', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'dreamroot_essence', count: 1 }, { itemId: 'seed_dreamroot', count: 1, chance: 0.25 }], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.SHIMMERBLOOM, name: 'Shimmerbloom', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'shimmerbloom_petal', count: 1 }, { itemId: 'seed_shimmerbloom', count: 1, chance: 0.25 }], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.ATHERWHEAT, name: 'Atherwheat', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'atherwheat_grain', count: 1 }, { itemId: 'seed_atherwheat', count: 1, chance: 0.25 }], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.DAWNCAP, name: 'Dawncap', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'dawncap_spore', count: 1 }, { itemId: 'seed_dawncap', count: 1, chance: 0.25 }], fastSkill: 'farming', placeable: true },
  // ── the pot: one block in three states, and only the empty one is a thing you carry ──────────
  { noSlab: true, material: MAT.POT, name: 'Clay Pot', hardness: 0.5, skill: null, minTier: 0, drops: [{ itemId: 'clay_pot', count: 1 }], placeable: true },
  // A planted or bloomed pot gives the POT back, never the seed: pulling a seed you already
  // committed would make planting risk-free, and the seed is the scarce thing.
  { noSlab: true, material: MAT.POT_SEEDED, name: 'Planted Pot', hardness: 0.5, skill: null, minTier: 0, drops: [{ itemId: 'clay_pot', count: 1 }], placeable: false },
  { noSlab: true, material: MAT.POT_BLOOM, name: 'Bloomed Pot', hardness: 0.5, skill: null, minTier: 0, drops: [{ itemId: 'clay_pot', count: 1 }], placeable: false },

  // ── the chest — the first block that holds something ────────────────────────────────────────
  // Breaks by hand into itself, same reasoning as the lantern and the bench: storage you cannot
  // rearrange for free is storage nobody commits to. What was INSIDE it is not in this row and
  // cannot be — a drop table is a fixed list and contents are not — so the host spills them
  // separately (voxel3d/chest.ts `spill`). It drops the chest ITEM only; the two are independent
  // and the oracle asserts you cannot get one without the other.
  { noSlab: true, material: MAT.CHEST, name: 'Chest', hardness: 0.9, skill: null, minTier: 0, drops: [{ itemId: 'chest', count: 1 }], fastSkill: 'forestry', placeable: true },
  { material: MAT.SPRING_CRUST, name: 'Spring Crust', hardness: 1.2, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'block_spring_crust', count: 1 }], placeable: true },

  // ── the Prospecting ladder — hardness AND tier both climb, so depth gates twice over ────────
  { material: ORE.RAW_MANA, name: 'Raw Mana Seam', hardness: 2.2, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'raw_mana_shard', count: 1 }], placeable: false },
  { material: ORE.ELEMENT_VIOLET, name: 'Violet Crystal Seam', hardness: 3.0, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'violet_crystal', count: 1 }], placeable: false },
  { material: ORE.ELEMENT_STORM, name: 'Storm Crystal Seam', hardness: 3.0, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'storm_crystal', count: 1 }], placeable: false },
  { material: ORE.ELEMENT_EARTH, name: 'Earth Crystal Seam', hardness: 3.0, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'earth_crystal', count: 1 }], placeable: false },
  { material: ORE.ELEMENT_WATER, name: 'Water Crystal Seam', hardness: 3.0, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'water_crystal', count: 1 }], placeable: false },
  { material: ORE.PURE_CORE, name: 'Pure Core Seam', hardness: 4.5, skill: 'prospecting', minTier: 2, drops: [{ itemId: 'pure_mana_core', count: 1 }], placeable: false },
  { material: ORE.ATHER_CRYSTAL, name: 'Ather Crystal Seam', hardness: 6.5, skill: 'prospecting', minTier: 3, drops: [{ itemId: 'ather_crystal', count: 1 }], placeable: false },

  // ── Forestry — the four ruled woods ────────────────────────────────────────────────────────
  // ★ skill: 'forestry' means a SPIKE WILL NOT CUT A TREE and a BLADE will not break stone. The
  // tool families are canon (`engine/tools.ts`: blades→forestry, spikes→prospecting) and the
  // registry enforces the split rather than restating it. Hardness climbs with the same 1/4/7/10
  // ladder the old node minLevels used.
  //
  // ── ★ A LOG DROPS A LOG (2026-08-07) ────────────────────────────────────────────────────────
  // These rows used to drop finished `goldwood_plank` / `starwillow_branch`, inherited verbatim
  // from `world/resources.ts` where a *node* handed over milled timber because the tile world had
  // no tree to cut. Carried into a voxel world it meant chopping a trunk yielded lumber, and it
  // silently broke the game: the blades cost bark and sap, those were secondary NODE drops, no
  // block produced them, so all three forestry tiers were uncraftable — which left the basic Worn
  // Blade (tier 1) as the ceiling and made STARWILLOW (minTier 2) and DAWNWOOD (minTier 3) trees
  // permanently unharvestable. The generator was placing wood nobody could ever cut.
  // `recipes.ts` is the missing layer; `recipes.test.ts` asserts nothing is unreachable again.
  // ★ A LOG IS RAW MATERIAL, NOT A BUILDING BLOCK (2026-08-13, the same ruling as stone). You fell
  // a tree and hold timber; timber becomes planks; planks buy the pieces and the planking. Putting
  // the trunk back up was the Minecraft loop this replaces — and it is also what made the 15%
  // thinner trunk safe to ship, since a raw-log WALL is no longer a thing anyone can build.
  { material: WOOD.GOLDWOOD_LOG, name: 'Goldwood', hardness: 1.4, skill: 'forestry', minTier: 1, drops: [{ itemId: 'goldwood_log', count: 1 }], placeable: false },
  { material: WOOD.SHIMMEROAK_LOG, name: 'Shimmeroak', hardness: 1.9, skill: 'forestry', minTier: 1, drops: [{ itemId: 'shimmeroak_log', count: 1 }], placeable: false },
  { material: WOOD.STARWILLOW_LOG, name: 'Starwillow', hardness: 2.6, skill: 'forestry', minTier: 2, drops: [{ itemId: 'starwillow_log', count: 1 }], placeable: false },
  { material: WOOD.DAWNWOOD_LOG, name: 'Dawnwood', hardness: 3.4, skill: 'forestry', minTier: 3, drops: [{ itemId: 'dawnwood_log', count: 1 }], placeable: false },

  // Leaves come away by hand — soft, fast, and they drop nothing in v1. Sapling drops are a
  // regrowth mechanic and regrowth is not built, so promising one here would be a lie.
  { material: WOOD.GOLDWOOD_LEAVES, name: 'Goldwood Leaves', hardness: 0.25, skill: null, minTier: 0, drops: [], placeable: false },
  { material: WOOD.SHIMMEROAK_LEAVES, name: 'Shimmeroak Leaves', hardness: 0.25, skill: null, minTier: 0, drops: [], placeable: false },
  { material: WOOD.STARWILLOW_LEAVES, name: 'Starwillow Leaves', hardness: 0.25, skill: null, minTier: 0, drops: [], placeable: false },
  { material: WOOD.DAWNWOOD_LEAVES, name: 'Dawnwood Leaves', hardness: 0.25, skill: null, minTier: 0, drops: [], placeable: false },
]

/**
 * ── ★ EVERY PLACEABLE BLOCK GETS A SLAB, DERIVED ─────────────────────────────────────────────────
 * Written as a derivation rather than 20 more table rows so a new block cannot ship without its
 * slab, and so a slab's name and drop id can never drift from the block it came from. A slab drops
 * `<item>_slab` and that item places it back — the same round-trip `mine.test` asserts for blocks.
 * Half the block, half the work to break it.
 */
// ⚠ `placeable || ground`, NOT `placeable` — see `BlockDef.ground`. A slab exists either because
// the player can place one or because the terrain can generate one, and those are different sets.
const HALF_DEFS: BlockDef[] = BLOCKS.filter(b => (b.placeable || b.ground) && !b.noSlab && b.drops.length > 0).map(b => ({
  ...b,
  material: b.material | HALF_BIT,
  name: `${b.name} Slab`,
  hardness: b.hardness / 2,
  drops: [{ itemId: `${b.drops[0].itemId}_slab`, count: 1 }],
}))

/**
 * Every block row that exists at runtime, hand-written and derived alike.
 *
 * ★ EXPORTED SO AUDITS READ THE REAL TABLE INSTEAD OF REBUILDING IT. `scripts/item-art.mts` needs
 * the slab rows; the only other way to get them is to re-apply `HALF_DEFS`' naming rule in a second
 * place, and a checklist that re-derives what it checks agrees with itself forever while the game
 * says something else. Same reason `icon-sheet.mts` calls the shipped rasteriser.
 */
export const ALL_BLOCKS: readonly BlockDef[] = [...BLOCKS, ...HALF_DEFS]

const BY_MATERIAL = new Map<number, BlockDef>([...BLOCKS, ...HALF_DEFS].map(b => [b.material, b]))
/** Reverse map so a placed block-item becomes the right voxel. */
/**
 * Reverse map so a placed block-item becomes the right voxel.
 *
 * ★ ONLY THE IDENTITY DROP (`drops[0]`), and only when it is guaranteed. Mapping every drop was
 * fine while every drop WAS the block, and broke the moment grass grew a bonus: two placeable
 * blocks both dropping `mana_seed` made the seed resolve to a block, so a Mana Seed — the thing
 * that pays out a SPIRIT — would have been placeable as a tuft. A bonus drop is loot, not identity.
 */
const BY_ITEM = new Map<string, number>(
  [...BLOCKS, ...HALF_DEFS]
    .filter(b => b.placeable && b.drops[0] && b.drops[0].chance === undefined)
    .map(b => [b.drops[0].itemId, b.material] as [string, number]),
)

/** ⚠ TOP_BIT is POSITION, not identity — a top slab is the same block as a bottom one, so it is
 *  masked off before the lookup. Without this, mining an upside-down slab finds no definition at
 *  all: no hardness, no drops, an unbreakable block you placed yourself. */
export const blockDef = (material: number): BlockDef | undefined => BY_MATERIAL.get(material & ~TOP_BIT)
export const materialForItem = (itemId: string): number | undefined => BY_ITEM.get(itemId)
/** Block light emitted by a material — `light.ts`'s `emit` callback in one lookup. */
export const emitOf = (material: number): number => blockDef(material)?.emit ?? 0
export const isBreakable = (material: number): boolean =>
  material !== AIR && (blockDef(material)?.hardness ?? Infinity) !== Infinity

/**
 * Seconds to break, given the tool actually held.
 *
 * ★ THE RETURN OF `Infinity` IS THE GATE, and it is deliberately not a boolean. Too weak a tool
 * means "you cannot", not "this takes a while" — a player grinding for 40 seconds on a block that
 * was never going to break is the worst version of this mechanic. `canBreak` reads the same fact.
 *
 * `toolTier` 0 means bare hands. `toolSpeed` is `engine/tools.ts`'s `speedBonus` (lower = faster),
 * passed in rather than looked up so the core stays free of the engine.
 */
export function breakSeconds(material: number, toolTier: number, toolSkill: BlockSkill, toolSpeed = 1): number {
  const def = blockDef(material)
  if (!def || def.hardness === Infinity) return Infinity
  // Ungated block (soil, sand): hands always work. Holding the RIGHT family (fastSkill — a shovel
  // on dirt) is a real speed step and carries the tool's own speedBonus; any other tool is the old
  // flat 0.85 for "at least you're holding something". Never Infinity here — an ungated block that
  // could refuse you would strand a fresh keeper who has no tools at all.
  if (def.skill === null) {
    if (def.fastSkill && toolSkill === def.fastSkill) return def.hardness * 0.55 * toolSpeed
    return def.hardness * (toolSkill === null ? 1 : 0.85)
  }
  if (toolSkill !== def.skill) return Infinity   // wrong tool family entirely
  if (toolTier < def.minTier) return Infinity    // too weak — refused, not slowed
  // Each tier above the minimum is a real speed step, so upgrading a spike is felt immediately.
  const tierGain = 1 - Math.min(0.55, (toolTier - def.minTier) * 0.22)
  return def.hardness * tierGain * toolSpeed
}

export const canBreak = (material: number, toolTier: number, toolSkill: BlockSkill): boolean =>
  breakSeconds(material, toolTier, toolSkill) !== Infinity
