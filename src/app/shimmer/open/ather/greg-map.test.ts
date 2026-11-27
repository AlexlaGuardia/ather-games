// Run: npx tsx src/app/shimmer/open/ather/greg-map.test.ts
// M236: Greg's Wilds talk plays the map. One stage per signed Wilds line (clear -> ripple -> hollow -> dark), no map on any other
// branch; the ripple turns zones 0 -> all over RIPPLE_MS and never falls back; s2: the area is the real Ather Wilds map's (the 3 x 3
// tiles round Greg's waymark, regions built by the fold map's own rule), each zone ranked once, the ripple starts far from the Glade;
// each stage's display-only regions read clear / ripple / all Hollow ground / all Unseen; the captions are the SIGNED legend words; the talk keeps its signed lines untouched.
import { readFileSync } from 'node:fs'
import { stageOfLine, stageState, rippleCount, buildGregArea, stageRegions, turnedAt, GREG_MAP_STAGES, RIPPLE_MS, type IndexTile } from './greg-map'
import { fuseZones, mergeRegions } from './zones'
import { SUB, nodeRegions, type WildsNode } from './nodes'
import { tutNode, BRANCH_LINES } from './glade-greg-talk'
import { freshTut } from './glade-tutorial'
import { line } from './glade-tutorial-lines'
import { STATE_WORD } from './spread-map'
import { GREG_WAYMARK } from './waymarks'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }

// stages ride the lines, one each
ok(BRANCH_LINES.wilds === GREG_MAP_STAGES.length, `one stage per Wilds line (${BRANCH_LINES.wilds} lines, ${GREG_MAP_STAGES.length} stages)`)
GREG_MAP_STAGES.forEach((s, i) => ok(stageOfLine('wilds', i) === s, `Wilds line ${i + 1} -> ${s}`))
for (const b of ['welcome', 'moglins', 'spirits', 'hub', 'ask']) for (let i = 0; i < 6; i++) ok(stageOfLine(b, i) === null, `no map on ${b}.${i}`)
ok(stageState('clear') === 'clear' && stageState('ripple') === 'hollow' && stageState('hollow') === 'hollow' && stageState('dark') === 'unseen', 'captions: Clear, Hollow ground, Hollow ground, Unseen')
ok(STATE_WORD[stageState('dark')] === 'Unseen' && STATE_WORD[stageState('clear')] === 'Clear', 'the captions are the signed legend words')

// the talk: each Wilds node names its stage and keeps its signed line; other nodes carry none
const t = { ...freshTut(), greg: { welcome: true, moglins: true, spirits: true, wilds: false } }
const acts = { set: () => {}, go: () => {}, grimoire: () => true }
for (let i = 0; i < BRANCH_LINES.wilds; i++) {
  const n = tutNode(t, { b: 'wilds', i }, acts)
  ok(n.mapStage === GREG_MAP_STAGES[i], `tutNode wilds.${i + 1} mapStage ${n.mapStage}`)
  ok(n.line === line(`greg.b1.wilds.${i + 1}`), `tutNode wilds.${i + 1} keeps its signed line`)
}
ok(tutNode(t, { b: 'wilds', i: 2 }, acts).scene === line('greg.b1.wilds.scene'), 'the Bonn scene still rides line 3')
ok(tutNode(t, { b: 'welcome', i: 0 }, acts).mapStage === undefined && tutNode(t, { b: 'spirits', i: 1 }, acts).mapStage === undefined, 'no stage off the Wilds')

// the ripple
const N = 297
ok(rippleCount(N, 0) === 0 && rippleCount(N, -5) === 0 && rippleCount(N, NaN) === 0, 'nothing turned before the ripple')
ok(rippleCount(N, RIPPLE_MS) === N && rippleCount(N, RIPPLE_MS * 3) === N, 'all turned by RIPPLE_MS, never more')
const mid = rippleCount(N, RIPPLE_MS / 2); ok(mid > N * 0.4 && mid < N * 0.6, `half way ~ half (${mid})`)
let prev = 0, mono = true; for (let ms = 0; ms <= RIPPLE_MS + 100; ms += 70) { const k = rippleCount(N, ms); if (k < prev) mono = false; prev = k } ok(mono, 'never falls back')
ok(rippleCount(0, 1000) === 0, 'no zones, nothing turns')

// s2: the real Ather Wilds map's ground round Greg's waymark (the shipped index)
const idx = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tileM: number; tiles: IndexTile[] }
const a = buildGregArea(idx.tiles, idx.tileM)
const home = idx.tiles.find(t => t.name === GREG_WAYMARK.tile)!
ok(a.tile === home.name && a.cx === home.tx * idx.tileM && a.cz === home.ty * idx.tileM, `centred on Greg's waymark tile (${a.tile})`)
const want = idx.tiles.filter(t => Math.abs(t.tx - home.tx) <= 1 && Math.abs(t.ty - home.ty) <= 1).map(t => t.name).sort()
ok(JSON.stringify([...a.byTile.keys()].sort()) === JSON.stringify(want), `the 3 x 3 tiles the fold map shows (${want.length})`)
// the regions are the fold map's own (page.tsx regionsByTile: nodeRegions per tile, merged by zone), not a drawing of their own
const raw: WildsNode[] = idx.tiles.flatMap(t => t.nodes.map(n => ({ ...n, tile: t.name, x: n.x + t.tx * idx.tileM, z: n.z + t.ty * idx.tileM, gi: t.tx * SUB + n.i, gj: t.ty * SUB + n.j })))
const fused = fuseZones(raw)
let same = true
for (const t of idx.tiles.filter(t => want.includes(t.name))) {
  const local = raw.filter(n => n.tile === t.name).map(n => ({ ...n, x: n.x - t.tx * idx.tileM, z: n.z - t.ty * idx.tileM }))
  const real = mergeRegions(nodeRegions(local, idx.tileM, idx.tileM), id => fused.zoneOf.get(id) ?? id)
  const mine = a.byTile.get(t.name)!
  if (JSON.stringify(real.map(r => [r.id, r.poly])) !== JSON.stringify(mine.map(r => [r.id, r.poly]))) same = false
}
ok(same, 'every tile\'s outlines = the fold map\'s outlines for the same zones')
const ranks = new Map<string, number>(); for (const rs of a.byTile.values()) for (const r of rs) { const q = ranks.get(r.id); ok(q === undefined || q === r.rank, `${r.id} one rank`); ranks.set(r.id, r.rank) }
ok(a.n > 10 && ranks.size === a.n, `every zone drawn (${ranks.size} of ${a.n})`)
ok(new Set(ranks.values()).size === a.n && Math.min(...ranks.values()) === 0 && Math.max(...ranks.values()) === a.n - 1, 'ranks are 0..n-1, once each')
// the ripple reaches the Glade's own zone late (it starts far away)
const near = [...home.nodes].sort((p, q) => Math.hypot(p.x - GREG_WAYMARK.x, p.z - GREG_WAYMARK.z) - Math.hypot(q.x - GREG_WAYMARK.x, q.z - GREG_WAYMARK.z))[0]
const homeRank = ranks.get(fused.zoneOf.get(near.id) ?? near.id)
ok(homeRank !== undefined && homeRank > a.n * 0.5, `the Glade's zone turns in the later half (${homeRank} of ${a.n})`)
ok(JSON.stringify([...buildGregArea(idx.tiles, idx.tileM).byTile]) === JSON.stringify([...a.byTile]), 'same index, same area')
// each stage's display-only state
const states = (st: (typeof GREG_MAP_STAGES)[number], k: number) => [...stageRegions(a, st, k).values()].flat().map(r => r.state)
ok(states('clear', turnedAt('clear', a.n)).every(s => s === 'clear'), 'clear: every zone Clear')
const half = Math.floor(a.n / 2), mid2 = new Set([...stageRegions(a, 'ripple', half).values()].flat().filter(r => r.state === 'hollow').map(r => r.id))
ok(mid2.size === half && [...mid2].every(id => ranks.get(id)! < half), `ripple half way: the ${half} first-ranked zones Hollow ground, the rest Clear`)
ok(states('hollow', turnedAt('hollow', a.n)).every(s => s === 'hollow'), 'hollow: every zone Hollow ground')
ok(states('dark', turnedAt('dark', a.n)).every(s => s === 'unseen'), 'dark: every zone Unseen')
ok(turnedAt('clear', 9) === 0 && turnedAt('ripple', 9) === 0 && turnedAt('hollow', 9) === 9 && turnedAt('dark', 9) === 9, 'turned outside the ripple')

console.log(`greg-map: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
