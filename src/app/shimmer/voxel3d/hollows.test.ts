// Hollows oracle. Run: npx tsx src/app/shimmer/voxel3d/hollows.test.ts
//
// The one assert that is CANON, not tuning: a Hollow may never body on healthy ground — grey is
// drain, darkness is only the condition, and "spawns where it's dark" is the 2026-06-16 failure
// the ruling names explicitly. The rest pins behaviour a playtest would misread as vibes: the
// drift is slower than a runner, the gun can actually hit one, dawn always wins.

import { hollowEligible, hollowStep, segmentDist, HOLLOW_SPEED, HOLLOW_HOVER, NIGHT_BELOW, type HollowState } from './hollows'
import { greyness } from '../voxel/biome'
import { columnHeight } from '../voxel/height'
import { RUN_SPEED } from './locomotion'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337

// ── 1. ★ the canon predicate: drained + dark + dry, all three, no exceptions ────────────────────
{
  let healthy = 0, greyN = 0, dayVeto = 0, wetVeto = 0
  for (let i = 0; i < 40000; i++) {
    const x = (i * 613) % 8000 - 4000, z = (i * 227) % 8000 - 4000
    const h = columnHeight(x, z, SEED)
    const night = 0.05, day = 0.6
    const elig = hollowEligible(x, z, SEED, night, h, 140)
    if (elig) {
      greyN++
      if (greyness(x, z, SEED) < 0.5) healthy++            // the forbidden case
    }
    if (hollowEligible(x, z, SEED, day, h, 140)) dayVeto++  // day must veto everywhere
    if (hollowEligible(x, z, SEED, night, 139, 140)) wetVeto++
  }
  ok(greyN > 50, `eligible ground exists at night (${greyN})`)
  ok(healthy === 0, `★ a Hollow NEVER bodies on healthy ground (${healthy} violations — this is canon, not tuning)`)
  ok(dayVeto === 0, `daylight vetoes everywhere (${dayVeto})`)
  ok(wetVeto === 0, `water vetoes everywhere (${wetVeto})`)
  ok(NIGHT_BELOW < 0.5, 'the night threshold is actually night')
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
