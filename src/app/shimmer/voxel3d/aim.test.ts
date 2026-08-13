// The entity-aim oracle. Run: npx tsx src/app/shimmer/voxel3d/aim.test.ts
//
// This file exists because the bug it guards against is the *absence* of a check: for months E
// talked to Greg with your back turned, and nothing about that looks broken from inside the code —
// a radius test is correct code answering the wrong question. So the asserts here are written as
// PLAYER SENTENCES ("standing behind him", "through the gate wall"), not as slab-test algebra. If
// the geometry is ever rewritten, these should still read as the rules of the game.
//
// ⚠ Every ray below is UNIT LENGTH. `rayBox` returns a world distance and the caller compares it
// against a voxel raycast's `distance`, so a non-unit direction silently rescales range — the kind
// of thing that shows up as "sometimes I can talk to him from further away".

import { rayBox, aimedAt, bodyBox, AIM_PAD, type Box3 } from './aim'
import { GREG_BOUNDS } from './greg'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number | null, b: number, m: string) => ok(a !== null && Math.abs(a - b) < 1e-6, m)

/** A 1×1×1 box centred on (5, 0.5, 0) — a thing standing five blocks east of the origin. */
const BOX: Box3 = { x0: 4.5, y0: 0, z0: -0.5, x1: 5.5, y1: 1, z1: 0.5 }

// ── 1. ★ THE BUG: facing it hits, facing away misses ────────────────────────────────────────────
// The whole feature in two lines. A radius test passes both of these, which is why it was wrong.
{
  near(rayBox(0, 0.5, 0, 1, 0, 0, BOX, 10), 4.5, 'looking straight at it: enters at the near face')
  ok(rayBox(0, 0.5, 0, -1, 0, 0, BOX, 10) === null, 'back turned: the same standing spot, no hit')
}

// ── 2. RANGE IS MEASURED TO THE NEAR FACE, ALONG THE RAY ────────────────────────────────────────
// Not centre-to-centre. Centre distance makes a tall body reachable from further away when you aim
// at its feet than at its head — invisible, and it feels like the game is deciding at random.
{
  ok(rayBox(0, 0.5, 0, 1, 0, 0, BOX, 4.4) === null, 'reach 4.4 falls short of a face at 4.5')
  near(rayBox(0, 0.5, 0, 1, 0, 0, BOX, 4.5), 4.5, 'reach 4.5 exactly touches it')
}

// ── 3. THE AXIS-ALIGNED RAY ─────────────────────────────────────────────────────────────────────
// A player standing still and turning passes through dy === 0 and dz === 0 exactly, so these are
// the commonest rays in the game, not edge cases. (They are ALSO the only place a `0/0` can appear
// — see rayBox's header for why that turns out not to matter, and why the branch stays anyway.)
{
  const t = rayBox(0, 0.5, 0, 1, 0, 0, BOX, 10)
  ok(t !== null && Number.isFinite(t), 'dy = dz = 0 exactly: a finite answer, not NaN')
  ok(rayBox(0, 9, 0, 1, 0, 0, BOX, 10) === null, 'parallel and outside the slab: a clean miss')
  // Eye exactly level with a face, on a zero component — the 0/0 case, spelled out.
  ok(rayBox(0, BOX.y0, 0, 1, 0, 0, BOX, 10) !== null, 'eye exactly on the bottom face: still a hit')
  ok(rayBox(0, BOX.y1, 0, 1, 0, 0, BOX, 10) !== null, 'eye exactly on the top face: still a hit')
}

// ── 4. ABOVE AND BELOW ──────────────────────────────────────────────────────────────────────────
// Jumping over Greg's head used to be talk range. Now it is a miss, and looking DOWN at him is not.
{
  ok(rayBox(0, 6, 0, 1, 0, 0, BOX, 10) === null, 'flying over it, aim level: no hit')
  ok(rayBox(5, 6, 0, 0, -1, 0, BOX, 10) !== null, 'directly above, looking down: hit')
}

// ── 5. INSIDE THE BOX IS DISTANCE ZERO ──────────────────────────────────────────────────────────
// Standing inside a presence's silhouette must not read as "not aimed at it" — the one case where
// a bare slab test can return a negative t and be discarded by a `t >= 0` guard written elsewhere.
{
  near(rayBox(5, 0.5, 0, 0, 0, 1, BOX, 10), 0, 'origin inside: enters at 0, whatever way you face')
}

// ── 6. ★ OCCLUSION: no talking through a wall ───────────────────────────────────────────────────
// `blockDist` is the reticle raycast's own hit. Aim alone would be WORSE than the radius it
// replaces: the radius at least required you to be standing next to him.
{
  ok(aimedAt(0, 0.5, 0, 1, 0, 0, BOX, 10, Infinity), 'clear line of sight: aimed')
  ok(!aimedAt(0, 0.5, 0, 1, 0, 0, BOX, 10, 2), 'a block at 2 in front of a body at 4.5: not aimed')
  ok(aimedAt(0, 0.5, 0, 1, 0, 0, BOX, 10, 9), 'a block BEHIND the body does not block it')
}

// ── 7. THE PAD IS REAL SLACK, AND IT IS BOUNDED ─────────────────────────────────────────────────
// Greg's arms are 0.16 wide. Unpadded, talking to him at four blocks is pixel-hunting. Padded, the
// crosshair still has to be ON him — assert both halves, or a pad that grew to 3 would pass too.
{
  const bare = bodyBox(0, 0, 0, 2, 0.5, 0)
  const padded = bodyBox(0, 0, 0, 2, 0.5)
  const graze = (b: Box3) => rayBox(0.5 + AIM_PAD / 2, 1, -5, 0, 0, 1, b, 10)
  ok(graze(bare) === null, 'a shoulder-width miss really misses the bare body')
  ok(graze(padded) !== null, 'the pad forgives it — this is why the pad exists')
  ok(rayBox(0.5 + AIM_PAD + 0.2, 1, -5, 0, 0, 1, padded, 10) === null,
    'and the pad still ends: aiming clearly past him is still a miss')
}

// ── 8. GREG'S OWN BODY, AT THE HEIGHTS A PLAYER ACTUALLY LOOKS FROM ─────────────────────────────
// Uses the real `GREG_BOUNDS` rather than invented numbers, so making him taller in `greg.ts`
// without thinking about the hitbox shows up here rather than in a player's confusion.
{
  const feetY = 40                                     // whatever column he stands on
  const box = bodyBox(10.5, 10.5, feetY + GREG_BOUNDS.y0, feetY + GREG_BOUNDS.y1, GREG_BOUNDS.halfW)
  const eye = feetY + 1.62                             // the voxel walker's eye, per world-metrics
  ok(aimedAt(7.5, eye, 10.5, 1, 0, 0, box, 3, Infinity), 'three blocks west, facing east: talk')
  ok(!aimedAt(7.5, eye, 10.5, -1, 0, 0, box, 3, Infinity), 'same spot, facing away: no talk')
  ok(!aimedAt(3.5, eye, 10.5, 1, 0, 0, box, 3, Infinity), 'seven blocks off, facing him: out of reach')
  ok(aimedAt(10.5, eye, 7.5, 0, 0, 1, box, 3, Infinity), 'approached from the south: talk')
  // ★ HE MUST STAND ON THE FLOOR AND REACH ABOUT A PERSON'S HEIGHT. Asserted as the SHAPE, because
  // the failure this catches is not "wrong number" — it is a body that has quietly lost its torso
  // or floated off the ground, which still passes every level-eye test above while making his legs
  // unclickable. Mutating GREG_BOUNDS to the head alone left the whole section green until this.
  ok(GREG_BOUNDS.y0 < 0.35, `Greg's feet are on the ground (y0 = ${GREG_BOUNDS.y0})`)
  ok(GREG_BOUNDS.y1 > 1.5 && GREG_BOUNDS.y1 < 2.2, `Greg is person-height (y1 = ${GREG_BOUNDS.y1})`)
  ok(GREG_BOUNDS.halfW > 0.25 && GREG_BOUNDS.halfW < 0.9, 'Greg is person-width, shoulder to shoulder')
  // And the one a player actually performs: standing close, looking DOWN at his feet.
  ok(aimedAt(9.0, feetY + 1.62, 10.5, 0.8, -0.6, 0, box, 3, Infinity), 'up close, looking down at him: talk')
}

console.log(fails.length ? `aim: ${pass} pass, ${fails.length} FAIL` : `aim oracle ${pass} CLEAN`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
