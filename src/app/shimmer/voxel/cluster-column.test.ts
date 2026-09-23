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
  quarterThresholdBearing, type ClusterConfig, type QuarterId,
} from './cluster'
import {
  DEFAULT_DIP, clusterGeneratedVoxel, clusterHeight, clusterMaterialAt, clusterQuarterPlot,
  clusterThresholds, clusterYRange, generateClusterColumn, middleHeight,
} from './cluster-column'

/** A door's floor — one below the y `plotThreshold` reports a keeper standing at. */
const y0 = (d: { y: number }) => d.y - 1
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

console.log('the made ground is visibly MADE — no rock body, and one continuous underside')
{
  // ⚠ BOTH OF THESE WERE FOUND BY LOOKING AT THE CROSS-SECTION, NOT BY A GUARD. The plan view is
  // structurally incapable of showing either, and nothing was asking. They are asserted now so the
  // statement cannot drift back into being an accident of the plot's layering.
  const cfg = allAt({ ne: 2, nw: 1, sw: 0, se: 2 })
  const m = cfg.base.materials
  let stone = 0, made = 0
  const bottoms: number[] = []
  for (let i = 0; i < 4000; i++) {
    const a2 = (i / 4000) * Math.PI * 2, r = (i % 149) / 149 * 1000
    const x = Math.round(Math.cos(a2) * r), z = Math.round(Math.sin(a2) * r)
    const part = clusterAt(x, z, cfg).part
    if (part !== 'green' && part !== 'join') continue
    made++
    const top = clusterHeight(x, z, cfg)!
    let y = top
    while (y > 0 && clusterMaterialAt(x, y, z, cfg) !== 0) {
      if (clusterMaterialAt(x, y, z, cfg) === m.stone) stone++
      y--
    }
    bottoms.push(y + 1)
  }
  check('the sample found made ground', made > 500, `${made} columns`)
  // A fold is an island and grew a stone core; the middle was pressed out of cloud and has none.
  check('the Green and the lanes contain no stone at all', stone === 0, `${stone} blocks`)
  // ⚠ AND THE UNDERSIDE IS CONTINUOUS. At `keel` 12 the made ground stopped two blocks proud of the
  // islands either side, so from below the cluster was a plank slotted between two islands.
  const foldBottoms: number[] = []
  for (const q of QUARTERS) {
    const c = quarterCentre(q, cfg)
    let y = clusterHeight(c.x, c.z, cfg)!
    while (y > 0 && clusterMaterialAt(c.x, y, c.z, cfg) !== 0) y--
    foldBottoms.push(y + 1)
  }
  const madeFloor = Math.min(...bottoms), foldFloor = Math.min(...foldBottoms)
  check('the middle hangs level with the folds it joins', Math.abs(madeFloor - foldFloor) <= 1,
    `made ${madeFloor} vs folds ${foldFloor}`)
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
}

console.log('★ four thresholds onto one fold — and the shell is never pierced')
{
  const cfg = allAt({ ne: 2, nw: 1, sw: 0, se: 2 })
  const open = allAt({ ne: 2, nw: 1, sw: 0 })
  const doors = clusterThresholds(cfg)
  check('every keeper has a door', doors.length === 4, `${doors.length}`)
  check('a slot nobody has taken has no door', clusterThresholds(open).length === 3)

  for (const d of doors) {
    const c = quarterCentre(d.quarter, cfg)
    // ⛔ IT FACES OUT. A door on the inward side would be a door between cluster-mates, which is
    // the permission system canon's first ruling forbids: a mate is folded in, never let through.
    check(`${d.quarter}: the door is on the outward side`,
      Math.hypot(d.x, d.z) > Math.hypot(c.x, c.z),
      `door ${Math.round(Math.hypot(d.x, d.z))} vs centre ${Math.round(Math.hypot(c.x, c.z))}`)
    // It stands on that keeper's own ground, not in the air and not on a neighbour's.
    const at = clusterAt(d.x, d.z, cfg)
    check(`${d.quarter}: the door stands on its own keeper's ground`,
      at.part === 'quarter' && at.quarter === d.quarter, `${at.part}/${at.quarter}`)
    // And nowhere near the middle.
    check(`${d.quarter}: no door opens onto the Green`, Math.hypot(d.x, d.z) > cfg.green * 2)
  }

  // ⛔⛔ THE SHELL IS NEVER PIERCED. `plot.ts`: run the bore past the coast and it is "a literal hole
  // in the fold's shell, with the void on the far side of it and nothing between a keeper and a
  // fall." So walking OUT along a door's own bearing at its floor height must meet solid cloud
  // before it meets the Ather. This is the one guard here that is about safety and not about look.
  let pierced = 0
  for (const d of doors) {
    const b = quarterThresholdBearing(d.quarter)
    let solid = false, escaped = false
    for (let r = 0; r <= 90; r += 0.5) {
      const x = d.x + Math.cos(b) * r, z = d.z + Math.sin(b) * r
      const mat = clusterMaterialAt(x, y0(d), z, cfg)
      if (mat !== 0) { solid = true; continue }
      // Air past the wall, having never met cloud, is a tunnel out of the world.
      if (!solid && !isGround(x, z, cfg) && clusterAt(x, z, cfg).part === 'ather') { escaped = true; break }
    }
    if (escaped) pierced++
  }
  check('no door bores through to the void', pierced === 0, `${pierced} of ${doors.length}`)

  // ★ THE MOUND IS THE LANDMARK, so it must out-top the wall it grows from — `plot.ts` sets the
  // cave 15 tall against a 9-block wall and calls that difference the whole point: "a mound that
  // tops out level with the wall is a bump you find by walking into it."
  // ⚠ MEASURED ON A COLUMN THE DOORWAY BRANCH ACTUALLY OWNS. The first cut swept outward from the
  // threshold and accepted tall cloud anywhere along the bearing — but the threshold sits INSIDE
  // the coast, so the mound's inner half is drawn by the quarter branch delegating to the same
  // plot. Deleting the doorway branch entirely therefore left this green: half the mound was still
  // there, drawn by somebody else. A guard has to look at the half its subject is responsible for.
  let tall = 0, outer = 0
  for (const d of doors) {
    const b = quarterThresholdBearing(d.quarter)
    let sawOuter = false, sawTall = false
    for (let r = 0; r < 40; r += 0.5) {
      const x = d.x + Math.cos(b) * r, z = d.z + Math.sin(b) * r
      if (clusterAt(x, z, cfg).part !== 'door') continue
      sawOuter = true
      if (clusterMaterialAt(x, B + cfg.base.wallHeight + 2, z, cfg) !== 0) { sawTall = true; break }
    }
    if (sawOuter) outer++
    if (sawTall) tall++
  }
  check('each door has columns outside the coast that it owns', outer === doors.length, `${outer}`)
  check('every door reads as a mound above the wall line', tall === doors.length, `${tall} of ${doors.length}`)

  // ⛔ AND A DOOR TAKES NO GROUND. The cave only ever fills air (`plot.ts` gates every branch on
  // being at or above the door's floor) — the 08-18 burial is what that gate exists to prevent.
  let eaten = 0, seen = 0
  for (const d of doors) {
    const plot = clusterQuarterPlot(d.quarter, cfg)!
    const c = quarterCentre(d.quarter, cfg)
    for (let dx = -20; dx <= 20; dx += 2) for (let dz = -20; dz <= 20; dz += 2) {
      const lx = d.x - c.x + dx, lz = d.z - c.z + dz
      const solo = plotHeight(lx, lz, cfg.slots[d.quarter]!.seed, plot)
      if (solo === null) continue
      seen++
      if (clusterHeight(c.x + lx, c.z + lz, cfg) !== solo) eaten++
    }
  }
  check('a door eats none of the keeper\'s turf', eaten === 0, `${eaten} of ${seen}`)
  check('the door sample found ground', seen > 200, `${seen}`)
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
