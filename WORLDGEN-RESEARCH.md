# Worldgen research — how Mojang does it, and what transfers
> Compiled 2026-08-06 by a 6-agent tiered workflow (4x Sonnet research -> Sonnet accuracy gate -> Opus synthesis),
> run `wf_28ce5271-5e1`. Scoped to the four questions blocking Shimmer's infinite-Wilds rework.
>
> **Accuracy gate: 19 claims confirmed against primary sources, 1 corrected, 0 refuted, 10 left explicitly unknown.**
> Minecraft's worldgen was rewritten wholesale in 1.18, so every claim below carries a version label.
> An unlabelled Minecraft claim is usually three different systems mashed together.
>
> ⚠ **AMENDED 2026-08-06 — read before citing this file.** ① The stronghold section said **ten**;
> canon had already ruled **8, Acts 2–9, banded 3/4/1** on 2026-07-24 and this doc never checked.
> Rewritten as **two classes** (8 authored + unbounded procedural). ② **Carvers are un-skipped** —
> skipped for lack of a z-column, and the voxel ruling (height 128) expired that reason. ③ Steal #3
> is **load-bearing from day one**, not a later optimisation. ④ A **second research round** appended
> *Trees and ores* below (same 6-agent shape; 33 confirmed / 1 corrected / 0 refuted / 18 unknown)
> and amended two claims above it: `heightmaps` was missing from the status chain, and the 3x3
> feature write bound is **downgraded from confirmed to medium**. ⑤ That round also **un-skips the
> `depth` biome axis** — same expired reason as carvers. See its own header for the detail.
>
> ⚠ **We copy DECISIONS, not CONSTANTS.** Their tuning assumes voxels, a 16-block chunk, Java, and
> twenty years of iteration. Ours is a browser voxel world at height 128 with 64-tile chunks and
> 16³ mesh sections. Anything version-specific or Java-only is called out as such.
> *(This line read "a 2.5D tile grid + height tiers … on a phone" until 2026-08-06 — both halves are
> now wrong: the world is voxel, and the phone was dropped as a hard target.)*

## What Mojang actually does

**Verified mechanisms only. Version labels are load-bearing; an unlabelled Minecraft claim is usually three different systems mashed together.**

- **Staged chunk statuses (1.18+).** `empty → structure_starts → structure_references → biomes → noise → surface → carvers/liquid_carvers → features → initialize_light/light → spawn → heightmaps → full`. *(**`heightmaps` added 2026-08-06** — the second research round's gate caught it missing against the same yarn 1.19.2 `ChunkStatus` enum this claim already cited. Nothing in our design turns on it; corrected so nobody copies the chain as complete.)* Everything before `full` is a proto-chunk holding only that stage's data. A chunk can sit frozen at an early status forever and still answer a neighbour's query. (Which version first shipped the named enum, 1.13 vs 1.14, is unresolved; pre-1.13 definitely used the older two-phase generate+populate.)
- **Structure placement is O(1) pure math (concept ~1.7-1.12 hardcoded, data-driven `structure_set` JSON in 1.18+).** World is tiled into cells of `spacing` chunks; one placement attempt per cell at a jittered offset bounded by `separation`; RNG seeded from world seed + cell coords + a per-structure-type `salt` (salt exists only so two types with identical spacing/separation don't land in lockstep). Two jitter modes: `linear` = uniform over `(0, spacing-separation-1)`, `triangular` = `floor((r1+r2)/2)` over the same range, biased to cell centre. Biome filtering happens *after* the grid picks the candidate, and a failed biome check kills that cell rather than retrying elsewhere.
- **Owning-chunk starts + pointer references (1.13+, refined 1.18).** The one chunk whose cell math wins generates the structure's *entire* piece layout in one shot and stores it in its own NBT under `structures.starts` with a bounding box. Nearby chunks store only a packed 64-bit chunk coordinate (X low 32 bits, Z high 32) under `structure_references`, not geometry. At `features`, each chunk dereferences those pointers and clips in only the pieces landing inside its own 16x16 column.
- **Features write to at most a 3x3-chunk area centred on the placing chunk (1.18+).** A tree rooted at a chunk edge is allowed to spill into neighbours. (The specific "neighbours must already be at carvers status" gate is *unverified*. ⚠ **The 3x3 write bound was labelled "confirmed" here and is DOWNGRADED to medium confidence, 2026-08-06** — the second round could not reproduce the passage verbatim in three direct fetches; it is corroborated by search summaries and by this doc's own earlier pass, i.e. **inherited, not re-proven.** It does not change the design, because our margin is set by our largest footprint rather than theirs — and see the trees/ores section: at CHUNK=64 a literal 3x3 would be a **192-tile** margin, which is absurd. The confidence label was simply wrong.)
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
- ~~**The `depth` biome axis.**~~ **★ UN-SKIPPED 2026-08-06.** This said *"it is derived by measuring down a real vertical column. We have no such quantity."* **Height 128 gave us the column** — the same expiry that un-skipped carvers. Depth is now the correct axis for **ore banding** (see *Trees and ores* steal #8, where our Prospecting tier ladder maps onto it). ⚠ Reading a material off **depth** is NOT the pre-1.18 mistake: depth is a real geometric quantity, whereas a **biome id** is a categorical label with no geometry behind it. Whether we also want depth as a *biome* axis stays open and unruled.
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

---

## Trees and ores: how Mojang grows and buries things

> Compiled 2026-08-06, second research round (4× Sonnet research → Sonnet accuracy gate → Opus synthesis).
> **Accuracy gate: 33 claims confirmed, 1 corrected, 0 refuted, 18 left explicitly unknown.**
> Scoped to the question the voxel ruling opened: the 12 resource nodes are props standing on terrain,
> and the whole move is making the terrain *be* the resource. Same house rules bind — **decisions, not
> constants**, every claim version-labelled, and **never derive terrain height or material from biome id.**
>
> ⚠ **This section AMENDS two lines above it.** ① The staged-status chain in *What Mojang actually does*
> omits **`heightmaps`**, which sits between `spawn` and `full`. The gate caught it against the same yarn
> 1.19.2 `ChunkStatus` enum the original claim cited: `…SURFACE, CARVERS, LIQUID_CARVERS, FEATURES, LIGHT,
> SPAWN, HEIGHTMAPS, FULL`. Nothing in our design turns on it; fix it so nobody copies the chain as complete.
> ② That section calls the **3×3-chunk feature write bound "confirmed."** Downgrade it to **medium**. Three
> direct fetches at minecraft.wiki failed to reproduce the passage verbatim this round; the figure is
> corroborated by search summaries and by our own earlier pass, and is inherited, not re-proven. It does not
> change the design (our margin is set by our largest footprint, not theirs) but the confidence label was wrong.
>
> ⚠ **And it expires a third skip.** *What we SKIP* drops the **`depth` biome axis** because "it is derived by
> measuring down a real vertical column. We have no such quantity." Height 128 gave us the column, same as it
> did for carvers. Depth is now the correct axis for **ore banding** — see steal #8. Whether we also want it as
> a *biome* axis stays open and unruled.

### What Mojang actually does

**Trees**

- **The WHAT/WHERE split (`configured_feature` = what it looks like, `placed_feature` = where and how often, 1.18-pre1).** Before 1.18 a configured feature carried its own placement via a `decorated` wrapper. Trees became data-configurable earlier, as a `minecraft:tree` feature in **1.16.2 (20w28a)**. *Confidence: high.* (Sources: minecraft.wiki `Placed_feature`, `Configured_feature`, `Tree_definition`.)
- **A tree is two strategy objects plus block providers (field set stable 1.17/21w10a → 1.21.5, verified against live vanilla JSON).** `trunk_placer` + `foliage_placer` + `trunk_provider`/`foliage_provider` + `minimum_size` + `decorators[]`, with `dirt_provider`/`force_dirt` added in 21w10a and `root_placer` mangrove-only. *Confidence: high.* Nine trunk placers and eleven foliage placers exist in 1.21.5; the ones that matter are that **each is an interface, not a special case** — `TrunkPlacer` is `(rng, base, height) → log positions`, `FoliagePlacer` is `(rng, trunkTop, radius) → leaf positions`.
- **Placement is an ordered modifier chain, and the order is cheap-checks-first (verified identical on live 1.18.2, 1.19.4 and 1.21.5 data).** `count` → `in_square` → `surface_water_depth_filter` → `heightmap` → `biome`. `count` is an IntProvider, commonly a `weighted_list` like 19:0-trees / 1:1-tree, which is how "sparse" is expressed. **A `count_extra`-style additive modifier does not exist in any 1.18+ vanilla data checked** — "sometimes one more" is folded into `count`'s provider. *Confidence: high.*
- **`in_square` is the anti-double-generation mechanism, and it works by ownership, not by dedup (1.18+).** It confines a tree's *origin* X/Z to the placing chunk's own 16×16 footprint, so exactly one chunk ever rolls a given tree. That chunk then gets write access to a bounded neighbourhood and paints its canopy across the border directly. The neighbour, when its turn comes, rolls only its **own** feature list from its **own** coordinates — there is no cross-chunk "already placed?" lookup to perform, because there is nothing to double-roll. *Confidence: high on the mechanism; medium on the 3×3 figure, see amendment above.*
- **Species mix is a `random_selector` meta-feature, not weights on trees (1.18+).** A `default` feature plus an ordered `{feature, chance}` list. Live: `trees_taiga` = 33.3% pine else spruce; `trees_savanna` = 80% acacia else oak. **The selection algorithm itself is unconfirmed** — sequential Bernoulli-first-hit-wins vs a normalized weighted pick. The wiki documents the data shape only. *Confidence: medium (shape), unknown (algorithm).*
- **Trees run in `VEGETAL_DECORATION`, step 10 of 11 (1.18+).** Two independent derivations agree exactly — live biome JSON's 11-element `features` array (index 9) and the yarn 1.18 `GenerationStep.Feature` enum. The gate flagged this as genuine corroboration rather than one source echoing itself. Within a step, feature order must be index-consistent across every biome sharing a feature id. *Confidence: high.*
- **★ Sapling growth reuses the identical configured feature (`TreeGrower`, confirmed present 1.20.6–1.21.x).** `getConfiguredFeature(RandomSource, hasFlowersNearby)` returns the same `Holder<ConfiguredFeature>` worldgen references — which is why an oak sapling can grow into plain *or* Fancy Oak: those are the same two variants the biome's `random_selector` mixes. Bonemeal is a different *trigger*, not different code. *Confidence: medium (the class is javadoc-confirmed; its introduction version is not).*

**Ores**

- **Pre-1.17 was the model they replaced: fixed count per chunk, uniform Y within a fixed band, one ellipsoid per attempt.** Every ore was flat except lapis, which got a hand-built peak by averaging two random draws. *Confidence: medium.* Nothing structural transfers; it is here to name the failure — flat count × uniform Y produces undifferentiated distributions.
- **1.18 made ore fully data-driven, with three parameters that are each worth more than any Y-number they carry.** `size` (0–64, mapped through a non-linear lookup to a max block count), `discard_chance_on_air_exposure` (probability the **whole blob** is discarded if any constituent block touches air — an anti-cave-spoiler roll, not per-block thinning), and `targets` = a list of (rule-test, block-state) pairs so **one feature definition places the stone-tier or deepslate-tier variant depending on what it actually replaced.** *Confidence: high.*
- **One distribution primitive, not three (1.18+ height providers).** `trapezoid(min, max, plateau)`. `plateau = 0` collapses to an isosceles triangle peaking at the range's arithmetic midpoint; `plateau = max−min` flattens to uniform. **You place the peak by choosing where the range sits, not by naming the peak.** *Confidence: high on the parametrization; the sampling formula (is it two averaged uniform draws?) is unconfirmed.*
- **Ores get multiple independent batches layered, not one clever curve (1.18–1.20 tuning).** Iron = a high-altitude small-blob batch + a main deep triangle + a deep uniform. Gold = a main triangle + a deep uniform + a badlands-only bonus batch. Copper = a normal batch + a bigger-blob dripstone-cave variant. The design reason is the finding: **a single curve cannot express both "common and shallow" and "has a special-case bonus somewhere," so they stack batches rather than complicate the distribution.** *Confidence: medium on shape.* **The exact Y-bands and attempt counts are NOT verified** — the researcher's own two sources disagreed for iron and no page carried a version pin. Treat every number as shape.
- **Two placement primitives: `ore` (ellipsoidal blob, all normal ores) and `scattered_ore` (dispersed, ancient debris only, where block count equals `size` directly).** *Confidence: medium.*
- **★ Ore veins are a DIFFERENT MECHANISM with the opposite ordering, and this is the trap (1.18+).** Large copper/iron veins are generated **inside the terrain/noise density pass** via three density functions (`vein_toggle` decides if a column has one, `vein_ridged` shapes the branching snake, `vein_gap` perforates it) — the same router that carves caves. So veins are placed **before** carving and get **truncated by** caves, mineshafts and structures. Ordinary ore features run in `UNDERGROUND_ORES`, which is inside `features`, which comes **after** `carvers` in the persisted status pipeline — which is *why* they need `discard_chance_on_air_exposure` at all. Both orderings are correct; they belong to different machines. *Confidence: high on both orderings (the gate re-verified the vein claim directly at minecraft.wiki `Ore_vein`).*

**Blocks, drops, and the code/data line**

- **Block ≠ BlockState ≠ Item (1.13, "the Flattening", 17w47a).** A `Block` is the registered behaviour; a `BlockState` is that block plus a fixed property map, and **the BlockState is what is stored per voxel**; an `Item` is a separate registry entirely, which is why `water` has no item and `diamond` has no block. Pre-1.13 was id + 4-bit metadata, capping variants at 16. *Confidence: high.*
- **Per section: a local palette of the distinct states present, plus packed indices at minimum bit-width, floored at 4 (1.18 on-disk; in-memory since ~1.13).** A single-value section costs a one-entry palette and no index array. *Confidence: high.* We already stole this — `voxel/section.ts` ships `uniformValue()` for exactly this reason.
- **Break time = `hardness × (1.5 if the tool can harvest, else 5)`, divided down by tool speed; internally, each tick adds the tool's speed as cumulative damage until it exceeds `hardness × 30`, with a ~6-tick floor.** Efficiency adds `level² + 1`; Mining Fatigue multiplies by hardcoded per-level factors; underwater and airborne each multiply time by 5. *Confidence: high on the mechanism, and every one of those numbers is Minecraft's balance, not ours.*
- **Harvestability is tag membership, not a field (tags since 1.13/17w49a).** `#mineable/pickaxe` says which tool type works; `#needs_stone_tool` / `needs_iron_tool` / `needs_diamond_tool` say which material tier is required; untagged means the lowest tier suffices. The same tag feeds both the break-time "can harvest" branch and loot drop-eligibility. *Confidence: medium — tags-in-general are 1.13, but when these specific tier tags split out of an older hardcoded harvest-level enum is unconfirmed.*
- **Loot tables are data; "drops itself" is not a flag.** `pools[] → entries[]` with `type` (`item`, `alternatives`, `tag`, `loot_table`, `empty`), plus `conditions` and `functions`. Stone's table simply names cobblestone. Silk Touch is an `alternatives` entry whose first child is conditioned on a `match_tool` predicate; Fortune is an `apply_bonus` function on the *normal* entry, which is why it does not stack with the silk branch — different entry. *Confidence: medium; the verbatim current-version bonus-formula id strings were paraphrased by the fetch, not quoted.*
- **★ Their code/data line is finer than "blocks are data," and the reason it sits where it does does not apply to us.** Loot tables, recipes, tags and advancements are data-pack JSON. Hardness, blast resistance, sound and collision are set in **Java at registration time** via the `BlockBehaviour.Properties` builder. That split is a **bootstrap-order constraint** — those values must exist before any data pack loads — not a principle. *Confidence: medium (sourced from Forge's docs mirroring vanilla's pattern, not a vanilla source diff).*
- **Recipes are data; recipe *unlocking* is not part of the recipe.** Unlock rides on a hidden advancement under `minecraft:recipes/root` carrying a `recipe_unlocked` reward, usually triggered by `inventory_changed`. *Confidence: medium.*

**Determinism and the pipeline**

- **A chunk's decoration draws from a per-chunk PRNG derived purely from (world seed, chunk origin), salted per sub-step and per feature index.** The whole 11-step sequence is a pure function of position with no dependency on load order, neighbour state, or wall clock. *Confidence: medium — the exact `index + 10000 × step` salt formula was reconstructed from secondary summaries and no primary quote was reproduced by the researcher or the gate.* The **property** is what matters, and it is not optional for us.
- **The persisted status field is what makes generation resumable and non-repeating.** A chunk only advances forward, its status is saved, and reloading a chunk already at or past a status skips that status. *Confidence: high.*
- **Modern Minecraft avoids the pre-1.13 cascade because a status transition requires neighbours only at some cheap *earlier* status, never at full.** That turns an unbounded recursive dependency graph into a bounded one-directional one. ⚠ **The claim that this was the deliberate fix for the cascading-worldgen bug is inference, not a sourced Mojang statement** — the gate flagged it. The pre-1.13 bug itself is well documented; the causal framing is not.
- **No Mojang-published per-chunk time budget exists for any version.** Searched for, not found. Their actual answer is architectural: worldgen runs off the tick on background threads, so decoration never had to fit a frame. *Confidence: low on any number, high on the architecture.*

### ★ What we STEAL

Numbering continues from steal #6 above.

**★ 7. TrunkPlacer / FoliagePlacer as two interfaces with two implementations each — not the catalogue.** `(rng, base, height) → log writes` and `(rng, trunkTop, radius) → leaf writes`. Straight + forking on trunks; blob + flat-layered on canopies. That is four small functions covering all four wood species, and it is Mojang's actual abstraction (a strategy object) rather than their catalogue of nine and eleven. **Cost: ~1 day.** Lands in `src/app/shimmer/voxel/features/trees.ts` (pure core — `purity.test.ts` already guards the folder).

**★ 8. Depth bands as a single `trapezoid(min, max, plateau)`, and our Prospecting ladder is already the thing it wants.** Say it plainly: **the research supports mapping our tier ladder onto depth bands, and the fit is unusually clean.** `resources.ts` already gates raw_mana / element_crystal / pure_core / ather_crystal at `minLevel` 1 / 4 / 7 / 10 — the ladder is already ordinal, already player-legible, and already shipped. Depth is the only worldgen axis that is monotone, needs no biome, and reads the same to a player on every seed: *deeper is better and more dangerous*. Minecraft's own coal-shallow-to-diamond-deep progression is exactly this shape, and 1.18 expresses all of it with one parametrized distribution rather than four hand-written curves. **We implement one function and give each tier a `{min, max, plateau}` in data.** ⚠ This is the axis the section header amendment un-skipped: depth is a real geometric quantity now, and reading a material off it is **not** the pre-1.18 mistake — the mistake is reading it off a *biome id*, which is a categorical label with no geometry behind it. **Cost: ~half a day** for the provider, plus tuning that never ends. `voxel/features/ores.ts`.

**★ 9. Multi-batch per tier, not one curve per tier.** Each Prospecting tier gets **two** independent bands: a shallow common band that teaches the player the block exists, and a deep rarer band that rewards committing to the descent. This is iron's mountain-convenience-source + main-underground-source split, and it is the cheapest way to avoid a world where "more depth = linearly more of everything." **Cost: nothing extra** — it is a second row in the feature table, given #8. Data only, `data/features/`.

**★ 10. `discard_chance_on_air_exposure` — and using it as a per-tier *readability* knob, not just an anti-spoiler.** This is the highest-value-per-line steal in the section. It is one float, one roll, zero geometry, and combined with the pre-carve/post-carve ordering it is the entire difference between an ore you stumble into and an ore you have to go dig for:

| tier | phase | air-exposure discard | what the player experiences |
|---|---|---|---|
| raw_mana | post-carve | ~0 | visible in cave walls constantly; the tutorial ore |
| element_crystal | post-carve | low | often visible, sometimes has to be dug to |
| pure_core | post-carve | high | almost never free; rewards deliberate tunnelling |
| ather_crystal | **pre-carve** | n/a — carvers truncate it | a rare large pocket, sliced open by a cavern when you get lucky |

**Cost: ~1 hour** for the discard roll; the phase split is free because we already need both a pre-carve and a post-carve decoration slot. `voxel/features/ores.ts` + `voxel/decorate.ts`.

**★ 11. `targets` / rule-test: one feature definition, block-state resolved by what it replaced.** One `ore_raw_mana` feature places `raw_mana_ore[host=stone]` or `[host=deep_stone]` depending on the block it lands in — no duplicated feature per depth skin. **The same trick solves element_crystal's four-way drop.** Today `element_crystal_node` drops violet/storm/earth/water at 25% each, i.e. a slot machine on break. Make `element` a **block state** resolved at placement time instead, and the player can *see which crystal it is before mining it* — readability for free, and it is the mechanism Mojang already uses for a different purpose. **Cost: ~half a day.** `voxel/registry.ts` + `voxel/features/ores.ts`.

**★ 12. The placement-modifier ORDER, translated into our units.** Roll count first (pure RNG, cheapest), then pick X/Z **inside our own chunk only**, then reject on ground material and water, then snap to the surface height. Cheap checks before expensive ones matters more inside a JS frame budget than it ever did on a JVM background thread. **The origin-inside-own-chunk rule is the whole anti-double-generation story** and it costs one modulo. **Cost: ~half a day.** `voxel/features/place.ts`.

**★ 13. One block+item+state registry in JSON, with behaviour hooks in code keyed by the same id.** Mojang splits hardness into Java because of bootstrap order; **we have no such constraint, so hardness, tool gate, tags, drops and look all go in one JSON block definition.** What stays in code is what genuinely cannot be data: tree growth, water behaviour, soil tilling. That mirrors their *real* boundary (relationships between registered things = data; intrinsic behaviour = code) rather than the naive reading of it. **Cost: ~1.5 days** for schema + loader + the loot evaluator. `data/blocks/*.json`, `data/features/*.json`, `data/recipes/*.json`, loaded by `voxel/registry.ts` and `voxel/loot.ts`; Rust reads the identical files later.

**★ 14. One tree definition serving both worldgen and planting (`TreeGrower`'s lesson).** Whatever Farming-adjacent "plant a seed, it grows" mechanic lands later routes through the **same** `TreeSpecies` object worldgen uses. If it forks into its own tree-shape code we will have two definitions of shimmeroak drifting apart within a month. **Cost: ~0 now, ~2 days saved later.** Enforced by there being exactly one export in `voxel/features/trees.ts`.

**15. Tags as a `string[]` per block, plus a tag→member index built once at load.** With 12 nodes across 4 skills, hand-enumerating "which blocks does a Prospecting pick work on" in engine code rots at block #13. No recursive tag-of-tags on day one. **Cost: ~half a day.** `voxel/registry.ts`.

**16. Break progress as accumulated per-tick damage against a per-block threshold, never a timer.** Copy the shape (`progress += toolSpeed` each tick, break when `progress > hardness × K`), because it is what makes a partially-mined block, an interrupted swing, and a tool swap all behave correctly with no extra state. Every constant — 1.5, 5, 30, the 5× penalties, the whole tool-multiplier table — is theirs. **Cost: ~half a day**, and it replaces the current instant-harvest in `engine/harvesting.ts`.

### ⛔ What we SKIP

- **The nine-trunk / eleven-foliage placer catalogue.** They have sixty-odd biomes' worth of silhouettes to distinguish. We have four species. Two implementations each, and we add a third only when a species reads wrong on screen.
- **`dirt_provider`, `force_dirt`, `ignore_vines`, `root_placer`.** No vines, no mangrove roots, and no below-tree soil conversion in scope. Porting dead fields is how a schema gets a reputation for lying.
- **`block_predicate_filter`'s `would_survive` sapling check.** It exists because Minecraft validates placement against the sapling *item's* survival rules. We have no sapling item gating worldgen, and our ground-material check already does that job — a second check would cost a lookup to confirm what we just confirmed.
- **The tree-decorator catalogue** (beehive, cocoa, trunk_vine, leave_vine, alter_ground, attached_to_leaves, attached_to_logs, pale_moss, creaking_heart, place_on_ground). Build **one** generic hook: probability-gated block placement at an offset relative to the finished tree. That single hook covers the ather_soil-patch-under-goldwood idea and anything like it. Ten named decorators is twenty years of individual features, not an architecture.
- **`scattered_ore` as a second feature type.** Its only vanilla user is ancient debris. We get the same read from a `cohesion` parameter on the one blob primitive — cohesion 1.0 is a tight clump, cohesion 0 is scatter. One code path, one thing to test.
- **Ore veins as density functions inside the terrain pass.** ⚠ This one is a genuine architecture mismatch, not laziness. Their veins live in the noise router because their terrain *is* a 3D density function. Ours is a heightfield plus a depth rule plus carvers — **there is no density router for a vein function to live in.** We get the same *player-facing* property (a big branching pocket that caves slice open) from an ordinary pre-carve placement pass. Copy the read, not the plumbing.
- **The eleven-step `GenerationStep.Feature` taxonomy.** We need three coarse phases: `pre_carve` (big pockets) → `post_carve` (ore blobs, springs) → `vegetation` (trees, ground cover, soil state). What we *do* steal is the discipline: **pick one fixed order and never let a later phase become a prerequisite for an earlier one.** Their eleven exist because they have strongholds, mineshafts, fluid springs and top-layer modification to sequence. We do not, yet.
- **Silk Touch and Fortune by name.** The shapes transfer (`alternatives` for a preserve-the-block branch, a bonus-count function on the ordinary branch); the names and the enchantment system behind them do not. Our tool model and the four skills already occupy that design space, and importing enchantment vocabulary would fight it.
- **The underwater ×5 and airborne ×5 break penalties.** Minecraft-specific tuning aimed at a mechanic we do not have. Rinning is fishing, not underwater mining — punishing it makes the skill worse.
- **The data-pack/Java boundary itself.** Their reason is bootstrap order before data packs load. We have no bootstrap. Adopting their split would put hardness in TypeScript, which is precisely the field Rust would then have to re-declare — the exact portability failure the registry exists to prevent.
- **The 26.x snapshot line's `configured_feature` → `feature` registry merge.** Post-1.21.5, currently in the `26.1`–`26.3` snapshots, with `dirt_provider`/`force_dirt` collapsed into `below_trunk_provider`. It is internal registry housekeeping, not a mechanism change. **Reference era for this whole section is 1.17–1.21.x**, which is stable, exhaustively documented, and matches every other claim here. Flagged only because it demonstrates the house rule working: an unlabelled "Minecraft trees use `force_dirt`" is *already* stale against the bleeding edge.
- **Every ore constant.** The Y-bands, the peaks, the attempt counts, the 30% vein-material fraction, the 2% raw-ore bonus. Two of the researcher's own sources disagreed about iron and no page carried a version pin. These are shapes, and we tune ours against a 128-tall world and our own walking speed.

### The mapping: 12 nodes → what each becomes

Item ids below are the ones `resources.ts` already ships. `TBD-CANON` marks a slot needing a name Magii owns — they go over as **one batched question**, not twelve.

| # | node today | skill | becomes | blocks | placement machine | notes |
|---|---|---|---|---|---|---|
| 1 | `goldwood` | forestry | tree feature | `goldwood_log`, `goldwood_leaves` | vegetation phase, straight trunk + blob canopy | common; drops `goldwood_plank`/`goldwood_bark` per the existing table |
| 2 | `shimmeroak` | forestry | tree feature | `shimmeroak_log`, `shimmeroak_leaves` | same, taller base height | `amber_sap` as a decorator-gated bonus drop |
| 3 | `starwillow` | forestry | tree feature | `starwillow_log`, `starwillow_leaves` | **forking** trunk + wide canopy — the one species that earns the second placer | the silhouette that justifies building two trunk placers at all |
| 4 | `dawnwood` | forestry | tree feature | `dawnwood_log`, `dawnwood_leaves` | rare weight in the species table, not a rare *feature* | rarity is a `random_selector` weight, exactly as savanna does oak |
| 5 | `raw_mana_node` | prospecting | **ore block, tier 1 band** | `raw_mana_ore[host=stone\|deep_stone]` | post-carve blob, shallow trapezoid, ~0 air-discard | the ore you see in every cave wall |
| 6 | `element_crystal_node` | prospecting | **ore block, tier 2 band, 4 states** | `element_crystal_ore[element=violet\|storm\|earth\|water]` | post-carve blob, mid band, low discard | ★ state resolved at placement, so the player reads the element before mining — replaces the 4×25% slot machine |
| 7 | `pure_core_node` | prospecting | **ore block, tier 3 band** | `pure_core_ore[host=…]` | post-carve blob, deep band, **high** discard | buried by design; rewards tunnelling over spelunking |
| 8 | `ather_crystal_node` | prospecting | **large pre-carve pocket** | `ather_crystal_ore[host=…]` | pre-carve, `plateau=0` at the deepest band, truncated by carvers | tier 4 reads as a *find*, not a trickle |
| 9 | `small_pond` | rinning | ⚠ **not a block** — see below | `water` (v1 solid, non-flowing) | terrain shape, surface phase | fishing *spot*, classified by connected water volume |
| 10 | `stream` | rinning | ⚠ **not a block** | `water` | terrain shape | same block, larger volume class |
| 11 | `lake` | rinning | ⚠ **not a block** | `water` | terrain shape | same block, largest volume class |
| 12 | `ather_soil` | farming | **block + state** | `ather_soil[tilled, watered]` | vegetation phase, last | the Flattening's block-state lesson, applied to the one node that was never harvestable |

**⚠ The Rinning three do not become three blocks, and this is the one place the conversion does not go through cleanly.** They are fishing spots with `maxHarvests` 3/5/8 and distinct catch tables (`shimmerscale`/`clickclaw` → `glowfin`/`ribboneel` → `moonkoi`/`pearlshell`/`crystal_rinn`). A water *block* you mine yields water, not a moonkoi. Three water blocks that differ only in what fish they hold would be a lie told in the terrain. **Our call — and it is ours, not Mojang's:** one `water` block, and pond/stream/lake become a **classification of the water body you are fishing in**, derived from connected-water extent at the cast point. The tier ladder survives, the loot tables survive unchanged, and the world stops carrying three near-identical materials. **Research established nothing about Minecraft's fishing or any open-water predicate — do not assume one exists.** Flagged as an open question below.

**On biomes and the house rule:** a biome may gate *which tree table runs* — that is Mojang's `biome` placement modifier, it is frequency, and it is fine. A biome must never determine terrain height, the column's material, or which ore band a depth maps to. Trees are decoration on top of finished terrain; ore is a function of depth. Neither reads a biome id to decide *what something is made of*.

### The registry — one schema, TS today, Rust later

Extends `VOXEL-WORLD-MODEL.md` § 4. Three registries, deliberately separate files, all pure data. `jsonc` for readability; ship as strict JSON.

```jsonc
// data/blocks/element_crystal_ore.json — ONE FILE PER BLOCK TYPE
{
  "id": "element_crystal_ore",
  "states": { "element": ["violet", "storm", "earth", "water"] },  // Block ≠ BlockState (1.13)
  "solid": true,
  "look": { "tile": 41, "byState": { "element=storm": 42, "element=earth": 43, "element=water": 44 } },

  // Intrinsic + mining. In Java these live in code for bootstrap reasons we do not have (steal #13).
  "mine": {
    "skill": "prospecting",          // existing SkillId
    "tier": 2,                       // existing node tier — the ladder, unchanged
    "minLevel": 4,                   // existing gate, unchanged
    "hardness": 4.0,                 // ours. no ruling needed.
    "requiredToolTier": 2            // numeric compare against the tool's toolTier
  },

  "tags": ["ore", "mineable/pick", "prospecting_node"],
  "itemId": null,                    // null = block has no inventory form; you get the drops

  // Drops are a LIST, never a switch in engine code. "Drops itself" would just be an entry
  // naming this block's own item id — it is not a flag.
  "drops": {
    "pools": [{
      "rolls": 1,
      "entries": [{
        "type": "alternatives",
        "children": [
          { "type": "item", "id": "element_crystal_block",
            "conditions": [{ "type": "tool_has_tag", "tag": "preserving" }] },   // our name, not Silk Touch
          { "type": "item", "id": "{state:element}_crystal",                     // violet_crystal, storm_crystal, …
            "count": { "min": 1, "max": 1 },
            "functions": [{ "type": "bonus_count", "by": "tool_quality" }] }     // our name, not Fortune
        ]
      }]
    }]
  }
}
```

```jsonc
// data/features/ore_element_crystal.json — WHAT it is + WHERE it goes, kept apart (1.18-pre1's split)
{
  "id": "ore_element_crystal",
  "kind": "ore",
  "phase": "post_carve",                       // pre_carve | post_carve | vegetation
  "blob": { "size": 6, "cohesion": 0.8 },      // cohesion 0 == scattered_ore, no second type needed
  "discardOnAirExposure": 0.25,                // whole-blob roll (steal #10)
  "targets": [                                 // one feature, skin resolved by what it replaced
    { "when": "stone",      "put": "element_crystal_ore" },
    { "when": "deep_stone", "put": "element_crystal_ore" }   // both TBD-CANON host names
  ],
  "stateRoll": { "element": ["violet", "storm", "earth", "water"] },   // resolved at PLACEMENT, not on break
  "band": { "min": 24, "max": 78, "plateau": 12 },   // trapezoid(min,max,plateau) — the ONE distribution
  "count": { "type": "weighted", "entries": [[1, 6], [2, 3], [0, 1]] }
}
```

```jsonc
// data/features/trees_moonwell_glade.json — the species MIX and its frequency, per biome
{
  "id": "trees_moonwell_glade",
  "phase": "vegetation",
  "count":   { "type": "weighted", "entries": [[0, 3], [1, 6], [2, 2]] },  // sparse is a count provider
  "pick":    "in_own_chunk",                    // ★ origin never leaves this chunk (steal #12)
  "reject":  ["underwater", "not_soil"],        // cheap checks before the height snap
  "snap":    "surface",
  "species": [                                  // normalized weighted pick — see open questions
    { "feature": "tree_shimmeroak", "weight": 6 },
    { "feature": "tree_goldwood",   "weight": 3 },
    { "feature": "tree_dawnwood",   "weight": 1 }
  ],
  "biomes": ["moonwell_glade"]                  // gates FREQUENCY only. never height, never material.
}

// data/features/tree_starwillow.json — the SHAPE, with no idea what a chunk or a biome is
{
  "id": "tree_starwillow",
  "kind": "tree",
  "trunk":  { "placer": "forking", "baseHeight": 6, "randA": 3, "randB": 2, "block": "starwillow_log" },
  "canopy": { "placer": "blob", "radius": 3, "offset": 0, "height": 4, "block": "starwillow_leaves" },
  "decorators": [                               // ONE generic hook, not ten named ones
    { "put": "ather_soil", "where": "ground_ring", "radius": 2, "chance": 0.15 }
  ],
  "writeMargin": 4                              // TILES, not chunks. see the browser section.
}
```

```jsonc
// data/recipes/goldwood_planks.json
{ "id": "goldwood_planks", "type": "shapeless",
  "ingredients": [{ "tag": "log/goldwood", "count": 1 }],
  "result": { "item": "goldwood_plank", "count": 4 },
  "station": null }

// data/unlocks/goldwood_planks.json — A SEPARATE FILE, ON PURPOSE
// Unlock is player progression state, not a property of the recipe. Folding an "unlockedByDefault"
// flag into the recipe is how the two get tangled and stay tangled.
{ "recipe": "goldwood_planks", "when": { "skill": "forestry", "level": 1 } }
```

**What stays in code, keyed by block id:** tree growth, water behaviour, soil tilling, node respawn. That is Mojang's *real* boundary — relationships between registered things are data; intrinsic behaviour is code — and it is the half of their split worth keeping.

**Names.** `goldwood`, `shimmeroak`, `starwillow`, `dawnwood`, `ather crystal` and the four skills are ruled; `_log` / `_leaves` / `_plank` are inflections of a ruled name, not new materials (`goldwood_plank` already ships). **`TBD-CANON`: the base stone, the deep stone below the ore ladder's midpoint, topsoil, subsoil, and whether canon wants a name for water-as-material.** Five slots, one batched question to /magii. Inventing forty rocks in a design doc is the named failure mode and it is refused the same way here.

### ★ The browser: what a 16ms frame forces us to do differently

Minecraft's answer to per-chunk cost is that there is no per-chunk cost budget — worldgen runs off the tick on background threads, and **no Mojang-published number exists for any version** (searched for, not found). We do not get that for free. JS has no thread as cheap as a JVM thread, so every property their architecture gives away has to be deliberately built.

The mesher spike (`voxel/bench.ts`, commit `d018c68`) already put numbers on the frame, and they set the constraints below. Desktop-class numbers, **and that is the target since the phone was dropped as a hard target on 2026-08-06** — which does not soften any constraint below, because 32³ already fails a frame on that hardware. `/shimmer/dev?mode=meshbench` gives a second reading inside a real browser engine rather than node.

- **One section re-mesh at 16³: 0.20–0.27 ms.** A block broken on a section corner dirties up to 8 sections: **2.0 ms at 16, 13.4 ms at 32, 106 ms at 64.**
- **A full 64-wide column at height 128: ~27 ms**, and a chunk entering the load radius pays that at once. At 49 live chunks a cold stream is ~1.3 s of meshing.
- **Greedy meshing wins 20–31× on surface and underground**, 5.3× in caves, 1.0× on checkerboard. Flat ground over solid rock is its best case, which is most of our world.

What follows from that:

**★ 1. Decoration is not one call. It is resumable work, and the status enum is what makes stopping safe.** A 64×64×128 chunk cannot be decorated inside a frame, and `requestIdleCallback` hands out a few ms at a time. Steal #2's per-chunk status enum (`NOISE → POI_STARTS → POI_REFS → DECORATED → READY`) gains a real second job here: it is the **resume point.** Stop mid-pipeline, come back next idle slice, pick up at the last completed status, and no step ever runs twice. Without the persisted status, "resume" and "run it again" are indistinguishable and you get double trees.

**★ 2. Purity of `decorate()` stops being an optimization and becomes a correctness requirement.** Phones evict chunks under memory pressure constantly. If the trees a chunk grows depend on load order, neighbour state, or a mutable shared RNG, **the same chunk re-rolls different ore when it streams back in**, and two players in a shared zone see different worlds. `decorate(worldSeed, chunkCoord, phaseIndex, featureIndex)` must be pure, and the feature index must be part of the seed so that adding a feature to the table does not reshuffle every existing one. This is the single most load-bearing mechanism in this section and it costs nothing if done first.

**★ 3. `writeMargin` is in TILES, and copying 3×3 chunks here would be absurd.** Their chunk is 16 blocks, so 3×3 is a 48-block reach. Ours is 64, so 3×3 would be a **192-tile** margin — 4× the world we are actually loading in each direction. A player-sized-block tree needs 3–5 tiles of spill. Take the *rule* (a bounded, declared write reach; the origin owns the feature; the neighbour never re-rolls it) and set the number from our largest canopy.

**★ 4. Feature placement must be allocation-free, and we have already paid this tuition once.** The mesher's first bench run was partly measuring its own garbage — ~626 KB of typed arrays allocated and discarded **per call**, and adding a reusable scratch made it **2.5–5× faster**. A tree placer that returns `Position[]` does exactly that, once per tree, during streaming. **Placers write directly into the section's `Uint16Array` through a bounded cursor; ore blobs walk a preallocated scratch.** Same shape as `createMeshScratch(size)` — one per worker, reused forever.

**★ 5. All writes land before the chunk is handed to the mesher, including the cross-border spill.** A tree written into an already-meshed neighbour dirties up to 8 sections at 2 ms each, for one tree, at stream time, when we are already paying 27 ms for the column. The ordering rule is therefore not just a correctness rule: **a chunk may not be meshed until every neighbour within `writeMargin` has completed its `DECORATED` status.** That is the neighbour-margin rule from steal #2, restated as a frame budget.

**★ 6. Section size is 16 and the ore/tree design has to live inside it.** 32 already eats most of a frame on a *desktop-class* corner-break (13.4 ms), so it fails outright — the phone was never in that argument. 8 is faster per section but 57.8% of blocks land on a boundary (vs 33% at 16) and column cost nearly doubles. Column cost is flat above 16 (28.9 / 27.6 / 26.8 ms), removing the last argument for going bigger. **Practical consequence for this section: an ore blob larger than ~16 across dirties four sections when broken.** That is a real constraint on `blob.size` for the tier-4 pocket, and it is the kind of thing that only shows up if the ore design and the mesh budget are read together.

**★ 7. The air-exposure discard is affordable precisely because it is probabilistic.** It is a per-blob roll over a handful of neighbour lookups, not a geometry pass, and it buys the entire buried/exposed axis in table #10. If it had required a real visibility computation it would be the first thing cut.

**8. Break progress accumulates on the game tick, not on a frame timer.** Tying it to frames makes mining faster on a fast machine. Their per-tick damage model is already the right shape and it is free to adopt.

### Open questions — what research could NOT establish

Do not fill these in from memory. Several are Mojang-internal and genuinely do not matter to us; they are listed so nobody re-derives them from a plausible guess.

**Mojang mechanisms, unresolved:**

- **The `random_selector` selection algorithm** — sequential Bernoulli-per-entry-first-hit-wins, or a normalized weighted pick? The wiki documents the per-entry `chance` data shape only. **We use a normalized weighted pick and that is OUR choice**, documented here so nobody later "corrects" it toward an unverified Mojang mechanism.
- **The exact ellipsoid-growth algorithm inside `minecraft:ore`.** Every source describes the result ("ellipsoidal cluster", a size→block-count lookup table) and none gives the placement loop. Needs a decompiled-source read, not a wiki read. **Our blob shape is ours.**
- **The trapezoid height-provider's sampling formula** — is it literally two averaged uniform draws? Parametrization confirmed, sampling not.
- **The trunk-height arithmetic** combining `base_height` / `height_rand_a` / `height_rand_b`. Only the field ranges (0–32 / 0–24 / 0–24) are sourced, not the order of operations or the distributions.
- **Every current per-ore Y-band and attempt count.** Two wiki pages disagreed about iron in the same session and no page carried a version pin. Shape only.
- **Whether `count_extra`-style additive decorators existed pre-1.18 (1.13–1.17).** Confirmed absent from 1.18.2 / 1.19.4 / 1.21.5 data; the legacy page returned HTTP 402. Neither confirmed nor refuted.
- **The verbatim current-version loot-table bonus-formula id strings** (`ore_drops` vs `binomial_with_bonus_count` vs `uniform_bonus_count`). Paraphrased by the fetch, never quoted.
- **When the tool-tier tags (`needs_stone_tool` etc.) split out of an older hardcoded harvest-level enum.** Tags in general are 1.13/17w49a; these specific ones are undated.
- **Whether hardness/blast resistance truly have zero data-pack override path today.** Sourced from Forge's docs mirroring vanilla's registration pattern, not a vanilla source diff.
- **The decoration-seed salt formula** (`index + 10000 × step`-style). Reconstructed from secondary summaries; no primary quote reproduced by the researcher or the gate. The *property* is confirmed enough to build on; the formula is not.
- **Whether `VEGETAL_DECORATION` specifically requires neighbours at `carvers` status.** Still open — this was already flagged in this doc's *Open questions* and a second research round did not move it.
- **Whether `LIQUID_CARVERS` is still functionally live or a vestigial status name** post-1.18 aquifers. The enum persists through at least yarn 1.19.2 while community sources describe the behaviour as superseded. Unresolved.
- **Which snapshot inserted `FLUID_SPRINGS`** into `GenerationStep.Feature` (absent in 21w05b's 10 steps, present in 1.18's 11).
- **Which version split `STRUCTURE_STARTS` from `STRUCTURE_REFERENCES`.** Confirmed present by 1.15.2/1.16.5; introduction unknown.
- **The version `TreeGrower` was introduced**, and whether the sapling path before it differed in mechanism or only in class structure.
- **That the ChunkStatus bounded-neighbour requirement was the *deliberate fix* for the pre-1.13 cascade.** Plausible, unsourced, flagged by the gate. The bug is documented; the intent is not. Do not cite it as history.
- **Any Mojang per-chunk time or cost budget for the decoration stage, in any version.** None exists in published material. Their answer is architectural.

**Ours, and nobody else can answer them:**

- **How a fishing spot's tier is derived from a water body.** Connected-volume flood fill at the cast point is the obvious answer and it is also an unbounded graph walk mid-frame, which is the shape of thing this doc has spent two sections warning about. Needs a bounded approximation and a spike. **Research established nothing about any Minecraft open-water predicate — do not assume one exists to copy.**
- **Whether `element_crystal` should be four block states or one block with a four-way drop.** Steal #11 argues states, for readability. It costs four tile skins that do not exist yet, which makes it partly an art call.
- **Whether `ather_soil` should be worldgen-placed at all**, or exist only where a player tills. Placing it procedurally makes Farming discoverable; placing none makes tilling meaningful. Unruled.
- **`blob.size` ceilings against the 16³ section budget.** The tier-4 pocket wants to be big and the mesh budget wants it under ~16 across. Needs the bench, not an argument.
- **Whether the pre-carve/post-carve phase split survives contact with carvers we have not written yet.** The whole tier-readability table in steal #10 rests on carvers existing and truncating things. They are un-skipped but unbuilt.
