// Run: npx tsx src/app/shimmer/voxel/bubble.test.ts
//
// ★ THE POINT OF THIS FILE IS THAT THE SHELL HOLDS AND THE DOOR OPENS — the two things that cannot
// be checked by looking at a sphere 2km across.
//
// A player never sees this object. They see a wall of cloud curving away in both directions, and at
// that scale a hole and a door are the same picture. So both are asked as reachability questions:
// can you get in anywhere you should not (flood), and can you get in where you should (the passage).

import {
  DEFAULT_BUBBLE, bubbleMaterialAt, insideShell, inShell, inPassage,
  shellRadiusAt, distFromAxis, bubbleSwallows, type BubbleConfig,
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
  check('the wall stops at its top', bubbleMaterialAt(SMALL.radius + 1, SMALL.topY + 1, 0, SEED, GROUND, SMALL) === null)
  check('the wall stops at its base', bubbleMaterialAt(SMALL.radius + 1, SMALL.bottomY - 1, 0, SEED, GROUND, SMALL) === null)
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
  // reaches the centre is a hole a player walks through into 1000 blocks of ungenerated nothing.
  // ⚠ The passage is deliberately moved out of the way for this pass — it is a hole ON PURPOSE and
  // is checked separately below. Testing the wall with its own door open proves nothing.
  const sealed: BubbleConfig = { ...SMALL, passageWidth: 0 }
  const seen = new Set<string>()
  const stack: [number, number][] = [[R, R]]
  let leaked = 0
  while (stack.length) {
    const [x, z] = stack.pop()!
    const k = `${x},${z}`
    if (seen.has(k)) continue
    seen.add(k)
    if (Math.abs(x) > R || Math.abs(z) > R) continue
    if (bubbleMaterialAt(x, GROUND + 1, z, SEED, GROUND, sealed) === WALL) continue   // the wall stops it
    if (distFromAxis(x, z, sealed) < sealed.radius - sealed.thickness) { leaked++; continue }
    stack.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1],
               [x + 1, z + 1], [x + 1, z - 1], [x - 1, z + 1], [x - 1, z - 1])
  }
  check('no way through the shell but the passage', leaked === 0,
    `${leaked} interior columns reachable from outside`)
}

// ── the door actually opens ───────────────────────────────────────────────────
console.log('\nthe passage')
{
  // ★ A DOOR THAT IS SEALED IS THE SAME BUG AS A WALL THAT LEAKS, and it is the likelier one: the
  // opening is an arc a few blocks wide on a circumference of kilometres, so an arithmetic slip in
  // the bearing simply closes it, and nothing looks wrong.
  const bearingX = Math.round(SMALL.cx + Math.cos(SMALL.passageBearing) * (SMALL.radius + 1))
  const bearingZ = Math.round(SMALL.cz + Math.sin(SMALL.passageBearing) * (SMALL.radius + 1))
  check('the doorway column is in the passage', inPassage(bearingX, bearingZ, SMALL))
  check('the doorway is open at the sill', bubbleMaterialAt(bearingX, GROUND, bearingZ, SEED, GROUND, SMALL) === AIR)
  check('the doorway is open at head height', bubbleMaterialAt(bearingX, GROUND + 2, bearingZ, SEED, GROUND, SMALL) === AIR)
  check('the doorway has a lintel',
    bubbleMaterialAt(bearingX, GROUND + SMALL.passageHeight, bearingZ, SEED, GROUND, SMALL) === WALL)

  // ⚠ THE SILL FOLLOWS THE GROUND. The first cut cut the door from the shell's underground base, so
  // the opening was a buried slot and the wall was solid where a player walks. Asserted by moving
  // the terrain and checking the door moves with it.
  const high = GROUND + 30
  check('the door moves with the terrain',
    bubbleMaterialAt(bearingX, high + 1, bearingZ, SEED, high, SMALL) === AIR &&
    bubbleMaterialAt(bearingX, GROUND + 1, bearingZ, SEED, high, SMALL) === WALL,
    'the sill is pinned to an altitude instead of to the ground')

  // Opposite the door, the wall is shut — otherwise "the passage" is just the whole ring.
  const backX = Math.round(SMALL.cx - Math.cos(SMALL.passageBearing) * (SMALL.radius + 1))
  const backZ = Math.round(SMALL.cz - Math.sin(SMALL.passageBearing) * (SMALL.radius + 1))
  check('the far side is shut', bubbleMaterialAt(backX, GROUND + 1, backZ, SEED, GROUND, SMALL) === WALL)

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
  const swallowed = bubbleSwallows(DEFAULT_BUBBLE, STORY_LANDMARKS)
  check('the guard catches the glade at the world origin',
    swallowed.some(s => s.id === 'moonwell-glade'),
    'a radius-1000 bubble at 0,0 buries the glade and nothing about the render would look wrong')
  check('and does not cry wolf about Gloview', !swallowed.some(s => s.id === 'gloview-village'),
    'Gloview clears it by 156 blocks — a guard that flags everything gets switched off')

  // Sited away from the story world, the same bubble is clean. This is the shape the wiring wants.
  const sited: BubbleConfig = { ...DEFAULT_BUBBLE, cx: 20000, cz: 20000 }
  check('a bubble sited off the story world swallows nothing',
    bubbleSwallows(sited, STORY_LANDMARKS).length === 0)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
