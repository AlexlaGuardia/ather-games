// Station models — the workshop group. See `../station-models.ts` for the CONTRACT before editing.
// Fill `MODELS` with one entry per material; an id left out draws as a cube until it has a model.
import type { StationModel } from '../station-models'
import { MAT } from '../../voxel/depth'

export const MODELS: Readonly<Record<number, StationModel>> = {
  // The Bench — a real workbench, not Minecraft's cube: thick top, apron, four legs, tools left on
  // top. Built in the same box-table style as `piece-mesh.ts`'s `case 'table'`, just heavier and
  // carrying a mallet head + a chisel so it reads as WORKED, not as furniture.
  [MAT.CRAFT_TABLE]: {
    parts: [
      { box: [0.86, 0.14, 0.86, 0, 0.87, 0] },      // the top slab
      { box: [0.70, 0.10, 0.70, 0, 0.75, 0] },       // the apron, flush under the top
      { box: [0.10, 0.70, 0.10, -0.30, 0.35, -0.30] }, // four square legs, flush under the apron
      { box: [0.10, 0.70, 0.10, 0.30, 0.35, -0.30] },
      { box: [0.10, 0.70, 0.10, -0.30, 0.35, 0.30] },
      { box: [0.10, 0.70, 0.10, 0.30, 0.35, 0.30] },
      { box: [0.16, 0.05, 0.10, 0.20, 0.965, -0.15] }, // mallet head, left on the bench
      { box: [0.24, 0.025, 0.045, -0.18, 0.9525, 0.18] }, // chisel, laid flat
    ],
    note: 'thick-topped workbench with an apron, four legs, and a mallet + chisel left on top',
  },

  // The Sawmill — the stonecutter's shape, not the cube: a low plinth carrying a thin vertical
  // circular-saw stand-in with a log cradle (two rails) either side of it, matching `paintSawmill`'s
  // bed-line/leg silhouette on the SIDE tile.
  [MAT.SAWMILL]: {
    parts: [
      { box: [0.90, 0.12, 0.90, 0, 0.44, 0] },        // plinth top
      { box: [0.76, 0.08, 0.76, 0, 0.34, 0] },         // apron, flush under the plinth top
      { box: [0.10, 0.30, 0.10, -0.33, 0.15, -0.33] }, // four legs, flush under the apron
      { box: [0.10, 0.30, 0.10, 0.33, 0.15, -0.33] },
      { box: [0.10, 0.30, 0.10, -0.33, 0.15, 0.33] },
      { box: [0.10, 0.30, 0.10, 0.33, 0.15, 0.33] },
      { box: [0.06, 0.46, 0.46, 0, 0.73, 0] },         // the saw, rising from the plinth's middle
      { box: [0.70, 0.08, 0.08, 0, 0.54, -0.27] },     // log cradle: two rails either side of the saw
      { box: [0.70, 0.08, 0.08, 0, 0.54, 0.27] },
    ],
    note: 'low plinth with a thin vertical saw at the middle and a two-rail log cradle beside it',
  },

  // The Stonecutter — Minecraft's own reference: a half-height slab nearly filling the cell, a raised
  // rim on all four sides (its actual block model has one), and a thin vertical blade at the centre.
  // The blade wears no override — it is the station's own STONECUTTER tile (stone/crystal, no metal).
  [MAT.STONECUTTER]: {
    parts: [
      { box: [0.94, 0.34, 0.94, 0, 0.17, 0] },   // the slab
      { box: [0.94, 0.16, 0.08, 0, 0.42, 0.43] }, // raised rim, all four sides
      { box: [0.94, 0.16, 0.08, 0, 0.42, -0.43] },
      { box: [0.08, 0.16, 0.78, 0.43, 0.42, 0] },
      { box: [0.08, 0.16, 0.78, -0.43, 0.42, 0] },
      { box: [0.14, 0.10, 0.14, 0, 0.55, 0] },   // the axle the blade pivots on
      { box: [0.06, 0.38, 0.50, 0, 0.69, 0] },   // the blade, rising from the centre
    ],
    note: 'half-height rimmed slab with a stone blade pivoting up from an axle at its centre',
  },
}
