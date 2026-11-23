// Run: npx tsx src/app/shimmer/open/ather/void-fall.test.ts
// Void v2 (Alex 11-23 06:4x): a keeper who walks over the lip FALLS (lip -> falling -> dark -> the cost runs once). On a synthetic
// pit carved exactly as wilds-voids carves one: land 20 m, a 24 m void, the lip rolling over across VOID_FADE.
import { startFall, stepFall, FALL_BLACK_S, FALL_FLOOR_GAP } from './void-fall'
import { VOID_DEPTH, VOID_HALF, VOID_FADE, FALL_LIP } from './wilds-voids'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const sm = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }
const wOf = (x: number) => { const d = Math.abs(x); return d <= VOID_HALF ? 1 : d >= VOID_HALF + VOID_FADE ? 0 : 1 - sm((d - VOID_HALF) / VOID_FADE) }
const LAND = 20, ground = (x: number) => LAND - VOID_DEPTH * wOf(x)

// the keeper walks in from x = +30 toward the void at 3.5 m/s: where does the fall start?
let x = 30
while (wOf(x) < FALL_LIP) x -= 3.5 / 60
ok(x > VOID_HALF && x < VOID_HALF + VOID_FADE, `the fall starts on the lip (x ${x.toFixed(2)}, ${(LAND - ground(x)).toFixed(2)} m down)`)
const b = { px: x, py: ground(x), pz: 0 }, y0 = b.py
const st = startFall(b, 0.4, -3.5, 0, { x: -1, z: 0 })
ok(st.vy === 0 && !st.done && st.hvx <= -5, 'starts falling, never rising (a small upward vy is dropped), pushed off the lip into the void')

// step at 60 fps; record the y trace, the darkness, the frame the cost would run
const trace: number[] = []
let t = 0, doneAt = -1, prevDark = 0, monotone = true, prevY = b.py, neverRises = true, minAbove = Infinity
for (let f = 0; f < 60 * 4; f++) {
  const d = stepFall(st, b, 1 / 60, (px) => ground(px)); t += 1 / 60
  if (d < prevDark - 1e-9) monotone = false
  if (b.py > prevY + 1e-9) neverRises = false
  prevDark = d; prevY = b.py; minAbove = Math.min(minAbove, b.py - ground(b.px))
  if (f % 15 === 0) trace.push(+b.py.toFixed(2))
  if (st.done && doneAt < 0) doneAt = t
}
console.log(`   y trace (every 0.25 s): ${trace.slice(0, 8).join(' ')}`)
ok(trace[2] < y0 - 2 && trace[4] < trace[2] - 4, `the keeper drops under gravity (y ${y0.toFixed(1)} -> ${trace[2]} at 0.5 s -> ${trace[4]} at 1 s)`)
ok(neverRises, 'the body never rises during the fall')
ok(monotone, 'the veil only closes')
ok(doneAt > 0.8 && doneAt <= FALL_BLACK_S + 1e-6, `black (the cost runs) ${doneAt.toFixed(2)} s after the lip, inside the asked 1-2 s`)
ok(b.px < x, 'the run carries the keeper on into the void')
ok(Math.abs(b.px) < VOID_HALF + VOID_FADE, 'the keeper ends up inside the pit, not back on land')
ok(minAbove >= -1e-9, `the body never goes under the ground (min ${minAbove.toFixed(2)} m above it)`)
ok(b.py - ground(b.px) <= FALL_FLOOR_GAP + 1e-9 && ground(b.px) === LAND - VOID_DEPTH, `it comes to rest in the bottom of the column, on the pit floor (y ${b.py.toFixed(2)})`)
ok(st.done, 'done stays latched')

// a body already deep (a long tumble down the cliff) goes black sooner
const b2 = { px: 0, py: LAND, pz: 0 }, s2 = startFall(b2, -15, 0, 0)
let t2 = 0; while (!s2.done && t2 < 3) { stepFall(s2, b2, 1 / 60, (px) => ground(px)); t2 += 1 / 60 }
ok(t2 < doneAt, `a fast fall goes black sooner (${t2.toFixed(2)} s vs ${doneAt.toFixed(2)} s)`)

console.log(`void-fall: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
