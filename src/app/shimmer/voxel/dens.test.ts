// Den oracle. Run: npx tsx src/app/shimmer/voxel/dens.test.ts
//
// A den is the first thing this generator builds by REMOVING ground, and every hazard in the file
// is the mirror image of one boulders already learned. Four claims carry it:
//
//  §5 OPEN — the failure this feature is actually likely to have. A den that never reaches daylight
//     is a sealed cavity: it costs cells, it generates deterministically, it breaks nothing, and it
//     is invisible in play and in every assert that counts cells. So openness is proved by FLOOD
//     FILL from outside air through the real generated world, and the fill is a PRECONDITION —
//     §5 refuses to score if it did not find dens to test. The boulder oracle shipped three
//     surviving mutations because its fixture never contained the collision its asserts were about.
//
//  §6 NOTCH — the mouth is allowed to cut surface blocks and nothing else is. Away from a den's own
//     mouth, this file may not remove a block a keeper is standing on. Stated as a bound on
//     distance-from-mouth rather than as "does it look right", because a trench through a hilltop
//     and a den mouth differ only in where the removed blocks are.
//
//  §7 SEAM — boulders found that a feature landing on an exposed element crystal converts it to
//     stone. A den does something strictly harder to notice: it removes the crystal and leaves
//     NOTHING, so there is no artefact for anyone to trip over. Each element gates ten canon second
//     forms, so an unnoticed shave off crystal rarity moves a third of the evolution grid.
//
//  §9 SEAM — a den spans chunks, so the same voxel is computed by more than one column's assembly.
//     Hashing the chamber warp on world position instead of on the offset from its own centre would
//     be deterministic, would look perfect in one column, and would step every den on a boundary.

import {
  denStartsAt, denAt, denCells, denWarp, denScanRadius, digDens, denCharacterAt,
  DEFAULT_DENS, DEN_DRESS, MAX_DEN_K, maxAttemptsPerChunk, type DenStart, type DenPlan,
} from './dens'
import { LAND_IDS, landMix, dominantLand, type LandId } from './character'
import { Section, AIR } from './section'
import { MAT, DEFAULT_DEPTH } from './depth'
import { columnHeight, DEFAULT_HEIGHT } from './height'
import { isSeam, placeSeams } from './seams'
import { isLogMat, isLeafMat } from './trees'
import { HOLDS } from './holds'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const SIZE = 16
const CFG = DEFAULT_DENS
const SEA = DEFAULT_DEPTH.seaLevel
const realSurface = (x: number, z: number) => columnHeight(x, z, SEED, DEFAULT_HEIGHT)

// ── 1. attempts are deterministic, bounded, and answer to the land ──────────────────────────────
{
  const a = denStartsAt(SEED, 31, -12, SIZE)
  const b = denStartsAt(SEED, 31, -12, SIZE)
  ok(JSON.stringify(a) === JSON.stringify(b), 'denStartsAt is deterministic')

  let n = 0, off = 0, bad = 0
  for (let cz = -60; cz <= 60; cz++) for (let cx = -60; cx <= 60; cx++) {
    for (const st of denStartsAt(SEED, cx, cz, SIZE)) {
      n++
      // A start must sit inside its own chunk, or the scan radius is computed against a lie.
      if (st.x < cx * SIZE || st.x >= (cx + 1) * SIZE || st.z < cz * SIZE || st.z >= (cz + 1) * SIZE) off++
      if (!(st.chamberR >= CFG.chamberRadiusMin && st.chamberR <= CFG.chamberRadiusMax)) bad++
      if (!(st.throatExtra >= CFG.throatExtraMin && st.throatExtra <= CFG.throatExtraMax)) bad++
    }
  }
  ok(n > 0, `dens are attempted at all (${n} over 121x121 chunks)`)
  ok(off === 0, `★ every attempt sits inside its own chunk (${off} strays)`)
  ok(bad === 0, `chamber radius and throat length stay inside their bands (${bad} out)`)
  const perChunk = n / (121 * 121)
  ok(perChunk <= maxAttemptsPerChunk() + 1e-9,
    `★ the Bernoulli tail never becomes a second den (${perChunk.toFixed(4)} <= ${maxAttemptsPerChunk().toFixed(4)}/chunk)`)
}

// ── 2. the dial table, and the ceiling that must track it ───────────────────────────────────────
{
  const tableMax = Math.max(...LAND_IDS.map(id => DEN_DRESS[id].denK))
  ok(tableMax === MAX_DEN_K,
    `★ MAX_DEN_K tracks the table (${MAX_DEN_K} vs table ${tableMax}) — a dial raised above the ceiling would be silently clipped`)
  ok(DEN_DRESS.marsh.denK === 0, '★ marsh digs nothing — a den in saturated ground is a flooded hole')

  // Every land is present, or a new land silently inherits nothing and reads as marsh.
  ok(LAND_IDS.every(id => typeof DEN_DRESS[id]?.denK === 'number'),
    'every land has a den dial — a missing one would read as "no dens here" rather than as an error')

  // ★ BLENDED, NEVER ROLLED. A rolled dial jumps by a fixed step wherever the roll flips, and that
  // jump is INVARIANT to how finely you sample. A blend's jump SHRINKS with the spacing. Measuring
  // the gradient at two spacings separates the two without needing to know where a border is.
  const grad = (step: number) => {
    let worst = 0
    for (let i = 0; i < 4000; i++) {
      const x = -3000 + (i * 271) % 6000, z = -3000 + (i * 733) % 6000
      worst = Math.max(worst, Math.abs(denCharacterAt(x + step, z, SEED) - denCharacterAt(x, z, SEED)))
    }
    return worst
  }
  const g8 = grad(8), g1 = grad(1)
  ok(g1 < g8 * 0.6,
    `★★ the dial BLENDS, it does not roll (max jump ${g1.toFixed(3)} at spacing 1 vs ${g8.toFixed(3)} at 8 — a roll would not shrink)`)

  // And a deep marsh interior really does read zero, blend notwithstanding.
  let marshMax = 0, marshN = 0
  for (let z = -4000; z <= 4000; z += 37) for (let x = -4000; x <= 4000; x += 37) {
    const d = dominantLand(landMix(x, z, SEED))
    if (d.id !== 'marsh' || d.t < 0.85) continue
    marshN++
    marshMax = Math.max(marshMax, denCharacterAt(x, z, SEED))
  }
  ok(marshN > 20, `…and the marsh sample is not vacuous (${marshN} deep-marsh columns)`)
  // ⚠ NOT ZERO, AND IT MUST NOT BE. Even at 0.85 dominance a column still carries 15% of its
  // neighbours, and `denCharacterAt` blends — so the residue IS the sibling law working. Asserting
  // an exact zero here would be asserting a contour, which is the one thing this layer forbids.
  ok(marshMax < 0.30, `★ a deep marsh carries essentially no den dial (max ${marshMax.toFixed(3)}, from its neighbours' share)`)
}

// ── 3. the bank is a precondition, and a flat world takes no dens ───────────────────────────────
{
  const flat = (): number => 120
  let planned = 0
  for (let cz = -30; cz <= 30; cz++) for (let cx = -30; cx <= 30; cx++) {
    for (const st of denStartsAt(SEED, cx, cz, SIZE)) if (denAt(st, SEED, flat, SEA)) planned++
  }
  ok(planned === 0, `★★ not one den is dug into flat ground (${planned} planned over 61x61 chunks)`)

  // …and the same window on a real bank DOES plan, or the assert above is satisfied by a feature
  // that never places anything at all.
  let real = 0
  for (let cz = -30; cz <= 30; cz++) for (let cx = -30; cx <= 30; cx++) {
    for (const st of denStartsAt(SEED, cx, cz, SIZE)) if (denAt(st, SEED, realSurface, SEA)) real++
  }
  ok(real > 20, `★ …and the real heightfield DOES plan dens in the same window (${real}) — the gate is not vacuous`)

  // The plan must actually face downhill: the mouth is lower than the anchor, always.
  let uphill = 0, checked = 0
  for (let cz = -30; cz <= 30; cz++) for (let cx = -30; cx <= 30; cx++) {
    for (const st of denStartsAt(SEED, cx, cz, SIZE)) {
      const plan = denAt(st, SEED, realSurface, SEA)
      if (!plan) continue
      checked++
      if (realSurface(Math.round(plan.mouthX), Math.round(plan.mouthZ)) >= realSurface(st.x, st.z)) uphill++
    }
  }
  ok(checked > 20 && uphill === 0, `★ every mouth faces downhill (${uphill} of ${checked} did not)`)
}

// ── 4. a den is a room: floor, headroom, and a chamber deeper than the throat ───────────────────
{
  // Synthetic bank, exactly steep enough to qualify: 1 block of fall per block of run.
  const ramp = (x: number, _z: number) => 120 - x
  const st: DenStart = { x: 0, z: 0, seed: 0x1234, chamberR: 2.8, throatExtra: CFG.throatExtraMin }
  const plan = denAt(st, SEED, ramp, SEA)
  ok(plan !== null, '★ a 1:1 bank takes a den (the fixture below depends on it)')
  if (plan) {
    const cells = denCells(plan)
    ok(cells.length > 60, `a den wants a real volume (${cells.length} cells)`)
    ok(cells.every(c => c.y >= plan.floorY), '★ nothing is ever dug below the floor a keeper walks in on')

    // ⚠⚠ AND ONE FIXTURE DOES NOT COVER THAT CLAIM — a mutation removing the floor clamp entirely
    // SURVIVED the line above. At chamberR 2.8 the ellipsoid excludes the sub-floor rows on its own,
    // so the clamp is dead code at that size and live at the top of the band. Same shape as the
    // boulder oracle sampling ONE radius over a configured RANGE and passing while r 3.3 was 55%
    // underground: a band must be swept, never sampled.
    let below = 0, wouldReach = 0, swept = 0
    for (let i = 0; i <= 20; i++) {
      const r = CFG.chamberRadiusMin + (i / 20) * (CFG.chamberRadiusMax - CFG.chamberRadiusMin)
      for (const extra of [CFG.throatExtraMin, CFG.throatExtraMax]) {
        const p2 = denAt({ x: 0, z: 0, seed: 0x2000 + i, chamberR: r, throatExtra: extra }, SEED, ramp, SEA)
        if (!p2) continue
        swept++
        for (const c of denCells(p2)) if (c.y < p2.floorY) below++
        // Non-vacuity: at the top of the band the UNCLAMPED ellipsoid really does reach under the
        // floor, so the clamp has something to do. Mirrors `denCells`' own y-loop bounds.
        const ry = r * CFG.chamberSquash
        if (Math.floor(p2.cyw - Math.ceil(ry * (1 + CFG.warp))) < p2.floorY) wouldReach++
      }
    }
    ok(swept >= 20, `the chamber band is swept, not sampled (${swept} sizes) — PRECONDITION`)
    ok(wouldReach > 0, `★ …and the clamp is live somewhere in the band (${wouldReach} sizes reach under the floor unclamped) — PRECONDITION`)
    ok(below === 0, `★★ across the WHOLE chamber band, nothing is dug below the floor (${below} cells)`)

    // Headroom: somewhere in the den there are `headroom` stacked rows over one column.
    const byCol = new Map<string, number[]>()
    for (const c of cells) {
      const k = `${c.x},${c.z}`
      const a = byCol.get(k) ?? []; a.push(c.y); byCol.set(k, a)
    }
    const tallest = Math.max(...[...byCol.values()].map(a => a.length))
    ok(tallest >= CFG.headroom, `★ the den stands ${CFG.headroom} high somewhere (tallest column ${tallest})`)

    // The apron is BOUNDED — only throat cells, only near the mouth.
    const apron = cells.filter(c => c.apron)
    // Exact, not tolerant — the notch bound is now the cell's own distance from the mouth.
    const far = apron.filter(c => Math.hypot(c.x - plan.mouthX, c.z - plan.mouthZ) > CFG.apronSteps + 1e-9)
    ok(apron.length > 0, `the mouth notch exists (${apron.length} apron cells)`)
    ok(far.length === 0, `★★ every apron cell is inside ${CFG.apronSteps} steps of the mouth (${far.length} strays)`)
    // ⚠ THE RIGHT CLAIM IS STRUCTURAL, NOT A RATIO. "Fewer than half the cells are apron-eligible"
    // reads like a bound on the notch and is not one: eligibility is a permission, and most of the
    // cells holding it are nowhere near the surface, so the ratio measures the throat's shape and
    // calls it the notch's size. What actually matters is that no CHAMBER cell can ever hold the
    // permission — §6 measures the blocks genuinely removed.
    const chamberApron = apron.filter(c =>
      Math.hypot(c.x - plan.cxw, c.z - plan.czw) <= plan.chamberR * (1 - CFG.warp) && c.y > plan.floorY)
    ok(chamberApron.length === 0,
      `★★ no chamber cell may cut the surface (${chamberApron.length} did) — only the throat has a mouth`)
  }

  // ★ THE CONFIG ITSELF MUST KEEP THE CHAMBER OUT OF THE NOTCH. Derived from the numbers rather
  // than restated, so lowering `throatExtraMin` for a shorter den fails here instead of silently
  // handing the chamber permission to cut the turf. (It did exactly that at throatExtraMin 2.)
  const clearance = CFG.probe + CFG.throatExtraMin - CFG.chamberRadiusMax * (1 + CFG.warp)
  ok(clearance > CFG.apronSteps,
    `★★ the chamber's near face clears the notch (${clearance.toFixed(2)} > apronSteps ${CFG.apronSteps})`)

  // ── ★★ VARIATION IS A CLAIM, AND AN UNSTATED CLAIM IS UNPROTECTED ─────────────────────────
  // Nothing above would notice if every den in the world were the identical shape — and for a
  // while every one was, because the chamber warp was salted with a literal `0` instead of the
  // den's own seed. Deterministic, seam-safe, alignment-agreed, 47 asserts green, and nine lands
  // of dens stamped from one mould: a defect invisible to every property this file checks and
  // obvious the moment you stand in two of them. So the claim gets stated.
  {
    const geom = { x: 0, z: 0, chamberR: 3.0, throatExtra: CFG.throatExtraMin }
    const shapes = [0xaaa1, 0xbbb2, 0xccc3, 0xddd4].map(sd => {
      const pl = denAt({ ...geom, seed: sd }, SEED, ramp, SEA)
      return pl ? denCells(pl).map(c => `${c.x},${c.y},${c.z}`).sort().join('|') : null
    })
    ok(shapes.every(Boolean), 'the variation fixture plans all four dens — PRECONDITION')
    ok(new Set(shapes).size === shapes.length,
      `★★ two dens of identical geometry but different seeds are DIFFERENT SHAPES (${new Set(shapes).size}/${shapes.length} distinct)`)
  }

  // Altitude: the shell is up there, and nothing is dug into it.
  const high = denAt({ x: 0, z: 0, seed: 9, chamberR: 2.5, throatExtra: CFG.throatExtraMin },
    SEED, (x) => CFG.maxAltitude + 20 - x, SEA)
  ok(high === null, `★ nothing is dug above ${CFG.maxAltitude} — the treeline's reason, the shell is up there`)
  const low = denAt({ x: 0, z: 0, seed: 9, chamberR: 2.5, throatExtra: CFG.throatExtraMin },
    SEED, (x) => CFG.maxAltitude - 40 - x, SEA)
  ok(low !== null, '★ …and the identical bank below the ceiling IS dug — the gate is not vacuous')

  // The roof check is real: shrink the ground over the chamber and the den must be refused.
  const thin = (x: number, _z: number) => (x < -1 ? 122 : 120 - x)
  let refusedThin = 0, acceptedFat = 0
  for (let i = 0; i < 40; i++) {
    const s: DenStart = { x: 0, z: 0, seed: i, chamberR: 3.2, throatExtra: CFG.throatExtraMax }
    if (!denAt(s, SEED, thin, SEA)) refusedThin++
    if (denAt(s, SEED, ramp, SEA)) acceptedFat++
  }
  ok(refusedThin === 40 && acceptedFat === 40,
    `★ a chamber under a thin crust is refused (${refusedThin}/40) while the same chamber under real ground is dug (${acceptedFat}/40)`)
}

// ── a little world: real heights, solid below the surface, so a fill has somewhere to go ────────
const STACKS = 16
function buildRegion(cx0: number, cz0: number, n: number, surf: (x: number, z: number) => number = realSurface) {
  const cols = new Map<string, (Section | null)[]>()
  for (let cz = cz0; cz < cz0 + n; cz++) for (let cx = cx0; cx < cx0 + n; cx++) {
    const secs: (Section | null)[] = Array.from({ length: STACKS }, () => new Section(SIZE))
    for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
      const h = surf(cx * SIZE + x, cz * SIZE + z)
      for (let y = 0; y <= Math.min(h, STACKS * SIZE - 1); y++) {
        secs[(y / SIZE) | 0]!.set(x, y - ((y / SIZE) | 0) * SIZE, z, y === h ? MAT.TOPSOIL : (y > h - 4 ? MAT.SUBSOIL : MAT.STONE))
      }
    }
    cols.set(`${cx},${cz}`, secs)
  }
  const get = (wx: number, wy: number, wz: number): number => {
    if (wy < 0 || wy >= STACKS * SIZE) return AIR
    const cx = Math.floor(wx / SIZE), cz = Math.floor(wz / SIZE)
    const secs = cols.get(`${cx},${cz}`)
    if (!secs) return -1                                  // outside the region — a wall, not air
    const s = secs[(wy / SIZE) | 0]
    return s ? s.get(wx - cx * SIZE, wy - ((wy / SIZE) | 0) * SIZE, wz - cz * SIZE) : AIR
  }
  const dig = (cfg = CFG) => {
    let opened = 0
    for (let cz = cz0; cz < cz0 + n; cz++) for (let cx = cx0; cx < cx0 + n; cx++) {
      opened += digDens(cols.get(`${cx},${cz}`)!, cx * SIZE, 0, cz * SIZE, SIZE, SEED, surf, SEA, cfg)
    }
    return opened
  }
  return { cols, get, dig }
}

/** Every den planned anywhere whose chamber lands inside an n-chunk region starting at (cx0, cz0). */
function densIn(cx0: number, cz0: number, n: number): DenPlan[] {
  const out: DenPlan[] = []
  const rad = denScanRadius(SIZE)
  for (let cz = cz0 - rad; cz < cz0 + n + rad; cz++) for (let cx = cx0 - rad; cx < cx0 + n + rad; cx++) {
    for (const st of denStartsAt(SEED, cx, cz, SIZE)) {
      const p = denAt(st, SEED, realSurface, SEA)
      if (!p) continue
      const bx = Math.round(p.cxw), bz = Math.round(p.czw)
      if (bx >= cx0 * SIZE + 6 && bx < (cx0 + n) * SIZE - 6 && bz >= cz0 * SIZE + 6 && bz < (cz0 + n) * SIZE - 6) out.push(p)
    }
  }
  return out
}

// Find regions that actually contain a den. Scanning for them is part of the test: a fixture chosen
// by hand would be a fixture chosen to pass.
const sites: { cx: number; cz: number; plan: DenPlan }[] = []
for (let cz = -40; cz <= 40 && sites.length < 12; cz += 5) {
  for (let cx = -40; cx <= 40 && sites.length < 12; cx += 5) {
    const found = densIn(cx, cz, 5)
    if (found.length) sites.push({ cx, cz, plan: found[0] })
  }
}

/** Every den PLAN that reaches an n-chunk region — including dens anchored outside it. */
function allPlansNear(cx0: number, cz0: number, n: number): DenPlan[] {
  const out: DenPlan[] = []
  const rad = denScanRadius(SIZE)
  for (let cz = cz0 - rad; cz < cz0 + n + rad; cz++) for (let cx = cx0 - rad; cx < cx0 + n + rad; cx++) {
    for (const st of denStartsAt(SEED, cx, cz, SIZE)) {
      const p = denAt(st, SEED, realSurface, SEA)
      if (p) out.push(p)
    }
  }
  return out
}

/** Every den mouth that reaches an n-chunk region — including dens anchored outside it. */
function allMouthsNear(cx0: number, cz0: number, n: number): [number, number][] {
  const out: [number, number][] = []
  const rad = denScanRadius(SIZE)
  for (let cz = cz0 - rad; cz < cz0 + n + rad; cz++) for (let cx = cx0 - rad; cx < cx0 + n + rad; cx++) {
    for (const st of denStartsAt(SEED, cx, cz, SIZE)) {
      const p = denAt(st, SEED, realSurface, SEA)
      if (p) out.push([p.mouthX, p.mouthZ])
    }
  }
  return out
}

// ── 5. ★★ THE MOUTH IS OPEN — flood fill from the sky, through the real world ───────────────────
{
  ok(sites.length >= 8, `★★ the openness fixture is not vacuous — ${sites.length} real den sites found to test`)

  let tested = 0, reached = 0, cellsDug = 0
  for (const site of sites) {
    const R = buildRegion(site.cx, site.cz, 5)
    cellsDug += R.dig()
    const p = site.plan

    // Flood fill AIR, seeded from every open cell on the region's top face and outer shell.
    const lo = { x: site.cx * SIZE, z: site.cz * SIZE }
    const hi = { x: (site.cx + 5) * SIZE, z: (site.cz + 5) * SIZE }
    const seen = new Set<number>()
    const key = (x: number, y: number, z: number) => ((x - lo.x) * 80 + (z - lo.z)) * 256 + y
    const stack: [number, number, number][] = []
    for (let z = lo.z; z < hi.z; z++) for (let x = lo.x; x < hi.x; x++) {
      const y = Math.min(realSurface(x, z) + 1, STACKS * SIZE - 1)
      if (R.get(x, y, z) === AIR) { stack.push([x, y, z]); seen.add(key(x, y, z)) }
    }
    while (stack.length) {
      const [x, y, z] = stack.pop()!
      for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]] as [number,number,number][]) {
        const nx = x + dx, ny = y + dy, nz = z + dz
        if (nx < lo.x || nx >= hi.x || nz < lo.z || nz >= hi.z || ny < 0 || ny >= STACKS * SIZE) continue
        const k = key(nx, ny, nz)
        if (seen.has(k)) continue
        if (R.get(nx, ny, nz) !== AIR) continue
        seen.add(k); stack.push([nx, ny, nz])
      }
    }
    // The chamber's own floor cell: the deepest point a keeper is meant to reach.
    const target: [number, number, number] = [Math.round(p.cxw), p.floorY, Math.round(p.czw)]
    if (R.get(...target) === AIR) {
      tested++
      if (seen.has(key(...target))) reached++
    }
  }
  ok(cellsDug > 0, `dens are actually dug into the region (${cellsDug} cells opened)`)
  ok(tested >= 8, `★★ …and the chambers exist to be reached (${tested} chamber floors are open air) — PRECONDITION`)
  ok(tested > 0 && reached === tested,
    `★★★ every den's chamber is reachable from open sky (${reached}/${tested}) — a sealed den is invisible and breaks nothing`)
}

// ── 6. ★★ THE NOTCH: away from its own mouth, a den never removes a surface block ───────────────
{
  let surfaceRemoved = 0, farFromMouth = 0, regions = 0
  for (const site of sites.slice(0, 6)) {
    regions++
    const R = buildRegion(site.cx, site.cz, 5)
    const before = new Map<string, number>()
    for (let z = site.cz * SIZE; z < (site.cz + 5) * SIZE; z++) for (let x = site.cx * SIZE; x < (site.cx + 5) * SIZE; x++) {
      before.set(`${x},${z}`, R.get(x, realSurface(x, z), z))
    }
    R.dig()
    // ⚠ EVERY den reaching in, not only the ones anchored here. `densIn` filters to interior
    // chambers so §5 has a target it can name; using that same list here would leave the mouths of
    // scanned-in dens unaccounted and report them as trenches. A test that measures the wrong set
    // reports a bug in the code it is testing — the instrument lesson, one more time.
    // ⚠⚠ SET MEMBERSHIP, NOT A DISTANCE TOLERANCE — and the difference decided this assert.
    // The first version asked whether a removed surface block was within
    // `apronSteps + throatRadius + 1.5` of some mouth, and a mutation that granted the notch
    // permission to the WHOLE den SURVIVED it: on gentler ground the extra cells it removes sit
    // at step 4, which is 4.0 from the mouth and comfortably inside a 5.75 tolerance. A slack
    // radius reads as a bound and is not one. So the claim is exact: every surface block this
    // file removes must be a cell the planner actually marked `apron`.
    const permitted = new Set<string>()
    for (const p of allPlansNear(site.cx, site.cz, 5)) {
      for (const c of denCells(p)) if (c.apron) permitted.add(`${c.x},${c.y},${c.z}`)
    }
    for (const [k, v] of before) {
      const [x, z] = k.split(',').map(Number)
      const h = realSurface(x, z)
      if (v === AIR || R.get(x, h, z) !== AIR) continue
      surfaceRemoved++
      if (!permitted.has(`${x},${h},${z}`)) farFromMouth++
    }
  }
  ok(regions >= 6 && surfaceRemoved > 0,
    `the notch exists to be bounded (${surfaceRemoved} surface blocks removed across ${regions} regions) — PRECONDITION`)
  ok(farFromMouth === 0,
    `★★ every removed surface block was marked as mouth-notch by the planner (${farFromMouth} of ${surfaceRemoved} were not) — no trench through a hilltop`)
}

// ── 6b. ★★ the no-skylight rule, on ground engineered to break it ──────────────────────────────
{
  // ⚠⚠ §6 ALONE DOES NOT COVER THIS, AND A MUTATION PROVED IT: granting every cell the notch
  // permission SURVIVED, because on the six sampled real-world regions no NON-apron cell happened
  // to sit exactly at its own surface. The rule only bites at one geometry — a throat cell whose
  // ceiling row meets the rising ground PAST `apronSteps` — and a sampled fixture will not contain
  // it reliably. So build ground that must: a 3-in-4 slope puts the passage's top row level with
  // the surface at step 4, exactly one step outside the notch. Periodic, so it stays in range.
  const gentle = (x: number, _z: number) => 160 - Math.floor(((((x % 96) + 96) % 96) * 3) / 4)

  // Scan for a chunk this surface actually takes a den in. Which chunk that is depends on the real
  // land dial (`denStartsAt` reads it), so it is found rather than assumed.
  let site: { cx: number; cz: number } | null = null
  for (let cz = 0; cz < 40 && !site; cz++) for (let cx = 0; cx < 40 && !site; cx++) {
    if (denStartsAt(SEED, cx, cz, SIZE).some(st => denAt(st, SEED, gentle, SEA))) site = { cx, cz }
  }
  ok(site !== null, 'the gentle-slope fixture finds a chunk that takes a den — PRECONDITION')

  if (site) {
    const N = 3, cx0 = site.cx - 1, cz0 = site.cz - 1
    const permitted = new Set<string>()
    let discriminating = 0
    const rad = denScanRadius(SIZE)
    for (let cz = cz0 - rad; cz < cz0 + N + rad; cz++) for (let cx = cx0 - rad; cx < cx0 + N + rad; cx++) {
      for (const st of denStartsAt(SEED, cx, cz, SIZE)) {
        const pl = denAt(st, SEED, gentle, SEA)
        if (!pl) continue
        for (const c of denCells(pl)) {
          if (c.apron) permitted.add(`${c.x},${c.y},${c.z}`)
          else if (c.y >= gentle(c.x, c.z)) discriminating++
        }
      }
    }
    ok(discriminating > 0,
      `★★ …and it CONTAINS the case the rule is about (${discriminating} non-apron cells sit at or above their surface) — PRECONDITION`)

    const R = buildRegion(cx0, cz0, N, gentle)
    R.dig()
    let breached = 0
    for (let z = cz0 * SIZE; z < (cz0 + N) * SIZE; z++) for (let x = cx0 * SIZE; x < (cx0 + N) * SIZE; x++) {
      const h = gentle(x, z)
      if (h < 0 || h >= STACKS * SIZE) continue
      if (R.get(x, h, z) === AIR && !permitted.has(`${x},${h},${z}`)) breached++
    }
    ok(breached === 0,
      `★★★ away from the notch, a den never removes the block a keeper stands on (${breached} breaches)`)
  }
}

// ── 7. what a den refuses to eat ────────────────────────────────────────────────────────────────
{
  const mk = () => Array.from({ length: STACKS }, () => new Section(SIZE)) as (Section | null)[]
  // ⚠ A TRIANGLE WAVE, NOT A LINE. A straight ramp leaves the world: at chunk -20 a 1:1 slope puts
  // the surface at y 440 in a 256-tall stack, every cell out of range, and `digDens` returns 0 —
  // which reads exactly like a den that refuses to dig. The first version of this fixture did that
  // and took three asserts down with it. Period 64, slope ±1: real banks, always in range.
  const ramp = (x: number, _z: number) => 120 + Math.abs((((x % 64) + 64) % 64) - 32)
  const fill = (secs: (Section | null)[], ox: number, m: (y: number) => number) => {
    for (let s = 0; s < STACKS; s++) for (let y = 0; y < SIZE; y++) for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
      const wy = s * SIZE + y
      if (wy <= ramp(ox + x, 0)) secs[s]!.set(x, y, z, m(wy))   // ox+x is the world x the digger sees
    }
  }
  const count = (secs: (Section | null)[], f: (m: number) => boolean) => {
    let n = 0
    for (const s of secs) if (s) for (const v of s.data) if (f(v)) n++
    return n
  }

  // Pick an origin where this ramp really is dug, so every refusal below is exercised.
  let ox = 0, oz = 0, opened = 0
  for (let cx = -20; cx <= 20 && !opened; cx++) for (let cz = -20; cz <= 20 && !opened; cz++) {
    const probe = mk(); fill(probe, cx * SIZE, () => MAT.STONE)
    const n = digDens(probe, cx * SIZE, 0, cz * SIZE, SIZE, SEED, ramp, SEA)
    if (n > 20) { ox = cx * SIZE; oz = cz * SIZE; opened = n }
  }
  ok(opened > 20, `★ the refusal fixture actually contains a den (${opened} cells dug) — PRECONDITION`)

  for (const [name, mat, pred] of [
    ['ore', ORE_SAMPLE(), isSeam],
    ['a log', LOG_SAMPLE(), isLogMat],
    ['a leaf', LEAF_SAMPLE(), isLeafMat],
  ] as [string, number, (m: number) => boolean][]) {
    const w = mk(); fill(w, ox, () => mat)
    const before = count(w, pred)
    digDens(w, ox, 0, oz, SIZE, SEED, ramp, SEA)
    ok(before > 0 && count(w, pred) === before,
      `★ a den never eats ${name} (${before} → ${count(w, pred)})`)
  }

  // …and the refusals are SELECTIVE, not total: ordinary ground must be removed, or the three
  // asserts above are satisfied by a den that digs nothing at all.
  const soil = mk(); fill(soil, ox, () => MAT.STONE)
  const solidBefore = count(soil, m => m !== AIR)
  digDens(soil, ox, 0, oz, SIZE, SEED, ramp, SEA)
  ok(count(soil, m => m !== AIR) < solidBefore,
    `★★ …and a den DOES remove ordinary ground (${solidBefore} → ${count(soil, m => m !== AIR)}) — the refusal is selective, not total`)
}
/** A real ore id, taken from the real placer. ⚠ It needs STONE to replace — an empty section
 *  yields no ore at all, and the refusal assert then passes on a fixture containing none. */
function ORE_SAMPLE(): number {
  const sec = new Section(SIZE)
  sec.data.fill(MAT.STONE)
  const secs = [sec] as (Section | null)[]
  placeSeams(secs, 0, 0, 0, SIZE, SEED, 'post')
  for (const s of secs) if (s) for (const v of s.data) if (isSeam(v)) return v
  throw new Error('ORE_SAMPLE found no ore — the fixture, not the feature, is broken')
}
function LOG_SAMPLE(): number { for (let m = 1; m < 4096; m++) if (isLogMat(m)) return m; return MAT.STONE }
function LEAF_SAMPLE(): number { for (let m = 1; m < 4096; m++) if (isLeafMat(m)) return m; return MAT.STONE }

// ── 8. a hold is never holed, and nothing drowns ────────────────────────────────────────────────
{
  let inHold = 0, checked = 0
  for (const h of HOLDS) {
    const c0x = Math.floor((h.x - 40) / SIZE), c0z = Math.floor((h.z - 40) / SIZE)
    for (let cz = c0z; cz < c0z + 6; cz++) for (let cx = c0x; cx < c0x + 6; cx++) {
      for (const st of denStartsAt(SEED, cx, cz, SIZE)) {
        checked++
        const p = denAt(st, SEED, realSurface, SEA)
        if (p && Math.abs(st.x - h.x) <= h.half && Math.abs(st.z - h.z) <= h.half) inHold++
      }
    }
  }
  ok(checked > 50, `the hold fixture sees real attempts (${checked}) — PRECONDITION`)
  ok(inHold === 0, `★ no den is dug inside a hold on the real heightfield (${inHold})`)

  // ⚠⚠ AND THAT ASSERT ALONE IS VACUOUS, WHICH A MUTATION PROVED. Deleting the hold guard entirely
  // left it green: `height.ts` flattens a hold's pad, a flat pad has no bank, and the bank rule
  // refuses the den before the hold rule is ever consulted. So the guard read as tested while being
  // untestable — decoration with a comment on it. The claim has to be made where it can fail: the
  // SAME geometry, on a surface that does have a bank, inside a hold and outside one.
  // A clean 1:1 bank falling away from the anchor, clamped so the chamber's roof stays in range.
  // ⚠ The anchor must sit ON the slope, not in a trough: the first fixture put it at a periodic
  // minimum, where steepest descent is zero, so BOTH sides refused and the precondition failed.
  const bank = (origin: number) => (x: number, _z: number) =>
    140 - Math.max(-30, Math.min(30, x - origin))
  const h0 = HOLDS[0]
  const inside = denAt({ x: h0.x, z: h0.z, seed: 0x5151, chamberR: 2.6, throatExtra: CFG.throatExtraMin },
    SEED, bank(h0.x), SEA)
  const outside = denAt({ x: h0.x + 4000, z: h0.z, seed: 0x5151, chamberR: 2.6, throatExtra: CFG.throatExtraMin },
    SEED, bank(h0.x + 4000), SEA)
  ok(outside !== null, `★ the hold fixture digs the identical den 4000 blocks away — PRECONDITION`)
  ok(inside === null, `★★ …and refuses it inside the hold — Brack's curtain keeps its ground`)

  // ⚠⚠ THE ANCHOR MUST STAND ABOVE THE WATERLINE AND THE MOUTH BELOW IT, OR THIS TESTS THE WRONG
  // GUARD. The first fixture put the whole bank under water, so `denAt`'s FIRST check (`hUp <
  // seaLevel`) refused it and the mouth check was never reached — deleting the mouth check left the
  // assert green. Two guards, one fixture, and the fixture only ever exercised the first: the
  // "fixed on one branch reads as fixed" trap, in a test rather than in a query.
  const shore = (x: number, _z: number) => 60 - x * 4     // 60 at the anchor, 44 at the mouth
  const drowned = denAt({ x: 0, z: 0, seed: 7, chamberR: 2.5, throatExtra: CFG.throatExtraMin }, SEED, shore, 50)
  ok(drowned === null, '★★ a bank standing above water whose MOUTH falls below it is refused — a drowned hole is invisible mass')
  const dry = denAt({ x: 0, z: 0, seed: 7, chamberR: 2.5, throatExtra: CFG.throatExtraMin }, SEED, shore, 20)
  ok(dry !== null, '★ …and the identical bank with the waterline lowered IS dug — the gate is not vacuous')
}

// ── 9. ★★ SEAM: the chamber warp is hashed on its own centre, so alignments agree ───────────────
{
  // Same voxel, computed from two different chunk origins. The warp must not shift by one block.
  let disagree = 0, sampled = 0
  for (let i = -200; i <= 200; i += 7) for (let j = -3; j <= 3; j++) {
    const a = denWarp(i, j, i + 5, 0x9911, CFG.warp)
    const b = denWarp(i, j, i + 5, 0x9911, CFG.warp)
    sampled++
    if (a !== b) disagree++
  }
  ok(sampled > 100 && disagree === 0, `denWarp is a pure function of the offset (${disagree}/${sampled} disagreed)`)

  // The real assert: dig the SAME den from two regions offset by one chunk and compare the overlap.
  const site = sites[0]
  if (site) {
    const A = buildRegion(site.cx, site.cz, 5); A.dig()
    const B = buildRegion(site.cx - 1, site.cz - 1, 5); B.dig()
    let compared = 0, differ = 0
    const lox = Math.max(site.cx, site.cx - 1) * SIZE, hix = Math.min(site.cx + 5, site.cx + 4) * SIZE
    const loz = Math.max(site.cz, site.cz - 1) * SIZE, hiz = Math.min(site.cz + 5, site.cz + 4) * SIZE
    for (let z = loz; z < hiz; z++) for (let x = lox; x < hix; x++) {
      for (let y = Math.max(0, realSurface(x, z) - 20); y <= realSurface(x, z); y++) {
        const a = A.get(x, y, z), b = B.get(x, y, z)
        if (a === -1 || b === -1) continue
        compared++
        if ((a === AIR) !== (b === AIR)) differ++
      }
    }
    ok(compared > 1000, `the seam fixture compares real overlap (${compared} voxels) — PRECONDITION`)
    ok(differ === 0, `★★ two chunk alignments dig the identical den (${differ}/${compared} voxels disagreed)`)
  }
}

// ── 10. the realised rate, per land — the table the config's doc points at ──────────────────────
{
  const R = 55
  const chunks: Record<string, number> = {}, dens: Record<string, number> = {}
  for (const id of LAND_IDS) { chunks[id] = 0; dens[id] = 0 }
  for (let cz = -R; cz <= R; cz++) for (let cx = -R; cx <= R; cx++) {
    const id = dominantLand(landMix(cx * SIZE + SIZE / 2, cz * SIZE + SIZE / 2, SEED)).id
    chunks[id]++
    for (const st of denStartsAt(SEED, cx, cz, SIZE)) if (denAt(st, SEED, realSurface, SEA)) dens[id]++
  }
  const line = LAND_IDS.map(id => `${id} 1/${dens[id] ? Math.round(chunks[id] / dens[id]) : '∞'}`).join(' · ')
  console.log(`   realised dens, chunks per den: ${line}`)

  // ★ A RATIO, NOT A FLOOR — the absolute number is a look call and the suite must not pin it.
  // What IS asserted is the ORDER the table asserts: green country digs, bare rock barely does,
  // and marsh does not. That is the statement a reader of DEN_DRESS is entitled to rely on.
  const rate = (id: LandId) => dens[id] / Math.max(1, chunks[id])
  ok(rate('meadow') > 0, `★ meadow carries dens — canon's grassland colonies (1 per ${Math.round(chunks.meadow / Math.max(1, dens.meadow))} chunks)`)
  ok(rate('woodland') > 0, '★ woodland carries dens — canon\'s forest undergrowth')
  ok(rate('marsh') < rate('meadow') * 0.4, `★ marsh digs far less than meadow (${rate('marsh').toFixed(4)} vs ${rate('meadow').toFixed(4)})`)
  ok(rate('crag') < rate('meadow'), '★ bare rock digs less than open green country')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the bank has a mouth in it — ${pass} passed. Now go LOOK at one (:3200 /shimmer/voxel3d)`)
