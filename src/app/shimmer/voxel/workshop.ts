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
export type StationId = 'crafting_table' | 'sawmill'

export interface StationDef {
  id: StationId
  /** What the panel calls it. */
  name: string
  /** ms per run at this station, unstaffed. */
  runMs: number
  /**
   * What it will work on. `'any'` = every hand-refine in the table; `'logs'` = only recipes that
   * consume a log.
   *
   * ★ DERIVED, NOT LISTED. `'logs'` asks the recipe's own inputs, so a fifth tree species joins the
   * sawmill the day it is added and nobody has to remember a second list — the same reason
   * `stationRecipes` filters on `station === 'hand'` rather than naming rows.
   */
  accepts: 'any' | 'logs'
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
 * ⚠ THE RATE IS NOT STORED ON THE JOB. It is read from here at the moment it is used, so tuning
 * these numbers retunes every station already standing in the world. A rate copied into the save
 * when the job was queued would leave old jobs running at whatever the balance was that day, and no
 * amount of later tuning would ever reach them.
 */
export const STATIONS: Record<StationId, StationDef> = {
  crafting_table: { id: 'crafting_table', name: 'The Bench',   runMs: RUN_MS, accepts: 'any' },
  sawmill:        { id: 'sawmill',        name: 'The Sawmill', runMs: 5_000,  accepts: 'logs' },
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
 * What ONE run of this recipe pays at a station.
 *
 * Falls back to the hand yield when a row declares no `milled` bonus, which is deliberate and not a
 * gap: `cut_stone` runs 2 rubble → 1 on purpose (`recipes.ts` — the loss is what makes a quarry a
 * real trip), and a mill that quietly erased it would overturn that ruling as a side effect of this
 * feature. Stone's reward for a station is unattended bulk; wood's is the cleaner split. Two
 * materials that feel different is the point, not an oversight.
 */
export function milledYield(r: RecipeDef): number {
  return r.milled ?? r.output.count
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
 */
export function collect(
  shop: Workshop, key: string, now: number, runMs: number,
): { shop: Workshop; payout: { itemId: string; count: number } | null } {
  const job = shop[key]
  if (!job) return { shop, payout: null }
  const r = recipeOf(job.recipeId)
  if (!r) return { shop, payout: null }               // table changed under an old save; see `salvage`
  const done = runsReady(job, now, runMs)
  if (done <= 0) return { shop, payout: null }

  const left = job.runs - done
  const next: Workshop = { ...shop }
  if (left <= 0) delete next[key]                     // spent stations leave no record behind
  else next[key] = { ...job, runs: left, since: job.since + done * runMs }

  return { shop: next, payout: { itemId: r.output.itemId, count: done * milledYield(r) } }
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
 */
export function salvage(
  shop: Workshop, key: string, now: number, runMs: number,
): { shop: Workshop; drops: { itemId: string; count: number }[] } {
  const job = shop[key]
  if (!job) return { shop, drops: [] }
  const next: Workshop = { ...shop }
  delete next[key]

  const r = recipeOf(job.recipeId)
  if (!r) return { shop: next, drops: [] }            // unknown recipe: nothing honest to hand back

  const done = runsReady(job, now, runMs)
  const drops: { itemId: string; count: number }[] = []
  if (done > 0) drops.push({ itemId: r.output.itemId, count: done * milledYield(r) })
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
  return RECIPES.filter(r => {
    if (r.station !== 'hand' || r.input.length === 0) return false
    // `'logs'` asks the recipe, never a list — see StationDef.accepts.
    return def.accepts === 'any' || r.input.some(i => i.itemId.endsWith('_log'))
  })
}
