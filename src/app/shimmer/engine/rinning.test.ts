// Rinning cast-and-catch — run: npx tsx src/app/shimmer/engine/rinning.test.ts
//
// Rewritten 2026-07-09 against the classic-cast engine (bc6deb8). The old test still imported
// `hookQuality` and asserted a `'waiting'` phase, both deleted in that rewrite — it crashed on run
// while looking like coverage. Phases are now wait → bite → gotaway; `hook` returns a boolean.
import { newCast, phaseAt, hook, type RinCast } from './rinning'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

// a deterministic cast: bite opens at 1000ms, `!` stays up for 800ms
const c: RinCast = { startMs: 0, biteMs: 1000, windowMs: 800 }

// phases across the timeline
chk('wait before the bite', phaseAt(c, 500) === 'wait')
chk('wait right up to the bite', phaseAt(c, 999) === 'wait')
chk('bite at the window open', phaseAt(c, 1000) === 'bite')
chk('bite mid-window', phaseAt(c, 1400) === 'bite')
chk('bite at the last instant', phaseAt(c, 1799) === 'bite')
chk('gotaway once the window passes', phaseAt(c, 1800) === 'gotaway')

// phases respect startMs (the walker casts at an arbitrary clock time, not 0)
{
  const late: RinCast = { startMs: 5000, biteMs: 1000, windowMs: 800 }
  chk('offset cast still waits', phaseAt(late, 5500) === 'wait')
  chk('offset cast bites on time', phaseAt(late, 6000) === 'bite')
  chk('offset cast lapses on time', phaseAt(late, 6800) === 'gotaway')
}

// hooking — caught only while the `!` is up
chk('hook too early → slips', hook(c, 700) === false)
chk('hook one tick before the bite → slips', hook(c, 999) === false)
chk('hook at the window open → caught', hook(c, 1000) === true)
chk('hook in the window → caught', hook(c, 1200) === true)
chk('hook at the last instant → caught', hook(c, 1799) === true)
chk('hook too late → slips', hook(c, 2000) === false)

// newCast: bite lands in the intended 0.9–3.0s band, given rng 0..1
{
  const lo = newCast(0, () => 0)
  const hi = newCast(0, () => 0.999999)
  chk('newCast earliest bite ~900ms', lo.biteMs === 900)
  chk('newCast latest bite ~3000ms', hi.biteMs > 2900 && hi.biteMs <= 3000, `${hi.biteMs}`)
  chk('newCast window is a real reaction window', lo.windowMs >= 500)
  chk('newCast carries the cast time', newCast(5000, () => 0).startMs === 5000)
}

console.log(`\nrinning: ${ok} passed, ${bad} failed`)
if (bad) process.exit(1)
