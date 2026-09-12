// The facing rule. Run: npx tsx src/app/shimmer/voxel3d/piece-facing.test.ts
import { placementForward, rotationFor, placementRotation } from './piece-facing'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codeOnly } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const hit = (x: number, y: number, z: number, px: number, py: number, pz: number) => ({ x, y, z, px, py, pz })

console.log('\n── 1. the mapping is the 08-08 one: rot 1 rises toward +X ──')
ok(rotationFor({ x: 0, z: -1 }) === 0, 'looking −Z → rot 0 (the authored orientation)')
ok(rotationFor({ x: 1, z: 0 }) === 1, 'looking +X → rot 1')
ok(rotationFor({ x: 0, z: 1 }) === 2, 'looking +Z → rot 2')
ok(rotationFor({ x: -1, z: 0 }) === 3, 'looking −X → rot 3')
ok(rotationFor({ x: 0.7, z: -0.71 }) === 0 || rotationFor({ x: 0.7, z: -0.71 }) === 1, 'a diagonal quantises to one of its two neighbours, never a throw')

console.log('\n── 2. ★★ placement wins over direction on a vertical face ──')
// Standing WEST of a wall, looking north-east at its west face (normal −x): the piece must face
// +X, into the wall, whatever the yaw said.
const westFace = hit(10, 0, 10, 9, 0, 10)
ok(placementForward({ x: 0.3, z: -0.95 }, westFace).x === 1, 'the forward vector is +X from the west face')
ok(placementRotation({ x: 0.3, z: -0.95 }, westFace, 0) === 1, `★★ set against a west face → rot 1 (into the wall), got ${placementRotation({ x: 0.3, z: -0.95 }, westFace, 0)}`)
ok(placementRotation({ x: 0.3, z: -0.95 }, null, 0) === 0, 'the same yaw with NO hit reads as looking −Z → rot 0 (direction decides)')
const southFace = hit(10, 0, 10, 10, 0, 11)   // normal +z: player south of the wall
ok(placementRotation({ x: 1, z: 0 }, southFace, 0) === 0, 'set against a south face → faces −Z into the wall, yaw ignored')

console.log('\n── 3. direction wins on a horizontal face ──')
const floor = hit(10, 0, 10, 10, 1, 10)       // placed on top of a block
ok(placementRotation({ x: 1, z: 0 }, floor, 0) === 1, 'on the floor, looking +X → rot 1')
const ceiling = hit(10, 2, 10, 10, 1, 10)
ok(placementRotation({ x: -1, z: 0 }, ceiling, 0) === 3, 'under a ceiling, looking −X → rot 3')

console.log('\n── 4. R is a quarter-turn on top of either ──')
ok(placementRotation({ x: 0, z: -1 }, null, 1) === 1, 'floor + R once')
ok(placementRotation({ x: 0, z: -1 }, null, 3) === 3, 'floor + R three times')
ok(placementRotation({ x: 0.3, z: -0.95 }, westFace, 2) === 3, 'wall (rot 1) + R twice → 3')
ok(placementRotation({ x: 0, z: 1 }, null, 2) === 0, 'wraps mod 4')

console.log('\n── 5. the frame uses it ──')
{
  const host = codeOnly(readFileSync(join(process.cwd(), 'src/app/shimmer/voxel3d/VoxelWorld.tsx'), 'utf8'))
  ok(host.includes('const face = placementRotation(aim, hit, rot)'), 'the ghost/placement facing comes from placementRotation(aim, hit, rot)')
  ok(!/Math\.atan2\(aim\.x, aim\.z\) \/ \(Math\.PI \/ 2\)/.test(host), 'the inline yaw quantisation is gone from the host — one rule, one file')
}

console.log(`\npiece-facing: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
