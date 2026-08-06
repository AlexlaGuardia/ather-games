// Mesher spike — what section size can we afford?
// Run headless: npx tsx src/app/shimmer/voxel/bench.ts
//
// ★ THE DECISION THIS EXISTS TO MAKE. Section size is NOT a memory decision — VOXEL-WORLD-MODEL.md
// § 2 showed the totals are identical at 16/32/64 for a fixed footprint. What changes is how much
// geometry rebuilds when the player breaks ONE block. So the number that decides it is: milliseconds
// to re-mesh one section. Everything else here is context for that column.
//
// ⚠ THESE ARE SERVER NUMBERS. The ruling target is a phone, and a phone is not a slower server —
// it throttles, it has a smaller cache, and Safari's JIT warms differently. Treat this as an upper
// bound on quality and a lower bound on time; the real number comes off Alex's device.
//
// Fill patterns are deliberately NOT random. Random fill is the worst case for merging and would
// make greedy meshing look far worse than our actual world, which is mostly flat ground over mostly
// solid rock — the exact shape greedy is best at. Checkerboard is included as the true bound.

import { Section } from './section'
import { greedyMesh, createMeshScratch } from './greedy'

// ── deterministic value noise (no Math.random: a bench that drifts can't be compared run to run) ──
const hash = (x: number, y: number, z: number, seed = 1337): number => {
  let h = seed ^ (x * 374761393) ^ (y * 668265263) ^ (z * 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const smooth = (x: number, z: number, freq: number): number => {
  const xf = x * freq, zf = z * freq
  const x0 = Math.floor(xf), z0 = Math.floor(zf)
  const tx = xf - x0, tz = zf - z0
  const l = (a: number, b: number, t: number) => a + (b - a) * (t * t * (3 - 2 * t))
  return l(l(hash(x0, 0, z0), hash(x0 + 1, 0, z0), tx), l(hash(x0, 0, z0 + 1), hash(x0 + 1, 0, z0 + 1), tz), tz)
}

type Filler = (S: number, oy: number) => Section

/** The common case: rolling surface, air above, stone below, a little ore. */
const surface: Filler = (S, oy) => {
  const s = new Section(S)
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const h = 40 + Math.floor(smooth(x, z, 0.06) * 14)
    for (let y = 0; y < S; y++) {
      const wy = oy + y
      if (wy > h) continue
      s.set(x, y, z, wy === h ? 2 : wy > h - 4 ? 3 : hash(x, wy, z, 99) < 0.008 ? 5 : 1)
    }
  }
  return s
}

/** Deep rock with scattered ore — the cheapest case, and most of a 128-tall column. */
const underground: Filler = (S, oy) => {
  const s = new Section(S)
  for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++)
    s.set(x, y, z, hash(x, oy + y, z, 7) < 0.012 ? 5 : 1)
  return s
}

/** Carved caves — the expensive real case: carving MAKES faces, so this is what carvers cost us. */
const caves: Filler = (S, oy) => {
  const s = new Section(S)
  for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const wy = oy + y
    const d = smooth(x + wy * 3, z + wy * 5, 0.08)
    s.set(x, y, z, d > 0.42 && d < 0.58 ? 0 : 1)
  }
  return s
}

/** The true upper bound: nothing merges, every solid cell shows 6 faces. */
const checker: Filler = (S) => {
  const s = new Section(S)
  for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++)
    if ((x + y + z) % 2 === 0) s.set(x, y, z, 1)
  return s
}

const CASES: [string, Filler, number][] = [
  ['surface', surface, 32],
  ['underground', underground, 8],
  ['caves', caves, 16],
  ['checkerboard', checker, 0],
]

const time = (fn: () => void, iters: number): number => {
  for (let i = 0; i < Math.max(3, iters >> 2); i++) fn()   // warm the JIT
  const t0 = performance.now()
  for (let i = 0; i < iters; i++) fn()
  return (performance.now() - t0) / iters
}

console.log('\n★ RE-MESH COST PER SECTION — the number that picks section size')
console.log('   (one broken block = one section re-mesh, so this is the latency of a swing)\n')
console.log('  size  case            ms/section   quads    faces   greedy win   sections/column@128')
console.log('  ' + '-'.repeat(88))

const results: Record<number, Record<string, number>> = {}
for (const S of [8, 16, 32, 64]) {
  results[S] = {}
  for (const [name, fill, oy] of CASES) {
    const sec = fill(S, oy)
    const scratch = createMeshScratch(S)          // one per worker in production, reused forever
    const ms = time(() => { greedyMesh(sec, undefined, scratch) }, S >= 64 ? 20 : 200)
    const r = greedyMesh(sec, undefined, scratch)
    results[S][name] = ms
    const win = r.faces > 0 ? (r.faces / r.quads).toFixed(1) + 'x' : '—'
    console.log(
      `  ${String(S).padStart(4)}  ${name.padEnd(14)} ${ms.toFixed(3).padStart(9)}   ` +
      `${String(r.quads).padStart(6)}  ${String(r.faces).padStart(7)}   ${win.padStart(9)}   ${String(Math.ceil(128 / S)).padStart(9)}`
    )
  }
  console.log()
}

// ── what a full chunk column costs, which is what a newly-streamed chunk pays at once ──────────
console.log('★ FULL COLUMN COST — a chunk entering the load radius meshes its whole stack')
console.log('  (64-tile chunk footprint, world height 128, mixed surface/underground/caves)\n')
console.log('  section  sections/column  est ms/column   at 49 live chunks')
console.log('  ' + '-'.repeat(62))
for (const S of [8, 16, 32, 64]) {
  const perCol = Math.ceil(128 / S) * (64 / S) ** 2
  // A column is mostly cheap rock, some surface, some cave. Weight it rather than using the worst.
  const mix = results[S].underground * 0.6 + results[S].surface * 0.2 + results[S].caves * 0.2
  const col = mix * perCol
  console.log(`  ${String(S).padStart(7)}  ${String(perCol).padStart(15)}  ${col.toFixed(1).padStart(13)}   ${(col * 49).toFixed(0).padStart(17)} ms`)
}

console.log('\n★ BOUNDARY COST — a block on a section corner dirties its own section AND up to 7 neighbours.')
console.log('  Smaller sections re-mesh faster but a larger share of blocks sit on a boundary:')
console.log('  size   boundary blocks   worst-case re-mesh (8 sections)')
console.log('  ' + '-'.repeat(56))
for (const S of [8, 16, 32, 64]) {
  const share = 100 * (1 - ((S - 2) / S) ** 3)
  console.log(`  ${String(S).padStart(4)}   ${share.toFixed(1).padStart(13)}%   ${(results[S].surface * 8).toFixed(2).padStart(22)} ms`)
}

console.log('\n⚠ Server numbers. The ruling target is a phone — run /shimmer/dev?mode=meshbench there.')
