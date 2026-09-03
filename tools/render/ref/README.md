# ref/ — assets that were generated and then NOT shipped, kept for the record

## `gate_landing.glb` — the Rune Hold landing arch, retired 2026-09-03 the day it was made

30 Meshy credits, image-to-3d, the first asset through the fixed normal-map bake
(`glb_optimize.py`). It is a good bake — 1,922,726 tris → 6,000, UV coverage 62.2%, error to
the high-poly down 1.833% → 1.167%. It is out of `public/` because it is **the wrong answer**,
and it is kept here because two rulings that already existed would have said so before the
spend.

**1. The tool was already ruled out for anything on the grid.** `STRUCTURE-LAYER.md` §10:
*"⛔ Meshy is the wrong tool — modular pieces need clean, dimension-exact geometry that tiles
against a grid, and Meshy makes organic meshes."* The landmark exemption is arguable, but the
argument had to be made first.

**2. A bare GLB has no collision, and that is the whole design.** A `pieces.ts` piece renders
as a mesh AND writes `STRUCTURE` into the voxel grid — *"the expensive-sounding half of the
idea reduces to a value already in an array."* `PROP_MODELS` writes nothing, so a keeper walks
through both piers. Alex ruled voxel-built on exactly this: *"keeps collision free."*

**3. And the LOOK contradicts a ruling Alex made on 2026-08-27.** He asked for *"more of a
stone hedge look"*, and `crossings.ts` records what that means: a **trilithon** — two jamb
columns carrying a lintel course, at least 2 blocks thick, because *"a sheet of stone with a
rectangle cut out of it reads as masonry however you proportion it; a standing stone reads as
a standing stone because you can see it has a SIDE."* This model is fitted ashlar coursing
with a semicircular arch: precisely the masonry reading that ruling rejects.

**What should be used instead** is already built and needs no credits: `crossings.ts` `FRAME`
— voxel, grid-aligned, collision free, canon-anchored. `gate: { half: 3, height: 7,
doorHalf: 1, doorHeight: 4, depth: 2, lintelDepth: 3 }` = 7 m wide, 7 m tall, 2 m thick, with
a 3 m × 4 m opening. That is larger and more civic than anything this model was going to be at
4.5 m with a 1.54 m span.

⚠ Placing one at the square is blocked on Alex either way: `landingGate()` returns **null** —
nobody has painted the landing — and `crossing-out.ts` refuses to derive it, because *"a
plausible coordinate is the worst kind of wrong here."*

The concepts that fed this live in `athernyx/assets/gate-landing/`.
