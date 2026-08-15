// The workshop — a station that keeps working while you don't.
//
// ★ PURE CORE. No react/three/DOM, and nothing from outside this folder but the recipe table. The
// host owns the voxels, the clock and the bag; this file owns what a standing job IS.
//
// ── ★ WHY THIS EXISTS: A STATION THAT ONLY GATES IS A TAX ─────────────────────────────────────
// `recipes.ts` refuses to gate refining behind furniture, and it is right to: *"mining is the gate,
// not furniture"* — a player who has quarried a bag of rubble should not walk home before it is
// worth anything. `recipes.test.ts` asserts it. That left the crafting table with one job (tools)
// and a note saying stations would need a deliberate pass to mean anything.
//
// This is that pass, and it inverts what a station is FOR. A station is bad as a gate on the player
// and good as *a place work happens without him*. Hand-refining stays instant, free and available
// everywhere, forever. The table additionally holds a JOB: leave it a stack of logs and it turns
// them over on its own clock while you are three hundred blocks away cutting more.
//
// ── ★ THE HARD PROBLEM, STATED PLAINLY, BECAUSE THE FIRST DESIGN FAILED IT ────────────────────
// Hand-crafting is INSTANT, FREE and UNLIMITED. So "the station does it slowly while you're away"
// is worth exactly NOTHING — every run it performs is a run you could have done faster by clicking.
// A station whose only product is elapsed time is furniture with a progress bar, and the player
// works that out in one session.
//
// So a milled run PAYS MORE than the same run done on your knee (`RecipeDef.milled`). That is the
// whole reason to build one, it is honest fiction — a bench splits a log cleanly, a blade across
// your thigh wastes half the wood — and it costs the invariant nothing, because every recipe is
// still hand-makeable anywhere. Access was never the thing being traded; efficiency is.
//
// ⚠ AND THE TRADE MUST BE SHOWN, or it is a trap rather than a decision. The craft panel prints
// both numbers ("4× by hand · 6× milled"), so refining in the field is a choice a player makes
// knowing what it costs — I need it now, or my bag is full. An unshown penalty is how a player
// finds out later that everything they did was wrong.
//
// ── ★ NOTHING IS SIMULATED ────────────────────────────────────────────────────────────────────
// Progress is DERIVED from wall-clock, exactly like the pot's bloom, the burrow patrols and the
// spawn board. No tick, no worker, no catch-up loop: a closed tab costs nothing and a station you
// have never walked to is already correct when you arrive.
//
// ── ★ WHERE A JOB LIVES (host side, stated here because this is where you'll look) ────────────
// In the COLUMN's save record, beside chest contents — NOT in a global sidecar like the pot clock.
// A job holds GOODS: its input is already out of your bag and its finished output is sitting inside
// the station. Block and contents must arrive and leave in one transaction or a refresh landing
// between two loads destroys what was in there. That is `chest.ts`'s argument verbatim, and it
// applies here for the same reason: the pot stores a timestamp, this stores your logs.

import { RECIPES, recipeDef, type RecipeDef } from './recipes'
import { MAT } from './depth'

/**
 * How long one run takes at an unstaffed station, in ms.
 *
 * Scaled off the pot's reasoning (`BLOOM_MS` = 4 min): long enough to be a thing you come back to,
 * short enough that a session contains it. A full satchel stack of 20 logs runs ~4 minutes, which
 * is about one trip out to the treeline and back — the beat this is built around.
 *
 * ⚠ THIS IS THE NUMBER A WORKER MULTIPLIES. When a Moglin can be assigned to a station he does not
 * unlock a new verb, he turns this dial (and later, pulls his own input from a bound chest so the
 * queue never empties). Keep the unstaffed rate honest on its own terms — a station that is
 * pointless until it is staffed makes the staffing the feature and the building a chore.
 */
export const RUN_MS = 12_000

/** The kinds of station that exist. Matches the `MAT.*` blocks and the item ids that place them. */
export type StationId = 'crafting_table' | 'sawmill' | 'stonecutter'

/**
 * A body of work a station can be built around.
 *
 * ★ EACH ONE IS DERIVED FROM THE RECIPE'S OWN INPUTS, NEVER FROM A LIST OF RECIPE IDS (see
 * `inSpeciality`). A fifth tree species joins the sawmill the day it is added and nobody has to
 * remember a second table — the same reason `stationRecipes` filters on `station === 'hand'`
 * rather than naming rows.
 */
export type Speciality = 'logs' | 'stone'

export interface StationDef {
  id: StationId
  /** What the panel calls it. */
  name: string
  /** ms per run at this station, unstaffed. */
  runMs: number
  /** What it will WORK ON. `'any'` = every hand-refine in the table. */
  accepts: 'any' | Speciality
  /**
   * What it pays the recipe's `milled` bonus on, or `'none'`. Always a SUBSET of `accepts`
   * (asserted): a station works on everything it accepts and pays extra only on what it was BUILT
   * for.
   *
   * ★ THIS FIELD IS WHY THE STONECUTTER CAN EXIST AT ALL. Before it, the bonus lived only on the
   * recipe, so any station that accepted a row paid its bonus. That was invisible while the only
   * bonus was on wood and both wood stations deserved it — and it breaks the instant a speciality
   * has a station the generalist bench should NOT match. Give `cut_stone` a bonus under the old
   * model and the bench pays it too: the quarry dial is erased for free and the cutter is a slower
   * bench. The bonus is a property of the STATION × RECIPE pair; this is the station's half.
   *
   * ⚠ THE BENCH PAYS `'logs'`, WHICH IS NOT AN ODDITY — it is today's behaviour written down. The
   * bench is a carpenter's bench: a plank bed and a blade, so it splits a log cleanly and shatters
   * stone like anything else you improvise on. Changing it to `'none'` would be a real balance
   * change to a station that has not been playtested yet, not a tidy-up.
   */
  pays: Speciality | 'none'
}

/**
 * Raw quarried stone, as an item id.
 *
 * ★ SAFE AS A SINGLE ID RATHER THAN A LIST, BECAUSE THE REGISTRY RULED IT SO: every stone block in
 * the game — stone and deep stone alike — drops this same rubble, deliberately, so that there is
 * *"one broken-rock economy, not two"* (`registry.ts`, asserted in `recipes.test.ts`). "Takes
 * rubble" therefore cannot fragment the way "takes a log" would have across four tree species,
 * which is why that one is a suffix test and this one is an equality test.
 */
const RAW_STONE = 'rubble'

/** Is this recipe inside that body of work? The one place a speciality is decided. */
function inSpeciality(r: RecipeDef, s: Speciality): boolean {
  return s === 'logs'
    ? r.input.some(i => i.itemId.endsWith('_log'))
    : r.input.some(i => i.itemId === RAW_STONE)
}

/** Will this station take the job at all? */
export const worksOn = (def: StationDef, r: RecipeDef): boolean =>
  def.accepts === 'any' || inSpeciality(r, def.accepts)

/** Will it pay the recipe's `milled` bonus on that job? */
export const paysBonus = (def: StationDef, r: RecipeDef): boolean =>
  def.pays !== 'none' && inSpeciality(r, def.pays)

/**
 * Which stations pay this recipe's bonus, in table order. Empty = nowhere pays extra.
 *
 * For the hand-craft panel, which has no station of its own and still owes the player the honest
 * comparison: it prints the yield AND where to get it, so "refine here or carry it home" is a
 * decision made with both numbers rather than discovered afterwards.
 */
export function payingStations(r: RecipeDef): StationDef[] {
  return Object.values(STATIONS).filter(def => paysBonus(def, r) && milledYield(r, def) > r.output.count)
}

/**
 * ★ THE SAWMILL IS FASTER **AND NARROWER**, AND THE SECOND HALF IS WHAT MAKES IT A DESIGN RATHER
 * THAN AN UPGRADE.
 *
 * A station strictly better than the bench retires the bench, and then the game has one station
 * again with extra steps — the same failure as a station whose only product is elapsed time. So the
 * mill runs logs 2.4x faster and **refuses everything else**: stone, lanterns, pots and chests stay
 * bench work. Specialist against generalist, so a plot that does both wants both.
 *
 * ★★ AND THE THIRD STATION SELLS A DIFFERENT THING AGAIN — THAT IS THE WHOLE REASON IT EXISTS.
 *
 * The sawmill proved a station can be narrower. If the stonecutter were "the sawmill for stone" the
 * family would have exactly one dial (speed) and a third member would be a copy wearing a new
 * texture. Worse, it could not have been built at all: the only stone recipe is `cut_stone`, which
 * paid no bonus, so a faster-but-narrower cutter would have sold nothing except elapsed time — and
 * elapsed time is worth precisely zero against instant, free, unlimited hand-crafting. That is the
 * failure this file's header was written about, and stone is exactly where it lands.
 *
 * ⚠ THE REPO'S OWN NOTE POINTED STRAIGHT AT THE TRAP. `milledYield` said stone's reward for a
 * station is *"unattended bulk"* — which the header two screens up already proves is worth nothing.
 * Stone had no station-shaped reward at all, so the cutter had to be given one rather than handed
 * the mill's.
 *
 * So the cutter INVERTS the mill's axis: it is the slowest thing on the plot and it pays in
 * MATERIAL. 4 rubble buys 2 cut stone in the hand or at the bench, and 3 at the cutter.
 *
 * ★ ITS THROUGHPUT IS EXACTLY THE BENCH'S — 3 per 18s and 2 per 12s are the same stone per second,
 * chosen rather than stumbled into, and asserted. The cutter does not make stone arrive faster; it
 * makes rubble go further. So the panel offers a real choice with no dominant answer: a player
 * sitting on a rubble mountain uses the bench, a player who has to walk to the quarry uses the
 * cutter, and neither retires the other.
 *
 * Read across, the three answers to "why build me" are all different:
 *   bench       — generalist. Runs anything; the baseline both other axes are measured against.
 *   sawmill     — sells TIME.     2.4x faster, logs only, at the same yield the bench gives.
 *   stonecutter — sells MATERIAL. 1.5x the yield, stone only, and slower than the bench for it.
 *
 * ⚠ THE RATE IS NOT STORED ON THE JOB. It is read from here at the moment it is used, so tuning
 * these numbers retunes every station already standing in the world. A rate copied into the save
 * when the job was queued would leave old jobs running at whatever the balance was that day, and no
 * amount of later tuning would ever reach them.
 */
export const STATIONS: Record<StationId, StationDef> = {
  crafting_table: { id: 'crafting_table', name: 'The Bench',       runMs: RUN_MS, accepts: 'any',   pays: 'logs'  },
  sawmill:        { id: 'sawmill',        name: 'The Sawmill',     runMs: 5_000,  accepts: 'logs',  pays: 'logs'  },
  stonecutter:    { id: 'stonecutter',    name: 'The Stonecutter', runMs: 18_000, accepts: 'stone', pays: 'stone' },
}

/** Item ids that place a station. Used by `recipes.test.ts` to state the gate rule. */
export const STATION_ITEMS: ReadonlySet<string> = new Set(Object.keys(STATIONS))

/**
 * Block material → which station it is, or null for anything that is not one.
 *
 * ★ THE SINGLE DEFINITION, and everything that needs to know asks it: `interact.ts` (does a
 * right-click mean 'work'), the panel (which rate and which recipe list), the mining branch (does
 * breaking this owe a salvage) and `setVoxel` (does removing this drop a job record). Four places,
 * and every one of them would otherwise carry its own `=== MAT.CRAFT_TABLE || === MAT.SAWMILL`
 * that agrees today and forgets the third station on the day it is added — which is the failure
 * mode the frame maps already have in three places and warn about.
 */
export const STATION_MAT: Readonly<Record<number, StationId>> = {
  [MAT.CRAFT_TABLE]: 'crafting_table',
  [MAT.SAWMILL]: 'sawmill',
  [MAT.STONECUTTER]: 'stonecutter',
}

export const stationOf = (mat: number): StationId | null => STATION_MAT[mat] ?? null

/** A station's standing job. `runs` counts RECIPE RUNS, never items — see `queue`. */
export interface StationJob {
  recipeId: string
  /**
   * Runs still owed, finished-but-uncollected INCLUDED. The input for every one of these is
   * already out of the player's bag, so this number is a debt the station owes him.
   */
  runs: number
  /**
   * Epoch ms the CURRENT run started — not when the job was loaded.
   *
   * ★ Advanced by exactly `done × RUN_MS` on every collect, never set to `now`. See `collect`.
   */
  since: number
}

/** Station position → its job. Keyed `"x,y,z"` in world coords, same shape as `potKey`/`chestKey`. */
export type Workshop = Record<string, StationJob>

export const stationKey = (x: number, y: number, z: number): string => `${x},${y},${z}`

/**
 * The recipe row, or undefined for an id that no longer exists (a save from an older table).
 *
 * Re-exported rather than re-implemented: `recipes.ts` already keeps a `BY_ID` map, and a second
 * lookup here would be a linear scan that agrees with it today and disagrees the first time one of
 * them learns about aliases.
 */
export const recipeOf = recipeDef

/**
 * What ONE run of this recipe pays AT THIS STATION.
 *
 * Falls back to the hand yield whenever the row declares no bonus, or declares one this station is
 * not built to pay. Both fallbacks are deliberate and neither is a gap: a chest is assembly and
 * earns nothing anywhere, and `cut_stone` earns its bonus at the cutter and nowhere else.
 *
 * ⚠ THE STATION IS REQUIRED, NOT DEFAULTED, and this is the same lesson `runMs` learnt one commit
 * ago — with more teeth, because the wrong answer here is a payout rather than a rate. A default of
 * "any station" would hand the cutter's stone bonus to the bench, silently erasing the quarry dial
 * for players who never build a cutter; a default of "the bench" would silently withhold it from
 * the cutter. Every call site has a station in hand, so there is nothing to save by guessing.
 */
export function milledYield(r: RecipeDef, at: StationDef): number {
  return paysBonus(at, r) ? (r.milled ?? r.output.count) : r.output.count
}

/**
 * Runs finished and waiting, given the wall clock.
 *
 * ⚠ `runMs` IS REQUIRED, NOT DEFAULTED, AND THAT IS DELIBERATE. A default would silently hand the
 * bench's 12s to every call site that had not been updated — so the sawmill would run at bench
 * speed, correctly, quietly, and forever. This repo has already ruled that shape once: `eligibleMoves`
 * /`canSlot`/`defaultLoadout` were made to REQUIRE a Book for exactly this reason, because an
 * optional one defaults every un-updated caller back to the old wrong answer with nothing to see.
 *
 * ⚠ Clamped at BOTH ends. Below zero because a `since` in the future (a clock that stepped back, a
 * hand-edited save) would otherwise read as negative progress and underflow the collect maths;
 * above `runs` because a station left overnight must not manufacture a debt nobody paid input for.
 */
export function runsReady(job: StationJob, now: number, runMs: number): number {
  const elapsed = now - job.since
  if (elapsed < 0) return 0
  const done = Math.floor(elapsed / runMs)
  return done > job.runs ? job.runs : done
}

/** 0..1 toward the NEXT run finishing. For the HUD hint; never gates a payout. */
export function runProgress(job: StationJob, now: number, runMs: number): number {
  if (runsReady(job, now, runMs) >= job.runs) return 1   // job is done; nothing is in flight
  const elapsed = now - job.since
  if (elapsed < 0) return 0
  const t = (elapsed % runMs) / runMs
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/** Every run paid out and collected — the station is idle and can take a new job. */
export const isSpent = (job: StationJob): boolean => job.runs <= 0

/**
 * What loading `runs` of a recipe costs the player's bag.
 *
 * Returned rather than taken: this file cannot see an inventory, and the host must be free to check
 * affordability without committing. Multiplied here so a caller cannot get the arithmetic subtly
 * wrong in one of the two places it would otherwise live.
 */
export function jobCost(r: RecipeDef, runs: number): { itemId: string; count: number }[] {
  return r.input.map(i => ({ itemId: i.itemId, count: i.count * runs }))
}

/**
 * The most runs one station will hold.
 *
 * A satchel stack is 20 and a job is meant to be "everything I just cut", so 32 clears a full stack
 * with room over. It is a ceiling rather than a balance dial: without one, a console-fed bag could
 * queue ten thousand runs and the station would owe a payout no inventory can accept.
 */
export const MAX_RUNS = 32

/**
 * How many runs the bag can actually pay for, capped.
 *
 * ★ HERE RATHER THAN IN THE PANEL. The UI wants this number twice — to size the button and to spend
 * against it — and a second copy of the arithmetic is how a display starts promising a run the
 * spend path then refuses. Same inversion `canCraft` uses: the caller counts, this decides.
 */
export function maxRuns(r: RecipeDef, have: (itemId: string) => number): number {
  let n = MAX_RUNS
  for (const i of r.input) {
    const afford = Math.floor(have(i.itemId) / i.count)
    if (afford < n) n = afford
  }
  return n < 0 ? 0 : n
}

/**
 * Load a station. The caller has already taken `jobCost` out of the bag.
 *
 * ⚠ REFUSES to touch a station that still owes runs. Overwriting a live job would silently destroy
 * whatever input was still sitting in it, and the failure is invisible — the player sees a station
 * happily working on the new thing and never learns the old logs are gone. The host greys the
 * button; this refuses the write, because a UI grey is a display and not an enforcement.
 */
export function loadJob(
  shop: Workshop, key: string, recipeId: string, runs: number, now: number,
): Workshop {
  if (runs <= 0) return shop
  const live = shop[key]
  if (live && !isSpent(live)) return shop
  if (!recipeOf(recipeId)) return shop
  return { ...shop, [key]: { recipeId, runs, since: now } }
}

/**
 * Take what is finished. Returns the payout and the workshop with those runs cleared.
 *
 * ★★ `since` ADVANCES BY `done × RUN_MS`, IT IS NOT SET TO `now` — and that difference is a whole
 * class of bug. Resetting to `now` throws away the run currently in flight: a player who collects
 * at 11.9 seconds into the next log loses those 11.9 seconds, every single time, and the more
 * attentive he is the more he loses. Punishing the player for checking on his own workshop is
 * exactly backwards, and it would never show up as a failure — only as a station that feels
 * mysteriously slower than the number says.
 *
 * Collecting an unfinished job is legal and pays zero; the job is untouched, not reset.
 *
 * ★ TAKES THE WHOLE STATION, NOT A RATE. A payout needs both halves — how fast this block runs and
 * what it pays per run — and passing them separately is an invitation to hand it one station's
 * clock with another's yield, which would read as correct and be wrong by exactly one bonus. The
 * pure clock helpers (`runsReady`/`runProgress`) still take a bare `runMs`, because a clock has no
 * opinion about payment.
 */
export function collect(
  shop: Workshop, key: string, now: number, at: StationDef,
): { shop: Workshop; payout: { itemId: string; count: number } | null } {
  const job = shop[key]
  if (!job) return { shop, payout: null }
  const r = recipeOf(job.recipeId)
  if (!r) return { shop, payout: null }               // table changed under an old save; see `salvage`
  const runMs = at.runMs
  const done = runsReady(job, now, runMs)
  if (done <= 0) return { shop, payout: null }

  const left = job.runs - done
  const next: Workshop = { ...shop }
  if (left <= 0) delete next[key]                     // spent stations leave no record behind
  else next[key] = { ...job, runs: left, since: job.since + done * runMs }

  return { shop: next, payout: { itemId: r.output.itemId, count: done * milledYield(r, at) } }
}

/**
 * Everything the station owes, for when its block is destroyed.
 *
 * ★ FINISHED RUNS PAY MILLED, UNSTARTED RUNS REFUND THEIR INPUT. Breaking a station is not a
 * penalty and not a windfall: work already done is yours at the rate it was done at, and logs it
 * never got to is just your logs back. Paying milled output for runs that never happened would make
 * "load it and smash it" the fastest mill in the game; paying nothing would make a misclick with a
 * pickaxe cost a full stack.
 *
 * ⚠ The run IN FLIGHT is refunded as input, not part-paid. There is no half a plank, and rounding a
 * partial run to a whole one in either direction is a lie in one direction or the other.
 *
 * ⚠ AT THE BROKEN BLOCK'S OWN STATION, both for rate and for yield. Salvaging a cutter's job
 * against the bench would hand back the wrong number of finished runs AND pay them at the wrong
 * rate — two errors in the same direction, which is how "load a cutter, smash it with a bench
 * open" would become the best stone in the game.
 */
export function salvage(
  shop: Workshop, key: string, now: number, at: StationDef,
): { shop: Workshop; drops: { itemId: string; count: number }[] } {
  const job = shop[key]
  if (!job) return { shop, drops: [] }
  const next: Workshop = { ...shop }
  delete next[key]

  const r = recipeOf(job.recipeId)
  if (!r) return { shop: next, drops: [] }            // unknown recipe: nothing honest to hand back

  const done = runsReady(job, now, at.runMs)
  const drops: { itemId: string; count: number }[] = []
  if (done > 0) drops.push({ itemId: r.output.itemId, count: done * milledYield(r, at) })
  const unstarted = job.runs - done
  if (unstarted > 0) for (const c of jobCost(r, unstarted)) drops.push(c)
  return { shop: next, drops }
}

/**
 * Which recipes a station will take.
 *
 * Refining only, by construction rather than by a hand-kept list: a station runs what it can run
 * unattended, and a tool is not in this table at all (`engine/tools.ts` owns those, and a blade is
 * bench work you do yourself). Filtering on `station === 'hand'` also means a future table row that
 * genuinely requires the player present is excluded automatically instead of being forgotten.
 */
export function stationRecipes(at: StationId = 'crafting_table'): RecipeDef[] {
  const def = STATIONS[at]
  // `worksOn` asks the recipe's own inputs, never a list — see `Speciality`.
  return RECIPES.filter(r => r.station === 'hand' && r.input.length > 0 && worksOn(def, r))
}
