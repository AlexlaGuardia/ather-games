// Run: npx tsx src/app/shimmer/voxel/plot.test.ts
//
// ★ THE POINT OF THIS FILE IS THE BOUNDARY. A bounded island is the one shape whose bugs all live
// at its edge, and every one of them reads as something else in play: ground outside the buildable
// cap reads as "placement is broken", a gap between ground and wall reads as "the world failed to
// load", a keel that reaches zero reads as "I fell through my own garden."
//
// The continuous generator could never have these bugs — it has no edge to get wrong. So none of
// the existing worldgen oracles cover any of this, and the asserts below are written against the
// CANON CLAIMS the shape is supposed to embody, not against the numbers that happen to produce it.

import {
  DEFAULT_PLOT, plotHeight, plotMaterialAt, keelDepth, edgeAt,
  insideCore, withinCap, inWall, distFromCentre, plotYRange, columnSpan, type PlotConfig,
} from './plot'
import { AIR } from './section'

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++ } else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const SEED = 1
const M = DEFAULT_PLOT.materials
const R = DEFAULT_PLOT.capRadius + DEFAULT_PLOT.wallWidth + 6   // sweep past the wall, into the void

/** Every column in a square that comfortably contains the whole plot. */
function* columns(): Generator<[number, number]> {
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) yield [x, z]
}

// ── the config is coherent before anything is generated ───────────────────────
console.log('the fold')
{
  // ★ THE CAP MUST NEVER BE SMALLER THAN THE GROUND. If it were, the generator would hand the
  // keeper ground they are forbidden to build on and cannot remove — the plot would open with a
  // rule it is already breaking. Asserted on the config rather than discovered in play.
  check('cap is never inside the island', DEFAULT_PLOT.capRadius >= DEFAULT_PLOT.coreRadius,
    `cap ${DEFAULT_PLOT.capRadius} vs core ${DEFAULT_PLOT.coreRadius}`)
  check('there is room to build on day one', DEFAULT_PLOT.capRadius > DEFAULT_PLOT.coreRadius,
    'cap == core means expansion has nowhere to go and the wall reads as a cage')
}

// ── the edge is organic but BOUNDED ───────────────────────────────────────────
console.log('\nthe edge')
{
  let maxEdge = 0, minEdge = Infinity, groundOutsideCap = 0
  for (const [x, z] of columns()) {
    const e = edgeAt(x, z, SEED)
    if (e > maxEdge) maxEdge = e
    if (e < minEdge) minEdge = e
    if (insideCore(x, z, SEED) && !withinCap(x, z)) groundOutsideCap++
  }

  // ★ THE WOBBLE CUTS IN, NEVER OUT. This is the assert the module's own comment promises; without
  // it "organic edge" and "exact bound" are two claims nothing reconciles.
  check('the edge never exceeds coreRadius', maxEdge <= DEFAULT_PLOT.coreRadius + 1e-9,
    `max edge ${maxEdge.toFixed(2)} vs core ${DEFAULT_PLOT.coreRadius}`)
  check('the edge actually wanders', minEdge < DEFAULT_PLOT.coreRadius - 0.5,
    `min ${minEdge.toFixed(2)} — a perfect circle means the wobble is dead`)

  // The consequence that matters in play, stated directly rather than inferred from the two above.
  check('no generated ground sits outside the buildable cap', groundOutsideCap === 0,
    `${groundOutsideCap} columns`)
}

// ── the island is solid, and it is an ISLAND ──────────────────────────────────
console.log('\nthe island')
{
  let ground = 0, gaps = 0, thinnest = Infinity
  for (const [x, z] of columns()) {
    const s = columnSpan(x, z, SEED)
    if (!s) continue
    ground++
    const d = keelDepth(x, z, SEED)
    if (d < thinnest) thinnest = d
    // ★ NO COLUMN MAY BE HOLLOW. An air voxel BETWEEN the turf and the keel is a pocket a keeper
    // digs into and falls through, with nothing under it and no way back up.
    //
    // ⚠ THE FIRST VERSION OF THIS ASKED "is h-1 air", WHICH IS A DIFFERENT AND WRONG QUESTION —
    // it flagged 6 columns whose keel is legitimately ONE voxel thick at the lip, where there is
    // nothing underneath because the island has ended. That is a taper, not a hole. Contiguity is
    // the property that actually means "you cannot fall through your own garden", and it holds for
    // a 1-thick column for free.
    for (let y = s.bottom; y <= s.top; y++) if (plotMaterialAt(x, y, z, SEED) === AIR) gaps++
  }
  check('the island has ground', ground > 500, `${ground} columns`)
  check('no column has a hollow in it', gaps === 0, `${gaps} air voxels inside solid ground`)
  // ★ THE KEEL NEVER REACHES ZERO. `keelDepth` clamps at 1 on purpose: a lens that truly tapers to
  // nothing produces rim columns of pure topsoil floating with no underside, which is the exact
  // silhouette that makes an island look unfinished from below — and the plot is a thing you FLY
  // past on the way in.
  check('every column has a keel', thinnest >= 1, `thinnest ${thinnest}`)

  // A lens, not a cylinder: the middle is materially deeper than the lip.
  const mid = keelDepth(0, 0, SEED)
  const lip = keelDepth(Math.round(DEFAULT_PLOT.coreRadius * 0.95), 0, SEED)
  check('the belly is a lens', mid > lip * 2, `centre ${mid} vs lip ${lip}`)
}

// ── the stack a keeper actually digs through ──────────────────────────────────
console.log('\nthe stack')
{
  const h = plotHeight(0, 0, SEED)!
  check('you stand on turf', plotMaterialAt(0, h, 0, SEED) === M.topsoil)
  check('turf is one block deep', plotMaterialAt(0, h - 1, 0, SEED) === M.subsoil)
  check('rock under the soil', plotMaterialAt(0, h - 4, 0, SEED) === M.stone)
  check('open air above', plotMaterialAt(0, h + 1, 0, SEED) === AIR)

  // ★ THE BOTTOM OF THE ISLAND IS CLOUD, AND THAT IS WHAT MAKES IT UNMINEABLE. The registry gives
  // the floor material hardness Infinity; if the keel's underside were soil or rock instead, a
  // keeper could dig straight out of the bottom of their own plot into the void. The geometry is
  // the guard, so it is swept rather than spot-checked.
  const span = columnSpan(0, 0, SEED)!
  check('the keel ends in cloud', plotMaterialAt(0, span.bottom, 0, SEED) === M.floor)
  check('below the keel is void', plotMaterialAt(0, span.bottom - 1, 0, SEED) === AIR)

  // ⚠ THIS IS THE ASSERT THAT CAUGHT THE REAL BUG. Written the intuitive way (turf, subsoil, then
  // the rest) the soil layers ate the whole keel on 31 thin rim columns — a ring of ordinary
  // diggable dirt with the void directly under it, at exactly the place a keeper stands to look
  // over the edge.
  let softBottoms = 0
  for (const [x, z] of columns()) {
    const s = columnSpan(x, z, SEED)
    if (!s) continue
    if (plotMaterialAt(x, s.bottom, z, SEED) !== M.floor) softBottoms++
  }
  check('no column bottoms out in anything but cloud', softBottoms === 0, `${softBottoms} columns`)

  // And the span is honest in both directions — one voxel of slack here is a floating island with a
  // one-block gap under its turf, or a keel that overhangs into the void.
  let spanWrong = 0
  for (const [x, z] of columns()) {
    const s = columnSpan(x, z, SEED)
    if (!s) continue
    if (plotMaterialAt(x, s.bottom - 1, z, SEED) !== AIR) spanWrong++
    if (plotMaterialAt(x, s.top, z, SEED) === AIR) spanWrong++
    if (plotMaterialAt(x, s.top + 1, z, SEED) !== AIR) spanWrong++
  }
  check('the declared span matches the solid voxels', spanWrong === 0, `${spanWrong} mismatches`)
}

// ── the wall, and the void it stands in ───────────────────────────────────────
console.log('\nthe wall and the void')
{
  let wallCols = 0, wallOverGround = 0
  for (const [x, z] of columns()) {
    if (!inWall(x, z)) continue
    wallCols++
    if (plotHeight(x, z, SEED) !== null) wallOverGround++
  }
  check('the wall rings the plot', wallCols > 100, `${wallCols} columns`)
  // ★ THE RING MAY NEVER EAT THE GARDEN IT RINGS. The wall sits outside the cap and the ground
  // inside the core, so this can only fail if someone lets the cap fall under the island's edge.
  check('the wall never stands on ground', wallOverGround === 0, `${wallOverGround} columns`)

  // The wall is tall enough to be a boundary rather than a kerb the keeper walks over.
  const wx = DEFAULT_PLOT.capRadius + 1
  check('the wall stands above the ground plane',
    plotMaterialAt(wx, DEFAULT_PLOT.baseY + DEFAULT_PLOT.wallHeight, 0, SEED) === M.wall)
  check('the wall skirts below it',
    plotMaterialAt(wx, DEFAULT_PLOT.baseY - DEFAULT_PLOT.wallSkirt, 0, SEED) === M.wall)
  check('the wall has a top', plotMaterialAt(wx, DEFAULT_PLOT.baseY + DEFAULT_PLOT.wallHeight + 1, 0, SEED) === AIR)

  // ★★ THE WALL MUST BE WATERTIGHT, AND EYEBALLING A CIRCLE CANNOT TELL YOU THAT. A ring defined by
  // a radial band (`cap < d <= cap + width`) is rasterised onto a grid, and a one-column hole at
  // some bearing is invisible in every rendering of it — it is one missing character in a picture
  // of a circle. It is also the single worst bug this module could ship: once a keeper expands to
  // the cap, a hole is a walk-out into a void with no floor and no way back.
  //
  // So it is asked as a REACHABILITY question rather than a geometric one: flood-fill the buildable
  // region and see whether anything leaks past the wall. That is the question a walking player asks.
  {
    const seen = new Set<string>()
    const stack: [number, number][] = [[0, 0]]
    let escaped = 0
    while (stack.length) {
      const [x, z] = stack.pop()!
      const k = `${x},${z}`
      if (seen.has(k)) continue
      seen.add(k)
      if (inWall(x, z)) continue                       // the wall stops the flood; that is its job
      if (distFromCentre(x, z) > DEFAULT_PLOT.capRadius + DEFAULT_PLOT.wallWidth) { escaped++; continue }
      if (Math.abs(x) > R || Math.abs(z) > R) continue
      // ⚠ 8-CONNECTED, NOT 4. A player is a moving box, not a rook: a wall that is watertight
      // against orthogonal steps can still have a DIAGONAL squeeze between two corner-touching
      // cells, and that is a real walk-out. The stricter flood is the one that matches the physics,
      // so it is the one asked. (It passes at wallWidth 2; if a future width of 1 is wanted, this
      // is the assert that will refuse it, and it should.)
      stack.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1],
                 [x + 1, z + 1], [x + 1, z - 1], [x - 1, z + 1], [x - 1, z - 1])
    }
    check('the wall has no gaps to walk or squeeze through', escaped === 0,
      `${escaped} columns outside the wall reachable from the centre`)
  }

  // ★ THE VOID IS EMPTY AND STAYS EMPTY. Canon: "not unbuilt space, not to be dressed with scenery
  // so it looks finished. Cloud-wall, then dark, then stars." A future pass that puts ANYTHING out
  // here — a decorative cloud floor, a skybox proxy, a safety net — fails this, which is the point.
  let voidCells = 0, dressed = 0
  for (const [x, z] of columns()) {
    if (insideCore(x, z, SEED) || inWall(x, z)) continue
    for (let y = 0; y < 160; y++) {
      voidCells++
      if (plotMaterialAt(x, y, z, SEED) !== AIR) dressed++
    }
  }
  check('the void is looked at', voidCells > 10000, `${voidCells} cells`)
  check('the void is empty', dressed === 0, `${dressed} cells have something in them`)
}

// ── the plot pays NOTHING, which is the whole wilds loop ──────────────────────
console.log('\nhome is where you grow things')
{
  // ★ `engine/spawn-board.ts` (Alex reversed the first cut to get here): "a home plot that refills
  // itself is a farm you never have to leave… HOME is where you grow things, WILD is where you
  // gather them." The generator can only honour that by containing nothing worth mining, so the
  // material set it emits is asserted CLOSED. Adding ore here would be a design reversal, and it
  // should have to argue with a failing test rather than slip in as a generator tweak.
  const allowed = new Set<number>([AIR, M.topsoil, M.subsoil, M.stone, M.floor, M.wall])
  const emitted = new Set<number>()
  const { min, max } = plotYRange()
  for (const [x, z] of columns())
    for (let y = min; y <= max; y++) emitted.add(plotMaterialAt(x, y, z, SEED))

  const strays = [...emitted].filter(m => !allowed.has(m))
  check('the plot generates nothing but ground, cloud and air', strays.length === 0, `${strays}`)
  check('and it does generate all of them', allowed.size === emitted.size,
    `emitted ${[...emitted]} — a material that never appears is a config that lies`)
}

// ── the declared y range is honest ────────────────────────────────────────────
console.log('\nthe slab')
{
  // A caller meshes only `plotYRange`. If the generator writes outside it, the island silently
  // loses its keel or its wall top and the bug looks like a chunk-loading fault.
  const { min, max } = plotYRange()
  let outside = 0
  for (const [x, z] of columns()) {
    for (let y = 0; y < min; y++) if (plotMaterialAt(x, y, z, SEED) !== AIR) outside++
    for (let y = max + 1; y < 200; y++) if (plotMaterialAt(x, y, z, SEED) !== AIR) outside++
  }
  check('nothing is generated outside the declared range', outside === 0, `${outside} cells`)
}

// ── expansion does not rewrite the island ─────────────────────────────────────
console.log('\ngrowth')
{
  // ★ RAISING THE CAP MUST NOT MOVE ONE VOXEL OF GROUND. Expansion is the keeper placing blocks;
  // if the generator's output shifted when the cap rose, every block already placed would be
  // sitting against different terrain — and the save is a DIFF against generated material, so the
  // damage is silent and permanent. This is the assert that lets the cap be a live number.
  const grown: PlotConfig = { ...DEFAULT_PLOT, capRadius: DEFAULT_PLOT.capRadius + 18 }
  let moved = 0
  const { min, max } = plotYRange()
  for (const [x, z] of columns()) {
    if (!insideCore(x, z, SEED)) continue
    for (let y = min; y <= max; y++)
      if (plotMaterialAt(x, y, z, SEED) !== plotMaterialAt(x, y, z, SEED, grown)) moved++
  }
  check('raising the cap leaves the island untouched', moved === 0, `${moved} voxels changed`)
  check('raising the cap opens new buildable ground',
    withinCap(DEFAULT_PLOT.capRadius + 10, 0, grown) && !withinCap(DEFAULT_PLOT.capRadius + 10, 0))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
