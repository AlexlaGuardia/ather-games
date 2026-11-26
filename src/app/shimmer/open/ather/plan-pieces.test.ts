// BETA M143: slabs + wall panels are PLANNED (works.planned), paid at Build. Run: npx tsx src/app/shimmer/open/ather/plan-pieces.test.ts
import { cancelPlan, hasDraft, planSpot, builtUnderPlan } from './plan-draft'
import { billOfAll, buildAll, plannedNeeds } from './plot-bom'
import { PIECE_JOBS, BENCH_JOBS, PLAN_PIECES, FURNITURE, MAX_PIECES } from './furniture'
import { ALL_JOBS } from './station-queue'
import { planPiece, plannedAt, unplan, withPlanned, canPlacePiece, placePiece, pieceBoxes, pieceFloor, slabLift, nearWork, adoptPlanned, loadWorks, saveWorks, KEEP_CLEAR, type Works } from './rooms'
import { findRooms, roomAt, planRun, runKeys, type Walls } from './plot-walls'
import { newInv, give, countOf } from '../shared/inventory'
import { freshBank, putIn, bankCount } from './garden-bank'
import { STARTING_SQUARES, squareAt, sqId } from './plot'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const J = JSON.stringify, own = new Set(STARTING_SQUARES)
const held = (x: number, z: number) => { const s = squareAt(x, z); return !!s && own.has(sqId(s.i, s.j)) }
let X = 0, Z = 0
find: for (let z = -150; z < 150; z++) for (let x = -150; x < 150; x++) if ([[-6, -6], [8, -6], [-6, 6], [8, 6], [0, 0], [4, 4], [5, -5]].every(([a, b]) => held(x + a, z + b)) && KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + 7)) { X = x; Z = z; break find }
const base = (): Works => ({ v: 1, rooms: [], chests: [], pieces: [] })
const plan = (w: Works, item: string, dx: number, dz: number, q = 0, from?: string) => { const r = planPiece(w, own, item, X + dx, Z + dz, q, from); if ('why' in r) throw new Error(`${item}: ${r.why}`); return r.works }
const bag = (n: Record<string, number>) => Object.entries(n).reduce((i, [id, k]) => give(i, id, k).inv, newInv())

// the bench and the catalog
ok(PLAN_PIECES.length === 27 && PLAN_PIECES.every(id => FURNITURE[id].slab || FURNITURE[id].panel || FURNITURE[id].shape), `the 27 pieces: 8 slabs + panels, 9 cut pieces (M169 s2), 9 stairs / railings / fences / ramp (s3), the ladder (s3b) (${PLAN_PIECES.length})`)
ok(PIECE_JOBS.length - BENCH_JOBS.length === 27 && BENCH_JOBS.every(j => !PLAN_PIECES.includes(j.id)), 'the bench lists none of them, everything else as before')
ok(PLAN_PIECES.every(id => ALL_JOBS.some(j => j.id === id)), 'a job already running still finishes (the queue knows it)')
// planning one: nothing spent, nothing solid, nothing near
let w = plan(base(), 'goldwood_slab_wide', 0, 0); w = plan(w, 'stone_slab', 1.5, 0); w = plan(w, 'goldwood_panel_wide', 0, 0, 0.5); w = plan(w, 'brick_panel', 4, 4)
ok(w.planned!.length === 4 && w.pieces.length === 0 && new Set(w.planned!.map(p => p.id)).size === 4, 'four planned, none standing')
ok(pieceBoxes(w).length === 0 && slabLift(w, X, Z) === 0 && nearWork(w, X + 4, Z + 4)?.kind !== 'piece', 'a planned piece is not solid, lifts nothing, answers no E')
ok(pieceFloor(withPlanned(w), w.planned![2]) > pieceFloor(w, w.planned![2]), 'a planned panel is drawn on its planned slab')
ok('why' in planPiece(w, own, 'stone_slab', X, Z, 0) && 'why' in planPiece(w, own, 'goldwood_bench', X + 6, Z, 0), 'slab on planned slab refused; furniture is not planned here')
ok(!canPlacePiece(w, own, 'stone_slab', X, Z, 0, bag({ stone_slab: 1 })).ok && canPlacePiece({ ...w, planned: w.planned!.slice(0, 2) }, own, 'goldwood_bench', X, Z, 0).ok && !canPlacePiece(w, own, 'goldwood_bench', X, Z, 0).ok, 'a real slab does not go into a planned one; furniture may stand on a planned slab, not in a planned panel')
// picking / moving
ok(plannedAt(w, X, Z)?.item === 'goldwood_panel_wide' && plannedAt(w, X - 0.9, Z + 0.9)?.item === 'goldwood_slab_wide' && plannedAt(w, X + 0.6, Z + 0.6)?.item === 'goldwood_panel_wide' && plannedAt(w, X + 9, Z + 9) === null, 'the piece under a tap, a panel before its slab, turned footprint')
{ const id = w.planned![3].id, m = plan(w, 'brick_panel', 4.2, 4, 0, id); ok(m.planned!.length === 4 && !m.planned!.some(p => p.id === id) && m.planned!.some(p => p.x === X + 4.2), 'a move takes the old one off (and may overlap where it stood)')
  ok(unplan(w, id).planned!.length === 3 && !('planned' in unplan(unplan({ ...w, planned: [w.planned![0]] }, w.planned![0].id), 'x')), 'the last one off leaves no list') }
// the bill
const n = Object.fromEntries(plannedNeeds(w.planned).map(c => [c.id, c.n]))
ok(n.goldwood_plank === 7 && n.stone_brick === 3, `list ${J(n)} (4 + 3 planks, 1 + 2 bricks: the crafted prices)`)
const short = billOfAll(w, bag({ goldwood_plank: 6, stone_brick: 3 }), null)
ok(!short.ok && !short.empty && short.set.length === 4 && !buildAll(w, bag({ goldwood_plank: 6, stone_brick: 3 }), null).ok, 'one plank short: no Build')
{ const inv = bag({ goldwood_plank: 10, stone_brick: 3 }), r = buildAll(w, inv, null)
  ok(r.ok && countOf(r.inv, 'goldwood_plank') === 3 && countOf(r.inv, 'stone_brick') === 0 && r.works.pieces.length === 4 && !r.works.planned && pieceBoxes(r.works).length > 4 - 1, 'Build takes exactly that; they stand, solid, no longer planned')
  ok(r.ok && billOfAll(r.works, r.inv, null).empty && !hasDraft(r.works) && !buildAll(r.works, r.inv, null).ok, 'built once: nothing left to pay')
  const bk = putIn(freshBank(), 10, 'goldwood_plank', 5).bank, rb = buildAll(w, bag({ goldwood_plank: 2, stone_brick: 3 }), bk)
  ok(rb.ok && bankCount(rb.bank!, 'goldwood_plank') === 0 && countOf(rb.inv, 'goldwood_plank') === 0, 'the Keepstone pays with the bag')
  // one bill with a drawn wall: planks add up before they are checked
  const wl = { ...w, walls: planRun({}, runKeys({ i: X + 5, j: Z - 5 }, { i: X + 7, j: Z - 5 }), 'goldwood') }, need = billOfAll(wl, inv, null).lines.find(l => l.id === 'goldwood_plank')!.n
  ok(need === 10 && !buildAll(wl, bag({ goldwood_plank: 9, stone_brick: 3 }), null).ok && buildAll(wl, inv, null).ok, `a wall and the pieces on one bill (${need})`) }
// cancel, edit
{ const c = cancelPlan({ ...base(), planned: w.planned }); ok(J(c) === J(base()) && hasDraft(w) && !hasDraft(c), 'cancel = the save before, to the byte')
  const s = planSpot({ walls: {}, planned: w.planned } as any, 1); ok(s?.level === 0 && Math.abs(s.x - X - 2) < 0.51, 'Edit goes to the pieces, ground floor') }
// an old save: crafted in the bag, placed on the plot: untouched, placed free
{ const old: Works = { ...base(), pieces: [{ id: 'a', item: 'goldwood_slab', x: X, z: Z, q: 0.5, placedAt: 5 }] }, inv = bag({ goldwood_slab: 2 })
  ok(billOfAll(old, inv, null).empty && cancelPlan(old) === old, 'nothing to pay, nothing to cancel')
  const p = placePiece(old, own, inv, 'goldwood_slab', X + 3, Z, 0); ok(!!p && p.works.pieces.length === 2 && countOf(p.inv, 'goldwood_slab') === 1 && billOfAll(p.works, p.inv, null).empty, 'a crafted one is set free, at once') 
  const store: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem() {}, key: () => null, length: 0 }
  saveWorks(old); ok(J(loadWorks().pieces) === J(old.pieces) && !('planned' in loadWorks()), 'loads as it was, no plan list')
  saveWorks(w); ok(J(loadWorks().planned!.map(p => [p.id, p.x, p.q])) === J(w.planned!.map(p => [p.id, p.x, p.q])) && loadWorks().pieces.length === 0, 'a plan survives a reload, still a plan') }
ok(adoptPlanned([{ id: 'x', item: 'goldwood_bench', x: 1, z: 1 }, { id: 'y', item: 'stone_slab', x: NaN, z: 1 }, null, 7]).length === 0 && adoptPlanned('no').length === 0, 'the loader keeps only real ones')
{ const full: Works = { ...base(), pieces: Array.from({ length: MAX_PIECES - 1 }, (_, i) => ({ id: 'f' + i, item: 'goldwood_stool', x: 900, z: 900, q: 0, placedAt: 0 })), planned: [w.planned![3]] }
  ok('why' in planPiece(full, own, 'stone_slab', X, Z, 0), 'planned ones count to the plot\'s cap, so Build never passes it') }
// the floor of a built room under a drafted divider is not repainted
{ const sq: Walls = {}; for (let i = 0; i < 4; i++) for (const k of [`h,${i},0`, `h,${i},4`, `v,0,${i}`, `v,4,${i}`]) (sq as any)[k] = { mat: 'goldwood' }
  const key = findRooms(sq)[0].key, div = planRun(sq, runKeys({ i: 2, j: 0 }, { i: 2, j: 4 }), 'goldwood'), rs = findRooms(div), r0 = roomAt(rs, 1, 1)!, r1 = roomAt(rs, 3, 1)!
  ok(rs.length === 2 && [r0, r1].every(r => builtUnderPlan(div, { [key]: 16 }, r) || r.key === key) && [r0, r1].some(r => builtUnderPlan(div, { [key]: 16 }, r)), 'a half of a paid room is known as built')
  ok([r0, r1].every(r => !builtUnderPlan(div, {}, r)) && !builtUnderPlan(sq, { [key]: 16 }, findRooms(sq)[0]), 'an unpaid room or the whole paid one paints as before') 
  console.log('  keys', key, r0.key, r1.key) }
console.log(`plan-pieces: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  x', f); if (fails.length) process.exit(1)
