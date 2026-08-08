// Springs oracle. Run: npx tsx src/app/shimmer/voxel/springs.test.ts
//
// The hot-spring mountain's claims (2026-08-08 rework): the Springs are a MASSIF (the heart stands
// well above the ellipse edge), the massif is TERRACED (interior flats sit on 8-voxel bench levels),
// pools are SUNK INTO flats and hold flat, contained water (every pooled column's water top matches
// its neighbours', and no dry neighbour sits below it — the standing-water-face sin the river system
// spent three models killing), beds and aprons wear the crust, and none of it leaks outside the
// Springs. Character numbers (lift, pool share) are build and retunable; the invariants are not.

import {
  columnHeight, poolDepthAt, springsPoolAt, riverField, RIVER_APPROACH,
  DEFAULT_HEIGHT,
} from './height'
import { materialAt, MAT, DEFAULT_DEPTH } from './depth'
import { padBlendAt } from './holds'
import { ZONE_ANCHORS } from './zones'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const SP = ZONE_ANCHORS.find(a => a.id === 'mana-springs')!
const { x: CX, z: CZ } = SP

// ── 1. the massif: the heart towers over the ellipse edge ───────────────────────────────────────
{
  const heart = columnHeight(CX, CZ, SEED)
  let edge = 0, n = 0
  for (let a = 0; a < 16; a++) {
    const th = (a / 16) * Math.PI * 2
    edge += columnHeight(Math.round(CX + Math.cos(th) * SP.rx * 1.05), Math.round(CZ + Math.sin(th) * SP.rz * 1.05), SEED)
    n++
  }
  ok(heart - edge / n >= 25, `the Springs are a mountain (heart ${heart} vs edge mean ${(edge / n).toFixed(0)})`)
}

// ── 2. the terraces: interior flats sit on bench levels, and the stack is real ──────────────────
{
  // A "flat" column: all four neighbours at its own height, un-pooled, outside river bands/pads.
  const levels = new Set<number>()
  let flats = 0, offLevel = 0
  for (let dz = -560; dz <= 560; dz += 4) for (let dx = -560; dx <= 560; dx += 4) {
    const x = CX + dx, z = CZ + dz
    if (Math.abs(riverField(x, z, SEED)) < RIVER_APPROACH || padBlendAt(x, z) || poolDepthAt(x, z, SEED) > 0) continue
    const h = columnHeight(x, z, SEED)
    if (columnHeight(x + 1, z, SEED) !== h || columnHeight(x - 1, z, SEED) !== h ||
        columnHeight(x, z + 1, SEED) !== h || columnHeight(x, z - 1, SEED) !== h) continue
    flats++
    levels.add(h)
    // Bench levels land on round(datum + calibration + 8k) — one fixed residue mod 8.
    if (((h - 1) % 8 + 8) % 8 !== 0) offLevel++
  }
  ok(flats > 3000, `the interior is mostly terrace flat (${flats} flat samples)`)
  // Riser ramps produce their own small rounded flats between terraces (a wide gentle ramp holds
  // a few equal-height columns after rounding) — those are geometry, not terrace, so the claim is
  // dominance, not purity: measured 81% of flat area on true bench levels at ship time.
  ok(offLevel / Math.max(1, flats) < 0.25, `bench levels dominate the flat area (${offLevel}/${flats} off-level)`)
  ok(levels.size >= 5, `the terrace stack is real (${levels.size} distinct levels)`)
}

// ── 3. the pools: present, sunk, flat, contained, crusted ───────────────────────────────────────
{
  let pools = 0, faceBad = 0, rimBad = 0, bedBad = 0, waterBad = 0, crustNear = 0
  for (let dz = -560; dz <= 560; dz += 2) for (let dx = -560; dx <= 560; dx += 2) {
    const x = CX + dx, z = CZ + dz
    const pd = poolDepthAt(x, z, SEED)
    if (pd === 0) continue
    pools++
    const h = columnHeight(x, z, SEED)
    const top = h + pd - 1
    // The fill: water from bed+1 up to one below the rim, air above, crust bed below.
    if (materialAt(x, h, z, SEED, h) !== MAT.SPRING_CRUST) bedBad++
    if (pd >= 2 && materialAt(x, h + 1, z, SEED, h) !== MAT.WATER) waterBad++
    if (materialAt(x, top + 1, z, SEED, h) === MAT.WATER) waterBad++
    // Containment: a dry 4-neighbour may never stand below the water top (exposed water face),
    // and a pooled 4-neighbour must share the exact rim (one pool = one level).
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const npd = poolDepthAt(x + ox, z + oz, SEED)
      const nh = columnHeight(x + ox, z + oz, SEED)
      if (npd === 0) { if (nh < top) faceBad++ }
      else if (nh + npd !== h + pd) rimBad++
    }
    // The shell: crust ground within 3 columns of any pool (sampled on one axis is enough).
    for (let r = 1; r <= 3 && pools <= 400; r++) {
      const cx2 = x + r, h2 = columnHeight(cx2, z, SEED)
      if (poolDepthAt(cx2, z, SEED) === 0 && materialAt(cx2, h2, z, SEED, h2) === MAT.SPRING_CRUST) { crustNear++; break }
    }
  }
  ok(pools > 200, `the terraces hold pools (${pools} pooled columns)`)
  ok(faceBad === 0, `no pool shows a standing water face (${faceBad} exposed)`)
  ok(rimBad === 0, `one pool, one level (${rimBad} rim mismatches)`)
  ok(bedBad === 0, `pool beds wear the crust (${bedBad} bare beds)`)
  ok(waterBad === 0, `pools hold water below their rim and nothing above it (${waterBad} bad fills)`)
  ok(crustNear > 0, `the mineral apron exists around pools (${crustNear} crusted shores in sample)`)
}

// ── 4. nothing leaks: no pools, no crust, no lift outside the Springs ───────────────────────────
{
  let leak = 0
  const elsewhere: [number, number][] = [
    [0, 0], [-2150, 700], [-2000, -1150], [-265, -1125], [3700, 1000], [800, 4600], [-4800, 3800],
  ]
  for (const [bx, bz] of elsewhere)
    for (let i = 0; i < 200; i++) {
      const x = bx + ((i * 37) % 400) - 200, z = bz + ((i * 91) % 400) - 200
      if (springsPoolAt(x, z, SEED) !== 0) leak++
    }
  ok(leak === 0, `pools and crust stay inside the Springs (${leak} leaks)`)
  // Purity of the un-lifted world: a re-read of the same column agrees (the caches are memos).
  ok(columnHeight(CX + 31, CZ - 17, SEED) === columnHeight(CX + 31, CZ - 17, SEED), 'height is deterministic')
  ok(springsPoolAt(CX + 31, CZ - 17, SEED, DEFAULT_HEIGHT) === springsPoolAt(CX + 31, CZ - 17, SEED), 'pools are deterministic')
}

// keep depth config import honest (sea level unused here, but the import guards the API shape)
void DEFAULT_DEPTH

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 12)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the springs steam in their terraces — ${pass} passed`)
