// HAZEL'S CARPENTRY — the first Moonwell trade building, authored as a blueprint.
//
// Run: npx tsx scripts/blueprint-hazel.mts   → writes src/app/shimmer/data/blueprints/hazel_carpentry.json
//
// ★ WHY A SCRIPT AND NOT THE WORKTABLE: the pipeline is worktable → disk → stamp → world, and this
// file is a second door into the same disk — the same `makeBlueprint`, the same `blueprintProblems`,
// the same JSON the worktable can open and edit afterwards. It exists because Alex asked (09-11)
// "how our buildings get built, to see what building blocks to introduce next", and the honest way
// to find out is to build one and write down every reach that finds nothing. Those reaches are the
// REACH list below. They are the deliverable; the building is the instrument.
//
// Canon (characters/moonwell-folk.md): Hazel, carpenter — "steady hands, measures twice, talks to the
// wood"; wants planks stacked square, "a crooked stack is the only thing that makes Hazel sigh";
// makes furniture, storage, grown-and-jointed structures. The look and where it stands are Jin's.
//
// The look: a timber workshop — cut-stone footing, goldwood walls on dawnwood posts, a stepped shimmeroak gable, the
// sawmill and the table under the roof, a squared plank stack by the door (the want-list, in wood),
// a fenced yard with a gate.
//
// ── ★★ THE REACH LIST (what the hand went for and did not find) ──────────────────────────────
// R1  A TIMBER POST. Logs are raw material, not blocks (registry, 08-13 ruling), and `beam` is a
//     horizontal piece. A timber frame has no vertical member; the posts here are dawnwood PLANKS,
//     a colour standing in for a shape. → a `post` piece (1×1×1, full cell) or a placeable timber.
// R2  A ROOF FILL THAT READS AS ROOFING. `roof_slope` and `roof_cap` are the edges; the gable's mass
//     between them is planks, which read as WALL. → a shingle/thatch block (material, not shape).
// R3  A COUNTER. Hazel sells; canon puts the loop's close at a counter (Mallow's). A `half_slab` is
//     knee-high, a block is a wall. Here: fence + half_slab = 1.5, a workaround. → a `counter`/`table`
//     piece, half-height on top of a full cell, or a 1×2 piece.
// R4  SHELVES. Storage is Hazel's trade and there is nothing to put on a wall but a `hook`. →
//     a `shelf` piece (passable, wall-mounted like the shutter).
// R5  A SIGN / NAMEBOARD. Five trades in one glade and no way to say which door is whose without
//     walking in. → a `sign` piece (text is lark's; the board is a piece).
// R6  THE RAW STOCK. A carpenter's yard shows timber and the world cannot show a log. R1 again,
//     from the yard side: even if posts stay pieces, a LOG PILE wants the log as a placeable.
// R8  THE VALIDATOR LET A PIECE SIT INSIDE A BLOCK. `blueprintProblems` checked piece-vs-piece
//     only; the first draft's shutters were buried in wall planks and every guard stayed green.
//     Closed the same day: a solid piece cell that coincides with a block is now a problem.
// R7  GLASS. `window` is a frame; whether it glazes is the renderer's call — flagged, not counted.
// (What was NOT missing: footing, planks ×3, door, window+shutter, fence+gate, bench, lantern,
//  sawmill, crafting table, chest, stair, half slab, hook. The shell vocabulary is enough.)
import { writeFileSync } from 'fs'
import { join } from 'path'
import { makeBlueprint, blueprintProblems, serializeBlueprint, type BlueprintCell } from '../src/app/shimmer/voxel/blueprints'
import type { Placement, Rotation } from '../src/app/shimmer/voxel/pieces'
import { MAT } from '../src/app/shimmer/voxel/depth'

const W = 9, D = 7            // the house: x 0..8, z 0..6. Front (open) = z 0. Yard beyond z 6.
const WALL = 3                // y 1..3 are wall rows; y 0 is the footing/floor
const cells: BlueprintCell[] = []
const pieces: Placement[] = []
const put = (x: number, y: number, z: number, m: number) => cells.push({ x, y, z, m })
const piece = (pieceId: string, x: number, y: number, z: number, rot: Rotation = 0, open?: boolean) =>
  pieces.push(open ? { pieceId, x, y, z, rot, open } : { pieceId, x, y, z, rot })

// Footing + floor.
for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
  const edge = x === 0 || x === W - 1 || z === 0 || z === D - 1
  put(x, 0, z, edge ? MAT.CUT_STONE : MAT.PLANKS_GOLDWOOD)
}
// Posts (R1: planks standing in for a timber post) at the four corners and the front's two mid-posts.
const posts = [[0, 0], [W - 1, 0], [0, D - 1], [W - 1, D - 1]]
for (let y = 1; y <= WALL; y++) for (const [x, z] of posts) put(x, y, z, MAT.PLANKS_DAWNWOOD)
const cut = (x: number, y: number, z: number) => { const i = cells.findIndex(c => c.x === x && c.y === y && c.z === z); if (i >= 0) cells.splice(i, 1) }
// Walls: all four. ★ THE FRONT IS CLOSED (2026-09-11). The first cut left it open between posts —
// a carpenter works in the air — and on screen three dark bays in a pale wall read as the front
// having fallen in (Alex: "more like ruins than a building"). A shop reads as a shop through a door.
for (let y = 1; y <= WALL; y++) {
  for (let x = 1; x < W - 1; x++) { put(x, y, D - 1, MAT.PLANKS_GOLDWOOD); put(x, y, 0, MAT.PLANKS_GOLDWOOD) }
  for (let z = 1; z < D - 1; z++) { put(0, y, z, MAT.PLANKS_GOLDWOOD); put(W - 1, y, z, MAT.PLANKS_GOLDWOOD) }
}
// The front: a doorway in the middle, a window either side.
cut(4, 1, 0); cut(4, 2, 0); cut(4, 3, 0); piece('doorway', 4, 1, 0, 0)
cut(2, 1, 0); cut(2, 2, 0); piece('window', 2, 1, 0, 0)
cut(6, 1, 0); cut(6, 2, 0); piece('window', 6, 1, 0, 0)
// Openings: a window each side with shutters, the door on the east wall to the yard.
cut(0, 1, 3); cut(0, 2, 3); piece('window', 0, 1, 3, 1)
cut(0, 2, 2); cut(0, 2, 4); piece('shutter', 0, 2, 2, 1); piece('shutter', 0, 2, 4, 1)   // shutters need their own cells (R8)
cut(W - 1, 1, 3); cut(W - 1, 2, 3); piece('window', W - 1, 1, 3, 1)
cut(W - 1, 1, 5); cut(W - 1, 2, 5); piece('door', W - 1, 1, 5, 1)
// Stepped gable (R2: the fill between the slopes is planks and reads as wall).
// ★ EAVES + DARK GABLE ENDS (2026-09-11). Row 0's slopes stand one cell OUTSIDE the side walls, so
// the roof overhangs like a roof and the wall top has a shadow line; the gable-end triangles are
// dawnwood (the darkest plank) so the roof mass reads as roof where it shows — the same-colour
// triangle over the wall was half of the ruin read (R2 stands: this is a colour, not a roofing block).
const ROOF0 = WALL + 1
for (let r = 0; r <= 5; r++) {
  const y = ROOF0 + r, xa = r - 1, xb = W - r
  for (let z = 0; z < D; z++) {
    if (xa === xb) { piece('roof_cap', xa, y, z, 0); continue }
    piece('roof_slope', xa, y, z, 3); piece('roof_slope', xb, y, z, 1)
    const end = z === 0 || z === D - 1
    for (let x = xa + 1; x < xb; x++) put(x, y, z, end ? MAT.PLANKS_DAWNWOOD : MAT.PLANKS_SHIMMEROAK)
  }
}
// Inside: the sawmill and the table under the roof, a chest, a lantern hung from a hook.
put(2, 1, 4, MAT.SAWMILL); put(6, 1, 4, MAT.CRAFT_TABLE); put(1, 1, 5, MAT.CHEST)
piece('hook', 4, 3, 3, 0); put(4, 2, 3, MAT.MANA_LANTERN)
// The counter (R3: fence + half slab = a 1.5-high workaround), across the front behind the posts.
for (const x of [1, 2, 6, 7]) { piece('fence', x, 1, 1, 0); piece('half_slab', x, 2, 1, 0) }
piece('bench', 4, 1, 5, 0)
// The yard: a squared stack of goldwood planks by the door (the want-list, stacked square), a fence and a gate.
// The stack stands against the yard's far fence, so the door opens onto path, not into it.
for (let y = 1; y <= 2; y++) for (let z = 4; z <= 5; z++) for (let x = W + 2; x <= W + 3; x++) put(x, y, z, MAT.PLANKS_GOLDWOOD)
for (let z = 3; z <= 6; z++) for (let x = W; x <= W + 3; x++) put(x, 0, z, MAT.PATH)
for (let x = W; x <= W + 3; x++) { piece('fence', x, 1, 6, 0); if (x !== W + 1) piece('fence', x, 1, 3, 0); else piece('gate', x, 1, 3, 0) }

const bp = makeBlueprint('hazel_carpentry', "Hazel's Carpentry", cells, pieces)
const problems = blueprintProblems(bp)
if (problems.length) { console.error('invalid:\n  - ' + problems.join('\n  - ')); process.exit(1) }
const out = join(process.cwd(), 'src/app/shimmer/data/blueprints/hazel_carpentry.json')
writeFileSync(out, serializeBlueprint(bp))
console.log(`✅ ${bp.id}: ${bp.w}x${bp.h}x${bp.d}, ${bp.cells.length / 4} blocks, ${bp.pieces?.length ?? 0} pieces → ${out}`)
