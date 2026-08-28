// Player edits — the only thing the world actually stores.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder. Where the bytes physically
// live (IndexedDB, a file, a server) is the host's problem; what an edit IS belongs here.
//
// ── ★ THE DELIBERATE DIVERGENCE FROM MOJANG ─────────────────────────────────────────────────
// Minecraft writes every generated chunk to disk in full, forever, touched or not. We do the
// opposite, and it was ruled in WORLDGEN-RESEARCH before any of this existed: **a column is stored
// only if it holds a player edit, and absence means "pure procedural, regenerate."**
//
// That is affordable for us and not for them because our generator is cheap, deterministic and
// order-independent — the same seed and coordinate always rebuild the same column, so the world
// itself needs no storage at all. Only the difference between what the generator said and what the
// player did has to survive.
//
// The practical consequence is worth stating: walking a thousand columns costs ZERO bytes. A save
// grows with what you BUILD, not with where you have been.

import { Column, SECTION } from './column'

/**
 * ★ BUMP THIS WHENEVER GENERATION CHANGES THE WORLD.
 *
 * An edit is a diff against generated terrain, so it is only meaningful against the generator that
 * produced that terrain. Retune the height spline and a saved "I removed this block" may now point
 * at a block that was never there — a hole in mid-air, or a door opening into rock.
 *
 * Storing the version does not FIX that (nothing can, in general — the research flagged it as ours
 * to solve and left it open). What it does is make the mismatch DETECTABLE instead of silent, so a
 * loader can warn, migrate, or refuse rather than quietly producing a broken world.
 */
// v2 (2026-08-07): per-item seeds now go through `mixSeed`. That fixed a real distribution bug
// (see noise.ts) but it also MOVES EVERY CARVE, SEAM VEIN AND TREE — which is exactly the case this
// constant exists for. A v1 save's edits were diffed against a world that no longer exists.
// v3: valley-floor shaping + woodland mask (2026-08-07) — the surface moved, so v2 edits may sit
// above or below the ground they were made on. The warning is honest; the edits still apply.
// v4: the biome layer (2026-08-07) — grey surfaces appear and species weights shifted, so a v3
// edit's recorded "generated" baseline can disagree with what now generates there.
// v5: the plains pass (2026-08-07 eve) — a flatness field benches the base and kills ridges over
// ~a third of the country, so v4 edits can sit metres above or below the new ground.
// v6: ruin sites (2026-08-07 late) — structures generate on greyfield pads; a v5 edit could sit
// inside ground a ruin now occupies.
// v7: rivers (2026-08-07 late) — the weirdness zero-line carves a channel; v6 edits along valley
// centres can now sit in the water or above the carved bed.
// v8: open country (2026-08-07 late) — ridge wavelength 150→340, relief gathered into ranges;
// most hills moved, so v7 edits on any slope are likely mid-air or buried now.
// v9: un-slice (2026-08-07 late) — base-field warps 4/3 → 1.2; coastlines and uplands moved.
// v8 shipped and was WALKED before this landed, so it gets its own number.
// v10: the water table (2026-08-07 late) — river/pond water fills to a coarse lattice level
// instead of per-column banks−1, so water blocks moved anywhere a channel or pool exists.
// v11: the rim clamp (2026-08-07 late) — water may not stand above adjacent dry ground; the
// standing walls v10 could build are gone, and water near shorelines moved down.
// v12: land-around-water (2026-08-07 late) — inside the river band the TERRAIN anchors to the
// water table (banks/levees/gorges); every riverside surface moved.
// v13: vertical rebalance (2026-08-08) — sea 140→100, datum 160→120; the whole surface moved
// down 40 and every shoreline redrew.
// v14: the Springs mountain (2026-08-08) — mana-springs lifts a terraced massif (lift 64,
// benchK 2, reliefK 0) with hot-spring pools sunk into the flats; every column in the Springs
// ellipse moved, nothing outside it did.
// 14 → 15 (2026-08-11): terrain changed three times in one day — slumped lips, ground cover as
// voxels above the surface, and lips becoming slab MATERIALS. Old edits still apply (they are
// absolute materials at fixed indices), but a save from before today no longer describes the same
// world, and `isStale` exists precisely so the player is told rather than left to notice.
// 15 → 16 (2026-08-13): the crown became a cluster of lobes. Every blob-species canopy changed
// shape — satellites hung below the main lobe, a warped radius, ~17% more leaf voxels — so any
// edit a player made inside or against a canopy now sits against different foliage. Terrain did
// not move; only the trees did.
//
// ⚠ I SHIPPED THAT CHANGE WITHOUT BUMPING THIS, and the bump is the entire point of the constant.
// The generator moved under saved edits for most of a day and nothing told anybody. Trunk geometry
// changed too (the root flare) but that one is RENDER-ONLY and correctly needs no bump — which is
// exactly the distinction that makes this easy to forget: two tree changes in one session, one of
// them version-affecting and one not.
// 16 → 17 (2026-08-15): the road's bridges stopped generating `MAT.PLANKS` (the crafted wall) and
// now generate `MAT.DECK`. Terrain did not move and no bridge changed shape — but every deck and
// rail voxel on the spine is a different material than the save was written against, and a player
// who mined one has an edit sitting in a hole that used to be worth something. Materially the same
// class of change as the v15→16 canopy reshape: the world did not move, what it is MADE of did.
// 17 → 18 (2026-08-15): THE KEEPER'S FOLD STANDS IN THE WILDS. `generatedAt` now answers the bubble
// first, so a 500-radius shell of cloud-wall exists where ordinary terrain used to generate and the
// disc inside it is empty. This is the largest terrain change the world has taken — it does not
// nudge a surface, it replaces a region — and any edit a player made inside that footprint is now
// an edit against ground that no longer exists. Nothing canon is in there (`bubbleSwallows` clears
// every anchor but `garden`, which IS the plot), so in practice this touches empty country; the
// bump is what makes the warning fire anyway rather than betting on that.
// 18 → 19 (2026-08-16): THE FOLD'S WALL BECAME A PILE OF CLOUDS. The shell stopped being a near
// cylinder with a flat lid: `wobble` 0.01 → 0.03 swings the wall ±15 blocks in and out around its
// old line, and the cap crowns and frays between y174 and y206 where it used to stop dead at 190.
// So the wall now STANDS where it did not (a bulge reaches 15 blocks further out over ground a
// player could have been building on) and is ABSENT where it did (a trough pulls it 15 blocks back,
// and a low crown leaves 16 blocks of sky where there was wall). Same class as 17 → 18 exactly: the
// footprint moved, and an edit inside the swept band is now an edit against ground that moved.
//
// ⚠ THE SHELL ITSELF IS UNMINEABLE (`hardness: Infinity`, `placeable: false`), which is precisely
// the argument that nearly talked me out of this bump — you cannot hold an edit made OF the wall.
// You can absolutely hold one the wall has since moved ON TOP OF, and that is the case the constant
// exists for. **The header three lines up says the bump is the entire point and was forgotten once
// already; the reasoning that skips it is always "in practice this touches empty country."** The
// bump is what makes the warning fire instead of betting on that.
// 19 → 20 (2026-08-16): THE HOME PLOT'S ISLAND FILLS TO ITS WALL. Ground used to stop at radius 20
// with the cloud-wall out at 30 and ten blocks of void between them; it now fills to the wall on
// every bearing, the surface roll and the keel taper from the COAST instead of as a fraction of the
// radius, and the threshold moved from the middle of the island to the wall. This is the largest
// change the plot's terrain has taken — the island is a different size and a different shape under
// the turf. Every plot edit in a save predating it is a diff against ground that has moved.
// 20 → 21 (2026-08-16, same evening): the plot's surface roll now rises FROM `baseY` instead of
// rolling around it, and the keel hangs from the ground plane instead of from the surface — the two
// changes that make growing a fold purely additive (0 voxels removed, was 261). Both move the
// generated ground: every plot column's surface sits up to `roll` higher than v20 put it, and the
// keel's underside no longer follows the turf. v20 shipped and was live for half an hour, so it
// gets its own number rather than being folded into 19 → 20.
// 21 → 22 (2026-08-18): THE FOUR ELEMENT HERBS GROW IN THE WILDS. Canon ruled where each one grows
// (`game/shimmer-geography.md`) and the generator now writes a herb voxel one above the surface, on
// its own ground, inside its own patch field — the cell that used to hold a tuft, a flower or air.
// Terrain did not move; what stands ON it did, which is the same class as the v14→15 ground-cover
// change and the v16→17 deck relabel. A player who mowed a patch of grass in a basin has an edit
// sitting where a Violetbloom now generates.
//
// ⚠ THE REASONING THAT SKIPS THIS BUMP IS ALWAYS "it is only a few plants" — the header above
// records that exact excuse costing a silent day when the canopies changed. One voxel per column is
// still the generated world, and `isStale` is what tells the player rather than betting they will
// not notice.
// 22 → 23 (2026-08-18): THE HOME PLOT STARTS AT r300 (Alex: *"the plot starts at 300 block radius
// and then greg can upgrade to 3, 4, and even 500"*). The island went from ~60 blocks across to
// ~600 — the largest single change any terrain in this build has taken. Growth is ADDITIVE by
// construction (the 08-16 coast-anchored keel + plane-hung span), so nothing a keeper built is
// standing on nothing; but the wall, the threshold and the coast all moved several hundred blocks,
// and a save written against the old island is a save written against a different place.
// 23 → 24 (2026-08-22): THE STORY ROAD'S BRIDGES BECAME STRUCTURES. A crossing was three parity
// tests inside `materialAt` — a flat deck one block over the water, stone on a world-aligned 4×4
// lattice, a rail keyed off a neighbour probe — none of which knew the span they were spanning.
// `voxel/bridges.ts` surveys the spine once per seed, so a crossing now arches (springing flush at
// both banks, up to +4 at midspan, climbing in HALF_BIT courses so `STEP_CAPTURE` walks it without
// a vault), its piers stand in measured bays on their OWN bed with a footing, and its rails follow
// the arch on the band's measured edge.
//
// This moves generated voxels on every crossing on the map, in both directions: the old flat deck
// cells at `table + 1` are AIR under the arch now (that gap IS the feature — water and a swimmer
// pass beneath), and deck exists at altitudes the old rule never wrote. The bridges themselves did
// not move: the footprint is deliberately the same set of columns the parity rule fired on, so no
// crossing is added or removed. ⚠ But a road bridge is exactly where a keeper builds, and an edit
// stored against the old deck level is a diff against a place the deck no longer is.
// 24 → 25 (2026-08-22, same evening): SPAN-TYPED CROSSINGS. v24 shipped an arch keyed to the span
// and left everything else span-blind — every bridge on the map had a bay of 6-7 blocks, from the
// 10-block creek to the 149-block river. Short crossings were a thicket of piers standing shoulder
// to shoulder; the long one was twenty identical sticks in water, which is a fence, not a viaduct.
// A crossing is now one of three kinds by span: a `plank` (no piers, barely a camber), a `trestle`
// (timber piers, short bays) or a `viaduct` (stone piers, bays up to 26, the highest running deck).
// Bay LENGTH is derived and bay COUNT is what stays roughly constant, which is the way round real
// crossings work. The deck profile went from a parabola to a trapezoid — ramp, run level, ramp —
// because an arch stretched over 149 blocks is an imperceptible sag, and a viaduct is a level road
// carried high, not a hump.
//
// Moves deck voxels and pier voxels on every crossing: decks run higher and flatter, pier positions
// and COUNT changed everywhere (149-span went 20 piers → 5), and trestle piers are now timber where
// they were stone. ⚠ v24 was live for roughly half an hour, so this takes its own number rather than
// being folded back into 23 → 24 — same reasoning as 20 → 21.
// 25 → 26 (2026-08-22, same evening): THE DECK BECAME A RIBBON — Alex: *"still crunched together
// not leaving much room to walk it."* The footprint was `roadAt ∩ submerged`: the intersection of a
// WOBBLED road with a RAGGED waterline, so the deck was whatever shape that accident produced.
// Measured across the map: walkable width had a MEDIAN OF 2 and **152 of 546 rows were a single
// cell**, because the rail then took the outermost cell of each side. One crossing was a one-block
// catwalk end to end. The parapet was eating the roadway it exists to protect.
// The deck is now a rasterised ribbon of constant width on the crossing's own axis — 7 across, rails
// on the outer pair, **5 walkable everywhere** (median 2 → 5, one-cell rows 152 → 0). Constant width
// also retires the raggedness that caused the walled mouths. RAIL_MIN_WIDTH 3 → 5, because a 4-cell
// row still surrenders two to rails and leaves two to walk on.
// ⚠ Moves deck voxels on every crossing and ADDS deck where the old road∩water intersection had
// none. Third bump of the evening; v25 was live ~20 minutes.
// 26 → 27 (2026-08-22, same evening): THE GATE WAS STILL THE OLD SHAPE. v26 widened the deck into a
// constant-width ribbon, but depth.ts's cheap pre-filter in front of it was still `roadAt` — correct
// while the footprint WAS the road, and wrong the moment the ribbon grew wider than the road on
// purpose. It discarded **44% of the deck and 93% of every rail** in the shipped build: v26's decks
// went out roughly as narrow as v25's, with almost no parapet.
// ⚠ THE 371-ASSERT ORACLE WAS GREEN THROUGHOUT, because it calls `bridgeVoxelAt` directly while the
// world calls it through `materialAt`'s gate. Two paths, one tested, both internally consistent.
// Gate is now `distToPath <= BRIDGE_BAND`, derived from the ribbon's own width, and the oracle
// asserts through `materialAt` in world coordinates so the two can never silently disagree again.
// This is a FIX to v26 rather than a new iteration, but it does move generated voxels — it adds the
// deck and rails that v26 intended and did not emit.
// 27 → 28 (2026-08-22, night): THE TRESTLE STANDS ON POSTS. Its pier was a SOLID block up to 5
// cells wide under a 7-cell deck, in the deck's OWN timber — so support and roadway merged into one
// mass and the bridge read as a wall with a road on top. The viaduct escaped it only because stone
// contrasts with the deck. A trestle is now a `bent`: two mirrored posts, a cap beam across their
// heads, and a sill at the bed, with daylight between the legs and water visible through it. You
// cannot quarry a 5-wide block of wood; the gaps are the whole reason it reads as carried.
// Masonry piers stay solid, which is what masonry is.
// ⚠ Also fixes two asymmetries that were invisible until asserted: pier geometry placed by `|s|`
// caught two cells on one flank and none on the other (`.D.DDD.`), and the post course selected by
// per-cell along-span distance produced a single lonely post (`.#.....`). Both are now placed by
// ROW INDEX. Moves pier voxels on every trestle and plank.
// 28 → 29 (2026-08-22, night): THE PARAPET BECAME A RAILING. It was a single solid course sitting
// on the deck edge — a KERB, which from any distance reads as the deck being one block thicker.
// That is why Alex asked for railings on a bridge that already had them: they were there and they
// did not look like railings. What makes one legible is the DAYLIGHT under the top rail; the eye
// reads posts + a line + gaps as a handrail and reads a continuous block as a wall.
// Now a continuous top rail two courses over the deck, standing on posts every 3 blocks, nothing
// between. Same material, opened up. ⚠ The gap at yc+1 IS the feature — filling it back in "so the
// rail is solid" restores the kerb, so the oracle asserts the daylight as well as the rail.
// Moves parapet voxels on every crossing.
// 29 → 30 (2026-08-22, night): THE RAILING LEFT THE VOXEL GRID. Alex: *"we are still trying to use
// whole blocks on the railings when it should actually be more like the fences."* Correct, and the
// thing he wanted already existed: `pieces.ts` › `fence` is a 0.18 centre post whose ARMS are
// derived per connected side at sync, `holds.ts` already emits it as a generated wall-top parapet,
// and it occupies its full cell for COLLISION while drawing thin — exactly a bridge railing.
// So no new item. The railing is now `fence` GenPieces along both deck edges (one per cell, because
// fence arms come from ADJACENCY and spaced posts grow no rail between them), and the bridge emits
// NOTHING above the deck. Removes the whole-block parapet voxels from every crossing.
// ⚠ The piece layer is not saved; only its ABSENCE is (tombstones). Gen ids are keyed on the
// crossing and the world CELL and must stay that way — key them on anything derived and the next
// version bump silently orphans every railing a player has broken.
// 30 → 31 (2026-08-22, night): THE DECK'S FLANK CELLS ARE FULL HEIGHT, so the railing can stand on
// them. Alex: *"the fences are all distorted, most not even connected to the bridge."* Both halves
// measured: **8 of 25 posts on one railing line floated half a block**, and the line broke 7 times.
// Root is a grid mismatch, not a bug in either part — the arch climbs in HALF steps because
// `STEP_CAPTURE` demands it (a whole-block riser is a vault), while PIECES live on the integer grid,
// so a post on a half-slab cell begins half a block above the surface. Rounding only the two flank
// cells up costs the walkway nothing (flanks are parapet, never walked) and reads correctly as a
// kerb under a parapet. Floating posts: 0 of 1058.
// ⚠ Moves the flank deck voxels on every crossing.
// 31 → 32 (2026-08-24): RUINS ARE ASSEMBLED, NOT STAMPED. Every ruin on a greyfield pad was the
// same 11×11 rectangle, varied only by a crumble hash. `voxel/ruins.ts` assembles one instead — a
// start piece rolled from a six-shape pool, breadth-first connectors, AABB-reject, a terminator
// pool, and a per-site size budget — so a ruin is now anything from one lonely room to a nine-room
// warren, and 357 distinct shapes stand where one did. Placement did not change: the same cells
// roll the same candidates on the same pads, so no ruin appears or disappears. What changed is the
// building on top of each one, which is every wall and rubble voxel any of them ever wrote.
//
// ★ WHAT THIS BUMP ACTUALLY COSTS, MEASURED RATHER THAN FEARED — because I got it backwards and
// left the bump parked on the strength of it. `isStale` has exactly ONE behavioural reader in the
// tree (`voxel3d/VoxelWorld.tsx:6485`) and all it gates is a one-time chat line, deduped in
// localStorage; `unpackEdits` runs unconditionally three lines later. **A bump discards nothing.**
// I had told Alex it would stale every column's edits in the world, which turned a one-line change
// into a decision he had to weigh — a wrong premise producing a wrong process, not just a wrong
// sentence. Read the consumer before pricing a constant.
//
// ⚠ The ruins shipped to prod UNBUMPED for about two hours (hub's build carried the tree), so this
// is the warning arriving late rather than not at all — which is the whole reason the constant
// exists, and exactly the v16 mistake this header already records once.
export const GENERATOR_VERSION = 32

/**
 * One column's edits: packed local index → material.
 *
 * A Map rather than a list, because editing the same voxel twice must collapse to one entry. A list
 * would grow forever while a player fiddles with the same doorway.
 */
export type ColumnEdits = Map<number, number>

/** Packed local index within a full-height column. Mirrors `Section.idx` extended across sections. */
export const editIndex = (x: number, y: number, z: number): number =>
  (y * SECTION + z) * SECTION + x

export const unpackIndex = (i: number): { x: number; y: number; z: number } => ({
  x: i % SECTION,
  z: Math.floor(i / SECTION) % SECTION,
  y: Math.floor(i / (SECTION * SECTION)),
})

/**
 * Record an edit, given what the GENERATOR would have put there.
 *
 * ★ AN EDIT THAT RESTORES THE ORIGINAL IS DELETED, NOT STORED. Mine a block and put it back and the
 * save returns to empty — because the diff is against generated terrain, and "same as generated" is
 * not a difference. Without this a player who tidies up leaves a file full of no-ops, and a column
 * that is byte-identical to procedural output still costs storage forever.
 */
export function recordEdit(edits: ColumnEdits, index: number, material: number, generated: number): void {
  if (material === generated) edits.delete(index)
  else edits.set(index, material)
}

/** Apply a column's edits over freshly generated terrain. Idempotent: applying twice changes nothing. */
export function applyEdits(col: Column, edits: ColumnEdits | undefined): void {
  if (!edits || edits.size === 0) return
  for (const [i, mat] of edits) {
    const { x, y, z } = unpackIndex(i)
    if (y < 0 || y >= col.sections.length * SECTION) continue   // a stale save must not throw
    const s = (y / SECTION) | 0
    col.sections[s].set(x, y - s * SECTION, z, mat)
  }
}

// ── serialisation ────────────────────────────────────────────────────────────────────────────
// Two parallel typed arrays rather than JSON: they survive structuredClone into IndexedDB with no
// parse step, and an edit is 6 bytes instead of ~20 characters.

export interface PackedEdits {
  version: number
  idx: Uint32Array
  mat: Uint16Array
}

export function packEdits(edits: ColumnEdits): PackedEdits {
  const n = edits.size
  const idx = new Uint32Array(n)
  const mat = new Uint16Array(n)
  let i = 0
  for (const [k, v] of edits) { idx[i] = k; mat[i] = v; i++ }
  return { version: GENERATOR_VERSION, idx, mat }
}

export function unpackEdits(p: PackedEdits | undefined | null): ColumnEdits {
  const out: ColumnEdits = new Map()
  if (!p || !p.idx || !p.mat) return out
  const n = Math.min(p.idx.length, p.mat.length)
  for (let i = 0; i < n; i++) out.set(p.idx[i], p.mat[i])
  return out
}

/**
 * Is this save from a different generator than the one running?
 *
 * Deliberately a QUESTION, not an action. Whether a mismatch means warn, migrate or discard is a
 * product decision, and burying it in a loader is how a player silently loses a house.
 */
export const isStale = (p: PackedEdits | undefined | null): boolean =>
  !!p && p.version !== GENERATOR_VERSION
