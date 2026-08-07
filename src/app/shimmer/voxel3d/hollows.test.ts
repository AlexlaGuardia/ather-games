// Hollows oracle. Run: npx tsx src/app/shimmer/voxel3d/hollows.test.ts
//
// The one assert that is CANON, not tuning: a Hollow may never body on healthy ground — grey is
// drain, darkness is only the condition, and "spawns where it's dark" is the 2026-06-16 failure
// the ruling names explicitly. The rest pins behaviour a playtest would misread as vibes: the
// drift is slower than a runner, the gun can actually hit one, dawn always wins.

import { hollowEligible, hollowStep, segmentDist, hollowCap, packSize, packWalk, hollowNight,
         HOLLOW_SPEED, HOLLOW_HOVER, PACK_MAX, PACK_STEP, NIGHT_SKY_MAX, GUTTER_SKY,
         type HollowState } from './hollows'
import { greyness } from '../voxel/biome'
import { columnHeight } from '../voxel/height'
import { packLight } from '../voxel/light'
import { RUN_SPEED } from './locomotion'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337

// ── 1. ★ the canon predicate: drained + dark + dry, all three, no exceptions ────────────────────
// "Dark" is the light field's word now: an open surface spot is packLight(sky 15, block 0), and
// the day factor decides what that sky is worth. Block light is an ABSOLUTE veto — the lantern.
{
  const openNight = packLight(15, 0)
  let healthy = 0, greyN = 0, dayVeto = 0, wetVeto = 0, litVeto = 0, duskMismatch = 0
  for (let i = 0; i < 40000; i++) {
    const x = (i * 613) % 8000 - 4000, z = (i * 227) % 8000 - 4000
    const h = columnHeight(x, z, SEED)
    const elig = hollowEligible(x, z, SEED, openNight, 0, h, 140)
    if (elig) {
      greyN++
      if (greyness(x, z, SEED) < 0.5) healthy++                          // the forbidden case
    }
    if (hollowEligible(x, z, SEED, openNight, 1, h, 140)) dayVeto++       // noon vetoes everywhere
    if (hollowEligible(x, z, SEED, openNight, 0.5, h, 140)) dayVeto++     // 15·0.5 = 7.5 > 7: still day
    if (hollowEligible(x, z, SEED, openNight, 0, 139, 140)) wetVeto++     // water vetoes everywhere
    // ★ the strategy layer: ONE point of block light — a lantern's far rim — vetoes at midnight.
    if (hollowEligible(x, z, SEED, packLight(15, 1), 0, h, 140)) litVeto++
    // ★ MC 1.18's internal-sky rule: deep dusk (15·0.4 = 6 ≤ 7) is already the tide's hour.
    if (hollowEligible(x, z, SEED, openNight, 0.4, h, 140) !== elig) duskMismatch++
  }
  ok(greyN > 50, `eligible ground exists at night (${greyN})`)
  ok(healthy === 0, `★ a Hollow NEVER bodies on healthy ground (${healthy} violations — this is canon, not tuning)`)
  ok(dayVeto === 0, `daylight vetoes everywhere (${dayVeto})`)
  ok(wetVeto === 0, `water vetoes everywhere (${wetVeto})`)
  ok(litVeto === 0, `★ tended light holds grey off — block light 1 vetoes at midnight (${litVeto})`)
  ok(duskMismatch === 0, `deep dusk spawns exactly where midnight does (${duskMismatch})`)
  ok(hollowNight(0.4) && !hollowNight(0.5), 'the night window opens at 15·day ≤ 7, MC verbatim')
  ok(GUTTER_SKY > NIGHT_SKY_MAX, 'gutter sits above the spawn line — hysteresis, no dusk flap')
}

// ── 1b. the cycle's tuning: cap scales with loaded world, packs are 1–4 on a triangular walk ────
{
  ok(hollowCap(0) === 2, 'an empty load still allows a pair (floor)')
  ok(hollowCap(113) === 11, `a full load radius carries 11 (${hollowCap(113)}) — MC would carry 27`)
  ok(hollowCap(1e6) === 12, 'the cap never becomes a horde (ceiling)')
  let mono = true
  for (let c = 1; c < 400; c++) if (hollowCap(c) < hollowCap(c - 1)) mono = false
  ok(mono, 'more loaded world never means fewer Hollows allowed')
  ok(packSize(0) === 1 && packSize(0.999) === PACK_MAX, 'pack size spans 1..PACK_MAX')
  let rollsOk = true
  for (let i = 0; i < 100; i++) { const s = packSize(i / 100); if (s < 1 || s > PACK_MAX) rollsOk = false }
  ok(rollsOk, 'every roll lands in 1..PACK_MAX')
  let r = 0.17
  const rand = () => { r = (r * 9301 + 0.2113) % 1; return r }
  const offs = packWalk(PACK_MAX, rand)
  ok(offs.length === PACK_MAX - 1, 'the anchor is not an offset — k-1 mates')
  // The walk accumulates ±PACK_STEP triangular steps: mate i is bounded by i steps.
  ok(offs.every((o, i) => Math.hypot(o.dx, o.dz) <= (i + 1) * PACK_STEP * Math.SQRT2 + 1e-9),
    'the walk is bounded by its steps')
  // Triangular concentrates: over many packs, the mean first-step distance sits well under the max.
  let sum = 0, n = 0
  for (let i = 0; i < 400; i++) { const w = packWalk(2, rand); sum += Math.hypot(w[0].dx, w[0].dz); n++ }
  ok(sum / n < PACK_STEP, `mates huddle near the anchor (mean first step ${(sum / n).toFixed(2)} < ${PACK_STEP})`)
}

// ── 2. the drift: toward the keeper, slower than a runner, riding the ground line ───────────────
{
  const st: HollowState = { x: 0, y: 10, z: 0, hp: 30, gutter: 0, phase: 0 }
  const flat = (_x: number, _z: number) => 8
  const before = Math.hypot(20 - st.x, 15 - st.z)
  for (let i = 0; i < 60; i++) hollowStep(st, 1 / 60, 20, 15, flat, i / 60)
  const after = Math.hypot(20 - st.x, 15 - st.z)
  ok(after < before, 'the Hollow closes distance')
  ok(before - after <= HOLLOW_SPEED * 1.05, `it drifts at its speed, not faster (${(before - after).toFixed(2)} in 1s)`)
  ok(RUN_SPEED > HOLLOW_SPEED, `running away always works (run ${RUN_SPEED} > hollow ${HOLLOW_SPEED})`)
  ok(Math.abs(st.y - (8 + 1 + HOLLOW_HOVER)) < 0.6, 'it rides the ground line at hover height')
  const stG: HollowState = { x: 0, y: 10, z: 0, hp: 30, gutter: 0.9, phase: 0 }
  const b2 = stG.x
  hollowStep(stG, 1 / 60, 100, 0, flat, 0)
  ok(stG.x - b2 < HOLLOW_SPEED / 60 * 0.2, 'a guttering Hollow loses its will first')
}

// ── 3. the gun can actually hit one ─────────────────────────────────────────────────────────────
{
  ok(segmentDist(0, 0, 0, 1, 0, 0, 10, 5, 0.5, 0) < 0.6, 'a round passing close registers')
  ok(segmentDist(0, 0, 0, 1, 0, 0, 10, 20, 0, 0) > 9, 'a body beyond the segment does not')
  ok(segmentDist(0, 0, 0, 1, 0, 0, 0.9, 5, 0, 0) > 4, 'a short segment cannot hit a distant body — no tunnelling in reverse')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the dark has a body, and it obeys the ruling — ${pass} passed`)
