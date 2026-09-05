// Render attributes from a core mesh — WITHOUT importing three.
//
// ★ WHY THIS IS SPLIT OUT OF mesh-bridge.ts: this runs inside the Web Worker, and a worker cannot
// import three (no DOM, and pulling the whole renderer into a worker bundle for `Color` would be
// absurd). So the colour lookup and the per-vertex expansion — the actual per-voxel work — happen
// off the main thread, and `mesh-bridge.ts` is left with nothing to do but wrap finished buffers in
// a BufferGeometry. The main thread's share of a chunk arrival becomes four `setAttribute` calls.

import { MAT } from '../voxel/depth'
import { SEAM } from '../voxel/seams'
import { WOOD } from '../voxel/trees'
import type { MeshResult } from '../voxel/greedy'
import { layerOf, faceOfNormal } from './tex/tiles'
import { baseOf } from '../voxel/depth'

/**
 * Palette — one colour per material index.
 *
 * ⚠ PLACEHOLDERS. Shimmer's look is Alex's pixel art; the registry (§4 of VOXEL-WORLD-MODEL) will
 * map each material to a `tiles.ts` index and an atlas. These exist so the world can be WALKED
 * before any art decision is made. Nothing here is a look call.
 */
export const MATERIAL_COLOR: Record<number, number> = {
  [MAT.POT]: 0xa9663f,
  [MAT.POT_SEEDED]: 0xa9663f,
  [MAT.POT_BLOOM]: 0xa9663f,
  // ── ★ THE FLOOR OF THE WORLD (2026-08-15) — was bedrock's near-black 0x2b2b33 ────────────────
  // Cool blue-white: the cloud-ocean pressed hard, seen from inside a garden pocket. It is the
  // PALEST thing underground on purpose — digging to the bottom and hitting something lighter than
  // the rock above it is the whole read ("this is not more world, this is the edge of it"), and a
  // dark floor is exactly how bedrock managed to look like ordinary deep stone for months.
  //
  // ⚠ IT DOES NOT EMIT, AND THAT IS A GAMEPLAY DECISION NOT AN ART ONE. Canon has cloud-walls
  // "faintly glowing", so an `emit` on the registry row would be defensible — and it would light
  // the floor of every deep cave in the world, which feeds `light.ts`'s block channel, which gates
  // Hollow spawn eligibility. That is a balance change to the night, smuggled in as a texture pass.
  // If the floor should glow, it should be Alex's call with the spawn consequence on the table.
  [MAT.PACKED_CLOUD]: 0xa8b4cc,
  [MAT.DEEP_STONE]: 0x494455,
  [MAT.STONE]: 0x7d7a86,
  [MAT.SUBSOIL]: 0x6b4f34,
  [MAT.TOPSOIL]: 0x4f9c3a,
  [MAT.SAND]: 0xd8c691,
  [MAT.WATER]: 0x2f6f9e,
  // ── ★ THE GROUNDS (2026-08-19, the character layer) ──────────────────────────────────────────
  // The world had ONE ground colour until today, which is most of what "it feels samey" was. These
  // eight have to read apart ACROSS A VALLEY, not just side by side in a swatch, so they are spread
  // on VALUE and SATURATION rather than nudged around one hue — a set of eight tasteful greens is
  // indistinguishable at fifty blocks and would have bought nothing.
  //   loam     — forest floor: dark, brown-shifted, the litter under a closed canopy
  //   lush     — a wet valley bottom: the most saturated green in the world, and the only one
  //              brighter than the meadow, so a dell reads as somewhere the water collects
  //   mud      — WET EARTH, and it took two passes to get there. 0x5a5738 then 0x6e6144 both went
  //              cold and near-grey in the scene: low-saturation browns lose their warmth entirely
  //              under this light, next to a turf that keeps all of its green. Only a properly
  //              saturated brown reads as mud rather than as dirty stone.
  //   dry      — OLIVE straw, not sand-straw. First pass was 0xb3a25c and the map killed it: it
  //              read as SAND (0xd8c691) at a glance, so every barrens and high plain looked like a
  //              beach that had wandered inland, right next to the real sand of the river shoulders.
  //              Duller and greener — dead grass is still grass, and it has to say so from a hill.
  //   highland — cool and grey-shifted, hardier turf at altitude, kin to stone rather than to grass
  //   scree    — warmer and paler than STONE (0x7d7a86) on purpose: broken rock catching light,
  //              which is what separates a crag's loose surface from the bedrock it sits on
  [MAT.FOREST_LOAM]: 0x3a6b2c,
  [MAT.LUSH_TURF]: 0x63b83e,
  [MAT.MARSH_MUD]: 0x7a5f3a,
  [MAT.DRY_GRASS]: 0x9c9a4e,
  [MAT.HIGHLAND_TURF]: 0x6d9270,
  [MAT.SCREE]: 0x93897c,
  // Desaturated on purpose — the greying IS desaturation (canon: grey is drained mana, and the
  // frayed edges gutter grey). An ashen green-grey, not a stone grey, so it still reads as ground.
  [MAT.GREY_SOIL]: 0x83887b,
  // ── ★ THE BUILDING GRAMMAR'S STONE (2026-08-13) ──────────────────────────────────────────────
  // Rubble reads BROKEN and cut stone reads WORKED, and they must not be told apart by hue: a
  // player standing in a half-built wall needs to see at a glance which cells are the patch and
  // which are the build. So they share stone's family and split on VALUE — rubble a shade darker
  // and browner (dirt in the cracks), cut stone paler and cooler than raw stone, the way a dressed
  // face is. ⚠ TBD-CANON on the names, like every other generic material in MAT.
  [MAT.RUBBLE]: 0x6e6862,
  [MAT.CUT_STONE]: 0x9aa0a4,
  // ── ★ THE MASONRY PALETTE (2026-08-15) ───────────────────────────────────────────────────────
  // The rule above ("share stone's family, split on VALUE") governs the two GREYS, because rubble
  // and cut stone are the same rock in two states. It deliberately does NOT govern these: pale
  // brick and sandstone are different MINERAL — terrace crust and beach sand — and a builder
  // reaching for a warm wall against a cold one is choosing hue on purpose. Each sits a step
  // deeper than the raw material it is bound from (crust 0xdcede4, sand 0xd8c691), so a wall reads
  // as worked next to the ground it came out of.
  //
  // ⚠ STONE BRICK IS THE ONE THAT HAD TO FIGHT FOR ITS READ. It is the same rock as cut stone, so
  // hue cannot separate them and the TEXTURE carries it (fine courses against big ashlar blocks);
  // this shade is a touch cooler and darker so a brick wall still reads apart from a dressed-slab
  // wall at distance, where the pattern blurs out first.
  [MAT.STONE_BRICK]: 0x8a9095,
  [MAT.PALE_BRICK]: 0xcfe0d7,
  // ⚠ ROSY, NOT YELLOW-TAN, AND THAT IS A LEGIBILITY FIX RATHER THAN A PREFERENCE. The first pass
  // took sand's own hue a step deeper (0xc6a76c) and landed it squarely between beach sand and
  // GOLDWOOD PLANKING — a warm banded cube beside a warm grained cube, which is the whole point of
  // adding a colour lost. Iron-pink is what real sandstone does anyway, it still reads as descended
  // from the sand it was bound out of, and nothing else in the world is in that hue.
  [MAT.SANDSTONE]: 0xc9977a,

  // ── ★ THE WEATHERED MASONRY (2026-08-27) ────────────────────────────────────────────────────
  // ⚠ THESE MUST NOT BE NEW HUES. The entire reason they exist is texture-mixing INSIDE one hue —
  // a mossy brick that reads as a different-coloured block is a second colour in the palette, which
  // is the thing every building source warns against. So each sits within a few points of its
  // clean sibling and the WEATHERING is carried by the tile, exactly the way stone brick and cut
  // stone are separated by pattern rather than colour.
  //
  // Moss pulls green and slightly darker (damp holds light badly); cracking pulls grey and lighter,
  // because a broken face shows unweathered stone under the patina.
  // ⚠ THE FIRST GREENS WERE TOO FAR AND THE HARNESS CAUGHT IT — 0x7e8c78 against stone brick's
  // 0x8a9095 is a genuine hue change, not a weathering of it, so a mixed wall read as two
  // materials rather than one material of two ages. These are pulled roughly 40% back toward their
  // clean siblings: enough green to say damp, not enough to become a second colour in the palette.
  // ⛔ THE EXACT GREEN IS ALEX'S CALL, not mine — `/shimmer/dev/build` is where it gets judged.
  [MAT.MOSSY_STONE_BRICK]: 0x848e83,
  [MAT.CRACKED_STONE_BRICK]: 0x93989b,
  [MAT.MOSSY_CUT_STONE]: 0x8a9184,
  // ── ★ THE CACHE — warm, against a warren that is entirely grey-green ─────────────────────────
  // Amber, and the choice is doing work rather than decorating: the rooms around it are mossy brick
  // (0x7f8a7c) and mossy cut stone (0x8a9184), so the ONE warm thing in a lightless corridor is the
  // thing worth walking to. `light.ts` gives it a 6-block block-light pool; this is what that pool
  // is centred on.
  [MAT.CACHE]: 0xd9a441,
  [SEAM.RAW_MANA]: 0x7fd4ff,
  // Mana in the shape of a wall. Deliberately the palest, coolest thing in the table and NOT in
  // stone's family — a cast wall must never be mistaken for one you could have built.
  [MAT.CONJURED]: 0xaef2ff,
  [SEAM.ELEMENT_VIOLET]: 0xa974ff,
  [SEAM.ELEMENT_STORM]: 0xe8e46a,
  [SEAM.ELEMENT_EARTH]: 0xc4813f,
  [SEAM.ELEMENT_WATER]: 0x53b7d8,
  [SEAM.PURE_CORE]: 0xfff2c4,
  [SEAM.ATHER_CRYSTAL]: 0xff6fd0,
  // Wood — placeholders like everything else here. Each species gets a distinguishable bark/leaf
  // pair so four species read as four species before a single tile is hand-painted.
  [WOOD.GOLDWOOD_LOG]: 0x8a6a34, [WOOD.GOLDWOOD_LEAVES]: 0x5aa845,
  [WOOD.SHIMMEROAK_LOG]: 0x6f5a3f, [WOOD.SHIMMEROAK_LEAVES]: 0x49913f,
  // ⚠ WAS 0x7d7291 AND IT READ AS POURED CONCRETE (Alex, 2026-08-13, confirmed in real GL — not a
  // software-GL artifact). The tell is in the channels: every other bark here runs R > G > B, which
  // is what wood DOES, and this one ran B highest. A blue-dominant mid-grey is a construction
  // material, and starwillow crowds the low ground, so the glade and the moonwell were full of
  // concrete columns. Pale silvered driftwood keeps the species reading apart from the three browns
  // without leaving the wood family.
  [WOOD.STARWILLOW_LOG]: 0xb3a690, [WOOD.STARWILLOW_LEAVES]: 0x7fc0a8,
  [WOOD.DAWNWOOD_LOG]: 0x9a5f4a, [WOOD.DAWNWOOD_LEAVES]: 0xd9a05e,
  // ── ★ SAPLINGS (2026-08-13) — a young tree, tinted toward its species' own canopy ──────────
  // ⚠ WITHOUT THESE FOUR LINES A PLANTED SAPLING RENDERS AS THE MAGENTA CHECKERBOARD. `tiles.ts`
  // paints an unmapped material as a loud checker on purpose ("a bug you SEE"), and a brand-new
  // material is exactly the case that trips it. Adding a MAT id is never the whole job.
  //
  // Each is its species' leaf colour pulled darker and greener — a seedling reads younger than the
  // canopy it becomes, and four saplings in a hotbar have to be told apart at a glance.
  [MAT.SAPLING_GOLDWOOD]: 0x3f7a30, [MAT.SAPLING_SHIMMEROAK]: 0x34682c,
  [MAT.SAPLING_STARWILLOW]: 0x4d8878, [MAT.SAPLING_DAWNWOOD]: 0x8a6a3a,
  // Warm mana-light in a plank frame — the raw-mana blue warmed toward candle, so a lit yard
  // reads as TENDED against the cold ore glow of a cave.
  [MAT.MANA_LANTERN]: 0xffd98a,
  // Milled goldwood, a step lighter and warmer than the raw log — a worked surface, not bark.
  [MAT.CRAFT_TABLE]: 0xb08a4e,
  [MAT.SAWMILL]: 0xc9a97a,
  // The stonecutter reads STONE, not timber — a shade under cut stone (0x9aa0a4) so a dressed bed
  // sits visibly darker than the wall blocks it produces. The two mills are pale wood; this one is
  // grey, which is the whole point: the family's third member must be told apart from the other two
  // across a plot, and a third warm timber cube could not be.
  [MAT.STONECUTTER]: 0x8f9296,
  // ── ★ THE CAULDRON (2026-08-18) — fired clay, deliberately NOT iron ──────────────────────────
  // Deeper and greyer than the planting pot's warm terracotta (0xa9663f): the same fired earth,
  // bigger, and darkened by the fire it stands over. Iron would be the obvious cauldron and it is
  // the one colour the substance law forbids (`design-briefs/shimmer-alchemy-vessels.md`), so the
  // brown is load-bearing — it is what tells a keeper this is Ather craft and not Mint metal.
  [MAT.CAULDRON]: 0x8a5236,
  // ── ★ THE GARDEN BED (2026-08-22) — turned earth, darker and wetter than the ground it sits on ──
  // Read against SUBSOIL's flank brown rather than against topsoil's green: a bed is soil that has
  // been broken open, so it should look like the underside of the turf, not like turf. Darker than
  // the surrounding ground on every one of the eight grounds, which is what makes a row of them read
  // as a garden from across the plot instead of as patches of slightly-off grass.
// ⚠ THREE MATERIALS, ONE SOIL, THREE FRAMES (2026-08-22, Alex: *"the planks used decides the color
// of the border"*). The vertex colour MULTIPLIES the tile (`atlas.ts`: `diffuseColor.rgb *= tile.rgb`),
// so this single value tints the whole block — the frame cannot be a second free hue here, it is the
// painter's job. What this does is set each bed's overall cast: the turned earth pulled toward the
// wood it is framed in, so three beds side by side read as three woods and not as three dirt patches.
//
// Turned earth read against SUBSOIL's flank brown rather than topsoil's green: a bed is soil broken
// open, so it looks like the underside of the turf. Darker than the surrounding ground on all eight
// grounds, which is what makes a row of them read as a garden from across the plot.
  [MAT.GARDEN_BED_GOLDWOOD]: 0x4a3527,
  // Shimmeroak's timber is the cooler, greyer wood (log 0x8a7f6a against goldwood's warm 0xa9803f),
  // so its bed cools the same amount — the difference has to survive being multiplied into soil.
  [MAT.GARDEN_BED_SHIMMEROAK]: 0x413628,
  // Dawnwood is the red timber (log 0x9a5f4a). The reddest of the three beds, and the one that has
  // to be told apart from goldwood's warm brown rather than from shimmeroak's grey.
  [MAT.GARDEN_BED_DAWNWOOD]: 0x54321f,
  // ── ★ THE FOUR ELEMENT HERBS (2026-08-18) — canon's own descriptions, at 16px ────────────────
  // Each colour is read off the herb's canon text rather than off its element's palette, because
  // the ruling that placed them says the same thing about their ground: read the thing, not the
  // lookup. Violetbloom HUMS (a violet that glows a little rather than a purple flower), Stormgrass
  // is *blue-tipped blades* on ordinary turf, Rootvine ANCHORS DEEP (dark root-brown-green, not a
  // leaf green), Tidepetal is *beaded with moisture* — pale, wet, almost white at the edge.
  // ⚠ These are the STEM/BODY colours; the head tint the renderer draws is derived from them.
  [MAT.VIOLETBLOOM]: 0x8f5fd8,
  [MAT.STORMGRASS]: 0x5f8fbe,
  [MAT.ROOTVINE]: 0x4a5f34,
  [MAT.TIDEPETAL]: 0x9fd8d0,
  // ── ★★ THE SEVEN WILD CROPS (2026-08-22) — read the plant, not the lookup ────────────────────
  // Same discipline as the herbs directly above: each colour is derived from what canon and the
  // item text say the thing IS, not picked to fill a palette slot. These are STALK/BODY colours;
  // the ripe head the renderer draws takes its own tint from the table in `flora-mesh.ts`.
  //
  // ⚠ SEVEN PLANTS ON SEVEN GROUNDS, AND SILHOUETTE IS NOT YET DOING ANY OF THE WORK. The herbs
  // carry the same warning and it applies harder here, because there are seven: colour is telling
  // them apart, and they survive it only because their grounds never put two side by side. That is
  // survivable, not good. **Distinct silhouettes are Alex's call** — the canon text is specific
  // enough to draw from when he wants it (a vine that opens at night, a pod hard enough to survive
  // scouring, a cap of crystal, a root that dreams).
  [MAT.MOONVINE]: 0x6f7fae,      // basin night-vine — cool, blue-shadowed, never a leaf green
  [MAT.STARBEAN]: 0x7f8f5a,      // river pod on a tough stem; the pod survives what scours it
  [MAT.CRYSTALCAP]: 0x9fb8c8,    // crag mineral — pale, faceted, closer to stone than to plant
  [MAT.DREAMROOT]: 0x8f6f9e,     // woodland, dusk-purple, the one that reads narcotic
  [MAT.SHIMMERBLOOM]: 0xe0c8a0,  // shore bloom, sun-bleached warm, sand in the colour
  [MAT.ATHERWHEAT]: 0xc8b070,    // meadow grain, the classic gold — rarest thing on the commonest ground
  [MAT.DAWNCAP]: 0xd8a070,       // highland first-light — warm orange over a cold ground
  // ── ★ THE WAYMARK (2026-08-15) — mana bound to a place ───────────────────────────────────────
  // Pale dressed stone, but pulled toward the raw-mana blue (0x7fd4ff) rather than sitting in
  // stone's grey family — a waymark is *"mana bound to a place"*, and the binding is the point. It
  // must read as a MARKER from distance, so it takes the coolest, brightest note in the masonry
  // range and carries a lit glyph the painter draws on top.
  // ⚠ DARKER THAN IT FIRST WAS (0x9fb6c8), because the GLYPH has to out-read the stone it is cut
  // into. At 16px a pale post with a pale mark on it renders as a few scattered dots — the icon
  // sheet showed it plainly. Slate gives the lit glyph somewhere to be bright against.
  [MAT.WAYMARK]: 0x74879b,
  // ── ★ THE CLOUD-WALL (2026-08-15) — PACKED_CLOUD's soft sibling ──────────────────────────────
  // Canon: *"soft, pale, faintly glowing cloud, piled like heaped wool."* So it is the SAME stuff
  // as the world floor (0xa8b4cc) pressed less hard — lighter, warmer and softer-edged, because at
  // the walls the cloud-ocean is held back rather than stood on. The two must read as one material
  // at two pressures, which is why they share a hue and split on value, exactly the way rubble and
  // cut stone do.
  // ⚠ DEEPER THAN IT FIRST WAS (0xd6dcea), for the arithmetic reason rather than a taste one: a
  // base that pale clips against white the moment the billow lift is added, so the whole face
  // compressed into one flat tone and the wall rendered as a blank cube. A softer material needs a
  // LOWER base than a hard one, not a higher one, if its highlights are going to have anywhere to
  // go — the floor (0xa8b4cc) gets away with less because its swing is narrower.
  [MAT.CLOUD_WALL]: 0xbcc7dd,
  // Darker than the bench: a chest is sturdier stock, and the two stand side by side in a keeper's
  // home — they have to read apart at a glance, not just up close.
  [MAT.CHEST]: 0x8f6535,
  // Packed earth, drier than subsoil, tanner than sand — the story road.
  [MAT.PATH]: 0xa8916b,
  // ── ★ THE WOODEN WALLS, ONE PER PLANK SPECIES (2026-08-22, the planking cut) ────────────────
  // Milled strips — the builder's floor. ⚠ No longer the bridge deck; see MAT.DECK.
  //
  // ⚠ EACH IS ITS SPECIES' OWN TIMBER, pulled a little warmer and lighter than the standing LOG,
  // because milled wood IS lighter than bark — that difference is what stops a wall reading as a
  // stack of trunks. Derived by eye from each log colour rather than by formula: goldwood's log is
  // 0x8a6a34, shimmeroak's 0x8a7f6a, dawnwood's 0x9a5f4a, and the three walls must be tellable
  // apart at a distance, which a uniform lightening does not guarantee.
  [MAT.PLANKS_GOLDWOOD]: 0xa8834d,
  // Shimmeroak: the cool grey-brown timber. The one that must not drift into goldwood's warmth.
  [MAT.PLANKS_SHIMMEROAK]: 0xa39a83,
  // Dawnwood: the red timber, and the most distinct of the three at any distance.
  [MAT.PLANKS_DAWNWOOD]: 0xb2765c,
  // The road's bridge timber: the same goldwood weathered paler and greyer by whatever years the
  // story road has stood. It must NOT read as fresh planking — the colour is the only warning a
  // player gets that this one pays nothing, so it is a visible step toward PATH's tan, not a tint.
  [MAT.DECK]: 0x8d7f63,
  // The hot springs' mineral shell: pale calcite white with a breath of the springs' teal — bright
  // against stone and topsoil so a terrace pool reads from across the valley, the way real spring
  // terraces do.
  [MAT.SPRING_CRUST]: 0xdcede4,
}

/** Materials that glow, so ore reads in an unlit cave instead of being a slightly different grey. */
export const EMISSIVE: Record<number, number> = {
  [SEAM.RAW_MANA]: 0.55,
  [SEAM.ELEMENT_VIOLET]: 0.5,
  [SEAM.ELEMENT_STORM]: 0.5,
  [SEAM.ELEMENT_EARTH]: 0.35,
  [SEAM.ELEMENT_WATER]: 0.5,
  [SEAM.PURE_CORE]: 0.8,
  [SEAM.ATHER_CRYSTAL]: 1.0,
  // The lantern out-glows every seam — it is the one block whose JOB is light. (Render-side only;
  // the spawn-side truth is registry `emit`, flooded by light.ts. Two systems, one story.)
  [MAT.MANA_LANTERN]: 1.0,
  // It glows because it IS mana, and because a glow is the cheapest way to say "this is not rock
  // and it will not be here long". Below the lantern: a wall should not out-light the light source.
  [MAT.CONJURED]: 0.45,
  // ── ★★ THE CACHE, AND IT NEEDS BOTH TABLES — registry `emit` AND this one ───────────────────
  // They are separate systems and a block can sit in one without the other: the WAYMARK has
  // registry `emit: 7` and no row here, so it lights the ground around it without looking lit
  // itself. That is right for a landmark and wrong for this. The cache's whole job is to be SEEN
  // from down a dark corridor — *"a filled seat is a line of light"*, pointed at the object — so it
  // must both cast light (registry) and read as self-lit (here).
  // ⚠ Setting only the registry field would have shipped a cache that lights the room it is in and
  // is itself an ordinary grey cube: the pool of light would be there with nothing at the middle of
  // it, which looks like a bug in the lighting rather than a thing to walk towards.
  // ★ Under the lantern's 1.0 on the same reasoning the waymark row gives: a cache is a thing you
  // glimpse and go to, not the light you carry.
  [MAT.CACHE]: 0.7,
}

/** An unmapped material must be LOUD, not invisible — magenta says "the registry missed one". */
const FALLBACK = 0xff00ff

export interface MeshAttrs {
  positions: Float32Array
  normals: Float32Array
  colors: Float32Array
  emissive: Float32Array
  /**
   * Texture-array layer per vertex.
   *
   * ★ BUILT HERE, WHICH MEANS BUILT IN THE WORKER. The texture spike computed this host-side from
   * `mesh.materials` + `mesh.normals` on every mesh upload; moving it into `attrs.ts` puts it on the
   * generation thread with the rest of the per-vertex expansion, so the main thread's share of a
   * chunk arrival stays four `setAttribute` calls. One float per vertex is the entire cost of
   * texturing — UVs are derived in-shader from position and normal, so there is no UV buffer.
   *
   * ⚠ Face comes from the NORMAL, which is exact for axis-aligned quads, so `voxel/` never had to
   * learn about textures. That is why the pure core is still untouched by any of this.
   */
  layers: Float32Array
  /**
   * ★ ONLY THE LEAF PARTITION CARRIES UVs, and only because it has to. Every other quad is
   * axis-aligned, so the shader derives its UV from position and normal and no buffer is needed —
   * that derivation is why `voxel/` never had to learn textures exist. A leaf is a crossed quad on
   * a diagonal: the derivation has no face to key off and would smear the tile. So leaves get real
   * UVs, and nothing else pays for them.
   */
  uv?: Float32Array
  /**
   * ── ★ WATER ONLY, AND THAT IS WHY IT IS OPTIONAL (2026-08-21) ────────────────────────────────
   * Per-vertex water depth in blocks, `-1` where the mesher had no depth field to read. Only the
   * WATER partition carries it: depth attenuation is a property of the transparent pass, and water
   * is a low single-digit percentage of the world's quads, so paying a float per vertex across
   * every block face to serve it would be the whole world subsidising the rivers.
   */
  depth?: Float32Array
  indices: Uint32Array
  quads: number
}

/** Every buffer in a MeshAttrs, for structuredClone transfer. Zero-copy across the worker boundary. */
export const attrBuffers = (a: MeshAttrs): ArrayBuffer[] =>
  [a.positions.buffer, a.normals.buffer, a.colors.buffer, a.emissive.buffer,
   a.layers.buffer, a.indices.buffer,
   ...(a.uv ? [a.uv.buffer] : []),
   ...(a.depth ? [a.depth.buffer] : [])] as ArrayBuffer[]

/**
 * ── ★ WATER IS ITS OWN DRAW, AND THIS IS WHERE IT SPLITS (2026-08-07 late) ─────────────────────
 * Transparent water cannot live in the section's opaque geometry: triangles inside one draw render
 * in INDEX order, so a water quad that happens to sit before its own river bed in the buffer
 * blends against the sky, writes depth, and the bed behind it is discarded — see-through water
 * that shows nothing is under it. The fix is the standard one: opaque pass first, water after, so
 * water always blends over a finished scene. That means water quads leave this geometry entirely
 * and come back as a second mesh with the shared water material (ONE extra program total — the
 * per-chunk-material rule bans a program per chunk, not a second pass).
 *
 * Partition is per QUAD (4 vertices, 6 indices, one material) and reindexes both halves densely.
 * Either half can be null — most sections have no water at all, and a null skips the mesh, the
 * geometry, and the draw, so dry country pays nothing.
 */
export function buildAttrsSplit(
  mesh: MeshResult, isWater: (m: number) => boolean, isLeaf: (m: number) => boolean = () => false,
): { solid: MeshAttrs | null; water: MeshAttrs | null; leaves: MeshAttrs | null } {
  // ★ LEAVES EARN A THIRD PASS FOR A DIFFERENT REASON THAN WATER. Water splits for ORDER (blend
  // after opaque). Leaves split for MATERIAL: they are crossed quads that need alpha cutout and
  // double-sided lighting, and neither can be a per-chunk uniform on the main program without
  // giving every block a cutout test it does not need. Still one extra program total, which is what
  // the per-chunk-material rule actually forbids — not a second pass.
  let waterQuads = 0, leafQuads = 0
  for (let q = 0; q < mesh.quads; q++) {
    const m = mesh.materials[q * 4]
    if (isWater(m)) waterQuads++
    else if (isLeaf(m)) leafQuads++
  }
  if (waterQuads === 0 && leafQuads === 0) return { solid: buildAttrs(mesh), water: null, leaves: null }

  const pick = (want: 'solid' | 'water' | 'leaf', quads: number): MeshAttrs => {
    const positions = new Float32Array(quads * 12)
    const normals = new Float32Array(quads * 12)
    const materials = new Uint16Array(quads * 4)
    const ao = new Uint8Array(quads * 4)
    // Only the water half ever reads this, so only the water half allocates it.
    const waterDepth = want === 'water' ? new Float32Array(quads * 4) : EMPTY_DEPTH
    const indices = new Uint32Array(quads * 6)
    let outQ = 0
    for (let q = 0; q < mesh.quads; q++) {
      const m = mesh.materials[q * 4]
      const kind = isWater(m) ? 'water' : isLeaf(m) ? 'leaf' : 'solid'
      if (kind !== want) continue
      positions.set(mesh.positions.subarray(q * 12, q * 12 + 12), outQ * 12)
      normals.set(mesh.normals.subarray(q * 12, q * 12 + 12), outQ * 12)
      materials.set(mesh.materials.subarray(q * 4, q * 4 + 4), outQ * 4)
      // ⚠ AO travels WITH the quad through the water split. Dropping it here would leave the water
      // half reading `undefined` per vertex and silently fall back to unoccluded — a river bed that
      // is correctly shaded until the moment water covers it.
      ao.set(mesh.ao.subarray(q * 4, q * 4 + 4), outQ * 4)
      // ⚠ Depth travels WITH the quad, for the same reason AO does one line above: the split is the
      // only place that knows which output quad an input quad became, so anything keyed by quad
      // index has to be remapped here or it silently reads another quad's value.
      if (want === 'water' && mesh.waterDepth) waterDepth.set(mesh.waterDepth.subarray(q * 4, q * 4 + 4), outQ * 4)
      // Remap the quad's OWN indices rather than assuming a triangulation: winding is what makes a
      // face face outward, and the mesher owns that decision, not this split.
      for (let i = 0; i < 6; i++) indices[outQ * 6 + i] = mesh.indices[q * 6 + i] - q * 4 + outQ * 4
      outQ++
    }
    return buildAttrs(
      { positions, normals, materials, ao, waterDepth, indices, quads, faces: quads },
      want === 'leaf', want === 'water')
  }
  const solidQuads = mesh.quads - waterQuads - leafQuads
  return {
    solid: solidQuads > 0 ? pick('solid', solidQuads) : null,
    water: waterQuads > 0 ? pick('water', waterQuads) : null,
    leaves: leafQuads > 0 ? pick('leaf', leafQuads) : null,
  }
}

/** One section's attributes plus the height its section sits at within its column. */
export interface AttrPart {
  attrs: MeshAttrs
  /** Section origin Y. Positions arrive section-local (0..SECTION); this is what makes them column-local. */
  dy: number
}

/**
 * ── ★ ONE DRAW PER COLUMN PER PASS, NOT ONE PER SECTION (2026-08-13) ───────────────────────────
 * Concatenate a column's section attributes into a single buffer set, lifting each section's
 * positions by its own origin so the merged geometry is COLUMN-local and its mesh sits at y=0.
 *
 * ★ WHY THIS EXISTS: the mesher's unit is the 16³ section, and the renderer inherited that unit as
 * its DRAW unit — one `THREE.Mesh` per section per pass. A 256-tall world is 16 sections per
 * column, so a load ring of 441 columns was uploading thousands of meshes and asking the GPU for
 * each one separately. Draw calls are near-pure CPU overhead when every mesh shares one material
 * (and they do — see `createVoxelMaterial`), so that count IS the frame budget. Meshing per section
 * and DRAWING per section are separate decisions that only looked like one decision.
 *
 * ★ THE COST IS FRUSTUM GRANULARITY, AND IT IS SMALL FOR A REASON WORTH WRITING DOWN. Culling now
 * happens per column, so a column with one corner on screen submits its whole height. That sounds
 * expensive and is not: the frustum is TALL at distance — by ~150 blocks out it already spans more
 * than the world's 256 height — so per-section vertical culling only ever rejected anything for the
 * handful of columns near the player. We trade a rejection that rarely fired for a call count that
 * always did. The bounding sphere is computed from real vertices (`toGeometry`), not from the
 * column's theoretical 16×256×16 box, so a shallow column still gets a tight sphere.
 *
 * Returns null for an empty list — most columns have no water at all, and a null skips the merge,
 * the geometry and the draw.
 */
export function concatAttrs(parts: AttrPart[]): MeshAttrs | null {
  if (parts.length === 0) return null

  let verts = 0, idxLen = 0, quads = 0, anyUV = false, anyDepth = false
  for (const p of parts) {
    verts += p.attrs.positions.length / 3
    idxLen += p.attrs.indices.length
    quads += p.attrs.quads
    if (p.attrs.uv) anyUV = true
    if (p.attrs.depth) anyDepth = true
  }

  const positions = new Float32Array(verts * 3)
  const normals = new Float32Array(verts * 3)
  const colors = new Float32Array(verts * 3)
  const emissive = new Float32Array(verts)
  const layers = new Float32Array(verts)
  const indices = new Uint32Array(idxLen)
  const uv = anyUV ? new Float32Array(verts * 2) : undefined
  const depth = anyDepth ? new Float32Array(verts) : undefined

  let v = 0, i = 0
  for (const p of parts) {
    const a = p.attrs
    const n = a.positions.length / 3
    positions.set(a.positions, v * 3)
    // The one transform in the whole merge. Sections are meshed against their own origin, so
    // without this every section of a column would stack at the bottom of it.
    if (p.dy !== 0) for (let j = 0; j < n; j++) positions[(v + j) * 3 + 1] += p.dy
    normals.set(a.normals, v * 3)
    colors.set(a.colors, v * 3)
    emissive.set(a.emissive, v)
    layers.set(a.layers, v)
    // ⚠ A PART WITHOUT DEPTH FILLS WITH THE -1 SENTINEL, NOT WITH ZERO. Zero is a real depth and
    // renders as almost perfectly clear water; -1 is "no data" and renders as the old flat opacity.
    // A mixed list means some sections were meshed without a water surface, and the honest result
    // for those is the previous look rather than a river you can see straight through.
    if (depth) { if (a.depth) depth.set(a.depth, v); else depth.fill(-1, v, v + n) }
    // ⚠ UV IS ALL-OR-NOTHING PER PASS BY CONSTRUCTION — only the leaf partition asks for it, and it
    // asks for every part. If a mixed list ever arrives anyway, derive the missing corners rather
    // than zero-filling: zeros would pin a whole section to one texel and read as a smear, which is
    // the kind of wrong that looks like an art bug and gets hunted in the wrong file for an hour.
    if (uv) {
      if (a.uv) uv.set(a.uv, v * 2)
      else for (let j = 0; j < n; j++) {
        const corner = j & 3
        uv[(v + j) * 2] = corner === 1 || corner === 2 ? 1 : 0
        uv[(v + j) * 2 + 1] = corner >= 2 ? 1 : 0
      }
    }
    // Indices are section-local too, so they shift by the vertices already written.
    for (let j = 0; j < a.indices.length; j++) indices[i + j] = a.indices[j] + v
    v += n
    i += a.indices.length
  }

  return { positions, normals, colors, emissive, layers, uv, depth, indices, quads }
}

/**
 * Expand a core mesh into render-ready attributes. Copies positions/normals/indices out of the
 * mesher's reusable scratch — they are views that the next section would overwrite, so a copy here
 * is not waste, it is the thing that makes the result safe to hand across a thread boundary.
 */
/**
 * ── ★ AO IS A COLOUR MULTIPLIER, NOT A NEW ATTRIBUTE (2026-08-12) ───────────────────────────────
 * The mesher hands back a 0–3 corner term per vertex. Folding it into the vertex colour here means
 * no new buffer crosses the worker boundary, no extra `setAttribute` on chunk arrival, and — the
 * part that actually decided it — **no shader change**, so AO cannot become the reason a material
 * needs its own program. The world shader already multiplies texture by vertex colour; darkening
 * that colour at a corner is exactly ambient occlusion, arriving through a path that already exists.
 *
 * The curve is deliberately gentle at the bright end and steep at the dark end. Voxel AO with a
 * linear ramp reads as dirt smeared on the walls; what sells the corner is the last step, not the
 * first. These four numbers are the entire look and are meant to be dialled — 0.62 is the darkest
 * an inside corner ever gets, which stays well clear of black so a shadowed corner keeps its
 * material's colour instead of turning into a hole.
 */
const AO_CURVE = [0.62, 0.78, 0.91, 1] as const

/** Shared empty buffer for the partitions that carry no depth — allocating one per call would put
 *  a throwaway Float32Array on every solid and leaf section, which is the exact garbage pressure
 *  `MeshScratch` exists to avoid. */
const EMPTY_DEPTH = new Float32Array(0)

export function buildAttrs(mesh: MeshResult, withUV = false, withDepth = false): MeshAttrs {
  const n = mesh.materials.length
  const colors = new Float32Array(n * 3)
  const emissive = new Float32Array(n)
  const layers = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const m = mesh.materials[i]
    // Face from the vertex NORMAL — exact for axis-aligned quads, which is why `voxel/` never had
    // to learn that textures exist. normals are 3 floats per vertex; y decides top/side/bottom.
    layers[i] = layerOf(m, faceOfNormal(mesh.normals[i * 3 + 1]))
    const hex = MATERIAL_COLOR[baseOf(m)] ?? FALLBACK
    // Inline hex→linear-ish float rather than THREE.Color, which is the whole reason this file has
    // no three import. Three's default is sRGB-in, and Lambert with vertexColors expects that.
    const ao = AO_CURVE[mesh.ao[i]] ?? 1
    colors[i * 3] = (((hex >> 16) & 255) / 255) * ao
    colors[i * 3 + 1] = (((hex >> 8) & 255) / 255) * ao
    colors[i * 3 + 2] = ((hex & 255) / 255) * ao
    emissive[i] = EMISSIVE[m] ?? 0
  }
  // Corner UVs from the vertex's index WITHIN its quad — the mesher winds every quad the same way,
  // so (0,0) (1,0) (1,1) (0,1) is the whole mapping and needs no extra data from the mesher.
  let uv: Float32Array | undefined
  if (withUV) {
    uv = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      const k = i & 3
      uv[i * 2] = k === 1 || k === 2 ? 1 : 0
      uv[i * 2 + 1] = k >= 2 ? 1 : 0
    }
  }
  return {
    positions: mesh.positions.slice(),
    normals: mesh.normals.slice(),
    colors,
    emissive,
    layers,
    uv,
    depth: withDepth && mesh.waterDepth ? mesh.waterDepth.slice() : undefined,
    indices: mesh.indices.slice(),
    quads: mesh.quads,
  }
}
