// The depth rule — what a column is MADE of, given its surface altitude.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// This is the surviving intent of Minecraft's surface rules with the part we cannot use removed.
// Theirs is a per-column CASCADE that walks downward through blocks, and that shape exists only
// because it is walking a real block column at generation time. We keep the *intent* — an ORDERED
// PREDICATE LIST deciding a voxel's material, first match wins — and drop the walk, because our
// height is already known analytically. `materialAt` is O(1) for any y: it never iterates a column,
// so a chunk builder can fill sections in any order, or fill only the one section it needs.
//
// ⚠ ORE IS NOT HERE, DELIBERATELY. This produces HOST ROCK only. Ores are features placed later
// (post-carve blobs, pre-carve pockets — WORLDGEN-RESEARCH steals #8–#11) and they overwrite what
// this returns. Mixing them would put ore placement on the wrong side of the carver ordering, which
// is the single decision that makes ore appear in cave walls or stay buried.

import { fbm2, value2 } from './noise'
import {
  columnHeight, riverCarve, waterSurfaceAt, RIVER_DEPTH,
  springsPoolAt, poolDepthAt, POOL_DEEP,
  type HeightConfig, DEFAULT_HEIGHT,
} from './height'
import { greySurfaceAt, DEFAULT_BIOME } from './biome'
import { landCharacter, surfaceBlockAt } from './character'
import { roadAt } from './story-path'
import { holdIndexAt, holdVoxelAt, holdCourtyardAt } from './holds'
import { holdPadLevel } from './height'
import { AIR } from './section'

/**
 * Base materials. Palette indices — the skin (which tile art) is resolved by the registry, not here.
 *
 * ⚠ TBD-CANON: these are generic earth materials named in plain English on purpose. If the Ather's
 * deep rock, its soil, or its stone carry canon names, those belong to Magii and go over as part of
 * the one batched naming question. Do NOT invent Athernyx names for them here — a guess that ships
 * becomes accidental canon.
 */
// ── ★ THE MATERIAL ID MAP — one number space, four files ────────────────────────────────────────
// MAT 0-13 + 24-30 + 40-47 + 50-56 (here) · ORE 16-22 (ore.ts) · WOOD 32-39 (trees.ts) · STRUCTURE 48-49 (pieces.ts).
// PLANTS take 24-26, in the gap between ore and wood. ⚠ The first cut put them at 14-16 because
// MAT stops at 13 — and 16 is ORE.RAW_MANA, so a wildflower WAS a mana seam: it inherited ore
// hardness, dropped shards, and `isPlant` matched ore and logs all through the underground.
// Nothing warned, because these enums are separate `const` objects that never see each other.
// Check this map before adding any material anywhere.
/**
 * ── ★ HALF BLOCKS ARE A MATERIAL, NOT A SHAPE THE TERRAIN REMEMBERS (2026-08-11, Alex's ruling) ──
 * A slab you can mine and place has to BE a block. The first cut made terrain lips full voxels that
 * a per-column mask drew at half height, and the seam showed immediately in play: mining one gave a
 * whole block, and placing ANY block into that cell — stone included — inherited the ground's shape.
 * Half-ness rode the (x, z) column instead of the cell.
 *
 * So it is a bit on the material. Every consequence falls out instead of being arranged:
 *   · the save is a material diff, so a slab persists with no extra machinery;
 *   · `dropsFor` can hand back a slab item and placing it writes a slab back;
 *   · the mesher tests a BIT inline rather than calling a predicate per cell — cheaper than the
 *     strip-a-copy machinery it replaces (see greedy.ts on what a per-cell call costs there);
 *   · any material can be a slab, so this is the general building block, not a terrain special case.
 * Base ids must stay under 256. Uint16 sections leave plenty of room above the flag.
 */
export const HALF_BIT = 0x0100
/**
 * A slab sitting in the UPPER half of its cell. Only meaningful with HALF_BIT.
 *
 * ★ A TOP SLAB COLLIDES AS A FULL BLOCK, and that is a deliberate simplification worth keeping: the
 * open lower half of the cell is 0.5 tall and the player is ~1.8, so nothing can ever stand in it.
 * Its walkable surface is the cell top, exactly like a full block's. That means top slabs cost
 * locomotion.ts NOTHING — no new cell code, no change to the 58-assert feel contract — and the
 * difference lives entirely in what the mesher draws.
 */
export const TOP_BIT = 0x0200
/** The full-block material behind a possibly-half one. Cheap: one mask. */
export const baseOf = (m: number): number => m & 0xFF


/** A slab in the upper half of its cell. */
export const isTopSlab = (m: number): boolean => (m & TOP_BIT) !== 0
/** Is this cell a slab? One bit test — safe in a hot loop. */
export const isHalfMat = (m: number): boolean => (m & HALF_BIT) !== 0

export const PLANT_MIN = 24
export const PLANT_MAX = 26

/**
 * ── ★ THE FOUR ELEMENT HERBS (2026-08-18) — a SECOND plant range, and it had to be ──────────────
 * Canon's wild herbs are ground cover in every way that matters to the mesher, the walker and the
 * light field, so they must answer `isPlant`. They could not join 24-26: 27-30 are the pot's three
 * states and the chest, and **a material id is written into every save**, so renumbering to make
 * room would silently repaint every stored edit in the world. A second range is the honest cost.
 *
 * ⚠ KEEP 58-61 CONTIGUOUS, exactly as the note on 24-26 and the saplings' 42-45 say. A fifth herb
 * inserted anywhere else stops being a plant — solid, opaque, un-mowable — with nothing in the code
 * looking wrong.
 */
export const HERB_MIN = 58
export const HERB_MAX = 61
export const isHerb = (m: number): boolean => m >= HERB_MIN && m <= HERB_MAX

/**
 * Non-solid, non-opaque ground cover. Range test on purpose — this runs in the mesher's hot loop.
 *
 * ⚠ THREE RANGES NOW, AND THE ORDER IS THE CHEAP ONE FIRST. Grass and flowers cover most of the
 * living world; herbs and scatter are rare by design, so the common case still costs two
 * comparisons and the rare ones cost four and six. Anything that treats "plant" as a single span
 * (a `<= PLANT_MAX` written by hand somewhere) is wrong from today — ask this function, never the
 * constants.
 */
export const SCATTER_MIN = 68
export const SCATTER_MAX = 70
export const isScatter = (m: number): boolean => m >= SCATTER_MIN && m <= SCATTER_MAX

export const isPlant = (m: number): boolean =>
  (m >= PLANT_MIN && m <= PLANT_MAX) || (m >= HERB_MIN && m <= HERB_MAX)
  || (m >= SCATTER_MIN && m <= SCATTER_MAX)

/**
 * Saplings, as a contiguous range — the same shape `isPlant` uses, and for the same reason: the
 * mesher has to ask "is this one of those" on every cell it sweeps, and a range test is the only
 * kind of question that function can afford.
 *
 * ⚠ KEEP 42-45 CONTIGUOUS. A fifth species inserted anywhere else silently stops rendering as a
 * seedling and comes back as a cube, with nothing in the code looking wrong.
 */
export const SAPLING_MIN = 42
export const SAPLING_MAX = 45
export const isSapling = (m: number): boolean => m >= SAPLING_MIN && m <= SAPLING_MAX
/** Any state of the pot. */
export const isPot = (m: number): boolean => m === 27 || m === 28 || m === 29

export const MAT = {
  AIR: AIR,
  /**
   * ── ★ THE FLOOR OF THE WORLD IS PRESSED CLOUD, NOT ROCK (2026-08-15, Alex) ────────────────────
   * Alex: *"we need an unbreakable bottom similar to bedrock .. maybe clouds or the compressed
   * version of clouds, since clouds will already be the borders in the wilds as world limit, as
   * well as in the home plot."*
   *
   * ★ THIS IS A RENAME, NOT A NEW MATERIAL, AND THAT IS THE WHOLE POINT. Id 1 was `BEDROCK` — a
   * Minecraft inheritance sitting in a world CANON says is made of cloud, and it had been the
   * bottom of every column since the first generator. Nothing about its mechanics was wrong
   * (hardness Infinity, drops nothing, unplaceable); its IDENTITY was. So the id, the generation
   * and every save keep meaning exactly what they meant, and only the name, the colour and the
   * tile change. ⚠ NO `GENERATOR_VERSION` BUMP IS OWED for the same reason — `materialAt` returns
   * the same id at the same cells, so this is a render change wearing a rename. Do not bump it to
   * be safe; a spurious bump makes every stored column read as stale.
   *
   * ★ AND IT IS CANON-LITERAL, not a reskin for flavour. `world/mother.md` (ruled 2026-07-19):
   * mana *"clouds inward and settles into the cloud-stuff that IS the Ather — cooling as it sinks,
   * compressing as it deepens,"* and the walkable world rests on **the Settle**, *"the crust where
   * the cloud-ocean has cooled just solid enough to stand on."* `spirit-tales-bible.md` (ruled
   * 2026-06-02/06-07): the cloud-walls ringing every plot ARE *"the cloud-ocean itself, held back
   * and pressed soft and glowing."* Pressed cloud is what this world is made of at every scale —
   * pressed soft at the walls, pressed hard at the floor. Digging to the bottom and finding
   * granite was the odd part.
   *
   * ⚠ WHY IT IS NOT CALLED "THE SETTLE" OR "THE SILT", both of which are ruled terms and both of
   * which would be wrong. The Settle is the WHOLE crust — the soil and stone above this are also
   * the Settle — and the Silt is the packed graveyard at the dead centre of the Ather, nowhere
   * near the floor of one garden pocket. Misusing a ruled name is worse than plain English, so
   * this is plain English for what it is, in Alex's own words. No canon gap is owed.
   */
  PACKED_CLOUD: 1,
  DEEP_STONE: 2,
  STONE: 3,
  SUBSOIL: 4,
  TOPSOIL: 5,
  SAND: 6,
  WATER: 7,
  /** Drained ground's surface — TOPSOIL with the mana gone. See biome.ts's richness field. */
  GREY_SOIL: 8,
  /**
   * The first emitter — a shard of raw mana in a plank frame. Exists so `light.ts`'s block
   * channel has a source and "tended light holds grey off" is a thing a keeper can DO, not just
   * a line the spawn code honours. Never generated; only ever placed. ⚠ TBD-CANON on the name,
   * same as everything else in this enum.
   */
  MANA_LANTERN: 9,
  /**
   * The crafting station, placed. The ITEM already existed (`voxel/recipes.ts` hand-crafts it;
   * canon has Greg gift one in the starter bag) — this id is what lets it stand in the world.
   * Never generated; only ever placed. ⚠ TBD-CANON on the name, same as everything else here.
   */
  CRAFT_TABLE: 10,
  /**
   * The story road's surface — packed earth worn by the quest spine (story-path.ts). Generated,
   * never placed; digging it yields plain dirt, because a road is wear, not a thing you pocket.
   */
  PATH: 11,
  /**
   * PLANKING — the crafted wooden wall (2 planks nailed together), the wood half of the building
   * grammar. ⚠ NEVER GENERATED as of 2026-08-15: the bridges that used to emit this id now emit
   * `DECK` (54), because handing the crafted material out in the world is the same hole as making
   * it diggable. Placed only, and it drops `planking` rather than the planks it was made from.
   *
   * ⚠ The id keeps the name PLANKS while the block is called "Planking" — it was renamed and
   * re-dropped in place on 2026-08-13 rather than replaced, so that two ids never meant one thing.
   */
  PLANKS: 12,
  /**
   * The hot springs' mineral shell (2026-08-08, the Springs rework) — the pale crust a spring
   * deposits around itself. Beds, aprons and the shallow walls of the terrace pools wear it
   * (height.ts's springsPoolAt says where). ⚠ TBD-CANON on the name, like everything else here.
   */
  SPRING_CRUST: 13,

  // ── ★ PLANTS ARE BLOCKS (2026-08-11, Alex: "everything should be collectable") ──────────────
  // Ground cover used to be a pure function the RENDERER drew and nothing else could see — so it
  // could not be targeted, broken, dropped or saved. Making it real voxels is what makes "you can
  // collect it" true by construction rather than by a second system that has to be kept in sync:
  // `raycast` already stops at any non-AIR material, `tickBreak`/`dropsFor` already read the
  // registry, and `recordEdit` already diffs against what the generator would have put here — so
  // a picked flower persists through the same path a mined block does, with no new machinery.
  // ⚠ KEEP THESE THREE CONTIGUOUS. `isPlant` is a range test, not a Set lookup, because it is
  // called from the mesher's inner loop — see greedy.ts on what a per-cell call costs there.
  TUFT: 24,
  TALL_GRASS: 25,
  FLOWER: 26,

  // ── ★ THE POT — where a Mana Seed becomes a spirit (2026-08-11) ─────────────────────────────
  // Three materials rather than one block plus a growth record, because THE MATERIAL IS THE STATE
  // and the save is a material diff: a planted pot survives a reload, an evict and a walk to the
  // Outfields with no new persistence layer. The only thing a material cannot hold is WHEN it was
  // planted, so that — and only that — lives beside the player save.
  POT: 27,
  POT_SEEDED: 28,
  POT_BLOOM: 29,

  // ── ★ THE CHEST — the first block that HOLDS something (2026-08-11) ─────────────────────────
  // Unlike the pot, a chest's state is NOT expressible as a material: what is inside it is a grid
  // of stacks, so this id names the block and the contents live beside its column's block edits
  // (see voxel3d/chest.ts's header for why there and not in a global sidecar). A chest cell that
  // stops being a chest must drop its record in the same breath, or the next one built on that
  // spot inherits somebody else's items.
  CHEST: 30,

  // ── ★ BUILDING MATERIALS — you build with what you MADE, not with what you dug (2026-08-13) ──
  // Alex's ruling, and it is the line that separates this game's building from Minecraft's: a
  // block you break gives you a MATERIAL, and the material is refined before it can go back into
  // the world. Stone is the first grammar: mine it and you hold RUBBLE, cut the rubble and you
  // hold CUT_STONE, and cut stone is the wall. Raw stone stops being placeable entirely — there
  // is no putting the mountain back.
  //
  // ⚠ SOIL, SUBSOIL AND SAND ARE DELIBERATELY EXEMPT (Alex, same ruling): landscaping your own
  // plot, filling a hole, shaping a garden bed IS the cozy loop, and the pot/farming chain reads
  // straight through it. "No block is ever placeable" is the Minecraft answer wearing a coat.
  //
  // ★ RUBBLE IS PLACEABLE, and that is the forgiveness valve. It goes back down as rubble — never
  // as stone — so a hole can be filled but the patch always shows. A cozy game where one mis-swing
  // permanently scars the garden is the wrong trade; so is a perfect undo.
  //
  // ⚠ Ids 40-41, in the clean band between WOOD (32-39) and STRUCTURE (48-49). NOT 14-15: those
  // sit against ORE's range and that adjacency is exactly how a wildflower became a mana seam.
  RUBBLE: 40,
  CUT_STONE: 41,
  // ── ★ SAPLINGS (2026-08-13) — a forest you planted ──────────────────────────────────────────
  // One material PER SPECIES, not one generic sapling, and the reason is the same one that made
  // pots three materials instead of one with a record: the world itself then says what will grow
  // here. No sidecar, no lookup, and a save that survives a wipe of everything except the blocks.
  //
  // ⚠ 42-45. STRUCTURE is 48 and STRUCTURE_HALF is 49 (pieces.ts), so 42-47 is the free gap — NOT
  // the 14-23 gap, which is ORE.
  SAPLING_GOLDWOOD: 42,
  SAPLING_SHIMMEROAK: 43,
  SAPLING_STARWILLOW: 44,
  SAPLING_DAWNWOOD: 45,
  /**
   * The sawmill — the second station, and the first one that is not general-purpose
   * (`voxel/workshop.ts`). Never generated; only ever placed. ⚠ TBD-CANON on the name, same as
   * everything else in this enum. 46; 47 is the last of the 42-47 gap.
   */
  SAWMILL: 46,
  /**
   * ── ★ CONJURED MATTER (2026-08-14, the terrain-cast port) ────────────────────────────────────
   * A wall a keeper CAST, not one anybody built: Stonewall, Cordon, Pillar Tomb, Flash Freeze,
   * Glacial Path, Living Architecture, Living Fortress all write this and only this.
   *
   * ★ IT IS ITS OWN MATERIAL FOR A GAMEPLAY REASON, NOT A TIDINESS ONE. Reusing `STONE` would put a
   * block in the world that looks permanent and then evaporates ten seconds later, which reads as a
   * bug every single time. **A temporary wall has to LOOK temporary**, so this glows (it is mana in
   * the shape of a wall, not rock) and reads unlike anything quarried.
   *
   * ★ AND `hardness: Infinity` IN THE REGISTRY IS WHAT CLOSES THE EXPLOIT, using the mechanism that
   * already exists rather than a guard in the mining path: `breakSeconds` returns Infinity, so
   * `canBreak` is false and a keeper cannot farm 16-mana Stonewalls for free rubble. Nothing in the
   * mine code had to learn about casts.
   *
   * ⚠ NEVER GENERATED, NEVER PLACED BY HAND, AND NEVER SAVED. The host writes it straight into
   * sections (the `applyGenPieces` path), so it never enters the edit record — a conjured wall is a
   * runtime occupancy, not an edit to the world. Close the tab mid-Cordon and it is simply gone.
   * 47; this closes the 42-47 gap.
   */
  CONJURED: 47,
  /**
   * The stonecutter — the third station, and the stone half of the family (`voxel/workshop.ts`).
   * Never generated; only ever placed. ⚠ TBD-CANON on the name, same as everything else here.
   *
   * ⚠ 50 OPENS A NEW BAND, because 42-47 is full and STRUCTURE owns 48-49 (pieces.ts). Ids 14-15,
   * 23 and 31 are also free and were all rejected: 14-15 sit against ORE's range (that adjacency is
   * how a wildflower once became a mana seam), 23 is the same story one slot up, and 31 is the lone
   * cell under WOOD's 32-39 band. A station is furniture, so 50+ is the STATION/FURNITURE band from
   * here on — the next one is 51, not another squeeze into somebody else's gap.
   */
  STONECUTTER: 50,

  // ── ★ THE MASONRY PALETTE (2026-08-15, Alex asked for colours and textures to build with) ────
  // Three crafted building surfaces beside CUT_STONE, and none of them is a new ROCK: the colour
  // comes from mineral the world already quarries. Pale from the springs' terrace crust, tan from
  // beach sand, and fine grey courses cut from cut stone. Never generated; only ever placed, so
  // none of them needs a GENERATOR_VERSION bump — see `recipes.ts` for why new strata would be a
  // canon question and this is not.
  //
  // ⚠ 51-53 CONTINUE THE HAND-PLACED BAND OPENED AT 50. The building-materials band (40-41) filled
  // up in August and the clean gaps below STRUCTURE are gone, so everything placed rather than
  // generated lives up here from now on. They are NOT range-tested anywhere — unlike plants and
  // saplings, nothing asks "is this masonry" in a hot loop — so the adjacency is tidiness, not a
  // contract. Keep it anyway; the next one is 54.
  STONE_BRICK: 51,
  PALE_BRICK: 52,
  SANDSTONE: 53,

  // ── ★ BRIDGE DECK (2026-08-15) — the road's own timber, and NOT the timber you build with ────
  // The story road's bridges generated `MAT.PLANKS`, which on 2026-08-13 stopped being "a plank
  // block" and became PLANKING: the crafted wooden WALL, the third rung of the building grammar.
  // Nobody moved the bridges, so the world went on handing out the crafted material for free.
  // Measured on the default seed, the spine alone: 1902 planking (1336 deck + 566 rail) = 951
  // logs = ~127 goldwoods, breakable BY HAND with no tool. Alex's ruling is that you build with
  // what you MADE, not what you dug; a bridge you can strip for two hundred trees' worth of wall
  // is that ruling with a hole in it.
  //
  // ★ THE PRECEDENT IS `MAT.PATH`, ONE BAND DOWN, AND IT ALREADY SETTLED THIS: the road drops
  // subsoil "because the road is a CONDITION of the ground, not a block you carry home and lay
  // somewhere else." A bridge is the road where it crosses water. Same rule, same reason — so
  // this is not a second id meaning one thing (the objection that kept the bridges on PLANKS in
  // the first place). PLANKING is what you MADE; DECK is worn infrastructure that happens to be
  // timber, exactly as PATH is worn ground that happens to be soil.
  //
  // ⚠ 54 BREAKS THIS BAND'S STATED RULE AND THE RULE IS THE THING THAT WAS WRONG. The 51-53 note
  // says everything up here is "placed rather than generated" — true of 50-53, and never a
  // contract (nothing range-tests it). This is GENERATED, and it still belongs at 54: the
  // generated band 0-13 is full, and 14-15/23/31 are all rejected for the documented ORE-adjacency
  // reason that once turned a wildflower into a mana seam. So 50+ is the OVERFLOW band, not the
  // hand-placed band. Read it that way from here on.
  DECK: 54,

  /**
   * ── ★ THE WAYMARK (2026-08-15) — a keeper's passage, planted ────────────────────────────────
   * `voxel/waymark.ts` owns what the network IS; this id is what lets one stand in the world.
   * Never generated, only ever placed.
   *
   * ⚠ VOCABULARY IS CANON HERE, not a naming preference. `game/shimmer-geography.md` grants the
   * build **waymark · passage · fold · threshold** and reserves **gate** for crossings out of the
   * WAKING WORLD (that is the Rune Hold gate-rune, a different feature Greg gives). It also bans
   * "a bought rune". Do not rename this to anything in that reserved set.
   */
  WAYMARK: 55,
  /**
   * ── ★ THE CLOUD-WALL (2026-08-15) — the plot's boundary, and PACKED_CLOUD's sibling ──────────
   * Canon draws the distinction explicitly and it is why this is a second material rather than a
   * reuse: the cloud-ocean is pressed **SOFT and glowing** where it rings a plot
   * (`spirit-tales-bible.md`: *"walls of soft, pale, faintly glowing cloud, piled like heaped
   * wool"*) and pressed **HARD** where you stand on it (`MAT.PACKED_CLOUD`, id 1). Same stuff, two
   * pressures, two reads.
   *
   * Registered here for the world lane's `plot.ts` / `bubble.ts`, both of which take their
   * materials as parameters so neither module has to reach into this file.
   */
  CLOUD_WALL: 56,
  /**
   * ── ★ THE CAULDRON (2026-08-18) — where a keeper BREWS ───────────────────────────────────────
   * The alchemy station. Never generated, only ever placed; `voxel3d/brew.ts` owns what brewing
   * decides and `engine/alchemy.ts` (already built, already canon-clean) owns what a potion IS.
   *
   * ⚠ VOCABULARY IS CANON, not a naming preference — same as WAYMARK above. `game/alchemy.md` says
   * brewing happens in a **cauldron** (*"contribute ingredients to shared cauldron"*), so this is
   * canon's own word for the vessel rather than an invented "alchemy bench". A brewing HALL is
   * canon too, and it is a settlement building, not a block: this is the keeper's own single
   * vessel, which canon neither describes nor forbids.
   *
   * ⚠ FIRED CLAY, NOT IRON, AND THAT IS A CANON CONSTRAINT ON THE LOOK. `design-briefs/
   * shimmer-alchemy-vessels.md` locks the substance law for everything alchemy touches: *"No
   * metal... hand-blown glass, fired clay, cork, wax, cord and cloth. Metal belongs to the collar
   * and the Mint."* A black iron pot on three legs is the default mental image of a cauldron and it
   * is the one look this block may NOT have. Painted as a clay basin on a stone hearth
   * (`tex/tiles.ts`), which is a placeholder standing INSIDE the law — Alex's call on the final read.
   */
  CAULDRON: 57,

  /**
   * ── ★★ THE FOUR ELEMENT HERBS — RULED 2026-08-18 (/magii, on the hub lane's gap) ─────────────
   * Canon: `game/alchemy.md` › *The four element herbs grow WILD* and `game/shimmer-geography.md`
   * › *★ WHERE THE FOUR ELEMENT HERBS GROW*. They are the last link between the front door and an
   * evolved spirit — the crystals and the sap were already in this world; only these were missing.
   *
   * ⚠ ONE MATERIAL EACH, NOT ONE `HERB` WITH A VARIANT. A variant is derived from position and
   * would re-derive fine, but the DROP is read off the registry by material — one id could only
   * ever drop one herb. Four ids is also what lets each carry its own name and look.
   *
   * ⚠ 58-61 IS THE `isHerb` RANGE. Contiguous, and the range test above is why.
   */
  VIOLETBLOOM: 58,
  STORMGRASS: 59,
  ROOTVINE: 60,
  TIDEPETAL: 61,

  /**
   * ── ★ THE GROUNDS (2026-08-19, the character layer) ────────────────────────────────────────
   * Until today this world had ONE ground. Every biome, every altitude, every valley and plain
   * wore `TOPSOIL`, and the terrain's considerable variety in SHAPE was dressed in a single green
   * — which is precisely what "it feels samey" was reporting. These are the rest of the grounds;
   * `character.ts` decides which one a column wears, and it decides by a blended roll rather than
   * by a biome id, for the reason written at the top of that file.
   *
   * ⚠ THEY ALL DROP `block_topsoil` (mud and scree excepted) AND NONE IS PLACEABLE, deliberately.
   * A ground is a thing the world grows, not a thing you pocket: nine placeable turfs would put
   * nine near-identical greens in the build palette and make the biome layer read as a colour
   * swatch. Dig one up and you get soil, exactly as digging grass has always given soil here.
   *
   * ⚠ ADD ANY NEW GROUND TO `TURF` BELOW IF IT GROWS THINGS. A ground missing from that set is
   * silently barren — no trees, no saplings, no ground cover you can pick — with nothing in the
   * code looking wrong. That is the failure mode this set exists to make impossible to reach by
   * accident, and it is the same shape as the sprite pipeline's "painted but never wired".
   */
  FOREST_LOAM: 62,
  LUSH_TURF: 63,
  MARSH_MUD: 64,
  DRY_GRASS: 65,
  HIGHLAND_TURF: 66,
  SCREE: 67,

  // ── ★ SCATTER (2026-08-19, slice ③) — a THIRD plant range, for the same reason as the second ──
  // What a land SHEDS: a loose stone, a fallen branch, a mushroom. They are ground cover in every
  // way the mesher, the walker and the light field care about — non-solid, non-opaque, breakable
  // by hand — so they must answer `isPlant`. They could not join 24-26 or 58-61 because both are
  // full and **a material id is written into every save**, so renumbering to make room would
  // silently repaint every stored edit in the world.
  //
  // ⚠ KEEP 68-70 CONTIGUOUS, exactly as the notes on 24-26, 42-45 and 58-61 say. A fourth scatter
  // kind inserted anywhere else stops being a plant — solid, opaque, unbreakable — with nothing in
  // the code looking wrong.
  //
  // ⚠ A ROCK IS NOT `RUBBLE` AND NOT `SCREE`, AND THE THREE ARE DELIBERATELY SEPARATE. Scree is a
  // GROUND (a surface you stand on), rubble is the CRAFTING stock quarried stone yields, and this
  // is a loose stone lying on top of a ground. It drops rubble, so it feeds the existing stone
  // economy rather than opening a second one — the same reasoning the two stone rows already state.
  LOOSE_ROCK: 68,
  DEADFALL: 69,
  MUSHROOM: 70,
  // ── ★ THE GARDEN BED (2026-08-22, Alex) — the only ground a keeper MAKES ────────────────────
  // Crafted and placed, never generated, and that last part is load-bearing twice over: it is what
  // lets `garden.ts` count beds off the edit log instead of a stored tally, and it is what keeps
  // canon's extent rule intact — a bed decides what existing ground DOES, it never adds ground.
  // ★ ONE PER PLANK WOOD (2026-08-22, Alex): *"can we make that planks a universal input where any
  // of the tree planks could be used... it would be cool if the garden beds were mergable and the
  // planks used decides the color of the border."*
  //
  // ⚠ THREE, NOT FOUR — starwillow is tier-3 forestry and yields BRANCHES, not planks ("the branch
  // is the structural piece here"). A fourth id here would be a bed nobody can ever craft, which is
  // the shape of bug this whole day has been about.
  //
  // ★ WHY THREE MATERIALS RATHER THAN ONE BED THAT REMEMBERS ITS WOOD: the wood is VISIBLE in the
  // result, so it is a choice the keeper makes, not a material detail. A material per wood means the
  // colour, the future merge and the drop all fall out of machinery that already exists — the
  // mesher, the atlas and `materialForItem` — instead of needing a parallel per-block species
  // record that every one of them would have to learn to read.
  //
  // ⚠ GOLDWOOD KEEPS 71, the id the generic bed already had. Nothing has ever been placed (the bed
  // was uncraftable until the craft surface was fixed the same day) so no save needs migrating, but
  // reusing the id costs nothing and keeps the edit-log version where it is.
  GARDEN_BED_GOLDWOOD: 71,
  GARDEN_BED_SHIMMEROAK: 72,
  GARDEN_BED_DAWNWOOD: 73,
} as const

/**
 * Ground that GROWS — the one definition of "a plant can stand here", read by the tree planter,
 * the sapling rule, ground-cover picking and the plant-in-hand refusal message.
 *
 * ★ IT IS AN ALLOWLIST, and which grounds are absent is character rather than oversight: marsh mud
 * and crag scree grow nothing, which is how a marsh reads as a marsh and a crag reads as bare. The
 * denylist shape (everything except mud) is what would quietly plant a forest on the next ground
 * anyone adds.
 */
export const TURF: ReadonlySet<number> = new Set<number>([
  MAT.TOPSOIL, MAT.FOREST_LOAM, MAT.LUSH_TURF, MAT.DRY_GRASS, MAT.HIGHLAND_TURF,
])

/**
 * The land-character table, bound to this file's materials once. `character.ts` cannot import `MAT`
 * (it would close a cycle — see `GroundMaterials`), so the binding happens here, at the one place
 * that owns both halves.
 *
 * ⚠ EXPORTED, AND THERE MUST ONLY EVER BE THIS ONE. `trees.ts` and `flora.ts` read it too (slice
 * ②) — a second `landCharacter(...)` call elsewhere would compile, run, and hold a second opinion
 * about what grows where, which is the three-copies-of-a-truth failure the sprite frame maps
 * taught us. Every consumer imports this binding.
 */
export const LAND_DRESS = landCharacter({
  topsoil: MAT.TOPSOIL, loam: MAT.FOREST_LOAM, lush: MAT.LUSH_TURF, mud: MAT.MARSH_MUD,
  dry: MAT.DRY_GRASS, highland: MAT.HIGHLAND_TURF, scree: MAT.SCREE,
  subsoil: MAT.SUBSOIL, stone: MAT.STONE,
})

export interface DepthConfig {
  /** Basins below this fill with water. Kept BELOW the datum so most of the world is dry land. */
  seaLevel: number
  /** Voxels of soil under the surface block, before stone. Varies by noise. */
  soilDepth: number
  soilVariance: number
  /** Below this altitude, stone becomes deep stone — the tier-3/4 host rock. */
  deepStoneLevel: number
  /** The packed-cloud floor: solid at y=0, ragged up to this. */
  cloudFloorTop: number
  /** Surfaces steeper than this (voxels of rise per voxel across) show bare rock, not soil. */
  cliffSlope: number
  /** Sand reaches this far above sea level — the beach band. */
  beachHeight: number
}

export const DEFAULT_DEPTH: DepthConfig = {
  // ★ Sea level sits 20 below the datum, not on it. On it, HALF the world would be underwater by
  // definition (the datum is the median ground height). 140/160 → 100/120 with the vertical
  // rebalance (Alex ruled the split 2026-08-08) — same 20-gap, so the wet share is unchanged.
  seaLevel: 100,
  soilDepth: 4,
  soilVariance: 2,
  deepStoneLevel: 56,   // keeps its 64-under-datum offset through the rebalance
  cloudFloorTop: 4,
  cliffSlope: 2.2,
  beachHeight: 2,
}

/**
 * Local steepness at a column, in voxels of rise per voxel across.
 *
 * ★ This reads neighbouring COLUMNS, which is safe, and the distinction matters: it evaluates the
 * pure `columnHeight` function at nearby coordinates. It does NOT read a neighbouring chunk's
 * stored state. That is exactly the line research steal #2 draws — a stage may never synchronously
 * generate a missing neighbour, but calling a pure O(1) function at any coordinate is free and
 * order-independent.
 */
export function slopeAt(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT): number {
  const h = columnHeight(x, z, seed, cfg)
  const dx = Math.abs(columnHeight(x + 1, z, seed, cfg) - h)
  const dz = Math.abs(columnHeight(x, z + 1, seed, cfg) - h)
  const bx = Math.abs(h - columnHeight(x - 1, z, seed, cfg))
  const bz = Math.abs(h - columnHeight(x, z - 1, seed, cfg))
  return Math.max(dx, dz, bx, bz)
}

/**
 * The ordered predicate list. First match wins; the order IS the rule, so it is written to be read
 * top to bottom rather than optimised into a lookup.
 *
 * `h` (the column's surface altitude) is passed in rather than recomputed, because a chunk builder
 * already has it for the whole column and recomputing it per voxel would be 256 redundant noise
 * evaluations per column — the difference between a fast generator and a slow one.
 */
export function materialAt(
  x: number, y: number, z: number, seed: number, h: number,
  cfg: DepthConfig = DEFAULT_DEPTH, hcfg: HeightConfig = DEFAULT_HEIGHT,
): number {
  // 1. An unbreakable floor: the cloud-ocean pressed hard enough to stand on, where the Settle
  //    bottoms out (see MAT.PACKED_CLOUD). Ragged rather than flat, so it reads as a real edge of
  //    the world rather than as a rendering plane — Minecraft's own trick, one noise sample.
  //    ⚠ THE RAGGEDNESS EARNS MORE HERE THAN IT DID AS BEDROCK. Pressed cloud banked in uneven
  //    drifts is what the material IS; a flat white plane at the bottom of a cave would read as a
  //    missing chunk, which is the one failure this line has always existed to prevent.
  if (y <= 0) return MAT.PACKED_CLOUD
  if (y < cfg.cloudFloorTop && value2(x * 0.7, z * 0.7, seed ^ 0xbed0) > y / cfg.cloudFloorTop) return MAT.PACKED_CLOUD

  // 2. Above the surface: water if we are in a basin — or in a river channel, filled to the WATER
  //    TABLE (height.ts: the land generates around the water, so the bed hangs ≤RIVER_DEPTH under
  //    the table and the fill is flat and contained by construction). Guarded: only the voxels
  //    just above a surface run the cheap band read; sky stays on the fast path.
  if (y > h) {
    // ── the hold blockouts (2026-08-08) — walls, keep, gate lanterns, above the flattened pad.
    // Gated on a cheap bbox; the pad level is memoised per seed in height.ts. Everything the
    // holds raise is ordinary voxels: mineable, edit-diffed, lit by the same light field.
    {
      const hi = holdIndexAt(x, z)
      if (hi >= 0) {
        const m = holdVoxelAt(x, y, z, hi, holdPadLevel(hi, seed, hcfg), MAT.STONE, MAT.MANA_LANTERN)
        if (m !== 0) return m
      }
    }
    // ── the story road BRIDGES water (2026-08-08, Alex: "the fords are fine… lets do the
    // bridges anyway") ── Wherever the road corridor runs over a submerged bed, a plank deck
    // lies at table+1 — which is EXACTLY where the approach band parks the banks, so deck and
    // bank meet flush by construction, no ramp logic. Stone piers drop to the bed on a sparse
    // lattice; plank rails stand on the deck's sides only (an end cell's along-road neighbour
    // is road, so the edge test can never wall the roadway). Gated behind the same cheap band
    // read as the water fill — sky never pays for bridges.
    if (y - h <= RIVER_DEPTH + 4 && roadAt(x, z, seed)) {
      const carve = riverCarve(x, z, seed, hcfg)
      if (carve >= 1) {
        const table = Math.floor(waterSurfaceAt(x, z, seed, hcfg))
        if (h <= table) {
          // ⚠ MAT.DECK, never MAT.PLANKS (2026-08-15). These two lines used to emit the crafted
          // building material and made the whole wood economy free to anyone who walked the road
          // — see the DECK note in the MAT table for the measurement and the PATH precedent.
          if (y === table + 1) return MAT.DECK
          if (y <= table && ((x % 4) + 4) % 4 === 0 && ((z % 4) + 4) % 4 === 0) return MAT.STONE
          if (y === table + 2 &&
              (!roadAt(x + 1, z, seed) || !roadAt(x - 1, z, seed) ||
               !roadAt(x, z + 1, seed) || !roadAt(x, z - 1, seed))) return MAT.DECK
        }
      }
    }
    if (y <= cfg.seaLevel) return MAT.WATER
    if (y - h <= RIVER_DEPTH + 1) {
      const carve = riverCarve(x, z, seed, hcfg)
      if (carve >= 1 && y <= waterSurfaceAt(x, z, seed, hcfg)) return MAT.WATER
    }
    // Hot-spring pools fill to one below their own rim (height.ts's pools block): h is the carved
    // bed, h + depth the rim, so the fill is y ≤ h + depth − 1. Gated to the two voxels above a
    // surface, exactly like the river fill — sky never pays for pools.
    if (y - h <= POOL_DEEP - 1) {
      const pd = poolDepthAt(x, z, seed, hcfg)
      if (pd >= 1 && y <= h + pd - 1) return MAT.WATER
    }
    return MAT.AIR
  }

  const depth = h - y

  // 3. The surface voxel itself — the only place where slope and water change the answer.
  if (depth === 0) {
    if (h <= cfg.seaLevel) return MAT.SAND                              // lake / sea bed
    if (h <= cfg.seaLevel + cfg.beachHeight) return MAT.SAND            // beach band
    if (riverCarve(x, z, seed, hcfg) >= 1) return MAT.SAND              // river bed and its shoulders
    if (holdCourtyardAt(x, z)) return MAT.PATH                          // hold courtyards are worn bare
    if (roadAt(x, z, seed)) return MAT.PATH                             // the story road wears through
    // Spring crust BEFORE the cliff rule: a pool's rim column sees a 2–3 voxel drop to its own bed,
    // which the slope test would misread as a cliff face — the shell must win over bare stone.
    if (springsPoolAt(x, z, seed, hcfg) >= 1) return MAT.SPRING_CRUST   // pool beds + mineral aprons
    if (slopeAt(x, z, seed, hcfg) >= cfg.cliffSlope) return MAT.STONE   // cliff faces show rock
    if (greySurfaceAt(x, z, seed)) return MAT.GREY_SOIL                 // drained ground wears grey
    // ── ★ EVERYTHING ABOVE OUTRANKS LAND CHARACTER, AND THE ORDER IS THE ARGUMENT ──────────────
    // A river bed, a road, a courtyard, a spring's crust, a cliff face and the greying are all
    // statements about this exact column that a REGION cannot overrule: the road is where people
    // walked, the grey is where the mana left. Land character is what the ground wears when nothing
    // more specific has happened to it, which is most of the world. See character.ts.
    return surfaceBlockAt(x, z, seed, LAND_DRESS, DEFAULT_BIOME, hcfg)
  }

  // 4. Soil under the surface, thinning on slopes so a cliff does not wear a soil stripe.
  //    The variance is noise, not randomness — same coordinate, same depth, forever.
  const soil = cfg.soilDepth + Math.round((fbm2(x * 0.08, z * 0.08, seed ^ 0x501, 2) - 0.5) * 2 * cfg.soilVariance)
  if (depth <= Math.max(1, soil)) {
    if (h <= cfg.seaLevel + cfg.beachHeight) return MAT.SAND
    // The crust has THICKNESS: the shell under a pool bed and apron runs a few voxels deep, so the
    // short interior walls of a basin read as deposit, not as a soil stripe with a stone cliff.
    if (depth <= 3 && springsPoolAt(x, z, seed, hcfg) >= 1) return MAT.SPRING_CRUST
    return slopeAt(x, z, seed, hcfg) >= cfg.cliffSlope ? MAT.STONE : MAT.SUBSOIL
  }

  // 5. Host rock. The deep/shallow split is what steals #11's `targets` rule-test keys on later:
  //    ONE ore feature places its stone-host or deep-host variant depending on what it replaced.
  return y < cfg.deepStoneLevel ? MAT.DEEP_STONE : MAT.STONE
}

/**
 * Fill one column segment. This is the shape a chunk builder actually wants: surface altitude
 * computed once, then a straight run down the column with no per-voxel height recomputation.
 * Writes into a caller-owned array — allocation-free, per port rule 3.
 */
export function fillColumn(
  out: Uint16Array, offset: number, stride: number,
  x: number, z: number, yFrom: number, yTo: number, seed: number,
  cfg: DepthConfig = DEFAULT_DEPTH, hcfg: HeightConfig = DEFAULT_HEIGHT,
): void {
  const h = columnHeight(x, z, seed, hcfg)
  for (let y = yFrom, i = offset; y < yTo; y++, i += stride) {
    out[i] = materialAt(x, y, z, seed, h, cfg, hcfg)
  }
}

/**
 * ★ THE ONE DEFINITION OF "SOLID", AND IT IS HERE SO EVERYTHING CAN ASK IT (moved 2026-08-20).
 * It used to live in `voxel3d/VoxelWorld.tsx`, which meant the keeper's own collision rule was
 * unreachable from any pure test — so tests asked `=== AIR` instead, which is a STRICTLY different
 * question and wrong in a direction that matters: it calls a flower an obstruction. That cost real
 * time on the wilds cave, where the door's landing was reported blocked on two seeds by a tuft.
 * Anything that needs to know whether a body fits should call this, never re-derive it.
 */

// Ground cover is walked THROUGH, blocks no light, and stops no fence arm — it is scenery you can
// also pick up, not geometry. Everything downstream of `isSolid` (collision, the light field's
// opacity, piece connection) inherits that from this one line.
// ⚠ SAPLINGS JOIN GROUND COVER HERE (2026-08-13). A seedling drawn as a small cross must not be a
// full solid cell you bump into and cannot see — that is the invisible-wall failure one size down.
// It also stops a sapling blocking light, which matters more than it sounds: `blockedBy` refuses to
// grow a tree without open sky, and a sapling that shadowed ITSELF would never come up.
export const SOLID_EXCEPT = new Set<number>([
  AIR, MAT.WATER, MAT.TUFT, MAT.TALL_GRASS, MAT.FLOWER,
  MAT.SAPLING_GOLDWOOD, MAT.SAPLING_SHIMMEROAK, MAT.SAPLING_STARWILLOW, MAT.SAPLING_DAWNWOOD,
  // ⚠ THE HERBS JOIN GROUND COVER HERE (2026-08-18), and forgetting this line is a specific bug
  // rather than a rough edge: a plant you can see through but walk into is the invisible-wall
  // failure, and on a SHORE — where Tidepetal grows — it would be a chest-high fence along the
  // waterline. This Set is a membership test, not a range, so `isPlant` gaining a second span does
  // not reach it; the four ids have to be written out.
  MAT.VIOLETBLOOM, MAT.STORMGRASS, MAT.ROOTVINE, MAT.TIDEPETAL,
  // ⚠ AND SCATTER JOINS THEM (2026-08-19, slice ③) — third span, same specific bug. A loose rock
  // you can see through and walk INTO is the invisible wall, and unlike the herbs these turn up on
  // open country a keeper crosses constantly. The comment above is now load-bearing for a third
  // time: this Set is membership, not a range, so `isPlant` gaining a span does not reach it.
  MAT.LOOSE_ROCK, MAT.DEADFALL, MAT.MUSHROOM,
])
// A slab is SOLID — it just occupies half the cell. Collision asks `solidProbe`, which reports
// CELL_HALF for it; everything else (light, fence arms, piece placement) wants "yes, solid".
export const isSolid = (m: number) => !SOLID_EXCEPT.has(baseOf(m))
