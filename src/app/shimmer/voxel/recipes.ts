// The recipe table — turning what you mined into what you use.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// ★ SHAPED AS DATA, NOT CODE, exactly like `registry.ts`. Every field is a plain value, so this
// table lifts into `data/recipes/*.json` unchanged the day the loader exists, and Rust reads the
// identical file. Behaviour must never creep in here.
//
// ── ★ WHY THIS EXISTS: THE TILE WORLD NEVER HAD A LOG ────────────────────────────────────────
// `world/resources.ts` is a table of *nodes* — you walked up to a goldwood node, channelled mana,
// and finished planks appeared in your satchel. There was no tree and no timber, because a node is
// a prop on terrain rather than terrain itself. The voxel world inverted that: terrain IS the
// resource, so there is now a goldwood LOG standing in the ground, and the step from log to plank
// is a thing the player should do.
//
// `registry.ts` originally had log blocks dropping `goldwood_plank` directly, inherited verbatim
// from the node table. That short-circuit is what this file removes.
//
// ── ★ AND IT WAS ALREADY A LIVE BUG, NOT A TIDY-UP ───────────────────────────────────────────
// The forestry tool ladder was DEAD in the voxel world and nothing said so. `goldwood_blade` costs
// `goldwood_bark`, `shimmeroak_blade` costs `amber_sap`, `starwillow_blade` costs `starwillow_sap`
// — and every one of those was a *secondary node drop* (`resources.ts` rolled them at 0.3–0.4
// chance). Log blocks drop no such thing, so all three blades were uncraftable, which meant the
// forestry tier never rose above the basic Worn Blade, which meant `STARWILLOW_LOG` (minTier 2) and
// `DAWNWOOD_LOG` (minTier 3) could never be cut at all. **The generator was placing two tree
// species the player was permanently unable to harvest.** Refining is what puts those materials
// back in reach — from the log, where they belong.
//
// `recipes.test.ts` closes the class with a REACHABILITY assert: every recipe and tool input must
// trace back to a block drop. That is the test that would have caught this on the day it appeared.
//
// ── BOUNDARY ─────────────────────────────────────────────────────────────────────────────────
// Yields, station gating and tiers are Jin's (build). Material NAMES are Magii's (canon) — every id
// below is already ruled in `resources.ts`, and `log` is generic English exactly like the `plank`
// and `sap` that already ship. Nothing here invents an Athernyx word, so no canon gap is owed.

/**
 * Where you have to be to make a thing. `hand` = anywhere, no station.
 *
 * ⚠ THIS FIELD IS THE GATE, AND IT IS NOT THE SAME QUESTION AS "WHICH STATION WILL RUN THIS
 * UNATTENDED". Every refine is and must stay `'hand'` (the invariant this file's header defends);
 * what a bench or a sawmill will *work on while you are away* is `voxel/workshop.ts`'s business,
 * derived there. Reusing this field for that would silently gate refining behind furniture the
 * first time someone added a station-only recipe, which is the exact thing that was refused.
 */
export type Station = 'hand' | 'crafting_table' | 'sawmill' | 'stonecutter'

/**
 * The body of work a refine belongs to. Absent = general, and general means BENCH ONLY.
 *
 * ★ ON THE ROW RATHER THAN SNIFFED FROM THE INPUTS (2026-08-15, and this replaces a derivation).
 * `workshop.ts` used to decide a sawmill's list by testing `itemId.endsWith('_log')` and a cutter's
 * by `itemId === 'rubble'`, on the reasoning that a derived rule needs no maintenance when a fifth
 * tree species arrives. That held exactly as long as a speciality had ONE raw input. Masonry now
 * runs on rubble, cut stone, spring crust and sand — four ids with nothing in common but the fact
 * that a mason works them — and no string test can spot that without becoming the hand-kept list
 * it was avoiding, written in the wrong file.
 *
 * ⚠ ABSENT IS THE FAIL-CLOSED DIRECTION AND THAT IS THE WHOLE REASON IT IS OPTIONAL. A writer who
 * has never heard of this field lands in "bench only, no bonus" — annoying and instantly visible.
 * The opposite default would silently enrol a new recipe in a speciality and pay it a bonus nobody
 * decided on. Never give this a default value.
 *
 * ⚠ AND THE OLD DERIVATIONS SURVIVE AS ORACLES, NOT AS MECHANISM: `workshop.test.ts` asserts that
 * every recipe consuming a `_log` is tagged `wood` and every one consuming `rubble` is tagged
 * `stone`. A forgotten tag on the cases we CAN derive still fails loudly; the cases we cannot are
 * the reason the field exists.
 */
export type Family = 'wood' | 'stone'

export interface RecipeDef {
  id: string
  name: string
  /** Consumed. Every id must be reachable from a block drop — enforced in recipes.test.ts. */
  input: { itemId: string; count: number }[]
  /** Produced. One stack out per recipe; a recipe wanting two outputs is two recipes. */
  output: { itemId: string; count: number }
  /**
   * ★ WHAT THIS RUN PAYS AT A STATION THAT IS BUILT FOR IT (`voxel/workshop.ts`). Absent = the same
   * as `output.count`, i.e. no bonus anywhere.
   *
   * ⚠ DECLARING IT DOES NOT MEAN EVERY STATION PAYS IT — that is `StationDef.pays`, and the split
   * arrived with the stonecutter (2026-08-15). A bonus is a property of the STATION × RECIPE pair
   * and always was; the sawmill only got away with reading this field alone because the bench
   * happened to deserve the same bonus on wood that the mill does. Stone is where that breaks: the
   * cutter dresses rubble better than a carpenter's bench does, and if this field alone decided it
   * the BENCH would quietly get the cutter's yield and the cutter would have no reason to exist.
   *
   * It exists because the obvious design for a working station does not survive contact: hand
   * crafting is instant, free and unlimited, so "the bench does it slowly while you're away" is
   * worth *nothing* — every run it performs is one you could have clicked faster. A station needs a
   * reason to exist that a click cannot beat, and the honest one is the fiction: a bench splits a
   * log cleanly, a blade across your thigh wastes half the wood.
   *
   * ⚠ THIS IS NOT A GATE AND MUST NEVER BECOME ONE. Every recipe stays hand-makeable anywhere —
   * `recipes.test.ts` asserts it and the header above says why. What a station sells is efficiency,
   * never access. A player refining in the field is making a fair trade (I need it now, my bag is
   * full), and the craft panel prints both numbers so it is a decision rather than a trap.
   *
   * ⚠ ONLY ON TAKING RAW MATERIAL APART. Extraction is what a purpose-built station does better.
   * Assembly is not — `planking` is two planks nailed together and a bench does not conjure a
   * third, so it stays bonus-free and the oracle guards that.
   *
   * ★ `cut_stone` NOW DECLARES ONE, AND THAT IS A REVISION, NOT AN EROSION — read this before
   * touching it. This comment used to exclude stone outright, on the grounds that its 2:1 loss is
   * the dial that makes a quarry a real trip and *"a mill quietly erasing it would overturn that
   * ruling as a side effect of a different feature."* The operative words were **quietly** and
   * **side effect**: the stonecutter is the deliberate pass that clause was holding the door open
   * for, and it does not erase the loss — 4 rubble buys 2 cut stone by hand and 3 at the cutter,
   * so stone still runs at a net loss everywhere and wood still runs at a net gain. Stone's
   * identity survives; it just stops being brutal once you have built the thing that dresses it.
   * `workshop.test.ts` asserts the loss survives at EVERY station rather than asserting this field
   * is absent, which is the stronger form of the same defence.
   */
  milled?: number
  /** Which specialist station cares about this row, if any. See `Family` — omit for general work. */
  family?: Family
  station: Station
  /**
   * ★ MANA IS CHARGED ONLY WHERE MANA IS ACTUALLY CHANNELLED.
   *
   * The tile world put a mana cost on everything because *gathering* was the mana verb — you stood
   * at a node and channelled. Mining is the verb now, and it costs durability and time instead. A
   * toll on "split a log into planks" would be friction with no fiction under it, charged against
   * the loop the player is in constantly. Recipes that genuinely seat mana (crystal work, the
   * stations that hold a connection open) keep it; carpentry does not.
   */
  mana: number
}

/**
 * ── REFINING ──────────────────────────────────────────────────────────────────────────────────
 * One log, two ways to take it apart. That fork is deliberate: planks and bark/sap both feed the
 * same blade, so the ladder costs real logs rather than one lucky roll, and the player decides
 * which half of the tree they need today. The tile world made that decision with a 0.3 dice roll.
 *
 * Yields are set so a tier-1 blade (5 plank + 3 bark) costs 2 goldwood logs of planks and 2 of
 * bark — four trees' worth of trunk for your first real axe. Cheap enough to reach in one session,
 * expensive enough that the basic tool has a job.
 */
export const RECIPES: RecipeDef[] = [
  // Goldwood — the day-one tree. Tier-1 forestry.
  { id: 'goldwood_planks', name: 'Goldwood Planks', milled: 6, family: 'wood', station: 'hand', mana: 0,
    input: [{ itemId: 'goldwood_log', count: 1 }], output: { itemId: 'goldwood_plank', count: 4 } },
  { id: 'goldwood_bark', name: 'Strip Goldwood Bark', milled: 3, family: 'wood', station: 'hand', mana: 0,
    input: [{ itemId: 'goldwood_log', count: 1 }], output: { itemId: 'goldwood_bark', count: 2 } },

  // Shimmeroak — tier-2 forestry. Sap is tapped from the log, not rolled off a node.
  { id: 'shimmeroak_planks', name: 'Shimmeroak Planks', milled: 6, family: 'wood', station: 'hand', mana: 0,
    input: [{ itemId: 'shimmeroak_log', count: 1 }], output: { itemId: 'shimmeroak_plank', count: 4 } },
  { id: 'amber_sap', name: 'Tap Amber Sap', milled: 3, family: 'wood', station: 'hand', mana: 0,
    input: [{ itemId: 'shimmeroak_log', count: 1 }], output: { itemId: 'amber_sap', count: 2 } },

  // Starwillow — tier-3 forestry. The branch is the structural piece here, not a plank.
  { id: 'starwillow_branches', name: 'Starwillow Branches', milled: 6, family: 'wood', station: 'hand', mana: 0,
    input: [{ itemId: 'starwillow_log', count: 1 }], output: { itemId: 'starwillow_branch', count: 4 } },
  { id: 'starwillow_sap', name: 'Tap Starwillow Sap', milled: 3, family: 'wood', station: 'hand', mana: 0,
    input: [{ itemId: 'starwillow_log', count: 1 }], output: { itemId: 'starwillow_sap', count: 2 } },

  // Dawnwood — the deep-forest tree. No tool tier claims it yet; it is building timber.
  { id: 'dawnwood_planks', name: 'Dawnwood Planks', milled: 6, family: 'wood', station: 'hand', mana: 0,
    input: [{ itemId: 'dawnwood_log', count: 1 }], output: { itemId: 'dawnwood_plank', count: 4 } },

  // ── ★ STONE: RUBBLE → CUT STONE (2026-08-13) ────────────────────────────────────────────────
  // The stone half of Alex's building grammar. Mining gives rubble; rubble is CUT into the block
  // you actually build with. This step is the whole point of the ruling — without it, "stone drops
  // rubble" is a rename and you are still placing back what you dug.
  //
  // ⚠ 2:1 ON PURPOSE, and it is the dial to turn if a wall feels expensive. A 1:1 refine has no
  // weight — it is a keystroke between digging and placing, and the player learns to resent it.
  // Losing half means a quarry is a real trip, which is what makes a stone building read as
  // something you went and got rather than something you swept up.
  //
  // ⚠ I WROTE THIS AT THE TABLE FIRST AND THE ORACLE REFUSED IT, correctly. `recipes.test.ts`
  // asserts every refine step is hand-makeable — *"mining is the gate, not furniture"* — and my
  // reason for the station was flavour (dressing stone feels like bench work) plus a wish to give
  // the crafting table a second job. Neither outranks a stated invariant, and the invariant's
  // reason applies here exactly as it does to splitting a log: a player who has quarried a bag of
  // rubble should not have to walk home before it is worth anything. If stations are ever to mean
  // something, that is a deliberate pass over the whole table, not a side effect of adding a rock.
  // No mana — cutting stone channels nothing. See the header on where mana is genuinely due.
  //
  // ⚠ RE-GRANULATED 4→2 ON 2026-08-15, AND THE RATIO IS UNCHANGED. It was 2 rubble → 1 cut stone;
  // it is now 4 → 2, which is the same 2:1 and the same hand experience in every way except that
  // the smallest batch is two blocks. The reason is arithmetic, not balance: the stonecutter's
  // bonus has to be expressible as a whole block, and there is no integer between 1 and 2. At the
  // old granularity the only bonus the data shape could express was 2 rubble → 2 stone, i.e. the
  // loss erased entirely — the one outcome the ruling above forbids. Written 4→2, the cutter pays
  // 3 and stone keeps a loss it can never dress away.
  { id: 'cut_stone', name: 'Cut Stone', milled: 3, family: 'stone', station: 'hand', mana: 0,
    input: [{ itemId: 'rubble', count: 4 }], output: { itemId: 'cut_stone', count: 2 } },

  // ── ★ THE MASONRY PALETTE (2026-08-15, Alex: "3 other stone types.. different colors and
  // textures to work with") ───────────────────────────────────────────────────────────────────
  // Three more building surfaces, and the important thing about all three is WHERE THE COLOUR
  // COMES FROM: nothing new is generated and no new rock is invented. The world already quarries
  // three differently-coloured mineral things, and two of them had NO CRAFTING USE AT ALL —
  // `block_spring_crust` (pale mint, the terrace shell, whose registry row has said since 08-08
  // that it is "exactly the block a builder would want to carry home") and `block_sand` (warm tan,
  // every beach in the world). They were dead ends you could dig and stack and nothing else.
  //
  // ⚠ SO THIS IS DELIBERATELY *NOT* NEW ROCK TYPES. A red stone that outcrops in the Outfields is a
  // statement about what that region is MADE OF, which is canon and Magii's — and it would want
  // worldgen, a GENERATOR_VERSION bump and a biome argument. Dressing rock the player can already
  // hold is entirely Jin's, ships today, and gives the same palette. If Alex wants genuinely new
  // strata later that is a canon gap, filed then, on purpose.
  //
  // ⚠ DEEP STONE IS THE OBVIOUS FOURTH COLOUR AND IT IS RULED OUT — do not "fix" this. It is a dark
  // violet-grey (0x494455) and would be the perfect dark family, but Alex ruled 08-13 that stone
  // and deep stone drop the SAME rubble ("two rubbles would be two economies for one material"),
  // and `recipes.test.ts` asserts it. A dark building stone needs either that ruling revisited or a
  // darkening step that does not exist yet. It is a question for Alex, not a gap to quietly fill.
  //
  // ★ EVERY ONE IS 3→2 BY HAND AND 3 AT THE CUTTER, i.e. 1:1 dressing once you own the station.
  // Chiselling a face by hand spoils one block in three; a heavy bed does not. That is the cutter's
  // whole pitch restated per recipe, and it never CREATES material — masonry may break even at
  // best, which `workshop.test.ts` asserts across the whole family. Wood multiplies, stone does
  // not; that asymmetry is the building grammar and these rows must not flatten it.
  //
  // Names are generic English (brick, sandstone, pale) describing worked versions of rock already
  // in the world — same call `plank`, `planking` and `cut stone` made. No Athernyx word is coined,
  // so no canon gap is owed.

  // Fine grey courses against cut stone's big ashlar blocks — the "somebody BUILT this" read that
  // a wall of dressed slabs does not give you. The one Alex actually asked for.
  { id: 'stone_brick', name: 'Stone Bricks', milled: 3, family: 'stone', station: 'hand', mana: 0,
    input: [{ itemId: 'cut_stone', count: 3 }], output: { itemId: 'stone_brick', count: 2 } },

  // Pale mint-white, from the hot springs' terrace shell. The colour is already in the world and
  // already quarryable; this is what makes a trip to the Springs worth a cart.
  { id: 'pale_brick', name: 'Pale Bricks', milled: 3, family: 'stone', station: 'hand', mana: 0,
    input: [{ itemId: 'block_spring_crust', count: 3 }], output: { itemId: 'pale_brick', count: 2 } },

  // Warm tan, from beach sand — and the texture is BANDED rather than coursed, because sedimentary
  // layers are what tells sandstone apart from masonry at a glance even before the hue lands.
  // ⚠ Sand is spade work, not prospecting, so this is the one masonry row whose raw material a
  // fresh keeper can dig bare-handed. That is on purpose: it is the cheap warm surface you can
  // build with on day one, against stone's tier-1 pick and the Springs' walk.
  { id: 'sandstone', name: 'Sandstone', milled: 3, family: 'stone', station: 'hand', mana: 0,
    input: [{ itemId: 'block_sand', count: 3 }], output: { itemId: 'sandstone', count: 2 } },

  // ── ★ WOOD: PLANKS → PLANKING (2026-08-13) ──────────────────────────────────────────────────
  // The wood half of the grammar, and the mirror of `cut_stone`. The plank is currency now — it
  // buys doors, windows, fences, beams — and this is what you spend it on when you want a floor or
  // a wall rather than a fitting.
  //
  // ⚠ CHEAPER THAN STONE ON PURPOSE, and the whole economy is in these two numbers. Stone runs
  // 2 mined -> 1 placed, a net LOSS, so a stone building is a quarry you went and did. Wood runs
  // 1 log -> 4 planks -> 2 planking, a net GAIN, so timber is what you throw up first. Renewable,
  // softer, and it should feel it. Turn these if building in wood ever feels harder than digging.
  { id: 'planking', name: 'Planking', family: 'wood', station: 'hand', mana: 0,
    input: [{ itemId: 'goldwood_plank', count: 2 }], output: { itemId: 'planking', count: 1 } },

  // ── THE STATION ITSELF ──────────────────────────────────────────────────────────────────────
  // Craftable by hand, and it must stay that way: a crafting table gated behind a crafting table is
  // the bootstrap that cannot start. Canon has Greg gift one in the starter bag
  // (`shimmer-quests-mainmap.md`), so this is the REPLACEMENT path, not the only one.
  { id: 'crafting_table', name: 'Crafting Table', station: 'hand', mana: 0,
    input: [{ itemId: 'goldwood_plank', count: 4 }], output: { itemId: 'crafting_table', count: 1 } },

  // ── ★ THE SAWMILL — the second station (2026-08-13) ─────────────────────────────────────────
  // Bench work, unlike the bench itself: the table is the bootstrap and must stay hand-makeable,
  // but by the time you want a mill you demonstrably own a table. Costs planking (so the building
  // material has a use that is not a wall) plus bark (a saw needs an edge, and bark is the tier-1
  // blade material the forestry ladder already runs on).
  //
  // ~5 goldwood logs all in. Expensive enough to be a decision, cheap enough to reach in the
  // session you first notice you are refining a lot of wood.
  { id: 'sawmill', name: 'Sawmill', station: 'crafting_table', mana: 0,
    input: [{ itemId: 'planking', count: 6 }, { itemId: 'goldwood_bark', count: 4 }],
    output: { itemId: 'sawmill', count: 1 } },

  // ── ★ THE STONECUTTER — the third station, and it pays in MATERIAL (2026-08-15) ─────────────
  // Bench work like the mill, and it costs the material it exists to save you: 24 rubble's worth
  // of cut stone for the bed, planking for the frame. That ordering is the point — you cannot buy
  // your way out of hand-cutting stone until you have hand-cut a real pile of it, so the station
  // is a reward for the trip rather than a way to skip it.
  //
  // Deliberately NOT costing a blade material (the mill takes bark for its edge). A cutter works
  // stone down by abrasion against a heavy bed; the mass IS the tool, which is also why it is the
  // slowest thing on the plot.
  { id: 'stonecutter', name: 'Stonecutter', station: 'crafting_table', mana: 0,
    input: [{ itemId: 'cut_stone', count: 6 }, { itemId: 'planking', count: 4 }],
    output: { itemId: 'stonecutter', count: 1 } },

  // ── LIGHT ───────────────────────────────────────────────────────────────────────────────────
  // One shard, four lanterns: night safety is meant to be a first-session purchase, not a grind —
  // the Hollows' pressure is "light your ground", and a mechanic you cannot afford is a mechanic
  // that does not exist. mana: 0 because the shard IS the mana; the crafting only frames it.
  { id: 'mana_lantern', name: 'Mana Lantern', station: 'hand', mana: 0,
    input: [{ itemId: 'raw_mana_shard', count: 1 }, { itemId: 'goldwood_plank', count: 2 }],
    output: { itemId: 'mana_lantern', count: 4 } },
  // ── GROWING ─────────────────────────────────────────────────────────────────────────────────
  // Canon has Greg GIFT the first pot, and the tutorial's starter-bag step is still parked — so
  // this recipe is the second pot and every pot after it, not a replacement for that moment.
  // Subsoil, because a pot is fired earth and subsoil is the only earth a keeper digs by the stack.
  { id: 'clay_pot', name: 'Clay Pot', station: 'hand', mana: 0,
    input: [{ itemId: 'block_subsoil', count: 3 }],
    output: { itemId: 'clay_pot', count: 1 } },

  // ── STORING ─────────────────────────────────────────────────────────────────────────────────
  // By HAND and cheap on purpose. A chest is what makes the 24-slot bag survivable, so gating it
  // behind the bench would mean the first hours of the game are spent throwing things away — the
  // same bootstrap argument as the bench itself. Eight planks (two logs' worth) against the
  // bench's four: a chest holds a bagful, and it should cost more than the table it stands next to.
  { id: 'chest', name: 'Chest', station: 'hand', mana: 0,
    input: [{ itemId: 'goldwood_plank', count: 8 }],
    output: { itemId: 'chest', count: 1 } },
]

const BY_ID = new Map(RECIPES.map(r => [r.id, r]))
export const recipeDef = (id: string): RecipeDef | undefined => BY_ID.get(id)

/** Every item id this table can PRODUCE. Used by the reachability test and the crafting UI. */
export const RECIPE_OUTPUTS: ReadonlySet<string> = new Set(RECIPES.map(r => r.output.itemId))

/**
 * Can this be made right now?
 *
 * `have` is a callback rather than an Inventory, on purpose: `Inventory` lives in `engine/`, and the
 * pure core must not reach across the boundary to read a host-side type. The caller counts; this
 * decides. Same inversion `pieces.ts` uses for its costs.
 */
export function canCraft(
  id: string,
  have: (itemId: string) => number,
  station: Station = 'hand',
  mana = Infinity,
): boolean {
  const def = BY_ID.get(id)
  if (!def) return false
  if (def.station !== 'hand' && def.station !== station) return false
  if (mana < def.mana) return false
  return def.input.every(i => have(i.itemId) >= i.count)
}

/**
 * What a craft would consume and produce — a plan, not a mutation.
 *
 * The core never edits an inventory (it cannot see one). It returns the deltas and the host applies
 * them, which is what keeps this file portable and what makes the whole table testable without an
 * inventory implementation existing at all.
 */
export function craftPlan(id: string): { take: { itemId: string; count: number }[]; give: { itemId: string; count: number } } | null {
  const def = BY_ID.get(id)
  if (!def) return null
  return { take: def.input.map(i => ({ ...i })), give: { ...def.output } }
}

/** Every recipe currently makeable, in table order. The UI renders this; it does not filter itself. */
export function availableRecipes(
  have: (itemId: string) => number,
  station: Station = 'hand',
  mana = Infinity,
): RecipeDef[] {
  return RECIPES.filter(r => canCraft(r.id, have, station, mana))
}
