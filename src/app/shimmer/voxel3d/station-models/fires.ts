// Station models — the fires group. See `../station-models.ts` for the CONTRACT before editing.
// Fill `MODELS` with one entry per material; an id left out draws as a cube until it has a model.
//
// Canon (`athernyx/CANON/world/ather.md` › "What heat is here") rules the substance for all three:
// NO METAL anywhere (no grate, no iron door, no chain — pegged and lashed like everything else).
// The oven is a dome of dressed stone with an arched mouth. The hearth is a stone firebox, the open
// fire you cook OVER. The kiln is "a low round dome of the very material it fires (clay),
// soot-darkened at the mouth, ash beneath it, a clay damper." Every box below defaults to its own
// station's tiles; `tex/tiles.ts` already paints the SIDE tile with the mouth/fire picture and the
// TOP tile with the dome/embers, so the boxes exist to let those faces show, not to add new art.
import { MAT } from '../../voxel/depth'
import type { StationModel } from '../station-models'

export const MODELS: Readonly<Record<number, StationModel>> = {
  // ── HEARTH — a low stone firebox, open on every side (no facing, so no single "front"). A
  // centre spine stands in for the back wall so the ember bed and flames read from both directions
  // instead of only one; the two cheeks are the firebox's short side walls. Walls are kept knee-low
  // (first pass had them nearly full-height and it read as a stone tower, not an open fire you cook
  // over) so the flame tongues rise clear above the stonework and stay the thing the eye lands on.
  [MAT.HEARTH]: {
    note: 'a low cobble firebox: base slab, knee-high centre spine + two cheeks, ember bed, fire IN the box between the cheeks',
    parts: [
      // ★ THE STONEWORK WEARS COBBLE, NOT THE HEARTH TILE (hub, at merge): the hearth's SIDE tile IS the
      // fire picture, so a cheek wearing it is a wall on fire — the first pass read as a burning castle.
      // Only the flame boxes and the ember bed wear the fire; the stone is the cobble the recipe lays.
      // ★ AND THE FLAMES SIT WHERE THE TILE'S FIRE IS: the fire in `paintHearth`'s side tile lies in the
      // tile's lower-middle, so the flame boxes live IN the box at knee height, cresting just over the
      // cheeks — which is what an open hearth looks like anyway.
      { box: [0.9, 0.2, 0.9, 0, 0.1, 0], top: MAT.COBBLESTONE, side: MAT.COBBLESTONE },                 // base slab
      { box: [0.15, 0.36, 0.85, 0, 0.38, 0], top: MAT.COBBLESTONE, side: MAT.COBBLESTONE },              // centre spine (stands in for the back wall)
      { box: [0.15, 0.3, 0.85, -0.375, 0.35, 0], top: MAT.COBBLESTONE, side: MAT.COBBLESTONE },          // left cheek
      { box: [0.15, 0.3, 0.85, 0.375, 0.35, 0], top: MAT.COBBLESTONE, side: MAT.COBBLESTONE },           // right cheek
      { box: [0.6, 0.06, 0.6, 0, 0.23, 0], top: MAT.HEARTH, side: MAT.COBBLESTONE },                    // ember bed — its top IS the ember tile
      // The flames stand near the cell's axis, where the tile's fire is (the tile's centre = the cell's).
      { box: [0.2, 0.36, 0.2, 0.14, 0.41, -0.12], side: MAT.HEARTH, top: MAT.HEARTH },    // flame, off-centre
      { box: [0.16, 0.3, 0.16, -0.14, 0.38, 0.13], side: MAT.HEARTH, top: MAT.HEARTH },   // flame, the other side of the spine
      { box: [0.14, 0.26, 0.14, 0.16, 0.36, 0.16], side: MAT.HEARTH, top: MAT.HEARTH },   // flame, small
      { box: [0.12, 0.22, 0.12, -0.15, 0.34, -0.16], side: MAT.HEARTH, top: MAT.HEARTH }, // flame, smallest
    ],
  },

  [MAT.OVEN]: {
    note: 'a stone dome in four shrinking tiers, the smoke hole at the crown',
    parts: [
      { box: [0.9, 0.35, 0.9, 0, 0.175, 0] },   // base tier — its side carries the arched mouth
      // ★ UPPER TIERS WEAR PLAIN CUT STONE (hub, at merge): a tier wearing the oven's own side tile repeats
      // the mouth on every face at every height — six mouths on one oven. The mouth belongs to the base.
      // Sides in stone brick (the dome is laid dressed stone, and the oven's own side tile is the mouth);
      // tops in the oven's own dome tile, whose centre is the smoke hole — it shows on the cap's crown.
      { box: [0.75, 0.25, 0.75, 0, 0.475, 0], top: MAT.OVEN, side: MAT.STONE_BRICK }, // second tier
      { box: [0.55, 0.15, 0.55, 0, 0.675, 0], top: MAT.OVEN, side: MAT.STONE_BRICK }, // third tier
      { box: [0.34, 0.1, 0.34, 0, 0.8, 0], top: MAT.OVEN, side: MAT.STONE_BRICK },    // cap — its top carries the smoke hole
    ],
  },

  // ── KILN — wider and squatter than the oven: three low tiers (no chimney; a kiln vents through
  // its damper, not a stack), a clay damper knob seated in the crown, and a thin ash lip spilling
  // out toward the cell edge from the stoke hole painted into the base tier's SIDE tile.
  [MAT.KILN]: {
    note: 'a low squat clay dome in three tiers, damper knob on the crown, ash lip at the mouth',
    parts: [
      { box: [0.95, 0.3, 0.95, 0, 0.15, 0] },    // base tier — its side carries the stoke-hole mouth
      // ★ UPPER TIERS WEAR THE BOWL'S PLAIN CLAY (hub, at merge) — same fired earth, no mouth on it.
      // (top = the kiln's own dome tile: plain clay outside the damper ring; side = the bowl's plain clay)
      { box: [0.8, 0.25, 0.8, 0, 0.425, 0], top: MAT.KILN, side: MAT.MIXER },    // second tier
      { box: [0.55, 0.2, 0.55, 0, 0.65, 0], top: MAT.KILN, side: MAT.MIXER },    // third tier, squatter than the oven's equivalent
      { box: [0.2, 0.08, 0.2, 0, 0.79, 0], top: MAT.KILN }, // clay damper knob
      { box: [0.5, 0.04, 0.08, 0, 0.02, 0.46], side: MAT.KILN, top: MAT.KILN }, // ash lip at the cell edge
    ],
  },
}
