// Boulder oracle. Run: npx tsx src/app/shimmer/voxel/boulders.test.ts
//
// Three claims carry this file, and only one of them is about boulders looking right:
//
//  §3 SEAM — a boulder spans columns, so the SAME voxel is computed by more than one column's
//     assembly. If the radius warp were hashed on world position instead of on the offset from the
//     boulder's own centre, both answers would still be deterministic and a single column would
//     still look perfect — and every boulder crossing a chunk boundary would grow a crack.
//
//  §6 ORE — the stage order that protects boulders from ore is exactly what exposes ore to
//     boulders. A boulder landing on an exposed element crystal converts it to stone that drops
//     rubble, which moves the rarity of a third of the canon evolution grid and is invisible in
//     play: no error, no wrong pixel, just slightly fewer crystals forever. This is the assert that
//     could never be eyeballed, and it is the reason the file exists. (Hub found it, not me.)
//
//  §5 BEDDED — a boulder must sit IN the ground, not on it. Balanced on the surface it reads as
//     dropped from the sky, and on a slope it hovers on the downhill side.

import {
  boulderStartsAt, boulderCells, boulderWarp, boulderScanRadius, plantBoulders,
  DEFAULT_BOULDERS, maxExpectedPerChunk, type BoulderStart,
} from './boulders'
import { SCATTER_DRESS, MAX_BOULDER_K } from './scatter'
import { LAND_IDS, landMix, dominantLand, type LandId } from './character'
import { Section, AIR } from './section'
import { MAT } from './depth'
import { ORE, isOre, placeOre, ORE_BATCHES } from './ore'
import { isLogMat, isLeafMat } from './trees'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const SIZE = 16
const CFG = DEFAULT_BOULDERS

// ── 1. starts are deterministic, bounded, and answer to the land ────────────────────────────────
{
  const a = boulderStartsAt(SEED, 40, -17, SIZE)
  const b = boulderStartsAt(SEED, 40, -17, SIZE)
  ok(JSON.stringify(a) === JSON.stringify(b), 'boulderStartsAt is deterministic')

  let n = 0, off = 0, badR = 0
  for (let cz = -60; cz <= 60; cz++) for (let cx = -60; cx <= 60; cx++) {
    for (const st of boulderStartsAt(SEED, cx, cz, SIZE)) {
      n++
      // A start must be INSIDE its own chunk, or the scan radius is computed against a lie.
      if (st.x < cx * SIZE || st.x >= (cx + 1) * SIZE || st.z < cz * SIZE || st.z >= (cz + 1) * SIZE) off++
      if (!(st.r >= CFG.minRadius && st.r <= CFG.maxRadius)) badR++
      if (!(st.squash >= CFG.minSquash && st.squash <= CFG.maxSquash)) badR++
    }
  }
  ok(n > 0, `boulders are placed at all (${n} over 121x121 chunks)`)
  ok(off === 0, `★ every start sits inside its own chunk (${off} strays)`)
  ok(badR === 0, `radius and squash stay inside their configured bands (${badR} out)`)

  // Never above the loosest expectation — a Bernoulli tail must not become a second boulder.
  const perChunk = n / (121 * 121)
  ok(perChunk <= maxExpectedPerChunk() + 1e-9,
    `★ density never exceeds the table's ceiling (${perChunk.toFixed(4)} vs ${maxExpectedPerChunk().toFixed(4)})`)
  ok(perChunk > 0.002, `★ and it is not vanishing (${perChunk.toFixed(4)}/chunk)`)
}

// ── 2. the land drives the count ────────────────────────────────────────────────────────────────
// Not an absolute rate — an ORDERING. Orderings survive retuning; magic constants do not.
{
  const found = new Map<LandId, { cx: number; cz: number; t: number }>()
  for (let cz = -180; cz <= 180; cz += 2) for (let cx = -180; cx <= 180; cx += 2) {
    const { id, t } = dominantLand(landMix(cx * SIZE + 8, cz * SIZE + 8, SEED))
    const cur = found.get(id)
    if (!cur || t > cur.t) found.set(id, { cx, cz, t })
  }
  const rate = (cx0: number, cz0: number): number => {
    let n = 0, c = 0
    for (let cz = cz0 - 7; cz <= cz0 + 7; cz++) for (let cx = cx0 - 7; cx <= cx0 + 7; cx++) {
      n += boulderStartsAt(SEED, cx, cz, SIZE).length; c++
    }
    return n / c
  }
  const crag = found.get('crag'), marsh = found.get('marsh')
  if (crag && marsh) {
    const rc = rate(crag.cx, crag.cz), rm = rate(marsh.cx, marsh.cz)
    ok(rc > rm, `★★ crag carries more boulders than marsh (${rc.toFixed(3)} vs ${rm.toFixed(3)})`)
  }
  const rank = [...LAND_IDS].sort((a, b) => SCATTER_DRESS[b].boulderK - SCATTER_DRESS[a].boulderK)
  ok(rank[0] === 'crag', '★ crag is the bouldery-est country in the table')
  ok(SCATTER_DRESS.marsh.boulderK < SCATTER_DRESS.barrens.boulderK,
    '★ a marsh is the wrong place for a boulder field; a barrens is the right one')
  ok(MAX_BOULDER_K === Math.max(...LAND_IDS.map(id => SCATTER_DRESS[id].boulderK)),
    'MAX_BOULDER_K tracks the table')
}

// ── 3. ★★ SEAM: the warp is a property of the BOULDER, not of where it happens to sit ───────────
{
  const st: BoulderStart = { x: 100, z: 100, r: 3.0, squash: 0.7, seed: 12345 }
  const shape = (s: BoulderStart) => boulderCells(s, 80).map(c => `${c.x - s.x},${c.y},${c.z - s.z}`).sort().join('|')
  // Same boulder, two different world positions: the OFFSET shape must be byte-identical. A
  // world-space warp fails this instantly, and it is the only cheap way to catch it.
  const moved: BoulderStart = { ...st, x: 100 + 16 * 7, z: 100 - 16 * 3 }
  const a = shape(st).replace(/,\d+,/g, ',Y,')
  const b = shape(moved).replace(/,\d+,/g, ',Y,')
  ok(a === b, '★★ a boulder is the same shape wherever it stands (the seam rule)')

  // And the warp function itself must not read world position — same offsets, same answer.
  ok(boulderWarp(2, -1, 3, 999, 0.3) === boulderWarp(2, -1, 3, 999, 0.3), 'boulderWarp is deterministic')
  ok(boulderWarp(2, -1, 3, 999, 0.3) !== boulderWarp(2, -1, 3, 1000, 0.3), 'boulderWarp answers to the boulder')

  // The scan radius must actually cover the widest boulder, or one straddling a boundary is clipped.
  const reach = Math.ceil(CFG.maxRadius * (1 + CFG.warp))
  ok(boulderScanRadius(SIZE) * SIZE >= reach,
    `★ the scan radius covers the widest boulder (${boulderScanRadius(SIZE) * SIZE} >= ${reach})`)
}

// ── 3b. ★★ TWO BOULDERS ARE NOT THE SAME BOULDER ───────────────────────────────────────────────
// ⚠ A MISSING PROPERTY, NOT A MISSING TEST, and every other assert in this file is blind to it.
// The dens pass shipped a literal `0` where the feature's own seed belonged: every chamber in the
// world came out identically warped — deterministic, seam-safe, 47 asserts green, and nine lands
// of holes all exactly the same shape. `boulders.test.ts` had the identical hole and would have
// survived the identical mutation. **Variation is a CLAIM, and an unstated claim is unprotected.**
//
// ★ COMPARE WHOLE CELL SETS, NOT A SUMMARY — handed over by hub, who tried the cheap version
// first. Identically-warped instances still differ in cell COUNT (they land on different ground
// and clip differently), so a count assert passes happily and ships a second decoration on top of
// the first. The set is the shape; a count is a shadow of it.
{
  const shapes = [1, 2, 3, 4].map(seed =>
    boulderCells({ x: 0, z: 0, r: 3.4, squash: 0.8, seed }, 100)
      .map(c => `${c.x},${c.y},${c.z}`).sort().join('|'))
  const distinct = new Set(shapes).size
  ok(distinct === shapes.length,
    `★★ boulders of identical geometry differ by SEED (${distinct}/${shapes.length} distinct shapes)`)

  // …and the counts alone would NOT have caught it — stated as an assert so the weaker test can
  // never quietly replace the stronger one.
  const counts = new Set(shapes.map(x => x.split('|').length)).size
  ok(counts <= shapes.length, `(cell counts alone distinguish only ${counts}/${shapes.length} — why the set is compared)`)
}

// ── 4. it is a lump, not a golf ball ────────────────────────────────────────────────────────────
{
  const st: BoulderStart = { x: 0, z: 0, r: 3.0, squash: 0.75, seed: 777 }
  const cells = boulderCells(st, 100)
  ok(cells.length > 30, `a boulder has real mass (${cells.length} cells)`)

  // Warped: the horizontal extent must not be identical in every direction. A perfect ellipsoid is
  // the "reads as a dome" failure, and it is invisible in a cell count.
  const spans: number[] = []
  for (const [dxk, dzk] of [[1, 0], [0, 1], [1, 1], [1, -1]] as const) {
    let m = 0
    for (const c of cells) {
      const dx = c.x - st.x, dz = c.z - st.z
      if (dxk === 1 && dzk === 0 && dz === 0) m = Math.max(m, Math.abs(dx))
      if (dxk === 0 && dzk === 1 && dx === 0) m = Math.max(m, Math.abs(dz))
      if (dxk === 1 && dzk === 1 && dx === dz) m = Math.max(m, Math.abs(dx))
      if (dxk === 1 && dzk === -1 && dx === -dz) m = Math.max(m, Math.abs(dx))
    }
    spans.push(m)
  }
  ok(new Set(spans).size > 1, `★ the silhouette is lumpy, not radially perfect (spans ${spans.join('/')})`)

  // Wider than tall — a boulder standing taller than it is broad is a menhir, a different object.
  const maxH = Math.max(...cells.map(c => c.y)) - Math.min(...cells.map(c => c.y)) + 1
  const maxW = Math.max(...cells.map(c => c.x)) - Math.min(...cells.map(c => c.x)) + 1
  ok(maxH < maxW, `★ boulders are wider than tall (${maxW} wide, ${maxH} tall)`)
}

// ── 5. ★ BEDDED IN THE GROUND, BUT MOSTLY STANDING PROUD OF IT ─────────────────────────────────
// ⚠ SWEEPS THE WHOLE CONFIGURED BAND, NOT ONE RADIUS. The first version checked three squash values
// at r = 3.0 and passed — while a perfectly ordinary r = 3.3 boulder was 55% underground and showed
// two rows. A sampled assert over a configured RANGE tests the sample, not the range, and the
// mismatch is invisible because both look like "the test passed".
{
  const G = 100
  let worstVisible = 1, worstRows = 99, cases = 0
  for (let r = CFG.minRadius; r <= CFG.maxRadius + 1e-9; r += 0.1) {
    for (const squash of [CFG.minSquash, (CFG.minSquash + CFG.maxSquash) / 2, CFG.maxSquash]) {
      const cells = boulderCells({ x: 0, z: 0, r, squash, seed: 4242 }, G)
      const above = cells.filter(c => c.y > G).length
      const below = cells.filter(c => c.y <= G).length
      const rowsAbove = new Set(cells.filter(c => c.y > G).map(c => c.y)).size
      cases++
      ok(below > 0, `★★ r${r.toFixed(1)}/${squash}: BEDDED — mass sits below the surface (${below})`)
      worstVisible = Math.min(worstVisible, above / (above + below))
      worstRows = Math.min(worstRows, rowsAbove)
    }
  }
  ok(cases > 20, `the band is actually swept (${cases} radius/squash pairs)`)
  // ★ THE NUMBER THAT MATTERS IS THE WORST CASE, not the average — one mostly-buried size is a
  // whole class of boulders that read as bumps, and an average hides it completely.
  ok(worstVisible > 0.5,
    `★★ every configured boulder is MOSTLY above ground (worst ${(worstVisible * 100).toFixed(0)}% visible)`)
  ok(worstRows >= 3,
    `★★ and stands at least 3 rows proud everywhere in the band (worst ${worstRows} rows) — two rows is a bump, not a boulder`)
}

// ── 6/7. ★★ BOULDERS DO NOT EAT ORE, LOGS OR LEAVES ────────────────────────────────────────────
// ⚠⚠ REWRITTEN AFTER THREE MUTATIONS SURVIVED THE FIRST VERSION, and the reason is worth more than
// the asserts. The first cut planted boulders into an ore fixture and checked the ore count had not
// moved — which passed with the refusal DELETED, because no boulder ever reached those windows.
// "Rooted" counts every boulder inside the SCAN radius, nearly all of which write no cell into the
// window being examined. I had even added a non-vacuity check for exactly this, and it was vacuous
// in a different place: it proved boulders write SOMEWHERE, not that they write HERE.
//
// ★ THE FIX IS TO MAKE THE COLLISION A PRECONDITION, NOT A HOPE. Find a window boulders demonstrably
// write into, then run the preservation test in THAT window, with the protected material laid in a
// checkerboard so the same window must both preserve it and write stone into the gaps. One assert
// then cannot pass without the collision actually happening.
{
  const mk = (): (Section | null)[] => Array.from({ length: 16 }, () => new Section(SIZE))
  const fill = (secs: (Section | null)[], f: (i: number) => number) => {
    for (const s of secs) if (s) for (let i = 0; i < s.data.length; i++) s.data[i] = f(i)
  }
  const count = (secs: (Section | null)[], pred: (m: number) => boolean): number => {
    let n = 0
    for (const s of secs) if (s) for (const v of s.data) if (pred(v)) n++
    return n
  }
  const GROUND = () => 140, SEA = 20

  // Precondition: a window boulders genuinely write mass into.
  let hitX = -1, hitCells = 0
  for (let cx = 0; cx < 200 && hitX < 0; cx++) {
    const probe = mk(); fill(probe, () => AIR)
    plantBoulders(probe, cx * SIZE, 0, 0, SIZE, SEED, GROUND, SEA)
    const w = count(probe, m => m === MAT.STONE)
    if (w > 40) { hitX = cx; hitCells = w }
  }
  ok(hitX >= 0, `★★ found a window boulders actually fill (chunk ${hitX}, ${hitCells} cells) — every assert below rests on this`)

  if (hitX >= 0) {
    const ox = hitX * SIZE
    // ── ORE. Checkerboard so the boulder must write into the gaps while sparing every ore cell.
    const oreW = mk(); fill(oreW, i => (i % 2 === 0 ? ORE.ELEMENT_EARTH : AIR))
    const oreBefore = count(oreW, isOre)
    plantBoulders(oreW, ox, 0, 0, SIZE, SEED, GROUND, SEA)
    const oreAfter = count(oreW, isOre)
    const stoneInOre = count(oreW, m => m === MAT.STONE)
    ok(oreBefore > 0, `the ore fixture holds ore (${oreBefore} cells)`)
    ok(stoneInOre > 0, `★★ the boulder DID write into this ore window (${stoneInOre} cells) — the collision is real`)
    ok(oreAfter === oreBefore,
      `★★ a boulder never converts ore to stone (${oreBefore} → ${oreAfter}) — an element crystal lost here is a third of the evolution grid getting rarer, silently`)

    // ── LOGS + LEAVES, same construction.
    const woodW = mk(); fill(woodW, i => (i % 2 === 0 ? 32 : AIR))          // 32 = GOLDWOOD_LOG
    const logBefore = count(woodW, isLogMat)
    plantBoulders(woodW, ox, 0, 0, SIZE, SEED, GROUND, SEA)
    ok(logBefore > 0 && count(woodW, m => m === MAT.STONE) > 0,
      `★ the boulder DID write into the trunk window — the collision is real`)
    ok(count(woodW, isLogMat) === logBefore,
      `★★ a boulder never eats a trunk (${logBefore} → ${count(woodW, isLogMat)}) — an eaten base breaks chopping and fires leaf decay on a canopy whose support silently vanished`)

    const leafW = mk(); fill(leafW, i => (i % 2 === 0 ? 33 : AIR))          // 33 = GOLDWOOD_LEAVES
    const leafBefore = count(leafW, isLeafMat)
    plantBoulders(leafW, ox, 0, 0, SIZE, SEED, GROUND, SEA)
    ok(leafBefore > 0 && count(leafW, isLeafMat) === leafBefore,
      `★ a boulder never eats leaves (${leafBefore} → ${count(leafW, isLeafMat)})`)

    // ── And the guard must not be a blanket refusal: ordinary ground MUST be overwritten, or the
    // three asserts above would pass for a boulder that writes nothing at all.
    const soilW = mk(); fill(soilW, () => MAT.TOPSOIL)
    plantBoulders(soilW, ox, 0, 0, SIZE, SEED, GROUND, SEA)
    ok(count(soilW, m => m === MAT.STONE) > 0,
      `★★ …and a boulder DOES overwrite ordinary ground (${count(soilW, m => m === MAT.STONE)} cells) — the refusal is selective, not total`)
  }
}

// ── 8. nothing drowns ───────────────────────────────────────────────────────────────────────────
{
  const secs: (Section | null)[] = Array.from({ length: 16 }, () => new Section(SIZE))
  // Surface below sea level everywhere: not one boulder may be rooted.
  const placed = plantBoulders(secs, 0, 0, 0, SIZE, SEED, () => 10, 20)
  ok(placed === 0, `★ no boulder is rooted below the waterline (${placed} placed)`)
  const dry = plantBoulders(secs, 0, 0, 0, SIZE, SEED, () => 140, 20)
  ok(dry > 0, `★ …and the same window DOES place when it is dry (${dry}) — the gate is not vacuous`)
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the country carries its stone — ${pass} passed. Now go LOOK at it (:3200 /shimmer)`)
