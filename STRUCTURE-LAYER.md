# The structure layer — blocks build the shell, pieces dress it
> Spec'd 2026-08-06 (jin-cc) off Alex's direction call: *"the material cost comes from blocks but the
> look will be more like Sims so we don't have to have blocky buildings."*
>
> **★ REVISED THE SAME DAY, and the revision is the useful part.** The first version specced
> Sims-style room-scale placement. Alex pushed back — *"the more I think about it this Sims building
> is going to look off"* — and he was right for a reason worth writing down. See § 1.
>
> Companion to `VOXEL-WORLD-MODEL.md`: that settles what the ground is made of, this settles what you
> put on it. ⚠ A spec to rule on, not to implement. § 9 lists the open calls.

## 1. ★ Why the first version was wrong: foundations

The Sims looks clean because **lots are flat**. Every wall meets the ground at the same height.

Our terrain is a heightfield whose adjacent columns step by up to 3 voxels. A rigid room-scale wall
on that either floats at one end, sinks at the other, or clips through the slope. The fix is
flattening terrain before every build — which I had casually deferred as "not in v1" and which is in
fact **load-bearing**. And once flattening is mandatory, the differentiator has been spent on a
chore: the player's memory of building is levelling dirt, not making something.

**The idea was right and the SCALE was wrong.** The reference is not The Sims. It is **Valheim**:
not voxel, not blocky, and its buildings read beautifully — because its pieces are grid-aligned and
roughly block-thick, so they sit *with* the terrain instead of fighting it, while still being real
geometry rather than cubes.

## 2. The model: blocks build the shell, pieces dress it

**One stack, not two competing systems.**

- **Blocks are structure.** Walls, floors, foundations — the flat surfaces nobody looks at. They are
  voxels, so they meet uneven ground the way terrain does: naturally, at any height, no flattening.
- **Pieces are the look.** Door, window, roof, stair, beam, trim, railing, awning. Exactly the
  elements that are *ugly as cubes* and carry the whole visual identity.

A house is block walls plus a real door, a real window, and a proper pitched roof. The parts that
would look bad blocky are pieces; the parts nobody notices stay blocks.

★ This also settles the raw-block question the previous version left open, and settles it *better*:
blocks are not a loophole that collapses the design into Minecraft, they are **half of it**. What
makes this not-Minecraft is that the elements carrying the look are designed geometry, not cubes.

## 3. Two representations, one grid

| | voxel world | piece layer |
|---|---|---|
| stores | `Uint16Array` per section | placement list — id, position, rotation |
| unit | 1 block | 1–3 blocks, block-aligned |
| built by | generator + player | player + generator |
| rendered as | greedy-meshed quads | `InstancedMesh` per piece type |

Both on the **same 1-block grid**, 4-way rotation. Not a finer grid: a half-grid buys nothing once
pieces are block-thick, and costs the single-integer "is this occupied" lookup § 4 rests on.

## 4. ★ Occupancy in the voxel grid — the trick that keeps it cheap

**A placed piece writes occupancy into the voxel grid even though it renders as a mesh.**

A door at (x,y,z) marks its blocks with a reserved material, so:

- **Collision is unchanged.** `voxelSolid`, the capsule check, the frontier rule and drop physics all
  work on buildings for free. No mesh colliders, no AABB tree, no second collision system.
- **Mining refuses it** — `registry.ts` gives the structure material infinite hardness for a spike,
  so a pick cannot chew a door. Deconstruct is its own verb (§ 7).
- **The mesher skips it** but it still occludes what is behind, which is a real performance win.

The expensive-sounding half of the whole idea — physics for arbitrary architecture — reduces to a
value already sitting in an array.

⚠ **Footprint ≠ visual bounds.** A roof overhang must not block someone standing under it. Footprint
is declared per piece and is usually *smaller* than the model. A doorway's footprint is its frame,
not its opening — you walk through it.

## 5. Rendering — `InstancedMesh`, non-negotiable

One geometry, one material, per piece **type**; every placed copy an instance.

★ A mesh-and-material per placed piece is precisely the allocation that got this page **blocked from
creating a WebGL context** on 2026-08-06. `render-audit.test.ts` fails the build on it now, but it
should never be written: a village is thousands of pieces. Models load through the existing
`world/prop-models.tsx` path — GLTF, DRACO, preload, and it already exports `GhostProp` for previews.

## 6. ★ Generation: hand-built templates, and they are the same pieces

**Yes, buildings are pre-built — that is the standard answer, not a compromise.** It is how Minecraft
villages work: hand-authored segments assembled procedurally under placement rules, with the machinery
`WORLDGEN-RESEARCH` already specifies (one chunk owns the structure, generates the whole piece layout
once, neighbours clip in what crosses their border).

**And the payoff is the reason to do it this way:** the player and the generator use the *same* piece
system, so **anything Alex builds by hand becomes a template the generator can place.**

- Build one Gloview cottage in-game → save it → the world scatters variations of it.
- The 8 canon holds, Gloview, and the tutorial glade get authored **by playing**, not by writing data.
- A template is a placement list plus its block shell: small, diffable, and seed-independent.

Variation comes from a small template set plus rules (rotation, palette swap, optional wings), not
from generating architecture from nothing — which is the thing that always looks generated.

## 7. Verbs

- **Place** — ghost at the aimed cell, red when blocked or unaffordable, 4-way rotate, click to commit.
- **Deconstruct** — its own verb, not mining. Refunds a fraction (a dial, not a ruling) and clears
  occupancy.
- **Save template** — select a region, store the block shell + piece list as a named template. This is
  the authoring tool and the generator's input, and it is *the same verb for both*.
- **⛔ Not v1:** piece-to-piece snapping (corners resolving into each other), interiors as rooms,
  structural integrity, terrain flattening. Flattening is explicitly no longer *needed* — that is the
  whole point of § 2.

## 8. Cost — data, in the registry style

```jsonc
{
  "id": "door_oak",
  "name": "Oak Door",
  "footprint": { "w": 1, "h": 3, "d": 1 },   // occupancy, NOT visual bounds
  "cost": [{ "itemId": "goldwood_plank", "count": 6 }],
  "model": "door_oak.glb",
  "category": "piece"
}
```

Item ids are the ones the block registry already drops, and `goldwood_plank` is a **ruled canon name**
already shipping in `resources.ts`. The mined economy feeds the built one directly. **No new material
names.** ⚠ Piece names themselves (anything more evocative than "door") are canon-adjacent — mark
`TBD-CANON` and batch them to Magii rather than inventing.

## 9. ⛔ Calls that are Alex's

- **The piece catalogue, and how small v1 is.** Recommendation: **six** — door, window, roof slope,
  roof cap, stair, beam/trim. Enough to make a block shed read as a building, which is the only thing
  that needs proving. Do not model forty against an unproven loop.
- **Deconstruct refund.** *Recommendation: 100% while the loop is unproven.* Consequence-free
  experimenting is what you want while judging feel.
- **Does the mortal side become pieces too?** Alex has already said Rune Hold will be smaller.
  Open, blocking nothing.

## 10. What this does NOT settle

- **The art.** Six pieces is a real modelling job and their look is the game's face. This is the
  **picaso / headless-Blender** lane. ⛔ **Meshy is the wrong tool** — modular pieces need clean,
  dimension-exact geometry that tiles against a grid, and Meshy makes organic meshes. The lane fits;
  the tool does not.
- **Piece-to-piece snapping.** Sims and Valheim both do it and it is a large part of why their
  buildings read as *built* rather than *assembled*. Genuinely hard, deliberately deferred.
- **Multi-block pieces crossing a column border** — same class as a tree canopy spilling into a
  neighbour, and it gets the same answer: owned by the column containing its origin.
