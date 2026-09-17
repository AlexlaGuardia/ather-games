// Falling leaves (2026-09-17). Run: npx tsx src/app/shimmer/voxel3d/leaf-fall.test.ts
import { createLeafFall, dropLeaf, stepLeafFall, LEAF_FALL } from './leaf-fall'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const rnd = (() => { let s = 7; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296 } })()

// A leaf dropped over flat ground at y=10 lands ON it (y ≈ 10.85 — resting on the block top).
{
  const st = createLeafFall()
  dropLeaf(st, 5, 20, 5, 15, rnd)
  ok(st.leaves[0].x === 5.5 && st.leaves[0].y === 20.5, 'starts at the block centre')
  const ground = (_x: number, y: number) => y <= 9
  let landed: ReturnType<typeof stepLeafFall> = [], t = 0
  while (!landed.length && t < 20) { landed = stepLeafFall(st, 1 / 60, ground); t += 1 / 60 }
  ok(landed.length === 1 && st.leaves.length === 0, 'lands once and leaves the state')
  ok(Math.abs(landed[0].y - 10.35) < 0.1, `rests on the ground block's top (y ${landed[0].y.toFixed(2)})`)
  ok(t > 2.5 && t < 6, `a leaf takes its time: ${t.toFixed(1)}s for a 10-block fall (terminal ${LEAF_FALL.terminal})`)
  ok(Math.abs(landed[0].x - 5.5) < 1.5 && Math.abs(landed[0].z - 5.5) < 1.5, 'drifts a little, not across the meadow')
}
// Terminal speed holds.
{
  const st = createLeafFall(); dropLeaf(st, 0, 200, 0, 15, rnd)
  for (let i = 0; i < 300; i++) stepLeafFall(st, 1 / 60, () => false)
  ok(Math.abs(st.leaves[0].vy + LEAF_FALL.terminal) < 1e-6, 'falls no faster than terminal')
}
// Unloaded space (never solid) → lands at maxLife, never lost.
{
  const st = createLeafFall(); dropLeaf(st, 0, 50, 0, 15, rnd)
  let landed = 0
  for (let i = 0; i < 60 * (LEAF_FALL.maxLife + 1); i++) landed += stepLeafFall(st, 1 / 60, () => false).length
  ok(landed === 1 && st.leaves.length === 0, 'a leaf over nothing lands at maxLife')
}
// The cap: the oldest goes first, count never exceeds it.
{
  const st = createLeafFall()
  for (let i = 0; i < LEAF_FALL.cap + 10; i++) dropLeaf(st, i, 30, 0, 15, rnd)
  ok(st.leaves.length === LEAF_FALL.cap, 'capped')
  ok(st.leaves[0].x === 10.5, 'the oldest were shed')
}
// Two leaves do not sway as one.
{
  const st = createLeafFall(); dropLeaf(st, 0, 30, 0, 15, rnd); dropLeaf(st, 0, 30, 0, 15, rnd)
  for (let i = 0; i < 30; i++) stepLeafFall(st, 1 / 60, () => false)
  ok(Math.abs(st.leaves[0].x - st.leaves[1].x) > 1e-4 || Math.abs(st.leaves[0].phase - st.leaves[1].phase) > 1e-4, 'per-leaf phases')
}
console.log(`\nleaf-fall: ${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ a leaf falls like a leaf, lands on what is under it, and is never lost')
