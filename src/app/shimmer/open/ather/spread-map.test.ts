// Run: npx tsx src/app/shimmer/open/ather/spread-map.test.ts
// BETA M70 s2: the spread map's three states, neglect growth in game days, a champion clears, the first look fires once,
// the save round-trips, and the four signed spread.* lines are the canon file's text word for word.
import { readFileSync } from 'node:fs'
import { freshMap, areaState, uncover, tend, firstLook, changes, parseMap, LEGEND, growLine, clearLine, firstLine, GROW_MS, GROW_DAYS } from './spread-map'
import { GAME_DAY_MS } from './nodes'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const canon = readFileSync('/root/athernyx/CANON/game/shimmer-quest-glade-tutorial.md', 'utf8')
const cl = (id: string) => canon.split('\n').find(l => l.startsWith(`- \`${id}\``))!.replace(/^- `[^`]+`\s*(\[[^\]]*\]\s*)?/, '').replace(/^[A-Z]+:\s*/, '')
ok(LEGEND().join(' · ') === cl('spread.map.legend') && LEGEND().join() === 'Unseen,Clear,Hollow ground', `legend word for word (${LEGEND().join(' · ')})`)
ok(growLine('Mana Springs') === cl('spread.hud.grow').replace('{PLACE}', 'Mana Springs') && growLine('X') === 'Hollow ground is spreading near X.', 'grow toast, {PLACE} filled')
ok(clearLine() === cl('spread.hud.clear'), 'clear toast')
ok(firstLine() === cl('spread.map.first'), 'first-look line (Chamomile)')
const t0 = 1_000_000_000
let m = freshMap()
ok(areaState(m, 'a', true, t0) === 'unseen' && areaState(m, 'a', false, t0) === 'unseen', 'unvisited = Unseen, infected or not')
m = uncover(m, 'a', t0)
ok(areaState(m, 'a', true, t0) === 'clear', 'uncovered = Clear on arrival, even infected')
ok(uncover(m, 'a', t0 + 5 * GAME_DAY_MS) === m, 'walking through again does not tend it')
ok(GROW_DAYS >= 1 && GROW_MS > 60 * 60 * 1000, 'growth is slower than the tutorial hour')
ok(areaState(m, 'a', true, t0 + 60 * 60 * 1000) === 'clear', 'an hour in: still Clear')
ok(areaState(m, 'a', true, t0 + GROW_MS - 1) === 'clear' && areaState(m, 'a', true, t0 + GROW_MS) === 'hollow', 'neglected GROW_DAYS game days: Hollow ground')
ok(areaState(m, 'a', false, t0 + 10 * GROW_MS) === 'clear', 'a clean node stays Clear')
const m2 = tend(m, 'a', t0 + GROW_MS)
ok(areaState(m2, 'a', true, t0 + GROW_MS + 1) === 'clear', 'champion down: Clear, the clock restarts')
let f = firstLook(freshMap()); ok(!f.fire, 'no first look with nothing uncovered')
f = firstLook(m); ok(f.fire && f.m.first, 'first look fires'); ok(!firstLook(f.m).fire, '...once')
ok(JSON.stringify(changes({ a: 'clear', b: 'hollow', c: 'clear' }, { a: 'hollow', b: 'clear', c: 'clear', d: 'clear' })) === JSON.stringify({ grew: ['a'], cleared: ['b'] }), 'changes: grew + cleared, new areas silent')
const rt = parseMap(JSON.parse(JSON.stringify(f.m)))
ok(rt.first && rt.seen.a === t0, 'the save round-trips')
ok(parseMap(null).first === false && Object.keys(parseMap({ v: 1, seen: { x: 'no' } }).seen).length === 0, 'bad saves read fresh')
console.log(fail ? `FAIL ${fail} (pass ${pass})` : `PASS ${pass}`); process.exit(fail ? 1 : 0)
