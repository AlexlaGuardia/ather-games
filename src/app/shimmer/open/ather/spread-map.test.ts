// Run: npx tsx src/app/shimmer/open/ather/spread-map.test.ts
// BETA M235 s1 (REWRITTEN from M70 s2 + M121; the old asserts' meaning changed: sections no longer start clear, no fourth state,
// no 8%/day roll): ZONES = 2 x 2 old sections fused (about a quarter of the champions), every zone starts INFECTED + DORMANT,
// a zone stood in reads Hollow ground until its champion falls, a cleared zone is taken back only rarely (2%/day after 3 grace
// days, one per catch-up, never an exempt zone, seeded + reproducible), an old save converts onto zones, the save round-trips,
// and the signed spread.* lines (the three-word legend) are the canon file's text word for word.
import { readFileSync } from 'node:fs'
import { AREA_STATES, STATE_LOOK, freshMap, areaState, uncover, tend, firstLook, changes, parseMap, startRule, toZones, rollSections, LEGEND, growLine, clearLine, firstLine, ZONE_RULE as R, type SpreadMap } from './spread-map'
import { clearAt, freshSpread, infectedIds } from './spread'
import { GAME_DAY_MS as D, SUB, ownerOf, nodeRegions, polyArea, type WildsNode } from './nodes'
import { fuseZones, mergeRegions, mergePolys } from './zones'
import { SETTLEMENT, pickTarget } from './first-settlement'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const canon = readFileSync('/root/athernyx/CANON/game/shimmer-quest-glade-tutorial.md', 'utf8')
const cl = (id: string) => canon.split('\n').find(l => l.startsWith(`- \`${id}\``))!.replace(/^- `[^`]+`\s*(\[[^\]]*\]\s*)?/, '').replace(/^[A-Z]+:\s*/, '')
ok(LEGEND().join(' · ') === cl('spread.map.legend').replace(/\s*\*\(.*\)\*$/, '') && LEGEND().join() === 'Unseen,Hollow ground,Clear', `legend word for word, three states (${LEGEND().join(' · ')})`)
ok(AREA_STATES.length === 3 && Object.keys(STATE_LOOK).length === 3, 'three states, three looks')
ok(growLine('Mana Springs') === cl('spread.hud.grow').replace('{PLACE}', 'Mana Springs'), 'grow toast, {PLACE} filled')
ok(clearLine() === cl('spread.hud.clear') && firstLine() === cl('spread.map.first'), 'clear toast + first-look line')

const t0 = 1000 * D + 5
const NONE = new Set<string>()
// ── a fresh save: everything Unseen; stood in = Hollow ground (infected, dormant till then); champion down = Clear ──
let m = startRule(freshMap(), { now: t0, seed: 42 })
ok(m.zones === 1 && areaState(m, 'a', true) === 'unseen' && areaState(m, 'b', false) === 'unseen', 'fresh: every zone Unseen')
m = uncover(m, 'a', t0)
ok(areaState(m, 'a', true) === 'hollow', 'stepped in: the zone reads Hollow ground (it started infected)')
m = tend(m, 'a', t0 + 1); ok(areaState(m, 'a', false) === 'clear', 'its champion down: Clear')
ok(startRule(m, { now: t0 + 9 * D, seed: 9 }) === m, 'the rule starts once: a reload never re-seeds')
// ── dormant: an infected or unseen zone never rolls; only a CLEARED one can turn ──
{
  let k = startRule(freshMap(), { now: t0, seed: 1 }); for (const id of ['x', 'y']) k = uncover(k, id, t0)
  ok(rollSections(k, [], NONE, t0 + 500 * D).turned.length === 0, 'nothing cleared: nothing spreads or returns, however long')
}
// ── the return rule, seeded ──
const many = (n: number, seed = 7) => { let k = startRule(freshMap(), { now: t0, seed }); const ids = Array.from({ length: n }, (_, i) => `z${i}`); for (const id of ids) k = tend(k, id, t0); return { k, ids } }
{
  const { k, ids } = many(40)
  const run = () => { let kk = k, clean = [...ids]; const log: string[] = []; for (let d = 1; d <= 60; d++) { const r = rollSections(kk, clean, NONE, t0 + d * D); kk = r.m; clean = r.clean; log.push(...r.turned.map(t => `${d}:${t}`)) } return log.join() }
  ok(run() === run(), 'same seed, same days: the same zones turn (reproducible)')
  let a = k, c = [...ids], turnedOn: number[] = []
  for (let d = 1; d <= 60; d++) { const r = rollSections(a, c, NONE, t0 + d * D); a = r.m; c = r.clean; if (r.turned.length) turnedOn.push(d); ok(r.turned.length <= 1, `day ${d}: at most one per catch-up`) }
  ok(turnedOn.every(d => d > R.graceDays), `grace: nothing turns in the first ${R.graceDays} days (${turnedOn.join()})`)
  const big = rollSections(k, ids, NONE, t0 + 3000 * D)
  ok(big.turned.length === 1 && rollSections(big.m, big.clean, NONE, t0 + 3000 * D + 1).turned.length === 0, 'away for years: ONE zone turns, the missed days are spent')
  ok(rollSections(many(5).k, many(5).ids, NONE, t0 - 50 * D).turned.length === 0, 'a clock set back rolls nothing')
  ok(rollSections(k, ids, new Set(ids), t0 + 3000 * D).turned.length === 0, 'an exempt zone (a settlement, where the keeper stands) never turns')
  // the rate: over many zones x days, about chancePerDay of the eligible zone-days roll under it
  let hits = 0, tries = 0; for (let s = 1; s <= 30; s++) { const q = many(40, s); for (let d = R.graceDays + 1; d < R.graceDays + 40; d++) { const r = rollSections({ ...q.k, rule: { ...q.k.rule!, day: Math.floor((t0 + d * D) / D) - 1 } }, q.ids, NONE, t0 + d * D); tries++; if (r.turned.length) hits++ } }
  const p = hits / tries, want = 1 - Math.pow(1 - R.chancePerDay, 40)
  ok(Math.abs(p - want) < 0.08, `rate: P(a day turns one of 40) ${p.toFixed(3)} vs 1-(1-${R.chancePerDay})^40 = ${want.toFixed(3)}`)
  ok(R.chancePerDay <= 0.03 && R.graceDays >= 3 && R.capPerCatchUp === 1, 'the dials are the slight ones (M235)')
}
// ── the two layers together: a zone taken back is infected again + Hollow ground; cleared again = Clear ──
{
  const ns = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, x: i, z: 0, i, j: 0, tile: 't', biome: 1 }) as unknown as WildsNode)
  let s = freshSpread(t0), k = startRule(freshMap(), { now: t0, seed: 3 }); for (const n of ns) { s = clearAt(s, n.id, t0); k = tend(k, n.id, t0) }
  let got = ''; for (let d = 1; d < 3000 && !got; d++) { const r = rollSections(k, s.clean, NONE, t0 + d * D); k = r.m; s = { ...s, clean: r.clean }; got = r.turned[0] ?? '' }
  ok(!!got && infectedIds(s, ns).includes(got) && areaState(k, got, true) === 'hollow', `a cleared zone re-greys: infected again + Hollow ground (${got})`)
  const before = { [got]: 'clear' as const }, after = { [got]: areaState(k, got, true) }
  ok(changes(before, after).grew[0] === got, 'Clear -> Hollow ground says the grow toast')
  s = clearAt(s, got, t0 + 3001 * D); k = tend(k, got, t0 + 3001 * D)
  ok(!infectedIds(s, ns).includes(got) && areaState(k, got, false) === 'clear', 'cleared again: clean + Clear')
}
// ── the real map: zones are 2 x 2 sections, about a quarter of the champions ──
const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: WildsNode[] }[] }).tiles
const T = 1000
const raw = tiles.flatMap(t => t.nodes.map(n => ({ ...n, tile: t.name, x: n.x + t.tx * T, z: n.z + t.ty * T, gi: t.tx * SUB + n.i, gj: t.ty * SUB + n.j })))
const F = fuseZones(raw)
{
  const r = F.zones.length / raw.length
  console.log(`zones ${F.zones.length} / sections ${raw.length} = ${r.toFixed(3)}`)
  ok(r > 0.22 && r < 0.33, `about a quarter of the champions (${F.zones.length}/${raw.length})`)
  ok(raw.every(n => F.zoneOf.has(n.id)) && [...F.members.values()].every(g => g.length >= 1 && g.length <= 4), 'every section in exactly one zone of 1..4 sections')
  ok(F.zones.every(z => F.members.get(z.id)!.some(id => { const n = raw.find(q => q.id === id)!; return n.x === z.x && n.z === z.z })), "a zone's champion stands on one of its own sections' spots")
  ok(F.zones.every(z => { const g = F.members.get(z.id)!.map(id => raw.find(q => q.id === id)!); return g.every(n => Math.floor(n.gi! / 2) === g[0].gi! >> 1 || true) && new Set(g.map(n => `${Math.floor(n.gi! / 2)},${Math.floor(n.gj! / 2)}`)).size === 1 }), 'a zone = one 2 x 2 block of the continent grid')
  const at = (x: number, z: number) => { const t = tiles.find(k => Math.abs(x - k.tx * T) <= T / 2 && Math.abs(z - k.ty * T) <= T / 2); return t ? ownerOf(raw.filter(n => n.tile === t.name), x, z)?.id : undefined }
  ok(F.zoneOf.get(at(SETTLEMENT.x, SETTLEMENT.z)!) === F.zoneOf.get(pickTarget(raw)!.id), "Greg's stone stands in the zone whose section Chamomile asks for")
  // merged outlines: a tile's zone outlines cover exactly what its sections did
  let same = 0, n = 0
  for (const t of tiles.slice(0, 12)) {
    const cells = nodeRegions(t.nodes.map(q => ({ ...q, tile: t.name })), T, T), merged = mergeRegions(cells, id => F.zoneOf.get(id) ?? id)
    const area = (rs: { poly: { x: number; z: number }[] }[]) => rs.reduce((s, r) => s + polyArea(r.poly), 0)
    n++; if (Math.abs(area(cells) - area(merged)) < 1 && new Set(merged.map(r => r.id)).size <= new Set(cells.map(c => F.zoneOf.get(c.id))).size) same++
    ok(merged.length <= cells.length, `${t.name}: fewer outlines than cells (${merged.length} <= ${cells.length})`)
  }
  ok(same === n, `merged outlines keep the area (${same}/${n} tiles)`)
  ok(mergePolys([[{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }, { x: 0, z: 1 }], [{ x: 1, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 1 }, { x: 1, z: 1 }]])?.[0].length === 6, 'two squares merge into one 6-point outline')
}
// ── an old save (keyed by sections) converts onto zones ──
{
  const z = [...F.members.entries()].find(([, g]) => g.length === 4)!, [zid, g] = z
  const other = [...F.members.entries()].find(([k, h]) => k !== zid && h.length >= 2)!
  const old: SpreadMap = { v: 1, seen: { [g[0]]: t0 - 5 * D, [g[1]]: t0 - 9 * D, [other[1][0]]: t0 }, first: true, grey: { [g[2]]: t0 }, rule: { seed: 5, day: 7, since: 3 } }
  const allClear = toZones(old, [...g, other[1][0]], F)
  ok(allClear.clean.includes(zid) && !allClear.clean.includes(other[0]), 'a zone is clear only if EVERY old section was (the other had one of its sections clear: infected)')
  ok(allClear.m.seen[zid] === t0 - 9 * D && allClear.m.seen[other[0]] === t0 && Object.keys(allClear.m.seen).length === 2, 'uncovered if any section was (the earliest time)')
  ok(allClear.m.zones === 1 && allClear.m.rule?.seed === 5 && allClear.m.first && Object.keys(allClear.m.grey).length === 0, 'the seed + first-look carry; old greys do not')
  ok(!toZones(old, g.slice(0, 3), F).clean.includes(zid), 'three of four sections clear: the zone is still infected')
  ok(toZones(allClear.m, ['q'], F).m === allClear.m, 'converts once')
  ok(areaState(allClear.m, zid, false) === 'clear' && areaState(allClear.m, other[0], true) === 'hollow', 'after the convert: Clear + Hollow ground')
}
let f = firstLook(freshMap()); ok(!f.fire, 'no first look with nothing uncovered')
f = firstLook(m); ok(f.fire && f.m.first, 'first look fires'); ok(!firstLook(f.m).fire, '...once')
ok(JSON.stringify(changes({ a: 'clear', b: 'hollow', c: 'clear' }, { a: 'hollow', b: 'clear', c: 'clear', d: 'hollow' })) === JSON.stringify({ grew: ['a'], cleared: ['b'] }), 'changes: grew + cleared, newly uncovered zones silent')
{ const k = many(3).k, rt = parseMap(JSON.parse(JSON.stringify({ ...k, grey: { z1: 4 } })))
  const sorted = (o: object) => JSON.stringify(o, Object.keys({ ...o, ...(o as SpreadMap).rule, ...(o as SpreadMap).grey }).sort())
  ok(sorted(rt) === sorted({ ...k, grey: { z1: 4 } }), 'the save round-trips, zones flag + grey + seed + day') }
ok(parseMap({ v: 1, seen: {}, first: false, grey: {} }).zones === undefined, 'a save without the flag reads as an old (section) save')
ok(parseMap(null).zones === 1 && Object.keys(parseMap({ v: 1, seen: { x: 'no' } }).seen).length === 0 && parseMap({ v: 1, seen: {}, rule: { seed: 'x' } }).rule === undefined, 'bad saves read fresh')
console.log(fail ? `FAIL ${fail} (pass ${pass})` : `PASS ${pass}`); process.exit(fail ? 1 : 0)
