// The rinning cast — canon's loop, in the Minecraft shape Alex asked for, minus its punishment.
//
// ★ PURE + TIME-BASED (pass timestamps). No DOM, no react, no world reads — the host drives it from
// a tick loop and owns every effect. Same discipline as the voxel core, for the same reason.
//
// ── ★★ WHY THIS FILE EXISTS AND `rinning.ts` IS SUPERSEDED ──────────────────────────────────────
// `engine/rinning.ts` (play3d's, still wired there) is a reaction test: the `!` pops, you strike
// inside ~1s, and a miss means the rinn "slips the line". Canon refuses that twice, with a reason:
//   `game/shimmer-skilling.md` › Skill 4  — *"Rinn are caught by simply waiting — there's no minigame."*
//   `game/shimmer-skilling.md` › Rinsticks — *"Rinsticks are built from rinn — kin calls to kin.
//      That is the canon reason rinning has no minigame and rewards patience: **you are asking a
//      rinn, not tricking one.**"*
// ★ THE CONTRADICTION IS THE LOSS, NOT THE BITE. Canon's own mechanic line is *"cast line → wait for
// bite → catch"*, which is Minecraft's loop beat for beat — so canon is not refusing an interaction,
// it is refusing a SKILL TEST. What makes the old version adversarial is that being slow costs you
// the fish: you were out-reflexed, which is tricking. Take the shape, drop the punishment.
//
// ── ★★ THE ONE IDEA WORTH STEALING: THE WAITING IS WATCHED, NOT EMPTY ───────────────────────────
// Minecraft's bubble trail moves toward the bobber before the dip, so a player waiting is LOOKING
// AT THE WATER rather than at a timer, and the tell is diegetic — a fish swimming at your bait, not
// a UI element. That is the whole craft of it. Our water is better suited to it than Minecraft's:
// canon rules the Ather's waters *"still, luminescent, and peaceful"*, and a luminous rise through
// still glowing water reads further and cleaner than bubbles in murk.
//
// ── ★ A MISSED ANSWER COSTS NOTHING, AND IT COSTS THE DESIGN NOTHING EITHER ─────────────────────
// Ignore the take and the rinn simply does not take. It circles and comes again. There is no
// `gotaway`. That is canon-safe by construction, it is the cozier feel, and the pressure was never
// where the fun was — canon puts the interest in the TABLE (*"the catch is random, weighted by level
// and location"*, four tiers up to crystal rinn) and the pacing in DEPLETION (3/5/8 catches, then a
// respawn), which is also why `rin-water.ts` lets you cast anywhere.

export type RinPhase =
  | 'waiting'  // line is out and the water is quiet — the long, idle-friendly stretch
  | 'rising'   // ★ the tell: something is coming. Visible, diegetic, and the reason to watch
  | 'taking'   // the float dips — answer now
  | 'held'     // answered in time; the host resolves the catch and ends the cast

/** The long quiet stretch. Canon calls rinning idle-friendly and patience-rewarding. */
export const WAIT_MIN_MS = 5_000
export const WAIT_MAX_MS = 20_000
/** ★ The tell's length. Long enough to notice, look up, and get ready — it is an announcement. */
export const RISE_MS = 2_200
/** The answer window. Generous on purpose: this is a cue to answer, not a reflex check. */
export const TAKE_MS = 1_600
/**
 * ★ AFTER AN UNANSWERED TAKE THE NEXT RISE COMES SOONER — the rinn is already interested. This
 * rewards staying without punishing leaving, which is the exact shape canon's "no minigame" asks
 * for: presence is worth something, absence costs nothing.
 */
export const REKINDLE = 0.35
/** Lively water (rin-water.ts) runs shorter waits. A place that looks alive IS more alive. */
export const LIVELY_WAIT = 0.7

export interface RinCast {
  startMs: number
  /** When the current rise begins, measured from `startMs`. */
  riseAt: number
  /** How many takes have gone unanswered. Never a penalty — only shortens the next wait. */
  passes: number
  lively: boolean
}

const waitSpan = (rng: () => number) => WAIT_MIN_MS + rng() * (WAIT_MAX_MS - WAIT_MIN_MS)

/** A fresh cast. `lively` comes from `rinSpotAt().lively`. */
export function newCast(startMs: number, rng: () => number, lively = false): RinCast {
  const base = waitSpan(rng) * (lively ? LIVELY_WAIT : 1)
  return { startMs, riseAt: base, passes: 0, lively }
}

export function phaseAt(c: RinCast, nowMs: number): RinPhase {
  const t = nowMs - c.startMs
  if (t < c.riseAt) return 'waiting'
  if (t < c.riseAt + RISE_MS) return 'rising'
  if (t < c.riseAt + RISE_MS + TAKE_MS) return 'taking'
  return 'waiting'   // ★ unanswered → back to waiting. There is no losing state.
}

/**
 * 0..1 through the rise, for the host's rise-mark: the ripple starts far out and closes on the
 * float. 0 outside the rise. This is the ONLY thing the player needs to read, and it is the reason
 * the wait is watched rather than endured.
 */
export function riseProgress(c: RinCast, nowMs: number): number {
  const t = nowMs - c.startMs - c.riseAt
  if (t < 0 || t >= RISE_MS) return 0
  return t / RISE_MS
}

/**
 * Advance a cast whose take went unanswered. The host calls this when `phaseAt` returns to
 * 'waiting' after a 'taking'. Pure — returns the next cast rather than mutating.
 *
 * ★ `passes` only ever shortens the next wait; nothing reads it as a penalty, and the test holds
 * that. A "miss counter" is one refactor away from becoming a miss PUNISHMENT.
 */
export function passed(c: RinCast, nowMs: number, rng: () => number): RinCast {
  const base = waitSpan(rng) * (c.lively ? LIVELY_WAIT : 1)
  return {
    startMs: nowMs,
    riseAt: base * REKINDLE,
    passes: c.passes + 1,
    lively: c.lively,
  }
}

/** The player answers. True only during the take — but a false costs NOTHING; the cast continues. */
export function answer(c: RinCast, nowMs: number): boolean {
  return phaseAt(c, nowMs) === 'taking'
}
