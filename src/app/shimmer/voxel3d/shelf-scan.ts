// The shelf fungus scan (2026-09-21): where the trunk-side plants are, and which face they hang from.
//
// ★ WHY A SECOND SCAN EXISTS. The flora renderer's one source of plants is `plantProbe(x, z)`: walk
// a column to its live ground, report the plant voxel standing ON it. That is the right shape for
// everything that grows up out of a ground — and the wrong shape, by construction, for a bracket
// hanging off a trunk three blocks up: the probe stops at h+1 and never looks higher, and the same
// (x, z) may hold a tuft at h+1 AND a shelf at h+3, which one-plant-per-column cannot say. So the
// shelf has its own reader. It reads the WORLD (the column's cells), not the tree field — a felled
// trunk, a mined bracket, an edit that moved the ground are all already in the cells, and asking
// `shelfStackFor` again would draw brackets on trees that are no longer there.
//
// ★ THE FACE COMES FROM THE LOG BESIDE IT, the way a deadfall log's axis comes from its neighbour
// (`VoxelWorld.plantProbe`): the world holds the answer. A bracket with no log on any side (the
// trunk was felled under it) still reports, on a default face — it is a voxel, it can be picked,
// and drawing what the world holds beats hiding it. NEXT: the felling cleanup that drops it.
import type { Column } from '../voxel/column'
import { SECTION } from '../voxel/column'
import { MAT } from '../voxel/depth'
import { isLogMat } from '../voxel/trees'

/** A shelf cell: world coordinates and the face it hangs from — the unit step from the cell TOWARD the log. */
export interface ShelfCell { x: number; y: number; z: number; face: number }

/** face index → (dx, dz) from the bracket's cell to the trunk it hangs on. Index 0 is the default. */
export const SHELF_FACES: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/**
 * Every shelf fungus in one column. Linear over the column's cells (a Uint16 compare per cell —
 * a 16×16×H column is a few tens of thousands, well under a millisecond), cached per column by the
 * renderer exactly as the ground spots are. `voxel` reads across the column's edge for the face:
 * a bracket on a border cell hangs on a trunk that may live in the next column.
 */
export function scanShelves(
  col: Column, x0: number, z0: number, voxel: (x: number, y: number, z: number) => number,
): ShelfCell[] {
  const out: ShelfCell[] = []
  for (let si = 0; si < col.sections.length; si++) {
    const sec = col.sections[si]
    const d = sec.data
    for (let i = 0; i < d.length; i++) {
      if (d[i] !== MAT.SHELF_FUNGUS) continue
      // idx = (y * S + z) * S + x — `Section.idx`, unrolled.
      const lx = i % SECTION
      const lz = ((i / SECTION) | 0) % SECTION
      const ly = (i / (SECTION * SECTION)) | 0
      const x = x0 + lx, y = si * SECTION + ly, z = z0 + lz
      let face = 0
      for (let f = 0; f < SHELF_FACES.length; f++) {
        const [dx, dz] = SHELF_FACES[f]
        if (isLogMat(voxel(x + dx, y, z + dz))) { face = f; break }
      }
      out.push({ x, y, z, face })
    }
  }
  return out
}
