// Zones oracle. Run: npx tsx src/app/shimmer/voxel/zones.test.ts
//
// The zone layer's claims: every anchor IS its zone at its heart, wild country is genuinely wild,
// each zone carries the character Alex ruled (rolling meadows / dense thicket / benched springs),
// the tended heart starves the grey and the rim feeds it. Layout truth (which zones, which
// neighbours) is canon; every number here is build and the bounds are wide enough to retune.

import { ZONE_ANCHORS, zoneAt, greyAllowance, zoneTreeCeiling } from './zones'
import { columnHeight } from './height'
import { forestness, greyness, biomeAt } from './biome'
import { DEFAULT_DEPTH } from './depth'
import { makeColumn, SECTION } from './column'
import { isLeafMat } from './trees'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337

// ── 1. anchors resolve to themselves; wild country resolves to nothing ──────────────────────────
{
  for (const a of ZONE_ANCHORS) {
    const zn = zoneAt(a.x, a.z, SEED)
    ok(zn.zone?.id === a.id && zn.t > 0.95, `${a.id} owns its own heart (t=${zn.t.toFixed(2)})`)
  }
  ok(zoneAt(0, 4800, SEED).t === 0, 'the far south is wild country')
  ok(zoneAt(-4800, 3800, SEED).t === 0, 'the far corner is wild country')
}

// ── 2. the labels: standing in a zone names the zone ────────────────────────────────────────────
{
  let named = 0
  for (const a of ZONE_ANCHORS) {
    const h = columnHeight(a.x, a.z, SEED)
    if (h <= DEFAULT_DEPTH.seaLevel + 2) continue          // an anchor under a pond names the pond
    if (biomeAt(a.x, a.z, SEED, h, DEFAULT_DEPTH.seaLevel) === a.id) named++
  }
  ok(named >= ZONE_ANCHORS.length - 2, `zone hearts label as their zone (${named}/${ZONE_ANCHORS.length})`)
}

// ── 3. Alex's characters, measured ──────────────────────────────────────────────────────────────
{
  // Spirit Meadows: rolling — adjacent steps stay small, no bench cliffs, across the whole heart.
  let sum = 0, n = 0, big = 0
  for (let dz = -400; dz <= 400; dz += 8) for (let dx = -400; dx <= 400; dx += 8) {
    const x = -2150 + dx, z = 700 + dz
    const h = columnHeight(x, z, SEED)
    const s = Math.abs(columnHeight(x + 1, z, SEED) - h)
    sum += s; n++; if (s >= 3) big++
  }
  ok(sum / n < 0.35, `the Meadows roll gently (mean step ${(sum / n).toFixed(2)})`)
  ok(big / n < 0.004, `no cliff walls inside the Meadows (${big}/${n} sheer steps)`)

  // Sparse trees in the Meadows, closed canopy in the Thicket — the same mask, opposite ends.
  ok(forestness(SEED, -2150 / 16, 700 / 16) < 0.15, 'Meadows: sparse lone trees')
  ok(forestness(SEED, -2000 / 16, -1150 / 16) > 0.9, 'Thicket: closed canopy')
  ok(forestness(SEED, 2100 / 16, -300 / 16) < 0.4, 'Springs: open enough to see the terraces')
}

// ── 4. tended heart, greying rim ────────────────────────────────────────────────────────────────
{
  ok(greyAllowance(0, 0, SEED) < 0.1, 'the Home Plot is fully tended — grey starved at spawn')
  ok(greyAllowance(800, 4600, SEED) > 1.2, 'the deep rim feeds the grey')
  // Greyness inside tended zones is (near) zero even where the richness band says otherwise:
  let greyInZone = 0, sampled = 0
  for (let d = 0; d < 2000; d += 50) {
    for (const a of ZONE_ANCHORS) {
      if (a.tended < 1) continue
      const x = a.x + (d % a.rx) * 0.5, z = a.z + (d % a.rz) * 0.3
      sampled++
      if (greyness(x, z, SEED) > 0.25) greyInZone++
    }
  }
  ok(sampled > 100 && greyInZone === 0, `no tended zone goes grey (${greyInZone}/${sampled})`)
}

// ── 6. THE THICKET IS CLOSED, AND THE CEILING IS A NO-OP EVERYWHERE ELSE ───────────────────────
// Canon (`CANON/game/shimmer-geography.md:1051`) rules twilight-thicket "closed canopy, dim floor,
// a permanent twilight", and places Athowl, Noctyx and Luminara there on that reading. Before
// `treeCeiling` the build could not express it at any setting of `forest`: trunk count is
// `meadow + forestness * (perColumn - meadow)`, so 1.7 was an arithmetic cap of ~26% coverage.
//
// ⚠ THIS ASSERTS THE AFFORDANCE, NOT THE CONSTANT. `treeCeiling === 16` would pass for a world
// where trees stopped generating; what canon rules is that the ROOF IS CLOSED, so the assert reads
// coverage out of the real generator. It is stated as a floor AND the Glade as a ceiling, because
// a bound checked from one side is satisfied by any number past it and stops being a bound.
{
  const cover = (id: string) => {
    const z = ZONE_ANCHORS.find(a => a.id === id)!
    const cx = Math.floor(z.x / SECTION), cz = Math.floor(z.z / SECTION)
    const col = makeColumn(cx * SECTION, cz * SECTION, SEED)
    let n = 0, leafy = 0
    for (let lz = 0; lz < SECTION; lz++) for (let lx = 0; lx < SECTION; lx++) {
      const h = columnHeight(cx * SECTION + lx, cz * SECTION + lz, SEED)
      if (h + 1 >= 255) continue
      n++
      for (let y = h + 1; y < Math.min(256, h + 40); y++) if (isLeafMat(col.get(lx, y, lz))) { leafy++; break }
    }
    return n ? leafy / n : 0
  }
  const thicket = cover('twilight-thicket'), glade = cover('moonwell-glade')
  // Measured 0.958 at sha 4b242fc with treeCeiling 16 (scripts/thicket-close.mts). The floor is set
  // well under that so retuning the density does not need this file edited; what it catches is the
  // roof OPENING again, which is the drift canon rules against.
  ok(thicket >= 0.85, `twilight-thicket canopy is closed (${(100 * thicket).toFixed(1)}%, want >= 85%)`)
  // ⚠ THE NO-OP HALF, AND IT IS THE ONE A FUTURE EDIT IS LIKELIEST TO BREAK. A ceiling applied
  // globally instead of by zone membership would raise the Thicket AND every wood in the world,
  // and the assert above would still pass. Moonwell Glade is `forest 0.35` and measured 27.5%
  // coverage before this knob existed; if it ever reads like a thicket, the blend is wrong.
  ok(glade < 0.45, `the ceiling does not leak into Moonwell Glade (${(100 * glade).toFixed(1)}%, want < 45%)`)
  // ⚠⚠ AND THE COVERAGE ASSERT ABOVE CANNOT SEE THE LEAK IT NAMES. Mutation-swept: replacing
  // `zoneTreeCeiling`'s body with a bare `return 16` — the ceiling applied to the whole world,
  // ignoring membership entirely — passed all 22 asserts, because the Glade's own forestness and
  // treeK keep its coverage under the bound anyway. A downstream statistic is a poor witness for
  // an upstream rule. So the no-op claim is asserted where it is actually MADE:
  ok(zoneTreeCeiling(6000, 6000, SEED, 1.7) === 1.7, 'wild country gets the config default, exactly')
  ok(zoneTreeCeiling(-3000, 4200, SEED, 0.4) === 0.4, 'the default passes through whatever it is')
  {
    const g = ZONE_ANCHORS.find(a => a.id === 'moonwell-glade')!
    ok(zoneTreeCeiling(g.x, g.z, SEED, 1.7) === 1.7, 'a zone with no ceiling of its own is untouched')
    const t = ZONE_ANCHORS.find(a => a.id === 'twilight-thicket')!
    ok(zoneTreeCeiling(t.x, t.z, SEED, 1.7) === t.treeCeiling, 'the Thicket reaches its full ceiling at its heart')
    // eases in rather than stepping — the whole reason it rides membership
    const edge = zoneTreeCeiling(t.x + t.rx, t.z, SEED, 1.7)
    ok(edge > 1.7 && edge < t.treeCeiling!, `the wood thins toward the edge (${edge.toFixed(2)} between 1.7 and ${t.treeCeiling})`)
  }
  ok(thicket > glade * 1.8, `the Thicket is markedly denser than ordinary wood (${(100 * thicket).toFixed(1)}% vs ${(100 * glade).toFixed(1)}%)`)
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 12)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the garden has its places — ${pass} passed`)
