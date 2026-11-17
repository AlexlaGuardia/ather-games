// keeper-pose.ts: the walk reads as a walk, every action is finite, and the cast lights the seat.
import { poseKeeper, stepTime, KEEPER_ACTIONS, STRIDE_S } from './keeper-pose'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
for (const a of KEEPER_ACTIONS) for (let t = 0; t < 3; t += 0.037) {
  const p = poseKeeper(a, t)
  const nums = [p.hipY, p.hipRoll, p.torsoPitch, p.torsoYaw, p.headPitch, ...[p.armL, p.armR, p.legL, p.legR].flatMap(l => [l.pitch, l.roll, l.bend])]
  if (!nums.every(Number.isFinite)) { ok(false, `${a} at ${t.toFixed(2)}: a non-finite angle`); break }
}
ok(true, 'all actions finite')
// contralateral: when the left leg is forward (negative pitch), the RIGHT arm is forward too
let contra = 0, n = 0
for (let t = 0; t < STRIDE_S.walk; t += 0.05) { const p = poseKeeper('walk', t); if (Math.abs(p.legL.pitch) > 0.1) { n++; if (Math.sign(p.legL.pitch) === Math.sign(p.armR.pitch)) contra++ } }
ok(n > 0 && contra === n, `walk is contralateral (${contra}/${n})`)
// the knee bends while its leg travels forward, and is near straight while it travels back (planted)
let swingBend = 0, plantBend = 0
for (let t = 0; t < STRIDE_S.walk; t += 0.01) {
  const a = poseKeeper('walk', t), b = poseKeeper('walk', t + 0.01)
  if (b.legL.pitch < a.legL.pitch) swingBend = Math.max(swingBend, a.legL.bend); else plantBend = Math.max(plantBend, a.legL.bend)
}
ok(swingBend > 0.5 && plantBend < 0.2, `knee bends on the swing (${swingBend.toFixed(2)}) not the plant (${plantBend.toFixed(2)})`)
ok(poseKeeper('run', 0.3).torsoPitch < poseKeeper('walk', 0.3).torsoPitch, 'a run leans further forward than a walk')
ok(Math.max(...[0, 0.35, 0.7, 1.05].map(t => poseKeeper('cast', t).seat)) > 0.8 && poseKeeper('idle', 0).seat < 0.3, 'a cast lights the glove seat; idle keeps it dim')
ok(poseKeeper('swing', 0.3).held === 'blade' && poseKeeper('aim', 0).held === 'gun' && poseKeeper('walk', 0).held === 'none', 'held item follows the action')
ok(poseKeeper('aim', 0).armR.pitch < -1.3, 'aim: the right arm is out level')
ok(stepTime(0.149, 12) === 1 / 12 && stepTime(0.149, 0) === 0.149, 'stepTime quantises the clock, 0 = smooth')
console.log(`keeper-pose: ${pass} passed, ${fail} failed`); if (fail) process.exit(1)
