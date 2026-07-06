// Rinning cast-and-catch — run: npx tsx src/app/shimmer/engine/rinning.test.ts
import { newCast, phaseAt, hook, hookQuality, type RinCast } from './rinning'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps

// a deterministic cast: bite at 1000ms, 800ms window
const c: RinCast = { startMs: 0, biteMs: 1000, windowMs: 800 }

// phases across the timeline
chk('waiting before the bite', phaseAt(c, 500) === 'waiting')
chk('waiting right up to the bite', phaseAt(c, 999) === 'waiting')
chk('bite at the window open', phaseAt(c, 1000) === 'bite')
chk('bite mid-window', phaseAt(c, 1400) === 'bite')
chk('bite at the last instant', phaseAt(c, 1799) === 'bite')
chk('gotaway once the window passes', phaseAt(c, 1800) === 'gotaway')

// hooking
chk('hook too early → gotaway', hook(c, 700) === 'gotaway')
chk('hook in the window → caught', hook(c, 1200) === 'caught')
chk('hook too late → gotaway', hook(c, 2000) === 'gotaway')

// quality: 1 at the window open, →0 at the window end, 0 outside
chk('quality 1.0 at bite open', near(hookQuality(c, 1000), 1))
chk('quality ~0.5 mid-window', near(hookQuality(c, 1400), 0.5))
chk('quality →0 at window end', near(hookQuality(c, 1799), 0.00125, 1e-4))
chk('quality 0 before bite', hookQuality(c, 900) === 0)
chk('quality 0 after window', hookQuality(c, 2000) === 0)

// newCast: bite lands in the intended 0.9–3.0s band, given rng 0..1
{
  const lo = newCast(0, () => 0)
  const hi = newCast(0, () => 0.999999)
  chk('newCast earliest bite ~900ms', near(lo.biteMs, 900))
  chk('newCast latest bite ~3000ms', hi.biteMs > 2900 && hi.biteMs <= 3000, `${hi.biteMs}`)
  chk('newCast window is a real reaction window', lo.windowMs >= 500)
}

console.log(`\nrinning: ${ok} passed, ${bad} failed`)
if (bad) process.exit(1)
