/**
 * Where the bucket blocks stand, and how far back the camera has to be to see all of them.
 *
 * ★★★ WHY THIS IS A MODULE AND NOT TWO EXPRESSIONS INSIDE THE PAGE (2026-09-01). `dev/break` was
 * cropping its FIRST bucket off the left edge, and the first bucket is **stone** — the one the
 * caption builds its whole argument on (*"stone should snap and die"*). Two faults stacked:
 *
 *   1. The row was laid out as `i * 2 - count`, which for 7 blocks runs x = -7 … +5 and is centred
 *      on **-1**, not 0. Off by one SPACING, not one unit.
 *   2. Even centred, ±6.5 of cubes does not fit inside the ±6.30 half-width the frustum gives at
 *      fov 50, z 9, at a 1500x1000 viewport.
 *
 * ⚠ A CROPPED LOOKING-GLASS IS A PARTICULARLY BAD FAILURE: nothing is missing from the SCENE, so
 * the page renders perfectly and simply is not showing you one of the things it exists to compare.
 * The caption went on saying *"left to right: stone, crystal, …"* while stone was off-screen. The
 * only reason it was caught is that the caption named seven and the picture held six.
 *
 * ⚠ AND THE OBVIOUS FIX — A BIGGER `z` LITERAL — IS THE ONE THAT COMES BACK. It settles whatever
 * window you happened to test and silently re-crops on a laptop, a phone, or the day an eighth
 * bucket joins `ALL_BUCKETS`. So the distance is DERIVED from the things that decide it: the block
 * count, the fov and the live aspect.
 *
 * These live in their own module so `framing.test.ts` can assert the real geometric invariant
 * rather than re-typing the formula next to it. A test that restates its subject's arithmetic is a
 * mirror, and a mirror agrees with its source right up until it does not (PATTERNS 2026-08-22).
 */

/** Blocks sit on a line at this spacing, in world units. A block is 1 unit wide. */
export const BLOCK_SPACING = 2
/** Half of a block's width — its outer edge relative to its centre. */
export const BLOCK_HALF = 0.5
/** A little air either side, so the outermost bucket is not flush against the frame. */
export const EDGE_MARGIN = 0.5
/** The authored framing. The camera never comes closer than this, it only pulls back. */
export const MIN_CAMERA_Z = 9

/**
 * The x of block `i` of `count`, centred on the origin.
 *
 * ⚠ The subtrahend is `count - 1`, NOT `count`: there are `count - 1` GAPS between `count` blocks,
 * so the span is `(count - 1) * SPACING` and half of it is `count - 1` at spacing 2. Using `count`
 * shifts the whole row half a spacing to the left, which is the bug this module was written for.
 */
export function blockX(i: number, count: number): number {
  return i * BLOCK_SPACING - (count - 1)
}

/** Distance from the origin to the outer edge of the outermost block, plus margin. */
export function rowHalfSpan(count: number): number {
  if (count <= 0) return 0
  return (count - 1) + BLOCK_HALF + EDGE_MARGIN
}

/**
 * How far back the camera must sit for the whole row to fit horizontally.
 *
 * A perspective camera's half-height at distance z is `z * tan(fov/2)`; the half-WIDTH is that
 * times the aspect. Invert it for the z that makes half-width equal the span we need.
 */
export function fitDistance(count: number, fovDeg: number, aspect: number): number {
  const halfFov = (fovDeg * Math.PI) / 360
  const safeAspect = aspect > 0 ? aspect : 1
  const needed = rowHalfSpan(count) / (Math.tan(halfFov) * safeAspect)
  return Math.max(MIN_CAMERA_Z, needed)
}

/** The frustum's half-width at distance z — what the camera can actually show. */
export function halfWidthAt(z: number, fovDeg: number, aspect: number): number {
  const halfFov = (fovDeg * Math.PI) / 360
  return z * Math.tan(halfFov) * (aspect > 0 ? aspect : 1)
}
