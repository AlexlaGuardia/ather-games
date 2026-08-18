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
  insideCore, withinCap, inWall, distFromCentre, plotYRange, columnSpan,
  plotThreshold, hasFallenOut, chestCap, plotStandY, type PlotConfig,
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
  // ── ★★ THE CAP AND THE GROUND ARE ONE EDGE NOW (2026-08-16) ──────────────────────────────────
  // These two asserts used to police `capRadius >= coreRadius` and demand a STRICT gap between them
  // — "cap == core means expansion has nowhere to go and the wall reads as a cage". That gap was a
  // ten-block ring of void the keeper could neither build on nor walk across, and it is exactly
  // what put the passage out of reach (Alex: *"island sits in the cloud bubble resting against the
  // cloud wall so it can reach the passage"*). **The invariant they protected cannot be violated
  // any more, because there is only one number.** Expansion is felt by the wall moving OUT, not by
  // a moat filling in. So the claim that replaces them is the one that is now load-bearing.
  // ★★ THE INVARIANT, SWEPT RATHER THAN SPOT-CHECKED: on no bearing is there a gap between the last
  // block of ground and the first block of wall. A single void column in that seam is a hole a
  // keeper falls through on the one ground canon says holds them — and it is what the old layout
  // had ten of, all the way round.
  let seamGaps = 0, bearings = 0
  for (let i = 0; i < 360; i++) {
    const b = (i / 360) * Math.PI * 2
    bearings++
    let lastGround = -1, firstWall = -1
    for (let r = 1; r <= DEFAULT_PLOT.capRadius + DEFAULT_PLOT.wallWidth + 3; r++) {
      const x = Math.round(Math.cos(b) * r), z = Math.round(Math.sin(b) * r)
      if (insideCore(x, z, SEED)) lastGround = r
      else if (inWall(x, z, SEED) && firstWall < 0) firstWall = r
    }
    if (lastGround < 0 || firstWall < 0 || firstWall - lastGround > 1) seamGaps++
  }
  check('the ground reaches its own wall on every bearing', seamGaps === 0,
    `${seamGaps} of ${bearings} bearings have void between the grass and the wall`)
}

// ── the edge is organic but BOUNDED ───────────────────────────────────────────
console.log('\nthe edge')
{
  let maxEdge = 0, minEdge = Infinity, groundOutsideCap = 0
  for (const [x, z] of columns()) {
    const e = edgeAt(x, z, SEED)
    if (e > maxEdge) maxEdge = e
    if (e < minEdge) minEdge = e
    if (insideCore(x, z, SEED) && !withinCap(x, z, SEED)) groundOutsideCap++
  }

  // ★ THE WOBBLE CUTS IN, NEVER OUT. This is the assert the module's own comment promises; without
  // it "organic edge" and "exact bound" are two claims nothing reconciles.
  check('the edge never exceeds capRadius', maxEdge <= DEFAULT_PLOT.capRadius + 1e-9,
    `max edge ${maxEdge.toFixed(2)} vs cap ${DEFAULT_PLOT.capRadius}`)
  check('the edge actually wanders', minEdge < DEFAULT_PLOT.capRadius - 0.5,
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
  const lip = keelDepth(Math.round(DEFAULT_PLOT.capRadius * 0.95), 0, SEED)
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
    if (!inWall(x, z, SEED)) continue
    wallCols++
    if (plotHeight(x, z, SEED) !== null) wallOverGround++
  }
  check('the wall rings the plot', wallCols > 100, `${wallCols} columns`)
  // ★ THE RING MAY NEVER EAT THE GARDEN IT RINGS. The wall sits outside the cap and the ground
  // inside the core, so this can only fail if someone lets the cap fall under the island's edge.
  check('the wall never stands on ground', wallOverGround === 0, `${wallOverGround} columns`)

  // The wall is tall enough to be a boundary rather than a kerb the keeper walks over.
  // ⚠ DERIVED, NOT `capRadius + 1` (2026-08-16). The wall used to sit at the bare cap radius, so a
  // literal landed in it. It stands on the COAST now and the coast wobbles in by up to 18%, so at
  // bearing 0 the wall is at 27-28 while `capRadius + 1` is 31 — out in the void, and all three
  // asserts below went red reporting AIR as though the wall had stopped generating. **Exactly the
  // `onShell` bug from this morning's bubble work, in a second file, the same day.** Ask the shape.
  const wx = Math.ceil(edgeAt(1, 0, SEED)) + 1
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
      if (inWall(x, z, SEED)) continue                       // the wall stops the flood; that is its job
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
    if (insideCore(x, z, SEED) || inWall(x, z, SEED)) continue
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
  // ── ★★ THE INTERIOR MUST NOT MOVE. THE OLD COAST IS ALLOWED TO, AND MUST (2026-08-16) ────────
  // This asserted that raising the cap moves NOT ONE VOXEL — correct while expansion granted only
  // permission and the island's size was fixed. Under the 08-16 layout the ground fills to the wall,
  // so growing the fold GROWS THE ISLAND: some generated change is the feature. The reason behind
  // the old assert survives intact though, and it is the sharpest sentence in this file — *the save
  // is a DIFF against generated material, so the damage is silent and permanent.* So the claim is
  // narrowed rather than dropped: **everything more than `keel` blocks inside the old coast is
  // bit-identical**, which is where a keeper has actually been building. The ring around the old
  // shoreline thickens into field, which is the growth being visible rather than terrain moving
  // under someone's house.
  // ⚠ Found by this assert going red at **87.7% of columns changed** — `keelDepth` tapered as a
  // FRACTION of the radius, so a bigger fold had a deeper belly everywhere. Fixed at the taper.
  const grown: PlotConfig = { ...DEFAULT_PLOT, capRadius: DEFAULT_PLOT.capRadius + 18 }
  let moved = 0
  const { min, max } = plotYRange()
  let interior = 0
  for (const [x, z] of columns()) {
    if (!insideCore(x, z, SEED)) continue
    // Deep inland of the OLD coast — the ground a keeper has had time to build on.
    if (edgeAt(x, z, SEED) - distFromCentre(x, z) <= DEFAULT_PLOT.keel) continue
    interior++
    for (let y = min; y <= max; y++)
      if (plotMaterialAt(x, y, z, SEED) !== plotMaterialAt(x, y, z, SEED, grown)) moved++
  }
  check('growing the fold leaves the island\'s interior bit-identical', moved === 0,
    `${moved} voxels changed across ${interior} interior columns`)

  // ── ★★ AND GROWTH IS ADDITIVE EVERYWHERE: NO CELL THAT WAS SOLID BECOMES AIR ──────────────────
  // The interior guarantee above is NOT enough on its own, and canon is the reason (`/magii`,
  // 2026-08-16, `shimmer-geography.md` › *the old shoreline becomes field*): expansion may reshape
  // the COAST, it may **never reach the interior a keeper built** — and a keeper may build right up
  // to their own shore, which is exactly where growth churns. The ruling gives the stake in plain
  // terms: *"a player who learns that expanding costs them their base stops expanding, and the whole
  // grimoire-ledger arc dies with it."*
  //
  // So the claim is widened to cover every column, in the one direction that matters. Ground may be
  // ADDED under and around a keeper's work; it may never be taken from beneath it.
  //
  // ⚠ CAUGHT TWO REAL LOSSES, BOTH INVISIBLE FROM THE INTERIOR ASSERT: the roll was centred on
  // `baseY` so a rising `fade` moved a column's surface in whichever direction its noise sat (**257
  // columns lost a block**), and the keel hung from `h`, so raising a surface lifted the whole keel
  // and emptied the cell underneath (**4 more**). Both fixed at the shape, not clamped after.
  let taken = 0, added = 0
  for (const [x, z] of columns()) {
    if (!insideCore(x, z, SEED)) continue
    for (let y = min; y <= max; y++) {
      const a = plotMaterialAt(x, y, z, SEED), b = plotMaterialAt(x, y, z, SEED, grown)
      if (a !== AIR && b === AIR) taken++
      if (a === AIR && b !== AIR) added++
    }
  }
  check('growing the fold never takes ground away', taken === 0,
    `${taken} voxels went solid -> AIR; a keeper who built there is standing on nothing now`)
  check('and it does add some', added > 1000, `${added} voxels of new ground`)
  check('raising the cap opens new buildable ground',
    withinCap(DEFAULT_PLOT.capRadius + 10, 0, SEED, grown) && !withinCap(DEFAULT_PLOT.capRadius + 10, 0, SEED))
}

// ── the threshold, and the soft return that depends on it ─────────────────────
console.log('\nthe threshold')
{
  const t = plotThreshold(SEED)

  // ★ IT MUST BE SOMEWHERE A KEEPER CAN STAND, because canon makes it the place the island CATCHES
  // them: "a keeper who goes over the edge is falling through their own fold, which returns them to
  // their threshold. No death, no fall damage." A threshold in rock or over the void turns the
  // gentlest rule in the game into a loop the keeper cannot escape.
  check('the threshold is on the island', insideCore(t.x, t.z, SEED))
  check('it is inside the buildable cap', withinCap(t.x, t.z, SEED))
  check('there is ground under it', plotMaterialAt(t.x, t.y - 1, t.z, SEED) === M.topsoil)
  check('it is standing room, not rock', plotMaterialAt(t.x, t.y, t.z, SEED) === AIR)
  check('and headroom above that', plotMaterialAt(t.x, t.y + 1, t.z, SEED) === AIR)

  // ── ★★ AT THE WALL, WHICH IS THE REVERSE OF WHAT THIS USED TO ASSERT (2026-08-16) ────────────
  // It demanded the threshold sit inside `0.85 * edge`, because *"the soft return must not deposit
  // the keeper one step from the drop it just caught them from."* That reasoning was sound while the
  // rim was a LIP over the void. It is not any more: the cloud-wall now stands ON the coast, so the
  // edge is a wall you bump into rather than a drop you walk off, and **the failure the inset was
  // defending against cannot occur on this geometry.** Meanwhile the inset was the bug Alex hit —
  // it put the door twelve blocks out with the wall twenty blocks further, so the passage could not
  // be reached at all.
  // ⚠ So the assert is INVERTED, not deleted: the door must now be AT the wall, and something that
  // quietly moved it back inland would silently restore the original bug.
  const e = edgeAt(t.x, t.z, SEED)
  const gap = e - distFromCentre(t.x, t.z)
  check('the threshold stands at its own wall', gap <= DEFAULT_PLOT.thresholdInset + 1.5,
    `${gap.toFixed(1)} blocks in from an edge at ${e.toFixed(1)} — the door has drifted inland again`)
  check('and still on solid ground, not in the wall', insideCore(t.x, t.z, SEED) && !inWall(t.x, t.z, SEED),
    'the arrival must be ground the keeper stands on, with the wall in front of them')

  // ── ★ IT MOVES WITH THE WALL NOW, AND THAT IS THE POINT ──────────────────────────────────────
  // This used to assert the threshold NEVER moves — *"every expansion would quietly relocate the
  // front door of a garden somebody has been decorating."* True of a door standing in a field.
  // The door is a gap in the WALL now, so when the fold grows the wall goes with it and the door
  // must follow or it would be left standing inland with nothing to be a gap in. What has to hold
  // is the RELATIONSHIP, not the coordinate: still at the wall, still on the same bearing.
  const grown: PlotConfig = { ...DEFAULT_PLOT, capRadius: DEFAULT_PLOT.capRadius + 24 }
  const t2 = plotThreshold(SEED, grown)
  const e2 = edgeAt(t2.x, t2.z, SEED, grown)
  check('the threshold follows its wall out',
    e2 - distFromCentre(t2.x, t2.z) <= DEFAULT_PLOT.thresholdInset + 1.5,
    `${(e2 - distFromCentre(t2.x, t2.z)).toFixed(1)} in from the grown edge — the door was left inland`)
  check('and stays on the same bearing',
    Math.abs(Math.atan2(t2.z, t2.x) - Math.atan2(t.z, t.x)) < 0.12,
    'a door that walks around the wall as you grow is a door you have to go looking for')

  // The soft-return trigger: below the island, yes; standing on it, no.
  check('falling below the island counts as fallen', hasFallenOut(plotYRange().min - 1))
  check('standing on the turf does not', !hasFallenOut(t.y))
  // ⚠ Open air INSIDE the cap is not a fall — it is ground the keeper has not built out to yet, and
  // snatching them back there would make expansion feel like a wall rather than an invitation.
  check('hovering over unbuilt ground is not a fall', !hasFallenOut(DEFAULT_PLOT.baseY))
}

// ── how many chests one fold holds ──────────────────────────────────────────────────────────────
{
  // ★ The number Alex asked for, at the cap that ships. If this ever fails, the spec changed and
  // somebody should have to say so out loud rather than discover it in a save.
  check('a first plot holds 10 chests', chestCap() === 10, `got ${chestCap()}`)

  // ★ IT RIDES `capRadius` AND NOTHING ELSE. That is what makes storage part of the same reward as
  // ground instead of a second track to balance — and it is why this survives whichever way the
  // ground-versus-resources gap is ruled.
  const wider = (r: number): PlotConfig => ({ ...DEFAULT_PLOT, capRadius: r })
  check('a fully-grown fold holds 24', chestCap(wider(72)) === 24, `got ${chestCap(wider(72))}`)
  check('it rises with the cap', chestCap(wider(45)) > chestCap(), '')
  check('and never falls as the cap rises', [30, 33, 40, 51, 60, 72].every((r, i, a) =>
    i === 0 || chestCap(wider(r)) >= chestCap(wider(a[i - 1]))))

  // ⚠ A cap of ZERO is a plot you cannot put a single chest in, which reads as a broken game rather
  // than as a rule. The floor is 1, whatever arithmetic arrives.
  check('never zero, however small the fold', chestCap(wider(1)) >= 1, `got ${chestCap(wider(1))}`)
  check('nor negative on a nonsense config', chestCap(wider(-10)) >= 1, `got ${chestCap(wider(-10))}`)
  check('always a whole number of chests', [1, 7, 30, 31, 32, 72, 100].every(r => Number.isInteger(chestCap(wider(r)))))
}

// ── the ground closing over a saved keeper ──────────────────────────────────────────────────────
// ★ THESE ARE WRITTEN AGAINST THE FAILURE, NOT THE ARITHMETIC. The bug shipped as "my player is
// stuck in the home plot unable to move" (Alex, 2026-08-18) and reproduced from his real save: feet
// stored at the exact y `plotHeight` now answers, i.e. one block INSIDE the topsoil, where collision
// refuses every direction. Every assert below is a sentence about a keeper, not about a number.
{
  // A spot with real ground, taken from the generator rather than assumed.
  const [gx, gz] = (() => {
    for (const [x, z] of columns()) if (plotHeight(x, z, SEED) !== null) return [x, z]
    throw new Error('the plot has no ground at all')
  })()
  const h = plotHeight(gx, gz, SEED)!

  // ★★ THE BUG ITSELF. Standing y is the first AIR block, so the surface block's own y is buried.
  check('a keeper saved inside the grass is lifted onto it',
    plotStandY(gx, h, gz, SEED) === h + 1, `got ${plotStandY(gx, h, gz, SEED)}, want ${h + 1}`)

  // ⚠ AND FROM ANY DEPTH, not just one block. Growth is additive and unbounded by this function, so
  // a save old enough to be two or three blocks under must not come back still buried.
  check('and from any depth the ground has grown to',
    [1, 2, 3, 8].every(d => plotStandY(gx, h - d, gz, SEED) === h + 1))

  // ★ A KEEPER WHO IS ALREADY STANDING MUST NOT BE MOVED AT ALL. If this ever fails, every load
  // teleports everyone a block upward forever — the fix becoming a slower version of the bug.
  check('a keeper already standing is left exactly where they are',
    plotStandY(gx, h + 1, gz, SEED) === h + 1)

  // ⚠ MID-JUMP, MID-FALL, IN FLIGHT. `Math.max` and not an assignment is what buys this, and it is
  // the one thing a naive "snap to the surface" fix would silently destroy.
  check('and one in the air stays in the air',
    [2, 5, 20].every(up => plotStandY(gx, h + up, gz, SEED) === h + up))

  // ⚠ OVER THE VOID THE SOFT RETURN OWNS THE FALL, not this. Returning anything but the stored y
  // here would give one fall two owners.
  const [vx, vz] = (() => {
    for (const [x, z] of columns()) if (plotHeight(x, z, SEED) === null) return [x, z]
    throw new Error('the plot has no void around it')
  })()
  check('outside the island the stored altitude is untouched',
    [80, 97, 140].every(y => plotStandY(vx, y, vz, SEED) === y))

  // ★ IT NEVER RETURNS A BURIED y ANYWHERE ON THE ISLAND. The sweep is the assert: a per-column
  // spot check would pass on a function that only works where it was sampled.
  let buried = 0
  for (const [x, z] of columns()) {
    const hh = plotHeight(x, z, SEED)
    if (hh === null) continue
    if (plotStandY(x, hh, z, SEED) <= hh) buried++
  }
  check('no column on the whole island restores a keeper under its own grass',
    buried === 0, `${buried} columns still bury the keeper`)

  // ★ AND THE ANSWER IS ALWAYS SOMEWHERE THE GENERATOR CALLS AIR — the property the keeper actually
  // cares about, asked of `plotMaterialAt` rather than re-derived from `plotHeight`.
  let solid = 0
  for (const [x, z] of columns()) {
    const hh = plotHeight(x, z, SEED)
    if (hh === null) continue
    if (plotMaterialAt(x, plotStandY(x, hh, z, SEED), z, SEED) !== AIR) solid++
  }
  check('and every restored keeper stands in air, not in a block',
    solid === 0, `${solid} columns restore into solid ground`)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
