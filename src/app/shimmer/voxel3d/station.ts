// THE WORKSTATION PATTERN — a placed block that gates a class of recipes, and says why it refuses.
//
// ★ PURE. No react/three/DOM, same rule as `brew.ts`. A station knows nothing about panels; it
// answers the one question a placed block has to answer: *given this keeper, this bag, this world —
// what does pressing the verb do, and if nothing, what sentence does the panel say?*
//
// ── ★★ THIS IS `brew.ts` GENERALISED, AND THE REFUSAL ORDER IS THE PART WORTH GENERALISING ─────
// The cauldron shipped 2026-08-18 with a blocker rather than a boolean, and its header argues the
// ORDER at length. That argument is not about alchemy at all — every one of its steps is about what
// a keeper should DO about a refusal, so it belongs to any station:
//   · `absent` — an input this world does not contain. Nothing to do; say so.
//   · `level`  — the skill gate. Nothing to do but make what you can.
//   · `inputs` — you can get these; you do not have them yet.
//   · `room`   — the output has nowhere to go. Empty a slot.
//   · `power`  — you have everything; wait for the pool to refill.
//
// ★★ `absent` OUTRANKS `level`, AND THAT IS THE LESSON THE CAULDRON PAID FOR. A refusal that will
// STILL BE TRUE after you fix it must be said first. Checking level first told a keeper at alchemy 7
// *"reach alchemy 10"* for an Infusion whose herb does not grow in this world at all — they would
// have ground five hundred XP toward a promise the world cannot keep. `level` is the honest answer
// only when reaching that level is actually enough.
//
// ── ⚠⚠ AND ONE THING DOES NOT GENERALISE, WHICH IS WHY THIS FILE EXISTS RATHER THAN A RENAME ────
// The cauldron checks mana LAST, and its reason is specific: *"it is the only refusal that fixes
// itself — the pool refills on its own clock while you stand there."* Checked first, a keeper three
// shards short would be told "not enough mana", wait, press again, and get a DIFFERENT answer.
//
// **That argument holds only for a REPLENISHING cost.** A station whose cost is CONSUMED — fuel in a
// furnace, say — has the opposite property: it does not refill, and telling a keeper to wait for it
// is a lie that never resolves. A consumed cost is simply another input and must be checked WITH the
// inputs. So a station declares which kind it has, and the ladder places it accordingly. Letting a
// future station inherit `replenishing` by default would hand it an ordering argument that is false
// about it, silently, in the one branch nobody re-reads.
//
// ⚠ `consumed` HAS NO REAL USER TODAY — the cauldron is the only station in the world, and the
// furnace that would want it is parked on a canon gap (`CANON_GAPS.md`, 2026-08-29: canon names
// fired clay and hand-blown glass but has no kiln, forge or furnace anywhere, and *furnace* is the
// one word the "metal in the Ather is evidence" engine may forbid). It is implemented anyway,
// because the alternative is an ordering rule that is stated in prose and enforced by nothing — and
// it is TESTED against a synthetic station, the same way the doors pass guarded the 3-wide openable
// and the double gate nobody has added.

/** What a station needs to know about one thing it can make. Deliberately smaller than any one
 *  system's recipe type, so a station never has to care whose recipe it is holding. */
export interface StationRecipe {
  id: string
  /** Everything consumed, including a consumed COST (fuel) if the station has one. */
  inputs: readonly { itemId: string; count: number }[]
  /** The item id the output lands in the bag as, and how many. */
  outputId: string
  outputCount: number
  /** The skill gate, in the station's own skill. */
  minLevel: number
  /** The replenishing cost, if this station has one. Zero when it does not. */
  power: number
}

/**
 * How a station's cost behaves, which decides WHERE in the ladder it is checked. See the header —
 * this is the one axis that does not generalise, and naming it is what stops it being inherited.
 */
export type CostKind = 'replenishing' | 'consumed' | 'none'

export interface StationDef<R = unknown> {
  id: string
  /** The placed block a keeper uses. One material, one station — asserted in `station.test.ts`. */
  material: number
  /** Canon's word for the vessel. ⚠ Never invent one; a station with no canon name is a canon gap. */
  name: string
  /** What the button says. */
  verb: string
  /** `replenishing` puts the cost LAST; `consumed` folds it in with the inputs. */
  cost: CostKind
  /** Canon's own list for this station at this skill level, in canon's order — NOT filtered by what
   *  the keeper can currently make. The cauldron's header argues this: filtering would quietly
   *  delete the Infusions from the game's most important shelf. The ROW carries the bad news. */
  menu: (level: number) => readonly R[]
  /** Adapt one of that system's recipes into the shape the ladder reads. */
  toRecipe: (r: R) => StationRecipe
}

/** Why the verb is not going to work, or `'ok'`. Ordered by what the keeper should do about it. */
export type StationBlock = 'ok' | 'absent' | 'level' | 'inputs' | 'room' | 'power'

/**
 * @param have    how many of an item is in the keeper's satchel
 * @param inWorld can this item be obtained in THIS world at all — DERIVED host-side, never a list
 * @param room    how many more of an item the bag could take right now
 * @param power   the replenishing pool's current value (ignored when `cost` is not replenishing)
 *
 * ★★ `room` IS CHECKED BEFORE ANYTHING IS SPENT, and that is why it is a refusal rather than a
 * detail: a run takes the inputs out of the bag and puts the output back, so if it does not fit, the
 * run has destroyed the inputs and produced nothing — and a full bag is exactly the state a keeper is
 * most likely to be standing in when they reach a station.
 */
export function stationBlocker<R>(
  st: StationDef<R>,
  raw: R,
  level: number,
  power: number,
  have: (itemId: string) => number,
  inWorld: (itemId: string) => boolean,
  room: (itemId: string) => number,
): StationBlock {
  const r = st.toRecipe(raw)
  if (r.inputs.some(i => !inWorld(i.itemId))) return 'absent'
  if (level < r.minLevel) return 'level'
  if (r.inputs.some(i => have(i.itemId) < i.count)) return 'inputs'
  // A CONSUMED cost is an input that happens to be spelled as a number, so it is checked here with
  // the rest of them — never last. See the header: last is a position that promises "wait and this
  // resolves itself", which is false about fuel.
  if (st.cost === 'consumed' && power < r.power) return 'inputs'
  // ⚠ The output's bonus roll is NOT accounted for and must not be: a companion perk can add one
  // beyond `outputCount`, and demanding room for a roll that usually does not happen would refuse a
  // legal run most of the time. An overflow drops at the keeper's feet, as every payout here does.
  if (room(r.outputId) < r.outputCount) return 'room'
  if (st.cost === 'replenishing' && power < r.power) return 'power'
  return 'ok'
}

/**
 * The inputs this world does not produce, in recipe order.
 *
 * The panel NAMES them rather than printing "unavailable": *"these lands grow no violetbloom petal"*
 * is a fact a keeper can carry, and it also tells the next person reading a bug report which SYSTEM
 * is missing rather than which bottle looked broken.
 */
export function absentAt<R>(st: StationDef<R>, raw: R, inWorld: (itemId: string) => boolean): string[] {
  return st.toRecipe(raw).inputs.filter(i => !inWorld(i.itemId)).map(i => i.itemId)
}

// ⚠ THE REGISTRY IS DELIBERATELY NOT IN THIS FILE. `brew.ts` imports this module for the ladder, so
// a registry here that imported the cauldron back would be a cycle. `station-registry.ts` is the one
// place that knows both, and this file stays a pure contract nothing has to import in a loop.
