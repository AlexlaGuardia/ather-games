// The holds' contract. ⚠⚠ REWRITTEN 2026-08-29 TO A CANON RULING — the previous contract was
// *"pads are flat, walls stand, the road walks IN through a gate"*, and every one of those asserts
// was correct about a hold that canon says never existed.
//
// `design-briefs/moglin-holds.md` (RULED 2026-08-29): **"A hold is neither built nor dug. It is
// folded, pinned and stacked — and at plot scale it is simply ground somebody else folded, taken."**
// ⛔ No masonry anywhere. What remains is the collar's kit: a watch-stake with a lantern, lead-lines
// around the edge, cage-hooks where stock is kept — *"metal on a structure means a hold."*
//
// ★ THESE ASSERTS WERE REWRITTEN, NOT DELETED. A red that is a contract change teaches everyone to
// discount red if it is simply removed; the new law needs guarding at least as hard as the old one
// did, and the strongest assert here is the one that says a hold builds NOTHING.
// Run: npx tsx src/app/shimmer/voxel/holds.test.ts

import { HOLDS, holdIndexAt, holdCourtyardAt, holdVoxelAt, holdGenPieces, holdGenPiecesForCol, STAKE_OFFSET } from './holds'
import { basePieceId, pieceMaterial, cellsOf, pieceDef } from './pieces'
import { columnHeight, holdPadLevel } from './height'
import { materialAt, MAT } from './depth'
import { STORY_NODES, roadAt } from './story-path'

let pass = 0
const fails: string[] = []
const check = (name: string, ok: boolean) => { ok ? pass++ : fails.push(name) }

const SEED = 1337

check('three holds derive from the spine', HOLDS.length === 3)
check('hold ids echo the ruled names', HOLDS.map(s => s.id).join(',') === 'thistle-hold,vetch-hold,brack-hold')
check('sizes escalate down the chain', HOLDS[0].half < HOLDS[1].half && HOLDS[1].half < HOLDS[2].half)

for (const [i, s] of HOLDS.entries()) {
  const pad = holdPadLevel(i, SEED)

  // The pad is FLAT inside the walls.
  let flat = true
  for (const [dx, dz] of [[0, 0], [s.half - 1, 0], [0, -s.half + 1], [-s.half + 1, s.half - 1]] as const)
    if (columnHeight(s.x + dx, s.z + dz, SEED) !== pad) flat = false
  check(`${s.id}: the pad is flat at the pad level`, flat)

  // ── ★★★ A HOLD BUILDS NOTHING, AND THIS IS THE ASSERT THAT SAYS SO ───────────────────────
  // The old contract asserted the wall was dressed masonry and refused to accept MAT.STONE, so that
  // it would still go red if a wall reverted to bare rock. That reasoning was sound and its subject
  // is gone: canon rules there is no wall. ⛔ The Ather has no ore and no quarry-craft, and Bonn #1
  // negates stone BY NAME at a garden plot's walls.
  //
  // ⚠ IT SWEEPS THE WHOLE FOOTPRINT RATHER THAN CHECKING THE OLD WALL LINE. Checking one cell where
  // masonry used to be would pass the day somebody rebuilt a keep two blocks inward — an assert
  // written against the shape of the bug it replaced, which is how the original defect walks back in
  // from a door nobody is watching.
  const MASONRY = new Set<number>([
    MAT.CUT_STONE, MAT.MOSSY_CUT_STONE, MAT.CRACKED_STONE_BRICK, MAT.STONE_BRICK,
    MAT.MOSSY_STONE_BRICK, MAT.PALE_BRICK,
  ])
  let stoneCells = 0, builtCells = 0
  for (let dx = -s.half; dx <= s.half; dx += 2) for (let dz = -s.half; dz <= s.half; dz += 2) {
    for (let dy = 1; dy <= 8; dy++) {
      const m = holdVoxelAt(s.x + dx, pad + dy, s.z + dz, i, pad, MAT.PLANKS_GOLDWOOD, MAT.MANA_LANTERN)
      if (m === 0) continue
      builtCells++
      if (MASONRY.has(m)) stoneCells++
    }
  }
  check(`${s.id}: ⛔ not one block of masonry anywhere in the hold (${stoneCells})`, stoneCells === 0)
  // ★★ AND THE MASS IS TINY — "a bully squatting a room", not a structure. A hold that started
  // growing walls again out of some other material would pass the masonry check and fail this one.
  check(`${s.id}: builds almost nothing at all (${builtCells} cells over the whole footprint)`,
        builtCells > 0 && builtCells < 24)

  // ★ THE WATCH-STAKE STANDS WHERE THE ROAD COMES IN, and canon says a lantern is the only made
  // thing here: *"a lantern hung to watch something."*
  for (const g of s.gates) {
    const gx = g.wall === 0 ? s.x + s.half : g.wall === 1 ? s.x - s.half : s.x + g.at + STAKE_OFFSET
    const gz = g.wall === 2 ? s.z + s.half : g.wall === 3 ? s.z - s.half : s.z + g.at + STAKE_OFFSET
    const post = holdVoxelAt(gx, pad + 1, gz, i, pad, MAT.PLANKS_GOLDWOOD, MAT.MANA_LANTERN)
    const light = holdVoxelAt(gx, pad + 3, gz, i, pad, MAT.PLANKS_GOLDWOOD, MAT.MANA_LANTERN)
    check(`${s.id}: a watch-stake stands where the road comes in (${gx},${gz})`, post === MAT.PLANKS_GOLDWOOD)
    check(`${s.id}: with a lantern on it — the hold's only made thing`, light === MAT.MANA_LANTERN)
  }

  // ⚠ AND THE ROAD IS NOT BLOCKED. The old assert checked the road pierced a WALL; with no wall the
  // property that still matters is that nothing of the hold's stands in the roadway.
  for (const g of s.gates) {
    const gx = g.wall === 0 ? s.x + s.half : g.wall === 1 ? s.x - s.half : s.x + g.at
    const gz = g.wall === 2 ? s.z + s.half : g.wall === 3 ? s.z - s.half : s.z + g.at
    let blocked = false
    for (let dy = 1; dy <= 3; dy++) {
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (holdVoxelAt(gx + ox, pad + dy, gz + oz, i, pad, MAT.PLANKS_GOLDWOOD, MAT.MANA_LANTERN) !== 0) blocked = true
      }
    }
    check(`${s.id}: the road walks in beside the stake, not through anything`, !blocked)
  }

  // ★ THE ONE THING THE OLD CONTRACT GOT RIGHT AND CANON KEPT: the ground wears bare. The brief's
  // ground row is "the plot's grass and paths, worn, trampled, dragged-over" — worn is correct, and
  // it is the ⛔ *flattened construction pad* that is not.
  const hc = columnHeight(s.x + 2, s.z + 2, SEED)
  check(`${s.id}: courtyard surface is worn path`, materialAt(s.x + 2, hc, s.z + 2, SEED, hc) === MAT.PATH)
  check(`${s.id}: courtyard membership agrees`, holdCourtyardAt(s.x, s.z) && !holdCourtyardAt(s.x + s.half + 30, s.z))

  // The ROAD enters through a gate: walk the road line to the wall and demand walkable air.
  const n = STORY_NODES.findIndex(nd => nd.id === s.id)
  for (const other of [STORY_NODES[n - 1], STORY_NODES[n + 1]]) {
    const dx = other.x - s.x, dz = other.z - s.z
    const len = Math.hypot(dx, dz)
    // Step outward along the road until we stand ON the wall ring, then check the column is open.
    let gx = 0, gz = 0
    for (let t = 0; t < s.half * 2; t++) {
      const x = Math.round(s.x + (dx / len) * t), z = Math.round(s.z + (dz / len) * t)
      if (Math.max(Math.abs(x - s.x), Math.abs(z - s.z)) === s.half) { gx = x; gz = z; break }
    }
    const hw = columnHeight(gx, gz, SEED)
    const open = materialAt(gx, hw + 1, gz, SEED, hw) === MAT.AIR && materialAt(gx, hw + 2, gz, SEED, hw) === MAT.AIR
    // ⚠ REPHRASED, NOT RELAXED. This said *"the road pierces the WALL"*, and with no wall the
    // property that still matters is the same one it was really protecting: **the road stays open
    // where it meets the hold.** A hold takes and pressures; canon is explicit it does not seal.
    check(`${s.id}: the road stays open where it meets the hold (${gx},${gz})`, open)
    check(`${s.id}: the road actually runs there`, roadAt(gx, gz, SEED))
  }

  // Gate lights: a lantern hangs over each gate centre.
  let lanterns = 0
  for (const g of s.gates) {
    const [wx, wz] =
      // ★ ASKED, NOT RESTATED — the stake stands STAKE_OFFSET along the edge from the road.
      g.wall === 0 ? [s.x + s.half, s.z + g.at + STAKE_OFFSET] : g.wall === 1 ? [s.x - s.half, s.z + g.at + STAKE_OFFSET] :
      g.wall === 2 ? [s.x + g.at + STAKE_OFFSET, s.z + s.half] : [s.x + g.at + STAKE_OFFSET, s.z - s.half]
    // ⚠ THE LANTERN MOVED DOWN WITH THE WALL IT USED TO HANG ON. It sat at pad+5, over a 4-high
    // curtain wall; it now tops a watch-stake at pad+3. Same fact — *"a lantern hung to watch
    // something"* — at the only height a hold still has.
    if (holdVoxelAt(wx, pad + 3, wz, i, pad, MAT.PLANKS_GOLDWOOD, MAT.MANA_LANTERN) === MAT.MANA_LANTERN) lanterns++
  }
  check(`${s.id}: both roads in are watched (${lanterns} lit stakes)`, lanterns === 2)
}

check('holdIndexAt rejects open country', holdIndexAt(0, 0) === -1 && holdIndexAt(-150, -640) === -1)

// ── the collar's kit: lead-lines, cage-hooks, tombstonable ids ────────────────────────────────
// ⚠⚠ REWRITTEN 2026-08-29. This block asserted parapets on the wall tops and a roof over the keep,
// and every assert was correct about dressing for a building canon says was never there. What it
// checks now is the list canon DOES give: *"cages, tethers, stakes, lead-lines, cage-hooks, a
// lantern hung to watch something."*
//
// ★ THE TOMBSTONE PROPERTY IS THE ONE THAT SURVIVED UNCHANGED, and it mattered through this very
// correction: `gen` keys on POSITION, not on the piece id, so a keeper who tore a piece down last
// week keeps it down even though every piece here changed identity today.
for (let i = 0; i < HOLDS.length; i++) {
  const s = HOLDS[i]
  const pad = holdPadLevel(i, SEED)
  const dressing = holdGenPieces(i, pad)

  check(`${s.id}: BLIND CHECK — there is dressing to inspect (${dressing.length})`, dressing.length > 4)

  const lines_ = dressing.filter(g => basePieceId(g.pieceId) === 'fence')
  const hooks = dressing.filter(g => basePieceId(g.pieceId) === 'hook')
  check(`${s.id}: lead-lines are strung around the taken ground (${lines_.length})`, lines_.length > 4)
  check(`${s.id}: and cage-hooks where stock is kept (${hooks.length})`, hooks.length > 0)

  // ⛔ NOTHING ARCHITECTURAL. A hold that grew a roof, a stair or a beam again would pass every
  // count above and fail this — the assert is against the CLASS of thing, not against a tally.
  const ARCH = new Set(['roof_slope', 'roof_cap', 'stair', 'beam', 'arch', 'window', 'doorway', 'door'])
  const built = dressing.filter(g => ARCH.has(basePieceId(g.pieceId)))
  check(`${s.id}: ⛔ nothing architectural in the kit (${built.map(g => g.pieceId).join(', ') || 'none'})`,
        built.length === 0)

  // ★ AND NOTHING STANDS IN THE ROADWAY. A lead-line across the quest spine reads as a barrier, and
  // canon is explicit that a collarer takes and pressures rather than seals.
  check(`${s.id}: the road's crossings are left clear`, dressing.every(g => {
    return !s.gates.some(gt => {
      const along = gt.wall <= 1 ? g.z - s.z : g.x - s.x
      return Math.abs(along - gt.at) <= 1
    })
  }))

  check(`${s.id}: gen ids are unique`, new Set(dressing.map(g => g.gen)).size === dressing.length)
  check(`${s.id}: gen ids key on POSITION, so a torn-down piece stays down across a piece change`,
        dressing.every(g => g.gen.includes(`${g.x},${g.z}`)))


  // Column partition: collecting per-column over the bbox reproduces the whole set exactly.
  const got = new Set<string>()
  const c0x = Math.floor((s.x - s.half - 2) / 16), c1x = Math.floor((s.x + s.half + 2) / 16)
  const c0z = Math.floor((s.z - s.half - 2) / 16), c1z = Math.floor((s.z + s.half + 2) / 16)
  for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++)
    for (const g of holdGenPiecesForCol(cx, cz, 16, j => holdPadLevel(j, SEED))) got.add(g.gen)
  check(`${s.id}: per-column partition covers the dressing exactly`,
    got.size === dressing.length && dressing.every(g => got.has(g.gen)))
}

console.log(`\nholds: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1) }
console.log('✅ the holds stand')
