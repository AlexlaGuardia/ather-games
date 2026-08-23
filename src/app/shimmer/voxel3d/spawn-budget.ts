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
 * Wall-clock ceiling for one sweep, in ms.
 *
 * ★ THE BACKSTOP THAT DOES NOT CARE WHY. `SPAWN_SCAN_MAX` bounds the count; this bounds the COST,
 * so a single pathological column (an uncached light field at ~14ms, a deep pack walk) cannot blow
 * the frame even while the count looks reasonable. Two limits because they fail differently: a
 * count is predictable and blind to cost, a clock is honest about cost and unpredictable in
 * coverage. Whichever trips first wins.
 */
export const SPAWN_BUDGET_MS = 3

/**
 * Should the sweep stop walking columns this frame?
 *
 * ★ A PREDICATE, NOT TWO INLINE COMPARISONS, so the rule can be asserted without a browser. The
 * loop it guards lives inside a React frame callback and cannot be unit-tested; this can.
 */
export function stopScan(examined: number, elapsedMs: number): boolean {
  return examined >= SPAWN_SCAN_MAX || elapsedMs >= SPAWN_BUDGET_MS
}
