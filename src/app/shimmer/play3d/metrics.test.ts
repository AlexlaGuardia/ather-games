// Map-metrics oracle — the derivations, and the drift guard that keeps them true.
// Run: npx tsx src/app/shimmer/play3d/metrics.test.ts
//
// Two jobs, and the second is the reason the file exists at all.
//
// (1) THE MATHS. Cheap to assert, and each tier is a number a map gets authored against — a
//     wrong one is not a crash, it is a street that plays badly for a month.
//
// (2) THE DRIFT GUARD. The movement kit exists in THREE places now: `Shimmer3D.tsx` (module-local
//     consts, where Alex tuned them), `voxel3d/locomotion.ts` (a copy, by its own admission), and
//     `metrics.ts` (this lineage, importable). Canon lists movement feel as UNIFIED across the
//     Ather/Athernyx seam, so the copies agreeing is law. A silent drift would not break a test
//     anywhere else in the repo: the Ather would simply start jumping differently from the mortal
//     world, and every authored height on the continuous side would quietly stop matching the
//     verb it was drawn for. So both copies get read and compared, at their source.
//
//     FALL_OFF is the ONE knowingly divergent constant (0.32 play3d / 0.55 voxel, for half-block
//     terrain that only exists in the Ather). It is asserted DIVERGENT rather than skipped — if
//     someone unifies it, this test says so instead of shrugging.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as LOCO from '../voxel3d/locomotion'
import {
  KIT, BODY, BODIES, coverTiersFor,
  AIRTIME, JUMP_APEX, gapAt, GAP_RUN, GAP_SLIDEHOP, GAP_CAP, SLIDE_RUN,
  STEP_FLOW, LEDGE_VAULT, LEDGE_MANTLE, LEDGE_CLIMB,
  COVER_SLIDE, COVER_STAND, COVER_FULL,
  BODY_D, PASS_MIN, LANE_SINGLE, LANE_PAIR, LANE_STREET,
  readsAs, snapHeight,
} from './metrics'

let pass = 0
const fails: string[] = []

function ok(label: string, cond: boolean) {
  if (cond) pass++
  else fails.push(label)
}
function near(label: string, got: number, want: number, tol = 1e-9) {
  ok(`${label} (got ${got}, want ${want})`, Math.abs(got - want) <= tol)
}

// ── (1) BALLISTICS ───────────────────────────────────────────────────────────────────────────
near('airtime = 2v0/g', AIRTIME, (2 * 7.4) / 22)
near('apex = v0^2/2g', JUMP_APEX, (7.4 * 7.4) / 44)
ok('apex clears a 1-block step', JUMP_APEX > LEDGE_VAULT)
ok('apex is ~1.24, not 2 (a tap is not a double-jump)', JUMP_APEX > 1.2 && JUMP_APEX < 1.3)

near('gapAt(run) = GAP_RUN', gapAt(KIT.RUN_SPEED), GAP_RUN)
ok('gapAt clamps to the speed cap', gapAt(999) === gapAt(KIT.SPEED_CAP))
ok('gap tiers are strictly ordered', GAP_RUN < GAP_SLIDEHOP && GAP_SLIDEHOP < GAP_CAP)
ok('the slide-hop band is worth authoring (>1.5 blocks wide)', GAP_SLIDEHOP - GAP_RUN > 1.5)
near('slide covers speed x time', SLIDE_RUN, 10 * 0.6)

// ── (1) LEDGE + SIGHT TIERS ──────────────────────────────────────────────────────────────────
ok('ledge tiers are strictly ordered',
  STEP_FLOW < LEDGE_VAULT && LEDGE_VAULT < LEDGE_MANTLE && LEDGE_MANTLE < LEDGE_CLIMB)
near('mantle top = apex + reach', LEDGE_MANTLE, JUMP_APEX + 1.4)
near('climb top = apex + rise + reach', LEDGE_CLIMB, JUMP_APEX + 2.5 + 1.4)
ok('climbing buys real height over a plain mantle', LEDGE_CLIMB - LEDGE_MANTLE >= 2)

// Seam-safe, true for either mannequin: a wall you can vault never blocks a standing line, and
// the three cover tiers stay ordered. If tuning ever inverts either, arenas stop reading.
ok('cover tiers are ordered', COVER_SLIDE < COVER_STAND && COVER_STAND < COVER_FULL)
ok('a vaultable wall never blocks a standing line', LEDGE_VAULT < COVER_STAND)
ok('full cover blocks a standing line', COVER_FULL > COVER_STAND)

// ★ THE PIVOT PIECE, ASSERTED PER BODY. A 1-block wall is the unit a street is built from, and
// which side of the SLIDING eye it lands on decides whether sliding behind it hides you. The two
// mannequins genuinely disagree, so both reads are pinned here: flipping BODY changes the
// character of every one-block wall in every map, and this is where that shows up as a diff.
ok('voxel body: a 1-block wall does NOT hide a slider (eye 1.02 clears it)',
  LEDGE_VAULT < BODIES.voxel.eyeSlide)
ok('play3d body: a 1-block wall DOES hide a slider (classic waist-high)',
  LEDGE_VAULT > BODIES.play3d.eyeSlide)
ok('slide-cover for the chosen body starts just above a block',
  coverTiersFor(BODY).slide === BODY.eyeSlide)

// ── (1) WIDTHS ───────────────────────────────────────────────────────────────────────────────
near('body diameter tracks the chosen mannequin', BODY_D, 2 * BODY.radius)
ok('minimum pass clears the body', PASS_MIN > BODY_D)
ok('lanes are ordered', PASS_MIN < LANE_SINGLE && LANE_SINGLE < LANE_PAIR && LANE_PAIR < LANE_STREET)
// Single-file means exactly that: two bodies abreast do not fit with any clearance to spare.
ok('a single lane cannot pass two bodies comfortably', LANE_SINGLE < 2 * PASS_MIN)
ok('a pair lane can', LANE_PAIR >= 2 * PASS_MIN)

// ── (1) THE CLASSIFIER ───────────────────────────────────────────────────────────────────────
ok('a kerb inside the step band flows', readsAs(0.3) === 'flow')
ok('0.4 is the dead band', readsAs(0.4) === 'ambiguous')
ok('0.8 doorstep is the dead band', readsAs(0.8) === 'ambiguous')
ok('exactly 1 block is a vault', readsAs(1.0) === 'vault')
ok('a crate is a mantle', readsAs(2.5) === 'mantle')
ok('a tall face is a climb', readsAs(4) === 'climb')
ok('past one grip is a wall', readsAs(6) === 'wall')
ok('the tier boundaries are inclusive-below', readsAs(STEP_FLOW) === 'flow')

// ★ MUTATION-CHECKED: the dead band must be REACHABLE by the classifier. If STEP_FLOW ever rises
// to meet LEDGE_VAULT the band closes and every 'ambiguous' assert above passes vacuously by
// becoming 'flow' — so assert the band has width, not just that a sample lands in it.
ok('the dead band is non-empty', LEDGE_VAULT - STEP_FLOW > 0.5)

ok('snap sends a doorstep to a real tier', readsAs(snapHeight(0.8)) !== 'ambiguous')
ok('snap sends a kerb to a real tier', readsAs(snapHeight(0.45)) !== 'ambiguous')
ok('snap is identity on a tier', snapHeight(LEDGE_VAULT) === LEDGE_VAULT)

// ── (2) DRIFT GUARD — vs voxel3d/locomotion.ts ───────────────────────────────────────────────
const DIVERGENT: Record<string, string> = {
  FALL_OFF: 'voxel widened the step band to 0.55 for half-blocks; play3d resolves tile tiers',
}

let comparedLoco = 0
for (const [name, value] of Object.entries(KIT)) {
  const theirs = (LOCO as Record<string, unknown>)[name]
  if (typeof theirs !== 'number') continue   // locomotion does not export the camera/body values
  comparedLoco++
  if (DIVERGENT[name]) {
    ok(`${name} is still knowingly divergent from locomotion (${DIVERGENT[name]})`, theirs !== value)
  } else {
    ok(`${name} matches locomotion.ts (${value} vs ${theirs})`, theirs === value)
  }
}
ok(`compared a real number of constants against locomotion (${comparedLoco})`, comparedLoco >= 9)

// ── (2) DRIFT GUARD — vs the tuned original in Shimmer3D.tsx ─────────────────────────────────
// Source-parsed because they are module-local consts inside a client component: it cannot be
// imported here, and making it importable is a live-file refactor this test should not require.
const SRC = readFileSync(join(import.meta.dirname, 'Shimmer3D.tsx'), 'utf8')

let comparedSrc = 0
for (const [name, value] of Object.entries(KIT)) {
  const m = SRC.match(new RegExp(`^const ${name}\\s*=\\s*(-?[0-9.]+)`, 'm'))
  // ★ A MISSING CONST IS A FAILURE, NOT A SKIP. A renamed or relocated constant would otherwise
  // silently drop out of the guard and leave the derivation unprotected while the suite stays green.
  if (!m) { fails.push(`${name} not found in Shimmer3D.tsx — guard lost its subject`); continue }
  comparedSrc++
  ok(`${name} matches Shimmer3D.tsx (${value} vs ${m[1]})`, Number(m[1]) === value)
}
ok(`every KIT constant was located in Shimmer3D.tsx (${comparedSrc}/${Object.keys(KIT).length})`,
  comparedSrc === Object.keys(KIT).length)

// ── (2) DRIFT GUARD — THE MANNEQUINS ─────────────────────────────────────────────────────────
// This is the guard that earned the file. On its first run it failed on EYE_SLIDE and turned up a
// real cross-seam divergence: the two walkers share every verb and disagree on the body. Both
// mannequins are pinned to their source so neither can move unnoticed, because cover heights are
// derived from them and a map authored against a stale eye is wrong everywhere at once.
const srcNum = (name: string): number | null => {
  const m = SRC.match(new RegExp(`^const ${name}\\s*=\\s*(-?[0-9.]+)`, 'm'))
  return m ? Number(m[1]) : null
}

ok(`voxel eyeStand matches locomotion EYE_STAND (${BODIES.voxel.eyeStand} vs ${LOCO.EYE_STAND})`,
  LOCO.EYE_STAND === BODIES.voxel.eyeStand)
ok(`voxel eyeSlide matches locomotion EYE_SLIDE (${BODIES.voxel.eyeSlide} vs ${LOCO.EYE_SLIDE})`,
  LOCO.EYE_SLIDE === BODIES.voxel.eyeSlide)
ok(`voxel radius matches locomotion BODY_R (${BODIES.voxel.radius} vs ${LOCO.BODY_R})`,
  LOCO.BODY_R === BODIES.voxel.radius)

ok(`play3d eyeStand matches Shimmer3D EYE_H (${BODIES.play3d.eyeStand} vs ${srcNum('EYE_H')})`,
  srcNum('EYE_H') === BODIES.play3d.eyeStand)
ok(`play3d eyeSlide matches Shimmer3D EYE_SLIDE (${BODIES.play3d.eyeSlide} vs ${srcNum('EYE_SLIDE')})`,
  srcNum('EYE_SLIDE') === BODIES.play3d.eyeSlide)
ok(`play3d radius matches Shimmer3D PLAYER_R (${BODIES.play3d.radius} vs ${srcNum('PLAYER_R')})`,
  srcNum('PLAYER_R') === BODIES.play3d.radius)

// ★ Asserted DIVERGENT, deliberately. Canon lists camera and movement feel as unified across the
// seam, so this divergence is a real open question — not a fact to enshrine. If someone unifies
// the mannequins, this fails and sends whoever did it back here to re-derive the cover tiers and
// delete the two-body machinery, which is exactly the right outcome.
// `as const` gives these literal types, so a direct !== is a compile error rather than a runtime
// check — read them as plain numbers so the assert survives the day the two values become equal.
const voxelEye: number = BODIES.voxel.eyeStand
const playEye: number = BODIES.play3d.eyeStand
ok('the mannequins still disagree (unify them → re-derive cover, then delete this assert)',
  voxelEye !== playEye)
ok('BODY is one of the two named mannequins',
  (Object.values(BODIES) as { eyeStand: number }[]).some(b => b.eyeStand === BODY.eyeStand))

// ── report ───────────────────────────────────────────────────────────────────────────────────
if (fails.length) {
  console.error(`\n✗ metrics: ${pass} passed, ${fails.length} FAILED`)
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`✓ metrics: ${pass} asserts pass`)
