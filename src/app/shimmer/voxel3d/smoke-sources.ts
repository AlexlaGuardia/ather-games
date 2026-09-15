// Chimney smoke — the pure half. WHERE smoke is born, asked of the loaded columns themselves.
//
// Fennel's R5 (`scripts/blueprint-fennel.mts`): "smoke keyed on a HEARTH (engine-side)". The block
// carries no smoke state of its own — `registry.ts` › HEARTH says fuel is not modelled and it burns
// because it is a hearth — so the world is the source of truth: a hearth exists where a HEARTH
// block sits, whether a blueprint stamped it or a keeper set one down last frame. That rules out
// keying on the placement table (a hand-placed hearth would never smoke) and rules IN a scan of
// the column data, which is what this file does. `smoke.ts` is the GPU half and knows nothing
// about columns or materials; it is handed a list of cells and rises from them.
//
// ★ THE FLUE. Smoke is not born on the fire, it is born where the fire's stack OPENS. Fennel's
// hearth sits under a lintel, a mantel course and a chimney column that runs through the roof
// (`blueprint-fennel.mts` › the hearth), so smoke from the block itself would rise into stone and
// vanish. `flueTop` walks up from the source through every non-air cell and returns the first
// open one — the chimney cap for a built hearth, the block's own top for an oven (its smoke hole
// is painted there, `tiles.ts` › paintOven) or a hearth standing in the open. Capped at
// `FLUE_MAX` so a hearth buried under a mountain smokes from nowhere rather than the summit.
//
// ★ THE SCAN IS CHEAP BECAUSE OF THE UNIFORM TABLE, AND HONEST BECAUSE THE HOST REFRESHES IT.
// `Column.uniform[i]` is -1 for a mixed section and the single value otherwise; the mesher's skip
// reads the same table, which is why every edit path in `VoxelWorld.tsx` calls `refreshUniform`
// (5814, 5856, 6009). A section that is all air or all stone is skipped in O(1); only mixed
// sections are walked, and a 16³ walk for two values is a tight typed-array loop.

import { MAT } from '../voxel/depth'
import { SECTION, type Column } from '../voxel/column'
import { AIR } from '../voxel/section'

/** Blocks that smoke. The hearth and the oven are "always burning" in the registry, no fuel state;
 *  the RUNNING cauldron (2026-09-14) steams — its material is its state, so it joins and leaves this
 *  set by being swapped in and out (`alchemy-chain.ts`). One plume look for all three today. */
export const SMOKE_MATS: ReadonlySet<number> = new Set<number>([MAT.HEARTH, MAT.OVEN, MAT.CAULDRON_LIT])

/** How far up a flue may run before the smoke gives up and is born on the source. */
export const FLUE_MAX = 32

/** A smoking cell: the block, and the open cell above its stack where the smoke is born. */
export interface SmokeSource {
  x: number; y: number; z: number
  /** World y of the first open cell above the source's stack — where a puff spawns. */
  top: number
}

/**
 * First open cell at or above `y0 + 1`, walking up through solid. `solidAt(y)` answers for the
 * source's own (x,z). Returns `y0 + 1` when the cell straight above is open (an oven, an open
 * hearth) and `y0 + 1` again when the stack exceeds `FLUE_MAX` — the fallback is the block's top,
 * never the summit of whatever it is buried under.
 */
export function flueTop(solidAt: (y: number) => boolean, y0: number, limit = FLUE_MAX): number {
  let y = y0 + 1
  const stop = y0 + 1 + limit
  while (y < stop && solidAt(y)) y++
  return y >= stop ? y0 + 1 : y
}

/**
 * Append every smoking cell in `col` to `out`. `voxelAt` is the host's world-coordinate reader,
 * used for the flue walk only — one reader for the walk is simpler than teaching this file the
 * section layout twice. `col.wx`/`col.wz` are the column's WORLD corner (`makeColumn(gx * SECTION,
 * …)`), not its index.
 */
export function columnSmokeSources(
  col: Column,
  voxelAt: (x: number, y: number, z: number) => number,
  out: SmokeSource[],
): void {
  const n = col.sections.length
  for (let i = 0; i < n; i++) {
    const u = col.uniform[i]
    if (u !== -1 && !SMOKE_MATS.has(u)) continue
    const data = col.sections[i].data
    const base = i * SECTION
    for (let j = 0; j < data.length; j++) {
      const m = data[j]
      if (!SMOKE_MATS.has(m)) continue
      // idx = (y * size + z) * size + x — section.ts's layout, unpacked.
      const lx = j % SECTION
      const lz = ((j / SECTION) | 0) % SECTION
      const ly = (j / (SECTION * SECTION)) | 0
      const x = col.wx + lx, y = base + ly, z = col.wz + lz
      out.push({ x, y, z, top: flueTop(yy => voxelAt(x, yy, z) !== AIR, y) })
    }
  }
}
