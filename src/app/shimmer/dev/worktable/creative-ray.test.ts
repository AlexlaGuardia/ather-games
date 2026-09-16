// The crosshair's ray, pinned on exact cells. Run: npx tsx src/app/shimmer/dev/worktable/creative-ray.test.ts
import { voxelRay } from './creative-ray'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const one = (x: number, y: number, z: number) => (a: number, b: number, c: number) => a === x && b === y && c === z
const pad = (x: number, y: number, z: number) => y === -1 && x >= 0 && z >= 0 && x < 40 && z < 40

// Straight down onto the pad from the middle of a cell: hits (5,-1,5) through its TOP face.
{
  const h = voxelRay({ x: 5.5, y: 3.2, z: 5.5 }, { x: 0, y: -1, z: 0 }, pad, 10)
  ok(!!h && h.cell.x === 5 && h.cell.y === -1 && h.cell.z === 5, `down onto the pad lands in (5,-1,5), got ${JSON.stringify(h?.cell)}`)
  ok(!!h && h.normal.y === 1 && h.normal.x === 0 && h.normal.z === 0, `and the face is the top (+y), got ${JSON.stringify(h?.normal)}`)
  ok(!!h && Math.abs(h.dist - 3.2) < 1e-9, `and the distance is 3.2 blocks, got ${h?.dist}`)
}

// A single block at (10,0,10), approached from -x along its middle: the hit is the -x face.
{
  const h = voxelRay({ x: 7.5, y: 0.5, z: 10.5 }, { x: 1, y: 0, z: 0 }, one(10, 0, 10), 8)
  ok(!!h && h.cell.x === 10 && h.cell.y === 0 && h.cell.z === 10, `walking +x hits the block, got ${JSON.stringify(h?.cell)}`)
  ok(!!h && h.normal.x === -1, `through its -x face, got ${JSON.stringify(h?.normal)}`)
}

// ★ THE CORNER CASE THE MOUSE EDITOR GOT WRONG: a shallow diagonal that clips the block's top edge.
// The walk crosses the y plane before the x plane, so it must report the TOP face, and the place
// cell must be the one above — never the side.
{
  const h = voxelRay({ x: 9.2, y: 1.9, z: 10.5 }, { x: 1, y: -1, z: 0 }, one(10, 0, 10), 8)
  ok(!!h && h.cell.x === 10 && h.cell.y === 0, `the diagonal finds the block, got ${JSON.stringify(h?.cell)}`)
  ok(!!h && h.normal.y === 1 && h.normal.x === 0, `and enters through the top, got ${JSON.stringify(h?.normal)}`)
}

// Beyond reach is a miss, even with a solid straight ahead.
{
  const h = voxelRay({ x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, one(20, 0, 0), 8)
  ok(h === null, 'a block 19.5 blocks away is out of an 8-block reach')
  const near = voxelRay({ x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, one(20, 0, 0), 30)
  ok(!!near && near.cell.x === 20 && Math.abs(near.dist - 19.5) < 1e-9, `and in reach at 30 (dist ${near?.dist})`)
}

// Starting inside a solid names that cell with a zero normal — breakable, not buildable-on.
{
  const h = voxelRay({ x: 10.5, y: 0.5, z: 10.5 }, { x: 0, y: 0, z: 1 }, one(10, 0, 10), 8)
  ok(!!h && h.dist === 0 && h.normal.x === 0 && h.normal.y === 0 && h.normal.z === 0, 'inside a block: the block, no face')
}

// A negative direction on every axis, from above and to the +x+z side, onto a block's top.
{
  const h = voxelRay({ x: 12.5, y: 4.5, z: 12.5 }, { x: -1, y: -2, z: -1 }, one(10, 0, 10), 20)
  ok(!!h && h.cell.x === 10 && h.cell.z === 10 && h.normal.y === 1, `all-negative direction still lands on the top, got ${JSON.stringify(h)}`)
}

// A zero direction is a miss, not a hang.
ok(voxelRay({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, () => true, 8) === null, 'a zero direction returns null')

console.log(`\ncreative-ray: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
