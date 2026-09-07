// The Hollow spawner's Y AXIS. Run: npx tsx src/app/shimmer/voxel3d/hollow-yaxis.test.ts
//
// ── WHAT THIS EXISTS TO CATCH (2026-09-07) ────────────────────────────────────────────────────
// Until today the sweep could only ever consider ONE cell per column — `columnHeight(x, z) + 1`,
// the top of the generated surface. So a spot at light level 0 that was not the surface could
// never body a Hollow, no cave was ever dangerous, and because a surface cell's sky is 15 the
// whole feature was gated on the CLOCK rather than on the dark. Alex asked for Minecraft's actual
// rule: spawn on any block at light level 0. That is a third axis, and it invalidates three
// separate things that were each correct while the surface was the only candidate:
//
//   1. the candidate itself (`columnHeight + 1`)
//   2. the `hollowNight(day)` pre-gate around the whole sweep — a clock answering for a cave
//   3. the gutter rule `15 * day >= GUTTER_SKY` — the sun burning off a body it cannot reach
//
// ⚠ NONE OF THE THREE WERE BUGS. They were exemptions resting on a premise, and this commit is
// the one that kills the premise. The 08-22 entry in PATTERNS.md is about exactly this shape and
// says the fix is to make the exemption EXPIRE — so each of the three is asserted here against the
// property that justifies it, not against the string that implements it where that is avoidable.
//
// ⚠⚠ AND THE ONE THAT FAILS SILENTLY IS THE CLAMP, WHICH IS WHY IT GETS A POSITIVE CONTROL WITH A
// REAL FIELD. `LightField.get` answers an out-of-bounds read with 0 — pitch dark — because for
// LIGHTING the conservative direction is dark (light.ts says so outright). For SPAWNING that is
// the dangerous direction: every cell past the box reads as perfect spawn ground. There is no
// error, no warning and nothing in the output to notice. The control below shows the SAME cell
// reading bright in a field that covers it and dark in one that does not.

import { pickSpawnY, hollowFoots, hollowGutters, hollowNight, NIGHT_SKY_MAX, GUTTER_SKY } from './hollows'
import { computeLight, skyOf, blockOf, spawnDark, type LightBounds } from '../voxel/light'
import { isSolid, MAT } from '../voxel/depth'
import { readFileSync } from 'node:fs'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── TWO synthetic worlds, because one world cannot honestly serve both questions ──────────────
// ⚠ THE FIRST DRAFT USED ONE, AND ITS "SEALED" CAVE WAS NOT SEALED. A low shelf put open air at
// the cave's own altitude four blocks away, so sky light walked in sideways and the cave read
// bright. Three asserts went red and every one of them was the FIXTURE, not the code — the 08-22
// lesson (*the fixture drifted into a place where the subject does not exist*) arriving while
// writing a guard against that family. Kept as two worlds rather than one tuned one, because a
// fixture that needs a spacing argument to stay valid is a fixture that will quietly stop being.
const AIRV = 0, ROCK = 1

// World A — a flat shelf at 119 with a SEALED cave slab at 110..112 over a floor at 109. Nothing
// reaches the cave: out-of-box is dark AND solid by light.ts's contract, so the slab has no mouth.
const SURF_A = 119
const worldA = (x: number, y: number, z: number): number =>
  (y >= 110 && y <= 112) ? AIRV : (y <= SURF_A ? ROCK : AIRV)
// World B — a step. x<=0 is a low shelf (surface 99, full sky); x>=1 is high (119). The spread is
// what makes a light box built for the HIGH shelf fail to cover the LOW one, and `lightBoundsFor`
// derives y0 from the centre column's own min surface, so this is an ordinary column here.
const SURF_B = (x: number): number => (x <= 0 ? 99 : 119)
const worldB = (x: number, y: number, z: number): number => (y <= SURF_B(x) ? ROCK : AIRV)

const inputsFor = (w: typeof worldA, surf: (x: number) => number) => ({
  opaque: (x: number, y: number, z: number) => w(x, y, z) !== AIRV,
  emit: () => 0,
  openToSky: (x: number, z: number, y: number) => y > surf(x),
  // These fixtures hold only ROCK and air, so wind and light agree here — stated rather than
  // relied on, because the day a fixture grows a plant the two predicates must part company.
  windBlocks: (x: number, y: number, z: number) => w(x, y, z) !== AIRV,
})
const boxOver = (y0: number, sy: number): LightBounds => ({ x0: -1, y0, z0: -1, sx: 4, sy, sz: 4 })

// The field a host builds for a 119 shelf: `lightBoundsFor`'s own arithmetic, min surface - 10.
const cave = computeLight(boxOver(109, 40), inputsFor(worldA, () => SURF_A))
const small = computeLight(boxOver(109, 40), inputsFor(worldB, SURF_B))
// A field that covers everything — the second instrument, so an absence claim has a witness.
const big = computeLight(boxOver(90, 60), inputsFor(worldB, SURF_B))

const footsIn = (w: typeof worldA) => (x: number) => (y: number) => hollowFoots(
  y,
  (fy) => w(x, fy, 0) !== AIRV,
  (cy) => w(x, cy, 0) === AIRV,
)
const foots = footsIn(worldA)      // world A is the one with a cave to stand in
const footsB = footsIn(worldB)
const dark = (f: typeof small, x: number, day: number) => (y: number) =>
  spawnDark(f.get(x, y, 0), day, NIGHT_SKY_MAX)

// ── 0. ★★★ A GRASS TUFT IS NOT A WALL — the defect the pure guards could not see ─────────────
// ⚠⚠ THIS BLOCK EXISTS BECAUSE THE FIRST DRAFT SHIPPED THE BUG AND 43 GREEN ASSERTS DID NOT CARE.
// `clearAt` was hand-rolled as `=== AIR`. Nearly every surface cell in this world carries a plant
// at `surface + 1`, so that predicate refused the overworld and the Y axis would have landed as a
// spawner that quietly stopped using the surface — MORE eligible ground on paper, less in fact.
// It was invisible here because the synthetic worlds above have no plants in them: I wrote the
// fixture, so the fixture agreed with me. An end-to-end sim on real terrain found it in one run.
// The shipped fix asks `isSolid` — the notion collision and light already use — and `VoxelWorld`
// has carried a comment since 2026-08-20 recording somebody making this identical mistake.
{
  const PLANT = 76           // MOONVINE — inside the crop span, therefore in SOLID_EXCEPT
  ok(!isSolid(PLANT), 'fixture: a crop really is non-solid to collision')
  ok(!isSolid(MAT.WATER) && !isSolid(0), 'fixture: water and air are non-solid too')
  // Ground at 100, a tuft standing at 101, open air at 102. A body's feet belong at 101.
  const tufted = (y: number): number => (y <= 100 ? ROCK : y === 101 ? PLANT : AIRV)
  const footsTufted = (y: number) => hollowFoots(
    y,
    (fy) => isSolid(tufted(fy)),
    (cy) => { const m = tufted(cy); return !isSolid(m) && m !== MAT.WATER },
  )
  ok(footsTufted(101),
     '★★★ a body may stand IN long grass — the shipped `!isSolid` rule, and the whole overworld'
     + ' depends on it')
  const airOnly = (y: number) => hollowFoots(y, (fy) => isSolid(tufted(fy)), (cy) => tufted(cy) === AIRV)
  ok(!airOnly(101),
     '★★★ POSITIVE CONTROL: the hand-rolled `=== AIR` refuses that same cell — this is the bug,'
     + ' reproduced, and it is why this block is not a source-text assert')
  // And water must still be refused, which `!isSolid` alone would admit.
  const flooded = (y: number): number => (y <= 100 ? ROCK : MAT.WATER)
  const footsFlooded = (y: number) => hollowFoots(
    y,
    (fy) => isSolid(flooded(fy)),
    (cy) => { const m = flooded(cy); return !isSolid(m) && m !== MAT.WATER },
  )
  ok(!footsFlooded(101), '★★ but not in water — `!isSolid` admits it, so WATER is excluded on top')
}

// ── 1. the placement rule: a floor, and two cells of room ─────────────────────────────────────
{
  ok(foots(1)(120), 'the high shelf surface is a foot (solid 119, air 120 and 121)')
  ok(foots(1)(110), '★★ the CAVE FLOOR is a foot — solid 109, air 110 and 111')
  ok(!foots(1)(111), 'one cell up inside the cave is not: its floor is air')
  ok(!foots(1)(112), 'the cave ceiling cell is not: no floor, and no head room')
  ok(!foots(1)(119), 'inside the rock is not a foot')
  // ⚠ A one-high slot must be refused, or a body forms with its head in the stone. This is the
  // assert that dies if `clearAt(y + 1)` is ever dropped from `hollowFoots`.
  const tight = (y: number) => hollowFoots(y, () => true, (cy) => cy === 5)
  ok(!tight(5), '★★ a ONE-high gap is refused — the head must fit too')
}

// ── 2. the Y roll finds the cave, and at NOON finds ONLY the cave ─────────────────────────────
{
  const rnd = () => 0.5
  const night = pickSpawnY(110, 147, foots(1), dark(cave, 1, 0), rnd)
  ok(night === 110 || night === 120, `at midnight both the cave and the surface are live (got ${night})`)

  // ★★★ THE HEADLINE. At noon the surface is sky-lit and refused; the sealed cave is untouched by
  // the clock. Before this commit the answer at noon was "nothing, anywhere, ever" — not because
  // the cave was lit but because no code path could name it.
  const seen = new Set<number>()
  for (let i = 0; i < 200; i++) seen.add(pickSpawnY(110, 147, foots(1), dark(cave, 1, 1), Math.random))
  ok(seen.size === 1 && seen.has(110),
     `★★★ AT NOON THE ONLY SPAWNABLE CELL IS THE CAVE FLOOR — got ${[...seen].join(',')}`)
  ok(15 * 1 > NIGHT_SKY_MAX && skyOf(cave.get(1, 120, 0)) === 15,
     'the control: the surface above that cave really is sky-15 and really is refused at noon')
  ok(skyOf(cave.get(1, 110, 0)) === 0 && blockOf(cave.get(1, 110, 0)) === 0,
     'and the cave really is pitch dark in the field — sky 0, block 0')
}

// ── 3. a line with nothing on it answers -1, and -1 is not an error ───────────────────────────
{
  // Solid rock all the way: no floor with room over it anywhere in range.
  const solid = (y: number) => hollowFoots(y, () => true, () => false)
  ok(pickSpawnY(110, 147, solid, () => true, Math.random) === -1,
     'a line with no standing room answers -1')
  ok(pickSpawnY(110, 147, foots(1), () => false, Math.random) === -1,
     'a line with standing room but no darkness answers -1 — the dark predicate is not decorative')
  // ⚠ AN EMPTY RANGE MUST ALSO ANSWER -1 rather than reading one cell anyway. This is the assert
  // that fires if the loop is ever written `y <= yHi + 1` or the bounds are swapped.
  ok(pickSpawnY(130, 129, () => true, () => true, Math.random) === -1, 'an inverted range answers -1')
  ok(pickSpawnY(120, 120, foots(1), dark(cave, 1, 0), Math.random) === 120,
     '★ the range is INCLUSIVE at both ends — a one-cell range containing the answer returns it')
}

// ── 4. ★★★ THE CLAMP, WITH THE CONTROL THAT MAKES IT A MEASUREMENT AND NOT A CLAIM ────────────
{
  // The low shelf's foot is y=100. The field built for the high shelf starts at 109, so 100 is
  // OUTSIDE it. `get` answers out-of-bounds with 0 — indistinguishable from a sealed cave.
  ok(small.get(0, 100, 0) === 0, 'fixture: the small field answers 0 for a cell it does not cover')
  ok(skyOf(big.get(0, 100, 0)) === 15,
     '★★ THE SECOND INSTRUMENT: the same cell is FULL SKY in a field that actually covers it')
  ok(footsB(0)(100), 'fixture: the low shelf really is standable')

  // ⚠ THE BUG, REPRODUCED. An unclamped line admits a sunlit clifftop at noon.
  const unclamped = pickSpawnY(95, 147, footsB(0), dark(small, 0, 1), Math.random)
  ok(unclamped === 100,
     `★★★ POSITIVE CONTROL: unclamped, a SUNLIT cell is admitted at noon purely because the field`
     + ` does not reach it (got ${unclamped})`)
  ok(!spawnDark(big.get(0, 100, 0), 1, NIGHT_SKY_MAX),
     '★★ and the field that CAN see it refuses it — so the admission was the instrument, not the world')

  // The shipped clamp: `Math.max(b.y0 + 1, 1)` .. `Math.min(b.y0 + b.sy - 2, H - 2)`.
  const yLo = Math.max(small.bounds.y0 + 1, 1)
  const yHi = Math.min(small.bounds.y0 + small.bounds.sy - 2, 254)
  ok(pickSpawnY(yLo, yHi, footsB(0), dark(small, 0, 1), Math.random) === -1,
     '★★★ CLAMPED to the field, that cell cannot be reached at all — no spawn beats a wrong spawn')
  // ⚠ The clamp must not be so tight it excludes real cells: the cave is still reachable.
  const cLo = Math.max(cave.bounds.y0 + 1, 1), cHi = Math.min(cave.bounds.y0 + cave.bounds.sy - 2, 254)
  ok(pickSpawnY(cLo, cHi, foots(1), dark(cave, 1, 1), Math.random) === 110,
     '★ and the clamp does not cost us the cave it exists to protect')
}

// ── 5. the reservoir is UNIFORM — a biased roll would quietly favour one depth forever ────────
{
  // Five valid, equally dark cells on one line: floors at 10, 20, 30, 40, 50.
  const FLOORS = new Set([10, 20, 30, 40, 50])
  const f = (y: number) => FLOORS.has(y)
  const counts = new Map<number, number>()
  const N = 60000
  for (let i = 0; i < N; i++) {
    const y = pickSpawnY(5, 60, f, () => true, Math.random)
    counts.set(y, (counts.get(y) ?? 0) + 1)
  }
  ok(counts.size === 5 && [...FLOORS].every((y) => counts.has(y)), 'every valid cell is reachable')
  const expect = N / 5
  // ±4% at n=12000 per bucket is ~9 standard errors — loose enough never to flap, tight enough
  // that a first-wins or last-wins reservoir (which give 100%/0%) cannot survive it.
  const worst = Math.max(...[...counts.values()].map((c) => Math.abs(c - expect) / expect))
  ok(worst < 0.04, `★★ the roll is uniform over valid cells (worst bucket off by ${(worst * 100).toFixed(1)}%)`)
}

// ── 6. the gutter reads the BODY'S light, and the sun does not reach into a cave ──────────────
{
  const capSky = (sky: number) => (sky << 4)
  ok(hollowGutters(capSky(15), 1, skyOf), 'an open-sky body at noon gutters')
  ok(!hollowGutters(capSky(15), 0, skyOf), 'the same body at midnight does not')
  ok(!hollowGutters(capSky(0), 1, skyOf),
     '★★★ A BODY IN A SEALED CAVE DOES NOT GUTTER AT NOON — the old `15 * day` rule burned it off'
     + ' with a sun it cannot see, which would have killed the daytime half on the frame it was born')
  // The hysteresis the constant exists for: a cell that may still SPAWN must not already burn.
  ok(GUTTER_SKY > NIGHT_SKY_MAX, 'the gutter line sits above the spawn line — no flap at dusk')
  const dusk = NIGHT_SKY_MAX / 15
  ok(spawnDark(capSky(15), dusk, NIGHT_SKY_MAX) && !hollowGutters(capSky(15), dusk, skyOf),
     '★ at the exact dusk boundary a surface cell can spawn and cannot yet gutter')
}

// ── 6b. ⚖ SPAWN CONDITION IS NOT PERSISTENCE CONDITION (canon, ruled 2026-09-06) ─────────────
// `design-briefs/hollows.md` › *Visibility in the dark*: **"a dark veto governs whether the grey
// BODIES, not whether a bodied Hollow CONTINUES. A formed Hollow does not un-body because a light
// arrived. Without this, lighting one to see it deletes it and THE ACT OF LOOKING DESTROYS THE
// SUBJECT."** The ruling then hands the check here by name: *"whether the build re-evaluates
// per-tick is Jin's to check."*
//
// ★ THE GUTTER CHANGE IN THIS COMMIT IS THE PLACE THAT COULD HAVE BROKEN IT, because it moved the
// dawn test from a global clock onto the body's own light reading — one line away from also
// reading the lamp. It does not: `hollowGutters` takes a SKY accessor and block light cannot enter
// through it. That was a tuning call made before the ruling existed and the ruling agrees with it,
// which is worth asserting rather than leaving as a coincidence.
{
  const packed = (sky: number, block: number) => (sky << 4) | (block & 0xf)
  // A keeper puts a lamp on a Hollow at midnight to find it. Block light 15, sky 0.
  ok(!hollowGutters(packed(0, 15), 0, skyOf),
     '★★★ A LAMP DOES NOT DISPERSE A BODIED HOLLOW — canon: the act of looking must not destroy'
     + ' the subject')
  ok(!hollowGutters(packed(0, 15), 1, skyOf),
     '★★ nor at noon in a cave — block light is not on the gutter axis at any hour')
  // ⚠ The mutation this exists to catch is one identifier wide: `skyOf` -> `effectiveLight`, which
  // is `max(block, sky*day)` and WOULD delete a lit body. Proven by running that substitution here
  // rather than described, because a described mutation is one nobody has seen fail.
  const effective = (v: number) => Math.max(v & 0xf, ((v >> 4) & 0xf))
  ok(hollowGutters(packed(0, 15), 1, effective),
     '★★★ POSITIVE CONTROL: with an EFFECTIVE-light accessor the same lamp DOES disperse it — so'
     + ' the assert above is discriminating, not vacuous')
  // And the spawn side must still veto on that same block light — the two axes differ on purpose.
  ok(!spawnDark(packed(0, 15), 0, NIGHT_SKY_MAX),
     '★★ while SPAWNING is still vetoed by one unit of block light — *tended light holds grey off*'
     + ' governs whether it bodies, never whether it continues')
}

// ── 7. WIRING — the pure rules above are worth nothing if the host asks a different question ──
// (the `bridgeVoxelAt`-vs-`materialAt` lesson: a test that skips the gate tests a world that does
// not exist. These are source-text asserts and they are the weaker kind, so each one names a
// mutation it would catch rather than merely describing the code.)
{
  const src = readFileSync('src/app/shimmer/voxel3d/VoxelWorld.tsx', 'utf8')

  ok(/const fy = spawnFootY\(wx, wz, lf, day\)/.test(src),
     '★★ the anchor rolls a foot Y — catches a revert to `columnHeight(wx, wz) + 1`')
  ok(/if \(fy < 0\) continue/.test(src),
     '★★ and -1 is honoured; without this a -1 becomes a body at y = -2')
  ok(/const mfy = spawnFootY\(mix, miz, lf, day\)/.test(src),
     '★★★ a PACK MATE rolls its OWN Y — inheriting the anchor\'s plants bodies inside hillsides,'
     + ' and it is the exemption the pack has always had to be denied')
  ok(/spawnHollow\(mx, mfy - 1, mz\)/.test(src) && /spawnHollow\(wx \+ 0\.5, sh, wz \+ 0\.5\)/.test(src),
     '★ both spawns place the body on the rolled FLOOR (foot - 1), not on the surface')

  // The clamp, asserted as the arithmetic rather than as a comment about it.
  ok(/Math\.max\(b\.y0 \+ 1, 1\)/.test(src) && /Math\.min\(b\.y0 \+ b\.sy - 2, H - 2\)/.test(src),
     '★★★ the Y roll is clamped to the light field\'s OWN box — the silent failure, see block 4')
  // ⚠⚠ ADDED AFTER A MUTATION SWEEP FOUND BOTH HOST MUTATIONS ALIVE. `hollow-wind.test.ts` builds
  // its candidate set from `field.windAt` directly, so it proves the RULE and is structurally
  // blind to whether the host applies it — dropping `&& lf.windAt(...)` from the roll left every
  // wind assert green. The pure-guard-plus-blind-wiring shape, one more time.
  ok(/spawnDark\(lf\.get\(wx, y, wz\), dayNow, NIGHT_SKY_MAX\) && lf\.windAt\(wx, y, wz\)/.test(src),
     '★★★ the roll requires dark AND wind — catches dropping the gate, and catches the gate'
     + ' REPLACING the dark test rather than joining it (canon needs both, they are different axes)')
  ok(/\(fy\) => isSolid\(voxel\(wx, fy, wz\)\)/.test(src),
     '★★ footing asks `isSolid`, the notion collision and light already use')
  ok(/return !isSolid\(m\) && m !== MAT\.WATER/.test(src),
     '★★★ and head room is `!isSolid` — a hand-rolled `=== AIR` counts a grass tuft as a wall and'
     + ' silently retires the overworld (see block 0)')
  ok(!/\(cy\) => voxel\(wx, cy, wz\) === AIR/.test(src),
     '★★ the hand-rolled predicate is gone, not merely supplemented')
  ok(!/pickSpawnY\(\s*0\s*,/.test(src), 'the roll never starts at world bottom, where no field reaches')

  // The pre-gate that had to die, and the one that had to stay.
  ok(!/if \(hollowNight\(day\)/.test(src),
     '★★★ the `hollowNight` clock pre-gate is gone from the sweep — restoring it re-kills every cave')
  ok(/if \(hollows\.current\.length < cap && hollowClock\.current <= 0\)/.test(src),
     '★ the cap and the cycle clock still gate the sweep — this was never about spawning more')

  // The gutter, at the host.
  ok(/hollowGutters\(glf\.get\(/.test(src),
     '★★★ the host gutters on the BODY\'S own light — catches a revert to `15 * day >= GUTTER_SKY`')
  ok(/hollowGutters\(glf\.get\(Math\.floor\(st\.x\), Math\.floor\(st\.y\), Math\.floor\(st\.z\)\), day, skyOf\)/.test(src),
     '★★★ the host hands `hollowGutters` a SKY accessor, never an effective-light one — canon:'
     + ' a formed Hollow does not un-body because a light arrived')
  ok(/: 15 \* day >= GUTTER_SKY/.test(src),
     '★★ with the global rule as the NO-FIELD fallback: a body that outlives its light data must'
     + ' disperse, never become immortal')

  // ⚠ THE EXEMPTION THAT IS STILL LOAD-BEARING AND NOW HAS A DIFFERENT REASON. `openToSky` reads
  // the GENERATED surface, so a player-built roof reads as open sky and its interior refuses a
  // spawn. That fails toward no-spawn, which is why it is survivable — but the comment that used
  // to justify it said "surface Hollows only body at night", and that premise died here.
  // ⚠⚠ THIS ASSERT CAUGHT ITS OWN AUTHOR, WHICH IS THE ONLY REASON IT IS WRITTEN THIS WAY.
  // The first version was `!/and surface Hollows only body at night/` — and it went red, because
  // the correction note QUOTES the retired sentence to explain what was retired. That is
  // PATTERNS.md's *documenting a marker created a marker*, arriving through the door most likely
  // to be opened by someone doing the right thing. The fix is not to stop quoting it (the wrong
  // reading is the useful artifact) but to assert the count: it may appear EXACTLY ONCE, and that
  // once must be inside the correction. A second copy — a reader restoring the old justification
  // in earnest — goes red.
  const retired = 'and surface Hollows only body at night'
  const hits = src.split(retired).length - 1
  ok(hits === 1, `★★ the retired justification survives ONLY as a quotation (found ${hits})`)
  ok(src.includes(`USED TO END "${retired}"`),
     '★★ and that one occurrence is inside the correction, not standing as a live reason')
  ok(/player-built interiors are NOT dark for spawning purposes by day/.test(src),
     '★ and the real, current consequence is stated where the exemption lives')
}

// ── 8. `hollowNight` survives as a SURFACE predicate, and says so ─────────────────────────────
{
  ok(hollowNight(0) && !hollowNight(1), 'it still answers the question it was always right about')
  const hsrc = readFileSync('src/app/shimmer/voxel3d/hollows.ts', 'utf8')
  ok(/Do not restore it as a gate around the sweep/.test(hsrc),
     '★ and the file says why it is not the gate any more, next to the function')
}

process.on('exit', () => {
  if (fails.length) {
    console.error(`❌ ${fails.length} failed (${pass} passed)`)
    for (const f of fails) console.error('  - ' + f)
    process.exitCode = 1
  } else {
    console.log(`✅ darkness is a place, not an hour — ${pass} passed`)
  }
})
