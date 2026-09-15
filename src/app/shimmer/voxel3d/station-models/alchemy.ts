// Station models — the alchemy group (Mortar · Still · Bowl · Cauldron, +lit). See
// `../station-models.ts` for the CONTRACT before editing. Substance per `CANON_GAPS.md`'s RULED
// 2026-09-15 entry: Mortar = stone, Still = glass bulb on a fired-clay foot, Bowl = fired clay
// (wide, shallow, cold), Cauldron = fired clay (brews). No metal anywhere in this world.
import type { StationModel } from '../station-models'
import { MAT } from '../../voxel/depth'

export const MODELS: Readonly<Record<number, StationModel>> = {
  // ── MORTAR (MAT.GRINDER) — a stone bowl on a narrow foot, a pestle leaning off-centre ─────────
  [MAT.GRINDER]: {
    note: 'stone mortar: foot/body/rim bowl stack with a pestle leaning off-centre above the rim',
    parts: [
      { box: [0.35, 0.12, 0.35, 0, 0.06, 0] },   // narrow foot
      { box: [0.50, 0.15, 0.50, 0, 0.195, 0] },  // lower body, widening
      { box: [0.62, 0.15, 0.62, 0, 0.345, 0] },  // upper body, widening again
      { box: [0.70, 0.13, 0.70, 0, 0.485, 0] },  // rim, ~0.55 tall total, ~0.7 wide
      { box: [0.09, 0.50, 0.09, 0.18, 0.65, 0.12] },  // pestle shaft, off-centre, well clear of the rim (0.55)
      { box: [0.13, 0.10, 0.13, 0.18, 0.92, 0.12] },  // pestle head, the rounded striking tip
    ],
  },

  // ── STILL (MAT.STILL) — fired-clay foot + neck, a hand-blown glass bulb with a spout and cup ──
  [MAT.STILL]: {
    note: 'brewing-stand silhouette: clay foot and neck, the glass bulb at the crown, a spout and a catch-cup',
    parts: [
      { box: [0.50, 0.16, 0.50, 0, 0.08, 0] },              // fired-clay foot
      { box: [0.32, 0.06, 0.32, 0, 0.19, 0] },               // stepped foot cap
      { box: [0.12, 0.34, 0.12, 0, 0.39, 0] },               // clay neck up to the bulb
      // ★ THE BULB WEARS THE STILL'S OWN TILE, NOT `MAT.GLASS` (hub, at merge): the window pane's tile is a
      // dark leaded lattice and a cube of it reads as coal. `paintStill`'s side tile is the clay base with
      // a PALE glass bulb painted in its UPPER rows — and a side face samples tile row (1 − local y), so
      // the glass shows on a box that lives in the top of the cell: y 0.55–1.0, measured on the shelf.
      { box: [0.45, 0.45, 0.45, 0, 0.775, 0] },  // the glass bulb — the still's own pale glass, at the crown
      { box: [0.14, 0.07, 0.08, 0.24, 0.62, 0] }, // spout off the bulb's foot
      { box: [0.13, 0.09, 0.13, 0.24, 0.07, 0] },            // tiny clay cup catching the drip, under 1.0 tall
    ],
  },

  // ── BOWL (MAT.MIXER) — a wide shallow clay dish, cold, sits flat on the floor ──────────────────
  [MAT.MIXER]: {
    note: 'wide shallow clay bowl: a two-tier disc base with a thin rim ring on four edges',
    parts: [
      { box: [0.70, 0.06, 0.70, 0, 0.03, 0] },     // lower disc
      { box: [0.80, 0.08, 0.80, 0, 0.10, 0] },     // upper disc, the dish floor
      { box: [0.80, 0.16, 0.09, 0, 0.22, -0.355] }, // rim, north edge
      { box: [0.80, 0.16, 0.09, 0, 0.22, 0.355] },  // rim, south edge
      { box: [0.09, 0.16, 0.80, 0.355, 0.22, 0] },  // rim, east edge
      { box: [0.09, 0.16, 0.80, -0.355, 0.22, 0] }, // rim, west edge — ~0.3 tall total
    ],
  },

  // ── CAULDRON (MAT.CAULDRON) — clay feet + an open-topped basin, hollow inside ───────────────────
  [MAT.CAULDRON]: {
    note: 'clay cauldron on four short feet, an open-topped basin (floor + four thin walls), no lid',
    parts: [
      { box: [0.15, 0.15, 0.15, 0.3, 0.075, 0.3] },     // foot, front-right
      { box: [0.15, 0.15, 0.15, 0.3, 0.075, -0.3] },    // foot, back-right
      { box: [0.15, 0.15, 0.15, -0.3, 0.075, 0.3] },    // foot, front-left
      { box: [0.15, 0.15, 0.15, -0.3, 0.075, -0.3] },   // foot, back-left
      { box: [0.70, 0.06, 0.70, 0, 0.18, 0] },          // basin floor, resting on the feet
      { box: [0.70, 0.65, 0.08, 0, 0.475, -0.35] },     // basin wall, north
      { box: [0.70, 0.65, 0.08, 0, 0.475, 0.35] },      // basin wall, south
      { box: [0.08, 0.65, 0.70, 0.35, 0.475, 0] },      // basin wall, east
      { box: [0.08, 0.65, 0.70, -0.35, 0.475, 0] },     // basin wall, west — top open, ~0.8 wide
    ],
  },

  // ── CAULDRON_LIT (MAT.CAULDRON_LIT) — the same cauldron, plus the brew surface at the rim ─────
  [MAT.CAULDRON_LIT]: {
    note: 'the cauldron with clay walls/feet plus a brew slab under the rim wearing the golden top tile',
    parts: [
      { box: [0.15, 0.15, 0.15, 0.3, 0.075, 0.3], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.15, 0.15, 0.15, 0.3, 0.075, -0.3], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.15, 0.15, 0.15, -0.3, 0.075, 0.3], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.15, 0.15, 0.15, -0.3, 0.075, -0.3], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.70, 0.06, 0.70, 0, 0.18, 0], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.70, 0.65, 0.08, 0, 0.475, -0.35], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.70, 0.65, 0.08, 0, 0.475, 0.35], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.08, 0.65, 0.70, 0.35, 0.475, 0], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.08, 0.65, 0.70, -0.35, 0.475, 0], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.60, 0.04, 0.60, 0, 0.7, 0], top: MAT.CAULDRON_LIT, side: MAT.CAULDRON }, // the brew, just under the rim
    ],
  },
}
