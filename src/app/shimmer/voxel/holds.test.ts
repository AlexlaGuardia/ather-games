// The hold blockouts' contract: pads are flat, walls stand, the road walks IN through a gate
// (never through stone), the courtyard wears bare, and the gates are lit.
// Run: npx tsx src/app/shimmer/voxel/holds.test.ts

import { HOLDS, holdIndexAt, holdCourtyardAt, holdVoxelAt, holdGenPieces, holdGenPiecesForCol } from './holds'
import { basePieceId, pieceMaterial } from './pieces'
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

  // Wall stands on the wall line; courtyard surface is worn path.
  // ⚠ THE WALL IS MIXED MASONRY SINCE 2026-08-27, so this asserts MEMBERSHIP OF THE COURSE SET
  // rather than one id. It deliberately does NOT accept MAT.STONE: raw stone is what the hillside
  // is made of, and the whole change was that a hold must not be the same material as the ground it
  // stands on. Widening this to "any solid" would make it a guard that cannot fail — it has to
  // still go red if the wall reverts to bare rock, which is the regression that matters.
  const COURSE = new Set<number>([MAT.CUT_STONE, MAT.MOSSY_CUT_STONE, MAT.CRACKED_STONE_BRICK])
  check(`${s.id}: wall is dressed masonry above the pad`,
        COURSE.has(materialAt(s.x + s.half, pad + 2, s.z, SEED, columnHeight(s.x + s.half, s.z, SEED))))
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
    check(`${s.id}: the road pierces the wall toward ${other.id} (gap at ${gx},${gz})`, open)
    check(`${s.id}: the road actually runs there`, roadAt(gx, gz, SEED))
  }

  // Gate lights: a lantern hangs over each gate centre.
  let lanterns = 0
  for (const g of s.gates) {
    const [wx, wz] =
      g.wall === 0 ? [s.x + s.half, s.z + g.at] : g.wall === 1 ? [s.x - s.half, s.z + g.at] :
      g.wall === 2 ? [s.x + g.at, s.z + s.half] : [s.x + g.at, s.z - s.half]
    if (holdVoxelAt(wx, pad + 5, wz, i, pad, MAT.STONE, MAT.MANA_LANTERN) === MAT.MANA_LANTERN) lanterns++
  }
  check(`${s.id}: both gates are lit`, lanterns === 2)
}

check('holdIndexAt rejects open country', holdIndexAt(0, 0) === -1 && holdIndexAt(-150, -640) === -1)

// ── the generated dressing: parapets on the walls, a roof on the keep, tombstonable ids ────────
for (const [i, s] of HOLDS.entries()) {
  const pad = holdPadLevel(i, SEED)
  const dressing = holdGenPieces(i, pad)
  // ★ THE PARAPET IS A STONE FENCE VARIANT SINCE 2026-08-27 (`fence_stonebrick`), so this matches
  // the SHAPE via basePieceId rather than the exact id — a wooden railing on a masonry wall was the
  // palette clash being fixed. ⚠ The material is asserted separately below; matching the base alone
  // would let the timber fence come straight back without a word.
  const parapets = dressing.filter(g => basePieceId(g.pieceId) === 'fence')
  const roof = dressing.filter(g => g.pieceId.startsWith('roof_'))
  check(`${s.id}: parapets exist`, parapets.length > 10)
  check(`${s.id}: ★ the parapet is stone, not timber`,
        parapets.length > 0 && parapets.every(g => pieceMaterial(g.pieceId)?.family === 'stone'))
  check(`${s.id}: every parapet stands ON the wall top`, parapets.every(g =>
    g.y === pad + 5 && (Math.abs(g.x - s.x) === s.half || Math.abs(g.z - s.z) === s.half)))
  check(`${s.id}: no parapet in a gate span`, parapets.every(g => {
    for (const gt of s.gates) {
      const along = gt.wall <= 1 ? g.z - s.z : g.x - s.x
      const onThatWall = gt.wall === 0 ? g.x - s.x === s.half : gt.wall === 1 ? g.x - s.x === -s.half
        : gt.wall === 2 ? g.z - s.z === s.half : g.z - s.z === -s.half
      if (onThatWall && Math.abs(along - gt.at) <= 2) return false
    }
    return true
  }))
  const keepArea = (2 * s.keepHalf + 1) ** 2 - 4    // minus the four lantern corners
  check(`${s.id}: the keep roof covers the keep`, roof.length === keepArea)
  check(`${s.id}: gen ids are unique`, new Set(dressing.map(g => g.gen)).size === dressing.length)
  check(`${s.id}: determinism`, JSON.stringify(holdGenPieces(i, pad)) === JSON.stringify(dressing))

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
