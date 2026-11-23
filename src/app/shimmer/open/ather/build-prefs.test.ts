// BETA M98 s1: snap sizes, turn steps, fine-turned footprints. Run: npx tsx src/app/shimmer/open/ather/build-prefs.test.ts
import { SNAPS, TURN_STEPS, DEFAULT_PREFS, snapTo, normQ, turnQ, nextSnap, nextStep, quad, quadBounds, quadsHit, rectQuad, adoptPrefs, getPrefs, setPrefs } from './build-prefs'
import { canPlacePiece, placePiece, pieceRect, pieceBoxes, freshWorks, chestBox, STARTER_CHEST } from './rooms'
import { STARTING_SQUARES } from './plot'
import { newInv, give } from '../shared/inventory'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e

// snap: each size lands on its grid, freehand passes the raw point through
ok(snapTo(3.37, 1) === 3 && snapTo(3.37, 0.5) === 3.5 && snapTo(3.37, 0.25) === 3.25, 'snap: a size missed its grid')
ok(snapTo(3.37, 0) === 3.37, 'snap: freehand moved the point')
ok(SNAPS.map(nextSnap).join() === '0.5,0.25,0,1', 'snap: the cycle order')
ok(TURN_STEPS.map(nextStep).join() === '45,30,15,90', 'turn: the step cycle order')

// turns: every step closes the circle exactly, the lattice kills float drift, a whole q is untouched
for (const st of TURN_STEPS) { let q = 0; for (let k = 0; k < 360 / st; k++) q = turnQ(q, st); ok(q === 0, `turn: ${st} deg x ${360 / st} did not come home (${q})`) }
{ let q = 0; for (let k = 0; k < 6; k++) q = turnQ(q, 15); ok(q === 1, `turn: six 15 deg turns != one quarter (${q})`) }
ok(turnQ(0, 45) === 0.5 && turnQ(0, 30) === 1 / 3 && turnQ(3.5, 90) === 0.5, 'turn: a step landed off the lattice')
ok([0, 1, 2, 3].every(q => normQ(q) === q) && normQ(-1) === 3 && normQ(5) === 1, 'turn: a legacy quarter turn changed')

// footprints: a whole q gives the OLD rectangle exactly; 45 deg gives the turned box; the quad is the true shape
const old = (w: number, d: number, x: number, z: number, q: number) => { const [hw, hd] = q % 2 ? [d / 2, w / 2] : [w / 2, d / 2]; return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd } }
for (const q of [0, 1, 2, 3]) ok(JSON.stringify(quadBounds(5.25, -3, 1.6, 0.5, q)) === JSON.stringify(old(1.6, 0.5, 5.25, -3, q)), `bounds: q ${q} drifted from the legacy rect`)
for (const q of [0, 1, 2, 3]) ok(JSON.stringify(pieceRect('goldwood_bench', 5.25, -3, q)) === JSON.stringify(old(1.6, 0.5, 5.25, -3, q)), `pieceRect: q ${q} changed for an old save`)
ok(JSON.stringify(chestBox(STARTER_CHEST)) === JSON.stringify(chestBox({ ...STARTER_CHEST })) && chestBox({ x: 0, z: 0, q: 1 }).x1 > 0, 'chestBox: shape')
{ const b = quadBounds(0, 0, 1.6, 0.5, 0.5), h = (1.6 + 0.5) / 2 / Math.SQRT2; ok(near(b.x1, h) && near(b.z1, h) && near(b.x0, -h), '45 deg: the axis box is wrong') }
{ const p = quad(0, 0, 2, 1, 1); ok(near(p[0][0], 0.5) && near(p[0][1], -1), 'quad: a quarter turn turns as rooms.toWorld does') }
ok(quadsHit(rectQuad({ x0: 0, x1: 1, z0: 0, z1: 1 }), rectQuad({ x0: 0.9, x1: 2, z0: 0, z1: 1 })), 'sat: overlapping boxes missed')
ok(!quadsHit(rectQuad({ x0: 0, x1: 1, z0: 0, z1: 1 }), rectQuad({ x0: 1.1, x1: 2, z0: 0, z1: 1 })), 'sat: apart boxes hit')
ok(quadsHit(rectQuad({ x0: 0, x1: 1, z0: 0, z1: 1 }), rectQuad({ x0: 1.1, x1: 2, z0: 0, z1: 1 }), 0.15), 'sat: pad ignored')
// two 45-deg sticks side by side: their axis boxes overlap, the sticks do not
ok(!quadsHit(quad(0, 0, 2, 0.2, 0.5), quad(0.4, -0.4, 2, 0.2, 0.5)), 'sat: parallel 45-deg pieces 0.57 m apart hit')

// placing on the plot: OBB overlap lets two benches sit close at 45 deg where their axis boxes would collide
const owned = new Set<string>(STARTING_SQUARES), P = { x: -130, z: 100 }, bag = give(newInv(12), 'goldwood_bench', 3).inv
const a = placePiece(freshWorks(), owned, bag, 'goldwood_bench', P.x, P.z, 0.5, 1)!
ok(!!a && a.piece.q === 0.5, 'place: a 45 deg bench did not keep its turn')
// the bench's normal at 45 deg: across its depth. 0.8 m out = clear (0.5 deep + 0.15 pad); 0.3 m out = in it
const n = { x: -Math.SQRT1_2, z: Math.SQRT1_2 }
const far = { x: P.x + n.x * 0.8, z: P.z + n.z * 0.8 }, close = { x: P.x + n.x * 0.3, z: P.z + n.z * 0.3 }
const ab = pieceRect('goldwood_bench', P.x, P.z, 0.5), bb = pieceRect('goldwood_bench', far.x, far.z, 0.5)
ok(ab.x0 < bb.x1 && ab.x1 > bb.x0 && ab.z0 < bb.z1 && ab.z1 > bb.z0, 'setup: the axis boxes should overlap')
ok(canPlacePiece(a.works, owned, 'goldwood_bench', far.x, far.z, 0.5, a.inv).ok, 'place: a parallel 45 deg bench 0.8 m off was refused (axis-box overlap, not the real shape)')
ok(!canPlacePiece(a.works, owned, 'goldwood_bench', close.x, close.z, 0.5, a.inv).ok, 'place: a bench 0.3 m off went through the first')
ok(!canPlacePiece(a.works, owned, 'goldwood_bench', P.x, P.z, 0, a.inv).ok, 'place: a crossing bench on the same spot was allowed')
ok(pieceBoxes(a.works).length === 1 && near(pieceBoxes(a.works)[0].x1 - pieceBoxes(a.works)[0].x0, 2 * (1.6 + 0.5) / 2 / Math.SQRT2), 'solid: the walker box is not the turned bench')
// a fine q is stored on the lattice; a shaft (lift) stays on quarter turns
ok(placePiece(freshWorks(), owned, bag, 'goldwood_bench', P.x, P.z, 1 / 6 + 1e-12, 1)!.piece.q === 1 / 6, 'place: q off the lattice was stored')
const lift = placePiece(freshWorks(), owned, give(newInv(12), 'lift', 1).inv, 'lift', P.x, P.z, 0.5, 1)
ok(!lift || Number.isInteger(lift.piece.q), 'place: a lift took a fine turn')

// prefs: junk reads as the default, good values survive, and setPrefs works with storage off (node has none)
ok(JSON.stringify(adoptPrefs(null)) === JSON.stringify(DEFAULT_PREFS) && JSON.stringify(adoptPrefs({ snap: 7, step: 20 })) === JSON.stringify(DEFAULT_PREFS), 'prefs: junk adopted')
ok(JSON.stringify(adoptPrefs({ snap: 0, step: 15 })) === JSON.stringify({ snap: 0, step: 15 }), 'prefs: a good pref was dropped')
ok(DEFAULT_PREFS.snap === 0.25 && DEFAULT_PREFS.step === 90, 'prefs: the default changed how pieces set before M98')
setPrefs({ snap: 0.5, step: 30 }); ok(getPrefs().snap === 0.5 && getPrefs().step === 30, 'prefs: set did not stick without storage')

if (fails.length) { console.error(`build-prefs: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`build-prefs: ${pass}/0`)
