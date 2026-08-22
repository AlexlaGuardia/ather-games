// How many garden beds a keeper may have down at once, and why there is a ceiling at all.
//
// ★ PURE. No react/three/DOM, no world reads. The host counts what is placed and asks this.
//
// ── ★★ ALEX, 2026-08-22: beds are CRAFTED and PLACED, and farming milestones raise the cap ──────
// *"gardening plots be crafted and placed this way there's a limit with milestones in the farming
// skill that unlock more plots, so they can start with about ten then 15 and eventually 20."*
//
// ── ★★★ THIS IS A SECOND CAP, AND CANON ALREADY OWNS THE FIRST ONE ─────────────────────────────
// `game/shimmer-geography.md`: **"how much island a keeper holds is the grimoire ledger's to say"**,
// and *"a build that lets a keeper terraform outward past their cap re-opens the farm problem by the
// back door."* So EXTENT is canon's and is bought with knowing. This file does not touch extent — a
// bed creates no ground, it decides what existing ground *does*, which the same ruling hands to Jin
// in the next sentence: *"materials and sculpting decide what that ground looks like and does."*
//
// ⚠ TWO INDEPENDENT LIMITS, AND WHICHEVER BINDS FIRST IS THE REAL ONE. A keeper with a young ledger
// runs out of island before they run out of allowance; a keeper with young farming runs out of
// allowance on a large island. That is not a conflict to resolve — it means both progressions matter,
// and neither can be ignored to reach the same place. Do not "fix" it by deriving one from the other.
import { SKILL_MILESTONES } from '../engine/skills'
import { MAT } from '../voxel/depth'

/**
 * The ladder, as data. Alex's three numbers, hung on the milestone levels that already exist.
 *
 * ★ THE LEVELS ARE NOT INVENTED — they are `SKILL_MILESTONES` (25 Apprentice · 50 Journeyman), which
 * until now were **cosmetic only**. Reusing them means the titles a keeper already earns finally do
 * something, and it means there is ONE ladder in this game rather than a farming-shaped exception to
 * it. Inventing 12/30 here would have been a second progression nobody could see from the skill panel.
 *
 * ⚠ MASTER (75) AND GRANDMASTER (99) ADD NOTHING, ON PURPOSE. Alex's ceiling was twenty; a cap that
 * keeps climbing to the level cap is not a cap. Stated rather than left as an apparent oversight —
 * if the top rungs should pay, this table is the one line to change.
 */
export const PLOT_ALLOWANCE: readonly { level: number; plots: number }[] = [
  { level: 1, plots: 10 },
  { level: SKILL_MILESTONES[0].level, plots: 15 },   // 25 · Apprentice
  { level: SKILL_MILESTONES[1].level, plots: 20 },   // 50 · Journeyman
]

/** How many beds a keeper of this farming level may have placed at once. */
export function plotsAllowed(farmingLevel: number): number {
  let allowed = 0
  for (const rung of PLOT_ALLOWANCE) if (farmingLevel >= rung.level) allowed = rung.plots
  return allowed
}

/** The next rung, or null at the top — so a refusal can say what would change it. */
export function nextAllowance(farmingLevel: number): { level: number; plots: number } | null {
  return PLOT_ALLOWANCE.find(r => r.level > farmingLevel) ?? null
}

/**
 * Why a bed cannot go down, or `'ok'`.
 *
 * ⚠ A TYPED REFUSAL, NOT A BOOLEAN — the same reason `applyInfusion` and `brewBlocker` are typed.
 * "you are at your limit, Apprentice raises it to 15" and "you are not holding one" are different
 * sentences and different things to do next; a `false` that means both is how a keeper concludes the
 * button is broken. `at-cap` in particular is the one that reads as a bug if it cannot explain itself.
 */
export type PlotRefusal = 'ok' | 'at-cap' | 'none-in-bag' | 'not-plantable-ground'

export function placeBedBlocker(
  placed: number, farmingLevel: number, heldCount: number, groundOk: boolean,
): PlotRefusal {
  if (heldCount < 1) return 'none-in-bag'
  if (!groundOk) return 'not-plantable-ground'
  if (placed >= plotsAllowed(farmingLevel)) return 'at-cap'
  return 'ok'
}

/**
 * One sentence for the keeper. Kept beside the refusal so a new refusal cannot ship without one —
 * the `potionEffectLine` lesson, where a `null` rendered as the literal word "null" in the hotbar.
 */
export function plotRefusalLine(why: PlotRefusal, farmingLevel: number): string {
  switch (why) {
    case 'ok': return ''
    case 'none-in-bag': return 'no garden bed in your bag — craft one first'
    case 'not-plantable-ground': return 'a bed wants open ground with sky over it'
    case 'at-cap': {
      const next = nextAllowance(farmingLevel)
      return next
        ? `${plotsAllowed(farmingLevel)} beds is your limit — farming ${next.level} raises it to ${next.plots}`
        : `${plotsAllowed(farmingLevel)} beds is the most any garden holds`
    }
  }
}

/**
 * How many beds are down, counted from the edit log rather than from a stored tally.
 *
 * ★★ DERIVED, NEVER COUNTED-AND-SAVED, and this is the whole reason it is a function here instead of
 * a number in the save. A stored count drifts the first time a bed is destroyed by anything that does
 * not remember to decrement — terrain regeneration, a rollback, an undo, another system reclaiming
 * ground. Then the cap is wrong in the direction that locks a keeper out of their own garden, with no
 * way to notice and nothing to repair it from. The edit log IS the truth about what is placed.
 *
 * ⚠ IT IS SOUND ONLY BECAUSE A BED IS NEVER GENERATED TERRAIN. `recordEdit` deletes an edit that
 * restores what the generator would have put there, so if a bed were ever part of worldgen, placing
 * one on its own square would record nothing and go uncounted. Beds are craft-only; if that ever
 * changes, this function is the thing that breaks, silently and permissively.
 */
export function countBeds(edits: Iterable<Map<number, number>>, beds: ReadonlySet<number> = GARDEN_BEDS): number {
  let n = 0
  for (const col of edits) for (const mat of col.values()) if (beds.has(mat)) n++
  return n
}


// ── THE THREE BEDS, AND THE ONE PLACE THAT KNOWS THEY ARE THREE ────────────────────────────────
//
// ★ ALEX, 2026-08-22: *"can we make that planks a universal input where any of the tree planks
// could be used..? (it would be cool if the garden beds were mergable and the planks used decides
// the color of the border)"*
//
// ⚠ EVERY READER IMPORTS THIS. There were eight `=== MAT.GARDEN_BED` comparisons in the build when
// the bed was one material, and each of them is a place where a two-of-three fix reads as a whole
// fix: sow works on goldwood, reap works on goldwood, and a shimmeroak bed is scenery. That is the
// two-branch-function trap from the 07-17 round, and the defence is that there is no comparison to
// forget — there is a set, derived here, and `isGardenBed` is the only question anyone asks.
//
// ⚠ AND THE CAP COUNTS ALL THREE TOGETHER, deliberately. The allowance is a farming-skill ration,
// not a per-wood one; three separate ceilings would let a keeper hold 30 beds by owning three woods
// and would make the milestone numbers Alex gave (10/15/20) mean nothing.
export const BED_WOODS: readonly { wood: string; material: number; item: string; plank: string }[] = [
  { wood: 'goldwood',   material: MAT.GARDEN_BED_GOLDWOOD,   item: 'garden_bed_goldwood',   plank: 'goldwood_plank' },
  { wood: 'shimmeroak', material: MAT.GARDEN_BED_SHIMMEROAK, item: 'garden_bed_shimmeroak', plank: 'shimmeroak_plank' },
  { wood: 'dawnwood',   material: MAT.GARDEN_BED_DAWNWOOD,   item: 'garden_bed_dawnwood',   plank: 'dawnwood_plank' },
]

/** Every material that IS a garden bed. Derived from the table above, never hand-listed. */
export const GARDEN_BEDS: ReadonlySet<number> = new Set(BED_WOODS.map(b => b.material))

/**
 * Is this material a garden bed, of any wood? The only question the rest of the build should ask.
 *
 * ⚠ TAKES `undefined` ON PURPOSE — the common caller is `materialForItem(heldItem)`, which returns
 * `number | undefined` for "you are holding something that is not a block". Forcing every call site
 * to narrow first is how one of them ends up narrowing with `!` and asserting that a fistful of
 * seeds is a material.
 */
export const isGardenBed = (material: number | undefined): boolean =>
  material !== undefined && GARDEN_BEDS.has(material)

/** Which wood a placed bed is framed in, or undefined if it is not a bed. */
export const bedWoodOf = (material: number): string | undefined =>
  BED_WOODS.find(b => b.material === material)?.wood
