// Mist-patch oracle. Run: npx tsx src/app/shimmer/voxel/mist.test.ts
//
// Every failure mode here is silent in the rendered world. A patch sliced at a cell seam looks like
// terrain. A patch that regenerates differently looks like the save is broken. A patch on drained
// ground looks like a Hollow spawned in a spar ring, which is the 2026-06-16 failure wearing a new
// coat. A memo that returns a stale answer looks like the field is noisy. Each assert pins one.

import {
  DEFAULT_MIST, mistPatchAt, mistAt, mistCellOf, mistPatchesNear, mistReach, mistEdgeMargin,
  clearMistMemo,
} from './mist'
import { greyness } from './biome'
import { columnHeight, poolDepthAt } from './height'
import { zoneAt, ZONE_ANCHORS } from './zones'
import { DEFAULT_DEPTH } from './depth'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const CFG = DEFAULT_MIST

// ── 1. the inequality that makes the ONE-CELL scan sound ────────────────────────────────────────
// mistAt reads its own cell and nothing else. That is only correct while a patch physically cannot
// reach past its cell edge. If a retune ever breaks this, patches get sliced at cell boundaries and
// the symptom reads as a worldgen bug three files away.
{
  ok(mistEdgeMargin(CFG) > mistReach(CFG),
    `a patch can never leave its cell (margin ${mistEdgeMargin(CFG).toFixed(0)} > reach ${mistReach(CFG).toFixed(0)})`)
  ok(CFG.spacing > CFG.separation * 2, 'the jitter span is positive')
  ok(CFG.floorRadius < CFG.radius, 'the spar floor sits inside the mist, not past it')
}

// ── 2. determinism — the same patch forever, and it answers to the seed ─────────────────────────
{
  let found = 0
  let stable = true
  let seedSensitive = false
  for (let cx = -14; cx <= 14; cx++) {
    for (let cz = -14; cz <= 14; cz++) {
      const a = mistPatchAt(SEED, cx, cz, CFG)
      const b = mistPatchAt(SEED, cx, cz, CFG)
      if (JSON.stringify(a) !== JSON.stringify(b)) stable = false
      if (a) {
        found++
        const other = mistPatchAt(SEED + 1, cx, cz, CFG)
        if (!other || other.x !== a.x || other.z !== a.z) seedSensitive = true
      }
    }
  }
  ok(stable, 'a cell answers identically every time it is asked')
  ok(found > 0, `patches exist at all (${found} in the 29x29 cell block around origin)`)
  ok(seedSensitive, 'a different world seed moves them')
}

// ── 3. THE CANON ASSERT — mist is the opposite of a Hollow ──────────────────────────────────────
// Hollows require greyness >= 0.5 (hollows.ts). Patches refuse anything over greyMax. While
// greyMax < 0.5 the two populations are disjoint BY FIELD, with no cross-check in either spawn
// path. This assert is what lets that stay true without anyone remembering it.
{
  ok(CFG.greyMax < 0.5, `greyMax ${CFG.greyMax} sits under the Hollow floor 0.5 — the populations cannot overlap`)
  let onDrained = 0, inPool = 0, inWater = 0, offZone = 0, n = 0
  for (let cx = -20; cx <= 20; cx++) {
    for (let cz = -20; cz <= 20; cz++) {
      const p = mistPatchAt(SEED, cx, cz, CFG)
      if (!p) continue
      n++
      if (greyness(p.x, p.z, SEED) > CFG.greyMax) onDrained++
      if (poolDepthAt(p.x, p.z, SEED) > 0) inPool++
      if (p.floor <= DEFAULT_DEPTH.seaLevel + DEFAULT_DEPTH.beachHeight) inWater++
      const zn = zoneAt(p.x, p.z, SEED)
      if (!zn.zone || zn.zone.mist <= 0 || zn.t < CFG.zoneMin) offZone++
    }
  }
  ok(n > 0, `sampled ${n} patches for the invariants`)
  ok(onDrained === 0, `no patch gathers on drained ground (${onDrained})`)
  ok(inPool === 0, `no patch sits in a hot-spring pool (${inPool})`)
  ok(inWater === 0, `no patch sits in water or on the beach (${inWater})`)
  ok(offZone === 0, `every patch is inside a mist-growing zone's interior (${offZone} strays)`)
}

// ── 4. the floor is level and the heart is a dell ───────────────────────────────────────────────
{
  let bad = 0, notDell = 0, n = 0
  for (let cx = -20; cx <= 20; cx++) {
    for (let cz = -20; cz <= 20; cz++) {
      const p = mistPatchAt(SEED, cx, cz, CFG)
      if (!p) continue
      n++
      let mn = Infinity, mx = -Infinity
      const fr = CFG.floorRadius
      for (let dz = -fr; dz <= fr; dz++) {
        for (let dx = -fr; dx <= fr; dx++) {
          if (dx * dx + dz * dz > fr * fr) continue
          const h = columnHeight(p.x + dx, p.z + dz, SEED)
          if (h < mn) mn = h
          if (h > mx) mx = h
        }
      }
      if (mx - mn > CFG.padSpan) bad++
      let ring = 0
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ring += columnHeight(
          Math.round(p.x + Math.cos(a) * CFG.radius * CFG.ringK),
          Math.round(p.z + Math.sin(a) * CFG.radius * CFG.ringK), SEED)
      }
      if (mn > ring / 8 - CFG.dellDrop) notDell++
    }
  }
  ok(bad === 0, `every spar floor is level within padSpan (${bad} of ${n} too steep)`)
  ok(notDell === 0, `every heart sits below its surroundings — mist pools (${notDell} of ${n} on a rise)`)
}

// ── 5. the field: 1 at the heart, 0 outside, and continuous in between ──────────────────────────
{
  let p = null
  for (let cx = -20; cx <= 20 && !p; cx++) for (let cz = -20; cz <= 20 && !p; cz++) p = mistPatchAt(SEED, cx, cz, CFG)
  if (!p) { fails.push('no patch found to probe the field with'); }
  else {
    const heart = mistAt(p.x, p.z, SEED, CFG)
    ok(heart > 0.6, `the heart is thick (${heart.toFixed(2)} — scaled by zone weight ${p.weight.toFixed(2)})`)
    ok(heart <= p.weight + 1e-9, 'the field never exceeds the zone weight')
    const far = mistAt(p.x + CFG.radius * 2, p.z, SEED, CFG)
    ok(far === 0, `the field is 0 well outside the patch (${far})`)
    // No cliff: walking out must be a fade, not a step. Sample the radial and bound the jump.
    let maxJump = 0
    let prev = heart
    for (let d = 1; d <= CFG.radius * 2; d++) {
      const v = mistAt(p.x + d, p.z, SEED, CFG)
      maxJump = Math.max(maxJump, Math.abs(v - prev))
      prev = v
    }
    ok(maxJump < 0.12, `the edge fades rather than snaps (largest 1-block step ${maxJump.toFixed(3)})`)
  }
}

// ── 6. the memo cannot change an answer ─────────────────────────────────────────────────────────
// mistAt memoises the validated cell. A memo keyed wrong (or not keyed on seed) would return one
// patch's answer for another cell — noise that would look like a broken field, not a broken cache.
{
  // Probe a line that provably crosses a real patch — a line through empty country would let a
  // broken memo pass by agreeing that everything is 0.
  let anchor = null
  for (let cx = -20; cx <= 20 && !anchor; cx++) for (let cz = -20; cz <= 20 && !anchor; cz++) anchor = mistPatchAt(SEED, cx, cz, CFG)
  const probes: { x: number; z: number }[] = []
  if (anchor) for (let i = 0; i < 400; i++) probes.push({ x: anchor.x - 200 + i, z: anchor.z + ((i * 7) % 40) - 20 })
  clearMistMemo()
  const cold = probes.map(q => mistAt(q.x, q.z, SEED, CFG))
  // Interleave two seeds and two distant regions — the pattern most likely to trip a bad key.
  clearMistMemo()
  let mismatch = 0
  for (let i = 0; i < probes.length; i++) {
    mistAt(probes[i].x + 9000, probes[i].z, SEED, CFG)
    mistAt(probes[i].x, probes[i].z, SEED + 7, CFG)
    if (Math.abs(mistAt(probes[i].x, probes[i].z, SEED, CFG) - cold[i]) > 1e-12) mismatch++
  }
  ok(mismatch === 0, `the memo survives interleaved seeds and regions (${mismatch} wrong answers)`)
  ok(cold.some(v => v > 0), 'the probe line actually crossed a patch (otherwise this proves nothing)')
}

// ── 7. mistPatchesNear agrees with the field it is meant to describe ────────────────────────────
{
  let disagree = 0
  for (let i = 0; i < 60; i++) {
    const x = -2600 + i * 37, z = 500 + ((i * 97) % 800)
    const near = mistPatchesNear(x, z, SEED, 600, CFG)
    const inside = near.some(p => Math.hypot(p.x - x, p.z - z) <= CFG.radius * 0.3)
    if (inside && mistAt(x, z, SEED, CFG) === 0) disagree++
  }
  ok(disagree === 0, `standing near a heart always reads as mist (${disagree} disagreements)`)
}

// ── 8. DENSITY — a couple per region, not a trail of them ───────────────────────────────────────
// The number that decides whether the feature reads as rare. Measured per ruled zone, so a retune
// that quietly turns the Meadows into a chain of spar rings fails here rather than in playtest.
{
  const counts = new Map<string, number>()
  for (const a of ZONE_ANCHORS) counts.set(a.id, 0)
  const reach = Math.max(...ZONE_ANCHORS.map(a => Math.max(Math.abs(a.x) + a.rx, Math.abs(a.z) + a.rz)))
  const cells = Math.ceil(reach / (CFG.spacing * 16)) + 2
  for (let cx = -cells; cx <= cells; cx++) {
    for (let cz = -cells; cz <= cells; cz++) {
      const p = mistPatchAt(SEED, cx, cz, CFG)
      if (!p) continue
      const id = zoneAt(p.x, p.z, SEED).zone?.id
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  const line = [...counts].map(([k, v]) => `${k}:${v}`).join(' ')
  const wild = ['spirit-meadow', 'twilight-thicket', 'mana-springs'] as const
  for (const id of wild) {
    const c = counts.get(id) ?? 0
    ok(c >= 1 && c <= 5, `${id} carries ${c} patches (want 1-5) — ${line}`)
  }
  ok((counts.get('gloview-village') ?? 0) === 0, 'the village grows none (mist: 0)')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 12)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the mist pools where it should — ${pass} passed`)
