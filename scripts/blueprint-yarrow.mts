// YARROW'S APOTHECARY — Yarrow's shopfront, the third Moonwell trade building as a blueprint.
//
// Run: npx tsx scripts/blueprint-yarrow.mts   → writes src/app/shimmer/data/blueprints/yarrow_apothecary.json
//
// Same door into the same disk as `blueprint-hazel.mts` / `blueprint-sax.mts`: `makeBlueprint` →
// `blueprintProblems` → `serializeBlueprint`, and the JSON the worktable can open afterwards. Read
// Hazel's header for why a script and not the worktable. This building's own reach list is below,
// numbered fresh (R1..) the way Sax's is — not a continuation of Hazel's or Mallow's numbering.
//
// Canon (characters/moonwell-folk.md): Yarrow, apothecary — wants herbs, bark, raw shards, and buys
// finished brews; gives catalysts, jars, the keeper's first recipe. "Brisk, precise, a little proud
// of the jars. Teaches by handing you the wrong ingredient and waiting." The look is Jin's; nothing
// here says a word about Yarrow beyond the canon line above.
//
// The look: a half-timbered cottage — dawnwood posts at the four corners AND flanking the door,
// pale-brick infill between them (the palest stone this world draws, `0xcfe0d7`; nowhere else is
// it a wall body, only Sax's quoin accent — so a pale plastered cottage reads as neither Hazel's
// honest-timber carpentry nor Sax's grey stone yard), a cut-stone base course, an eaves-front roof
// (the front reads eaves, not a gable — Hazel already owns the gable silhouette) with a row of
// hooks under the front eave for a drying rack. The house itself is a small single room — the
// footprint's length is nearly all garden. A shut back door leads straight out into a fenced herb
// garden that runs the rest of the lot: beds of the four element herbs along the fence line, a
// path down the middle, a lantern on a post at the far end.
//
// Footprint 9 (x) × 14 (z) including the garden; the FRONT (the open doorway) is the z=0 side.
//
// ── ★★ THE REACH LIST (what the hand went for and did not find) ──────────────────────────────
// R1  SHELVES. Same gap Hazel and Mallow both hit. Jars want a wall-mounted shelf; there is only
//     `hook` (one item) and `half_slab` (knee-high, floor-standing). Used: `half_slab` pieces at
//     y=1 along the east interior wall with a pot sitting in the cell above at y=2 — a low bench
//     doubling as a shelf ledge, which is the same workaround Sax's kerb-cap uses for a different
//     shape. → a wall-mounted `shelf` piece (passable, like the shutter).
// R2  A SIGN. Same as Hazel's R5 / Sax's R6 — three trade buildings now and still no way to say
//     whose door is whose without a nameboard. Worth flagging again because Yarrow is the building
//     where it matters MOST: an apothecary and a plain cottage are the same shape.
// R3  HUNG GOODS ON THE DRYING RACK. The front-eave hook row is the building's signature read
//     ("a drying rack") and every hook hangs empty — same family as Mallow's R9. A bundle of drying
//     herbs that draws BELOW a hook would make the rack read as working rather than decorative.
// R4  A COUNTER. Same open item as Hazel's R3 / Mallow's R3. Canon's "hands you the wrong
//     ingredient and waits" wants a counter to hand it across; used the cauldron + shelf as the
//     interior focal point instead, no counter at all — a keeper who wants Yarrow has to walk in.
// R5  THE WANT-LIST HAS NO BLOCK. Same shape as Sax's R7. Canon says Yarrow wants herbs, BARK and
//     RAW SHARDS; the garden can show what Yarrow GROWS (the four herbs) but there is no placeable
//     bark or shard block, so what Yarrow is waiting ON on cannot stand in the yard the way the
//     herbs can. → a placeable `BARK` and a `RAW_SHARD`/mana-shard block.
// R6  THE PLINTH IS BLOCKS-ONLY. Same as Sax's R8. `stamps.ts` fills a plinth under bottom-layer
//     BLOCKS only; the front and back doorstep stairs sit at y=0 and would float on a stepped pad.
//     Not hit on the preview pad (flat); written down because both stairs are at y=0.
// (What was NOT missing: footing, planks, cut stone, pale brick, shingles, post/half_slab/bench,
//  doorway, door, window+shutter, hook, stair, roof_slope/cap, fence, gate, the CAULDRON, the three
//  jar states (POT/POT_SEEDED/POT_BLOOM), CHEST, MANA_LANTERN, all three garden-bed woods, all four
//  element herbs. The shell + garden vocabulary is enough; the shop-floor furniture is the reach.)
// ⚠ 2026-09-13: `doorway` became a 3×3 FRAME (posts + head around a 1×2 opening; see pieces.ts).
// This script still authors the old 1×3 slot, so re-running it would set a frame three cells wide
// where a slot was and overlap the wall. The five old placements were dropped from the JSONs by
// hand; Alex is rebuilding the buildings in the editor, which is the artefact from here on.
import { writeFileSync } from 'fs'
import { join } from 'path'
import { makeBlueprint, blueprintProblems, serializeBlueprint, type BlueprintCell } from '../src/app/shimmer/voxel/blueprints'
import type { Placement, Rotation } from '../src/app/shimmer/voxel/pieces'
import { MAT } from '../src/app/shimmer/voxel/depth'

// The house: x 0..4, walls z 1..5 (z 0 and z 6 are the eave rows). The garden: x 0..8, z 7..13.
// Total 9 × 14. Front = z 0.
const BX0 = 0, BX1 = 6                      // house x span (7 wide — needed so the front has brick
                                             // pillars beside its openings, not just corner posts)
const BZ0 = 1, BZ1 = 5                      // house wall z span (eaves at BZ0-1 and BZ1+1)
const WALL = 3                              // y 1..3 wall rows; y 0 floor
const GZ0 = 7, GZ1 = 13, GX1 = 8            // garden z span and x span (wider than the house)
const cells: BlueprintCell[] = []
const pieces: Placement[] = []
const put = (x: number, y: number, z: number, m: number) => cells.push({ x, y, z, m })
const cut = (x: number, y: number, z: number) => { const i = cells.findIndex(c => c.x === x && c.y === y && c.z === z); if (i >= 0) cells.splice(i, 1) }
const piece = (pieceId: string, x: number, y: number, z: number, rot: Rotation = 0) => pieces.push({ pieceId, x, y, z, rot })

// ── the house ────────────────────────────────────────────────────────────────────────────────
// Floor: cut-stone footing ring, goldwood planks inside (Mallow's pattern).
for (let z = BZ0; z <= BZ1; z++) for (let x = BX0; x <= BX1; x++) {
  const edge = x === BX0 || x === BX1 || z === BZ0 || z === BZ1
  put(x, 0, z, edge ? MAT.CUT_STONE : MAT.PLANKS_GOLDWOOD)
}
// Half-timbered: dawnwood posts at the four corners, pale-brick infill between them on a cut-stone
// base course. Corners get posts, never wall blocks (Hazel/Mallow's convention).
const corners: [number, number][] = [[BX0, BZ0], [BX1, BZ0], [BX0, BZ1], [BX1, BZ1]]
for (let y = 1; y <= WALL; y++) {
  for (const [x, z] of corners) piece('post_dawnwood', x, y, z, 0)
  for (let x = BX0 + 1; x < BX1; x++) for (const z of [BZ0, BZ1]) put(x, y, z, y === 1 ? MAT.CUT_STONE : MAT.PALE_BRICK)
  for (let z = BZ0 + 1; z < BZ1; z++) for (const x of [BX0, BX1]) put(x, y, z, y === 1 ? MAT.CUT_STONE : MAT.PALE_BRICK)
}
// Age on the base course — one mossy block each side, where water pools under the eave.
cut(BX0, 1, 2); put(BX0, 1, 2, MAT.MOSSY_CUT_STONE)
cut(BX1, 1, 4); put(BX1, 1, 4, MAT.MOSSY_CUT_STONE)
// The front: an open doorway in the middle (frame only, no leaf — Sax's front convention), a
// window either side of it with a solid brick pillar between (so the pale brick actually shows —
// three openings in a row with only corner posts left the first cut skeletal, all frame and no
// wall), a doorstep stair under the eave.
const DX = 3
cut(DX, 1, BZ0); cut(DX, 2, BZ0); cut(DX, 3, BZ0); piece('doorway', DX, 1, BZ0, 0)
piece('stair', DX, 0, BZ0 - 1, 2)          // rot 2: the tall step is at +z, you climb toward the door
for (const x of [1, 5]) { cut(x, 1, BZ0); cut(x, 2, BZ0); piece('window', x, 1, BZ0, 0) }
// The back: a shut door straight out to the garden (Mallow's doorway+door convention), the
// doorstep stair mirrored the other way.
cut(DX, 1, BZ1); cut(DX, 2, BZ1); cut(DX, 3, BZ1); piece('doorway', DX, 1, BZ1, 0); piece('door', DX, 1, BZ1, 0)
piece('stair', DX, 0, BZ1 + 1, 0)          // rot 0: mirrored — the tall step is at −z, toward the door
// Side windows with shutters (Mallow's convention: window rot stays 1 on both sides, only the
// shutter's rotation flips so the leaf shows on the outside face).
for (const [x, rot] of [[BX0, 1], [BX1, 3]] as [number, Rotation][]) {
  cut(x, 1, 3); cut(x, 2, 3); piece('window', x, 1, 3, 1)
  cut(x, 2, 2); cut(x, 2, 4); piece('shutter', x, 2, 2, rot); piece('shutter', x, 2, 4, rot)
}
// Roof: ridge along x, so the EAVES face the front (Hazel shows a gable end; two buildings that
// read as the same silhouette are one building, and Sax already owns plain eaves in stone — this
// one is timber-and-plaster under shingles). Row 0's slopes stand one cell outside the front/back
// walls for the overhang the drying-rack hooks sit under. Gable ends stay pale brick (the wall
// climbing on), everything else is shingles.
const ROOF0 = WALL + 1
for (let r = 0; r <= 3; r++) {
  const y = ROOF0 + r, za = BZ0 - 1 + r, zb = BZ1 + 1 - r
  for (let x = BX0; x <= BX1; x++) {
    if (za === zb) { piece('roof_cap', x, y, za, 1); continue }
    piece('roof_slope', x, y, za, 2); piece('roof_slope', x, y, zb, 0)
    const gableEnd = x === BX0 || x === BX1
    for (let z = za + 1; z < zb; z++) put(x, y, z, gableEnd ? MAT.PALE_BRICK : MAT.SHINGLES)
  }
}
// The drying rack (R3): a row of hooks under the front eave, empty.
for (let x = BX0; x <= BX1; x++) piece('hook', x, WALL, BZ0 - 1, 0)
// Inside: the cauldron and the chest along the west wall, jars on the shelf workaround (R1) along
// the east wall, a lantern hung from a hook over the middle of the room.
put(1, 1, 3, MAT.CAULDRON)
put(1, 1, 2, MAT.CHEST)
piece('hook', DX, 3, 3, 0); put(DX, 2, 3, MAT.MANA_LANTERN)
const jars: [number, number][] = [[2, MAT.POT], [3, MAT.POT_SEEDED], [4, MAT.POT_BLOOM]]
for (const [z, jar] of jars) { piece('half_slab', 5, 1, z, 0); put(5, 2, z, jar) }

// ── the herb garden ──────────────────────────────────────────────────────────────────────────
// A fence perimeter with a gate lined up on the back door, beds of the four element herbs along
// the west fence line, a path from the gate to a lantern at the far end, a bench to sit by the beds.
for (let x = BX0; x <= GX1; x++) piece(x === DX ? 'gate' : 'fence', x, 1, GZ0, 0)  // front (the gate)
for (let x = BX0; x <= GX1; x++) piece('fence', x, 1, GZ1, 0)                      // back
for (let z = GZ0 + 1; z < GZ1; z++) { piece('fence', BX0, 1, z, 0); piece('fence', GX1, 1, z, 0) }  // sides
const beds: [number, number][] = [[8, MAT.VIOLETBLOOM], [9, MAT.STORMGRASS], [10, MAT.ROOTVINE], [11, MAT.TIDEPETAL]]
for (const [z, herb] of beds) { put(1, 0, z, MAT.GARDEN_BED_GOLDWOOD); put(1, 1, z, herb) }
put(1, 0, 12, MAT.GARDEN_BED_GOLDWOOD)     // a fifth bed, freshly turned, waiting on the next herb
for (let z = GZ0; z <= 12; z++) put(DX, 0, z, MAT.PATH)
piece('post_dawnwood', DX, 1, 12, 0); put(DX, 2, 12, MAT.MANA_LANTERN)
piece('bench', DX + 1, 1, 9, 0)

const bp = makeBlueprint('yarrow_apothecary', "Yarrow's Apothecary", cells, pieces)
const problems = blueprintProblems(bp)
if (problems.length) { console.error('invalid:\n  - ' + problems.join('\n  - ')); process.exit(1) }
if (bp.w > 9 || bp.d > 14) { console.error(`too big: ${bp.w}x${bp.d} exceeds the 9x14 lot`); process.exit(1) }
const out = join(process.cwd(), 'src/app/shimmer/data/blueprints/yarrow_apothecary.json')
writeFileSync(out, serializeBlueprint(bp))
console.log(`✅ ${bp.id}: ${bp.w}x${bp.h}x${bp.d}, ${bp.cells.length / 4} blocks, ${bp.pieces?.length ?? 0} pieces → ${out}`)
