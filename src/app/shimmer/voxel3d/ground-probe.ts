/**
 * ── ★ THE LIVE GROUND LINE, AS A PURE FUNCTION (extracted 2026-08-28) ─────────────────────────
 *
 * This was `VoxelWorld`'s `groundTopNear` closure and nothing else changed when it moved. It is out
 * here because of what it cost while it was in there: **the Hollows spent an unknown number of
 * nights perched in the canopy and 469 lines of `hollows.test.ts` could not see it**, since every
 * fixture in that file hands `hollowStep` a FLAT ground function. A flat function cannot ratchet.
 * The defect lived in the composition of the host's closure with the body's step, which is exactly
 * the seam a test that stubs one half can never reach.
 *
 * ⚠ SO THE ORACLE MUST IMPORT THIS, NEVER RESTATE IT. A hand-kept copy of a window scan would agree
 * with the original on the day it was written and drift silently afterwards, and agreement between
 * a copy and its source is not evidence about either.
 *
 * ── WHY THE WINDOW IS ASYMMETRIC, WHICH IS THE WHOLE FIX ──────────────────────────────────────
 * The old signature took ONE `span` and looked that far in both directions. Downward that is right:
 * a body can be any distance above its own ground (it hovers, it just walked off a ledge) and the
 * probe has to find the floor. Upward it answers a question nobody asked. **Nothing that walks
 * needs to know about a surface it could not possibly climb onto** — and in a forest that surface
 * is the canopy, four blocks over a warden's head and thirteen blocks thick.
 *
 * ★★ THAT ASYMMETRY IS WHAT BREAKS THE RATCHET. When the caller derives `fromY` from this
 * function's own previous answer — which every walking body does, because its height IS its ground
 * line plus a hover — a symmetric window is a positive feedback loop: each answer lifts the window,
 * a lifted window reaches higher leaves, higher leaves lift the answer. Measured on a real trunk it
 * climbs about 8 blocks per frame and settles on the canopy top. Bounding the UP half to what the
 * body can actually climb closes the loop at its source, and it closes it for every caller at once
 * rather than for the one that was noticed.
 */

/**
 * The y of the topmost solid block near `fromY`, i.e. what `columnHeight` returns but true — it
 * sees mining, building and conjured terrain, which a pure generator query never can.
 *
 * @param solid   is this cell solid? (the host binds its voxel read)
 * @param up      how far ABOVE `fromY` to look. Bound this to what the asker can climb.
 * @param down    how far BELOW `fromY` to look.
 * @param ceiling world height limit, exclusive of nothing — the scan is clamped to it
 * @param fallback answer when the whole window is air, so a body degrades to the generator's line
 *                 rather than dropping through the floor
 */
export function topSolidNear(
  solid: (x: number, y: number, z: number) => boolean,
  x: number, z: number, fromY: number,
  up: number, down: number, ceiling: number,
  fallback: (xi: number, zi: number) => number,
): number {
  const xi = Math.floor(x), zi = Math.floor(z)
  const top = Math.min(ceiling, Math.floor(fromY) + up)
  const bottom = Math.max(0, Math.floor(fromY) - down)
  for (let y = top; y >= bottom; y--) {
    if (solid(xi, y, zi)) return y
  }
  return fallback(xi, zi)
}
