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

  // ── CAULDRON (MAT.CAULDRON) — a THROWN POT, the lane's first sculpt ──────────────────────────
  // ★ WAS TWELVE BOXES UNTIL 2026-09-22, AND THE BOXES WERE NEVER A STYLE CHOICE. The 09-15
  // rebuild (Alex: "the cauldron looks off, fix the walls") stacked four tiers — lower belly, wide
  // belly, neck, rim — hand-fitted to the horizontal BANDS of `paintCauldron`'s side tile, which
  // is rim in the top 12.5% (`size >> 3`), plain clay through the middle, and a dark stone HEARTH
  // COURSE in the bottom 25% (`size / 4`), sampled by local height. A lathe gets that continuously
  // and for free: the pot darkens into its hearth ring at the foot and brightens at the lip with
  // no step where one tier ends. `scripts/models/cauldron.py`, `npm run bake:props`.
  //
  // ★ `top: MAT.KILN` ON THE BODY IS LOAD-BEARING, NOT A DETAIL. The piece program picks its tile
  // with a HARD branch — `an.y > 0.5 ? vLayerTop : vLayerSide` — and `an.y > 0.5` is a 60-degree
  // cone about vertical, not a dominant-axis test. So the rim's annulus, the inner floor, the base
  // underside and any facet whose wall tips past ~30 degrees off plumb all read `top`. The
  // cauldron's OWN top tile is the dark water disc, so leaving it default paints water across the
  // pot's shoulder and lip. KILN's top is plain fired clay — the same fix the box rim walls used.
  // (The profile keeps every wall under the cone anyway; this is the belt to that braces.)
  [MAT.CAULDRON]: {
    note: 'a thrown clay pot: a hearth-wide foot, the belly low, a flared lip and dark water inside',
    parts: [],
    sculpt: {
      model: 'cauldron',
      parts: [
        { node: 'Body', top: MAT.KILN },
        // No `side`, no `glow`: both default to the station itself, so the idle pot's water wears
        // MAT.CAULDRON's dark disc and glows at EMISSIVE[CAULDRON] — which is unset, i.e. 0. The
        // idle cauldron promises no brew, and `alchemy-chain.test` asserts exactly that.
        { node: 'Brew' },
      ],
    },
  },

  // ── CAULDRON_LIT (MAT.CAULDRON_LIT) — the same pot, the brew where the water was ─────────────
  // ★ AND THE BREW GLOWS AGAIN. The box model wrote `{ top: MAT.CAULDRON_LIT, side: MAT.CAULDRON }`
  // on its brew slab, and a part's glow defaults to `EMISSIVE[p.side ?? mat]` — so naming CAULDRON
  // as the side ALSO silenced the glow: EMISSIVE[CAULDRON] is unset, 0. The running cauldron's
  // brew has been rendering dead since the cauldron stopped being a cube on 09-15, while
  // `EMISSIVE[CAULDRON_LIT] = 0.7` sat right there and `paintCauldron` kept painting the emissive
  // alpha the shader multiplies by. Exactly the failure `piece-mesh.ts`'s own header warns of:
  // *"a model that wears those tiles must do the same or the lantern goes dark the day it stops
  // being a cube."* Leaving `side` OFF the brew fixes it with no hardcoded number — the part falls
  // through to the station itself (CAULDRON_LIT) for tile AND glow, and the lit side tile is the
  // same clay as the idle one (`paintCauldron`'s `lit` flag only changes the TOP face's liquid).
  [MAT.CAULDRON_LIT]: {
    note: 'the same thrown pot, the golden brew standing in it and lit like the block it replaces',
    parts: [],
    sculpt: {
      model: 'cauldron',
      parts: [
        // The pot is clay whether or not it is running: name CAULDRON so the body neither wears
        // the lit tile nor inherits its 0.7 glow. A glowing POT would be the opposite regression.
        { node: 'Body', top: MAT.KILN, side: MAT.CAULDRON },
        { node: 'Brew' },
      ],
    },
  },
}
