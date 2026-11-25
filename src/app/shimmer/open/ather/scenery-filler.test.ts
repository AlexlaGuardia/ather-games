// BETA M153 s1a+: the filler shapes. Run: npx tsx src/app/shimmer/open/ather/scenery-filler.test.ts
import { FILLER, SCENERY_BY, endSnap, isSolid, sceneryBoxes, sceneryPlaced, turned } from './scenery'
import { FILLER_IDS, fillerGeometry } from './scenery-filler'
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
ok(boxes(P('fence-corner', { q: 0.5 })).length > 4, 'a diagonal corner is two chains')
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
ok(e({ ...hand, s: 1.5 }, 12.4, 20) === '12.50,20.00', 'sizes count')
const dg = endSnap([P('fence', { q: 0.5 })], { ...hand, q: 0.5 }, 11.5, 21.5)!
ok(!!dg && Math.abs(dg.x - 10 - Math.SQRT2) < 1e-9 && Math.abs(dg.z - 20 - Math.SQRT2) < 1e-9, 'on the diagonal too, off the grid')
console.log(fails ? `\n${fails} FAILED` : '\nall pass'); process.exit(fails ? 1 : 0)
