// The map-marker heading oracle. Run: npx tsx src/app/shimmer/voxel3d/map-heading.test.ts
//
// This exists because the marker shipped pointing exactly backwards and nobody could have caught it
// by reading the code — a sign error here produces a perfectly plausible-looking arrow. The asserts
// are written as COMPASS SENTENCES rather than as algebra, so the convention survives a rewrite:
// if someone re-derives this from scratch, these still say what "facing north" has to look like.
//
// The canvas contract being pinned: a marker is drawn along +x and rotated by `screenHeading`.
// Screen +x is east, screen +y is SOUTH (down). North is therefore -π/2, not +π/2.

import { screenHeading } from './map-heading'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, m: string) => ok(Math.abs(a - b) < 1e-9, `${m} (got ${a.toFixed(4)}, want ${b.toFixed(4)})`)

const H = Math.PI / 2

// ── the four compass points ────────────────────────────────────────────────────────────────────
{
  near(screenHeading(1, 0), 0, 'looking EAST points right along the screen')
  near(screenHeading(0, 1), H, 'looking SOUTH (+z) points DOWN the screen')
  near(Math.abs(screenHeading(-1, 0)), Math.PI, 'looking WEST points left')
  near(screenHeading(0, -1), -H, '★ looking NORTH (-z) points UP the screen — NOT down')
}

// ── ★ THE BUG THIS FILE EXISTS FOR: the marker must never be 180° out ──────────────────────────
// Asserted as a property over the whole circle rather than at a few points, because "backwards"
// was exactly what shipped and it passes any single-axis spot check you happen to write.
{
  let worst = 0
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 - Math.PI
    const h = screenHeading(Math.cos(a), Math.sin(a))
    // The heading must reproduce the direction it was given. Compare as unit vectors so the
    // ±π wrap cannot make a correct answer look wrong.
    const dx = Math.cos(h) - Math.cos(a), dz = Math.sin(h) - Math.sin(a)
    worst = Math.max(worst, Math.hypot(dx, dz))
  }
  ok(worst < 1e-9, `★ the marker points where the camera looks, all the way round (worst ${worst.toExponential(1)})`)
}

// ── the diagonals, spelled out so a quarter-turn error cannot hide between axes ─────────────────
{
  near(screenHeading(1, 1), H / 2, 'south-east is half a right angle down from east')
  near(screenHeading(-1, -1), -Math.PI + H / 2, 'north-west mirrors it')
}

// ── a still camera does not produce NaN ────────────────────────────────────────────────────────
// Looking straight down zeroes the horizontal vector. A NaN rotation removes the marker from the
// canvas entirely, which reads as "the map lost me" — worse than a marker pointing an arbitrary way.
{
  ok(Number.isFinite(screenHeading(0, 0)), 'a zero forward vector gives a finite heading, not NaN')
  near(screenHeading(0, 0), 0, 'and it is a defined direction rather than whatever atan2 returns')
}

// ── magnitude is irrelevant ────────────────────────────────────────────────────────────────────
// The caller passes the camera's forward vector, which is unit length today. If that ever changes
// (a scaled aim, a velocity), the heading must not move.
{
  near(screenHeading(7, 0), screenHeading(0.01, 0), 'only the direction is read, not the length')
  near(screenHeading(3, -3), screenHeading(1, -1), 'and that holds off-axis too')
}

console.log(fails.length ? `map-heading: ${pass} pass, ${fails.length} FAIL` : `map-heading oracle ${pass} CLEAN`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
