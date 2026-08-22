// Sapling oracle. Run: npx tsx src/app/shimmer/voxel/sapling.test.ts
//
// Every failure this file guards is a DELAYED one. A sapling's rules are checked minutes after the
// player acted, in a world that has moved since — so a wrong answer surfaces as "a tree grew through
// my roof" or "my dawnwood never came up", with nothing on screen connecting it back to the cause.
// Neither shows in a material census and neither reproduces on demand.

import { AIR } from './section'
import { MAT } from './depth'
import { SPECIES } from './trees'
import { GROW_DAYS, PLANTABLE_GROUND, saplingKey, canPlant, blockedBy, envelope, progress, speciesOf } from './sapling'
import { CYCLE_MS, morningsBetween, nextMorning } from '../engine/day-cycle'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const GOLD = SPECIES.find(s => s.id === 'goldwood')!
const DAWN = SPECIES.find(s => s.id === 'dawnwood')!

/** A world that is topsoil at y<=0 and air above, with an optional set of extra solid cells. */
function world(solid: Set<string> = new Set()) {
  return (x: number, y: number, z: number): number => {
    if (solid.has(`${x},${y},${z}`)) return MAT.STONE
    return y <= 0 ? MAT.TOPSOIL : AIR
  }
}
const openSky = () => true
const NOW = 1_000_000_000
// ★ GROWTH COUNTS MORNINGS NOW, NOT ELAPSED MS (2026-08-22). Stepping back a whole number of cycles
// crosses exactly that many dawn boundaries, whatever hour NOW happens to be — so this is exact
// rather than "long enough", and it does not silently become wrong if CYCLE_MS changes.
const plantedDaysAgo = (days: number) => NOW - days * CYCLE_MS

// ── 1. the three rules Alex stated ───────────────────────────────────────────────────────────
{
  const at = world()
  ok(canPlant(at, openSky, 5, 1, 5), 'a sapling plants on topsoil under open sky')
  // "only plantable on dirt" — the cell BELOW decides, and it is the generator's own set.
  const onStone = (x: number, y: number, z: number) => (y <= 0 ? MAT.STONE : AIR)
  ok(!canPlant(onStone, openSky, 5, 1, 5), '★ a sapling refuses stone — the same set the world plants on')
  ok(PLANTABLE_GROUND.has(MAT.TOPSOIL) && !PLANTABLE_GROUND.has(MAT.SAND),
    'PLANTABLE_GROUND is topsoil and not sand')
  // "no blocks above" and "after a certain time" are the growth rules, checked below.
  ok(blockedBy({}, at, openSky, GOLD, 5, 1, 5, NOW) === 'time', 'a fresh sapling is waiting on time')
  const clock = { [saplingKey(5, 1, 5)]: plantedDaysAgo(GROW_DAYS.goldwood) }
  ok(blockedBy(clock, at, openSky, GOLD, 5, 1, 5, NOW) === null, '★ a due sapling with room grows')
}

// ── 2. ★ THE CLEARANCE CHECK RUNS AT GROWTH TIME, NOT PLANTING TIME ──────────────────────────
// The trap in "no blocks above": ask it once, when the player plants, and they can build over the
// sapling while it grows and still get a tree through the roof. This is the whole reason `blockedBy`
// takes the world as an argument instead of a flag stored at planting.
{
  const clock = { [saplingKey(5, 1, 5)]: plantedDaysAgo(GROW_DAYS.goldwood) }
  ok(blockedBy(clock, world(), openSky, GOLD, 5, 1, 5, NOW) === null, 'clear at planting, clear now')
  // …and now the player lays a floor four blocks up, AFTER planting.
  const roofed = world(new Set(['5,5,5']))
  ok(blockedBy(clock, roofed, openSky, GOLD, 5, 1, 5, NOW) === 'clearance',
    '★ a roof built AFTER planting blocks the growth')
  // ⚠ It WAITS. It must not report ready, and it must not be reported dead — there is no 'dead'.
  const cleared = world()
  ok(blockedBy(clock, cleared, openSky, GOLD, 5, 1, 5, NOW) === null,
    '★ and it grows once the roof comes down — blocked is a WAIT, never a death')
}

// ── 3. ★ THE ENVELOPE IS THE TREE'S REAL SIZE, NOT A CONSTANT ────────────────────────────────
// A hand-written "check N blocks up" is a second description of how big a tree is. This asserts the
// reservation actually tracks the species, and specifically that the TALL one reserves more than the
// short one — the failure being a dawnwood (15 tall, radius 4) cleared by a goldwood-sized check.
{
  const g = envelope(GOLD), d = envelope(DAWN)
  let gTop = 0, dTop = 0, gWide = 0, dWide = 0
  for (const c of g) { gTop = Math.max(gTop, c.dy); gWide = Math.max(gWide, Math.abs(c.dx), Math.abs(c.dz)) }
  for (const c of d) { dTop = Math.max(dTop, c.dy); dWide = Math.max(dWide, Math.abs(c.dx), Math.abs(c.dz)) }
  ok(gTop >= GOLD.maxHeight - 1, `goldwood reserves its full trunk (${gTop} vs ${GOLD.maxHeight})`)
  ok(dTop > gTop, `★ dawnwood reserves higher than goldwood (${dTop} vs ${gTop})`)
  ok(dWide >= DAWN.radius, `dawnwood reserves its crown's width (${dWide} vs r${DAWN.radius})`)
  // The species' own maxHeight must be inside the envelope — this is the assert that goes red if
  // anyone retunes heights and the reservation stops tracking.
  for (const sp of SPECIES) {
    const top = envelope(sp).reduce((a, c) => Math.max(a, c.dy), 0)
    ok(top >= sp.maxHeight - 1, `${sp.id} reserves for its tallest roll (${top} vs ${sp.maxHeight})`)
    // ⚠ AND AN ABSOLUTE CEILING ON THE RESERVATION, because the assert below (test 4) CANNOT catch
    // over-reservation: it derives its test ceiling FROM the envelope, so it measures whether the
    // boundary is sharp, never where the boundary is. Mutating `envelope` to a flat 24-block column
    // left it green. Over-reserving is a real failure — a sapling that refuses to grow in a clearly
    // open field reads as broken — so it needs a bound that does not move with the thing it checks.
    const ceiling = sp.maxHeight + sp.radius * 2
    ok(top <= ceiling, `★ ${sp.id} does not over-reserve (${top} vs a ceiling of ${ceiling})`)
  }
}

// ── 4. a ceiling exactly at the tree's crown is caught; one above it is not ───────────────────
// Guards the OTHER direction: an envelope that over-reserves makes saplings refuse to grow in
// perfectly good spots, which reads as "saplings are broken" and is just as unshippable.
{
  const clock = { [saplingKey(5, 1, 5)]: plantedDaysAgo(GROW_DAYS.dawnwood) }
  const top = envelope(DAWN).reduce((a, c) => Math.max(a, c.dy), 0)
  const justAbove = world(new Set([`5,${1 + top + 1},5`]))
  ok(blockedBy(clock, justAbove, openSky, DAWN, 5, 1, 5, NOW) === null,
    '★ a ceiling one block clear of the crown does NOT block growth')
  const onTheCrown = world(new Set([`5,${1 + top},5`]))
  ok(blockedBy(clock, onTheCrown, openSky, DAWN, 5, 1, 5, NOW) === 'clearance',
    'a ceiling ON the crown does block it')
}

// ── 5. sky, and the missing-stamp rule ───────────────────────────────────────────────────────
{
  const clock = { [saplingKey(5, 1, 5)]: plantedDaysAgo(GROW_DAYS.goldwood) }
  ok(blockedBy(clock, world(), () => false, GOLD, 5, 1, 5, NOW) === 'sky',
    '★ no sky, no tree — a sealed dark room is not a farm')
  // pot.ts's rule, kept for pot.ts's reason: a lost stamp costs minutes, never the sapling.
  ok(blockedBy({}, world(), openSky, GOLD, 5, 1, 5, NOW) === 'time',
    '★ a missing stamp reads as JUST PLANTED, never as never')
  ok(progress({}, GOLD, 5, 1, 5, NOW) === 0, 'progress with no stamp is 0, not NaN')
  ok(progress(clock, GOLD, 5, 1, 5, NOW) === 1, 'progress clamps at 1')
}

// ── 6. rarity is paid for in time, on the canon ladder ───────────────────────────────────────
{
  ok(GROW_DAYS.goldwood < GROW_DAYS.shimmeroak && GROW_DAYS.shimmeroak < GROW_DAYS.starwillow
     && GROW_DAYS.starwillow < GROW_DAYS.dawnwood, '★ the rarer the tree, the longer the wait')
  ok(GROW_DAYS.goldwood === 3, "★ Alex's number, for the day-one tree: three mornings")
  const missing = SPECIES.filter(s => GROW_DAYS[s.id] === undefined)
  ok(missing.length === 0, `every species has a grow time (missing ${missing.map(s => s.id).join(',')})`)
  ok(speciesOf('dawnwood')?.id === 'dawnwood', 'a sapling item resolves to its species')
  ok(speciesOf('nonesuch') === null, 'an unknown sapling id resolves to nothing, not to goldwood')
}

// ── 7. ★★ GROWTH COUNTS MORNINGS, NOT ELAPSED TIME (2026-08-22, Alex) ────────────────────────
// *"a bit fast tho; what if every morning in-game we could have it grow.. so it takes three days"*
// The distinction is the whole feature and it is easy to fake: a flat `3 * CYCLE_MS` elapsed check
// passes every assert above and is NOT what was asked for, because it makes planting-at-dusk and
// planting-at-dawn identical. These are the asserts that can tell those two apart.
{
  // ★ THE ASYMMETRY IS THE FEATURE. Two saplings planted 2 in-game hours apart across a dawn are a
  // whole day apart in maturity, and no elapsed-time rule can produce that.
  const dawn = nextMorning(NOW)
  const justBefore = dawn - CYCLE_MS / 24        // one in-game hour before the sun comes up
  const justAfter  = dawn + CYCLE_MS / 24        // one in-game hour after
  ok(morningsBetween(justBefore, dawn + 1) === 1, '★ a morning breaking counts, however brief the wait')
  ok(morningsBetween(justAfter, dawn + CYCLE_MS / 2) === 0,
    '★★ planting just AFTER dawn waits for tomorrow — elapsed time cannot express this')

  // ...and the same two spans in raw milliseconds are nearly equal, which is what makes the pair
  // above a real discriminator rather than a restatement.
  ok((dawn + 1 - justBefore) < (dawn + CYCLE_MS / 2 - justAfter),
    '⚠ the counted-1 span is SHORTER in ms than the counted-0 span — elapsed time would rank them backwards')

  // Boundaries, stated: nothing yet, and never negative however the arguments arrive.
  ok(morningsBetween(NOW, NOW) === 0, 'no time, no mornings')
  ok(morningsBetween(NOW + CYCLE_MS, NOW) === 0, '★ a backwards span is 0, never negative')

  // A whole cycle is exactly one morning wherever it starts — the property `plantedDaysAgo` rests on.
  for (const offset of [0, CYCLE_MS / 7, CYCLE_MS / 3, CYCLE_MS * 0.9]) {
    ok(morningsBetween(NOW + offset, NOW + offset + CYCLE_MS) === 1,
      `one cycle is one morning, starting at +${Math.round(offset / 60000)}m`)
  }

  // The bar counts what the gate counts. A sapling one morning short must NOT read as ready.
  const nearly = { [saplingKey(5, 1, 5)]: plantedDaysAgo(GROW_DAYS.goldwood - 1) }
  ok(blockedBy(nearly, world(), openSky, GOLD, 5, 1, 5, NOW) === 'time',
    '★ one morning short is still waiting')
  ok(progress(nearly, GOLD, 5, 1, 5, NOW) < 1, '...and the HUD bar agrees it is not ready')

  // ⚠⚠ THE ASSERT ABOVE IS DOMINATED AND CANNOT CATCH A DRIFTING BAR — a mutation putting `progress`
  // back on elapsed time left every assert green, because at two cycles elapsed both rules land
  // under 1. A bar and a gate measuring DIFFERENT things is exactly the mirror failure: two
  // derivations of one truth, agreeing until they do not. This fixture is where they disagree.
  //
  // Planted an in-game hour before dawn, read an in-game hour after it: one whole morning has
  // broken, so the bar owes a full 1/3. Elapsed time has barely moved and would show ~2%.
  const beforeDawn = nextMorning(NOW) - CYCLE_MS / 24
  const justPastIt = nextMorning(NOW) + CYCLE_MS / 24
  const overnight = { [saplingKey(5, 1, 5)]: beforeDawn }
  const shown = progress(overnight, GOLD, 5, 1, 5, justPastIt)
  ok(Math.abs(shown - 1 / GROW_DAYS.goldwood) < 1e-9,
    `★★ the bar counts MORNINGS like the gate does — a dawn crossed is a whole rung (got ${shown})`)
}

console.log(`\nsapling: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
else console.log('✅ a planted forest comes back')
