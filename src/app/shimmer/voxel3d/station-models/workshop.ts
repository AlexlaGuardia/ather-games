// Station models — the workshop group. See `../station-models.ts` for the CONTRACT before editing.
// Fill `MODELS` with one entry per material; an id left out draws as a cube until it has a model.
import type { StationModel } from '../station-models'
import { MAT } from '../../voxel/depth'

export const MODELS: Readonly<Record<number, StationModel>> = {
  // ── THE BENCH (MAT.CRAFT_TABLE) — the box-frame lane's first sculpt ─────────────────────────
  // ★ WAS EIGHT BOXES UNTIL 2026-09-22, AND ITS LEGS WERE STANDING IN THE WRONG STRIPE. A side
  // face samples tile u from LOCAL position and local = cell + 0.5, so the vertical stripe a tile
  // paints at u < 1/8 lands at cell x < -0.375 and nowhere else. `paintCraftTable`'s SIDE tile is a
  // rail band across the top quarter, CORNER LEGS at the outer eighth (`x < b || x >= size - b`,
  // b = size/8) and a recessed panel between them. The box model's legs sat at cx ±0.30, spanning
  // cell 0.25..0.35 — local 0.75..0.85, which is PANEL: the legs wore the recessed shading and the
  // dark leg stripes the tile paints landed on the slab and the apron instead. The sculpt's legs
  // are at ±0.4325 (local 0.885..0.980), so a leg wears the leg. Same family as the cauldron's
  // hearth course — the picture was already right and the geometry was not standing in it.
  //
  // What else the sculpt buys over the boxes: every upright corner is chamfered (a vertical
  // chamfer's normal is HORIZONTAL, so it cannot flip past the 60-degree cone — it is free), the
  // legs are shaved to 0.82 at the foot, the slab's top edge is rolled, two stretchers brace the
  // legs where a bench is braced, and each stick sits a few thousandths off square so two benches
  // on a plot are siblings rather than one bench drawn twice.
  // `scripts/models/frame.py`, `npm run bake:props`. 352 tris.
  [MAT.CRAFT_TABLE]: {
    note: 'a made workbench: chamfered slab on shaved corner legs, braced, a mallet and chisel left on top',
    parts: [],
    sculpt: {
      model: 'bench',
      // ★ EVERY NODE NAMES `top: MAT.CRAFT_TABLE`, WHICH IS THE DEFAULT, AND SAYING IT IS THE
      // POINT. `station-sculpt.test.ts` §2 refuses a mixed part that leaves its top tile unnamed,
      // because the default is the STATION'S OWN and a cauldron's own top is dark water — a pot
      // that defaults gets water painted across its shoulder. Here the default is genuinely right:
      // the bench's top tile is the worked plank surface with the etched work-square, which is
      // what a bench's up-faces should be, including the slab's rolled edge (it reads as the top
      // turning over) and the leg tops the slab hides. A frame is made of sticks and every stick
      // has a cap, so these nodes run 43-64% up-facing — high enough that the guard is right to
      // ask, and the answer is written here rather than left to a default that means something
      // else three blocks away. The tools wear the same wood, which is also the canon-safe answer
      // (`world/ather.md`: no metal anywhere).
      parts: [
        { node: 'Top', top: MAT.CRAFT_TABLE },
        { node: 'Frame', top: MAT.CRAFT_TABLE },
        { node: 'Tools', top: MAT.CRAFT_TABLE },
      ],
    },
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
