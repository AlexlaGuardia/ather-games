// Ring 2's WIRING. Run: npx tsx src/app/shimmer/voxel3d/ring-wiring.test.ts
//
// Canon RULED 2026-07-30 that a keeper's spirits are "visible, wandering, underfoot" about the Home
// Plot. `plot-ring.ts` (the rules), `plot-ring-pass.ts` (the THREE shell) and a harness that beat 35
// green asserts all shipped 08-27 — and `createPlotRing` appeared in exactly ONE file, its own dev
// page. The fold was empty the whole time and nothing was red. Third instance of that shape today,
// after the 98 unreachable build pieces and the collar prompt.
//
// ⚠ THIS FILE GUARDS THE TWO ARGUMENTS THE PASS TRUSTS AND CANNOT CHECK:
//   1. SPACE. The pass has no opinion about where it is; ticking it in the Wilds scatters the
//      keeper's own spirits across country they have never been to. Only the host knows.
//   2. YAW. `inView` computes `atan2(z - k.z, x - k.x) - k.yaw`, so the convention is
//      `atan2(forward.z, forward.x)`. Hand it the camera's euler y and the pass does NOT fall over
//      — it places residents a quarter turn off from where the keeper is looking, so bodies pop
//      into view instead of arriving behind you, and the rule reads as broken rather than mis-aimed.

import { readFileSync } from 'node:fs'
import { blockAt, justBefore } from '../testing/guard'
import * as THREE from 'three'
import { inView, ringCap, DEFAULT_RING, type Keeper } from './plot-ring'
import { DEFAULT_PLOT } from '../voxel/plot'
import { restingSpirits, normalizeRoster, MAX_PARTY } from '../engine/spirit-health'
import type { Spirit } from '../spirits/spirit'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

/** The keeper exactly as VoxelWorld builds it: yaw off a real camera's getWorldDirection. */
function keeperFrom(yawDeg: number, x = 0, z = 0): { fwd: THREE.Vector3; k: Keeper } {
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  cam.rotation.order = 'YXZ'
  cam.quaternion.setFromEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(yawDeg), 0, 'YXZ'))
  const f = new THREE.Vector3(); cam.getWorldDirection(f)
  return { fwd: f, k: { x, z, yaw: Math.atan2(f.z, f.x) } }
}

// ── 1. ★★★ "IN FRONT OF ME" MEANS IN FRONT OF ME, AT EVERY HEADING ──────────────────────────────
// Four headings, because "correct at one heading" is exactly how this morning's camera-roll bug
// survived — and the ring's whole placement rule is built on this predicate.
{
  for (const yaw of [0, 45, 90, 180, 270]) {
    const { fwd, k } = keeperFrom(yaw)
    const ahead = { x: fwd.x * 40, z: fwd.z * 40 }
    const behind = { x: -fwd.x * 40, z: -fwd.z * 40 }
    ok(inView(k, ahead.x, ahead.z), `yaw ${yaw}: a spot 40 blocks dead ahead is in view`)
    ok(!inView(k, behind.x, behind.z), `yaw ${yaw}: the same distance directly behind is NOT`)
  }
}

// ── 2. ⚠ THE EULER-Y MISTAKE IS NOT A CRASH — IT IS A QUARTER TURN ──────────────────────────────
// The mutation this file exists for, measured rather than reasoned. A pass fed the wrong yaw keeps
// working and keeps being wrong.
{
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  cam.rotation.order = 'YXZ'
  cam.quaternion.setFromEuler(new THREE.Euler(0, 0, 0, 'YXZ'))
  const f = new THREE.Vector3(); cam.getWorldDirection(f)

  const right: Keeper = { x: 0, z: 0, yaw: Math.atan2(f.z, f.x) }   // what VoxelWorld does
  const wrong: Keeper = { x: 0, z: 0, yaw: cam.rotation.y }         // the tempting mistake

  const ahead = { x: f.x * 40, z: f.z * 40 }
  ok(inView(right, ahead.x, ahead.z), 'with the shipped convention, ahead is in view')
  ok(!inView(wrong, ahead.x, ahead.z),
     '★ with the euler-y mistake the SAME spot reads as OUT of view — so residents would be placed where the keeper is looking')
}

// ── 3. ★★★ RING 2 DRAWS THE WHOLE ROSTER — ALEX RULED IT 2026-08-27 ─────────────────────────────
// ⚠⚠ THIS SECTION USED TO ASSERT THE OPPOSITE, AND THE FLIP IS THE POINT RATHER THAN AN EDIT.
// It shipped for one deploy reading `restingSpirits` (`inParty === false`), which `normalizeRoster`
// only sets past `MAX_PARTY` — so a keeper holding FOUR OR FEWER saw an empty fold, and four is the
// common case. Canon (`shimmer-geography.md`, ruled 07-30) says a keeper's spirits are "visible,
// wandering, underfoot" and does not qualify that with a roster band; resting-vs-party is a COMBAT
// distinction that had no business deciding who is at home.
//
// ★ The old asserts were CORRECT about the old rule and are kept here as the numbers that made the
// case, not deleted — a test that quietly changes its mind teaches nobody why.
{
  const mk = (n: number): Spirit[] =>
    Array.from({ length: n }, (_, i) => ({ id: `s${i}`, species: 'sp', hpFrac: 1 } as unknown as Spirit))
  const resting = (n: number) => { const o = mk(n); normalizeRoster(o, MAX_PARTY); return restingSpirits(o).length }
  const drawn = (n: number) => { const o = mk(n); normalizeRoster(o, MAX_PARTY); return o.length }

  ok(MAX_PARTY === 4, `MAX_PARTY is 4 (${MAX_PARTY}) — the number the old emptiness turned on`)
  ok(resting(4) === 0, 'the retired rule: four spirits leaves NOBODY resting — which is why the fold was empty')
  ok(resting(5) === 1 && resting(7) === 3, 'and only a fifth spirit ever put a body in the yard')

  ok(drawn(0) === 0, 'no spirits: nothing to draw, which is the one empty fold that is honest')
  ok(drawn(1) === 1, '★ one spirit stands in the fold — a keeper is never alone at home again')
  ok(drawn(4) === 4, '★★ FOUR spirits all stand there: the case the retired rule drew as empty')
  ok(drawn(7) === 7, 'and a long roster is handed over whole')

  // ⚠ THE REGRESSION THIS EXISTS TO CATCH IS NOW THE REVERSE OF THE OLD ONE. "Only the resting
  // ones" reads like a tidy optimisation and empties the yard for the commonest keeper there is.
  ok(drawn(4) !== resting(4), 'the party IS part of ring 2 — narrowing to restingSpirits would empty the fold at four')

  // ★ The population ceiling is the PASS's and stays derived from the fold, so handing over a long
  // roster is a statement about who exists here, not about how many bodies draw.
  ok(ringCap({ ...DEFAULT_PLOT }) >= 1, 'the pass caps how many draw, from the fold radius, not from this list')
}

// ── 4. ★★ AND THE WORLD HAS TO MOUNT, TICK AND DROP IT ──────────────────────────────────────────
// Sections 1-3 are green with `createPlotRing` still reachable only from its dev page, which is
// exactly the state this file ends.
{
  const src = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')

  ok(/createPlotRing\(SEED\)/.test(src), 'VoxelWorld builds the ring')
  ok(/<primitive object=\{ring\.group\} \/>/.test(src), 'and puts its one object in the scene')
  ok(/ring\.dispose\(\)/.test(src), 'and drops it on unmount — the pass owns THREE resources')
  ok(/const ring = useMemo\(\(\) => createPlotRing\(SEED\), \[\]\)/.test(src),
     'memoised with empty deps, so a re-render cannot leak a second set of bodies')

  // ⚠⚠ THE SPACE GATE, ANCHORED TO THE TICK ITSELF rather than grepped loose — `space.current ===
  // 'plot'` appears several times in this file, so a bare match is satisfied by being ANYWHERE.
  // That is the trap that got past me earlier today on `/hostile\(e\.f\)/`.
  // ⚠ SLICED BY INDEX, NOT MATCHED BY ONE BIG REGEX. My first version chained the space gate and
  // the call into a single pattern and it silently matched NOTHING — the block is right there and
  // five asserts went red against correct code, which is the worst direction for a guard to fail
  // in. A regex that must span a multi-line call is a parser wearing a disguise; find the anchor,
  // then read a window around it.
  const { at, raw: tickRaw, code: tick } = blockAt(src, 'ring.tick(', '\n      )')
  ok(at > 0, 'the ring is ticked somewhere')
  ok(tickRaw.includes('//'), 'the block does carry prose — so the stripper above is load-bearing, not decorative')
  // The gate is read from the 200 characters BEFORE the call, which is where an `if` guarding it
  // has to live. Anchored, because `space.current === 'plot'` appears several times in this file
  // and a bare match is satisfied by being anywhere — the trap that got past me this morning.
  const before = justBefore(src, at)
  ok(/if \(space\.current === 'plot'\) \{\s*$/.test(before),
     'and the statement immediately guarding it is the plot-space gate')
  ok(/yaw: Math\.atan2\(hollowFwd\.current\.z, hollowFwd\.current\.x\)/.test(tick),
     'the keeper yaw is atan2(forward.z, forward.x), matching plot-ring.ts')
  ok(!/yaw: camera\.rotation\.y/.test(tick), 'and never the camera euler')
  ok(/party\.current\.map\(sp => sp\.id\)/.test(tick), 'the roster handed over is the WHOLE party, per Alex\'s ruling')
  ok(!/restingSpirits\(/.test(tick), 'and not restingSpirits, which drew an empty fold for a keeper with four')
  ok(!/activeSpirits\(/.test(tick), 'and not activeSpirits, which is the other half of the same combat split')
  ok(/withinCap\(x, z, SEED, plotCfg\.current\)/.test(tick), 'ground acceptance asks the LIVE plot config, not a default')
  ok(/groundTopNear\(x, z, hint, 12\)/.test(tick),
     'and the ground probe is the live one, so a resident stands on dug and built ground')
}

console.log(`ring-wiring: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
