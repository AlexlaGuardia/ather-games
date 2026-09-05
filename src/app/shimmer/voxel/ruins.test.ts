// Ruins oracle — the jigsaw assembler. Run: npx tsx src/app/shimmer/voxel/ruins.test.ts
//
// An assembler's failure modes are all quiet and all look like architecture: a room grown through
// another room, a branch that walked past the envelope and lost its far half at a cell seam, a
// doorway onto nothing, a wall floating over a dip, and — the one this exists to close — a pool
// that assembles the same building every time. Each assert pins one of those, and each was
// mutation-tested against the bug it is written for.

import { DEFAULT_SITES, siteAt } from './sites'
import { DEFAULT_RUINS, RUIN_PIECES, RUIN_REACH, ruinPlan, buildRuin, type RuinPart } from './ruins'
import { hasDescent, warrenPlan } from './warren'
import { columnHeight } from './height'
import { MAT } from './depth'
import { makeColumn, SECTION } from './column'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const CFG = DEFAULT_RUINS

/** Every site in a slab of country, so the asserts run against real ruins and not a fixture. */
const sites = []
for (let cz = -60; cz <= 60; cz++) for (let cx = -60; cx <= 60; cx++) {
  const s = siteAt(SEED, cx, cz)
  if (s) sites.push(s)
}
ok(sites.length > 10, `found ruins to inspect (${sites.length})`)

// ── 1. the envelope is a CORRECTNESS bound, not a taste knob ─────────────────────────────────
// `sites.ts` scans one ring of cells. That is sound only while a ruin cannot leave its own cell.
{
  ok(DEFAULT_SITES.separation * 16 > RUIN_REACH + 1,
    `a ruin can never leave its cell — separation ${DEFAULT_SITES.separation * 16} outreaches envelope ${RUIN_REACH}`)
  ok(RUIN_PIECES.every(p => p.w % 2 === 1 && p.d % 2 === 1),
    'every piece has odd extents — an even edge has no midpoint for a socket to sit on')
  ok(RUIN_PIECES.some(p => p.terminal) && RUIN_PIECES.some(p => !p.terminal),
    'both pools exist — a terminator pool that is empty leaves every deep branch hanging')
}

// ── 2. determinism — the assembly is a pure function of the site, from any column, forever ────
{
  const sig = (parts: RuinPart[]) => parts.map(p => `${p.def.id}@${p.x0},${p.z0},${p.x1},${p.z1},${p.floor}`).join('|')
  let checked = 0
  for (const s of sites.slice(0, 20)) {
    ok(sig(ruinPlan(s, SEED)) === sig(ruinPlan(s, SEED)), `the same site assembles the same ruin (${s.x},${s.z})`)
    checked++
  }
  ok(checked > 5, `determinism checked on ${checked} ruins`)
}

// ── 3. ★ THE POINT OF THE WHOLE FILE: ruins are not all the same ruin ────────────────────────
// Before the assembler this was one 11×11 rectangle everywhere, and NOTHING in the suite could
// tell. The assert is on the SHAPE (piece ids and their offsets from the centre), not on the
// crumble hash — a hash made the old ruins differ cell by cell while every one was the same
// building, so counting distinct block layouts would have passed on the bug this replaces.
{
  const shapes = new Map<string, number>()
  const sizes = new Set<number>()
  for (const s of sites) {
    const parts = ruinPlan(s, SEED)
    const k = parts.map(p => `${p.def.id}:${p.x0 - s.x},${p.z0 - s.z}`).sort().join('|')
    shapes.set(k, (shapes.get(k) ?? 0) + 1)
    sizes.add(parts.length)
  }
  // ⚠ A RAW DISTINCT-SHAPE RATIO IS THE WRONG METRIC AND IT MISLED ME ONCE ALREADY. A third of
  // ruins are one room, so the ratio is dominated by that bucket and moved by 0.4 points when the
  // start piece went from fixed to rolled — a change that quadrupled the variety of every small
  // ruin in the world. What matters is whether ONE building is the world's ruin, so the assert is
  // on DOMINATION, which is the shape of the bug this file replaces: the old generator put the
  // identical 11×11 rectangle on 100% of sites.
  const top = [...shapes.values()].sort((a, b) => b - a)[0] / sites.length
  ok(top < 0.15, `no single building is "the" ruin (most common shape is ${(top * 100).toFixed(1)}% of sites)`)
  ok(shapes.size > 200, `ruins are different buildings (${shapes.size} distinct shapes across ${sites.length} ruins)`)
  ok(sizes.size > 2, `ruins differ in SIZE too, not just in arrangement (${[...sizes].sort((a, b) => a - b).join('/')} pieces)`)
  console.log(`  (variety: ${shapes.size}/${sites.length} shapes, most common ${(top * 100).toFixed(1)}%, ${[...sizes].sort((a, b) => a - b).join('/')} pieces)`)
}

// ── 4. AABB-reject actually rejects, and the envelope actually bounds ────────────────────────
{
  let overlaps = 0, escapes = 0, maxReach = 0, pieces = 0
  for (const s of sites) {
    const parts = ruinPlan(s, SEED)
    pieces += parts.length
    ok(parts.length <= CFG.maxPieces, `ruin at ${s.x},${s.z} respects the piece cap (${parts.length})`)
    for (let i = 0; i < parts.length; i++) {
      const a = parts[i]
      maxReach = Math.max(maxReach, Math.abs(a.x0 - s.x), Math.abs(a.x1 - s.x), Math.abs(a.z0 - s.z), Math.abs(a.z1 - s.z))
      if (Math.abs(a.x0 - s.x) > RUIN_REACH || Math.abs(a.x1 - s.x) > RUIN_REACH ||
          Math.abs(a.z0 - s.z) > RUIN_REACH || Math.abs(a.z1 - s.z) > RUIN_REACH) escapes++
      for (let j = i + 1; j < parts.length; j++) {
        const b = parts[j]
        // Interiors, not boxes: two rooms SHARING a wall is the grammar, two rooms sharing floor
        // space is a building grown through itself.
        if (a.x0 + 1 <= b.x1 - 1 && b.x0 + 1 <= a.x1 - 1 && a.z0 + 1 <= b.z1 - 1 && b.z0 + 1 <= a.z1 - 1) overlaps++
      }
    }
  }
  ok(overlaps === 0, `no room is grown through another (${overlaps} interior overlaps)`)
  ok(escapes === 0, `no piece escapes the envelope (${escapes})`)
  ok(maxReach <= RUIN_REACH, `measured reach ${maxReach} ≤ envelope ${RUIN_REACH}`)

  // ⚠⚠ AND THE SAME ASSERT AGAINST A CONFIG THAT PUSHES ON IT, because under the shipped one it
  // CANNOT FAIL. The size budget stops most assemblies long before the envelope does — deleting
  // the envelope check outright left every assert above green, which makes it decoration and not
  // a guard. This config removes the budget (sizeBias 0 ⇒ always the cap), opens every socket and
  // triples the cap, so the envelope is the ONLY thing standing between the assembler and the
  // neighbouring cell — which is exactly the situation `siteScanCells === 1` is sound for.
  const STRESS = { ...CFG, sizeBias: 0, sprawl: 1, maxPieces: 30, maxDepth: 8 }
  let stressReach = 0, stressPieces = 0
  for (const s of sites.slice(0, 60)) {
    for (const p of ruinPlan(s, SEED, STRESS)) {
      stressPieces++
      stressReach = Math.max(stressReach, Math.abs(p.x0 - s.x), Math.abs(p.x1 - s.x), Math.abs(p.z0 - s.z), Math.abs(p.z1 - s.z))
    }
  }
  ok(stressPieces / 60 > CFG.maxPieces, `the stress config really does push (${(stressPieces / 60).toFixed(1)} pieces per ruin)`)
  ok(stressReach <= RUIN_REACH, `under maximum sprawl nothing leaves the envelope (reach ${stressReach} ≤ ${RUIN_REACH})`)
  ok(DEFAULT_SITES.separation * 16 > stressReach + 1, `…and that reach still cannot leave the cell`)
  console.log(`  (stress: ${(stressPieces / 60).toFixed(1)} pieces per ruin, reach ${stressReach} of ${RUIN_REACH})`)
  ok(pieces / sites.length > 1.5, `ruins actually assemble — ${(pieces / sites.length).toFixed(1)} pieces each on average`)
  console.log(`  (reach: max ${maxReach} of ${RUIN_REACH} allowed; ${(pieces / sites.length).toFixed(1)} pieces per ruin)`)
}

// ── 5. a door is an opening BETWEEN two rooms, never onto nothing ─────────────────────────────
// The terminator pool exists for exactly this: the last ring of rooms must not have doors to
// open country. A door cell has to sit inside at least two pieces — the wall they share.
{
  let orphans = 0, doors = 0
  for (const s of sites) {
    const parts = ruinPlan(s, SEED)
    for (const p of parts) for (const d of p.doors) {
      doors++
      // ⚠ NOT "is this cell inside two boxes" — it always is, the shared wall belongs to both.
      // The question is whether both pieces RECORD it, because a piece that does not record the
      // door draws its wall straight back over the opening. Measuring containment instead of
      // agreement let a one-sided door through the whole suite.
      const containing = parts.filter(q => q.x0 <= d.x && d.x <= q.x1 && q.z0 <= d.z && d.z <= q.z1)
      const agree = containing.filter(q => q.doors.some(e => e.x === d.x && e.z === d.z)).length
      if (containing.length < 2 || agree < containing.length) orphans++
    }
  }
  ok(doors > 0, `ruins have doorways at all (${doors})`)
  ok(orphans === 0, `every doorway is agreed OPEN by both rooms it joins (${orphans} bad)`)
}

// ── 6. nothing floats, and it is provable rather than sampled ─────────────────────────────────
// Each piece seats on the LOWEST surface under its own footprint, so its base course is at or
// below the ground at every cell it covers. That is a property to assert, not a spot check.
{
  let floating = 0, cells = 0
  for (const s of sites.slice(0, 30)) {
    for (const p of ruinPlan(s, SEED)) {
      for (let z = p.z0; z <= p.z1; z++) for (let x = p.x0; x <= p.x1; x++) {
        if (x !== p.x0 && x !== p.x1 && z !== p.z0 && z !== p.z1) continue
        cells++
        if (p.floor > columnHeight(x, z, SEED)) floating++
      }
    }
  }
  ok(cells > 200, `checked real wall cells (${cells})`)
  ok(floating === 0, `no wall course starts above the ground under it (${floating} of ${cells})`)
}

// ── 7. the anti-seam assert: every column derives the same ruin, so a wall crossing a boundary
//      simply IS there on both sides. This is the one that pays for the purity rule. ────────────
{
  const site = sites.find(s => ruinPlan(s, SEED).length > 2) ?? sites[0]
  const parts = ruinPlan(site, SEED)
  const cols = new Map<string, ReturnType<typeof makeColumn>>()
  const colFor = (x: number, z: number) => {
    const ox = Math.floor(x / SECTION) * SECTION, oz = Math.floor(z / SECTION) * SECTION
    const k = `${ox},${oz}`
    if (!cols.has(k)) cols.set(k, makeColumn(ox, oz, SEED))
    return cols.get(k)!
  }
  let stone = 0, rubble = 0
  for (const p of parts) {
    for (let z = p.z0; z <= p.z1; z++) for (let x = p.x0; x <= p.x1; x++) {
      const col = colFor(x, z)
      const m = col.get(x - col.wx, p.floor + 1, z - col.wz)
      if (m === MAT.STONE) stone++
      const g = col.get(x - col.wx, p.floor, z - col.wz)
      if (g === MAT.RUBBLE) rubble++
    }
  }
  ok(cols.size > 1, `the ruin genuinely crosses column boundaries (${cols.size} columns)`)
  ok(stone > 20, `standing wall survives the seam (${stone} stone at floor+1)`)
  ok(rubble > 0, `fallen stone is written too (${rubble} rubble)`)

  // And the direct form: write the same column twice through buildRuin and compare every cell.
  const ox = Math.floor(site.x / SECTION) * SECTION, oz = Math.floor(site.z / SECTION) * SECTION
  const a = makeColumn(ox, oz, SEED), b = makeColumn(ox, oz, SEED)
  buildRuin(a.sections, ox, 0, oz, SECTION, site, SEED)
  buildRuin(b.sections, ox, 0, oz, SECTION, site, SEED)
  let diff = 0
  for (let y = site.floor - 1; y <= site.floor + 5; y++)
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++)
      if (a.get(x, y, z) !== b.get(x, y, z)) diff++
  ok(diff === 0, `a column rebuilt twice is byte-identical (${diff} differing cells)`)

  // ── ★★ THROUGH THE GATE, NOT AROUND IT ────────────────────────────────────────────────────
  // Every assert above talks to `ruinPlan`/`buildRuin` directly. The GAME reaches them through
  // `placeSites`, which clips columns against a radius — and a clip that is too small silently
  // deletes the far half of every ruin, identically on every load, with the module and the oracle
  // both perfectly happy. (That clip WAS the pad radius until the assembler landed.) So: for each
  // column the ruin touches, generate it the way the game does, then run `buildRuin` over it a
  // second time. Writing the same blocks twice is a no-op — so if anything CHANGES, the pipeline
  // had not written it.
  // ── ⚠⚠ ONE LEGITIMATE EXCEPTION, ADDED 2026-09-05 WITH THE DESCENT, AND IT IS NOT A WEAKENING ──
  // A ruin with a warren under it has a STAIRWELL cut up through its floor (`warren.ts`), and the
  // shaft stage runs after `buildRuin` inside the same `placeSites` call. So re-running `buildRuin`
  // legitimately restores the rubble the shaft cleared, and the idempotence this block reasons from
  // is genuinely false over the 3×3 at the site centre — measured as exactly 1 cell.
  //
  // ★ THE GUARD'S PURPOSE IS UNTOUCHED: it exists to catch the reach clip dropping a ruin's OUTER
  // slices, and the shaft is at the dead centre, which is the one place a clip failure can never
  // reach. Excluding it costs the assert nothing and keeps a real red available.
  // ⛔ THE TEMPTING FIX WAS `dropped <= 1`. That is the cheapest thing that turns this green and it
  // would have swallowed a genuinely missing cell anywhere in the ruin, forever, for one cell of
  // convenience — a count nudged until it passes, which is the exact anti-pattern this repo keeps
  // re-learning. Name the cells that are allowed to move instead of raising the tolerance.
  const inStairwell = (wx: number, wz: number): boolean =>
    hasDescent(site) && warrenPlan(site, SEED).length > 0 &&
    Math.abs(wx - site.x) <= 1 && Math.abs(wz - site.z) <= 1

  let dropped = 0, touched = 0
  const seen = new Set<string>()
  for (const p of parts) for (const [cx, cz] of [[p.x0, p.z0], [p.x1, p.z0], [p.x0, p.z1], [p.x1, p.z1]]) {
    const ox2 = Math.floor(cx / SECTION) * SECTION, oz2 = Math.floor(cz / SECTION) * SECTION
    if (seen.has(`${ox2},${oz2}`)) continue
    seen.add(`${ox2},${oz2}`)
    touched++
    const viaPipeline = makeColumn(ox2, oz2, SEED)
    const before: number[] = []
    for (let y = site.floor - 1; y <= site.floor + 5; y++)
      for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) before.push(viaPipeline.get(x, y, z))
    buildRuin(viaPipeline.sections, ox2, 0, oz2, SECTION, site, SEED)
    let i = 0
    for (let y = site.floor - 1; y <= site.floor + 5; y++)
      for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
        const changed = viaPipeline.get(x, y, z) !== before[i++]
        if (changed && !inStairwell(ox2 + x, oz2 + z)) dropped++
      }
  }
  ok(touched > 1, `the ruin is checked across ${touched} columns of the real pipeline`)
  ok(dropped === 0, `the pipeline writes the WHOLE ruin, not just the middle (${dropped} cells it missed)`)
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 12)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ something was BUILT here — ${pass} passed`)
