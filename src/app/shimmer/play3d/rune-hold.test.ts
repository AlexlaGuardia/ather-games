/**
 * Rune Hold greybox — the authoring oracle.
 *
 * ★ WHY: authored geometry can sit at any height, and a face between the step band and the vault
 * tier reads to the player as the CONTROLS being broken rather than the map. `metrics.ts` exists to
 * name the tiers; this asserts the town actually lands on them, for BOTH mannequins.
 *
 * Run: `npx tsx src/app/shimmer/play3d/rune-hold.test.ts`
 */
import { runeHold, townFaults, FRONTS, ladderFor } from './rune-hold'
import { BODIES, BODY, metricsFor, readsAs } from './metrics'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

// ── 1. the town reads, for EITHER mannequin ───────────────────────────────────────────────────
// ★★ THIS IS THE ASSERT THAT LETS THE GREYBOX START BEFORE ALEX RULES THE BODY. If the town is
// clean against both, the mannequin question cannot be silently decided by this file — flipping
// `BODY` re-derives it and the sweep still passes. The day someone types a literal height in
// `rune-hold.ts`, one of these two goes red and names the piece.
for (const [name, body] of [['voxel', BODIES.voxel], ['play3d', BODIES.play3d]] as const) {
  const town = runeHold(body)
  const faults = townFaults(town)
  ok(faults.length === 0,
     `${name} body: the town reads` + (faults.length ? ` — ${faults.map(f => JSON.stringify(f)).join(' · ')}` : ''))
  ok(town.body === body, `${name} body: the town knows which mannequin it was built for`)
}

// ── 2. the two bodies really do produce different towns ───────────────────────────────────────
// A parameter nothing passes a second value to is a parameter in name only — the lesson from the
// metrics de-pinning, applied to its first consumer.
{
  const v = runeHold(BODIES.voxel), p = runeHold(BODIES.play3d)
  ok(v.square.size !== p.square.size, 'the square is sized from the body, so the two differ')
  ok(v.streets.some((s, i) => s.width !== p.streets[i].width), 'street widths track the body')
  ok(v.masses.every(m => Number.isFinite(m.h)) && p.masses.every(m => Number.isFinite(m.h)),
     'every face has a real height in both towns')
}

// ── 3. canon, asserted rather than reviewed ───────────────────────────────────────────────────
// ⚠ THE ONE-DOOR RULING IS ONE CHARACTER WIDE AND A SECOND `open: true` READS AS A CONVENIENCE.
ok(FRONTS.filter(f => f.open).length === 1, 'exactly one door is open in v1')
ok(FRONTS.find(f => f.open)?.id === 'spirit-corner', 'and it is the Spirit Corner')
ok(FRONTS.length === 5, 'the five ruled storefronts front the square')
for (const id of ['kindled-mug', 'spirit-corner', 'eyuun-bookstore', 'the-passage', 'notice-board'])
  ok(FRONTS.some(f => f.id === id), `canon front present: ${id}`)

// ★ THE STATION IS INFRASTRUCTURE AT THE EDGE, NOT A STOREFRONT ON THE SQUARE.
{
  const t = runeHold(BODY)
  ok(!FRONTS.some(f => (f.id as string) === 'travelers-station'), 'the Station is not a storefront')
  const fromSquare = Math.hypot(t.station.x - t.square.x, t.station.z - t.square.z)
  ok(fromSquare > t.square.size, `the Station sits at the town's edge (${fromSquare.toFixed(1)} from the square)`)
  const road = t.streets.find(s => s.id === 'station-road')!
  ok(road.fromTerrace > 0, 'the Station road starts above the square — reached THROUGH the town')
}

// ── 4. every face lands on a tier the walker has a verb for ───────────────────────────────────
// The ambiguous band is the whole reason `metrics.ts` exists: too tall to cross at speed, too short
// to read as an obstacle, and the player blames the controls.
for (const [name, body] of [['voxel', BODIES.voxel], ['play3d', BODIES.play3d]] as const) {
  const t = runeHold(body)
  ok(readsAs(t.terraceRise) !== 'ambiguous', `${name}: the terrace rise is a tier (${t.terraceRise.toFixed(2)})`)
  for (const m of t.masses)
    ok(readsAs(m.h) !== 'ambiguous', `${name}: ${m.id} face ${m.h.toFixed(2)} reads as ${readsAs(m.h)}`)
  const M = metricsFor(body)
  for (const s of t.streets)
    ok(s.width >= M.widths.passMin, `${name}: ${s.id} is passable (${s.width.toFixed(2)} >= ${M.widths.passMin.toFixed(2)})`)
}

// ── 5. the notice board is furniture, not a shopfront ─────────────────────────────────────────
// ★ It stands ON the square, so if it were shop-height it would wall off the sightline the square
// exists to give. Asserted against the body's own standing cover rather than a number.
for (const body of [BODIES.voxel, BODIES.play3d]) {
  const t = runeHold(body)
  const board = t.masses.find(m => m.id === 'notice-board')!
  const shop = t.masses.find(m => m.id === 'spirit-corner')!
  ok(board.h < shop.h, `board (${board.h.toFixed(2)}) is lower than a shopfront (${shop.h.toFixed(2)})`)
  ok(board.h <= metricsFor(body).cover.full, 'the board never becomes full cover on the square')
}

// ── 6. the ladder is body-derived, so a reviewer reads the right one ──────────────────────────
{
  const a = ladderFor(BODIES.voxel), b = ladderFor(BODIES.play3d)
  ok(a.flow === b.flow && a.vault === b.vault, 'kit-derived rungs are shared across bodies')
  ok(a.laneStreet !== b.laneStreet, 'body-derived rungs are not')
}

console.log(`rune-hold: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
