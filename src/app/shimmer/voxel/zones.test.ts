// Zones oracle. Run: npx tsx src/app/shimmer/voxel/zones.test.ts
//
// The zone layer's claims: every anchor IS its zone at its heart, wild country is genuinely wild,
// each zone carries the character Alex ruled (rolling meadows / dense thicket / benched springs),
// the tended heart starves the grey and the rim feeds it. Layout truth (which zones, which
// neighbours) is canon; every number here is build and the bounds are wide enough to retune.

import { ZONE_ANCHORS, zoneAt, greyAllowance } from './zones'
import { columnHeight } from './height'
import { forestness, greyness, biomeAt } from './biome'
import { DEFAULT_DEPTH } from './depth'

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

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 12)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the garden has its places — ${pass} passed`)
