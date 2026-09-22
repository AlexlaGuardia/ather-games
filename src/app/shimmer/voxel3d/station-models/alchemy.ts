// Station models — the alchemy group (Mortar · Still · Bowl · Cauldron, +lit). See
// `../station-models.ts` for the CONTRACT before editing. Substance per `CANON_GAPS.md`'s RULED
// 2026-09-15 entry: Mortar = stone, Still = glass bulb on a fired-clay foot, Bowl = fired clay
// (wide, shallow, cold), Cauldron = fired clay (brews). No metal anywhere in this world.
import type { StationModel } from '../station-models'
import { MAT } from '../../voxel/depth'

export const MODELS: Readonly<Record<number, StationModel>> = {
  // ── MORTAR (MAT.GRINDER) — stone, and it GRINDS ──────────────────────────────────────────────
  // ★ THE HOLLOW IS THE TOOL, so the profile spends its height on a deep dish over a narrow turned
  // foot. `paintGrinder`'s TOP tile IS that hollow's picture — a dusted bowl with a darker turning
  // stone at r 0.18 — which is why this body names GRINDER as its own `top` rather than borrowing a
  // plain clay one the way the cauldron does: here a facet that tips past the 60-degree cone SHOULD
  // wear the hollow. That is also why the script's cone budget is 0.80 for this vessel and 0.50 for
  // the others; the outer wall still obeys it, only the dish does not.
  // The pestle leans off-centre out of the hollow, merged into the same node — canon's hand tool at
  // rest, not a second object (`design-briefs/shimmer-alchemy-vessels.md`: stone, no metal).
  [MAT.GRINDER]: {
    note: 'a turned stone mortar: narrow foot, a deep dusted hollow, the pestle leaning on its rim',
    parts: [],
    sculpt: { model: 'mortar', parts: [{ node: 'Body', top: MAT.GRINDER }] },
  },

  // ── STILL (MAT.STILL) — a hand-blown glass bulb on a fired-clay foot ─────────────────────────
  // ★ TWO NODES BECAUSE THE TILE HAS TWO HALVES, AND HEIGHT IS WHAT SELECTS THEM. `paintStill`'s
  // side face paints clay below `baseY` (0.62 of the tile) and a pale GLASS BULB above it, centred
  // ~0.64 local y with radius ~0.30 — and a side face samples row (1 - local y). So the bulb is
  // glass because it LIVES high in the cell, exactly as the box model's "y 0.55-1.0, measured on the
  // shelf" note recorded. Drop it and it comes out clay.
  // ⚠ The bulb wears the STILL's own tiles, never MAT.GLASS: the pane tile is a dark leaded lattice
  // and a bulb of it reads as coal (hub, at the 09-15 merge).
  [MAT.STILL]: {
    note: 'a blown glass bulb on a fired-clay foot: turned base, a drawn neck, the bulb at the crown',
    parts: [],
    sculpt: {
      model: 'still',
      parts: [
        // Plain clay on the flips: the foot's shoulder and the collar under the bulb both point up,
        // and the still's own top tile is a dark disc that would read as a hole punched in the clay.
        { node: 'Base', top: MAT.KILN },
        // The bulb keeps its OWN top on purpose — that dark disc with a glass ring at r 0.27 is
        // what looking down the bulb's neck should look like.
        { node: 'Bulb', top: MAT.STILL },
      ],
    },
  },

  // ── BOWL (MAT.MIXER) — fired clay, wide and shallow, cold ────────────────────────────────────
  // ★ IT IS 0.42 TALL AND THE BOX MODEL WAS 0.30, AND THAT IS A FIX NOT A DRIFT. `paintMixer` puts
  // a bright rim band just under `lip` (0.55 of the tile) with a dark "wall behind a low bowl" above
  // it; at 0.30 the shipped bowl sat entirely in the plain-clay rows and never reached its own rim
  // band, so the tile's whole rim/lip story went unused. At 0.42 the lip lands in it.
  // ⚠ A WIDE SHALLOW DISH CANNOT OBEY THE 60-DEGREE CONE AND IS NOT MEANT TO — `dz` is in CELL
  // units, so a 0.42-tall vessel multiplies every profile rise by 2.4. The body therefore declares a
  // PLAIN CLAY top (KILN, 0x8b5638 against the mixer's 0x9c5f42 — the nearest plain clay in the
  // set), because the mixer's own top tile is the PASTE and a flipped outer wall would wear ground
  // paste down its side. The paste belongs on one surface only, which is the next node.
  [MAT.MIXER]: {
    note: 'a wide shallow clay dish: low foot, a swelling wall, the lip in its own rim band, paste inside',
    parts: [],
    sculpt: {
      model: 'bowl',
      parts: [
        { node: 'Body', top: MAT.KILN },
        // The mixing surface, and the ONLY part that wears the mixer's own top — paste with the
        // track where the paddle went round. Sits just above the inner floor and hides it.
        { node: 'Paste' },
      ],
    },
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
