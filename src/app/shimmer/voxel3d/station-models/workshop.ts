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

  // ── ★★ THE SAWMILL — TWO CELLS TALL, WITH A TOOL WALL (2026-09-23) ──────────────────────────
  // Alex: *"a 2 tall structure with a storage .. feel a bit bigger"*. A one-metre mill reads as a
  // prop sitting on the floor; this is a bench you walk up to with a rack rising behind it. The
  // upper cell is `MAT.STATION_RACK` — solid, invisible to the mesher, and the storage itself.
  //
  // ★ THE LEG-STRIPE CHECK THE BOARD ASKED FOR, RUN BEFORE A NUMBER WAS CHOSEN — AND IT FAILED
  // THE SAME WAY THE BENCH DID. `paintSawmill`'s SIDE tile puts dark leg stripes at the outer
  // eighth (`x < size/8 || x >= size - size/8`), i.e. local u outside [0.125, 0.875], i.e. cell x
  // outside ±0.375. The old boxes stood their legs at cx ±0.30 — cell 0.25..0.35, local
  // 0.75..0.85, which is the lighter milled field BETWEEN the stripes. Four legs wearing panel,
  // and the tile's painted legs landing on the plinth and the apron instead. They are now at
  // ±0.4325 on a 0.10 stick (local 0.8825..0.9825) — the bench's own numbers, so the family's
  // frames stand in their stripe identically rather than each being fixed to its own taste.
  //
  // ★ AND THE SAME MISTAKE VERTICALLY, WHICH THE BENCH NEVER HAD TO ANSWER. The tile's bed line is
  // one dark row at tile y = size/4 with the bright rim just above it, and tile row r is world
  // height `1 - r/size` — so the bed reads at **y = 0.75**, the rim at ~0.78. The old plinth top
  // was at 0.38..0.50: the painted bed line crossed the SAW and the plinth wore blank field. The
  // bed slab now spans 0.72..0.86, so the line and its rim land on the bed's own edge.
  //
  // ⚠⚠ THE SIDE TILE REPEATS EVERY METRE, AND THAT IS THE WHOLE CONSTRAINT ON AN UPPER CELL.
  // The piece program samples a side face at `vec2(local.x, -local.y)` and the tile array is
  // `RepeatWrapping` (`tex/atlas.ts`), so world y ∈ [1,2] samples exactly the rows y ∈ [0,1] does:
  // a second copy of the picture, bed line and all, at head height. **A SILHOUETTE TILE CANNOT BE
  // WORN TWICE.** So every board of the rack names `PLANKS_GOLDWOOD` — a grain, which is what a
  // repeating sample is for — and only the two posts keep the station's own tile, because a post
  // is precisely what that stripe paints and it should read as the same frame continuing upward.
  //
  // ★ THE FRONT IS DELIBERATELY OPEN. Posts and panel sit at the BACK (+z) so the bed, the blade
  // and the cradle stay visible from three sides. A four-post cage would have bought mass by
  // hiding the half of the object that says what the station does.
  [MAT.SAWMILL]: {
    tall: true,
    note: 'a two-cell mill: bed and blade on stripe-standing legs, a planked tool wall and shelf above',
    parts: [
      // ── the mill, in the lower cell ──
      { box: [0.10, 0.72, 0.10, -0.4325, 0.36, -0.4325] },  // four legs, IN the tile's leg stripe
      { box: [0.10, 0.72, 0.10, 0.4325, 0.36, -0.4325] },
      { box: [0.10, 0.72, 0.10, -0.4325, 0.36, 0.4325] },
      { box: [0.10, 0.72, 0.10, 0.4325, 0.36, 0.4325] },
      { box: [0.86, 0.10, 0.86, 0, 0.67, 0] },              // apron, recessed so the stripes show
      { box: [0.94, 0.14, 0.94, 0, 0.79, 0] },              // the bed — wears the line at 0.75
      // ⚠ cy = 0.895, NOT 0.90 — a 0.07 stick centred at 0.90 starts at 0.865 and the bed's top is
      // 0.86, so the rails floated five millimetres above the bed they lie on. Invisible in a
      // render at any distance a human looks from; `modelConnected` reported it as two loose
      // groups on the first run. That five millimetres is the whole argument for having the guard.
      { box: [0.72, 0.07, 0.07, 0, 0.895, -0.28] },         // log cradle, a rail either side
      { box: [0.72, 0.07, 0.07, 0, 0.895, 0.28] },
      { box: [0.05, 0.40, 0.44, 0, 1.06, 0] },              // the blade, standing through the seam
      // ── the rack, in the upper cell. Boards wear PLANK GRAIN; posts wear the leg stripe. ──
      // ⚠⚠ THEY START AT 0.86, THE BED'S TOP — NOT AT 1.00, THE CELL SEAM. The first cut ran them
      // 1.00..2.00 and the render showed the tool wall HANGING IN THE AIR over the bench with
      // daylight under it, while every guard stayed green: each box was inside the cell, nothing
      // flipped, the tri count was fine. That is the bench's 09-22 finding recurring one day later
      // — and the cell seam is a seductive place to start because it is where the second cell
      // begins, which is a fact about the GRID and not about the object. `modelConnected` now
      // asks the question that render answered.
      { box: [0.10, 1.14, 0.10, -0.4325, 1.43, 0.42] },     // two posts, down to the bed they stand on
      { box: [0.10, 1.14, 0.10, 0.4325, 1.43, 0.42] },
      { box: [0.94, 1.12, 0.06, 0, 1.42, 0.46], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD },
      { box: [0.88, 0.07, 0.30, 0, 1.40, 0.30], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD },
      { box: [0.98, 0.08, 0.20, 0, 1.96, 0.40], top: MAT.PLANKS_GOLDWOOD, side: MAT.PLANKS_GOLDWOOD },
    ],
  },

  // ── ★★ THE STONECUTTER — TWO CELLS TALL, AND ITS SLAB WAS UPSIDE DOWN (2026-09-23) ──────────
  // The sawmill's sibling by the tile's own account, so it gets the same shape: mass on stripe-
  // standing legs, a stone rack above, front open.
  //
  // ★★ THE VERTICAL MISTAKE HERE WAS THE WHOLE OBJECT, NOT A DETAIL. `paintStonecutter`'s SIDE
  // tile is `inBed = y < size/3` — the pale gritty slab occupies the tile's TOP THIRD, which is
  // world y **0.667..1.0**, with the bright rim on its underside and dark stone + TIMBER legs
  // below. The shipped model put its slab at y 0..0.34 and its blade at 0.50..0.88: the slab was
  // wearing the dark under-stone, the blade was wearing the pale slab band, and the timber legs
  // the tile paints had nothing standing in them at all. Every part of this object was in the
  // wrong band of its own picture. The slab now spans 0.66..1.00 and the legs stand in the timber.
  // Same family as the bench's legs and the cauldron's hearth course, for the third time: **the
  // picture was already right and the geometry was not standing in it.**
  //
  // ⚠ THE BLADE GOES UP THROUGH THE SEAM AND WEARS THE DARK BAND, which is correct rather than a
  // compromise: above y = 1 the tile repeats, so 1.0..1.667 is the dark stone the tile paints under
  // its bed. A dark blade over a pale slab is the contrast the object wants, and it costs nothing.
  // ⚠ Canon (`world/ather.md`): no metal. The blade wears the station's own stone, as it always has.
  [MAT.STONECUTTER]: {
    tall: true,
    note: 'a two-cell cutter: a thick slab in its own tile band on timber legs, a stone rack above',
    parts: [
      // ── the cutter, in the lower cell ──
      { box: [0.10, 0.66, 0.10, -0.4325, 0.33, -0.4325] },  // four legs, IN the tile's timber stripe
      { box: [0.10, 0.66, 0.10, 0.4325, 0.33, -0.4325] },
      { box: [0.10, 0.66, 0.10, -0.4325, 0.33, 0.4325] },
      { box: [0.10, 0.66, 0.10, 0.4325, 0.33, 0.4325] },
      { box: [0.78, 0.52, 0.78, 0, 0.36, 0] },              // the dark under-mass, recessed
      { box: [0.96, 0.34, 0.96, 0, 0.83, 0] },              // the slab, standing in its own band
      { box: [0.16, 0.12, 0.16, 0, 1.06, 0] },              // the axle
      { box: [0.05, 0.46, 0.52, 0, 1.23, 0] },              // the blade, through the seam
      // ── the rack, in the upper cell. Boards are CUT_STONE; posts keep the cutter's own tile. ──
      { box: [0.11, 0.94, 0.11, -0.4325, 1.47, 0.4325] },
      { box: [0.11, 0.94, 0.11, 0.4325, 1.47, 0.4325] },
      { box: [0.92, 0.90, 0.07, 0, 1.45, 0.455], top: MAT.CUT_STONE, side: MAT.CUT_STONE },  // down to 1.00, the slab's top — a 0.02 gap is still a gap
      { box: [0.90, 0.09, 0.32, 0, 1.38, 0.31], top: MAT.CUT_STONE, side: MAT.CUT_STONE },
      { box: [0.98, 0.10, 0.20, 0, 1.95, 0.40], top: MAT.CUT_STONE, side: MAT.CUT_STONE },
    ],
  },
}
