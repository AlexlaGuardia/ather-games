// Run: npx tsx src/app/shimmer/voxel/plot-column.test.ts
//
// ★ THE POINT OF THIS FILE IS THE SAVE BASELINE. `recordEdit` stores a cell only where the new
// material differs from the GENERATED one, so "what did the generator put here" is the single most
// load-bearing question in the persistence path — and getting it wrong is silent in both directions.
// This codebase has already paid for that once: chopped trees regrew because the diff baseline
// disagreed with what was actually generated.

import { Column, SECTION, Stage, generatedVoxel } from './column'
import { generatePlotColumn, plotGeneratedVoxel, plotSectionRange } from './plot-column'
import { DEFAULT_PLOT, plotMaterialAt, plotYRange, plotThreshold } from './plot'
import { AIR } from './section'

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++ } else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const SEED = 1
/** A column over the middle of the island, and one out in the void. */
const MID = { wx: 0, wz: 0 }
const VOID = { wx: DEFAULT_PLOT.capRadius + 64, wz: DEFAULT_PLOT.capRadius + 64 }

// ── the column matches the geometry it came from ──────────────────────────────
console.log('the column')
{
  const col = generatePlotColumn(new Column(MID.wx, MID.wz), SEED)
  check('the column is Ready', col.stage === Stage.Ready)

  let wrong = 0, solid = 0
  for (let y = 0; y < col.sections.length * SECTION; y++)
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      const want = plotMaterialAt(col.wx + x, y, col.wz + z, SEED)
      if (col.get(x, y, z) !== want) wrong++
      if (want !== AIR) solid++
    }
  check('every voxel matches plotMaterialAt', wrong === 0, `${wrong} cells`)
  check('and it actually built something', solid > 1000, `${solid} solid voxels`)

  // The threshold must be standable in the BUILT column, not just in the geometry — this is the
  // spot canon's soft return drops a keeper onto, so it is worth asking the real voxels.
  const t = plotThreshold(SEED)
  const lx = t.x - col.wx, lz = t.z - col.wz
  if (lx >= 0 && lx < SECTION && lz >= 0 && lz < SECTION) {
    check('the threshold has floor and headroom in the built column',
      col.get(lx, t.y - 1, lz) !== AIR && col.get(lx, t.y, lz) === AIR && col.get(lx, t.y + 1, lz) === AIR)
  } else { check('threshold column skipped (outside this chunk)', true); }
}

// ── ★ THE SAVE BASELINE ───────────────────────────────────────────────────────
console.log('\nthe save baseline')
{
  const col = generatePlotColumn(new Column(MID.wx, MID.wz), SEED)

  // ★ THE INVARIANT: what the generator BUILT and what `recordEdit` will DIFF AGAINST must be the
  // same value at every cell. Any disagreement writes phantom edits (or swallows real ones).
  let disagree = 0
  for (let y = 0; y < col.sections.length * SECTION; y++)
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++)
      if (plotGeneratedVoxel(col, x, y, z, SEED) !== col.get(x, y, z)) disagree++
  check('the plot baseline agrees with the built column at every cell', disagree === 0, `${disagree} cells`)

  // ★★ AND THE TRAP, ASSERTED RATHER THAN ONLY COMMENTED. `column.ts`'s `generatedVoxel` answers
  // with the CONTINENT's depth rule, which knows nothing about a bounded island. If a host wires
  // the plot to it, the baseline disagrees with the world almost everywhere and the entire island
  // lands in the save as player edits on first load — bloating it, and freezing the plot's shape
  // behind a save that claims the old shape was deliberate.
  //
  // This assert exists to make that concrete: it counts the damage rather than describing it. If it
  // ever drops to zero, the two generators have converged and this whole file needs rethinking.
  let wouldBeEdits = 0
  const { min, max } = plotYRange()
  for (let y = min; y <= max; y++)
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++)
      if (generatedVoxel(col, x, y, z, SEED) !== col.get(x, y, z)) wouldBeEdits++
  check('⚠ the CONTINENT baseline is wrong here, loudly', wouldBeEdits > 500,
    `only ${wouldBeEdits} cells differ — if this is small, the trap is not what this file claims`)
}

// ── the void columns cost nothing ─────────────────────────────────────────────
console.log('\nthe void')
{
  const col = generatePlotColumn(new Column(VOID.wx, VOID.wz), SEED)
  let solid = 0
  for (let y = 0; y < col.sections.length * SECTION; y++)
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++)
      if (col.get(x, y, z) !== AIR) solid++
  check('a column outside the plot is empty', solid === 0, `${solid} voxels`)
  check('and every section reads uniform-air', col.uniform.every(u => u === AIR),
    'a non-uniform empty section still costs the mesher a sweep')
}

// ── the slab, and what it saves ───────────────────────────────────────────────
console.log('\nthe slab')
{
  const { first, last } = plotSectionRange()
  const col = generatePlotColumn(new Column(MID.wx, MID.wz), SEED)

  // Nothing outside the declared section band may hold anything — that is what makes it safe for a
  // host to skip those sections entirely.
  let strays = 0
  for (let s = 0; s < col.sections.length; s++) {
    if (s >= first && s <= last) continue
    if (col.uniform[s] !== AIR) strays++
  }
  check('nothing is built outside the declared section band', strays === 0, `${strays} sections`)
  check('the band is genuinely thin', last - first + 1 <= 4,
    `${last - first + 1} of ${col.sections.length} sections — the saving is the whole point`)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
