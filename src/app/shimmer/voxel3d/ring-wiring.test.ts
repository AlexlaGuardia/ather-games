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
import * as THREE from 'three'
import { inView, DEFAULT_RING, type Keeper } from './plot-ring'
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

// ── 3. ★★ RING 2 IS THE SPIRITS **NOT** IN THE PARTY, AND THAT MEANS AN EMPTY YARD AT FOUR ──────
// Measured, because it is the first thing anyone will read as a broken wiring. `restingSpirits` is
// `inParty === false`, and nothing sets that until `normalizeRoster` trims past `MAX_PARTY`.
{
  const mk = (n: number): Spirit[] =>
    Array.from({ length: n }, (_, i) => ({ id: `s${i}`, species: 'sp', hpFrac: 1 } as unknown as Spirit))
  const drawn = (n: number) => { const o = mk(n); normalizeRoster(o, MAX_PARTY); return restingSpirits(o).length }

  ok(MAX_PARTY === 4, `MAX_PARTY is 4 (${MAX_PARTY}) — the number the emptiness turns on`)
  ok(drawn(0) === 0, 'no spirits: nothing to draw')
  ok(drawn(4) === 0, '★ FOUR spirits: still nothing — a full party has nobody resting, and this is the design, not a fault')
  ok(drawn(5) === 1, 'five: one rests, and the fold has a body in it')
  ok(drawn(7) === 3, 'seven: three rest')
  // ⚠ The cheapest wrong "fix" if someone sees an empty yard and reaches for the whole roster.
  ok(drawn(4) !== 4, 'the party is NOT ring 2 — pointing it at the roster would put your fighters in the yard')
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
  const at = src.indexOf('ring.tick(')
  ok(at > 0, 'the ring is ticked somewhere')
  const tick = at > 0 ? src.slice(at, src.indexOf('\n      )', at) + 8) : ''
  // The gate is read from the 200 characters BEFORE the call, which is where an `if` guarding it
  // has to live. Anchored, because `space.current === 'plot'` appears several times in this file
  // and a bare match is satisfied by being anywhere — the trap that got past me this morning.
  const before = at > 0 ? src.slice(Math.max(0, at - 200), at) : ''
  ok(/if \(space\.current === 'plot'\) \{\s*$/.test(before),
     'and the statement immediately guarding it is the plot-space gate')
  ok(/yaw: Math\.atan2\(hollowFwd\.current\.z, hollowFwd\.current\.x\)/.test(tick),
     'the keeper yaw is atan2(forward.z, forward.x), matching plot-ring.ts')
  ok(!/yaw: camera\.rotation\.y/.test(tick), 'and never the camera euler')
  ok(/restingSpirits\(party\.current\)\.map/.test(tick), 'the roster is restingSpirits, not the whole party')
  ok(!/activeSpirits\(/.test(tick), 'and not activeSpirits, which is the other half of the same split')
  ok(/withinCap\(x, z, SEED, plotCfg\.current\)/.test(tick), 'ground acceptance asks the LIVE plot config, not a default')
  ok(/groundTopNear\(x, z, hint, 12\)/.test(tick),
     'and the ground probe is the live one, so a resident stands on dug and built ground')
}

console.log(`ring-wiring: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
