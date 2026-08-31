/**
 * THE AVATAR'S PURE HALF, ASSERTED THROUGH THE FUNCTIONS THE PAGE ACTUALLY CALLS.
 *
 * ★★ WHY THIS FILE IS WORTH ITS LINES. The build box has no camera, so the tracker's output can
 * never be eyeballed here. That makes the arithmetic the only thing that CAN be checked, and it
 * already caught the expensive one: `poseFromMatrix` had yaw and pitch swapped, so a pure head
 * TURN reported as a NOD. PATTERNS' rule is that a wrong direction is worse than a wrong
 * magnitude — it does not weaken a fix, it reverses it — and a swapped axis is invisible on
 * inspection because it still produces smooth, plausible, confidently wrong motion.
 *
 * ⚠ EVERY ASSERT HERE DRIVES THE SHIPPED FUNCTION. Nothing re-implements a transform beside the
 * one it is checking; a test that recomputes the answer its subject computes agrees with itself
 * and knows nothing about the world (PATTERNS 2026-08-22, the hand-kept mirror).
 *
 * Run: npx tsx src/app/shimmer/../vtuber/rig.test.ts   (repo convention — there is no vitest)
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { rig, DEFAULT_OPTIONS, type AvatarMeta } from './rig'
import { OVERSCAN } from './renderer'
import { poseFromMatrix, stateFromBlend, DEFAULT_TUNING, Calibrator, blendMap } from './tracker'
import { NEUTRAL, approach, MOUTH_SMOOTH, EYE_SMOOTH, normalise, DEFAULT_CHANNELS } from './expression'
import { synthetic } from './sources'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) { if (cond) pass++; else fails.push(label) }
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps

// ── the avatar the page ships with, read rather than invented ────────────────────────────────
const METAP = join(process.cwd(), 'public/vtuber/serberus.json')
ok(existsSync(METAP), 'the shipped avatar has metadata (run `npm run vtuber:layers`)')
const meta: AvatarMeta = JSON.parse(readFileSync(METAP, 'utf8'))

// ── 1. THE CUT ITSELF ────────────────────────────────────────────────────────────────────────
// The whole approach rests on the mouth being the only lit thing on a shadowed face. If that
// stops being true for a future avatar, everything downstream is cutting scenery.
ok(meta.mouth.dominance > 0.55,
  `the grin is ${(meta.mouth.dominance * 100).toFixed(0)}% of the frame's bright pixels — the shadowed-face premise holds`)
const [bx0, by0, bx1, by1] = meta.mouth.box
ok(meta.mouth.pivotX > bx0 && meta.mouth.pivotX < bx1, 'the pivot sits inside the mouth horizontally')
// ★ THE PIVOT MUST BE AT THE TOP OF THE MOUTH, NOT ITS MIDDLE. A jaw drops. Scaling the crescent
// about its centre grows it upward into the nose by half the added height.
ok(meta.mouth.pivotY - by0 < (by1 - by0) * 0.35,
  `the pivot is in the TOP third of the mouth box (a jaw drops, it does not inflate)`)
ok(meta.mouth.layerPx > meta.mouth.corePx,
  'the mouth layer carries more than the teeth — the bloom came with it')

// ── 2. THE MOUTH OPENS DOWNWARD, AND THE LIGHT FOLLOWS IT ────────────────────────────────────
const shut = rig({ ...NEUTRAL, mouthOpen: 0 }, meta, { ...DEFAULT_OPTIONS, now: 0 })
const open = rig({ ...NEUTRAL, mouthOpen: 1 }, meta, { ...DEFAULT_OPTIONS, now: 0 })
// ★★★ THE ASSERT THAT EXISTS BECAUSE OF A PHOTOGRAPH. The first renderer opened the mouth by
// SCALING the crescent vertically. Every number was right and the guard was green; the picture
// showed the teeth stretching into a drip. Teeth are rigid — a jaw is a TRANSLATION of the lower
// row, never a scale of the whole. So `scaleY` must stay pinned at 1 across the entire range,
// and any future attempt to reintroduce a vertical scale goes red here.
let noStretch = true
for (let i = 0; i <= 20; i++) {
  const p = rig({ ...NEUTRAL, mouthOpen: i / 20, mouthWide: i / 20 }, meta, { ...DEFAULT_OPTIONS, now: 0 })
  if (!near(p.mouth.scaleY, 1)) noStretch = false
}
ok(noStretch, 'the grin is NEVER scaled vertically at any openness — teeth do not stretch')
ok(near(shut.jawDrop, 0), 'a shut mouth drops the jaw exactly zero')
ok(open.jawDrop > 0, 'an open mouth drops the jaw')
// The split has to sit inside the teeth, or one "half" is empty and only one row ever moves.
ok(meta.mouth.splitY > meta.mouth.coreTop && meta.mouth.splitY < meta.mouth.coreBottom,
  'the jaw hinge sits inside the grin, so both halves carry teeth')
// ⚠ AND THE JAW MUST NOT FALL OFF THE FACE. The lower row travels from the split; at full open
// it has to stay within a plausible chin rather than sliding down the neck.
const grinH = meta.mouth.coreBottom - meta.mouth.coreTop
ok(open.jawDrop > grinH * 0.25 && open.jawDrop < grinH * 1.2,
  `a full jaw drop is ${(open.jawDrop / grinH).toFixed(2)} of the grin's own height — open, not dislocated`)
ok(open.glow > shut.glow, 'opening the mouth puts MORE light on the scene (glow rides openness)')
// Monotonic, not merely different at the ends: a non-monotonic glow flickers mid-syllable.
let mono = true
for (let i = 1; i <= 20; i++) {
  const a = rig({ ...NEUTRAL, mouthOpen: (i - 1) / 20 }, meta, { ...DEFAULT_OPTIONS, now: 0 })
  const b = rig({ ...NEUTRAL, mouthOpen: i / 20 }, meta, { ...DEFAULT_OPTIONS, now: 0 })
  if (b.glow < a.glow || b.jawDrop < a.jawDrop) mono = false
}
ok(mono, 'glow and jaw drop both rise monotonically across the whole range')

// A grin widens without getting taller, or "smile" and "speak" would be the same channel.
const grin = rig({ ...NEUTRAL, mouthWide: 1 }, meta, { ...DEFAULT_OPTIONS, now: 0 })
ok(grin.mouth.scaleX > 1 && near(grin.jawDrop, 0),
  'a grin widens the crescent and does not open the jaw')

// ── 3. THE HEAD MOVES AND THE BACKDROP RESISTS ───────────────────────────────────────────────
const turned = rig({ ...NEUTRAL, yaw: 1 }, meta, { ...DEFAULT_OPTIONS, now: 0 })
ok(turned.base.x > 0, 'a positive yaw shifts the head')
ok(Math.sign(turned.backdrop.x) === -Math.sign(turned.base.x),
  'the backdrop counter-moves — that opposition IS the depth')
ok(Math.abs(turned.backdrop.x) < Math.abs(turned.base.x),
  'and it moves LESS than the head, or the parallax reads inside-out')
const pinned = rig({ ...NEUTRAL, yaw: 1 }, meta, { ...DEFAULT_OPTIONS, motion: 0, now: 0 })
ok(near(pinned.base.x, 0), 'motion 0 pins the head completely')

// ★★ THE OVERSCAN IS ASSERTED AS A RELATIONSHIP, NOT A NUMBER. If head travel ever exceeds the
// margin the art is drawn with, the picture's own edge walks into frame — and it would do so only
// at extreme poses, i.e. rarely enough to look like a rendering glitch rather than a constant.
let worst = 0
for (const yaw of [-1, 1]) for (const pitch of [-1, 1]) {
  for (let t = 0; t < 6000; t += 250) {
    const p = rig({ ...NEUTRAL, yaw, pitch }, meta, { ...DEFAULT_OPTIONS, now: t })
    worst = Math.max(worst, Math.abs(p.base.x) / meta.w, Math.abs(p.base.y) / meta.h)
  }
}
ok(worst < (OVERSCAN - 1) / 2,
  `worst head travel ${(worst * 100).toFixed(2)}% of frame fits inside the ${((OVERSCAN - 1) * 100).toFixed(0)}% overscan with margin`)

// ── 4. THE EYES ARE A TOGGLE, AND A BLINK ACTUALLY CLOSES ────────────────────────────────────
ok(rig(NEUTRAL, meta, { ...DEFAULT_OPTIONS, eyes: false, now: 0 }).eyes === null,
  'eyes off returns nothing for the renderer to draw')
const blink = rig({ ...NEUTRAL, eyeOpenL: 0, eyeOpenR: 0 }, meta, { ...DEFAULT_OPTIONS, now: 0 })
// ⚠ A "blink" that bottoms out above zero leaves a bright line across the face, which is worse
// than not blinking at all.
ok(blink.eyes !== null && near(blink.eyes.ry, 0), 'a full blink closes the lid to zero height')
const wideEye = rig(NEUTRAL, meta, { ...DEFAULT_OPTIONS, now: 0 })
ok(wideEye.eyes !== null && wideEye.eyes.ry > 0, 'an open eye has height')
ok(wideEye.eyes !== null && wideEye.eyes.leftX < wideEye.eyes.rightX, 'left eye is left of right eye')

// ── 5. SMOOTHING IS ASYMMETRIC, WHICH IS THE WHOLE FEEL ──────────────────────────────────────
// Same distance travelled, opposite directions: opening must cover more ground per frame.
const up = approach(0, 1, MOUTH_SMOOTH)
const down = 1 - approach(1, 0, MOUTH_SMOOTH)
ok(up > down, `the mouth opens faster than it closes (${up.toFixed(2)} vs ${down.toFixed(2)} per frame)`)
ok(EYE_SMOOTH.attack > MOUTH_SMOOTH.attack,
  'an eyelid is faster than a jaw — the mouth constant would turn every blink into a droop')

// ── 6. CALIBRATION ACTUALLY SUBTRACTS A REST POINT ───────────────────────────────────────────
// ⚠ This is the assert that would have caught "the rig does not work" being blamed on the art.
const REST = 0.14
ok(normalise(REST, DEFAULT_CHANNELS.jawOpen) > 0.1,
  `an uncalibrated resting jaw of ${REST} reads as a partly-open mouth — this is the defect calibration exists for`)
const cal = new Calibrator()
for (let i = 0; i < 30; i++) cal.add({ jawOpen: REST, eyeBlinkLeft: 0.04, eyeBlinkRight: 0.05 })
const ch = cal.finish()
ok(ch !== null, 'calibration accepts 30 frames')
ok(ch !== null && near(normalise(REST, ch.jawOpen), 0, 1e-9),
  'after calibration that same resting face reads as a CLOSED mouth')
ok(new Calibrator().finish() === null,
  'calibration refuses to average zero frames rather than returning a confident guess')

// ── 7. THE AXIS BUG THIS FILE WAS WRITTEN TO CATCH ───────────────────────────────────────────
// ★★★ Pure rotations, driven through the shipped function, asserting WHICH CHANNEL ANSWERS.
function rotY(t: number) { // head turning: yaw
  const c = Math.cos(t), s = Math.sin(t)
  return [c, 0, -s, 0,  0, 1, 0, 0,  s, 0, c, 0,  0, 0, 0, 1]
}
function rotX(t: number) { // head nodding: pitch
  const c = Math.cos(t), s = Math.sin(t)
  return [1, 0, 0, 0,  0, c, s, 0,  0, -s, c, 0,  0, 0, 0, 1]
}
function rotZ(t: number) { // head tilting: roll
  const c = Math.cos(t), s = Math.sin(t)
  return [c, s, 0, 0,  -s, c, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1]
}
const ident = poseFromMatrix([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])
ok(near(ident.yaw, 0) && near(ident.pitch, 0) && near(ident.roll, 0),
  'a face pointed straight at the camera reports no rotation at all')

const y = poseFromMatrix(rotY(0.4))
ok(y.yaw > 0.5 && Math.abs(y.pitch) < 0.05 && Math.abs(y.roll) < 0.05,
  `a pure head TURN answers on yaw and nothing else (got yaw ${y.yaw.toFixed(2)} pitch ${y.pitch.toFixed(2)} roll ${y.roll.toFixed(2)})`)
const x = poseFromMatrix(rotX(0.4))
ok(x.pitch > 0.5 && Math.abs(x.yaw) < 0.05 && Math.abs(x.roll) < 0.05,
  `a pure NOD answers on pitch and nothing else (got yaw ${x.yaw.toFixed(2)} pitch ${x.pitch.toFixed(2)} roll ${x.roll.toFixed(2)})`)
const z = poseFromMatrix(rotZ(0.4))
ok(z.roll > 0.5 && Math.abs(z.yaw) < 0.05 && Math.abs(z.pitch) < 0.05,
  `a pure TILT answers on roll and nothing else (got yaw ${z.yaw.toFixed(2)} pitch ${z.pitch.toFixed(2)} roll ${z.roll.toFixed(2)})`)
// Sign, not just magnitude: a mirrored avatar leans the wrong way and reads as bad tuning.
ok(poseFromMatrix(rotY(-0.4)).yaw < 0, 'turning the other way reports the other sign')

// ── 8. NOTHING PRODUCES NaN, EVER ────────────────────────────────────────────────────────────
// ⚠ NaN through an exponential smoother never recovers: one poisoned frame kills the rig for the
// rest of the stream, and it presents as the avatar simply freezing.
const finite = (o: object): boolean =>
  Object.values(o).every(v =>
    v === null ? true
    : typeof v === 'number' ? Number.isFinite(v)
    : typeof v === 'object' ? finite(v as object)
    : true)
// The degenerate case: a head pitched to vertical, where the decomposition loses a gimbal.
ok(finite(poseFromMatrix(rotX(Math.PI / 2))), 'a straight-up head still yields finite angles')
let allFinite = true
for (let t = 0; t < 12000; t += 97) {
  if (!finite(rig(synthetic(t), meta, { ...DEFAULT_OPTIONS, now: t }))) allFinite = false
}
ok(allFinite, 'the synthetic driver produces a finite pose at every sampled moment')
const zeroBlend = stateFromBlend(blendMap([]), null, DEFAULT_TUNING, 0)
ok(finite(zeroBlend) && zeroBlend.mouthOpen === 0,
  'a frame with no blendshapes at all yields a closed, finite face rather than NaN')

console.log(fails.length ? `❌ ${pass} passed, ${fails.length} FAILED` : `✅ ${pass} passed`)
for (const f of fails) console.log(`   · ${f}`)
process.exit(fails.length ? 1 : 0)
