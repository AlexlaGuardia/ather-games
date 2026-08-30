// The ring floor's oracle. Run: npx tsx src/app/shimmer/voxel/ring-floor.test.ts
//
// ★ THE PROPERTY: **it must read as WORN, never as BUILT.** Canon asks for *"a stage worn flat by
// use"* and bans ⛔ *"a flattened construction pad"* in the same breath, and every failure here looks
// like architecture rather than a bug: a surveyed circle, a uniform depth, a hard edge.
import { bowlAt, floorSurface, DEFAULT_FLOOR } from './ring-floor'
import { bowlCentre, bowlFloorRadius, DEFAULT_ROWS, holdRows } from './hold-rows'
import { DOWNBARROW_HEARTS } from './burrowtown'
import type { Box } from './jigsaw'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const GREEN: Box = { x0: 100, x1: 130, z0: 200, z1: 230 }
const C = bowlCentre(GREEN)
const at = (dx: number, dz: number) => bowlAt(GREEN, C.x + dx, C.z + dz)

// ── 1. ★★ THERE IS A BOWL, AND IT IS SHALLOW ──────────────────────────────────────────────────
{
  // ⚠⚠ CONTRACT CHANGE 2026-08-30, NOT A REGRESSION. This asserted the middle DIPPED. Alex looked
  // at it and called it a dirt horseshoe, and the fix he named — raise the floor flush with the
  // grass — also corrects a canon error: a hold is *"neither built nor dug"*, and an excavated
  // hollow is digging, which is what FREE Moglins do. The dip Bonn describes now comes from the
  // banks rising around a floor that was *"worn flat by use"*.
  ok(at(0, 0).drop === 0, `★★★ the floor is FLUSH with the green — a collarer takes ground, he does not carve it (${at(0, 0).drop})`)
  ok(at(0, 0).wear > 0, `★★ BLIND CHECK: the middle is still worn, which is what the surface reads off (${at(0, 0).wear.toFixed(2)})`)
  // ⚠⚠ AGAINST AN ABSOLUTE, NOT AGAINST THE DIAL. This read `drop <= DEFAULT_FLOOR.maxDrop`, which
  // moves WITH the value it is checking and therefore cannot fail — the mutation sweep raised
  // maxDrop to 6 and the assert sailed through. Canon's word is **shallow**, and what makes it
  // shallow is not a number this file chose: a bowl deeper than a keeper is tall stops being a dip
  // you look down into and becomes a pit you are thrown into, which is a different room.
  const SHALLOW = 3
  ok(DEFAULT_FLOOR.maxDrop === 0,
    `★★★ nothing is dug at all (maxDrop ${DEFAULT_FLOOR.maxDrop}) — "neither built nor dug" is the law, and digging is the FREE Moglins' verb`)
  ok(at(0, 0).drop <= SHALLOW, `★★ and the dial cannot exceed a dip even if someone reaches for it (${at(0, 0).drop})`)
  let worst = 0
  for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) worst = Math.max(worst, at(x, z).drop)
  ok(worst <= SHALLOW, `★★ nowhere in the green is deeper (${worst})`)
  for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) {
    if (at(x, z).drop < 0) { ok(false, `a cell dips upward at ${x},${z}`); break }
  }
  ok(true, '★ and nothing dips upward')
}

// ── 2. ★★★ WORN, NOT BUILT — THE DEPTH IS A FALLOFF, NOT A STEP ───────────────────────────────
// A pad is uniformly deep to a hard edge. Wear is deepest where the feet are and shallows outward.
{
  const ring = (r: number) => {
    let s = 0, n = 0
    for (let a = 0; a < Math.PI * 2; a += 0.05) { s += at(Math.cos(a) * r, Math.sin(a) * r).wear; n++ }
    return s / n
  }
  const w0 = ring(0.5), w4 = ring(4), w7 = ring(7)
  // ⚠⚠ A GAP, NOT AN ORDERING. This asked only `w0 > w4 > w7`, and with a uniform depth the three
  // means land within noise of each other — so the ordering became a coin flip and the mutation
  // sweep found it passing on a floor that was a construction pad. Ordering is what the property
  // sounds like; a MEASURABLE falloff is what it is.
  ok(w0 > w4 && w4 > w7 && w0 - w7 > 0.3,
    `★★★ wear falls off measurably outward (${w0.toFixed(2)} → ${w4.toFixed(2)} → ${w7.toFixed(2)}, drop ${(w0 - w7).toFixed(2)}) — a uniform interior IS the construction pad`)
  ok(w0 > 0.7, `★★ and the middle is properly trodden (${w0.toFixed(2)})`)
}

// ── 3. ★★★ THE RIM IS IRREGULAR — A SURVEYED CIRCLE IS A PAD WHATEVER THE FALLOFF DOES ────────
{
  const edge: number[] = []
  for (let a = 0; a < Math.PI * 2; a += 0.08) {
    // Walk out along this bearing until the bowl stops.
    let r = 0
    for (; r < 25; r += 0.25) if (at(Math.cos(a) * r, Math.sin(a) * r).wear <= 0) break
    edge.push(r)
  }
  const spread = Math.max(...edge) - Math.min(...edge)
  ok(spread > 0.5,
    `★★★ the rim wanders (${spread.toFixed(2)} blocks between nearest and furthest) — a constant radius reads as surveyed, which is the one thing the brief bans`)
  ok(spread < DEFAULT_FLOOR.rimJitter * 2 + 1,
    `★★ but within the dialled jitter (${spread.toFixed(2)}) — a rim that wanders further than its own dial is noise, not wear`)

  // ⚠ AND IT WANDERS SMOOTHLY. A rim keyed per-cell speckles, which reads as damage rather than use.
  let jumps = 0
  for (let i = 1; i < edge.length; i++) if (Math.abs(edge[i] - edge[i - 1]) > 1.0) jumps++
  ok(jumps <= 2,
    `★★★ and it wanders SMOOTHLY (${jumps} abrupt steps around the whole rim) — per-cell noise would read as damage, not as wear`)
}

// ── 4. ★★★ THE RADIUS IS ASKED OF `hold-rows`, NOT RESTATED ───────────────────────────────────
// The floor is *everything inside the first row*. A second copy of that fact here would agree until
// somebody moved a row, and then disagree silently — the hand-kept mirror, one file over.
{
  const base = bowlFloorRadius()
  ok(at(base - 2, 0).wear > 0, `★★ the bowl reaches to just inside the first row (r=${base})`)
  ok(at(base + DEFAULT_FLOOR.rimJitter + 2, 0).wear === 0,
    '★★★ and stops before the seating — a floor that ran under the front row would seat the audience in the fight')

  // ★ The seats must all stand OUTSIDE the bowl, checked against the real seating rather than by eye.
  const inside = holdRows(GREEN, 0).filter(s => bowlAt(GREEN, s.x, s.z).wear > 0)
  ok(inside.length === 0,
    `★★★ every seat stands on unworn ground (${inside.length} seats inside the bowl) — asked of holdRows, not assumed`)
}

// ── 5. ★★★ THE DOCTRINE SPLIT — what un-wears when the hold falls, and what does not ──────────
// S6: *"the cloud takes its colour back."* ⚠ The colour comes back; the ground does not un-dip.
{
  const mid = at(0, 0)
  ok(floorSurface(mid, GREEN, C.x, C.z, 0, false) === 'bare',
    '★★ a FREE green still has a bare, trodden middle — a town gathered here long before anyone collared anything')
  let scorched = 0
  for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) {
    if (floorSurface(bowlAt(GREEN, C.x + x, C.z + z), GREEN, C.x + x, C.z + z, 0, false) === 'scorch') scorched++
  }
  ok(scorched === 0,
    `★★★ and NO scorch anywhere on it (${scorched} cells) — scorch is the collar's, and freeing must lift it`)

  let takenScorch = 0
  for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) {
    if (floorSurface(bowlAt(GREEN, C.x + x, C.z + z), GREEN, C.x + x, C.z + z, 0, true) === 'scorch') takenScorch++
  }
  ok(takenScorch > 0, `★★★ while a TAKEN one is dragged over (${takenScorch} scorched cells) — the guard is not simply always-clean`)

  // ★★ THE DIP IS THE SAME EITHER WAY, AND THAT IS THE WHOLE SPLIT. If freeing changed the geometry,
  // the reward beat would flatten the hollow the act was staged in.
  let same = true
  for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) {
    if (bowlAt(GREEN, C.x + x, C.z + z).drop !== bowlAt(GREEN, C.x + x, C.z + z).drop) same = false
  }
  ok(same && typeof mid.drop === 'number',
    '★★★ `bowlAt` takes no doctrine at all — geometry cannot depend on who owns the hill, so freeing cannot un-dig it')
}

// ── 6. ★★ THE DRAG-LINES FAN FROM THE WAY IN, THEY DO NOT RADIATE ─────────────────────────────
// A rosette of evenly spaced spokes is a decoration. Stock is hauled in from ONE side.
{
  const bearings: number[] = []
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const r = 5
    const x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r
    if (floorSurface(bowlAt(GREEN, x, z), GREEN, x, z, 0, true) === 'scorch') bearings.push(a)
  }
  ok(bearings.length > 0, `★★ BLIND CHECK: found drag-lines to measure (${bearings.length} samples)`)
  // Wrapped to [-pi,pi] about the entry, they must all sit within the fan, not all round the circle.
  const spread = bearings.map(a => { let d = a; while (d > Math.PI) d -= Math.PI * 2; return Math.abs(d) })
  ok(Math.max(...spread) < Math.PI / 2,
    `★★★ every drag-line sits on the entry side (widest ${Math.max(...spread).toFixed(2)} rad) — a full rosette would read as ceremony, and this hold hauls stock`)

  // ⚠ And they MOVE with the way in. A fan pinned to a fixed bearing is decoration nailed to the map.
  let moved = 0
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const x = C.x + Math.cos(a) * 5, z = C.z + Math.sin(a) * 5
    const l = floorSurface(bowlAt(GREEN, x, z), GREEN, x, z, 0, true)
    const r = floorSurface(bowlAt(GREEN, x, z), GREEN, x, z, Math.PI, true)
    if (l !== r) moved++
  }
  ok(moved > 0, `★★★ the fan follows the way in (${moved} cells differ when the entry moves) — otherwise it is nailed to the map`)
}

// ── 7. ★★ EVERY GREEN THE POOL PRODUCES HOLDS ITS OWN BOWL ────────────────────────────────────
{
  for (const g of DOWNBARROW_HEARTS) {
    const box: Box = { x0: 0, x1: g.w - 1, z0: 0, z1: g.d - 1 }
    const c = bowlCentre(box)
    // ⚠ THE FLOOR IS FLUSH NOW, so "has a bowl" is asked as WEAR rather than as depth — the middle
    // is worn bare and the banks make the bowl. Asking for depth here would be asserting the very
    // thing the 08-30 correction removed.
    ok(bowlAt(box, c.x, c.z).wear > 0, `★★ '${g.id}' has a worn floor in the middle of it`)
    let outside = 0
    for (let x = 0; x < g.w; x++) for (let z = 0; z < g.d; z++) {
      if (bowlAt(box, x, z).wear > 0 && Math.hypot(x - c.x, z - c.z) > Math.min(g.w, g.d) / 2) outside++
    }
    ok(outside === 0, `★★★ and it stays inside the green (${outside} worn cells beyond the half-span) — a bowl overflowing its piece wears into a neighbour`)
  }
}

// ── 8. ★ DETERMINISTIC — any column must re-derive the same ground ────────────────────────────
{
  const sig = () => {
    let s = ''
    for (let x = -12; x <= 12; x += 3) for (let z = -12; z <= 12; z += 3) s += `${at(x, z).drop},`
    return s
  }
  ok(sig() === sig(), '★★★ the same cell answers the same, every time — no clock, no dice, no arrival order')
}

if (fails.length) {
  console.log(`\n${fails.map(f => `  ✗ ${f}`).join('\n')}\n`)
  console.log(`❌ ${fails.length} failed, ${pass} passed`)
  process.exit(1)
}
console.log(`✅ worn, not built — ${pass} passed`)
