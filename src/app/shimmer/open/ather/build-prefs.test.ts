// BETA M98 s1: snap sizes, turn steps, fine-turned footprints. Run: npx tsx src/app/shimmer/open/ather/build-prefs.test.ts
import { SNAPS, TURN_STEPS, DEFAULT_PREFS, snapTo, normQ, turnQ, nextSnap, nextStep, quad, quadBounds, quadsHit, rectQuad, adoptPrefs, getPrefs, setPrefs, anchorSnap, flushAxis, getAnchor, setAnchor, subscribeAnchor, type Anchor } from './build-prefs'
import { canPlacePiece, placePiece, pieceRect, pieceBoxes, freshWorks, chestBox, STARTER_CHEST, slabLift, pieceFloor, panelChain } from './rooms'
import { WALL_T, WALL_H } from './plot-walls'
import { FURNITURE } from './furniture'
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

// ── M98 s2 ANCHOR ──
// no anchor or freehand: exactly the world snap (s1 unchanged)
{ const [x, z] = anchorSnap(3.37, -1.62, 0.5, null, 1, 1, 0); ok(x === 3.5 && z === -1.5, 'anchor: null anchor is not the world snap') }
{ const a: Anchor = { x: 0.3, z: 0.7, q: 0.5, w: 1.6, d: 0.5 }; const [x, z] = anchorSnap(3.37, -1.62, 0, a, 1, 1, 0.5); ok(x === 3.37 && z === -1.62, 'anchor: freehand moved the point') }
// flushAxis: a 1.6 bench anchor, a 1.0 piece, snap 1: beside it lands touching (0.8 + 0.5 = 1.3), not on a 0.2 lattice
ok(near(flushAxis(1.35, 0.8, 0.5, 1, true), 1.3), 'anchor: touching on the right missed')
ok(near(flushAxis(-1.25, 0.8, 0.5, 1, true), -1.3), 'anchor: touching on the left missed')
ok(near(flushAxis(0.9, 0.8, 0.5, 1, true), 1.3), 'anchor: beside stepped back into the anchor')
ok(near(flushAxis(2.4, 0.8, 0.5, 1, true), 2.3), 'anchor: a step out is not a snap step from touching')
ok(near(flushAxis(0.31, 0.8, 0.5, 1, false), 0.3) && near(flushAxis(-0.4, 0.8, 0.5, 1, false), -0.3), 'anchor: edges in line missed')
ok(near(flushAxis(0.1, 0.25, 0.25, 1, false), 0), 'anchor: same-depth row did not stay in line')
// a 45 deg anchor (q 0.5): the next piece at the same turn lands touching along the anchor's own axis, in line, no overlap, no gap
{ const a: Anchor = { x: 2, z: 3, q: 0.5, w: 1.6, d: 0.5 }, c = Math.SQRT1_2
  const at = (l: number, m: number) => [a.x + l * c - m * c, a.z + l * c + m * c]   // anchor-local (l along, m across) to world
  const loc = (x: number, z: number) => [(x - a.x) * c + (z - a.z) * c, -(x - a.x) * c + (z - a.z) * c]
  const r1 = at(1.4, 0.07), [x, z] = anchorSnap(r1[0], r1[1], 0.25, a, 1.6, 0.5, 0.5), [lx, lz] = loc(x, z)
  ok(near(lx, 1.6, 1e-6) && near(lz, 0, 1e-6), `anchor: 45 deg row neighbour not flush (${lx}, ${lz})`)
  ok(!quadsHit(quad(a.x, a.z, a.w, a.d, a.q), quad(x, z, 1.6, 0.5, 0.5), -0.001), 'anchor: flush neighbour overlaps the anchor')
  ok(quadsHit(quad(a.x, a.z, a.w, a.d, a.q), quad(x, z, 1.6, 0.5, 0.5), 0.001), 'anchor: flush neighbour leaves a gap')
  // a ghost turned a quarter off the anchor swaps its extents (its 0.5 depth runs along the anchor's x: touching at 1.05)
  const r2 = at(1.1, 0), [x2, z2] = anchorSnap(r2[0], r2[1], 0.25, a, 1.6, 0.5, 1.5), [lx2] = loc(x2, z2)
  ok(near(lx2, 1.05, 1e-6), `anchor: quarter-turned ghost did not use its swapped extent (${lx2})`)
  // a ghost at 15 deg to the anchor (q 0.5 + 1/6) snaps its centre on the anchor grid, no flush
  const [x3, z3] = anchorSnap(r1[0], r1[1], 1, a, 1.6, 0.5, 0.5 + 1 / 6), [lx3, lz3] = loc(x3, z3)
  ok(near(lx3, 1, 1e-6) && near(lz3, 0, 1e-6), `anchor: off-square ghost not on the anchor grid (${lx3}, ${lz3})`)
  // in front of the anchor (across its depth): touching its long face, left edges in line
  const r4 = at(-0.3, 0.9), [x4, z4] = anchorSnap(r4[0], r4[1], 0.5, a, 1, 1, 0.5), [lx4, lz4] = loc(x4, z4)
  ok(near(lz4, 0.75, 1e-6) && near(lx4, -0.3, 1e-6), `anchor: in-front ghost not touching / in line (${lx4}, ${lz4})`) }
// a whole-q anchor on the world axes: outputs are clean numbers (no float dust from cos/sin)
{ const a: Anchor = { x: 0.13, z: 0, q: 1, w: 1.6, d: 0.5 }; const [x, z] = anchorSnap(0.2, 1.7, 0.5, a, 1.6, 0.5, 1)
  ok(x === 0.13 && z === 1.6, `anchor: whole-q anchor gave dust or the wrong flush (${x}, ${z})`) }
// placing against the anchor: the flush neighbour of a 45 deg bench is ALLOWED (furniture may touch furniture), 2 cm into it is not
{ const an: Anchor = { x: P.x, z: P.z, q: 0.5, w: 1.6, d: 0.5 }, [fx, fz] = anchorSnap(P.x, P.z, 1, an, 1.6, 0.5, 0.5)
  ok(canPlacePiece(a.works, owned, 'goldwood_bench', fx, fz, 0.5, a.inv).ok, 'anchor: the flush neighbour was refused (piece clearance pad)')
  const back = 0.02 * Math.SQRT1_2
  ok(!canPlacePiece(a.works, owned, 'goldwood_bench', fx - back, fz - back, 0.5, a.inv).ok, 'anchor: a bench 2 cm into the anchor was allowed') }
// ── M98b b1: floor slabs ──
{ const sb = give(give(newInv(12), 'goldwood_slab_wide', 3).inv, 'goldwood_bench', 1).inv
  const s1 = placePiece(freshWorks(), owned, sb, 'goldwood_slab_wide', P.x, P.z, 0.5, 1)!
  ok(!!s1, 'slab: a 45 deg wide slab was refused on open ground')
  const base = pieceFloor(freshWorks(), { item: 'goldwood_bench', x: P.x, z: P.z })
  ok(near(slabLift(s1.works, P.x, P.z), 0.12) && near(pieceFloor(s1.works, { item: 'goldwood_bench', x: P.x, z: P.z }), base + 0.12), 'slab: a piece on it is not lifted by its top')
  ok(near(pieceFloor(s1.works, { item: 'goldwood_slab_wide', x: P.x, z: P.z }), base), 'slab: a slab lifted itself')
  ok(slabLift(s1.works, P.x + 0.95, P.z + 0.95) === 0, 'slab: a point in its axis box but off the turned slab was lifted')
  const onIt = placePiece(s1.works, owned, s1.inv, 'goldwood_bench', P.x, P.z, 0.5, 2)
  ok(!!onIt, 'slab: a bench could not stand on the slab')
  const bb = pieceBoxes(onIt!.works).find((_, i, a) => i === a.length - 1)!
  ok(near(bb.y1, base + 0.12 + 0.5), `slab: the bench's walker box did not ride the slab (${bb.y1})`)
  ok(!canPlacePiece(s1.works, owned, 'goldwood_slab_wide', P.x + 0.3, P.z, 0.5, s1.inv).ok, 'slab: a slab overlapping a slab was allowed')
  const an: Anchor = { x: P.x, z: P.z, q: 0.5, w: 2, d: 2 }, [fx, fz] = anchorSnap(P.x + 2, P.z + 2, 1, an, 2, 2, 0.5)
  ok(canPlacePiece(s1.works, owned, 'goldwood_slab_wide', fx, fz, 0.5, s1.inv).ok, 'slab: the anchored flush neighbour slab was refused')
  const sw = pieceBoxes(s1.works)[0]; ok(near(sw.y1, base + 0.12), 'slab: its walker top is not its thickness') }
// M98b: over a SLAB anchor a piece stays ON it (edges in line), a slab ghost still lands flush beside it
{ const a: Anchor = { x: 0, z: 0, q: 0, w: 2, d: 2, floor: true }
  const [bx, bz] = anchorSnap(0.1, 0.2, 0.5, a, 1.6, 0.5, 0, true); ok(near(bx, 0.2) && near(bz, 0.25), `onto: bench over a slab anchor was not kept on it (${bx}, ${bz})`)
  const [sx, sz] = anchorSnap(0.1, 0.2, 0.5, a, 2, 2, 0, false); ok(near(sx, 0) && near(Math.abs(sz), 2), `onto: a slab over a slab anchor did not land beside it (${sx}, ${sz})`)
  const [ox] = anchorSnap(1.9, 0, 0.5, a, 1.6, 0.5, 0, true); ok(near(ox, 1.8), `onto: a bench off the slab anchor was not flush outside (${ox})`)
  const [nx, nz] = anchorSnap(0.1, 0.2, 0.5, { ...a, floor: false }, 1.6, 0.5, 0, true); ok(near(Math.abs(nz), 1.25) || near(Math.abs(nx), 1.8), `onto: a non-floor anchor kept a piece on top (${nx}, ${nz})`) }
// ── M98b b2: wall panels ──
for (const id of ['goldwood_panel', 'goldwood_panel_wide', 'brick_panel', 'brick_panel_wide']) ok(FURNITURE[id]?.panel === true && FURNITURE[id].d === WALL_T && FURNITURE[id].h === WALL_H, `panel: ${id} is not a drawn wall's size`)
{ const pb = give(give(newInv(12), 'goldwood_panel_wide', 3).inv, 'goldwood_slab_wide', 1).inv
  const w45 = placePiece(freshWorks(), owned, pb, 'goldwood_panel_wide', P.x, P.z, 0.5, 1)!
  ok(!!w45, 'panel: a 45 deg wide panel was refused on open ground')
  const bx = pieceBoxes(w45.works), inBox = (x: number, z: number) => bx.some(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1)
  ok(bx.length === 7, `panel: a 2 m panel at 45 deg is not a chain of 7 boxes (${bx.length})`)
  ok(bx.every(b => near(b.y1 - b.y0, WALL_H + 0.5)), 'panel: the chain is not wall height')
  ok(inBox(P.x, P.z) && inBox(P.x + 0.65, P.z + 0.65) && inBox(P.x - 0.65, P.z - 0.65), 'panel: a point on the 45 deg panel is not blocked')
  ok(!inBox(P.x + 0.6, P.z - 0.6) && !inBox(P.x - 0.6, P.z + 0.6), 'panel: the walker is blocked off the panel (one fat axis box)')
  const sq = placePiece(freshWorks(), owned, pb, 'goldwood_panel_wide', P.x, P.z, 1, 1)!, sb = pieceBoxes(sq.works)
  ok(sb.length === 1 && near(sb[0].x1 - sb[0].x0, WALL_T) && near(sb[0].z1 - sb[0].z0, 2), 'panel: a square-turned panel is not its one exact box')
  ok(panelChain(0, 0, 1, 0.3, 0.5).length === 4 && panelChain(0, 0, 0.3, 0.3, 0.5).length === 1, 'panel: chain length')
  // a run: the next panel anchored on the first lands flush along its axis and may be set
  const an: Anchor = { x: P.x, z: P.z, q: 0.5, w: 2, d: WALL_T }, [fx, fz] = anchorSnap(P.x + 1.5, P.z + 1.4, 0.5, an, 2, WALL_T, 0.5)
  const c = Math.SQRT1_2, lx = (fx - P.x) * c + (fz - P.z) * c, lz = -(fx - P.x) * c + (fz - P.z) * c
  ok(near(lx, 2, 1e-6) && near(lz, 0, 1e-6), `panel: the run's next panel is not flush in line (${lx}, ${lz})`)
  ok(canPlacePiece(w45.works, owned, 'goldwood_panel_wide', fx, fz, 0.5, w45.inv).ok, 'panel: the flush next panel was refused')
  // on a slab: allowed, and lifted by it
  const sl = placePiece(freshWorks(), owned, pb, 'goldwood_slab_wide', P.x, P.z, 0.5, 1)!, onS = placePiece(sl.works, owned, sl.inv, 'goldwood_panel_wide', P.x, P.z, 0.5, 2)
  ok(!!onS && pieceBoxes(onS.works).filter(b => near(b.y1 - b.y0, WALL_H + 0.5)).every(b => near(b.y0, pieceFloor(freshWorks(), { item: 'goldwood_slab', x: P.x, z: P.z }) + 0.12 - 0.5)), 'panel: a panel on a slab does not stand on it') }
// the store: set, read, clear, subscribers told
{ let told = 0; const off = subscribeAnchor(() => told++)
  setAnchor({ x: 1, z: 2, q: 0.5, w: 1, d: 1 }); ok(getAnchor()?.q === 0.5, 'anchor: set did not stick'); setAnchor(null); ok(getAnchor() === null && told === 2, 'anchor: clear / notify'); off() }

if (fails.length) { console.error(`build-prefs: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`build-prefs: ${pass}/0`)
