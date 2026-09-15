// Station models — the decor group: blocks that are not stations but took a model anyway.
// See `../station-models.ts` for the CONTRACT before editing.
import type { StationModel } from '../station-models'
import { MAT } from '../../voxel/depth'

export const MODELS: Readonly<Record<number, StationModel>> = {
  // ── MANA LANTERN (Alex, 09-15: "the lantern as well while we are here") ────────────────────────
  // Minecraft's lantern is a small caged glass body under a hook. Ours stands: a goldwood post with
  // a foot, the mana-glass head on top of it, a plank cap over that and a finial. The head wears the
  // lantern's own tile (plank frame around the diamond of glass — the tile's alpha IS the glow mask,
  // so the glass lights and the frame stays dead wood); post, foot, cap and finial wear goldwood
  // planks and are told `glow: 0` so the tile-alpha rule cannot light a post. The head sits at the
  // top of the cell because the light field reads the block's cell; a head at the crown puts the
  // visible glow where the floor's light already comes from.
  [MAT.MANA_LANTERN]: {
    note: 'a standing lantern: goldwood post on a foot, the mana-glass head at the crown, a cap and a finial',
    parts: [
      { box: [0.30, 0.06, 0.30, 0, 0.03, 0], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD, glow: 0 },   // foot
      { box: [0.10, 0.50, 0.10, 0, 0.31, 0], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD, glow: 0 },   // post
      { box: [0.34, 0.34, 0.34, 0, 0.73, 0] },                                                              // the head — the lantern's own tile, glowing glass
      { box: [0.40, 0.05, 0.40, 0, 0.925, 0], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD, glow: 0 }, // cap
      { box: [0.08, 0.05, 0.08, 0, 0.975, 0], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD, glow: 0 }, // finial
    ],
  },
}
