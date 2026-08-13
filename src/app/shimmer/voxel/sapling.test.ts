// Sapling oracle. Run: npx tsx src/app/shimmer/voxel/sapling.test.ts
//
// Every failure this file guards is a DELAYED one. A sapling's rules are checked minutes after the
// player acted, in a world that has moved since — so a wrong answer surfaces as "a tree grew through
// my roof" or "my dawnwood never came up", with nothing on screen connecting it back to the cause.
// Neither shows in a material census and neither reproduces on demand.

import { AIR } from './section'
import { MAT } from './depth'
import { SPECIES } from './trees'
import { GROW_MS, PLANTABLE_GROUND, saplingKey, canPlant, blockedBy, envelope, progress, speciesOf } from './sapling'

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
  const clock = { [saplingKey(5, 1, 5)]: NOW - GROW_MS.goldwood - 1 }
  ok(blockedBy(clock, at, openSky, GOLD, 5, 1, 5, NOW) === null, '★ a due sapling with room grows')
}

// ── 2. ★ THE CLEARANCE CHECK RUNS AT GROWTH TIME, NOT PLANTING TIME ──────────────────────────
// The trap in "no blocks above": ask it once, when the player plants, and they can build over the
// sapling while it grows and still get a tree through the roof. This is the whole reason `blockedBy`
// takes the world as an argument instead of a flag stored at planting.
{
  const clock = { [saplingKey(5, 1, 5)]: NOW - GROW_MS.goldwood - 1 }
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
  const clock = { [saplingKey(5, 1, 5)]: NOW - GROW_MS.dawnwood - 1 }
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
  const clock = { [saplingKey(5, 1, 5)]: NOW - GROW_MS.goldwood - 1 }
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
  ok(GROW_MS.goldwood < GROW_MS.shimmeroak && GROW_MS.shimmeroak < GROW_MS.starwillow
     && GROW_MS.starwillow < GROW_MS.dawnwood, '★ the rarer the tree, the longer the wait')
  const missing = SPECIES.filter(s => GROW_MS[s.id] === undefined)
  ok(missing.length === 0, `every species has a grow time (missing ${missing.map(s => s.id).join(',')})`)
  ok(speciesOf('dawnwood')?.id === 'dawnwood', 'a sapling item resolves to its species')
  ok(speciesOf('nonesuch') === null, 'an unknown sapling id resolves to nothing, not to goldwood')
}

console.log(`\nsapling: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
else console.log('✅ a planted forest comes back')
