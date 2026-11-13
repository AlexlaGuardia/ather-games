// The feel slice's land. Run: npx tsx src/app/shimmer/open/land.test.ts

import { createLoco, tickLocomotion, type LocoInput } from '../voxel3d/locomotion'
import { terrainWorld, MAX_WALK_GRADIENT } from './terrain-world'
import { LAND_SHAPE, LAND_SIZE, CELL, GRID_N, vertexHeight, heightAt, PROPS } from './land'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const input = (o: Partial<LocoInput> = {}): LocoInput => ({
  mvX: 0, mvZ: 0, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60, ...o,
})
const half = LAND_SIZE / 2
const W = terrainWorld(LAND_SHAPE)

// ★ what you see is what you stand on: the walker's height IS the mesh's, at every vertex and mid-face
{
  let worst = 0
  for (let k = 0; k < 2000; k++) {
    const i = (k * 37) % GRID_N, j = (k * 91) % GRID_N
    worst = Math.max(worst, Math.abs(heightAt(i * CELL - half, j * CELL - half) - vertexHeight(i, j)))
    // centroid of the upper triangle (00,10,11) = average of its corners
    const cx = (i + 2 / 3) * CELL - half, cz = (j + 1 / 3) * CELL - half
    const want = (vertexHeight(i, j) + vertexHeight(i + 1, j) + vertexHeight(i + 1, j + 1)) / 3
    worst = Math.max(worst, Math.abs(heightAt(cx, cz) - want))
  }
  ok(worst < 1e-4, `★ collision height matches the drawn triangles (worst ${worst.toExponential(1)})`)
}

// spawn is a flat pad you stand on
{
  const s = createLoco(0, heightAt(0, 6), 6)
  for (let i = 0; i < 60; i++) tickLocomotion(s, input(), W)
  ok(!s.airborne && Math.abs(s.py - heightAt(0, 6)) < 0.05, `stands at spawn (feet ${s.py.toFixed(2)})`)
  ok(Math.abs(heightAt(0, 0)) < 0.05 && Math.abs(heightAt(4, 3)) < 0.2, 'the spawn pad is flat')
}

// the low cliff and the bluff are walls, not slopes
{
  const grad = (x: number, z: number, dx: number, dz: number) => (heightAt(x + dx * 0.5, z + dz * 0.5) - heightAt(x - dx * 0.5, z - dz * 0.5))
  ok(Math.abs(grad(34 - 13.6, -4, 1, 0)) > MAX_WALK_GRADIENT, `the low cliff's west face is too steep to walk (${grad(34 - 13.6, -4, 1, 0).toFixed(2)})`)
  ok(Math.abs(grad(22, -42 + 10.5, 0, 1)) > MAX_WALK_GRADIENT, `the bluff's south face is too steep to walk (${grad(22, -42 + 10.5, 0, 1).toFixed(2)})`)
}

// a minute of sprinting north from spawn never wedges the body (no stuck-in-terrain on the generated land)
{
  const s = createLoco(0, heightAt(0, 6), 6)
  let stuck = 0, lastZ = s.pz
  for (let i = 0; i < 60 * 12; i++) {
    tickLocomotion(s, input({ mvZ: -1, mvX: Math.sin(i / 90) * 0.4 }), W)
    if (i % 60 === 59) { if (Math.abs(s.pz - lastZ) < 0.5) stuck++; lastZ = s.pz }
  }
  ok(W.bodyFree(s.px, s.pz, s.py), 'the body is never left inside the land')
  ok(stuck <= 3, `sprinting the hill rarely stalls (${stuck} stalled seconds of 12, ended z ${s.pz.toFixed(0)})`)
}

ok(PROPS.some(p => p.kind === 'ledge') && PROPS.filter(p => p.kind === 'trunk').length > 30, 'the ledge and a forest are placed')

console.log(`\nland: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the slice is land you can stand on')
