// Run: npx tsx src/app/shimmer/voxel/bubble.test.ts
//
// ★ THE POINT OF THIS FILE IS THAT THE SHELL HOLDS EVERYWHERE AND THE SEAM STILL CROSSES — two
// claims that cannot be checked by looking at a sphere 2km across.
//
// A player never sees this object whole. They see a wall of cloud curving away in both directions,
// and at that scale a hole and an unbroken wall are the same picture. So the wall is asked as a
// reachability question (flood it), and the seam is asked as a trigger question (does the crossing
// fire exactly there and nowhere else) — because since 2026-08-15 the seam is a VOLUME, not a cut.

import {
  DEFAULT_BUBBLE, bubbleMaterialAt, insideShell, inShell, inPassage, inPassageVolume,
  shellRadiusAt, distFromAxis, bubbleSwallows, shellCapTop, lobeAt, maxShellRadius,
  type BubbleConfig,
} from './bubble'
import { AIR } from './section'

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++ } else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const SEED = 1
const WALL = DEFAULT_BUBBLE.materials.wall
/** A stand-in for the Wilds' surface altitude — the host passes the real one. */
const GROUND = 100

// ★ Testing a radius-1000 shell by sweeping every column is 12.5M columns per pass. The geometry is
// scale-free, so the asserts run on a SMALL bubble and the full-size one is checked where it counts
// (the doorway's angular width, below). A test that is too slow to run is a test nobody runs.
const SMALL: BubbleConfig = { ...DEFAULT_BUBBLE, radius: 60, passageWidth: 4 }
const R = SMALL.radius + SMALL.thickness + 8

function* columns(): Generator<[number, number]> {
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) yield [x, z]
}

// ── the shell exists and sits where it says ───────────────────────────────────
console.log('the shell')
{
  let shellCols = 0, insideCols = 0
  for (const [x, z] of columns()) {
    if (inShell(x, z, SEED, SMALL)) shellCols++
    if (insideShell(x, z, SEED, SMALL)) insideCols++
  }
  check('the shell is a ring of columns', shellCols > 200, `${shellCols}`)
  check('it contains an interior', insideCols > 5000, `${insideCols}`)

  // Inside and shell are disjoint — if they overlapped, the interior would be walled at every cell
  // and the "skip streaming it" contract would be meaningless.
  let both = 0
  for (const [x, z] of columns()) if (insideShell(x, z, SEED, SMALL) && inShell(x, z, SEED, SMALL)) both++
  check('interior and shell never overlap', both === 0, `${both} columns`)

  check('the wall is solid at head height',
    bubbleMaterialAt(SMALL.radius + 1, GROUND + 2, 0, SEED, GROUND, { ...SMALL, passageBearing: Math.PI }) === WALL)
  // ⚠ ASKED OF `shellCapTop`, NOT OF `topY + 1`. Since the cap crowns, `topY` is the MEAN height of
  // the lid and a column whose puff stands proud is still solid well above it — the old form of this
  // assert was not a stricter test, it was a test of a number that no longer describes the wall.
  //
  // ⚠ AND THE COLUMN IS DERIVED, NOT `radius + 1`. With the bulge at ±3% that literal lands INSIDE
  // the wall on some bearings and outside it on others, so the assert would have been reporting the
  // seed rather than the cap. `lobeAt` reads the bearing alone, so any point on this ray answers for
  // the whole ray.
  const SEALED: BubbleConfig = { ...SMALL, passageBearing: Math.PI }
  const capX = Math.floor(shellRadiusAt(100, 0, SEED, SEALED)) + 1
  const cap = shellCapTop(capX, 0, SEED, SEALED)
  check('the wall stops at its own top', bubbleMaterialAt(capX, cap + 1, 0, SEED, GROUND, SEALED) === null, `cap ${cap}`)
  check('and is still wall at that top', bubbleMaterialAt(capX, cap, 0, SEED, GROUND, SEALED) === WALL, `cap ${cap}, x ${capX}`)
  check('the wall stops at its base', bubbleMaterialAt(capX, SEALED.bottomY - 1, 0, SEED, GROUND, SEALED) === null)
}

// ── ★ THE WALL IS A PILE OF CLOUDS, WHICH IS A CLAIM AND NOT A CONFIG VALUE ───
console.log('\nthe pile')
{
  // ★ WHY THIS SECTION EXISTS AT ALL. Every number that makes the shell read as heaped cloud rather
  // than as a tank lives in the config, and a config value proves nothing — it is exactly as true
  // with `wobble: 0`. What has to be asserted is that the SHAPE arrives: that the wall leans in and
  // out by a real amount, that the skyline is not a level line, and that the two agree with each
  // other. Sweep the bearings and measure it.
  const N = 720
  const rs: number[] = [], caps: number[] = [], lobes: number[] = []
  for (let i = 0; i < N; i++) {
    const b = (i / N) * Math.PI * 2
    const x = SMALL.cx + Math.cos(b) * SMALL.radius, z = SMALL.cz + Math.sin(b) * SMALL.radius
    rs.push(shellRadiusAt(x, z, SEED, SMALL))
    caps.push(shellCapTop(x, z, SEED, SMALL))
    lobes.push(lobeAt(x, z, SEED, SMALL))
  }
  const span = (a: number[]) => Math.max(...a) - Math.min(...a)

  // The bulge is real. Stated as a FRACTION of the band the config allows, so it stays true if the
  // radius is ever retuned — and it fails loudly if the lobe field is ever flattened to a constant.
  const band = 2 * SMALL.wobble * SMALL.radius
  check('the wall bulges through most of the band it is given', span(rs) > band * 0.6,
    `${span(rs).toFixed(1)} blocks of a possible ${band.toFixed(1)}`)

  // ★ AND THE SKYLINE IS NOT A LINE. This is the half a player sees from the glade — see
  // `shellCapTop`. A flat lid is the failure mode, so the assert is about SPREAD, not about height.
  check('the skyline is heaped, not level', span(caps) > SMALL.crown,
    `${span(caps)} blocks between the lowest and highest crown`)

  // ★★ THE CLAIM THAT WOULD ROT SILENTLY: bulge and crown are ONE field. Split them onto two noises
  // and every assert above still passes while the wall stops reading as cloud — it becomes a bumpy
  // wall wearing an unrelated bumpy hat. So: the widest bearing must also be the tallest.
  // ⚠ ASSERTED AS AN ORDERING, NOT AS "THE WIDEST IS THE TALLEST". That first form was red by ONE
  // sample out of 720: the cap is rounded to whole blocks, so the two peaks tie and the tie broke
  // the other way. Both quantities are strictly increasing in the same lobe, and rounding is
  // non-decreasing — so walking the bearings in order of radius, the crowns may never step DOWN.
  // Exactly as strong, and it does not depend on where the sampling happens to land.
  const byWidth = [...caps.keys()].sort((a, b) => rs[a] - rs[b])
  let inversion = -1
  for (let i = 1; i < byWidth.length; i++) if (caps[byWidth[i]] < caps[byWidth[i - 1]]) { inversion = i; break }
  check('a puff that bulges out also stands taller', inversion === -1,
    inversion < 0 ? '' : `a wider bearing crowns lower at sample ${inversion} — the crown has come off the bulge's field`)

  // ★ THE BOUNDS ARE EXACT, and two reach-rejects in two files depend on it. A shape that overruns
  // `maxShellReach` does not render wrong — it renders a HOLE, because the reject upstream answers
  // "not mine" and the wall is simply never built there.
  check('nothing reaches past the bound the rejects trust', Math.max(...rs) <= maxShellRadius(SMALL),
    `${Math.max(...rs).toFixed(2)} vs ${maxShellRadius(SMALL).toFixed(2)}`)

  // ★ AND THE PUFFS ARE THE SAME SIZE ON ANY BUBBLE. `lobeFreq` is a radius in noise space walked
  // along the unit circle, so the lobe COUNT is scale-free — which is the only reason this whole
  // file may test a radius-60 stand-in and claim anything about the 500 that ships.
  let crossings = 0
  for (let i = 0; i < N; i++) if ((lobes[i] < 0) !== (lobes[(i + 1) % N] < 0)) crossings++
  const expected = Math.round(Math.PI * 2 * SMALL.lobeFreq)
  check('the puffs are the size the lobe count says', crossings >= expected * 0.4 && crossings <= expected * 2.2,
    `${crossings} sign changes around the ring against ~${expected} lobes`)
  const big: BubbleConfig = { ...SMALL, radius: 500 }
  let bigCrossings = 0
  for (let i = 0; i < N; i++) {
    const b = (i / N) * Math.PI * 2, b2 = ((i + 1) / N) * Math.PI * 2
    const a = lobeAt(Math.cos(b) * 500, Math.sin(b) * 500, SEED, big)
    const c = lobeAt(Math.cos(b2) * 500, Math.sin(b2) * 500, SEED, big)
    if ((a < 0) !== (c < 0)) bigCrossings++
  }
  check('and the shipped radius has the same number of them', bigCrossings === crossings,
    `${bigCrossings} on r500 vs ${crossings} on r${SMALL.radius} — the shape is no longer scale-free`)
}

// ── ★ `null` IS NOT `AIR`, AND THE WILDS DEPENDS ON THE DIFFERENCE ────────────
console.log('\nthe integration contract')
{
  // Ordinary Wilds, far outside the bubble: this module must have NO opinion, at every altitude.
  // If it ever answered AIR out here it would punch a hole in whatever terrain was generated.
  let opinions = 0
  for (let x = R - 4; x <= R; x++) for (let z = R - 4; z <= R; z++)
    for (let y = 0; y < 200; y++) if (bubbleMaterialAt(x, y, z, SEED, GROUND, SMALL) !== null) opinions++
  check('the bubble has no opinion about ordinary Wilds', opinions === 0, `${opinions} cells claimed`)

  // And inside, it must have an opinion at EVERY altitude — a `null` in there lets the Wilds
  // generate ground inside the fold, which is the bug this whole module exists to prevent.
  let unclaimed = 0
  for (let y = 0; y < 200; y++) if (bubbleMaterialAt(0, y, 0, SEED, GROUND, SMALL) !== AIR) unclaimed++
  check('the interior is claimed at every altitude', unclaimed === 0, `${unclaimed} cells`)
}

// ── ★ THE SHELL HOLDS (8-connected, same lesson as the plot's wall) ───────────
console.log('\nthe shell holds')
{
  // Flood from OUTSIDE inward, through everything that is not shell, at head height. Anything that
  // reaches the centre is a hole a player walks through into ungenerated nothing.
  //
  // ★ THIS NOW RUNS AGAINST THE SHIPPED CONFIG, AND THAT IS THE POINT OF THE 08-15 REVERSAL. While
  // the passage was a hole cut through the wall, this test had to SEAL the door first — so the one
  // arrangement never tested was the one that ships. The shell is continuous now, the passage is a
  // trigger volume rather than a cut, and the flood proves the real thing.
  const seen = new Set<string>()
  const stack: [number, number][] = [[R, R]]
  let leaked = 0
  while (stack.length) {
    const [x, z] = stack.pop()!
    const k = `${x},${z}`
    if (seen.has(k)) continue
    seen.add(k)
    if (Math.abs(x) > R || Math.abs(z) > R) continue
    if (bubbleMaterialAt(x, GROUND + 1, z, SEED, GROUND, SMALL) === WALL) continue   // the wall stops it
    if (distFromAxis(x, z, SMALL) < SMALL.radius - SMALL.thickness) { leaked++; continue }
    stack.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1],
               [x + 1, z + 1], [x + 1, z - 1], [x - 1, z + 1], [x - 1, z - 1])
  }
  check('the shell has no way through it at all', leaked === 0,
    `${leaked} interior columns reachable from outside`)
}

// ── the seam crosses, and only there ─────────────────────────────────────────
console.log('\nthe passage')
{
  // ★ A SEAM THAT NEVER FIRES IS THE SAME BUG AS A WALL THAT LEAKS, and it is the likelier one: the
  // seam is an arc a few blocks wide on a circumference of kilometres, so an arithmetic slip in the
  // bearing simply silences it, and nothing about the wall looks wrong.
  const bearingX = Math.round(SMALL.cx + Math.cos(SMALL.passageBearing) * (SMALL.radius + 1))
  const bearingZ = Math.round(SMALL.cz + Math.sin(SMALL.passageBearing) * (SMALL.radius + 1))
  check('the seam column is in the passage', inPassage(bearingX, bearingZ, SMALL))

  // ★ THE WALL IS UNBROKEN THROUGH THE SEAM. Canon: a threshold is "a soft seam… ground that simply
  // continues. No gates, no locks, no keep-out", and "a build that puts a locked gate on a plot has
  // misread the world." A hole is a gate. It is also a walk into an interior that is a separate
  // coordinate space and is never generated — so if the crossing ever failed to fire, the keeper
  // would step through the door into nothing.
  check('the wall is solid at the seam, at the sill',
    bubbleMaterialAt(bearingX, GROUND, bearingZ, SEED, GROUND, SMALL) === WALL)
  check('and solid at head height',
    bubbleMaterialAt(bearingX, GROUND + 2, bearingZ, SEED, GROUND, SMALL) === WALL)

  // ★ BUT THE TRIGGER FIRES THERE — the seam is a volume, not a cut.
  check('the crossing fires in the seam', inPassageVolume(bearingX, GROUND + 1, bearingZ, SEED, GROUND, SMALL))
  check('it does not fire below the ground', !inPassageVolume(bearingX, GROUND - 2, bearingZ, SEED, GROUND, SMALL))
  check('nor above the seam', !inPassageVolume(bearingX, GROUND + SMALL.passageHeight + 1, bearingZ, SEED, GROUND, SMALL))

  // ⚠ THE SEAM FOLLOWS THE GROUND, which is why `h` is a parameter. An earlier cut pinned it to the
  // shell's underground base, so it sat ~100 blocks below the terrain — a trigger a keeper could
  // never reach, with nothing about the wall looking wrong.
  const high = GROUND + 30
  check('the seam moves with the terrain',
    inPassageVolume(bearingX, high + 1, bearingZ, SEED, high, SMALL) &&
    !inPassageVolume(bearingX, GROUND + 1, bearingZ, SEED, high, SMALL),
    'the sill is pinned to an altitude instead of to the ground')

  // Away from the seam the trigger must be silent, or "the passage" is the whole ring.
  const backX = Math.round(SMALL.cx - Math.cos(SMALL.passageBearing) * (SMALL.radius + 1))
  const backZ = Math.round(SMALL.cz - Math.sin(SMALL.passageBearing) * (SMALL.radius + 1))
  check('the far side is wall', bubbleMaterialAt(backX, GROUND + 1, backZ, SEED, GROUND, SMALL) === WALL)
  check('and the far side does not cross', !inPassageVolume(backX, GROUND + 1, backZ, SEED, GROUND, SMALL))

  // ★ AND THE TRIGGER MUST NOT REACH. One that bled inward would fire across the whole interior;
  // one that bled outward would grab a keeper walking past on their own business.
  check('the trigger does not reach into the interior',
    !inPassageVolume(Math.round(bearingX * 0.5), GROUND + 1, Math.round(bearingZ * 0.5), SEED, GROUND, SMALL))
  check('nor out into the open Wilds',
    !inPassageVolume(bearingX + 12, GROUND + 1, bearingZ, SEED, GROUND, SMALL))

  // ★ AND AT THE REAL RADIUS, because this is the one property that does NOT survive scaling: the
  // doorway is an ANGLE, so at radius 1000 a fixed angle would be a 100-block hole. It is derived
  // from a width in blocks for exactly that reason, and this checks the derivation holds at the
  // size the world actually uses.
  let openCols = 0
  const full = DEFAULT_BUBBLE
  for (let t = -40; t <= 40; t++) {
    const a = full.passageBearing + t / full.radius
    const px = Math.round(full.cx + Math.cos(a) * (full.radius + 1))
    const pz = Math.round(full.cz + Math.sin(a) * (full.radius + 1))
    if (inPassage(px, pz, full)) openCols++
  }
  check('the full-size door is a door, not a breach', openCols > 2 && openCols < 40,
    `${openCols} columns wide at radius ${full.radius}`)
}

// ── the centre is a decision, not a default ───────────────────────────────────
console.log('\nthe siting')
{
  // ★ THIS TESTS THE GUARD, NOT THE DEFAULT — and the distinction matters more than it looks.
  // The first version asserted "the default centre is clear", which FAILS, because the default IS a
  // known collision: at cx/cz 0 with radius 1000 the bubble swallows Moonwell Glade. A test that is
  // red on purpose is a test everyone learns to scroll past, and it would have been red next to
  // genuine failures. So the placeholder stays honest in the config, and what is asserted is that
  // `bubbleSwallows` CATCHES it — which is the thing that will actually protect the world.
  const STORY_LANDMARKS = [
    { id: 'moonwell-glade', x: -150, z: -640 },      // canon: a permanent hub, holds the Folds gate
    { id: 'gloview-village', x: -265, z: -1125 },
    { id: 'thistle-hold', x: -630, z: -1780 },
  ]
  // ★ THE DEFAULT IS NOW CLEAN, AND THAT IS THE ASSERT THAT MATTERS. Alex chose to keep the centre
  // and shrink the radius (1000 -> 500) rather than move the bubble or split the Wilds into its own
  // space. At 500 the glade sits 157 blocks outside the wall.
  check('the shipped bubble swallows nothing', bubbleSwallows(DEFAULT_BUBBLE, STORY_LANDMARKS).length === 0,
    bubbleSwallows(DEFAULT_BUBBLE, STORY_LANDMARKS).map(s => `${s.id}@${Math.round(s.dist)}`).join(', '))
  check('and it clears the glade by a walkable margin',
    657 - DEFAULT_BUBBLE.radius > 100 && 657 - DEFAULT_BUBBLE.radius < 400,
    `${657 - DEFAULT_BUBBLE.radius} blocks — too little and the tutorial hub is crowded, ` +
    'too much and the keeper cannot see their own fold from where Greg tells them about it')

  // ★ AND THE GUARD IS STILL PROVEN TO BITE, against the config that was measured to be wrong.
  // Asserting only that the default is clean would pass just as well with a guard that returns [].
  const asAsked: BubbleConfig = { ...DEFAULT_BUBBLE, radius: 1000 }
  check('the guard catches the 1000 radius that started this',
    bubbleSwallows(asAsked, STORY_LANDMARKS).some(s => s.id === 'moonwell-glade'),
    'at r1000 the glade is buried and nothing about the render would look wrong')
  check('and does not cry wolf about Gloview', !bubbleSwallows(asAsked, STORY_LANDMARKS).some(s => s.id === 'gloview-village'),
    'Gloview clears r1000 by 156 blocks — a guard that flags everything gets switched off')

  // ── ★★ AND THE LIMIT OF EVERY ASSERT ABOVE, WRITTEN DOWN WHERE IT MISLED SOMEONE (2026-08-16) ──
  // All four of these check a HAND-WRITTEN list. On 2026-08-16 the world lane fed the same guard the
  // real `ZONE_ANCHORS` registry and it returned `garden@0` — an anchor at the exact centre of the
  // shipped bubble, in a column with no ground at any altitude, which `/goto garden` had been
  // teleporting keepers into for a day. Nothing here was wrong. The literal simply did not contain
  // the one entry that mattered, and a guard is only ever as true as its input.
  //
  // ⚠ THE REGISTRY-LEVEL ASSERT LIVES IN `bubble-wiring.test.ts` (§7) BY DESIGN — this file is the
  // pure-core oracle and importing `zones` would give it knowledge of the world it exists not to
  // have. What is asserted HERE is only the mechanism the fix leans on: an exemption exempts.
  check('an exempted landmark is not reported',
    bubbleSwallows(asAsked, STORY_LANDMARKS, ['moonwell-glade']).length === 0,
    'a collision that has been declared is the caller\'s business, not a failure')
  check('and exempting one does not silence the rest',
    bubbleSwallows({ ...asAsked, radius: 1200 }, STORY_LANDMARKS, ['moonwell-glade'])
      .some(s => s.id === 'gloview-village'),
    '★ an exemption list is a named door, never an off switch')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
