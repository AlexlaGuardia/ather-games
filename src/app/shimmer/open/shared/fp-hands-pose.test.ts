// fp-hands-pose.ts: Alex's shape. Both gloves in view at rest, cuffs pointed AWAY from each other; on a run they take turns
// dropping out of view below the frame; a jump throws both up, the right higher.
import { newFpState, stepFpHands, FP, type FpInput } from './fp-hands-pose'
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
ok(still.R.roll > 1 && still.L.roll < -1, `cuffs point away from each other (roll R ${still.R.roll.toFixed(2)}, L ${still.L.roll.toFixed(2)})`)
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
console.log(`fp-hands-pose: ${pass} passed, ${fail} failed`); if (fail) process.exit(1)
