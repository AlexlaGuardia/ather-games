// ★ PURE. Rune Hold's terraces — the town climbs, as canon has it: *"Mountain village carved into hillside...
// Stone buildings stacked along winding streets"* (`world/rune-hold.md`).
//
// Alex, 2026-09-26, picking the shape: **climb north, gate at the top** — you arrive high on the north road and walk
// DOWN into the square; the Station sits lowest at the south end. In tiers (heights can't go below 0):
//   north road 3 → the Inn / Mug row 2 → the square 1 (the Landing, the Spirit Corner, the Bookstore, the Smithy)
//   → the south road down to the Station at 0.
//
// ★ WALKABLE BY CONSTRUCTION. The walker steps up at most one tier (`segs-collision` › stepUp 1) and eases onto
// the floor, so every change of level is a RAMP in quarter-tier steps — a street that slopes, never a ledge.
// A building stands LEVEL (one height for every cell of it: a roof does not tilt), and it takes the height of
// the ground at its door. `rune-hold-terraces.test.ts` checks both against the shipped grid.
//
// This BAKES the town's heights into `world/heightmaps.json` (the file the 3D sculpt tool writes), via
// `scripts/rune-hold-terraces.mts`. After that the json is the truth and Alex can sculpt on top of it.
import { blocksOf } from './rune-hold-look'

/** quarter-tier steps: small enough to read as a slope, big enough to read as laid steps */
export const TERRACE_STEP = 0.25

/** The town's ground level at row z, before buildings are levelled. */
export function groundAt(z: number): number {
  const ramp = (z0: number, z1: number, h0: number, h1: number) => h0 + (h1 - h0) * Math.min(1, Math.max(0, (z - z0) / (z1 - z0)))
  let h: number
  if (z <= 22) h = ramp(8, 22, 3, 2)          // the north road comes down from the gate
  else if (z <= 37) h = 2                      // the Inn / Mug row
  else if (z <= 43) h = ramp(37, 43, 2, 1)     // the square's north lip
  else if (z <= 78) h = 1                      // the square and its houses
  else h = ramp(78, 85, 1, 0)                  // the south road down to the Station
  return Math.round(h / TERRACE_STEP) * TERRACE_STEP
}

/** Heights for the whole town: ground by row, every building levelled to the ground at its door side. */
export function terraceHeights(grid: number[][], doors: { x: number; z: number }[]): number[][] {
  const H = grid.map((row, z) => row.map(() => groundAt(z)))
  for (const b of blocksOf(grid)) {
    // the door that belongs to this block, or its middle if it has none
    const d = doors.find(p => p.x >= b.x0 - 1 && p.x <= b.x1 + 1 && p.z >= b.z0 - 1 && p.z <= b.z1 + 1)
    const level = b.kind === 'hillside' ? null : groundAt(d ? d.z : Math.round((b.z0 + b.z1) / 2))
    if (level === null) continue    // the hillside is rock: it follows the ground under it
    for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) if ((grid[z][x] & 0xff) === 103) H[z][x] = level
  }
  return H
}
