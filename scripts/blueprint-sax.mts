// SAX'S STONERY — Saxifrage's stonewright's yard, the second Moonwell trade building as a blueprint.
//
// Run: npx tsx scripts/blueprint-sax.mts   → writes src/app/shimmer/data/blueprints/sax_stonery.json
//
// Same door into the same disk as `blueprint-hazel.mts`: `makeBlueprint` → `blueprintProblems` →
// `serializeBlueprint`, and the file the worktable can open afterwards. Read Hazel's header for why a
// script and not the worktable; this one exists for the second reason too — a second trade, a second
// material family, a second REACH list. Stone is the family the world already draws right, so this
// building leans on it and the reaches are about what a stone YARD wants, not about the shell.
//
// Canon (characters/moonwell-folk.md): Sax, stonewright — wants cooled-cloud stone and mana crystal;
// gives paving, low walls, the Moonwell's rim, "anything that has to hold weight and hold still".
// "Named for the small flower that lives in the cracks of rock and splits it slowly; the gentlest of
// the five and the one who moves the heaviest things. Says little." The look and the yard are Jin's;
// nothing here says a word about Sax beyond that.
//
// The look: a squat stone-brick workshop on a cut-stone base course with pale-brick quoins, the
// eaves of a shingle roof facing the visitor (Hazel shows a gable end; the two must not read as one
// building twice), a wooden doorway with a doorstep stair under the eave, and a walled WORK YARD to
// the east: the stonecutter by the side door, a 4×4 paving sampler in four stones (the want-list, in
// stone), a squared stack of cut stone, a rubble heap, a cut-stone low wall on two sides (Sax's own
// trade, standing as the fence), and a lantern on a stone pier at the yard mouth.
//
// Footprint 14 (x) × 9 (z) including the yard; the FRONT (the door) is the z=0 side.
//
// ── ★★ THE REACH LIST (what the hand went for and did not find) ──────────────────────────────
// R1  A STONE-VARIANT PIECE HAS NO COLOUR. `piece-mesh.ts` tints by `TINT[def.id]`, keyed on the
//     BASE ids only, so `post_cutstone`, `half_slab_cutstone`, `bench_cutstone` all fall to the
//     `0x999999` fallback. It happens to sit one shade off `CUT_STONE` (0x9aa0a4), which is why the
//     piers and the wall cap here still read as stone — by accident, not by design. Used: the
//     cutstone variants anyway, because the accident is the right colour. → tint variants by
//     material (the same table the blocks use), so `roof_slope_cutstone` is grey and `_sandstone`
//     is warm instead of everything-not-wood being one fallback.
// R2  A SLAB ROOF. Canon's stonewright would roof in stone; `roof_slope` is one shape in seven
//     materials but the FILL between the slopes is a block, and there is no stone roofing block —
//     `SHINGLES` is "dark weathered wood, laid in courses". Used: shingles + wood slopes, a timber
//     roof on a stone house, which is honest enough. → a `SLATE`/stone-slab roofing block.
// R3  A STONE STACK THAT READS AS STACKED. Cut stone blocks two high are a cut-stone CUBE; nothing
//     says "these are separate dressed blocks waiting to be laid". Used: a 2×2×2 of CUT_STONE with a
//     half slab on top to break the silhouette. → a `stone_stack` block (courses drawn on the faces,
//     like the plank-stack Hazel wants for R6) or a per-face variant of CUT_STONE.
// R4  A HEAP. `RUBBLE` is a cube, and a rubble HEAP is the yard's most legible signal. Used: a 2×2
//     of RUBBLE with one on top — a stepped cube. → a `rubble_heap` piece (a passable mound, or a
//     half-height rubble like the half slab).
// R5  A LOW WALL AS A PIECE. Sax GIVES low walls; here the yard's low wall is a row of full blocks
//     (one block high reads as a wall; a half slab alone reads as a kerb). Used: CUT_STONE blocks
//     at y=1, with a half-slab cap only on the front run. → a `wall` piece (Minecraft's: a post
//     with arms that connect, like the fence, but stone-thick and cappable).
// R6  A SIGN. Same as Hazel's R5 — nothing says whose door this is.
// R7  THE WANT-LIST IN STONE. Canon says Sax wants COOLED-CLOUD STONE and MANA CRYSTAL. There is
//     `PACKED_CLOUD` (the sky-island substrate, not placeable as a trade good) and no crystal block
//     at all, so the yard cannot show what Sax is waiting for. Used: nothing — the sampler shows
//     what Sax GIVES (four pavings), not what Sax wants. → a placeable `CLOUD_STONE` and a
//     `MANA_CRYSTAL` block, so the want-list can stand in the yard the way Hazel's plank stack does.
// R8  THE PLINTH IS BLOCKS-ONLY. `stamps.ts` fills under bottom-layer BLOCKS; a bench or a stair
//     placed at y=0 gets no plinth, so on a stepped pad it can float. Not hit on the preview pad
//     (flat); written down because the doorstep stair and the bench both sit at y=0.
// (What was NOT missing: the whole stone family — cut stone, stone brick, pale brick, sandstone,
//  mossy/cracked — shingles, stonecutter, rubble, path, lantern, table, chest, doorway, door,
//  window+shutter, post/half_slab/bench in stone, stair, hook. The shell vocabulary is enough; the
//  yard vocabulary is where the reaches are.)
// ⚠ 2026-09-13: `doorway` became a 3×3 FRAME (posts + head around a 1×2 opening; see pieces.ts).
// This script still authors the old 1×3 slot, so re-running it would set a frame three cells wide
// where a slot was and overlap the wall. The five old placements were dropped from the JSONs by
// hand; Alex is rebuilding the buildings in the editor, which is the artefact from here on.
import { writeFileSync } from 'fs'
import { join } from 'path'
import { makeBlueprint, blueprintProblems, serializeBlueprint, type BlueprintCell } from '../src/app/shimmer/voxel/blueprints'
import type { Placement, Rotation } from '../src/app/shimmer/voxel/pieces'
import { MAT } from '../src/app/shimmer/voxel/depth'

// The house: x 0..6, walls z 1..5 (z 0 and z 6 are the eave rows). The yard: x 7..13, z 0..8.
// The back lot behind the house: x 0..6, z 6..8. Total 14 × 9. Front = z 0.
const BW = 7, BX0 = 0, BX1 = BW - 1        // house x span
const BZ0 = 1, BZ1 = 5                     // house wall z span (eaves at BZ0-1 and BZ1+1)
const WALL = 3                             // y 1..3 wall rows; y 0 floor
const YX0 = 7, YX1 = 13, YZ1 = 8           // yard x span, back edge
const cells: BlueprintCell[] = []
const pieces: Placement[] = []
const put = (x: number, y: number, z: number, m: number) => cells.push({ x, y, z, m })
const cut = (x: number, y: number, z: number) => { const i = cells.findIndex(c => c.x === x && c.y === y && c.z === z); if (i >= 0) cells.splice(i, 1) }
const piece = (pieceId: string, x: number, y: number, z: number, rot: Rotation = 0) => pieces.push({ pieceId, x, y, z, rot })

// ── the house ────────────────────────────────────────────────────────────────────────────────
// Floor: cut stone throughout (a stonewright does not floor in wood).
for (let z = BZ0; z <= BZ1; z++) for (let x = BX0; x <= BX1; x++) put(x, 0, z, MAT.CUT_STONE)
// Walls: a cut-stone base course, stone-brick body, pale-brick quoins on the four corners. Cut stone
// and stone brick differ by one shade (crossings.ts learned this on 09-11), so the contrast that
// READS is the pale quoin, not the base course; the base course is there for the plinth to match.
const isCorner = (x: number, z: number) => (x === BX0 || x === BX1) && (z === BZ0 || z === BZ1)
for (let y = 1; y <= WALL; y++) {
  for (let x = BX0; x <= BX1; x++) for (const z of [BZ0, BZ1]) put(x, y, z, isCorner(x, z) ? MAT.PALE_BRICK : y === 1 ? MAT.CUT_STONE : MAT.STONE_BRICK)
  for (let z = BZ0 + 1; z < BZ1; z++) for (const x of [BX0, BX1]) put(x, y, z, y === 1 ? MAT.CUT_STONE : MAT.STONE_BRICK)
}
// Age on the base course — two mossy blocks on the side that faces the yard, where water pools.
cut(BX1, 1, 2); put(BX1, 1, 2, MAT.MOSSY_CUT_STONE)
cut(BX0, 1, 4); put(BX0, 1, 4, MAT.MOSSY_CUT_STONE)
// The front: a wooden doorway in the middle (timber frame in a stone wall is the honest read; the
// cutstone doorway would be grey-on-grey, R1), a window either side, a doorstep stair under the eave.
const DX = 3
cut(DX, 1, BZ0); cut(DX, 2, BZ0); cut(DX, 3, BZ0); piece('doorway', DX, 1, BZ0, 0)
piece('stair', DX, 0, BZ0 - 1, 2)          // rot 2: the tall step is at +z, you climb toward the door
for (const x of [1, 5]) { cut(x, 1, BZ0); cut(x, 2, BZ0); piece('window', x, 1, BZ0, 0) }
// West wall: a shuttered window. East wall: the yard door, opening at the stonecutter.
cut(BX0, 1, 3); cut(BX0, 2, 3); piece('window', BX0, 1, 3, 1)
cut(BX0, 2, 2); cut(BX0, 2, 4); piece('shutter', BX0, 2, 2, 1); piece('shutter', BX0, 2, 4, 1)
cut(BX1, 1, 3); cut(BX1, 2, 3); piece('door', BX1, 1, 3, 1)
// Roof: ridge along x, so the EAVES face the front (Hazel shows her gable end; two buildings that
// read as the same building are one building). Row 0's slopes stand one cell outside the front and
// back walls — the overhang and the shadow line. The fill between slopes is shingles (R2), except
// at the two gable ends, where the stone wall keeps climbing as a stone gable.
const ROOF0 = WALL + 1
for (let r = 0; r <= 3; r++) {
  const y = ROOF0 + r, za = BZ0 - 1 + r, zb = BZ1 + 1 - r
  for (let x = BX0; x <= BX1; x++) {
    if (za === zb) { piece('roof_cap', x, y, za, 1); continue }
    piece('roof_slope', x, y, za, 2); piece('roof_slope', x, y, zb, 0)   // rot 2 faces -z (front), rot 0 faces +z
    const gableEnd = x === BX0 || x === BX1
    for (let z = za + 1; z < zb; z++) put(x, y, z, gableEnd ? MAT.STONE_BRICK : MAT.SHINGLES)
  }
}
// Inside: the table and the chest against the back wall, a lantern hung from a hook.
put(1, 1, 4, MAT.CRAFT_TABLE); put(5, 1, 4, MAT.CHEST)
piece('hook', 3, 3, 4, 0); put(3, 2, 4, MAT.MANA_LANTERN)

// ── the yard ─────────────────────────────────────────────────────────────────────────────────
// Paving: path over the whole lot, and a 4×4 sampler of the four pavings Sax lays (what Sax GIVES,
// since what Sax WANTS has no block yet — R7).
for (let z = 0; z <= YZ1; z++) for (let x = YX0; x <= YX1; x++) put(x, 0, z, MAT.PATH)
for (let z = BZ1 + 1; z <= YZ1; z++) for (let x = BX0; x <= BX1; x++) put(x, 0, z, MAT.PATH)   // the back lot
const sampler: [number, number, number][] = [[9, 2, MAT.STONE_BRICK], [11, 2, MAT.PALE_BRICK], [9, 4, MAT.SANDSTONE], [11, 4, MAT.CUT_STONE]]
for (const [sx, sz, m] of sampler) for (let z = sz; z < sz + 2; z++) for (let x = sx; x < sx + 2; x++) { cut(x, 0, z); put(x, 0, z, m) }
// ★ THE KERB (second pass, 09-12). The yard's bottom layer lands one course above grade and the
// plinth under it is the cell's own material — so a PATH yard stood on a wall of PATH SIDES, which
// draw as dirt: a paved deck on a mud plinth. The perimeter ring is cut stone instead, so every
// plinth face a visitor can see is dressed stone. The Moonwell's rim is Sax's; so is this one.
for (let z = 0; z <= YZ1; z++) for (let x = BX0; x <= YX1; x++) {
  const kerb = x === YX1 || z === YZ1 || (z === 0 && x >= YX0) || (x === BX0 && z > BZ1)
  if (kerb) { cut(x, 0, z); put(x, 0, z, MAT.CUT_STONE) }
}
// The stonecutter, one step out of the side door.
put(YX0 + 1, 1, 3, MAT.STONECUTTER)
// The low wall (R5): stone brick one block high along the back and the east side, capped with a
// cut-stone half slab (stone brick is a shade darker than the cut-stone stack, so the wall and the
// stack stop reading as one lump), two mossy blocks in it; along the front a half-slab kerb between
// a lantern pier and the corner pier, with the yard mouth open next to the house.
for (let x = BX0; x <= YX1; x++) { put(x, 1, YZ1, MAT.STONE_BRICK); piece('half_slab_cutstone', x, 2, YZ1, 0) }
for (let z = 1; z < YZ1; z++) { put(YX1, 1, z, MAT.STONE_BRICK); piece('half_slab_cutstone', YX1, 2, z, 0) }
cut(YX1, 1, 5); put(YX1, 1, 5, MAT.MOSSY_STONE_BRICK)
cut(4, 1, YZ1); put(4, 1, YZ1, MAT.MOSSY_STONE_BRICK)
piece('post_cutstone', 9, 1, 0, 0); put(9, 2, 0, MAT.MANA_LANTERN)   // the lantern pier at the yard mouth
for (let x = 10; x <= 12; x++) piece('half_slab_cutstone', x, 1, 0, 0)
piece('post_cutstone', YX1, 1, 0, 0)
// The stack (R3): a squared 2×2×2 of cut stone against the east wall, a half slab on top.
for (let y = 1; y <= 2; y++) for (let z = 6; z <= 7; z++) for (let x = 11; x <= 12; x++) put(x, y, z, MAT.CUT_STONE)
piece('half_slab_cutstone', 12, 3, 6, 0)
// The rubble heap (R4): a 2×2 with one on top, and a stray block, by the stonecutter's back.
for (let z = 6; z <= 7; z++) for (let x = 8; x <= 9; x++) put(x, 1, z, MAT.RUBBLE)
put(8, 2, 7, MAT.RUBBLE); put(10, 1, 7, MAT.RUBBLE)
// A second, smaller stack of stone brick behind the house, and a bench in the yard by the side door.
put(2, 1, 7, MAT.STONE_BRICK); put(3, 1, 7, MAT.STONE_BRICK); put(2, 2, 7, MAT.STONE_BRICK)
piece('bench_cutstone', YX0, 1, 1, 1)

const bp = makeBlueprint('sax_stonery', "Sax's Stonery", cells, pieces)
const problems = blueprintProblems(bp)
if (problems.length) { console.error('invalid:\n  - ' + problems.join('\n  - ')); process.exit(1) }
if (bp.w > 14 || bp.d > 9) { console.error(`too big: ${bp.w}x${bp.d} exceeds the 14x9 lot`); process.exit(1) }
const out = join(process.cwd(), 'src/app/shimmer/data/blueprints/sax_stonery.json')
writeFileSync(out, serializeBlueprint(bp))
console.log(`✅ ${bp.id}: ${bp.w}x${bp.h}x${bp.d}, ${bp.cells.length / 4} blocks, ${bp.pieces?.length ?? 0} pieces → ${out}`)
