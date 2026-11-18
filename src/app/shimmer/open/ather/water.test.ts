// Run: npx tsx src/app/shimmer/open/ather/water.test.ts
// The water tap + tanks (ather/water.ts). Numbers are absolute on purpose (never compared against the module's own constants
// alone): a tap = 6 water held, 1 water per 90 s per tap, a tank adds 6.
import { TAP, TANK, TANK_HOLD, FILL_MS, plumbingOf, capacityOf, levelOf, wholeOf, msToNext, settle, stale, draw, spillIfRemoved, adoptWater, freshWater, type WaterSave } from './water'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const T0 = 9_000_000, S = 1000

ok(TANK_HOLD === 6 && FILL_MS === 90 * S, 'numbers: tank 6, one water per 90 s')
ok(TAP === 'water_tap' && TANK === 'water_tank', 'ids')

// plumbing from pieces
const pl = plumbingOf([{ item: 'water_tap' }, { item: 'water_tank' }, { item: 'water_tank' }, { item: 'goldwood_stool' }])
ok(pl.taps === 1 && pl.tanks === 2, 'plumbingOf counts taps and tanks only')
ok(capacityOf(pl) === 18, 'one tap + two tanks hold 18')
ok(capacityOf({ taps: 0, tanks: 3 }) === 0, 'tanks with no tap hold nothing')
ok(capacityOf({ taps: 2, tanks: 0 }) === 12, 'two taps hold 12')

// no tap: nothing, ever
const none = freshWater(T0)
ok(levelOf(none, { taps: 0, tanks: 2 }, T0 + 3600 * S) === 0, 'no tap: no water after an hour')
const d0 = draw(none, { taps: 0, tanks: 0 }, T0); ok(!d0.ok && /water tap/.test(d0.why) && /Smithy/.test(d0.why), 'no tap: draw refused, names the tap')

// one tap: 1 per 90 s, capped at 6
const one = { taps: 1, tanks: 0 }
let sv: WaterSave = settle(freshWater(T0), one, T0)
ok(stale(freshWater(T0), one) && !stale(sv, one), 'stale until settled')
ok(wholeOf(sv, one, T0 + 89 * S) === 0 && wholeOf(sv, one, T0 + 90 * S) === 1, 'first water at exactly 90 s, not before')
ok(wholeOf(sv, one, T0 + 270 * S) === 3, '3 water at 270 s')
ok(wholeOf(sv, one, T0 + 3600 * S) === 6 && wholeOf(sv, one, T0 + 3600 * S) < 7, 'one tap caps at 6')
ok(msToNext(sv, one, T0 + 30 * S) === 60 * S, 'next water in 60 s at 30 s')
ok(msToNext(sv, one, T0 + 3600 * S) === null, 'full: no next')

// two taps fill twice as fast
const two = { taps: 2, tanks: 0 }
const sv2 = settle(freshWater(T0), two, T0)
ok(wholeOf(sv2, two, T0 + 45 * S) === 1 && wholeOf(sv2, two, T0 + 44 * S) === 0, 'two taps: first water at 45 s')

// ★ a tap set later never back-fills: a save that saw no tap credits nothing for the time before
const old = freshWater(T0)   // taps 0 when last seen
ok(wholeOf(old, one, T0 + 3600 * S) === 0, 'tap set later: no back-fill from before it stood')
const now1 = T0 + 3600 * S, re = settle(old, one, now1)
ok(wholeOf(re, one, now1 + 90 * S) === 1, 'after settle the new tap fills from the moment it was seen')

// draw
const full = settle(sv, one, T0 + 3600 * S)
const d1 = draw(full, one, T0 + 3600 * S, 1)
ok(d1.ok && wholeOf(d1.sv, one, T0 + 3600 * S) === 5, 'draw 1 from 6 leaves 5')
let s6 = full, t = T0 + 3600 * S
for (let i = 0; i < 6; i++) { const d = draw(s6, one, t); if (d.ok) s6 = d.sv }
const d7 = draw(s6, one, t); ok(!d7.ok && /Out of water/.test(d7.why), 'seventh draw from 6 refused (out of water)')
ok(wholeOf(s6, one, t + 90 * S) === 1, 'refills after drawing dry')
// partial progress kept across a draw
const half = settle(freshWater(T0), one, T0)
const dh = draw(half, one, T0 + 135 * S)   // 1.5 made, take 1, 0.5 left
ok(dh.ok && wholeOf(dh.sv, one, T0 + 135 * S + 44 * S) === 0 && wholeOf(dh.sv, one, T0 + 135 * S + 45 * S) === 1, 'draw keeps the half-made water')

// tanks + spill
const big = { taps: 1, tanks: 2 }
const bigFull = settle(settle(freshWater(T0), big, T0), big, T0 + 10 * 3600 * S)
ok(wholeOf(bigFull, big, T0 + 10 * 3600 * S) === 18, 'tap + 2 tanks fill to 18')
ok(spillIfRemoved(bigFull, big, TANK, T0 + 10 * 3600 * S) === 6, 'picking up a tank from 18 pours 6')
ok(spillIfRemoved(bigFull, big, TAP, T0 + 10 * 3600 * S) === 18, 'picking up the only tap pours everything')
ok(spillIfRemoved(bigFull, big, 'goldwood_stool', T0) === 0, 'a stool spills nothing')
const low = draw(bigFull, big, T0 + 10 * 3600 * S, 13); ok(low.ok && spillIfRemoved((low as { sv: WaterSave }).sv, big, TANK, T0 + 10 * 3600 * S) === 0, '5 left: a tank comes up dry, nothing spilt')
ok(wholeOf(bigFull, one, T0 + 10 * 3600 * S) === 6, 'after a tank goes, the level clamps to 6')

// adopt
ok(adoptWater(null, T0).n === 0 && adoptWater({ v: 2 }, T0).taps === 0, 'adopt: junk = fresh')
const a = adoptWater({ v: 1, n: 4.5, at: T0 + 999 * S, taps: 2 }, T0)
ok(a.n === 4.5 && a.at === T0 && a.taps === 2, 'adopt: a future stamp is pulled back to now (no clock-skew fill)')
ok(adoptWater({ v: 1, n: -3, at: T0 }, T0).n === 0 && adoptWater({ v: 1, n: 2, at: T0 }, T0).taps === 0, 'adopt: negative clamps, missing taps = 0')

console.log(`water: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
