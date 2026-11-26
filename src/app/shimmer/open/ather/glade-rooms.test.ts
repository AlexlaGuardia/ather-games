// npx tsx src/app/shimmer/open/ather/glade-rooms.test.ts   (BETA M153 s1c-3)
import { readFileSync } from 'fs'
import { join } from 'path'
import { GLADE_ROOMS, PROPS_MAX, SCALE_MAX, addProp, changeProp, cleanProp, cleanProps, isRoom, isStanding, pieceCount, propsCanon, putPlace, removeProp, roomOf, type Prop } from '../../world/builder-props'
import { EMPTY_LAYER, cleanLayer } from '../../world/builder'
import { setGladePeople } from './glade-people'
import { gladePlaces } from './glade-places'
import { BENCH_IN, PAD_FALL, ROOM_SIZE, fromRect, padGround, padLevel, rectPoints, rectsOverlap, roomPad, roomPads } from './glade-pads'
import { gladePeople, GLADE_GATE } from './glade-cluster'
import { GLADE_LOTS, gladeJetty } from './moonwell-glade'
import { pondDepthIn } from './relief'
import { gladeHome } from './glade-home'
import { setGladeBlueprint, yarrowCrate } from './glade-lots'
import { parseHouse } from './plot-blueprint'
import { gladeFrame, gladeLayerGround, parseGladeLayer, type GladeLayer } from './glade-layer'
import { FLOOR_UNDER, gladeShapeOf, peopleProblems, placeProblems, walkReach } from './glade-people-check'
import { FURNITURE } from './furniture'
import { terrainWorld } from '../terrain-world'
import { ROOMS, ROOM_ORDER, benchOf, type Room } from './rooms'
import { SCENERY, SCENERY_BY, isSolid, sceneryBoxes, sceneryPlaced } from './scenery'
let bad = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.log('FAIL', m) } }
const J = JSON.stringify, near = (a: number, b: number, e = 1e-3) => Math.abs(a - b) < e, root = join(__dirname, '../../../../..')
for (const l of GLADE_LOTS) setGladeBlueprint(l.id, parseHouse(JSON.parse(readFileSync(join(root, 'world/house-blueprints', `glade-${l.id}.json`), 'utf8'))))
const raw = JSON.parse(readFileSync(join(__dirname, '../../world/glade-edits.json'), 'utf8')), live = parseGladeLayer(raw), land = gladeLayerGround(live.edits)
const base = (live.props ?? []).filter(p => !isRoom(p)), L = (add: Prop[]): GladeLayer => ({ ...live, props: [...base, ...add] })
const R = (k: string, x: number, z: number, q = 0, id = 'pzz1'): Prop => ({ id, k: `room:${k}`, x, z, q, s: 1 })
const nb = gladePeople().find(p => p.who === 'newborn')!
const problems = (add: Prop[]) => { setGladePeople([...base, ...add]); const r = placeProblems(L(add), gladePlaces(), nb); setGladePeople(base); return r }
setGladePeople(base)

// ── the store: an ordinary piece, true size, no toggle
ok(J(cleanProp({ id: 'p1', k: 'room:cooking', x: 1.23456, z: 2, q: 5, s: 2, solid: false, w: 4 })) === J({ id: 'p1', k: 'room:cooking', x: 1.235, z: 2, q: 1, s: 1 }), 'true size, no toggle')
for (const k of ['room:', 'room:farm', 'room:smith', 'room:alchemy', 'room:toString']) ok(cleanProp({ id: 'p1', k, x: 1, z: 1, q: 0, s: 1 }) === null && roomOf(k) === null, `junk ${k}`)
const one = addProp([], { k: 'room:rinnshop', x: 3, z: 4, q: 0.5, s: 1.4 })!
ok(one.length === 1 && one[0].id === 'p1' && one[0].s === 1 && !isStanding(one[0]) && pieceCount(one) === 1, 'placed like a piece, in the cap')
ok(addProp(Array.from({ length: PROPS_MAX }, (_, i) => ({ id: `p${(i + 1).toString(36)}`, k: 'bush:x', x: 0, z: 0, q: 0, s: 1 })), { k: 'room:rinnshop', x: 0, z: 0, q: 0, s: 1 }) === null, 'the cap counts it')
ok(changeProp(one, 'p1', { x: 9, q: 1 })[0].x === 9 && J(removeProp(one, 'p1')) === '[]', 'moved, deleted')
ok(J(cleanLayer({ ...EMPTY_LAYER, props: [] })) === J(EMPTY_LAYER) && cleanProps({ props: one }).length === 1 && J(propsCanon(one)) !== J(propsCanon(changeProp(one, 'p1', { q: 1 }))), 'none = the layer as it was; a turn is a change')

// ── the palette: the plot's own four
ok(SCENERY.filter(s => s.group === 'Rooms').map(s => s.k).join() === 'room:carpentry,room:stonemason,room:rinnshop,room:cooking' && GLADE_ROOMS.every(r => ROOM_ORDER.includes(r)), 'four rooms')
for (const r of GLADE_ROOMS) {
  const K = SCENERY_BY.get(`room:${r}`)!, D = ROOMS[r]
  ok(K.label === D.name && K.w === D.w && K.d === D.d && ROOM_SIZE[r].w === D.w && ROOM_SIZE[r].d === D.d && isSolid({ k: K.k }), `${r}: the plot's name and floor`)
  for (const q of [0, 1, 2, 3]) {
    const b = benchOf({ id: 'x', kind: r, x: 10, z: 20, q, placedAt: 0, doneAt: 0 } as Room), bs = sceneryBoxes(sceneryPlaced([R(r, 10, 20, q)], () => 3)), p = fromRect(roomPad(R(r, 10, 20, q))!, 0, D.d / 2 - BENCH_IN)
    ok(near(p.x, b.x) && near(p.z, b.z) && bs.length === 1 && near((bs[0].x0 + bs[0].x1) / 2, b.x) && near((bs[0].z0 + bs[0].z1) / 2, b.z), `${r} q${q}: its furniture blocks where the plot's stands`)
    const h = r === 'cooking' ? [2, 1.1] : [2.4, 0.8], w = bs[0].x1 - bs[0].x0, d = bs[0].z1 - bs[0].z0; ok(near(q % 2 ? d : w, h[0]) && near(q % 2 ? w : d, h[1]), `${r} q${q}: its size, turned with it`)
  }
}

// ── level on the highest ground, a plinth down to the lowest
const slope = (x: number) => 2 + 0.1 * x, sp = sceneryPlaced([R('carpentry', 0, 0)], slope)[0], sb = sceneryBoxes([sp])
ok(near(sp.y, 2.4) && near(sp.low!, 1.6), 'level on the highest ground under it')
ok(sb.length > 1 && near(sb.filter(b => near(b.y1, 2.4)).reduce((t, b) => t + (b.x1 - b.x0) * (b.z1 - b.z0), 0), 48, 0.5) && sb.some(b => near(b.y1, 3.4)), 'a solid plinth under the whole floor, the bench on it')
ok(sceneryBoxes(sceneryPlaced([R('carpentry', 0, 0)], () => 3)).length === 1, 'flat ground needs none')
const pg = padGround([R('carpentry', 0, 0)], slope); ok(near(pg(-3, 0), 2.4) && near(pg(-5, 0), 1.5) && near(sceneryPlaced([{ id: 'p9', k: 'piece:stool', x: -3, z: 0, q: 0, s: 1 }, { id: 'p8', k: 'tree:grove', x: -3, z: 0, q: 0, s: 1 }], pg)[0].y, 2.4), 'what stands on it stands on its floor')
ok(near(sceneryPlaced([R('carpentry', 0, 0)], pg, slope)[0].low!, 1.6), 'the plinth asks the land, not its own pad')
ok(sceneryPlaced([R('carpentry', 0, 0)], () => NaN).length === 0, 'off the land it is not drawn')

// ── the valley's trees make way
{ const f0 = gladeFrame(L([])).meadow!.trees, t = f0[0], f = gladeFrame(L([R('rinnshop', t.x, t.z)])).meadow!.trees; ok(f0.includes(t) && !f.includes(t) && f.length < f0.length && f.length > f0.length - 30, `a generated tree under a room goes (${f0.length} -> ${f.length})`) }

// ── publish
ok(problems([]).length === 0, `nothing placed: nothing to refuse (${problems([])})`)
const spots: Prop[] = []
for (let x = -150; x <= -60 && spots.length < 4; x += 5) for (let z = 110; z <= 165 && spots.length < 4; z += 5) {
  const v = padLevel({ x, z, yaw: 0, w: 8, d: 7 }, land); if (!(v.top - v.low < (spots.length ? PAD_FALL : 0.45)) || (!spots.length && v.top - v.low < 0.15)) continue
  const c = R(GLADE_ROOMS[spots.length], x, z, 0, `pz${spots.length}`); if (!spots.some(s => Math.hypot(s.x - x, s.z - z) < 14) && !problems([...spots, c]).length) spots.push(c)
}
ok(spots.length === 4, `four stand (${spots.map(s => `${s.x},${s.z}`).join(' ')})`)
const s0 = spots[0], no = (add: Prop[], why: RegExp, m: string) => { const r = problems(add); ok(r.length === 1 && why.test(r[0]), `${m}: ${r.join(' | ')}`) }
const bench = fromRect(roomPad(s0)!, 0, ROOM_SIZE.carpentry.d / 2 - BENCH_IN), at = (u: number, v: number) => fromRect(roomPad(s0)!, u, v)
no([{ ...s0, x: 350, z: 350 }], /^Carpentry room is in the void$/, 'void')
no([{ ...s0, x: -122.5, z: 110.5 }], /Carpentry room is in the Moonwell/, 'pool')
{ const j = gladeJetty(); no([{ ...s0, x: (j.x0 + j.x1) / 2, z: (j.z0 + j.z1) / 2 }], /in the Moonwell/, 'jetty') }
{ const h = gladeHome(); no([{ ...s0, x: h.x, z: h.z }], /Carpentry room (stands in Greg's home|is on a slope)/, 'home') }
{ const j = gladeJetty(), hit: string[] = []; for (const e of [[j.x0, j.z0, j.x0 - j.x1, j.z0 - j.z1], [j.x1, j.z1, j.x1 - j.x0, j.z1 - j.z0]]) for (let m = 2; m < 4.4; m += 0.2) { const k = Math.hypot(e[2], e[3]), x = e[0] + e[2] / k * m, z = e[1] + e[3] / k * m, p = roomPad({ ...s0, x, z })!; if (!rectPoints(p).some(q => pondDepthIn(q.x, q.z) > 0)) hit.push(`${rectsOverlap(p, { x: (j.x0 + j.x1) / 2, z: (j.z0 + j.z1) / 2, yaw: Math.atan2(j.x1 - j.x0, j.z1 - j.z0), w: j.w, d: Math.hypot(j.x1 - j.x0, j.z1 - j.z0) })}:${/in the Moonwell/.test(problems([{ ...s0, x, z }]).join())}`) }
  console.log('  jetty end, dry:', hit.join(' ') || 'never'); ok(hit.every(h => h === 'true:true' || h === 'false:false'), 'the jetty, over dry ground') }
{ const p = at(-3, -1.5), r = problems(putPlace([s0], 'jars', { x: p.x, z: p.z, q: 0 })); ok(r.some(q => /(Yarrow's jars stands in Carpentry room|Carpentry room stands in Yarrow's jars)/.test(q)), `the crate on its floor: ${r}`) }
{ const c = yarrowCrate()!.crate, r = problems([{ ...s0, x: c.x, z: c.z }]); ok(r.some(q => /Carpentry room stands in Yarrow's (house|jars)/.test(q)), `the crate: ${r}`) }
no([s0, { ...R('cooking', s0.x + 5, s0.z, 0, 'pq2') }], /Carpentry room stands in Cooking room/, 'two rooms, said once')
ok(!problems([s0, R('cooking', s0.x + 8, s0.z, 0, 'pq2')]).some(q => /stands in/.test(q)), 'edge to edge is fine')
{ const H = putPlace([s0], 'home', { x: s0.x, z: s0.z - 1, q: 0 }), r = problems(H); ok(r.some(q => /Greg's home stands in Carpentry room/.test(q)), `a house moved onto a room: ${r}`) }
{ // a steep place and wet ones, found on the live land
  let st: Prop | null = null, g: string[] = []; for (let x = -190; x <= 60 && !st; x += 4) for (let z = 60; z <= 220 && !st; z += 4) { const v = padLevel({ x, z, yaw: 0, w: 8, d: 6 }, land); if (v.top - v.low > PAD_FALL && v.top - v.low < 6) { const r = problems([{ ...s0, x, z }]); if (/slope/.test(r.join())) { st = { ...s0, x, z }; g = r } } }
  ok(!!st && g.length === 1 && /is on a slope \(the ground falls [\d.]+ m under it, 1\.5 at most\)/.test(g[0]), `slope: ${g}`)
}
{ const tall = { ...L([]), edits: live.edits }, r = (setGladePeople(base), placeProblems({ ...tall, props: [...base, R('rinnshop', GLADE_GATE.x, GLADE_GATE.z)] }, gladePlaces(), nb)); ok(/Rinnshop is (in the gate|on a slope)/.test(r.join()), `gate: ${r}`) }
// something solid in its furniture; a chair on its floor is fine
no([s0, { id: 'pq3', k: 'filler:rock-large', ...bench, q: 0, s: 1 }], /Carpentry room stands in a solid piece/, 'a rock in the bench')
ok(problems([s0, { id: 'pq3', k: 'filler:rock-large', ...at(-3, -1.5), q: 0, s: 1 }]).length === 0, 'a solid piece on its floor is not in its way')
ok(problems([s0, { id: 'pq3', k: 'filler:rock-large', ...at(0, 0.2), q: 0, s: 1 }]).some(q => /Carpentry room has a bench nobody can stand at/.test(q)), 'a rock in front of the bench')
ok(problems([s0, { id: 'pq3', k: 'filler:sign', ...at(0, 0.6), q: 0, s: 1 }]).some(q => /Carpentry room has a bench nobody can stand at/.test(q)), 'a sign at the bench')
{ const ring: Prop[] = []; for (let s = -7; s <= 7; s += 2) for (const [x, z, q] of [[s, -7, 0], [s, 7, 0], [-7, s, 1], [7, s, 1]]) ring.push({ id: `pr${ring.length}`, k: 'filler:fence', x: s0.x + x, z: s0.z + z, q, s: 2 })
  ok(problems([s0, ...ring]).some(q => /Carpentry room cannot be reached on foot/.test(q)), 'fenced in') }
// M183: a room is a pad (Alex 11-25: his Carpentry room floored in wide slabs, walls and tables round it, refused 'stands in a solid piece')
{ const D = ROOM_SIZE.carpentry.d / 2, spot = at(0, D - BENCH_IN - 1.2), pc = (k: string, p: { x: number; z: number }, i: number, sc = 1): Prop => ({ id: `pm${i}`, k: `piece:${k}`, x: p.x, z: p.z, q: 0, s: sc })
  const floor: Prop[] = []; for (let u = -3; u <= 3; u += 2) for (let v = -2; v <= 2; v += 2) floor.push(pc('stone_slab_wide', at(u, v), floor.length))
  ok(floor.length === 12 && problems([s0, ...floor]).length === 0, `slabs over the whole floor, under the bench and the use spot: ${problems([s0, ...floor])}`)
  ok(problems([s0, pc('stone_slab_wide', bench, 0, SCALE_MAX)]).length === 0, 'the thickest slab the builder can scale lies under the bench')
  ok(problems([s0, ...floor, pc('goldwood_table', at(-2.5, -1.5), 20), pc('goldwood_table', at(2.5, -1.5), 21)]).length === 0, 'tables on the floor')
  no([s0, pc('goldwood_table', bench, 20)], /^Carpentry room stands in a solid piece$/, 'a table in the bench')
  no([s0, ...floor, pc('goldwood_table', bench, 20)], /^Carpentry room stands in a solid piece$/, 'a table in the bench, on the slabs')
  no([s0, ...floor, pc('goldwood_table', spot, 20)], /^Carpentry room has a bench nobody can stand at$/, 'a table on the use spot, on the slabs')
  ok(FLOOR_UNDER >= Math.max(...Object.values(FURNITURE).filter(f => f.slab).map(f => f.h)) * SCALE_MAX && FLOOR_UNDER < Math.min(...sceneryBoxes(sceneryPlaced([s0], () => 3)).map(b => b.y1 - b.y0 - 0.5)) / 2, `FLOOR_UNDER ${FLOOR_UNDER}: the thickest floor, well under the bench`)
  // a room turned off the square (Alex's is at 45 degrees): its bench's boxes are a chain, fatter than the bench; it still publishes
  for (const q of [0.5, 1.5, 0.25]) { const t = { ...s0, q }, ta = (u: number, v: number) => fromRect(roomPad(t)!, u, v)
    ok(problems([t]).length === 0, `turned ${q}: publishes (${problems([t])})`)
    no([t, pc('goldwood_table', ta(0, D - BENCH_IN - 1.4), 20)], /^Carpentry room (has a bench nobody can stand at|stands in a solid piece)$/, `turned ${q}: a table on its use spot`) }
}
// a person in its bench is people's own line; on its floor they stand
{ const ps = (x: number, z: number) => [{ who: 'greg', name: 'Gregory', x, z }]; ok(peopleProblems(L([s0]), ps(bench.x, bench.z)).join() === 'Gregory is inside something solid' && peopleProblems(L([s0]), ps(at(2, -1).x, at(2, -1).z)).length === 0, 'a person in the bench; on the floor') }
// the walker gets on and off it, and is stopped by the bench
{ const sh = gladeShapeOf(L([s0])), w = terrainWorld(sh), go = walkReach(sh, padGround(L([s0]).props, land)), mid = at(0, -0.5), top = padLevel(roomPad(s0)!, land).top
  ok(near(w.floorAt(mid.x, mid.z, top, 0.5)!, top, 0.03) && w.bodyFree(mid.x, mid.z, top) && !w.bodyFree(bench.x, bench.z, top), 'the floor carries a keeper, the bench stops one')
  ok(go(nb, mid) && go(mid, nb), 'on and off on foot') }
console.log(`${n - bad}/${n} glade-rooms${bad ? ' FAIL' : ''}`); process.exit(bad ? 1 : 0)
