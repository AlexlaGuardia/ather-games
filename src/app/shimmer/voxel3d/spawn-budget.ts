// How much of a frame the Hollow spawn sweep is allowed to take.
//
// ── ★★★ WHY THIS EXISTS: A BACKGROUND SYSTEM OWNED 137ms OF A 163ms FRAME ──────────────────────
// Measured on Alex's UHD 630 in the wilds at night, 2026-08-23, with `worstZones` + `worstGpuMs`:
//
//     worst frame — 163.0 ms      gpu on THIS frame  10.9 ms  ·  7%
//       137.50 ms   84%  world:spawn
//
// The GPU was doing an ordinary frame's work while the main thread spent an eighth of a second
// inside the spawn sweep. Two sessions had hunted this in render submit and buffer upload; it was
// never there.
//
// ⚠⚠ AND IT HAD BEEN "EXONERATED" BY A BENCH THAT MEASURED THE WRONG SUBJECT. An offline run timed
// `columnHeight` alone — 10.3µs per column, 5.37ms across 520 — and concluded the sweep was 2.2% of
// a stall. The real sweep costs roughly **500µs per column**, ~50x that, because `columnHeight` is
// ONE line inside a loop that also splits strings, allocates a key, consults a light field, rolls
// dice twice, tests eligibility, and constructs a mesh with a scene-graph insert per spawn.
// **Benching a component and concluding about the loop.** The measurement was accurate and answered
// a question nobody had asked.
//
// ── ★★ THE BOUND IS ON THE SWEEP, NOT ON THE SUSPECT — and that is the point ────────────────────
// We do not yet know WHICH line inside the sweep is slowest; the sub-zones shipped alongside this
// will say. This bound is deliberately robust to that answer being a surprise: **a background
// spawner has no business owning a frame regardless of what is inside it.** Fixing the symptom is
// correct here precisely because the symptom — an unbounded loop in a frame callback — IS the
// defect. A per-line optimisation would leave the next expensive line free to do this again.
//
// ⚠ `lightBudget = 2` in the sweep already bounds the ONE call anybody suspected. It is proof the
// author knew the loop needed bounding and bounded the part they could name. Everything else in the
// body was unbounded, and the cost turned out to be mostly elsewhere.

/**
 * Columns examined per sweep. The sweep already starts at a RANDOM offset into the loaded set, so
 * capping the walk samples a different window each cycle rather than starving one corner — coverage
 * is statistical over a few seconds instead of exhaustive in one frame.
 *
 * ⚠ THIS CHANGES SPAWN RATE, NOT SPAWN CAP. `hollowCap` still bounds how many Hollows exist; this
 * only slows how fast the night fills toward it. Reaching a full night over a few seconds rather
 * than in one hitch is closer to "they well up out of the ground" than the stall ever was.
 */
export const SPAWN_SCAN_MAX = 32

/**
 * Wall-clock ceiling for the sweep's WALK, in ms.
 *
 * ── ⚠⚠⚠ THE OLD DOCSTRING HERE CLAIMED TO BOUND COST AND DID NOT, AND THAT IS WORSE THAN NO ─────
 * ── BOUND, BECAUSE THE NEXT READER TRUSTS IT AND STOPS LOOKING (corrected 2026-08-27) ───────────
 * It said: *"`SPAWN_SCAN_MAX` bounds the count; this bounds the COST, so a single pathological
 * column (an uncached light field at ~14ms) cannot blow the frame."* It **named the exact failure
 * it does not prevent.** `stopScan` is evaluated at the TOP of a loop iteration, before the body
 * runs, so it bounds how many iterations **START** — and nothing on a single thread can preempt a
 * synchronous call once begun. The true worst case was always `budget + the cost of one iteration`,
 * with the second term unbounded.
 *
 * ⚠ AND THE COUNTEREXAMPLE ARRIVED IN A PROFILE, NOT IN A TEST. From a capture Alex pasted (home
 * plot, 465 columns, 96 draws, 37fps, UHD 630): `world:spawn/light` was **44% of the mean frame and
 * 118.60ms of a 123.4ms worst frame — 96% — while the GPU sat at 8% on that same frame.** A
 * background spawner owned the frame again, through a "budget" that reads as if it could not.
 *
 * ★★ SO THE FIX IS NOT A SMALLER NUMBER, IT IS A BOUND THAT EXISTS. Two changes, together:
 *   1. The one unbounded call in the body — computing a cold light field — is now **admitted
 *      explicitly** by `mayStartColdField`, at most `COLD_FIELDS_PER_SWEEP` per sweep, and only
 *      while the walk's clock still has room. It is no longer something the loop wanders into.
 *   2. That call was itself made ~8.7× cheaper (`VoxelWorld.tsx` › `lightFor`): the sky seed was
 *      asking generated terrain height **per cell** and now reads a 48×48 table computed once.
 *      Measured 113.16ms → 12.98ms, holding everything else identical, byte-identical output.
 *
 * The worst frame is therefore `sweepCeilingMs()` — a number this module can state and the oracle
 * can check — instead of a promise. **Say what is bounded and by how much, or say nothing.**
 */
export const SPAWN_BUDGET_MS = 3

/**
 * How many COLD light fields one sweep may compute. Was an inline `lightBudget = 2` in the host.
 *
 * ★ IT IS OUT HERE BECAUSE IT IS HALF OF THE CEILING, and a term of the ceiling that lives as a
 * literal in a 9,000-line component is a term nobody can check. Two of these were 118ms of the
 * measured frame; one tabulated field is ~13ms on a fast box.
 *
 * ⚠ A COLD COLUMN IS SKIPPED, NEVER GUESSED AT — the host's own rule, and the reason lowering this
 * is safe: no-spawn is the safe direction, the lantern's veto must never be bypassed by a cache
 * miss, and the cache fills over the next few sweeps regardless.
 */
export const COLD_FIELDS_PER_SWEEP = 1

/**
 * Measured ceiling for ONE cold light field, in ms — the term that used to be unbounded.
 *
 * ⚠ EMPIRICAL, AND DELIBERATELY GENEROUS. Measured 4.5–6.6ms for the flood alone and 13.0ms median
 * (23.6ms worst) through the host's own predicates on a server CPU; Alex's UHD 630 desktop is the
 * slower machine and is the one that has to hold. This is a BOUND to reason with, not a target to
 * hit — if a future field genuinely costs more, the ceiling below goes stale and the honest fix is
 * to re-measure it, not to widen it.
 */
export const COLD_FIELD_MS = 20

/**
 * The worst frame this sweep can produce, stated rather than promised.
 *
 * ── ★★ THE COUNT IS NOT A TERM, AND FINDING THAT OUT TIGHTENED THE BOUND (2026-08-27) ──────────
 * The first version of this was `SPAWN_BUDGET_MS + COLD_FIELDS_PER_SWEEP * COLD_FIELD_MS`, and a
 * mutation raising `COLD_FIELDS_PER_SWEEP` to 5 changed no behaviour at all — which is what sent me
 * back to the derivation. `mayStartColdField` refuses to START a field once the walk's clock is
 * spent, so **at most one field can ever be in flight past the budget**: every earlier one both
 * began and finished inside `SPAWN_BUDGET_MS`, or the next would have been refused. The count is
 * belt to the clock's braces and does not enter the arithmetic.
 *
 * ⚠ So the honest ceiling is tighter than the one I first wrote, and it stops moving when somebody
 * retunes the count. A ceiling that overstates by 4× is not a lie, but it is a claim nobody can act
 * on — and this file has already shipped one docstring that could not be acted on.
 */
export const sweepCeilingMs = (): number => SPAWN_BUDGET_MS + COLD_FIELD_MS

/**
 * May the sweep begin computing a cold light field right now?
 *
 * ★ THE POINT IS *BEGIN*. This is asked immediately before the only call in the body that costs
 * more than a rounding error, which is the one place a single-threaded loop can still decide
 * anything — after the call starts, nothing can. `stopScan` answers the clock half so there is ONE
 * definition of "the walk has run out of time", not a second copy that can drift from it.
 */
export function mayStartColdField(coldUsed: number, elapsedMs: number): boolean {
  return coldUsed < COLD_FIELDS_PER_SWEEP && !stopScan(0, elapsedMs)
}

/**
 * Should the sweep stop walking columns this frame?
 *
 * ★ A PREDICATE, NOT TWO INLINE COMPARISONS, so the rule can be asserted without a browser. The
 * loop it guards lives inside a React frame callback and cannot be unit-tested; this can.
 */
export function stopScan(examined: number, elapsedMs: number): boolean {
  return examined >= SPAWN_SCAN_MAX || elapsedMs >= SPAWN_BUDGET_MS
}
