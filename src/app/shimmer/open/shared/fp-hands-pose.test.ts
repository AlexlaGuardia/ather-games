// fp-hands-pose.ts: Alex's shape. Both gloves in view at rest, cuffs pointed AWAY from each other; on a run they take turns
// dropping out of view below the frame; a jump throws both up, the right higher.
import { newFpState, stepFpHands, FP, eulerQ, angleQ, holdTurn, slerpQ, type FpInput, type Quat } from './fp-hands-pose'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const base: FpInput = { now: 0, speed: 0, airborne: false, hidden: false, castAt: -Infinity, working: false }
const run = (frames: number, f: (k: number) => Partial<FpInput>, s = newFpState(), dt = 1 / 60) => {
  const out: { R: { y: number; z: number; x: number; roll: number }; L: { y: number; z: number; x: number; roll: number } }[] = []
  for (let k = 0; k < frames; k++) { const p = stepFpHands(s, { ...base, now: k * dt * 1000, ...f(k) }, dt); out.push({ R: { ...p.R }, L: { ...p.L } }) }
  return { out, s }
}
const BOTTOM = FP.Z * Math.tan((75 / 2) * Math.PI / 180)   // the frame's bottom edge at the hands' depth (fov 75)
// rest: both in view, low, cuffs turned outward (right cuff to the right: +roll; left to the left: -roll)
const still = run(120, () => ({})).out.at(-1)!
ok(still.R.y > BOTTOM && still.R.y < BOTTOM + 0.12 && still.L.y > BOTTOM, `at rest both hands are in view, low (y ${still.R.y.toFixed(3)} vs edge ${BOTTOM.toFixed(3)})`)
// the DIRECTION is the rule (right cuff +, left cuff -); the old '> 1' was fitted to ROLL 1.02 and Alex tuned 0.63 on 11-19
ok(still.R.roll > 0.3 && still.L.roll < -0.3, `cuffs point away from each other (roll R ${still.R.roll.toFixed(2)}, L ${still.L.roll.toFixed(2)})`)
// run: alternating, opposite phase, each hand rising into view in turn
const r = run(240, () => ({ speed: FP.RUN_SPEED })).out.slice(60)
const dR = r.map(p => p.R.y), dL = r.map(p => p.L.y)
const mR = dR.reduce((a, b) => a + b, 0) / dR.length, mL = dL.reduce((a, b) => a + b, 0) / dL.length
const corr = dR.reduce((a, y, k) => a + (y - mR) * (dL[k] - mL), 0)
ok(Math.max(...dR) - Math.min(...dR) > 0.05 && Math.max(...dL) - Math.min(...dL) > 0.05, 'a run swings both hands')
ok(corr < 0, `the hands alternate (one up while the other is down; correlation ${corr.toFixed(4)})`)
ok(Math.min(...dR) < BOTTOM - 0.1 && Math.min(...dL) < BOTTOM - 0.1, 'on its step each hand drops out of view below the frame')
const HALF = 0.06   // a glove's half height: its top shows while its centre is within this of the edge
// they TAKE TURNS: when one hand is at its lowest, the other shows (Alex's tune drops both briefly as they cross; that is his look)
const kR = dR.indexOf(Math.min(...dR)), kL = dL.indexOf(Math.min(...dL))
ok(dL[kR] > BOTTOM - HALF && dR[kL] > BOTTOM - HALF, 'they take turns: at one hand\'s lowest the other is in view')
// smooth: no frame-to-frame jump bigger than a centimetre while running at a steady speed
// a pumping hand MOVES ~2 cm a frame; what must not happen is a sudden change in that motion (the second difference)
const acc = (ys: number[]) => ys.slice(2).map((y, k) => Math.abs(y - 2 * ys[k + 1] + ys[k]))
// the ideal: a sine of amplitude DROP/2 at the stride's rate has a second difference of A·ω²·dt² at most; allow 30 % for the ease
const w = 2 * Math.PI * FP.RUN_SPEED / FP.STRIDE_M, ideal = (FP.DROP_Y / 2) * w * w / 3600, steady = Math.max(...acc(dR))
ok(steady < ideal * 1.3, `steady run: no jerk (max second difference ${steady.toFixed(4)} vs a pure sine's ${ideal.toFixed(4)})`)
// jitter in the INPUT speed (a slope, an uneven frame) must not shake the hands
const j = run(240, k => ({ speed: FP.RUN_SPEED * (k % 2 ? 0.7 : 1.3) })).out.slice(60)
const jy = j.map(p => p.R.y)
// unsmoothed, a flicker runs ~20x rougher than a steady run (the mutation below the test); 2x is the line
ok(Math.max(...acc(jy)) < steady * 2, `a speed that flickers ±30% every frame stays within 2x a steady run (${Math.max(...acc(jy)).toFixed(4)} vs ${steady.toFixed(4)})`)
// a jump: both up, the right higher; no alternation in the air
const air = run(60, () => ({ speed: FP.RUN_SPEED, airborne: true })).out.at(-1)!
ok(air.R.y > still.R.y + 0.1 && air.L.y > still.L.y + 0.07, 'a jump throws both hands up')
ok(air.R.y > air.L.y + 0.03, `the right a little higher (${air.R.y.toFixed(3)} vs ${air.L.y.toFixed(3)})`)
ok(air.R.y > BOTTOM && air.L.y > BOTTOM, 'in the air both are in view')
// the stride does not advance in the air
const s1 = run(60, () => ({ speed: 6, airborne: true })).s
ok(s1.phase === 0, 'no footfalls in the air (the stride holds)')
// hidden: out of frame
const hid = run(90, () => ({ hidden: true })).out.at(-1)!
ok(hid.R.y < BOTTOM - 0.4 && hid.L.y < BOTTOM - 0.4, 'a panel or the gun takes both hands out of frame')
// a cast raises the right only
const c = run(20, k => ({ castAt: 0 })).out.at(-1)!
ok(c.R.y > still.R.y + 0.08 && Math.abs(c.L.y - still.L.y) < 0.02, 'a cast raises the glove, not the bracelet hand')
// M45 holding: the right mitt goes to the Hold numbers, the left stays at rest, and a run barely drops the presenting hand
const hd = run(120, () => ({ holding: true }))
const hp = hd.out.at(-1)!
ok(Math.abs(hp.R.x - FP.HOLD_X) < 0.005 && Math.abs(hp.R.y - FP.HOLD_Y) < 0.005 && Math.abs(hp.R.roll - FP.HOLD_ROLL) < 0.01, 'holding: the right mitt settles on the Hold pose')
ok(Math.abs(hp.L.y - still.L.y) < 0.005 && hd.s.hold > 0.99, 'holding: the left stays at rest; the hold weight reaches 1')
const hr = run(240, () => ({ holding: true, speed: FP.RUN_SPEED })).out
const lowHeld = Math.min(...hr.slice(120).map(f => f.R.y)), lowBare = Math.min(...run(240, () => ({ speed: FP.RUN_SPEED })).out.slice(120).map(f => f.R.y))
ok(lowHeld > lowBare + FP.DROP_Y * 0.5, `holding on a run: the presenting hand stays up (${lowHeld.toFixed(3)} vs bare ${lowBare.toFixed(3)})`)
const let_ = run(120, k => ({ holding: k < 60 })).out.at(-1)!
ok(Math.abs(let_.R.x - still.R.x) < 0.005 && Math.abs(let_.R.roll - still.R.roll) < 0.01, 'put away: back to rest')
// ── 11-21: idle -> HOLD turns by the SHORTEST arc (Alex: "the rotation from idle to HOLD looks unnatural") ─────────────
{
  const qRest = eulerQ(FP.PITCH, 0, FP.ROLL), qHold = eulerQ(FP.HOLD_PITCH, FP.HOLD_YAW, FP.HOLD_ROLL), arc = angleQ(qRest, qHold)
  // endpoints: the rig shows exactly what rotation.set(pitch, 0, roll) showed, at rest and settled in the hold
  const s0 = newFpState(); let q0: Quat = s0.R.q
  for (let k = 0; k < 120; k++) q0 = [...stepFpHands(s0, { ...base, now: k * 16.7 }, 1 / 60).R.q] as Quat
  ok(angleQ(q0, qRest) < 1e-6, `rest orientation unchanged (off by ${angleQ(q0, qRest).toExponential(1)} rad)`)
  const s1 = newFpState(); let q1: Quat = s1.R.q, p1 = { x: 0, y: 0, z: 0 }
  for (let k = 0; k < 240; k++) { const p = stepFpHands(s1, { ...base, now: k * 16.7, holding: true }, 1 / 60).R; q1 = [...p.q] as Quat; p1 = { x: p.x, y: p.y, z: p.z } }
  ok(angleQ(q1, qHold) < 1e-4, `hold orientation unchanged (off by ${angleQ(q1, qHold).toExponential(1)} rad)`)
  ok(Math.abs(p1.x - FP.HOLD_X) < 1e-4 && Math.abs(p1.y - FP.HOLD_Y) < 1e-4 && Math.abs(p1.z - FP.HOLD_Z) < 1e-4, 'hold position unchanged')
  // the way there: the turn away from rest never exceeds the rest->hold arc, and only grows (no tumble, no swing back)
  const s2 = newFpState(); const ang: number[] = []
  for (let k = 0; k < 120; k++) ang.push(angleQ(stepFpHands(s2, { ...base, now: k * 16.7, holding: true }, 1 / 60).R.q, qRest))
  const peak = Math.max(...ang), mono = ang.every((a, k) => k === 0 || a >= ang[k - 1] - 1e-6)
  ok(peak <= arc + 1e-4 && mono, `the turn grows steadily to the ${arc.toFixed(2)} rad arc and never past it (peak ${peak.toFixed(3)}, steady ${mono})`)
  // and back: putting it away retraces the same short way
  const back: number[] = []; for (let k = 0; k < 120; k++) back.push(angleQ(stepFpHands(s2, { ...base, now: (120 + k) * 16.7 }, 1 / 60).R.q, qHold))
  ok(Math.max(...back) <= arc + 1e-4, `putting it away turns back the short way too (peak ${Math.max(...back).toFixed(3)})`)
  // control: the old blend (pitch and roll lerped as angles) swings further than the arc on the way: the bug was real
  // control: the old blend (pitch and roll lerped as angles) TRAVELS much further than the arc: it wanders across axes on the way
  const path = (f: (t: number) => Quat) => { let L = 0, prev = f(0); for (let n = 1; n <= 200; n++) { const q = f(n / 200); L += angleQ(prev, q); prev = q } return L }
  // the control is pinned to the 11-21 am tune that showed the bug (rest -1.4/0.63, hold 1.89/-3.05, no twist): with the pm tune the
  // angle blend happens to run near the short arc, which says nothing about whether the quaternion path is right
  const [P0, R0, P1, R1] = [-1.4, 0.63, 1.89, -3.05], oldArc = angleQ(eulerQ(P0, 0, R0), eulerQ(P1, 0, R1))
  const oldLen = path(t => eulerQ(P0 + t * (P1 - P0), 0, R0 + t * (R1 - R0)))
  const s3 = newFpState(); let prevQ = s3.R.q, travelled = 0
  for (let k = 0; k < 200; k++) { const q = [...stepFpHands(s3, { ...base, now: k * 16.7, holding: true }, 1 / 60).R.q] as Quat; travelled += angleQ(prevQ, q); prevQ = q }
  ok(travelled <= arc * 1.02 && oldLen > oldArc + 0.5, `the glove now travels ${travelled.toFixed(2)} rad (= the ${arc.toFixed(2)} arc); the old angle blend travelled ${oldLen.toFixed(2)} rad on a ${oldArc.toFixed(2)} arc`)
  // no flip: holding through a run, a jump and a cast, no frame turns the glove more than a sliver
  //   (a flip shows as a frame far faster than the two motions it is made of: the plain Hold turn, and the run/jump/cast alone)
  const worstOf = (holding: (k: number) => boolean, busy: boolean) => { const st = newFpState(); let pq = st.R.q, w = 0
    for (let k = 0; k < 360; k++) { const q = [...stepFpHands(st, { ...base, now: k * 16.7, holding: holding(k), ...(busy ? { speed: FP.RUN_SPEED, airborne: k > 60 && k < 90, castAt: k > 100 ? 100 * 16.7 : -Infinity } : {}) }, 1 / 60).R.q] as Quat; w = Math.max(w, angleQ(pq, q)); pq = q } return w }
  const both = worstOf(k => k > 20, true), turn = worstOf(k => k > 20, false), moves = worstOf(() => false, true)
  ok(both <= turn + moves + 0.01, `holding through a run, a jump and a cast: worst frame ${both.toFixed(3)} rad <= the Hold turn's ${turn.toFixed(3)} + the moves' ${moves.toFixed(3)} (no mid-blend flip)`)
  // the way round is FIXED: sweep the pitch a run / jump / cast adds across its whole range; the half-way attitude never jumps
  // to the other side of the near-half-turn (the per-frame "shortest arc" would switch sides somewhere in here)
  let prevMid: Quat | null = null, mjump = 0
  for (let dp = -1.2; dp <= 1.2; dp += 0.01) { const q = holdTurn(FP.PITCH + dp, FP.ROLL - 0.8 * Math.max(0, dp), 0.5); if (prevMid) mjump = Math.max(mjump, angleQ(prevMid, q)); prevMid = q }
  ok(mjump < 0.05, `the half-way attitude moves smoothly with the offsets (largest step ${mjump.toFixed(3)} rad over 0.01 rad sweeps)`)
  // slerpQ's `side`: a 200 deg turn about x; shortest-arc goes the 160 deg way, side = +1 keeps the 200 deg way (the fixed-direction
  // guard for a retune whose rest + hold sit right at the half turn; with today's tune the sweep above never reaches that edge)
  { const a = eulerQ(0, 0, 0), b = eulerQ(200 * Math.PI / 180, 0, 0), dir = (q: Quat) => Math.sign(q[0])
    ok(dir(slerpQ(a, b, 0.5)) < 0 && dir(slerpQ(a, b, 0.5, 1)) > 0 && angleQ(slerpQ(a, b, 1, 1), b) < 1e-6, 'slerpQ: shortest arc by default, the given way round with side = +1') }
  // the turn starts gently (eased weight): the first frame of holding barely turns the glove
  const s5 = newFpState(); stepFpHands(s5, base, 1 / 60); const first = angleQ(stepFpHands(s5, { ...base, holding: true }, 1 / 60).R.q, qRest)
  ok(first < 0.06, `the turn eases in: the first frame turns ${first.toFixed(3)} rad`)
  // the left hand never turns: its orientation still equals its angles
  ok(angleQ(stepFpHands(s2, base, 1 / 60).L.q, eulerQ(FP.PITCH, 0, -FP.ROLL)) < 1e-3, 'the left hand keeps its rest attitude')
}
// ── 11-21: HOLD_YAW, the twist (Alex flipped the glove with pitch + roll because the Hold had no twist axis) ─────────────
{
  // (11-21 pm: the twist ships at Alex's tuned value; the settled hold above is asserted against eulerQ(.., HOLD_YAW, ..))
  // documented order: eulerQ(x, y, z) = qx(x) * qy(y) * qz(z) (three.js 'XYZ'), so the twist sits between tilt and roll
  const mul = (a: Quat, b: Quat): Quat => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]
  const ax = (i: 0 | 1 | 2, t: number): Quat => { const q: Quat = [0, 0, 0, Math.cos(t / 2)]; q[i] = Math.sin(t / 2); return q }
  let worst = 0
  for (const [p, y, r] of [[1.89, 0.7, -3.05], [-1.4, -2.2, 0.63], [0.3, 3.1, -0.9]]) worst = Math.max(worst, angleQ(eulerQ(p, y, r), mul(mul(ax(0, p), ax(1, y)), ax(2, r))))
  ok(worst < 1e-6, `eulerQ composes X * Y * Z (worst ${worst.toExponential(1)} rad)`)
  // with a twist set: rest is untouched (no yaw at rest) and the settled hold IS eulerQ(HOLD_PITCH, HOLD_YAW, HOLD_ROLL)
  const saved = FP.HOLD_YAW; FP.HOLD_YAW = 0.9
  const settle = (holding: boolean) => { const st = newFpState(); let q: Quat = st.R.q; for (let k = 0; k < 240; k++) q = [...stepFpHands(st, { ...base, now: k * 16.7, holding }, 1 / 60).R.q] as Quat; return q }
  const dRest = angleQ(settle(false), eulerQ(FP.PITCH, 0, FP.ROLL)), dHold = angleQ(settle(true), eulerQ(FP.HOLD_PITCH, 0.9, FP.HOLD_ROLL))
  ok(dRest < 1e-6 && dHold < 1e-4, `twist 0.9: rest unchanged (${dRest.toExponential(1)}), hold settles on the twisted attitude (${dHold.toExponential(1)})`)
  ok(angleQ(holdTurn(FP.PITCH, FP.ROLL, 1), eulerQ(FP.HOLD_PITCH, 0.9, FP.HOLD_ROLL)) < 1e-6, 'holdTurn at w=1 = the twisted hold')
  FP.HOLD_YAW = saved
}
console.log(`fp-hands-pose: ${pass} passed, ${fail} failed`); if (fail) process.exit(1)
