// Day/night clock oracle — run: npx tsx src/app/shimmer/engine/day-cycle.test.ts
//
// The bug this file exists for: the first cut declared the phase boundaries as their own constants
// next to the light curve, and they drifted immediately — the HUD read DUSK at 19:00 while the sky
// had finished going dark at 18:51. Nothing crashed, nothing logged; the label was just a lie for
// an hour of every day. So the headline assert is that the NAME and the LIGHT agree at every one of
// the day's 1440 game-minutes, which is a property no amount of eyeballing one screenshot can give.
//
// The rest guards what the spawner layer is about to build on: that the world-reset boundaries land
// exactly on midnight and noon, and that the clock is a pure function of wall time (same instant →
// same answer, on every machine, with nothing persisted). If that purity ever breaks, two people
// standing in the same field would deal different boards and nobody would find out for weeks.

import {
  CYCLE_MS, dayProgress, getPhase, getDisplayTime, daylight, silver,
  sunElevation, sunAzimuth, resetIndex, msUntilPhase, isTimePinned,
} from './day-cycle'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { console.log(`  ok    ${label}`); return }
  failures++
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps
const MINUTES = 24 * 60
const atHour = (h: number) => h / 24

console.log('\nday-cycle oracle\n')

console.log('shape of the day')
{
  check('a day is 64 real minutes', CYCLE_MS === 64 * 60 * 1000)
  // 2^6 is the point: every subdivision a reset schedule might want stays a whole minute.
  check('...which halves and quarters into whole minutes',
    (CYCLE_MS / 2) % 60000 === 0 && (CYCLE_MS / 4) % 60000 === 0 && (CYCLE_MS / 8) % 60000 === 0)
  check('progress 0 is midnight', getDisplayTime(0) === '00:00')
  check('progress 0.5 is noon', getDisplayTime(0.5) === '12:00')
  check('the clock has no offset — progress maps straight to the hour', getDisplayTime(atHour(7)) === '07:00')
}

console.log('\nthe sun')
{
  check('is lowest at midnight', near(sunElevation(0), -1))
  check('is highest at noon', near(sunElevation(0.5), 1))
  check('crosses the horizon at 06:00', Math.abs(sunElevation(atHour(6))) < 1e-9)
  check('...and again at 18:00', Math.abs(sunElevation(atHour(18))) < 1e-9)
  check('rises in the east', sunAzimuth(atHour(6)) > 0.99)
  check('and sets in the west', sunAzimuth(atHour(18)) < -0.99)

  check('full daylight at noon', near(daylight(0.5), 1))
  check('no daylight at midnight', near(daylight(0), 0))
  check('silver is exactly the inverse', near(silver(0.3) + daylight(0.3), 1))
  check('daylight never leaves 0..1', Array.from({ length: MINUTES }, (_, i) => daylight(i / MINUTES)).every(d => d >= 0 && d <= 1))

  // Monotone over each half-day: no flicker where a smoothstep meets a clamp.
  let mono = true
  for (let i = 1; i <= 12 * 60; i++) {
    if (daylight(i / MINUTES) < daylight((i - 1) / MINUTES) - 1e-12) mono = false
  }
  check('daylight rises monotonically from midnight to noon', mono)
}

console.log('\n★ the label agrees with the light')
{
  // The regression that motivated this file. Checked at every game-minute, not at a few samples,
  // because the original drift was only ~an hour wide and sat entirely between round hours.
  let bad = 0
  let firstBad = ''
  for (let i = 0; i < MINUTES; i++) {
    const p = i / MINUTES
    const d = daylight(p)
    const ph = getPhase(p)
    const ok = ph === 'night' ? d <= 0.02 : ph === 'day' ? d >= 0.98 : (d > 0.02 && d < 0.98)
    if (!ok) { bad++; if (!firstBad) firstBad = `${getDisplayTime(p)} says ${ph} at daylight ${d.toFixed(3)}` }
  }
  check(`no phase label contradicts the sky, across all ${MINUTES} game-minutes`, bad === 0, firstBad)

  check('midnight is night', getPhase(0) === 'night')
  check('noon is day', getPhase(0.5) === 'day')
  check('the morning seam is dawn, not dusk', getPhase(atHour(6)) === 'dawn')
  check('the evening seam is dusk, not dawn', getPhase(atHour(18)) === 'dusk')

  // Four phases, each a single unbroken run — a phase appearing twice would mean the curve
  // wobbles across a threshold, which reads on screen as the sky flickering at the seam.
  const runs: string[] = []
  let prev = ''
  for (let i = 0; i < MINUTES; i++) {
    const ph = getPhase(i / MINUTES)
    if (ph !== prev) { runs.push(ph); prev = ph }
  }
  // The day starts mid-night and ends mid-night, so night legitimately bookends the list.
  const collapsed = runs[0] === 'night' && runs[runs.length - 1] === 'night' ? runs.slice(0, -1) : runs
  check('the day is exactly night → dawn → day → dusk', collapsed.join(' → ') === 'night → dawn → day → dusk', runs.join(' → '))

  const seams = MINUTES - Array.from({ length: MINUTES }, (_, i) => getPhase(i / MINUTES)).filter(p => p === 'day' || p === 'night').length
  check('the seams are long enough to watch (>1 real minute each)', (seams / MINUTES) * CYCLE_MS / 2 > 60_000,
    `${((seams / MINUTES) * CYCLE_MS / 2 / 1000).toFixed(0)}s each`)
}

console.log('\nworld-reset boundaries (what the spawner layer keys on)')
{
  // Two resets a day must land on midnight and noon, or the "board is re-dealt at a legible moment"
  // premise quietly becomes "the board is re-dealt at 03:47".
  const half = CYCLE_MS / 2
  check('a reset window is 32 real minutes', half === 32 * 60 * 1000)
  for (const [t, want] of [[0, '00:00'], [half, '12:00'], [half * 2, '00:00'], [half * 3, '12:00']] as [number, string][]) {
    check(`t=+${t / 60000}min lands on ${want}`, getDisplayTime(dayProgress(t)) === want)
  }
  check('the index advances once per window', resetIndex(0) + 1 === resetIndex(half) && resetIndex(half) + 1 === resetIndex(half * 2))
  check('...and is stable anywhere inside one', resetIndex(1000) === resetIndex(half - 1000))
}

console.log('\npurity (what makes offline + multiplayer work)')
{
  const t = 1785400000000
  check('the same instant always gives the same hour', dayProgress(t) === dayProgress(t) && getPhase(dayProgress(t)) === getPhase(dayProgress(t)))
  check('a full cycle later is the same hour', near(dayProgress(t), dayProgress(t + CYCLE_MS), 1e-12))
  check('the world moves while the tab is closed', dayProgress(t) !== dayProgress(t + CYCLE_MS / 3))
  check('negative/epoch-zero times do not produce a negative hour',
    dayProgress(0) >= 0 && dayProgress(-CYCLE_MS * 1.5) >= 0 && dayProgress(-1) >= 0)
  check('the pin is off outside a browser', isTimePinned() === false)
}

console.log('\nscheduling')
{
  const ms = msUntilPhase('night', 0)
  check('midnight is already night, so the next one is nearly a day away', ms > CYCLE_MS * 0.5, `${(ms / 60000).toFixed(1)} min`)
  for (const phase of ['dawn', 'day', 'dusk', 'night'] as const) {
    const d = msUntilPhase(phase, 0)
    check(`${phase} is reachable within a day`, d > 0 && d <= CYCLE_MS, `${(d / 60000).toFixed(1)} min`)
  }
}

console.log(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} failing`}\n`)
process.exit(failures === 0 ? 0 : 1)
