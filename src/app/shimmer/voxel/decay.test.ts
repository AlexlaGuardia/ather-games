// Leaf decay oracle. Run: npx tsx src/app/shimmer/voxel/decay.test.ts
//
// Decay is the class of feature whose bugs are invisible at the moment they happen and obvious an
// hour later: a canopy that never falls looks like a canopy, and a canopy that falls too eagerly
// eats a hole in the tree NEXT to the one you chopped. Neither shows up in a screenshot of the
// swing, so the properties get pinned arithmetically here.

import { AIR } from './section'
import { WOOD, isLeafMat } from './trees'
import { orphanedLeaves, dueLeaves, withoutLeaves, enqueueLeaves, DEFAULT_DECAY, type PendingLeaf } from './decay'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }
const eq = (a: number, b: number, msg: string) => ok(a === b, `${msg} (got ${a}, want ${b})`)

const isLog = (m: number) => m >= WOOD.GOLDWOOD_LOG && m <= WOOD.DAWNWOOD_LOG && m % 2 === 0
// Deterministic stand-in for Math.random, so a delay assert pins a number rather than a range.
const noRand = () => 0

/** A tiny sparse world. `grow` plants a trunk of `h` logs at (x,z) with a solid cube crown. */
function world() {
  const m = new Map<string, number>()
  const k = (x: number, y: number, z: number) => `${x},${y},${z}`
  return {
    at: (x: number, y: number, z: number) => m.get(k(x, y, z)) ?? AIR,
    set: (x: number, y: number, z: number, v: number) => m.set(k(x, y, z), v),
    grow(x: number, z: number, h: number, r: number) {
      for (let i = 0; i < h; i++) m.set(k(x, i, z), WOOD.GOLDWOOD_LOG)
      for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const key = k(x + dx, h - 1 + dy, z + dz)
        if (!m.has(key)) m.set(key, WOOD.GOLDWOOD_LEAVES)
      }
    },
    count(pred: (v: number) => boolean) { let n = 0; for (const v of m.values()) if (pred(v)) n++; return n },
  }
}

// ── ★ A STANDING TREE NEVER SHEDS ────────────────────────────────────────────────────────────────
// The single most important negative: this runs after EVERY log removal, and chopping the base of a
// trunk is the common case. If support leaked, ordinary mining would rain leaves off healthy trees.
{
  const w = world()
  w.grow(0, 0, 8, 2)
  w.set(0, 0, 0, AIR)              // chop the base only — the rest of the trunk still stands
  const orphans = orphanedLeaves(w.at, isLeafMat, isLog, 0, 0, 0, noRand)
  eq(orphans.length, 0, '★ chopping the base of a standing trunk orphans nothing')
}

// ── ★ THE LAST LOG TAKES THE WHOLE CANOPY ────────────────────────────────────────────────────────
{
  const w = world()
  w.grow(0, 0, 8, 2)
  const leaves = w.count(isLeafMat)
  ok(leaves > 0, 'the fixture actually grew a canopy')
  for (let y = 0; y < 8; y++) w.set(0, y, 0, AIR)     // fell it
  const orphans = orphanedLeaves(w.at, isLeafMat, isLog, 0, 7, 0, noRand)
  eq(orphans.length, leaves, '★ with every log gone, every leaf is orphaned')
}

// ── ★ AND IT DOES NOT EAT THE TREE NEXT DOOR ─────────────────────────────────────────────────────
// The failure this guards is the ugly one: fell a tree at the edge of a wood and watch a bite
// appear in its neighbour's crown. Two trunks close enough that their canopies touch.
{
  const w = world()
  w.grow(0, 0, 8, 2)
  w.grow(4, 0, 8, 2)                                  // crowns overlap around x=2
  const before = w.count(isLeafMat)
  for (let y = 0; y < 8; y++) w.set(0, y, 0, AIR)     // fell only the first
  const orphans = orphanedLeaves(w.at, isLeafMat, isLog, 0, 7, 0, noRand)
  ok(orphans.length > 0, 'felling one of two trees still drops something')
  ok(orphans.length < before, '★ ... but not the whole wood')
  const survivors = new Set(orphans.map(o => `${o.x},${o.y},${o.z}`))
  let neighbourLost = 0
  for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
    if (survivors.has(`${4 + dx},${7 + dy},${dz}`)) neighbourLost++
  eq(neighbourLost, 0, '★ not one leaf of the STANDING tree is taken')
}

// ── ★ SUPPORT DOES NOT LEAK THROUGH AIR ──────────────────────────────────────────────────────────
// The BFS walks leaves only. Through air, a felled crown would be propped up by any tree within the
// box and the feature would silently do nothing in a forest — the only place it matters.
{
  const w = world()
  w.grow(0, 0, 8, 1)
  w.grow(6, 0, 8, 1)                                  // far enough apart that crowns do NOT touch
  for (let y = 0; y < 8; y++) w.set(0, y, 0, AIR)
  const orphans = orphanedLeaves(w.at, isLeafMat, isLog, 0, 7, 0, noRand)
  const mine = orphans.filter(o => Math.abs(o.x) <= 1).length
  // 3³ minus the two cells the trunk already occupied — `grow` refuses to overwrite a log, so the
  // crown of a radius-1 tree is 25 leaves, not 27. Worth stating rather than rounding to "> 20":
  // an exact count is what would catch the walk quietly stopping one cell short.
  eq(mine, 3 * 3 * 3 - 2, '★ a severed crown falls even with another tree in the same box')
}

// ── ★ THE CANOPY UNRAVELS OUTWARD, IT DOES NOT BLINK OUT ─────────────────────────────────────────
// Alex asked for "come down over time". A single shared delay would read as the tree being deleted.
{
  const w = world()
  w.grow(0, 0, 8, 3)
  for (let y = 0; y < 8; y++) w.set(0, y, 0, AIR)
  const orphans = orphanedLeaves(w.at, isLeafMat, isLog, 0, 7, 0, noRand)
  const near = orphans.find(o => o.x === 0 && o.y === 7 && o.z === 1)!
  const far = orphans.find(o => o.x === 3 && o.y === 7 && o.z === 3)!
  ok(!!near && !!far, 'both a near and a far leaf are in the fall')
  ok(far.delay > near.delay, '★ leaves further from the trunk fall later')
  eq(Math.round(near.delay * 100), Math.round((DEFAULT_DECAY.delayBase + DEFAULT_DECAY.delayPerStep) * 100),
     'the near leaf waits base + one step')
}

// ── ★ RE-CHOPPING NEVER PUSHES THE FALL FURTHER AWAY ─────────────────────────────────────────────
// The scan re-runs on every swing, so the same leaf is re-orphaned many times while a trunk comes
// down. Taking the newest time each pass means a fast chopper outruns the decay forever and nothing
// ever falls — a bug that only appears when someone plays WELL.
{
  let q: PendingLeaf[] = []
  q = enqueueLeaves(q, [{ x: 0, y: 7, z: 0, delay: 1 }], 100)
  q = enqueueLeaves(q, [{ x: 0, y: 7, z: 0, delay: 1 }], 105)     // same leaf, five seconds later
  eq(q.length, 1, 'the same cell is queued once')
  eq(q[0].at, 101, '★ it keeps its EARLIEST fall time, not the latest')
}

// ── ★ THE QUEUE IS ABSOLUTE-TIMED, WHICH IS WHAT MAKES A RELOAD FINISH THE JOB ──────────────────
{
  const q: PendingLeaf[] = [
    { x: 0, y: 0, z: 0, at: 10 },
    { x: 1, y: 0, z: 0, at: 20 },
    { x: 2, y: 0, z: 0, at: 30 },
  ]
  eq(dueLeaves(q, 15).length, 1, 'only what is due comes back')
  eq(dueLeaves(q, 9).length, 0, 'nothing is due before its time')
  eq(dueLeaves(q, 9999).length, 3, '★ come back much later and the whole canopy is already down')
  eq(withoutLeaves(q, dueLeaves(q, 15)).length, 2, 'consumed entries leave the queue')
  eq(withoutLeaves(q, []).length, 3, 'an empty harvest consumes nothing')
}

console.log(`\nleaf decay: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
if (fails.length) process.exit(1)
console.log('✅ a felled tree loses its canopy, a standing one keeps it')
