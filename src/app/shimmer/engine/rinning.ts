// ⚠⚠ SUPERSEDED BY `engine/rin-cast.ts` (2026-08-19) — DO NOT BUILD ON THIS FILE.
//
// This is a reaction test: the `!` pops, you strike inside ~1s, and a miss means the rinn "slips
// the line". **Canon refuses that, twice, with a stated in-world reason** —
//   `game/shimmer-skilling.md` › Skill 4:   *"Rinn are caught by simply waiting — there's no minigame."*
//   `game/shimmer-skilling.md` › Rinsticks: *"kin calls to kin. That is the canon reason rinning has
//      no minigame and rewards patience: **you are asking a rinn, not tricking one.**"*
// The contradiction is the LOSS, not the bite — canon's own line is "cast line → wait for bite →
// catch", so it refuses a SKILL TEST, not an interaction. `rin-cast.ts` keeps the loop and drops the
// punishment. Same family as the EvolutionOverlay free-pick deleted on 08-18: a mechanic built on a
// premise canon refuses. No drift gate catches this class — all 10 gates diff lore TABLES.
//
// ⚠ STILL WIRED INTO play3d (`play3d/Shimmer3D.tsx`) and left running deliberately: swapping a live
// surface's feel is its own change with its own playtest, not a footnote to writing the new module.
// Migrating play3d onto `rin-cast.ts` is tracked as an open row.
//
// Rinning cast-and-catch — the fishing-analog skill's own feel, distinct from the
// hold-to-channel of forestry/prospecting. Cast a line into a pool (which locks the
// walker to the node), wait, then a `!` pops over the mote's head: strike during it to
// hook, strike early or let it lapse and it slips. Pure + time-based (pass timestamps),
// so it's testable without the DOM; the walker drives it from a tick loop.

export type RinPhase =
  | 'wait' // line's out, no bite yet — striking here is too early
  | 'bite' // the `!` is up — hook it NOW
  | 'gotaway' // the window lapsed without a hook

export interface RinCast {
  startMs: number // when the line went out (the cast/lock-in)
  biteMs: number // delay from start until the bite (the `!`) begins
  windowMs: number // how long the `!` stays up to react
}

// a fresh cast: the bite lands 0.9–3.0s after casting, react within ~1s (classic, generous).
export function newCast(startMs: number, rng: () => number): RinCast {
  return { startMs, biteMs: 900 + rng() * 2100, windowMs: 1000 }
}

export function phaseAt(c: RinCast, nowMs: number): RinPhase {
  const t = nowMs - c.startMs
  if (t < c.biteMs) return 'wait'
  if (t < c.biteMs + c.windowMs) return 'bite'
  return 'gotaway'
}

// the player strikes at nowMs: caught only while the `!` is up; too early (wait) or too
// late (window lapsed) and it slips the line.
export function hook(c: RinCast, nowMs: number): boolean {
  return phaseAt(c, nowMs) === 'bite'
}
