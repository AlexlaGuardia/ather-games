// The hands' pose clock: every motion is a function of what the keeper is doing, and nothing else.
//
// Mutation-swept 2026-09-16: stride driven by time instead of distance (the bob-freezes assert) ·
// chop sign flipped · PLACE window off-by-one · cast env never released · lower not eased.
import { stepHands, newHandsState, BOB_Y, BREATH_Y, SWING_HZ, SWING_RAD, PLACE_MS, CAST_MS, LOWER_Y, type HandsInput } from './hands-pose'
import { RUN_SPEED } from './locomotion'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const DT = 1 / 60
const base = (over: Partial<HandsInput> = {}): HandsInput => ({ t: 0, now: 0, speed: 0, breaking: false, placeAt: -Infinity, castAt: -Infinity, hidden: false, ...over })
/** Run `n` frames from t=0, returning every pose. `f` shapes the input per frame. */
const run = (n: number, f: (i: number) => Partial<HandsInput>, s = newHandsState()) => {
  const out = []
  for (let i = 0; i < n; i++) out.push(stepHands(s, base({ t: i * DT, now: i * DT * 1000, ...f(i) }), DT))
  return out
}

// ── standing still: breath only ──
{
  const ps = run(300, () => ({}))
  ok(ps.every(p => Math.abs(p.dy) <= BREATH_Y + 1e-9 && Math.abs(p.dx) < 1e-9), 'standing: only the breath moves the hand, and only vertically')
  ok(ps.every(p => p.pitch === 0 && p.left === 0 && p.dz === 0), 'standing: no chop, no push, no wrist')
  ok(Math.max(...ps.map(p => p.dy)) > BREATH_Y * 0.9, 'the breath actually rises (a zero-amplitude breath passes the bound above)')
}

// ── walking: the bob is DISTANCE, not time ──
{
  const ps = run(120, () => ({ speed: RUN_SPEED }))
  ok(Math.min(...ps.map(p => p.dy)) < -BOB_Y * 0.9, `running: the footfall dips the hand by ~BOB_Y (${Math.min(...ps.map(p => p.dy)).toFixed(4)})`)
  ok(ps.every(p => p.dy <= BREATH_Y + 1e-9), 'running: a footfall is a DIP, never a rise past the breath')
  const s = newHandsState()
  run(30, () => ({ speed: RUN_SPEED }), s)
  const strideMoving = s.stride
  run(30, () => ({ speed: 0 }), s)
  ok(s.stride === strideMoving, '★ standing still, the stride does not advance — the bob freezes with the feet (a time-driven bob keeps walking while you stand)')
  const slow = run(120, () => ({ speed: RUN_SPEED * 0.3 }))
  ok(Math.min(...slow.map(p => p.dy)) > -BOB_Y * 0.5, 'a slow walk bobs less than a run')
}

// ── the chop ──
{
  const ps = run(60, () => ({ breaking: true }))
  const minPitch = Math.min(...ps.map(p => p.pitch))
  ok(minPitch < -SWING_RAD * 0.8, `breaking: the arm chops DOWN (min pitch ${minPitch.toFixed(3)}, SWING_RAD ${SWING_RAD})`)
  ok(ps.every(p => p.pitch <= 1e-9), 'breaking: a chop never pitches the arm UP')
  // cadence: the first down-stroke bottoms out within 40% of one swing
  const firstMin = ps.findIndex(p => p.pitch === minPitch)
  ok(firstMin * DT <= 0.4 / SWING_HZ + DT, `the first stroke lands by ${(0.4 / SWING_HZ).toFixed(2)}s (landed at ${(firstMin * DT).toFixed(2)}s)`)
  // release: after breaking stops the arm finishes its arc and rests within one swing period
  const s = newHandsState()
  run(20, () => ({ breaking: true }), s)
  const after = run(Math.ceil(1.2 / SWING_HZ / DT), () => ({ breaking: false }), s)
  ok(Math.abs(after[after.length - 1].pitch) < 1e-6, `released: the arm is at rest within a swing (${after[after.length - 1].pitch.toFixed(4)})`)
}

// ── the place tap ──
{
  const ps = run(60, () => ({ placeAt: 100 }))
  const during = ps.filter((_, i) => i * DT * 1000 > 100 && i * DT * 1000 < 100 + PLACE_MS)
  const afterP = ps.filter((_, i) => i * DT * 1000 >= 100 + PLACE_MS)
  ok(during.length > 3 && during.every(p => p.dz < 0), 'placing: a push FORWARD (−z) for the whole window')
  ok(afterP.every(p => p.dz === 0), 'placing: and nothing after it')
  ok(ps.filter((_, i) => i * DT * 1000 < 100).every(p => p.dz === 0), 'placing: nothing before it either')
}

// ── the cast ──
{
  const ps = run(90, () => ({ castAt: 50 }))
  const at = (ms: number) => ps[Math.round(ms / 1000 / DT)]
  ok(at(50 + CAST_MS * 0.3).left > 0.99, 'cast: the wrist is fully up by 30% of the cast')
  ok(at(50 + CAST_MS * 0.3).pitch > 0.3, 'cast: the glove is RAISED (pitch up) to aim')
  ok(at(50 + CAST_MS + 20).left === 0 && at(50 + CAST_MS + 20).pitch === 0, 'cast: wrist down and glove level once it is over')
  ok(ps[0].left === 0, 'cast: nothing before the stamp')
}

// ── lowered ──
{
  const s = newHandsState()
  const down = run(90, () => ({ hidden: true }), s)
  ok(down[0].dy > -LOWER_Y * 0.5, 'hidden: the first frame is NOT already gone — the drop is eased')
  ok(down[89].dy < -LOWER_Y * 0.95, 'hidden: and it is gone within 1.5s')
  const up = run(90, () => ({ hidden: false }), s)
  ok(Math.abs(up[89].dy) < BREATH_Y + 0.01, 'shown again: it comes back')
}

console.log(`hands-pose: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
