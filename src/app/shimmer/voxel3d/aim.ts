// Is the crosshair ON that thing? — the entity half of "what am I looking at".
//
// ★ PURE. No three, no DOM, no voxels. The host owns bodies and the world; this file owns the one
// question "does the ray my eye is casting enter that box, close enough to touch, without a wall in
// the way" — and answers it identically for an NPC, a bench and a presence in the mist.
//
// ── ★ WHY THIS EXISTS (Alex, 2026-08-13: "only work when on the item/person you are looking at") ──
// Blocks were already right: chest, pot and place all resolve through the reticle's DDA raycast, so
// a chest opens because the crosshair is on THAT chest. Every ENTITY verb was proximity-only —
// `hypot(dx, dz) <= 3` for Greg, a ±4 box scan for the bench, nearest-within-6 for the mist. Three
// consequences, all of them the same bug wearing different hats:
//   • E talked to Greg with your back turned, from behind a wall, mid-jump over his head
//   • a bench you had walked PAST kept upgrading your craft surface — the recipe list changed for a
//     table that was not in front of you and might not even be in the room
//   • the spar prompt named a presence you could not see, so the consent design ("you approach a
//     spar, you do not trip over one") was satisfied by geometry and undone by the trigger
// A radius answers "am I near it". A player asking to interact is pointing at something. Those are
// different questions and the game was only ever asking the first one.
//
// ── the three gates, and why all three are needed ─────────────────────────────────────────────
//  1. AIM — the ray enters the body's box. This is the ask.
//  2. RANGE — measured ALONG THE RAY to the box's near face, not centre-to-centre. Centre distance
//     lets a tall thing be interactable from further away when you aim at its feet than its head,
//     which is invisible and infuriating; the entry distance is what "close enough to touch" means.
//  3. OCCLUSION — the first solid voxel the SAME ray hit must be further away than the box. Without
//     this, aim alone lets you talk to Greg through the gate wall, which is worse than the radius
//     bug it replaces: the radius at least required you to be standing next to him.
//
// ── the pad, and why it is not zero ───────────────────────────────────────────────────────────
// A bare body box turns talking into pixel-hunting: Greg's arms are 0.16 wide and his head 0.44, so
// at four blocks an unpadded box is a target a few degrees across. `AIM_PAD` inflates every box by
// a third of a block, which is roughly MC's own entity-interaction slack. It is generous on purpose
// — the crosshair must be ON him, but "on him" should mean what a player means by it.

/** A world-space axis-aligned box. Half-open is irrelevant here: this is geometry, not occupancy. */
export interface Box3 {
  x0: number; y0: number; z0: number
  x1: number; y1: number; z1: number
}

/** How much every interaction box is inflated by. See the header — this is aim slack, not a hitbox. */
export const AIM_PAD = 0.3

/**
 * A standing body's box: centred on (cx, cz), rising from `y0` to `y1`, inflated by `pad`.
 * The mesh that draws the body should be the thing that supplies these numbers — a second set of
 * dimensions written here would drift from the first the day someone makes Greg taller.
 */
export function bodyBox(
  cx: number, cz: number, y0: number, y1: number, halfW: number, pad = AIM_PAD,
): Box3 {
  return {
    x0: cx - halfW - pad, x1: cx + halfW + pad,
    y0: y0 - pad, y1: y1 + pad,
    z0: cz - halfW - pad, z1: cz + halfW + pad,
  }
}

/**
 * Slab test. Returns the distance along the ray at which it ENTERS the box, `0` when the origin is
 * already inside it, or `null` on a miss or a hit beyond `maxDist`.
 *
 * ⚠ The direction must be unit length — the return value is a world distance, and the caller
 * compares it against a block-raycast distance measured on the same assumption. `camera
 * .getWorldDirection` gives a unit vector, which is where every caller here gets its ray.
 *
 * ★ The zero-component case is branched on explicitly, and the honest reason is NOT the one this
 * comment first claimed. I wrote "otherwise it produces NaN and the verb goes dead", then mutation-
 * tested it: deleting the branch does not change a single answer. `1/0` is ±Infinity, which clips
 * the interval correctly for a ray that misses the slab; the only NaN is `0/0`, when the origin sits
 * exactly ON a face, and NaN loses every comparison in this function, so it is silently skipped —
 * which lands on the right answer, because an origin on the face IS inside the slab.
 * The branch stays because it says what it means and it survives a refactor that flips one of those
 * comparisons (at which point the NaN would start winning instead of losing). It is not load-bearing
 * today, and a future reader deserves to know that rather than "verify" a fiction.
 */
export function rayBox(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  b: Box3, maxDist: number,
): number | null {
  let tMin = 0
  let tMax = maxDist

  // One axis at a time; each clips the surviving interval. An empty interval is a miss.
  const axis = (o: number, d: number, lo: number, hi: number): boolean => {
    if (d > -1e-9 && d < 1e-9) return o >= lo && o <= hi   // parallel: in the slab, or never
    let t0 = (lo - o) / d
    let t1 = (hi - o) / d
    if (t0 > t1) { const s = t0; t0 = t1; t1 = s }
    if (t0 > tMin) tMin = t0
    if (t1 < tMax) tMax = t1
    return tMin <= tMax
  }

  if (!axis(ox, dx, b.x0, b.x1)) return null
  if (!axis(oy, dy, b.y0, b.y1)) return null
  if (!axis(oz, dz, b.z0, b.z1)) return null
  return tMin
}

/**
 * The whole gate: aimed at, in range, and not through a wall.
 *
 * @param maxDist   how far you can reach this kind of thing, along the ray
 * @param blockDist distance to the first solid voxel this same ray hit — `Infinity` when it hit
 *                  nothing. Pass the reticle raycast's own `hit.distance`; running a second ray
 *                  would let the crosshair and the verb disagree about what is in front of you,
 *                  which is the exact failure the build ghost's comment already warns about.
 */
export function aimedAt(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  b: Box3, maxDist: number, blockDist: number,
): boolean {
  const t = rayBox(ox, oy, oz, dx, dy, dz, b, maxDist)
  return t !== null && t <= blockDist
}
