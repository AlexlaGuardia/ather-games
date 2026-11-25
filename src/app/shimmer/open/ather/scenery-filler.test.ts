// BETA M153 s1a+: the filler shapes. Run: npx tsx src/app/shimmer/open/ather/scenery-filler.test.ts
import { FILLER, SCENERY_BY, TILT_MAX, endSnap, fenceTilt, isSolid, sceneryBoxes, sceneryPlaced, turned } from './scenery'
import * as THREE from 'three'
import { FILLER_IDS, fillerGeometry, tiltMatrix } from './scenery-filler'
import type { Prop } from '../../world/builder-props'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const P = (k: string, o: Partial<Prop> = {}): Prop => ({ id: 'p1', k: `filler:${k}`, x: 10, z: 20, q: 0, s: 1, ...o })
ok(Object.keys(FILLER).sort().join() === [...FILLER_IDS].sort().join(), `palette = built shapes (${FILLER_IDS.length})`)
let tris = 0
for (const id of FILLER_IDS) {
  const g = fillerGeometry(id), b = g.boundingBox!, K = SCENERY_BY.get(`filler:${id}`)!, n = g.getAttribute('position').count / 3, again = fillerGeometry(id)
  tris += n
  const w = 2 * Math.max(b.max.x, -b.min.x), d = 2 * Math.max(b.max.z, -b.min.z)
  ok(Math.abs(b.max.y - K.h) < 0.06 && b.min.y < 0.02 && b.min.y > -0.5 && Math.abs(w - K.w) < 0.2 && Math.abs(d - K.d) < 0.2, `${id}: built ${w.toFixed(2)} x ${d.toFixed(2)} x ${b.max.y.toFixed(2)}, foot ${b.min.y.toFixed(2)}, says ${K.w} x ${K.d} x ${K.h}`)
  ok(n <= 600 && !!g.getAttribute('color') && Array.from(g.getAttribute('position').array).every(Number.isFinite) && Array.from(again.getAttribute('position').array).join() === Array.from(g.getAttribute('position').array).join(), `${id}: ${n} triangles, coloured, the same every load`)
}
ok(tris < 4500, `all of it once: ${tris} triangles`)
const solid = FILLER_IDS.filter(i => isSolid(P(i))).sort().join()
ok(solid === ['fence', 'fence-corner', 'log-fallen', 'rock-large', 'rock-medium', 'sign', 'stump'].sort().join(), `blocks: ${solid}`)
const boxes = (p: Prop) => sceneryBoxes(sceneryPlaced([p], () => 3))
const span = (b: { x0: number; x1: number; z0: number; z1: number }) => [b.x1 - b.x0, b.z1 - b.z0]
const [f0] = boxes(P('fence')), [f1] = boxes(P('fence', { q: 1 })), diag = boxes(P('fence', { q: 0.5 }))
ok(Math.abs(span(f0)[0] - 2) < 1e-9 && span(f0)[1] < 0.2 && Math.abs(span(f1)[1] - 2) < 1e-9 && span(f1)[0] < 0.2, 'a fence blocks as a thin wall, turned with it')
ok(diag.length > 2 && diag.every(b => span(b)[0] < 1 && span(b)[1] < 1), 'on the diagonal it is a chain, not a square')
ok(!diag.some(b => 10.6 > b.x0 && 10.6 < b.x1 && 19.4 > b.z0 && 19.4 < b.z1) && diag.some(b => 10.6 >= b.x0 && 10.6 <= b.x1 && 20.6 >= b.z0 && 20.6 <= b.z1), '...along the drawn diagonal (+x +z at 45), not the other one')
// the corner: an L, the inside quarter open, for every turn
for (const q of [0, 1, 2, 3]) {
  const bs = boxes(P('fence-corner', { q })), hit = (lx: number, lz: number) => { const [x, z] = turned(lx, lz, q); return bs.some(b => 10 + x >= b.x0 && 10 + x <= b.x1 && 20 + z >= b.z0 && 20 + z <= b.z1) }
  ok(hit(0.9, 0) && hit(0, 0.9) && !hit(0.5, 0.5) && !hit(-0.5, 0) && !hit(0, -0.5), `corner, turn ${q}: both arms block, nothing else`)
}
{ const bs = boxes(P('fence-corner', { q: 0.5 })), at = (x: number, z: number) => bs.some(b => 10 + x >= b.x0 && 10 + x <= b.x1 && 20 + z >= b.z0 && 20 + z <= b.z1)
  ok(at(0.6, 0.6) && at(-0.6, 0.6) && !at(0.6, -0.6) && !at(0, 0.7), 'a diagonal corner is two chains along the drawn arms') }
// the DRAWN turn is the blocked turn (three's rotateY(-q * 90))
{ const g = fillerGeometry('fence-corner').rotateY(-1 * Math.PI / 2); g.computeBoundingBox(); const b = g.boundingBox!, [ax, az] = turned(1, 0, 1), [bx, bz] = turned(0, 1, 1); ok(az > 0.99 && bx < -0.99 && Math.abs(ax) < 1e-9 && Math.abs(bz) < 1e-9 && b.max.z > 0.99 && b.min.x < -0.99 && b.max.x < 0.2, 'turned() is the drawn turn') }
// end to end
const a = P('fence'), hand = { k: 'filler:fence', q: 0, s: 1 }
const e = (h: typeof hand, x: number, z: number, ps: Prop[] = [a]) => { const r = endSnap(ps, h, x, z); return r ? `${r.x.toFixed(2)},${r.z.toFixed(2)}` : 'none' }
ok(e(hand, 12.3, 20.4) === '12.00,20.00' && e(hand, 7.7, 19.8) === '8.00,20.00', 'a fence joins on either end, straight on')
ok(e({ ...hand, q: 1 }, 11.2, 21.3) === '11.00,21.00', 'a quarter turned one turns the corner on the end post')
ok(e({ k: 'filler:fence-corner', q: 2, s: 1 }, 12.1, 20.1) === '12.00,20.00', 'a corner piece joins by its arm')
ok(e(hand, 10.1, 20.1) === 'none', 'never on top of the piece already there')
ok(e(hand, 14, 23) === 'none' && e({ ...hand, k: 'filler:stump' }, 12, 20) === 'none' && e(hand, 12, 20, [P('stump')]) === 'none', 'far away, or not fences: the grid decides')
ok(e({ ...hand, s: 1.5 }, 12.4, 20) === '12.50,20.00' && e(hand, 12.4, 20, [P('fence', { s: 1.5 })]) === '12.50,20.00', 'sizes count, both ways')
const dg = endSnap([P('fence', { q: 0.5 })], { ...hand, q: 0.5 }, 11.5, 21.5)!
ok(!!dg && Math.abs(dg.x - 10 - Math.SQRT2) < 1e-9 && Math.abs(dg.z - 20 - Math.SQRT2) < 1e-9, 'on the diagonal too, off the grid')
// ── M168: fences follow a slope ──
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e, put = (p: Prop, g: (x: number, z: number) => number) => sceneryPlaced([p], g)[0]
/** a local point of the piece, as drawn (scenery-view's matrix) */
const drawn = (p: ReturnType<typeof put>, x: number, y: number, z: number) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -p.q * Math.PI / 2), new THREE.Vector3(p.s, p.s, p.s)); if (p.tilt) m.multiply(tiltMatrix(p.tilt)); return new THREE.Vector3(x, y, z).applyMatrix4(m) }
for (const k of ['fence', 'fence-corner']) for (const q of [0, 0.5, 1, 3.3]) { const p = P(k, { q, s: 1.5 }); ok(JSON.stringify(put(p, () => 3)) === JSON.stringify({ ...p, y: 3 }) && !fenceTilt(p, (x, z) => 3 + 2e-5 * Math.sin(x * 99 + z)), `${k} q ${q}: on the level (and on the land's rounding) it is what it was`) }
ok(JSON.stringify(boxes(P('fence'))) === '[{"x0":9,"x1":11,"z0":19.925,"z1":20.075,"y0":2.5,"y1":4.1}]' && boxes(P('fence-corner')).length === 2, 'the level fence blocks as the same one box, number for number')
const hill = (x: number, z: number) => 2 + 0.3 * x - 0.2 * z + 0.02 * x * x
for (const k of ['fence', 'fence-corner']) for (const q of [0, 1, 2, 3, 0.5, 1.7]) for (const s of [0.5, 1, 2]) {
  const p = put(P(k, { q, s }), hill), K = SCENERY_BY.get(`filler:${k}`)!
  ok(!!p.tilt && K.ends!.every(([x, z]) => { const v = drawn(p, x, 0, z), [a, b] = turned(x * s, z * s, q); return near(v.x, 10 + a) && near(v.z, 20 + b) && near(v.y, hill(v.x, v.z)) }), `${k} q ${q} size ${s}: every end stands on the ground, and where it stood`)
  const [[ex, ez]] = K.ends!, foot = drawn(p, ex, 0, ez), top = drawn(p, ex, 1, ez); ok(near(foot.x, top.x) && near(foot.z, top.z) && near(top.y - foot.y, s), '...its posts upright, its own height')
  const bs = sceneryBoxes([p])
  ok(K.ends!.every(([x, z]) => [0.1, 0.5, 0.95].every(f => { const [a, b] = turned(x * s * f, z * s * f, q), top = drawn(p, x * f, 1.1, z * f).y, X = 10 + a, Z = 20 + b, hit = bs.filter(b2 => X >= b2.x0 - 1e-9 && X <= b2.x1 + 1e-9 && Z >= b2.z0 - 1e-9 && Z <= b2.z1 + 1e-9), hi = Math.max(...hit.map(b2 => b2.y1)), lo = Math.min(...hit.map(b2 => b2.y0)); return hit.length > 0 && lo <= top - 1.1 * s - 0.49 && hi >= top - 1e-9 && hi < top + 0.55 })), '...it blocks all along, to about the height it shows')
}
{ const a = put(P('fence'), hill), b = put(P('fence', { id: 'p2', x: 12 }), hill), u = drawn(a, 1, 0.82, 0), v = drawn(b, -1, 0.82, 0); ok(u.distanceTo(v) < 1e-9, 'two fences end to end meet on the slope, rail to rail') }
{ const a = put(P('fence'), hill), c = put(P('fence-corner', { id: 'p2', x: 12, q: 2 }), hill); ok(drawn(a, 1, 0.82, 0).distanceTo(drawn(c, 1, 0.82, 0)) < 1e-9, 'a corner runs on the same way') }
{ const g = (x: number) => (x > 10.5 ? 50 : 0), p = put(P('fence'), g); ok(p.tilt![0] === TILT_MAX && put(P('fence', { q: 2 }), g).tilt![0] === -TILT_MAX, 'no steeper than 45 degrees, either way') }
ok(put(P('fence'), x => (x > 10.5 ? NaN : 0)).tilt === undefined && sceneryPlaced([P('fence')], () => NaN).length === 0, 'an end off the land: level; off the land: not drawn')
for (const k of ['rock-large', 'sign', 'log-fallen', 'reeds']) ok(put(P(k), hill).tilt === undefined && put(P(k), hill).y === hill(10, 20), `${k} never leans`)
{ const p = put(P('fence', { solid: false }), hill); ok(!!p.tilt && sceneryBoxes([p]).length === 0, 'a walk-through fence leans and does not block') }
console.log(fails ? `\n${fails} FAILED` : '\nall pass'); process.exit(fails ? 1 : 0)
