// The recoil oracle. Run: npx tsx src/app/shimmer/voxel3d/recoil.test.ts
//
// This guards Alex's 2026-08-27 bug: *"as they damaged my player it tilted the screen view."* The
// tilt was his own firing, and the cause was a property nobody set — `camera.rotation.order`, left
// at three's default XYZ, so the recoil drain pitched about the WORLD x axis instead of the
// camera's right axis. After a yaw those are different axes and the difference is roll.
//
// ⚠ THE ASSERTS BELOW DRIVE A REAL `THREE.PerspectiveCamera` THROUGH THE REAL SHIPPED FUNCTIONS,
// and measure the horizon the way a player sees it. They do NOT restate the drain arithmetic: a
// copy of a derivation agrees with its original for exactly as long as nobody edits either, and
// this repo has that written up twice already. If the drain changes, this file measures the change.
//
// ⚠ AND THE MEASUREMENT IS TAKEN AT SEVERAL YAWS ON PURPOSE. The bug is EXACTLY ZERO at yaw 0 and
// 180 — the camera is world-axis-aligned there, so world-x and camera-right coincide. A test that
// fired from the default spawn facing would have reported the feature working all along. Absence
// of roll at one heading is not absence of roll.

import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { drainRecoil, prepareLookCamera, RECOIL_DRAIN_RATE, LOOK_EULER_ORDER } from './recoil'
import { WEAPONS, recoilKick } from '../engine/weapons'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const deg = (r: number) => r * 180 / Math.PI
const rad = (d: number) => d * Math.PI / 180

/** The horizon lean a player would see: decompose the real orientation as YXZ and read z. */
function horizonLean(cam: THREE.Camera): number {
  return deg(new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ').z)
}

/**
 * Hold the trigger for `seconds` at 60fps from a given heading, and hand back the worst horizon
 * lean seen at any point during the burst. `prepare` is what makes this a fixed-vs-broken switch:
 * skipping it leaves the camera in three's default order, which IS the shipped bug.
 */
function holdTrigger(weaponId: string, yawDeg: number, pitchDeg: number, seconds: number,
                     prepare: boolean): number {
  const w = WEAPONS.find(x => x.id === weaponId)!
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  if (prepare) prepareLookCamera(cam)
  // look(): the one place orientation is authored, always as a YXZ euler.
  cam.quaternion.setFromEuler(new THREE.Euler(rad(pitchDeg), rad(yawDeg), 0, 'YXZ'))

  let seed = 12345
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }

  const recoil = { p: 0, y: 0 }
  const dt = 1 / 60
  let cd = 0
  let worst = 0
  for (let f = 0; f < Math.round(seconds * 60); f++) {
    cd -= dt
    if (cd <= 0) { const k = recoilKick(w, rand); recoil.p += k.pitch; recoil.y += k.yaw; cd = w.fireCd }
    drainRecoil(cam.rotation, recoil, dt)
    worst = Math.max(worst, Math.abs(horizonLean(cam)))
  }
  return worst
}

const HEADINGS = [0, 45, 90, 135, 180, 225, 270, 315]

// ── 1. ★★★ THE BUG, AS A PLAYER SENTENCE: EMPTYING A CLIP MUST NOT LEAN THE HORIZON ─────────────
// Every weapon, every heading, standing level and looking down. Not "small" — the drain has no
// business touching roll at all, so the bar is a rounding error, not a tolerance.
{
  for (const id of ['spitter', 'lance', 'repeater']) {
    for (const yaw of HEADINGS) {
      for (const pitch of [0, -20, -40, 25]) {
        const lean = holdTrigger(id, yaw, pitch, 4, true)
        ok(lean < 1e-9, `${id}: 4s of fire facing ${yaw}deg (pitch ${pitch}) leaves the horizon level (saw ${lean.toFixed(3)}deg)`)
      }
    }
  }
}

// ── 2. ⚠ THE ASSERT ABOVE CAN FAIL — THIS IS THE BUG, RESTORED ──────────────────────────────────
// A guard nobody has watched fail is a guard nobody has tested. Skipping `prepareLookCamera` is
// precisely the shipped defect, so this section is the mutation, run every time.
{
  const broken = HEADINGS.map(y => holdTrigger('spitter', y, -40, 4, false))
  const worst = Math.max(...broken)
  ok(worst > 10, `without prepareLookCamera the horizon leans hard: worst ${worst.toFixed(2)}deg over the headings`)
  ok(broken.filter(v => v > 1).length >= 5, 'and it is not one unlucky heading: most of the compass leans')
}

// ── 3. ★★ AND IT IS ZERO AT TWO HEADINGS EVEN WHEN BROKEN — WHY THIS WENT UNSEEN ────────────────
// World-axis-aligned facings hide it completely. Asserted so nobody later "simplifies" section 1
// down to a single heading and gets a green suite over a broken camera.
{
  // Measured, not asserted-by-eye: 0.30deg at yaw 0 and 0.47deg at 180, against 19.09deg at 90.
  // Not exactly zero, because the gun's random yaw kick walks the camera a little off the axis
  // during the burst — but a third of a degree over four seconds is below noticing, and that is
  // the whole reason this shipped. The ratio is the finding, not the floor.
  ok(holdTrigger('spitter', 0, -40, 4, false) < 1, 'facing 0deg the bug is under a degree — invisible, even unfixed')
  ok(holdTrigger('spitter', 180, -40, 4, false) < 1, 'facing 180deg the bug is under a degree — invisible, even unfixed')
  ok(holdTrigger('spitter', 90, -40, 4, false) > 15, 'facing 90deg the same burst leans over fifteen degrees')
}

// ── 4. THE DRAIN STILL DOES ITS ACTUAL JOB: THE GUN CLIMBS, AND THE CLIMB DECAYS ────────────────
// A camera that never rolls but also never kicks would pass section 1 perfectly. Assert the
// affordance, not just the absence — this is the cheapest wrong answer that satisfies the above.
{
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  prepareLookCamera(cam)
  cam.quaternion.setFromEuler(new THREE.Euler(0, rad(90), 0, 'YXZ'))
  const recoil = { p: 0.2, y: 0 }
  const before = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ').x
  drainRecoil(cam.rotation, recoil, 1 / 60)
  const after = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ').x
  ok(after > before, 'firing pitches the view UP — the kick still reaches the camera')
  ok(recoil.p < 0.2 && recoil.p > 0, 'and the owed kick decays rather than being spent or kept whole')

  const rest = { p: 0, y: 0 }
  const held = cam.rotation.x
  drainRecoil(cam.rotation, rest, 1 / 60)
  ok(cam.rotation.x === held, 'with nothing owed the drain does not drift the camera')
}

// ── 5. A LONG FRAME MUST NOT OVERSHOOT ──────────────────────────────────────────────────────────
// `Math.min(1, dt * RATE)` is the clamp. On a 200ms hitch dt*18 is 3.6, and without the clamp the
// camera would swing past the kick and the owed value would flip sign and oscillate.
{
  const recoil = { p: 0.2, y: 0.05 }
  const look = { x: 0, y: 0 }
  drainRecoil(look, recoil, 0.2)
  ok(Math.abs(look.x - 0.2) < 1e-12, 'a 200ms hitch delivers the whole owed kick, not more')
  ok(recoil.p === 0 && recoil.y === 0, 'and leaves nothing owed instead of an oscillating remainder')
  ok(Math.min(1, 0.2 * RECOIL_DRAIN_RATE) === 1, 'the clamp is what did that, at the shipped rate')
}

// ── 6. ★★ THE MODULE BEING RIGHT IS NOT THE GAME BEING RIGHT ────────────────────────────────────
// Sections 1-5 prove the functions. They cannot see whether VoxelWorld calls them — and a fix that
// ships in a module the game reaches around is the exact shape that cost this repo a 371-assert
// oracle last week. So: read the consumer.
{
  const src = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')

  ok(/prepareLookCamera\(camera\)/.test(src), 'VoxelWorld actually puts its camera into the look order')

  // Every write to camera.rotation must go through the drain. A bare `camera.rotation.x +=`
  // anywhere is the bug re-entering by the door it used the first time.
  const rawWrites = src.match(/camera\.rotation\.[xyz]\s*(\+|-|\*|\/)?=/g) ?? []
  ok(rawWrites.length === 0, `no hand-rolled camera.rotation writes remain (found ${rawWrites.length}: ${rawWrites.join(', ')})`)

  ok(/drainRecoil\(camera\.rotation,/.test(src), 'the drain is handed the real camera euler, not a scratch object')

  // ⚠ The order string is asserted from the module, not spelled again here — a second literal is a
  // mirror, and a mirror agrees with its source right up until it does not.
  ok(LOOK_EULER_ORDER === 'YXZ', 'the look order is YXZ')
  ok(!/rotation\.order\s*=\s*['"](?!YXZ)/.test(src), 'nothing in VoxelWorld sets a different euler order')
}

console.log(`recoil: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
