# Moving play3d onto the voxel world — what actually has to change
> Audited 2026-08-06 (jin-cc) after Alex asked how to swap the voxel stack in for play3d.
> Method is the zone-cutover one: **measure the coupling before planning the work**, because the
> last two times the scary-sounding job turned out to be three small ones and the small-sounding
> job turned out to be a phase.

## The framing, first

**This is not a renderer swap.** `play3d` is the live game — zones, warps, the mortal side, holds,
the Crucible, NPCs, battles, quests — and `voxel3d` is a different *world model* with none of those
concepts. The voxel stack does not replace `Shimmer3D`; it replaces the **ground underneath it**,
and every system founded on zone-and-tile assumptions has to be re-founded on blocks.

So the question is not "how do we swap the renderer". It is **which systems survive the world-model
change untouched, which need re-founding, and in what order**.

`play3d` is **12,528 lines** across 40-odd files, standing on a `world/` layer of ~5,900 lines.
That is the thing being moved, and most of it turns out not to care.

## ★ The measurement, and it is good news

Counting references to zones, tiles and world grids across the 23 engine systems `Shimmer3D` imports:

| coupling | systems | verdict |
|---|---|---|
| **none** | alchemy, arena, battle-ai, burrows, crafting, day-cycle, exchange, **inventory**, mana, moves, party-stats, potion-effects, rinning, skills, spirit-index, tools | **port untouched** |
| light (1–5 refs) | segs-collision, bank, harvesting, farming | re-found cheaply |
| heavy | player (20), encounters (25), **spawn-board (54)** | real work |

**Sixteen of twenty-three systems have zero coupling to the world model.** Combat, spirits, moves,
skills, tools, crafting, the day cycle, the exchange — none of them know what the ground is made of.
That is a much better starting position than "rewrite the game".

### ⚠ And the specific answer to "do we need a new inventory system?" — NO

`engine/inventory.ts` scores **zero** zone/tile references. Its nine apparent hits were `grid[` —
the **inventory grid**, i.e. slots, not the world grid. A false positive from my own first pass,
caught by looking at the lines instead of trusting the count.

The inventory is already world-agnostic: it stores `ItemStack`s in slots and has no idea where the
player is standing. It ports as-is, and the voxel test bed **already uses it unmodified** — the
hotbar and pickups run through `createInventory` / `addItems` / `removeItems` today.

**Recommendation: keep it.** Building a second inventory would mean two save formats, two hotbar
code paths, and a migration nobody asked for. The offer to write a new one is worth banking for
something that genuinely needs it; this is not that.

## What actually has to be re-founded

**`spawn-board` (54 refs) is the biggest single piece** and it is not a surprise — it is entirely
about *where things spawn in a zone*. On a voxel world "a zone" stops existing, so the board needs
re-founding on the same grid+jitter+salt placement the worldgen research already specifies for
class-2 structures. That is a rewrite of its addressing, not of its rules.

**`encounters` (25)** is keyed on zone id. It becomes keyed on **biome + depth**, which the
generator already computes — the fields exist, nothing new has to be invented.

**`player` (20)** is position and collision, which the voxel test bed has already solved once
(`voxelSolid`, the capsule check, the phantom floor at the frontier). This is porting a solved
problem, not solving it again.

**`bank` / `harvesting` / `farming` / `segs-collision` (1–5 each)** are incidental references —
mostly "which zone am I in" for a save key or a log line.

## The `world/` layer is where the real deletion is

| file | lines | fate |
|---|---|---|
| `tiles.ts` | 4,081 | **the pixel art survives** — it becomes the texture-array source. This is the asset, not the system. |
| `zones.ts` | 733 | retires with the zone model (the cutover already audited this) |
| `garden-world.ts` | 359 | retires — it is the old answer to "make the surface one place" |
| `region-maps.ts` | 286 | retires with the 7-canvas composition, already ruled |
| `wilds-world.ts` | 315 | superseded by `voxel/column.ts` |
| `chunk-stream.ts` | 94 | **survives in spirit** — the radius/window logic is sound, the payload changes |
| `heightmaps.ts` | 39 | retires (the sculpt was already reversed out) |

## Suggested order, and why

1. **Nothing yet.** The voxel world is not feature-complete enough to host the game: no trees, no
   structures, no persistence. Migrating onto a world you cannot save is premature.
2. **Persistence first.** You mine a hole, refresh, it is back. Nothing else can be judged until the
   world is durable, and it is small: a chunk is stored only if it holds a player edit.
3. **Trees, then class-1/class-2 structures.** These make the voxel world somewhere a game could
   plausibly happen. Structures are also where the 8 canon holds and the tutorial glade land.
4. **Port the zero-coupling sixteen.** Mechanical, low-risk, and it makes the test bed a game.
5. **Re-found `spawn-board`, `encounters`, `player`.** The three real pieces, in that order.
6. **Retire the `world/` layer** — and only then, because until step 5 lands it is still load-bearing.

## ⚠ What this audit does NOT say

It does not say the migration is easy. It says the *expensive-sounding* part (23 engine systems) is
mostly free and the *cheap-sounding* part (the world layer) is where the work is — the same
inversion the zone cutover found, where "delete 18 zones" turned out to require ripping out a
stitcher threaded through 76 call sites.

It also does not settle **whether the mortal side comes along**. Rune Hold, the holds, the station
and the Crucible are a different continent in a different year, they are dense authored interiors
(0–14% void, unlike the 45–99% of the retired canvases), and canon already rules them as the hub
Shimmer's gate leads *out* to. They may be better left as they are than converted to voxels. That is
Alex's call and it is not blocking anything.
