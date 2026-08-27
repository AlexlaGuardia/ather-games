/**
 * THE DOOR ROUND TRIP — a gate that goes out to the map editor must come back a gate.
 *
 * ★ WHY THIS FILE DID NOT EXIST AND SHOULD HAVE. `expandGate` (gate -> warp tiles) runs on every
 * module load for every zone, so it is exercised constantly. Its inverse ran only when somebody hit
 * save in the editor, and **nothing checked it at all** — which is how "A Gate is square by
 * definition" survived three days after `Gate` was widened with `w`/`h` for a 1x2 landing. The
 * failure was invisible in the direction that matters: the save returned 200, wrote a file, and
 * quietly dropped the label the whole crossing keys off.
 *
 * ⚠ THE ASSERT THAT MATTERS IS `expand -> collapse === identity`, NOT "the collapse handles 1x2".
 * A shape-specific test passes the day someone adds a shape-specific branch and goes quiet again on
 * the next widening. Comparing against `expandGate` compares two DERIVATIONS of one fact, so the
 * day the two disagree — for any footprint anyone ever paints — this goes red on its own.
 *
 * Run: `npx tsx src/app/shimmer/world/gate-collapse.test.ts`
 */
import { ALL_ZONES } from './all-zones'
import { expandGate, gateFootprint, type Gate, type Zone } from './zones'
import { collapseGates, footprintFields, type PaintedWarp } from './gate-collapse'
import { crossingReady, landingGate, LANDING_LABEL } from '../voxel3d/crossing-out'

let pass = 0
const fails: string[] = []
const ok = (cond: boolean, msg: string) => { if (cond) pass++; else fails.push(msg) }

/** The editor hands tiles over in paint order, which is not necessarily reading order. */
const asPainted = (g: Gate): PaintedWarp[] =>
  expandGate(g).map(w => ({
    fromX: w.fromX, fromY: w.fromY, toZone: w.toZone, toX: w.toX, toY: w.toY,
    direction: w.direction, requiredFlag: w.requiredFlag, gate: w.gate, ownerOnly: w.ownerOnly,
  }))

const sameGate = (g: Gate, got: { x: number; y: number; w: number; h: number; label: string; toZone: string; toX: number; toY: number }) => {
  const fp = gateFootprint(g)
  return got.x === g.x && got.y === g.y && got.w === fp.w && got.h === fp.h
    && got.label === g.label && got.toZone === g.toZone && got.toX === g.toX && got.toY === g.toY
}

// ── 1. every door already on the map survives a round trip ───────────────────────────────────
// This is the regression that would have caught the bug on the fourteen gates that DO round-trip,
// had any of them been non-square. None were, which is precisely why nothing noticed.
{
  let checked = 0
  for (const z of ALL_ZONES) {
    const gates: Gate[] = (z as unknown as { gates?: Gate[] }).gates ?? []
    for (const g of gates) {
      const { gates: back, loose, demoted } = collapseGates(asPainted(g))
      checked++
      ok(back.length === 1 && loose.length === 0 && demoted.length === 0,
        `${z.id} "${g.label}" collapses to exactly one gate (got ${back.length} gates, ${loose.length} loose, ${demoted.length} demoted)`)
      if (back.length === 1) ok(sameGate(g, back[0]), `${z.id} "${g.label}" round-trips unchanged — got ${JSON.stringify(back[0])}`)
      if (back.length === 1) ok(back[0].ownerOnly === (g.ownerOnly || undefined) || (!back[0].ownerOnly && !g.ownerOnly),
        `${z.id} "${g.label}" keeps ownerOnly (${g.ownerOnly} -> ${back[0].ownerOnly})`)
    }
  }
  // ⚠ MEASURED, NOT QUOTED. `zones.ts` says "the fourteen gates already painted"; the map actually
  // carries TEN doors (8 in zones.ts + 2 on region maps). A floor, not an equality — this exists to
  // notice the day this loop silently checks nothing, not to be re-edited whenever a door is added.
  ok(checked >= 10, `the shipped map still has doors to check (${checked})`)
}

// ── 2. THE LANDING — the shape the whole thing was widened for ───────────────────────────────
// ⚠ 1x2, and it is the ONLY non-square gate the map will have. Before the fix this group came back
// as two loose warps with no label, so `landingGate()` found nothing and `crossingReady()` stayed
// false with a successful save behind it.
{
  const landing: Gate = { x: 40, y: 50, w: 1, h: 2, toZone: 'rune-hold', toX: 41, toY: 51, label: 'THE LANDING', direction: 'down' }
  const { gates: back, loose, demoted } = collapseGates(asPainted(landing))
  ok(back.length === 1 && loose.length === 0, `a 1x2 landing collapses to one gate (got ${back.length} gates, ${loose.length} loose)`)
  ok(demoted.length === 0, `a 1x2 landing is not demoted (${demoted.join(' · ')})`)
  if (back.length === 1) {
    ok(sameGate(landing, back[0]), `the 1x2 landing round-trips unchanged — got ${JSON.stringify(back[0])}`)
    ok(back[0].label === 'THE LANDING', 'the label survives — this is the field crossingReady() reads')
  }
  // The other orientation, because a bug that reads one axis is a bug that reads one axis.
  const wide: Gate = { x: 3, y: 4, w: 3, h: 1, toZone: 'rune-hold', toX: 9, toY: 9, label: 'WIDE' }
  const w2 = collapseGates(asPainted(wide))
  ok(w2.gates.length === 1 && sameGate(wide, w2.gates[0]), `a 3x1 door round-trips too — got ${JSON.stringify(w2.gates[0])}`)
}

// ── 3. the footprint SPELLING is the type's defaults read backwards ──────────────────────────
// ⚠ These three cases are why a 2x2 save does not churn the fourteen doors already in the file.
{
  ok(footprintFields({ w: 2, h: 2 }).length === 0, '2x2 writes nothing — 2 is what gateFootprint assumes')
  ok(footprintFields({ w: 3, h: 3 }).join() === 'size: 3', 'a square writes size')
  ok(footprintFields({ w: 1, h: 2 }).join() === 'w: 1,h: 2', 'a rectangle writes both axes')
  // ★ AND THE SPELLING MUST SURVIVE BEING READ BACK. Comparing the string to a string proves
  // nothing about gateFootprint; parse it the way zones.ts would and compare the NUMBERS.
  for (const fp of [{ w: 2, h: 2 }, { w: 3, h: 3 }, { w: 1, h: 2 }, { w: 4, h: 1 }]) {
    const parts = footprintFields(fp)
    const g: Gate = { x: 0, y: 0, toZone: 'x', toX: 1, toY: 1, label: 'L' }
    for (const p of parts) {
      const [k, v] = p.split(': ')
      ;(g as unknown as Record<string, number>)[k] = Number(v)
    }
    const readBack = gateFootprint(g)
    ok(readBack.w === fp.w && readBack.h === fp.h,
      `${fp.w}x${fp.h} spelled as [${parts.join(', ')}] reads back as ${readBack.w}x${readBack.h}`)
  }
}

// ── 4. the refusals, which must still refuse ─────────────────────────────────────────────────
{
  const base = { toZone: 'rune-hold', toX: 9, toY: 9, gate: 'RAGGED' }
  // An L: bounding box 2x2, only three tiles. A Gate cannot describe it.
  const ragged: PaintedWarp[] = [
    { ...base, fromX: 0, fromY: 0 }, { ...base, fromX: 1, fromY: 0 }, { ...base, fromX: 0, fromY: 1 },
  ]
  const r = collapseGates(ragged)
  ok(r.gates.length === 0 && r.loose.length === 3, `a ragged group is refused, whole (${r.gates.length} gates, ${r.loose.length} loose)`)
  ok(r.demoted.length === 1 && r.demoted[0].includes('RAGGED'), `and the refusal is NAMED — ${r.demoted.join(' · ')}`)

  // ★★ THE CHEAPEST WRONG ANSWER: a duplicate tile making a count add up. `length === w*h` would
  // accept this and write a 2x2 gate over a cell that does not warp. Membership is why it does not.
  const dupes: PaintedWarp[] = [
    { ...base, gate: 'DUPES', fromX: 0, fromY: 0 }, { ...base, gate: 'DUPES', fromX: 0, fromY: 0 },
    { ...base, gate: 'DUPES', fromX: 1, fromY: 1 }, { ...base, gate: 'DUPES', fromX: 1, fromY: 1 },
  ]
  const d = collapseGates(dupes)
  ok(d.gates.length === 0, `four tiles that are really two do NOT become a 2x2 door (got ${d.gates.length})`)

  // Two doors sharing a name at opposite ends of one map must not merge into a giant gate.
  const twins: PaintedWarp[] = [
    { ...base, gate: 'RUNE HOLD', fromX: 0, fromY: 0 }, { ...base, gate: 'RUNE HOLD', fromX: 1, fromY: 0 },
    { ...base, gate: 'RUNE HOLD', fromX: 0, fromY: 1 }, { ...base, gate: 'RUNE HOLD', fromX: 1, fromY: 1 },
    { ...base, gate: 'RUNE HOLD', fromX: 80, fromY: 80 },
  ]
  const t = collapseGates(twins)
  ok(t.gates.length === 0, 'a door plus a stray tile under one name is refused rather than spanned')

  // A warp with no label is not a gate and never was.
  const plain = collapseGates([{ toZone: 'rune-hold', toX: 1, toY: 1, fromX: 5, fromY: 5 }])
  ok(plain.gates.length === 0 && plain.loose.length === 1 && plain.demoted.length === 0,
    'an unlabelled warp stays a loose warp and is not reported as a demotion')
}

// ── 5. THE SEAM NOBODY OWNS: does a collapsed landing actually open the crossing? ────────────
// ★ Sections 1-4 prove the collapse is faithful. Faithful to WHAT is the question this asks. The
// crossing does not read a footprint or a round trip — it reads `landingGate()`, which searches the
// shipped zones for a gate whose LABEL matches, and that is the exact field the old refusal threw
// away. Three green suites and nothing testing the join between them is how the first version of
// this shipped, so the join gets an assert of its own.
{
  const painted: PaintedWarp[] = [
    { fromX: 40, fromY: 50, toZone: 'rune-hold', toX: 41, toY: 51, gate: 'THE LANDING', direction: 'down' },
    { fromX: 40, fromY: 51, toZone: 'rune-hold', toX: 41, toY: 51, gate: 'THE LANDING', direction: 'down' },
  ]
  const { gates: back } = collapseGates(painted)
  const town = { id: 'rune-hold', gates: back } as unknown as Zone
  ok(crossingReady([town]) === true, 'a 1x2 THE LANDING, collapsed, opens the crossing')
  ok(landingGate([town])?.label === LANDING_LABEL, 'and landingGate finds it by the label the crossing reads')

  // ⚠ THE NEGATIVE, because a check that cannot say no is decoration. Same tiles, no label — which
  // is EXACTLY what the demotion used to write — must leave the crossing closed.
  const unlabelled = painted.map(({ gate: _gate, ...rest }) => rest)
  const stripped = collapseGates(unlabelled)
  const closed = { id: 'rune-hold', gates: stripped.gates } as unknown as Zone
  ok(crossingReady([closed]) === false, 'the same tiles WITHOUT a label leave the crossing closed — the old bug, asserted')

  // And the refusal is still a refusal: no landing anywhere means no crossing.
  ok(crossingReady([{ id: 'rune-hold', gates: [] } as unknown as Zone]) === false,
    'an unpainted square refuses cleanly')
}

console.log(`gate round trip: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
