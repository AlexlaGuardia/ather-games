/**
 * EVERY BUCKET IS IN FRAME, AT EVERY WINDOW SHAPE.
 *
 * ★★★ WHAT THIS CATCHES (2026-09-01). `dev/break` shipped for four days cropping its FIRST bucket
 * off the left edge — stone, the one its caption argues from. Nothing looked broken: the scene
 * rendered perfectly and simply held six of the seven things it exists to compare, while the
 * caption below went on naming all seven.
 *
 * ⚠ THE ASSERT IS THE AFFORDANCE, NOT THE ARITHMETIC. It would be easy and useless to check that
 * `fitDistance` returns some particular number — that is a mirror of the implementation and would
 * agree with it however wrong both were. What a reader of this page needs is *can I see every
 * bucket*, so that is what gets asserted: at the distance the page actually uses, the OUTER EDGE of
 * the outermost block on each side lands inside the frustum's half-width. PATTERNS 2026-08-22 —
 * assert the affordance, not the membership.
 *
 * ⚠ AND IT SWEEPS SHAPES THE AUTHOR DID NOT PICK. The original bug was invisible at 1900px and
 * present at 1500px, so a single-viewport check is how it survived. A guard sized against the one
 * window somebody happened to open is sized against that window.
 *
 * Run: `npx tsx src/app/shimmer/dev/break/framing.test.ts` (repo convention — there is no vitest).
 */
import { blockX, fitDistance, halfWidthAt, rowHalfSpan, BLOCK_HALF, MIN_CAMERA_Z } from './framing'
import { ALL_BUCKETS } from '../../voxel3d/break-fx-spec'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else fails.push(label)
}

/** The page's real fov. If this changes there, it must change here — and the sweep below will say so. */
const FOV = 50

// ⚠ The count is the SHIPPED bucket list, not a literal. An eighth bucket must widen this guard by
// existing, exactly as it widens the page.
const LIVE_COUNT = ALL_BUCKETS.length
ok(LIVE_COUNT >= 2, `BLIND: ALL_BUCKETS has ${LIVE_COUNT} entries — with fewer than 2 the centring assert cannot discriminate`)

// ── 1. THE ROW IS CENTRED ─────────────────────────────────────────────────────────────────────
// The original defect exactly: `i * 2 - count` puts 7 blocks at -7..+5, centred on -1.
for (const count of [2, 3, 5, 6, 7, 8, 11, LIVE_COUNT]) {
  const xs = Array.from({ length: count }, (_, i) => blockX(i, count))
  const lo = Math.min(...xs), hi = Math.max(...xs)
  ok(Math.abs(lo + hi) < 1e-9, `ROW OFF CENTRE at count=${count}: spans ${lo}..${hi}, which is centred on ${(lo + hi) / 2} rather than 0`)
}

// ── 2. THE BLOCKS DO NOT OVERLAP AND KEEP THEIR ORDER ─────────────────────────────────────────
// ★ Without this, a "centred" row could be centred by collapsing every block onto the origin.
// Ask of any passing guard: what is the cheapest wrong answer that still satisfies it?
{
  const xs = Array.from({ length: LIVE_COUNT }, (_, i) => blockX(i, LIVE_COUNT))
  let ascending = true, clear = true
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] <= xs[i - 1]) ascending = false
    if (xs[i] - xs[i - 1] < 2 * BLOCK_HALF) clear = false
  }
  ok(ascending, 'BLOCKS OUT OF ORDER: left-to-right in the caption must be left-to-right in the scene')
  ok(clear, 'BLOCKS OVERLAP: adjacent cubes are closer than their own width')
}

// ── 3. THE WHOLE ROW FITS, AT EVERY SHAPE ─────────────────────────────────────────────────────
// The affordance. Real viewports plus deliberately hostile ones: a phone in portrait is the case
// that breaks a hand-picked camera distance first.
const SHAPES: [number, number, string][] = [
  [1920, 1080, 'desktop 16:9'],
  [1900, 900, 'the width the bug was INVISIBLE at'],
  [1500, 1000, 'the width the bug was PRESENT at'],
  [1440, 900, 'laptop'],
  [1280, 800, 'small laptop'],
  [1024, 768, '4:3'],
  [900, 700, 'small window'],
  [760, 640, 'narrow'],
  [520, 900, 'phone portrait'],
  [390, 844, 'iPhone portrait'],
]
for (const [w, h, why] of SHAPES) {
  const aspect = w / h
  const z = fitDistance(LIVE_COUNT, FOV, aspect)
  const halfW = halfWidthAt(z, FOV, aspect)
  const outerEdge = Math.max(...Array.from({ length: LIVE_COUNT }, (_, i) => Math.abs(blockX(i, LIVE_COUNT)))) + BLOCK_HALF
  ok(outerEdge <= halfW + 1e-9,
    `CROPPED at ${w}x${h} (${why}): outermost bucket reaches ${outerEdge.toFixed(2)} but the frame only shows ${halfW.toFixed(2)} — a reader would see ${LIVE_COUNT - 1} of ${LIVE_COUNT} buckets while the caption names all ${LIVE_COUNT}`)
}

// ── 4. THE CAMERA ONLY EVER PULLS BACK ────────────────────────────────────────────────────────
// ⚠ A "fit" that moves the camera CLOSER on a wide monitor would silently restyle the page for
// everyone with a big screen, which is a look change wearing a bug fix's clothes.
for (const [w, h] of SHAPES) {
  const z = fitDistance(LIVE_COUNT, FOV, w / h)
  ok(z >= MIN_CAMERA_Z - 1e-9, `CAMERA CAME CLOSER than the authored framing at ${w}x${h}: ${z.toFixed(2)} < ${MIN_CAMERA_Z}`)
}

// ── 5. MORE BUCKETS MEANS MORE ROOM ───────────────────────────────────────────────────────────
// The property that makes this survive an eighth bucket. Not an arithmetic restatement: it asserts
// the DIRECTION, which is what a hardcoded distance gets wrong.
{
  const a = 1500 / 1000
  let monotonic = true
  for (let n = 2; n < 20; n++) {
    if (rowHalfSpan(n + 1) <= rowHalfSpan(n)) monotonic = false
    if (fitDistance(n + 1, FOV, a) < fitDistance(n, FOV, a)) monotonic = false
  }
  ok(monotonic, 'ADDING A BUCKET DID NOT WIDEN THE VIEW: the camera must pull back as the row grows, or the next bucket crops the first one again')
}

// ── 6. A NARROWER WINDOW PULLS BACK FURTHER ───────────────────────────────────────────────────
{
  const wide = fitDistance(LIVE_COUNT, FOV, 1920 / 1080)
  const narrow = fitDistance(LIVE_COUNT, FOV, 390 / 844)
  ok(narrow > wide, `NARROW WINDOW DID NOT PULL BACK: phone portrait sits at ${narrow.toFixed(2)} against desktop ${wide.toFixed(2)}`)
}

console.log(`break-framing: ${pass} pass, ${fails.length} fail  (${LIVE_COUNT} buckets, ${SHAPES.length} window shapes)`)
if (fails.length) {
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
