// Which way the keeper is facing, ON THE MAP.
//
// ★ Its own module for one reason: this is the kind of maths that is wrong by a sign or a quarter
// turn and cannot be caught by reading it. The first cut shipped the marker pointing exactly
// backwards (Alex: "its facing the wrong direction"), and every plausible fix — negate the yaw,
// flip the rotate, swap the atan2 args — looks equally right on the page. So the convention is
// stated once here, asserted against the four compass points, and imported by both the world and
// the map instead of being re-derived at each end.
//
// ── the two coordinate spaces, written down ────────────────────────────────────────────────────
// WORLD: the camera's forward vector is (aim.x, aim.z). +x is east, +z is SOUTH.
// MAP:   north-up, so screen +x is east and screen +y is south — i.e. world z maps straight to
//        screen y with no flip. That is the whole reason this is easy to get wrong: it looks like
//        it needs a flip (screen y usually points the other way from a world axis) and it does not.
//
// A canvas rotation of θ turns the +x axis toward +y — clockwise on screen, because y is down. So a
// marker drawn along +x and rotated by `screenHeading` points exactly where the camera looks.

/**
 * Camera forward (world x/z) → canvas rotation, in radians.
 *  east  (1, 0)  →  0
 *  south (0, 1)  →  +π/2   (down the screen)
 *  west  (-1, 0) →  π
 *  north (0, -1) →  -π/2   (up the screen)
 *
 * The vector need not be normalised; only its direction is read. A zero vector returns 0 rather
 * than NaN — a marker that vanishes because the camera looked straight down is a worse bug than a
 * marker that briefly points east.
 */
export function screenHeading(aimX: number, aimZ: number): number {
  if (aimX === 0 && aimZ === 0) return 0
  return Math.atan2(aimZ, aimX)
}
