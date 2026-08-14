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

/** Chance a broken tuft yields a wind-borne Mana Seed. See the grass entries below before dialing. */
export const MANA_SEED_CHANCE = 1 / 2_500
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
  { material: MAT.BEDROCK, name: 'Bedrock', hardness: Infinity, skill: null, minTier: 0, drops: [], placeable: false },
  // ── ★ QUARRIED STONE YIELDS RUBBLE, AND DOES NOT GO BACK (2026-08-13, Alex's ruling) ────────
  // Both drop the SAME rubble on purpose: what a pick leaves behind is broken rock either way, and
  // the tier lives in what it costs to BREAK them (hardness + minTier), which is where a player
  // already feels it. Two rubbles would be two economies for one material.
  // `placeable: false` is the whole ruling in one field — and it needs no other code, because
  // `BY_ITEM` below only reverses PLACEABLE blocks, so `block_stone` simply stops resolving to a
  // voxel. ⚠ `block_stone`/`block_deep_stone` are now unobtainable ids: anything that still asks
  // for them is uncraftable, which is what `recipes.test.ts`'s reachability sweep is for.
  { material: MAT.DEEP_STONE, name: 'Deep Stone', hardness: 2.4, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'rubble', count: 1 }], placeable: false },
  { material: MAT.STONE, name: 'Stone', hardness: 1.6, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'rubble', count: 1 }], placeable: false },

  // ★ RUBBLE IS THE FORGIVENESS VALVE — placeable, but only ever as rubble. A hole can be filled
  // and the patch always shows, which is the honest middle between an irreversible scar and a
  // perfect undo. Loose rock, so it is softer than the stone it came from and a bare hand can move
  // it (`skill: null`); a spike is simply faster.
  { material: MAT.RUBBLE, name: 'Rubble', hardness: 0.6, skill: null, minTier: 0, drops: [{ itemId: 'rubble', count: 1 }], fastSkill: 'prospecting', placeable: true },
  // ★ AND CUT STONE IS THE WALL — the first CRAFTED surface, never generated and never dug. This
  // is the rung the ruling needs that pieces alone cannot supply: doorways, fences and beams do
  // not make a house without something to be the wall between them.
  { material: MAT.CUT_STONE, name: 'Cut Stone', hardness: 1.5, skill: 'prospecting', minTier: 1, drops: [{ itemId: 'cut_stone', count: 1 }], placeable: true },

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
  { material: MAT.GREY_SOIL, name: 'Greyed Soil', hardness: 0.55, skill: null, minTier: 0, drops: [{ itemId: 'block_subsoil', count: 1 }], fastSkill: 'farming', placeable: false },
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
  // ── ★ CAST MATTER CANNOT BE QUARRIED (2026-08-14) ────────────────────────────────────────────
  // `hardness: Infinity` ⇒ `breakSeconds` returns Infinity ⇒ `canBreak` is false. That single value
  // is the whole anti-exploit: without it a keeper casts a 16-mana Stonewall, mines five rubble, and
  // repeats. Using the registry's existing gate means the mining path never learns what a cast is.
  // `drops: []` is belt-and-braces — if some future path forces a break, it still pays nothing.
  { material: MAT.CONJURED, name: 'Conjured Matter', hardness: Infinity, skill: null, minTier: 0, drops: [], placeable: false },

  // The story road. Digs like soil and drops SUBSOIL for the same reason greyed soil does: the
  // road is a CONDITION of the ground, not a block you carry home and lay somewhere else.
  { material: MAT.PATH, name: 'Worn Path', hardness: 0.5, skill: null, minTier: 0, drops: [{ itemId: 'block_subsoil', count: 1 }], fastSkill: 'farming', placeable: false },

  // ── ★ PLANKING — the WOOD half of the building grammar (2026-08-13, Alex's ruling) ───────────
  // Alex: *"which get turned into planks .. actual planks not the block, not placeable, but can be
  // used to craft materials to build with."* So the plank stopped being a block in hand and became
  // pure CURRENCY — it buys doors, fences, beams, windows — and this block became the thing you
  // craft OUT of planks when you want a wooden surface. Same third rung cut stone is for stone:
  // pieces do not make a house without a wall between them.
  //
  // ★ IT IS THE SAME MATERIAL ID, RENAMED AND RE-DROPPED, not a new block. The id already exists,
  // already generates in the road's bridges and already has a milled-plank painter — and a bridge
  // deck IS planking, which is what a crafted wooden surface should look like. Adding a second
  // wooden block beside it would have left two ids meaning one thing.
  //
  // ⚠ CHANGING THE DROP IS WHAT MAKES THE PLANK UNPLACEABLE, and it needs no other code: `BY_ITEM`
  // maps a placeable block's identity drop back to its material, so the moment this row stops
  // dropping `goldwood_plank`, that item stops resolving to a voxel. Breaking planking gives back
  // `planking` (salvage the panel), never the planks it was made from.
  { material: MAT.PLANKS, name: 'Planking', hardness: 0.7, skill: null, minTier: 0, drops: [{ itemId: 'planking', count: 1 }], fastSkill: 'forestry', placeable: true },

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
  { noSlab: true, material: MAT.TUFT, name: 'Grass Tuft', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'grass_tuft', count: 1 }, { itemId: 'mana_seed', count: 1, chance: MANA_SEED_CHANCE }], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.TALL_GRASS, name: 'Tall Grass', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'tall_grass', count: 1 }, { itemId: 'mana_seed', count: 1, chance: MANA_SEED_CHANCE }], fastSkill: 'farming', placeable: true },
  { noSlab: true, material: MAT.FLOWER, name: 'Wildflower', hardness: 0.05, skill: null, minTier: 0, drops: [{ itemId: 'wild_flower', count: 1 }], fastSkill: 'farming', placeable: true },
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
const HALF_DEFS: BlockDef[] = BLOCKS.filter(b => b.placeable && !b.noSlab && b.drops.length > 0).map(b => ({
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
