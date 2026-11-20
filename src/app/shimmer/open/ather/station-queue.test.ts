// Run: npx tsx src/app/shimmer/open/ather/station-queue.test.ts
// Station work (ather/station-queue.ts, BETA M43). The pins: STOCKPILE keeps 30 of each RAW input in the store and refines only
// the surplus, ONE item's worth of input at a time, a stack of 30 of each product, one product at a time (planks to 30, then bark);
// refining jobs only. FOCUS ignores both the reserve and the cap, uses all the material, then drops back to stockpile (also when
// the inputs run out). Offline catch-up from timestamps, bounded by surplus and caps; idle / unstaffed time is never banked.
import { advance, setFocus, cancelFocus, touch, maxAffordable, runsFor, statusOf, takeOut, adoptWork, jobById, itemMs, runMs, moglinSpeed, stockJobs, OUT_CAP, RESERVE, MAX_QTY, type Station } from './station-queue'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const n = (st: readonly { id: string; n: number }[] | undefined, id: string) => (st ?? []).reduce((a, s) => a + (s.id === id ? s.n : 0), 0)
const T0 = 1_000_000, HOUR = 3600_000
const carp = stockJobs('carpentry')
const logs = (k: number): Station => ({ store: [{ id: 'goldwood_log', n: k }] })

ok(RESERVE === 30 && OUT_CAP === 30 && MAX_QTY === 99, 'reserve 30, cap 30, quantity 99')
const plank = jobById('goldwood-plank')!
ok(itemMs(plank) === 4000 && runMs(plank) === 8000 && itemMs(jobById('stone-brick')!) === 6000 && itemMs(jobById('crystal-pane')!) === 8000, 'times: plank 4 s, brick 6 s, pane 8 s')
ok(itemMs(jobById('goldwood_stool')!) >= 20000 && itemMs(jobById('goldwood_stool')!) <= 60000, 'furniture 20-60 s')
ok(stockJobs('carpentry').every(j => j.in.length === 1) && stockJobs('cooking').length === 0 && stockJobs('alchemy').length === 0 && !stockJobs('carpentry').some(j => j.id === 'goldwood_stool'), 'stockpile = refining jobs only (never furniture, roasts, brews)')
ok(runsFor(plank, 10) === 5 && runsFor(plank, 500) === 50, '10 planks = 5 runs; the 99 cap')
ok(maxAffordable(plank, [{ id: 'goldwood_log', n: 7 }]) === 14 && maxAffordable(plank, [{ id: 'goldwood_log', n: 400 }]) === 99 && maxAffordable(plank, []) === 0, 'focus max = all the material (capped at 99)')

// STOCKPILE: 65 logs, the reserve keeps 30, only 35 are used; planks to 30 (15 logs), then bark to 30 (15 logs), then 5 left over go on
let s: Station = touch(logs(65), T0)
let r = advance(s, T0 + 100 * HOUR, 1, carp)
ok(n(r.station.store, 'goldwood_log') === 35, `65 logs: the 30 reserve is untouched, 30 used (planks 15 + bark 15) (${n(r.station.store, 'goldwood_log')} left)`)
ok(n(r.station.out, 'goldwood_plank') === 30 && n(r.station.out, 'goldwood_bark') === 30 && r.status === 'idle', `planks 30 (15 logs), bark 30 (15 logs), the last 5 surplus have no product left to make, idle (${n(r.station.out, 'goldwood_plank')}/${n(r.station.out, 'goldwood_bark')}, ${r.status})`)
ok(!r.station.work!.run, 'idle: no run started, nothing taken')
// 40 logs: 10 surplus = 20 planks, no bark yet (one product at a time)
r = advance(touch(logs(40), T0), T0 + 100 * HOUR, 1, carp)
ok(n(r.station.out, 'goldwood_plank') === 20 && n(r.station.out, 'goldwood_bark') === 0 && n(r.station.store, 'goldwood_log') === 30, '40 logs: 10 surplus -> 20 planks, 30 logs remain')
// at or under the reserve nothing happens
r = advance(touch(logs(30), T0), T0 + 100 * HOUR, 1, carp)
ok(!r.made.length && n(r.station.store, 'goldwood_log') === 30 && r.status === 'idle', '30 logs or fewer: it keeps them for you')
// inputs ONE run at a time: 1 s into a run, a single log is gone
r = advance(touch(logs(40), T0), T0 + 1000, 1, carp)
ok(n(r.station.store, 'goldwood_log') === 39 && !!r.station.work!.run && !r.made.length, 'one run started: one log taken, not the surplus')
// partial progress carries
r = advance(touch(logs(40), T0), T0 + 20_000, 1, carp)
ok(n(r.station.out, 'goldwood_plank') === 4 && r.station.work!.run!.t === 4000 && n(r.station.store, 'goldwood_log') === 37, '20 s = 2 runs and 4 s into the third')
// the output cap: with 29 planks a 2-plank run does not start (nothing is burned for nowhere to put it); a collect lets it on
const near: Station = { store: [{ id: 'goldwood_log', n: 50 }], out: [{ id: 'goldwood_plank', n: 29 }], work: { cur: 0, last: T0 } }
r = advance(near, T0 + HOUR, 1, carp)
ok(n(r.station.out, 'goldwood_plank') === 29 && n(r.station.out, 'goldwood_bark') > 0, 'planks at 29 cannot take a run of 2: it swaps to the next product')
r = advance({ store: [{ id: 'goldwood_log', n: 100 }], out: [{ id: 'goldwood_plank', n: 30 }], work: { cur: 0, last: T0 } }, T0 + 1000 * HOUR, 1, carp)
ok(n(r.station.out, 'goldwood_plank') === 30 && n(r.station.out, 'goldwood_bark') === 30 && n(r.station.store, 'goldwood_log') === 100 - 15, 'planks full: bark to 30 (15 logs), then idle')
r = advance({ ...r.station, out: takeOut(r.station, 'goldwood_plank', 10).station.out }, T0 + 2000 * HOUR, 1, carp)
ok(n(r.station.out, 'goldwood_plank') === 30, 'taking planks out refills the stack from the surplus')

// round-robin on the stack list: the pointer stays on a product until it is done, then moves on
const two = advance(touch({ store: [{ id: 'goldwood_log', n: 50 }, { id: 'shimmeroak_log', n: 50 }] }, T0), T0 + 1000 * HOUR, 1, carp)
ok(n(two.station.out, 'goldwood_plank') === 30 && n(two.station.out, 'goldwood_bark') === 10 && n(two.station.out, 'shimmeroak_plank') === 30 && n(two.station.out, 'amber_sap') === 5, 'each raw input has its own reserve and every one of its products gets its stack')

// OFFLINE catch-up: 5 min away = 37 runs worth of time, 20 s of work per... bounded by surplus
r = advance(touch(logs(40), T0), T0 + 60_000, 1, carp)
ok(n(r.station.out, 'goldwood_plank') === 14 && n(r.station.store, 'goldwood_log') === 32, 'a minute away: 7 runs done (14 planks), the 8th under way (8 logs taken)')
r = advance(touch(logs(40), T0), T0 + 12 * HOUR, 1, carp)
ok(n(r.station.out, 'goldwood_plank') === 20 && n(r.station.store, 'goldwood_log') === 30, '12 h away: bounded by the 10-log surplus')
// pace
ok(moglinSpeed(1) === 1 && moglinSpeed(5) === 2, 'moglin pace: fair x1, rare x2')
r = advance(touch(logs(40), T0), T0 + 8000, moglinSpeed(5), carp)
ok(n(r.station.out, 'goldwood_plank') === 4, 'a rare Moglin makes two runs in 8 s')
// nobody working (speed 0): nothing taken, the clock moves, nothing banked
r = advance(touch(logs(40), T0), T0 + 5 * HOUR, 0, carp)
ok(!r.made.length && n(r.station.store, 'goldwood_log') === 40 && r.station.work!.last === T0 + 5 * HOUR, 'unstaffed: nothing taken, no time banked')
// idle time is not banked: idle at 30 logs for an hour, then 10 logs arrive: it does not make an hour of planks at once
let idle = advance(touch(logs(30), T0), T0 + HOUR, 1, carp).station
idle = touch({ ...idle, store: [{ id: 'goldwood_log', n: 40 }] }, T0 + HOUR)   // the panel touches the clock when the store changes
r = advance(idle, T0 + HOUR + 8000, 1, carp)
ok(n(r.station.out, 'goldwood_plank') === 2, 'stocked after an idle hour: one run in 8 s, not an hour of crafting')

// FOCUS ignores the reserve and the cap
let f = setFocus(touch(logs(40), T0), 'goldwood-plank', maxAffordable(plank, logs(40).store), T0)
r = advance(f, T0 + 100 * HOUR, 1, [])
ok(n(r.station.out, 'goldwood_plank') === 80 && n(r.station.store, 'goldwood_log') === 0, `focus planks, max: ALL 40 logs -> 80 planks, logs 0, past the 30 cap and the reserve (${n(r.station.out, 'goldwood_plank')}, ${n(r.station.store, 'goldwood_log')})`)
ok(!r.station.work!.focus, 'the focus ends when the material is gone')
// a counted focus: 10 planks = exactly 5 logs, then back to stockpile (with a Moglin)
f = setFocus(touch(logs(40), T0), 'goldwood-plank', 10, T0)
r = advance(f, T0 + 5 * 8000, 1, carp)
ok(n(r.station.out, 'goldwood_plank') === 10 && n(r.station.store, 'goldwood_log') === 35 && !r.station.work!.focus, '10 planks cost exactly 5 logs; the focus is done')
r = advance(r.station, T0 + 5 * 8000 + 8000, 1, carp)
ok(n(r.station.out, 'goldwood_plank') === 12 || r.status !== 'idle', 'then it drops back to stockpile (35 logs: surplus 5 makes more)')
// focus without surplus: 20 logs, below the reserve, still made
r = advance(setFocus(touch(logs(20), T0), 'goldwood-bark', 99, T0), T0 + 100 * HOUR, 1, [])
ok(n(r.station.out, 'goldwood_bark') === 40 && n(r.station.store, 'goldwood_log') === 0, 'focus uses material under the reserve')
// focus stops on empty inputs mid-way and falls back to stockpile
r = advance(setFocus(touch(logs(3), T0), 'goldwood-plank', 99, T0), T0 + 100 * HOUR, 1, carp)
ok(n(r.station.out, 'goldwood_plank') === 6 && !r.station.work!.focus && r.status === 'idle', 'focus stops on empty inputs and drops back')
// furniture is focus-only
const fur = advance(setFocus(touch({ store: [{ id: 'goldwood_plank', n: 5 }] }, T0), 'goldwood_stool', 2, T0), T0 + HOUR, 1, carp)
ok(n(fur.station.out, 'goldwood_stool') === 2 && n(fur.station.store, 'goldwood_plank') === 1, 'furniture by focus, 2 stools = 4 planks')
ok(advance(touch({ store: [{ id: 'goldwood_plank', n: 99 }] }, T0), T0 + HOUR, 1, carp).made.length === 0, 'planks as furniture input are never auto-stockpiled into stools')
// keeper focus without Moglin: speed 1 and no stockpile list
r = advance(setFocus(touch(logs(40), T0), 'goldwood-plank', 10, T0), T0 + 40_000, 1, [])
ok(n(r.station.out, 'goldwood_plank') === 10, 'the keeper at the open bench: 10 planks in 40 s')
r = advance(touch(logs(40), T0), T0 + 40_000, 1, [])
ok(!r.made.length, 'no Moglin, no focus: nothing makes by itself')
// cancel a focus: only the run in progress is handed back
const mid = advance(setFocus(touch(logs(4), T0), 'goldwood-plank', 10, T0), T0 + 3000, 1, [])
const c = cancelFocus(mid.station)
ok(!c.work!.focus && !c.work!.run && n(c.store, 'goldwood_log') === 4, 'cancel focus: the run in progress returns its log, nothing else to refund')
ok(n(cancelFocus(setFocus(touch(logs(4), T0), 'goldwood-plank', 10, T0)).store, 'goldwood_log') === 4, 'cancel before anything started: nothing taken, nothing to hand back')
// stone: 1 blankstone = 3 bricks
r = advance(touch({ store: [{ id: 'blankstone', n: 34 }] }, T0), T0 + 1000 * HOUR, 1, stockJobs('stonemason'))
ok(n(r.station.out, 'stone_brick') === 12 && n(r.station.store, 'blankstone') === 30, 'stonery stockpile: 34 blankstone -> 4 used = 12 bricks')
// status
ok(statusOf(setFocus(touch(logs(5), T0), 'goldwood-plank', 4, T0), carp) === 'focus' && statusOf(touch(logs(40), T0), carp) === 'working' && statusOf(touch(logs(5), T0), carp) === 'idle', 'status: focus / working / idle')
// old saves
ok(adoptWork(undefined) === undefined && adoptWork({ last: 'x' }) === undefined, 'a save from before M43 loads with no work state')
ok(adoptWork({ last: 5, focus: { job: 'goldwood-plank', left: 500 }, run: { job: 'nope', t: 1 } })!.focus!.left === 99 && !adoptWork({ last: 5, run: { job: 'nope', t: 1 } })!.run, 'adoptWork clamps to 99 and drops unknown jobs')

console.log(`station-queue.test: ${pass} passed, ${fails.length} failed`)
for (const x of fails) console.log('  FAIL', x)
process.exit(fails.length ? 1 : 0)
