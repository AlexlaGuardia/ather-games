// Station models — the decor group: blocks that are not stations but took a model anyway.
// See `../station-models.ts` for the CONTRACT before editing.
import type { StationModel } from '../station-models'
import { MAT } from '../../voxel/depth'

export const MODELS: Readonly<Record<number, StationModel>> = {
  // ── ★★ THE MANA LANTERN — A CAGED SHARD, NOT A SHADED LAMP (revamped 2026-09-23) ─────────────
  // Alex: *"rn it looks like a tacky lamp"*, and he was describing the silhouette exactly. The
  // first version (09-15) was a 0.34 head on a 0.10 post under a 0.40 cap — a head three times
  // the post's width with a cap FLARING WIDER THAN THE HEAD is not a lantern, it is a lampshade,
  // and no amount of wood colour argues with that outline.
  //
  // ★ BUT THE DEEPER FAULT WAS THE SAME ONE THE BENCH, THE MILL AND THE CUTTER ALL HAD: the
  // picture was already right and the geometry was not standing in it. `paintLantern` paints a
  // GOLDWOOD FRAME BORDER at the outer eighth (`x < b || y < b || x >= size-b || y >= size-b`,
  // b = size/8) with a glowing glass diamond inside it — a plank frame around a shard, drawn. A
  // 0.34-wide head centred in the cell spans LOCAL 0.33..0.67, which is entirely inside the
  // diamond and never once touches the border. So the head wore nothing but glass, on all four
  // faces, and that is why it read as a solid cream shade with no frame on it at all.
  //
  // ★ THE FIX IS TO BUILD THE FRAME RATHER THAN HOPE FOR IT. Four goldwood staves and two rails
  // make a cage, and the shard hangs INSIDE it — which is also what this block has always been
  // by canon: `depth.ts` calls it *"a shard of raw mana in a plank frame"*, and `world/ather.md`
  // forbids metal, so a cage of staves is the only honest reading of it. The shard is the only
  // part that glows (the wood is told `glow: 0`, since the tile's alpha is the glow mask and
  // would otherwise light a post), and at 0.15 wide it sits in the tile's hot centre, so it is
  // pure light rather than light-behind-a-grid drawn twice.
  //
  // ⚠⚠ AND THE CAGE STANDS IN THE TILE'S HOT BAND, WHICH IS NOT WHERE THE EYE PUTS IT. The first
  // cut of this revamp hung the cage at 0.52..0.82 — the middle of the upper half, where a lantern
  // "looks" right — and the shard came out a flat mustard panel. `paintLantern`'s glowing diamond
  // is a picture in a 32px tile, and a side face samples it at `-local.y` through a repeating
  // atlas, so the diamond's ALPHA-255 core lands at world y **0.330..0.700** and nowhere else.
  // Above 0.875 and below 0.125 is the frame border; between them it falls off to dim. The cage is
  // now 0.33..0.70 exactly, so the shard is hot over its whole height. Computed from the painter's
  // own numbers, not eyeballed — and it is the same finding as the bench's legs, the mill's bed
  // line and the cutter's slab, for the fourth time in one day: **the picture was already right
  // and the geometry was not standing in it.**
  // ⚠ The consequence is a SHORT POST (0.06..0.27), and that is the tile's decision rather than a
  // compromise: the light has to sit where the tile paints light. It reads as a garden bollard
  // lantern instead of a tall lamp-post, which is the better object for a plot path anyway.
  //
  // ⚠ THE SHARD TOUCHES THE LOWER RAIL AND THAT IS LOAD-BEARING, not tidiness. `modelConnected`
  // refuses a model whose boxes are not one connected lump, and a shard floating inside a cage is
  // the textbook case — two loose groups, and the guard would be right: a thing suspended by
  // nothing is what the sawmill's log cradle was, five millimetres up. Resting on the rail it is
  // one object AND the more honest picture.
  //
  // ⚠ NOTHING FLARES. Foot 0.30, cap 0.30, cage 0.29 across — the rails are a hair proud of the
  // staves so they read as lid and floor, and never wider than the base. That single relationship
  // is most of the difference between a lantern and a table lamp.
  [MAT.MANA_LANTERN]: {
    note: 'a standing lantern: a mana shard caged between plank rails on a goldwood post',
    parts: [
      { box: [0.30, 0.06, 0.30, 0, 0.030, 0], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD, glow: 0 },  // foot
      { box: [0.11, 0.21, 0.11, 0, 0.165, 0], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD, glow: 0 },  // post
      { box: [0.30, 0.06, 0.30, 0, 0.300, 0], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD, glow: 0 },  // lower rail
      // Four corner staves — the cage. 0.06 and not thinner on purpose: at 32px to the block a
      // 0.045 stave is under a pixel and a half and aliases into a dotted line.
      { box: [0.06, 0.37, 0.06, -0.115, 0.515, -0.115], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD, glow: 0 },
      { box: [0.06, 0.37, 0.06,  0.115, 0.515, -0.115], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD, glow: 0 },
      { box: [0.06, 0.37, 0.06, -0.115, 0.515,  0.115], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD, glow: 0 },
      { box: [0.06, 0.37, 0.06,  0.115, 0.515,  0.115], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD, glow: 0 },
      // THE SHARD — the one part that lights, and the only one whose span is dictated rather than
      // chosen: 0.33..0.70 is the tile's alpha-255 core, measured off `paintLantern`.
      { box: [0.16, 0.37, 0.16, 0, 0.515, 0] },
      { box: [0.30, 0.06, 0.30, 0, 0.730, 0], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD, glow: 0 },  // upper rail / cap
      { box: [0.05, 0.06, 0.05, 0, 0.790, 0], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD, glow: 0 },  // the hanging knob
    ],
  },
}
