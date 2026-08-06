# Worldgen research — how Mojang does it, and what transfers
> Compiled 2026-08-06 by a 6-agent tiered workflow (4x Sonnet research -> Sonnet accuracy gate -> Opus synthesis),
> run `wf_28ce5271-5e1`. Scoped to the four questions blocking Shimmer's infinite-Wilds rework.
>
> **Accuracy gate: 19 claims confirmed against primary sources, 1 corrected, 0 refuted, 10 left explicitly unknown.**
> Minecraft's worldgen was rewritten wholesale in 1.18, so every claim below carries a version label.
> An unlabelled Minecraft claim is usually three different systems mashed together.
>
> ⚠ **AMENDED 2026-08-06 — three changes, read before citing this file.** ① The stronghold section
> said **ten**; canon had already ruled **8, Acts 2–9, banded 3/4/1** on 2026-07-24 and this doc never
> checked. Rewritten as **two classes** (8 authored + unbounded procedural). ② **Carvers are
> un-skipped** — they were skipped for lack of a z-column, and the voxel ruling (height 128) expired
> that reason. ③ Steal #3 is **load-bearing from day one**, not a later optimisation.
>
> ⚠ **We copy DECISIONS, not CONSTANTS.** Their tuning assumes voxels, a 16-block chunk, Java, and
> twenty years of iteration. Ours is a 2.5D tile grid + height tiers, 64-tile chunks, in a browser,
> on a phone. Anything version-specific or voxel-only is called out as such.

## What Mojang actually does

**Verified mechanisms only. Version labels are load-bearing; an unlabelled Minecraft claim is usually three different systems mashed together.**

- **Staged chunk statuses (1.18+).** `empty → structure_starts → structure_references → biomes → noise → surface → carvers/liquid_carvers → features → initialize_light/light → spawn → full`. Everything before `full` is a proto-chunk holding only that stage's data. A chunk can sit frozen at an early status forever and still answer a neighbour's query. (Which version first shipped the named enum, 1.13 vs 1.14, is unresolved; pre-1.13 definitely used the older two-phase generate+populate.)
- **Structure placement is O(1) pure math (concept ~1.7-1.12 hardcoded, data-driven `structure_set` JSON in 1.18+).** World is tiled into cells of `spacing` chunks; one placement attempt per cell at a jittered offset bounded by `separation`; RNG seeded from world seed + cell coords + a per-structure-type `salt` (salt exists only so two types with identical spacing/separation don't land in lockstep). Two jitter modes: `linear` = uniform over `(0, spacing-separation-1)`, `triangular` = `floor((r1+r2)/2)` over the same range, biased to cell centre. Biome filtering happens *after* the grid picks the candidate, and a failed biome check kills that cell rather than retrying elsewhere.
- **Owning-chunk starts + pointer references (1.13+, refined 1.18).** The one chunk whose cell math wins generates the structure's *entire* piece layout in one shot and stores it in its own NBT under `structures.starts` with a bounding box. Nearby chunks store only a packed 64-bit chunk coordinate (X low 32 bits, Z high 32) under `structure_references`, not geometry. At `features`, each chunk dereferences those pointers and clips in only the pieces landing inside its own 16x16 column.
- **Features write to at most a 3x3-chunk area centred on the placing chunk (1.18+).** A tree rooted at a chunk edge is allowed to spill into neighbours. (The specific "neighbours must already be at carvers status" gate is *unverified*; the 3x3 write bound is confirmed.)
- **Pre-1.13 did it the bad way and it is documented.** `populate()` targeted a 16x16 area offset +8/+8 so it sat on the intersection of 4 chunks, which required all 4 to have terrain, which triggered *synchronous on-demand generation of missing neighbours*. Chained, that is the cascading-worldgen lag/stack-overflow bug. The staged model with a precomputed margin replaced it.
- **1.18+ biomes: nearest-match in a 6-axis continuous space** (temperature, humidity, continentalness, erosion, weirdness, depth), sampled per 4x4 column, falling back to closest point if nothing matches. Temperature/humidity affect biome choice only; continentalness/erosion/weirdness drive *both* biome and terrain shape; depth is derived from terrain height, not sampled. `PV = 1 − |3·|weirdness| − 2|` is confirmed verbatim off the debug screen.
- **★ Terrain height in 1.18+ is never a function of biome ID.** Height comes from splines over continentalness/erosion/weirdness; biome is a separate lookup over the same continuous fields. That is why nothing steps at a biome edge and why there is no per-edge blend pass. Pre-1.18 (Beta 1.8 through 1.17.1) each biome carried its own base-height and height-variation constants, which forced "Hills" variant biomes to exist at all and produced hard elevation seams. (Biomes as a concept date to Alpha 1.2.0, Oct 2010; Beta 1.8 replaced that with the layer-stack, it did not invent biomes.)
- **"Biome blending" (1.18 only) is a migration seam fix**, smoothing pre-1.18 saved chunks against new-height chunks. It is not a per-edge biome smoother. Do not cite it as one.
- **Strongholds ignore the grid entirely (1.9+).** Concentric rings centred on world origin: 8 rings, 128 total, counts 3/6/10/15/21/28/36/9, radii 1280-2816 / 4352-5888 / 7424-8960 / 10496-12032 / 13568-15104 / 16640-18176 / 19712-21248 / 22784-24320 blocks. Ring N gets roughly `spread·(N²+3N+2)/6` slots until the 128 cap truncates ring 8 from 45 to 9. Within a ring: equal angular wedges plus jitter, proven by the outer ring's 9 strongholds sitting ~36° apart (ten wedges, one dropped) instead of 40°. Pre-1.9: exactly 3, 120° apart, radius 640-1152.
- **Storage (Anvil, 1.2.1 / 12w07a onward).** 32x32-chunk region files, 8KiB header of per-chunk sector offsets + timestamps, 4KiB sectors, zlib (LZ4 added 24w04a). Per section: a *local* palette plus a bit-packed index array at minimum width (min 4 bits) since the 1.13 Flattening; since 1.16 an index never straddles two longs. **A section whose palette has one entry omits the packed array entirely.**
- **Once a chunk finishes generating, 100% of it is written to disk forever.** There is no diff-against-the-generator. The only free case is a chunk never visited, which is all-or-nothing per column.
- **`simulation-distance` is separate from `view-distance` (added 1.18).** Chunks inside render but outside simulation are loaded and drawn but not ticked.

## ★ What we STEAL

**★ 1. Owning-chunk POI starts + bounded-radius references.** When a chunk's placement math says it owns a stronghold anchor, it generates the whole footprint once and stores it keyed to itself; every chunk within `ceil(maxFootprint / CHUNK)` stores a packed pointer and, at decorate time, clips in only the pieces inside its own 64x64. Transfers cleanly because it is pointer bookkeeping over a grid, nothing voxel about it. **This is the exact hole `edgeGate()` does not cover: the edge hash makes terrain openings agree, it says nothing about an object that straddles a border.** Cost: ~1 day. A `poiStartsAt(seed, cx, cy)` pure function, a `Map<chunkKey, PoiRef[]>` in the mount, and a clip step in the chunk builder.

**★ 2. An explicit per-chunk status enum with a generation margin.** Something like `NOISE → POI_STARTS → POI_REFS → DECORATED → READY`, plus a rule that a stage may only run when its declared neighbour ring is already at the prior stage. `wildsLoadRadius()` already does the right thing in miniature (`radius * CHUNK + WILDS_LOAD_MARGIN`); generalise it so the margin is sized by the largest POI footprint, not one chunk. **Never let a stage synchronously generate a missing neighbour: that is precisely the pre-1.13 cascading bug, and in a browser it is a frame-time cliff, not a lag spike.** Cost: ~1 day, mostly in `syncWilds` and `chunk-stream`.

**★ 3. Grid + jitter + salt placement for the *many* case.** `spacing`/`separation`/`salt`, triangular jitter for even-looking spread. Not for the 8 canon strongholds (see below — those are authored and guaranteed), but this is the correct machine for **every class-2 structure**: procedural holds, camps, ruins, rune caches, patrol posts, Moglin burrow-villages. Same trick `edgeGate()` already uses, one level up: hash of (seed, cell coords, salt) instead of hash of the shared edge. Cost: ~3 hours, one function and a table of `{spacing, separation, salt}` per POI type. **Load-bearing from day one, not a later optimisation** — since 2026-08-06 it is what makes the world unbounded past the eighth hold.

**★ 4. Height and biome as two separate reads of the same noise fields.** Pick 3-5 axes (elevation-bias, roughness, temperature, moisture, plus layer-index as a discrete axis), sample them per tile off the existing `terrainNoise()` domain-warp, then: height-tier = spline over elevation-bias/roughness; biome = nearest-match in axis-space. **Never derive the height tier from the biome id, or we rebuild the pre-1.18 mistake and get stepped cliffs at every biome edge.** Nearest-match over ~15 biome points is a brute-force loop, no kd-tree needed at our count. Cost: ~1-2 days in `wilds-gen.ts`, and it lands *before* the infinite migration, independent of it.

**5. Palette + minimum-bit-width indices, per layer.** Our tile vocabulary per 64x64 chunk is small; a local palette plus packed indices is dictionary compression over a bounded alphabet, not a voxel trick. `sparseGrid` / `sharedRow` / `materializeRows` in `wilds-world.ts` is already the single-value-section trick by another name, so extend the same idea: a mid or floor layer that does not exist under a chunk serialises to a one-entry sentinel, never an array. Cost: ~half a day for the palette codec, and it pays off most on the wire.

**6. Render radius vs simulation radius as two numbers.** `DEFAULT_RADIUS = 3` currently governs both drawing and everything else. Split it: draw the `(2r+1)²` window, tick enemies/spawns/growth only in an inner `r=1`. This is the cheap unlock for #294 (real-time world enemies) on a phone. Cost: ~2 hours plus whatever the enemy tick ends up being.

## ⛔ What we SKIP

- ~~**Carvers.**~~ **★ UN-SKIPPED 2026-08-06.** This said *"we have a tile grid plus a height tier and no z-column, so there is nothing to tunnel."* **That reason expired the same day** — Alex ruled the world voxel at height 128 (`VOXEL-WORLD-MODEL.md` § 8), so there is now a column to carve. Voranyx Caverns becomes generated mineshafts opening into large caverns rather than an authored region. **The cost to respect:** carvers are among the most expensive stages, so this must run as a chunk stage with a declared neighbour margin and **never synchronously generate a missing neighbour** — steal #2's rule, and in a browser that failure is a frame-time cliff, not a lag spike.
- **Light propagation as a generation stage.** It is a stage at all only because illumination has to flood through a voxel volume across a chunk border. Our lighting is a shader concern, not a worldgen dependency, and porting it would drag in a neighbour-margin we do not otherwise need.
- **The `depth` biome axis.** It is derived by measuring down a real vertical column. We have no such quantity. Feed layer-index (surface/mid/floor) in as a discrete axis instead and stop there.
- **Surface rules as a per-column cascade.** The cascade shape exists to walk downward through blocks. Keep the *intent* (an ordered predicate list deciding a tile's variant) keyed on `(biome, local noise, neighbour tile)`, drop the column walk.
- **Vertical sections, 24-section stacks, the Anvil NBT container.** Tooling shaped around 3D chunk columns. The 32x32 sharding idea is fine to imitate; the file format is not.
- **1.18 "biome blending."** It is a one-time fix for old saves meeting new height limits. Nobody should reach for it as a per-edge smoother, ever. Our 400x400-region-to-infinite migration is closer to *that* problem than to the biome one, and needs its own pass.
- **★ Vanilla's persistence model.** Minecraft writes every generated chunk in full, forever, touched or not. We want the opposite: **a chunk file exists only if it contains a player edit, and file-absence means "pure procedural, regenerate."** That is a deliberate divergence from Mojang, not an oversight, because our generator is cheap and deterministic and our storage is a browser.
- **Every tuning constant.** 1280-block ring radii, spacing 32/separation 8, ~60 biome points, the 150-170KB-per-chunk RAM figure (an unverified forum estimate anyway). Twenty years of tuning against a 16-block chunk and a walking speed we do not share.

## The cross-border feature problem

`edgeGate(seed, ax, ay, bx, by, span)` hashes the unordered region pair, so both sides agree on where the border opens with no global pass. That is the terrain half. **The unsolved half is objects: a stronghold, a bridge, a grove, or a cave mouth whose footprint straddles a chunk or region boundary has no owner today, so it either gets generated twice, gets clipped inconsistently, or forces a region-wide pass we cannot afford in an infinite world.**

Mojang's answer is the starts/references split: exactly one chunk *authors* the whole feature, everyone nearby holds a pointer and clips.

Smallest thing that gets the same property:

1. `poiStartsAt(seed, cx, cy) → PoiStart[]` , pure, O(1), no neighbour reads. A chunk asks only about itself.
2. When building chunk `(cx, cy)`, call it for every chunk in the box `±ceil(maxPoiFootprint / 64)`. With a 128-tile max footprint that is a 5x5 scan of a pure function, which is nothing.
3. Clip each returned footprint against this chunk's 64x64 and paint only the overlap.

No storage, no pointers, no statuses in v1. The pointer table and the status enum are the optimisation you add when the footprint math gets expensive enough that recomputing it 25 times per chunk shows up in a profile. The property that matters, one author per feature and zero global coordination, arrives on day one from the purity of step 1 alone.

## Strongholds: TWO CLASSES, not one ring table

> ⚠ **CORRECTED 2026-08-06.** This section originally said **ten** strongholds in three rings split
> 3/3/4, and built its whole argument on that number. **It was wrong against a canon ruling that
> predated it by two weeks:** `game/shimmer-storyline.md:131` — *"Wilds stronghold count — RULED
> 2026-07-24 (Alex): **8 strongholds, Acts 2–9, banded 3/4/1**,"* superseding the four-element anchor
> **as the campaign spine** (one hold per Act). The research never checked canon for a number canon
> had already fixed. Same family as the Faro / Groq / handoff-sort lies: **a doc asserting a settled
> number is worse than no doc, because nobody re-checks a box already ticked.** Verify against
> `CANON/game/`, not against this file.

**Alex's 2026-08-06 call — strongholds are no longer a fixed set of N.** Reconciled with the ruling
above by splitting them into two classes, which is Mojang's own answer and costs nothing:

**Class 1 — the 8 canon strongholds.** Authored, guaranteed, one per Act (2–9), banded **3/4/1**.
These carry the campaign, so their placement must be *guaranteed*, not probabilistic. Bake them
offline into the authored-POI table the infinite generator needs regardless, using the ring math
only as an authoring heuristic: wedge-centre angles plus a small deterministic per-stronghold salt
jitter (Mojang's equal-wedge-plus-jitter, proven by the outer ring's 36°-not-40° anomaly), radius a
seeded uniform draw inside each band. **Do not implement Minecraft's lazy per-chunk ring algorithm** —
that machinery exists only because Mojang cannot know how many a player will need, and we do.
The wedge split buys the property that actually matters: **a hold lies ahead whichever heading the
player commits to at spawn**, which a jittered grid gives only in expectation. Band radii in tiles
are a playtest call, same class as `GUARD_TUNING`.

**Class 2 — unbounded procedural holds, ruins, camps, rune caches, patrol posts.** Grid + jitter +
salt (steal #3), infinite, no story weight. This is what makes "keep walking and there is always
another" true past the eighth.

**★ The split retires both consequences the ten-stronghold design had to accept.** The world stops
being hard origin-centric (only the 8 canon holds are origin-banded; procedural ones are everywhere),
and "after the last one it is pure filler" stops being true, because filler was always the plan for
class 2. Steal #3 is no longer a thing to build *later when someone walks past ring 3* — it is
load-bearing from the first session.

**The same two-class shape applies to settlements**, and canon forces it there too: **Gloview
Village is canon** (`shimmer-storyline.md:75` — *"a settlement of free, uncollared Moglins… the
counter-image to the holds"*), so it is class 1 — authored and guaranteed. Generic Moglin burrow-
villages are class 2, procedural, Minecraft-village style. **And the tutorial is class 1 with an
extra constraint:** Moonwell Glade (Greg's home, per `moonwell-glade-gregory-s-home`) must be
*guaranteed near origin with spawn inside it*, or the tutorial is missable.

## Open questions

- **Exact per-status neighbour radii in current Minecraft are unresearchable at this depth.** Only "features write to at most 3x3" is confirmed; the structure_references search radius and the light radius stayed qualitative in every source. Irrelevant to us in practice, since our margin is set by our own largest footprint, not theirs.
- **Whether Minecraft's decorate step is gated on neighbours reaching `carvers` specifically** is unconfirmed. If we adopt the status enum, we pick our own gate and document it rather than copying an unverified one.
- **Whether the named 12-stage pipeline arrived at 1.13 or 1.14** is unresolved. Does not change the design.
- **How many biome axes we actually want**, and their target points, is a tuning question no amount of Minecraft reading settles. Start at 4 (elevation-bias, roughness, temperature, moisture) plus layer-index; add a "weirdness" analogue only if biome variants start feeling too predictable.
- **Ring radii in tiles** are a guess until someone walks them. Needs a playtest pass, same class of decision as `GUARD_TUNING`.
- **The 400x400 region JSON to infinite migration** (what happens to already-saved regions when the manifest goes away) is genuinely unresearched and is closer to Minecraft's 1.18 old-chunk blending problem than to anything else in this brief. It deserves its own pass before `syncWilds` is touched.
- **Whether player edits diff cleanly against a regenerating world** is our own problem, since we are deliberately diverging from vanilla here. Open question: what happens when the generator changes and a saved edit no longer matches the terrain under it. Version the generator and store the version with the edit, or accept drift.
## Corrections the accuracy gate made to the research

- **Topic 2, finding 6 (pre-1.18 layered biome generator): version field states 'Beta 1.8 (2011, biomes introduced) through 1.17.1 (2021)'.**
  - Biomes were NOT introduced in Beta 1.8. They were introduced in Alpha 1.2.0 ('the Halloween Update', released October 30, 2010) using an earlier noise-based temperature/rainfall biome system with ~13 biome types. Beta 1.8 (2011) REPLACED that earlier system with the layered-grid-transform pipeline (island growth + zoom + climate assignment + rivers) the finding actually describes — confirmed via minecraft.wiki's dedicated 'Biome/Before Beta 1.8' article and general version-history sources. So the layered pipeline's version range (Beta 1.8 through 1.17.1) is correct, but the parenthetical '(biomes introduced)' misattributes the introduction of biomes as a concept to Beta 1.8 rather than to Alpha 1.2.0 roughly a year earlier. This is a minor date/attribution error, not load-bearing for the appliesToUs section, but should not be repeated as fact.

## What research could NOT establish (do not fill these in from memory)

- Topic 1: Exact numeric neighbor-dependency radius per ChunkStatus (structure_references search radius, features-stage WorldGenRegion radius beyond the general '3x3' figure, light-stage radius) in current 1.21 source — not found in decompiled/primary form this pass either; wiki language stayed qualitative.
- Topic 1: Whether noise/surface/carvers internal stage ORDER changed between 1.13-1.17 and the 1.18 rewrite — not resolved by this verification pass.
- Topic 1: Exact version the 12-stage named ChunkStatus pipeline was introduced (1.13 Flattening vs 1.14 village rewrite) versus the older two-phase generate+populate model — not resolved; only confirmed pre-1.13 used the offset-chunk populate system and cascading-lag bug was real.
- Topic 1: Whether the specific 'immediate neighbors must be at carvers status before this chunk can decorate' gate is the actual mechanism (vs. some other synchronization) — search confirmed the 3x3 feature-writable area but did not confirm this specific status-gating detail.
- Topic 2: Exact nearest-neighbor search structure MC uses at runtime (kd-tree vs brute force) for the 6D biome parameter lookup — not verified against source.
- Topic 2: Precise per-axis noise implementation (octave counts, frequencies) for the 6 multi-noise parameters — not verified beyond qualitative behavior.
- Topic 3: Literal decompiled formula for angular jitter magnitude within a stronghold ring wedge — only the documented outcome (9 strongholds at ~36° not 40°) was confirmed, not the underlying jitter-generation code.
- Topic 3: Whether Bedrock Edition's stronghold/structure algorithms share Java's exact salt/RNG mechanics or are a separate implementation — not researched this pass.
- Topic 4: The ~150-170KB-per-loaded-chunk RAM figure remains an unverified community/forum estimate, not a Mojang-published number — appropriately flagged low-confidence by the original researcher and not independently confirmable via search.
- Topic 4: Exact bit-width threshold where a section's local palette falls back to the global block-state table (commonly cited as 8 bits) — not independently reverified against 1.21.x source this pass.
