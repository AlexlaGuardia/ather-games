/**
 * THE POSE GUARD — every assert here is one a wrong walk cycle actually trips.
 *
 * ★ WHY THESE ASSERTS AND NOT "IT RETURNS NUMBERS" (2026-09-04, sprites lane). PATTERNS 2026-08-22:
 * ask of any assert whether there is an input that makes it fire. A pose function is the easy place
 * to write decoration — every field is a finite number no matter how wrong the animation looks — so
 * each assert below names a SPECIFIC way a walk reads wrong to the eye, and was mutation-checked by
 * reintroducing that exact bug. The knee-phase one caught a real defect in this module's first
 * draft: the bend peaked at maximum backward extension, a quarter cycle early.
 *
 * Run: `npx tsx src/app/shimmer/play3d/moglin-pose.test.ts`
 */
import { walkPose, idlePose, stepTime, STEP_FPS, STRIDE_S, type MoglinPose } from './moglin-pose'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else fails.push(label)
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps

// A dense sample of one full stride, reused by every cycle-wide claim below.
const SAMPLES = Array.from({ length: 240 }, (_, i) => (i / 240) * STRIDE_S)

// ── THE STEPPED CLOCK ─────────────────────────────────────────────────────────────────────────
// The clay cadence is the point of the whole module, so it gets asserted before any joint does.
const frame = 1 / STEP_FPS
ok(stepTime(0.01) === stepTime(frame * 0.99), 'two instants inside one frame pose IDENTICALLY')
ok(stepTime(frame * 1.01) !== stepTime(0.01), 'the clock still ADVANCES across a frame boundary')
ok(SAMPLES.every(t => stepTime(t) <= t + 1e-12),
  'a stepped pose never LEADS the real clock (floor, not round — anticipation reads as a glitch)')
ok(stepTime(0.37, 0) === 0.37 && stepTime(0.37, -5) === 0.37,
  'fps <= 0 means "do not step" and returns the clock untouched (the smooth escape hatch)')
// ⚠ An instrument that cannot see its subject: if stepping ever became a no-op at the real rate,
// every assert above still passes except this one.
ok(new Set(SAMPLES.map(t => stepTime(t))).size < SAMPLES.length / 4,
  `stepping at ${STEP_FPS}fps actually COLLAPSES a stride into few poses, not many`)

// ── CONTRALATERAL SWING ───────────────────────────────────────────────────────────────────────
// Point 1 of the header: get this backwards and it reads as deeply wrong with no nameable cause.
const moving = SAMPLES.map(t => walkPose(t, 1))
ok(moving.every(p => p.armL * p.armR <= 1e-12), 'the arms always swing in OPPOSITE directions')
ok(moving.every(p => p.legL * p.legR <= 1e-12), 'the legs always swing in OPPOSITE directions')
ok(moving.every(p => p.armL * p.legL <= 1e-12),
  '★ the left arm opposes the LEFT leg — the contralateral rule, and the one a viewer feels')

// ── THE BOB RUNS AT TWICE THE STRIDE ──────────────────────────────────────────────────────────
// Point 2: one stride is two steps and the body drops on each. A bob at stride rate reads as a limp.
ok(moving.every(p => p.hipY <= 1e-12), 'the bob is a DIP — the body never floats above its rest line')
const top0 = walkPose(0, 1).hipY, dip1 = walkPose(STRIDE_S * 0.25, 1).hipY
const top1 = walkPose(STRIDE_S * 0.5, 1).hipY, dip2 = walkPose(STRIDE_S * 0.75, 1).hipY
ok(near(top0, top1, 1e-6) && near(dip1, dip2, 1e-6) && dip1 < top0 - 0.01,
  '★ TWO dips per stride, evenly spaced — a bob at stride rate would make these four unequal')

// ── KNEES ─────────────────────────────────────────────────────────────────────────────────────
// Point 3, and the assert that caught this module's own first-draft bug.
ok(moving.every(p => p.kneeL >= 0 && p.kneeR >= 0), 'a knee never bends BACKWARDS')
// The left leg is most forward (planting) at phase 3pi/2 == 0.75 of the stride: the knee must be
// straight there. It is mid swing-through at phase pi == 0.5: the knee must be near its most bent.
const plantL = walkPose(STRIDE_S * 0.75, 1), swingL = walkPose(STRIDE_S * 0.5, 1)
ok(plantL.kneeL < 0.02, 'the left knee is STRAIGHT at the plant (heel strike)')
ok(swingL.kneeL > plantL.kneeL + 0.4,
  '★ the left knee is BENT mid swing-through — keying the bend off the raw stride peaks it a ' +
  'quarter cycle early, at maximum backward extension, and that is what this catches')
// The right leg is half a cycle out: it PLANTS at 0.25 (most forward) and swings through at 0.
ok(walkPose(0.0, 1).kneeR > walkPose(STRIDE_S * 0.25, 1).kneeR + 0.4,
  'and the right knee does the same thing half a cycle out of phase')
ok(walkPose(STRIDE_S * 0.25, 1).kneeR < 0.02, 'the right knee is STRAIGHT at ITS plant')

// ── THE EARS LAG ──────────────────────────────────────────────────────────────────────────────
// Point 4: lag is what makes a rigid part hung off another read as weight rather than as rotation.
// If the lag were removed the ears would peak exactly with the arm swing that drives the body.
const earPeak = SAMPLES.reduce((b, t) => (walkPose(t, 1).earL > walkPose(b, 1).earL ? t : b), 0)
const armPeak = SAMPLES.reduce((b, t) => (walkPose(t, 1).armL > walkPose(b, 1).armL ? t : b), 0)
ok(earPeak > armPeak + 0.02,
  `★ the ears peak AFTER the swing that threw them (ear ${earPeak.toFixed(3)}s vs arm ${armPeak.toFixed(3)}s)`)
ok(!near(walkPose(0.3, 1).earL, walkPose(0.3, 1).earR),
  'the two ears are not identical — a hand-made puppet is never symmetric')

// ── A STANDSTILL IS A STANDSTILL ──────────────────────────────────────────────────────────────
// ⚠ The "sliding doll" failure this whole approach gets accused of: a figure that keeps swinging
// while its feet do not move. Asserted as an EXACT match so a small residual swing cannot creep in.
const still = walkPose(1.234, 0), rest = idlePose(1.234)
ok((Object.keys(rest) as (keyof MoglinPose)[]).every(k => near(still[k], rest[k])),
  '★ speed 0 is EXACTLY the idle pose — no residual swing on a moglin that has stopped')
ok(still.legL === 0 && still.legR === 0 && still.armL === 0,
  'and nothing at rest is mid-stride')
ok(!near(idlePose(0).headYaw, idlePose(1.5).headYaw),
  'but rest is not a STATUE — it still breathes and looks about')

// ── AMPLITUDE FOLLOWS SPEED ───────────────────────────────────────────────────────────────────
const slow = walkPose(STRIDE_S * 0.25, 0.35), fast = walkPose(STRIDE_S * 0.25, 1)
ok(Math.abs(slow.armL) < Math.abs(fast.armL) && Math.abs(slow.hipY) < Math.abs(fast.hipY),
  'a slower moglin swings and bobs LESS — it winds down instead of stopping mid-stride')
ok(Math.abs(walkPose(STRIDE_S * 0.25, 99).armL) <= Math.abs(walkPose(STRIDE_S * 0.25, 1.6).armL) + 1e-12,
  'speed is clamped, so a bad caller cannot windmill the arms')

// ── THE CYCLE CLOSES, AND IT IS TWO STRIDES LONG ──────────────────────────────────────────────
// A cycle that does not close pops on every repeat, the most visible animation bug there is.
// ⚠ THE FULL PERIOD IS NOT ONE STRIDE, AND THAT IS DELIBERATE. `headYaw` runs at HALF the stride
// rate so the head look-about does not lock to the feet — a figure whose head turns exactly in
// time with its steps reads as clockwork rather than as a creature. So the locomotion joints close
// over one stride and the whole pose closes over two, and both halves are asserted: the second
// one is what goes red the day somebody "simplifies" that half-rate term away.
const keys = Object.keys(walkPose(0, 1)) as (keyof MoglinPose)[]
const LOCOMOTION: (keyof MoglinPose)[] = ['hipY', 'hipRoll', 'armL', 'armR', 'legL', 'legR', 'kneeL', 'kneeR', 'earL', 'earR']
ok(SAMPLES.every(t => LOCOMOTION.every(k => near(walkPose(t, 1)[k], walkPose(t + STRIDE_S, 1)[k], 1e-9))),
  '★ every LOCOMOTION joint is periodic over one stride — the walk does not pop')
ok(SAMPLES.every(t => keys.every(k => near(walkPose(t, 1)[k], walkPose(t + STRIDE_S * 2, 1)[k], 1e-9))),
  '★ and the whole pose closes over two strides')
ok(SAMPLES.some(t => !near(walkPose(t, 1).headYaw, walkPose(t + STRIDE_S, 1).headYaw, 1e-6)),
  '★ the head look-about is NOT locked to the stride — pins the deliberate desync')

console.log(`   ${SAMPLES.length} samples over a ${STRIDE_S}s stride · stepped at ${STEP_FPS}fps`)
console.log(fails.length ? `❌ ${pass} passed, ${fails.length} FAILED` : `✅ ${pass} passed`)
for (const f of fails) console.log(`   · ${f}`)
process.exit(fails.length ? 1 : 0)
