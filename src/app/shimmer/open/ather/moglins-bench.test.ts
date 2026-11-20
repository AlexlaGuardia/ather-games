// Run: npx tsx src/app/shimmer/open/ather/moglins-bench.test.ts
// Moglin BENCH WORK (moglins.ts › BENCH_JOBS / benchRun / tick): a cook roasts and an alchemist brews from the room's
// store only, at the craft grade's pace; a stall banks nothing; the 12 h cap holds; the wrong room does nothing.
import { tick, assign, freshVillage, dutyLine, PER_HOUR, type MoglinRecord, type Village } from './moglins'
import { freshWorks, type Works, type Room } from './rooms'
import { ROAST } from './cooking'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const H = 3_600_000, T0 = 1_000 * H
const mog = (id: string, profession: MoglinRecord['profession'], craft: 1 | 2 | 3 | 4 | 5, room?: string): MoglinRecord =>
  ({ id, name: id, home: 's', grades: { craft, yield: 1, trade: 1 }, dream: '', profession, recruitedAt: 0, room, acc: 0 })
const room = (id: string, kind: Room['kind'], store: Room['store']): Room => ({ id, kind, x: 0, z: 0, q: 0, placedAt: 0, doneAt: 0, store })
const count = (w: Works, rid: string, id: string) => (w.rooms.find(r => r.id === rid)?.store ?? []).reduce((a, s) => a + (s.id === id ? s.n : 0), 0)

// ONE TICKER (M43 fold): the village tick no longer eats a cook/alchemy store; the station stockpile (station-queue) does.
import { advance, stockJobs, moglinSpeed, OUT_CAP, RESERVE, setFocus } from './station-queue'
import { BREW } from './alchemy'
const sc = (n: number) => [{ id: 'shimmerscale', n }]
const W: Works = { ...freshWorks(), rooms: [room('k', 'cooking', sc(60))] }
const V: Village = { v: 1, moglins: [mog('heath', 'cook', 1, 'k')], lastTick: T0 }
const t = tick(V, W, T0 + 2 * H)
ok(!Object.keys(t.made).length && count(t.works, 'k', 'shimmerscale') === 60, 'village tick still eats a cooking store (double ticker)')
ok(stockJobs('cooking') === ROAST && stockJobs('alchemy') === BREW, 'cooking / alchemy are not stockpile rooms')
// the stockpile with a fair cook, 1 h: 60 stocked keeps the 30 reserve; 30 surplus roasts into the OUTPUT at 8 s a roast / speed 1
const st0 = { store: sc(60), out: undefined as undefined, work: { cur: 0, last: T0 } }
const a = advance(st0, T0 + H, moglinSpeed(1), stockJobs('cooking'))
const outN = (a.station.out ?? []).reduce((n, x) => n + (x.id === 'roast_rinn' ? x.n : 0), 0)
ok(outN === OUT_CAP && count({ ...W, rooms: [room('k', 'cooking', a.station.store)] }, 'k', 'shimmerscale') === RESERVE, 'cook stockpile: reserve kept / 30 roasted')
// input conservation across BOTH tickers on the same store+time: every scale gone is a roast made, none eaten twice
const both = tick(V, { ...W, rooms: [room('k', 'cooking', a.station.store as Room['store'])] }, T0 + H)
const left = count(both.works, 'k', 'shimmerscale') + outN
ok(left === 60, 'a scale was eaten twice (village + station)')
// a focus is the only way past the reserve, and the village tick leaves it alone too
const f = advance(setFocus(st0, 'roast-roast_rinn', 99, T0), T0 + 10 * H, moglinSpeed(5), stockJobs('cooking'))
ok((f.station.store ?? []).length === 0 && (f.station.out ?? []).reduce((n, x) => n + x.n, 0) === 60, 'cook focus: all 60 scales roasted once')
// pace is the CRAFT grade: rare cook is x2 a fair one (station speed)
ok(moglinSpeed(5) === 2 * moglinSpeed(1), 'pace: craft grade')
// the alchemist brews a Shard Tonic through the stockpile too
const A = [{ id: 'raw_mana_shard', n: 36 }, { id: 'goldwood_bark', n: 34 }]
const ab = advance({ store: A, work: { cur: 0, last: T0 } }, T0 + 5 * H, 1, stockJobs('alchemy'))
ok((ab.station.out ?? []).some(x => x.id === 'shard_tonic' && x.n > 0), 'alchemist: no tonic from the stockpile')
ok(!Object.keys(tick({ v: 1, moglins: [mog('sorrel', 'alchemist', 1, 'a')], lastTick: T0 }, { ...freshWorks(), rooms: [room('a', 'alchemy', A)] }, T0 + H).made).length, 'village tick brewed from the alchemy store')
// the wrong trade in a room works nothing; assign refuses it anyway
const tw = tick({ v: 1, moglins: [mog('x', 'alchemist', 5, 'k')], lastTick: T0 }, W, T0 + 3 * H)
ok(!Object.keys(tw.made).length, 'a trade worked a room that is not its own')
ok(assign(freshVillage(T0), W, 'nobody', 'k') === null && assign({ v: 1, moglins: [mog('x', 'alchemist', 1)], lastTick: T0 }, W, 'x', 'k', T0) === null, 'assign: let an alchemist keep the cooking room')
ok(!!assign({ v: 1, moglins: [mog('h', 'cook', 1)], lastTick: T0 }, W, 'h', 'k', T0), 'assign: refused a cook the cooking room')
ok(/stock/i.test(dutyLine(mog('h', 'cook', 2), 'cooking')) && /yet/.test(dutyLine(mog('h', 'cook', 2), 'rinnshop')), 'duty: lines')
if (fails.length) { console.error(`moglins-bench: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`moglins-bench: ${pass}/0`)
