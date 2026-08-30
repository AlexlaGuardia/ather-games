// The Hollow voice's WIRING. Run: npx tsx src/app/shimmer/voxel3d/hollow-wiring.test.ts
//
// `hollow-voice.ts` (26 asserts, 12 mutations) and `hollow-sfx.ts` shipped 2026-08-27 and had NO
// caller outside their dev page, so Alex met the stalker in silence and reported being *"attacked
// by invisible enemies"*. `VoxelWorld.tsx` had 138 imports and not one of them was audio. This file
// guards the join, because the two halves being right is not the world making a sound.
//
// ⚠ IT GUARDS TWO THINGS THE PURE ORACLE STRUCTURALLY CANNOT SEE:
//   1. THE EAR'S YAW CONVENTION. `stepVoices` takes a yaw and trusts it. Hand it the camera's Euler
//      y instead of `atan2(forward.z, forward.x)` and every cue is a quarter turn out or mirrored —
//      and the failure is NOT silence, it is a confident cue pointing the wrong way, which is worse
//      than the bug it replaces. The oracle cannot catch this: from inside, any yaw is a valid yaw.
//   2. THAT `speed` IS MEASURED, NOT LOOKED UP. `HOLLOW_FORMS[form].speed` is the form's TOP speed —
//      what it IS, not what it is DOING — so a stalker withdrawing while watched, or a warden
//      stopped by a wall, would go on making footfalls while standing still.

import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { stepVoices, newVoiceClock, loudness, DEFAULT_VOICE, type Voice, type Ear } from './hollow-voice'
import { HOLLOW_FORMS } from './hollows'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) fails.length === fails.length && pass++; else fails.push(m) }
const near = (a: number, b: number, m: string, eps = 1e-6) => ok(Math.abs(a - b) < eps, `${m} (got ${a.toFixed(3)}, want ${b})`)

/** The ear exactly as VoxelWorld builds it: off a real camera's getWorldDirection. */
function earFrom(yawDeg: number): { fwd: THREE.Vector3; ear: Ear } {
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  cam.rotation.order = 'YXZ'
  cam.quaternion.setFromEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(yawDeg), 0, 'YXZ'))
  const f = new THREE.Vector3(); cam.getWorldDirection(f)
  return { fwd: f, ear: { x: 0, z: 0, yaw: Math.atan2(f.z, f.x) } }
}

/** Walk a body until it emits, and hand back the first emission. */
function firstEmission(ear: Ear, x: number, z: number) {
  const clock = newVoiceClock()
  const body: Voice = { id: 'b', x, z, form: 'stalker', speed: 4 }
  for (let i = 0; i < 400; i++) {
    const e = stepVoices(clock, [body], ear, 1 / 60)[0]
    if (e) return e
  }
  return null
}

// ── 1. ★★★ THE EAR POINTS WHERE THE KEEPER IS LOOKING ───────────────────────────────────────────
// Measured through a real camera, at four headings — because "correct at one heading" is exactly
// how the camera-roll bug survived this morning. A cue is only learnable if it means the same
// thing whichever way you are facing.
{
  for (const yaw of [0, 90, 180, 270]) {
    const { fwd, ear } = earFrom(yaw)
    // Right is forward x up, the right-hand rule. Positive pan is right in Web Audio, so these
    // are the only sign conventions the whole feature has to agree with.
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize()

    const ahead = firstEmission(ear, fwd.x * 8, fwd.z * 8)
    ok(!!ahead, `yaw ${yaw}: a body ahead is heard`)
    if (ahead) {
      near(ahead.pan, 0, `yaw ${yaw}: straight ahead is centred`)
      near(ahead.muffle, 0, `yaw ${yaw}: straight ahead is unmuffled`)
    }

    const behind = firstEmission(ear, -fwd.x * 8, -fwd.z * 8)
    if (behind) {
      near(behind.pan, 0, `yaw ${yaw}: directly behind is also centred — pan cannot carry "behind"`)
      near(behind.muffle, 1, `yaw ${yaw}: directly behind is fully muffled — THAT is what carries it`)
    }

    const onRight = firstEmission(ear, right.x * 8, right.z * 8)
    ok(!!onRight && onRight.pan > 0.99, `yaw ${yaw}: a body on the keeper's right pans RIGHT`)
    const onLeft = firstEmission(ear, -right.x * 8, -right.z * 8)
    ok(!!onLeft && onLeft.pan < -0.99, `yaw ${yaw}: a body on the keeper's left pans LEFT`)
  }
}

// ── 2. ⚠ THE WRONG YAW IS NOT SILENT — IT IS CONFIDENTLY WRONG ──────────────────────────────────
// The mutation this file exists for. Hand `stepVoices` the camera's Euler y (the tempting mistake)
// and a body straight ahead reports as behind you. Asserted so the fix cannot be "simplified" back.
{
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  cam.rotation.order = 'YXZ'
  cam.quaternion.setFromEuler(new THREE.Euler(0, 0, 0, 'YXZ'))
  const f = new THREE.Vector3(); cam.getWorldDirection(f)

  const right = { x: 0, z: 0, yaw: Math.atan2(f.z, f.x) }         // what VoxelWorld does
  const wrong = { x: 0, z: 0, yaw: cam.rotation.y }               // the euler-y mistake

  const aheadRight = firstEmission(right, f.x * 8, f.z * 8)
  const aheadWrong = firstEmission(wrong, f.x * 8, f.z * 8)
  ok(!!aheadRight && aheadRight.muffle < 0.01, 'with the shipped convention, ahead reads as ahead')
  // ⚠ MEASURED, AND MY FIRST VERSION OF THIS ASSERT OVERSTATED IT. I wrote "reads as directly
  // behind" (muffle 1) from reasoning; the real error is a QUARTER TURN — muffle 0.50, which is
  // "directly to the side". Still a confidently wrong cue, and still the thing worth guarding,
  // but the number is the number. An oracle that exaggerates a bug is an oracle that goes red for
  // the wrong reason the day someone fixes it slightly.
  ok(!!aheadWrong && Math.abs(aheadWrong.muffle - 0.5) < 0.01,
     `with the euler-y mistake the SAME body reads as off to the SIDE, a quarter turn out (muffle ${aheadWrong?.muffle.toFixed(2)})`)
  ok(!!aheadWrong && aheadWrong.muffle > 0.4,
     'and that is not a small error — the keeper would turn ninety degrees the wrong way')
}

// ── 3. ★★ A STANDING BODY IS SILENT, AND THE FORM CONSTANT IS NOT THE ANSWER ────────────────────
// The stalker is the fastest form in the game (`speed: 3.9`) and its own design has it stop and
// withdraw while watched. Reading the constant would make it loudest exactly when it is holding
// still — the cue lying about what the body is doing, which is the bug this feature replaces.
{
  const ear: Ear = { x: 0, z: 0, yaw: 0 }
  const clock = newVoiceClock()
  const still: Voice = { id: 's', x: 3, z: 0, form: 'stalker', speed: 0 }
  let heard = 0
  for (let i = 0; i < 600; i++) heard += stepVoices(clock, [still], ear, 1 / 60).length
  ok(heard === 0, `a body at speed 0 makes no sound over ten seconds (heard ${heard})`)

  ok(HOLLOW_FORMS.stalker.speed > 0, 'the stalker HAS a nonzero form speed — so the constant would have made noise')
  ok(HOLLOW_FORMS.stalker.speed >= HOLLOW_FORMS.warden.speed,
     'and it is the fast form, so the mistake would be loudest on the one that withdraws')

  // Walking, same body, same place: now it is heard. Proves section 3's silence is about MOVEMENT.
  const walking: Voice = { id: 's', x: 3, z: 0, form: 'stalker', speed: HOLLOW_FORMS.stalker.speed }
  const clock2 = newVoiceClock()
  let heard2 = 0
  for (let i = 0; i < 600; i++) heard2 += stepVoices(clock2, [walking], ear, 1 / 60).length
  ok(heard2 > 0, `the same body walking IS heard (${heard2} footfalls in ten seconds)`)
}

// ── 4. RANGE — a cue you cannot act on is noise ─────────────────────────────────────────────────
{
  ok(loudness(0, DEFAULT_VOICE) > loudness(5, DEFAULT_VOICE), 'closer is louder')
  ok(loudness(DEFAULT_VOICE.range, DEFAULT_VOICE) === 0, 'and past the range a body is silent')
  ok(loudness(DEFAULT_VOICE.range + 50, DEFAULT_VOICE) === 0, 'well past it too — never negative')
}

// ── 5. ★★ AND THE WORLD HAS TO ACTUALLY RUN IT ──────────────────────────────────────────────────
// Sections 1-4 are green with `VoxelWorld.tsx` never importing a note of this — which is precisely
// the state that put Alex in a silent world with a 14-damage hit landing behind him.
{
  const src = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')

  ok(/from '\.\/hollow-voice'/.test(src), 'VoxelWorld imports the voice')
  ok(/from '\.\/hollow-sfx'/.test(src), 'and the shell that makes it audible')
  ok(/playEmissions\(stepVoices\(/.test(src), 'and hands what the voice decides straight to the shell')

  // ⚠ The ear, spelled the one way that is correct. Asserted literally because section 2 shows the
  // plausible alternative is not silent — it points the wrong way and sounds fine doing it.
  ok(/yaw: Math\.atan2\(hollowFwd\.current\.z, hollowFwd\.current\.x\)/.test(src),
     'the ear yaw is atan2(forward.z, forward.x) — never the camera euler')
  ok(!/yaw: camera\.rotation\.y/.test(src), 'and the euler-y mistake is not present')

  // ⚠⚠ SPEED IS MEASURED ACROSS `hollowStep`, NOT LOOKED UP. Anchored to the push itself rather
  // than grepped loose — a bare /Math.hypot/ over this file is satisfied by a dozen other lines,
  // which is the "satisfiable by being anywhere" trap that got past me earlier today.
  const push = src.match(/voices\.current\.push\(\{[\s\S]{0,220}?\}\)/)?.[0] ?? ''
  ok(push !== '', 'the voice list is built inside the Hollow loop')
  ok(/speed: dt > 0 \? Math\.hypot\(st\.x - vx0, st\.z - vz0\) \/ dt : 0/.test(push),
     'speed is what the body ACTUALLY moved across hollowStep')
  ok(!/HOLLOW_FORMS\[[^\]]*\]\.speed/.test(push), 'and never the form constant')
  // ⚠ COMMENT LINES ARE PERMITTED HERE AND STATEMENTS ARE NOT, AND THAT DISTINCTION IS THE WHOLE
  // ASSERT. What this guards is that nothing MOVES the body between the sample and the step — a
  // comment cannot move anything, so forbidding one is a false positive, and it fired as one on
  // 2026-08-28 when the sky-Hollow fix documented the up-span argument directly above the call.
  // ★ Loosened to match the intent rather than deleted or dodged: a red that is answered by moving
  // the prose somewhere it reads worse teaches the next person to route around the guard.
  ok(/const vx0 = st\.x, vz0 = st\.z\s*\n(?:\s*\/\/[^\n]*\n)*\s*hollowStep\(/.test(src),
     'the before-position is sampled with no STATEMENT between it and hollowStep')

  // ── ★★★ 6. THE SKY-HOLLOW FIX LIVES IN THE HOST CLOSURE, SO ONLY THE HOST CAN BE ASKED ────────
  // `hollows.test.ts` proves the BODY behaves given a well-bounded ground probe. It cannot prove
  // the world hands it one — the ratchet was never inside `hollowStep`, it was in the argument
  // `VoxelWorld` bound to it. Collapse these back to their defaults and every module assert stays
  // green while the Hollows climb the trees again. Same shape as the bridge oracle that called
  // `bridgeVoxelAt` directly while the game reached it through `materialAt`.
  const hollowGround = src.match(/hollowStep\(st, dt,[\s\S]{0,260}?\)\n/)?.[0] ?? ''
  ok(hollowGround !== '', 'the Hollow step call is findable')
  ok(/groundTopNear\(x, z, st\.y, HOLLOW_GROUND_DOWN, HOLLOW_GROUND_UP\)/.test(hollowGround),
     '★★★ the Hollow ground probe is bounded UPWARD by the climb — the canopy ratchet cannot return')
  ok(/HOLLOW_GROUND_UP/.test(src) && /HOLLOW_GROUND_DOWN/.test(src),
     'and both spans come from the module that derives them, not from literals here')

  // ── ★★ 6b. THE `window.__hollows()` READOUT (2026-08-30) ─────────────────────────────────────
  // It exists to answer "are they in the trees again?" from the RUNNING world, because bodies spawn
  // at runtime and no generator query can see them. Guarded here because a readout that quietly
  // reports the wrong quantity is worse than none: the last two arguments about Hollow altitude were
  // both lost to units, and this one publishes a number people will act on.
  const readout = src.match(/w\.__hollows = \(\) =>[\s\S]{0,1200}?\n {4}\}\)\n/)?.[0] ?? ''
  ok(readout !== '', 'the __hollows readout is findable')

  // ★★★ THE STANDING SURFACE IS THE PROBE PLUS ONE. `groundTopNear` returns the TOP SOLID CELL and
  // `hollowStep` rests a body at `groundAt + 1 + hover`. Publishing `y - probe` would report 1.0 for
  // a body standing perfectly on the floor — the same off-by-one that inverted the bridge-landing
  // diagnosis on this very day, and it would read as a Hollow permanently a block in the air.
  ok(/groundTopNear\(st\.x, st\.z, st\.y, HOLLOW_GROUND_DOWN, HOLLOW_GROUND_UP\) \+ 1/.test(readout),
     '★★★ the readout derives standingY as probe + 1, so a settled body reads 0 and not 1')
  ok(/HOLLOW_GROUND_DOWN, HOLLOW_GROUND_UP/.test(readout),
     '★★ and it probes with the HOST\'S OWN bounds — a readout on the default symmetric window would'
     + ' disagree with the world it reports on, which is the 08-28 simulation error in a lab coat')

  // ★ The three quantities stay SEPARATE and the answer is pre-subtracted, so no reader has to
  // remember which of them the hover belongs to.
  // ⚠ MATCH SHORTHAND TOO. `{ standingY, hover }` publishes both just as surely as `standingY:` does,
  // and a `${field}:` regex reports a field that IS published as missing — a guard failing toward
  // "you found something", which is the direction that gets acted on. Caught by this assert going
  // red against a readout that was correct.
  for (const field of ['standingY', 'aboveStanding', 'hover', 'offItsFloor']) {
    ok(new RegExp(`[\\s,{]${field}\\s*[:,}]`).test(readout), `the readout publishes ${field}`)
  }

  // ⚠⚠ THE GATE IS READ AT CALL TIME. `owner` is a ref because /api/owner answers async; an effect
  // that early-returned on `!owner.current` would install nothing before the fetch landed and the
  // hook would be missing for everyone, the owner included — the exact trap this file's own keydown
  // note describes. So the refusal must live INSIDE the published function.
  ok(/w\.__hollows = \(\) => !owner\.current \?/.test(src),
     '★★ the owner check is inside the published function, not around its installation')
  ok(!/if \(!owner\.current\) return\s*\n\s*const w = window/.test(src),
     'and the install-time early return (which would never arm) is not present')

  // A hot reload that left the old closure behind would hold a dead `hollows` ref and report a world
  // that no longer exists — which is worse than reporting nothing.
  ok(/delete w\.__hollows/.test(src), 'the readout is torn down on unmount')

  // ⚠ THE KEEPER'S HEIGHT MUST BE HER FEET. `p` in this loop is the CAMERA, so `p.y` is the eye —
  // passing it would put every keeper a constant 1.62 above where she stands and quietly eat most
  // of a warden's vertical tolerance, which reads as "the melee forms stopped hitting me".
  ok(/hollowStrike\(st, dt, p\.x, loco\.current\.py, p\.z,/.test(src),
     '★★ the strike is told the keeper FEET, never the camera eye')
  ok(!/hollowStrike\(st, dt, p\.x, p\.y, p\.z,/.test(src),
     'and the eye-height mistake is not present')

  // The list must be rebuilt each frame, or a despawned body keeps walking.
  ok(/voices\.current\.length = 0/.test(src), 'the list is cleared every frame, so a departed body goes quiet')

  // Audio needs a real user gesture; riding the canvas click means there is no button to miss.
  ok(/unlockHollowSfx\(\)/.test(src), 'the audio context is unlocked from a user gesture')
  const click = src.match(/addEventListener\('click', \(\) => \{[\s\S]{0,1200}?\n {16}\}\)/)?.[0] ?? ''
  ok(click !== '', 'the canvas click handler is findable')
  ok(/unlockHollowSfx\(\)/.test(click), 'and that gesture is the canvas click — the same one that takes pointer lock')
}

console.log(`hollow-wiring: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
