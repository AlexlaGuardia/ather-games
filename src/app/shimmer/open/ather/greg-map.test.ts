// Run: npx tsx src/app/shimmer/open/ather/greg-map.test.ts
// M236: Greg's Wilds talk plays the map. One stage per signed Wilds line (clear -> ripple -> hollow -> dark), no map on any other
// branch; the ripple turns zones 0 -> all over RIPPLE_MS and never falls back; the whole Ather's zones are drawn, each ranked once,
// the ripple starts far from the Glade; the captions are the SIGNED legend words; the talk keeps its signed lines untouched.
import { readFileSync } from 'node:fs'
import { stageOfLine, stageState, rippleCount, buildGregMap, GREG_MAP_STAGES, RIPPLE_MS, type IndexTile } from './greg-map'
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

// the whole Ather (the shipped index)
const idx = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tileM: number; tiles: IndexTile[] }
const m = buildGregMap(idx.tiles, idx.tileM)
const ids = new Set(m.zones.map(z => z.id))
ok(m.n > 200 && ids.size === m.n, `every zone drawn (${ids.size} of ${m.n})`)
const ranks = new Map<string, number>(); for (const z of m.zones) { const r = ranks.get(z.id); ok(r === undefined || r === z.rank, `${z.id} one rank`); ranks.set(z.id, z.rank) }
ok(new Set(ranks.values()).size === m.n && Math.min(...ranks.values()) === 0 && Math.max(...ranks.values()) === m.n - 1, 'ranks are 0..n-1, once each')
ok(m.zones.every(z => z.pts.split(' ').length >= 3), 'every outline is a shape')
ok(m.box.w === (Math.max(...idx.tiles.map(t => t.tx)) - Math.min(...idx.tiles.map(t => t.tx)) + 1) * idx.tileM, 'the box spans every tile')
// the ripple reaches the Glade's own zone late (it starts far away)
const ft = idx.tiles.find(t => t.name === GREG_WAYMARK.tile)!
const near = [...ft.nodes].sort((a, b) => Math.hypot(a.x - GREG_WAYMARK.x, a.z - GREG_WAYMARK.z) - Math.hypot(b.x - GREG_WAYMARK.x, b.z - GREG_WAYMARK.z))[0]
const homeZone = m.zones.find(z => z.id.startsWith('z') && z.pts && ranks.get(z.id) !== undefined && z.id === `z${Math.floor((ft.tx * 5 + near.i) / 2)},${Math.floor((ft.ty * 5 + near.j) / 2)}`)
ok(homeZone && homeZone.rank > m.n * 0.5, `the Glade's zone turns in the later half (${homeZone?.rank} of ${m.n})`)
const again = buildGregMap(idx.tiles, idx.tileM); ok(JSON.stringify(again) === JSON.stringify(m), 'same index, same map')

console.log(`greg-map: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
