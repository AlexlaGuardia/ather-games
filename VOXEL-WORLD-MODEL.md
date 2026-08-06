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

## 5. Heightfield → voxels

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

## 8. ⛔ Three calls that are Alex's

- **(a) Voxel scale vs the art.** Tiles are 32px and the player is ~1 tile wide. **One voxel = one
  tile** makes a block player-sized, the Minecraft read. Larger voxels read chunkier and cost less.
  *Recommendation: 1 voxel = 1 tile*, because it keeps every existing sprite, sculpt and placement
  coordinate valid — the transition costs nothing in re-authoring.
- **(b) World height / how deep mining goes.** Currently 0–6. Minecraft is 384. This is the biggest
  memory lever, though § 2 shows even 128 is affordable. *Recommendation: 128*, split as ~96 above
  the surface datum and ~32 below — deep enough for real mining, cheap enough for a phone.
- **(c) Do the seven painted canvases survive** as extruded surface (§ 5), or does the whole Ather
  become generated country? *Recommendation: survive.* They are the only hand-authored land in the
  game and § 5 costs nothing to keep them.

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
