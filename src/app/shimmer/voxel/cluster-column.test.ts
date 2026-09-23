// Run: npx tsx src/app/shimmer/voxel/cluster-column.test.ts
//
// The adapter: the plan turned into blocks. Three things here are worth more than the rest.
//
// ★ THE SAVE BASELINE. `recordEdit` diffs a cell against `clusterGeneratedVoxel`; if that disagrees
// with what `generateClusterColumn` actually wrote, **the whole cluster is written into the save as
// player edits on first load** and the terrain FREEZES — every future change to the shape masked by
// a save asserting the old shape was deliberate. The plot paid for this once already
// (`plot-column.test.ts`), and a cluster has a second way to get it wrong that a plot does not:
// `plotGeneratedVoxel` is *nearly* right here, correct inside a quarter and wrong for every column
// of the Green, the lanes and the wall.
//
// ★ WALKABILITY, WHICH IS THE WHOLE POINT OF THE Y MODEL. The plan's flood fill proved the ground
// is CONNECTED; it cannot see a five-block cliff at the seam, and a cliff is what a flat middle at
// a different height would have produced at all eight junctions. So the transects below walk from
// each fold's centre to the middle a block at a time and require ground under every step and no
// step taller than one block.
//
// ★ AND NOTHING DIGGABLE MAY SIT OVER THE VOID. `plotMaterialAt`'s docstring records 31 rim columns
// that had ordinary dirt with nothing under it — the floor material's infinite hardness is the only
// thing stopping a keeper mining out of the bottom of the world, and it protects nothing if the
// soil rule outranks it. The made ground repeats that rule and therefore must repeat the guard.

import { Column, SECTION, Stage } from './column'
import {
  DEFAULT_CLUSTER, NO_SLOTS, QUARTERS, clusterAt, isGround, quarterCentre, quarterLocal,
  type ClusterConfig, type QuarterId,
} from './cluster'
import {
  DEFAULT_DIP, clusterGeneratedVoxel, clusterHeight, clusterMaterialAt, clusterQuarterPlot,
  clusterYRange, generateClusterColumn, middleHeight,
} from './cluster-column'
import { plotHeight, plotMaterialAt } from './plot'

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++ } else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const SEED: Record<QuarterId, number> = { ne: 1, nw: 7, sw: 42, se: 555 }
const allAt = (t: Partial<Record<QuarterId, number>>): ClusterConfig => ({
  ...DEFAULT_CLUSTER,
  slots: { ...NO_SLOTS, ...Object.fromEntries(QUARTERS.filter(q => t[q] !== undefined)
    .map(q => [q, { seed: SEED[q], tier: t[q]! }])) },
})
const FOUR = allAt({ ne: 2, nw: 1, sw: 0, se: 2 })
const B = DEFAULT_CLUSTER.base.baseY

console.log('★ the save baseline — the one that freezes the terrain if it is wrong')
{
  // Build real columns through the real generator and ask the baseline about every cell it wrote.
  // Sampled over a quarter, the Green, a lane and the wall, because the two functions can only
  // disagree where the ground came from somewhere `plot.ts` has never heard of.
  const spots: [number, number, string][] = [
    [DEFAULT_CLUSTER.offset, DEFAULT_CLUSTER.offset, 'deep in a fold'],
    [0, 0, 'the middle of the Green'],
    [DEFAULT_CLUSTER.green + 40, 40, 'the Green\'s lip'],
    [DEFAULT_CLUSTER.offset, 160, 'along a rim lane'],
    [260, 260, 'a spoke between fold and Green'],
    [DEFAULT_CLUSTER.offset + 500, DEFAULT_CLUSTER.offset, 'out at the coast'],
  ]
  let cells = 0, disagreed = 0
  for (const [wx, wz] of spots) {
    // ⚠ `new Column`, NOT `makeColumn` — and the difference cost this suite its first run.
    // `makeColumn` runs `generateColumn`, the CONTINENT generator, so the first cut of this test
    // built a Wilds column and then overlaid a cluster on it, and reported 75,568 disagreeing
    // cells against an adapter that was correct. The host's contract is the one `generatePlotColumn`
    // states — "sections start empty; skip the writes" — so the oracle has to start where the host
    // does. A test that seeds its subject with a different world measures the seed, not the subject.
    const col = new Column(Math.floor(wx / SECTION) * SECTION, Math.floor(wz / SECTION) * SECTION)
    generateClusterColumn(col, FOUR)
    check('the column is finished', col.stage === Stage.Ready)
    for (let lz = 0; lz < SECTION; lz++) for (let lx = 0; lx < SECTION; lx++) {
      for (let y = 0; y < col.sections.length * SECTION; y++) {
        const s = (y / SECTION) | 0
        const inCol = col.sections[s].get(lx, y - s * SECTION, lz)
        const baseline = clusterGeneratedVoxel(col, lx, y, lz, FOUR)
        cells++
        if (inCol !== baseline) disagreed++
      }
    }
  }
  check('every generated cell equals its own save baseline', disagreed === 0,
    `${disagreed} of ${cells}`)
  check('the sample actually looked at something', cells > 100000, `${cells} cells`)
  // ⚠ And the near-miss is a real near-miss: the plot's baseline is CORRECT inside a quarter, which
  // is exactly what would make it survive a lazy test and destroy every save.
  const plotWrong = (() => {
    const q: QuarterId = 'ne'
    const plot = clusterQuarterPlot(q, FOUR)!
    let wrong = 0
    for (let i = 0; i < 400; i++) {
      const x = Math.round((i % 20) * 22) - 100, z = Math.round(Math.floor(i / 20) * 22) - 100
      const l = quarterLocal(x, z, q, FOUR)
      if (plotMaterialAt(l.x, B, l.z, SEED[q], plot) !== clusterMaterialAt(x, B, z, FOUR)) wrong++
    }
    return wrong
  })()
  check('the plot\'s own baseline would have been wrong here', plotWrong > 0,
    'plotGeneratedVoxel agrees everywhere sampled — the near-miss is not being demonstrated')
}

console.log('★ you can WALK from your garden to the middle')
{
  // Transects at one-block steps: ground under every step, and no step taller than one block. The
  // plan's flood fill proved connection and is blind to a cliff; this is the half it cannot see.
  const tiers: Partial<Record<QuarterId, number>>[] = [
    { ne: 0, nw: 0, sw: 0, se: 0 }, { ne: 2, nw: 2, sw: 2, se: 2 }, { ne: 2, nw: 1, sw: 0, se: 2 },
  ]
  for (const t of tiers) {
    const cfg = allAt(t)
    let gaps = 0, cliffs = 0, steps = 0, worst = 0
    for (const q of QUARTERS) {
      const c = quarterCentre(q, cfg)
      const n = Math.round(Math.hypot(c.x, c.z))
      let prev: number | null = null
      for (let i = 0; i <= n; i++) {
        // Walk the diagonal in from the fold's centre to the middle — down the spoke.
        const x = c.x * (1 - i / n), z = c.z * (1 - i / n)
        const h = clusterHeight(x, z, cfg)
        if (h === null) { gaps++; prev = null; continue }
        if (prev !== null) {
          steps++
          const d = Math.abs(h - prev)
          worst = Math.max(worst, d)
          if (d > 1) cliffs++
        }
        prev = h
      }
    }
    const label = QUARTERS.map(q => t[q]).join('')
    check(`tiers ${label}: no hole on the way in`, gaps === 0, `${gaps} columns with no ground`)
    check(`tiers ${label}: no step taller than a block`, cliffs === 0,
      `${cliffs} of ${steps}, worst ${worst}`)
  }
  // And the rim: fold to adjacent fold, along the line between their centres.
  const cfg = allAt({ ne: 0, nw: 0, sw: 0, se: 0 })
  let rimGaps = 0, rimCliffs = 0
  for (let z = -cfg.offset; z <= cfg.offset; z++) {
    const h = clusterHeight(cfg.offset, z, cfg), prev = clusterHeight(cfg.offset, z - 1, cfg)
    if (h === null) { rimGaps++; continue }
    if (prev !== null && Math.abs(h - prev) > 1) rimCliffs++
  }
  check('the rim lane is walkable end to end', rimGaps === 0 && rimCliffs === 0,
    `${rimGaps} holes, ${rimCliffs} cliffs`)
}

console.log('the bowl — the middle is lower than the folds, and that is Alex\'s word made literal')
{
  const cfg = allAt({ ne: 2, nw: 2, sw: 2, se: 2 })
  const mid = middleHeight(0, 0, cfg)
  check('the middle settles below the folds\' plane', mid === B - DEFAULT_DIP.depth,
    `${mid} vs ${B - DEFAULT_DIP.depth}`)
  check('and it never rises above it', middleHeight(0, 0, cfg) <= B && middleHeight(200, 30, cfg) <= B)
  // It is a bowl, not a pit: the lip is level with the ground it meets.
  const small = allAt({ ne: 0, nw: 0, sw: 0, se: 0 })
  let rising = 0
  for (let d = 0; d < DEFAULT_DIP.ramp; d++) {
    // Straight out along a rim from the fold's coast — the gap grows, so the ground must fall.
    const a = middleHeight(small.offset, d, small), b = middleHeight(small.offset, d + 1, small)
    if (b > a) rising++
  }
  check('the ground only ever falls away from a fold', rising === 0, `${rising} of ${DEFAULT_DIP.ramp}`)
  // ⚠ The alternative design — flat middle, folds on top — is the bug this shape exists to avoid.
  // If the dip were applied as a step it would show up here as a multi-block jump at the coast.
  // ⚠ MEASURED AT A REAL COAST, NOT AT A GUESSED ONE. The first cut sampled (offset, 1) and called
  // it "the coast" — but a tier-0 fold's coast is nowhere near the rim's midpoint, so it read the
  // bottom of the bowl (91) against baseY (96) and reported a five-block step that does not exist.
  // The coast is where `foldGap` is zero, so ask for that rather than assuming where it is.
  const q0 = quarterCentre('ne', small)
  let atCoast = B, found = false
  for (let r = 100; r < 500 && !found; r += 0.5) {
    const x = q0.x - r / Math.SQRT2, z = q0.z - r / Math.SQRT2
    if (clusterAt(x, z, small).part !== 'quarter') {
      atCoast = middleHeight(x, z, small); found = true
    }
  }
  check('the coast was actually found', found)
  check('there is no step at the coast', Math.abs(atCoast - B) <= 1, `${atCoast} vs ${B}`)
}

console.log('a quarter is still the keeper\'s own island, in blocks this time')
{
  // The plan asserted this in 2D. The adapter can still lose it by delegating wrong.
  const cfg = allAt({ ne: 2, nw: 1, sw: 0, se: 2 })
  for (const q of QUARTERS) {
    const plot = clusterQuarterPlot(q, cfg)!
    const c = quarterCentre(q, cfg)
    let differ = 0, checked = 0
    for (let i = 0; i < 900; i++) {
      const a = (i / 900) * Math.PI * 2, r = (i % 37) / 37 * plot.capRadius * 0.92
      const lx = Math.round(Math.cos(a) * r), lz = Math.round(Math.sin(a) * r)
      const solo = plotHeight(lx, lz, SEED[q], plot)
      if (solo === null) continue
      // ⚠ EXCEPT THE GREEN, which at max tier genuinely overlaps the fold's corner. That ground is
      // RESERVED, not lost — canon's "each fold grows toward it, never through it" — so a column
      // the middle owns is the one lawful place a quarter's surface may differ from a solo plot's.
      // The first cut of this assert did not carve it out and failed on two columns of exactly that.
      if (clusterAt(c.x + lx, c.z + lz, cfg).part !== 'quarter') continue
      checked++
      if (clusterHeight(c.x + lx, c.z + lz, cfg) !== solo) differ++
    }
    check(`${q}: the surface is the solo island's, block for block`, differ === 0 && checked > 300,
      `${differ} of ${checked}`)
  }
  // ⚠ The front door is OFF in a cluster and that is deliberate, not forgotten — see the header.
  check('a quarter\'s cave is cleared', QUARTERS.every(q => clusterQuarterPlot(q, cfg)?.cave === undefined))
}

console.log('nothing diggable sits over the void')
{
  const cfg = allAt({ ne: 2, nw: 1, sw: 0, se: 2 })
  const m = cfg.base.materials
  let floating = 0, checked = 0
  for (let i = 0; i < 6000; i++) {
    const a = (i / 6000) * Math.PI * 2, r = (i % 211) / 211 * 900
    const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r)
    if (!isGround(x, z, cfg)) continue
    const top = clusterHeight(x, z, cfg)
    if (top === null) continue
    checked++
    // Walk down to the first air. The last solid block above it must be the unbreakable floor.
    let y = top
    while (y > 0 && clusterMaterialAt(x, y, z, cfg) !== 0) y--
    if (clusterMaterialAt(x, y + 1, z, cfg) !== m.floor) floating++
  }
  check('every ground column bottoms out in the keel', floating === 0, `${floating} of ${checked}`)
  check('the sample found ground', checked > 2000, `${checked} columns`)
}

console.log('the y range covers what is generated')
{
  // ⚠ A SHORT RANGE DOES NOT FAIL LOUDLY — it silently omits ground, and the omission is at the
  // bottom of the world where nobody looks. It must also widen with the deepest slot, because a
  // maxed fold hangs lower than a young one and the base config knows about neither.
  const cfg = allAt({ ne: 2, nw: 1, sw: 0, se: 2 })
  const { min, max } = clusterYRange(cfg)
  let outside = 0, checked = 0
  for (let i = 0; i < 4000; i++) {
    const a = (i / 4000) * Math.PI * 2, r = (i % 173) / 173 * 1000
    const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r)
    for (const y of [min - 1, min - 4, max + 1, max + 6]) {
      checked++
      if (clusterMaterialAt(x, y, z, cfg) !== 0) outside++
    }
  }
  check('nothing is generated outside the declared range', outside === 0, `${outside} of ${checked}`)
  // ⚠ AND A TIER MAKES A FOLD WIDER, NEVER DEEPER — asserted because the module's own docstring
  // claimed the opposite and this suite caught it. `plotForTier` changes `capRadius` alone, and
  // `keelDepth` measures from the coast, so a tier-0 and a tier-2 fold bottom out on the same block.
  const shallow = clusterYRange(allAt({ ne: 0, nw: 0, sw: 0, se: 0 }))
  const deep = clusterYRange(allAt({ ne: 2, nw: 2, sw: 2, se: 2 }))
  check('growing a fold does not deepen it', deep.min === shallow.min, `${deep.min} vs ${shallow.min}`)
  check('an empty frame still names a band', clusterYRange({ ...DEFAULT_CLUSTER, slots: NO_SLOTS }).max > 0)
}

console.log('the wall stands on the outline, not on each fold')
{
  const cfg = allAt({ ne: 2, nw: 1, sw: 0, se: 2 })
  const m = cfg.base.materials
  // ⚠ WALKED OUT FROM EACH FOLD'S COAST, NOT SAMPLED AT RANDOM. The ring is `wallWidth` 2 blocks
  // thick; random radial darts over a 1,100-block disc found 18 columns of it, which is not a
  // sample, it is a coincidence. Same blindness the plan suite hit twice.
  let band = 0, aboveWall = 0
  for (const q of QUARTERS) {
    const c = quarterCentre(q, cfg)
    for (let i = 0; i < 360; i++) {
      const a = (i / 360) * Math.PI * 2
      for (let r = 240; r < 520; r += 0.5) {
        const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r
        if (clusterAt(x, z, cfg).part !== 'wall') continue
        band++
        if (clusterMaterialAt(x, B + cfg.base.wallHeight + 1, z, cfg) !== 0) aboveWall++
        if (clusterMaterialAt(x, B, z, cfg) !== m.wall) aboveWall++
        break
      }
    }
  }
  check('the sample found wall', band > 800, `${band} columns`)
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass}/${pass + fail} passed${fail ? `, ${fail} failed` : ''}`)
process.exit(fail === 0 ? 0 : 1)
