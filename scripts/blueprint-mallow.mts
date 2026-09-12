// MALLOW'S SHOP — the general store, second Moonwell trade building, authored as a blueprint.
//
// Run: npx tsx scripts/blueprint-mallow.mts   → writes src/app/shimmer/data/blueprints/mallow_shop.json
//
// Same door into the disk as `blueprint-hazel.mts` (read that header for WHY a script): the same
// `makeBlueprint`, the same `blueprintProblems`, the same JSON the worktable can open afterwards.
//
// Canon (characters/moonwell-folk.md): Mallow, shopkeeper — soft-spoken, remembers everything the
// keeper ever sold; wants a ROTATING list of anything, the widest want-list in the glade; gives
// general goods and Marks for what is brought; "the counter where the loop closes". The look is
// Jin's; nothing else about Mallow is invented here.
//
// The look: an EAVE-FRONT shop, deliberately not Hazel's gable-front twin. The roof's ridge runs
// side to side, and its front pitch keeps going past the wall, over a stone-floored porch, down to
// a row of posts at the road — one unbroken 45° catslide from the ridge to the awning edge. Under
// it, in the front wall itself, the counter: a five-bay opening with fence + half slab in the wall
// plane, closed shutter leaves either side, a row of hooks above it for hung goods, the door to
// the right with a lantern hung beside it, a bench under the window. Cut-stone footing, goldwood
// walls on dawnwood posts, dawnwood gable ends, shingle roof. Inside: chests along the back wall
// (the stock), pots in the corners, a lantern over the shop floor. This building stands where the
// road arrives, so the front (z = 0) is the side that matters and everything faces it.
//
// ── ★★ THE REACH LIST (what the hand went for and did not find) ──────────────────────────────
// Numbered on from Hazel's list (R1–R8 there; R1, R2, R8 closed). Same convention: what was
// reached for, what stands in for it.
// R3  A COUNTER — still open. Fence + half_slab in the wall plane = 1.5 high, five bays wide.
//     The fence's derived arms grow toward the wall cells beside it, which reads as a rail under
//     the slab. → a `counter` piece (a full cell with a half on top, or a 1×2 piece).
// R4  SHELVES — still open. Mallow sells everything and the only wall-mounted thing is a hook.
//     Stock is chests on the floor and one on top of another. → a `shelf` piece.
// R5  A SIGN — still open, and it is THIS building's reach more than any other's: a shop with no
//     sign. Nothing here spells anything with blocks (ruled out). → a `sign` piece; text is lark's.
// R9  HUNG GOODS. A hook row exists; the only thing that hangs from a hook is a lantern. A shop's
//     hooks want sacks, bundles, a coil of rope, a hanging pot — a passable "hung item" block or
//     piece that draws BELOW a hook. Here the hooks over the counter hang empty (which at least
//     reads as "bring me something"), and the door hook holds a lantern.
// R10 AN AWNING THAT IS NOT A ROOF. The porch cover is `roof_slope` on posts because that is the
//     only sloped surface. It works — but it is shingled timber, not cloth, and a market awning
//     wants a canvas/cloth material (a colour, not a shape — R2's family).
// R11 AN OPEN SHUTTER THAT PROPS UP, NOT OUT. `open: true` swings a shutter 90° about its hinge
//     edge — a sideways leaf. A shopfront's shutter lifts to become the awning. Left CLOSED here
//     so the leaves read as shutters flanking the counter, not as fins.
// R12 A ROOF CAP ON AN EVEN SPAN. The house is 6 deep so the roof can overhang front AND back
//     inside the 9-cell footprint; that makes the ridge two slopes meeting back to back with no
//     `roof_cap` row. Reads as a ridge; the cap piece is for odd spans only.
// R13 A STEP. The porch floor is one block proud of the road (the stamp's plinth). A `stair`
//     would do it but a stair at every bay is a staircase; a one-block-deep `step`/kerb, or a
//     half_slab at grade in front of the porch, is what the entrance wants. Left as the plinth.
// (What was NOT missing: footing, planks ×3, post, doorway + door that opens, window + shutter,
//  fence, half slab, hook, bench, lantern, chest, pot, shingles, roof slopes.)
// ⚠ 2026-09-13: `doorway` became a 3×3 FRAME (posts + head around a 1×2 opening; see pieces.ts).
// This script still authors the old 1×3 slot, so re-running it would set a frame three cells wide
// where a slot was and overlap the wall. The five old placements were dropped from the JSONs by
// hand; Alex is rebuilding the buildings in the editor, which is the artefact from here on.
import { writeFileSync } from 'fs'
import { join } from 'path'
import { makeBlueprint, blueprintProblems, serializeBlueprint, type BlueprintCell } from '../src/app/shimmer/voxel/blueprints'
import type { Placement, Rotation } from '../src/app/shimmer/voxel/pieces'
import { MAT } from '../src/app/shimmer/voxel/depth'

const W = 13                  // x 0..12
const Z0 = 2, Z1 = 7          // the house: z 2..7 (6 deep). Porch z 0..1. Back overhang z 8.
const WALL = 4                // y 1..4 wall rows; y 0 footing/floor. ★ Four, not Hazel's three: the
                              // first cut's awning eave sat 3 over the porch and from the road the
                              // wall was a dark strip under the roof — "a roof on a stone platform".
const cells: BlueprintCell[] = []
const pieces: Placement[] = []
const put = (x: number, y: number, z: number, m: number) => cells.push({ x, y, z, m })
const cut = (x: number, y: number, z: number) => { const i = cells.findIndex(c => c.x === x && c.y === y && c.z === z); if (i >= 0) cells.splice(i, 1) }
const piece = (pieceId: string, x: number, y: number, z: number, rot: Rotation = 0, open?: boolean) =>
  pieces.push(open ? { pieceId, x, y, z, rot, open } : { pieceId, x, y, z, rot })

// ── Footing + floor. Cut-stone ring under the walls, plank floor inside, a stone porch in front.
for (let z = Z0; z <= Z1; z++) for (let x = 0; x < W; x++) {
  const edge = x === 0 || x === W - 1 || z === Z0 || z === Z1
  put(x, 0, z, edge ? MAT.CUT_STONE : MAT.PLANKS_GOLDWOOD)
}
for (let z = 0; z < Z0; z++) for (let x = 0; x < W; x++) put(x, 0, z, MAT.CUT_STONE)

// ── Walls, all four, goldwood; dawnwood posts at the house corners.
for (let y = 1; y <= WALL; y++) {
  for (let x = 1; x < W - 1; x++) { put(x, y, Z0, MAT.PLANKS_GOLDWOOD); put(x, y, Z1, MAT.PLANKS_GOLDWOOD) }
  for (let z = Z0 + 1; z < Z1; z++) { put(0, y, z, MAT.PLANKS_GOLDWOOD); put(W - 1, y, z, MAT.PLANKS_GOLDWOOD) }
  for (const [x, z] of [[0, Z0], [W - 1, Z0], [0, Z1], [W - 1, Z1]]) piece('post_dawnwood', x, y, z, 0)
}

// ── The shopfront (z = Z0, outside face toward z = 0).
// The counter: a five-bay opening x 2..6, three high, fence + half slab in the wall plane (R3).
// The lintel row (y = WALL) stays above it.
for (let x = 2; x <= 6; x++) { cut(x, 1, Z0); cut(x, 2, Z0); cut(x, 3, Z0); piece('fence', x, 1, Z0, 0); piece('half_slab', x, 2, Z0, 0) }
// Closed shutter leaves either side of the counter, three high, hung on the outside face (R11).
for (const x of [1, 7]) for (const y of [1, 2, 3]) { cut(x, y, Z0); piece('shutter', x, y, Z0, 0) }
// The hook row over the counter, in the porch, arms out toward the road (R9: they hang empty).
for (let x = 2; x <= 6; x++) piece('hook', x, WALL, Z0 - 1, 0)
// The door: a framed doorway with a door leaf standing open — the shop is open.
cut(9, 1, Z0); cut(9, 2, Z0); cut(9, 3, Z0); piece('doorway', 9, 1, Z0, 0); piece('door', 9, 1, Z0, 0, true)
// A window right of the door, and the lantern between them, hung from a hook.
cut(11, 1, Z0); cut(11, 2, Z0); piece('window', 11, 1, Z0, 0)
piece('hook', 10, WALL, Z0 - 1, 0); put(10, WALL - 1, Z0 - 1, MAT.MANA_LANTERN)
// A bench on the porch under the window.
piece('bench', 11, 1, Z0 - 1, 0)

// ── Side windows with shutters (west rot 1 as Hazel's; east rot 3 so the leaf is on the outside face).
for (const [x, rot] of [[0, 1], [W - 1, 3]] as [number, Rotation][]) {
  cut(x, 1, 4); cut(x, 2, 4); piece('window', x, 1, 4, 1)
  cut(x, 2, 3); cut(x, 2, 5); piece('shutter', x, 2, 3, rot); piece('shutter', x, 2, 5, rot)
}

// ── The porch: posts at the road edge holding the awning row.
for (const x of [0, 4, 8, W - 1]) for (let y = 1; y < WALL; y++) piece('post_dawnwood', x, y, 0, 0)

// ── The roof. Ridge along x. rot 2 = high side at +z (front pitch, faces the road); rot 0 = high
// side at −z (back pitch). Row 0 overhangs one cell front and back; the awning row (y = WALL) is the
// same pitch carried one more cell down and out, over the porch, onto the posts. The mass is
// shingles; the gable ends at x = 0 and x = 12 are dawnwood so they read as timber, not roof.
const ROOF0 = WALL + 1
for (let x = 0; x < W; x++) piece('roof_slope', x, WALL, 0, 2)          // the awning edge (R10)
for (let r = 0; r <= 3; r++) {
  const y = ROOF0 + r, za = Z0 - 1 + r, zb = Z1 + 1 - r
  for (let x = 0; x < W; x++) {
    piece('roof_slope', x, y, za, 2); piece('roof_slope', x, y, zb, 0)  // R12: the top pair is the ridge
    const end = x === 0 || x === W - 1
    for (let z = za + 1; z < zb; z++) put(x, y, z, end ? MAT.PLANKS_DAWNWOOD : MAT.SHINGLES)
  }
}

// ── Inside: the stock. Chests along the back wall, one stacked; pots in the corners; a lantern
// over the shop floor behind the counter.
for (let x = 1; x <= 4; x++) put(x, 1, Z1 - 1, MAT.CHEST)
put(1, 2, Z1 - 1, MAT.CHEST); put(2, 2, Z1 - 1, MAT.CHEST)
put(W - 2, 1, Z1 - 1, MAT.CHEST); put(W - 2, 1, Z0 + 1, MAT.POT_BLOOM); put(1, 1, Z0 + 1, MAT.POT)
piece('hook', 6, WALL, 4, 0); put(6, WALL - 1, 4, MAT.MANA_LANTERN)

const bp = makeBlueprint('mallow_shop', "Mallow's Shop", cells, pieces)
const problems = blueprintProblems(bp)
if (problems.length) { console.error('invalid:\n  - ' + problems.join('\n  - ')); process.exit(1) }
if (bp.w > 14 || bp.d > 9) { console.error(`footprint ${bp.w}x${bp.d} exceeds the 14x9 limit`); process.exit(1) }
const out = join(process.cwd(), 'src/app/shimmer/data/blueprints/mallow_shop.json')
writeFileSync(out, serializeBlueprint(bp))
console.log(`✅ ${bp.id}: ${bp.w}x${bp.h}x${bp.d}, ${bp.cells.length / 4} blocks, ${bp.pieces?.length ?? 0} pieces → ${out}`)
