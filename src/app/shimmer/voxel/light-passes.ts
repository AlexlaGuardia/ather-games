// What light passes through — ONE rule, imported by the host's flood and by the tests that model it.
//
// ── ★ PIECES PASS LIGHT (Alex, 2026-09-12: "the block under it is still getting that heavy
// shadow.. its not very realistic") ─────────────────────────────────────────────────────────────
// A placed piece writes `STRUCTURE` into the grid so collision is free, and the light flood read
// that cell as a solid block: the sky column stopped at a fence post, the cell went to 0, and the
// grass under a 0.26-wide upright was lit as if a boulder sat on it. Every piece is thinner than
// its cell (a doorway and a window are literally holes), so the honest answer at cell resolution
// is that light goes through. A half-thick wall will not cast a shadow; that is the cheaper wrong
// than a post that blacks out its footprint, and it is the same call the leaves make.
//
// ⚠ THIS USED TO BE A HAND-KEPT SET IN `VoxelWorld.tsx` WITH A COPY IN `hollow-wind.test.ts`.
// Two copies agree until one is edited. The host and the test now import this.
import { AIR } from './section'
import { MAT } from './depth'
import { WOOD } from './trees'
import { STRUCTURE, STRUCTURE_HALF } from './pieces'

/** Non-air materials light still passes through: foliage, and the pieces (see above). */
export const LIGHT_PASSES: ReadonlySet<number> = new Set<number>([
  WOOD.GOLDWOOD_LEAVES, WOOD.SHIMMEROAK_LEAVES, WOOD.STARWILLOW_LEAVES, WOOD.DAWNWOOD_LEAVES,
  STRUCTURE, STRUCTURE_HALF,
  // Glass (2026-09-12): the whole point of it.
  MAT.GLASS,
])

/** light.ts's `opaque` contract: air, water, foliage and pieces pass; everything else stops. */
export const lightOpaque = (m: number): boolean => m !== AIR && m !== MAT.WATER && !LIGHT_PASSES.has(m)
