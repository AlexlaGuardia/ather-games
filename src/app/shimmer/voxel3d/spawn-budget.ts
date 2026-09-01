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
 *
 * ── ⚠⚠ SUPERSEDED 2026-09-01, AND KEPT BECAUSE THE WRONG READING IS THE USEFUL ARTIFACT ────────
 * Everything above this line is 08-27 history. `mayStartColdField` and `COLD_FIELDS_PER_SWEEP` no
 * longer exist. The paragraph above is right that a bound must exist and wrong about where it can
 * come from: it bounds the START of the field and then states a ceiling containing the field's own
 * COST, `COLD_FIELD_MS` — a constant measured on a server CPU for a frame that has to hold on a
 * UHD 630. Alex's next capture read **55.80ms of a 58.9ms frame** against that 23ms ceiling.
 *
 * ★★★ THE LESSON IS NARROWER THAN "SAY WHAT IS BOUNDED": a ceiling containing a term you cannot
 * CONTROL is a measurement, not a bound. `SPAWN_BUDGET_MS` was always a real bound because this
 * module decides it; `COLD_FIELD_MS` never was, because the machine decides it. The 09-01 fix
 * removes the term rather than re-measuring it — see `LIGHT_BUILD_MS` below.
 */
export const SPAWN_BUDGET_MS = 3

/**
 * How long the cold-light-field JOB may run per frame, in ms.
 *
 * ── ★★★ THE THIRD ROUND, AND THIS TIME THE UNIT CHANGED RATHER THAN THE NUMBER (2026-09-01) ────
 * `COLD_FIELDS_PER_SWEEP`, `COLD_FIELD_MS` and `mayStartColdField` lived here and are gone. They
 * bounded when a field could START and could never bound what it COST, because nothing on a single
 * thread preempts a synchronous call already running. The honest ceiling they could state was
 * `SPAWN_BUDGET_MS + COLD_FIELD_MS` = 23ms, and `COLD_FIELD_MS` was measured on a server CPU.
 *
 * ⚠ IT WENT STALE EXACTLY AS ITS OWN DOCSTRING PREDICTED. From Alex's capture on the UHD 630 (home
 * plot, 465 columns, view radius 12): `world:spawn/light` was **55.80ms of a 58.9ms frame — 95% —
 * GPU 5.3ms, heap flat.** One field, 2.4x the stated bound. That docstring said "if a future field
 * genuinely costs more, the ceiling goes stale and the honest fix is to re-measure it, not to widen
 * it." Re-measuring would have made the doc honest and the frame no better: **23ms and 55ms are
 * both hitches**, and with `SPAWN_CYCLE_S` at 0.4 either could recur ~2.5x a second all night.
 *
 * ★★ SO THE FIX IS NOT A TRUER CONSTANT, IT IS A SMALLER UNIT. The field is built by
 * `beginLight`/`stepLight` as a resumable job, advanced this many ms per frame and published only
 * when complete. The frame cost is now a slice size this file chooses, and **no per-machine
 * measurement has to be right for the frame to hold** — which is the property the last two rounds
 * were missing. A slower box takes more frames to finish a field; it does not drop one.
 *
 * ⚠ THE ONE THING THAT STILL SCALES WITH THE MACHINE is how many frames a field takes, and that is
 * the safe direction: a column stays SKIPPED while its job runs, and skipped means no-spawn.
 */
export const LIGHT_BUILD_MS = 2

/**
 * The worst frame this sweep can produce, stated rather than promised.
 *
 * ── ★★ IT IS NOW `SPAWN_BUDGET_MS` ALONE, AND THAT IS THE WHOLE POINT OF THE 09-01 CHANGE ──────
 * The sweep no longer computes anything expensive: a cold column is nominated and skipped, and the
 * field is built by the job. So there is no second term — nothing hides behind the walk's clock any
 * more. The frame's total light cost is `LIGHT_BUILD_MS`, billed to its own zone, and the two
 * numbers are independent because they happen in different places.
 *
 * ⚠ HISTORY, BECAUSE THE SHAPE REPEATS: the first version of this was
 * `SPAWN_BUDGET_MS + COLD_FIELDS_PER_SWEEP * COLD_FIELD_MS`, and a mutation raising the count to 5
 * changed no behaviour at all — the clock refused the second field regardless, so the count was
 * never a term. **A ceiling that overstates by 4x is not a lie, but it is a claim nobody can act
 * on.** Two rounds later the remaining term was the one measured on the wrong machine.
 */
export const sweepCeilingMs = (): number => SPAWN_BUDGET_MS



/**
 * Should the sweep stop walking columns this frame?
 *
 * ★ A PREDICATE, NOT TWO INLINE COMPARISONS, so the rule can be asserted without a browser. The
 * loop it guards lives inside a React frame callback and cannot be unit-tested; this can.
 */
export function stopScan(examined: number, elapsedMs: number): boolean {
  return examined >= SPAWN_SCAN_MAX || elapsedMs >= SPAWN_BUDGET_MS
}
