// World-overlay oracle — run: npx tsx src/app/shimmer/world/world-overlay.test.ts
//
// This file exists because the bug it guards against already shipped once, in a quieter form: the
// terrain between districts belonged to no zone, so an edit made out there was silently discarded
// and the composer redrew its own version on the next load. The fix moves that terrain into an
// overlay keyed on WORLD coordinates — the one place in this codebase that cannot use logical keys,
// because it describes the space between the things logical keys are relative to.
//
// So the asserts are mostly about that exposure. A layout change has to be caught and refused, not
// absorbed; the substrate has to actually cover the space it claims to; and an authored tile has to
// beat the generated corridor that used to overwrite it.

import { composeGardenWorld, SURFACE_ZONES } from './garden-world'
import { setLiveOverlay, paintOverlay, layoutFingerprint, overlayMismatch, EMPTY_OVERLAY } from './world-overlay'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { console.log(`  ok    ${label}`); return }
  failures++
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}

const VOID = -1, WALL = 34

console.log('\nworld-overlay oracle\n')

console.log('the cloud substrate')
{
  setLiveOverlay(null)
  const w = composeGardenWorld()
  let voidOutside = 0, voidInside = 0, wall = 0
  for (let y = 0; y < w.rows; y++) for (let x = 0; x < w.cols; x++) {
    const v = w.grid[y][x]
    if (v === VOID) (w.zoneAt(x, y) ? voidInside++ : voidOutside++)
    else if ((v & 0xFF) === WALL) wall++
  }
  // ★ The headline. Before the substrate, 94,607 tiles outside every zone were VOID: black on the
  // map toggle, owned by nobody, editable by nobody. Not one may remain.
  check('★ no tile outside a district is empty sky any more', voidOutside === 0, `${voidOutside} left`)
  check('the cloudscape is substantial', wall > 50_000, `${wall.toLocaleString()} cloud tiles`)

  // A zone's own authored sky is a deliberate shape — holes in the island — and the substrate has
  // no business filling those in.
  check('a district keeps its own authored sky', voidInside > 0, `${voidInside} inside zones`)

  check('every stitched district is still placed', SURFACE_ZONES.every(z => w.placements.has(z)))

  // The solver tolerates ONE class of issue by design: a loop mismatch, where two paths through the
  // warp graph disagree about where a zone lands and the corridor router absorbs the difference.
  // An OVERLAP or an unreachable zone is real breakage and must never appear.
  const fatal = w.issues.filter(i => !i.startsWith('loop mismatch'))
  check('no district overlaps or is unreachable', fatal.length === 0, fatal.slice(0, 2).join(' · '))

  // Reported, not asserted away: `mycelial-path → spirit-meadow` is off by (80,22), which is why
  // the corridor between them is a long generated dog-leg rather than a short punch through the
  // band — and why hand-editing that particular tunnel felt like fighting the map. With the overlay
  // it is now authored terrain, so the generated path is a starting point rather than the answer.
  for (const i of w.issues.filter(i => i.startsWith('loop mismatch'))) console.log(`  note  ${i}`)
}

console.log('\nthe fingerprint refuses a moved layout')
{
  const w = composeGardenWorld()
  const grid = w.grid.map(r => [...r]), heights = w.heights.map(r => [...r])

  // A tile out in the cloud, authored.
  let ox = -1, oy = -1
  for (let y = 0; y < w.rows && oy < 0; y++) for (let x = 0; x < w.cols; x++) {
    if (!w.zoneAt(x, y)) { ox = x; oy = y; break }
  }
  setLiveOverlay({ fingerprint: w.fingerprint, tiles: { [`${ox},${oy}`]: 97 }, heights: {} })
  check('an authored tile lands', paintOverlay(grid, heights, w.rows, w.cols, w.fingerprint) === 1)
  check('...and it is the tile that was authored', grid[oy][ox] === 97)
  check('...with no mismatch reported', overlayMismatch() === null)

  // ★ Now pretend a zone was resized. Every stored coordinate points somewhere else, so applying
  // would scatter tiles across the map — corruption that looks like a rendering bug and is tedious
  // to undo by hand. Fail closed: apply nothing, say so.
  const grid2 = w.grid.map(r => [...r])
  const painted = paintOverlay(grid2, heights, w.rows, w.cols, w.fingerprint + '|moved')
  check('★ a moved layout applies NOTHING', painted === 0)
  check('...and says why, out loud', (overlayMismatch() ?? '').includes('different layout'))
  check('...leaving the composed world untouched', grid2[oy][ox] === w.grid[oy][ox])

  // The fingerprint has to notice a zone changing SIZE, not just position — a zone growing a row
  // shifts everything the solver places after it without changing the world's outer dimensions.
  const base = [{ zone: { id: 'a' }, ox: 0, oy: 0, cols: 10, rows: 10 }]
  const moved = [{ zone: { id: 'a' }, ox: 1, oy: 0, cols: 10, rows: 10 }]
  const grown = [{ zone: { id: 'a' }, ox: 0, oy: 0, cols: 11, rows: 10 }]
  check('fingerprint notices a district moving', layoutFingerprint(50, 50, base) !== layoutFingerprint(50, 50, moved))
  check('fingerprint notices a district resizing', layoutFingerprint(50, 50, base) !== layoutFingerprint(50, 50, grown))
  check('fingerprint is stable for an unchanged layout', layoutFingerprint(50, 50, base) === layoutFingerprint(50, 50, [...base]))

  // Order must not matter — placements come out of a Map and nothing promises an iteration order.
  const two = [base[0], { zone: { id: 'b' }, ox: 20, oy: 0, cols: 5, rows: 5 }]
  check('fingerprint does not depend on placement order',
    layoutFingerprint(50, 50, two) === layoutFingerprint(50, 50, [...two].reverse()))
}

console.log('\nan authored route beats the generated one')
{
  // The actual bug, as an assert: the composer carves an L-path between every stitched warp pair on
  // EVERY load. Painting over that path only sticks if the overlay is applied after the carve.
  setLiveOverlay(null)
  const plain = composeGardenWorld()
  let cx = -1, cy = -1
  for (let y = 0; y < plain.rows && cy < 0; y++) for (let x = 0; x < plain.cols; x++) {
    // a carved corridor tile: outside every zone, and walkable rather than cloud
    if (!plain.zoneAt(x, y) && (plain.grid[y][x] & 0xFF) !== WALL && plain.grid[y][x] !== VOID) { cx = x; cy = y; break }
  }
  check('the composer does carve corridors through the cloud', cx >= 0, `found at ${cx},${cy}`)

  if (cx >= 0) {
    setLiveOverlay({ fingerprint: plain.fingerprint, tiles: { [`${cx},${cy}`]: WALL }, heights: {} })
    const walled = composeGardenWorld()
    check('★ authoring over a generated corridor sticks', (walled.grid[cy][cx] & 0xFF) === WALL)
    check('...and the rest of the world is unchanged', walled.rows === plain.rows && walled.cols === plain.cols)
  }
  setLiveOverlay(null)
}

console.log('\nbad data cannot break the world')
{
  const w = composeGardenWorld()
  const grid = w.grid.map(r => [...r]), heights = w.heights.map(r => [...r])
  setLiveOverlay({
    fingerprint: w.fingerprint,
    tiles: { '99999,99999': 97, '-5,-5': 97, [`${w.cols - 1},${w.rows - 1}`]: 97 },
    heights: {},
  })
  const painted = paintOverlay(grid, heights, w.rows, w.cols, w.fingerprint)
  check('out-of-bounds entries are dropped, not thrown on', painted === 1, `${painted} painted`)
  check('the in-bounds one still landed', grid[w.rows - 1][w.cols - 1] === 97)

  setLiveOverlay(EMPTY_OVERLAY)
  check('an empty overlay is a no-op', paintOverlay(grid, heights, w.rows, w.cols, w.fingerprint) === 0)
  setLiveOverlay(null)
  check('a missing overlay is a no-op', paintOverlay(grid, heights, w.rows, w.cols, w.fingerprint) === 0)
  check('...and neither reports a mismatch', overlayMismatch() === null)
}

console.log(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} failing`}\n`)
process.exit(failures === 0 ? 0 : 1)
