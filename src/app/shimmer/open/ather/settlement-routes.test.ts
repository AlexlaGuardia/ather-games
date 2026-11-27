// BETA M237 s3: paths + pads follow the owner's moved/added settlements (settlement-routes.ts), on the real raw tiles.
// Run: npx tsx src/app/shimmer/open/ather/settlement-routes.test.ts
import { readFileSync } from 'fs'
import { roadField, clearing, pitchOwnerTents, tentsOf, type Network, type Path } from './network'
import { applySettlementEdits, moveSettlementEdit, removeSettlementEdit, addSettlementEdit, patchEdit, type SettlementEdits } from './settlement-edits'
import { groundOf, profilePath, levelPads, routeOn, rerouteNetwork, keptPaths, groundBoxes, tilesFor, tentSiteOk, spurEnd, SPUR_MIN, TENT_NODE_CLEAR, type TileData } from './settlement-routes'
import { LOT_W, LOT_D } from './settlement-lots'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const DIR = 'public/open/wilds'
const bake = JSON.parse(readFileSync(`${DIR}/network-s1.json`, 'utf8')) as Network
const index = JSON.parse(readFileSync(`${DIR}/tiles.json`, 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { x: number; z: number }[] }[] }
const tiles: TileData[] = index.tiles.map(t => {
  const b = readFileSync(`${DIR}/${t.name}.bin`)
  return { tx: t.tx, ty: t.ty, meta: JSON.parse(readFileSync(`${DIR}/${t.name}.json`, 'utf8')), dm: new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), bio: new Uint8Array(readFileSync(`${DIR}/${t.name}.biome`)) }
})
const g = groundOf(tiles)
const nodes = index.tiles.flatMap(t => t.nodes.map(q => ({ x: q.x + t.tx * 1000, z: q.z + t.ty * 1000 })))
const byId = (n: Network, id: string) => n.settlements.find(s => s.id === id)!

// ── parity with the bake: the same heights, the same pads ──
let worstY = 0
for (const p of bake.paths) { const r = profilePath(p.pts.map(q => [q[0], q[1]]), g.raw); r.forEach((q, k) => { worstY = Math.max(worstY, Math.abs(q[2] - (p.pts[k][2] as number))) }) }
ok(worstY <= 0.011, `profilePath = the bake's path heights (worst ${worstY.toFixed(3)} m)`)
let worstPad = 0
for (const s of bake.settlements) { const pads = levelPads(s, bake.season, g.raw)!; pads.forEach((q, k) => { for (let i = 0; i < 4; i++) worstPad = Math.max(worstPad, Math.abs(q[i] - s.pads![k][i])) }) }
ok(worstPad <= 0.011, `levelPads = the bake's lot pads (worst ${worstPad.toFixed(3)})`)
// the route: the bake's own edges, re-routed in a window of the same lattice, come out point for point the same road (a window too
// small for a long detour gives null, never a different road)
{
  const P: Record<string, { x: number; z: number }> = { greg: { x: -300, z: 300 } }; for (const s of bake.settlements) P[s.id] = s
  let same = 0, other = 0
  for (const p of bake.paths) { const r = routeOn(g, P[p.a], P[p.b], 1500); if (!r) continue; if (r.length === p.pts.length && r.every((q, k) => Math.abs(q[0] - p.pts[k][0]) < 0.11 && Math.abs(q[1] - p.pts[k][1]) < 0.11)) same++; else other++ }
  ok(same >= 12 && other === 0, `routeOn = the bake's routes (${same} identical, ${other} different)`)
}
// ── the merge: move a hub (Bryonydell, 2 paths), move a leaf (Elderdelve, 1 path), add one, remove a leaf + a hub ──
const deg = (id: string) => bake.paths.filter(p => p.a === id || p.b === id).length
ok(deg('s1-10') === 2 && deg('s1-5') === 1 && deg('s1-0') === 1 && deg('s1-2') === 4, 'fixture degrees')
let E: SettlementEdits = []
E = moveSettlementEdit(E, 's1-10', -20, 1215)            // s1's check move (Bryonydell)
E = moveSettlementEdit(E, 's1-5', -1930 + 260, 1710 - 180)  // a leaf moved off its spur
const add = addSettlementEdit(E, bake, 260, 800); E = add.edits
E = removeSettlementEdit(E, 's1-0'); E = removeSettlementEdit(E, 's1-2')
const m0 = applySettlementEdits(bake, E), m = rerouteNetwork(bake, m0, g)
const hasPath = (n: Network, a: string, b: string) => n.paths.some(p => (p.a === a && p.b === b) || (p.a === b && p.b === a))
ok(!m.paths.some(p => p.a === 's1-5' && p.b !== undefined && !p.b.startsWith('~') || p.b === 's1-5'), 'leaf moved: its old dead-end spur goes')
ok(!m.paths.some(p => p.a === 's1-0' || p.b === 's1-0'), 'leaf removed: its dead-end spur goes')
ok(bake.paths.filter(p => (p.a === 's1-2' || p.b === 's1-2') && ![p.a, p.b].some(x => x === 's1-0' || x === 's1-5')).every(p => hasPath(m, p.a, p.b)), 'hub removed: its through paths stay (a crossroads now)')
ok(bake.paths.filter(p => p.a === 's1-10' || p.b === 's1-10').every(p => hasPath(m, p.a, p.b)), 'hub moved: its through paths stay')
ok(keptPaths(bake, m0).length === bake.paths.length - 2, 'exactly two baked paths dropped')
// every moved/added one has a spur from its centre to a point of another path, continuous, with heights
const spurs = m.paths.filter(p => p.b.startsWith('~'))
ok(spurs.length === 3, `three spurs (${spurs.length})`)
for (const id of ['s1-10', 's1-5', add.id]) {
  const s = byId(m, id), sp = spurs.find(p => p.a === id)
  if (!sp) { ok(false, `${id}: no spur`); continue }
  const f = sp.pts[0], l = sp.pts[sp.pts.length - 1]
  ok(Math.hypot(f[0] - s.x, f[1] - s.z) < 0.1, `${id}: spur starts at the settlement`)
  const other = m.paths.filter(p => p !== sp && p.pts.some(q => Math.hypot(q[0] - l[0], q[1] - l[1]) < 0.01))
  ok(other.length >= 1 && sp.b === spurEnd(other[0]), `${id}: spur ends ON another path's point, labelled by it`)
  const meet = other[0]?.pts.find(q => Math.hypot(q[0] - l[0], q[1] - l[1]) < 0.01)
  ok(!!meet && Math.abs((meet[2] as number) - (l[2] as number)) < 0.011, `${id}: spur end height = the path it meets`)
  let gap = 0; for (let k = 1; k < sp.pts.length; k++) gap = Math.max(gap, Math.hypot(sp.pts[k][0] - sp.pts[k - 1][0], sp.pts[k][1] - sp.pts[k - 1][1]))
  ok(gap <= 30, `${id}: no gap in the spur (worst step ${gap.toFixed(1)} m)`)
  ok(sp.pts.every(q => typeof q[2] === 'number'), `${id}: every spur point carries its height`)
  ok(sp.pts.every(q => { const c = g.cell(q[0], q[1]); return !!c && c.b !== 0 }), `${id}: the spur never crosses open water`)
  let grade = 0; for (let k = 1; k < sp.pts.length; k++) { const d = Math.hypot(sp.pts[k][0] - sp.pts[k - 1][0], sp.pts[k][1] - sp.pts[k - 1][1]); if (d > 1) grade = Math.max(grade, Math.abs((sp.pts[k][2] as number) - (sp.pts[k - 1][2] as number)) / d) }
  ok(grade <= 0.19, `${id}: spur grade capped (${grade.toFixed(3)})`)
  // pads: five, at the new spot, level at the mean ground, and the ground under each is near level (small cut/fill)
  ok(s.pads?.length === 5 && s.pads.every(p => Math.hypot(p[0] - s.x, p[1] - s.z) < 30), `${id}: five pads round the new spot`)
  let cut = 0
  for (const p of s.pads ?? []) for (let a = -LOT_W / 2; a <= LOT_W / 2; a += 1.5) for (let b = -LOT_D / 2; b <= LOT_D / 2; b += 1.5) { const sn = Math.sin(p[2]), cs = Math.cos(p[2]); cut = Math.max(cut, Math.abs(g.raw(p[0] + cs * a + sn * b, p[1] - sn * a + cs * b) - p[3])) }
  ok(cut < 4, `${id}: pad cut/fill small (${cut.toFixed(2)} m)`)
}
// connected: from Greg's stone every settlement still on the network is reached (paths touch at an end or a shared point)
{
  const P = m.paths, par = P.map((_, i) => i), f = (i: number): number => (par[i] === i ? i : (par[i] = f(par[i])))
  const touch = (p: Path, q: Path) => [p.pts[0], p.pts[p.pts.length - 1]].some(e => q.pts.some(v => Math.hypot(v[0] - e[0], v[1] - e[1]) < 0.5))
  for (let i = 0; i < P.length; i++) for (let j = 0; j < P.length; j++) if (i !== j && (touch(P[i], P[j]) || [P[i].a, P[i].b].some(x => !x.startsWith('~') && (x === P[j].a || x === P[j].b)))) par[f(i)] = f(j)
  const gi = P.findIndex(p => p.a === 'greg' || p.b === 'greg'), comp = f(gi)
  const reached = (x: number, z: number) => P.some((p, i) => f(i) === comp && [p.pts[0], p.pts[p.pts.length - 1]].some(e => Math.hypot(e[0] - x, e[1] - z) < 1))
  const miss = m.settlements.filter(s => !reached(s.x, s.z)).map(s => s.id)
  ok(!miss.length, `every settlement joined to Greg's stone (missing ${miss.join(',')})`)
}
ok(!!roadField(m), 'the road field still builds (every path has heights)')
{ const sp = spurs[0], q = sp.pts[Math.floor(sp.pts.length / 2)]; ok(clearing(m)(q[0], q[1]) && !clearing(bake)(q[0], q[1]) === !clearing(bake)(q[0], q[1]), 'a spur clears its ground (no tree, no outcrop on it)') }
ok(rerouteNetwork(bake, applySettlementEdits(bake, []), g) === bake, 'no edits: the very same network')
ok(rerouteNetwork(bake, applySettlementEdits(bake, patchEdit([], 's1-3', { homes: 2 })), g).paths === bake.paths, 'no move: paths untouched')
// near the network already: no spur
{ const p = bake.paths[0].pts[10], e = addSettlementEdit([], bake, p[0] + 5, p[1]); const r = rerouteNetwork(bake, applySettlementEdits(bake, e.edits), g); ok(!r.paths.some(q => q.a === e.id) && 5 < SPUR_MIN, 'on a path already: no spur') }
// the tiles the merge fetches cover every spur
{ const want = tilesFor(groundBoxes(bake, m0)), key = (x: number, z: number) => `${Math.floor((x + 500) / 1000)},${Math.floor((z + 500) / 1000)}`
  ok(spurs.every(sp => sp.pts.every(q => want.some(w => `${w.tx},${w.ty}` === key(q[0], q[1])))), 'groundBoxes: the fetched tiles hold every spur point') }

// ── the tent's ground: dry, off the Hollows' wells ──
const ok2 = tentSiteOk(g, nodes)
let wet: [number, number] | null = null
for (let z = -4000; z < 2000 && !wet; z += 40) for (let x = -5000; x < 2000 && !wet; x += 40) { const c = g.cell(x, z); if (c && c.b === 0) wet = [x, z] }
ok(!!wet && !ok2(wet[0], wet[1]), 'tent: open water refused')
ok(!ok2(nodes[5].x + 20, nodes[5].z), `tent: within ${TENT_NODE_CLEAR} m of an infected node refused`)
ok(bake.tents!.filter(t => !nodes.some(n => Math.hypot(n.x - t.x, n.z - t.z) < TENT_NODE_CLEAR)).every(t => ok2(t.x, t.z)), 'tent: the baked tents\' own ground passes')
// a settlement MOVED to the shore (the first shore cell, scanning, where a pitch with no ground test lands wet): with the test the
// tent stands dry, or there is no room; never wet
{
  let found = 0, dryAfter = 0
  for (let z = -3000; z < 2000 && found < 3; z += 100) for (let x = -5000; x < 2000 && found < 3; x += 100) {
    const c = g.cell(x, z); if (!c || c.b !== 1) continue
    const e = patchEdit(moveSettlementEdit([], 's1-9', x, z), 's1-9', { tent: { contest: 'dash' } }), mm = applySettlementEdits(bake, e)
    const bare = tentsOf(pitchOwnerTents(mm)).find(t => t.settlement === 's1-9')
    if (!bare || ok2(bare.x, bare.z)) continue
    found++
    const t = tentsOf(pitchOwnerTents(mm, ok2)).find(q => q.settlement === 's1-9')
    if (!t || ok2(t.x, t.z)) dryAfter++
  }
  ok(found === 3 && dryAfter === 3, `tent beside a shore settlement: ${found} wet pitches without the test, ${dryAfter} dry (or no room) with it`)
}

console.log(`settlement-routes: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
