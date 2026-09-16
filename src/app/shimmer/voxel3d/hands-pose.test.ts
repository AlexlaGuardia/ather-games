// The hands' pose clock: every motion is a function of what the keeper is doing, and nothing else.
//
// Mutation-swept 2026-09-16: stride driven by time instead of distance (the bob-freezes assert) ·
// chop sign flipped · PLACE window off-by-one · cast env never released · lower not eased.
import { stepHands, newHandsState, BOB_Y, BREATH_Y, SWING_HZ, SWING_RAD, PLACE_MS, CAST_MS, LOWER_Y, LAND_DIP, type HandsInput } from './hands-pose'
import { RUN_SPEED } from './locomotion'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const DT = 1 / 60
const base = (over: Partial<HandsInput> = {}): HandsInput => ({
  t: 0, now: 0, speed: 0, vy: 0, breaking: false, placeAt: -Infinity, castAt: -Infinity, hidden: false,
  airborne: false, sliding: false, crouching: false, climbing: false, wallCatch: false, hanging: false, mantle: -1,
  swimming: false, landAt: -Infinity, landVy: 0, holding: false, ...over,
})
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
  run(30, () => ({ speed: 0 }), s)          // the eased speed settles inside this half second
  const strideStill = s.stride
  run(30, () => ({ speed: 0 }), s)
  ok(s.stride === strideStill, '★ standing still, the stride does not advance — the bob freezes with the feet (a time-driven bob keeps walking while you stand)')
  const slow = run(120, () => ({ speed: RUN_SPEED * 0.3 }))
  ok(Math.min(...slow.map(p => p.dy)) > -BOB_Y * 0.5, 'a slow walk bobs less than a run')
  // ★ the slide-jump (09-16): a slide at 10 blocks/s must not hammer the stride, and in the air
  // there are no footfalls at all
  const s2 = newHandsState(); run(60, () => ({ speed: RUN_SPEED }), s2); const perRun = s2.stride
  const s3 = newHandsState(); run(60, () => ({ speed: RUN_SPEED * 1.6 }), s3)
  ok(s3.stride < perRun * 1.12, `★ a slide (${(RUN_SPEED * 1.6).toFixed(1)} b/s) strides at the RUN'S cadence, not 1.6× it (${s3.stride.toFixed(2)} vs ${perRun.toFixed(2)}; the ease-in is the few % over)`)
  const air = run(90, () => ({ speed: RUN_SPEED, vy: 6 }))
  ok(Math.min(...air.slice(30).map(p => p.dy)) > -BOB_Y * 0.15, '★ airborne (vy 6): no footfalls — the hand floats')
  const s4 = newHandsState(); run(30, () => ({ speed: RUN_SPEED, vy: 6 }), s4); const st = s4.stride
  run(30, () => ({ speed: RUN_SPEED, vy: 6 }), s4)
  ok(s4.stride - st < 0.05, '★ airborne: the stride does not advance either')
  // the raw delta is spiky: a single-frame speed spike barely moves the eased speed
  const s5 = newHandsState(); stepHands(s5, base({ speed: 30 }), DT)
  ok(s5.speed < 30 * 0.3, `a one-frame spike is eased (${s5.speed.toFixed(2)} of 30)`)
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

// ── the body's verbs (09-16, Alex: "climbing, grabbing a ledge, holding an item, anything else") ──
// Each verb: on → its pose is there; off → it is gone; and it BLENDS (no single-frame snap).
{
  const settle = (over: Partial<HandsInput>) => { const s = newHandsState(); return run(60, () => over, s)[59] }
  const rest = settle({})
  const hang = settle({ hanging: true, airborne: true })
  ok(hang.pitch > 1.0 && hang.dy > 0.2 && hang.left > 0.99 && hang.leftPitch > 0.8, `hang: both hands up on the lip (pitch ${hang.pitch.toFixed(2)}, dy ${hang.dy.toFixed(2)}, left ${hang.left.toFixed(2)})`)
  const mantleEnd = settle({ mantle: 1 })
  ok(mantleEnd.pitch < hang.pitch - 0.5 && mantleEnd.dy < hang.dy - 0.2, 'mantle done: the hands have pressed the lip DOWN from the hang')
  const climb = run(120, () => ({ climbing: true, airborne: true }))
  const cp = climb.slice(30).map(p => p.pitch)
  ok(Math.max(...cp) - Math.min(...cp) > 0.5 && Math.min(...cp) > 0.4, 'climb: the reach ALTERNATES (pitch swings > 0.5 rad) and stays raised')
  const cl = climb.slice(30).map(p => p.leftDy)
  ok(Math.max(...cl) > 0.05 && Math.min(...cl) < -0.05, 'climb: the left hand pulls while the right reaches (opposite phase)')
  const catchP = settle({ wallCatch: true, airborne: true })
  ok(catchP.pitch > 0.8 && catchP.dz < -0.1 && catchP.left > 0.99, 'wall catch: the hand is flat on the wall in front, the other up to it')
  const air = settle({ airborne: true })
  ok(air.dy > rest.dy + 0.01 && air.pitch > 0.08, 'airborne: floaty — up and open')
  const slide = settle({ sliding: true })
  ok(slide.dy < -0.05 && slide.pitch < -0.2 && slide.dx > 0.04, 'slide: braced low and out')
  const crouch = settle({ crouching: true })
  ok(crouch.dy < -0.03 && crouch.dy > slide.dy, 'crouch: low, but not the slide\'s brace')
  const swim = run(180, () => ({ swimming: true }))
  const sp = swim.slice(60).map(p => p.pitch)
  ok(Math.max(...sp) - Math.min(...sp) > 0.7, 'swim: a slow full stroke')
  const hold = settle({ holding: true })
  ok(hold.pitch > 0.15 && hold.pitch < 0.25, 'holding: the fist comes up a touch, no more')
  // the landing dip, sized by the fall
  const soft = run(20, () => ({ landAt: 0, landVy: 3 })), hard = run(20, () => ({ landAt: 0, landVy: 12 }))
  ok(Math.min(...hard.map(p => p.dy)) < -LAND_DIP * 0.9 && Math.min(...soft.map(p => p.dy)) > -LAND_DIP * 0.35, 'landing: a hard fall dips deep, a hop barely')
  // blending: the first frame of a hang is not the settled hang
  const s = newHandsState(); const first = stepHands(s, base({ hanging: true, airborne: true }), DT)
  ok(first.pitch < hang.pitch * 0.5, `★ a verb BLENDS in (first frame ${first.pitch.toFixed(2)} of ${hang.pitch.toFixed(2)})`)
  // and hanging outranks airborne: no floaty drift on top of a grip
  ok(Math.abs(hang.dy - (settle({ hanging: true }).dy)) < 1e-6, '★ hanging outranks airborne — the air pose does not stack on the grip')
  // release: everything off → back to rest within a beat
  const s2 = newHandsState(); run(60, () => ({ hanging: true, airborne: true, sliding: true, swimming: true }), s2)
  const back = run(60, () => ({}), s2)[59]
  ok(Math.abs(back.pitch) < 0.02 && Math.abs(back.dy - rest.dy) < 0.02 && back.left < 0.02, 'every verb off: back at rest within a second')
}

console.log(`hands-pose: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
