// What the grimoire has earned the keeper — the ledger Greg reads before he widens a fold.
//
// ★ PURE. No react/three/DOM. The host owns the index, the party and the save; this owns the one
// question *"how much ground has this keeper's KNOWING bought."*
//
// ── ★★ CANON DECIDED THE VECTOR, AND IT IS NOT MATERIALS ───────────────────────────────────────
// `game/shimmer-geography.md` › *THE GRIMOIRE IS WHAT GREG READS — the ledger the ground is won on*
// (RULED 2026-08-15, /magii + Alex): ***the collar's way is to OWN a spirit, the grimoire's way is to
// KNOW one***, and a plot that widens as the grimoire fills is *"the line's thesis rendered as
// progression."* Both of the grimoire's ruled faces pay, and they pay for different acts:
//
//   · **what a spirit IS** — the species index — fills by DISCOVERING one in the world. The seeker's
//     half, *"document the glimpse instead of chasing it."*
//   · **who YOURS are** — the roster — fills by FREEING or BONDING one. The liberator's half.
//
// **Materials never buy ground.** Canon is explicit: *"The grimoire raises the CAP; the keeper's
// blocks fill it in."* So nothing in this file may ever look at an inventory, and if a future
// "upgrade cost" wants to spend rubble, that is a canon contradiction rather than a balance change.
//
// **Nothing is bought at all.** *"Greg widening the fold is Greg rewarding his own life's work, not a
// shopkeeper taking payment… the book is how he sees they are ready."* There is no price here, only
// a threshold — which is why this returns an EARNED tier rather than an affordable one.
//
// ★ THE ANTI-FARM PROPERTY IS THE REASON THIS IS SAFE, and it is structural rather than tuned: you
// can mine a thousand blocks, and you cannot mine a species you have never met. A grimoire fills
// only by meeting something new, which means leaving the plot. The garden can never be ground out.
//
// **Boundary:** that the grimoire is the ledger, that both faces pay, and that knowing (never
// materials) buys extent = canon. *"How many entries buy how much ground, pacing, whether the two
// faces pay at different rates"* = mine, and every number below is a first guess.

import type { Spirit } from '../spirits/spirit'
import type { SpiritIndex } from '../engine/spirit-index'
import { PLOT_TIERS } from '../voxel/plot'

/**
 * Entries needed to stand at each tier. Index 0 is the fold Greg gives you on day one.
 *
 * ⚠ FIRST GUESSES, AND THE PACING IS THE WHOLE RISK. Ten species exist to meet, so tier 1 at six
 * entries is roughly *"you have been out of the garden and it showed"* — a session or two — and tier
 * 2 at fourteen wants both faces working: meeting most of the roster AND keeping some. Set to be
 * walked and argued with. If it plays slow, this array is the dial and nothing else moves.
 *
 * ⚠ LENGTH MUST MATCH `PLOT_TIERS` — asserted, because a fourth radius with no threshold beside it
 * would be a fold nobody can ever earn, and it would fail silently as "the upgrade never comes".
 */
// ⚠ SIZED AGAINST THE REAL CEILING, WHICH IS 14 (found by the page harness, 2026-08-18). Ten
// species exist to meet and the roster holds **four** — so a keeper who does everything the build
// currently allows tops out at 10 + 4. The first cut put tier 2 at exactly 14, which is a threshold
// only a perfect keeper can touch and which drops away the moment they send a spirit home. 5 and 10
// leave slack in both faces: tier 1 is *"you have been out and it showed"*, tier 2 wants most of the
// index or a full roster and a good walk.
//
// ⚠ AND THE ROSTER'S CEILING IS A BUILD LIMIT, NOT CANON. `Where a keeper's spirits live` (RULED
// 2026-07-30) puts a keeper's spirits *"elsewhere in the garden — off in the meadow, down at the
// water"*; the four are who is WITH you, not who is yours. This world has no roster beyond the
// carried party yet, so the liberator's face is capped low. When that lands, raise these.
export const TIER_NEED: readonly number[] = [0, 5, 10]

export interface FoldLedger {
  /** Distinct species the keeper has MET — the index face. */
  seen: number
  /** Spirits in the keeper's own roster — the liberator's face. */
  held: number
  /** What Greg counts. Both faces, added, because canon makes both pay. */
  total: number
  /** The highest tier this ledger has earned, 0-based. */
  earned: number
  /** Entries still owed for the next tier, or 0 at the top. */
  toNext: number
  /** Is there a wider fold left to give at all? */
  atTop: boolean
}

/**
 * Read the ledger.
 *
 * ★ THE TWO FACES ARE ADDED, NOT MAXED OR AVERAGED, and that is a design choice worth naming: a
 * keeper who only ever wanders and a keeper who only ever frees are both making progress, at the
 * same rate, and a keeper who does both is rewarded for doing both. Canon says both faces pay; it
 * does not say they pay in one currency, and one counter is the version a player can hold in their
 * head while standing in front of Greg.
 *
 * ⚠ THE SAME SPIRIT CAN COUNT TWICE — once as a species met, once as a spirit kept — and that is
 * deliberate rather than sloppy. Freeing a Manalotl you had never seen is two different acts in
 * canon's own split (you learned what one IS, and one is now yours), and taxing the overlap would
 * make the most canon-shaped play the least rewarded.
 */
export function foldLedger(index: SpiritIndex | null, party: readonly Spirit[]): FoldLedger {
  // ★ A SPIRIT YOU HOLD IS A SPECIES YOU KNOW, so the index face is the persisted ledger UNION the
  // party's own species. `grimoire-tab.tsx` already derives exactly this and calls it the honest
  // ceiling of what party data can establish — the two must not disagree about what the keeper
  // knows, and a keeper who bonded a Manalotl before ever meeting one in the mist has plainly met
  // one. The union is also what keeps the counter from going DOWN when a spirit is sent home.
  const met = new Set<string>()
  if (index) for (const e of Object.values(index.entries)) if (e.status !== 'unseen') met.add(e.species)
  for (const s of party) if (s?.species) met.add(s.species)
  const seen = met.size
  const held = party.length
  const total = seen + held
  let earned = 0
  for (let t = 0; t < TIER_NEED.length; t++) if (total >= TIER_NEED[t]) earned = t
  const atTop = earned >= TIER_NEED.length - 1
  return { seen, held, total, earned, toNext: atTop ? 0 : TIER_NEED[earned + 1] - total, atTop }
}

/**
 * Is Greg holding a wider fold for this keeper right now?
 *
 * ⚠ COMPARES EARNED AGAINST THE **SAVED** TIER, never against what the ledger alone says. The saved
 * number is the ground that actually exists; a keeper whose book has raced ahead is owed the
 * difference, and one whose save somehow sits higher (a hand-edited file, a rolled-back threshold)
 * is left alone rather than having their garden shrink. **Ground is never taken back** — that is the
 * additive-growth guarantee `plot.ts` is built on, stated here where the decision is made.
 */
export const foldOwed = (ledger: FoldLedger, savedTier: number): boolean => ledger.earned > savedFloor(savedTier)

/**
 * The tier a keeper should be standing on: what they have earned, never less than what they hold.
 *
 * ⚠ THE SAVED TIER IS SANITISED FIRST, and the oracle is what caught it. `Math.max(NaN, 0)` is
 * **NaN**, not 0 — so a save with a corrupt tier would propagate NaN into `plotForTier`, and from
 * there into a radius, a threshold and a fall line. `plotForTier` happens to clamp it back to 0 on
 * its own, which is exactly what makes this the dangerous kind of bug: it would have looked fine
 * until the day something else read this number first.
 */
// ⚠ NOT NAMED `held` — that is already a local inside `foldLedger` (spirits in the roster), and
// two different meanings one letter apart in one small file is how a refactor picks the wrong one.
const savedFloor = (savedTier: number): number => (Number.isFinite(savedTier) ? Math.max(0, savedTier) : 0)
export const foldTier = (ledger: FoldLedger, savedTier: number): number =>
  Math.max(savedFloor(savedTier), ledger.earned)

/**
 * The counter Greg says out loud. Canon asked for exactly this — the ruling calls the grimoire *"the
 * legible counter it never had"* — so a keeper always knows whether they are close.
 *
 * ⚠ SAYS ENTRIES, NEVER BLOCKS. The keeper is not buying radius; they are filling a book, and a line
 * that priced ground in metres would put a shopkeeper where canon put a teacher.
 */
export function foldProgressLine(ledger: FoldLedger): string {
  if (ledger.atTop) return `${ledger.total} entries. There is nothing left in the book I can fold for you.`
  return `${ledger.total} entries in the book. ${ledger.toNext} more and I can give you more ground.`
}

/** Blocks of radius at a tier, for a line that wants to name what changed. */
export const tierRadius = (tier: number): number =>
  PLOT_TIERS[Math.max(0, Math.min(PLOT_TIERS.length - 1, tier))]
