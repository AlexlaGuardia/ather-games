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

  // ── CAULDRON (MAT.CAULDRON) — a bellied clay pot on four feet, a rim, the water seen from above ──
  // ★ REBUILT 09-15 PM (Alex: "the cauldron looks off, fix the walls"). The first pass was four thin
  // walls on a floor slab — a crate. A cauldron is a BELLY: the pot swells at the middle and narrows to
  // a neck and a rim. The tile helps and hurts: `paintCauldron`'s side is rim band (top ~12%) · clay
  // belly · a dark stone hearth course (bottom ~25%), sampled by local height — so thin walls wore the
  // stone course as a grey skirt and the feet wore it whole. Now the tiers sit where the bands are:
  // the wide belly and neck in the plain clay rows, the lower belly and feet down in the stone course
  // (a pot standing on its hearth ring), the rim in the top 14% where the tile's rim band is. The open top is a recessed disc wearing the cauldron's own top tile (dark
  // water); the lit twin swaps that one face for the brew.
  [MAT.CAULDRON]: {
    note: 'a bellied clay pot on four feet: lower belly, wide belly, neck, a rim you can see the water inside',
    parts: [
      { box: [0.14, 0.14, 0.14, 0.28, 0.07, 0.28] },      // feet
      { box: [0.14, 0.14, 0.14, 0.28, 0.07, -0.28] },
      { box: [0.14, 0.14, 0.14, -0.28, 0.07, 0.28] },
      { box: [0.14, 0.14, 0.14, -0.28, 0.07, -0.28] },
      { box: [0.66, 0.18, 0.66, 0, 0.23, 0] },            // lower belly
      { box: [0.82, 0.36, 0.82, 0, 0.50, 0] },            // the wide belly
      { box: [0.70, 0.18, 0.70, 0, 0.77, 0] },            // neck
      { box: [0.76, 0.14, 0.08, 0, 0.93, -0.34] },                                          // rim, four walls — the tile's rim band
      { box: [0.76, 0.14, 0.08, 0, 0.93, 0.34] },
      { box: [0.08, 0.14, 0.76, -0.34, 0.93, 0] },
      { box: [0.08, 0.14, 0.76, 0.34, 0.93, 0] },
      { box: [0.60, 0.02, 0.60, 0, 0.87, 0] },                            // the water, recessed inside the rim (top = the cauldron's own dark disc)
    ],
  },

  // ── CAULDRON_LIT (MAT.CAULDRON_LIT) — the same pot, the brew where the water was ─────────────
  [MAT.CAULDRON_LIT]: {
    note: 'the same bellied pot, the golden brew standing in the rim',
    parts: [
      { box: [0.14, 0.14, 0.14, 0.28, 0.07, 0.28], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.14, 0.14, 0.14, 0.28, 0.07, -0.28], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.14, 0.14, 0.14, -0.28, 0.07, 0.28], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.14, 0.14, 0.14, -0.28, 0.07, -0.28], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.66, 0.18, 0.66, 0, 0.23, 0], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.82, 0.36, 0.82, 0, 0.50, 0], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.70, 0.18, 0.70, 0, 0.77, 0], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.76, 0.14, 0.08, 0, 0.93, -0.34], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.76, 0.14, 0.08, 0, 0.93, 0.34], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.08, 0.14, 0.76, -0.34, 0.93, 0], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.08, 0.14, 0.76, 0.34, 0.93, 0], top: MAT.CAULDRON, side: MAT.CAULDRON },
      { box: [0.60, 0.02, 0.60, 0, 0.90, 0], top: MAT.CAULDRON_LIT, side: MAT.CAULDRON },   // the brew, a touch higher — it is boiling
    ],
  },
}
