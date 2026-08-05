/**
 * chunk-stream oracle. Run: `npx tsx src/app/shimmer/world/chunk-stream.test.ts`
 *
 * The load-bearing one: mounted chunk count must be bounded by the RADIUS and not by the world,
 * because that is the entire reason streaming exists. It is asserted against a deliberately absurd
 * world size so a regression cannot hide behind a small test map.
 */
import {
  CHUNK, DEFAULT_RADIUS, chunkOf, sameChunk, chunkVisible, visibleChunks,
  viewFar, fogNear, windowSize,
} from './chunk-stream'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, label: string) => { c ? pass++ : fails.push(label) }

// ── 1. chunk coords ───────────────────────────────────────────────────────────────────────
ok(chunkOf(0, 0).cx === 0 && chunkOf(0, 0).cy === 0, 'tile 0,0 is chunk 0,0')
ok(chunkOf(CHUNK - 1, 0).cx === 0, 'the last tile of a chunk is still that chunk')
ok(chunkOf(CHUNK, 0).cx === 1, 'the next tile crosses into the next chunk')
ok(chunkOf(-1, -1).cx === -1 && chunkOf(-1, -1).cy === -1,
  'negative tiles floor correctly — a world may extend past the origin')
ok(sameChunk(chunkOf(3, 3), chunkOf(60, 60)), 'two tiles in one chunk compare equal')
ok(!sameChunk(chunkOf(3, 3), chunkOf(70, 3)), '...and across a boundary they do not')
ok(!sameChunk(null, chunkOf(0, 0)), 'a null center is never "the same chunk" (first frame)')

// ── 2. ★ THE BOUND — mounted count depends on the radius, not the world ───────────────────
const huge = visibleChunks({ cx: 500, cy: 500 }, 100_000, 100_000, DEFAULT_RADIUS)
ok(huge.length === windowSize(DEFAULT_RADIUS),
  `★ a 100,000x100,000 world still mounts only ${windowSize(DEFAULT_RADIUS)} chunks`)
ok(windowSize(3) === 49, 'radius 3 is a 7x7 window = 49 chunks')
ok(windowSize(1) === 9 && windowSize(0) === 1, 'the window formula holds at the small end')
// the same window regardless of how much world surrounds it
const w1 = visibleChunks({ cx: 500, cy: 500 }, 100_000, 100_000)
const w2 = visibleChunks({ cx: 500, cy: 500 }, 1_000_000, 1_000_000)
ok(w1.length === w2.length, 'growing the world 10x does not mount one extra chunk')

// ── 3. clamping at the map edge ───────────────────────────────────────────────────────────
const corner = visibleChunks({ cx: 0, cy: 0 }, 400, 400)
ok(corner.every((c) => c.cx >= 0 && c.cy >= 0), 'no chunk outside the map is mounted')
ok(corner.length < windowSize(), 'a corner mounts fewer than a full window')
ok(corner.some((c) => c.cx === 0 && c.cy === 0), '...but always the one you are standing in')
const small = visibleChunks({ cx: 0, cy: 0 }, 100, 100)   // a 100x100 map is 2x2 chunks
ok(small.length === 4, 'a small map mounts all of itself and nothing more')

// ── 4. the window is square, not round ────────────────────────────────────────────────────
// A circular window unmounts the diagonal corners, which are plainly visible across a screen corner.
ok(chunkVisible({ cx: 3, cy: 3 }, { cx: 0, cy: 0 }, 3), 'the far diagonal corner IS mounted')
ok(!chunkVisible({ cx: 4, cy: 0 }, { cx: 0, cy: 0 }, 3), 'one step beyond the radius is not')
ok(chunkVisible({ cx: 0, cy: 0 }, { cx: 0, cy: 0 }, 0), 'radius 0 still mounts your own chunk')

// ── 5. near-to-far ordering — matters the frame after a warp ──────────────────────────────
const ordered = visibleChunks({ cx: 10, cy: 10 }, 100_000, 100_000)
ok(ordered[0].cx === 10 && ordered[0].cy === 10, 'the chunk you stand in is mounted first')
const d = (c: { cx: number; cy: number }) => Math.abs(c.cx - 10) + Math.abs(c.cy - 10)
ok(ordered.every((c, i) => i === 0 || d(ordered[i - 1]) <= d(c)), 'chunks are ordered near to far')

// ── 6. ★ sight must not out-range the mounted window ──────────────────────────────────────
// If the camera draws further than the furthest mounted chunk, the player watches the world end.
for (const r of [1, 2, 3, 5]) {
  ok(viewFar(r) < r * CHUNK, `radius ${r}: the far plane stays inside the mounted window`)
  ok(fogNear(r) < viewFar(r), `radius ${r}: haze starts before the far plane, so geometry fades`)
  ok(fogNear(r) > 0, `radius ${r}: the haze does not start at the camera`)
}
ok(viewFar(3) > CHUNK, 'the default view is still more than one chunk — this is not a tunnel')

console.log(`\nchunk-stream: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
console.log(`✅ ${windowSize(DEFAULT_RADIUS)} chunks max at any world size\n`)
