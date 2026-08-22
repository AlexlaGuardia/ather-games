// What a cast actually lands — canon's ladder, weighted by the place and the wait.
//
// ★ PURE. No DOM, no react, no world reads. The host resolves a spot with `voxel/rin-water.ts`,
// runs the loop with `rin-cast.ts`, and asks this what came up. Three files, three questions:
// WHERE you can cast · WHAT the line is doing · WHAT you caught.
//
// ── ★ CANON RULES ALL OF THIS AND THERE WAS NOTHING TO INVENT ───────────────────────────────────
// `game/shimmer-skilling.md` §Skill 4 gives the four tiers, their members, their XP and the rule
// that binds them: *"The catch is random, weighted by level and location. Rare Rinn require patience
// and higher levels to even appear."* Plus *"The longer your patience, the better the catch."*
// So there are exactly three inputs — LEVEL, LOCATION, PATIENCE — and this file's whole job is to
// turn them into one of seven named rinn. `rin-catch.test.ts` parses the canon table and fails if a
// name or an XP value here drifts from it, because a hand-copied table is a table that goes stale.
//
// ── ★★ "LOCATION" IS THE SPOT KIND *AND* THE DEPTH, AND THE DEPTH ONLY EXISTS IN ONE OF THEM ────
// Measured 2026-08-20 over 247,692 columns (18,200 of them water), per kind, because a sweep that
// only reaches rivers answers the wrong question and one had already been run that way:
//
//     pond    n=6653   depth 3 everywhere              — ONE distinct value
//     stream  n=7467   depth 1..3, median 2            — three
//     lake    n=4080   depth 0..12, median 2, p75 4    — THIRTEEN
//
// So depth is a real axis in basins and a constant everywhere else, and that is not a defect to
// paper over — a pond IS uniformly shallow, and the ladder should say so by giving it nothing but
// tier 1. ⚠ The lake numbers were **unmeasurable until the same afternoon**: `rinSpotAt` returned
// `surfaceY: -Infinity` for every basin column, so any depth taken from it was `-Infinity` too, and
// a sweep would have "shown" that no lake had any depth at all. **A measurement is only as honest as
// the field under it** — that fix (`237a8d9`) is what made this table possible.
//
// ── ★★ PATIENCE IS ELAPSED TIME, AND IT IS EXPLICITLY *NOT* `RinCast.passes` ────────────────────
// `passes` counts takes that went UNANSWERED, and `rin-cast.ts` is emphatic that it may only ever
// shorten the next wait: *"a miss counter is one refactor away from becoming a miss PUNISHMENT."*
// Feeding it in here would be that refactor wearing a friendly name — it would reward a keeper for
// ignoring the float, which is the opposite of the thing canon is asking for. What canon means by
// patience is the plain one: how long the line has been out. The host passes that.

import { RIN_POND, RIN_STREAM, RIN_LAKE, type RinKind } from '../voxel/rin-water'

/** One rung of canon's ladder. Names and XP are canon's; the test proves they still are. */
export interface RinTier {
  tier: 1 | 2 | 3 | 4
  /** Canon's minimum rinning level for this rung. */
  minLevel: number
  xp: number
  /** Every rinn on this rung. The roll picks one uniformly — canon gives them no ordering. */
  items: readonly string[]
}

/**
 * ⚠ `minLevel` COMES FROM CANON'S OWN LEVEL BANDS, not from the fishing-spot table. §Skill 4 heads
 * each tier with a band (*"Tier 1 — Levels 1-3"*, *"Tier 2 — Levels 4-6"*, *"Tier 3 — Levels 7-9"*,
 * *"Tier 4 — Level 10"*). `world/resources.ts`'s per-spot `minLevel` (pond 1 / stream 4 / lake 7) is
 * a DIFFERENT number that happens to look similar — it gates the spot, not the catch — and reading
 * one for the other is how two tables that agree today quietly stop agreeing.
 */
/**
 * ⚠⚠ THESE IDS ARE JOIN KEYS, NOT NAMES — and treating them as names shipped a ladder that could
 * not be climbed (found + fixed 2026-08-22, play lane).
 *
 * Tier 2 and tier 3 read `glowfin_scale` and `moonkoi_scale` for two days. Both ids have **no
 * `ItemDef` in `sprites/items.ts` and no consumer anywhere in the build**, while the fish they were
 * named after — `glowfin`, `moonkoi` — are exactly what `TOOL_DEFS.glowfin_rinstick` and
 * `TOOL_DEFS.moonkoi_rinstick` require. So a keeper past level 4 landed a nameless, artless object
 * half of every cast, and **could never craft the rod that reaches the next rung**. The ladder ends
 * at tier 1 by construction. Canon rules the relationship this breaks: rinsticks are built *from
 * rinn*, *"kin calls to kin"* (`CANON_GAPS.md` §rinstick ruling).
 *
 * ★ The slip is legible: tier 1's `shimmerscale` is a species whose NAME ends in "scale"
 * (`world/cuisine.md` calls a Shimmerscale steak *"the best fish in the world"*), and the suffix got
 * carried onto its two neighbours as though it were a convention.
 *
 * ⚠ AND THE GUARD THAT EXISTS FOR THIS EXEMPTED IT. `rin-catch.test.ts` matched canon's names after
 * `id.replace(/_scale$/, '')`, reasoning that *"the ID convention is the build's business and the
 * NAME is canon's"* — true in general, and wrong here, because an id that another table looks up is
 * not a convention. That replace had no other target in the ladder: it existed only to let these two
 * through. The exemption is gone and the orphan join is asserted directly.
 */
export const RIN_TIERS: readonly RinTier[] = [
  { tier: 1, minLevel: 1,  xp: 15,  items: ['shimmerscale', 'clickclaw'] },
  { tier: 2, minLevel: 4,  xp: 45,  items: ['glowfin', 'ribboneel'] },
  { tier: 3, minLevel: 7,  xp: 120, items: ['moonkoi', 'pearlshell'] },
  { tier: 4, minLevel: 10, xp: 350, items: ['crystal_rinn'] },
]

/** The water a cast is sitting on, as this file needs it. Built by the host from `rinSpotAt`. */
export interface RinWater {
  kind: RinKind
  /** Surface minus bed, in blocks. See the header: only basins have any range in this. */
  depth: number
  lively: boolean
}

/**
 * The deepest rung a given water can hold, regardless of the keeper's level.
 *
 * ★ THE SPOT IS A CEILING, THE LEVEL IS A KEY, AND THEY ARE DIFFERENT KINDS OF LIMIT. A level-10
 * keeper standing at a puddle should not pull a crystal rinn out of it — canon calls that one
 * *"a Rinn made partly of crystallized mana… catching one feels like holding a wish"*, and a wish
 * you can farm at the nearest ditch is not a wish. Equally a level-1 keeper at a deep basin should
 * see the good water and not be able to land what is in it. Two limits, both real, neither
 * substituting for the other.
 */
export function ceilingFor(w: RinWater): 1 | 2 | 3 | 4 {
  if (w.kind === RIN_POND) return 1
  if (w.kind === RIN_STREAM) return 2
  // Basins carry the range, so this is the one place depth decides anything. The thresholds sit at
  // the measured p75 (4) and near the top of the distribution (8) rather than on round numbers —
  // at p75 roughly a quarter of basin water is tier-3 capable, and tier 4 stays genuinely rare.
  if (w.depth >= 8) return 4
  if (w.depth >= 4) return 3
  return 2
}

/**
 * How much life this water holds, 0..1 — Alex's *"fish population"*, computed rather than authored.
 *
 * ⚠ IT LEANS THE ROLL AND NEVER GATES IT. `rin-water.ts` already states the rule this has to honour:
 * *"NEVER a gate on casting — quiet water is fishable water, it is just quiet."* A population that
 * could reach zero would make a stretch of water silently useless, which reads as a broken feature
 * rather than as a quiet pond.
 */
export function population(w: RinWater): number {
  const base = w.kind === RIN_LAKE ? 0.5 : w.kind === RIN_STREAM ? 0.4 : 0.35
  // Depth contributes only where it varies. Clamped at the measured max so a future generator
  // change that digs deeper cannot push this past 1 and silently re-weight the whole ladder.
  const byDepth = w.kind === RIN_LAKE ? Math.min(w.depth, 12) / 12 * 0.3 : 0
  return Math.min(1, base + byDepth + (w.lively ? 0.2 : 0))
}

/** Full minute of the line being out. Canon: *"The longer your patience, the better the catch."* */
export const PATIENCE_FULL_MS = 90_000

export interface RinResult {
  itemId: string
  xp: number
  tier: 1 | 2 | 3 | 4
}

/**
 * Resolve one landed catch.
 *
 * `level` is the keeper's rinning level, `patienceMs` is how long the line has been out this
 * session (NOT `RinCast.passes` — see the header), `rng` returns 0..1.
 *
 * ★ THE ROLL WALKS DOWN FROM THE BEST RUNG THIS WATER AND THIS KEEPER CAN BOTH REACH, and each rung
 * gets a chance proportional to how good the conditions are. Walking DOWN rather than up is what
 * makes "rare rinn require patience and higher levels to even appear" literally true: the top rung
 * is simply not in the loop unless both limits admit it. A single weighted table would have to
 * encode the same thing as a pile of zeroes, which is the version that goes wrong when a tier is
 * added.
 *
 * ⚠ IT ALWAYS RETURNS SOMETHING. A cast that lands nothing is a punishment, and canon spent two
 * sentences refusing punishments in this skill. Tier 1 is the floor, not a failure.
 */
export function rinCatch(w: RinWater, level: number, patienceMs: number, rng: () => number): RinResult {
  const ceiling = ceilingFor(w)
  const patience = Math.max(0, Math.min(1, patienceMs / PATIENCE_FULL_MS))
  // Conditions: mostly the water, meaningfully the wait. Both 0..1, so `quality` is too.
  const quality = population(w) * 0.65 + patience * 0.35

  for (let i = RIN_TIERS.length - 1; i > 0; i--) {
    const t = RIN_TIERS[i]
    if (t.tier > ceiling || level < t.minLevel) continue
    // Each rung above the first is harder than the one below it, so the same conditions buy less
    // the higher you reach. `tier` is 2..4, giving 1/4, 1/9, 1/16 of `quality` — steep enough that
    // a crystal rinn stays a story and shallow enough that good water plainly matters.
    if (rng() < quality / (t.tier * t.tier)) return pick(t, rng)
  }
  return pick(RIN_TIERS[0], rng)
}

const pick = (t: RinTier, rng: () => number): RinResult =>
  ({ itemId: t.items[Math.min(t.items.length - 1, Math.floor(rng() * t.items.length))], xp: t.xp, tier: t.tier })
