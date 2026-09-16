// The Glade's column builder — the adapter between `glade.ts`'s ring math and a real `Column`.
//
// ★ THE GLADE IS THE WILDS, MASKED. Unlike the plot (`plot-column.ts`, which needs none of the
// continent's seven stages), the Glade needs ALL of them — its ground is the tended zone the
// continent already generates at (-150,-640), with the same trees, the same pool, the same stamped
// buildings the folk stand in. So this runs `generateColumn` unchanged and then applies the island
// mask on top: void past the coast, a cloud-wall ring, a keel of pressed cloud under the turf.
// Nothing the Wilds put inside the island moves by a block, which is what keeps every authored
// coordinate (Greg's, the folk's, the harness's) valid across the change.
//
// ⚠ THE MASK IS DECIDED PER COLUMN, APPLIED PER CELL. `gladeMaskAt` is pure in (x, z, h) plus an
// altitude band, so the walk below asks the ring questions once per (lx, lz) and only touches
// cells the mask actually changes — a column deep inside the island costs one keel band, a column
// in the void costs a clear.

import { Column, Stage, SECTION, refreshUniform, generateColumn, generatedVoxel, type ColumnConfig, DEFAULT_COLUMN } from './column'
import { DEFAULT_GLADE, gladePlanAt, gladeBandAt, gladeMaskAt, type GladeConfig } from './glade'

/**
 * Fill a column with the Glade's ground. Same post-conditions as `generateColumn` (uniform table
 * refreshed, stage `Ready`) so the host can switch on space at one call site.
 */
export function generateGladeColumn(
  col: Column, seed: number, colCfg: ColumnConfig = DEFAULT_COLUMN, cfg: GladeConfig = DEFAULT_GLADE,
): Column {
  generateColumn(col, seed, colCfg)
  const H = col.sections.length * SECTION
  for (let z = 0; z < SECTION; z++) {
    for (let x = 0; x < SECTION; x++) {
      const plan = gladePlanAt(col.wx + x, col.wz + z, seed, col.heightAt(x, z), cfg)
      if (plan.kind === 'inside' && plan.bottom <= 0) continue      // a keel that reaches the floor changes nothing
      // Only the band the plan can touch: the void clears everything, the wall is a strip, the
      // keel is everything under `floorTop`.
      const hi = plan.kind === 'inside' ? Math.min(H - 1, plan.floorTop - 1) : H - 1
      for (let y = 0; y <= hi; y++) {
        const m = gladeBandAt(plan, y, cfg)
        if (m === null) continue
        const s = (y / SECTION) | 0
        const ly = y - s * SECTION
        if (col.sections[s].get(x, ly, z) !== m) col.sections[s].set(x, ly, z, m)
      }
    }
  }
  refreshUniform(col)
  col.stage = Stage.Ready
  return col
}

/**
 * The value `recordEdit` must diff a Glade cell against — the Wilds' baseline with the same mask
 * over it. ★ Same rule, same reason as `plotGeneratedVoxel`: a baseline that disagrees with what
 * was generated writes the whole island into the save as player edits on first load.
 */
export function gladeGeneratedVoxel(
  col: Column, lx: number, y: number, lz: number, seed: number, cfg: GladeConfig = DEFAULT_GLADE,
): number {
  const m = gladeMaskAt(col.wx + lx, y, col.wz + lz, seed, col.heightAt(lx, lz), cfg)
  if (m !== null) return m
  return generatedVoxel(col, lx, y, lz, seed)
}
