// npx tsx src/app/shimmer/open/ather/train-daily.test.ts
// BETA M239b (Alex 11-27): a spirit active in the garden trains ONCE A GAME DAY: one allowed piece, one play, her point, done.
// Several allowed: a random pick seeded per spirit + day. None allowed: she never trains. Driven through the real trot too.
import { dailyPiece, makeOccupancy } from './training-use'
import { withPlay, trainedOn, parseRec, type StatBook } from './spirit-stats'
import { makeTrot, type Toy } from './spirit-trot'
import { footBlocked, plotFootprints, playSize } from './obstacles'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }

// 1. the book refuses a second session the same game day, and takes one the next day
{
  const d = 812
  const a = withPlay({}, 'p1', 'fox', 'grd', 1, d)
  ok(a.rose === 1 && !a.refused && a.book.p1.day === d && a.book.p1.plays === 1, 'first session of the day: +1, stamped with the day')
  const b = withPlay(a.book, 'p1', 'fox', 'agi', 1, d)
  ok(b.refused === true && b.rose === 0, 'a second session the same day is refused')
  ok(b.book === a.book && b.book.p1.plays === 1 && !b.book.p1.g.agi, 'the refused session changes nothing')
  ok(trainedOn(a.book.p1, d) && !trainedOn(a.book.p1, d + 1) && !trainedOn(undefined, d), 'trainedOn reads the day')
  const c = withPlay(b.book, 'p1', 'fox', 'agi', 1, d + 1)
  ok(c.rose === 1 && c.book.p1.day === d + 1 && c.book.p1.plays === 2, 'the next day she trains again')
  const o = withPlay(a.book, 'p2', 'fox', 'grd', 1, d)
  ok(o.rose === 1, 'one spirit\'s session does not spend another\'s')
  const u = withPlay(withPlay({}, 'p1', 'fox', 'grd').book, 'p1', 'fox', 'grd')
  ok(u.rose === 1 && !u.refused, 'no day given (the old callers): no daily rule')
  ok(parseRec(JSON.parse(JSON.stringify(a.book.p1)))?.day === d, 'the day survives a save and load')
  ok(parseRec({ g: {}, plays: 1, day: 'x' })?.day === undefined, 'a junk day is dropped')
}

// 2. the pick: none allowed = no piece; deterministic per spirit + day; order does not matter; random across pieces and days
{
  ok(dailyPiece([], 'p1', 5) === null, 'no allowed piece: she never trains')
  ok(dailyPiece(['gp'], 'p1', 5) === 'gp', 'one allowed piece: that one')
  const L = ['gp', 'hd', 'ps', 'rr']
  ok(dailyPiece(L, 'p1', 9) === dailyPiece([...L].reverse(), 'p1', 9), 'same spirit + day = same piece, whatever the order')
  ok(dailyPiece(L, 'p1', 9) === dailyPiece(L, 'p1', 9), 'deterministic')
  const n: Record<string, number> = {}
  for (let s = 0; s < 40; s++) for (let d = 0; d < 50; d++) { const p = dailyPiece(L, `pot-${s}`, 800 + d)!; n[p] = (n[p] ?? 0) + 1 }
  ok(L.every(p => (n[p] ?? 0) > 2000 * 0.2 && (n[p] ?? 0) < 2000 * 0.3), `even across the allowed pieces (${JSON.stringify(n)})`)
  const days = new Set(Array.from({ length: 30 }, (_, d) => dailyPiece(L, 'p1', 900 + d)))
  ok(days.size === 4, `one spirit's pick changes day to day (${days.size} of 4 in 30 days)`)
  const sp = new Set(Array.from({ length: 30 }, (_, s) => dailyPiece(L, `pot-${s}`, 900)))
  ok(sp.size === 4, `spirits differ on one day (${sp.size} of 4)`)
}

// 3. through the real trot, the way workshop planterNav wires it: a whole game day of roaming = ONE session, at today's piece
{
  const pcs = [{ id: 'gp', item: 'guard_posts', x: -1.5, z: 2.6 }, { id: 'rr', item: 'running_ring', x: 2.2, z: 3 }, { id: 'hd', item: 'goldwood_hurdle', x: 0, z: -3 }]
  const feet = plotFootprints(pcs), r = 0.42
  const all: Toy[] = [{ id: 'gp', x: -1.5, z: 2.6, ax: 0, az: 1, stat: 'grd', kind: 'guard', size: playSize('guard_posts', r)! },
    { id: 'rr', x: 2.2, z: 3, ax: 0, az: 1, stat: 'vig', kind: 'laps', size: playSize('running_ring', r)! },
    { id: 'hd', x: 0, z: -3, ax: 0, az: 1, stat: 'agi', kind: 'leap' }]
  for (const [allowed, day] of [[['gp', 'rr', 'hd'], 700], [['gp', 'rr', 'hd'], 701], [['gp', 'rr'], 702], [['rr'], 703], [[], 704]] as const) {
    let book: StatBook = {}, granted = 0, refused = 0
    const at: string[] = [], want = dailyPiece(allowed, 'p1', day)
    const toys = () => { if (trainedOn(book.p1, day)) return []; const mine = all.filter(t => (allowed as readonly string[]).includes(t.id)); return mine.filter(t => t.id === dailyPiece(mine.map(m => m.id), 'p1', day)) }
    const t = makeTrot({ home: { x: 0, z: 0 }, rMin: 1, rMax: 1.6, roam: { maxLeg: 4.5, away: 3 }, toys, occ: makeOccupancy(),
      blocked: (x, z, toy) => Math.abs(x) > 6 || Math.abs(z) > 6 || footBlocked(feet, x, z, r, toy) }, 11)
    t.near(() => ({ x: 0, z: 1.2, yaw: 0 }))
    t.onPlayed((id, stat) => { at.push(id); const w = withPlay(book, 'p1', 'fox', stat as 'grd', 1, day); if (w.refused) refused++; else { granted++; book = w.book } })
    for (let i = 0; i < 30 * 900; i++) t.step(1 / 30)
    if (want === null) ok(at.length === 0 && granted === 0, `day ${day}: nothing allowed, she never trains (${at.length} plays)`)
    else {
      ok(granted === 1 && refused === 0, `day ${day}: exactly one session (granted ${granted}, refused ${refused}, plays ${at.length})`)
      ok(at.every(id => id === want), `day ${day}: she played today's pick ${want} only (${at.join(',')})`)
    }
  }
}

console.log(`train-daily: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
