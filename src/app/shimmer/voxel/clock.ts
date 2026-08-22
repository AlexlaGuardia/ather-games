// The world's clock, as arithmetic. Length of a day, where dawn falls in it, and how many mornings
// have broken between two moments.
//
// ★ PURE. No react/three/DOM, no browser globals, no world reads — the voxel core may not depend
// upward (VOXEL-WORLD-MODEL.md § 6 rule 4) and this file is why the rest of the clock can stay put.
//
// ── ★★ WHY THIS IS A SPLIT AND NOT A MOVE ──────────────────────────────────────────────────────
// `engine/day-cycle.ts` reads `window.location` for the `?hour=` time pin, so it cannot live in a
// portable core and should not: pinning the sky is a HOST concern, a thing you do to look at the
// light. What a sapling has lived through is not. The core keeps the arithmetic the world model
// needs; the host keeps the pin, the sky colour, and the HUD. `day-cycle.ts` imports these back and
// re-exports them, so every existing caller is untouched and there is still exactly ONE definition
// of each — see that file's own warning about two constants describing one thing coming apart.
//
// ⚠ THESE FUNCTIONS DELIBERATELY IGNORE THE TIME PIN, and that is the reason the split lands here
// rather than one function further along. `?hour=` and the console's `time` command move what the
// sky SHOWS, not what the world has lived through — pinning dawn to look at the light must not
// mature every sapling in the garden, and un-pinning must not un-grow them. Growth reads the wall
// clock; only the render reads the pin. A core that cannot see the pin cannot get that wrong.

/** One full day, in real milliseconds. */
export const CYCLE_MS = 64 * 60 * 1000

/** Game hours, as a fraction of the cycle. Progress 0 = 00:00. */
const H = (hour: number) => hour / 24

// ★ These are for the map editor ONLY — the PHASE NAMES are derived from the light curve itself
// (see `getPhase` in day-cycle.ts). The first cut declared them as independent constants and they
// immediately drifted: the HUD said DUSK at 19:00 while `daylight()` had already reached zero at
// 18:51, so the label and the sky disagreed by an hour. Two constants describing one thing will
// always come apart. The one that survives is the one the renderer actually uses.
export const DAWN_START = H(5)
export const DUSK_START = H(18)

/**
 * How many MORNINGS have broken between two moments.
 *
 * ── ★★ ALEX, 2026-08-22: *"what if every morning in-game we could have it grow.. so it takes three
 * days for it to reach ful grown and mineable"* ────────────────────────────────────────────────
 * Sapling growth was a flat elapsed-milliseconds check, so a goldwood came up two minutes after you
 * planted it and the whole ritual of planting a tree was a countdown you stood next to. Counting
 * DAWNS instead means a tree is something you come back to, and it costs nothing to persist because
 * the clock is already derived from wall time rather than ticked.
 *
 * ⚠ IT COUNTS BOUNDARIES CROSSED, NOT ELAPSED TIME, and those are genuinely different. Plant at
 * 04:00 and one morning breaks an in-game hour later; plant at 06:00 and the first is 23 hours off.
 * That asymmetry is the feature — a keeper planting at dusk is planting *for tomorrow*, which is
 * what makes it read as a morning at all rather than as a differently-shaped timer.
 */
export function morningsBetween(fromMs: number, toMs: number): number {
  if (!(toMs > fromMs)) return 0
  // Dawn lands this far into every cycle, so shifting by it puts a morning on each integer boundary.
  const dawnAt = CYCLE_MS * DAWN_START
  const morning = (t: number) => Math.floor((t - dawnAt) / CYCLE_MS)
  return Math.max(0, morning(toMs) - morning(fromMs))
}

/**
 * When the next morning breaks after `fromMs`, as epoch ms — so a HUD can say how long the wait is
 * rather than only that there is one.
 */
export function nextMorning(fromMs: number): number {
  const dawnAt = CYCLE_MS * DAWN_START
  return (Math.floor((fromMs - dawnAt) / CYCLE_MS) + 1) * CYCLE_MS + dawnAt
}
