// The stations' MODELS — what a station looks like when it is not a cube.
//
// ★ PURE. No three, no DOM. A model is a list of axis-aligned boxes inside the unit cell; the
// renderer (`station-mesh.ts`) merges them into one geometry per material and instances it at every
// cell that holds that material. Nothing outside this file knows what a station looks like, which
// is the piece renderer's own rule and the reason a GLTF could replace any entry here in one line.
//
// ── ★ WHY MODELS AND NOT PIECES (2026-09-15, Alex: "they don't have to make it a block.. take a
//    look at how minecraft does theirs for inspiration") ─────────────────────────────────────────
// Minecraft's cauldron, brewing stand, grindstone, stonecutter and campfire are all one BLOCK ID
// whose model is not a cube. That is exactly the split this file makes: the station stays a
// material (identity, jobs, mining, salvage, light — untouched), and only the LOOK changes. Making
// them pieces would have re-keyed every job, every interact rule and every save on STRUCTURE
// occupancy for no gain the eye can see.
//
// ── THE CONTRACT (what an agent writing a model must honour) ──────────────────────────────────
//   · The cell is x ∈ [-0.5, 0.5], y ∈ [0, 1], z ∈ [-0.5, 0.5]; +y is up. The cell's floor is y=0.
//   · A box is `[w, h, d, cx, cy, cz]` — full size and CENTRE, like `BoxGeometry` + translate.
//   · Every box stays inside the cell (asserted): the cell is what you collide with and mine, and
//     a model that leaks into the neighbour is the "invisible wall" failure `pieces.ts` warns of.
//   · `top` / `side` name the MATERIAL whose tile a box wears on its up-face / other faces. Default
//     is the station's own tiles. Any `TILE_MATERIALS` id is valid — the still's bulb wears GLASS,
//     the mortar's pestle wears the stonecutter's grey, the cauldron's brew wears CAULDRON_LIT's top.
//   · No facing: a station is looked at from every side, like the oven and hearth tiles already are.
//   · Read something before you write: the tile it wears is painted in `tex/tiles.ts` and its
//     substance is ruled (no metal anywhere — `world/ather.md`; the alchemy vessels in
//     `design-briefs/shimmer-alchemy-vessels.md`; the three fires in `world/ather.md` › What heat).
//   · Faces are sampled by LOCAL POSITION (the piece shader's rule): a thin box shows a SLICE of its
//     tile, not a shrunken copy of it. The tile's centre sits at the cell's centre (x=0, z=0) and its
//     top row at y=1, so a box centred in the cell wears the middle of its tile's picture (the mouth,
//     the bulb, the fire) and a box in a corner wears the picture's edge. Pick the tile for its colour
//     and grain, or place the box where the picture is.
import { MAT } from '../voxel/depth'
import { MODELS as WORKSHOP } from './station-models/workshop'
import { MODELS as ALCHEMY } from './station-models/alchemy'
import { MODELS as FIRES } from './station-models/fires'

/** `[w, h, d, cx, cy, cz]` — size and centre, cell-local. */
export type Box = readonly [number, number, number, number, number, number]

export interface ModelPart {
  box: Box
  /** Material whose TOP tile the +y face wears. Default: the station's own. */
  top?: number
  /** Material whose SIDE tile the other faces wear. Default: the station's own. */
  side?: number
}

export interface StationModel {
  parts: readonly ModelPart[]
  /** One line on what the model is, for the readout. */
  note: string
}

/** The plain cube a station draws until it has a model — its own tiles, the block it was. */
export const CUBE: StationModel = { parts: [{ box: [1, 1, 1, 0, 0.5, 0] }], note: 'a cube, the block it was' }

/**
 * Every modelled material's model. ⚠ An id in `MODELLED_MATS` (depth.ts) with no entry here draws
 * `CUBE`, never nothing. Fill an entry to give the station its shape.
 */
export const STATION_MODELS: Readonly<Record<number, StationModel>> = {
  // One file per group so three hands can model at once without touching one another's lines:
  //   workshop.ts — bench, sawmill, stonecutter · alchemy.ts — mortar, still, bowl, cauldron (+lit)
  //   fires.ts — oven, hearth, kiln
  ...WORKSHOP, ...ALCHEMY, ...FIRES,
}

export const modelOf = (material: number): StationModel => STATION_MODELS[material] ?? CUBE

/** Is every box of the model inside the unit cell? The one invariant the renderer relies on. */
export function modelFits(m: StationModel, eps = 1e-6): { ok: boolean; bad: number[] } {
  const bad: number[] = []
  m.parts.forEach((p, i) => {
    const [w, h, d, x, y, z] = p.box
    if (w <= 0 || h <= 0 || d <= 0) { bad.push(i); return }
    if (x - w / 2 < -0.5 - eps || x + w / 2 > 0.5 + eps) { bad.push(i); return }
    if (y - h / 2 < 0 - eps || y + h / 2 > 1 + eps) { bad.push(i); return }
    if (z - d / 2 < -0.5 - eps || z + d / 2 > 0.5 + eps) { bad.push(i); return }
  })
  return { ok: bad.length === 0, bad }
}

// Re-exported so a model file can name tiles without a second import path.
export { MAT }
