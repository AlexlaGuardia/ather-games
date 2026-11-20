// Run: npx tsx src/app/shimmer/open/ather/station-queue.test.ts
// Station queue (ather/station-queue.ts, BETA M43). The pins: inputs leave the store ONE RUN at a time (never the batch);
// the queue pauses on empty inputs and on a full output (30 of an item) and resumes; offline catch-up from timestamps is
// bounded by inputs and the cap; the 99 cap; cancel hands back only the run in progress; no worker banks no time.
import { advance, enqueue, cancel, dequeue, maxAffordable, runsFor, statusOf, takeOut, adoptQueue, jobById, itemMs, runMs, moglinSpeed, OUT_CAP, MAX_QTY, type Station } from './station-queue'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const n = (st: readonly { id: string; n: number }[] | undefined, id: string) => (st ?? []).reduce((a, s) => a + (s.id === id ? s.n : 0), 0)
const T0 = 1_000_000

// times: plank 4 s/item, a run of 2 planks = 8 s
const plank = jobById('goldwood-plank')!
ok(itemMs(plank) === 4000 && runMs(plank) === 8000, 'plank: 4 s an item, 8 s a run of two')
ok(itemMs(jobById('stone-brick')!) === 6000 && itemMs(jobById('crystal-pane')!) === 8000, 'brick 6 s, pane 8 s')
ok(itemMs(jobById('goldwood_stool')!) >= 20000 && itemMs(jobById('goldwood_stool')!) <= 60000, 'furniture 20-60 s')

// quantity: 10 planks = 5 runs; the 99 cap; max-affordable follows the store
ok(runsFor(plank, 10) === 5 && runsFor(plank, 99) === 50 && runsFor(plank, 500) === 50, '10 planks = 5 runs, 99 caps the batch')
ok(maxAffordable(plank, [{ id: 'goldwood_log', n: 7 }]) === 14 && maxAffordable(plank, [{ id: 'goldwood_log', n: 400 }]) === MAX_QTY && maxAffordable(plank, []) === 0, 'max-affordable: 7 logs = 14 planks, capped at 99, none = 0')
let s: Station = { store: [{ id: 'goldwood_log', n: 20 }] }
ok(enqueue(s, 'goldwood-plank', 500, T0).queue!.items[0].left === 50, 'enqueue clamps to 99 items')
ok(enqueue(enqueue(s, 'goldwood-plank', 90, T0), 'goldwood-plank', 90, T0).queue!.items[0].left === 50, 'a second add still caps at 99 items')

// inputs ONE RUN at a time: 10 planks queued, 20 logs stocked; after 1 run's time only 1 log is gone
s = enqueue(s, 'goldwood-plank', 10, T0)
ok(n(s.store, 'goldwood_log') === 20, 'queueing takes nothing')
let r = advance(s, T0 + 1000, 1)
ok(n(r.station.store, 'goldwood_log') === 19 && r.station.queue!.run && n(r.station.out, 'goldwood_plank') === 0, 'one run started: ONE log taken, not the batch')
r = advance(r.station, T0 + 8000, 1)
ok(n(r.station.out, 'goldwood_plank') === 2 && n(r.station.store, 'goldwood_log') === 19 - 0 || n(r.station.store, 'goldwood_log') === 18, 'a finished run lands in the output')
// the whole batch: 5 logs gone exactly, 10 planks out
r = advance(s, T0 + 5 * 8000 + 5, 1)
ok(n(r.station.out, 'goldwood_plank') === 10 && n(r.station.store, 'goldwood_log') === 15 && !r.station.queue, `10 planks cost exactly 5 logs, queue done (${n(r.station.out, 'goldwood_plank')}, ${n(r.station.store, 'goldwood_log')})`)

// pause on EMPTY inputs: 3 logs for 10 planks asked = 6 made, then stops; no time banked while empty
let e: Station = enqueue({ store: [{ id: 'goldwood_log', n: 3 }] }, 'goldwood-plank', 10, T0)
r = advance(e, T0 + 10 * 3600_000, 1)
ok(n(r.station.out, 'goldwood_plank') === 6 && n(r.station.store, 'goldwood_log') === 0 && r.status === 'empty' && r.station.queue!.items[0].left === 2, `stops on empty inputs, 2 runs still queued (${n(r.station.out, 'goldwood_plank')}, ${r.status})`)
ok(!r.station.queue!.run && r.station.queue!.t === 0, 'an empty queue holds no half-run')
// resume when stocked: the hours spent waiting do not count
let r2 = advance({ ...r.station, store: [{ id: 'goldwood_log', n: 5 }] }, T0 + 10 * 3600_000 + 8000, 1)
ok(n(r2.station.out, 'goldwood_plank') === 6 + 2 && r2.status === 'working', 'stocked again: it resumes at one run per 8 s, the idle hours are not banked')

// pause on a FULL output (30): never burns a log it cannot place
const big = enqueue({ store: [{ id: 'goldwood_log', n: 50 }] }, 'goldwood-plank', 99, T0)
r = advance(big, T0 + 99 * 3600_000, 1)
ok(n(r.station.out, 'goldwood_plank') === OUT_CAP && n(r.station.store, 'goldwood_log') === 50 - 15 && r.status === 'full', `pauses at ${OUT_CAP} in the output, 15 logs spent, the rest kept (${n(r.station.out, 'goldwood_plank')}, ${n(r.station.store, 'goldwood_log')}, ${r.status})`)
ok(!r.station.queue!.run, 'full: no run started')
// empty the output, it goes on
const t = takeOut(r.station, 'goldwood_plank', 10)
ok(t.took === 10 && n(t.station.out, 'goldwood_plank') === 20 && statusOf(t.station) === 'working', 'taking from the output frees room and the queue resumes')
const t2 = takeOut(r.station, 'goldwood_plank')
ok(t2.took === 30 && !t2.station.out!.length, 'take all of an item')

// OFFLINE catch-up from timestamps: a Moglin for 1 h at fair pace (speed 1): 450 runs of capacity, but 50 queued, inputs 50, cap 30 -> bounded
r = advance(big, T0 + 3600_000, 1)
ok(n(r.station.out, 'goldwood_plank') === 30, 'an hour away: capped by the output (30)')
const small = enqueue({ store: [{ id: 'goldwood_log', n: 50 }] }, 'goldwood-plank', 10, T0)
r = advance(small, T0 + 3600_000, 1)
ok(n(r.station.out, 'goldwood_plank') === 10 && n(r.station.store, 'goldwood_log') === 45, 'an hour away: 10 queued is 10 made, 5 logs')
// partway offline: 20 s = 2 runs and 4 s into the third
r = advance(small, T0 + 20_000, 1)
ok(n(r.station.out, 'goldwood_plank') === 4 && r.station.queue!.run && r.station.queue!.t === 4000 && n(r.station.store, 'goldwood_log') === 47, 'partial progress carries (t = 4 s into the third run)')
// a faster Moglin
ok(moglinSpeed(1) === 1 && moglinSpeed(5) === 2, 'moglin pace: fair x1, rare x2')
r = advance(small, T0 + 8000, moglinSpeed(5))
ok(n(r.station.out, 'goldwood_plank') === 4, 'a rare Moglin makes two runs in 8 s')
// nobody working: the clock moves on, nothing banked, no input taken
r = advance(small, T0 + 3600_000, 0)
ok(n(r.station.out, 'goldwood_plank') === 0 && n(r.station.store, 'goldwood_log') === 50 && !r.station.queue!.run && r.station.queue!.last === T0 + 3600_000, 'no worker: nothing taken, no time banked')

// two jobs in order; cancel refunds only the run in progress
let two = enqueue(enqueue({ store: [{ id: 'goldwood_log', n: 4 }] }, 'goldwood-plank', 2, T0), 'goldwood-bark', 2, T0)
r = advance(two, T0 + 8000 + 4000, 1)
ok(n(r.station.out, 'goldwood_plank') === 2 && r.station.queue!.items[0].job === 'goldwood-bark' && r.station.queue!.run, 'jobs run in order')
const c = cancel(r.station)
ok(!c.queue && n(c.store, 'goldwood_log') === 3 && n(c.out, 'goldwood_plank') === 2, 'cancel: the run in progress is handed back (3 logs of 4, 1 used for the finished one), finished output kept')
const c0 = cancel(enqueue({ store: [{ id: 'goldwood_log', n: 4 }] }, 'goldwood-plank', 10, T0))
ok(!c0.queue && n(c0.store, 'goldwood_log') === 4, 'cancel with nothing started: nothing to refund, store untouched')
ok(!dequeue(enqueue({}, 'goldwood-plank', 4, T0), 'goldwood-plank').queue, 'dequeue the only job clears the queue')

// stone: 1 blankstone = 3 bricks, a run is 18 s
const st = enqueue({ store: [{ id: 'blankstone', n: 4 }] }, 'stone-brick', 99, T0)
r = advance(st, T0 + 1000 * 3600, 1)
ok(n(r.station.out, 'stone_brick') === 12 && r.status === 'empty', 'stonery: 4 blankstone = 12 bricks')

// old saves: no queue, no output
ok(adoptQueue(undefined) === undefined && adoptQueue({ items: 'x' }) === undefined && adoptQueue({ items: [{ job: 'nope', left: 3 }] }) === undefined, 'a save from before M43 (or junk) loads with an empty queue')
ok(adoptQueue({ items: [{ job: 'goldwood-plank', left: 500 }], t: 1, run: true, last: 5 })!.items[0].left === 99, 'adoptQueue clamps to 99')
ok(advance({}, T0, 1).status === 'idle', 'no queue is idle')

console.log(`station-queue.test: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  FAIL', f)
process.exit(fails.length ? 1 : 0)
