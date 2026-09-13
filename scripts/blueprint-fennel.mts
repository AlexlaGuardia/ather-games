// FENNEL'S KITCHEN — Fennel's cookhouse, the fifth Moonwell trade building as a blueprint.
//
// Run: npx tsx scripts/blueprint-fennel.mts   → src/app/shimmer/data/blueprints/fennel_kitchen.json
//
// Same door into the same disk as `blueprint-hazel.mts` / `-sax` / `-yarrow` / `-mallow`:
// `makeBlueprint` → `blueprintProblems` → `serializeBlueprint`, so a scripted building and an
// editor-saved one are the same artefact and the placer cannot tell them apart.
//
// Canon (`characters/moonwell-folk.md`): Fennel is the COOK — "warm, loud, feeds everyone including
// the spirits, who come when Fennel whistles. Wants whatever is in season. The Glade's kitchen is
// where the folk gather, which is how the player learns the five are a household." So this is not
// a shop with a counter; it is a HALL. The front is OPEN — no wall, just posts under the eave, the
// long table right there in the mouth of it, benches both sides, the hearth on the back wall with
// its chimney through the roof. You do not go in to buy; you sit down.
//
// The look: a stone-floored open hall, dawnwood posts, stone-brick back and side walls on a cut-
// stone base course, an eaves-front shingle roof (ridge along x, like Yarrow — the open front reads
// as a deep porch under the eave), the HEARTH as a stone-brick alcove with a chimney stack breaking
// the ridge. West end: the work side (cauldron, pots, chest, firewood). East end: the eating side
// (the long table, benches). Out back through a shut door, two garden beds and the compost (a
// rubble heap is the nearest thing) — what is in season is growing right there.
//
// Footprint 12 (x) × 9 (z); the FRONT (open) is the z=0 side. Placed at rot 1 on the street it
// becomes 9 × 12 with the open front facing the road (east).
//
// ── ★★ THE REACH LIST (what the hand went for and did not find) ──────────────────────────────
// R1  A HEARTH / FIRE / OVEN. ✅ HALF CLOSED 09-13: `HEARTH` block (registry emit 12, warm; fire
//     texels emissive; `tiles.ts` › paintHearth) now sits in the firebox where the MANA_LANTERN
//     was. Was: the building's whole identity is a fire and there was no fire block; a cook lit by
//     mana-blue read as a placeholder. ✅ OTHER HALF CLOSED 09-13 (later): `OVEN` block (emit 6,
//     half the hearth; `tiles.ts` › paintOven — arched sooted mouth, banked coals, domed top with
//     a smoke hole) on the back wall past the cauldron. R1 is whole.
// R2  A TABLE. ✅ CLOSED 09-13: `table` piece (full-cell, top at y+1, four legs; wood/stone
//     variants), a run of six down the eating side. Was: `half_slab` at y=1 — knee-high, a low
//     bench, not a table you sit at. Same close lands in Hazel (R3) and Yarrow (R4).
// R3  FOOD. Nothing to put ON the table: no bread, bowl, pie, or plate. The table is bare and the
//     jar states (POT/POT_SEEDED/POT_BLOOM) are the only "stuff" the world has. → a few food blocks
//     or a `platter` piece; the want-list wants to be visible as a spread.
// R4  A SIGN. Fifth building, same R as the other four.
// R5  SMOKE. ✅ CLOSED 09-13 (later): `voxel3d/smoke.ts` + `smoke-sources.ts` — every HEARTH /
//     OVEN in the columns around the camera smokes from where its stack OPENS (the flue walk
//     finds this chimney's cap through the lintel + mantel + column; the oven smokes from its own
//     top). Engine side, keyed on the block, so a keeper's hand-placed hearth smokes too. Was: a
//     chimney with nothing coming out of it is a stone column.
// (What was NOT missing: footing, cut stone + stone brick + mossy, dawnwood posts, shingles,
//  roof_slope/cap, bench, half_slab, hook, doorway+door (the new 3×3 frame), window+shutter,
//  CAULDRON, CHEST, TIMBER_STACK, MANA_LANTERN, the jar states, garden beds, RUBBLE, PATH.)
// 09-13 later: HEARTH block + `table` piece landed (R1 half, R2 whole) — see the two lines above.
import { writeFileSync } from 'fs'
import { join } from 'path'
import { makeBlueprint, blueprintProblems, serializeBlueprint, type BlueprintCell } from '../src/app/shimmer/voxel/blueprints'
import type { Placement, Rotation } from '../src/app/shimmer/voxel/pieces'
import { MAT } from '../src/app/shimmer/voxel/depth'

// The hall: x 0..11, walls z 1..6 (z 0 and z 7 are the eave rows). Garden strip z 8. Total 12 × 9.
const BX0 = 0, BX1 = 11
const BZ0 = 1, BZ1 = 6                      // BZ0 is the OPEN front line (posts only); BZ1 the back wall
const WALL = 3                              // y 1..3 wall rows; y 0 floor
const cells: BlueprintCell[] = []
const pieces: Placement[] = []
const put = (x: number, y: number, z: number, m: number) => cells.push({ x, y, z, m })
const cut = (x: number, y: number, z: number) => { const i = cells.findIndex(c => c.x === x && c.y === y && c.z === z); if (i >= 0) cells.splice(i, 1) }
const piece = (pieceId: string, x: number, y: number, z: number, rot: Rotation = 0) => pieces.push({ pieceId, x, y, z, rot })

// ── the hall ─────────────────────────────────────────────────────────────────────────────────
// Floor: cut stone throughout (a kitchen floor gets wet), one row of it out under the eave too.
for (let z = BZ0 - 1; z <= BZ1; z++) for (let x = BX0; x <= BX1; x++) put(x, 0, z, MAT.CUT_STONE)
// Back and side walls: stone brick on a cut-stone base course; corners are posts. The front line
// (BZ0) is OPEN: posts at the corners and every third cell, nothing between them.
for (let y = 1; y <= WALL; y++) {
  for (let x = BX0 + 1; x < BX1; x++) put(x, y, BZ1, y === 1 ? MAT.CUT_STONE : MAT.STONE_BRICK)
  for (let z = BZ0 + 1; z < BZ1; z++) for (const x of [BX0, BX1]) put(x, y, z, y === 1 ? MAT.CUT_STONE : MAT.STONE_BRICK)
  for (const x of [BX0, BX1]) { piece('post_dawnwood', x, y, BZ0, 0); piece('post_dawnwood', x, y, BZ1, 0) }
  for (const x of [3, 6, 9]) piece('post_dawnwood', x, y, BZ0, 0)
}
// Age: a mossy brick low on each side wall where the eave drips.
cut(BX0, 2, 3); put(BX0, 2, 3, MAT.MOSSY_STONE_BRICK)
cut(BX1, 2, 4); put(BX1, 2, 4, MAT.MOSSY_STONE_BRICK)
// Side windows with shutters (Yarrow's convention).
for (const [x, rot] of [[BX0, 1], [BX1, 3]] as [number, Rotation][]) {
  cut(x, 1, 3); cut(x, 2, 3); piece('window', x, 1, 3, 1)
  cut(x, 2, 2); cut(x, 2, 4); piece('shutter', x, 2, 2, rot); piece('shutter', x, 2, 4, rot)
}
// The back door to the garden: the NEW 3×3 doorway frame around a 1×2 opening, shut leaf in it.
const DX = 8
for (let x = DX - 1; x <= DX + 1; x++) for (let y = 1; y <= 3; y++) cut(x, y, BZ1)
piece('doorway', DX - 1, 1, BZ1, 0); piece('door', DX, 1, BZ1, 0)
// (The door stair went 2026-09-13: the buildings sink one so the floor is level with the ground — `placed.table.json` › sink — and a stair at y=0 would be a stepped hole in the path.)
// Roof: ridge along x, eaves front and back; row 0 stands one cell outside both wall lines. Gable
// ends are stone brick climbing on; the field is shingles.
const ROOF0 = WALL + 1
for (let r = 0; r <= 4; r++) {
  const y = ROOF0 + r, za = BZ0 - 1 + r, zb = BZ1 + 1 - r
  for (let x = BX0; x <= BX1; x++) {
    if (za === zb) { piece('roof_cap', x, y, za, 1); continue }
    piece('roof_slope', x, y, za, 2); piece('roof_slope', x, y, zb, 0)
    const gableEnd = x === BX0 || x === BX1
    for (let z = za + 1; z < zb; z++) put(x, y, z, gableEnd ? MAT.STONE_BRICK : MAT.SHINGLES)
  }
}
// ── the hearth (R1) ──────────────────────────────────────────────────────────────────────────
// A stone-brick alcove against the back wall, x 2..4: the HEARTH block at y=1 (its own firebox
// and fire — the alcove's cheeks hide its side mouths, the wall its back), a mantel row of cut
// stone at y=2, and a chimney column rising through the roof to one above the ridge.
const HX = 3
for (const x of [HX - 1, HX + 1]) { put(x, 1, BZ1 - 1, MAT.STONE_BRICK); put(x, 2, BZ1 - 1, MAT.STONE_BRICK) }
put(HX, 2, BZ1 - 1, MAT.CUT_STONE)                      // lintel over the firebox
put(HX, 1, BZ1 - 1, MAT.HEARTH)                          // the fire (R1 closed: warm, emit 12)
for (let x = HX - 1; x <= HX + 1; x++) put(x, 3, BZ1 - 1, MAT.CUT_STONE)   // mantel
for (let y = 4; y <= ROOF0 + 5; y++) {                   // chimney: through the roof, one above the ridge
  const i = cells.findIndex(c => c.x === HX && c.y === y && c.z === BZ1 - 1); if (i >= 0) cells.splice(i, 1)
  const j = pieces.findIndex(p => p.x === HX && p.y === y && p.z === BZ1 - 1); if (j >= 0) pieces.splice(j, 1)
  put(HX, y, BZ1 - 1, MAT.STONE_BRICK)
}
put(HX, ROOF0 + 5, BZ1 - 1, MAT.CRACKED_STONE_BRICK)     // the top course, fire-cracked
// Firewood by the hearth, the cauldron on the fire's other side, the chest in the corner.
put(1, 1, BZ1 - 1, MAT.TIMBER_STACK)
put(HX + 2, 1, BZ1 - 1, MAT.CAULDRON)
// The bread OVEN (R1's other half, closed 09-13 later): a dressed-stone dome against the back
// wall past the cauldron, at the hearth's level — its mouth lands at a two-block keeper's waist,
// which is where a bread oven's mouth is. A plinth would have put it at the head. The wall hides
// its back; every other side is a mouth (a block has no facing).
put(HX + 4, 1, BZ1 - 1, MAT.OVEN)
put(BX1 - 1, 1, BZ1 - 1, MAT.CHEST)
// The work side: a half-slab counter along the west wall with the jars on it (Yarrow's R1
// workaround), hooks over it for hung pans.
for (let z = 2; z <= 4; z++) piece('half_slab', 1, 1, z, 0)
put(1, 2, 2, MAT.POT); put(1, 2, 3, MAT.POT_SEEDED); put(1, 2, 4, MAT.POT_BLOOM)
for (let z = 2; z <= 4; z++) piece('hook', BX0, 3, z, 1)
// ── the long table (R2) ─────────────────────────────────────────────────────────────────────
// ★ ROOM TO WALK (Alex, 2026-09-13: "the inside doesn't leave room for even walking in"). The
// hall is four deep (z 2..5) and the first cut filled all four rows — bench, table, bench, then
// the wall furniture — so there was no aisle at all. Now: FOUR tables (x 6..9) with a bench on
// the FRONT side only. The whole back row z=4 is a clear aisle from the counter to the chest,
// the west end (x 1..5) is open floor in front of the hearth, and you walk in off the street
// and around the board instead of climbing over it.
for (let x = 6; x <= 9; x++) piece('table', x, 1, 3, 0)
for (let x = 6; x <= 9; x++) piece('bench', x, 1, 2, 2)
// A lantern hung over each end of the table.
for (const x of [6, 9]) { piece('hook', x, 3, 3, 0); put(x, 2, 3, MAT.MANA_LANTERN) }
// ── out back ─────────────────────────────────────────────────────────────────────────────────
// Two beds of what is in season and the heap, on a path from the back door.
put(DX, 0, BZ1 + 2, MAT.PATH)
put(DX - 2, 0, BZ1 + 2, MAT.GARDEN_BED_GOLDWOOD); put(DX - 2, 1, BZ1 + 2, MAT.ROOTVINE)
put(DX - 3, 0, BZ1 + 2, MAT.GARDEN_BED_GOLDWOOD); put(DX - 3, 1, BZ1 + 2, MAT.DAWNCAP)
put(DX + 2, 0, BZ1 + 2, MAT.RUBBLE)

const bp = makeBlueprint('fennel_kitchen', "Fennel's Kitchen", cells, pieces)
const problems = blueprintProblems(bp)
if (problems.length) { console.error('invalid:\n  - ' + problems.join('\n  - ')); process.exit(1) }
if (bp.w > 12 || bp.d > 9) { console.error(`too big: ${bp.w}x${bp.d} exceeds the 12x9 lot`); process.exit(1) }
const out = join(process.cwd(), 'src/app/shimmer/data/blueprints/fennel_kitchen.json')
writeFileSync(out, serializeBlueprint(bp))
console.log(`✅ ${bp.id}: ${bp.w}x${bp.h}x${bp.d}, ${bp.cells.length / 4} blocks, ${bp.pieces?.length ?? 0} pieces → ${out}`)
