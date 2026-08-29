// Hollow-voice oracle. Run: npx tsx src/app/shimmer/voxel3d/hollow-voice.test.ts
//
// ★★ THE ASSERT THAT CARRIES THE FEATURE IS THE FRONT/BACK ONE. Everything else here is cadence
// and falloff, which would pass just as happily on a cue that cannot tell a keeper which way to
// turn — and telling them which way to turn IS the feature. Alex was hit by something he never
// saw; a footstep that does not carry a direction only tells him it will happen again.

import { stepVoices, loudness, newVoiceClock, DEFAULT_VOICE as D, type Voice, type Ear, type VoiceClock } from './hollow-voice'
import { PLAYER_EXCLUSION, PACK_MAX } from './hollows'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const ear = (x = 0, z = 0, yaw = 0): Ear => ({ x, z, yaw })
const body = (o: Partial<Voice> = {}): Voice =>
  ({ id: 'h1', x: 5, z: 0, form: 'stalker', speed: 3.9, ...o })
/**
 * Run n seconds at 60fps and collect everything heard.
 *
 * ⚠⚠ EVERY PHASE IS SEEDED, AND WITHOUT IT THIS SUITE IS DECIDED BY DICE. `hollow-voice.ts:164`
 * falls back to `Math.random() * stride` for a body it has not seen — legitimate in the game, where
 * a pack starting in lockstep would sound like one animal — but it means the number of emissions in
 * a fixed window varies per run. The throttle asserts sit near the ceiling by design, so the
 * twelve-vs-four monotonicity check flipped at **27 vs 28** in a full sweep while passing twelve
 * times out of twelve standing alone. ★ The tempting fix was to loosen that assert, and this file's
 * own comment already refuses it: *"nudge the number until the red goes green is how a threshold
 * stops meaning anything."* The dice were never the thing being tested.
 *
 * ★ SPREAD, NOT ZEROED. Setting every phase to 0 would make the pack fire in lockstep — an input the
 * game never produces, and one that would flatter a throttle by handing it a single burst instead of
 * a steady stream. An even spread across the stride is the distribution the randomness was reaching
 * for, minus the variance.
 */
function run(bodies: Voice[], e: Ear, secs: number, clock: VoiceClock = newVoiceClock()) {
  bodies.forEach((b, i) => {
    if (clock.phase[b.id] === undefined) clock.phase[b.id] = (i / bodies.length) * (D.strideAt1 / b.speed)
  })
  const out = []
  for (let i = 0; i < Math.round(secs * 60); i++) out.push(...stepVoices(clock, bodies, e, 1 / 60))
  return out
}

// ── 1. the warning has to arrive before the thing does ───────────────────────────────────────────
{
  ok(D.range > PLAYER_EXCLUSION,
    `★ a body forms at ${PLAYER_EXCLUSION} blocks, so a range of ${D.range} must exceed it or the first sound is already a close one`)
  ok(loudness(0) > loudness(10) && loudness(10) > loudness(25), 'nearer must be louder, monotonically')
  ok(loudness(D.range) === 0 && loudness(D.range + 5) === 0, 'past range is silent, and stays silent')
  ok(loudness(D.range * 0.5) < 0.5, '★ falloff is squared on purpose — half the range must be well under half the volume')
}

// ── 2. front and back must not sound the same ────────────────────────────────────────────────────
{
  const e = ear(0, 0, 0)                                     // facing +x
  const ahead = run([body({ x: 8, z: 0 })], e, 3)
  const rear = run([body({ x: -8, z: 0 })], e, 3)
  ok(ahead.length > 0 && rear.length > 0, 'both positions must actually be heard, or the rest of this block proves nothing')
  ok(ahead[0].muffle < 0.05, 'dead ahead must be unmuffled')
  ok(rear[0].muffle > 0.95, '★★★ DIRECTLY BEHIND MUST BE MUFFLED — stereo pan alone puts 4 and 8 o-clock in the same place, and behind is the whole point')
  const left = run([body({ x: 0, z: -8 })], e, 3)
  const right = run([body({ x: 0, z: 8 })], e, 3)
  ok(left[0].pan < -0.9 && right[0].pan > 0.9, '★★ the two flanks must pan to opposite sides')
  ok(Math.abs(left[0].muffle - right[0].muffle) < 0.05, '...and must be equally muffled, since neither is more behind you than the other')
  ok(Math.abs(ahead[0].pan) < 0.05 && Math.abs(rear[0].pan) < 0.05, 'dead ahead and dead behind both pan centre — which is exactly why muffle has to carry it')
  // ★ monotonic as you swing round, so a keeper can LEARN it rather than memorise four cases.
  let last = -1, monotonic = true
  for (let deg = 0; deg <= 180; deg += 15) {
    const a = (deg * Math.PI) / 180
    const em = run([body({ x: Math.cos(a) * 8, z: Math.sin(a) * 8 })], e, 3)
    if (!em.length || em[0].muffle < last - 1e-9) monotonic = false
    last = em.length ? em[0].muffle : last
  }
  ok(monotonic, '★ muffle must rise monotonically from ahead to behind — a cue you cannot learn is noise')
}

// ── 3. cadence: feet, not a siren ────────────────────────────────────────────────────────────────
{
  const fast = run([body({ id: 'f', speed: 3.9 })], ear(), 4)
  const slow = run([body({ id: 's', speed: 1.0 })], ear(), 4)
  ok(fast.length > slow.length, '★ faster feet must tick faster — the cadence IS the speed readout')
  ok(fast.length >= 4 && fast.length <= 20, `a 4-second approach must be a rhythm, not a drone or a single tap — got ${fast.length}`)
  const still = run([body({ speed: 0 })], ear(), 4)
  ok(still.length === 0, '★★ a body that is not walking must be SILENT — a footfall from something standing still is the cue lying about what it is doing')
  const crawling = run([body({ speed: D.moveFloor - 0.01 })], ear(), 4)
  ok(crawling.length === 0, '...and the floor must actually bite, not merely exist')
}

// ── 4. a pack is a rhythm, not a wall ────────────────────────────────────────────────────────────
{
  const pack: Voice[] = Array.from({ length: 4 }, (_, i) => body({ id: `p${i}`, x: 4 + i, z: i }))
  const heard = run(pack, ear(), 4)
  ok(heard.length > 0, 'a pack must be audible at all')
  // ⚠ THE BOUND IS maxPerSec PLUS THE EXEMPT NEAREST BODY, and it is written that way rather than
  // padded, because the tempting fix for a red count is to widen the slack until it passes — and
  // that would have hidden the exemption instead of describing it. The nearest body is never rate
  // limited (see stepVoices), so the honest ceiling is the bucket plus one body's own cadence.
  const soloCadence = run([body({ id: 'solo', x: 4, z: 0 })], ear(), 4).length
  const bound = D.maxPerSec * 4 + soloCadence + 2   // +2 = the bucket's burst reserve
  ok(heard.length <= bound,
    `★ the per-second ceiling must bite — ${heard.length} in 4s against ${D.maxPerSec}/s + one exempt body (${soloCadence}) = ${bound}`)
  // ⚠ I NEARLY ASSERTED THAT A FULL PACK IS NEVER THROTTLED, AND THE DATA SAYS OTHERWISE: PACK_MAX
  // is 4 and four stalkers demand about 8 footfalls a second against a ceiling of 7, so a legal
  // pack loses roughly a quarter of them. That is a claim I invented while writing the test, and
  // the honest move was to delete the claim rather than raise the ceiling to satisfy it — a 7/s
  // rhythm still tells a keeper everything they need, and "nudge the number until the red goes
  // green" is how a threshold stops meaning anything.
  //
  // What IS a contract: throttling must degrade gracefully. More bodies must never yield FEWER
  // total sounds, or a big pack goes quieter than a small one and the cue inverts exactly when the
  // danger is highest.
  const crowd = Array.from({ length: 12 }, (_, i) => body({ id: `c${i}`, x: 4 + i * 0.3, z: i * 0.2 }))
  const crowdHeard = run(crowd, ear(), 4).length
  ok(crowdHeard >= heard.length,
    `★★ twelve bodies must never sound QUIETER than four — ${crowdHeard} vs ${heard.length}`)
  // ⚠ COMPARED TO THE BOUND, NOT TO THE UNLIMITED DEMAND. Asserting `crowdHeard < 12 * solo` was
  // marginal by exactly one sample: with the ceiling switched off entirely the crowd lands ON that
  // number, so random stride phases decided whether the assert fired. A mutation that handed every
  // body the nearest-body exemption — i.e. no ceiling at all — walked through it. The bound is the
  // real contract and the gap is decisive: ~38 with the ceiling, ~96 without.
  ok(crowdHeard <= bound,
    `★★ twelve bodies must obey the SAME ceiling as four — ${crowdHeard} against ${bound}`)
  ok(PACK_MAX === 4, 'the pack size this was reasoned against is still 4 — if it moves, re-measure the ceiling')
  // ★★ AND IT MUST DROP THE FAR ONE, NEVER THE CLOSE ONE.
  // ⚠ MEASURED AGAINST THE ALONE CASE, NOT AGAINST ZERO. The first version asserted `nearHeard > 0`
  // and a mutation that REVERSED the ranking — dropping the close body for the far crowd — sailed
  // straight through it, because tokens replenish and something always squeaks past. "It was heard
  // at all" is not the claim; "it was not starved by a crowd" is. Found by the mutation sweep.
  const near = body({ id: 'near', x: 2, z: 0 })
  const far = Array.from({ length: 12 }, (_, i) => body({ id: `far${i}`, x: 20 + i * 0.1, z: 0 }))
  const alone = run([near], ear(), 4).length
  const clock: VoiceClock = newVoiceClock()
  let nearHeard = 0
  for (let i = 0; i < 240; i++) for (const em of stepVoices(clock, [near, ...far], ear(), 1 / 60)) {
    if (em.id === 'near') nearHeard++
  }
  ok(alone >= 5, `the baseline must be a real cadence to compare against — ${alone} in 4s alone`)
  ok(nearHeard >= alone - 1,
    `★★★ the body about to hit you must never be starved by a crowd 20 blocks away — ${nearHeard} heard in a pack vs ${alone} alone`)
}

// ── 5. out of range is forgotten, not remembered ─────────────────────────────────────────────────
{
  const clock: VoiceClock = newVoiceClock()
  stepVoices(clock, [body({ id: 'gone', x: 3, z: 0 })], ear(), 1 / 60)
  ok(Object.keys(clock.phase).length === 1, 'a body in range keeps a stride phase')
  stepVoices(clock, [body({ id: 'gone', x: D.range + 10, z: 0 })], ear(), 1 / 60)
  ok(clock.phase.gone === undefined, '★ a body that walked out of range must drop its phase, or the clock grows forever across a night of spawns')
  ok(stepVoices(newVoiceClock(), [], ear(), 1 / 60).length === 0, 'no bodies, no sound')
  ok(stepVoices(newVoiceClock(), [body()], ear(), 0).length === 0, 'a zero-length frame emits nothing')
}

if (fails.length) { console.error(`❌ ${fails.length} failed:`); for (const f of fails) console.error('   · ' + f); process.exit(1) }
console.log(`✅ you can hear which way to turn — ${pass} passed`)
