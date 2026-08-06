# The voxel world model — design, and the port boundary
> Drafted 2026-08-06 (jin-cc) off Alex's direction call: **Minecraft model, web now, Supra later.**
> Spawn → pick a birth rune → the Greg tutorial → open country, every block mineable and craftable.
>
> Companion to `WORLDGEN-RESEARCH.md` — that doc settled *how terrain gets generated*, this one
> settles *what terrain is made of and where it lives in memory*. Every rule there still binds,
> in particular: **never derive material from biome id** (the pre-1.18 mistake, third disguise).
>
> ⚠ This is a design to rule on, not a spec to implement. Three calls in § 8 are Alex's.

## 1. We are not starting from zero, and that shapes everything

Four things already exist and survive the transition:

- **A z-axis, already sculpted.** `heightmaps.ts` opens with *"integer tiers (Minecraft-style BLOCKY
  terrain)"*. Alex has sculpted **17 zones / 233,380 cells / heights 0–6**. That is a *heightfield*:
  a surface with no body. The voxel step gives it an interior. **The sculpt becomes the top layer,
  it does not get thrown away.**
- **A material spine.** `resources.ts` carries 12 node types over 4 skills — Forestry (goldwood,
  shimmeroak, starwillow, dawnwood), Prospecting (raw mana, element crystal, pure core, ather
  crystal), Rinning (pond, stream, lake), Farming (ather soil) — with drops, tiers and level gates.
  They are **props standing on terrain**. The whole move is making the terrain *be* the resource.
- **Chunk streaming that already works.** `CHUNK = 64`, `DEFAULT_RADIUS = 3` → 49 live chunks,
  measured flat however far you walk. The window logic transfers unchanged; only its payload changes.
- **A generator.** `wilds-gen.ts` + the domain-warp noise field. Biome, height and now *material*
  are three reads of that one field.

What does **not** exist: any notion that a tile is *made of something*. `tiles.ts` is a **look
library** — pixel art plus a `SOLID` flag. Measured across all 11 canvases (1,485,000 cells),
**six tiles carry 99.97%** of the world and **88 of 104 defined tiles have never been painted**.
Cloud (void) alone is 76.1%. So the block vocabulary isn't too large to enumerate; it barely exists.

## 2. ★ Chunk width is a RE-MESH decision, not a memory decision

The instinct is to pick a chunk size to control memory. Run the numbers and that instinct is wrong —
for a fixed world footprint the totals are **identical** at every width:

| shape | H | voxels/chunk | live chunks | raw @2B | palette-packed |
|---|---|---|---|---|---|
| 64×64×H | 64 | 262,144 | 49 | 24.5 MB | ~2.0 MB |
| 32×32×H | 64 | 65,536 | 196 | 24.5 MB | ~2.0 MB |
| 16×16×H | 64 | 16,384 | 784 | 24.5 MB | ~2.0 MB |
| 64×64×H | 128 | 524,288 | 49 | 49.0 MB | ~3.9 MB |
| 32×32×H | 128 | 131,072 | 196 | 49.0 MB | ~3.9 MB |
| 16×16×H | 128 | 32,768 | 784 | 49.0 MB | ~3.9 MB |

(Packed figure assumes most vertical sections are single-value — all air above the surface, all
stone below — which is the normal case and the reason the trick pays.)

What *does* change with width is **how much geometry has to be rebuilt when the player breaks one
block.** At 64×64×128 that is 524,288 voxels re-meshed for one swing, which will not fit in a frame.
At 16×16×16 sections it is 4,096. **That is the entire argument, and it is why Minecraft sections
are small.** Pick the width from re-mesh cost; memory follows for free.

**★ And the memory news is better than expected.** The current 2.5D world spends **~8 bytes per
cell** (23 MB for ~2.9M cells) because it is JS `number[][]`. Typed arrays at 2 bytes with palette
packing are a **4× win before voxels enter the picture at all**. A 128-deep voxel world is
*cheaper* than the flat tile grid we ship today.

## 3. Storage format

- **Column chunk** = `W × W` footprint, full height, split into **cubic sections** of `S³`.
  Sections are the mesh unit and the compression unit, exactly as in Anvil.
- **Per section: a local palette + bit-packed indices at minimum width.** A section whose palette
  has one entry **omits the index array entirely** (research steal #5). This is the same idea
  `sparseGrid` / `sharedRow` / `materializeRows` already implement one dimension down.
- **Typed arrays throughout — never an object per voxel.** `Uint16Array` for indices, plain arrays
  only for the palette. This is rule 3 of the port boundary and also the anti-GC fix; the two
  motivations happen to want the identical thing.
- **Persistence diverges from Mojang deliberately** (already decided in the research): a chunk is
  written **only if it holds a player edit**. File-absence means *pure procedural, regenerate*.
  Our generator is cheap, deterministic, and our storage is a browser.
- **Edits carry a generator version.** When the generator changes, a saved edit may no longer match
  the terrain beneath it. Version the edit or accept drift — flagged in the research as ours to solve.

## 4. The material registry — DATA, not code

The single highest-leverage portability decision. Materials and recipes live in **JSON**, not
TypeScript. Rust reads the identical files. Shape:

```jsonc
{
  "id": "goldwood",           // ruled canon name — see §10 before adding any new one
  "skill": "forestry",        // existing SkillId, gates harvest
  "tier": 1,                  // existing node tier
  "hardness": 2.0,            // time-to-break multiplier      (Jin's, no ruling)
  "drops": [{ "item": "goldwood_log", "min": 1, "max": 3 }],
  "solid": true,
  "look": { "tile": 20 },     // indexes the EXISTING tiles.ts art
  "generate": { "field": "moisture", "band": [0.55, 0.85], "depth": "surface" }
}
```

Note what `generate` does **not** say: it never names a biome. It names an **axis band on the noise
field**, so material and biome are siblings read from one source rather than one derived from the
other. Supra's `crafting.rs` gets this wrong today (`biome_resources()` maps biome → materials) and
we should not copy that half.

## 4b. ✅ The shape of the game (Alex, 2026-08-06)

**One world.** Choose a birth rune → dropped in **Moonwell Glade** (the tutorial biome; canon-clean,
Greg's home *is* `moonwell-glade-gregory-s-home`) → **everything else generated**, a whole world to
explore. Structures come in two classes (see `WORLDGEN-RESEARCH.md` § Strongholds): the 8 canon
holds + Gloview + the tutorial glade are **authored and guaranteed**; holds, ruins, camps and
Moglin burrow-villages beyond that are **unbounded procedural**. Voranyx is no longer a place on the
map — it is generated mineshafts opening into large caverns.

**A gate leads out to Athernyx — the hub.** Not a continent you walk to: the waking world as a
front door holding the other game modes (expeditions, the Crucible) and the canon storefronts (the
Kindled Mug, the Passage, Eyuun's Bookstore, the Notice Board). **This half is already ruled** —
`world/arcade.md:13` (2026-07-12) describes exactly this hub, so Shimmer's mortal side stops being
a second continent and becomes what canon already said it was.

> ⛔ **The gate itself is a CANON GAP — do not build it.** Alex wants it craftable. `glossary.md`
> says gates between the waking world and the Ather are **rare Eyuun gatecraft**, so a workbench
> recipe would rewrite cosmology from a mechanic — the named failure mode. Filed as `[OPEN]` in
> `CANON_GAPS.md` with the reconciliation Jin argues for: **crafting the means to *open/attune to*
> an existing crossing ≠ crafting the crossing.** Everything else above is unblocked and proceeding.

## 5. Heightfield → voxels *(SUPERSEDED — see § 8(c); kept for the reasoning)*

Alex's 233,380 sculpted cells extrude:

1. The sculpted tier `h ∈ 0..6` becomes the **surface altitude** of that column (rescaled to the
   chosen world height).
2. Everything **above** is air. Everything **below** is filled by a *depth rule* — a small ordered
   predicate list (topsoil → subsoil → stone → deep stone), the surviving intent of Minecraft's
   surface rules with the column-walk dropped (research § skip).
3. Ore and node materials are placed by the `generate` band, not by biome, at their declared depth.
4. **The painted tile art becomes the surface skin**, so the world still looks like Shimmer on day
   one. Nothing needs redrawing to see this run.

This is why the sculpt survives: it is not reference material, it is literally the top of the world.

## 6. ★ The port boundary — four rules, one of which actually decides it

1. **Materials and recipes are data files.** Engine-neutral for free.
2. **Generation is pure `fn(seed, coords)`** — no I/O, no neighbour reads (research steal #1/#2).
   ★ This buys a *checkable* contract: run the TS and Rust generators on one seed and **diff the
   chunks**. Portability stops being a promise and becomes a test that fails.
3. **Typed arrays, never object-per-voxel.** `Uint16Array` ⇄ `Vec<u16>`.
4. **★ The voxel core lives in a folder with ZERO react/three/DOM imports, enforced by a test that
   greps the import graph.** This is the rule that decides whether any of the others survive.
   "We'll port it later" dies the day the world model quietly grows a `useState` — and it will,
   inside two weeks, unless something fails loudly in CI.

Host-side (does **not** port, and that is fine): the R3F renderer, the mesher's Web-Worker plumbing,
IndexedDB, every editor, the UI layer.

## 7. Browser-specific: what actually kills voxel games in a tab

Not world size — **per-frame meshing and GC**. Mitigations, all of which port unchanged:
greedy meshing; meshing off the main thread in a Worker; typed arrays end to end; section size
tuned so one rebuild fits a frame budget. Supra would need a chunk mesher it does not have today
(its renderer is 492 lines — flat-shaded meshes and a floor primitive), but the **model** arrives
ready and the mesher is a renderer concern on both sides.

### ✅ THE PHONE IS NO LONGER A HARD TARGET (Alex, 2026-08-06)

Carried in from 2.5D cozy Shimmer, where phase 3 sized the whole streaming budget around not
killing a phone tab (~23MB). The voxel rework is a different game and the assumption was never
re-checked against it. Dropped deliberately, not forgotten.

**What does NOT change, and it is most of the design:**
- **Section size stays 16.** The 13.4ms worst case at 32 was measured on a *desktop-class server*
  and already fails a 16.7ms frame. The phone never entered that argument.
- **Typed arrays, no object-per-voxel.** That is GC and the Rust port path, not device class.
- **All four port rules, greedy meshing, the palette/packing scheme.** Unaffected.
- **The Worker.** Still wanted — it moves from *required* to *headroom*, which is a scheduling
  change, not an architectural one.

**What genuinely relaxes:**
- **★ World height.** 128 was partly a phone-memory number, and § 8(b) already flagged that the
  datum sketch left only ~32 blocks below the surface — shallow for a game whose loop is mining
  down. § 2 puts **256 at ~7.8MB packed vs ~3.9MB at 128**: nothing on a desktop, and it doubles
  the depth available for ore tiers, mineshafts and large caverns. **Recommend revisiting 128 → 256
  now that caverns are a headline feature.** Still only a format number; the datum stays tunable.
- **The memory ceiling** stops being the binding constraint it was in phase 3. Not unlimited — a
  tab that eats 500MB is still bad — but it stops driving decisions.
- **View radius.** `DEFAULT_RADIUS = 3` (182 units + fog) was already flagged as possibly too close
  and needing Alex's eye. There is now room to open it.

## 8. ✅ RULED 2026-08-06 (Alex) — all three, as recommended

- **(a) 1 voxel = 1 tile.** A block is player-sized, the Minecraft read. Chosen because it keeps
  every existing sprite, sculpt and placement coordinate **valid unchanged** — the transition costs
  nothing in re-authoring, which is the whole reason the sculpt and the canvases survive.
- **(b) ✅ REVISED 2026-08-06 → world height = 256** (was 128; the phone drop removed the reason for
  the lower number). Costs ~7.8MB packed — nothing on a desktop.
  - **★ The cost of height was never memory, it was WASTED SWEEPING, and that is now fixed.** A
    uniform section (all air above the surface, all stone well below it) emits **zero quads** but the
    mesher still swept all 3(S+1)=51 planes to discover that. In a tall world most of a column is
    uniform, so column cost scaled *linearly with height* for no geometry: 28.6ms at 128 rising to
    115.3ms at 512. `greedy.ts` now takes a **uniform fast path** — only the 2 boundary planes per
    axis can carry a face, so 6 planes instead of 51 — and the curve flattens: **15.5 / 23.4 / 31.3 /
    39.3 ms** at 128 / 256 / 384 / 512. **256 costs 50% more than 128, not 100%.**
  - **⛔ Why not 512, given it is affordable at 39ms?** Because **the datum decides mining depth, not
    the ceiling.** At 256 with the surface datum around y=160 there are ~160 blocks below the player —
    already deeper than Minecraft's ~126 below sea level. Going to 512 without moving the datum buys
    *sky*, not depth. If more mining depth is wanted, raise the datum first; it is free.
  - **⛔ THE REMAINING HEADROOM WAS TAKEN AND IT DOES NOT PAY — corrected 2026-08-06.** This said a
    uniform section whose neighbours are all uniform-equal could be skipped entirely, for a
    ~10.6ms/column floor at any height. Built it in `column.ts` and **measured ~0% saving on the real
    generated world.** The 10.6ms figure came from *synthetic* uniform sections; once ore spans
    y16..156 at 26 attempts per chunk and carvers cut through, only **14% of sections are uniformly
    solid**, and those still need all six neighbours to agree. **The ore density that makes the game
    good is what kills the optimisation.** Kept (correct, free, asserted output-identical, and it
    would pay in a sparser world) but do not budget for it.
  - **★ The mesher's OWN uniform fast path is the one that pays** — 6 boundary planes instead of 51,
    in `greedy.ts`. 45% of sections are uniform (31% sky, 14% solid) even when their neighbours are
    not, so that one fires constantly. Two different optimisations; only conflate them at the cost of
    re-deriving this.
  - **★ REAL measured cost per 64-wide streaming chunk (16 columns), on generated content:**
    **generation ~109ms, meshing ~47ms.** The earlier ~23ms meshing estimate was taken on synthetic
    uniform sections and is roughly 2x optimistic against a world with ore and caves in it. ~156ms
    per chunk arrival is ~9 frames, so streaming MUST spread this — which is exactly what `Stage`
    exists for (resume at the last completed stage), plus a Worker.
  - ⚠ **The datum split is NOT part of this ruling and must not be treated as format.** 128 is the
    format; *where y=0 sits relative to sea level* is a tuning constant. The sketch was ~96 above /
    ~32 below, but 32 is shallow for a mining game (Minecraft ships ~64 below and later −64). **Move
    the datum freely during the mesher spike — it costs nothing.** Only the 128 is locked.
- **(c) ⛔ REVERSED 2026-08-06, same day, by Alex — the canvases do NOT survive.** The original
  ruling kept them as *"the only hand-authored land in the game."* **That claim was false and the
  measurement killed it:** home-plot is **96.1% void** (868 real cells in 150×150, 764 of them one
  grass tile); the-outfields **99.3% void** (1,120 cells); twilight-thicket has **3 cells of path in
  a 400×400**; and the best of them, spirit-meadow, is **74,712 cells of a single grass tile**. The
  four Wilds regions were never painted at all — `gen-wilds.mts` generated them. These are *shapes*,
  two to five tiles each, with no path network and no composition. **The heightmaps go with them** —
  a sculpt of a canvas that no longer exists is equally stale.
  - **What actually survives, and it is not the land:** `tiles.ts` (the pixel art itself — untouched,
    it becomes the material skin, and it is where the drawing hours went), the sprites, and the
    **placements** (NPCs, chests, structures, pickups, nodes, spawners). Placements are coordinates
    *into* dying canvases, so they need **re-homing into the class-1 authored pieces** — that is the
    one piece of real migration work in the whole retirement.
  - **⚠ Do not let this sweep up the mortal side.** Rune Hold / the holds / station / Crucible run
    **0–14% void**, not 45–99% — real interior maps (though even Rune Hold is 100×100 of *four*
    distinct tiles). Different continent, different year, outside the voxel Ather. Leave them alone.

**Consequence for the sculpt:** with (c) reversed there is nothing to lift onto the datum. Terrain
comes from the generator, and the datum is a tuning constant per (b).

## 9. What we take from Supra, and what we leave

**Take:** `crafting.rs` (990 lines — recipe registry, stations, `build_canon_recipes()`),
`inventory.rs` (783), and the shapes in `economy.rs` / `progression.rs` / `loot.rs`. These are
already written against canon and are a *draft of exactly this system*. Port the schema outward
into the JSON registry (§ 4) so both engines read one source.

**Leave:** `terrain.rs`. It is a **heightmap** — FBM noise, 32×32 cells at 1m, Whittaker biomes by
elevation × moisture — i.e. the same 2.5D model Shimmer already has, in Rust. It does not have a
z-column and switching engines never bought us voxels. Also leave `biome_resources()`, per § 4.

## 10. Canon boundary — read before naming anything

Material **names and what they are in the world** are Magii's. Recipes, yields, hardness, tool
tiers, drop rates, re-mesh budgets: Jin's, no ruling needed. Goldwood / shimmeroak / starwillow /
dawnwood / ather crystal and the four skills are **already ruled** — build with those. Every slot
needing a new name gets marked `TBD-CANON` and they go to /magii as **one batched question**.
Inventing forty rocks in a design doc is how a build reaches up and rewrites the world; it is the
named failure mode here (the arcade-draughts precedent) and it is refused the same way.

## 11. Open questions

- **Section size `S`** — pick from a measured re-mesh budget, not from Minecraft's 16. Needs a
  spike: time a greedy mesh of one section in a Worker on the phone.
- **Does the Outfields seam survive as the one non-gate transition**, now that the Ather composes
  into one zone? Canon says leaving the tended world is an event; that may be atmosphere rather
  than a warp.
- **Water.** Deep Water is 0.29% of painted cells and currently `SOLID`. Flowing/volume water is a
  large system on its own — v1 should almost certainly keep it a solid, non-flowing material.
- **Caves.** The research ruled carvers out *because* we had no z-column. That reason expires here.
  Carvers become available and want their own pass.
- **The zone cutover and the 7-canvas composition** are unchanged and still queued; the voxel model
  lands on top of one continuous surface, which is another argument for composing first.
