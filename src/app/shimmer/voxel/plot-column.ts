// The plot's column builder — the adapter between `plot.ts`'s pure geometry and a real `Column`.
//
// ★ WHY THIS IS ITS OWN FILE. `plot.ts` imports nothing but noise and the AIR constant, and it is
// worth keeping that way: it is the geometry, and it should stay cheap to test and impossible to
// tangle. `column.ts` pulls in height, depth, carve, ore and trees — the whole continent. So the
// glue lives here, one file, importing both, and neither of the two it joins knows about the other.
//
// ── ★ WHAT THIS SAVES THE HOST, WHICH IS THE POINT ──────────────────────────────────────────────
// `generateColumn` runs seven stages keyed to a world that goes on forever: slump, the depth rule,
// pre-ore, carve, post-ore, vegetation, sites, waystones. **The plot needs exactly none of them.**
// So the switch at the host is one line — `isPlot ? generatePlotColumn(col, seed) : generateColumn(...)`
// — rather than a mode threaded through seven stages that would each need teaching where the world
// ends.

import { Column, Stage, SECTION, refreshUniform } from './column'
import { DEFAULT_PLOT, plotMaterialAt, plotYRange, type PlotConfig } from './plot'

/**
 * Which sections a plot column can possibly touch.
 *
 * ★ THE PLOT IS A THIN SLAB IN A TALL WORLD. With the default config the island occupies roughly
 * y 78-106 out of 256 — about two sections of sixteen. Measured 2026-08-22 over a 49-column sample
 * through the real generator: **2.00 non-uniform sections per plot column against 7.20 in the
 * Wilds**, and 188k solid cells against 1.47M.
 *
 * ⚠⚠ AND IT HAS NO PRODUCTION CALLERS — ONLY ITS OWN TEST. This docstring used to end with a claim
 * about what it saves the host, and `plot.ts`'s `plotYRange` warning asserted outright that
 * *"`plotSectionRange` meshes only the sections it names."* **It meshes nothing.** Nobody calls it.
 * Same family as the `brew-reach.test.ts` citation to a file that has never existed: a doc that
 * asserts coverage retires the question instead of answering it, and the next reader budgets for an
 * optimisation that is not running.
 *
 * ★ IT IS KEPT RATHER THAN DELETED BECAUSE ITS TEST ASSERTS REAL PROPERTIES OF THE RANGE, AND
 * WIRING IT IS NOT WORTH DOING — measured, not assumed. `column.ts` already records that the
 * uniform-section skip *"buys about nothing"* in the Wilds, and in the plot the 14 uniform-air
 * sections per column are already handled by the mesher's own uniform fast path. Skipping the visit
 * to a section that costs nothing to visit saves nothing. **If you are here looking for the plot's
 * frame cost, this is not it** — take a reading with `voxel3d/profile.ts` instead.
 */
export function plotSectionRange(cfg: PlotConfig = DEFAULT_PLOT): { first: number; last: number } {
  const { min, max } = plotYRange(cfg)
  return { first: Math.max(0, (min / SECTION) | 0), last: (max / SECTION) | 0 }
}

/**
 * Fill a column with the plot's ground.
 *
 * Mirrors `generateColumn`'s signature and its post-conditions — uniform table refreshed, stage set
 * to `Ready` — so a host can treat the two as interchangeable at the call site.
 *
 * ⚠ NO `overrides` MAP, AND ITS ABSENCE IS CORRECT RATHER THAN MISSING. `Column.overrides` exists
 * because the continent writes trees, ore, ruins and waystones AFTER the depth rule, and
 * `materialAt` cannot see any of them — so the save needs a record of what the later stages put
 * where. The plot has no later stages: `plotMaterialAt` IS the whole world here, and it can simply
 * be asked again. An empty overrides map is the honest encoding of "nothing was added on top."
 */
export function generatePlotColumn(
  col: Column, seed: number, cfg: PlotConfig = DEFAULT_PLOT,
): Column {
  const { min, max } = plotYRange(cfg)
  const lo = Math.max(0, min)
  const hi = Math.min(col.sections.length * SECTION - 1, max)

  for (let z = 0; z < SECTION; z++) {
    for (let x = 0; x < SECTION; x++) {
      const wx = col.wx + x, wz = col.wz + z
      for (let y = lo; y <= hi; y++) {
        const m = plotMaterialAt(wx, y, wz, seed, cfg)
        if (m === 0) continue                       // sections start empty; skip the writes
        const s = (y / SECTION) | 0
        col.sections[s].set(x, y - s * SECTION, z, m)
      }
    }
  }
  refreshUniform(col)
  col.stage = Stage.Ready
  return col
}

/**
 * The value `recordEdit` must diff a plot cell against.
 *
 * ★★ DO NOT USE `column.ts`'s `generatedVoxel` INSIDE THE PLOT. This is the whole reason this
 * function exists, and the failure is silent and expensive.
 *
 * `generatedVoxel` falls back to `generatedAt` — the CONTINENT's depth rule — for every cell no
 * stage overrode. Asked about a plot column it would answer with whatever the endless world would
 * have generated at that coordinate: rock, air, a river bed, anything. The save is a DIFF against
 * generated material, and `recordEdit` stores a cell only where the new material differs from the
 * generated one. So every voxel of the island would read as different from its baseline, and **the
 * entire plot would be written into the save as player edits** — on first load, before the keeper
 * had touched anything.
 *
 * Two costs, and the second is the bad one: the save balloons by the whole island, and the terrain
 * FREEZES. Every future change to the plot's shape would be masked by a save full of edits that say
 * the old shape was deliberate. That is the same family as the bug that regrew chopped trees, where
 * the diff baseline disagreed with what was generated — only larger, and in the opposite direction.
 */
export function plotGeneratedVoxel(
  col: Column, lx: number, y: number, lz: number, seed: number, cfg: PlotConfig = DEFAULT_PLOT,
): number {
  return plotMaterialAt(col.wx + lx, y, col.wz + lz, seed, cfg)
}
