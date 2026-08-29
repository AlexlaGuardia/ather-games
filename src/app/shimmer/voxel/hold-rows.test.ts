// The rows' oracle. Run: npx tsx src/app/shimmer/voxel/hold-rows.test.ts
//
// ★ THE PROPERTY: **the rows are TIDY, they face the middle, and they open where the player walks
// in.** Canon fixes all three, and each has a failure that looks like architecture rather than a
// bug: a crowd that gathered instead of a stock that was placed, an audience facing outward, or a
// beat where the player cannot reach the floor they were being walked toward.
import { holdRows, bowlCentre, bowlFloorRadius, DEFAULT_ROWS, type Seat } from './hold-rows'
import type { Box } from './jigsaw'
import { DOWNBARROW_HEARTS } from './burrowtown'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

/** A green the size the pool actually produces — `green_round`, 31x31. */
const GREEN: Box = { x0: 100, x1: 130, z0: 200, z1: 230 }
const C = bowlCentre(GREEN)
const dist = (s: Seat) => Math.hypot(s.x - C.x, s.z - C.z)

// ── 1. ★★ THERE IS AN AUDIENCE AT ALL ─────────────────────────────────────────────────────────
{
  const seats = holdRows(GREEN, 0)
  ok(seats.length > 30, `★★ BLIND CHECK: ${seats.length} seats — a handful is not "in tidy rows" and every assert below would be vacuous`)
  ok(new Set(seats.map(s => s.row)).size === DEFAULT_ROWS.rows,
    `★ every row is populated (${new Set(seats.map(s => s.row)).size} of ${DEFAULT_ROWS.rows})`)
  ok(seats.every(s => Number.isFinite(s.x) && Number.isFinite(s.z)), 'every seat has a real position')
}

// ── 2. ★★★ TIDY MEANS EVEN ARC SPACING, NOT EVEN ANGLES ───────────────────────────────────────
// Equal angles crowd the inner row and thin the outer one — a crowd that gathered. The cruelty here
// is bookkeeping made visible, so the regularity IS the content.
{
  const seats = holdRows(GREEN, 0)
  for (let row = 0; row < DEFAULT_ROWS.rows; row++) {
    const mine = seats.filter(s => s.row === row)
    if (mine.length < 4) continue
    // Neighbour gaps along the row, ignoring the aisle (the largest gap by construction).
    const byAngle = [...mine].sort((a, b) =>
      Math.atan2(a.z - C.z, a.x - C.x) - Math.atan2(b.z - C.z, b.x - C.x))
    const gaps: number[] = []
    for (let i = 1; i < byAngle.length; i++) {
      gaps.push(Math.hypot(byAngle[i].x - byAngle[i - 1].x, byAngle[i].z - byAngle[i - 1].z))
    }
    gaps.sort((a, b) => a - b)
    const inner = gaps.slice(0, -1)          // drop the aisle
    const spread = inner[inner.length - 1] - inner[0]
    ok(spread < 0.35,
      `★★★ row ${row} is evenly spaced by ARC LENGTH (gap spread ${spread.toFixed(3)} blocks over ${inner.length} gaps)`)
    ok(near(inner[0], DEFAULT_ROWS.seatStep, 0.35),
      `★★ and at the dialled spacing (${inner[0].toFixed(2)} vs ${DEFAULT_ROWS.seatStep})`)
  }
  // ⚠ THE CONSEQUENCE THAT PROVES IT IS ARC AND NOT ANGLE: an outer row must hold MORE seats.
  const perRow = [0, 1, 2].map(r => seats.filter(s => s.row === r).length)
  ok(perRow[2] > perRow[0],
    `★★★ the outer row seats more than the inner one (${perRow.join(' < ')}) — equal ANGLES would make these equal, which is the bug this asserts against`)
}

// ── 3. ★★★ EVERY SEAT FACES THE MIDDLE ────────────────────────────────────────────────────────
// S4: *"dimmed, facing the middle."* An audience facing outward is the same geometry saying the
// opposite thing, and it would look deliberate.
{
  for (const s of holdRows(GREEN, 0)) {
    const toCentre = Math.atan2(C.z - s.z, C.x - s.x)
    let d = s.yaw - toCentre
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    if (Math.abs(d) > 1e-9) {
      ok(false, `★★★ a seat at (${s.x.toFixed(1)},${s.z.toFixed(1)}) faces ${d.toFixed(3)} rad off the middle`)
      break
    }
  }
  ok(true, '★★★ every seat faces the centre of the bowl')
}

// ── 4. ★★★ THE ROWS OPEN WHERE THE PLAYER WALKS IN ────────────────────────────────────────────
// S4: the player *"passes the audience on the way in."* You cannot walk through an occupied row, and
// an aisle facing the wrong way puts the audience behind them — the one thing the beat forbids.
{
  for (const entry of [0, 1.2, -2.4, Math.PI, 3.0]) {
    const seats = holdRows(GREEN, entry)
    const offAisle = seats.filter(s => {
      let d = Math.atan2(s.z - C.z, s.x - C.x) - entry
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      return Math.abs(d) < DEFAULT_ROWS.aisleHalfAngle
    })
    ok(offAisle.length === 0,
      `★★★ the aisle at ${entry.toFixed(2)} rad is clear (${offAisle.length} seats standing in the way in)`)
  }
  // ⚠ AND THE WRAP MATTERS. An aisle straddling angle 0 opens on only one side without it, which is
  // a half-blocked entrance — visible only at one bearing out of the whole circle.
  const straddling = holdRows(GREEN, 0)
  const nearZero = straddling.filter(s => {
    const a = Math.atan2(s.z - C.z, s.x - C.x)
    return Math.abs(a) < DEFAULT_ROWS.aisleHalfAngle || Math.abs(Math.abs(a) - Math.PI * 2) < DEFAULT_ROWS.aisleHalfAngle
  })
  ok(nearZero.length === 0,
    `★★★ an aisle straddling 0 opens on BOTH sides (${nearZero.length} seats) — the wrap is what makes that true`)
}

// ── 5. ★★ THE ROWS STEP OUTWARD AND UP, SO THE BACK CAN SEE OVER THE FRONT ────────────────────
{
  const seats = holdRows(GREEN, 0)
  for (let row = 1; row < DEFAULT_ROWS.rows; row++) {
    const inner = seats.filter(s => s.row === row - 1)
    const outer = seats.filter(s => s.row === row)
    if (!inner.length || !outer.length) continue
    ok(Math.min(...outer.map(dist)) > Math.max(...inner.map(dist)) - 0.001,
      `★★ row ${row} sits entirely outside row ${row - 1}`)
    ok(outer[0].y > inner[0].y, `★★ and higher (${inner[0].y} → ${outer[0].y}) — a flat bank hides the front row's own captives`)
  }
}

// ── 6. ★★ THE BOWL FITS INSIDE THE GREEN IT IS WORN INTO ──────────────────────────────────────
// A ring larger than its green stands in somebody's house — and the green is a jigsaw piece with
// neighbours sharing its walls.
{
  const halfSpan = Math.min(GREEN.x1 - GREEN.x0, GREEN.z1 - GREEN.z0) / 2
  ok(holdRows(GREEN, 0).every(s => dist(s) <= halfSpan + 0.001),
    `★★★ every seat stays inside the green (half-span ${halfSpan})`)

  // ⚠ A SMALL GREEN MUST DEGRADE, NOT OVERFLOW. `green_long` is 31x21, so its short axis is 21.
  const small: Box = { x0: 0, x1: 36, z0: 0, z1: 26 }
  const sm = holdRows(small, 0)
  const smHalf = 13
  ok(sm.every(s => Math.hypot(s.x - 18, s.z - 13) <= smHalf + 0.001),
    '★★★ and on a smaller green too — a partial ring is honest, an overflowing one is a wall through a neighbour')
  ok(sm.length > 0, `★★ while still seating an audience (${sm.length}) — degrading to nothing would delete the set piece`)

  // ⚠⚠ A GREEN TOO SMALL FOR ITS OWN SEATING — and the fixture has to REACH that case or the
  // containment guard is decoration. The two greens above both hold every row, so removing the
  // clip changes nothing about them: the mutation sweep caught this assert passing for the wrong
  // reason. 21x21 gives a half-span of 10 against rows at 9, 11 and 13, so two rows must be
  // refused. A ring that overflowed here would put seating inside a neighbouring mass, and the
  // greens SHARE walls with their neighbours by construction — `interiorsOverlap` permits it.
  const tiny: Box = { x0: 0, x1: 20, z0: 0, z1: 20 }
  const tn = holdRows(tiny, 0)
  ok(tn.every(s => Math.hypot(s.x - 10, s.z - 10) <= 10.001),
    `★★★ a green too small for its seating CLIPS rather than overflowing (${tn.filter(s => Math.hypot(s.x - 10, s.z - 10) > 10.001).length} seats outside)`)
  ok(new Set(tn.map(s => s.row)).size < DEFAULT_ROWS.rows,
    `★★ and honestly drops the rows that do not fit (${new Set(tn.map(s => s.row)).size} of ${DEFAULT_ROWS.rows}) — a partial ring is honest, a wall through a neighbour is not`)
}

// ── 7. ★★ DETERMINISTIC AND SEEDLESS, BY DESIGN ───────────────────────────────────────────────
// Every other assembly here is seeded because it must vary. This one must not: tidy rows are not
// rolled ones, and any column has to re-derive the same seating without talking to its neighbours.
{
  const a = JSON.stringify(holdRows(GREEN, 1.1))
  const b = JSON.stringify(holdRows(GREEN, 1.1))
  ok(a === b, '★★★ the same green and the same way in seat identically, every time')
  ok(a !== JSON.stringify(holdRows(GREEN, 2.2)), '★ while a different way in moves the aisle')
}

// ── 8. ★★ THE CAP IS REAL, AND THE FLOOR IS NOT THE RING ──────────────────────────────────────
{
  const capped = holdRows({ x0: 0, x1: 400, z0: 0, z1: 400 }, 0, { ...DEFAULT_ROWS, maxSeats: 12 })
  ok(capped.length === 12, `★★ maxSeats bounds the audience (${capped.length})`)
  ok(bowlFloorRadius() < DEFAULT_ROWS.innerRadius,
    '★ the floor is everything inside the first row')
  // ⚠ Canon's build order: the rows exist, the fighting floor does not. A helper that quietly grew
  // one would collapse the two, and the brief is explicit that the rows come first.
  ok(typeof bowlFloorRadius() === 'number' && bowlFloorRadius() > 0,
    '★★ and it is an EXTENT only — no floor geometry is built here, deliberately')
}

// ── 9. ★★★ EVERY GREEN THE POOL PRODUCES CAN HOLD EVERY ROW ───────────────────────────────────
// The green is the set piece; the rows are what makes it one. A green too small drops its back row
// SILENTLY — not a crash, just a smaller audience, and *"in tidy rows"* quietly becoming two rows is
// the sort of thing nobody notices. ⚠ This is a cross-file DERIVATION check: it compares what the
// pool offers against what the seating needs, so shrinking a green OR adding a row goes red. My
// first pass sized the greens as ordinary jigsaw pieces and the third row did not fit — which
// building the rows found, and which is why canon put them first.
{
  ok(DOWNBARROW_HEARTS.length >= 2, `★★ BLIND CHECK: ${DOWNBARROW_HEARTS.length} hearts to check`)
  const needed = DEFAULT_ROWS.innerRadius + (DEFAULT_ROWS.rows - 1) * DEFAULT_ROWS.rowStep
  for (const g of DOWNBARROW_HEARTS) {
    const half = Math.min(g.w, g.d) / 2
    ok(half >= needed,
      `★★★ '${g.id}' (${g.w}x${g.d}, half-span ${half}) holds all ${DEFAULT_ROWS.rows} rows (needs ${needed})`)
    const box: Box = { x0: 0, x1: g.w - 1, z0: 0, z1: g.d - 1 }
    const rowsSeen = new Set(holdRows(box, 0).map(s => s.row)).size
    ok(rowsSeen === DEFAULT_ROWS.rows,
      `★★★ and seats all of them in practice, not just on paper (${rowsSeen} of ${DEFAULT_ROWS.rows})`)
  }
}

if (fails.length) {
  console.log(`\n${fails.map(f => `  ✗ ${f}`).join('\n')}\n`)
  console.log(`❌ ${fails.length} failed, ${pass} passed`)
  process.exit(1)
}
console.log(`✅ the rows are tidy, they face the middle, and they open where you walk in — ${pass} passed`)
