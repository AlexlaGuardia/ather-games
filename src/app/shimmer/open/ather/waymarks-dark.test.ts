// Run: npx tsx src/app/shimmer/open/ather/waymarks-dark.test.ts
// BETA M75 s2 DARK / RELIGHT (Magii RULED-AFK athernyx d3bf5e9; basis shimmer-folds-settlements.md:32 "a waymark exists only on
// kept ground"): a planted waymark whose ground goes grey again goes DARK (no travel to it) and RELIGHTS when the ground is
// cleared again. It stays planted, no re-buy, no refund; the fold map shows it unlit, not removed. Settlement = kept by definition.
import { isLit, canTravel, lastLit, plant, parseWaymarks, canPlant, groundOf, DARK_WHY, GREG_WAYMARK, type Waymark } from './waymarks'
import { advance, clearAt, freshSpread, infectedIds } from './spread'
import { GAME_DAY_MS, type WildsNode } from './nodes'
import { BIOME } from './wilds'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }

const base = { tile: 'first-wilds', y: 0, biome: BIOME.woods }
const onNode = (id: string, x = 0): Omit<Waymark, 'id' | 'made'> => ({ ...base, x, z: 0, node: id })
let list: Waymark[] = []
list = plant(list, onNode('n1', 0), 1)
list = plant(list, { ...base, x: 100, z: 0, settlement: 's1' }, 2)
list = plant(list, { ...base, x: 200, z: 0 }, 3)                      // an older waymark bound to no node
const [nodeW, settW, oldW] = list

// ── lit iff kept ──
ok(isLit(nodeW, new Set()), 'a node waymark is lit while its node is clean')
ok(!isLit(nodeW, new Set(['n1'])), 'a node waymark is DARK while the grey holds its node')
ok(isLit(nodeW, new Set(['n2'])), 'another node going grey does not darken it')
ok(isLit(settW, new Set(['n1', 's1'])), 'a settlement waymark is kept ground by definition: always lit')
ok(isLit({ ...settW, node: 'n1' }, new Set(['n1'])), 'a settlement waymark stays lit even on a grey node')
ok(isLit(oldW, new Set(['n1'])), 'an older waymark bound to no node stays lit')
ok(isLit(GREG_WAYMARK, new Set(['n1'])), "Gregory's waymark is always lit")
// lit agrees with the planting rule's word for the same ground (one source of truth: the spread's infected set)
for (const inf of [new Set<string>(), new Set(['n1'])]) ok(isLit(nodeW, inf) === (groundOf('n1', inf) === 'cleared'), `lit == ground cleared (${[...inf]})`)

// ── dark refuses travel with a reason; lit travels ──
const d = canTravel(nodeW, new Set(['n1']))
ok(!d.ok && d.why === DARK_WHY && /grey/.test(d.why) && /clear/.test(d.why), `dark refuses travel, with the reason (${!d.ok && d.why})`)
ok(canTravel(nodeW, new Set()).ok, 'lit travels')
ok(canTravel(settW, new Set(['n1'])).ok, 'a settlement waymark always travels')

// ── never removed, no refund, no re-buy: dark is a READ, the ledger is untouched ──
const before = JSON.stringify(list)
isLit(nodeW, new Set(['n1'])); canTravel(nodeW, new Set(['n1'])); lastLit(list, new Set(['n1']))
ok(JSON.stringify(list) === before, 'reading dark changes nothing in the ledger')
ok(parseWaymarks(JSON.stringify(list)).length === 3, 'a dark waymark round-trips through the save (still planted)')
ok(!('lit' in nodeW) && !('dark' in nodeW), 'no lit/dark flag is stored on a waymark (derived at read time)')
// it still counts against the caps while dark (it is planted, not lifted): a second plant on the same spot is still too close
const again = canPlant(list, { tile: 'first-wilds', x: 10, z: 0, biome: BIOME.woods, grounded: true, swimming: false, settlement: null, ground: 'cleared', folded: true })
ok(!again.ok && /Too close/.test(again.why), 'a dark waymark still holds its place (no re-plant beside it)')

// ── a fall sets down at the last LIT waymark ──
ok(lastLit(list, new Set())?.id === oldW.id, 'last lit = the newest when all are lit')
ok(lastLit([nodeW], new Set(['n1'])) === undefined, 'no lit waymark -> none (the page falls back to Greg)')
ok(lastLit([settW, nodeW], new Set(['n1']))?.id === settW.id, 'a dark newest is skipped for the last lit one')

// ── relight on clear, through the real spread: the node wells up grey, then is cleared again ──
const nodes: WildsNode[] = []
for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) nodes.push({ id: `g${i}-${j}`, tile: 'first-wilds', biome: BIOME.woods, x: i * 100, z: j * 100, i, j })
let s = freshSpread(0)
for (const n of nodes) s = clearAt(s, nodes, n.id, 0).s
ok(infectedIds(s, nodes).length === 0, 'spread: every node cleared')
const w0 = plant([], onNode('g0-0'), 1)[0]
ok(isLit(w0, new Set(infectedIds(s, nodes))), 'planted on cleared ground: lit')
// find a tick where g0-0 has gone grey again (it wells or the grey spreads back)
let t = 0, grey = false
while (t < 3000 * GAME_DAY_MS && !grey) { t += 5 * GAME_DAY_MS; s = advance(s, nodes, t).s; grey = infectedIds(s, nodes).includes('g0-0') }
ok(grey, 'spread: the node went grey again in time')
ok(!isLit(w0, new Set(infectedIds(s, nodes))) && !canTravel(w0, new Set(infectedIds(s, nodes))).ok, 'the ground went grey: dark, no travel')
s = clearAt(s, nodes, 'g0-0', t + 1).s
ok(isLit(w0, new Set(infectedIds(s, nodes))) && canTravel(w0, new Set(infectedIds(s, nodes))).ok, 'cleared again: relit, travels')

console.log(`waymarks-dark: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
