// Run: npx tsx src/app/shimmer/open/ather/spread-map.test.ts
// BETA M70 s2 + M121: the spread map's four states, the first section grey on a fresh save only, the daily roll (seeded, grace,
// cap per catch-up, share ceiling, exempt sections), a pre-M121 save keeps every state, a champion clears, the save round-trips,
// and the four signed spread.* lines are the canon file's text word for word.
import { readFileSync } from 'node:fs'
import { AREA_STATES, STATE_LOOK, freshMap, areaState, uncover, tend, firstLook, changes, parseMap, startRule, rollSections, sectionRoll, dayOf, LEGEND, growLine, clearLine, firstLine, SECTION_RULE as R, PRE_M121_GROW_MS, type SpreadMap } from './spread-map'
import { clearAt, freshSpread, infectedIds } from './spread'
import { GAME_DAY_MS as D, ownerOf, type WildsNode } from './nodes'
import { SETTLEMENT, pickTarget } from './first-settlement'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const canon = readFileSync('/root/athernyx/CANON/game/shimmer-quest-glade-tutorial.md', 'utf8')
const cl = (id: string) => canon.split('\n').find(l => l.startsWith(`- \`${id}\``))!.replace(/^- `[^`]+`\s*(\[[^\]]*\]\s*)?/, '').replace(/^[A-Z]+:\s*/, '')
ok(LEGEND().filter(w => w !== 'Charted').join(' · ') === cl('spread.map.legend') && LEGEND().join() === 'Unseen,Charted,Clear,Hollow ground', `legend word for word (${LEGEND().join(' · ')})`)
ok(growLine('Mana Springs') === cl('spread.hud.grow').replace('{PLACE}', 'Mana Springs') && growLine('X') === 'Hollow ground is spreading near X.', 'grow toast, {PLACE} filled')
ok(clearLine() === cl('spread.hud.clear'), 'clear toast')
ok(firstLine() === cl('spread.map.first'), 'first-look line (Chamomile)')

const t0 = 1000 * D + 5
const NONE = new Set<string>(), yes = () => true
const start = (o: Partial<Parameters<typeof startRule>[1]> = {}, m = freshMap()) => startRule(m, { fresh: true, firstId: 'home', infected: yes, now: t0, seed: 42, ...o })
// ── a fresh save: the first section grey, every other discovered one clear ──
let m = start()
ok(areaState(m, 'home', true) === 'unseen', 'unvisited = Unseen, even the first section')
m = uncover(m, 'home', t0)
ok(areaState(m, 'home', true) === 'hollow', 'fresh: the first section is Hollow ground')
for (const id of ['a', 'b', 'c']) { m = uncover(m, id, t0); ok(areaState(m, id, true) === 'charted' && areaState(m, id, false) === 'clear', `fresh: ${id} is Charted when discovered, Clear once cleared`) }
ok(uncover(m, 'a', t0 + 5 * D) === m, 'walking through again does not tend it')
ok(startRule(m, { fresh: true, firstId: 'a', infected: yes, now: t0 + D, seed: 9 }) === m, 'the rule starts once: a reload neither re-seeds nor re-greys')
m = tend(m, 'home', t0 + 1)
ok(areaState(m, 'home', false) === 'clear' && m.grey.home === undefined, 'its champion down: Clear')
ok(areaState(startRule(parseMap(JSON.parse(JSON.stringify(m))), { fresh: true, firstId: 'home', infected: yes, now: t0 + 9 * D, seed: 1 }), 'home', true) === 'charted', 'a cleared first section is never turned Hollow ground by a reload')

// M121 s2: the toasts follow the four states; Unseen -> Charted says nothing
{ const c = (p: string, n: string) => { const r = changes({ a: p as never }, { a: n as never }); return `${r.grew.length}${r.cleared.length}` }
  ok(c('charted', 'hollow') === '10' && c('clear', 'hollow') === '10', 'Charted or Clear turning Hollow ground: the grow toast')
  ok(c('charted', 'clear') === '01' && c('hollow', 'clear') === '01', 'cleared from Charted or Hollow ground: the clear toast')
  ok(c('unseen', 'charted') === '00' && c('charted', 'charted') === '00' && Object.keys(changes({}, { a: 'charted' }).grew).length === 0, 'discovering ground: no toast') }
// M121 s2: the four looks tell apart (fill + line + dash), one table for both maps and the legend
ok(AREA_STATES.length === 4 && new Set(AREA_STATES.map(s => STATE_LOOK[s].fill)).size === 4 && new Set(AREA_STATES.map(s => STATE_LOOK[s].line)).size === 4, 'four states, four fills, four lines')

// ── a pre-M121 save: every section unchanged, nothing rolled for the time before ──
{
  const old = { v: 1, seen: { tired: t0 - PRE_M121_GROW_MS, edge: t0 - PRE_M121_GROW_MS + 1, kept: t0 - 400 * D, home: t0 - 1 }, first: true }
  const inf = (id: string) => id !== 'kept'
  const was = (id: string) => (t0 - (old.seen as Record<string, number>)[id] >= PRE_M121_GROW_MS && inf(id) ? 'hollow' : inf(id) ? 'charted' : 'clear')   // the old rule, written out (M121 s2: what it showed Clear without a clear is Charted)
  const n = startRule(parseMap(old), { fresh: false, firstId: 'home', infected: inf, now: t0, seed: 3 })
  for (const id of Object.keys(old.seen)) ok(areaState(n, id, inf(id)) === was(id), `old save: ${id} stays ${was(id)} (${areaState(n, id, inf(id))})`)
  ok(areaState(n, 'home', true) === 'charted' && areaState(n, 'new', true) === 'unseen', 'old save: the first section is not re-infected; unseen stays unseen')
  ok(n.first && JSON.stringify(n.seen) === JSON.stringify(old.seen), 'old save: seen + first kept')
  const r = rollSections(n, ['kept', 'offmap'], NONE, t0 + 1)
  ok(!r.turned.length && r.clean.join() === 'kept,offmap', 'old save: no missed day is rolled on load, the cleared list is kept')
}
// ── the roll ──
const many = (n: number, seed = 42): SpreadMap => { let k = start({ seed, firstId: null }); for (let i = 0; i < n; i++) k = uncover(k, `s${i}`, t0); return k }
const run = (seed: number, days: number) => { let k = many(40, seed), clean: string[] = Array.from({ length: 10 }, (_, i) => `s${i}`); const log: string[] = []; for (let d = 1; d <= days; d++) { const r = rollSections(k, clean, NONE, t0 + d * D); k = r.m; clean = r.clean; log.push(r.turned.join('+')) } return { k, clean, log } }
const A = run(42, 12), B = run(42, 12), C = run(43, 12)
ok(JSON.stringify(A) === JSON.stringify(B), 'same seed, same days: the same sections turn')
ok(JSON.stringify(A.log) !== JSON.stringify(C.log), 'another seed: a different result')
ok(A.log.some(x => x) && Object.keys(A.k.grey).length < 40, `over 12 days some turn, not all (${Object.keys(A.k.grey).length}/40)`)
ok(Object.keys(A.k.grey).every(id => areaState(A.k, id, true) === 'hollow'), 'a turned section reads Hollow ground')
ok(A.clean.every(id => A.k.grey[id] === undefined) && A.clean.length + ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'].filter(id => A.k.grey[id] !== undefined).length === 10, 'a turned section leaves the cleared list (its waymark goes dark)')
ok(rollSections(A.k, A.clean, NONE, t0 + 12 * D).turned.length === 0, 'the same day never rolls twice')
// the rate, measured off the hash itself
{ let hits = 0; for (let d = 0; d < 100; d++) for (let i = 0; i < 100; i++) if (sectionRoll(42, d, `first-wilds:${i % 10},${Math.floor(i / 10)}`) < R.chancePerDay) hits++; ok(Math.abs(hits / 10000 - R.chancePerDay) < 0.015, `the roll is fair (${hits / 10000} vs ${R.chancePerDay})`) }
// grace: nothing turns before graceDays after discovery, or after a clear
{
  const save = R.chancePerDay, cap = R.capPerCatchUp; R.chancePerDay = 1; R.capPerCatchUp = 99; const share = R.maxShare; R.maxShare = 1
  ok(rollSections(many(3), [], NONE, t0 + R.graceDays * D).turned.length === 0, 'grace: safe for graceDays after discovery (chance 1)')
  ok(rollSections(many(3), [], NONE, t0 + (R.graceDays + 1) * D).turned.length === 3, '...and not after')
  let k = tend(many(3), 's1', t0 + 10 * D); k = { ...k, rule: { ...k.rule!, day: dayOf(t0 + 10 * D) } }
  ok(rollSections(k, [], NONE, t0 + 12 * D).turned.slice().sort().join() === 's0,s2', 'grace: a section cleared recently is safe while the others turn')
  ok(rollSections(many(3), ['off'], NONE, t0 + 99 * D).turned.includes('off'), 'ground cleared before the map existed can turn too')
  ok(rollSections(many(3), [], new Set(['s1']), t0 + 99 * D).turned.slice().sort().join() === 's0,s2', 'an exempt (settlement) section never turns')
  R.chancePerDay = save; R.capPerCatchUp = cap; R.maxShare = share
}
// caps
const away = rollSections(many(200), [], NONE, t0 + 3000 * D)
ok(R.capPerCatchUp === 3 && away.turned.length === R.capPerCatchUp, `a long absence turns ${away.turned.length} of 200 (the cap)`)
ok(rollSections(away.m, [], NONE, t0 + 3000 * D + 1).turned.length === 0, '...and the missed days are spent: nothing more on the next look')
{ let k = many(20); for (let d = 1; d < 2000; d++) k = rollSections(k, [], NONE, t0 + d * D).m; ok(Object.keys(k.grey).length === 10, `never tended for 2000 days: ${Object.keys(k.grey).length}/20 grey (the share ceiling)`) }
ok(rollSections(many(5), [], NONE, t0 - 50 * D).turned.length === 0, 'a clock set back rolls nothing')
// ── the two layers together: turn -> infected, clear -> clean again ──
{
  const ns = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, x: i, z: 0, i, j: 0, tile: 't', biome: 1 }) as unknown as WildsNode)
  let s = freshSpread(t0), k = start({ firstId: null }); for (const n of ns) { s = clearAt(s, n.id, t0); k = tend(k, n.id, t0) }
  let got = ''; for (let d = 1; d < 500 && !got; d++) { const r = rollSections(k, s.clean, NONE, t0 + d * D); k = r.m; s = { ...s, clean: r.clean }; got = r.turned[0] ?? '' }
  ok(!!got && infectedIds(s, ns).includes(got) && areaState(k, got, true) === 'hollow', `a cleared section re-greys: infected again + Hollow ground (${got})`)
  s = clearAt(s, got, t0 + 501 * D); k = tend(k, got, t0 + 501 * D)
  ok(!infectedIds(s, ns).includes(got) && areaState(k, got, false) === 'clear', 'cleared again: clean + Clear')
}
// ── the real map: the first section is Lamps Out's section, and settlements leave most of the map open to the roll ──
{
  const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: WildsNode[] }[] }).tiles
  const T = 1000, at = (x: number, z: number) => { const t = tiles.find(k => Math.abs(x - k.tx * T) <= T / 2 && Math.abs(z - k.ty * T) <= T / 2); return t ? ownerOf(t.nodes.map(n => ({ ...n, x: n.x + t.tx * T, z: n.z + t.ty * T })), x, z)?.id : undefined }
  const all = tiles.flatMap(t => t.nodes.map(n => ({ ...n, x: n.x + t.tx * T, z: n.z + t.ty * T })))
  ok(at(SETTLEMENT.x, SETTLEMENT.z) === pickTarget(all)!.id, `Greg's stone stands on the section whose champion Chamomile asks for (${at(SETTLEMENT.x, SETTLEMENT.z)})`)
  const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as { settlements: { x: number; z: number }[] }
  const ex = new Set([SETTLEMENT, ...net.settlements].map(k => at(k.x, k.z)))
  ok(ex.size < all.length * 0.2, `settlements exempt ${ex.size} of ${all.length} sections`); console.log(`exempt ${ex.size}/${all.length}; first-wilds:`, [...ex].filter(k => k?.startsWith('first-wilds')))
}
let f = firstLook(freshMap()); ok(!f.fire, 'no first look with nothing uncovered')
f = firstLook(m); ok(f.fire && f.m.first, 'first look fires'); ok(!firstLook(f.m).fire, '...once')
ok(JSON.stringify(changes({ a: 'clear', b: 'hollow', c: 'clear' }, { a: 'hollow', b: 'clear', c: 'clear', d: 'clear' })) === JSON.stringify({ grew: ['a'], cleared: ['b'] }), 'changes: grew + cleared, new areas silent')
const rt = parseMap(JSON.parse(JSON.stringify({ ...A.k, first: true })))
ok(JSON.stringify(rt) === JSON.stringify({ ...A.k, first: true }) , 'the save round-trips, grey + seed + day')
ok(parseMap(null).first === false && Object.keys(parseMap({ v: 1, seen: { x: 'no' } }).seen).length === 0 && parseMap({ v: 1, seen: {}, rule: { seed: 'x' } }).rule === undefined, 'bad saves read fresh')
console.log(fail ? `FAIL ${fail} (pass ${pass})` : `PASS ${pass}`); process.exit(fail ? 1 : 0)
