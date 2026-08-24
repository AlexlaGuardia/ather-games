/**
 * Rune Hold greybox — the authoring oracle.
 *
 * ★ WHY: authored geometry can sit at any height, and a face between the step band and the vault
 * tier reads to the player as the CONTROLS being broken rather than the map. `metrics.ts` exists to
 * name the tiers; this asserts the town actually lands on them, for BOTH mannequins.
 *
 * Run: `npx tsx src/app/shimmer/play3d/rune-hold.test.ts`
 */
import { runeHold, townFaults, gateParts, FRONTS, ladderFor } from './rune-hold'
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
// ⚠ THIS ASSERT USED TO SAY THE OPPOSITE, AND THE FLIP IS THE RULING. Until 2026-08-24 canon staged
// *"exactly one storefront is enterable: The Spirit Corner."* `rune-hold.md` › ★ NO INTERIOR OPENS
// struck it: the Corner is *"a face on the town, not a space that loads"* and stepping through
// Gregory's doorway IS the crossing. ★ A test left asserting a retired contract is worse than no
// test — a red that is merely out of date trains everyone to discount red.
ok(FRONTS.every(f => !f.open), 'no storefront interior is enterable in the opening')
ok(runeHold(BODY).gates.some(g => g.id === 'spirit-corner-gate'),
   "the Corner keeps Gregory's door — it lost the interior, not the crossing")
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

// ── 3b. the route actually chains, square to Station ──────────────────────────────────────────
// ★★ THE GAP THIS CATCHES IS INVISIBLE IN PLAY AND FATAL ON PAPER. Two legs that stop short of each
// other still sit on walkable band, so you can walk between them and nothing looks wrong — while the
// route GRAPH is in two pieces, which is the exact shape that let a shop stand a terrace up with
// nothing reaching it. Asserted as a chain, not as a count of legs.
for (const [name, body] of [['voxel', BODIES.voxel], ['play3d', BODIES.play3d]] as const) {
  const t = runeHold(body)
  const meets = (a: readonly [number, number], b: readonly [number, number]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6
  // ⚠ THE MAIN ROUTE ONLY. A spur is a branch by definition, so folding it into the chain would
  // make the assert fail for the one reason that is not a defect — and the tempting fix for that is
  // to delete the assert.
  const main = t.streets.filter(s => !s.spur)
  let level = 0, broken = ''
  for (let i = 1; i < main.length; i++) {
    const prev = main[i - 1], leg = main[i]
    if (!meets(prev.to, leg.from)) { broken = `${prev.id} ends where ${leg.id} does not begin`; break }
    if (leg.fromTerrace !== prev.toTerrace) { broken = `${leg.id} starts on a band ${prev.id} never reached`; break }
    level = leg.toTerrace
  }
  ok(!broken, `${name}: the streets chain from the square upward` + (broken ? ` — ${broken}` : ''))
  // ★ AND A SPUR MUST HANG OFF GROUND THE MAIN ROUTE ACTUALLY REACHES, or it is a path to a place
  // you can only arrive at by falling into it.
  const reached = new Set([0, ...main.map(s => s.toTerrace)])
  for (const sp of t.streets.filter(s => s.spur))
    ok(reached.has(sp.fromTerrace), `${name}: ${sp.id} leaves from a band the town reaches`)
  const top = Math.round(t.station.y / t.terraceRise)
  ok(level === top, `${name}: the chain ends on the Station's own band (${level} vs ${top})`)
  ok(t.station.y > 0, `${name}: the Station stands where its road delivers (y ${t.station.y.toFixed(2)})`)
}

// ── 3c. a gate's FORM costs geometry, and the frame surrounds the opening ─────────────────────
// ★★ THE GUARD THIS REPLACES COULD NOT FAIL FOR THE REASON IT EXISTED. It compared `kept` to the
// string `'framed'` — two fields agreeing about a label — while the RENDERER held the only
// statement of what a form looks like. A form with no branch drew a bare veil and every assert
// stayed green. `gateParts()` resolves the form to boxes in the pure module, so this compares
// volume and footprint, the way the sapling-icon guard compares coverage instead of source strings.
{
  const t = runeHold(BODY)
  for (const g of t.gates) {
    const parts = gateParts(g)
    const frame = parts.filter(p => p.kind !== 'veil')
    ok(parts.some(p => p.kind === 'veil'), `${g.id}: the crossing itself is drawn in either form`)
    ok(frame.length > 0 && frame.reduce((a, p) => a + p.w * p.h * p.d, 0) > 0,
       `${g.id}: kept, so the frame costs real geometry (${frame.length} parts)`)
    const veil = parts.find(p => p.kind === 'veil')!
    ok(frame.every(p => Math.abs(p.x) - p.w / 2 >= veil.w / 2 - 1e-9 || p.y - p.h / 2 >= veil.h - 1e-9),
       `${g.id}: every frame part is outside the opening, not across it`)
  }
  // ⚠ AND THE OTHER FORM MUST ACTUALLY DIFFER, or the branch is decoration. Canon's grammar only
  // teaches anything if bare and framed are distinguishable at a glance.
  const bare = gateParts({ ...t.gates[0], form: 'bare-spiral', kept: false })
  ok(bare.length < gateParts(t.gates[0]).length, 'a bare spiral is visibly less than a framed doorway')
  ok(bare.every(p => p.kind === 'veil'), 'and it is the note standing in the air, with nothing built around it')
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
