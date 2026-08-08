// The hold blockouts' contract: pads are flat, walls stand, the road walks IN through a gate
// (never through stone), the courtyard wears bare, and the gates are lit.
// Run: npx tsx src/app/shimmer/voxel/holds.test.ts

import { HOLDS, holdIndexAt, holdCourtyardAt, holdVoxelAt } from './holds'
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
  check(`${s.id}: wall stone above the pad`, materialAt(s.x + s.half, pad + 2, s.z, SEED, columnHeight(s.x + s.half, s.z, SEED)) === MAT.STONE)
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

console.log(`\nholds: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1) }
console.log('✅ the strongholds stand')
