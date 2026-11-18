// Run: npx tsx src/app/shimmer/open/ather/moglins-bench.test.ts
// Moglin BENCH WORK (moglins.ts › BENCH_JOBS / benchRun / tick): a cook roasts and an alchemist brews from the room's
// store only, at the craft grade's pace; a stall banks nothing; the 12 h cap holds; the wrong room does nothing.
import { tick, benchRun, assign, freshVillage, dutyLine, PER_HOUR, type MoglinRecord, type Village } from './moglins'
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

// a fair cook (craft 1 = 3 an hour), 2 hours, 10 shimmerscale stocked → 6 roast rinn, 4 shimmerscale left
const W: Works = { ...freshWorks(), rooms: [room('k', 'cooking', [{ id: 'shimmerscale', n: 10 }])] }
const V: Village = { v: 1, moglins: [mog('heath', 'cook', 1, 'k')], lastTick: T0 }
const t = tick(V, W, T0 + 2 * H)
ok(count(t.works, 'k', 'roast_rinn') === 2 * PER_HOUR(1) && count(t.works, 'k', 'shimmerscale') === 10 - 2 * PER_HOUR(1), 'cook: wrong number roasted in 2 h')
ok(t.made.roast_rinn === 6 && t.village.lastTick === T0 + 2 * H, 'cook: made / lastTick')
// a rare cook (craft 5 = 7 an hour) with only 3 to roast: stalls at 3, banks nothing
const t2 = tick({ ...V, moglins: [mog('heath', 'cook', 5, 'k')] }, { ...W, rooms: [room('k', 'cooking', [{ id: 'shimmerscale', n: 3 }])] }, T0 + 2 * H)
ok(count(t2.works, 'k', 'roast_rinn') === 3 && t2.village.moglins[0].acc === 0, 'cook: a stall banked work to cash later')
// fractions carry: 10 minutes of a fair cook = half a roast, nothing made yet, acc kept
const t3 = tick(V, W, T0 + 10 * 60_000)
ok(!t3.made.roast_rinn && Math.abs((t3.village.moglins[0].acc ?? 0) - 0.5) < 1e-9, 'cook: a part-roast did not carry')
// pace is the CRAFT grade, not yield: a rare-craft, fair-yield cook roasts 7 in an hour
const tc = tick({ ...V, moglins: [mog('heath', 'cook', 5, 'k')] }, { ...W, rooms: [room('k', 'cooking', [{ id: 'shimmerscale', n: 20 }])] }, T0 + H)
ok(count(tc.works, 'k', 'roast_rinn') === PER_HOUR(5), 'pace: bench work does not run on the craft grade')
// the 12 h cap: a week away credits 12 h at most
const t4 = tick(V, { ...W, rooms: [room('k', 'cooking', [{ id: 'shimmerscale', n: 99 }])] }, T0 + 7 * 24 * H)
ok(count(t4.works, 'k', 'roast_rinn') === 12 * PER_HOUR(1), 'cap: more than 12 h credited')
// store only: the keeper's bag is never touched (tick never sees it), and an empty store makes nothing
ok(!tick(V, { ...W, rooms: [room('k', 'cooking', [])] }, T0 + 5 * H).made.roast_rinn, 'cook: roasted from an empty store')
// the alchemist brews a Shard Tonic from the alchemy store
const A: Works = { ...freshWorks(), rooms: [room('a', 'alchemy', [{ id: 'raw_mana_shard', n: 6 }, { id: 'goldwood_bark', n: 4 }])] }
const ta = tick({ v: 1, moglins: [mog('sorrel', 'alchemist', 1, 'a')], lastTick: T0 }, A, T0 + H)
ok(count(ta.works, 'a', 'shard_tonic') === 2 && count(ta.works, 'a', 'raw_mana_shard') === 0, 'alchemist: wrong brews from the store')
// the wrong trade in a room works nothing; assign refuses it anyway
const tw = tick({ v: 1, moglins: [mog('x', 'alchemist', 5, 'k')], lastTick: T0 }, W, T0 + 3 * H)
ok(!Object.keys(tw.made).length, 'a trade worked a room that is not its own')
ok(assign(freshVillage(T0), W, 'nobody', 'k') === null && assign({ v: 1, moglins: [mog('x', 'alchemist', 1)], lastTick: T0 }, W, 'x', 'k', T0) === null, 'assign: let an alchemist keep the cooking room')
ok(!!assign({ v: 1, moglins: [mog('h', 'cook', 1)], lastTick: T0 }, W, 'h', 'k', T0), 'assign: refused a cook the cooking room')
// benchRun: full store refuses (the output must fit)
const full = Array.from({ length: 16 }, (_, i) => ({ id: i === 0 ? 'shimmerscale' : `junk${i}`, n: 1 }))
ok(benchRun(full, ROAST[0]) !== null, 'benchRun: an input slot freeing up should make room')
ok(/an hour/.test(dutyLine(mog('h', 'cook', 2), 'cooking')) && /yet/.test(dutyLine(mog('h', 'cook', 2), 'rinnshop')), 'duty: lines')
if (fails.length) { console.error(`moglins-bench: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`moglins-bench: ${pass}/0`)
