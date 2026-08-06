# The structure layer — voxel cost, Sims look
> Spec'd 2026-08-06 (jin-cc) off Alex's direction call: *"the material cost comes from blocks but the
> look will be more like Sims so we don't have to have blocky buildings."*
>
> Companion to `VOXEL-WORLD-MODEL.md`. That doc settles what the ground is made of; this one settles
> what you can put **on** it. ⚠ A spec to rule on, not a spec to implement — § 8 lists the calls.

## 1. Why this is the differentiator, stated plainly

Minecraft's building *is* its terrain: you place the same cubes you mined, so a house is a pile of
world. Ours splits the two. **Blocks are the economy; architecture is the product.** You mine stone
to *pay* for a wall, but the wall is a designed piece, not a stack of cubes.

That single split is the thing a player would describe to a friend, and it is worth protecting from
the obvious simplification (let people place raw blocks too, "for flexibility"), which would collapse
it straight back into Minecraft with extra steps. See § 8.

## 2. Two representations, one grid

| | voxel world | structure layer |
|---|---|---|
| stores | `Uint16Array` per section | a **placement list** — id, position, rotation |
| unit | 1 block | a piece occupying 1+ blocks |
| built by | the generator | the player |
| rendered as | greedy-meshed quads | `InstancedMesh` per piece type |
| costs | nothing to place | materials from the inventory |

Both live on the **same 1-block grid**. Not a finer one: a half-grid buys Sims-ish wall placement
and costs the ability to reason about "is this block occupied" in a single integer lookup, which is
the property § 3 is built on. Rotation is 4-way (90°), which is enough for architecture and keeps
occupancy a lookup rather than a polygon test.

## 3. ★ The trick that makes it affordable: occupancy in the voxel grid

**A placed piece writes into the voxel grid even though it renders as a mesh.**

A `wall` at (x,y,z) marks its blocks with a reserved material (`MAT.STRUCTURE`), so:

- **Collision is unchanged.** `voxelSolid` already treats non-air as solid, so the capsule check,
  the phantom-floor-at-the-frontier rule and the drop physics all work on buildings for free. There
  is no second collision system, no mesh colliders, no AABB tree.
- **Mining refuses it.** `registry.ts` gives `MAT.STRUCTURE` hardness `Infinity` for the spike, so a
  pick cannot chew a wall. Deconstruction is its own verb (§ 6), which is what a build game wants.
- **The mesher skips it.** A structure block is never drawn as a quad — the piece's own mesh is the
  visual. It participates in occlusion (blocks behind a wall are correctly hidden) which is a real
  performance win, not just correctness.

**This is the whole reason the idea is cheap.** The expensive-sounding half (physics for arbitrary
architecture) reduces to a value already in an array.

⚠ The corollary: **a piece's occupancy footprint is not its visual bounds.** A decorative roof
overhang should not block a player standing under it. Footprint is declared per piece, deliberately,
and is usually smaller than the model.

## 4. Rendering — `InstancedMesh`, and this one is non-negotiable

One geometry and one material **per piece type**, with every placed copy an instance.

★ A mesh-and-material per placed wall is precisely the allocation that got this page **blocked from
creating a WebGL context** on 2026-08-06 (a material per dropped item). `render-audit.test.ts` fails
the build on it now, but it should never be written in the first place. A hundred houses is tens of
thousands of pieces; instancing is the difference between that working and the tab dying.

Per-instance data is a transform plus a small attribute for tint/variant. Piece models load through
the **existing** `world/prop-models.tsx` path — GLTF, DRACO, preloaded — which already exists and is
already used for props.

## 5. Cost, and where it comes from

Costs are **data**, in the same registry style as blocks (`VOXEL-WORLD-MODEL` § 4) so they lift to
JSON and Rust reads them later:

```jsonc
{
  "id": "wall_stone",
  "name": "Stone Wall",
  "footprint": { "w": 1, "h": 3, "d": 1 },   // occupancy, NOT visual bounds
  "cost": [{ "itemId": "block_stone", "count": 4 }],
  "model": "wall_stone.glb",
  "category": "structure"
}
```

Item ids are the ones the block registry already drops. **No new material names** — the mined
economy feeds the built one directly, which is the point of the design.

## 6. Verbs

- **Place** — ghost preview at the aimed grid cell, red when blocked or unaffordable, 4-way rotate,
  commit on click. The ghost already has a precedent: `prop-models.tsx` exports `GhostProp`.
- **Deconstruct** — its own verb, not mining. Returns a **fraction** of the cost (a dial, not a
  ruling) so building is not a free undo, and clears the occupancy.
- **⛔ Not in v1:** interiors as rooms, floors above floors, terrain flattening, wall-segment
  half-grid placement. All are Sims features that want the loop proven first.

## 7. Order of work

1. **Persistence first.** A structure layer with no save is a demo. Placements are trivial to
   store — the point is that the rule is already ruled.
2. **Six pieces:** floor, wall, doorway, window, roof, stair. Enough to build a shed, which is
   enough to judge the loop.
3. **The placement loop** — ghost, snap, rotate, cost, commit, deconstruct.
4. **Occupancy + collision**, which should be nearly free per § 3, and is the assertion that proves it.
5. **Only then** commission the rest of the catalogue. Do not model forty pieces against an
   unproven loop.

## 8. ⛔ Calls that are Alex's

- **★ Can players place raw blocks at all?** The strong version of this design says **no** — blocks
  are currency, architecture is product, and allowing raw placement collapses it back into
  Minecraft. The soft version allows raw blocks for terrain shaping (bridging a gap, filling a hole)
  but not for buildings. *Recommendation: soft version.* Terrain edits are a mining-game need; let
  them exist, and keep pieces as the only way to build.
- **Deconstruct refund fraction.** 100% makes building consequence-free; 0% punishes experimenting.
  *Recommendation: 100% while the loop is unproven, tuned down later if it matters.*
- **Does the mortal side (Rune Hold, the holds) become structures too**, or stay authored interiors?
  Alex has already said Rune Hold will be smaller. Open, and blocking nothing.

## 9. What this spec does NOT settle

- **The art.** Six pieces is a real modelling job and the look of them is the game's face. This is
  the picaso / headless-Blender lane; **Meshy is the wrong tool** — modular pieces need clean,
  dimension-exact geometry and Meshy makes organic meshes.
- **Whether pieces snap to each other** (a wall knowing it meets another wall, so corners resolve).
  Sims does this and it is a large part of why its buildings read as built rather than assembled.
  Genuinely hard; deliberately out of v1.
- **Multi-block pieces crossing a column border.** The same class as a tree canopy spilling into a
  neighbour, and it gets the same answer: the piece is owned by the column containing its origin.
