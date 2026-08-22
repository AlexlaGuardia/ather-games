// The garden-allowance oracle. Run: npx tsx src/app/shimmer/voxel/garden.test.ts
import { PLOT_ALLOWANCE, plotsAllowed, nextAllowance, placeBedBlocker, plotRefusalLine, countBeds, BED_WOODS, GARDEN_BEDS, isGardenBed } from './garden'
import { MAT } from './depth'
import { SKILL_MILESTONES } from '../engine/skills'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. THE LADDER IS ALEX'S THREE NUMBERS, ON LEVELS THAT ALREADY EXISTED ───────────────────────
{
  ok(PLOT_ALLOWANCE.map(r => r.plots).join(',') === '10,15,20',
    `the ladder is 10 → 15 → 20 (${PLOT_ALLOWANCE.map(r => r.plots).join(' → ')})`)

  // ★ The rungs must BE milestone levels, not merely equal them today. If someone retunes
  // SKILL_MILESTONES, this ladder should move with it rather than quietly become a second,
  // invisible progression — which is the thing reusing them was for.
  const milestoneLevels = SKILL_MILESTONES.map(m => m.level)
  const raised = PLOT_ALLOWANCE.slice(1).map(r => r.level)
  ok(raised.every(l => milestoneLevels.includes(l)),
    `★★ every raise sits on a real skill milestone (${raised.join(', ')} vs ${milestoneLevels.join(', ')})`)

  ok(PLOT_ALLOWANCE.every((r, i) => i === 0 || r.level > PLOT_ALLOWANCE[i - 1].level),
    'the rungs ascend by level')
  ok(PLOT_ALLOWANCE.every((r, i) => i === 0 || r.plots > PLOT_ALLOWANCE[i - 1].plots),
    '★ and by plots — a rung that does not raise the cap is a rung that lies')
}

// ── 2. THE BOUNDARIES, WHICH IS WHERE AN OFF-BY-ONE LIVES ───────────────────────────────────────
{
  ok(plotsAllowed(1) === 10, 'a fresh keeper gets ten')
  ok(plotsAllowed(24) === 10, 'one level short of Apprentice is still ten')
  ok(plotsAllowed(25) === 15, '★ Apprentice itself raises it — the rung is inclusive')
  ok(plotsAllowed(49) === 15, 'one short of Journeyman is still fifteen')
  ok(plotsAllowed(50) === 20, '★ Journeyman itself raises it')
  ok(plotsAllowed(99) === 20, 'the ceiling holds at the level cap — a cap that keeps climbing is not a cap')

  // ⚠ Below the first rung is a real case: a skill can read 0 before anything is set up, and the
  // permissive reading (fall through to ten) would hand beds to a keeper with no farming at all.
  ok(plotsAllowed(0) === 0, '★★ level 0 allows nothing — the table fails CLOSED, never to its first rung')
}

// ── 3. WHAT THE NEXT RUNG SAYS, INCLUDING AT THE TOP ────────────────────────────────────────────
{
  ok(nextAllowance(1)?.level === 25, 'a new keeper is told about Apprentice')
  ok(nextAllowance(25)?.level === 50, 'an Apprentice is told about Journeyman')
  ok(nextAllowance(50) === null, '★ at the top there is no next rung, and it must say null rather than repeat itself')
  ok(nextAllowance(99) === null, 'and still null past it')
}

// ── 4. ★★ THE REFUSALS ARE FOUR DIFFERENT SENTENCES ────────────────────────────────────────────
{
  ok(placeBedBlocker(0, 10, 1, true) === 'ok', 'room, a bed in hand, good ground → ok')
  ok(placeBedBlocker(10, 10, 1, true) === 'at-cap', '★ the tenth bed placed blocks the eleventh')
  ok(placeBedBlocker(9, 10, 1, true) === 'ok', '...and the ninth does not')
  ok(placeBedBlocker(0, 10, 0, true) === 'none-in-bag', 'nothing in the bag is its own answer')
  ok(placeBedBlocker(0, 10, 1, false) === 'not-plantable-ground', 'bad ground is its own answer')

  // ★ ORDER MATTERS AND IS ASSERTED. A keeper at the cap holding nothing should be told they are
  // holding nothing — that is the thing they can act on. Reporting `at-cap` first would send them to
  // grind farming when the real answer is "craft one".
  ok(placeBedBlocker(99, 10, 0, true) === 'none-in-bag',
    '★★ at the cap AND empty-handed reports the bag first — the actionable one wins')

  // Every refusal must produce a sentence. A `null` here becomes the literal word "null" on screen,
  // which is exactly what `potionEffectLine` shipped.
  for (const why of ['ok', 'at-cap', 'none-in-bag', 'not-plantable-ground'] as const) {
    const line = plotRefusalLine(why, 10)
    ok(why === 'ok' ? line === '' : line.length > 0, `${why} has a sentence`)
    ok(!line.includes('undefined') && !line.includes('null'), `${why}'s sentence has no undefined/null in it`)
  }
  ok(plotRefusalLine('at-cap', 10).includes('25') && plotRefusalLine('at-cap', 10).includes('15'),
    '★ the cap message names the level that lifts it and what it lifts to')
  ok(plotRefusalLine('at-cap', 50).includes('most any garden holds'),
    '★ at the top it stops promising a rung that does not exist')
}

// ── 5. THE COUNT IS DERIVED FROM THE EDIT LOG ──────────────────────────────────────────────────
{
  const BED = 77, STONE = 1
  const ONE = new Set([BED])
  const col = (...mats: number[]) => new Map(mats.map((m, i) => [i, m]))

  ok(countBeds([], ONE) === 0, 'no columns, no beds')
  ok(countBeds([col(STONE, STONE)], ONE) === 0, 'edits that are not beds do not count')
  ok(countBeds([col(BED, STONE, BED)], ONE) === 2, 'two beds in one column')
  ok(countBeds([col(BED), col(BED, BED)], ONE) === 3, '★ beds are counted across columns, not per column')

  // ★★ A BROKEN BED STOPS COUNTING, which is the property that makes a derived count safe. The host
  // overwrites the edit with whatever replaced it; nothing has to remember to decrement a tally.
  ok(countBeds([col(STONE)], ONE) === 0, '★★ a bed replaced by something else is no longer a bed')

  // ⚠ Guards the material comparison itself — a `truthy` test instead of `===` would count every
  // edit in the world and lock a keeper out of their garden after their first tunnel.
  ok(countBeds([col(1, 2, 3, 4, 5)], ONE) === 0, '★ only the bed material counts, not any edit')
}

// ── ★★ THE CAP SPANS ALL THREE WOODS (2026-08-22) ──────────────────────────────────────────────
// The bed became three materials the day Alex asked for the plank to decide the border colour. The
// allowance did NOT become three allowances, and that is the whole risk of the split: a per-wood
// count is invisible (every single-wood garden behaves identically) and only shows up as a keeper
// holding thirty beds because they own three woods.
{
  const col = (...mats: number[]) => new Map(mats.map((m, i) => [i, m]))
  const woods = BED_WOODS.map(b => b.material)
  ok(woods.length === 3, 'three plank woods — goldwood, shimmeroak, dawnwood; starwillow has no plank')

  // One of each, in one column. The default set is the real one, which is what the host passes.
  ok(countBeds([col(...woods)]) === 3,
    '★★ a bed of every wood counts toward ONE ration, not three')

  // ...and the derivation is not blind: a material that is not a bed still must not count.
  ok(countBeds([col(...woods, 1, 2, 3)]) === 3, '★ non-bed edits alongside them still do not count')

  // ⚠ THE MIRROR CHECK. `GARDEN_BEDS` and `BED_WOODS` must not drift into two lists — the set is
  // derived from the table, and this asserts that it still IS derived rather than re-typed.
  ok(woods.every(m => isGardenBed(m)) && GARDEN_BEDS.size === woods.length,
    '★ the set is exactly the table, not a second copy of it')
  ok(!isGardenBed(undefined) && !isGardenBed(MAT.TOPSOIL),
    'holding a non-block, and plain ground, are both not beds')
}

console.log(`\ngarden: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
