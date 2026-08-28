// Hold territory — which hold's hand is over a given piece of ground, and how hard it presses.
//
// ⚠⚠ "STRONGHOLD" IS THE WRONG WORD FOR THESE AND CANON LOCKS IT. `game/shimmer-storyline.md:23`:
// *"Terminology lock for Shimmer: the v1 main-map three are **holds / camps**; the word
// 'stronghold' is reserved for the Wilds."* Thistle/Vetch/Brack are garden-plot scale — the game's
// Thornlords, rung ONE of the ladder, not its top. The individuals are **hold-Moglins**
// (`glossary.md:23`), the places are **holds / camps / plot-holds**. This file's own first line said
// "stronghold" until canon was checked.
//
// ⚠⚠ THE LINE THAT STOOD HERE MADE A FALSE CLAIM ABOUT ANOTHER FILE, AND STAYED TRUE-SOUNDING FOR
// DAYS AFTER IT STOPPED BEING TRUE. It read *"`holds.ts:1` still opens 'story-node strongholds' —
// worth correcting there"*. That file was corrected; this sentence was not, so a reader arriving
// here was sent to fix something already fixed, in a file this one does not own. **A comment about
// another file's current text is a standing claim with no way to fail** — the same shape as a doc
// citing a test that never existed, and the reason it is not simply UPDATED here: an updated
// cross-reference rots exactly as fast as the one it replaces. `seams.test.ts`'s reserved-word
// guard asserts the property instead, on both headers at once, and goes red rather than stale.
//
// ★ PURE CORE, GEOMETRY ONLY. Imports `holds` and nothing else, for the same reason holds.ts imports
// only story-path: no caller's height, grid or renderer can leak in, so the oracle can ask about any
// point in the world without building one.
//
// ── CANON, QUOTED RATHER THAN PARAPHRASED (`CANON/game/shimmer-geography.md`, RULED 2026-07-30) ──
//   "a burrow is a mouth, a hold is the hand behind it" — collared Moglins press into a plot through
//   burrows near its edge and keep pressing FOR AS LONG AS THAT AREA'S HOLD STANDS; free the hold and
//   the tunnelling STOPS.
// The boundary line hands placement, rates and reset cadence to Jin and hands nothing else. So what
// canon fixes here is: territory exists, it belongs to a hold, and freeing ends it. The SHAPE of it,
// the reach and the falloff are build decisions and live in this file.
//
// ★★ WHY THIS IS DERIVED AND NOT AUTHORED. `dens.ts` carries the warning that "a burrow with no hold
// behind it contradicts the ruling in one word" — which today is a rule a person has to remember
// while placing things. Deriving territory from the holds themselves makes that unrepresentable
// rather than merely forbidden: there is no way to sit inside a band that no hold is projecting.
// `spawn-placements.ts` currently hand-types `gate: 'thistle' | 'vetch' | 'brack'` beside each
// burrow, which is a second statement of where the burrow IS, and two statements of one fact are the
// mirror this codebase keeps paying for. Once bands exist that field is a derivation.
//
// ★★ AND REACH AND PRESSURE BOTH COME OFF `half`, WHICH ALREADY ESCALATES 10 / 12 / 14. holds.ts
// says the curtain wall grows down the chain because "Brack looms" — so the looming is already
// stated in the geometry, and a second hand-kept escalation table would be free to disagree with it.
// One source: a hold that is built bigger reaches further and presses harder, necessarily.

// ── ★ TWO CANON FACTS THIS FILE DOES NOT YET MODEL, NAMED SO THEY ARE NOT MISTAKEN FOR ABSENT ──
// 1. THE HOLD-MOGLINS RETREAT INWARD AND POOL. `game/shimmer-quests-mainmap.md:19-24`: the three
//    "fall back and pool as you push in" — Thistle retreats toward Vetch, Vetch falls back to Brack,
//    Brack makes a last stand, and "reform happens ONLY after all three are down". So freeing a hold
//    does not merely empty its band; its Moglins arrive somewhere. `territoryAt` answers a question
//    about GROUND and is correct as it stands, but whoever spends the freed pressure must know it is
//    owed to the next hold down the chain rather than deleted.
// 2. A QUIETED BURROW IS NOT A CORPSE. `game/shimmer-geography.md:100-103`: "a quieted burrow is the
//    natural place a reformed presence appears — the deflated folk who came to raid and stayed to be
//    neighbours." That is canon's own payoff for freed territory, and it is better than closing the
//    mouth over: the hole stays, and someone friendly comes out of it.

import { HOLDS, type HoldSpec } from './holds'

/**
 * Blocks of reach per block of curtain-wall half-extent.
 *
 * ⚠ 38, AND THE FIRST VALUE HERE WAS 48 WITH A COMMENT CLAIMING IT LEFT A FREE CORRIDOR. It did not:
 * the oracle answered 53 blocks of overlap between Thistle and Vetch and 150 between Vetch and Brack
 * on the first run. The chain spacings are 1003 and 1098 blocks, so a corridor needs
 * reach(a) + reach(b) < spacing — which caps this at 42 for the tightest pair, not 48. Prose in a
 * header is a claim like any other; this one survived exactly as long as it took to measure.
 *
 * The corridor is deliberate: a front line you can stand OUTSIDE of is what makes stepping into one
 * mean anything. At 38 the bands are 380 / 456 / 532 against plot tiers of 300 / 400 / 500 — a
 * hold's reach lands on the same scale as a keeper's plot, so the top of the built chain projects
 * roughly one full-grown garden's worth of country. That is a legible unit rather than a tuned one.
 */
export const REACH_PER_HALF = 38

/** How far this hold's hand reaches, in blocks from its centre. */
export const holdReach = (h: HoldSpec): number => h.half * REACH_PER_HALF

/**
 * How hard the smallest hold presses at its own wall. Scales with `half`, so Brack presses 1.4x
 * what Thistle does at the same relative distance — the same ratio its wall already claims.
 */
export const holdWeight = (h: HoldSpec): number => h.half / HOLDS[0].half

export interface Territory {
  /** The hold whose hand is over this ground, or null for free country. */
  hold: string | null
  /**
   * 0 at the outer edge of reach, rising to `holdWeight` at the wall. Free country is 0.
   * ⚠ NOT clamped to 1: the top of the range IS the rung, so a caller comparing pressure between
   * bands is comparing the escalation rather than a normalised number that has thrown it away.
   */
  pressure: number
  /** Distance to that hold's centre, or Infinity in free country. Handy for placement checks. */
  distance: number
}

const FREE: Territory = Object.freeze({ hold: null, pressure: 0, distance: Infinity })

/**
 * Whose ground is this, given the holds the keeper has already freed?
 *
 * ★ A FREED HOLD'S BAND GOES FREE — IT IS NOT INHERITED BY THE NEXT HOLD DOWN THE CHAIN.
 * `game/shimmer-geography.md:91-94` (RULED 2026-07-30): Moglins press into a plot "for as long as
 * that area's hold still stands. Break the hold ... and the tunnelling into that plot STOPS."
 * Not "moves". If a neighbour absorbed the ground, liberating Thistle would relocate the pressure
 * rather than end it, and the arc would read as rearranging furniture.
 *
 * ⚠ AND THE OTHER HALF OF THIS IS GENUINELY UNSETTLED, WHICH IS WHY IT IS FILED RATHER THAN CHOSEN.
 * Canon scopes the stop to "that plot" and "that area" and never defines the area's extent, and
 * nothing in the corpus describes a hold RE-taking ground, pressure creeping back, or a front that
 * has to be garrisoned. So whether a still-standing neighbour may press into a plot whose own hold
 * you already broke is not answered — and answering it build-side would be asserting how far a hold
 * reaches, which changes what liberation MEANS. Filed `[OPEN]` for the Magii seat. This function
 * implements the conservative reading (freed ground stays free) and one line changes it.
 *
 * Nearest STANDING hold wins where reaches overlap, so a contested corridor belongs to whoever is
 * closer — and freeing one hands that corridor to nobody, not to its rival.
 */
export function territoryAt(x: number, z: number, freed: ReadonlySet<string> = new Set()): Territory {
  let best: Territory = FREE
  for (const h of HOLDS) {
    if (freed.has(h.id)) continue
    const d = Math.hypot(x - h.x, z - h.z)
    const reach = holdReach(h)
    if (d >= reach) continue
    if (d >= best.distance) continue
    // Linear falloff from the wall to the edge of reach. Inside the wall it is flat at full weight:
    // the courtyard is not "more" the hold's than the gate is, and a spike at the centre would make
    // pressure a function of how close you stand to a wall you cannot enter.
    const t = d <= h.half ? 1 : 1 - (d - h.half) / (reach - h.half)
    best = { hold: h.id, pressure: t * holdWeight(h), distance: d }
  }
  return best
}

/** Every hold still standing, in chain order. */
export const standingHolds = (freed: ReadonlySet<string> = new Set()): HoldSpec[] =>
  HOLDS.filter(h => !freed.has(h.id))

/**
 * Is this a legal place to author a burrow? Canon forbids a burrow with no hold behind it, and
 * `dens.ts` forbids a generator scattering them — so this answers the authoring question and the
 * guard question with one function rather than two that can drift.
 */
export const canHostBurrow = (x: number, z: number, freed: ReadonlySet<string> = new Set()): boolean =>
  territoryAt(x, z, freed).hold !== null
